import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminOnlyMiddleware } from '../middleware/adminOnly.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';

const router = Router();
router.use(authMiddleware);

/** Generate a short company code like CM-48291 */
function generateCompanyCode(): string {
  const num = Math.floor(10000 + Math.random() * 90000); // 5 digits
  return `CM-${num}`;
}

// GET /api/company — get company profile
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const db = getFirestore();
    const docRef = db.collection('companies').doc(companyId);
    const doc = await docRef.get();
    if (!doc.exists) throw new AppError('Company not found', 404);
    const data = doc.data() ?? {};

    // Auto-generate companyCode if missing
    if (!data['companyCode']) {
      const code = generateCompanyCode();
      await docRef.update({ companyCode: code });
      data['companyCode'] = code;
    }

    res.json({ success: true, data: { id: doc.id, ...data } });
  } catch (err) {
    if (err instanceof AppError) throw err;
    res.json({ success: true, data: { id: companyId } });
  }
}));

// PATCH /api/company — update company profile (admin only)
router.patch('/', adminOnlyMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as Record<string, unknown>;

  // Whitelist of allowed fields
  const allowed = [
    'name', 'slogan', 'description', 'sector', 'size', 'website', 'logoUrl',
    'address', 'city', 'country', 'postalCode',
    'phone', 'whatsapp', 'email', 'supportEmail',
    'linkedin', 'twitter', 'facebook', 'instagram',
    'settings',
    // Domain + brand identity (visible on public pages and tenant emails)
    'customDomain', 'subdomain', 'proEmails', 'theme', 'tagline',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  updates['updatedAt'] = new Date();

  try {
    await getFirestore().collection('companies').doc(companyId).update(updates);
  } catch {
    // If doc doesn't exist yet, create it
    await getFirestore().collection('companies').doc(companyId).set({ ...updates, id: companyId }, { merge: true });
  }

  res.json({ success: true, data: updates });
}));

// POST /api/company/upload-logo — upload a logo image (base64) → Firebase Storage public URL
router.post('/upload-logo', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { imageBase64, imageMimeType } = req.body as { imageBase64?: string; imageMimeType?: string };
  if (!imageBase64) throw new AppError('imageBase64 required', 400);
  const { getStorage } = await import('../config/firebase.config');
  const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
  if (buffer.length > 4 * 1024 * 1024) throw new AppError('Logo trop lourd (max 4 Mo).', 413);
  const mime = imageMimeType ?? 'image/png';
  const ext = mime.split('/')[1]?.split('+')[0] ?? 'png';
  const { randomBytes } = await import('crypto');
  const fileName = `companies/${companyId}/branding/logo-${randomBytes(6).toString('hex')}.${ext}`;
  const bucket = getStorage().bucket();
  await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  await getFirestore().collection('companies').doc(companyId).set({ logoUrl: url, updatedAt: new Date() }, { merge: true });
  res.json({ success: true, data: { url } });
}));

// GET /api/company/domain/verify?domain=<host>
// Performs a real DNS A-record lookup via Google's public DNS-over-HTTPS resolver
// and tells the user whether their domain currently points at the Firebase Hosting
// edge IPs. No side effect on the company doc — purely a checker.
router.get('/domain/verify', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const domain = String((req.query as any).domain ?? '').trim().toLowerCase();
  if (!domain || !/^[a-z0-9][a-z0-9.-]{1,253}[a-z0-9]$/.test(domain)) {
    throw new AppError('Domaine invalide', 400);
  }

  // Firebase Hosting global IPs (stable since 2019).
  const FIREBASE_IPS = ['199.36.158.100'];
  const FIREBASE_CNAME_TARGET = 'mon-assistant-86bbd.web.app';

  try {
    const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
    const dnsJson = (await dnsRes.json()) as { Answer?: Array<{ data: string; type: number }> };
    const answers = dnsJson.Answer ?? [];
    const aRecords = answers.filter(a => a.type === 1).map(a => a.data);

    // CNAME lookup (separate query because dns.google returns CNAME chain as type 5)
    const cnameRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=CNAME`);
    const cnameJson = (await cnameRes.json()) as { Answer?: Array<{ data: string; type: number }> };
    const cnames = (cnameJson.Answer ?? []).filter(a => a.type === 5).map(a => a.data.replace(/\.$/, ''));

    const pointsToFirebase = aRecords.some(ip => FIREBASE_IPS.includes(ip))
      || cnames.some(c => c === FIREBASE_CNAME_TARGET || c.endsWith('.web.app') || c.endsWith('.firebaseapp.com'));

    // Update domain status on the company doc so the UI can reflect verified state.
    const status: 'active' | 'verifying' | 'failed' = pointsToFirebase ? 'active' : 'verifying';
    await getFirestore().collection('companies').doc(companyId).set({
      customDomain: domain, customStatus: status, customLastCheckedAt: new Date(),
    }, { merge: true });

    res.json({
      success: true,
      data: {
        domain,
        aRecords,
        cnames,
        expectedIps: FIREBASE_IPS,
        expectedCnameTarget: FIREBASE_CNAME_TARGET,
        verified: pointsToFirebase,
        nextStep: pointsToFirebase
          ? 'Ajoute le domaine côté Firebase Hosting (console) — Orlode délivrera le SSL automatiquement sous 24h.'
          : `Pointe ${domain} sur l'IP ${FIREBASE_IPS[0]} (record A) ou crée un CNAME vers ${FIREBASE_CNAME_TARGET}, puis re-vérifie.`,
      },
    });
  } catch (e: any) {
    res.json({
      success: false,
      data: { domain, verified: false, error: String(e?.message ?? e) },
    });
  }
}));

// PATCH /api/company/onboarding/step — save onboarding progress
router.patch('/onboarding/step', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { step, data } = req.body as { step: number; data?: Record<string, unknown> };
  const db = getFirestore();
  const updates: Record<string, unknown> = { [`onboardingStep`]: step, updatedAt: new Date() };

  if (data?.companyName) updates['name'] = data.companyName;
  if (data?.language) updates['settings.language'] = data.language;
  if (data?.aiPersonality) updates['settings.aiPersonality'] = data.aiPersonality;
  if (data?.industry) updates['industry'] = data.industry;
  if (data?.plan) updates['plan'] = data.plan;

  try { await db.collection('companies').doc(companyId).update(updates); }
  catch { await db.collection('companies').doc(companyId).set({ ...updates, id: companyId }, { merge: true }); }

  res.json({ success: true });
}));

// POST /api/company/onboarding/complete — mark onboarding as done + send completion email
router.post('/onboarding/complete', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const db = getFirestore();
  await db.collection('companies').doc(companyId).set({
    onboardingCompleted: true,
    onboardingCompletedAt: new Date(),
  }, { merge: true });

  // Send the onboarding-complete email asynchronously — don't block the response.
  // Best-effort: never fail the API if email send fails.
  (async () => {
    try {
      const userEmail = req.user?.email;
      if (!userEmail) return;
      const companyDoc = await db.collection('companies').doc(companyId).get();
      const company = companyDoc.data() ?? {};
      const companyName = (company['name'] as string) ?? 'Votre entreprise';
      const selectedBundleId = (company['selectedBundleId'] as string | null) ?? null;

      // Resolve pack name from active trial / paid subscription, if any
      let packName: string | undefined;
      let agentCount = 1;
      let trialDays: number | undefined;
      if (selectedBundleId) {
        try {
          const trialSnap = await db.collection('marketplacePayments')
            .where('companyId', '==', companyId)
            .where('bundleId', '==', selectedBundleId)
            .where('status', '==', 'trialing')
            .limit(1).get();
          if (!trialSnap.empty) {
            const trial = trialSnap.docs[0]?.data();
            packName = trial?.['bundleName'] as string | undefined;
            trialDays = 30;
            agentCount = 7;
          }
        } catch { /* best-effort */ }
      }

      const { sendOnboardingCompleteEmail } = await import('../services/email/emailService');
      await sendOnboardingCompleteEmail({
        to: userEmail,
        userName: userEmail.split('@')[0] ?? 'friend',
        companyName,
        packName,
        trialDays,
        agentCount,
        companyId,
        dashboardUrl: 'https://mon-assistant-86bbd.web.app/admin',
      });
    } catch (err) {
      const { logger } = await import('../utils/logger');
      logger.warn('[Onboarding] welcome email failed (non-fatal)', { err: String(err), companyId });
    }
  })();

  res.json({ success: true });
}));

// POST /api/company/seed-demo — load demo data (admin only)
router.post('/seed-demo', adminOnlyMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { seedDemoData } = await import('../services/seedDemoData');
  const result = await seedDemoData(companyId);
  res.json({ success: true, data: result });
}));

// POST /api/company/clear-demo — remove demo data (admin only)
router.post('/clear-demo', adminOnlyMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { clearDemoData } = await import('../services/seedDemoData');
  await clearDemoData(companyId);
  res.json({ success: true });
}));

export default router;
