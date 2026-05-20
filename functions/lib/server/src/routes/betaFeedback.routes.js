"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Beta feedback — collected during the launch phase to triage bugs / features.
 *
 * One simple endpoint: POST /api/beta-feedback. Saves to a top-level Firestore
 * collection `betaFeedback` so the team can review across all companies.
 * No PII validation here — the auth middleware already gives us the user's
 * companyId and uid.
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// POST /api/beta-feedback — submit feedback on a beta agent or bundle
router.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!userId || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const body = req.body;
    const title = (body.title ?? '').trim();
    const description = (body.description ?? '').trim();
    if (!title || !description)
        throw new error_middleware_1.AppError('title and description required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const docRef = await db.collection('betaFeedback').add({
        userId,
        companyId,
        userEmail: req.user?.email ?? null,
        agentId: body.agentId ?? null,
        bundleId: body.bundleId ?? null,
        type: body.type ?? 'other',
        severity: body.severity ?? 'medium',
        title: title.slice(0, 200),
        description: description.slice(0, 4000),
        page: body.page ?? null,
        status: 'new',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    logger_1.logger.info('[BetaFeedback] received', {
        id: docRef.id, companyId, userId,
        type: body.type, agentId: body.agentId, bundleId: body.bundleId,
    });
    res.json({ success: true, data: { id: docRef.id, message: 'Merci pour ton feedback !' } });
}));
// GET /api/beta-feedback — list feedback (admin-only check happens upstream)
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (req.user?.role !== 'admin')
        throw new error_middleware_1.AppError('Admin only', 403);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('betaFeedback').orderBy('createdAt', 'desc').limit(200).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
exports.default = router;
//# sourceMappingURL=betaFeedback.routes.js.map