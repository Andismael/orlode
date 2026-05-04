import type { Response, Request } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { stripeService, PLANS } from '../services/billing/stripeService';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// GET /api/billing/subscription
export async function getSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const subscription = await stripeService.getSubscription(companyId);
  const planDetails  = PLANS[subscription.plan];

  res.json({ success: true, data: { ...subscription, planDetails } });
}

// GET /api/billing/plans
export async function getPlans(_req: Request, res: Response): Promise<void> {
  const plans = Object.entries(PLANS).map(([id, plan]) => ({
    id,
    name:           plan.name,
    priceMonthly:   (plan as Record<string, unknown>)['priceMonthly'] as number ?? 0,
    priceYearly:    (plan as Record<string, unknown>)['priceYearly'] as number ?? 0,
    documentsLimit: plan.documentsLimit,
    agentsLimit:    plan.agentsLimit,
    usersLimit:     plan.usersLimit,
    storageGB:      plan.storageGB,
    features:       plan.features,
  }));
  res.json({ success: true, data: plans });
}

// POST /api/billing/checkout
export async function createCheckout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { planId, successUrl, cancelUrl, interval } = req.body as {
    planId: string; successUrl: string; cancelUrl: string; interval?: 'monthly' | 'yearly';
  };

  if (!planId || !successUrl || !cancelUrl) {
    throw new AppError('planId, successUrl, and cancelUrl are required', 400);
  }

  const db = getFirestore();
  const companyDoc = await db.collection('companies').doc(companyId).get();
  const companyData = companyDoc.data() ?? {};

  const customerId = await stripeService.getOrCreateCustomer(
    companyId,
    req.user?.email ?? '',
    (companyData['name'] as string) ?? 'Company'
  );

  const checkoutUrl = await stripeService.createCheckoutSession(
    companyId, customerId, planId as never, successUrl, cancelUrl, interval ?? 'monthly'
  );

  res.json({ success: true, data: { url: checkoutUrl } });
}

// POST /api/billing/portal
export async function createPortal(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { returnUrl } = req.body as { returnUrl: string };
  const db = getFirestore();
  const companyDoc = await db.collection('companies').doc(companyId).get();
  const customerId = companyDoc.data()?.['stripeCustomerId'] as string | undefined;

  if (!customerId) throw new AppError('No billing account found. Please subscribe first.', 400);

  const portalUrl = await stripeService.createPortalSession(customerId, returnUrl ?? '/settings');
  res.json({ success: true, data: { url: portalUrl } });
}

// POST /api/billing/cancel — downgrade to free (cancel Stripe sub or wipe PayPal/Wave)
export async function cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const immediate = (req.body as { immediate?: boolean })?.immediate === true;
  const result = await stripeService.cancelSubscription(companyId, immediate);
  res.json({ success: true, data: result });
}

// POST /api/billing/webhook — called by Stripe, no auth middleware
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) { res.status(400).send('Missing stripe-signature header'); return; }

  try {
    await stripeService.handleWebhook(req.body as Buffer, signature);
    res.json({ received: true });
  } catch (err) {
    logger.error('[Stripe Webhook] Error', { error: err });
    res.status(400).send(`Webhook error: ${(err as Error).message}`);
  }
}

// GET /api/billing/usage
export async function getUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const month = (req.query['month'] as string) ?? new Date().toISOString().slice(0, 7);
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/usageMetrics`).doc(month).get();
  const data = doc.data() ?? {};

  const subscription = await stripeService.getSubscription(companyId);
  const planDetails  = PLANS[subscription.plan];

  // Current document count
  const docsSnap = await db.collection(`companies/${companyId}/documents`).count().get();
  const usersSnap = await db.collection('users').where('companyId', '==', companyId).count().get();

  res.json({
    success: true,
    data: {
      month,
      plan:      subscription.plan,
      agentCalls: data['total'] ?? 0,
      agentBreakdown: (data['agents'] as Record<string, number>) ?? {},
      documents: {
        current: docsSnap.data().count,
        limit:   planDetails.documentsLimit,
        pct:     planDetails.documentsLimit > 0
          ? Math.round((docsSnap.data().count / planDetails.documentsLimit) * 100)
          : 0,
      },
      users: {
        current: usersSnap.data().count,
        limit:   planDetails.usersLimit,
      },
    },
  });
}
