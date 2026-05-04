"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Website Routes — protected endpoints for website editor + leads
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/website/config — get website config
router.get('/config', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/website`).doc('config').get();
    res.json({ success: true, data: doc.exists ? doc.data() : null });
}));
// PUT /api/website/config — save website config (editor)
router.put('/config', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const { content, color, template, companyName, status, slug } = req.body;
    await db.collection(`companies/${companyId}/website`).doc('config').set({
        content: content ?? {},
        color: color ?? '#6c3ce0',
        template: template ?? 'vitrine',
        companyName: companyName ?? '',
        status: status ?? 'draft',
        slug: slug ?? '',
        widgetEnabled: true,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
}));
// GET /api/website/leads — get captured leads
router.get('/leads', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/website/config/leads`).orderBy('createdAt', 'desc').limit(100).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
exports.default = router;
//# sourceMappingURL=website.routes.js.map