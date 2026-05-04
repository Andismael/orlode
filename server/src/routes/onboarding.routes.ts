import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getOnboardingStatus,
  saveOnboardingStep,
  completeOnboarding,
} from '../controllers/onboarding.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/status', asyncHandler(getOnboardingStatus));
router.patch('/step', asyncHandler(saveOnboardingStep));
router.post('/complete', asyncHandler(completeOnboarding));

export default router;
