"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscription = getSubscription;
exports.getPlans = getPlans;
exports.createCheckout = createCheckout;
exports.createPortal = createPortal;
exports.cancelSubscription = cancelSubscription;
exports.handleStripeWebhook = handleStripeWebhook;
exports.getUsage = getUsage;
const stripeService_1 = require("../services/billing/stripeService");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
// GET /api/billing/subscription
async function getSubscription(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const subscription = await stripeService_1.stripeService.getSubscription(companyId);
    const planDetails = stripeService_1.PLANS[subscription.plan];
    res.json({ success: true, data: { ...subscription, planDetails } });
}
// GET /api/billing/plans
async function getPlans(_req, res) {
    const plans = Object.entries(stripeService_1.PLANS).map(([id, plan]) => ({
        id,
        name: plan.name,
        priceMonthly: plan['priceMonthly'] ?? 0,
        priceYearly: plan['priceYearly'] ?? 0,
        documentsLimit: plan.documentsLimit,
        agentsLimit: plan.agentsLimit,
        usersLimit: plan.usersLimit,
        storageGB: plan.storageGB,
        features: plan.features,
    }));
    res.json({ success: true, data: plans });
}
// POST /api/billing/checkout
async function createCheckout(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { planId, successUrl, cancelUrl, interval } = req.body;
    if (!planId || !successUrl || !cancelUrl) {
        throw new error_middleware_1.AppError('planId, successUrl, and cancelUrl are required', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyData = companyDoc.data() ?? {};
    const customerId = await stripeService_1.stripeService.getOrCreateCustomer(companyId, req.user?.email ?? '', companyData['name'] ?? 'Company');
    const checkoutUrl = await stripeService_1.stripeService.createCheckoutSession(companyId, customerId, planId, successUrl, cancelUrl, interval ?? 'monthly');
    res.json({ success: true, data: { url: checkoutUrl } });
}
// POST /api/billing/portal
async function createPortal(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { returnUrl } = req.body;
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const customerId = companyDoc.data()?.['stripeCustomerId'];
    if (!customerId)
        throw new error_middleware_1.AppError('No billing account found. Please subscribe first.', 400);
    const portalUrl = await stripeService_1.stripeService.createPortalSession(customerId, returnUrl ?? '/settings');
    res.json({ success: true, data: { url: portalUrl } });
}
// POST /api/billing/cancel — downgrade to free (cancel Stripe sub or wipe PayPal/Wave)
async function cancelSubscription(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const immediate = req.body?.immediate === true;
    const result = await stripeService_1.stripeService.cancelSubscription(companyId, immediate);
    res.json({ success: true, data: result });
}
// POST /api/billing/webhook — called by Stripe, no auth middleware
async function handleStripeWebhook(req, res) {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
        res.status(400).send('Missing stripe-signature header');
        return;
    }
    try {
        await stripeService_1.stripeService.handleWebhook(req.body, signature);
        res.json({ received: true });
    }
    catch (err) {
        logger_1.logger.error('[Stripe Webhook] Error', { error: err });
        res.status(400).send(`Webhook error: ${err.message}`);
    }
}
// GET /api/billing/usage
async function getUsage(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const month = req.query['month'] ?? new Date().toISOString().slice(0, 7);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/usageMetrics`).doc(month).get();
    const data = doc.data() ?? {};
    const subscription = await stripeService_1.stripeService.getSubscription(companyId);
    const planDetails = stripeService_1.PLANS[subscription.plan];
    // Current document count
    const docsSnap = await db.collection(`companies/${companyId}/documents`).count().get();
    const usersSnap = await db.collection('users').where('companyId', '==', companyId).count().get();
    res.json({
        success: true,
        data: {
            month,
            plan: subscription.plan,
            agentCalls: data['total'] ?? 0,
            agentBreakdown: data['agents'] ?? {},
            documents: {
                current: docsSnap.data().count,
                limit: planDetails.documentsLimit,
                pct: planDetails.documentsLimit > 0
                    ? Math.round((docsSnap.data().count / planDetails.documentsLimit) * 100)
                    : 0,
            },
            users: {
                current: usersSnap.data().count,
                limit: planDetails.usersLimit,
            },
        },
    });
}
//# sourceMappingURL=billing.controller.js.map