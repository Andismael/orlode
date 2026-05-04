"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/overview', (0, asyncHandler_1.asyncHandler)(analytics_controller_1.getOverview));
router.get('/charts', (0, asyncHandler_1.asyncHandler)(analytics_controller_1.getCharts));
router.get('/activity', (0, asyncHandler_1.asyncHandler)(analytics_controller_1.getActivity));
// GET /api/analytics/usage  — token & cost usage stats
router.get('/usage', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection('usageStats')
            .where('companyId', '==', companyId)
            .orderBy('date', 'desc')
            .limit(30)
            .get();
        const daily = snap.docs.map(d => ({ ...d.data() })).reverse();
        const totGemini = daily.reduce((s, d) => s + (d.gemini ?? 0), 0);
        const totClaude = daily.reduce((s, d) => s + (d.claude ?? 0), 0);
        const totStorage = 0; // would come from Firebase Storage stats
        const costGemini = totGemini * 0.0000003;
        const costClaude = totClaude * 0.000015;
        const estimatedCost = Math.round((costGemini + costClaude) * 30 / (daily.length || 1));
        res.json({
            success: true,
            data: {
                kpis: { tokensGemini: totGemini, tokensClaude: totClaude, storageGB: totStorage, estimatedCost, costGemini: parseFloat(costGemini.toFixed(2)), costClaude: parseFloat(costClaude.toFixed(2)) },
                daily,
                prediction: estimatedCost,
            },
        });
    }
    catch {
        res.json({ success: true, data: { kpis: { tokensGemini: 0, tokensClaude: 0, storageGB: 0, estimatedCost: 0, costGemini: 0, costClaude: 0 }, daily: [], prediction: 0 } });
    }
}));
// GET /api/analytics/cross-modules — aggregated KPIs from all modules
router.get('/cross-modules', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const safe = async (fn, fb) => { try {
        return await fn();
    }
    catch {
        return fb;
    } };
    const [users, visitors, presence, leaves, tickets, supportTickets, invoices, posts, trainings] = await Promise.all([
        safe(async () => (await db.collection('users').where('companyId', '==', companyId).get()).size, 0),
        safe(async () => {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            return (await db.collection('visitors').where('companyId', '==', companyId).where('checkInAt', '>=', start).get()).size;
        }, 0),
        safe(async () => {
            const today = new Date().toISOString().split('T')[0];
            return (await db.collection('presence').where('companyId', '==', companyId).where('date', '==', today).get()).size;
        }, 0),
        safe(async () => (await db.collection('leaveRequests').where('companyId', '==', companyId).where('status', '==', 'pending').get()).size, 0),
        safe(async () => (await db.collection('itTickets').where('companyId', '==', companyId).where('status', '!=', 'resolved').limit(200).get()).size, 0),
        safe(async () => (await db.collection('supportTickets').where('companyId', '==', companyId).where('status', '!=', 'resolved').limit(200).get()).size, 0),
        safe(async () => {
            const snap = await db.collection('invoices').where('companyId', '==', companyId).where('status', '==', 'overdue').get();
            return { count: snap.size, amount: snap.docs.reduce((s, d) => s + (d.data()['amount'] ?? 0), 0) };
        }, { count: 0, amount: 0 }),
        safe(async () => (await db.collection('marketingPosts').where('companyId', '==', companyId).get()).size, 0),
        safe(async () => (await db.collection('trainingCourses').where('companyId', '==', companyId).get()).size, 0),
    ]);
    res.json({
        success: true,
        data: {
            employees: users,
            visitorsToday: visitors,
            presenceToday: presence,
            presenceRate: users > 0 ? Math.round((presence / users) * 100) : 0,
            pendingLeaves: leaves,
            openITTickets: tickets,
            openSupportTickets: supportTickets,
            overdueInvoices: invoices.count,
            overdueAmount: invoices.amount,
            marketingPosts: posts,
            trainingCourses: trainings,
        },
    });
}));
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map