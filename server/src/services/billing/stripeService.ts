/**
 * Stripe Billing Service
 * Gère abonnements, checkout, portail client, webhooks, usage tracking.
 */
import Stripe from 'stripe';
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../utils/logger';
import { resolvePlan } from '../../config/agentCatalog';
import { sendPaymentConfirmationEmail } from '../email/emailService';

// ── Plan definitions ──────────────────────────────────────────────────────────
// Source of truth for pricing is PLAN_AGENT_LIMITS in agentCatalog.ts.
// Aligned with frontend: free, creator, starter, pro, premium.

export const PLANS = {
  free: {
    name:            'Free',
    priceIdMonthly:  null,
    priceIdYearly:   null,
    priceMonthly:    0,
    priceYearly:     0,
    documentsLimit:  10,
    messagesLimit:   100,     // 100 messages IA / mois
    agentsLimit:     1,
    usersLimit:      2,
    storageGB:       1,
    byoe:            false,
    watermark:       true,    // "Powered by Orlode" obligatoire
    features:        ['documents', 'qa'],
  },
  creator: {
    name:            'Creator',
    priceIdMonthly:  process.env['STRIPE_CREATOR_PRICE_ID'] ?? '',          // $9.99/mois
    priceIdYearly:   process.env['STRIPE_CREATOR_YEARLY_PRICE_ID'] ?? '',   // $89.99/an
    priceMonthly:    9.99,
    priceYearly:     89.99,
    documentsLimit:  50,
    messagesLimit:   1000,
    agentsLimit:     0,  // own agents only, unlimited
    usersLimit:      3,
    storageGB:       2,
    byoe:            false,
    watermark:       false,
    features:        ['creator', 'marketplace_publish', 'referral'],
  },
  starter: {
    // ↳ Public-facing name "Pack" (the $20/pack métier pivot, Avril 2026).
    //   Internal key stays "starter" so the existing Stripe Price ID,
    //   webhook events, and Firestore companies/{id}.plan == 'starter'
    //   rows keep working without migration.
    name:            'Pack',
    priceIdMonthly:  process.env['STRIPE_STARTER_PRICE_ID'] ?? '',          // $19.99/mois (affiché 20$)
    priceIdYearly:   process.env['STRIPE_STARTER_YEARLY_PRICE_ID'] ?? '',   // $200/an
    priceMonthly:    19.99,
    priceYearly:     200,
    documentsLimit:  100,
    messagesLimit:   2000,
    agentsLimit:     4,
    usersLimit:      5,
    storageGB:       5,
    byoe:            false,
    watermark:       false,
    // NO default trial — the Free plan already serves as "try before buy".
    // SuperAdmin can still grant custom trials via /superadmin/companies/:id/grant-trial.
    features:        ['documents', 'qa', 'voice', 'comms'],
  },
  pro: {
    // ↳ Public-facing name "Super Pack". Internal key stays "pro" for
    //   backwards-compat with Stripe / Firestore.
    name:            'Super Pack',
    priceIdMonthly:  process.env['STRIPE_PRO_PRICE_ID'] ?? process.env['STRIPE_BUSINESS_PRICE_ID'] ?? '',            // $49.99/mois
    priceIdYearly:   process.env['STRIPE_PRO_YEARLY_PRICE_ID'] ?? process.env['STRIPE_BUSINESS_YEARLY_PRICE_ID'] ?? '', // $470/an
    priceMonthly:    49.99,
    priceYearly:     470,
    documentsLimit:  1000,
    messagesLimit:   10000,
    agentsLimit:     8,
    usersLimit:      25,
    storageGB:       50,
    byoe:            true,
    watermark:       false,
    features:        ['all', 'whatsapp', 'connectors'],
  },
  premium: {
    name:            'Premium',
    priceIdMonthly:  process.env['STRIPE_PREMIUM_PRICE_ID'] ?? process.env['STRIPE_ENTERPRISE_PRICE_ID'] ?? '',           // $99.99/mois
    priceIdYearly:   process.env['STRIPE_PREMIUM_YEARLY_PRICE_ID'] ?? process.env['STRIPE_ENTERPRISE_YEARLY_PRICE_ID'] ?? '', // $950/an
    priceMonthly:    99.99,
    priceYearly:     950,
    documentsLimit:  -1,
    messagesLimit:   -1,
    agentsLimit:     12,
    usersLimit:      -1,
    storageGB:       -1,
    byoe:            true,
    watermark:       false,
    features:        ['all', 'sla', 'priority_support'],
  },
} as const;

export type PlanId = keyof typeof PLANS;

function toPlanId(plan: string): PlanId {
  const resolved = resolvePlan(plan);
  return (resolved in PLANS ? resolved : 'free') as PlanId;
}

// ── Stripe instance ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getStripe(): any {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (Stripe as any)(key, { apiVersion: '2025-03-31.basil' });
}

// ── Service ───────────────────────────────────────────────────────────────────

export class StripeService {

  /** Crée ou récupère le customer Stripe pour une entreprise */
  async getOrCreateCustomer(companyId: string, email: string, name: string): Promise<string> {
    const db = getFirestore();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const existing = companyDoc.data()?.['stripeCustomerId'] as string | undefined;
    if (existing) return existing;

    const stripe = getStripe();
    const customer = await stripe.customers.create({ email, name, metadata: { companyId } });

    await db.collection('companies').doc(companyId).update({
      stripeCustomerId: customer.id,
      updatedAt: new Date(),
    });

    logger.info('[Stripe] Customer created', { companyId, customerId: customer.id });
    return customer.id;
  }

  /** Crée une session Checkout pour souscrire à un plan (mensuel ou annuel) */
  async createCheckoutSession(
    companyId: string,
    customerId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string,
    interval: 'monthly' | 'yearly' = 'monthly',
  ): Promise<string> {
    const resolvedId = toPlanId(planId);
    const plan = PLANS[resolvedId];
    const priceId = interval === 'yearly'
      ? (plan as { priceIdYearly?: string }).priceIdYearly
      : (plan as { priceIdMonthly?: string }).priceIdMonthly;

    if (!priceId) throw new Error(`Plan ${resolvedId} has no Stripe price ID for ${interval}. Set STRIPE_${resolvedId.toUpperCase()}${interval === 'yearly' ? '_YEARLY' : ''}_PRICE_ID in env.`);

    const stripe = getStripe();
    const trialDays = (plan as { trialDays?: number }).trialDays;

    const session = await stripe.checkout.sessions.create({
      customer:    customerId,
      mode:        'subscription',
      line_items:  [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  cancelUrl,
      metadata:    { companyId, planId: resolvedId, interval },
      subscription_data: {
        metadata:          { companyId, planId: resolvedId, interval },
        trial_period_days: trialDays,
      },
      allow_promotion_codes: true,
    });

    logger.info('[Stripe] Checkout session created', { companyId, planId: resolvedId, interval });
    return session.url ?? '';
  }

  /** Crée une session portail client (gérer abonnement, factures, CB) */
  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  /** Traite les webhooks Stripe (checkout.completed, subscription.updated, etc.) */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    const db = getFirestore();

    logger.info('[Stripe] Webhook received', { type: event.type });

    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as unknown as {
          metadata?: Record<string, string>; customer?: string; subscription?: string;
          customer_email?: string; customer_details?: { email?: string };
          amount_total?: number; currency?: string;
        };
        const companyId = session.metadata?.['companyId'];
        const rawPlanId = session.metadata?.['planId'];
        if (!companyId || !rawPlanId) break;
        const planId = toPlanId(rawPlanId);
        const interval = session.metadata?.['interval'] as 'monthly' | 'yearly' | undefined;

        await db.collection('companies').doc(companyId).update({
          plan:               planId,
          stripeCustomerId:   session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          subscriptionStatus: 'active',
          planActivatedAt:    new Date(),
          updatedAt:          new Date(),
        });
        logger.info('[Stripe] Subscription activated', { companyId, planId });

        // Send confirmation email (non-blocking — don't fail webhook if email fails)
        const buyerEmail = session.customer_email ?? session.customer_details?.email;
        if (buyerEmail) {
          const amount = session.amount_total
            ? `${(session.amount_total / 100).toFixed(2)} ${session.currency?.toUpperCase() ?? 'USD'}`
            : `$${PLANS[planId].priceMonthly}`;
          sendPaymentConfirmationEmail({
            to: buyerEmail,
            planName: PLANS[planId].name,
            amount,
            method: 'Carte bancaire (Stripe)',
            reference: (session.subscription as string) ?? 'stripe',
            interval,
            companyId,
          }).catch(err => logger.error('[Stripe] confirmation email failed', { err: String(err) }));
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as unknown as { metadata?: Record<string, string>; items: { data: Array<{ price: { id: string } }> }; status: string; current_period_end: number; cancel_at_period_end: boolean };
        const companyId = sub.metadata?.['companyId'];
        if (!companyId) break;

        const planId = this.getPlanFromPriceId(sub.items.data[0]?.price.id ?? '');
        await db.collection('companies').doc(companyId).update({
          plan:                 planId ?? 'free',
          subscriptionStatus:   sub.status,
          currentPeriodEnd:     new Date(sub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd:    sub.cancel_at_period_end,
          updatedAt:            new Date(),
        });
        logger.info('[Stripe] Subscription updated', { companyId, status: sub.status });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as unknown as { metadata?: Record<string, string> };
        const companyId = sub.metadata?.['companyId'];
        if (!companyId) break;

        await db.collection('companies').doc(companyId).update({
          plan:               'free',
          subscriptionStatus: 'canceled',
          updatedAt:          new Date(),
        });
        logger.info('[Stripe] Subscription canceled', { companyId });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as unknown as { customer?: string };
        const customerId = invoice.customer as string;
        // Trouver l'entreprise par customerId
        const snap = await db.collection('companies')
          .where('stripeCustomerId', '==', customerId).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({ subscriptionStatus: 'past_due', updatedAt: new Date() });
          logger.warn('[Stripe] Payment failed', { customerId });
        }
        break;
      }
    }
  }

  /** Récupère l'abonnement actuel d'une entreprise */
  async getSubscription(companyId: string): Promise<{
    plan: PlanId;
    status: string;
    customerId?: string;
    subscriptionId?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  }> {
    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId).get();
    const data = doc.data() ?? {};
    return {
      plan:              toPlanId((data['plan'] as string) ?? 'free'),
      status:            (data['subscriptionStatus'] as string) ?? 'trialing',
      customerId:        data['stripeCustomerId'] as string | undefined,
      subscriptionId:    data['stripeSubscriptionId'] as string | undefined,
      currentPeriodEnd:  data['currentPeriodEnd'] as string | undefined,
      cancelAtPeriodEnd: data['cancelAtPeriodEnd'] as boolean | undefined,
    };
  }

  /**
   * Cancel a company's Stripe subscription at period end.
   * Firestore plan stays on the paid tier until the period ends, then webhook downgrades to 'free'.
   * If no Stripe sub exists (PayPal/Wave paid), just set plan to 'free' immediately.
   */
  async cancelSubscription(companyId: string, immediate = false): Promise<{ endsAt: string | null; immediate: boolean }> {
    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId).get();
    const data = doc.data() ?? {};
    const subscriptionId = data['stripeSubscriptionId'] as string | undefined;

    if (!subscriptionId) {
      // No Stripe sub — probably PayPal/Wave one-shot. Downgrade immediately.
      await db.collection('companies').doc(companyId).update({
        plan: 'free',
        subscriptionStatus: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info('[Stripe] Company downgraded to free (no Stripe sub)', { companyId });
      return { endsAt: null, immediate: true };
    }

    const stripe = getStripe();

    if (immediate) {
      const sub = await stripe.subscriptions.cancel(subscriptionId);
      await db.collection('companies').doc(companyId).update({
        plan: 'free',
        subscriptionStatus: 'canceled',
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info('[Stripe] Subscription canceled immediately', { companyId, subscriptionId });
      return { endsAt: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null, immediate: true };
    }

    // Soft cancel: mark to cancel at period end — user keeps their plan until then
    const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    const endsAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    await db.collection('companies').doc(companyId).update({
      cancelAtPeriodEnd: true,
      subscriptionStatus: sub.status,
      currentPeriodEnd: endsAt,
      updatedAt: new Date(),
    });
    logger.info('[Stripe] Subscription scheduled to cancel at period end', { companyId, subscriptionId, endsAt });
    return { endsAt, immediate: false };
  }

  /** Track usage agent par mois */
  async trackAgentUsage(companyId: string, agentName: string): Promise<void> {
    const db = getFirestore();
    const month = new Date().toISOString().slice(0, 7);
    await db.collection(`companies/${companyId}/usageMetrics`).doc(month).set({
      [`agents.${agentName}`]: FieldValue.increment(1),
      total:                   FieldValue.increment(1),
      updatedAt:               FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  /** Retrouve le planId depuis un Stripe price ID (mensuel ou annuel) */
  private getPlanFromPriceId(priceId: string): PlanId | null {
    for (const [id, plan] of Object.entries(PLANS)) {
      const p = plan as Record<string, unknown>;
      if (p['priceIdMonthly'] === priceId || p['priceIdYearly'] === priceId) return id as PlanId;
    }
    return null;
  }
}

export const stripeService = new StripeService();
