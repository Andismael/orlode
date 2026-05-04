/**
 * Connectors Controller
 * Endpoints for all data connector operations.
 */
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { webCrawlerService } from '../services/connectors/webCrawlerService';
import { databaseConnectorService } from '../services/connectors/databaseConnectorService';
import type { DatabaseConnectorConfig, DbType } from '../services/connectors/databaseConnectorService';
import { videoConnectorService } from '../services/connectors/videoConnectorService';
import type { VideoCategory } from '../services/connectors/videoConnectorService';
import { audioConnectorService } from '../services/connectors/audioConnectorService';
import type { AudioCategory } from '../services/connectors/audioConnectorService';
import { apiConnectorService } from '../services/connectors/apiConnectorService';
import type { APIConnectorConfig } from '../services/connectors/apiConnectorService';
import { ecommerceConnectorService } from '../services/connectors/ecommerceConnectorService';
import type { ShopifyConfig, WooCommerceConfig } from '../services/connectors/ecommerceConnectorService';
import { connectorManager } from '../services/connectors/connectorManager';
import { logger } from '../utils/logger';

function getCompanyId(req: AuthenticatedRequest): string {
  const id = req.user?.companyId;
  if (!id) throw new AppError('Company ID required', 400);
  return id;
}

// ── GET /api/connectors — list all connectors + stats ────────────────────────
export async function getConnectors(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const stats = await connectorManager.getStats(companyId);
  res.json({ success: true, data: stats });
}

// ── DELETE /api/connectors/:id ────────────────────────────────────────────────
export async function deleteConnector(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const { id } = req.params as { id: string };
  await connectorManager.deleteConnector(companyId, id);
  res.json({ success: true });
}

// ══ WEB CRAWLER ══════════════════════════════════════════════════════════════

// POST /api/connectors/web/crawl
export async function crawlWebsite(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const { siteUrl, crawlDepth = 3, maxPages = 100, includePatterns, excludePatterns, schedule = 'weekly' } = req.body as {
    siteUrl: string; crawlDepth?: number; maxPages?: number;
    includePatterns?: string[]; excludePatterns?: string[]; schedule?: 'once' | 'daily' | 'weekly' | 'monthly';
  };

  if (!siteUrl) throw new AppError('siteUrl is required', 400);

  const config = { companyId, siteUrl, crawlDepth, maxPages, includePatterns, excludePatterns, schedule };

  // Save config first
  await webCrawlerService.saveConfig(companyId, config);

  // Acknowledge immediately, crawl async
  res.json({ success: true, message: 'Crawl started', status: 'processing' });

  setImmediate(async () => {
    try {
      const result = await webCrawlerService.crawlWebsite(config);
      logger.info(`[Connectors] Web crawl complete for company ${companyId}`, result);
    } catch (err) {
      logger.error(`[Connectors] Web crawl failed for company ${companyId}`, { error: err });
    }
  });
}

// POST /api/connectors/web/recrawl
export async function recrawlWebsite(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const config = await webCrawlerService.getConfig(companyId);
  if (!config) throw new AppError('No web connector configured', 404);

  res.json({ success: true, message: 'Re-crawl started' });

  setImmediate(async () => {
    try {
      await webCrawlerService.recrawl(companyId, config);
    } catch (err) {
      logger.error(`[Connectors] Re-crawl failed for company ${companyId}`, { error: err });
    }
  });
}

// ══ DATABASE ═════════════════════════════════════════════════════════════════

// POST /api/connectors/database/test
export async function testDatabaseConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { type, host, port, database, username, password, ssl = true } = req.body as {
    type: DbType; host: string; port: number; database: string;
    username: string; password: string; ssl?: boolean;
  };

  const result = await databaseConnectorService.testConnection(type, { host, port, database, username, password, ssl });
  res.json({ success: result.ok, error: result.error });
}

// POST /api/connectors/database/discover
export async function discoverDatabaseSchema(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { type, host, port, database, username, password, ssl = true } = req.body as {
    type: DbType; host: string; port: number; database: string;
    username: string; password: string; ssl?: boolean;
  };

  const tables = await databaseConnectorService.discoverSchema(type, { host, port, database, username, password, ssl });
  res.json({ success: true, data: { tables } });
}

// POST /api/connectors/database/sync
export async function syncDatabase(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const config = req.body as DatabaseConnectorConfig;
  config.companyId = companyId;

  await databaseConnectorService.saveConfig(config);
  res.json({ success: true, message: 'Database sync started' });

  setImmediate(async () => {
    try {
      const result = await databaseConnectorService.syncDatabase(config);
      logger.info(`[Connectors] DB sync complete for company ${companyId}`, result);
    } catch (err) {
      logger.error(`[Connectors] DB sync failed for company ${companyId}`, { error: err });
    }
  });
}

// ══ VIDEO ═════════════════════════════════════════════════════════════════════

// POST /api/connectors/video/process
export async function processVideo(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const { source, url, title, category = 'other' } = req.body as {
    source: 'upload' | 'youtube' | 'url'; url?: string; title?: string; category?: VideoCategory;
  };

  const file = (req as unknown as { file?: Express.Multer.File }).file;

  if (!url && !file) throw new AppError('url or file upload required', 400);

  const config = {
    companyId,
    source,
    url,
    title,
    category,
    fileBuffer: file?.buffer,
    mimeType: file?.mimetype,
  };

  res.json({ success: true, message: 'Video processing started' });

  setImmediate(async () => {
    try {
      const result = await videoConnectorService.processVideo(config);
      logger.info(`[Connectors] Video processed for company ${companyId}`, result);
    } catch (err) {
      logger.error(`[Connectors] Video processing failed for company ${companyId}`, { error: err });
    }
  });
}

// ══ AUDIO ════════════════════════════════════════════════════════════════════

// POST /api/connectors/audio/process
export async function processAudio(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const { source, url, title, category = 'other' } = req.body as {
    source: 'upload' | 'url' | 'podcast_rss'; url?: string; title?: string; category?: AudioCategory;
  };

  const file = (req as unknown as { file?: Express.Multer.File }).file;

  if (source === 'podcast_rss') {
    if (!url) throw new AppError('url (RSS feed) required', 400);
    res.json({ success: true, message: 'Podcast import started' });
    setImmediate(async () => {
      try {
        const result = await audioConnectorService.importPodcastFeed(companyId, url, 20);
        logger.info(`[Connectors] Podcast import done for company ${companyId}`, result);
      } catch (err) {
        logger.error(`[Connectors] Podcast import failed for company ${companyId}`, { error: err });
      }
    });
    return;
  }

  if (!url && !file) throw new AppError('url or file upload required', 400);

  res.json({ success: true, message: 'Audio processing started' });
  setImmediate(async () => {
    try {
      const result = await audioConnectorService.processAudio({
        companyId, source, url, title, category,
        fileBuffer: file?.buffer, mimeType: file?.mimetype,
      });
      logger.info(`[Connectors] Audio processed for company ${companyId}`, result);
    } catch (err) {
      logger.error(`[Connectors] Audio processing failed for company ${companyId}`, { error: err });
    }
  });
}

// ══ API CUSTOM ════════════════════════════════════════════════════════════════

// POST /api/connectors/api/test
export async function testAPIConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const { name, baseUrl, authType, credentials } = req.body as Pick<APIConnectorConfig, 'name' | 'baseUrl' | 'authType' | 'credentials'>;
  const result = await apiConnectorService.testConnection({ companyId, name, baseUrl, authType, credentials });
  res.json({ success: result.ok, error: result.error });
}

// POST /api/connectors/api/sync
export async function syncAPI(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const config = req.body as APIConnectorConfig;
  config.companyId = companyId;

  await apiConnectorService.saveConfig(config);
  res.json({ success: true, message: 'API sync started' });

  setImmediate(async () => {
    try {
      const result = await apiConnectorService.syncAPI(config);
      logger.info(`[Connectors] API sync complete for company ${companyId}`, result);
    } catch (err) {
      logger.error(`[Connectors] API sync failed for company ${companyId}`, { error: err });
    }
  });
}

// ══ E-COMMERCE ════════════════════════════════════════════════════════════════

// POST /api/connectors/ecommerce/shopify
export async function syncShopify(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const config = req.body as ShopifyConfig;
  config.companyId = companyId;

  await ecommerceConnectorService.saveShopifyConfig(config);
  res.json({ success: true, message: 'Shopify sync started' });

  setImmediate(async () => {
    try {
      const result = await ecommerceConnectorService.syncEcommerce(config);
      logger.info(`[Connectors] Shopify sync complete for company ${companyId}`, result);
    } catch (err) {
      logger.error(`[Connectors] Shopify sync failed for company ${companyId}`, { error: err });
    }
  });
}

// POST /api/connectors/ecommerce/woocommerce
export async function syncWooCommerce(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = getCompanyId(req);
  const config = req.body as WooCommerceConfig;
  config.companyId = companyId;

  await ecommerceConnectorService.saveWooConfig(config);
  res.json({ success: true, message: 'WooCommerce sync started' });

  setImmediate(async () => {
    try {
      const result = await ecommerceConnectorService.syncEcommerce(config);
      logger.info(`[Connectors] WooCommerce sync complete for company ${companyId}`, result);
    } catch (err) {
      logger.error(`[Connectors] WooCommerce sync failed for company ${companyId}`, { error: err });
    }
  });
}
