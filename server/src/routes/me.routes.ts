import { Router } from 'express';
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';

const router = Router();

router.use(authMiddleware);

// ─── GET /api/me/leave ─────────────────────────────────────────────────────
// My leave requests (any status). Employees only see their own.
router.get('/leave', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!userId || !companyId) {
    res.json({ success: true, requests: [] });
    return;
  }
  const db = getFirestore();
  const snap = await db.collection('leaveRequests')
    .where('companyId', '==', companyId)
    .where('userId', '==', userId)
    .get();
  const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, requests });
}));

// ─── GET /api/me/agenda ────────────────────────────────────────────────────
// My appointments today (host = me OR participants include my email).
router.get('/agenda', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid;
  const email = req.user?.email;
  const companyId = req.user?.companyId;
  if (!companyId) {
    res.json({ success: true, appointments: [] });
    return;
  }
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/appointments`).get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 3600 * 1000;

  const mine = all.filter((a: any) => {
    const ts = a.date ? new Date(a.date).getTime() : 0;
    if (ts < startOfDay || ts >= endOfDay) return false;
    if (a.hostId === userId) return true;
    if (a.host === email) return true;
    if (Array.isArray(a.participants) && email && a.participants.includes(email)) return true;
    return false;
  });

  res.json({ success: true, appointments: mine });
}));

// ─── GET /api/me/conversations ─────────────────────────────────────────────
// My conversations across agents.
router.get('/conversations', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!userId || !companyId) {
    res.json({ success: true, conversations: [] });
    return;
  }
  const db = getFirestore();
  const snap = await db.collection('conversations')
    .where('companyId', '==', companyId)
    .where('userId', '==', userId)
    .limit(100)
    .get();
  const conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, conversations });
}));

// ─── GET /api/me/agent-usage ───────────────────────────────────────────────
// My usage of each agent (count of my conversations grouped by agentId).
router.get('/agent-usage', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!userId || !companyId) {
    res.json({ success: true, usage: [] });
    return;
  }
  const db = getFirestore();
  const snap = await db.collection('conversations')
    .where('companyId', '==', companyId)
    .where('userId', '==', userId)
    .limit(500)
    .get();
  const counts: Record<string, number> = {};
  snap.docs.forEach(d => {
    const data = d.data() as any;
    const agent = data.agentId ?? 'unknown';
    counts[agent] = (counts[agent] ?? 0) + 1;
  });
  const usage = Object.entries(counts)
    .map(([agentId, count]) => ({ agentId, count }))
    .sort((a, b) => b.count - a.count);
  res.json({ success: true, usage });
}));

// ─── GET /api/me/summary ───────────────────────────────────────────────────
// Compact summary used by employee dashboard hero.
router.get('/summary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!userId || !companyId) {
    res.json({ success: true, summary: { conversations: 0, leavePending: 0, agendaToday: 0 } });
    return;
  }
  const db = getFirestore();
  const [convsSnap, leavesSnap] = await Promise.all([
    db.collection('conversations')
      .where('companyId', '==', companyId)
      .where('userId', '==', userId)
      .limit(500)
      .get(),
    db.collection('leaveRequests')
      .where('companyId', '==', companyId)
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get(),
  ]);

  // Count today's appointments where I'm host or participant
  const apptSnap = await db.collection(`companies/${companyId}/appointments`).get();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 3600 * 1000;
  const email = req.user?.email;
  const todayCount = apptSnap.docs.filter(d => {
    const a = d.data() as any;
    const ts = a.date ? new Date(a.date).getTime() : 0;
    if (ts < startOfDay || ts >= endOfDay) return false;
    return a.hostId === userId || a.host === email
      || (Array.isArray(a.participants) && email && a.participants.includes(email));
  }).length;

  res.json({
    success: true,
    summary: {
      conversations: convsSnap.size,
      leavePending: leavesSnap.size,
      agendaToday: todayCount,
    },
  });
}));

export default router;
