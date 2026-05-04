"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLONE_COMMERCE_TOOL_NAMES = exports.CLONE_COMMERCE_TOOLS = exports.cloneCancelOrderTool = exports.cloneFindOrderTool = exports.cloneGeneratePaymentLinkTool = exports.cloneCreateOrderDraftTool = exports.cloneFindProductTool = exports.cloneListProductsTool = void 0;
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
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const helpers_1 = require("../../utils/helpers");
const logger_1 = require("../../utils/logger");
function normalizePhone(p) { return (p ?? '').replace(/[^0-9+]/g, ''); }
function normalizeEmail(e) { return (e ?? '').toLowerCase().trim(); }
async function audit(companyId, action, details) {
    try {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/cloneAuditLog`).add({
            action, details, createdAt: new Date(),
        });
    }
    catch { /* non-critical */ }
}
async function loadCompanyCurrency(companyId) {
    try {
        const doc = await (0, firebase_config_1.getFirestore)().collection('companies').doc(companyId).get();
        const s = (doc.data()?.['settings'] ?? {});
        return s['currency'] || 'XOF';
    }
    catch {
        return 'XOF';
    }
}
// ── listProducts ─────────────────────────────────────────────────────────────
exports.cloneListProductsTool = genkit_config_1.ai.defineTool({
    name: 'listProducts',
    description: "List the company's products. Optionally filter by category or free-text search. Use when the user asks 'what do you sell?' or 'show me the menu' or 'do you have X?'.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        category: zod_1.z.string().optional(),
        search: zod_1.z.string().optional().describe('Fuzzy match on name'),
    }),
    outputSchema: zod_1.z.object({
        products: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), name: zod_1.z.string(), price: zod_1.z.number(), currency: zod_1.z.string(),
            stock: zod_1.z.number().nullable().optional(), category: zod_1.z.string().optional(), description: zod_1.z.string().optional(),
        })),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        let q = db.collection(`companies/${input.companyId}/products`).where('active', '==', true);
        if (input.category)
            q = q.where('category', '==', input.category);
        const snap = await q.limit(100).get().catch(async () => await db.collection(`companies/${input.companyId}/products`).limit(100).get());
        let products = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data['name'] ?? '',
                price: Number(data['price'] ?? 0),
                currency: data['currency'] ?? 'XOF',
                stock: data['stock'] ?? null,
                category: data['category'] ?? '',
                description: data['description'] ?? '',
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
    }
    catch (err) {
        logger_1.logger.error('[CommerceTools] listProducts failed', { err: String(err) });
        return { products: [], message: 'Erreur.' };
    }
});
// ── findProduct ──────────────────────────────────────────────────────────────
exports.cloneFindProductTool = genkit_config_1.ai.defineTool({
    name: 'findProduct',
    description: "Find a specific product by exact or partial name. Returns the best match with price.",
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), name: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(),
        productId: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        price: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        stock: zod_1.z.number().nullable().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection(`companies/${input.companyId}/products`).where('active', '==', true).get().catch(async () => await db.collection(`companies/${input.companyId}/products`).get());
        const needle = input.name.toLowerCase().trim();
        const match = snap.docs
            .map(d => ({ id: d.id, data: d.data() }))
            .find(p => (p.data['name'] ?? '').toLowerCase().includes(needle));
        if (!match)
            return { found: false, message: `Produit "${input.name}" introuvable.` };
        return {
            found: true,
            productId: match.id,
            name: match.data['name'],
            price: Number(match.data['price'] ?? 0),
            currency: match.data['currency'] ?? 'XOF',
            stock: match.data['stock'] ?? null,
            message: `${match.data['name']} — ${match.data['price']} ${match.data['currency']}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[CommerceTools] findProduct failed', { err: String(err) });
        return { found: false, message: 'Erreur.' };
    }
});
// ── createOrderDraft ─────────────────────────────────────────────────────────
exports.cloneCreateOrderDraftTool = genkit_config_1.ai.defineTool({
    name: 'createOrderDraft',
    description: "Create an order DRAFT (status='pending_payment'). Call only after the client has confirmed the items + quantities. The draft captures the order — a payment link can then be generated with generatePaymentLink. Products are validated server-side (price + existence).",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        clientName: zod_1.z.string(),
        clientPhone: zod_1.z.string().optional(),
        clientEmail: zod_1.z.string().optional(),
        items: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string(),
            quantity: zod_1.z.number().min(1).default(1),
        })).min(1),
        notes: zod_1.z.string().optional(),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        orderId: zod_1.z.string().optional(),
        subtotal: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        itemsResolved: zod_1.z.array(zod_1.z.object({
            productId: zod_1.z.string(), name: zod_1.z.string(), quantity: zod_1.z.number(), unitPrice: zod_1.z.number(),
        })).optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    if (!input.clientName?.trim())
        return { success: false, message: 'Nom du client requis.' };
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email)
        return { success: false, message: 'Téléphone ou email requis.' };
    try {
        const db = (0, firebase_config_1.getFirestore)();
        // Resolve each product server-side
        const resolved = [];
        let currency = await loadCompanyCurrency(input.companyId);
        for (const item of input.items) {
            const pdoc = await db.collection(`companies/${input.companyId}/products`).doc(item.productId).get();
            if (!pdoc.exists)
                return { success: false, message: `Produit introuvable (${item.productId}).` };
            const p = pdoc.data() ?? {};
            if (p['active'] === false)
                return { success: false, message: `Produit "${p['name']}" indisponible.` };
            const unitPrice = Number(p['price'] ?? 0);
            currency = p['currency'] ?? currency;
            resolved.push({
                productId: item.productId,
                name: p['name'] ?? '',
                quantity: item.quantity,
                unitPrice,
                currency,
            });
        }
        const subtotal = resolved.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
        const orderId = (0, helpers_1.generateId)();
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
                const { createNotification } = await Promise.resolve().then(() => __importStar(require('../../services/notificationService')));
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
            }
            catch { /* non-critical */ }
        })().catch(() => { });
        return {
            success: true,
            orderId,
            subtotal,
            currency,
            itemsResolved: resolved,
            message: `Commande enregistrée. Total: ${subtotal} ${currency}. Utilisez generatePaymentLink pour obtenir le lien de paiement.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[CommerceTools] createOrderDraft failed', { err: String(err) });
        return { success: false, message: "Impossible de créer la commande." };
    }
});
// ── generatePaymentLink ──────────────────────────────────────────────────────
exports.cloneGeneratePaymentLinkTool = genkit_config_1.ai.defineTool({
    name: 'generatePaymentLink',
    description: "Generate a payment link for an existing order (status='pending_payment'). Supports Stripe, PayPal, Wave. Returns the URL the client should open to pay. The payment capture is handled by webhook — the Clone must NOT mark the order paid itself.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        orderId: zod_1.z.string(),
        method: zod_1.z.enum(['stripe', 'paypal', 'wave', 'manual']).optional().describe("Preferred method; defaults to whatever is configured"),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        paymentUrl: zod_1.z.string().optional(),
        method: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(`companies/${input.companyId}/orders`).doc(input.orderId);
        const doc = await ref.get();
        if (!doc.exists)
            return { success: false, message: 'Commande introuvable.' };
        const order = doc.data() ?? {};
        if (order['status'] !== 'pending_payment') {
            return { success: false, message: `Commande au statut "${order['status']}" — paiement impossible.` };
        }
        const subtotal = Number(order['subtotal'] ?? 0);
        const currency = order['currency'] ?? 'XOF';
        if (subtotal <= 0)
            return { success: false, message: 'Total invalide.' };
        // Read company payment config
        const companyDoc = await db.collection('companies').doc(input.companyId).get();
        const settings = (companyDoc.data()?.['settings'] ?? {});
        const waveRecipient = settings['wavePhone'] || '';
        const manualEmail = settings['manualPaymentEmail'] || '';
        const method = input.method ?? (waveRecipient ? 'wave' : 'manual');
        let paymentUrl = '';
        if (method === 'wave' && waveRecipient) {
            paymentUrl = `https://pay.wave.com/m/${encodeURIComponent(waveRecipient)}?amount=${subtotal}&currency=${currency}&description=${encodeURIComponent(`Commande ${input.orderId}`)}`;
        }
        else if (method === 'stripe') {
            // Real Stripe Checkout Session — webhook will auto-confirm
            const STRIPE_SECRET = process.env['STRIPE_SECRET_KEY'];
            if (!STRIPE_SECRET) {
                return { success: false, message: 'Stripe non configuré côté plateforme.' };
            }
            try {
                const Stripe = (await Promise.resolve().then(() => __importStar(require('stripe')))).default;
                const stripeClient = new Stripe(STRIPE_SECRET);
                const items = order['items'] ?? [];
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
            }
            catch (err) {
                return { success: false, message: `Stripe a échoué: ${String(err)}` };
            }
        }
        else if (method === 'paypal') {
            // Placeholder — fall back to manual instruction page
            const base2 = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';
            paymentUrl = `${base2}/order/${input.companyId}/${input.orderId}`;
        }
        else {
            // Manual: return URL with order details (client calls back)
            const base2 = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';
            paymentUrl = `${base2}/order/${input.companyId}/${input.orderId}`;
        }
        await ref.update({ paymentUrl, paymentMethod: method, paymentLinkGeneratedAt: new Date() });
        await audit(input.companyId, 'generatePaymentLink', { orderId: input.orderId, method, subtotal, currency });
        // Email the payment link if we have email
        const email = order['clientEmail'];
        if (email) {
            (async () => {
                try {
                    const { sendEmail: sendMail } = await Promise.resolve().then(() => __importStar(require('../../services/email/emailService')));
                    await sendMail({
                        to: email,
                        subject: `Lien de paiement — Commande ${input.orderId}`,
                        html: `<p>Bonjour ${order['clientName'] ?? ''},</p><p>Pour finaliser votre commande de ${subtotal} ${currency}, cliquez sur ce lien:</p><p><a href="${paymentUrl}">${paymentUrl}</a></p><p>Référence: ${input.orderId}</p>`,
                        companyId: input.companyId,
                        tags: [{ name: 'type', value: 'payment-link' }],
                    });
                }
                catch { /* non-critical */ }
            })().catch(() => { });
        }
        return {
            success: true,
            paymentUrl,
            method,
            message: `Lien de paiement envoyé${email ? ` à ${email}` : ''}. Montant: ${subtotal} ${currency}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[CommerceTools] generatePaymentLink failed', { err: String(err) });
        return { success: false, message: 'Impossible de générer le lien.' };
    }
});
// ── findOrder ────────────────────────────────────────────────────────────────
exports.cloneFindOrderTool = genkit_config_1.ai.defineTool({
    name: 'findOrder',
    description: "Find a recent order by the client contact. Returns the latest order and its status.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        clientPhone: zod_1.z.string().optional(),
        clientEmail: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(),
        orderId: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        subtotal: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        paymentUrl: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email)
        return { found: false, message: 'Téléphone ou email requis.' };
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const coll = db.collection(`companies/${input.companyId}/orders`);
        const snap = phone
            ? await coll.where('clientPhone', '==', phone).limit(5).get()
            : await coll.where('clientEmail', '==', email).limit(5).get();
        if (snap.empty)
            return { found: false, message: 'Aucune commande trouvée.' };
        const doc = snap.docs[0].data();
        return {
            found: true,
            orderId: snap.docs[0].id,
            status: doc['status'],
            subtotal: Number(doc['subtotal'] ?? 0),
            currency: doc['currency'] ?? 'XOF',
            paymentUrl: doc['paymentUrl'] ?? undefined,
            message: `Commande ${snap.docs[0].id}: ${doc['status']} — ${doc['subtotal']} ${doc['currency']}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[CommerceTools] findOrder failed', { err: String(err) });
        return { found: false, message: 'Erreur.' };
    }
});
// ── cancelOrder (identity-gated, draft/pending only) ─────────────────────────
exports.cloneCancelOrderTool = genkit_config_1.ai.defineTool({
    name: 'cancelOrder',
    description: "Cancel an order that has not been paid yet. Requires identity proof (phone or email that matches the record).",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        orderId: zod_1.z.string(),
        clientPhone: zod_1.z.string().optional(),
        clientEmail: zod_1.z.string().optional(),
        reason: zod_1.z.string().optional(),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string(), requiresHuman: zod_1.z.boolean().optional() }),
}, async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email)
        return { success: false, requiresHuman: true, message: 'Téléphone ou email requis.' };
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(`companies/${input.companyId}/orders`).doc(input.orderId);
        const doc = await ref.get();
        if (!doc.exists)
            return { success: false, message: 'Commande introuvable.' };
        const data = doc.data() ?? {};
        const storedPhone = normalizePhone(data['clientPhone'] ?? '');
        const storedEmail = normalizeEmail(data['clientEmail'] ?? '');
        if (!((phone && phone === storedPhone) || (email && email === storedEmail))) {
            await audit(input.companyId, 'cancelOrder.identityFailed', { orderId: input.orderId });
            return { success: false, requiresHuman: true, message: "Vérification impossible. Un agent vous recontactera." };
        }
        const status = data['status'] ?? 'pending_payment';
        if (status === 'paid' || status === 'fulfilled') {
            return { success: false, requiresHuman: true, message: "Commande déjà payée — un agent va traiter le remboursement." };
        }
        await ref.update({ status: 'cancelled', cancelledAt: new Date(), cancelReason: input.reason ?? '' });
        await audit(input.companyId, 'cancelOrder', { orderId: input.orderId, reason: input.reason });
        return { success: true, message: 'Commande annulée.' };
    }
    catch (err) {
        logger_1.logger.error('[CommerceTools] cancelOrder failed', { err: String(err) });
        return { success: false, requiresHuman: true, message: "Impossible d'annuler. Un agent va vous recontacter." };
    }
});
exports.CLONE_COMMERCE_TOOLS = [
    exports.cloneListProductsTool,
    exports.cloneFindProductTool,
    exports.cloneCreateOrderDraftTool,
    exports.cloneGeneratePaymentLinkTool,
    exports.cloneFindOrderTool,
    exports.cloneCancelOrderTool,
];
exports.CLONE_COMMERCE_TOOL_NAMES = [
    'listProducts', 'findProduct', 'createOrderDraft', 'generatePaymentLink', 'findOrder', 'cancelOrder',
];
//# sourceMappingURL=commerceTools.js.map