/**
 * PayPal Billing Service
 * REST API v2 — OAuth token, create order, capture payment, webhook verification.
 * Used alongside Stripe (Western cards) and Wave (XOF mobile money).
 */
import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';
import { sendPaymentConfirmationEmail } from '../email/emailService';

const PAYPAL_BASE = process.env['PAYPAL_ENV'] === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

interface OAuthToken { access_token: string; expires_in: number; }
interface PayPalOrder { id: string; status: string; links?: Array<{ href: string; rel: string; method: string }>; }

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const clientId = process.env['PAYPAL_CLIENT_ID'];
  const secret = process.env['PAYPAL_CLIENT_SECRET'];
  if (!clientId || !secret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not configured');

  const basic = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal OAuth failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as OAuthToken;
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export class PayPalService {

  /** Create a PayPal checkout order. Returns approval URL to redirect the user to. */
  async createOrder(params: {
    paymentId: string;
    companyId: string;
    planId: string;
    interval: 'monthly' | 'yearly';
    amountUSD: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ orderId: string; approveUrl: string }> {
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
    if (!res.ok) throw new Error(`PayPal createOrder failed: ${res.status} ${await res.text()}`);

    const order = await res.json() as PayPalOrder;
    const approveUrl = order.links?.find(l => l.rel === 'approve')?.href ?? '';
    if (!approveUrl) throw new Error('PayPal order missing approve link');

    logger.info('[PayPal] Order created', { orderId: order.id, companyId: params.companyId, planId: params.planId });
    return { orderId: order.id, approveUrl };
  }

  /** Capture an approved order. Called after user returns from PayPal. */
  async captureOrder(orderId: string): Promise<{ status: string; captureId?: string; payerEmail?: string }> {
    const token = await getAccessToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`PayPal capture failed: ${res.status} ${await res.text()}`);

    const data = await res.json() as {
      status: string;
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>;
      payer?: { email_address?: string };
    };
    const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    logger.info('[PayPal] Order captured', { orderId, status: data.status, captureId });
    return { status: data.status, captureId, payerEmail: data.payer?.email_address };
  }

  /**
   * Verify a webhook signature. PayPal calls /v1/notifications/verify-webhook-signature
   * with the raw event body + headers. Requires PAYPAL_WEBHOOK_ID from dashboard.
   */
  async verifyWebhook(headers: Record<string, string | undefined>, body: unknown): Promise<boolean> {
    const webhookId = process.env['PAYPAL_WEBHOOK_ID'];
    if (!webhookId) {
      logger.warn('[PayPal] PAYPAL_WEBHOOK_ID not set — skipping signature verification');
      return true;
    }
    const token = await getAccessToken();

    const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo:         headers['paypal-auth-algo'],
        cert_url:          headers['paypal-cert-url'],
        transmission_id:   headers['paypal-transmission-id'],
        transmission_sig:  headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id:        webhookId,
        webhook_event:     body,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { verification_status?: string };
    return data.verification_status === 'SUCCESS';
  }

  /** Called by webhook when a capture is completed — activates the plan. */
  async handleCaptureCompleted(event: {
    resource?: { custom_id?: string; supplementary_data?: { related_ids?: { order_id?: string } }; id?: string };
  }): Promise<void> {
    const customId = event.resource?.custom_id;
    if (!customId) return;

    const [companyId, planId] = customId.split(':');
    if (!companyId || !planId) return;

    const db = getFirestore();
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;

    await db.collection('companies').doc(companyId).update({
      plan:               planId,
      paymentMethod:      'paypal',
      paypalCaptureId:    event.resource?.id ?? null,
      paypalOrderId:      orderId ?? null,
      subscriptionStatus: 'active',
      planActivatedAt:    new Date(),
      updatedAt:          new Date(),
    });

    // Update payment record + send confirmation (idempotent — skip if already completed)
    let paymentData: Record<string, unknown> | null = null;
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
    const buyerEmail = (companyDoc.data()?.['email'] as string | undefined)
      ?? (companyDoc.data()?.['ownerEmail'] as string | undefined);
    if (buyerEmail && paymentData) {
      sendPaymentConfirmationEmail({
        to: buyerEmail,
        planName: String(planId).charAt(0).toUpperCase() + String(planId).slice(1),
        amount: `$${paymentData['amountUSD'] ?? '0'}`,
        method: 'PayPal',
        reference: orderId ?? String(event.resource?.id ?? ''),
        interval: paymentData['interval'] as 'monthly' | 'yearly' | undefined,
        companyId,
      }).catch(err => logger.error('[PayPal] confirmation email failed', { err: String(err) }));
    }
    logger.info('[PayPal] Subscription activated via webhook', { companyId, planId });
  }

  /** Capture pending (e.g. eCheck, fraud review) — mark payment as pending, no plan activation yet. */
  async handleCapturePending(event: {
    resource?: { custom_id?: string; supplementary_data?: { related_ids?: { order_id?: string } }; id?: string; status_details?: { reason?: string } };
  }): Promise<void> {
    const customId = event.resource?.custom_id;
    if (!customId) return;
    const [companyId, planId] = customId.split(':');
    if (!companyId) return;

    const db = getFirestore();
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
    logger.warn('[PayPal] Capture pending', { companyId, planId, reason });
  }

  /** Capture denied — mark payment as failed, do NOT activate plan. */
  async handleCaptureDenied(event: {
    resource?: { custom_id?: string; supplementary_data?: { related_ids?: { order_id?: string } }; id?: string; status_details?: { reason?: string } };
  }): Promise<void> {
    const customId = event.resource?.custom_id;
    if (!customId) return;
    const [companyId, planId] = customId.split(':');
    if (!companyId) return;

    const db = getFirestore();
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
    logger.warn('[PayPal] Capture denied', { companyId, planId, reason });
  }
}

export const paypalService = new PayPalService();
