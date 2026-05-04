/**
 * Notification routes — CRUD for user notifications
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';

const router = Router();
router.use(authMiddleware);

// GET /api/notifications — list my notifications
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!uid || !companyId) throw new AppError('Auth required', 401);

  try {
    const db = getFirestore();
    // Get user-specific + company-wide notifications
    const [userSnap, companySnap] = await Promise.all([
      db.collection('notifications')
        .where('userId', '==', uid)
        .limit(50).get(),
      db.collection('notifications')
        .where('companyId', '==', companyId)
        .where('userId', '==', null)
        .limit(50).get(),
    ]);

    const all = [
      ...userSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      ...companySnap.docs.map(d => ({ id: d.id, ...d.data() })),
    ];

    // Sort by createdAt desc
    all.sort((a, b) => {
      const ta = (a as Record<string, unknown>)['createdAt'];
      const tb = (b as Record<string, unknown>)['createdAt'];
      const da = ta && typeof ta === 'object' && 'toDate' in ta ? (ta as { toDate: () => Date }).toDate().getTime() : new Date(ta as string).getTime();
      const db2 = tb && typeof tb === 'object' && 'toDate' in tb ? (tb as { toDate: () => Date }).toDate().getTime() : new Date(tb as string).getTime();
      return db2 - da;
    });

    res.json({ success: true, data: all.slice(0, 50) });
  } catch {
    res.json({ success: true, data: [] });
  }
}));

// GET /api/notifications/unread-count
router.get('/unread-count', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!uid || !companyId) throw new AppError('Auth required', 401);

  try {
    const db = getFirestore();
    const [userSnap, companySnap] = await Promise.all([
      db.collection('notifications')
        .where('userId', '==', uid)
        .where('read', '==', false)
        .limit(100).get(),
      db.collection('notifications')
        .where('companyId', '==', companyId)
        .where('userId', '==', null)
        .where('read', '==', false)
        .limit(100).get(),
    ]);
    res.json({ success: true, data: { count: userSnap.size + companySnap.size } });
  } catch {
    res.json({ success: true, data: { count: 0 } });
  }
}));

// PATCH /api/notifications/:id/read
router.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  await db.collection('notifications').doc(req.params.id).update({ read: true });
  res.json({ success: true });
}));

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  const companyId = req.user?.companyId;
  if (!uid || !companyId) throw new AppError('Auth required', 401);

  const db = getFirestore();
  const batch = db.batch();

  const [userSnap, companySnap] = await Promise.all([
    db.collection('notifications').where('userId', '==', uid).where('read', '==', false).limit(100).get(),
    db.collection('notifications').where('companyId', '==', companyId).where('userId', '==', null).where('read', '==', false).limit(100).get(),
  ]);

  [...userSnap.docs, ...companySnap.docs].forEach(doc => {
    batch.update(doc.ref, { read: true });
  });

  await batch.commit();
  res.json({ success: true });
}));

// DELETE /api/notifications/:id
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  await db.collection('notifications').doc(req.params.id).delete();
  res.json({ success: true });
}));

export default router;
