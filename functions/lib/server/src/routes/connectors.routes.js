"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const connectors_controller_1 = require("../controllers/connectors.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// ── Overview ─────────────────────────────────────────────────────────────────
router.get('/', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.getConnectors));
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.deleteConnector));
// ── Web Crawler ───────────────────────────────────────────────────────────────
router.post('/web/crawl', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.crawlWebsite));
router.post('/web/recrawl', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.recrawlWebsite));
// ── Database ──────────────────────────────────────────────────────────────────
router.post('/database/test', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.testDatabaseConnection));
router.post('/database/discover', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.discoverDatabaseSchema));
router.post('/database/sync', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.syncDatabase));
// ── Video ─────────────────────────────────────────────────────────────────────
router.post('/video/process', upload_middleware_1.singleFileUpload, (0, asyncHandler_1.asyncHandler)(connectors_controller_1.processVideo));
// ── Audio ─────────────────────────────────────────────────────────────────────
router.post('/audio/process', upload_middleware_1.singleFileUpload, (0, asyncHandler_1.asyncHandler)(connectors_controller_1.processAudio));
// ── API Custom ────────────────────────────────────────────────────────────────
router.post('/api/test', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.testAPIConnection));
router.post('/api/sync', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.syncAPI));
// ── E-Commerce ────────────────────────────────────────────────────────────────
router.post('/ecommerce/shopify', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.syncShopify));
router.post('/ecommerce/woocommerce', (0, asyncHandler_1.asyncHandler)(connectors_controller_1.syncWooCommerce));
exports.default = router;
//# sourceMappingURL=connectors.routes.js.map