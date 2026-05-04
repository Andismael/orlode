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
 * Public Routes — sans authentification
 * Widget chat landing page → Agent Commercial Orlode
 * Protection : rate limit 20 req/min par IP + max 10 messages/session
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const commercialAgent_1 = require("../agents/commercial/commercialAgent");
const ttsService_1 = require("../services/tts/ttsService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const sessions = new Map();
const ipCounters = new Map();
const MAX_MESSAGES = 10;
const MAX_CHARS = 500;
const RATE_LIMIT = 20; // req/min par IP
const SESSION_TTL = 60 * 60 * 1000;
setInterval(() => {
    const cutoff = Date.now() - SESSION_TTL;
    for (const [id, s] of sessions)
        if (s.lastAt < cutoff)
            sessions.delete(id);
    for (const [ip, c] of ipCounters)
        if (c.resetAt < Date.now())
            ipCounters.delete(ip);
}, 10 * 60 * 1000);
// ── POST /api/public/chat ─────────────────────────────────────────────────────
router.post('/chat', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    // Rate limit par IP
    const counter = ipCounters.get(ip);
    if (!counter || counter.resetAt < now) {
        ipCounters.set(ip, { count: 1, resetAt: now + 60000 });
    }
    else {
        counter.count++;
        if (counter.count > RATE_LIMIT) {
            throw new error_middleware_1.AppError('Trop de requêtes. Réessayez dans 1 minute.', 429);
        }
    }
    const { message, language = 'fr', sessionId } = req.body;
    if (!message?.trim())
        throw new error_middleware_1.AppError('message requis', 400);
    if (message.length > MAX_CHARS)
        throw new error_middleware_1.AppError(`Max ${MAX_CHARS} caractères`, 400);
    // Session
    let sid = sessionId?.trim() || '';
    if (!sid || !sessions.has(sid)) {
        sid = crypto.randomUUID();
        sessions.set(sid, { messageCount: 0, lastAt: now });
    }
    const session = sessions.get(sid);
    if (session.messageCount >= MAX_MESSAGES) {
        throw new error_middleware_1.AppError('Limite de conversation atteinte. Contactez-nous directement.', 429);
    }
    session.messageCount++;
    session.lastAt = now;
    logger_1.logger.info('[Public/Chat] Agent invoked', { sid, messageCount: session.messageCount });
    const result = await (0, commercialAgent_1.commercialAgentFlow)({
        prompt: message,
        companyId: 'corpmind-public',
        language,
        sessionId: sid,
        messageCount: session.messageCount,
    });
    res.json({
        success: true,
        data: {
            response: result.response,
            sessionId: sid,
            remaining: MAX_MESSAGES - session.messageCount,
            leadCaptured: result.leadCaptured ?? false,
        },
    });
}));
// ── POST /api/public/tts ──────────────────────────────────────────────────────
router.post('/tts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    // Rate limit par IP (même compteur)
    const counter = ipCounters.get(ip);
    if (!counter || counter.resetAt < now) {
        ipCounters.set(ip, { count: 1, resetAt: now + 60000 });
    }
    else {
        counter.count++;
        if (counter.count > RATE_LIMIT) {
            throw new error_middleware_1.AppError('Trop de requêtes. Réessayez dans 1 minute.', 429);
        }
    }
    const { text, language = 'fr-FR', provider = 'google' } = req.body;
    if (!text?.trim())
        throw new error_middleware_1.AppError('text requis', 400);
    if (text.length > 1000)
        throw new error_middleware_1.AppError('Max 1000 caractères pour le TTS', 400);
    logger_1.logger.info('[Public/TTS] Synthesizing', { textLength: text.length, language, provider });
    const result = await (0, ttsService_1.synthesizeSpeech)({ text, language, provider });
    res.set({
        'Content-Type': result.contentType,
        'Content-Length': result.audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
    });
    res.send(result.audioBuffer);
}));
// POST /api/public/cron/reminders — appointment reminders (called by Cloud Scheduler)
router.post('/cron/reminders', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { checkAppointmentReminders } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    await checkAppointmentReminders();
    res.json({ success: true });
}));
// GET /api/public/landing — public landing content (cached)
router.get('/landing', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { getFirestore } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
    const doc = await getFirestore().doc('platform/landingPage').get();
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data: doc.exists ? doc.data() : null });
}));
// POST /api/public/lead — capture lead from website form (no auth)
// Rate limit: simple in-memory tracker (1 req / IP / 5 sec)
const leadRateLimit = new Map();
router.post('/lead', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { companyId, name, email, phone, message, source, website } = req.body;
    // Honeypot: if 'website' field is filled, it's a bot (hidden field)
    if (website) {
        res.json({ success: true, data: { leadId: 'ok' } });
        return;
    }
    // Rate limit: 1 req per IP per 5 seconds
    const ip = req.ip ?? 'unknown';
    const lastReq = leadRateLimit.get(ip) ?? 0;
    if (Date.now() - lastReq < 5000) {
        res.status(429).json({ success: false, message: 'Too many requests' });
        return;
    }
    leadRateLimit.set(ip, Date.now());
    // Cleanup old entries every 100 requests
    if (leadRateLimit.size > 1000) {
        const cutoff = Date.now() - 60000;
        for (const [k, v] of leadRateLimit) {
            if (v < cutoff)
                leadRateLimit.delete(k);
        }
    }
    if (!companyId || !name) {
        res.status(400).json({ success: false, message: 'companyId and name required' });
        return;
    }
    const { getFirestore } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
    const { FieldValue } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
    const db = getFirestore();
    const leadRef = db.collection(`companies/${companyId}/website/config/leads`).doc();
    await leadRef.set({
        name, email: email ?? '', phone: phone ?? '', message: message ?? '',
        source: source ?? 'website_form',
        status: 'new',
        createdAt: FieldValue.serverTimestamp(),
    });
    // Also add to main CRM leads if exists
    try {
        await db.collection(`companies/${companyId}/leads`).add({
            name, email: email ?? '', phone: phone ?? '', notes: message ?? '',
            source: 'website', stage: 'nouveau', score: 40,
            createdAt: FieldValue.serverTimestamp(),
        });
    }
    catch { }
    // Send email notification to company
    try {
        const companyDoc = await db.collection('companies').doc(companyId).get();
        const ownerEmail = companyDoc.data()?.['ownerEmail'];
        if (ownerEmail) {
            const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
            await sendEmail({
                to: ownerEmail,
                subject: `Nouveau lead depuis votre site — ${name}`,
                html: `<div style="font-family:sans-serif;padding:20px"><h2>Nouveau prospect !</h2><p><strong>${name}</strong> a envoye un message depuis votre site web.</p>${email ? `<p>Email: ${email}</p>` : ''}${phone ? `<p>Tel: ${phone}</p>` : ''}${message ? `<p>Message: ${message}</p>` : ''}<a href="https://orlode.com/sales" style="display:inline-block;padding:10px 20px;background:#6c3ce0;color:#fff;border-radius:8px;text-decoration:none;margin-top:10px">Voir dans Orlode</a></div>`,
            });
        }
    }
    catch { }
    res.json({ success: true, data: { leadId: leadRef.id } });
}));
// GET /api/public/site/:companyId — public website data (no auth)
router.get('/site/:companyId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { companyId } = req.params;
    const { getFirestore } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
    const db = getFirestore();
    const configDoc = await db.collection(`companies/${companyId}/website`).doc('config').get();
    if (!configDoc.exists) {
        res.status(404).json({ success: false, message: 'Site not found' });
        return;
    }
    const data = configDoc.data();
    // Also get company basic info
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const company = companyDoc.data() ?? {};
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({
        success: true,
        data: {
            ...data,
            companyName: data['companyName'] ?? company['name'] ?? '',
            companyLogo: company['logo'] ?? null,
            companyId,
        },
    });
}));
exports.default = router;
//# sourceMappingURL=public.routes.js.map