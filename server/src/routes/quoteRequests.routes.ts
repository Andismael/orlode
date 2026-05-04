/**
 * Quote Requests (lightweight — from Clone). Separate from formal quotes.
 *
 * GET    /api/quote-requests         — list (filter by status)
 * PATCH  /api/quote-requests/:id     — action: accept | reject | convertToQuote
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

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Unauthorized', 401);
  const { status } = req.query as Record<string, string | undefined>;
  const db = getFirestore();
  let q: FirebaseFirestore.Query = db.collection(`companies/${companyId}/quoteRequests`);
  if (status) q = q.where('status', '==', status);
  const snap = await q.limit(500).get().catch(async () => await db.collection(`companies/${companyId}/quoteRequests`).limit(500).get());
  const items: Array<Record<string, unknown>> = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => {
    const ca = a['createdAt'] as { seconds?: number } | Date | undefined;
    const cb = b['createdAt'] as { seconds?: number } | Date | undefined;
    const ta = ca instanceof Date ? ca.getTime() : (ca?.seconds ?? 0) * 1000;
    const tb = cb instanceof Date ? cb.getTime() : (cb?.seconds ?? 0) * 1000;
    return tb - ta;
  });
  res.json({ success: true, data: items });
}));

router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Unauthorized', 401);
  const { id } = req.params;
  const { action, notes } = req.body as { action?: string; notes?: string };
  if (!action || !['accept', 'reject', 'convert'].includes(action)) {
    throw new AppError('Invalid action (accept | reject | convert)', 400);
  }
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/quoteRequests`).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Not found', 404);

  const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy: userId };
  if (action === 'accept') { updates['status'] = 'accepted'; updates['acceptedAt'] = new Date(); }
  if (action === 'reject') { updates['status'] = 'rejected'; updates['rejectedAt'] = new Date(); if (notes) updates['rejectNote'] = notes; }
  if (action === 'convert') { updates['status'] = 'converted'; updates['convertedAt'] = new Date(); }

  await ref.update(updates);
  res.json({ success: true, data: { id, ...((await ref.get()).data()) } });
}));

export default router;
