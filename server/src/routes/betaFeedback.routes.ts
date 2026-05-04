/**
 * Beta feedback — collected during the launch phase to triage bugs / features.
 *
 * One simple endpoint: POST /api/beta-feedback. Saves to a top-level Firestore
 * collection `betaFeedback` so the team can review across all companies.
 * No PII validation here — the auth middleware already gives us the user's
 * companyId and uid.
 */
import { Router, type Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// POST /api/beta-feedback — submit feedback on a beta agent or bundle
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!userId || !companyId) throw new AppError('Auth required', 401);

  const body = req.body as {
    agentId?: string;
    bundleId?: string;
    type?: 'bug' | 'feature' | 'praise' | 'other';
    title?: string;
    description?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    page?: string;
  };

  const title = (body.title ?? '').trim();
  const description = (body.description ?? '').trim();
  if (!title || !description) throw new AppError('title and description required', 400);

  const db = getFirestore();
  const docRef = await db.collection('betaFeedback').add({
    userId,
    companyId,
    userEmail: req.user?.email ?? null,
    agentId: body.agentId ?? null,
    bundleId: body.bundleId ?? null,
    type: body.type ?? 'other',
    severity: body.severity ?? 'medium',
    title: title.slice(0, 200),
    description: description.slice(0, 4000),
    page: body.page ?? null,
    status: 'new',
    createdAt: FieldValue.serverTimestamp(),
  });

  logger.info('[BetaFeedback] received', {
    id: docRef.id, companyId, userId,
    type: body.type, agentId: body.agentId, bundleId: body.bundleId,
  });

  res.json({ success: true, data: { id: docRef.id, message: 'Merci pour ton feedback !' } });
}));

// GET /api/beta-feedback — list feedback (admin-only check happens upstream)
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin') throw new AppError('Admin only', 403);
  const db = getFirestore();
  const snap = await db.collection('betaFeedback').orderBy('createdAt', 'desc').limit(200).get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

export default router;
