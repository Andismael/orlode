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
 * Orlode Talents API — server endpoints for the talents marketplace.
 *
 * Public read endpoints + the recruiter↔candidate WhatsApp conversation
 * flow with an integrated inbox on orlode.com (no need for the recruiter
 * to use WhatsApp on their phone — replies are routed via webhook into
 * Firestore conversations and surfaced in /talents/inbox).
 *
 * Routes:
 *   POST  /api/talents/contact                         — first message from recruiter (creates conversation)
 *   GET   /api/talents/:id/public                      — public talent profile (no private fields)
 *   GET   /api/talents/conversations                   — recruiter's conversation list
 *   GET   /api/talents/conversations/:id/messages      — full thread for a conversation
 *   POST  /api/talents/conversations/:id/reply         — recruiter sends a follow-up (already in conv)
 *   POST  /api/talents/conversations/:id/mark-read     — clear unread badge
 */
const express_1 = require("express");
const zod_1 = require("zod");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const whatsappService_1 = require("../services/whatsapp/whatsappService");
const logger_1 = require("../utils/logger");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
// Orlode platform's own companyId — used as the WhatsApp sender for Talents
// contact messages (the platform mediates between recruiter and candidate so
// the candidate doesn't get spammed from many unknown numbers). The master
// SuperAdmin uid is also the platform companyId by convention.
const PLATFORM_COMPANY_ID = process.env['ORLODE_PLATFORM_COMPANY_ID'] ?? 'J4vwyMVHP3ZeHdTsC1gOMjeOTRA2';
// ── POST /api/talents/contact ─────────────────────────────────────────────
// Body: { talentId, message }
// Auth: required (recruiter must be logged in via Firebase Auth)
// Flow:
//   1. Read talent's private WhatsApp number from talents_profiles/{id}/private/contact
//   2. Send the message via Orlode's platform WhatsApp Business
//   3. Audit-log to talent_contacts/{contactId}
//   4. Atomically increment talents_profiles/{id}.contactsCount
const CONTACT_INPUT = zod_1.z.object({
    talentId: zod_1.z.string().min(1),
    message: zod_1.z.string().min(10).max(1000),
});
router.post('/contact', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const parsed = CONTACT_INPUT.safeParse(req.body);
    if (!parsed.success)
        throw new error_middleware_1.AppError(`Invalid input: ${parsed.error.message}`, 400);
    const { talentId, message } = parsed.data;
    const recruiterUid = req.user?.uid;
    if (!recruiterUid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    // 1. Talent must exist and be active
    const talentRef = db.collection('talents_profiles').doc(talentId);
    const talentSnap = await talentRef.get();
    if (!talentSnap.exists)
        throw new error_middleware_1.AppError('Talent not found', 404);
    const talent = talentSnap.data();
    if (talent.status !== 'active')
        throw new error_middleware_1.AppError('This talent is not currently accepting contacts', 403);
    // 2. Get the private WhatsApp number (subcollection, locked by Firestore rules)
    const privateSnap = await talentRef.collection('private').doc('contact').get();
    const privateData = privateSnap.data();
    const candidateWhatsApp = privateData?.whatsappNumber;
    if (!candidateWhatsApp)
        throw new error_middleware_1.AppError('This talent has no WhatsApp number on file', 422);
    // 3. Lookup recruiter info for the audit + outbound message attribution
    const recruiterUserSnap = await db.collection('users').doc(recruiterUid).get();
    const recruiterUser = recruiterUserSnap.data();
    const recruiterCompanyId = recruiterUser?.companyId;
    let recruiterCompanyName = '';
    if (recruiterCompanyId) {
        const companySnap = await db.collection('companies').doc(recruiterCompanyId).get();
        recruiterCompanyName = companySnap.data()?.name ?? '';
    }
    // 4. Compose the WhatsApp message (signature so the candidate knows it's not spam)
    const signature = recruiterCompanyName
        ? `\n\n— ${recruiterUser?.displayName ?? 'Un recruteur'} · *${recruiterCompanyName}* · via Orlode Talents`
        : `\n\n— ${recruiterUser?.displayName ?? 'Un recruteur'} · via Orlode Talents`;
    const finalText = message + signature;
    // 5. Send via Orlode's platform WhatsApp (the recruiter doesn't expose their
    //    own number — Orlode mediates and stores the routing so candidate replies
    //    can be routed back to the recruiter).
    const config = await whatsappService_1.whatsappService.getConfig(PLATFORM_COMPANY_ID).catch(() => null);
    if (!config) {
        logger_1.logger.error('[TalentsContact] Platform WhatsApp not configured', { platform: PLATFORM_COMPANY_ID });
        throw new error_middleware_1.AppError('Le service WhatsApp Talents est temporairement indisponible. Réessaie dans quelques minutes.', 503);
    }
    const messageId = await whatsappService_1.whatsappService.sendMessage(config, candidateWhatsApp, finalText, PLATFORM_COMPANY_ID, 'talents-recruiter-contact');
    if (!messageId) {
        logger_1.logger.warn('[TalentsContact] WhatsApp send returned no messageId', { talentId, recruiterUid });
        throw new error_middleware_1.AppError('Le message n\'a pas pu être envoyé. Réessaie ou contacte le support.', 502);
    }
    // 6. Conversation — create-or-update so this recruiter-talent pair gets
    //    one persistent thread. Key = `${recruiterUid}__${talentId}` for
    //    deterministic upsert without a query.
    const normalizedCandidatePhone = candidateWhatsApp.replace(/\D/g, '');
    const conversationId = `${recruiterUid}__${talentId}`;
    const convRef = db.collection('talent_conversations').doc(conversationId);
    const convSnap = await convRef.get();
    const now = new Date();
    if (!convSnap.exists) {
        await convRef.set({
            id: conversationId,
            recruiterUid,
            recruiterName: recruiterUser?.displayName ?? '',
            recruiterEmail: recruiterUser?.email ?? '',
            recruiterCompanyId: recruiterCompanyId ?? null,
            recruiterCompanyName,
            talentId,
            talentDisplayName: talent.displayName ?? '',
            candidatePhone: normalizedCandidatePhone,
            createdAt: now,
            lastMessageAt: now,
            lastMessageText: message,
            lastMessageFrom: 'recruiter',
            unreadByRecruiter: 0,
            messageCount: 1,
        });
    }
    else {
        await convRef.update({
            lastMessageAt: now,
            lastMessageText: message,
            lastMessageFrom: 'recruiter',
            messageCount: (convSnap.data()?.['messageCount'] ?? 0) + 1,
        });
    }
    // Append the message to the thread (subcollection).
    const messageDocId = (0, helpers_1.generateId)();
    await convRef.collection('messages').doc(messageDocId).set({
        id: messageDocId,
        from: 'recruiter',
        text: message,
        whatsappMessageId: messageId,
        sentAt: now,
    });
    // 6b. Legacy audit log — still kept for compliance / 1-row-per-send analytics.
    const contactId = (0, helpers_1.generateId)();
    await db.collection('talent_contacts').doc(contactId).set({
        id: contactId,
        conversationId,
        talentId,
        talentDisplayName: talent.displayName ?? '',
        recruiterUid,
        recruiterName: recruiterUser?.displayName ?? '',
        recruiterEmail: recruiterUser?.email ?? '',
        recruiterCompanyId: recruiterCompanyId ?? null,
        recruiterCompanyName,
        message,
        whatsappMessageId: messageId,
        sentAt: now,
        status: 'sent',
    });
    // 7. Public counter on the talent doc — non-blocking, ok if it lags
    try {
        const FieldValue = (await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')))).FieldValue;
        await talentRef.update({ contactsCount: FieldValue.increment(1) });
    }
    catch (err) {
        logger_1.logger.warn('[TalentsContact] Failed to increment contactsCount', { error: err instanceof Error ? err.message : err });
    }
    logger_1.logger.info('[TalentsContact] Recruiter → Talent message sent', {
        talentId, recruiterUid, contactId, messageId,
    });
    res.json({
        success: true,
        contactId,
        whatsappMessageId: messageId,
        message: 'Message envoyé sur WhatsApp. Le candidat te répondra directement.',
    });
}));
// ── GET /api/talents/conversations ────────────────────────────────────────
// Auth: recruiter. Lists their own conversations, newest activity first.
router.get('/conversations', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recruiterUid = req.user?.uid;
    if (!recruiterUid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('talent_conversations')
        .where('recruiterUid', '==', recruiterUid)
        .orderBy('lastMessageAt', 'desc')
        .limit(100)
        .get();
    const conversations = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            talentId: data['talentId'],
            talentDisplayName: data['talentDisplayName'] ?? '',
            lastMessageText: data['lastMessageText'] ?? '',
            lastMessageFrom: data['lastMessageFrom'] ?? 'recruiter',
            lastMessageAt: data['lastMessageAt']?.toDate?.()?.toISOString?.() ?? null,
            unreadByRecruiter: data['unreadByRecruiter'] ?? 0,
            messageCount: data['messageCount'] ?? 0,
        };
    });
    res.json({ success: true, data: conversations });
}));
// ── GET /api/talents/conversations/:id/messages ───────────────────────────
router.get('/conversations/:id/messages', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recruiterUid = req.user?.uid;
    if (!recruiterUid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const convId = req.params['id'];
    const db = (0, firebase_config_1.getFirestore)();
    const convSnap = await db.collection('talent_conversations').doc(convId).get();
    if (!convSnap.exists)
        throw new error_middleware_1.AppError('Conversation not found', 404);
    if (convSnap.data()?.['recruiterUid'] !== recruiterUid)
        throw new error_middleware_1.AppError('Access denied', 403);
    const msgSnap = await db.collection('talent_conversations').doc(convId)
        .collection('messages')
        .orderBy('sentAt', 'asc')
        .limit(500)
        .get();
    const messages = msgSnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            from: data['from'] ?? 'unknown',
            text: data['text'] ?? '',
            sentAt: data['sentAt']?.toDate?.()?.toISOString?.() ?? null,
        };
    });
    res.json({
        success: true,
        data: {
            conversation: { id: convId, ...convSnap.data() },
            messages,
        },
    });
}));
// ── POST /api/talents/conversations/:id/reply ─────────────────────────────
// Recruiter sends a follow-up message in an existing conversation.
// Re-uses the same platform WhatsApp number as the original /contact.
const REPLY_INPUT = zod_1.z.object({ message: zod_1.z.string().min(1).max(1000) });
router.post('/conversations/:id/reply', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recruiterUid = req.user?.uid;
    if (!recruiterUid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const parsed = REPLY_INPUT.safeParse(req.body);
    if (!parsed.success)
        throw new error_middleware_1.AppError(`Invalid input: ${parsed.error.message}`, 400);
    const { message } = parsed.data;
    const convId = req.params['id'];
    const db = (0, firebase_config_1.getFirestore)();
    const convRef = db.collection('talent_conversations').doc(convId);
    const convSnap = await convRef.get();
    if (!convSnap.exists)
        throw new error_middleware_1.AppError('Conversation not found', 404);
    const conv = convSnap.data();
    if (conv.recruiterUid !== recruiterUid)
        throw new error_middleware_1.AppError('Access denied', 403);
    if (!conv.candidatePhone)
        throw new error_middleware_1.AppError('Conversation has no candidate phone', 422);
    const config = await whatsappService_1.whatsappService.getConfig(PLATFORM_COMPANY_ID).catch(() => null);
    if (!config)
        throw new error_middleware_1.AppError('Service WhatsApp Talents indisponible', 503);
    // Lightweight signature so the candidate keeps the context across replies.
    const sig = conv.recruiterCompanyName
        ? `\n— ${conv.recruiterName ?? 'Recruteur'} · ${conv.recruiterCompanyName}`
        : `\n— ${conv.recruiterName ?? 'Recruteur'} · via Orlode`;
    const messageId = await whatsappService_1.whatsappService.sendMessage(config, conv.candidatePhone, message + sig, PLATFORM_COMPANY_ID, 'talents-recruiter-reply');
    if (!messageId)
        throw new error_middleware_1.AppError('Message non envoyé. Réessaie.', 502);
    const now = new Date();
    await convRef.update({
        lastMessageAt: now,
        lastMessageText: message,
        lastMessageFrom: 'recruiter',
        messageCount: (convSnap.data()?.['messageCount'] ?? 0) + 1,
    });
    const messageDocId = (0, helpers_1.generateId)();
    await convRef.collection('messages').doc(messageDocId).set({
        id: messageDocId,
        from: 'recruiter',
        text: message,
        whatsappMessageId: messageId,
        sentAt: now,
    });
    res.json({ success: true, whatsappMessageId: messageId });
}));
// ── POST /api/talents/conversations/:id/mark-read ─────────────────────────
router.post('/conversations/:id/mark-read', auth_middleware_1.authMiddleware, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const recruiterUid = req.user?.uid;
    if (!recruiterUid)
        throw new error_middleware_1.AppError('Auth required', 401);
    const convId = req.params['id'];
    const db = (0, firebase_config_1.getFirestore)();
    const convRef = db.collection('talent_conversations').doc(convId);
    const convSnap = await convRef.get();
    if (!convSnap.exists)
        throw new error_middleware_1.AppError('Not found', 404);
    if (convSnap.data()?.['recruiterUid'] !== recruiterUid)
        throw new error_middleware_1.AppError('Access denied', 403);
    await convRef.update({ unreadByRecruiter: 0 });
    res.json({ success: true });
}));
// ── GET /api/talents/:id/public ───────────────────────────────────────────
// Public read — no auth required. Returns only safe fields (no whatsappNumber).
// Used by orlode.com /talents/feed and talents.orlode.com profile page.
router.get('/:id/public', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('talents_profiles').doc(req.params['id']).get();
    if (!snap.exists)
        throw new error_middleware_1.AppError('Talent not found', 404);
    const data = snap.data();
    if (data['status'] !== 'active')
        throw new error_middleware_1.AppError('Talent not available', 403);
    // Strip private fields — never return whatsappNumber via this endpoint
    const safe = { ...data, id: snap.id };
    delete safe['whatsappNumber'];
    res.json({ success: true, data: safe });
}));
exports.default = router;
//# sourceMappingURL=talents.routes.js.map