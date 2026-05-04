"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paypalService = exports.PayPalService = void 0;
/**
 * PayPal Billing Service
 * REST API v2 — OAuth token, create order, capture payment, webhook verification.
 * Used alongside Stripe (Western cards) and Wave (XOF mobile money).
 */
const firebase_config_1 = require("../../config/firebase.config");
const logger_1 = require("../../utils/logger");
const emailService_1 = require("../email/emailService");
const PAYPAL_BASE = process.env['PAYPAL_ENV'] === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
let cachedToken = null;
async function getAccessToken() {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30000)
        return cachedToken.value;
    const clientId = process.env['PAYPAL_CLIENT_ID'];
    const secret = process.env['PAYPAL_CLIENT_SECRET'];
    if (!clientId || !secret)
        throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not configured');
    const basic = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    if (!res.ok)
        throw new Error(`PayPal OAuth failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
}
class PayPalService {
    /** Create a PayPal checkout order. Returns approval URL to redirect the user to. */
    async createOrder(params) {
        const token = await getAccessToken();
        const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'PayPal-Request-Id': params.paymentId,
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                        reference_id: params.paymentId,
                        description: params.description,
                        custom_id: `${params.companyId}:${params.planId}:${params.interval}`,
                        amount: { currency_code: 'USD', value: params.amountUSD.toFixed(2) },
                    }],
                application_context: {
                    return_url: params.returnUrl,
                    cancel_url: params.cancelUrl,
                    user_action: 'PAY_NOW',
                    shipping_preference: 'NO_SHIPPING',
                },
            }),
        });
        if (!res.ok)
            throw new Error(`PayPal createOrder failed: ${res.status} ${await res.text()}`);
        const order = await res.json();
        const approveUrl = order.links?.find(l => l.rel === 'approve')?.href ?? '';
        if (!approveUrl)
            throw new Error('PayPal order missing approve link');
        logger_1.logger.info('[PayPal] Order created', { orderId: order.id, companyId: params.companyId, planId: params.planId });
        return { orderId: order.id, approveUrl };
    }
    /** Capture an approved order. Called after user returns from PayPal. */
    async captureOrder(orderId) {
        const token = await getAccessToken();
        const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok)
            throw new Error(`PayPal capture failed: ${res.status} ${await res.text()}`);
        const data = await res.json();
        const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
        logger_1.logger.info('[PayPal] Order captured', { orderId, status: data.status, captureId });
        return { status: data.status, captureId, payerEmail: data.payer?.email_address };
    }
    /**
     * Verify a webhook signature. PayPal calls /v1/notifications/verify-webhook-signature
     * with the raw event body + headers. Requires PAYPAL_WEBHOOK_ID from dashboard.
     */
    async verifyWebhook(headers, body) {
        const webhookId = process.env['PAYPAL_WEBHOOK_ID'];
        if (!webhookId) {
            logger_1.logger.warn('[PayPal] PAYPAL_WEBHOOK_ID not set — skipping signature verification');
            return true;
        }
        const token = await getAccessToken();
        const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth_algo: headers['paypal-auth-algo'],
                cert_url: headers['paypal-cert-url'],
                transmission_id: headers['paypal-transmission-id'],
                transmission_sig: headers['paypal-transmission-sig'],
                transmission_time: headers['paypal-transmission-time'],
                webhook_id: webhookId,
                webhook_event: body,
            }),
        });
        if (!res.ok)
            return false;
        const data = await res.json();
        return data.verification_status === 'SUCCESS';
    }
    /** Called by webhook when a capture is completed — activates the plan. */
    async handleCaptureCompleted(event) {
        const customId = event.resource?.custom_id;
        if (!customId)
            return;
        const [companyId, planId] = customId.split(':');
        if (!companyId || !planId)
            return;
        const db = (0, firebase_config_1.getFirestore)();
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
        await db.collection('companies').doc(companyId).update({
            plan: planId,
            paymentMethod: 'paypal',
            paypalCaptureId: event.resource?.id ?? null,
            paypalOrderId: orderId ?? null,
            subscriptionStatus: 'active',
            planActivatedAt: new Date(),
            updatedAt: new Date(),
        });
        // Update payment record + send confirmation (idempotent — skip if already completed)
        let paymentData = null;
        if (orderId) {
            const snap = await db.collection('payments').where('paypalOrderId', '==', orderId).limit(1).get();
            if (!snap.empty) {
                const doc = snap.docs[0];
                paymentData = doc.data();
                if (paymentData['status'] !== 'completed') {
                    await doc.ref.update({ status: 'completed', completedAt: new Date() });
                }
            }
        }
        // Fetch company email for confirmation
        const companyDoc = await db.collection('companies').doc(companyId).get();
        const buyerEmail = companyDoc.data()?.['email']
            ?? companyDoc.data()?.['ownerEmail'];
        if (buyerEmail && paymentData) {
            (0, emailService_1.sendPaymentConfirmationEmail)({
                to: buyerEmail,
                planName: String(planId).charAt(0).toUpperCase() + String(planId).slice(1),
                amount: `$${paymentData['amountUSD'] ?? '0'}`,
                method: 'PayPal',
                reference: orderId ?? String(event.resource?.id ?? ''),
                interval: paymentData['interval'],
                companyId,
            }).catch(err => logger_1.logger.error('[PayPal] confirmation email failed', { err: String(err) }));
        }
        logger_1.logger.info('[PayPal] Subscription activated via webhook', { companyId, planId });
    }
    /** Capture pending (e.g. eCheck, fraud review) — mark payment as pending, no plan activation yet. */
    async handleCapturePending(event) {
        const customId = event.resource?.custom_id;
        if (!customId)
            return;
        const [companyId, planId] = customId.split(':');
        if (!companyId)
            return;
        const db = (0, firebase_config_1.getFirestore)();
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
        const reason = event.resource?.status_details?.reason ?? 'unknown';
        if (orderId) {
            const snap = await db.collection('payments').where('paypalOrderId', '==', orderId).limit(1).get();
            if (!snap.empty) {
                await snap.docs[0].ref.update({
                    status: 'pending_review',
                    pendingReason: reason,
                    updatedAt: new Date(),
                });
            }
        }
        logger_1.logger.warn('[PayPal] Capture pending', { companyId, planId, reason });
    }
    /** Capture denied — mark payment as failed, do NOT activate plan. */
    async handleCaptureDenied(event) {
        const customId = event.resource?.custom_id;
        if (!customId)
            return;
        const [companyId, planId] = customId.split(':');
        if (!companyId)
            return;
        const db = (0, firebase_config_1.getFirestore)();
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
        const reason = event.resource?.status_details?.reason ?? 'denied';
        if (orderId) {
            const snap = await db.collection('payments').where('paypalOrderId', '==', orderId).limit(1).get();
            if (!snap.empty) {
                await snap.docs[0].ref.update({
                    status: 'failed',
                    failedAt: new Date(),
                    failureReason: reason,
                });
            }
        }
        logger_1.logger.warn('[PayPal] Capture denied', { companyId, planId, reason });
    }
}
exports.PayPalService = PayPalService;
exports.paypalService = new PayPalService();
//# sourceMappingURL=paypalService.js.map