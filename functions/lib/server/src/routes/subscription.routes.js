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
/**
 * Subscription routes — plan selection, agent picker, Wave payment
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const helpers_1 = require("../utils/helpers");
const agentCatalog_1 = require("../config/agentCatalog");
const exchangeRateService_1 = require("../services/exchangeRateService");
const paypalService_1 = require("../services/billing/paypalService");
const emailService_1 = require("../services/email/emailService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// ─── PUBLIC: Exchange rates ──────────────────────────────────────────────────
// GET /api/subscription/rates — live exchange rates (base USD)
router.get('/rates', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const rates = await (0, exchangeRateService_1.getExchangeRates)();
    res.json({ success: true, data: rates });
}));
// ─── PUBLIC: Catalog ─────────────────────────────────────────────────────────
// GET /api/subscription/catalog — full agent catalog with skills
router.get('/catalog', (_req, res) => {
    res.json({ success: true, data: { agents: agentCatalog_1.AGENT_CATALOG, plans: agentCatalog_1.PLAN_AGENT_LIMITS } });
});
// GET /api/subscription/plans — plan details with limits
router.get('/plans', (_req, res) => {
    res.json({ success: true, data: agentCatalog_1.PLAN_AGENT_LIMITS });
});
// POST /api/subscription/paypal/webhook — PayPal webhook (no auth, verified via signature)
router.post('/paypal/webhook', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const event = req.body;
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }
    const valid = await paypalService_1.paypalService.verifyWebhook(headers, event);
    if (!valid) {
        res.status(401).send('Invalid signature');
        return;
    }
    switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
            await paypalService_1.paypalService.handleCaptureCompleted(event);
            break;
        case 'PAYMENT.CAPTURE.PENDING':
            await paypalService_1.paypalService.handleCapturePending(event);
            break;
        case 'PAYMENT.CAPTURE.DENIED':
            await paypalService_1.paypalService.handleCaptureDenied(event);
            break;
    }
    res.status(200).send('OK');
}));
// GET /api/subscription/available/:plan — agents available for a plan
router.get('/available/:plan', (req, res) => {
    const plan = (0, agentCatalog_1.resolvePlan)(req.params.plan);
    const agents = (0, agentCatalog_1.getAvailableAgents)(plan);
    const limits = agentCatalog_1.PLAN_AGENT_LIMITS[plan];
    res.json({ success: true, data: { agents, limits } });
});
// ─── PROTECTED: Selection & Activation ───────────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
// GET /api/subscription/my-agents — current company's selected agents
router.get('/my-agents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('companies').doc(companyId).get();
    const data = doc.data() ?? {};
    res.json({
        success: true,
        data: {
            plan: data['plan'] ?? 'free',
            selectedAgents: data['selectedAgents'] ?? [],
            totalSkills: (0, agentCatalog_1.countSkills)(data['selectedAgents'] ?? []),
            activatedAt: data['agentsActivatedAt'] ?? null,
        },
    });
}));
// POST /api/subscription/select-agents — choose agents for your plan
router.post('/select-agents', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { agentIds } = req.body;
    if (!agentIds || !Array.isArray(agentIds))
        throw new error_middleware_1.AppError('agentIds required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const plan = (0, agentCatalog_1.resolvePlan)(companyDoc.data()?.['plan'] ?? 'free');
    const limits = agentCatalog_1.PLAN_AGENT_LIMITS[plan];
    if (!limits)
        throw new error_middleware_1.AppError('Invalid plan', 400);
    // Validate agent count
    if (agentIds.length > limits.maxAgents) {
        throw new error_middleware_1.AppError(`Your plan allows max ${limits.maxAgents} agents. You selected ${agentIds.length}.`, 400);
    }
    // Validate agents are available for this plan
    const available = (0, agentCatalog_1.getAvailableAgents)(plan);
    const availableIds = new Set(available.map(a => a.id));
    const invalid = agentIds.filter(id => !availableIds.has(id));
    if (invalid.length > 0) {
        throw new error_middleware_1.AppError(`Agents not available for your plan: ${invalid.join(', ')}`, 400);
    }
    // Validate skill count
    const totalSkills = (0, agentCatalog_1.countSkills)(agentIds);
    if (totalSkills > limits.maxSkills) {
        throw new error_middleware_1.AppError(`Your plan allows max ${limits.maxSkills} skills. Selected agents have ${totalSkills}.`, 400);
    }
    // Save selection — use set+merge so the doc is created if it doesn't exist yet
    // (can happen when a user signs up faster than the onboarding writes the company doc).
    await db.collection('companies').doc(companyId).set({
        id: companyId,
        plan: companyDoc.data()?.['plan'] ?? plan,
        selectedAgents: agentIds,
        totalSkills,
        agentsActivatedAt: new Date(),
        updatedAt: new Date(),
        ...(companyDoc.exists ? {} : { name: 'Mon Entreprise', createdAt: new Date(), ownerId: req.user?.uid }),
    }, { merge: true });
    // Also update tenant config enabled agents
    const tenantDoc = await db.collection('tenants').doc(companyId).get();
    if (tenantDoc.exists) {
        await db.collection('tenants').doc(companyId).update({
            'agents.enabled': agentIds,
            'agents.maxAgents': limits.maxAgents,
        });
    }
    res.json({ success: true, data: { selectedAgents: agentIds, totalSkills } });
}));
// ─── WAVE PAYMENT ────────────────────────────────────────────────────────────
// POST /api/subscription/wave/checkout — create Wave payment
router.post('/wave/checkout', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { planId, interval, agentIds } = req.body;
    if (!planId)
        throw new error_middleware_1.AppError('planId required', 400);
    const resolvedPlan = (0, agentCatalog_1.resolvePlan)(planId);
    const limits = agentCatalog_1.PLAN_AGENT_LIMITS[resolvedPlan];
    if (!limits)
        throw new error_middleware_1.AppError('Invalid plan', 400);
    let amount = limits.price;
    if (interval === 'yearly')
        amount = amount * 12 * 0.8; // -20%
    // Convert USD to XOF (approx rate)
    const XOF_RATE = 600;
    const amountXOF = Math.round(amount * XOF_RATE);
    const paymentId = (0, helpers_1.generateId)();
    // Create pending payment record
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('payments').doc(paymentId).set({
        companyId,
        planId,
        interval: interval ?? 'monthly',
        agentIds: agentIds ?? [],
        amountUSD: amount,
        amountXOF,
        currency: 'XOF',
        method: 'wave',
        status: 'pending',
        createdAt: new Date(),
    });
    // Call Wave API to create checkout
    const WAVE_API_KEY = process.env['WAVE_API_KEY'];
    if (!WAVE_API_KEY) {
        // Return manual payment info if no Wave API key
        return res.json({
            success: true,
            data: {
                paymentId,
                method: 'wave_manual',
                amountXOF,
                amountUSD: amount,
                instructions: `Envoyez ${amountXOF} FCFA via Wave au numero du service. Reference: ${paymentId}`,
            },
        });
    }
    try {
        const waveRes = await fetch('https://api.wave.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WAVE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: String(amountXOF),
                currency: 'XOF',
                error_url: `${process.env['CORS_ORIGIN'] ?? 'https://orlode.com'}/admin/billing?status=error`,
                success_url: `${process.env['CORS_ORIGIN'] ?? 'https://orlode.com'}/admin/billing?status=success&payment=${paymentId}`,
                client_reference: paymentId,
            }),
        });
        const waveData = await waveRes.json();
        await db.collection('payments').doc(paymentId).update({
            waveSessionId: waveData.id ?? null,
            waveCheckoutUrl: waveData.wave_launch_url ?? null,
        });
        res.json({
            success: true,
            data: {
                paymentId,
                method: 'wave',
                checkoutUrl: waveData.wave_launch_url,
                amountXOF,
                amountUSD: amount,
            },
        });
    }
    catch (err) {
        res.json({
            success: true,
            data: {
                paymentId,
                method: 'wave_manual',
                amountXOF,
                amountUSD: amount,
                instructions: `Envoyez ${amountXOF} FCFA via Wave. Reference: ${paymentId}`,
                error: String(err),
            },
        });
    }
}));
// POST /api/subscription/wave/webhook — Wave payment confirmation
// SECURITY: gated by ?secret=CRON_SECRET (Wave doesn't sign webhooks consistently).
// Without this, anyone who guesses a paymentId can flip a plan to 'completed'.
router.post('/wave/webhook', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const expected = process.env['CRON_SECRET'] ?? '';
    const provided = (req.query['secret'] ?? '').trim();
    if (!expected || provided !== expected) {
        res.status(403).send('Forbidden');
        return;
    }
    const body = req.body;
    const clientReference = body['data']?.['client_reference'];
    const checkoutStatus = body['data']?.['checkout_status'];
    if (!clientReference) {
        res.status(200).send('OK');
        return;
    }
    const db = (0, firebase_config_1.getFirestore)();
    const paymentDoc = await db.collection('payments').doc(clientReference).get();
    if (!paymentDoc.exists) {
        res.status(200).send('OK');
        return;
    }
    const payment = paymentDoc.data();
    if (checkoutStatus === 'complete') {
        // Activate the plan
        await db.collection('payments').doc(clientReference).update({
            status: 'completed', completedAt: new Date(),
        });
        const companyId = payment['companyId'];
        const planId = payment['planId'];
        const agentIds = payment['agentIds'] ?? [];
        // Update company plan + agents
        await db.collection('companies').doc(companyId).update({
            plan: planId,
            selectedAgents: agentIds,
            totalSkills: (0, agentCatalog_1.countSkills)(agentIds),
            agentsActivatedAt: new Date(),
            paymentMethod: 'wave',
            subscriptionStatus: 'active',
            updatedAt: new Date(),
        });
        // Confirmation email
        const companyDoc = await db.collection('companies').doc(companyId).get();
        const buyerEmail = companyDoc.data()?.['email']
            ?? companyDoc.data()?.['ownerEmail'];
        if (buyerEmail) {
            (0, emailService_1.sendPaymentConfirmationEmail)({
                to: buyerEmail,
                planName: planId.charAt(0).toUpperCase() + planId.slice(1),
                amount: `${(payment['amountXOF'] ?? 0).toLocaleString()} FCFA`,
                method: 'Wave Mobile Money',
                reference: clientReference,
                interval: payment['interval'],
                companyId,
            }).catch(err => logger_1.logger.error('[Wave webhook] email failed', { err: String(err) }));
        }
    }
    else if (checkoutStatus === 'expired' || checkoutStatus === 'failed') {
        await db.collection('payments').doc(clientReference).update({
            status: 'failed', failedAt: new Date(),
        });
    }
    res.status(200).send('OK');
}));
// ─── LOCAL / MANUAL PAYMENT (Cash, Orange Money, MTN, Zelle, etc.) ───────────
// POST /api/subscription/manual/checkout — user requests contact for manual payment
router.post('/manual/checkout', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { planId, interval, agentIds, paymentMethod, userNote } = req.body;
    if (!planId)
        throw new error_middleware_1.AppError('planId required', 400);
    const resolvedPlan = (0, agentCatalog_1.resolvePlan)(planId);
    const limits = agentCatalog_1.PLAN_AGENT_LIMITS[resolvedPlan];
    if (!limits)
        throw new error_middleware_1.AppError('Invalid plan', 400);
    let amountUSD = limits.price;
    if (interval === 'yearly')
        amountUSD = Math.round(amountUSD * 12 * 0.8 * 100) / 100; // -20%
    const amountXOF = Math.round(amountUSD * 600); // approx rate
    const paymentId = (0, helpers_1.generateId)();
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('payments').doc(paymentId).set({
        companyId,
        planId: resolvedPlan,
        interval: interval ?? 'monthly',
        agentIds: agentIds ?? [],
        amountUSD,
        amountXOF,
        currency: 'USD',
        method: 'manual',
        paymentMethod: paymentMethod ?? 'other',
        userNote: userNote ?? null,
        status: 'awaiting_confirmation',
        createdAt: new Date(),
    });
    // Contact info — Firestore (super admin editable) with env fallback
    const { getManualPaymentContact } = await Promise.resolve().then(() => __importStar(require('../services/platformSettings')));
    const { phone: contactPhone, whatsapp: contactWhatsApp, email: contactEmail } = await getManualPaymentContact();
    res.json({
        success: true,
        data: {
            paymentId,
            method: 'manual',
            amountUSD,
            amountXOF,
            planId: resolvedPlan,
            interval: interval ?? 'monthly',
            reference: paymentId,
            contact: {
                phone: contactPhone,
                whatsapp: contactWhatsApp,
                email: contactEmail,
                whatsappLink: `https://wa.me/${contactWhatsApp.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(`Bonjour, je souhaite payer le plan ${resolvedPlan} (${interval ?? 'monthly'}) — ${amountUSD}$. Reference: ${paymentId}`)}`,
                emailLink: `mailto:${contactEmail}?subject=${encodeURIComponent(`Paiement manuel — ${resolvedPlan} — ref ${paymentId}`)}&body=${encodeURIComponent(`Bonjour,\n\nJe souhaite payer le plan ${resolvedPlan} (${interval ?? 'monthly'}) pour ${amountUSD}$.\nReference: ${paymentId}\n\nMethode envisagee: ${paymentMethod ?? 'a definir'}\n\nMerci de me contacter pour les instructions.`)}`,
            },
            instructions: `Votre demande est enregistree avec la reference ${paymentId}. Contactez-nous via WhatsApp, email ou telephone pour finaliser le paiement (${amountUSD}$ / ${amountXOF.toLocaleString()} FCFA).`,
        },
    });
}));
// ─── PAYPAL PAYMENT ──────────────────────────────────────────────────────────
// POST /api/subscription/paypal/checkout — create PayPal order
router.post('/paypal/checkout', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { planId, interval, agentIds } = req.body;
    if (!planId)
        throw new error_middleware_1.AppError('planId required', 400);
    const resolvedPlan = (0, agentCatalog_1.resolvePlan)(planId);
    const limits = agentCatalog_1.PLAN_AGENT_LIMITS[resolvedPlan];
    if (!limits)
        throw new error_middleware_1.AppError('Invalid plan', 400);
    let amountUSD = limits.price;
    if (interval === 'yearly')
        amountUSD = Math.round(amountUSD * 12 * 0.8 * 100) / 100; // -20%
    const paymentId = (0, helpers_1.generateId)();
    const origin = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('payments').doc(paymentId).set({
        companyId,
        planId: resolvedPlan,
        interval: interval ?? 'monthly',
        agentIds: agentIds ?? [],
        amountUSD,
        currency: 'USD',
        method: 'paypal',
        status: 'pending',
        createdAt: new Date(),
    });
    const { orderId, approveUrl } = await paypalService_1.paypalService.createOrder({
        paymentId,
        companyId,
        planId: resolvedPlan,
        interval: interval ?? 'monthly',
        amountUSD,
        description: `Orlode AI — Plan ${resolvedPlan} (${interval ?? 'monthly'})`,
        returnUrl: `${origin}/admin/billing?paypal_order=${paymentId}&status=success`,
        cancelUrl: `${origin}/admin/plans?status=cancel`,
    });
    await db.collection('payments').doc(paymentId).update({ paypalOrderId: orderId });
    res.json({
        success: true,
        data: { paymentId, method: 'paypal', checkoutUrl: approveUrl, amountUSD, orderId },
    });
}));
// POST /api/subscription/paypal/capture — capture order after user returns from PayPal
router.post('/paypal/capture', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { paymentId } = req.body;
    if (!paymentId)
        throw new error_middleware_1.AppError('paymentId required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const paymentDoc = await db.collection('payments').doc(paymentId).get();
    if (!paymentDoc.exists)
        throw new error_middleware_1.AppError('Payment not found', 404);
    const payment = paymentDoc.data();
    if (payment['companyId'] !== companyId)
        throw new error_middleware_1.AppError('Forbidden', 403);
    const orderId = payment['paypalOrderId'];
    if (!orderId)
        throw new error_middleware_1.AppError('No PayPal order on this payment', 400);
    // Idempotency — if already completed, return the existing result without re-capturing / re-emailing
    if (payment['status'] === 'completed') {
        return res.json({ success: true, data: { status: 'COMPLETED', paymentId, alreadyCaptured: true } });
    }
    const result = await paypalService_1.paypalService.captureOrder(orderId);
    if (result.status === 'COMPLETED') {
        const planId = payment['planId'];
        const agentIds = payment['agentIds'] ?? [];
        await db.collection('payments').doc(paymentId).update({
            status: 'completed',
            completedAt: new Date(),
            paypalCaptureId: result.captureId ?? null,
            payerEmail: result.payerEmail ?? null,
        });
        await db.collection('companies').doc(companyId).update({
            plan: planId,
            selectedAgents: agentIds.length > 0 ? agentIds : (await db.collection('companies').doc(companyId).get()).data()?.['selectedAgents'] ?? [],
            totalSkills: (0, agentCatalog_1.countSkills)(agentIds),
            agentsActivatedAt: new Date(),
            paymentMethod: 'paypal',
            subscriptionStatus: 'active',
            updatedAt: new Date(),
        });
        // Fire confirmation email (buyer email comes from PayPal payer)
        const buyerEmail = result.payerEmail ?? req.user?.email;
        if (buyerEmail) {
            (0, emailService_1.sendPaymentConfirmationEmail)({
                to: buyerEmail,
                planName: planId.charAt(0).toUpperCase() + planId.slice(1),
                amount: `$${payment['amountUSD'] ?? 0}`,
                method: 'PayPal',
                reference: paymentId,
                interval: payment['interval'],
                companyId,
            }).catch(err => logger_1.logger.error('[PayPal capture] email failed', { err: String(err) }));
        }
    }
    else {
        await db.collection('payments').doc(paymentId).update({ status: 'failed', failedAt: new Date() });
    }
    res.json({ success: true, data: { status: result.status, paymentId } });
}));
// POST /api/subscription/confirm-manual — admin confirms manual payment
router.post('/confirm-manual', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const role = req.user?.role;
    if (role !== 'admin')
        throw new error_middleware_1.AppError('Admin only', 403);
    const { paymentId } = req.body;
    if (!paymentId)
        throw new error_middleware_1.AppError('paymentId required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const paymentDoc = await db.collection('payments').doc(paymentId).get();
    if (!paymentDoc.exists)
        throw new error_middleware_1.AppError('Payment not found', 404);
    const payment = paymentDoc.data();
    const companyId = payment['companyId'];
    const planId = payment['planId'];
    const agentIds = payment['agentIds'] ?? [];
    await db.collection('payments').doc(paymentId).update({
        status: 'completed', completedAt: new Date(), confirmedBy: req.user?.uid,
    });
    await db.collection('companies').doc(companyId).update({
        plan: planId,
        selectedAgents: agentIds,
        totalSkills: (0, agentCatalog_1.countSkills)(agentIds),
        agentsActivatedAt: new Date(),
        paymentMethod: payment['method'] ?? 'manual',
        subscriptionStatus: 'active',
        updatedAt: new Date(),
    });
    // Confirmation email to the buyer
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const buyerEmail = companyDoc.data()?.['email']
        ?? companyDoc.data()?.['ownerEmail'];
    if (buyerEmail) {
        const method = payment['paymentMethod'] ?? payment['method'] ?? 'manual';
        const amount = payment['amountXOF']
            ? `${payment['amountXOF'].toLocaleString()} FCFA`
            : `$${payment['amountUSD'] ?? 0}`;
        (0, emailService_1.sendPaymentConfirmationEmail)({
            to: buyerEmail,
            planName: planId.charAt(0).toUpperCase() + planId.slice(1),
            amount,
            method: method.replace(/_/g, ' '),
            reference: paymentId,
            interval: payment['interval'],
            companyId,
        }).catch(err => logger_1.logger.error('[manual confirm] email failed', { err: String(err) }));
    }
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=subscription.routes.js.map