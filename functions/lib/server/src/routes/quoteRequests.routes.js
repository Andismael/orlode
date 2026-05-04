"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Quote Requests (lightweight — from Clone). Separate from formal quotes.
 *
 * GET    /api/quote-requests         — list (filter by status)
 * PATCH  /api/quote-requests/:id     — action: accept | reject | convertToQuote
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { status } = req.query;
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/quoteRequests`);
    if (status)
        q = q.where('status', '==', status);
    const snap = await q.limit(500).get().catch(async () => await db.collection(`companies/${companyId}/quoteRequests`).limit(500).get());
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => {
        const ca = a['createdAt'];
        const cb = b['createdAt'];
        const ta = ca instanceof Date ? ca.getTime() : (ca?.seconds ?? 0) * 1000;
        const tb = cb instanceof Date ? cb.getTime() : (cb?.seconds ?? 0) * 1000;
        return tb - ta;
    });
    res.json({ success: true, data: items });
}));
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { id } = req.params;
    const { action, notes } = req.body;
    if (!action || !['accept', 'reject', 'convert'].includes(action)) {
        throw new error_middleware_1.AppError('Invalid action (accept | reject | convert)', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/quoteRequests`).doc(id);
    const doc = await ref.get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Not found', 404);
    const updates = { updatedAt: new Date(), updatedBy: userId };
    if (action === 'accept') {
        updates['status'] = 'accepted';
        updates['acceptedAt'] = new Date();
    }
    if (action === 'reject') {
        updates['status'] = 'rejected';
        updates['rejectedAt'] = new Date();
        if (notes)
            updates['rejectNote'] = notes;
    }
    if (action === 'convert') {
        updates['status'] = 'converted';
        updates['convertedAt'] = new Date();
    }
    await ref.update(updates);
    res.json({ success: true, data: { id, ...((await ref.get()).data()) } });
}));
exports.default = router;
//# sourceMappingURL=quoteRequests.routes.js.map