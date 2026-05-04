/**
 * Onboarding Controller
 * Manages company setup wizard state.
 * Steps: welcome → language → team → documents → done
 */
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// GET /api/onboarding/status
export async function getOnboardingStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const companyDoc = await db.collection('companies').doc(companyId).get();
  if (!companyDoc.exists) throw new AppError('Company not found', 404);

  const data = companyDoc.data()!;
  res.json({
    success: true,
    data: {
      completed: data['onboardingCompleted'] === true,
      currentStep: (data['onboardingStep'] as number | undefined) ?? 0,
      completedAt: data['onboardingCompletedAt'] ?? null,
    },
  });
}

// PATCH /api/onboarding/step — save progress without completing
export async function saveOnboardingStep(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  if (!req.user?.uid) throw new AppError('User not authenticated', 401);

  const { step, data } = req.body as { step: number; data?: Record<string, unknown> };
  if (typeof step !== 'number') throw new AppError('step (number) is required', 400);

  const db = getFirestore();
  const update: Record<string, unknown> = {
    onboardingStep: step,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Merge step data into company settings / top-level fields
  if (data?.companyName) update['name'] = data.companyName;
  if (data?.language) update['settings.language'] = data.language;
  if (data?.timezone) update['settings.timezone'] = data.timezone;
  if (data?.aiPersonality) update['settings.aiPersonality'] = data.aiPersonality;

  await db.collection('companies').doc(companyId).update(update);
  logger.info(`[Onboarding] Step ${step} saved for company ${companyId}`);
  res.json({ success: true, step });
}

// POST /api/onboarding/complete
export async function completeOnboarding(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  await db.collection('companies').doc(companyId).update({
    onboardingCompleted: true,
    onboardingCompletedAt: FieldValue.serverTimestamp(),
    onboardingStep: 5,
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info(`[Onboarding] Completed for company ${companyId}`);
  res.json({ success: true, message: 'Onboarding complete' });
}
