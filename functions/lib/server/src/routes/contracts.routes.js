"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Contracts routes — thin proxy over the Wemas bridge.
 *
 * Reads come from Wemas (source of truth). Writes (create/send) also go
 * through Wemas. Firestore stays as a read-cache only.
 *
 *   GET    /api/contracts            — list
 *   GET    /api/contracts/:id        — single
 *   POST   /api/contracts            — create + send
 *   POST   /api/contracts/:id/resend — re-trigger signature email
 *   POST   /api/contracts/provision  — manually trigger Wemas org provisioning
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const wemasBridge_1 = require("../services/wemas/wemasBridge");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/contracts/status — feature flag for the UI
router.get('/status', (_req, res) => {
    res.json({
        success: true,
        data: { configured: (0, wemasBridge_1.isWemasConfigured)(), frontendUrl: (0, wemasBridge_1.getWemasFrontendUrl)() },
    });
});
// GET /api/contracts — list contracts for current company
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    if (!(0, wemasBridge_1.isWemasConfigured)()) {
        return res.json({ success: true, data: [], wemasConfigured: false });
    }
    const limit = Math.min(parseInt(req.query['limit'] ?? '50', 10), 200);
    const list = await (0, wemasBridge_1.listContracts)(companyId, limit);
    res.json({ success: true, data: list, wemasConfigured: true });
}));
// GET /api/contracts/:id — single contract
router.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const contract = await (0, wemasBridge_1.getContract)(companyId, req.params['id']);
    res.json({ success: true, data: contract });
}));
// POST /api/contracts — create + send for signature
router.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const { signatoryName, signatoryEmail, signatoryPhone, contractContent, contractType, senderName, sendNow } = req.body;
    if (!signatoryName || !signatoryEmail || !contractContent) {
        throw new error_middleware_1.AppError('signatoryName, signatoryEmail, contractContent required', 400);
    }
    const result = await (0, wemasBridge_1.createAndSendContract)({
        companyId, signatoryName, signatoryEmail, signatoryPhone,
        contractContent, contractType, senderName, sendNow,
    });
    res.json({ success: true, data: result });
}));
// POST /api/contracts/:id/resend — re-send the signature email
router.post('/:id/resend', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const result = await (0, wemasBridge_1.resendContract)(companyId, req.params['id']);
    res.json({ success: true, data: result });
}));
// POST /api/contracts/provision — manually provision the Wemas org for this company
// (auto-runs on first contract, but admins may want to pre-provision for branding)
router.post('/provision', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const wemasOrgId = await (0, wemasBridge_1.provisionOrgIfNeeded)(companyId);
    res.json({ success: true, data: { wemasOrgId } });
}));
exports.default = router;
//# sourceMappingURL=contracts.routes.js.map