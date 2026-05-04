import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import { singleFileUpload } from '../middleware/upload.middleware';
import {
  getConnectors,
  deleteConnector,
  crawlWebsite,
  recrawlWebsite,
  testDatabaseConnection,
  discoverDatabaseSchema,
  syncDatabase,
  processVideo,
  processAudio,
  testAPIConnection,
  syncAPI,
  syncShopify,
  syncWooCommerce,
} from '../controllers/connectors.controller';

const router = Router();
router.use(authMiddleware);

// ── Overview ─────────────────────────────────────────────────────────────────
router.get('/',          asyncHandler(getConnectors));
router.delete('/:id',   asyncHandler(deleteConnector));

// ── Web Crawler ───────────────────────────────────────────────────────────────
router.post('/web/crawl',    asyncHandler(crawlWebsite));
router.post('/web/recrawl',  asyncHandler(recrawlWebsite));

// ── Database ──────────────────────────────────────────────────────────────────
router.post('/database/test',     asyncHandler(testDatabaseConnection));
router.post('/database/discover', asyncHandler(discoverDatabaseSchema));
router.post('/database/sync',     asyncHandler(syncDatabase));

// ── Video ─────────────────────────────────────────────────────────────────────
router.post('/video/process', singleFileUpload, asyncHandler(processVideo));

// ── Audio ─────────────────────────────────────────────────────────────────────
router.post('/audio/process', singleFileUpload, asyncHandler(processAudio));

// ── API Custom ────────────────────────────────────────────────────────────────
router.post('/api/test', asyncHandler(testAPIConnection));
router.post('/api/sync', asyncHandler(syncAPI));

// ── E-Commerce ────────────────────────────────────────────────────────────────
router.post('/ecommerce/shopify',     asyncHandler(syncShopify));
router.post('/ecommerce/woocommerce', asyncHandler(syncWooCommerce));

export default router;
