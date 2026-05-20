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
import { logger } from '../utils/logger';
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
  // Accept BOTH forms:
  //   (a) bulk: { invites: [{ email, role }], message? }   ← legacy
  //   (b) flat: { email, role, name, position, department, phone, hireDate,
  //               salary, photoBase64, photoMimeType }     ← HR NewEmployeeModal
  const body = req.body as Record<string, unknown>;
  let invites: Array<{ email: string; role: string }>;
  let extraFields: Record<string, unknown> = {};

  if (Array.isArray(body['invites'])) {
    invites = body['invites'] as Array<{ email: string; role: string }>;
  } else if (typeof body['email'] === 'string') {
    invites = [{ email: body['email'] as string, role: (body['role'] as string) ?? 'employee' }];
    extraFields = {
      ...(body['name'] ? { name: body['name'] } : {}),
      ...(body['position'] ? { position: body['position'] } : {}),
      ...(body['department'] ? { department: body['department'] } : {}),
      ...(body['contractType'] ? { contractType: body['contractType'] } : {}),
      ...(body['phone'] ? { phone: body['phone'] } : {}),
      ...(body['hireDate'] ? { hireDate: body['hireDate'] } : {}),
      ...(typeof body['salary'] === 'number' ? { salary: body['salary'] } : {}),
    };
  } else {
    throw new AppError('email or invites[] required', 400);
  }
  const message = body['message'] as string | undefined;

  // Optional photo upload — stored in Firebase Storage, URL persisted on invite + later on user
  let photoUrl: string | null = null;
  const photoBase64 = body['photoBase64'] as string | undefined;
  const photoMimeType = (body['photoMimeType'] as string | undefined) ?? 'image/jpeg';
  if (photoBase64) {
    try {
      const buf = Buffer.from(photoBase64, 'base64');
      if (buf.length <= 4 * 1024 * 1024) {
        const { getStorage } = await import('../config/firebase.config');
        const bucket = getStorage().bucket();
        const ext = photoMimeType.includes('png') ? 'png' : photoMimeType.includes('webp') ? 'webp' : 'jpg';
        const path = `employees/${req.user!.companyId}/photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        await bucket.file(path).save(buf, { metadata: { contentType: photoMimeType }, public: true });
        photoUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;
      }
    } catch (err) {
      // Photo failure shouldn't block the invite
      logger.warn('[Users] Invite photo upload failed', { err: String(err) });
    }
  }

  if (!invites.length) throw new AppError('invites array required', 400);

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
        ...(photoUrl ? { photoUrl } : {}),
        ...extraFields,
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

// SECURITY helper: assert that the target user belongs to the caller's company.
// Without this, an admin from company A could rewrite roles or delete users in
// company B, since `adminOnly` only checks the caller's own role.
async function assertSameCompany(targetUserId: string, callerCompanyId: string | undefined): Promise<void> {
  if (!callerCompanyId) throw new AppError('Auth required', 401);
  const db = getFirestore();
  const target = await db.collection('users').doc(targetUserId).get();
  if (!target.exists) throw new AppError('User not found', 404);
  const targetCompanyId = (target.data()?.['companyId'] as string) ?? '';
  if (targetCompanyId !== callerCompanyId) {
    throw new AppError('User does not belong to your company', 403);
  }
}

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

  // SECURITY: cross-tenant guard
  await assertSameCompany(req.params.id, req.user?.companyId);

  const db = getFirestore();
  await db.collection('users').doc(req.params.id).update({ role });
  res.json({ success: true });
}));

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────

router.delete('/:id', adminOnly, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.params.id === req.user?.uid) {
    throw new AppError('Vous ne pouvez pas supprimer votre propre compte', 400);
  }

  // SECURITY: cross-tenant guard
  await assertSameCompany(req.params.id, req.user?.companyId);

  const db = getFirestore();
  await db.collection('users').doc(req.params.id).update({
    companyId: '',
    deletedAt: new Date().toISOString(),
  });
  // Also drop the corresponding members subcollection entry so the user can't
  // re-appear in team listings, and revoke Firebase custom claims so the
  // existing JWT can no longer access company data after the next refresh.
  await db.collection(`companies/${req.user!.companyId}/members`).doc(req.params.id).delete().catch(() => {});
  try {
    const { getAuth } = await import('../config/firebase.config');
    await getAuth().setCustomUserClaims(req.params.id, null);
  } catch { /* best-effort */ }
  res.json({ success: true });
}));

export default router;
