"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Notification routes — CRUD for user notifications
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/notifications — list my notifications
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        // Get user-specific + company-wide notifications
        const [userSnap, companySnap] = await Promise.all([
            db.collection('notifications')
                .where('userId', '==', uid)
                .limit(50).get(),
            db.collection('notifications')
                .where('companyId', '==', companyId)
                .where('userId', '==', null)
                .limit(50).get(),
        ]);
        const all = [
            ...userSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            ...companySnap.docs.map(d => ({ id: d.id, ...d.data() })),
        ];
        // Sort by createdAt desc
        all.sort((a, b) => {
            const ta = a['createdAt'];
            const tb = b['createdAt'];
            const da = ta && typeof ta === 'object' && 'toDate' in ta ? ta.toDate().getTime() : new Date(ta).getTime();
            const db2 = tb && typeof tb === 'object' && 'toDate' in tb ? tb.toDate().getTime() : new Date(tb).getTime();
            return db2 - da;
        });
        res.json({ success: true, data: all.slice(0, 50) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// GET /api/notifications/unread-count
router.get('/unread-count', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const [userSnap, companySnap] = await Promise.all([
            db.collection('notifications')
                .where('userId', '==', uid)
                .where('read', '==', false)
                .limit(100).get(),
            db.collection('notifications')
                .where('companyId', '==', companyId)
                .where('userId', '==', null)
                .where('read', '==', false)
                .limit(100).get(),
        ]);
        res.json({ success: true, data: { count: userSnap.size + companySnap.size } });
    }
    catch {
        res.json({ success: true, data: { count: 0 } });
    }
}));
// PATCH /api/notifications/:id/read
router.patch('/:id/read', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('notifications').doc(req.params.id).update({ read: true });
    res.json({ success: true });
}));
// POST /api/notifications/mark-all-read
router.post('/mark-all-read', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const batch = db.batch();
    const [userSnap, companySnap] = await Promise.all([
        db.collection('notifications').where('userId', '==', uid).where('read', '==', false).limit(100).get(),
        db.collection('notifications').where('companyId', '==', companyId).where('userId', '==', null).where('read', '==', false).limit(100).get(),
    ]);
    [...userSnap.docs, ...companySnap.docs].forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    await batch.commit();
    res.json({ success: true });
}));
// DELETE /api/notifications/:id
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('notifications').doc(req.params.id).delete();
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=notification.routes.js.map