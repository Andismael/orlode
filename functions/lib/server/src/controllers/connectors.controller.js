"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectors = getConnectors;
exports.deleteConnector = deleteConnector;
exports.crawlWebsite = crawlWebsite;
exports.recrawlWebsite = recrawlWebsite;
exports.testDatabaseConnection = testDatabaseConnection;
exports.discoverDatabaseSchema = discoverDatabaseSchema;
exports.syncDatabase = syncDatabase;
exports.processVideo = processVideo;
exports.processAudio = processAudio;
exports.testAPIConnection = testAPIConnection;
exports.syncAPI = syncAPI;
exports.syncShopify = syncShopify;
exports.syncWooCommerce = syncWooCommerce;
const error_middleware_1 = require("../middleware/error.middleware");
const webCrawlerService_1 = require("../services/connectors/webCrawlerService");
const databaseConnectorService_1 = require("../services/connectors/databaseConnectorService");
const videoConnectorService_1 = require("../services/connectors/videoConnectorService");
const audioConnectorService_1 = require("../services/connectors/audioConnectorService");
const apiConnectorService_1 = require("../services/connectors/apiConnectorService");
const ecommerceConnectorService_1 = require("../services/connectors/ecommerceConnectorService");
const connectorManager_1 = require("../services/connectors/connectorManager");
const logger_1 = require("../utils/logger");
function getCompanyId(req) {
    const id = req.user?.companyId;
    if (!id)
        throw new error_middleware_1.AppError('Company ID required', 400);
    return id;
}
// ── GET /api/connectors — list all connectors + stats ────────────────────────
async function getConnectors(req, res) {
    const companyId = getCompanyId(req);
    const stats = await connectorManager_1.connectorManager.getStats(companyId);
    res.json({ success: true, data: stats });
}
// ── DELETE /api/connectors/:id ────────────────────────────────────────────────
async function deleteConnector(req, res) {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    await connectorManager_1.connectorManager.deleteConnector(companyId, id);
    res.json({ success: true });
}
// ══ WEB CRAWLER ══════════════════════════════════════════════════════════════
// POST /api/connectors/web/crawl
async function crawlWebsite(req, res) {
    const companyId = getCompanyId(req);
    const { siteUrl, crawlDepth = 3, maxPages = 100, includePatterns, excludePatterns, schedule = 'weekly' } = req.body;
    if (!siteUrl)
        throw new error_middleware_1.AppError('siteUrl is required', 400);
    const config = { companyId, siteUrl, crawlDepth, maxPages, includePatterns, excludePatterns, schedule };
    // Save config first
    await webCrawlerService_1.webCrawlerService.saveConfig(companyId, config);
    // Acknowledge immediately, crawl async
    res.json({ success: true, message: 'Crawl started', status: 'processing' });
    setImmediate(async () => {
        try {
            const result = await webCrawlerService_1.webCrawlerService.crawlWebsite(config);
            logger_1.logger.info(`[Connectors] Web crawl complete for company ${companyId}`, result);
        }
        catch (err) {
            logger_1.logger.error(`[Connectors] Web crawl failed for company ${companyId}`, { error: err });
        }
    });
}
// POST /api/connectors/web/recrawl
async function recrawlWebsite(req, res) {
    const companyId = getCompanyId(req);
    const config = await webCrawlerService_1.webCrawlerService.getConfig(companyId);
    if (!config)
        throw new error_middleware_1.AppError('No web connector configured', 404);
    res.json({ success: true, message: 'Re-crawl started' });
    setImmediate(async () => {
        try {
            await webCrawlerService_1.webCrawlerService.recrawl(companyId, config);
        }
        catch (err) {
            logger_1.logger.error(`[Connectors] Re-crawl failed for company ${companyId}`, { error: err });
        }
    });
}
// ══ DATABASE ═════════════════════════════════════════════════════════════════
// POST /api/connectors/database/test
async function testDatabaseConnection(req, res) {
    const { type, host, port, database, username, password, ssl = true } = req.body;
    const result = await databaseConnectorService_1.databaseConnectorService.testConnection(type, { host, port, database, username, password, ssl });
    res.json({ success: result.ok, error: result.error });
}
// POST /api/connectors/database/discover
async function discoverDatabaseSchema(req, res) {
    const { type, host, port, database, username, password, ssl = true } = req.body;
    const tables = await databaseConnectorService_1.databaseConnectorService.discoverSchema(type, { host, port, database, username, password, ssl });
    res.json({ success: true, data: { tables } });
}
// POST /api/connectors/database/sync
async function syncDatabase(req, res) {
    const companyId = getCompanyId(req);
    const config = req.body;
    config.companyId = companyId;
    await databaseConnectorService_1.databaseConnectorService.saveConfig(config);
    res.json({ success: true, message: 'Database sync started' });
    setImmediate(async () => {
        try {
            const result = await databaseConnectorService_1.databaseConnectorService.syncDatabase(config);
            logger_1.logger.info(`[Connectors] DB sync complete for company ${companyId}`, result);
        }
        catch (err) {
            logger_1.logger.error(`[Connectors] DB sync failed for company ${companyId}`, { error: err });
        }
    });
}
// ══ VIDEO ═════════════════════════════════════════════════════════════════════
// POST /api/connectors/video/process
async function processVideo(req, res) {
    const companyId = getCompanyId(req);
    const { source, url, title, category = 'other' } = req.body;
    const file = req.file;
    if (!url && !file)
        throw new error_middleware_1.AppError('url or file upload required', 400);
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
            const result = await videoConnectorService_1.videoConnectorService.processVideo(config);
            logger_1.logger.info(`[Connectors] Video processed for company ${companyId}`, result);
        }
        catch (err) {
            logger_1.logger.error(`[Connectors] Video processing failed for company ${companyId}`, { error: err });
        }
    });
}
// ══ AUDIO ════════════════════════════════════════════════════════════════════
// POST /api/connectors/audio/process
async function processAudio(req, res) {
    const companyId = getCompanyId(req);
    const { source, url, title, category = 'other' } = req.body;
    const file = req.file;
    if (source === 'podcast_rss') {
        if (!url)
            throw new error_middleware_1.AppError('url (RSS feed) required', 400);
        res.json({ success: true, message: 'Podcast import started' });
        setImmediate(async () => {
            try {
                const result = await audioConnectorService_1.audioConnectorService.importPodcastFeed(companyId, url, 20);
                logger_1.logger.info(`[Connectors] Podcast import done for company ${companyId}`, result);
            }
            catch (err) {
                logger_1.logger.error(`[Connectors] Podcast import failed for company ${companyId}`, { error: err });
            }
        });
        return;
    }
    if (!url && !file)
        throw new error_middleware_1.AppError('url or file upload required', 400);
    res.json({ success: true, message: 'Audio processing started' });
    setImmediate(async () => {
        try {
            const result = await audioConnectorService_1.audioConnectorService.processAudio({
                companyId, source, url, title, category,
                fileBuffer: file?.buffer, mimeType: file?.mimetype,
            });
            logger_1.logger.info(`[Connectors] Audio processed for company ${companyId}`, result);
        }
        catch (err) {
            logger_1.logger.error(`[Connectors] Audio processing failed for company ${companyId}`, { error: err });
        }
    });
}
// ══ API CUSTOM ════════════════════════════════════════════════════════════════
// POST /api/connectors/api/test
async function testAPIConnection(req, res) {
    const companyId = getCompanyId(req);
    const { name, baseUrl, authType, credentials } = req.body;
    const result = await apiConnectorService_1.apiConnectorService.testConnection({ companyId, name, baseUrl, authType, credentials });
    res.json({ success: result.ok, error: result.error });
}
// POST /api/connectors/api/sync
async function syncAPI(req, res) {
    const companyId = getCompanyId(req);
    const config = req.body;
    config.companyId = companyId;
    await apiConnectorService_1.apiConnectorService.saveConfig(config);
    res.json({ success: true, message: 'API sync started' });
    setImmediate(async () => {
        try {
            const result = await apiConnectorService_1.apiConnectorService.syncAPI(config);
            logger_1.logger.info(`[Connectors] API sync complete for company ${companyId}`, result);
        }
        catch (err) {
            logger_1.logger.error(`[Connectors] API sync failed for company ${companyId}`, { error: err });
        }
    });
}
// ══ E-COMMERCE ════════════════════════════════════════════════════════════════
// POST /api/connectors/ecommerce/shopify
async function syncShopify(req, res) {
    const companyId = getCompanyId(req);
    const config = req.body;
    config.companyId = companyId;
    await ecommerceConnectorService_1.ecommerceConnectorService.saveShopifyConfig(config);
    res.json({ success: true, message: 'Shopify sync started' });
    setImmediate(async () => {
        try {
            const result = await ecommerceConnectorService_1.ecommerceConnectorService.syncEcommerce(config);
            logger_1.logger.info(`[Connectors] Shopify sync complete for company ${companyId}`, result);
        }
        catch (err) {
            logger_1.logger.error(`[Connectors] Shopify sync failed for company ${companyId}`, { error: err });
        }
    });
}
// POST /api/connectors/ecommerce/woocommerce
async function syncWooCommerce(req, res) {
    const companyId = getCompanyId(req);
    const config = req.body;
    config.companyId = companyId;
    await ecommerceConnectorService_1.ecommerceConnectorService.saveWooConfig(config);
    res.json({ success: true, message: 'WooCommerce sync started' });
    setImmediate(async () => {
        try {
            const result = await ecommerceConnectorService_1.ecommerceConnectorService.syncEcommerce(config);
            logger_1.logger.info(`[Connectors] WooCommerce sync complete for company ${companyId}`, result);
        }
        catch (err) {
            logger_1.logger.error(`[Connectors] WooCommerce sync failed for company ${companyId}`, { error: err });
        }
    });
}
//# sourceMappingURL=connectors.controller.js.map