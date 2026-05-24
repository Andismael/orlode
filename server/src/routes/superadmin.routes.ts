/**
 * Super Admin routes — Platform management
 * Companies, users, payments, marketplace review, analytics, system health
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { seedDemoData, clearDemoData } from '../services/seedDemoData';

const router = Router();
router.use(authMiddleware);

// Master super admin — always has access (owner)
const MASTER_UID = 'J4vwyMVHP3ZeHdTsC1gOMjeOTRA2';

router.use(asyncHandler(async (req: AuthenticatedRequest, _res: Response, next: () => void) => {
  const uid = req.user?.uid;
  if (!uid) throw new AppError('Auth required', 401);

  // Master always passes
  if (uid === MASTER_UID) { next(); return; }

  // Others need superAdmin flag in Firestore (set by master from the dashboard)
  const doc = await getFirestore().collection('users').doc(uid).get();
  if (doc.data()?.['superAdmin'] !== true) throw new AppError('Access denied', 403);
  next();
}) as never);

// ── COMPANIES ───────────────────────────────────────────────────────────────

// GET /api/superadmin/companies
router.get('/companies', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const snap = await db.collection('companies').limit(200).get();
  const companies = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data['name'] ?? d.id,
      email: data['email'] ?? data['billingEmail'] ?? '',
      plan: data['plan'] ?? 'free',
      status: data['subscriptionStatus'] ?? data['status'] ?? 'active',
      usersCount: data['usersCount'] ?? 0,
      selectedAgents: (data['selectedAgents'] as string[])?.length ?? 0,
      paymentMethod: data['paymentMethod'] ?? '',
      createdAt: data['createdAt']?.toDate?.()?.toISOString() ?? '',
      updatedAt: data['updatedAt']?.toDate?.()?.toISOString() ?? '',
    };
  });
  res.json({ success: true, data: companies });
}));

// GET /api/superadmin/companies/:id
router.get('/companies/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const doc = await db.collection('companies').doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Company not found', 404);

  const data = doc.data()!;

  // Count users for this company
  const usersSnap = await db.collection('users').where('companyId', '==', req.params.id).get();
  const users = usersSnap.docs.map(u => ({
    uid: u.id, email: u.data()['email'], displayName: u.data()['displayName'],
    role: u.data()['role'], createdAt: u.data()['createdAt']?.toDate?.()?.toISOString(),
  }));

  // Installed agents
  const agentsSnap = await db.collection(`companies/${req.params.id}/installedAgents`).get();
  const installedAgents = agentsSnap.docs.map(a => ({ id: a.id, ...a.data() }));

  res.json({
    success: true,
    data: { id: doc.id, ...data, users, installedAgents, usersCount: users.length },
  });
}));

// GET /api/superadmin/companies/:id/granted-bundles
// Returns the bundle IDs currently granted to this company (via grant_bundle).
// Used by the SuperAdmin UI to show which packs are already offered as gifts.
router.get('/companies/:id/granted-bundles', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const snap = await db.collection('marketplacePayments')
    .where('companyId', '==', req.params.id)
    .where('paymentMethod', '==', 'granted')
    .get();
  // Dedupe — a company can have multiple grant records for the same bundle
  // if it was granted then revoked then re-granted; we only care about the
  // currently-active ones (status === 'completed').
  const bundleIds = Array.from(new Set(
    snap.docs
      .filter(d => d.data()['status'] === 'completed')
      .map(d => d.data()['bundleId'] as string)
      .filter(Boolean),
  ));
  res.json({ success: true, data: { bundleIds } });
}));

// POST /api/superadmin/companies/:id/members/:memberId/action
// Super admin acts on any company's members: change role, toggle voice perm, suspend, delete.
router.post('/companies/:id/members/:memberId/action', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id: companyId, memberId } = req.params;
  const { action, role, permissions } = req.body as { action: string; role?: string; permissions?: string[] };
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/members`).doc(memberId);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Member not found', 404);
  if (doc.data()?.['role'] === 'owner' && action !== 'toggle-voice' && action !== 'update-permissions') {
    throw new AppError('Cannot modify owner', 400);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  switch (action) {
    case 'change-role':
      if (!role) throw new AppError('role required', 400);
      updates['role'] = role;
      break;
    case 'update-permissions':
      if (!Array.isArray(permissions)) throw new AppError('permissions array required', 400);
      updates['permissions'] = permissions;
      break;
    case 'toggle-voice': {
      const current = (doc.data()?.['permissions'] as string[]) ?? [];
      const has = current.includes('useVoiceLive');
      updates['permissions'] = has ? current.filter(p => p !== 'useVoiceLive') : [...current, 'useVoiceLive'];
      break;
    }
    case 'suspend':
      updates['status'] = 'suspended';
      break;
    case 'reactivate':
      updates['status'] = 'active';
      break;
    case 'delete':
      await ref.delete();
      res.json({ success: true, message: 'Member deleted' });
      return;
    default:
      throw new AppError(`Invalid action: ${action}`, 400);
  }
  await ref.update(updates);
  res.json({ success: true, data: { memberId, ...updates } });
}));

// POST /api/superadmin/companies/:id/action
router.post('/companies/:id/action', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { action, plan } = req.body as { action: string; plan?: string };
  const db = getFirestore();

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  const { trialDays, trialPlan, maxAgents } = req.body as { trialDays?: number; trialPlan?: string; maxAgents?: number };

  switch (action) {
    case 'activate': updates['subscriptionStatus'] = 'active'; break;
    case 'suspend': updates['subscriptionStatus'] = 'suspended'; break;
    case 'upgrade': {
      if (plan) {
        updates['plan'] = plan;
        updates['subscriptionStatus'] = 'active';
        const { getAvailableAgents: getUpAgents, countSkills: countUpSkills } = await import('../config/agentCatalog');
        const upAvailable = getUpAgents(plan);
        const upAgentIds = upAvailable.map(a => a.id);
        updates['selectedAgents'] = upAgentIds;
        updates['totalSkills'] = countUpSkills(upAgentIds);
        updates['agentsActivatedAt'] = new Date();
      }
      break;
    }
    case 'grant_trial': {
      const days = trialDays ?? 14;
      const trialEnd = new Date(Date.now() + days * 86400000);
      const tPlan = trialPlan ?? 'business';
      updates['plan'] = tPlan;
      updates['subscriptionStatus'] = 'trial';
      updates['trialEndsAt'] = trialEnd;
      updates['trialGrantedBy'] = req.user?.uid;
      updates['trialGrantedAt'] = new Date();
      if (maxAgents) updates['trialMaxAgents'] = maxAgents;
      // Auto-select agents for trial plan
      const { getAvailableAgents: getTrialAgents, countSkills: countTrialSkills } = await import('../config/agentCatalog');
      const trialAvailable = getTrialAgents(tPlan);
      const trialAgentIds = trialAvailable.map(a => a.id);
      updates['selectedAgents'] = trialAgentIds;
      updates['totalSkills'] = countTrialSkills(trialAgentIds);
      updates['agentsActivatedAt'] = new Date();
      break;
    }
    case 'end_trial': {
      updates['plan'] = 'free';
      updates['subscriptionStatus'] = 'active';
      updates['trialEndsAt'] = null;
      break;
    }
    case 'grant_free': {
      // Give permanent free access to a paid plan + auto-select all agents
      const grantPlan = plan ?? 'enterprise';
      updates['plan'] = grantPlan;
      updates['subscriptionStatus'] = 'active';
      updates['paymentMethod'] = 'granted';
      updates['grantedBy'] = req.user?.uid;
      updates['grantedAt'] = new Date();
      // Auto-select all agents available for this plan
      const { getAvailableAgents, countSkills } = await import('../config/agentCatalog');
      const available = getAvailableAgents(grantPlan);
      const agentIds = available.map(a => a.id);
      updates['selectedAgents'] = agentIds;
      updates['totalSkills'] = countSkills(agentIds);
      updates['agentsActivatedAt'] = new Date();
      break;
    }
    case 'revoke_free': {
      updates['plan'] = 'free';
      updates['subscriptionStatus'] = 'active';
      updates['paymentMethod'] = '';
      break;
    }
    case 'grant_bundle': {
      // Offer one of the marketplace bundles (Boutique, Restaurant, PME, etc.)
      // to a company for free as a permanent gift. Creates a paid marketplace
      // payment record + installs all agents in the bundle.
      const { bundleId } = req.body as { bundleId?: string };
      if (!bundleId) throw new AppError('bundleId required', 400);
      const { BUNDLES } = await import('./marketplace.routes');
      const bundle = BUNDLES.find((b: any) => b.id === bundleId);
      if (!bundle) throw new AppError(`Bundle ${bundleId} introuvable`, 404);
      const agentIds: string[] = bundle.agentIds ?? [];
      // Record a granted payment so the merchant's /marketplace shows the bundle
      // as active (paymentMethod=granted distinguishes gift from real payment).
      const cid = req.params.id;
      await db.collection('marketplacePayments').add({
        companyId: cid, userId: req.user?.uid ?? null,
        bundleId, bundleName: bundle.name,
        agentIds, amountUSD: 0, currency: 'USD',
        provider: 'granted', status: 'completed',
        paymentMethod: 'granted', grantedBy: req.user?.uid,
        paidAt: new Date(), completedAt: new Date(), createdAt: new Date(),
      });
      // Install each agent in the bundle (idempotent — skip if already installed).
      let installed = 0;
      for (const agentId of agentIds) {
        const existing = await db.collection(`companies/${cid}/installedAgents`).doc(agentId).get();
        if (existing.exists) {
          if (existing.data()?.['status'] !== 'active') {
            await existing.ref.update({ status: 'active', pricingModel: 'bundle', bundleId, upgradedAt: new Date() });
          }
          continue;
        }
        const agentDoc = await db.collection('marketplaceAgents').doc(agentId).get();
        if (!agentDoc.exists) continue;
        const agent = agentDoc.data()!;
        await db.collection(`companies/${cid}/installedAgents`).doc(agentId).set({
          agentId, installedAt: new Date(), status: 'active',
          pricingModel: 'bundle', bundleId, sentFrom: 'superadmin-grant',
          cachedConfig: {
            name: agent['name'], systemPrompt: agent['systemPrompt'] ?? '',
            tools: agent['tools'] ?? [], temperature: agent['temperature'] ?? 0.4,
            model: agent['model'] ?? 'flash',
          },
        });
        installed++;
      }
      updates['subscriptionStatus'] = 'active';
      // Don't override `plan` — bundles coexist with the plan field.
      break;
    }
    case 'revoke_bundle': {
      // Reverse a previously granted bundle — uninstall its agents.
      const { bundleId } = req.body as { bundleId?: string };
      if (!bundleId) throw new AppError('bundleId required', 400);
      const { BUNDLES } = await import('./marketplace.routes');
      const bundle = BUNDLES.find((b: any) => b.id === bundleId);
      if (!bundle) throw new AppError(`Bundle ${bundleId} introuvable`, 404);
      const cid = req.params.id;
      // Remove the granted payment record(s) for this bundle on this company.
      const paymentsSnap = await db.collection('marketplacePayments')
        .where('companyId', '==', cid).where('bundleId', '==', bundleId).get();
      for (const d of paymentsSnap.docs) await d.ref.delete();
      // Uninstall the bundle's agents that were installed via this bundle.
      for (const agentId of (bundle.agentIds ?? [])) {
        const inst = await db.collection(`companies/${cid}/installedAgents`).doc(agentId).get();
        if (inst.exists && inst.data()?.['bundleId'] === bundleId) {
          await inst.ref.delete();
        }
      }
      break;
    }
    case 'grant_marketplace_agents': {
      // Install specific or ALL marketplace agents for free
      const { agentIds: specificIds } = req.body as { agentIds?: string[] };
      let snap;
      if (specificIds && specificIds.length > 0) {
        // Install only selected agents
        const docs = await Promise.all(specificIds.map(id => db.collection('marketplaceAgents').doc(id).get()));
        snap = { docs: docs.filter(d => d.exists), size: docs.filter(d => d.exists).length };
      } else {
        // Install all approved agents
        snap = await db.collection('marketplaceAgents').where('status', '==', 'approved').get();
      }
      let installed = 0;
      for (const agentDoc of snap.docs) {
        const agent = agentDoc.data()!;
        const existing = await db.collection(`companies/${req.params.id}/installedAgents`).doc(agentDoc.id).get();
        if (!existing.exists) {
          await db.collection(`companies/${req.params.id}/installedAgents`).doc(agentDoc.id).set({
            agentId: agentDoc.id,
            installedAt: new Date(),
            installedBy: req.user?.uid,
            status: 'active',
            pricingModel: 'granted',
            grantedBy: req.user?.uid,
            cachedConfig: {
              name: agent['name'] ?? '',
              systemPrompt: agent['systemPrompt'] ?? '',
              tools: agent['tools'] ?? [],
              temperature: agent['temperature'] ?? 0.4,
              model: agent['model'] ?? 'flash',
            },
          });
          installed++;
        }
      }
      res.json({ success: true, data: { installed, total: snap.size } });
      return;
    }
    case 'revoke_marketplace_agents': {
      // Remove all marketplace agents from this company
      const installedSnap = await db.collection(`companies/${req.params.id}/installedAgents`).get();
      for (const d of installedSnap.docs) { await d.ref.delete(); }
      res.json({ success: true, data: { removed: installedSnap.size } });
      return;
    }
    case 'seed_demo': {
      const result = await seedDemoData(req.params.id);
      res.json({ success: true, data: result });
      return;
    }
    case 'clear_demo': {
      await clearDemoData(req.params.id);
      res.json({ success: true });
      return;
    }
    case 'delete': await db.collection('companies').doc(req.params.id).delete(); res.json({ success: true }); return;
    default: throw new AppError('Invalid action', 400);
  }

  await db.collection('companies').doc(req.params.id).update(updates);
  res.json({ success: true });
}));

// ── USERS ───────────────────────────────────────────────────────────────────

// GET /api/superadmin/users
router.get('/users', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const snap = await db.collection('users').limit(500).get();
  const users = snap.docs.map(d => {
    const data = d.data();
    return {
      uid: d.id,
      email: data['email'] ?? '',
      displayName: data['displayName'] ?? '',
      companyId: data['companyId'] ?? '',
      role: data['role'] ?? 'employee',
      superAdmin: data['superAdmin'] === true,
      createdAt: data['createdAt']?.toDate?.()?.toISOString() ?? '',
    };
  });
  res.json({ success: true, data: users });
}));

// POST /api/superadmin/users/:uid/action
router.post('/users/:uid/action', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { action } = req.body as { action: string };
  const db = getFirestore();

  switch (action) {
    case 'make_admin':
      await db.collection('users').doc(req.params.uid).update({ role: 'admin' }); break;
    case 'make_manager':
      await db.collection('users').doc(req.params.uid).update({ role: 'manager' }); break;
    case 'make_employee':
      await db.collection('users').doc(req.params.uid).update({ role: 'employee' }); break;
    case 'make_superadmin':
      if (req.user?.uid !== MASTER_UID) throw new AppError('Only master admin can promote super admins', 403);
      await db.collection('users').doc(req.params.uid).update({ superAdmin: true }); break;
    case 'remove_superadmin':
      if (req.user?.uid !== MASTER_UID) throw new AppError('Only master admin can demote super admins', 403);
      await db.collection('users').doc(req.params.uid).update({ superAdmin: false }); break;
    case 'suspend':
      await db.collection('users').doc(req.params.uid).update({ suspended: true }); break;
    case 'activate':
      await db.collection('users').doc(req.params.uid).update({ suspended: false }); break;
    case 'delete':
      await db.collection('users').doc(req.params.uid).delete(); break;
    case 'change_company': {
      const { companyId: newCompanyId } = req.body as { companyId?: string };
      if (newCompanyId) await db.collection('users').doc(req.params.uid).update({ companyId: newCompanyId });
      break;
    }
    default: throw new AppError('Invalid action', 400);
  }
  res.json({ success: true });
}));

// ── PAYMENTS ────────────────────────────────────────────────────────────────

// GET /api/superadmin/payments
router.get('/payments', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();

  // Subscription payments
  const subSnap = await db.collection('payments').orderBy('createdAt', 'desc').limit(100).get();
  const subPayments = subSnap.docs.map(d => ({ id: d.id, type: 'subscription', ...d.data() }));

  // Marketplace payments
  const mkSnap = await db.collection('marketplacePayments').orderBy('createdAt', 'desc').limit(100).get();
  const mkPayments = mkSnap.docs.map(d => ({ id: d.id, type: 'marketplace', ...d.data() }));

  const all = [...subPayments, ...mkPayments].sort((a, b) => {
    const aT = ((a as Record<string, unknown>)['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
    const bT = ((b as Record<string, unknown>)['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
    return bT - aT;
  });

  // Totals
  const totalRevenue = all
    .filter(p => (p as Record<string, unknown>)['status'] === 'completed')
    .reduce((sum, p) => sum + (((p as Record<string, unknown>)['amountUSD'] as number) ?? 0), 0);

  res.json({ success: true, data: { payments: all, totalRevenue } });
}));

// ── PLATFORM SETTINGS (super admin only) ─────────────────────────────────────

// GET /api/superadmin/platform-settings — current contact info + other global configs
router.get('/platform-settings', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const doc = await db.collection('_platform').doc('settings').get();
  const data = doc.exists ? doc.data() ?? {} : {};
  res.json({
    success: true,
    data: {
      manualPaymentPhone:    data['manualPaymentPhone']    ?? process.env['MANUAL_PAYMENT_PHONE']    ?? '',
      manualPaymentWhatsapp: data['manualPaymentWhatsapp'] ?? process.env['MANUAL_PAYMENT_WHATSAPP'] ?? '',
      manualPaymentEmail:    data['manualPaymentEmail']    ?? process.env['MANUAL_PAYMENT_EMAIL']    ?? '',
      supportEmail:          data['supportEmail']          ?? '',
      supportPhone:          data['supportPhone']          ?? '',
    },
  });
}));

// PATCH /api/superadmin/platform-settings — update settings (super admin)
router.patch('/platform-settings', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as Record<string, string | undefined>;
  const allowed = ['manualPaymentPhone', 'manualPaymentWhatsapp', 'manualPaymentEmail', 'supportEmail', 'supportPhone'];
  const update: Record<string, string | Date> = { updatedAt: new Date(), updatedBy: req.user?.uid ?? '' };
  for (const k of allowed) {
    if (typeof body[k] === 'string') update[k] = body[k] as string;
  }
  const db = getFirestore();
  await db.collection('_platform').doc('settings').set(update, { merge: true });
  // Invalidate the cache so subsequent payment checkouts see the new values immediately
  const { invalidatePlatformSettingsCache } = await import('../services/platformSettings');
  invalidatePlatformSettingsCache();
  res.json({ success: true, data: update });
}));

// POST /api/superadmin/companies/:companyId/hosted-exception — grant hosted access (bypass BYOE)
router.post('/companies/:companyId/hosted-exception', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { companyId } = req.params;
  const { hours, reason } = req.body as { hours: number; reason?: string };
  if (!hours || hours <= 0) { res.status(400).json({ success: false, error: 'hours required (> 0)' }); return; }

  const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const db = getFirestore();
  await db.collection('companies').doc(companyId).update({
    hostedException: {
      grantedBy: req.user?.uid ?? null,
      grantedAt: new Date(),
      expiresAt,
      reason: reason ?? null,
      hours,
    },
    updatedAt: new Date(),
  });
  res.json({ success: true, data: { expiresAt, hours } });
}));

// DELETE /api/superadmin/companies/:companyId/hosted-exception — revoke
router.delete('/companies/:companyId/hosted-exception', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { companyId } = req.params;
  const db = getFirestore();
  await db.collection('companies').doc(companyId).update({
    hostedException: null,
    updatedAt: new Date(),
  });
  res.json({ success: true });
}));

// POST /api/superadmin/test-email — send a test email via Resend to verify deliverability.
// Body: { to: string, subject?: string }
router.post('/test-email', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { to, subject } = req.body as { to: string; subject?: string };
  if (!to) { res.status(400).json({ success: false, error: 'to required' }); return; }

  const { sendEmail } = await import('../services/email/emailService');
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, sans-serif; background: #f6f7fb; margin: 0; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
            <img src="https://orlode.com/logo.png" alt="Orlode" style="width: 40px; height: 40px; border-radius: 10px;" />
            <h1 style="margin: 0; font-size: 20px; color: #111;">Orlode AI</h1>
          </div>
          <h2 style="color: #111; margin-top: 0;">✅ Test email from Orlode</h2>
          <p style="color: #444; line-height: 1.6;">
            Si tu lis cet email, la configuration Resend + DKIM + SPF fonctionne parfaitement.
          </p>
          <p style="color: #444; line-height: 1.6;">
            <strong>Envoyé le :</strong> ${new Date().toLocaleString('fr-FR')}<br/>
            <strong>Depuis :</strong> noreply@orlode.com<br/>
            <strong>Via :</strong> Resend (prod)
          </p>
          <p style="color: #888; font-size: 12px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;">
            Cet email a été généré par le endpoint superadmin <code>/api/superadmin/test-email</code>.
          </p>
        </div>
      </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      to,
      subject: subject ?? 'Test email Orlode ✅',
      html,
      text: 'Test email from Orlode. If you read this, emails are working.',
      forceResend: true, // bypass Gmail OAuth, test Resend directly
    });
    res.json({ success: true, data: { messageId: result.id, provider: result.provider, from: result.from } });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}));

// PATCH /api/superadmin/companies/:companyId/byoe-allowed — allow/disallow BYOE setup
// Controls whether the company's admin can access /admin/byoe and configure their own Firebase.
router.patch('/companies/:companyId/byoe-allowed', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { companyId } = req.params;
  const { allowed } = req.body as { allowed: boolean };
  const db = getFirestore();
  await db.collection('companies').doc(companyId).set({
    byoeAllowed: !!allowed,
    byoeAllowedBy: req.user?.uid ?? null,
    byoeAllowedAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });
  res.json({ success: true, data: { byoeAllowed: !!allowed } });
}));

// PATCH /api/superadmin/companies/:companyId/hosted-by-orlode — toggle permanent Orlode hosting
// When true, the company can use Orlode's Firebase / AI keys WITHOUT setting up BYOE.
// Orlode pays the AI bill. Use for NGOs, demos, special partners, internal accounts.
// When false (default), the company MUST configure BYOE to use the AI agents.
router.patch('/companies/:companyId/hosted-by-orlode', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { companyId } = req.params;
  const { hosted } = req.body as { hosted: boolean };
  const db = getFirestore();
  await db.collection('companies').doc(companyId).set({
    hostedByOrlode: !!hosted,
    hostedByOrlodeBy: req.user?.uid ?? null,
    hostedByOrlodeAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });
  res.json({ success: true, data: { hostedByOrlode: !!hosted } });
}));

// PATCH /api/superadmin/companies/:companyId/allowed-providers — restrict AI providers
// Providers: 'claude' | 'gemini' | 'openai' | 'elevenlabs' | 'all'
// Empty or ['all'] = no restriction. Otherwise only the listed providers are permitted.
router.patch('/companies/:companyId/allowed-providers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { companyId } = req.params;
  const { providers } = req.body as { providers: string[] };
  if (!Array.isArray(providers)) {
    res.status(400).json({ success: false, error: 'providers must be an array' });
    return;
  }
  const VALID = new Set(['all', 'claude', 'gemini', 'openai', 'elevenlabs']);
  const filtered = providers.filter(p => VALID.has(p));
  const db = getFirestore();
  await db.collection('companies').doc(companyId).set({
    allowedProviders: filtered,
    allowedProvidersBy: req.user?.uid ?? null,
    allowedProvidersAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true });
  res.json({ success: true, data: { allowedProviders: filtered } });
}));

// POST /api/superadmin/payments/reject — superadmin rejects a manual payment
router.post('/payments/reject', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { paymentId, reason } = req.body as { paymentId: string; reason?: string };
  if (!paymentId) { res.status(400).json({ success: false, error: 'paymentId required' }); return; }

  const db = getFirestore();
  await db.collection('payments').doc(paymentId).update({
    status: 'failed',
    failedAt: new Date(),
    failureReason: reason ?? 'Rejected by admin',
    rejectedBy: req.user?.uid ?? null,
    updatedAt: new Date(),
  });
  res.json({ success: true });
}));

// ── MARKETPLACE REVIEW ──────────────────────────────────────────────────────

// GET /api/superadmin/marketplace/pending
router.get('/marketplace/pending', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const snap = await db.collection('marketplaceAgents').where('status', '==', 'pending_review').get();
  res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));

// GET /api/superadmin/marketplace/all
router.get('/marketplace/all', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const snap = await db.collection('marketplaceAgents').limit(200).get();
  const agents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, data: agents });
}));

// POST /api/superadmin/marketplace/:id/review
router.post('/marketplace/:id/review', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { action, reason } = req.body as { action: 'approve' | 'reject'; reason?: string };
  if (!['approve', 'reject'].includes(action)) throw new AppError('Invalid action', 400);

  const db = getFirestore();
  await db.collection('marketplaceAgents').doc(req.params.id).update({
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewedAt: new Date(), reviewedBy: req.user?.uid, reviewReason: reason ?? '',
    ...(action === 'approve' ? { publishedAt: new Date() } : {}),
  });
  res.json({ success: true });
}));

// POST /api/superadmin/marketplace/:id/action — edit, delete, toggle
router.post('/marketplace/:id/action', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { action, updates: bodyUpdates } = req.body as { action: string; updates?: Record<string, unknown> };
  const db = getFirestore();
  const docRef = db.collection('marketplaceAgents').doc(req.params.id);

  switch (action) {
    case 'delete':
      await docRef.delete(); break;
    case 'suspend':
      await docRef.update({ status: 'rejected', updatedAt: new Date() }); break;
    case 'activate':
      await docRef.update({ status: 'approved', updatedAt: new Date() }); break;
    case 'feature':
      await docRef.update({ featured: true, updatedAt: new Date() }); break;
    case 'unfeature':
      await docRef.update({ featured: false, updatedAt: new Date() }); break;
    case 'edit':
      if (bodyUpdates) {
        const safe: Record<string, unknown> = { updatedAt: new Date() };
        const allowed = ['name', 'description', 'longDescription', 'icon', 'category', 'industry', 'pricingModel', 'priceUSD', 'color', 'features', 'systemPrompt'];
        for (const k of allowed) { if (bodyUpdates[k] !== undefined) safe[k] = bodyUpdates[k]; }
        await docRef.update(safe);
      }
      break;
    default: throw new AppError('Invalid action', 400);
  }
  res.json({ success: true });
}));

// ── PLATFORM ANALYTICS ──────────────────────────────────────────────────────

// GET /api/superadmin/analytics
router.get('/analytics', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();

  const [companiesSnap, usersSnap, agentsSnap, paymentsSnap, mkPaymentsSnap, reviewsSnap] = await Promise.all([
    db.collection('companies').get(),
    db.collection('users').get(),
    db.collection('marketplaceAgents').where('status', '==', 'approved').get(),
    db.collection('payments').where('status', '==', 'completed').get(),
    db.collection('marketplacePayments').where('status', '==', 'completed').get(),
    db.collection('marketplaceReviews').get(),
  ]);

  const totalCompanies = companiesSnap.size;
  const totalUsers = usersSnap.size;
  const totalAgents = agentsSnap.size;
  const totalReviews = reviewsSnap.size;

  // Revenue
  const subRevenue = paymentsSnap.docs.reduce((s, d) => s + ((d.data()['amountUSD'] as number) ?? 0), 0);
  const mkRevenue = mkPaymentsSnap.docs.reduce((s, d) => s + ((d.data()['amountUSD'] as number) ?? 0), 0);
  const totalRevenue = subRevenue + mkRevenue;

  // Plans distribution
  const planCounts: Record<string, number> = { free: 0, starter: 0, business: 0, enterprise: 0 };
  companiesSnap.docs.forEach(d => {
    const plan = (d.data()['plan'] as string) ?? 'free';
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  });

  // Total installs
  const totalInstalls = agentsSnap.docs.reduce((s, d) => s + ((d.data()['installCount'] as number) ?? 0), 0);

  // Companies by month
  const companiesByMonth: Record<string, number> = {};
  companiesSnap.docs.forEach(d => {
    const date = (d.data()['createdAt'] as { toDate?: () => Date })?.toDate?.();
    if (date) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      companiesByMonth[key] = (companiesByMonth[key] ?? 0) + 1;
    }
  });

  // Revenue by month
  const revenueByMonth: Record<string, number> = {};
  [...paymentsSnap.docs, ...mkPaymentsSnap.docs].forEach(d => {
    const date = (d.data()['completedAt'] as { toDate?: () => Date })?.toDate?.() ??
                 (d.data()['createdAt'] as { toDate?: () => Date })?.toDate?.();
    if (date) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[key] = (revenueByMonth[key] ?? 0) + ((d.data()['amountUSD'] as number) ?? 0);
    }
  });

  res.json({
    success: true,
    data: {
      totalCompanies, totalUsers, totalAgents, totalReviews, totalRevenue,
      subRevenue, mkRevenue, totalInstalls, planCounts,
      companiesByMonth, revenueByMonth,
    },
  });
}));

// ── PACKS ───────────────────────────────────────────────────────────────────
// Pack catalog + adoption stats (count of companies that activated each pack
// = at least one store of the matching businessType). Cross-company aggregation
// — only super admin can see this.

const PACK_CATALOG = [
  { id: 'boutique',   businessType: 'boutique',   label: 'Boutique',    pitch: 'Catalogue + commandes WhatsApp',           emoji: '🛍️', color: '#0019FF', monthlyPriceUSD: 20 },
  { id: 'restaurant', businessType: 'restaurant', label: 'Restaurant',  pitch: 'Menu + commandes + reservations',          emoji: '🍽️', color: '#F97316', monthlyPriceUSD: 20 },
  { id: 'hotel',      businessType: 'hotel',      label: 'Hotel',       pitch: 'Chambres + reservations + sejours',        emoji: '🏨', color: '#3B82F6', monthlyPriceUSD: 20 },
  { id: 'service',    businessType: 'service',    label: 'Salon',       pitch: 'Coiffure / beaute — services + RDV',       emoji: '💇', color: '#EC4899', monthlyPriceUSD: 20 },
  { id: 'health',     businessType: 'health',     label: 'Sante',       pitch: 'Cabinet medical — RDV + dossiers patients', emoji: '🏥', color: '#14B8A6', monthlyPriceUSD: 20 },
  { id: 'realestate', businessType: 'realestate', label: 'Immobilier',  pitch: 'Biens + visites + qualif leads',           emoji: '🏠', color: '#7C3AED', monthlyPriceUSD: 20 },
  { id: 'pme',        businessType: null,         label: 'PME Hub',     pitch: 'CRM + comms + marketing + support (cross)', emoji: '📊', color: '#0EA5E9', monthlyPriceUSD: 0 },
  { id: 'enterprise', businessType: null,         label: 'Entreprise',  pitch: 'Sales / Compta / Support / Comms — cross', emoji: '🏢', color: '#475569', monthlyPriceUSD: 0 },
];

router.get('/packs', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const companiesSnap = await db.collection('companies').get();

  // Map businessType -> { companies: Set<companyId>, totalStores: number }
  const adoption: Record<string, { companies: Set<string>; stores: number; latestActivation: Date | null }> = {};
  await Promise.all(companiesSnap.docs.map(async (cDoc) => {
    const cid = cDoc.id;
    const storesSnap = await db.collection(`companies/${cid}/stores`).get().catch(() => null);
    if (!storesSnap) return;
    storesSnap.docs.forEach(sDoc => {
      const data = sDoc.data();
      const type = (data['businessType'] as string | undefined) ?? 'boutique';
      if (!adoption[type]) adoption[type] = { companies: new Set(), stores: 0, latestActivation: null };
      adoption[type].companies.add(cid);
      adoption[type].stores += 1;
      const created = (data['createdAt'] as { toDate?: () => Date })?.toDate?.();
      if (created && (!adoption[type].latestActivation || created > adoption[type].latestActivation)) {
        adoption[type].latestActivation = created;
      }
    });
  }));

  const packs = PACK_CATALOG.map(p => {
    const stats = p.businessType ? adoption[p.businessType] : null;
    const companies = stats ? stats.companies.size : 0;
    return {
      ...p,
      companies,
      stores: stats ? stats.stores : 0,
      latestActivation: stats?.latestActivation?.toISOString() ?? null,
      monthlyRevenueUSD: companies * p.monthlyPriceUSD,
    };
  });

  const totalMRR = packs.reduce((s, p) => s + p.monthlyRevenueUSD, 0);
  const totalActivations = packs.reduce((s, p) => s + p.companies, 0);

  res.json({ success: true, data: { packs, totalMRR, totalActivations } });
}));

// GET /api/superadmin/packs/:packId/companies — list of companies that have this pack
router.get('/packs/:packId/companies', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pack = PACK_CATALOG.find(p => p.id === req.params.packId);
  if (!pack || !pack.businessType) throw new AppError('Pack not found', 404);
  const db = getFirestore();
  const companiesSnap = await db.collection('companies').get();

  const results: Array<{ companyId: string; companyName: string; storeName: string; storeSlug: string; activatedAt: string | null }> = [];
  await Promise.all(companiesSnap.docs.map(async (cDoc) => {
    const storesSnap = await db.collection(`companies/${cDoc.id}/stores`)
      .where('businessType', '==', pack.businessType).get().catch(() => null);
    if (!storesSnap) return;
    storesSnap.docs.forEach(sDoc => {
      const sd = sDoc.data();
      results.push({
        companyId: cDoc.id,
        companyName: (cDoc.data()['name'] as string) ?? '(sans nom)',
        storeName: (sd['name'] as string) ?? '',
        storeSlug: (sd['slug'] as string) ?? '',
        activatedAt: (sd['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? null,
      });
    });
  }));

  res.json({ success: true, data: { pack, companies: results } });
}));

// ── SYSTEM HEALTH ───────────────────────────────────────────────────────────

// GET /api/superadmin/health
router.get('/health', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const start = Date.now();

  // Test Firestore
  let firestoreOk = false;
  try { await db.collection('_system').doc('healthcheck').set({ ts: new Date() }); firestoreOk = true; } catch {}
  const firestoreLatency = Date.now() - start;

  // Memory usage
  const mem = process.memoryUsage();

  res.json({
    success: true,
    data: {
      status: firestoreOk ? 'healthy' : 'degraded',
      uptime: Math.round(process.uptime()),
      memory: { heapUsed: Math.round(mem.heapUsed / 1024 / 1024), heapTotal: Math.round(mem.heapTotal / 1024 / 1024), rss: Math.round(mem.rss / 1024 / 1024) },
      firestore: { ok: firestoreOk, latencyMs: firestoreLatency },
      node: process.version,
      env: process.env['NODE_ENV'],
      timestamp: new Date().toISOString(),
    },
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE CMS
// ═══════════════════════════════════════════════════════════════════════════════

const LANDING_DOC = 'platform/landingPage';

// GET /api/superadmin/landing — get landing content
router.get('/landing', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const doc = await getFirestore().doc(LANDING_DOC).get();
  res.json({ success: true, data: doc.exists ? doc.data() : null });
}));

// PATCH /api/superadmin/landing — update landing content (partial)
router.patch('/landing', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as Record<string, unknown>;
  await getFirestore().doc(LANDING_DOC).set({ ...body, updatedAt: new Date(), updatedBy: req.user?.uid }, { merge: true });
  res.json({ success: true });
}));

// ── INFLUENCERS — moderation (Orlode Influenceurs marketplace) ──────────────
// SuperAdmin lists all creator profiles (any status) and flips status
// pending ↔ active to approve / re-pause a creator. Bypasses Firestore
// public read rules via Admin SDK.

// GET /api/superadmin/influencers?status=pending|active|paused
router.get('/influencers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const db = getFirestore();
  const status = (req.query['status'] as string | undefined) ?? '';
  let q: FirebaseFirestore.Query = db.collection('influencers_profiles');
  if (['pending', 'active', 'paused', 'hired'].includes(status)) {
    q = q.where('status', '==', status);
  }
  const snap = await q.limit(200).get();
  const profiles = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      displayName: data['displayName'] ?? '',
      handle: data['handle'] ?? '',
      city: data['city'] ?? '',
      bio: data['bio'] ?? '',
      categories: data['categories'] ?? [],
      audience: data['audience'] ?? {},
      languages: data['languages'] ?? [],
      verified: !!data['verified'],
      status: data['status'] ?? 'pending',
      userId: data['userId'] ?? null,
      createdAt: data['createdAt']?.toDate?.()?.toISOString?.() ?? null,
      lastActiveAt: data['lastActiveAt']?.toDate?.()?.toISOString?.() ?? null,
    };
  });
  res.json({ success: true, data: profiles });
}));

// PATCH /api/superadmin/influencers/:id/status — flip status (with audit)
router.patch('/influencers/:id/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, verified } = req.body as { status?: string; verified?: boolean };
  if (status && !['pending', 'active', 'paused', 'hired'].includes(status)) {
    throw new AppError(`Invalid status: ${status}`, 400);
  }
  const db = getFirestore();
  const update: Record<string, unknown> = {
    moderatedBy: req.user?.uid ?? null,
    moderatedAt: new Date(),
    updatedAt: new Date(),
  };
  if (status !== undefined) update['status'] = status;
  if (typeof verified === 'boolean') update['verified'] = verified;
  await db.collection('influencers_profiles').doc(req.params.id).set(update, { merge: true });
  res.json({ success: true, data: update });
}));

export default router;
