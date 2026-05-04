/**
 * API Keys — personal + company-wide.
 *
 * Access model:
 *   - `useApiKeys` permission required to create/list/revoke own keys
 *   - Admin/owner/superAdmin see ALL keys across all users
 *   - Non-admin users only see/revoke THEIR OWN keys
 *   - Webhooks remain admin-only
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnlyMiddleware } from '../middleware/adminOnly.middleware';
import { apiKeysService } from '../services/apiKeys.service';
import { AppError } from '../middleware/error.middleware';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response, NextFunction } from 'express';

const router = Router();
router.use(authMiddleware);

async function isSuperAdminOrAdmin(req: AuthenticatedRequest): Promise<boolean> {
  if (req.user?.role === 'admin' || req.user?.role === 'owner' || req.user?.role === 'manager') return true;
  try {
    const udoc = await getFirestore().collection('users').doc(req.user!.uid).get();
    return udoc.data()?.['superAdmin'] === true;
  } catch { return false; }
}

async function hasApiKeyPermission(req: AuthenticatedRequest): Promise<boolean> {
  if (await isSuperAdminOrAdmin(req)) return true;
  try {
    const db = getFirestore();
    const mdoc = await db.collection(`companies/${req.user!.companyId}/members`).doc(req.user!.uid).get();
    const perms = (mdoc.data()?.['permissions'] as string[]) ?? [];
    return perms.includes('useApiKeys');
  } catch { return false; }
}

// Permission gate for create/list/revoke own keys
async function requireApiKeyAccess(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  if (!(await hasApiKeyPermission(req))) return next(new AppError("Permission 'useApiKeys' requise. Demandez à votre administrateur.", 403));
  next();
}

// GET /api/apikeys — list keys (admin: all; user: own + shared with me)
router.get('/', requireApiKeyAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const uid = req.user?.uid;
  if (!companyId || !uid) throw new AppError('Company ID required', 400);
  const allKeys = await apiKeysService.listKeys(companyId);
  const isAdmin = await isSuperAdminOrAdmin(req);
  const filtered = isAdmin ? allKeys : allKeys.filter(k => {
    const owner = (k as { createdBy?: string }).createdBy;
    const shared = (k as { sharedWith?: string[] }).sharedWith ?? [];
    return owner === uid || shared.includes(uid);
  });
  // Tag relationship for the current user (owner vs shared-with)
  const tagged = filtered.map(k => {
    const owner = (k as { createdBy?: string }).createdBy;
    const shared = (k as { sharedWith?: string[] }).sharedWith ?? [];
    const relation = owner === uid ? 'owner' : shared.includes(uid) ? 'shared' : 'admin-view';
    return { ...k, relation };
  });
  res.json({ success: true, data: tagged });
}));

// POST /api/apikeys/:id/share — owner adds users to share list
// Body: { userIds: string[] } OR { emails: string[] }
router.post('/:id/share', requireApiKeyAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const uid = req.user?.uid;
  if (!companyId || !uid) throw new AppError('Auth required', 401);
  const { id } = req.params;
  const { userIds, emails } = req.body as { userIds?: string[]; emails?: string[] };

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/apiKeys`).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Clé introuvable', 404);
  const data = doc.data() as { createdBy?: string; sharedWith?: string[]; scopes?: string[] };

  // Only owner (or admin) can share
  const isAdmin = await isSuperAdminOrAdmin(req);
  if (!isAdmin && data.createdBy !== uid) throw new AppError('Seul le propriétaire peut partager cette clé.', 403);

  // Resolve emails to uids within the same company
  let toAdd: string[] = [...(userIds ?? [])];
  if (emails?.length) {
    const membersSnap = await db.collection(`companies/${companyId}/members`).get();
    for (const email of emails) {
      const lower = email.toLowerCase().trim();
      const m = membersSnap.docs.find(d => ((d.data()['email'] as string) ?? '').toLowerCase() === lower);
      if (m) toAdd.push(m.id);
    }
  }
  // Dedup + remove owner (no self-share)
  toAdd = Array.from(new Set(toAdd)).filter(u => u !== data.createdBy);

  const current = data.sharedWith ?? [];
  const next = Array.from(new Set([...current, ...toAdd]));
  await ref.update({
    sharedWith: next,
    sharedAt: FieldValue.serverTimestamp(),
  });

  // Audit: log the share
  await db.collection(`companies/${companyId}/apiKeyAuditLog`).add({
    action: 'share', keyId: id, by: uid, added: toAdd, at: new Date(),
  }).catch(() => {});

  res.json({ success: true, data: { sharedWith: next } });
}));

// DELETE /api/apikeys/:id/share/:userId — revoke a specific user's share
router.delete('/:id/share/:userId', requireApiKeyAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const uid = req.user?.uid;
  if (!companyId || !uid) throw new AppError('Auth required', 401);
  const { id, userId } = req.params;

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/apiKeys`).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Clé introuvable', 404);
  const data = doc.data() as { createdBy?: string; sharedWith?: string[] };

  const isAdmin = await isSuperAdminOrAdmin(req);
  // Owner can remove anyone; shared user can remove only themselves
  if (!isAdmin && data.createdBy !== uid && userId !== uid) {
    throw new AppError('Opération non autorisée.', 403);
  }

  const next = (data.sharedWith ?? []).filter(u => u !== userId);
  await ref.update({ sharedWith: next });

  await db.collection(`companies/${companyId}/apiKeyAuditLog`).add({
    action: 'unshare', keyId: id, by: uid, removed: userId, at: new Date(),
  }).catch(() => {});

  res.json({ success: true, data: { sharedWith: next } });
}));

// POST /api/apikeys — create a new key (createdBy = current user)
router.post('/', requireApiKeyAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Company ID required', 400);

  const { name, scopes, expiresInDays } = req.body as {
    name: string; scopes?: string[]; expiresInDays?: number;
  };
  if (!name) throw new AppError('Key name is required', 400);

  // Non-admins cannot grant admin-level scopes (e.g. 'write:billing', 'manageTeam')
  const isAdmin = await isSuperAdminOrAdmin(req);
  const safeScopes = isAdmin ? (scopes ?? ['read', 'agent']) : (scopes ?? ['read', 'agent']).filter(s => !s.startsWith('admin'));

  const result = await apiKeysService.createKey(companyId, userId, name, safeScopes, expiresInDays);
  res.json({
    success: true,
    data: result,
    warning: '⚠️ Enregistrez cette clé maintenant — elle ne sera plus affichée.',
  });
}));

// DELETE /api/apikeys/:id — revoke (admin: any, user: own only)
router.delete('/:id', requireApiKeyAccess, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { id } = req.params as { id: string };

  const isAdmin = await isSuperAdminOrAdmin(req);
  if (!isAdmin) {
    // Verify ownership
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/apiKeys`).doc(id).get();
    if (!doc.exists) throw new AppError('Key not found', 404);
    if (doc.data()?.['createdBy'] !== req.user?.uid) throw new AppError("Vous ne pouvez pas révoquer la clé d'un autre utilisateur.", 403);
  }

  await apiKeysService.revokeKey(companyId, id);
  res.json({ success: true, message: 'API key revoked' });
}));

// ── Webhooks — admin-only ────────────────────────────────────────────────────
const webhookRouter = Router();
webhookRouter.use(adminOnlyMiddleware);

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

webhookRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection(`companies/${companyId}/webhooks`).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, []);
  res.json({ success: true, data });
}));

webhookRouter.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { url, events } = req.body as { url: string; events: string[] };
  if (!url) throw new AppError('URL required', 400);
  const id = generateId();
  const webhook = { url, events: events ?? [], active: true, createdAt: new Date(), lastStatus: null };
  await safe(async () => {
    await getFirestore().collection(`companies/${companyId}/webhooks`).doc(id).set(webhook);
  }, undefined);
  res.status(201).json({ success: true, data: { id, ...webhook } });
}));

webhookRouter.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  await safe(async () => {
    await getFirestore().collection(`companies/${companyId}/webhooks`).doc(req.params['id']).delete();
  }, undefined);
  res.json({ success: true });
}));

webhookRouter.post('/:id/test', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const webhookDoc = await safe(async () => {
    return getFirestore().collection(`companies/${companyId}/webhooks`).doc(req.params['id']).get();
  }, null);
  if (!webhookDoc?.exists) { res.json({ success: false, message: 'Webhook not found' }); return; }
  const { url } = webhookDoc.data() as { url: string };
  let status = '500';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Orlode-Event': 'test' },
      body: JSON.stringify({ event: 'test', timestamp: new Date().toISOString(), source: 'corpmind' }),
      signal: AbortSignal.timeout(5000),
    });
    status = String(resp.status);
  } catch { status = 'timeout'; }
  await safe(async () => {
    await getFirestore().collection(`companies/${companyId}/webhooks`).doc(req.params['id']).update({ lastStatus: status });
  }, undefined);
  res.json({ success: true, data: { status } });
}));

router.use('/webhooks', webhookRouter);

export default router;
