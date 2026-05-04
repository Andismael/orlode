"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Clone Analytics — aggregate stats on what the Clone has captured.
 *
 * GET /api/clone-analytics/summary?days=30
 *   Returns totals + channel breakdown for: appointments, reservations, leads,
 *   quote requests, orders. Aimed at the admin to see ROI of the Clone.
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
async function countByChannel(db, collPath, since, extraFilter) {
    const snap = await db.collection(collPath).limit(2000).get().catch(() => null);
    if (!snap)
        return { total: 0, byChannel: {}, bySource: {} };
    const byChannel = {};
    const bySource = {};
    let total = 0;
    for (const d of snap.docs) {
        const data = d.data();
        const createdAt = data['createdAt'];
        let t = null;
        if (createdAt instanceof Date)
            t = createdAt;
        else if (typeof createdAt === 'object' && createdAt?._seconds)
            t = new Date(createdAt._seconds * 1000);
        else if (typeof createdAt === 'object' && createdAt?.seconds)
            t = new Date((createdAt.seconds) * 1000);
        if (!t || t < since)
            continue;
        if (extraFilter && !extraFilter(d))
            continue;
        total++;
        const ch = data['sourceChannel'] || 'unknown';
        byChannel[ch] = (byChannel[ch] ?? 0) + 1;
        const src = data['createdBy'] || 'human';
        bySource[src] = (bySource[src] ?? 0) + 1;
    }
    return { total, byChannel, bySource };
}
router.get('/summary', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const days = Math.max(1, Math.min(365, Number(req.query['days']) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const db = (0, firebase_config_1.getFirestore)();
    const [appts, resvs, leads, quotes, orders] = await Promise.all([
        countByChannel(db, `companies/${companyId}/appointments`, since),
        countByChannel(db, `companies/${companyId}/reservations`, since),
        countByChannel(db, `companies/${companyId}/leads`, since),
        countByChannel(db, `companies/${companyId}/quoteRequests`, since),
        countByChannel(db, `companies/${companyId}/orders`, since),
    ]);
    // Revenue from paid orders (summed)
    let paidRevenue = 0;
    let paidCount = 0;
    let currency = 'XOF';
    try {
        const ordersSnap = await db.collection(`companies/${companyId}/orders`).limit(2000).get();
        for (const d of ordersSnap.docs) {
            const o = d.data();
            if (o['status'] !== 'paid' && o['status'] !== 'fulfilled')
                continue;
            const createdAt = o['createdAt'];
            let t = null;
            if (createdAt instanceof Date)
                t = createdAt;
            else if (typeof createdAt === 'object' && createdAt?._seconds)
                t = new Date(createdAt._seconds * 1000);
            else if (typeof createdAt === 'object' && createdAt?.seconds)
                t = new Date(createdAt.seconds * 1000);
            if (!t || t < since)
                continue;
            paidRevenue += Number(o['subtotal'] ?? 0);
            paidCount++;
            currency = o['currency'] ?? currency;
        }
    }
    catch { /* non-critical */ }
    // Clone-captured share (createdBy === 'clone')
    const cloneShare = {
        appointments: appts.bySource['clone'] ?? 0,
        reservations: resvs.bySource['clone'] ?? 0,
        leads: leads.bySource['clone'] ?? 0,
        quoteRequests: quotes.bySource['clone'] ?? 0,
        orders: orders.bySource['clone'] ?? 0,
    };
    res.json({
        success: true,
        data: {
            rangeDays: days,
            since: since.toISOString(),
            totals: {
                appointments: appts.total,
                reservations: resvs.total,
                leads: leads.total,
                quoteRequests: quotes.total,
                orders: orders.total,
            },
            byChannel: {
                appointments: appts.byChannel,
                reservations: resvs.byChannel,
                leads: leads.byChannel,
                quoteRequests: quotes.byChannel,
                orders: orders.byChannel,
            },
            cloneCaptured: cloneShare,
            revenue: {
                paidRevenue,
                paidCount,
                currency,
            },
        },
    });
}));
exports.default = router;
//# sourceMappingURL=cloneAnalytics.routes.js.map