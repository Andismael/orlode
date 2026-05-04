import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { requireAgentRole } from '../middleware/agentRbac.middleware';

const router = Router();
router.use(authMiddleware);

// All finance endpoints require at least user-level access to the accounting agent.
// Specific admin-only endpoints (write operations) use `accountingAdmin` below.
router.use(requireAgentRole('accounting'));
const accountingAdmin = requireAgentRole('accounting', 'admin');

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

// GET /api/finance/invoices
router.get('/invoices', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    let q = db.collection('invoices').where('companyId', '==', companyId);
    if (req.query['type']) q = q.where('type', '==', req.query['type']) as typeof q;
    if (req.query['status']) q = q.where('status', '==', req.query['status']) as typeof q;
    const snap = await (q as FirebaseFirestore.Query).orderBy('dueDate', 'desc').limit(100).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, []);
  res.json({ success: true, data });
}));

// POST /api/finance/invoices
router.post('/invoices', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const invoice = { companyId, ...body, status: body['status'] ?? 'pending', createdAt: new Date(), updatedAt: new Date() };
  await safe(async () => { await getFirestore().collection('invoices').doc(id).set(invoice); }, undefined);
  res.status(201).json({ success: true, data: { id, ...invoice } });
}));

// PATCH /api/finance/invoices/:id
router.patch('/invoices/:id', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await safe(async () => {
    await getFirestore().collection('invoices').doc(req.params.id).update({ ...(req.body as Record<string, unknown>), updatedAt: new Date() });
  }, undefined);
  res.json({ success: true });
}));

// GET /api/finance/budget
router.get('/budget', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection('budgets').where('companyId', '==', companyId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, []);
  res.json({ success: true, data });
}));

// PUT /api/finance/budget/:dept
router.put('/budget/:dept', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const id = `${companyId}_${req.params.dept}`;
  await safe(async () => {
    await getFirestore().collection('budgets').doc(id).set({ companyId, dept: req.params.dept, ...(req.body as Record<string, unknown>), updatedAt: new Date() }, { merge: true });
  }, undefined);
  res.json({ success: true });
}));

// GET /api/finance/dashboard
router.get('/dashboard', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  // Safe number coercion — handles strings, null, undefined, NaN
  const num = (v: unknown): number => {
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const data = await safe(async () => {
    const db = getFirestore();
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
    const inMonth = (dateStr: unknown): boolean => {
      if (typeof dateStr !== 'string') return false;
      return dateStr.startsWith(thisMonth);
    };
    const invoiceAmount = (i: Record<string, unknown>) => num(i['totalTTC'] ?? i['amount'] ?? i['total']);
    const expenseAmount = (e: Record<string, unknown>) => num(e['amount']);

    const mtdRevenue = invoices
      .filter((i: Record<string, unknown>) => inMonth(i['issueDate'] ?? i['date'] ?? i['createdAt']))
      .reduce((s, i) => s + invoiceAmount(i as Record<string, unknown>), 0);
    const mtdExpenses = expenses
      .filter((e: Record<string, unknown>) => inMonth(e['date'] ?? e['createdAt']))
      .reduce((s, e) => s + expenseAmount(e as Record<string, unknown>), 0);

    // Overdue: pending invoices past their dueDate
    const overdue = invoices.filter((i: Record<string, unknown>) => {
      if (i['status'] === 'paid' || i['status'] === 'cancelled' || i['status'] === 'void') return false;
      const due = i['dueDate'] as string | undefined;
      return typeof due === 'string' && due < now.toISOString().slice(0, 10);
    });

    // Monthly breakdown: last 7 months from actual data
    const byMonth = new Map<string, { revenue: number; expenses: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      byMonth.set(d.toISOString().slice(0, 7), { revenue: 0, expenses: 0 });
    }
    for (const inv of invoices as Record<string, unknown>[]) {
      const dateStr = (inv['issueDate'] ?? inv['date'] ?? inv['createdAt']) as string | undefined;
      if (typeof dateStr !== 'string') continue;
      const key = dateStr.slice(0, 7);
      const entry = byMonth.get(key);
      if (entry) entry.revenue += invoiceAmount(inv);
    }
    for (const exp of expenses as Record<string, unknown>[]) {
      const dateStr = (exp['date'] ?? exp['createdAt']) as string | undefined;
      if (typeof dateStr !== 'string') continue;
      const key = dateStr.slice(0, 7);
      const entry = byMonth.get(key);
      if (entry) entry.expenses += expenseAmount(exp);
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
        overdueAmount: overdue.reduce((s, i) => s + invoiceAmount(i as Record<string, unknown>), 0),
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
router.post('/monthly', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = `${companyId}_${body['month'] as string}`;
  await safe(async () => {
    await getFirestore().collection('financeMonthly').doc(id).set({ companyId, ...body, updatedAt: new Date() }, { merge: true });
  }, undefined);
  res.json({ success: true });
}));

// ─── SEND INVOICE ───────────────────────────────────────────────────────────
router.post('/invoices/:id/send', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { sendInvoiceTool } = await import('../agents/accounting.agent');
  const result = await sendInvoiceTool({ companyId, invoiceId: req.params.id });
  res.json({ success: true, data: result });
}));

// ─── PAYMENT REMINDER ───────────────────────────────────────────────────────
router.post('/invoices/:id/reminder', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/invoices`).doc(req.params.id).get();
  const number = doc.exists ? (doc.data()?.['number'] as string) : undefined;
  const { sendReminderTool } = await import('../agents/accounting.agent');
  const result = await sendReminderTool({ companyId, invoiceNumber: number, tone: (req.body as any)?.tone ?? 'gentle' });
  res.json({ success: true, data: result });
}));

// ─── PAYMENTS HISTORY ───────────────────────────────────────────────────────
router.get('/payments', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const snap = await safe(async () => {
    return await getFirestore().collection(`companies/${companyId}/payments`).limit(50).get();
  }, null);
  res.json({ success: true, data: snap ? snap.docs.map(d => ({ id: d.id, ...d.data() })) : [] });
}));

// ─── EXPENSES ───────────────────────────────────────────────────────────────
router.post('/expenses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  await safe(async () => {
    await getFirestore().collection(`companies/${companyId}/expenses`).doc(id).set({
      id, userId: req.user?.uid ?? '', submittedBy: body['submittedBy'] ?? '',
      amount: body['amount'] ?? 0, currency: body['currency'] ?? 'EUR',
      category: body['category'] ?? 'autre', description: body['description'] ?? '',
      date: body['date'] ?? new Date().toISOString().split('T')[0],
      receipt: body['receipt'] ?? null, status: 'pending', submittedAt: new Date(), createdAt: new Date(),
    });
  }, undefined);
  res.status(201).json({ success: true, data: { id } });
}));

router.get('/expenses', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const status = req.query['status'] as string;
  const data = await safe(async () => {
    let q = getFirestore().collection(`companies/${companyId}/expenses`) as FirebaseFirestore.Query;
    if (status && status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, []);
  res.json({ success: true, data });
}));

router.patch('/expenses/:id/review', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  await safe(async () => {
    await getFirestore().collection(`companies/${companyId}/expenses`).doc(req.params.id).update({
      status: body['status'] ?? 'approved', reviewComment: body['comment'] ?? '', reviewedAt: new Date(),
    });
  }, undefined);
  res.json({ success: true });
}));

// ─── CASH FLOW ──────────────────────────────────────────────────────────────
router.get('/cashflow', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { getCashFlowTool } = await import('../agents/accounting.agent');
  const result = await getCashFlowTool({ companyId, period: (req.query['period'] as any) ?? 'month' });
  res.json({ success: true, data: result });
}));

// ─── TVA REPORT ─────────────────────────────────────────────────────────────
router.get('/vat-report', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { vatReportTool } = await import('../agents/accounting.agent');
  const result = await vatReportTool({
    companyId, period: (req.query['period'] as any) ?? 'quarter',
    year: req.query['year'] ? parseInt(req.query['year'] as string) : undefined,
    quarter: req.query['quarter'] ? parseInt(req.query['quarter'] as string) : undefined,
  });
  res.json({ success: true, data: result });
}));

// ─── BANK RECONCILIATION ────────────────────────────────────────────────────
router.post('/reconciliation', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const { bankReconciliationTool } = await import('../agents/accounting.agent');
  const result = await bankReconciliationTool({
    companyId, bankBalance: (body['bankBalance'] as number) ?? 0,
    bankCurrency: (body['currency'] as string) ?? 'EUR',
  });
  res.json({ success: true, data: result });
}));

// ─── EXPORT CSV ─────────────────────────────────────────────────────────────
router.get('/export', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { exportFinanceTool } = await import('../agents/accounting.agent');
  const result = await exportFinanceTool({
    companyId, dataType: (req.query['type'] as any) ?? 'invoices',
    status: req.query['status'] as string,
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
router.post('/auto-relance', accountingAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { autoRelanceTool } = await import('../agents/accounting.agent');
  const result = await autoRelanceTool({ companyId });
  res.json({ success: true, data: result });
}));

// ─── CURRENCY CONVERSION ───────────────────────────────────────────────────
router.get('/convert', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { convertCurrencyTool } = await import('../agents/accounting.agent');
  const result = await convertCurrencyTool({
    amount: parseFloat(req.query['amount'] as string) || 0,
    from: (req.query['from'] as string) ?? 'EUR',
    to: (req.query['to'] as string) ?? 'USD',
  });
  res.json({ success: true, data: result });
}));

router.get('/cashflow/forecast', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { forecastCashFlowTool } = await import('../agents/accounting.agent');
  const result = await forecastCashFlowTool({ companyId });
  res.json({ success: true, data: result });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PRO: P&L, AGING, RECURRING, EXPENSE ANALYTICS, AUTOMATION
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/profit-loss', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { profitLossTool } = await import('../agents/accounting.agent');
  const result = await (profitLossTool as (args: unknown) => Promise<unknown>)({ companyId: cid, period: req.query['period'] ?? 'quarter' });
  res.json({ success: true, data: result });
}));

router.get('/aging', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { agingReportTool } = await import('../agents/accounting.agent');
  const result = await (agingReportTool as (args: unknown) => Promise<unknown>)({ companyId: cid });
  res.json({ success: true, data: result });
}));

router.get('/recurring', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const snap = await getFirestore().collection(`companies/${cid}/recurringInvoices`).limit(50).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

router.post('/recurring', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { createRecurringInvoiceTool } = await import('../agents/accounting.agent');
  const result = await (createRecurringInvoiceTool as (args: unknown) => Promise<unknown>)({ companyId: cid, ...(req.body as Record<string, unknown>) });
  res.json({ success: true, data: result });
}));

router.get('/expense-analytics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { expenseAnalyticsTool } = await import('../agents/accounting.agent');
  const result = await (expenseAnalyticsTool as (args: unknown) => Promise<unknown>)({ companyId: cid, period: req.query['period'] ?? 'quarter' });
  res.json({ success: true, data: result });
}));

router.get('/client-risk', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { clientRiskScoreTool } = await import('../agents/accounting.agent');
  const result = await (clientRiskScoreTool as (args: unknown) => Promise<unknown>)({ companyId: cid, clientName: req.query['client'] as string });
  res.json({ success: true, data: result });
}));

router.post('/automation/run', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const cid = req.user?.companyId; if (!cid) throw new AppError('Company ID required', 400);
  const { financeAutomationTool } = await import('../agents/accounting.agent');
  const result = await (financeAutomationTool as (args: unknown) => Promise<unknown>)({ companyId: cid, type: (req.body as Record<string, string>)['type'] ?? 'overdue_alert' });
  res.json({ success: true, data: result });
}));

export default router;
