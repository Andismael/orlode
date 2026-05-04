"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Azure credentials management (admin-only).
 *
 * GET  /api/azure/status      — which services are configured (no secrets)
 * POST /api/azure/docintel    { endpoint, key }
 * POST /api/azure/speech      { region, key }
 * POST /api/azure/openai      { endpoint, key, deployment }
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const azureService_1 = require("../services/azure/azureService");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
function adminOnly(req) {
    const role = req.user?.role;
    if (role !== 'admin' && role !== 'owner' && role !== 'manager') {
        throw new error_middleware_1.AppError('Admins uniquement', 403);
    }
}
router.get('/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const status = await (0, azureService_1.getAzureStatus)(companyId);
    res.json({ success: true, data: status });
}));
router.post('/docintel', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    adminOnly(req);
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { endpoint, key } = req.body;
    if (!endpoint || !key)
        throw new error_middleware_1.AppError('endpoint + key required', 400);
    await (0, azureService_1.saveAzureConfig)(companyId, { docIntel: { endpoint, key } });
    res.json({ success: true });
}));
router.post('/speech', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    adminOnly(req);
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { region, key } = req.body;
    if (!region || !key)
        throw new error_middleware_1.AppError('region + key required', 400);
    await (0, azureService_1.saveAzureConfig)(companyId, { speech: { region, key } });
    res.json({ success: true });
}));
router.post('/openai', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    adminOnly(req);
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { endpoint, key, deployment } = req.body;
    if (!endpoint || !key)
        throw new error_middleware_1.AppError('endpoint + key required', 400);
    await (0, azureService_1.saveAzureConfig)(companyId, { openai: { endpoint, key, deployment } });
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=azure.routes.js.map