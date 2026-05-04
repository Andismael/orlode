/**
 * Team Routes — Full team collaboration layer V2
 * ✅ createdBy/createdByName/updatedAt everywhere
 * ✅ Member status: active | invited | suspended | removed
 * ✅ Channel types: general | private | project | agent
 * ✅ Activity entityType + entityId
 * ✅ allowedAgents + allowedModules on members
 * ✅ Polling V1, ready for Firestore realtime V2
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// ── Types ───────────────────────────────────────────────────────────────────
type TeamRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
type MemberStatus = 'active' | 'invited' | 'suspended' | 'removed';
type ChannelType = 'general' | 'private' | 'project' | 'agent';

const ROLE_HIERARCHY: Record<TeamRole, number> = { owner: 100, admin: 80, manager: 60, member: 40, viewer: 20 };

const DEFAULT_PERMISSIONS: Record<TeamRole, string[]> = {
  owner:   ['manageTeam', 'inviteMembers', 'removeMembers', 'viewAgents', 'editAgents', 'publishAgents', 'accessBilling', 'accessAnalytics', 'accessMarketplace', 'accessSettings', 'manageChannels', 'accessSales', 'accessSupport', 'accessIT', 'accessHR', 'accessLegal', 'useVoiceLive', 'connectorsShared', 'connectorsCritical', 'useApiKeys'],
  admin:   ['manageTeam', 'inviteMembers', 'removeMembers', 'viewAgents', 'editAgents', 'publishAgents', 'accessAnalytics', 'accessMarketplace', 'accessSettings', 'manageChannels', 'accessSales', 'accessSupport', 'accessIT', 'accessHR', 'accessLegal', 'useVoiceLive', 'connectorsShared', 'connectorsCritical', 'useApiKeys'],
  manager: ['inviteMembers', 'viewAgents', 'editAgents', 'accessAnalytics', 'accessMarketplace', 'accessSales', 'accessSupport', 'accessIT', 'accessHR', 'useVoiceLive', 'connectorsShared', 'useApiKeys'],
  member:  ['viewAgents', 'accessMarketplace'],
  viewer:  ['viewAgents'],
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const getUserName = (req: AuthenticatedRequest) => (req.user as Record<string, unknown>)?.['displayName'] as string ?? '';
const getUserPhoto = (req: AuthenticatedRequest) => (req.user as Record<string, unknown>)?.['photoURL'] as string ?? '';

async function logActivity(
  companyId: string, action: string, userId: string, userName: string,
  entityType?: string, entityId?: string, details?: Record<string, unknown>,
) {
  const db = getFirestore();
  await db.collection(`companies/${companyId}/activities`).add({
    action, userId, userName,
    entityType: entityType ?? null,
    entityId: entityId ?? null,
    details: details ?? {},
    createdBy: userId,
    createdByName: userName,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function checkPermission(companyId: string, userId: string, permission: string): Promise<boolean> {
  const db = getFirestore();
  const memberDoc = await db.collection(`companies/${companyId}/members`).doc(userId).get();
  if (!memberDoc.exists) {
    // Owner fallback
    const companyDoc = await db.collection('companies').doc(companyId).get();
    return companyDoc.data()?.['ownerId'] === userId;
  }
  const data = memberDoc.data()!;
  if (data['status'] === 'suspended' || data['status'] === 'removed') return false;
  const perms = (data['permissions'] as string[]) ?? DEFAULT_PERMISSIONS[(data['role'] as TeamRole) ?? 'member'];
  return perms.includes(permission);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM INFO
// ═══════════════════════════════════════════════════════════════════════════

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId) throw new AppError('Company required', 400);
  const db = getFirestore();

  const companyDoc = await db.collection('companies').doc(companyId).get();
  const company = companyDoc.data() ?? {};
  const ownerId = company['ownerId'] as string | undefined;

  // Auto-seed owner as member if not exists
  if (userId && ownerId === userId) {
    const ownerMemberDoc = await db.collection(`companies/${companyId}/members`).doc(userId).get();
    if (!ownerMemberDoc.exists) {
      await db.collection(`companies/${companyId}/members`).doc(userId).set({
        uid: userId,
        email: req.user?.email ?? '',
        displayName: getUserName(req) || (req.user?.email ?? ''),
        photoURL: getUserPhoto(req),
        role: 'owner' as TeamRole,
        permissions: DEFAULT_PERMISSIONS['owner'],
        allowedAgents: [],
        allowedModules: [],
        status: 'active' as MemberStatus,
        joinedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await logActivity(companyId, 'team_created', userId, getUserName(req) || (req.user?.email ?? ''), 'team', companyId);
    }
  }

  // Load from BOTH sources and merge:
  //   1. companies/{id}/members (team subcollection — canonical)
  //   2. users where companyId == companyId (invited users who haven't been migrated yet)
  const [membersSnap, usersSnap] = await Promise.all([
    db.collection(`companies/${companyId}/members`).limit(200).get().catch(() => null),
    db.collection('users').where('companyId', '==', companyId).limit(200).get().catch(() => null),
  ]);

  const byUid = new Map<string, Record<string, unknown>>();

  // 1) Team members subcollection (wins on role/permissions)
  if (membersSnap) {
    for (const d of membersSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      byUid.set(d.id, { id: d.id, uid: d.id, ...data });
    }
  }

  // 2) Legacy users collection — fill gaps
  if (usersSnap) {
    for (const d of usersSnap.docs) {
      const u = d.data() as Record<string, unknown>;
      const existing = byUid.get(d.id);
      if (existing) {
        // Augment missing fields (displayName, email, photoURL) from user doc
        byUid.set(d.id, {
          ...existing,
          email:       existing['email']       ?? u['email'],
          displayName: existing['displayName'] ?? u['displayName'],
          photoURL:    existing['photoURL']    ?? u['photoURL'],
        });
      } else {
        // Not in subcollection → fabricate a member entry
        byUid.set(d.id, {
          id: d.id,
          uid: d.id,
          email: u['email'],
          displayName: u['displayName'],
          photoURL: u['photoURL'],
          role: (u['role'] as string) ?? (u['uid'] === ownerId ? 'owner' : 'member'),
          permissions: (u['permissions'] as string[]) ?? [],
          status: 'active',
          source: 'users_collection',
        });
      }
    }
  }

  const members = Array.from(byUid.values()).filter(m => {
    const s = m['status'] as string | undefined;
    return !s || s === 'active' || s === 'invited';
  });

  res.json({ success: true, data: { team: { id: companyId, name: company['name'], plan: company['plan'], ownerId }, members } });
}));

// GET /api/team/members — flat list of members (alias of GET / for clients
// that expect just the members array). Mirrors the merge logic above.
router.get('/members', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const db = getFirestore();

  const [membersSnap, usersSnap] = await Promise.all([
    db.collection(`companies/${companyId}/members`).limit(200).get().catch(() => null),
    db.collection('users').where('companyId', '==', companyId).limit(200).get().catch(() => null),
  ]);
  const byUid = new Map<string, Record<string, unknown>>();
  if (membersSnap) {
    for (const d of membersSnap.docs) byUid.set(d.id, { id: d.id, uid: d.id, ...d.data() });
  }
  if (usersSnap) {
    for (const d of usersSnap.docs) {
      const u = d.data() as Record<string, unknown>;
      const existing = byUid.get(d.id);
      if (existing) {
        byUid.set(d.id, { ...existing, email: existing['email'] ?? u['email'], displayName: existing['displayName'] ?? u['displayName'], photoURL: existing['photoURL'] ?? u['photoURL'] });
      } else {
        byUid.set(d.id, { id: d.id, uid: d.id, email: u['email'], displayName: u['displayName'], photoURL: u['photoURL'], role: u['role'] ?? 'member', status: 'active' });
      }
    }
  }
  const members = Array.from(byUid.values()).filter(m => {
    const s = m['status'] as string | undefined;
    return !s || s === 'active' || s === 'invited';
  });
  res.json({ success: true, data: members });
}));

// ═══════════════════════════════════════════════════════════════════════════
// INVITES
// ═══════════════════════════════════════════════════════════════════════════

router.post('/invite', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const can = await checkPermission(companyId, userId, 'inviteMembers');
  if (!can) throw new AppError('Permission denied: inviteMembers', 403);

  const { email, phone, role, permissions, allowedAgents, allowedModules } = req.body as {
    email: string; phone?: string; role?: TeamRole; permissions?: string[];
    allowedAgents?: string[]; allowedModules?: string[];
  };
  if (!email) throw new AppError('Email required', 400);

  const db = getFirestore();
  const assignedRole = role ?? 'member';
  const assignedPerms = permissions ?? DEFAULT_PERMISSIONS[assignedRole];
  const token = generateId();
  const userName = getUserName(req);
  const trimmedPhone = phone?.trim() ?? '';

  await db.collection(`companies/${companyId}/invites`).doc(token).set({
    email: email.toLowerCase().trim(),
    phone: trimmedPhone || null,
    role: assignedRole,
    permissions: assignedPerms,
    allowedAgents: allowedAgents ?? [],
    allowedModules: allowedModules ?? [],
    status: 'pending' as const,
    createdBy: userId,
    createdByName: userName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const companyDoc = await db.collection('companies').doc(companyId).get();
  const companyName = (companyDoc.data()?.['name'] as string) ?? 'Orlode';
  const inviteUrl = `https://orlode.com/invite/${token}`;
  const channels: Array<'email' | 'whatsapp'> = [];
  const channelErrors: Record<string, string> = {};

  // ── Email channel ──
  try {
    const { sendEmail } = await import('../services/email/emailService');
    await sendEmail({
      to: email,
      subject: `Invitation a rejoindre ${companyName} sur Orlode`,
      html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px">
        <h2>Vous etes invite !</h2>
        <p><strong>${userName || 'Un administrateur'}</strong> vous invite a rejoindre <strong>${companyName}</strong> sur Orlode AI.</p>
        <p>Role: <strong>${assignedRole}</strong></p>
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#6c3ce0;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Accepter l'invitation</a>
        <p style="color:#888;font-size:12px">Ce lien expire dans 7 jours.</p>
      </div>`,
    });
    channels.push('email');
  } catch (err) {
    channelErrors['email'] = (err as Error).message;
    logger.warn('[Team] Email send failed', { error: err });
  }

  // ── WhatsApp channel (optional) ──
  if (trimmedPhone) {
    try {
      const { whatsappService } = await import('../services/whatsapp/whatsappService');
      const config = await whatsappService.getConfig(companyId).catch(() => null);
      if (!config) {
        channelErrors['whatsapp'] = 'WhatsApp non connecté pour cette entreprise — invitation email envoyée uniquement.';
      } else {
        const message = `🎉 *Invitation Orlode AI*\n\n${userName || 'Un administrateur'} vous invite à rejoindre *${companyName}* sur Orlode AI.\n\nRôle : *${assignedRole}*\n\nAcceptez l'invitation ici :\n${inviteUrl}\n\n_Ce lien expire dans 7 jours._`;
        await whatsappService.sendMessage(config, trimmedPhone, message);
        channels.push('whatsapp');
      }
    } catch (err) {
      channelErrors['whatsapp'] = (err as Error).message;
      logger.warn('[Team] WhatsApp invite send failed', { error: err });
    }
  }

  await logActivity(companyId, 'invite_sent', userId, userName, 'invite', token, {
    email, phone: trimmedPhone || null, role: assignedRole, channels, channelErrors,
  });

  res.json({ success: true, data: { token, email, phone: trimmedPhone || null, role: assignedRole, channels, channelErrors } });
}));

router.post('/invite/:token/accept', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.uid;
  if (!userId) throw new AppError('Auth required', 401);

  const { token } = req.params;
  const db = getFirestore();

  // Find invite
  const companiesSnap = await db.collectionGroup('invites').where('__name__', '==', token).limit(1).get();
  if (companiesSnap.empty) throw new AppError('Invite not found or expired', 404);

  const inviteDoc = companiesSnap.docs[0];
  const invite = inviteDoc.data();
  const companyId = inviteDoc.ref.parent.parent!.id;

  if (invite['status'] !== 'pending') throw new AppError('Invite already used', 400);
  if (invite['expiresAt'] && new Date(invite['expiresAt'].toDate?.() ?? invite['expiresAt']) < new Date())
    throw new AppError('Invite expired', 400);

  const userName = getUserName(req);

  // Add member with full fields
  await db.collection(`companies/${companyId}/members`).doc(userId).set({
    uid: userId,
    email: req.user?.email ?? '',
    displayName: userName,
    photoURL: getUserPhoto(req),
    role: invite['role'] ?? 'member',
    permissions: invite['permissions'] ?? DEFAULT_PERMISSIONS['member'],
    allowedAgents: invite['allowedAgents'] ?? [],
    allowedModules: invite['allowedModules'] ?? [],
    status: 'active' as MemberStatus,
    joinedAt: FieldValue.serverTimestamp(),
    invitedBy: invite['createdBy'] ?? invite['invitedBy'],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Update user's companyId
  await db.collection('users').doc(userId).update({ companyId, role: invite['role'] ?? 'member' });

  // Auto-create HR employee record so RH/agents can act on this person immediately.
  // Info minimal — admin can enrich later (salary, department, etc.)
  await db.collection(`companies/${companyId}/employees`).doc(userId).set({
    id: userId,
    userId,
    email: req.user?.email ?? '',
    displayName: userName,
    photoURL: getUserPhoto(req),
    role: invite['role'] ?? 'member',
    jobTitle: invite['jobTitle'] ?? '',
    department: invite['department'] ?? '',
    baseSalary: invite['baseSalary'] ?? 0,
    currency: invite['currency'] ?? 'XOF',
    startDate: new Date().toISOString().split('T')[0],
    status: 'active',
    source: 'invite',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch(err => {
    // Non-blocking — if it fails, invite acceptance still succeeds
    console.warn('[team/accept] Auto-create employee failed', { userId, err: String(err) });
  });

  // Mark invite accepted
  await inviteDoc.ref.update({ status: 'accepted', acceptedBy: userId, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

  await logActivity(companyId, 'invite_accepted', userId, userName, 'member', userId, { role: invite['role'] });

  res.json({ success: true, data: { companyId, role: invite['role'] } });
}));

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Change role
router.patch('/members/:memberId/role', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'manageTeam'))) throw new AppError('Permission denied', 403);

  const { memberId } = req.params;
  const { role } = req.body as { role: TeamRole };
  if (!role || !ROLE_HIERARCHY[role]) throw new AppError('Invalid role', 400);

  const db = getFirestore();
  await db.collection(`companies/${companyId}/members`).doc(memberId).set({
    role, permissions: DEFAULT_PERMISSIONS[role], updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await logActivity(companyId, 'role_changed', userId, getUserName(req), 'member', memberId, { newRole: role });
  res.json({ success: true });
}));

// Update permissions
router.patch('/members/:memberId/permissions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'manageTeam'))) throw new AppError('Permission denied', 403);

  const { memberId } = req.params;
  const { permissions } = req.body as { permissions: string[] };
  if (!Array.isArray(permissions)) throw new AppError('permissions array required', 400);

  const db = getFirestore();
  await db.collection(`companies/${companyId}/members`).doc(memberId).set({
    permissions, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await logActivity(companyId, 'permission_changed', userId, getUserName(req), 'member', memberId, { permissions });
  res.json({ success: true });
}));

// Update allowed agents/modules for a member
router.patch('/members/:memberId/access', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'manageTeam'))) throw new AppError('Permission denied', 403);

  const { memberId } = req.params;
  const { allowedAgents, allowedModules } = req.body as { allowedAgents?: string[]; allowedModules?: string[] };

  const db = getFirestore();
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (allowedAgents) update['allowedAgents'] = allowedAgents;
  if (allowedModules) update['allowedModules'] = allowedModules;

  await db.collection(`companies/${companyId}/members`).doc(memberId).set(update, { merge: true });

  await logActivity(companyId, 'access_changed', userId, getUserName(req), 'member', memberId, { allowedAgents, allowedModules });
  res.json({ success: true });
}));

// ── Per-agent RBAC ─────────────────────────────────────────────────────────
// GET /api/team/members/:memberId/agent-roles — read agentRoles map
router.get('/members/:memberId/agent-roles', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const { memberId } = req.params;
  const db = getFirestore();
  const doc = await db.collection('users').doc(memberId).get();
  const agentRoles = (doc.data()?.['agentRoles'] as Record<string, 'admin' | 'user' | null>) ?? {};
  res.json({ success: true, data: agentRoles });
}));

// PUT /api/team/members/:memberId/agent-roles — update agentRoles map
router.put('/members/:memberId/agent-roles', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'manageTeam'))) throw new AppError('Permission denied', 403);

  const { memberId } = req.params;
  const agentRoles = (req.body as { agentRoles?: Record<string, 'admin' | 'user' | null> }).agentRoles ?? {};

  const db = getFirestore();
  await db.collection('users').doc(memberId).set({
    agentRoles, agentRolesUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // Invalidate RBAC cache for that user so new roles take effect immediately
  const { invalidateRbacCache } = await import('../middleware/agentRbac.middleware');
  invalidateRbacCache(memberId);

  await logActivity(companyId, 'agent_roles_changed', userId, getUserName(req), 'member', memberId, { agentRoles });
  res.json({ success: true });
}));

// GET /api/team/my-agent-roles — current user's roles (used by sidebar)
router.get('/my-agent-roles', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) throw new AppError('Auth required', 401);
  const db = getFirestore();
  const doc = await db.collection('users').doc(uid).get();
  const data = doc.data() ?? {};
  res.json({
    success: true,
    data: {
      agentRoles:  (data['agentRoles'] as Record<string, 'admin' | 'user' | null>) ?? {},
      isOwner:     (data['isCompanyOwner'] as boolean) === true,
      legacyRole:  (data['role'] as string) ?? 'member',
    },
  });
}));

// Suspend member
router.patch('/members/:memberId/suspend', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'manageTeam'))) throw new AppError('Permission denied', 403);

  const { memberId } = req.params;
  const db = getFirestore();
  const memberDoc = await db.collection(`companies/${companyId}/members`).doc(memberId).get();
  if (memberDoc.exists && memberDoc.data()?.['role'] === 'owner') throw new AppError('Cannot suspend owner', 400);

  await db.collection(`companies/${companyId}/members`).doc(memberId).set({
    status: 'suspended' as MemberStatus, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await logActivity(companyId, 'member_suspended', userId, getUserName(req), 'member', memberId, { memberName: memberDoc.data()?.['displayName'] });
  res.json({ success: true });
}));

// Reactivate member
router.patch('/members/:memberId/reactivate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'manageTeam'))) throw new AppError('Permission denied', 403);

  const { memberId } = req.params;
  const db = getFirestore();
  await db.collection(`companies/${companyId}/members`).doc(memberId).set({
    status: 'active' as MemberStatus, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await logActivity(companyId, 'member_reactivated', userId, getUserName(req), 'member', memberId);
  res.json({ success: true });
}));

// Remove member (soft delete → status: removed)
router.delete('/members/:memberId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'removeMembers'))) throw new AppError('Permission denied', 403);

  const { memberId } = req.params;
  if (memberId === userId) throw new AppError('Cannot remove yourself', 400);

  const db = getFirestore();
  const memberDoc = await db.collection(`companies/${companyId}/members`).doc(memberId).get();
  if (memberDoc.exists && memberDoc.data()?.['role'] === 'owner') throw new AppError('Cannot remove owner', 400);

  // Soft delete
  await db.collection(`companies/${companyId}/members`).doc(memberId).set({
    status: 'removed' as MemberStatus, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await logActivity(companyId, 'member_removed', userId, getUserName(req), 'member', memberId, { memberName: memberDoc.data()?.['displayName'] });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/channels', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);
  const db = getFirestore();

  const snap = await db.collection(`companies/${companyId}/channels`).limit(50).get();
  const channels: Record<string, unknown>[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (channels.length === 0) {
    const defaultId = 'general';
    const data = {
      name: 'general', description: 'Canal general de l\'equipe',
      type: 'general' as ChannelType,
      createdBy: req.user?.uid, createdByName: getUserName(req),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection(`companies/${companyId}/channels`).doc(defaultId).set(data);
    channels.push({ id: defaultId, ...data });
  }

  res.json({ success: true, data: channels });
}));

router.post('/channels', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'manageChannels'))) throw new AppError('Permission denied', 403);

  const { name, description, type } = req.body as { name: string; description?: string; type?: ChannelType };
  if (!name) throw new AppError('Channel name required', 400);

  const db = getFirestore();
  const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const userName = getUserName(req);

  await db.collection(`companies/${companyId}/channels`).doc(id).set({
    name, description: description ?? '',
    type: type ?? 'general' as ChannelType,
    createdBy: userId, createdByName: userName,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });

  await logActivity(companyId, 'channel_created', userId, userName, 'channel', id, { channelName: name, type: type ?? 'general' });
  res.json({ success: true, data: { id, name } });
}));

router.get('/channels/:channelId/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const { channelId } = req.params;
  const limit = Math.min(Number(req.query['limit']) || 50, 100);
  const db = getFirestore();

  const snap = await db.collection(`companies/${companyId}/channels/${channelId}/messages`)
    .orderBy('createdAt', 'desc').limit(limit).get();

  const messages = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
  res.json({ success: true, data: messages });
}));

router.post('/channels/:channelId/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { channelId } = req.params;
  const { content, attachments } = req.body as { content: string; attachments?: string[] };
  if (!content?.trim()) throw new AppError('Message required', 400);

  const db = getFirestore();
  const userName = getUserName(req);
  const msgRef = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc();
  const trimmedContent = content.trim();

  await msgRef.set({
    content: trimmedContent,
    authorId: userId, authorName: userName, authorPhoto: getUserPhoto(req),
    attachments: attachments ?? [],
    createdBy: userId, createdByName: userName,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });

  // Niveau 2 — fire-and-forget AI response if the message mentions @orlode/@bot/@ai.
  // Never await: the user gets their POST 200 immediately; the agent reply lands
  // in the channel a few seconds later via Firestore polling on the client.
  void import('../services/teamAgentResponder').then(({ processChannelMessageForAgent }) =>
    processChannelMessageForAgent({
      companyId, channelId, messageId: msgRef.id,
      content: trimmedContent,
      authorId: userId,
      authorName: userName,
      createdByType: 'human',
    }),
  ).catch(err => logger.warn('[Team] AI responder failed', { error: err instanceof Error ? err.message : err }));

  await db.collection(`companies/${companyId}/channels`).doc(channelId).update({
    lastMessage: content.trim().slice(0, 100), lastMessageBy: userName,
    lastMessageAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });

  // Mention extraction: find @username patterns and create mention notifications
  const mentionPattern = /@([a-zA-Z0-9_-]+(?:\s+[A-Z][a-z]+)?)/g;
  const mentions = Array.from(content.matchAll(mentionPattern)).map(m => m[1]);
  if (mentions.length > 0) {
    // Find members by name to get their userIds
    const membersSnap = await db.collection(`companies/${companyId}/members`).get();
    const memberMap = new Map<string, string>();
    membersSnap.docs.forEach(d => {
      const data = d.data() as any;
      const name = (data.displayName ?? '').toLowerCase();
      if (name) memberMap.set(name, d.id);
    });

    for (const mention of mentions) {
      const lower = mention.toLowerCase().trim();
      // Try exact match first, then partial
      let mentionedId = memberMap.get(lower);
      if (!mentionedId) {
        for (const [name, id] of memberMap.entries()) {
          if (name.includes(lower) || lower.includes(name.split(' ')[0])) { mentionedId = id; break; }
        }
      }
      if (mentionedId && mentionedId !== userId) {
        await db.collection(`companies/${companyId}/mentions`).add({
          mentionedUserId: mentionedId,
          fromUserId: userId, fromUserName: userName,
          channelId, messageId: msgRef.id,
          content: content.slice(0, 200),
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }
  }

  res.json({ success: true, data: { id: msgRef.id } });
}));

// PATCH /api/team/channels/:channelId/messages/:msgId — edit own message
router.patch('/channels/:channelId/messages/:msgId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { channelId, msgId } = req.params;
  const { content } = req.body as { content: string };
  if (!content?.trim()) throw new AppError('Content required', 400);

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc(msgId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Message not found', 404);
  if (doc.data()?.['authorId'] !== userId) throw new AppError('You can only edit your own messages', 403);

  await ref.update({
    content: content.trim(),
    edited: true,
    editedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ success: true });
}));

// DELETE /api/team/channels/:channelId/messages/:msgId — delete own message
router.delete('/channels/:channelId/messages/:msgId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { channelId, msgId } = req.params;
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc(msgId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Message not found', 404);
  const isAuthor = doc.data()?.['authorId'] === userId;
  const isAdmin = req.user?.role === 'admin';
  if (!isAuthor && !isAdmin) throw new AppError('Forbidden', 403);

  await ref.delete();
  res.json({ success: true });
}));

// POST /api/team/channels/:channelId/messages/:msgId/reactions — add/toggle reaction
router.post('/channels/:channelId/messages/:msgId/reactions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { channelId, msgId } = req.params;
  const { emoji } = req.body as { emoji: string };
  if (!emoji) throw new AppError('Emoji required', 400);

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc(msgId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Message not found', 404);

  const data = doc.data() ?? {};
  const reactions = (data['reactions'] as Array<{ emoji: string; users: string[] }>) ?? [];
  const existing = reactions.find(r => r.emoji === emoji);

  if (existing) {
    if (existing.users.includes(userId)) {
      // Toggle off
      existing.users = existing.users.filter(u => u !== userId);
      if (existing.users.length === 0) {
        const idx = reactions.indexOf(existing);
        reactions.splice(idx, 1);
      }
    } else {
      existing.users.push(userId);
    }
  } else {
    reactions.push({ emoji, users: [userId] });
  }

  await ref.update({ reactions, updatedAt: FieldValue.serverTimestamp() });
  res.json({ success: true, reactions });
}));

// POST /api/team/channels/:channelId/messages/:msgId/replies — reply to a thread
router.post('/channels/:channelId/messages/:msgId/replies', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { channelId, msgId } = req.params;
  const { content } = req.body as { content: string };
  if (!content?.trim()) throw new AppError('Reply content required', 400);

  const db = getFirestore();
  const userName = getUserName(req);
  const replyRef = db.collection(`companies/${companyId}/channels/${channelId}/messages/${msgId}/replies`).doc();
  const trimmedReply = content.trim();
  await replyRef.set({
    content: trimmedReply,
    authorId: userId, authorName: userName, authorPhoto: getUserPhoto(req),
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update parent message thread count
  const parentRef = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc(msgId);
  await parentRef.update({
    threadCount: FieldValue.increment(1),
    lastThreadAt: FieldValue.serverTimestamp(),
  });

  // Niveau 2 — fire-and-forget AI thread reply if @orlode is mentioned.
  void import('../services/teamAgentResponder').then(({ processThreadReplyForAgent }) =>
    processThreadReplyForAgent({
      companyId, channelId, parentMessageId: msgId, replyId: replyRef.id,
      content: trimmedReply, authorId: userId, authorName: userName,
      createdByType: 'human',
    }),
  ).catch(err => logger.warn('[Team] thread AI responder failed', { error: err instanceof Error ? err.message : err }));

  res.json({ success: true, data: { id: replyRef.id } });
}));

// GET /api/team/channels/:channelId/messages/:msgId/replies — fetch thread replies
router.get('/channels/:channelId/messages/:msgId/replies', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const { channelId, msgId } = req.params;
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/channels/${channelId}/messages/${msgId}/replies`)
    .orderBy('createdAt', 'asc').limit(100).get();

  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// PATCH /api/team/channels/:channelId — update channel
router.patch('/channels/:channelId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { channelId } = req.params;
  const { description, name } = req.body as { description?: string; name?: string };

  const db = getFirestore();
  const update: any = { updatedAt: FieldValue.serverTimestamp() };
  if (description !== undefined) update.description = description;
  if (name !== undefined) update.name = name;
  await db.collection(`companies/${companyId}/channels`).doc(channelId).update(update);
  res.json({ success: true });
}));

// DELETE /api/team/channels/:channelId — delete channel
router.delete('/channels/:channelId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);
  if (!(await checkPermission(companyId, userId, 'manageChannels'))) throw new AppError('Permission denied', 403);

  const { channelId } = req.params;
  if (channelId === 'general') throw new AppError('Cannot delete the general channel', 400);

  const db = getFirestore();
  await db.collection(`companies/${companyId}/channels`).doc(channelId).delete();
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT MESSAGES (DMs)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/team/dms — list user's DM threads
router.get('/dms', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/dms`)
    .where('participants', 'array-contains', userId)
    .limit(100).get();

  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// POST /api/team/dms — start a new DM (or get existing)
router.post('/dms', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { participantIds } = req.body as { participantIds: string[] };
  if (!Array.isArray(participantIds) || participantIds.length === 0) throw new AppError('participantIds required', 400);

  // Always include the requester
  const allParticipants = Array.from(new Set([userId, ...participantIds])).sort();
  const isGroup = allParticipants.length > 2;
  const dmId = allParticipants.join('_');

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/dms`).doc(dmId);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      participants: allParticipants,
      isGroup,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  res.json({ success: true, data: { id: dmId, participants: allParticipants, isGroup } });
}));

// GET /api/team/dms/:dmId/messages — fetch messages of a DM
router.get('/dms/:dmId/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { dmId } = req.params;
  const limit = Math.min(Number(req.query['limit']) || 50, 100);
  const db = getFirestore();

  // Verify the user is a participant
  const dmDoc = await db.collection(`companies/${companyId}/dms`).doc(dmId).get();
  if (!dmDoc.exists) throw new AppError('DM not found', 404);
  const participants = (dmDoc.data()?.['participants'] as string[]) ?? [];
  if (!participants.includes(userId)) throw new AppError('Not a participant', 403);

  const snap = await db.collection(`companies/${companyId}/dms/${dmId}/messages`)
    .orderBy('createdAt', 'desc').limit(limit).get();

  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse() });
}));

// POST /api/team/dms/:dmId/messages — send a DM
router.post('/dms/:dmId/messages', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { dmId } = req.params;
  const { content } = req.body as { content: string };
  if (!content?.trim()) throw new AppError('Content required', 400);

  const db = getFirestore();
  const dmRef = db.collection(`companies/${companyId}/dms`).doc(dmId);
  const dmDoc = await dmRef.get();
  if (!dmDoc.exists) throw new AppError('DM not found', 404);
  const participants = (dmDoc.data()?.['participants'] as string[]) ?? [];
  if (!participants.includes(userId)) throw new AppError('Not a participant', 403);

  const userName = getUserName(req);
  const msgRef = db.collection(`companies/${companyId}/dms/${dmId}/messages`).doc();
  const trimmedDm = content.trim();
  await msgRef.set({
    content: trimmedDm,
    authorId: userId, authorName: userName, authorPhoto: getUserPhoto(req),
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update DM with last message info
  await dmRef.update({
    lastMessage: trimmedDm.slice(0, 100),
    lastMessageBy: userName, lastMessageAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Niveau 2 — fire-and-forget AI reply in DM if @orlode is mentioned.
  void import('../services/teamAgentResponder').then(({ processDMMessageForAgent }) =>
    processDMMessageForAgent({
      companyId, dmId, messageId: msgRef.id,
      content: trimmedDm, authorId: userId, authorName: userName,
      createdByType: 'human',
    }),
  ).catch(err => logger.warn('[Team] DM AI responder failed', { error: err instanceof Error ? err.message : err }));

  res.json({ success: true, data: { id: msgRef.id } });
}));

// ═══════════════════════════════════════════════════════════════════════════
// MENTIONS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/team/mentions — fetch mentions for current user
router.get('/mentions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/mentions`)
    .where('mentionedUserId', '==', userId)
    .orderBy('createdAt', 'desc').limit(50).get()
    .catch(() => ({ docs: [] as any[] }));

  res.json({ success: true, data: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
}));

// PATCH /api/team/mentions/:mentionId/read — mark a mention as read
router.patch('/mentions/:mentionId/read', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { mentionId } = req.params;
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/mentions`).doc(mentionId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Mention not found', 404);
  if (doc.data()?.['mentionedUserId'] !== userId) throw new AppError('Forbidden', 403);

  await ref.update({ read: true, readAt: FieldValue.serverTimestamp() });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════════════════════════════════
// THREADS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/team/threads — list active threads in user's channels
router.get('/threads', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const db = getFirestore();
  // Find messages with threadCount > 0 across all channels
  const channelsSnap = await db.collection(`companies/${companyId}/channels`).limit(50).get();
  const threads: any[] = [];
  for (const ch of channelsSnap.docs) {
    const msgsSnap = await db.collection(`companies/${companyId}/channels/${ch.id}/messages`)
      .where('threadCount', '>', 0)
      .orderBy('threadCount', 'desc')
      .orderBy('lastThreadAt', 'desc')
      .limit(20)
      .get()
      .catch(() => ({ docs: [] as any[] }));
    msgsSnap.docs.forEach((d: any) => {
      threads.push({
        id: d.id,
        channelId: ch.id,
        channelName: ch.data()['name'],
        ...d.data(),
      });
    });
  }
  threads.sort((a, b) => {
    const ta = a.lastThreadAt?._seconds ?? 0;
    const tb = b.lastThreadAt?._seconds ?? 0;
    return tb - ta;
  });
  res.json({ success: true, data: threads.slice(0, 50) });
}));

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY LOGS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/activity', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const limit = Math.min(Number(req.query['limit']) || 50, 200);
  const entityType = req.query['entityType'] as string | undefined;
  const db = getFirestore();

  const snap = await db.collection(`companies/${companyId}/activities`).orderBy('createdAt', 'desc').limit(limit).get();
  let activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (entityType) activities = activities.filter(a => (a as Record<string, unknown>)['entityType'] === entityType);
  res.json({ success: true, data: activities });
}));

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSIONS & ACCESS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/my-permissions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const db = getFirestore();
  const memberDoc = await db.collection(`companies/${companyId}/members`).doc(userId).get();

  if (!memberDoc.exists) {
    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (companyDoc.data()?.['ownerId'] === userId) {
      return res.json({ success: true, data: { role: 'owner', permissions: DEFAULT_PERMISSIONS['owner'], allowedAgents: [], allowedModules: [], status: 'active' } });
    }
    return res.json({ success: true, data: { role: 'member', permissions: DEFAULT_PERMISSIONS['member'], allowedAgents: [], allowedModules: [], status: 'active' } });
  }

  const data = memberDoc.data()!;
  res.json({
    success: true, data: {
      role: data['role'], status: data['status'] ?? 'active',
      permissions: data['permissions'] ?? DEFAULT_PERMISSIONS[(data['role'] as TeamRole) ?? 'member'],
      allowedAgents: data['allowedAgents'] ?? [],
      allowedModules: data['allowedModules'] ?? [],
    },
  });
}));

router.get('/pending-invites', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/invites`).where('status', '==', 'pending').limit(50).get();
  const invites = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  res.json({ success: true, data: invites });
}));

// ═══════════════════════════════════════════════════════════════════════════
// AGENT PROPOSALS (action cards in team chat)
//
// When @orlode is asked to do a write action (send message, create invoice…),
// the agent stores a "proposal" instead of executing. The team-chat UI renders
// it as a card with [Modifier] [Valider] [Annuler] buttons. Clicking Valider
// calls /execute, which runs the actual tool.
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/team/agent-proposals/:proposalId
router.get('/agent-proposals/:proposalId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company required', 400);

  const { proposalId } = req.params;
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/agentProposals`).doc(proposalId).get();
  if (!doc.exists) throw new AppError('Proposal not found', 404);

  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));

// PATCH /api/team/agent-proposals/:proposalId — edit the draft before executing
router.patch('/agent-proposals/:proposalId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { proposalId } = req.params;
  const { draft, recipient } = req.body as { draft?: string; recipient?: string };

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/agentProposals`).doc(proposalId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Proposal not found', 404);
  if (doc.data()?.['status'] !== 'pending') throw new AppError('Proposal already resolved', 400);

  const update: any = { updatedAt: FieldValue.serverTimestamp(), editedBy: userId };
  if (draft !== undefined) update.draft = draft;
  if (recipient !== undefined) update.recipient = recipient;

  await ref.update(update);
  res.json({ success: true });
}));

// POST /api/team/agent-proposals/:proposalId/execute — run the proposed action
router.post('/agent-proposals/:proposalId/execute', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { proposalId } = req.params;
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/agentProposals`).doc(proposalId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Proposal not found', 404);
  const data = doc.data()!;
  if (data['status'] !== 'pending') throw new AppError('Proposal already resolved', 400);

  const { type, channel, recipient, draft, subject, language } = data as {
    type: string; channel?: string; recipient?: string; draft?: string;
    subject?: string; language?: string;
  };

  let result: { success: boolean; message: string; details?: any } = { success: false, message: '' };

  try {
    if (type === 'send_message') {
      if (channel === 'whatsapp') {
        const { whatsappService } = await import('../services/whatsapp/whatsappService');
        const wConfig = await whatsappService.getConfig(companyId).catch(() => null);
        if (!wConfig) throw new AppError('WhatsApp non connecté pour cette entreprise', 400);
        await whatsappService.sendMessage(wConfig, recipient ?? '', draft ?? '');
        result = { success: true, message: `WhatsApp envoyé à ${recipient}` };
      } else if (channel === 'email') {
        const { sendEmail } = await import('../services/email/emailService');
        await sendEmail({
          companyId,
          to: recipient ?? '',
          subject: subject ?? 'Message',
          html: (draft ?? '').replace(/\n/g, '<br>'),
        });
        result = { success: true, message: `Email envoyé à ${recipient}` };
      } else if (channel === 'telegram') {
        const { sendTelegramMessage } = await import('../services/telegram/telegramService');
        await sendTelegramMessage(companyId, recipient ?? '', draft ?? '');
        result = { success: true, message: `Telegram envoyé à ${recipient}` };
      } else {
        throw new AppError(`Canal non supporté: ${channel}`, 400);
      }
    } else {
      throw new AppError(`Type de proposition non supporté: ${type}`, 400);
    }

    await ref.update({
      status: 'executed',
      executedAt: FieldValue.serverTimestamp(),
      executedBy: userId,
      executionResult: result,
    });

    // Log activity for audit trail
    await db.collection(`companies/${companyId}/activities`).add({
      action: 'agent_proposal_executed',
      userId,
      entityType: 'agent_proposal',
      entityId: proposalId,
      details: { type, channel, recipient, language, draftPreview: (draft ?? '').slice(0, 200) },
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    await ref.update({
      status: 'failed',
      executedAt: FieldValue.serverTimestamp(),
      executedBy: userId,
      executionError: err?.message ?? String(err),
    });
    throw err instanceof AppError ? err : new AppError(err?.message ?? 'Execution failed', 500);
  }
}));

// POST /api/team/agent-proposals/:proposalId/cancel
router.post('/agent-proposals/:proposalId/cancel', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Auth required', 401);

  const { proposalId } = req.params;
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/agentProposals`).doc(proposalId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Proposal not found', 404);
  if (doc.data()?.['status'] !== 'pending') throw new AppError('Proposal already resolved', 400);

  await ref.update({
    status: 'cancelled',
    cancelledAt: FieldValue.serverTimestamp(),
    cancelledBy: userId,
  });
  res.json({ success: true });
}));

export default router;
