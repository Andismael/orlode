/**
 * Clone Analytics — aggregate stats on what the Clone has captured.
 *
 * GET /api/clone-analytics/summary?days=30
 *   Returns totals + channel breakdown for: appointments, reservations, leads,
 *   quote requests, orders. Aimed at the admin to see ROI of the Clone.
 */
import { Router } from 'express';
import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';

const router = Router();
router.use(authMiddleware);

async function countByChannel(
  db: FirebaseFirestore.Firestore,
  collPath: string,
  since: Date,
  extraFilter?: (d: FirebaseFirestore.QueryDocumentSnapshot) => boolean,
): Promise<{ total: number; byChannel: Record<string, number>; bySource: Record<string, number> }> {
  const snap = await db.collection(collPath).limit(2000).get().catch(() => null);
  if (!snap) return { total: 0, byChannel: {}, bySource: {} };
  const byChannel: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let total = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const createdAt = data['createdAt'];
    let t: Date | null = null;
    if (createdAt instanceof Date) t = createdAt;
    else if (typeof createdAt === 'object' && createdAt?._seconds) t = new Date(createdAt._seconds * 1000);
    else if (typeof createdAt === 'object' && (createdAt as { seconds?: number })?.seconds) t = new Date(((createdAt as { seconds: number }).seconds) * 1000);
    if (!t || t < since) continue;
    if (extraFilter && !extraFilter(d)) continue;
    total++;
    const ch = (data['sourceChannel'] as string) || 'unknown';
    byChannel[ch] = (byChannel[ch] ?? 0) + 1;
    const src = (data['createdBy'] as string) || 'human';
    bySource[src] = (bySource[src] ?? 0) + 1;
  }
  return { total, byChannel, bySource };
}

router.get('/summary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Unauthorized', 401);
  const days = Math.max(1, Math.min(365, Number(req.query['days']) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = getFirestore();

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
      if (o['status'] !== 'paid' && o['status'] !== 'fulfilled') continue;
      const createdAt = o['createdAt'];
      let t: Date | null = null;
      if (createdAt instanceof Date) t = createdAt;
      else if (typeof createdAt === 'object' && (createdAt as { _seconds?: number })?._seconds) t = new Date((createdAt as { _seconds: number })._seconds * 1000);
      else if (typeof createdAt === 'object' && (createdAt as { seconds?: number })?.seconds) t = new Date((createdAt as { seconds: number }).seconds * 1000);
      if (!t || t < since) continue;
      paidRevenue += Number(o['subtotal'] ?? 0);
      paidCount++;
      currency = (o['currency'] as string) ?? currency;
    }
  } catch { /* non-critical */ }

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

export default router;
