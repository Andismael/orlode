import { Router } from 'express';
import express from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getSubscription, getPlans, createCheckout, createPortal, handleStripeWebhook, getUsage, cancelSubscription } from '../controllers/billing.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Stripe webhook — raw body required, no auth
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(handleStripeWebhook));

// Public — plan catalog
router.get('/plans', asyncHandler(getPlans));

// Protected
router.use(authMiddleware);
router.get('/subscription', asyncHandler(getSubscription));
router.get('/usage',        asyncHandler(getUsage));
router.post('/checkout',    asyncHandler(createCheckout));
router.post('/portal',      asyncHandler(createPortal));
router.post('/cancel',      asyncHandler(cancelSubscription));

export default router;
