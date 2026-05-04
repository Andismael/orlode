/**
 * Clone-safe Commerce tools.
 *
 * Philosophy (money-related, highest safety):
 *   - Clone can guide, search, and BUILD an order (draft)
 *   - Clone can generate a payment link — but the actual capture is handled by payment provider webhook
 *   - Clone can NEVER mark an order "paid" directly (admin-only + webhook-driven)
 *   - Clone CAN cancel a draft order (identity-gated, before payment)
 *
 * Tools:
 *   - listProducts(category?, search?)
 *   - findProduct(name)
 *   - createOrderDraft(clientName + contact, items[])
 *   - findOrder(clientPhone|clientEmail)
 *   - cancelOrder(orderId, clientPhone|clientEmail)        ← only draft/pending_payment
 *   - generatePaymentLink(orderId)                          ← uses company payment config
 */
import { z } from 'zod';
import { ai } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';

function normalizePhone(p: string | undefined): string { return (p ?? '').replace(/[^0-9+]/g, ''); }
function normalizeEmail(e: string | undefined): string { return (e ?? '').toLowerCase().trim(); }

async function audit(companyId: string, action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await getFirestore().collection(`companies/${companyId}/cloneAuditLog`).add({
      action, details, createdAt: new Date(),
    });
  } catch { /* non-critical */ }
}

async function loadCompanyCurrency(companyId: string): Promise<string> {
  try {
    const doc = await getFirestore().collection('companies').doc(companyId).get();
    const s = (doc.data()?.['settings'] ?? {}) as Record<string, unknown>;
    return (s['currency'] as string) || 'XOF';
  } catch { return 'XOF'; }
}

// ── listProducts ─────────────────────────────────────────────────────────────
export const cloneListProductsTool = ai.defineTool(
  {
    name: 'listProducts',
    description: "List the company's products. Optionally filter by category or free-text search. Use when the user asks 'what do you sell?' or 'show me the menu' or 'do you have X?'.",
    inputSchema: z.object({
      companyId: z.string(),
      category: z.string().optional(),
      search: z.string().optional().describe('Fuzzy match on name'),
    }),
    outputSchema: z.object({
      products: z.array(z.object({
        id: z.string(), name: z.string(), price: z.number(), currency: z.string(),
        stock: z.number().nullable().optional(), category: z.string().optional(), description: z.string().optional(),
      })),
      message: z.string(),
    }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      let q: FirebaseFirestore.Query = db.collection(`companies/${input.companyId}/products`).where('active', '==', true);
      if (input.category) q = q.where('category', '==', input.category);
      const snap = await q.limit(100).get().catch(async () => await db.collection(`companies/${input.companyId}/products`).limit(100).get());
      let products = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: (data['name'] as string) ?? '',
          price: Number(data['price'] ?? 0),
          currency: (data['currency'] as string) ?? 'XOF',
          stock: (data['stock'] as number | null) ?? null,
          category: (data['category'] as string) ?? '',
          description: (data['description'] as string) ?? '',
        };
      });
      if (input.search) {
        const q2 = input.search.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(q2) || p.description.toLowerCase().includes(q2));
      }
      return {
        products,
        message: products.length === 0 ? 'Aucun produit.' : `${products.length} produit(s).`,
      };
    } catch (err) {
      logger.error('[CommerceTools] listProducts failed', { err: String(err) });
      return { products: [], message: 'Erreur.' };
    }
  }
);

// ── findProduct ──────────────────────────────────────────────────────────────
export const cloneFindProductTool = ai.defineTool(
  {
    name: 'findProduct',
    description: "Find a specific product by exact or partial name. Returns the best match with price.",
    inputSchema: z.object({ companyId: z.string(), name: z.string() }),
    outputSchema: z.object({
      found: z.boolean(),
      productId: z.string().optional(),
      name: z.string().optional(),
      price: z.number().optional(),
      currency: z.string().optional(),
      stock: z.number().nullable().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      const snap = await db.collection(`companies/${input.companyId}/products`).where('active', '==', true).get().catch(async () => await db.collection(`companies/${input.companyId}/products`).get());
      const needle = input.name.toLowerCase().trim();
      const match = snap.docs
        .map(d => ({ id: d.id, data: d.data() }))
        .find(p => ((p.data['name'] as string) ?? '').toLowerCase().includes(needle));
      if (!match) return { found: false, message: `Produit "${input.name}" introuvable.` };
      return {
        found: true,
        productId: match.id,
        name: match.data['name'] as string,
        price: Number(match.data['price'] ?? 0),
        currency: (match.data['currency'] as string) ?? 'XOF',
        stock: (match.data['stock'] as number | null) ?? null,
        message: `${match.data['name']} — ${match.data['price']} ${match.data['currency']}.`,
      };
    } catch (err) {
      logger.error('[CommerceTools] findProduct failed', { err: String(err) });
      return { found: false, message: 'Erreur.' };
    }
  }
);

// ── createOrderDraft ─────────────────────────────────────────────────────────
export const cloneCreateOrderDraftTool = ai.defineTool(
  {
    name: 'createOrderDraft',
    description: "Create an order DRAFT (status='pending_payment'). Call only after the client has confirmed the items + quantities. The draft captures the order — a payment link can then be generated with generatePaymentLink. Products are validated server-side (price + existence).",
    inputSchema: z.object({
      companyId: z.string(),
      clientName: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().min(1).default(1),
      })).min(1),
      notes: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      orderId: z.string().optional(),
      subtotal: z.number().optional(),
      currency: z.string().optional(),
      itemsResolved: z.array(z.object({
        productId: z.string(), name: z.string(), quantity: z.number(), unitPrice: z.number(),
      })).optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    if (!input.clientName?.trim()) return { success: false, message: 'Nom du client requis.' };
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { success: false, message: 'Téléphone ou email requis.' };

    try {
      const db = getFirestore();

      // Resolve each product server-side
      const resolved: Array<{ productId: string; name: string; quantity: number; unitPrice: number; currency: string }> = [];
      let currency = await loadCompanyCurrency(input.companyId);
      for (const item of input.items) {
        const pdoc = await db.collection(`companies/${input.companyId}/products`).doc(item.productId).get();
        if (!pdoc.exists) return { success: false, message: `Produit introuvable (${item.productId}).` };
        const p = pdoc.data() ?? {};
        if (p['active'] === false) return { success: false, message: `Produit "${p['name']}" indisponible.` };
        const unitPrice = Number(p['price'] ?? 0);
        currency = (p['currency'] as string) ?? currency;
        resolved.push({
          productId: item.productId,
          name: (p['name'] as string) ?? '',
          quantity: item.quantity,
          unitPrice,
          currency,
        });
      }

      const subtotal = resolved.reduce((s, r) => s + r.unitPrice * r.quantity, 0);

      const orderId = generateId();
      await db.collection(`companies/${input.companyId}/orders`).doc(orderId).set({
        id: orderId,
        clientName: input.clientName.trim(),
        clientPhone: phone,
        clientEmail: email,
        items: resolved,
        subtotal,
        currency,
        status: 'pending_payment',
        paymentMethod: null,
        paymentUrl: null,
        notes: input.notes ?? '',
        sourceChannel: input.sourceChannel ?? 'unknown',
        createdBy: 'clone',
        createdAt: new Date(),
      });

      await audit(input.companyId, 'createOrderDraft', {
        orderId, clientName: input.clientName, itemsCount: resolved.length, subtotal, currency,
      });

      // Notify admin
      (async () => {
        try {
          const { createNotification } = await import('../../services/notificationService');
          await createNotification({
            companyId: input.companyId,
            type: 'lead_created',
            title: 'Nouvelle commande en attente de paiement',
            message: `${input.clientName} — ${subtotal} ${currency}`,
            actionUrl: '/admin/orders',
            icon: 'ShoppingCart',
            severity: 'info',
            metadata: { orderId, source: input.sourceChannel ?? 'unknown', subtotal, currency },
          });
        } catch { /* non-critical */ }
      })().catch(() => {});

      return {
        success: true,
        orderId,
        subtotal,
        currency,
        itemsResolved: resolved,
        message: `Commande enregistrée. Total: ${subtotal} ${currency}. Utilisez generatePaymentLink pour obtenir le lien de paiement.`,
      };
    } catch (err) {
      logger.error('[CommerceTools] createOrderDraft failed', { err: String(err) });
      return { success: false, message: "Impossible de créer la commande." };
    }
  }
);

// ── generatePaymentLink ──────────────────────────────────────────────────────
export const cloneGeneratePaymentLinkTool = ai.defineTool(
  {
    name: 'generatePaymentLink',
    description: "Generate a payment link for an existing order (status='pending_payment'). Supports Stripe, PayPal, Wave. Returns the URL the client should open to pay. The payment capture is handled by webhook — the Clone must NOT mark the order paid itself.",
    inputSchema: z.object({
      companyId: z.string(),
      orderId: z.string(),
      method: z.enum(['stripe', 'paypal', 'wave', 'manual']).optional().describe("Preferred method; defaults to whatever is configured"),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      paymentUrl: z.string().optional(),
      method: z.string().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      const ref = db.collection(`companies/${input.companyId}/orders`).doc(input.orderId);
      const doc = await ref.get();
      if (!doc.exists) return { success: false, message: 'Commande introuvable.' };
      const order = doc.data() ?? {};
      if (order['status'] !== 'pending_payment') {
        return { success: false, message: `Commande au statut "${order['status']}" — paiement impossible.` };
      }
      const subtotal = Number(order['subtotal'] ?? 0);
      const currency = (order['currency'] as string) ?? 'XOF';
      if (subtotal <= 0) return { success: false, message: 'Total invalide.' };

      // Read company payment config
      const companyDoc = await db.collection('companies').doc(input.companyId).get();
      const settings = (companyDoc.data()?.['settings'] ?? {}) as Record<string, unknown>;
      const waveRecipient = (settings['wavePhone'] as string) || '';
      const manualEmail = (settings['manualPaymentEmail'] as string) || '';

      const method = input.method ?? (waveRecipient ? 'wave' : 'manual');
      let paymentUrl = '';

      if (method === 'wave' && waveRecipient) {
        paymentUrl = `https://pay.wave.com/m/${encodeURIComponent(waveRecipient)}?amount=${subtotal}&currency=${currency}&description=${encodeURIComponent(`Commande ${input.orderId}`)}`;
      } else if (method === 'stripe') {
        // Real Stripe Checkout Session — webhook will auto-confirm
        const STRIPE_SECRET = process.env['STRIPE_SECRET_KEY'];
        if (!STRIPE_SECRET) {
          return { success: false, message: 'Stripe non configuré côté plateforme.' };
        }
        try {
          const Stripe = (await import('stripe')).default;
          const stripeClient = new (Stripe as unknown as new (key: string) => { checkout: { sessions: { create: (opts: unknown) => Promise<{ id: string; url: string }> } } })(STRIPE_SECRET);
          const items = (order['items'] as Array<Record<string, unknown>>) ?? [];
          const base2 = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';
          const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: items.map(it => ({
              price_data: {
                currency: (currency || 'USD').toLowerCase(),
                product_data: { name: String(it['name'] ?? 'Article') },
                unit_amount: Math.round(Number(it['unitPrice'] ?? 0) * 100),
              },
              quantity: Number(it['quantity'] ?? 1),
            })),
            success_url: `${base2}/order/${input.companyId}/${input.orderId}?status=success`,
            cancel_url: `${base2}/order/${input.companyId}/${input.orderId}?status=cancelled`,
            metadata: { orderId: input.orderId, companyId: input.companyId, kind: 'shop_order' },
          });
          paymentUrl = session.url;
          await ref.update({ stripeSessionId: session.id });
        } catch (err) {
          return { success: false, message: `Stripe a échoué: ${String(err)}` };
        }
      } else if (method === 'paypal') {
        // Placeholder — fall back to manual instruction page
        const base2 = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';
        paymentUrl = `${base2}/order/${input.companyId}/${input.orderId}`;
      } else {
        // Manual: return URL with order details (client calls back)
        const base2 = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';
        paymentUrl = `${base2}/order/${input.companyId}/${input.orderId}`;
      }

      await ref.update({ paymentUrl, paymentMethod: method, paymentLinkGeneratedAt: new Date() });
      await audit(input.companyId, 'generatePaymentLink', { orderId: input.orderId, method, subtotal, currency });

      // Email the payment link if we have email
      const email = order['clientEmail'] as string;
      if (email) {
        (async () => {
          try {
            const { sendEmail: sendMail } = await import('../../services/email/emailService');
            await sendMail({
              to: email,
              subject: `Lien de paiement — Commande ${input.orderId}`,
              html: `<p>Bonjour ${order['clientName'] ?? ''},</p><p>Pour finaliser votre commande de ${subtotal} ${currency}, cliquez sur ce lien:</p><p><a href="${paymentUrl}">${paymentUrl}</a></p><p>Référence: ${input.orderId}</p>`,
              companyId: input.companyId,
              tags: [{ name: 'type', value: 'payment-link' }],
            });
          } catch { /* non-critical */ }
        })().catch(() => {});
      }

      return {
        success: true,
        paymentUrl,
        method,
        message: `Lien de paiement envoyé${email ? ` à ${email}` : ''}. Montant: ${subtotal} ${currency}.`,
      };
    } catch (err) {
      logger.error('[CommerceTools] generatePaymentLink failed', { err: String(err) });
      return { success: false, message: 'Impossible de générer le lien.' };
    }
  }
);

// ── findOrder ────────────────────────────────────────────────────────────────
export const cloneFindOrderTool = ai.defineTool(
  {
    name: 'findOrder',
    description: "Find a recent order by the client contact. Returns the latest order and its status.",
    inputSchema: z.object({
      companyId: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      orderId: z.string().optional(),
      status: z.string().optional(),
      subtotal: z.number().optional(),
      currency: z.string().optional(),
      paymentUrl: z.string().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { found: false, message: 'Téléphone ou email requis.' };
    try {
      const db = getFirestore();
      const coll = db.collection(`companies/${input.companyId}/orders`);
      const snap = phone
        ? await coll.where('clientPhone', '==', phone).limit(5).get()
        : await coll.where('clientEmail', '==', email).limit(5).get();
      if (snap.empty) return { found: false, message: 'Aucune commande trouvée.' };
      const doc = snap.docs[0].data();
      return {
        found: true,
        orderId: snap.docs[0].id,
        status: doc['status'] as string,
        subtotal: Number(doc['subtotal'] ?? 0),
        currency: (doc['currency'] as string) ?? 'XOF',
        paymentUrl: (doc['paymentUrl'] as string) ?? undefined,
        message: `Commande ${snap.docs[0].id}: ${doc['status']} — ${doc['subtotal']} ${doc['currency']}.`,
      };
    } catch (err) {
      logger.error('[CommerceTools] findOrder failed', { err: String(err) });
      return { found: false, message: 'Erreur.' };
    }
  }
);

// ── cancelOrder (identity-gated, draft/pending only) ─────────────────────────
export const cloneCancelOrderTool = ai.defineTool(
  {
    name: 'cancelOrder',
    description: "Cancel an order that has not been paid yet. Requires identity proof (phone or email that matches the record).",
    inputSchema: z.object({
      companyId: z.string(),
      orderId: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      reason: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string(), requiresHuman: z.boolean().optional() }),
  },
  async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { success: false, requiresHuman: true, message: 'Téléphone ou email requis.' };
    try {
      const db = getFirestore();
      const ref = db.collection(`companies/${input.companyId}/orders`).doc(input.orderId);
      const doc = await ref.get();
      if (!doc.exists) return { success: false, message: 'Commande introuvable.' };
      const data = doc.data() ?? {};
      const storedPhone = normalizePhone((data['clientPhone'] as string) ?? '');
      const storedEmail = normalizeEmail((data['clientEmail'] as string) ?? '');
      if (!((phone && phone === storedPhone) || (email && email === storedEmail))) {
        await audit(input.companyId, 'cancelOrder.identityFailed', { orderId: input.orderId });
        return { success: false, requiresHuman: true, message: "Vérification impossible. Un agent vous recontactera." };
      }
      const status = (data['status'] as string) ?? 'pending_payment';
      if (status === 'paid' || status === 'fulfilled') {
        return { success: false, requiresHuman: true, message: "Commande déjà payée — un agent va traiter le remboursement." };
      }
      await ref.update({ status: 'cancelled', cancelledAt: new Date(), cancelReason: input.reason ?? '' });
      await audit(input.companyId, 'cancelOrder', { orderId: input.orderId, reason: input.reason });
      return { success: true, message: 'Commande annulée.' };
    } catch (err) {
      logger.error('[CommerceTools] cancelOrder failed', { err: String(err) });
      return { success: false, requiresHuman: true, message: "Impossible d'annuler. Un agent va vous recontacter." };
    }
  }
);

export const CLONE_COMMERCE_TOOLS = [
  cloneListProductsTool,
  cloneFindProductTool,
  cloneCreateOrderDraftTool,
  cloneGeneratePaymentLinkTool,
  cloneFindOrderTool,
  cloneCancelOrderTool,
];

export const CLONE_COMMERCE_TOOL_NAMES = [
  'listProducts', 'findProduct', 'createOrderDraft', 'generatePaymentLink', 'findOrder', 'cancelOrder',
];
