"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const agentRbac_middleware_1 = require("../middleware/agentRbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// All finance endpoints require at least user-level access to the accounting agent.
// Specific admin-only endpoints (write operations) use `accountingAdmin` below.
router.use((0, agentRbac_middleware_1.requireAgentRole)('accounting'));
const accountingAdmin = (0, agentRbac_middleware_1.requireAgentRole)('accounting', 'admin');
const safe = async (fn, fallback) => {
    try {
        return await fn();
    }
    catch {
        return fallback;
    }
};
// GET /api/finance/invoices
router.get('/invoices', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
        let q = db.collection('invoices').where('companyId', '==', companyId);
        if (req.query['type'])
            q = q.where('type', '==', req.query['type']);
        if (req.query['status'])
            q = q.where('status', '==', req.query['status']);
        const snap = await q.orderBy('dueDate', 'desc').limit(100).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, []);
    res.json({ success: true, data });
}));
// POST /api/finance/invoices
router.post('/invoices', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    const invoice = { companyId, ...body, status: body['status'] ?? 'pending', createdAt: new Date(), updatedAt: new Date() };
    await safe(async () => { await (0, firebase_config_1.getFirestore)().collection('invoices').doc(id).set(invoice); }, undefined);
    res.status(201).json({ success: true, data: { id, ...invoice } });
}));
// PATCH /api/finance/invoices/:id
router.patch('/invoices/:id', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await safe(async () => {
        await (0, firebase_config_1.getFirestore)().collection('invoices').doc(req.params.id).update({ ...req.body, updatedAt: new Date() });
    }, undefined);
    res.json({ success: true });
}));
// GET /api/finance/budget
router.get('/budget', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const data = await safe(async () => {
        const snap = await (0, firebase_config_1.getFirestore)().collection('budgets').where('companyId', '==', companyId).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, []);
    res.json({ success: true, data });
}));
// PUT /api/finance/budget/:dept
router.put('/budget/:dept', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const id = `${companyId}_${req.params.dept}`;
    await safe(async () => {
        await (0, firebase_config_1.getFirestore)().collection('budgets').doc(id).set({ companyId, dept: req.params.dept, ...req.body, updatedAt: new Date() }, { merge: true });
    }, undefined);
    res.json({ success: true });
}));
// GET /api/finance/dashboard
router.get('/dashboard', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    // Safe number coercion — handles strings, null, undefined, NaN
    const num = (v) => {
        if (v == null)
            return 0;
        const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : Number(v);
        return Number.isFinite(n) ? n : 0;
    };
    const data = await safe(async () => {
        const db = (0, firebase_config_1.getFirestore)();
        // Read from the sub-collections where the accounting agent actually writes
        const [invoicesSnap, expensesSnap] = await Promise.all([
            db.collection(`companies/${companyId}/invoices`).limit(500).get(),
            db.collection(`companies/${companyId}/expenses`).limit(500).get(),
        ]);
        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7); // "YYYY-MM"
        const invoices = invoicesSnap.docs.map(d => d.data());
        const expenses = expensesSnap.docs.map(d => d.data());
        // KPIs — month-to-date
        const inMonth = (dateStr) => {
            if (typeof dateStr !== 'string')
                return false;
            return dateStr.startsWith(thisMonth);
        };
        const invoiceAmount = (i) => num(i['totalTTC'] ?? i['amount'] ?? i['total']);
        const expenseAmount = (e) => num(e['amount']);
        const mtdRevenue = invoices
            .filter((i) => inMonth(i['issueDate'] ?? i['date'] ?? i['createdAt']))
            .reduce((s, i) => s + invoiceAmount(i), 0);
        const mtdExpenses = expenses
            .filter((e) => inMonth(e['date'] ?? e['createdAt']))
            .reduce((s, e) => s + expenseAmount(e), 0);
        // Overdue: pending invoices past their dueDate
        const overdue = invoices.filter((i) => {
            if (i['status'] === 'paid' || i['status'] === 'cancelled' || i['status'] === 'void')
                return false;
            const due = i['dueDate'];
            return typeof due === 'string' && due < now.toISOString().slice(0, 10);
        });
        // Monthly breakdown: last 7 months from actual data
        const byMonth = new Map();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setMonth(d.getMonth() - i);
            byMonth.set(d.toISOString().slice(0, 7), { revenue: 0, expenses: 0 });
        }
        for (const inv of invoices) {
            const dateStr = (inv['issueDate'] ?? inv['date'] ?? inv['createdAt']);
            if (typeof dateStr !== 'string')
                continue;
            const key = dateStr.slice(0, 7);
            const entry = byMonth.get(key);
            if (entry)
                entry.revenue += invoiceAmount(inv);
        }
        for (const exp of expenses) {
            const dateStr = (exp['date'] ?? exp['createdAt']);
            if (typeof dateStr !== 'string')
                continue;
            const key = dateStr.slice(0, 7);
            const entry = byMonth.get(key);
            if (entry)
                entry.expenses += expenseAmount(exp);
        }
        const monthly = Array.from(byMonth.entries()).map(([month, vals]) => ({
            month: month.slice(5) + '/' + month.slice(2, 4),
            revenue: vals.revenue,
            expenses: vals.expenses,
        }));
        return {
            kpis: {
                revenue: mtdRevenue,
                expenses: mtdExpenses,
                cashflow: mtdRevenue - mtdExpenses,
                overdueCount: overdue.length,
                overdueAmount: overdue.reduce((s, i) => s + invoiceAmount(i), 0),
            },
            monthly,
            alerts: overdue.length > 0
                ? [{ text: `${overdue.length} facture(s) en retard`, priority: 'high' }]
                : [],
        };
    }, { kpis: { revenue: 0, expenses: 0, cashflow: 0, overdueCount: 0, overdueAmount: 0 }, monthly: [], alerts: [] });
    res.json({ success: true, data });
}));
// POST /api/finance/monthly  — upsert monthly data
router.post('/monthly', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = `${companyId}_${body['month']}`;
    await safe(async () => {
        await (0, firebase_config_1.getFirestore)().collection('financeMonthly').doc(id).set({ companyId, ...body, updatedAt: new Date() }, { merge: true });
    }, undefined);
    res.json({ success: true });
}));
// ─── SEND INVOICE ───────────────────────────────────────────────────────────
router.post('/invoices/:id/send', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { sendInvoiceTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await sendInvoiceTool({ companyId, invoiceId: req.params.id });
    res.json({ success: true, data: result });
}));
// ─── PAYMENT REMINDER ───────────────────────────────────────────────────────
router.post('/invoices/:id/reminder', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/invoices`).doc(req.params.id).get();
    const number = doc.exists ? doc.data()?.['number'] : undefined;
    const { sendReminderTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await sendReminderTool({ companyId, invoiceNumber: number, tone: req.body?.tone ?? 'gentle' });
    res.json({ success: true, data: result });
}));
// ─── PAYMENTS HISTORY ───────────────────────────────────────────────────────
router.get('/payments', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await safe(async () => {
        return await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/payments`).limit(50).get();
    }, null);
    res.json({ success: true, data: snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [] });
}));
// ─── EXPENSES ───────────────────────────────────────────────────────────────
router.post('/expenses', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const id = (0, helpers_1.generateId)();
    await safe(async () => {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/expenses`).doc(id).set({
            id, userId: req.user?.uid ?? '', submittedBy: body['submittedBy'] ?? '',
            amount: body['amount'] ?? 0, currency: body['currency'] ?? 'EUR',
            category: body['category'] ?? 'autre', description: body['description'] ?? '',
            date: body['date'] ?? new Date().toISOString().split('T')[0],
            receipt: body['receipt'] ?? null, status: 'pending', submittedAt: new Date(), createdAt: new Date(),
        });
    }, undefined);
    res.status(201).json({ success: true, data: { id } });
}));
router.get('/expenses', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const status = req.query['status'];
    const data = await safe(async () => {
        let q = (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/expenses`);
        if (status && status !== 'all')
            q = q.where('status', '==', status);
        const snap = await q.limit(50).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, []);
    res.json({ success: true, data });
}));
router.patch('/expenses/:id/review', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    await safe(async () => {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/expenses`).doc(req.params.id).update({
            status: body['status'] ?? 'approved', reviewComment: body['comment'] ?? '', reviewedAt: new Date(),
        });
    }, undefined);
    res.json({ success: true });
}));
// ─── CASH FLOW ──────────────────────────────────────────────────────────────
router.get('/cashflow', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { getCashFlowTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await getCashFlowTool({ companyId, period: req.query['period'] ?? 'month' });
    res.json({ success: true, data: result });
}));
// ─── TVA REPORT ─────────────────────────────────────────────────────────────
router.get('/vat-report', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { vatReportTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await vatReportTool({
        companyId, period: req.query['period'] ?? 'quarter',
        year: req.query['year'] ? parseInt(req.query['year']) : undefined,
        quarter: req.query['quarter'] ? parseInt(req.query['quarter']) : undefined,
    });
    res.json({ success: true, data: result });
}));
// ─── BANK RECONCILIATION ────────────────────────────────────────────────────
router.post('/reconciliation', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const { bankReconciliationTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await bankReconciliationTool({
        companyId, bankBalance: body['bankBalance'] ?? 0,
        bankCurrency: body['currency'] ?? 'EUR',
    });
    res.json({ success: true, data: result });
}));
// ─── EXPORT CSV ─────────────────────────────────────────────────────────────
router.get('/export', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { exportFinanceTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await exportFinanceTool({
        companyId, dataType: req.query['type'] ?? 'invoices',
        status: req.query['status'],
    });
    // Return as downloadable CSV
    if (req.query['download'] === 'true') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="export-${req.query['type'] ?? 'invoices'}-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send('\uFEFF' + result.csv); // BOM for Excel compatibility
        return;
    }
    res.json({ success: true, data: result });
}));
// ─── AUTO-RELANCE ───────────────────────────────────────────────────────────
router.post('/auto-relance', accountingAdmin, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { autoRelanceTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await autoRelanceTool({ companyId });
    res.json({ success: true, data: result });
}));
// ─── CURRENCY CONVERSION ───────────────────────────────────────────────────
router.get('/convert', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { convertCurrencyTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await convertCurrencyTool({
        amount: parseFloat(req.query['amount']) || 0,
        from: req.query['from'] ?? 'EUR',
        to: req.query['to'] ?? 'USD',
    });
    res.json({ success: true, data: result });
}));
router.get('/cashflow/forecast', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { forecastCashFlowTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await forecastCashFlowTool({ companyId });
    res.json({ success: true, data: result });
}));
// ═══════════════════════════════════════════════════════════════════════════════
// PRO: P&L, AGING, RECURRING, EXPENSE ANALYTICS, AUTOMATION
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/profit-loss', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { profitLossTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await profitLossTool({ companyId: cid, period: req.query['period'] ?? 'quarter' });
    res.json({ success: true, data: result });
}));
router.get('/aging', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { agingReportTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await agingReportTool({ companyId: cid });
    res.json({ success: true, data: result });
}));
router.get('/recurring', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${cid}/recurringInvoices`).limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
router.post('/recurring', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { createRecurringInvoiceTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await createRecurringInvoiceTool({ companyId: cid, ...req.body });
    res.json({ success: true, data: result });
}));
router.get('/expense-analytics', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { expenseAnalyticsTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await expenseAnalyticsTool({ companyId: cid, period: req.query['period'] ?? 'quarter' });
    res.json({ success: true, data: result });
}));
router.get('/client-risk', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { clientRiskScoreTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await clientRiskScoreTool({ companyId: cid, clientName: req.query['client'] });
    res.json({ success: true, data: result });
}));
router.post('/automation/run', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const cid = req.user?.companyId;
    if (!cid)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { financeAutomationTool } = await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')));
    const result = await financeAutomationTool({ companyId: cid, type: req.body['type'] ?? 'overdue_alert' });
    res.json({ success: true, data: result });
}));
exports.default = router;
//# sourceMappingURL=finance.routes.js.map