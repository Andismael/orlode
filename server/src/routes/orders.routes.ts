/**
 * Orders — Clone commerce layer.
 *
 * Firestore: companies/{id}/orders/{orderId}
 *   {
 *     id, clientName, clientPhone, clientEmail, company,
 *     items: [{ productId, name, quantity, unitPrice, currency }],
 *     subtotal, currency,
 *     status: 'draft' | 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded',
 *     paymentMethod: 'stripe' | 'wave' | 'paypal' | 'manual' | null,
 *     paymentUrl?: string,
 *     paymentProviderId?: string,
 *     notes, sourceChannel, createdBy, createdAt,
 *   }
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import express from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const router = Router();

async function sendInvoiceEmail(companyId: string, orderId: string): Promise<void> {
  try {
    const { renderInvoicePdf, loadOrderForInvoice, loadCompanyForInvoice } = await import('../services/invoice/invoicePdfService');
    const order = await loadOrderForInvoice(companyId, orderId);
    if (!order?.clientEmail) return;
    const company = await loadCompanyForInvoice(companyId);
    const pdf = await renderInvoicePdf(company, order);
    const { sendEmail } = await import('../services/email/emailService');
    await sendEmail({
      to: order.clientEmail,
      subject: `Facture — Commande ${orderId}`,
      html: `<p>Bonjour ${order.clientName},</p><p>Merci pour votre achat chez ${company.name}. Veuillez trouver votre facture en pièce jointe.</p><p>Total: <strong>${order.subtotal.toLocaleString()} ${order.currency}</strong></p>`,
      companyId,
      tags: [{ name: 'type', value: 'invoice' }],
      attachments: [{ filename: `facture-${orderId}.pdf`, content: pdf }],
    });
    logger.info('[Orders] Invoice email sent', { companyId, orderId });
  } catch (err) {
    logger.warn('[Orders] invoice email failed', { err: String(err) });
  }
}

async function decrementStock(companyId: string, order: Record<string, unknown>): Promise<void> {
  const items = (order['items'] as Array<Record<string, unknown>>) ?? [];
  if (items.length === 0) return;
  const db = getFirestore();
  for (const it of items) {
    const productId = it['productId'] as string;
    const qty = Number(it['quantity'] ?? 0);
    if (!productId || qty <= 0) continue;
    try {
      const pref = db.collection(`companies/${companyId}/products`).doc(productId);
      await db.runTransaction(async (tx) => {
        const pdoc = await tx.get(pref);
        if (!pdoc.exists) return;
        const pdata = pdoc.data() ?? {};
        const currentStock = pdata['stock'];
        if (currentStock == null) return; // null stock = untracked, skip
        const newStock = Math.max(0, Number(currentStock) - qty);
        tx.update(pref, { stock: newStock, updatedAt: new Date() });
      });
    } catch (err) {
      logger.warn('[Orders] stock decrement failed', { companyId, productId, err: String(err) });
    }
  }
  logger.info('[Orders] Stock decremented', { companyId, items: items.length });
}

// ── PUBLIC: Stripe webhook (no auth — verified by signature) ────────────────
// POST /api/orders/webhook/stripe
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), asyncHandler(async (req: Request, res: Response) => {
  const STRIPE_SECRET = process.env['STRIPE_SECRET_KEY'];
  const WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'];
  if (!STRIPE_SECRET || !WEBHOOK_SECRET) {
    res.status(503).json({ success: false, message: 'Stripe not configured' });
    return;
  }
  try {
    const Stripe = (await import('stripe')).default;
    const stripeClient = new (Stripe as unknown as new (key: string) => { webhooks: { constructEvent: (payload: string | Buffer, sig: string, secret: string) => { type: string; data: { object: Record<string, unknown> } } } })(STRIPE_SECRET);
    const sig = req.headers['stripe-signature'] as string;
    const event = stripeClient.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as { metadata?: Record<string, string>; payment_status?: string; id?: string };
      const orderId = session.metadata?.['orderId'];
      const companyId = session.metadata?.['companyId'];
      const kind = session.metadata?.['kind'];
      if (kind === 'shop_order' && orderId && companyId && session.payment_status === 'paid') {
        const db = getFirestore();
        const ref = db.collection(`companies/${companyId}/orders`).doc(orderId);
        const doc = await ref.get();
        if (doc.exists && doc.data()?.['status'] !== 'paid') {
          await ref.update({
            status: 'paid', paidAt: new Date(), paymentMethod: 'stripe',
            stripeSessionId: session.id, paidBy: 'webhook',
          });
          await decrementStock(companyId, doc.data() ?? {});
          sendInvoiceEmail(companyId, orderId).catch(() => {});
          logger.info('[Stripe Webhook] Order marked paid + stock decremented', { orderId, companyId });
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('[Stripe Webhook] Failed', { err: String(err) });
    res.status(400).json({ success: false, message: String(err) });
  }
}));

// ── PUBLIC: Wave callback (no standard signature; guard via CRON_SECRET or URL token) ──
// POST /api/orders/webhook/wave?orderId=XXX&companyId=YYY&secret=...
router.post('/webhook/wave', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const got = (req.query['secret'] as string | undefined) ?? '';
  if (!expected || got !== expected) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const { orderId, companyId } = req.query as Record<string, string | undefined>;
  if (!orderId || !companyId) {
    res.status(400).json({ success: false, message: 'orderId + companyId required' });
    return;
  }
  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/orders`).doc(orderId);
  const doc = await ref.get();
  if (!doc.exists) {
    res.status(404).json({ success: false, message: 'Order not found' });
    return;
  }
  if (doc.data()?.['status'] !== 'paid') {
    await ref.update({ status: 'paid', paidAt: new Date(), paymentMethod: 'wave', paidBy: 'wave_webhook' });
    await decrementStock(companyId, doc.data() ?? {});
    sendInvoiceEmail(companyId, orderId).catch(() => {});
    logger.info('[Wave Webhook] Order marked paid + stock decremented', { orderId, companyId });
  }
  res.json({ success: true });
}));

// ── PUBLIC: Invoice PDF (accessible with order ID + email match OR admin auth) ──
// GET /api/orders/:id/invoice.pdf?companyId=XXX&email=YYY
// Clients can download their invoice with their email as proof.
router.get('/:id/invoice.pdf', asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params['id'];
  const companyId = (req.query['companyId'] as string) ?? '';
  const email = ((req.query['email'] as string) ?? '').toLowerCase().trim();

  // Admin auth bypass: if Authorization header is set, authenticate through middleware
  const authHeader = req.headers.authorization;
  let isAdmin = false;
  let authedCompanyId = '';
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { getAuth, getFirestore: gfs } = await import('../config/firebase.config');
      const token = await getAuth().verifyIdToken(authHeader.slice(7));
      authedCompanyId = (token['companyId'] as string) || '';
      if (!authedCompanyId) {
        const udoc = await gfs().collection('users').doc(token.uid).get();
        authedCompanyId = (udoc.data()?.['companyId'] as string) || '';
      }
      isAdmin = true;
    } catch { /* fallback to email check */ }
  }

  const effectiveCompanyId = isAdmin ? authedCompanyId : companyId;
  if (!effectiveCompanyId || !orderId) {
    res.status(400).send('companyId + orderId required');
    return;
  }

  const { renderInvoicePdf, loadOrderForInvoice, loadCompanyForInvoice } = await import('../services/invoice/invoicePdfService');
  const order = await loadOrderForInvoice(effectiveCompanyId, orderId);
  if (!order) { res.status(404).send('Order not found'); return; }

  if (!isAdmin) {
    // Require email to match
    if (!email || email !== (order.clientEmail ?? '').toLowerCase().trim()) {
      res.status(401).send('Unauthorized');
      return;
    }
  }

  const company = await loadCompanyForInvoice(effectiveCompanyId);
  const pdf = await renderInvoicePdf(company, order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="facture-${orderId}.pdf"`);
  res.end(pdf);
}));

router.use(authMiddleware);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Unauthorized', 401);
  const { status } = req.query as Record<string, string | undefined>;
  const db = getFirestore();
  let q: FirebaseFirestore.Query = db.collection(`companies/${companyId}/orders`);
  if (status) q = q.where('status', '==', status);
  const snap = await q.limit(500).get().catch(async () => await db.collection(`companies/${companyId}/orders`).limit(500).get());
  const items: Array<Record<string, unknown>> = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => {
    const ca = a['createdAt'] as { seconds?: number } | Date | undefined;
    const cb = b['createdAt'] as { seconds?: number } | Date | undefined;
    const ta = ca instanceof Date ? ca.getTime() : (ca?.seconds ?? 0) * 1000;
    const tb = cb instanceof Date ? cb.getTime() : (cb?.seconds ?? 0) * 1000;
    return tb - ta;
  });
  res.json({ success: true, data: items });
}));

// PATCH /api/orders/:id — action: mark-paid | fulfill | cancel | refund | send-payment-link
router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Unauthorized', 401);
  const { id } = req.params;
  const { action, notes, paymentMethod } = req.body as { action?: string; notes?: string; paymentMethod?: string };
  if (!action || !['mark-paid', 'fulfill', 'cancel', 'refund', 'send-payment-link'].includes(action)) {
    throw new AppError('Invalid action', 400);
  }

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/orders`).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Order not found', 404);
  const data = doc.data() ?? {};

  const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy: userId };

  if (action === 'mark-paid') {
    if (data['status'] !== 'paid') {
      updates['status'] = 'paid';
      updates['paidAt'] = new Date();
      if (paymentMethod) updates['paymentMethod'] = paymentMethod;
      if (notes) updates['paymentNotes'] = notes;
      // Decrement stock on manual mark-paid too
      await decrementStock(companyId, data);
      sendInvoiceEmail(companyId, id).catch(() => {});
    }
  } else if (action === 'fulfill') {
    updates['status'] = 'fulfilled';
    updates['fulfilledAt'] = new Date();
  } else if (action === 'cancel') {
    updates['status'] = 'cancelled';
    updates['cancelledAt'] = new Date();
    if (notes) updates['cancelReason'] = notes;
  } else if (action === 'refund') {
    updates['status'] = 'refunded';
    updates['refundedAt'] = new Date();
  } else if (action === 'send-payment-link') {
    // Send the client the payment URL via email (if email) + log
    const email = data['clientEmail'] as string;
    const paymentUrl = data['paymentUrl'] as string;
    if (!paymentUrl) throw new AppError('No payment URL on this order', 400);
    if (email) {
      try {
        const { sendEmail } = await import('../services/email/emailService');
        await sendEmail({
          to: email,
          subject: `Lien de paiement — Commande ${id}`,
          html: `<p>Bonjour ${data['clientName'] ?? 'client'},</p><p>Voici le lien de paiement pour votre commande: <a href="${paymentUrl}">${paymentUrl}</a></p><p>Montant: ${data['subtotal']} ${data['currency']}</p>`,
          companyId,
          tags: [{ name: 'type', value: 'order-payment-link' }],
        });
      } catch (err) { logger.warn('[Orders] send-payment-link email failed', { err: String(err) }); }
    }
    updates['paymentLinkSentAt'] = new Date();
  }

  await ref.update(updates);
  res.json({ success: true, data: { id, ...((await ref.get()).data()) } });
}));

export default router;
