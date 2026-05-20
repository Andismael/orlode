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
 * Kora routes — personal companion agent.
 *
 * Authenticated:
 *   GET  /api/kora/profile        — current user's profile + opt-in state
 *   PATCH /api/kora/profile       — update firstName, language, timezone, checkInHour, voiceId, personality, phoneE164
 *   GET  /api/kora/facts          — list facts (transparency / control)
 *   DELETE /api/kora/facts/:id    — forget a single fact
 *   POST /api/kora/chat           — { message, sessionId? } → { text, sessionId }
 *   GET  /api/kora/reminders      — list pending reminders
 *   DELETE /api/kora/reminders/:id — cancel a reminder
 *
 * Cron (x-cron-secret gated, no auth):
 *   POST /api/kora/cron/checkin      — proactive morning check-in dispatcher
 *   POST /api/kora/cron/reminders    — fire due reminders (every minute)
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const firebase_config_1 = require("../config/firebase.config");
const koraMemoryService_1 = require("../services/kora/koraMemoryService");
const koraChatService_1 = require("../services/kora/koraChatService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// ── Standalone (B2C) endpoints — public, no auth ─────────────────────────────
/**
 * POST /api/kora/standalone/checkout
 * Body: { phoneE164 }
 * Creates a Stripe Checkout Session (or Wave link) and returns the URL.
 * For Phase 1 we return a placeholder URL — Adel can wire Stripe later.
 */
router.post('/standalone/checkout', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const phoneE164 = String(req.body?.phoneE164 ?? '').trim();
    if (!phoneE164)
        throw new error_middleware_1.AppError('phoneE164 required', 400);
    // TODO(Adel): plug Stripe Checkout Session here.
    //   const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    //   const session = await stripe.checkout.sessions.create({...});
    //   return res.json({ success: true, data: { url: session.url } });
    //
    // For now we return a tg/wave deep-link placeholder so the flow is testable.
    res.json({
        success: true,
        data: {
            url: `https://orlode.com/kora/upgrade/pending?phone=${encodeURIComponent(phoneE164)}`,
            provider: 'placeholder',
        },
    });
}));
/**
 * POST /api/kora/standalone/webhook/stripe
 * Stripe webhook receiver. Marks the user "active" on `checkout.session.completed`.
 * Stripe signature verification stub — wire the real one once secret is set.
 */
router.post('/standalone/webhook/stripe', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // TODO(Adel): verify Stripe signature with STRIPE_WEBHOOK_SECRET.
    const event = req.body;
    if (event?.type === 'checkout.session.completed') {
        const phoneE164 = String(event?.data?.object?.metadata?.phoneE164 ?? '').trim();
        const subId = String(event?.data?.object?.subscription ?? '') || null;
        if (phoneE164) {
            const { markStandaloneActive } = await Promise.resolve().then(() => __importStar(require('../services/kora/koraStandaloneService')));
            await markStandaloneActive(phoneE164, subId);
        }
    }
    res.json({ received: true });
}));
// ── Cron endpoints (x-cron-secret gated, BEFORE auth) ────────────────────────
function checkCronSecret(req) {
    const expected = process.env['CRON_SECRET'] ?? '';
    const got = req.headers['x-cron-secret'] ?? req.query['secret'] ?? '';
    return Boolean(expected) && got === expected;
}
/**
 * POST /api/kora/cron/checkin
 * Body: { hour: number }   — the UTC hour the Scheduler fired on.
 * We find every enabled profile whose local checkInHour matches the user's
 * local time RIGHT NOW (timezone-aware), generate a contextual message, and
 * dispatch via WhatsApp utility template.
 */
router.post('/cron/checkin', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!checkCronSecret(req)) {
        res.status(401).json({ success: false });
        return;
    }
    const utcHour = new Date().getUTCHours();
    // Build a list of "candidate local hours" — we look at profiles whose
    // checkInHour equals their CURRENT local hour. The Scheduler hits us every
    // hour at minute 0 so we cast a wide net (0..23) and filter by timezone.
    let dispatched = 0;
    for (let h = 0; h < 24; h++) {
        const profiles = await (0, koraMemoryService_1.listEnabledProfilesForHour)(h, 500);
        for (const profile of profiles) {
            try {
                // Compute the user's local hour right now.
                const fmt = new Intl.DateTimeFormat('en-US', { timeZone: profile.timezone, hour: 'numeric', hour12: false });
                const local = Number(fmt.format(new Date()));
                if (Number.isNaN(local) || local !== h)
                    continue;
                // Only send if we have a reason. The koraReply call below short-circuits if not.
                const reason = await decideCheckInReason(profile.uid, profile.companyId);
                if (!reason)
                    continue;
                const { text } = await (0, koraChatService_1.koraReply)({
                    uid: profile.uid,
                    companyId: profile.companyId,
                    userMessage: `[CHECK-IN PROACTIF — interne, ne le mentionne pas. Raison: ${reason}. Compose un message court (1-2 phrases max), naturel, sans "bonjour bonjour", qui appelle ${profile.firstName || 'l\'utilisateur'} à réagir sur cette raison. PAS de question creuse. PAS d'émoji.]`,
                });
                // Send via WhatsApp utility template when available.
                if (profile.phoneE164) {
                    try {
                        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
                        const cfg = await whatsappService.getConfig(profile.companyId).catch(() => null);
                        if (cfg) {
                            await whatsappService.sendMessage(cfg, profile.phoneE164, text);
                            dispatched++;
                        }
                    }
                    catch (sendErr) {
                        logger_1.logger.warn('[Kora] check-in WA send failed', { uid: profile.uid, error: String(sendErr) });
                    }
                }
            }
            catch (perUserErr) {
                logger_1.logger.warn('[Kora] check-in per-profile failed', { uid: profile.uid, error: String(perUserErr) });
            }
        }
        // Important: avoid scanning every hour bucket if we already found enabled
        // users — the loop is cheap (collection-group query per hour) but the
        // dispatch above is what costs LLM tokens.
        if (h !== utcHour && h !== (utcHour + 1) % 24 && h !== (utcHour + 23) % 24) {
            // Skip far-away hour buckets to bound the scan.
            continue;
        }
    }
    res.json({ success: true, dispatched });
}));
/**
 * Decide whether to ping the user this morning. Returns the reason string,
 * or null if we should stay silent.
 *
 * Triggers (priority order):
 *   1. There's a reminder due today.
 *   2. An "open loop" word in the last session summary (galère, bug, à finir…).
 *   3. The user hasn't been seen in 3-14 days (re-engagement window).
 */
async function decideCheckInReason(uid, companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);
    try {
        const todays = await db.collection(`companies/${companyId}/koraProfiles/${uid}/reminders`)
            .where('status', '==', 'pending')
            .where('dueAt', '>=', dayStart)
            .where('dueAt', '<=', dayEnd)
            .limit(1).get();
        if (!todays.empty) {
            const r = todays.docs[0].data();
            return `Rappel programmé aujourd'hui : "${r.title}"`;
        }
    }
    catch { /* index missing — fall through */ }
    const last = await (0, koraMemoryService_1.lastSessionSummary)(uid, companyId);
    if (last) {
        const sinceMs = last.endedAt ? now.getTime() - last.endedAt.getTime() : Infinity;
        const sinceDays = sinceMs / 86400000;
        if (sinceDays >= 3 && sinceDays <= 14) {
            return `Pas vu depuis ${Math.round(sinceDays)} jours. Reprend le fil sans poser de question creuse.`;
        }
        const openLoopRegex = /(galère|galere|bug|erreur|à finir|a finir|demain|en cours|coincé|coince)/i;
        if (last.summary && openLoopRegex.test(last.summary) && sinceDays < 3) {
            return `Loop ouvert : "${last.summary.slice(0, 140)}"`;
        }
    }
    return null;
}
/**
 * POST /api/kora/cron/reminders
 * Fires every minute via Cloud Scheduler. Pulls reminders due in the
 * [now - 2min, now + 1min] window and dispatches them.
 */
router.post('/cron/reminders', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!checkCronSecret(req)) {
        res.status(401).json({ success: false });
        return;
    }
    const reminders = await (0, koraMemoryService_1.getDueReminders)(new Date());
    let dispatched = 0;
    for (const r of reminders) {
        try {
            const profile = await (0, koraMemoryService_1.getOrCreateProfile)({ uid: r.uid, companyId: r.companyId });
            const ctx = r.contextSnippet ? ` Contexte : "${r.contextSnippet}".` : '';
            const reminderMsg = `Rappel : ${r.title}.${ctx}`;
            if (profile.phoneE164 && (r.channel === 'whatsapp' || r.channel === 'both')) {
                try {
                    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
                    const cfg = await whatsappService.getConfig(profile.companyId).catch(() => null);
                    if (cfg)
                        await whatsappService.sendMessage(cfg, profile.phoneE164, reminderMsg);
                }
                catch (sendErr) {
                    logger_1.logger.warn('[Kora] reminder WA send failed', { reminderId: r.id, error: String(sendErr) });
                }
            }
            await (0, koraMemoryService_1.markReminderFired)(r.uid, r.companyId, r.id);
            dispatched++;
        }
        catch (err) {
            logger_1.logger.warn('[Kora] reminder dispatch failed', { reminderId: r.id, error: String(err) });
        }
    }
    res.json({ success: true, dispatched, scanned: reminders.length });
}));
// ── Auth-protected routes ────────────────────────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
router.get('/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const profile = await (0, koraMemoryService_1.getOrCreateProfile)({
        uid, companyId,
        defaults: {},
    });
    res.json({ success: true, data: profile });
}));
router.patch('/profile', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const allowed = [
        'firstName', 'assistantName', 'language', 'timezone', 'checkInHour', 'voiceId', 'personality', 'enabled', 'phoneE164', 'ownerMessageRouting', 'directives',
    ];
    const patch = {};
    for (const k of allowed)
        if (req.body[k] !== undefined)
            patch[k] = req.body[k];
    await (0, koraMemoryService_1.updateProfile)(uid, companyId, patch);
    const profile = await (0, koraMemoryService_1.getOrCreateProfile)({ uid, companyId });
    res.json({ success: true, data: profile });
}));
router.get('/facts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const facts = await (0, koraMemoryService_1.recallFacts)({ uid, companyId, limit: 200 });
    res.json({ success: true, data: facts });
}));
router.delete('/facts/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const deleted = await (0, koraMemoryService_1.forgetFact)({ uid, companyId, factIds: [req.params.id] });
    res.json({ success: true, deleted });
}));
router.post('/chat', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    // Subscription gate — Kora is an opt-in addon, not a core feature.
    const profile = await (0, koraMemoryService_1.getOrCreateProfile)({ uid, companyId });
    if (!profile.enabled) {
        return res.status(403).json({ success: false, error: 'kora_not_activated', message: 'Active Kora dans les paramètres avant de discuter.' });
    }
    const status = profile.subscriptionStatus ?? 'none';
    if (status === 'none' || status === 'expired') {
        return res.status(402).json({ success: false, error: 'kora_subscription_required', message: 'Kora est un addon. Démarre ton essai gratuit ou souscris pour continuer.' });
    }
    if (status === 'trial' && profile.trialStartedAt) {
        const started = profile.trialStartedAt?.toDate?.() ?? new Date(profile.trialStartedAt);
        const days = (Date.now() - started.getTime()) / 86400000;
        if (days >= 7) {
            await (0, koraMemoryService_1.updateProfile)(uid, companyId, { subscriptionStatus: 'expired' });
            return res.status(402).json({ success: false, error: 'kora_trial_expired', message: 'Ton essai de 7 jours est terminé. Souscris pour continuer.' });
        }
    }
    const message = String(req.body?.message ?? '').trim();
    const sessionId = req.body?.sessionId ? String(req.body.sessionId) : undefined;
    if (!message)
        throw new error_middleware_1.AppError('message required', 400);
    const result = await (0, koraChatService_1.koraReply)({
        uid, companyId, userMessage: message, sessionId,
    });
    res.json({ success: true, data: result });
}));
/**
 * POST /api/kora/activate
 * Body: { directives?: string[] }
 * Turns Kora on for this user and starts the 7-day trial. Idempotent.
 */
router.post('/activate', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const directives = Array.isArray(req.body?.directives)
        ? req.body.directives.map(d => String(d).trim()).filter(Boolean).slice(0, 5).map(d => d.slice(0, 200))
        : undefined;
    const current = await (0, koraMemoryService_1.getOrCreateProfile)({ uid, companyId });
    const patch = { enabled: true };
    if (directives)
        patch.directives = directives;
    // Only start the trial once — re-activating doesn't reset the clock.
    if (current.subscriptionStatus === 'none' || !current.trialStartedAt) {
        patch.subscriptionStatus = 'trial';
        patch.trialStartedAt = new Date();
    }
    await (0, koraMemoryService_1.updateProfile)(uid, companyId, patch);
    const profile = await (0, koraMemoryService_1.getOrCreateProfile)({ uid, companyId });
    res.json({ success: true, data: profile });
}));
router.get('/reminders', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/koraProfiles/${uid}/reminders`)
        .where('status', '==', 'pending')
        .orderBy('dueAt', 'asc')
        .limit(100).get();
    const data = snap.docs.map(d => {
        const v = d.data();
        return { id: d.id, title: v.title, dueAt: v.dueAt?.toDate?.()?.toISOString?.() ?? null, contextSnippet: v.contextSnippet ?? null, channel: v.channel };
    });
    res.json({ success: true, data });
}));
/**
 * POST /api/kora/migrate-standalone
 * Body: { phoneE164 }
 * Copies a Kora Standalone profile (facts, sessions, reminders…) into the
 * authenticated user's workspace. The user must own the phone — we currently
 * trust the auth + phone match; for higher security wire an OTP exchange.
 */
router.post('/migrate-standalone', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const phoneE164 = String(req.body?.phoneE164 ?? '').trim();
    if (!phoneE164)
        throw new error_middleware_1.AppError('phoneE164 required', 400);
    const { migrateStandaloneToWorkspace } = await Promise.resolve().then(() => __importStar(require('../services/kora/koraStandaloneService')));
    const result = await migrateStandaloneToWorkspace({ phoneE164, targetCompanyId: companyId, targetUid: uid });
    res.json({ success: true, data: result });
}));
router.delete('/reminders/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const uid = req.user?.uid;
    const companyId = req.user?.companyId;
    if (!uid || !companyId)
        throw new error_middleware_1.AppError('Auth required', 401);
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/koraProfiles/${uid}/reminders/${req.params.id}`).delete();
    res.json({ success: true });
}));
exports.default = router;
//# sourceMappingURL=kora.routes.js.map