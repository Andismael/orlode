import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { register, verifyToken, getMyCompanies } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { getAuth, getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { sendWelcomeEmail } from '../services/email/emailService';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/auth/register
router.post('/register', authRateLimiter, asyncHandler(register));

// POST /api/auth/welcome-email — fire welcome email (called from client after signup)
router.post('/welcome-email', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { companyName, plan, userName } = req.body as { companyName?: string; plan?: string; userName?: string };
  const email = req.user?.email;
  const name = userName ?? email?.split('@')[0] ?? 'friend';
  if (!email) throw new AppError('User email required', 400);

  try {
    await sendWelcomeEmail({
      to: email,
      userName: name,
      companyName: companyName ?? 'votre entreprise',
      plan,
    });
    res.json({ success: true });
  } catch (err) {
    logger.error('[Welcome email] failed', { err: String(err), email });
    res.json({ success: false, error: String(err) });
  }
}));

// POST /api/auth/verify-token
router.post('/verify-token', authMiddleware, asyncHandler(verifyToken));

// GET /api/auth/my-companies
router.get('/my-companies', authMiddleware, asyncHandler(getMyCompanies));

// GET /api/auth/invite/:token — verify invitation (public, no auth)
router.get('/invite/:token', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const db = getFirestore();
  const doc = await db.collection('invites').doc(token).get();

  if (!doc.exists) throw new AppError('Invitation invalide ou expirée', 404);

  const data = doc.data()!;
  if (data['status'] === 'accepted') throw new AppError('Invitation déjà acceptée', 400);
  if (data['expiresAt'] && new Date(data['expiresAt']) < new Date()) throw new AppError('Invitation expirée', 400);

  // Get company name
  const companyDoc = await db.collection('companies').doc(data['companyId'] as string).get();
  const companyName = (companyDoc.data()?.['name'] as string) ?? 'Entreprise';

  res.json({
    success: true,
    data: {
      email: data['email'],
      role: data['role'],
      companyName,
      companyId: data['companyId'],
    },
  });
}));

// POST /api/auth/accept-invite — accept invitation (auth required)
router.post('/accept-invite', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token, displayName, photoURL } = req.body as { token: string; displayName?: string; photoURL?: string };
  if (!token) throw new AppError('Token required', 400);

  const db = getFirestore();
  const doc = await db.collection('invites').doc(token).get();
  if (!doc.exists) throw new AppError('Invitation invalide', 404);

  const data = doc.data()!;
  if (data['status'] === 'accepted') throw new AppError('Invitation déjà acceptée', 400);

  const uid = req.user?.uid;
  const email = req.user?.email ?? (data['email'] as string) ?? '';
  if (!uid) throw new AppError('Not authenticated', 401);

  const companyId = data['companyId'] as string;
  const role = data['role'] as string;

  // Update user with company + role (don't downgrade existing admins)
  const existingUser = await db.collection('users').doc(uid).get();
  const existingRole = existingUser.data()?.['role'] as string | undefined;
  const newRole = (existingRole === 'admin' || existingRole === 'manager') ? existingRole : (role ?? 'employee');

  const finalDisplayName = displayName ?? (existingUser.data()?.['displayName'] as string) ?? email.split('@')[0];
  const finalPhotoURL = photoURL ?? (existingUser.data()?.['photoURL'] as string) ?? '';

  await db.collection('users').doc(uid).set({
    uid, email,
    displayName: finalDisplayName,
    photoURL: finalPhotoURL,
    companyId,
    role: newRole,
    invitedBy: data['invitedBy'],
    inviteAcceptedAt: new Date(),
  }, { merge: true });

  // Seed the members subcollection so the user appears in /admin/users immediately
  try {
    await db.collection(`companies/${companyId}/members`).doc(uid).set({
      uid, email,
      displayName: finalDisplayName,
      photoURL: finalPhotoURL,
      role: newRole,
      status: 'active',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });
  } catch (err) {
    logger.warn('[auth/accept-invite] Failed to seed member doc', { uid, companyId, err: String(err) });
  }

  // CRITICAL: also set Firebase custom claims so the auth middleware picks up the right companyId
  // on the next token refresh. Without this, req.user.companyId falls back to uid → broken access.
  try {
    await getAuth().setCustomUserClaims(uid, { companyId, role: newRole });
  } catch (err) {
    logger.error('[auth/accept-invite] Failed to set custom claims', { uid, companyId, err: String(err) });
  }

  // Mark invite as accepted
  await db.collection('invites').doc(token).update({
    status: 'accepted',
    acceptedBy: uid,
    acceptedAt: new Date(),
  });

  // Client must call `user.getIdToken(true)` (force refresh) to pick up the new claims.
  res.json({ success: true, data: { companyId, role: newRole, requiresTokenRefresh: true } });
}));

export default router;
