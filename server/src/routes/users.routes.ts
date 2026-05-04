/**
 * Users Routes
 * - GET    /api/users          — lister les utilisateurs de l'entreprise
 * - POST   /api/users/invite   — inviter des collaborateurs (email Resend)
 * - PATCH  /api/users/:id/role — changer le rôle d'un utilisateur
 * - DELETE /api/users/:id      — supprimer un utilisateur
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnlyMiddleware as adminOnly } from '../middleware/adminOnly.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { sendInviteEmail } from '../services/email/emailService';

const router = Router();
router.use(authMiddleware);

// ── GET /api/users ─────────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db   = getFirestore();
  const snap = await db.collection('users')
    .where('companyId', '==', companyId)
    .get();

  const users = snap.docs.map(d => {
    const data = d.data();
    // Ne pas exposer les champs sensibles
    const { password: _p, ...safe } = data as Record<string, unknown>;
    return { id: d.id, ...safe };
  });

  res.json({ success: true, data: users });
}));

// ── POST /api/users/invite ─────────────────────────────────────────────────────

router.post('/invite', adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { invites, message } = req.body as {
    invites: { email: string; role: string }[];
    message?: string;
  };

  if (!invites?.length) throw new AppError('invites array required', 400);

  const db        = getFirestore();
  const companyId = req.user!.companyId;
  const inviterId = req.user!.uid;

  // Récupérer infos entreprise + inviteur
  const [companyDoc, inviterDoc] = await Promise.all([
    db.collection('companies').doc(companyId!).get(),
    db.collection('users').doc(inviterId).get(),
  ]);

  const companyName  = (companyDoc.data()?.name as string) ?? 'votre entreprise';
  const inviterName  = (inviterDoc.data()?.displayName as string) ?? req.user!.email ?? 'Un administrateur';
  const APP_URL      = process.env['APP_URL'] ?? 'https://orlode.com';

  const results = await Promise.allSettled(
    invites.map(async ({ email, role }) => {
      // Créer le token d'invitation en Firestore
      const tokenRef = db.collection('invites').doc();
      await tokenRef.set({
        email,
        role,
        companyId,
        invitedBy: inviterId,
        message:   message ?? '',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        status:    'pending',
      });

      const inviteUrl = `${APP_URL}/invite/${tokenRef.id}`;

      await sendInviteEmail({
        to:          email,
        inviteeName: email,
        companyName,
        inviterName,
        inviteUrl,
      });

      return { email, token: tokenRef.id };
    })
  );

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').map((r, i) =>
    ({ email: invites[i]?.email, reason: (r as PromiseRejectedResult).reason?.message })
  );

  res.json({ success: true, sent, failed });
}));

// ── PATCH /api/users/:id/role ──────────────────────────────────────────────────

router.patch('/:id/role', adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body as { role: string };
  const validRoles = ['admin', 'manager', 'employee', 'viewer'];

  if (!validRoles.includes(role)) {
    throw new AppError(`Role must be one of: ${validRoles.join(', ')}`, 400);
  }

  // Empêcher un admin de modifier son propre rôle
  if (req.params.id === req.user?.uid) {
    throw new AppError('Vous ne pouvez pas modifier votre propre rôle', 400);
  }

  const db = getFirestore();
  await db.collection('users').doc(req.params.id).update({ role });
  res.json({ success: true });
}));

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────

router.delete('/:id', adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.params.id === req.user?.uid) {
    throw new AppError('Vous ne pouvez pas supprimer votre propre compte', 400);
  }

  const db = getFirestore();
  await db.collection('users').doc(req.params.id).update({
    companyId: '',
    deletedAt: new Date().toISOString(),
  });
  res.json({ success: true });
}));

export default router;
