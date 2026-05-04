/**
 * Subscription routes — plan selection, agent picker, Wave payment
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Request, Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { AGENT_CATALOG, PLAN_AGENT_LIMITS, getAvailableAgents, countSkills, resolvePlan } from '../config/agentCatalog';
import { getExchangeRates } from '../services/exchangeRateService';
import { paypalService } from '../services/billing/paypalService';
import { sendPaymentConfirmationEmail } from '../services/email/emailService';
import { logger } from '../utils/logger';

const router = Router();

// ─── PUBLIC: Exchange rates ──────────────────────────────────────────────────

// GET /api/subscription/rates — live exchange rates (base USD)
router.get('/rates', asyncHandler(async (_req: Request, res: Response) => {
  const rates = await getExchangeRates();
  res.json({ success: true, data: rates });
}));

// ─── PUBLIC: Catalog ─────────────────────────────────────────────────────────

// GET /api/subscription/catalog — full agent catalog with skills
router.get('/catalog', (_req: Request, res: Response) => {
  res.json({ success: true, data: { agents: AGENT_CATALOG, plans: PLAN_AGENT_LIMITS } });
});

// GET /api/subscription/plans — plan details with limits
router.get('/plans', (_req: Request, res: Response) => {
  res.json({ success: true, data: PLAN_AGENT_LIMITS });
});

// POST /api/subscription/paypal/webhook — PayPal webhook (no auth, verified via signature)
router.post('/paypal/webhook', asyncHandler(async (req: Request, res: Response) => {
  const event = req.body as { event_type?: string; resource?: Record<string, unknown> };
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : (v as string | undefined);
  }

  const valid = await paypalService.verifyWebhook(headers, event);
  if (!valid) { res.status(401).send('Invalid signature'); return; }

  type CaptureEvent = {
    resource?: {
      custom_id?: string;
      id?: string;
      supplementary_data?: { related_ids?: { order_id?: string } };
      status_details?: { reason?: string };
    };
  };

  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      await paypalService.handleCaptureCompleted(event as CaptureEvent);
      break;
    case 'PAYMENT.CAPTURE.PENDING':
      await paypalService.handleCapturePending(event as CaptureEvent);
      break;
    case 'PAYMENT.CAPTURE.DENIED':
      await paypalService.handleCaptureDenied(event as CaptureEvent);
      break;
  }

  res.status(200).send('OK');
}));

// GET /api/subscription/available/:plan — agents available for a plan
router.get('/available/:plan', (req: Request, res: Response) => {
  const plan = resolvePlan(req.params.plan);
  const agents = getAvailableAgents(plan);
  const limits = PLAN_AGENT_LIMITS[plan as keyof typeof PLAN_AGENT_LIMITS];
  res.json({ success: true, data: { agents, limits } });
});

// ─── PROTECTED: Selection & Activation ───────────────────────────────────────

router.use(authMiddleware);

// GET /api/subscription/my-agents — current company's selected agents
router.get('/my-agents', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  const doc = await db.collection('companies').doc(companyId).get();
  const data = doc.data() ?? {};

  res.json({
    success: true,
    data: {
      plan: data['plan'] ?? 'free',
      selectedAgents: data['selectedAgents'] ?? [],
      totalSkills: countSkills((data['selectedAgents'] as string[]) ?? []),
      activatedAt: data['agentsActivatedAt'] ?? null,
    },
  });
}));

// POST /api/subscription/select-agents — choose agents for your plan
router.post('/select-agents', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { agentIds } = req.body as { agentIds: string[] };
  if (!agentIds || !Array.isArray(agentIds)) throw new AppError('agentIds required', 400);

  const db = getFirestore();
  const companyDoc = await db.collection('companies').doc(companyId).get();
  const plan = resolvePlan((companyDoc.data()?.['plan'] as string) ?? 'free');
  const limits = PLAN_AGENT_LIMITS[plan as keyof typeof PLAN_AGENT_LIMITS];

  if (!limits) throw new AppError('Invalid plan', 400);

  // Validate agent count
  if (agentIds.length > limits.maxAgents) {
    throw new AppError(`Your plan allows max ${limits.maxAgents} agents. You selected ${agentIds.length}.`, 400);
  }

  // Validate agents are available for this plan
  const available = getAvailableAgents(plan);
  const availableIds = new Set(available.map(a => a.id));
  const invalid = agentIds.filter(id => !availableIds.has(id));
  if (invalid.length > 0) {
    throw new AppError(`Agents not available for your plan: ${invalid.join(', ')}`, 400);
  }

  // Validate skill count
  const totalSkills = countSkills(agentIds);
  if (totalSkills > limits.maxSkills) {
    throw new AppError(`Your plan allows max ${limits.maxSkills} skills. Selected agents have ${totalSkills}.`, 400);
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
router.post('/wave/checkout', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { planId, interval, agentIds } = req.body as {
    planId: string; interval: 'monthly' | 'yearly'; agentIds: string[];
  };
  if (!planId) throw new AppError('planId required', 400);

  const resolvedPlan = resolvePlan(planId);
  const limits = PLAN_AGENT_LIMITS[resolvedPlan as keyof typeof PLAN_AGENT_LIMITS];
  if (!limits) throw new AppError('Invalid plan', 400);

  let amount = limits.price;
  if (interval === 'yearly') amount = amount * 12 * 0.8; // -20%

  // Convert USD to XOF (approx rate)
  const XOF_RATE = 600;
  const amountXOF = Math.round(amount * XOF_RATE);

  const paymentId = generateId();

  // Create pending payment record
  const db = getFirestore();
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
    const waveData = await waveRes.json() as { id?: string; wave_launch_url?: string; checkout_status?: string };

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
  } catch (err) {
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
router.post('/wave/webhook', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const clientReference = (body['data'] as Record<string, unknown>)?.['client_reference'] as string;
  const checkoutStatus = (body['data'] as Record<string, unknown>)?.['checkout_status'] as string;

  if (!clientReference) { res.status(200).send('OK'); return; }

  const db = getFirestore();
  const paymentDoc = await db.collection('payments').doc(clientReference).get();
  if (!paymentDoc.exists) { res.status(200).send('OK'); return; }

  const payment = paymentDoc.data()!;

  if (checkoutStatus === 'complete') {
    // Activate the plan
    await db.collection('payments').doc(clientReference).update({
      status: 'completed', completedAt: new Date(),
    });

    const companyId = payment['companyId'] as string;
    const planId = payment['planId'] as string;
    const agentIds = (payment['agentIds'] as string[]) ?? [];

    // Update company plan + agents
    await db.collection('companies').doc(companyId).update({
      plan: planId,
      selectedAgents: agentIds,
      totalSkills: countSkills(agentIds),
      agentsActivatedAt: new Date(),
      paymentMethod: 'wave',
      subscriptionStatus: 'active',
      updatedAt: new Date(),
    });

    // Confirmation email
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const buyerEmail = (companyDoc.data()?.['email'] as string | undefined)
      ?? (companyDoc.data()?.['ownerEmail'] as string | undefined);
    if (buyerEmail) {
      sendPaymentConfirmationEmail({
        to: buyerEmail,
        planName: planId.charAt(0).toUpperCase() + planId.slice(1),
        amount: `${(payment['amountXOF'] as number ?? 0).toLocaleString()} FCFA`,
        method: 'Wave Mobile Money',
        reference: clientReference,
        interval: payment['interval'] as 'monthly' | 'yearly' | undefined,
        companyId,
      }).catch(err => logger.error('[Wave webhook] email failed', { err: String(err) }));
    }
  } else if (checkoutStatus === 'expired' || checkoutStatus === 'failed') {
    await db.collection('payments').doc(clientReference).update({
      status: 'failed', failedAt: new Date(),
    });
  }

  res.status(200).send('OK');
}));

// ─── LOCAL / MANUAL PAYMENT (Cash, Orange Money, MTN, Zelle, etc.) ───────────

// POST /api/subscription/manual/checkout — user requests contact for manual payment
router.post('/manual/checkout', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { planId, interval, agentIds, paymentMethod, userNote } = req.body as {
    planId: string; interval: 'monthly' | 'yearly'; agentIds: string[];
    paymentMethod?: string; // 'cash' | 'orange_money' | 'mtn' | 'zelle' | 'wave_manual' | 'other'
    userNote?: string;
  };
  if (!planId) throw new AppError('planId required', 400);

  const resolvedPlan = resolvePlan(planId);
  const limits = PLAN_AGENT_LIMITS[resolvedPlan as keyof typeof PLAN_AGENT_LIMITS];
  if (!limits) throw new AppError('Invalid plan', 400);

  let amountUSD = limits.price;
  if (interval === 'yearly') amountUSD = Math.round(amountUSD * 12 * 0.8 * 100) / 100; // -20%
  const amountXOF = Math.round(amountUSD * 600); // approx rate

  const paymentId = generateId();

  const db = getFirestore();
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
  const { getManualPaymentContact } = await import('../services/platformSettings');
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
router.post('/paypal/checkout', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { planId, interval, agentIds } = req.body as {
    planId: string; interval: 'monthly' | 'yearly'; agentIds: string[];
  };
  if (!planId) throw new AppError('planId required', 400);

  const resolvedPlan = resolvePlan(planId);
  const limits = PLAN_AGENT_LIMITS[resolvedPlan as keyof typeof PLAN_AGENT_LIMITS];
  if (!limits) throw new AppError('Invalid plan', 400);

  let amountUSD = limits.price;
  if (interval === 'yearly') amountUSD = Math.round(amountUSD * 12 * 0.8 * 100) / 100; // -20%

  const paymentId = generateId();
  const origin = process.env['CORS_ORIGIN'] ?? 'https://orlode.com';

  const db = getFirestore();
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

  const { orderId, approveUrl } = await paypalService.createOrder({
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
router.post('/paypal/capture', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { paymentId } = req.body as { paymentId: string };
  if (!paymentId) throw new AppError('paymentId required', 400);

  const db = getFirestore();
  const paymentDoc = await db.collection('payments').doc(paymentId).get();
  if (!paymentDoc.exists) throw new AppError('Payment not found', 404);
  const payment = paymentDoc.data()!;
  if (payment['companyId'] !== companyId) throw new AppError('Forbidden', 403);

  const orderId = payment['paypalOrderId'] as string | undefined;
  if (!orderId) throw new AppError('No PayPal order on this payment', 400);

  // Idempotency — if already completed, return the existing result without re-capturing / re-emailing
  if (payment['status'] === 'completed') {
    return res.json({ success: true, data: { status: 'COMPLETED', paymentId, alreadyCaptured: true } });
  }

  const result = await paypalService.captureOrder(orderId);

  if (result.status === 'COMPLETED') {
    const planId = payment['planId'] as string;
    const agentIds = (payment['agentIds'] as string[]) ?? [];

    await db.collection('payments').doc(paymentId).update({
      status: 'completed',
      completedAt: new Date(),
      paypalCaptureId: result.captureId ?? null,
      payerEmail: result.payerEmail ?? null,
    });

    await db.collection('companies').doc(companyId).update({
      plan: planId,
      selectedAgents: agentIds.length > 0 ? agentIds : (await db.collection('companies').doc(companyId).get()).data()?.['selectedAgents'] ?? [],
      totalSkills: countSkills(agentIds),
      agentsActivatedAt: new Date(),
      paymentMethod: 'paypal',
      subscriptionStatus: 'active',
      updatedAt: new Date(),
    });

    // Fire confirmation email (buyer email comes from PayPal payer)
    const buyerEmail = result.payerEmail ?? req.user?.email;
    if (buyerEmail) {
      sendPaymentConfirmationEmail({
        to: buyerEmail,
        planName: planId.charAt(0).toUpperCase() + planId.slice(1),
        amount: `$${payment['amountUSD'] ?? 0}`,
        method: 'PayPal',
        reference: paymentId,
        interval: payment['interval'] as 'monthly' | 'yearly' | undefined,
        companyId,
      }).catch(err => logger.error('[PayPal capture] email failed', { err: String(err) }));
    }
  } else {
    await db.collection('payments').doc(paymentId).update({ status: 'failed', failedAt: new Date() });
  }

  res.json({ success: true, data: { status: result.status, paymentId } });
}));

// POST /api/subscription/confirm-manual — admin confirms manual payment
router.post('/confirm-manual', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role;
  if (role !== 'admin') throw new AppError('Admin only', 403);

  const { paymentId } = req.body as { paymentId: string };
  if (!paymentId) throw new AppError('paymentId required', 400);

  const db = getFirestore();
  const paymentDoc = await db.collection('payments').doc(paymentId).get();
  if (!paymentDoc.exists) throw new AppError('Payment not found', 404);

  const payment = paymentDoc.data()!;
  const companyId = payment['companyId'] as string;
  const planId = payment['planId'] as string;
  const agentIds = (payment['agentIds'] as string[]) ?? [];

  await db.collection('payments').doc(paymentId).update({
    status: 'completed', completedAt: new Date(), confirmedBy: req.user?.uid,
  });

  await db.collection('companies').doc(companyId).update({
    plan: planId,
    selectedAgents: agentIds,
    totalSkills: countSkills(agentIds),
    agentsActivatedAt: new Date(),
    paymentMethod: (payment['method'] as string) ?? 'manual',
    subscriptionStatus: 'active',
    updatedAt: new Date(),
  });

  // Confirmation email to the buyer
  const companyDoc = await db.collection('companies').doc(companyId).get();
  const buyerEmail = (companyDoc.data()?.['email'] as string | undefined)
    ?? (companyDoc.data()?.['ownerEmail'] as string | undefined);
  if (buyerEmail) {
    const method = payment['paymentMethod'] as string ?? (payment['method'] as string) ?? 'manual';
    const amount = payment['amountXOF']
      ? `${(payment['amountXOF'] as number).toLocaleString()} FCFA`
      : `$${payment['amountUSD'] ?? 0}`;
    sendPaymentConfirmationEmail({
      to: buyerEmail,
      planName: planId.charAt(0).toUpperCase() + planId.slice(1),
      amount,
      method: method.replace(/_/g, ' '),
      reference: paymentId,
      interval: payment['interval'] as 'monthly' | 'yearly' | undefined,
      companyId,
    }).catch(err => logger.error('[manual confirm] email failed', { err: String(err) }));
  }

  res.json({ success: true });
}));

export default router;
