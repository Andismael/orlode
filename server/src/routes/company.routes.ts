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
