import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getOverview, getCharts, getActivity } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/overview',  asyncHandler(getOverview));
router.get('/charts',    asyncHandler(getCharts));
router.get('/activity',  asyncHandler(getActivity));

// GET /api/analytics/usage  — token & cost usage stats
router.get('/usage', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const db = getFirestore();
    const snap = await db.collection('usageStats')
      .where('companyId', '==', companyId)
      .orderBy('date', 'desc')
      .limit(30)
      .get();
    const daily = snap.docs.map(d => ({ ...d.data() })).reverse() as Array<{ day: string; gemini: number; claude: number; requests: number; date: string }>;
    const totGemini  = daily.reduce((s, d) => s + (d.gemini ?? 0), 0);
    const totClaude  = daily.reduce((s, d) => s + (d.claude ?? 0), 0);
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
  } catch {
    res.json({ success: true, data: { kpis: { tokensGemini: 0, tokensClaude: 0, storageGB: 0, estimatedCost: 0, costGemini: 0, costClaude: 0 }, daily: [], prediction: 0 } });
  }
}));

// GET /api/analytics/cross-modules — aggregated KPIs from all modules
router.get('/cross-modules', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const safe = async <T>(fn: () => Promise<T>, fb: T): Promise<T> => { try { return await fn(); } catch { return fb; } };

  const [users, visitors, presence, leaves, tickets, supportTickets, invoices, posts, trainings] = await Promise.all([
    safe(async () => (await db.collection('users').where('companyId', '==', companyId).get()).size, 0),
    safe(async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
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
      return { count: snap.size, amount: snap.docs.reduce((s, d) => s + ((d.data()['amount'] as number) ?? 0), 0) };
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

export default router;
