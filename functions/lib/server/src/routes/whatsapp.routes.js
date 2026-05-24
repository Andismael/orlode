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
const express_1 = require("express");
const crypto_1 = require("crypto");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const adminOnly_middleware_1 = require("../middleware/adminOnly.middleware");
const whatsappService_1 = require("../services/whatsapp/whatsappService");
const error_middleware_1 = require("../middleware/error.middleware");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// ── Webhook Meta global (public — pas d'auth) ────────────────────────────────
// URL à configurer dans Meta : .../api/whatsapp/webhook
// Verify Token : valeur de WHATSAPP_VERIFY_TOKEN dans .env
// GET /api/whatsapp/webhook — vérification webhook Meta
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = process.env['WHATSAPP_VERIFY_TOKEN'];
    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
        logger_1.logger.info('[WhatsApp] Webhook verified by Meta');
        res.status(200).send(challenge);
    }
    else {
        logger_1.logger.warn('[WhatsApp] Webhook verification failed', { token });
        res.status(403).send('Forbidden');
    }
});
// POST /api/whatsapp/webhook — messages entrants (routage automatique par phoneNumberId)
router.post('/webhook', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // Vérification X-Hub-Signature-256
    const appSecret = process.env['WHATSAPP_APP_SECRET'];
    if (appSecret) {
        const sigHeader = req.headers['x-hub-signature-256'];
        if (!sigHeader) {
            logger_1.logger.warn('[WhatsApp] Missing X-Hub-Signature-256 header');
            res.status(403).send('Forbidden');
            return;
        }
        const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
        const expected = 'sha256=' + (0, crypto_1.createHmac)('sha256', appSecret).update(rawBody).digest('hex');
        try {
            if (!(0, crypto_1.timingSafeEqual)(Buffer.from(sigHeader), Buffer.from(expected))) {
                logger_1.logger.warn('[WhatsApp] Invalid signature');
                res.status(403).send('Forbidden');
                return;
            }
        }
        catch {
            res.status(403).send('Forbidden');
            return;
        }
    }
    res.status(200).send('OK'); // Répondre immédiatement à Meta
    const body = req.body;
    // ── Handle delivery/read status updates ────────────────────────────────
    const statuses = whatsappService_1.whatsappService.parseStatuses?.(body);
    if (statuses && statuses.length > 0) {
        // Log every status update so we can debug delivery problems quickly
        // (e.g. failed delivery outside the 24h customer service window).
        for (const st of statuses) {
            logger_1.logger.info('[WhatsApp] Status webhook', {
                messageId: st.messageId,
                status: st.status, // sent | delivered | read | failed
                recipient: st.recipient_id ?? st.recipientId,
                errors: st.errors, // Meta error codes if status === 'failed'
                timestamp: st.timestamp,
            });
        }
        setImmediate(async () => {
            try {
                const db = (0, firebase_config_1.getFirestore)();
                for (const st of statuses) {
                    // Update message status in Firestore. We previously used a
                    // collectionGroup query which requires a composite index — replaced
                    // by a tenant-scoped lookup so it works without admin index setup.
                    // `whatsappMessages` is per-company; we extract companyId from the
                    // outer webhook body (set by Meta) when available, fall back to a
                    // best-effort collectionGroup query.
                    let snap;
                    try {
                        snap = await db.collectionGroup('whatsappMessages')
                            .where('messageId', '==', st.messageId)
                            .limit(1).get();
                        if (snap.empty) {
                            snap = await db.collectionGroup('whatsappMessages')
                                .where('waMessageId', '==', st.messageId)
                                .limit(1).get();
                        }
                    }
                    catch {
                        // Index missing — skip update silently; the status info is in the
                        // log above and the outbound message still appears in the inbox.
                        continue;
                    }
                    if (!snap.empty) {
                        await snap.docs[0].ref.update({
                            deliveryStatus: st.status,
                            deliveryTimestamp: new Date(st.timestamp),
                            ...((st.errors) ? { deliveryErrors: st.errors } : {}),
                        });
                    }
                }
            }
            catch (err) {
                logger_1.logger.error('[WhatsApp] Status update failed', { error: err });
            }
        });
    }
    const incoming = whatsappService_1.whatsappService.parseWebhook(body);
    // Allow audio messages with empty .message (we'll transcribe). Block only
    // when there's nothing to process at all.
    if (!incoming)
        return;
    const hasContent = !!incoming.message ||
        (incoming.type === 'audio' && !!incoming.audioId) ||
        (incoming.type === 'image' && !!incoming.imageId);
    if (!hasContent)
        return;
    // ── BOT-TO-BOT LOOP GUARD ──────────────────────────────────────────────
    // If `incoming.from` is itself a WhatsApp business number connected to
    // another Orlode company, this is a bot-to-bot loop (one Orlode bot
    // replied, which triggered another Orlode bot, etc.). Skip silently.
    // We compare against the display phone numbers of all connected companies.
    try {
        const guardDb = (0, firebase_config_1.getFirestore)();
        const fromDigits = (incoming.from ?? '').replace(/\D/g, '');
        if (fromDigits) {
            // Use a small global cache of known business numbers (5min TTL via doc).
            // Maintained when connecting/disconnecting WhatsApp accounts.
            const knownDoc = await guardDb.collection('_platformBusinessNumbers').doc(fromDigits).get().catch(() => null);
            if (knownDoc?.exists) {
                logger_1.logger.warn('[WhatsApp] Skipped — incoming "from" is itself a connected Orlode WhatsApp number (bot-to-bot loop guard)', {
                    from: incoming.from,
                    companyId: knownDoc.data()?.['companyId'],
                });
                return;
            }
        }
    }
    catch (err) {
        logger_1.logger.warn('[WhatsApp] Loop-guard check failed (continuing)', { error: err instanceof Error ? err.message : err });
    }
    // ── Rate limit + spam check (silent drop — Meta already 200-acked) ──
    {
        const { checkRateLimit, isSpam, isRepeatSpam } = await Promise.resolve().then(() => __importStar(require('../utils/rateLimit')));
        const rlKey = `wa:${incoming.from}`;
        const msgText = incoming.message ?? '';
        if (!checkRateLimit(rlKey, { windowMs: 60000, maxMessages: 25 })) {
            logger_1.logger.warn('[WhatsApp] Rate-limited', { from: incoming.from });
            return;
        }
        if (isSpam(msgText)) {
            logger_1.logger.warn('[WhatsApp] Spam pattern dropped', { from: incoming.from, preview: msgText.slice(0, 40) });
            return;
        }
        if (isRepeatSpam(rlKey, msgText)) {
            logger_1.logger.warn('[WhatsApp] Repeat spam dropped', { from: incoming.from });
            return;
        }
    }
    // ── Deduplication: prefer messageId (unique per Meta) over timestamp.
    // Falls back to from+timestamp for old payloads without messageId.
    const dedupId = incoming.messageId || `${incoming.from}_${incoming.timestamp}`;
    const dedupKey = `wa_${dedupId}`;
    const dedupDb = (0, firebase_config_1.getFirestore)();
    const dedupDoc = await dedupDb.collection('_whatsappDedup').doc(dedupKey).get().catch(() => null);
    if (dedupDoc?.exists) {
        logger_1.logger.info('[WhatsApp] Duplicate webhook ignored', { from: incoming.from, messageId: incoming.messageId });
        return;
    }
    await dedupDb.collection('_whatsappDedup').doc(dedupKey).set({ at: new Date(), from: incoming.from }).catch(() => { });
    // Traitement asynchrone : transcription, agent, réponse vocale
    setImmediate(async () => {
        try {
            const db = (0, firebase_config_1.getFirestore)();
            // The phoneNumberId comes from the incoming webhook payload (receiving business line)
            const phoneNumberId = incoming.phoneNumberId ?? process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';
            const accessToken = process.env['WHATSAPP_ACCESS_TOKEN'] ?? '';
            // ── Cached owner-store lookup ─────────────────────────────────────────
            // The webhook used to call findStoreByOwnerPhone 4-5 times per message
            // (once per intercept). Each call = collectionGroup query, ~150-300ms.
            // We now look up once at the top, reuse everywhere — saves 0.5-1.5s per
            // inbound message on average. Also: scope the query to companyId (already
            // resolved from phoneNumberId) so we avoid the collectionGroup composite
            // index requirement entirely.
            let _ownerStoreLookedUp = false;
            let _ownerStore = null;
            const getOwnerStore = async () => {
                if (_ownerStoreLookedUp)
                    return _ownerStore;
                const { findStoreByOwnerPhone } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                // Pass companyId only if we resolved it (not 'default')
                const scopedId = companyId !== 'default' ? companyId : undefined;
                _ownerStore = await findStoreByOwnerPhone(incoming.from, scopedId);
                _ownerStoreLookedUp = true;
                return _ownerStore;
            };
            // Set to true when a previously-confirmed business action is being
            // executed (owner replied "oui" to a confirmation prompt). Forces the
            // brain switch to Orchestrator regardless of detection logic, since
            // we already validated intent on the previous message.
            let forceOrchestrator = false;
            // Route to the right company by matching phoneNumberId on the company doc (mirrored)
            let companyId = 'default';
            if (phoneNumberId) {
                const companiesSnap = await db.collection('companies')
                    .where('whatsappPhoneNumberId', '==', phoneNumberId)
                    .limit(1)
                    .get()
                    .catch(() => null);
                if (companiesSnap && !companiesSnap.empty) {
                    companyId = companiesSnap.docs[0].id;
                }
                else {
                    // Fallback: search the integrations sub-collection group
                    const integrationsSnap = await db.collectionGroup('integrations')
                        .where('phoneNumberId', '==', phoneNumberId)
                        .limit(1)
                        .get()
                        .catch(() => null);
                    const parent = integrationsSnap?.docs[0]?.ref.parent.parent;
                    if (parent) {
                        companyId = parent.id;
                        // Backfill the mirror field for fast future lookups
                        parent.set({ whatsappPhoneNumberId: phoneNumberId, updatedAt: new Date() }, { merge: true }).catch(() => { });
                    }
                }
            }
            if (companyId === 'default') {
                logger_1.logger.warn('[WhatsApp] Could not resolve company from phoneNumberId, falling back to default', { phoneNumberId });
            }
            let finalMessage = incoming.message;
            let transcriptionFailed = false;
            // ── Si message vocal → transcription Whisper ──────────────────────────
            if (incoming.type === 'audio' && incoming.audioId && accessToken) {
                logger_1.logger.info('[WhatsApp Audio Debug]', {
                    audioId: incoming.audioId,
                    hasAccessToken: !!accessToken,
                    companyId,
                    type: incoming.type,
                });
                try {
                    logger_1.logger.info('[WhatsApp] Transcribing audio', { audioId: incoming.audioId });
                    const transcribed = await whatsappService_1.whatsappService.transcribeAudio(incoming.audioId, accessToken, companyId);
                    if (!transcribed || !transcribed.trim()) {
                        transcriptionFailed = true;
                        finalMessage = '';
                        logger_1.logger.warn('[WhatsApp] Transcription returned empty', { audioId: incoming.audioId, companyId });
                    }
                    else {
                        finalMessage = transcribed;
                        logger_1.logger.info('[WhatsApp] Transcription done', { text: finalMessage.slice(0, 80) });
                    }
                }
                catch (err) {
                    logger_1.logger.error('[WhatsApp] Transcription failed', {
                        error: err instanceof Error ? err.message : String(err),
                        audioId: incoming.audioId,
                        companyId,
                    });
                    transcriptionFailed = true;
                    finalMessage = '';
                }
            }
            else if (incoming.type === 'audio') {
                // Audio without audioId or accessToken — log why we can't transcribe
                logger_1.logger.warn('[WhatsApp] Audio received but cannot transcribe', {
                    hasAudioId: !!incoming.audioId,
                    hasAccessToken: !!accessToken,
                    companyId,
                });
                transcriptionFailed = true;
                finalMessage = '';
            }
            // ── Sauvegarder le message entrant ────────────────────────────────────
            await db.collection(`companies/${companyId}/whatsappMessages`).add({
                direction: 'inbound',
                from: incoming.from,
                message: finalMessage,
                originalType: incoming.type,
                timestamp: new Date(incoming.timestamp),
                processed: false,
                createdAt: new Date(),
                ...(incoming.referral ? { referral: incoming.referral } : {}),
            });
            // ── Talents inbox routing ─────────────────────────────────────────────
            // When the platform's WhatsApp number receives a message AND the sender
            // is a candidate who has an open talent_conversation, route the message
            // to the inbox thread + increment unreadByRecruiter. Skip the regular
            // orchestrator/clone path — this is a recruiter-mediated conversation,
            // not a generic clone interaction.
            const PLATFORM_COMPANY = process.env['ORLODE_PLATFORM_COMPANY_ID'] ?? 'J4vwyMVHP3ZeHdTsC1gOMjeOTRA2';
            if (companyId === PLATFORM_COMPANY && finalMessage) {
                try {
                    const fromDigits = incoming.from.replace(/\D/g, '');
                    const talentsConvSnap = await db.collection('talent_conversations')
                        .where('candidatePhone', '==', fromDigits)
                        .orderBy('lastMessageAt', 'desc')
                        .limit(1)
                        .get()
                        .catch(() => null);
                    if (talentsConvSnap && !talentsConvSnap.empty) {
                        const convDoc = talentsConvSnap.docs[0];
                        const convRef = convDoc.ref;
                        const now = new Date();
                        const FieldValue = (await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')))).FieldValue;
                        await convRef.update({
                            lastMessageAt: now,
                            lastMessageText: finalMessage,
                            lastMessageFrom: 'candidate',
                            messageCount: (convDoc.data()['messageCount'] ?? 0) + 1,
                            unreadByRecruiter: FieldValue.increment(1),
                        });
                        await convRef.collection('messages').add({
                            from: 'candidate',
                            text: finalMessage,
                            sentAt: now,
                            receivedViaPhoneNumberId: phoneNumberId,
                        });
                        logger_1.logger.info('[TalentsInbox] Candidate reply routed to conversation', {
                            conversationId: convDoc.id, candidatePhone: fromDigits,
                        });
                        return; // skip orchestrator — this is a Talents-only inbound
                    }
                }
                catch (err) {
                    logger_1.logger.warn('[TalentsInbox] Routing failed (non-blocking, falling through to orchestrator)', {
                        error: err instanceof Error ? err.message : err,
                    });
                }
            }
            // ── Capture Click-to-WhatsApp ad attribution ────────────────────────
            // If this conversation started from a Meta ad, attach the referral to
            // the customer's conversation doc + bump per-campaign stats.
            // We always tag the lead created from this conversation later.
            if (incoming.referral?.source_id) {
                try {
                    const phoneKey = incoming.from.replace(/\D/g, '');
                    const convoRef = db.collection(`companies/${companyId}/whatsappConversations`).doc(phoneKey);
                    await convoRef.set({
                        customerPhone: incoming.from,
                        adReferral: incoming.referral,
                        adFirstSeenAt: firestore_1.FieldValue.serverTimestamp(),
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    // Per-campaign aggregate
                    await db.collection(`companies/${companyId}/whatsappAdCampaigns`).doc(incoming.referral.source_id).set({
                        campaignId: incoming.referral.source_id,
                        headline: incoming.referral.headline ?? null,
                        body: incoming.referral.body ?? null,
                        sourceUrl: incoming.referral.source_url ?? null,
                        imageUrl: incoming.referral.image_url ?? null,
                        conversationsStarted: firestore_1.FieldValue.increment(1),
                        lastSeenAt: firestore_1.FieldValue.serverTimestamp(),
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    logger_1.logger.info('[WhatsApp/Ads] referral captured', { from: incoming.from, campaignId: incoming.referral.source_id });
                }
                catch (err) {
                    logger_1.logger.warn('[WhatsApp/Ads] referral capture failed (non-blocking)', { error: String(err) });
                }
            }
            // ── Conversion tracking: link inbound to recent template OR product send ──
            // If we sent a template OR product card to this customer in the last 7 days
            // and they reply, mark that send as "replied" + bump broadcast.repliedCount
            // (templates) or stats (products). Best-effort, never blocks webhook.
            try {
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const recentSends = await db.collection(`companies/${companyId}/whatsappTemplateSends`)
                    .where('to', '==', incoming.from)
                    .where('sentAt', '>=', sevenDaysAgo)
                    .orderBy('sentAt', 'desc')
                    .limit(1)
                    .get()
                    .catch(() => null);
                if (recentSends && !recentSends.empty) {
                    const sendDoc = recentSends.docs[0];
                    const sendData = sendDoc.data();
                    if (!sendData['replied']) {
                        await sendDoc.ref.update({ replied: true, repliedAt: new Date() });
                        const broadcastId = sendData['relatedBroadcastId'];
                        if (broadcastId) {
                            await db.collection(`companies/${companyId}/whatsappBroadcasts`).doc(broadcastId)
                                .update({ repliedCount: firestore_1.FieldValue.increment(1), updatedAt: firestore_1.FieldValue.serverTimestamp() })
                                .catch(() => null);
                        }
                        const leadId = sendData['relatedLeadId'];
                        if (leadId) {
                            await db.collection(`companies/${companyId}/whatsappLeads`).doc(leadId)
                                .update({ repliedToTemplate: true, repliedAt: new Date() })
                                .catch(() => null);
                        }
                    }
                }
                // Catalog product sends — same logic, separate collection
                const recentProducts = await db.collection(`companies/${companyId}/whatsappCatalogSends`)
                    .where('to', '==', incoming.from)
                    .where('sentAt', '>=', sevenDaysAgo)
                    .orderBy('sentAt', 'desc')
                    .limit(1)
                    .get()
                    .catch(() => null);
                if (recentProducts && !recentProducts.empty) {
                    const sendDoc = recentProducts.docs[0];
                    const sendData = sendDoc.data();
                    if (!sendData['replied']) {
                        await sendDoc.ref.update({ replied: true, repliedAt: new Date() });
                        const leadId = sendData['relatedLeadId'];
                        if (leadId) {
                            await db.collection(`companies/${companyId}/whatsappLeads`).doc(leadId)
                                .update({ repliedToProduct: true, repliedAt: new Date() })
                                .catch(() => null);
                        }
                    }
                }
            }
            catch { /* best-effort */ }
            // ── Opt-out detection (STOP, UNSUBSCRIBE, ARRÊTER) ─────────────────
            // Per Meta + GDPR best practice: a customer who replies with an opt-out
            // keyword should never receive a marketing template again. We mark all
            // their leads as `optedOut: true`. Future template sends are blocked.
            const optOutPattern = /^(stop|stoppe|stop\.?|unsubscribe|désabonner|desabonner|arr[eê]ter|arret\s*envois?)\s*$/i;
            if (finalMessage && optOutPattern.test(finalMessage.trim())) {
                try {
                    const leadsSnap = await db.collection(`companies/${companyId}/whatsappLeads`)
                        .where('customerPhone', '==', incoming.from).limit(20).get();
                    for (const ld of leadsSnap.docs) {
                        await ld.ref.update({ optedOut: true, optedOutAt: new Date() });
                    }
                    // Also store on the conversation doc for quick check during sends
                    const phoneKey = (incoming.from ?? '').replace(/\D/g, '');
                    await db.collection(`companies/${companyId}/whatsappConversations`).doc(phoneKey).set({
                        optedOut: true,
                        optedOutAt: new Date(),
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    // Confirm to the customer per regulation
                    const cfg = await whatsappService_1.whatsappService.getConfig(companyId).catch(() => null);
                    if (cfg) {
                        await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, "👍 Bien noté — vous ne recevrez plus de messages marketing. Pour reprendre, écrivez-nous quand vous voulez.", companyId).catch(() => null);
                    }
                    logger_1.logger.info('[WhatsApp] Opted-out customer', { from: incoming.from, leadsAffected: leadsSnap.size });
                }
                catch (err) {
                    logger_1.logger.warn('[WhatsApp] opt-out processing failed (non-blocking)', { error: String(err) });
                }
                return; // skip orchestrator — don't reply with the bot
            }
            // ── Kora Standalone (B2C — dedicated WABA) ───────────────────────────
            // If the receiving phoneNumberId matches the dedicated Kora WhatsApp
            // Business Account, every inbound goes straight to Kora — there is no
            // company, no commerce, no orchestrator. Identification is by phoneE164.
            const koraStandalonePnid = process.env['KORA_STANDALONE_PHONE_NUMBER_ID'] ?? '';
            if (finalMessage && koraStandalonePnid && phoneNumberId === koraStandalonePnid) {
                try {
                    const { processStandaloneInbound } = await Promise.resolve().then(() => __importStar(require('../services/kora/koraStandaloneService')));
                    const result = await processStandaloneInbound({ phoneE164: incoming.from, message: finalMessage });
                    // Build the standalone WABA config from env vars (this WABA is owned
                    // by Orlode itself, not by a tenant — so we don't read it from Firestore).
                    const standaloneCfg = {
                        accessToken: process.env['KORA_STANDALONE_ACCESS_TOKEN'] ?? process.env['WHATSAPP_ACCESS_TOKEN'] ?? '',
                        phoneNumberId: koraStandalonePnid,
                        businessAccountId: process.env['KORA_STANDALONE_BUSINESS_ACCOUNT_ID'] ?? '',
                        webhookVerifyToken: process.env['WHATSAPP_VERIFY_TOKEN'] ?? '',
                        autoReply: true,
                        replyMode: 'text',
                        ttsVoice: 'nova',
                        language: 'fr',
                    };
                    try {
                        if (standaloneCfg.accessToken && result.reply) {
                            await whatsappService_1.whatsappService.sendMessage(standaloneCfg, incoming.from, result.reply, companyId).catch(() => null);
                        }
                    }
                    catch (sendErr) {
                        logger_1.logger.warn('[Kora] Standalone send failed', { error: String(sendErr) });
                    }
                    return; // Standalone fully handled — never fall through.
                }
                catch (err) {
                    logger_1.logger.error('[Kora] Standalone handler crashed', { error: String(err) });
                    return;
                }
            }
            // ── Kora: personal companion (keyword-triggered) ─────────────────────
            // Kora intercepts BEFORE Commerce so a personal "salut kora" never gets
            // routed to the shop assistant. She only takes over for users who have
            // opt-in (their phone is bound to a koraProfile) AND either say a trigger
            // keyword or are already in an active Kora session (< 30 min).
            if (finalMessage) {
                try {
                    const { tryHandleKoraWhatsApp } = await Promise.resolve().then(() => __importStar(require('../services/kora/koraWhatsAppHandler')));
                    const koraOutcome = await tryHandleKoraWhatsApp({
                        companyId,
                        fromPhoneE164: incoming.from,
                        message: finalMessage,
                    });
                    if (koraOutcome.handled) {
                        if (koraOutcome.reply) {
                            const cfg = await whatsappService_1.whatsappService.getConfig(companyId).catch(() => null);
                            if (cfg)
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, koraOutcome.reply, companyId).catch(() => null);
                        }
                        return; // Kora handled this turn — skip Commerce + Orchestrator.
                    }
                }
                catch (err) {
                    logger_1.logger.warn('[Kora] WhatsApp handler failed (falling through)', { error: String(err) });
                }
            }
            // ── Commerce Agent: photo + owner → product magic (the WAOUH) ────────
            // If the sender owns a Commerce store AND sent an image (or replies "1/2/3"
            // to a recent product creation), intercept BEFORE the regular orchestrator.
            if (incoming.type === 'image' && incoming.imageId) {
                logger_1.logger.info('[Commerce] Image received', {
                    from: incoming.from, hasCaption: !!incoming.caption, hasAccessToken: !!accessToken, companyId,
                });
                try {
                    const { handleOwnerPhotoUpload, findAllStoresByOwnerPhone, detectStoreBusinessType } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                    let ownerStore = await getOwnerStore();
                    // Multi-store disambiguation: if the owner has 2+ stores AND no
                    // clear hint (caption or recent intent), ask them where to add
                    // before downloading/processing the photo.
                    if (ownerStore) {
                        try {
                            const phoneKey0 = incoming.from.replace(/\D/g, '');
                            const sessionDoc0 = await db
                                .doc(`companies/${ownerStore.companyId}/stores/${ownerStore.storeId}/sessions/${phoneKey0}`)
                                .get()
                                .catch(() => null);
                            const sessionTarget0 = sessionDoc0?.data()?.['pendingProductBusinessType'];
                            const awaitingMore0 = sessionDoc0?.data()?.['awaitingMorePhotosFor'];
                            const captionTarget0 = detectStoreBusinessType(incoming.caption ?? '');
                            const hasHint = !!(sessionTarget0 || captionTarget0);
                            const allStores0 = await findAllStoresByOwnerPhone(incoming.from, ownerStore.companyId);
                            // Skip the picker if the owner is already mid-product (more
                            // photos coming for an existing article) — the photo handler
                            // will append to that product on the same store.
                            if (!hasHint && !awaitingMore0 && allStores0.length >= 2) {
                                // Save the imageId + caption so we can resume after the owner
                                // picks. Meta media IDs are valid for several hours, well
                                // within our 5-minute pending window.
                                await db
                                    .doc(`companies/${ownerStore.companyId}/stores/${ownerStore.storeId}/sessions/${phoneKey0}`)
                                    .set({
                                    pendingPhoto: {
                                        imageId: incoming.imageId,
                                        caption: incoming.caption ?? '',
                                        createdAt: new Date(),
                                        stores: allStores0.map(s => ({
                                            storeId: s.storeId,
                                            businessType: s.store.businessType ?? 'boutique',
                                            name: s.store.name ?? '',
                                        })),
                                    },
                                    updatedAt: new Date(),
                                }, { merge: true });
                                const cfg0 = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                                if (cfg0) {
                                    const lines = allStores0.map((s, i) => {
                                        const bt = s.store.businessType ?? 'boutique';
                                        const labelMap = {
                                            boutique: '🛍 Boutique', restaurant: '🍽 Restaurant', hotel: '🏨 Hôtel',
                                            service: '💇 Salon', health: '🏥 Cabinet', realestate: '🏠 Immobilier',
                                        };
                                        return `*${i + 1}.* ${labelMap[bt] ?? bt} — ${s.store.name ?? ''}`;
                                    });
                                    await whatsappService_1.whatsappService.sendMessage(cfg0, incoming.from, `📸 Photo reçue. Tu as plusieurs packs activés — *à qui je l'ajoute ?*\n\n${lines.join('\n')}\n\n_Réponds juste avec le numéro (ex. *2*)._`, companyId);
                                }
                                logger_1.logger.info('[Commerce] Photo arrived with multiple stores → asking owner to pick', {
                                    from: incoming.from, companyId: ownerStore.companyId, storeCount: allStores0.length,
                                });
                                return; // wait for owner's choice
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn('[Commerce] Photo disambiguation failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                        }
                    }
                    logger_1.logger.info('[Commerce] Owner lookup', {
                        from: incoming.from,
                        matched: !!ownerStore,
                        companyId: ownerStore?.companyId,
                        storeId: ownerStore?.storeId,
                    });
                    if (ownerStore) {
                        // Multi-store routing: if owner has multiple stores (boutique +
                        // restaurant + hotel + ...), pick the right one based on hints.
                        // Priority: 1) session.pendingProductBusinessType (saved during a
                        // conversational "ajouter au restaurant" intent earlier),
                        // 2) businessType keywords in the photo caption itself.
                        try {
                            const phoneKey = incoming.from.replace(/\D/g, '');
                            const sessionDoc = await db
                                .doc(`companies/${ownerStore.companyId}/stores/${ownerStore.storeId}/sessions/${phoneKey}`)
                                .get()
                                .catch(() => null);
                            const sessionTargetType = sessionDoc?.data()?.['pendingProductBusinessType'];
                            const captionTargetType = detectStoreBusinessType(incoming.caption ?? '');
                            const targetType = sessionTargetType ?? captionTargetType ?? null;
                            const currentType = ownerStore.store.businessType ?? 'boutique';
                            if (targetType && targetType !== currentType) {
                                const allStores = await findAllStoresByOwnerPhone(incoming.from, ownerStore.companyId);
                                const matched = allStores.find(s => (s.store.businessType ?? 'boutique') === targetType);
                                if (matched) {
                                    logger_1.logger.info('[Commerce] Photo routed to matching businessType store', {
                                        from: incoming.from, fromType: currentType, toType: targetType,
                                        fromStoreId: ownerStore.storeId, toStoreId: matched.storeId,
                                        source: sessionTargetType ? 'session' : 'caption',
                                    });
                                    ownerStore = { companyId: ownerStore.companyId, storeId: matched.storeId, store: matched.store };
                                }
                            }
                            // Consume the pending hint so a future random photo doesn't keep routing
                            if (sessionTargetType && sessionDoc) {
                                await sessionDoc.ref.set({ pendingProductBusinessType: null }, { merge: true });
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn('[Commerce] Multi-store routing failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                        }
                        if (!accessToken) {
                            const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                            if (cfg) {
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, '⚠️ Photo reçue, mais impossible de la télécharger (configuration serveur manquante). Le support a été notifié.', companyId);
                            }
                            logger_1.logger.error('[Commerce] WHATSAPP_ACCESS_TOKEN env missing — cannot download media', { companyId: ownerStore.companyId });
                            return;
                        }
                        // ── Solution 2: immediate ACK so the merchant sees activity in <2s.
                        // Vision + Storage + Firestore can take 10-20s; user shouldn't wait
                        // in silence. Send the ack BEFORE awaiting handleOwnerPhotoUpload.
                        const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                        if (cfg) {
                            void whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, '📸 Photo reçue ! Je crée ton produit, ça prend 10-15 secondes…', companyId);
                        }
                        const result = await handleOwnerPhotoUpload({
                            companyId: ownerStore.companyId,
                            storeId: ownerStore.storeId,
                            ownerPhone: incoming.from,
                            imageId: incoming.imageId,
                            caption: incoming.caption,
                            accessToken,
                        });
                        if (cfg) {
                            await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, result.reply, companyId);
                            logger_1.logger.info('[Commerce] Owner photo handled', {
                                companyId: ownerStore.companyId, storeId: ownerStore.storeId,
                                productId: result.productId, from: incoming.from,
                            });
                        }
                        return; // skip orchestrator — Commerce handled it
                    }
                    // Image received but no boutique matches this number → don't drop silently:
                    // log it, and let the orchestrator handle as a normal customer image.
                    logger_1.logger.info('[Commerce] Image received from non-owner — falling through to orchestrator', { from: incoming.from });
                }
                catch (err) {
                    logger_1.logger.error('[Commerce] Owner photo handling failed', { error: err instanceof Error ? err.message : err });
                    // Fall through to orchestrator on failure rather than leave user hanging
                }
            }
            // ── Commerce Agent: PIN setup / change via WhatsApp ────────────────
            // "set pin 1234" / "change pin 1234" / "définis pin 5678"
            if (incoming.type === 'text' && finalMessage) {
                const pinSet = /^(?:set|change|d[eé]finis|d[eé]finit|nouveau)\s*pin\s+(\d{4,6})\s*$/i.exec(finalMessage.trim());
                if (pinSet) {
                    try {
                        const ownerStore = await getOwnerStore();
                        if (ownerStore) {
                            const { isOwnerSessionValid, setStorePin, startOwnerOtp } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                            const sessionOk = await isOwnerSessionValid(ownerStore.companyId, ownerStore.storeId, incoming.from);
                            const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                            if (!sessionOk) {
                                const code = await startOwnerOtp(ownerStore.companyId, ownerStore.storeId, incoming.from);
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `🔒 Pour définir un PIN, valide d'abord avec ce code OTP : *${code}*\n_(5 min, ensuite session 24h)_`, companyId);
                                return;
                            }
                            const r = await setStorePin(ownerStore.companyId, ownerStore.storeId, pinSet[1]);
                            if (cfg) {
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, r.ok
                                    ? `🔐 PIN enregistré (${pinSet[1].length} chiffres).\n\nIl te sera demandé pour les actions ultra-sensibles : exports, remboursements, suppressions massives.\n\n_Pour changer : tape \`change pin XXXX\`._`
                                    : `❌ ${r.reason ?? 'PIN invalide.'}`, companyId);
                            }
                            return;
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn('[Commerce] PIN setup failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                    }
                }
            }
            // ── Commerce Agent: customer asks for the address / location ───────
            // Universal intercept (works for owner and visitors) — when anyone
            // writes "adresse", "où êtes-vous", "comment venir", "localisation",
            // we reply directly with the store address + Google Maps link AND a
            // native WhatsApp location ping when GPS coords are configured.
            // Faster than going through Clone+Gemini, and avoids the bot inventing
            // a wrong address.
            if (incoming.type === 'text' && finalMessage) {
                const tAddr = finalMessage.trim().toLowerCase();
                const wantsAddress = /\b(adresse|address|localisation|location|position|gps)\b/i.test(tAddr) ||
                    /\b(o[uù]\s+(?:[eê]tes[\s-]?vous|se trouve|c'?est|vous trouvez))\b/i.test(tAddr) ||
                    /\b(comment\s+(?:venir|y\s+aller|vous\s+trouver))\b/i.test(tAddr) ||
                    /\b(c'?est\s+o[uù]|trouve[zr]?\s+vous|sit[eé]\s+o[uù])\b/i.test(tAddr) ||
                    /\b(envoie[\s-]?(?:moi)?\s+(?:l[ae'])?\s*localisation)\b/i.test(tAddr) ||
                    /\b(map|maps|carte)\b.*\b(votre|vos|ta|le|la)\b/i.test(tAddr);
                if (wantsAddress) {
                    try {
                        // Find any store of the company that owns this WA number — the
                        // address is per-company, so the first store with one wins.
                        const storesSnap = await db.collection(`companies/${companyId}/stores`)
                            .limit(10).get().catch(() => null);
                        const storeWithAddr = storesSnap?.docs.find(d => {
                            const sd = d.data();
                            return !!(sd.address || sd.googleMapsUrl || typeof sd.latitude === 'number');
                        });
                        if (storeWithAddr) {
                            const sd = storeWithAddr.data();
                            const cfg = await whatsappService_1.whatsappService.getConfig(companyId).catch(() => null);
                            if (cfg) {
                                let lines = `📍 *${sd.name ?? 'Notre adresse'}*\n\n`;
                                if (sd.address)
                                    lines += `${sd.address}\n\n`;
                                const mapsUrl = sd.googleMapsUrl
                                    ?? (typeof sd.latitude === 'number' && typeof sd.longitude === 'number'
                                        ? `https://www.google.com/maps/search/?api=1&query=${sd.latitude},${sd.longitude}`
                                        : null);
                                if (mapsUrl)
                                    lines += `🗺 ${mapsUrl}`;
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, lines.trim(), companyId);
                                // Also send a native WhatsApp location ping if we have coords
                                if (typeof sd.latitude === 'number' && typeof sd.longitude === 'number') {
                                    try {
                                        await whatsappService_1.whatsappService.sendLocation?.(cfg, incoming.from, {
                                            latitude: sd.latitude, longitude: sd.longitude,
                                            name: sd.name, address: sd.address,
                                        });
                                    }
                                    catch (err) {
                                        logger_1.logger.warn('[Commerce] Native WA location send failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                                    }
                                }
                            }
                            logger_1.logger.info('[Commerce] Address auto-reply sent', {
                                companyId, storeId: storeWithAddr.id, hasGps: typeof sd.latitude === 'number',
                            });
                            return;
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn('[Commerce] Address intercept failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                    }
                }
            }
            // ── Customer asks for photos (hotel rooms / immo properties) ───────
            // When a visitor writes "photos chambres", "envoie image villa Cocody",
            // "voir l'appartement", we send 2-3 native WhatsApp images of the
            // matched item(s) + a link to the full public page. Faster + more
            // visual than the clone's text response, and proper native render
            // (not unreliable URL link previews).
            if (incoming.type === 'text' && finalMessage) {
                const tPhoto = finalMessage.trim().toLowerCase();
                const wantsPhotos = /\b(photo|photos|image|images|montre[\s-]?moi|envoie[\s-]?(?:moi)?\s+(?:la|le|les)?\s*(?:photo|image)|voir|aper[cç]u)\b/i.test(tPhoto)
                    && /\b(chambre|chambres|appart|appartement|villa|maison|bien|biens|residence|suite|studio|piece)\b/i.test(tPhoto);
                if (wantsPhotos) {
                    try {
                        const storesSnap = await db.collection(`companies/${companyId}/stores`)
                            .where('businessType', 'in', ['hotel', 'realestate'])
                            .limit(5).get().catch(() => null);
                        if (storesSnap && !storesSnap.empty) {
                            const cfg = await whatsappService_1.whatsappService.getConfig(companyId).catch(() => null);
                            if (!cfg)
                                return;
                            for (const storeDoc of storesSnap.docs) {
                                const sd = storeDoc.data();
                                const isHotel = sd.businessType === 'hotel';
                                // Hotel = rooms subcollection. Realestate = products subcollection.
                                const itemsSnap = isHotel
                                    ? await db.collection(`companies/${companyId}/stores/${storeDoc.id}/rooms`).limit(20).get()
                                    : await db.collection(`companies/${companyId}/stores/${storeDoc.id}/products`)
                                        .where('status', '==', 'active').limit(20).get();
                                if (itemsSnap.empty)
                                    continue;
                                // Match by name (or send first 2-3 if no specific name)
                                const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                                const named = items.find(it => {
                                    const name = (it['name'] ?? it['number'] ?? '').toLowerCase();
                                    return name && tPhoto.includes(name.toLowerCase());
                                });
                                const targets = named ? [named] : items.slice(0, 3);
                                const baseUrl = process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app';
                                const publicUrl = sd.slug
                                    ? `${baseUrl}/${isHotel ? 'hotel' : 'biens'}/${sd.slug}`
                                    : null;
                                let sentAny = false;
                                for (const item of targets) {
                                    const photos = item['imageUrls']?.filter(Boolean) ?? [];
                                    if (photos.length === 0 && item['imageUrl'])
                                        photos.push(item['imageUrl']);
                                    if (photos.length === 0)
                                        continue;
                                    const itemName = item['name'] ?? item['number'] ?? '';
                                    const caption = `${isHotel ? '🛏' : '🏠'} *${itemName}*${publicUrl ? `\n${publicUrl}` : ''}`;
                                    // Send up to 3 images per item
                                    for (let i = 0; i < Math.min(photos.length, 3); i++) {
                                        await whatsappService_1.whatsappService.sendImage(cfg, incoming.from, photos[i], i === 0 ? caption : undefined);
                                        sentAny = true;
                                    }
                                }
                                if (sentAny && publicUrl) {
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `Voir tout sur la page complète :\n${publicUrl}`, companyId);
                                }
                                if (sentAny) {
                                    logger_1.logger.info('[Commerce] Photos sent natively', {
                                        companyId, businessType: sd.businessType, items: targets.length,
                                    });
                                    return;
                                }
                            }
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn('[Commerce] Photo intercept failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                    }
                }
            }
            // ── Commerce Agent: owner asks for shop link / share boutique ──────
            // Quick intercept — owner says "lien boutique", "url boutique",
            // "partage le lien", "envoie le lien"… → reply with public storefront
            // URL directly (no Clone, no Gemini). Read-only, super fast.
            if (incoming.type === 'text' && finalMessage) {
                const t0 = finalMessage.trim().toLowerCase();
                const wantsShopLink = /\b(lien|url)\b.*\b(boutique|shop|magasin|catalogue|catalog)\b/i.test(t0) ||
                    /\b(partag[ezr]+|envoie?[zr]?|donne[zr]?|c'?est\s+quoi)\b.*\b(lien|url|adresse)\b.*\b(boutique|shop|magasin)?\b/i.test(t0) ||
                    /^(?:donne[\s-]?moi|envoie[\s-]?moi|partage[\s-]?moi)\b.*\b(lien|url)\b/i.test(t0) ||
                    /^(?:lien|url)\s+(?:de\s+)?(?:la|ma)\s+(?:boutique|magasin|shop)\b/i.test(t0);
                if (wantsShopLink) {
                    try {
                        const ownerStore = await getOwnerStore();
                        if (ownerStore) {
                            const { ensureStoreSlug } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                            const slug = await ensureStoreSlug(ownerStore.companyId, ownerStore.storeId, ownerStore.store);
                            const publicUrl = process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app';
                            const shopLink = `${publicUrl}/shop/${slug}`;
                            const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                            if (cfg) {
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `🛍️ *Voici le lien public de ta boutique* :\n\n${shopLink}\n\n` +
                                    `Tu peux le partager partout : Instagram, Facebook, status WhatsApp, signature email…\n\n` +
                                    `Quand un client clique, il voit tes produits avec photos et un bouton *Commander* qui le ramène ici sur WhatsApp.`, companyId);
                            }
                            logger_1.logger.info('[Commerce] Owner shop link sent', { companyId: ownerStore.companyId, slug });
                            return;
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn('[Commerce] Shop-link intercept failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                    }
                }
            }
            // ── Commerce Agent: variant follow-up reply ──────────────────────────
            // After a photo→product, owner can reply "tailles S M L XL" or
            // "couleurs rouge bleu" to add variants. Or "non" to skip. We only
            // attempt this if the sender is a known owner — otherwise it's a
            // customer message and goes to the orchestrator unchanged.
            if (incoming.type === 'text' && finalMessage && !/^\s*\d{6}\s*$/.test(finalMessage)) {
                try {
                    const { parseVariantReply, applyVariantsToLastProduct } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                    const ownerStore = await getOwnerStore();
                    if (ownerStore) {
                        const parsed = parseVariantReply(finalMessage);
                        // Look up if there's a pending lastProductId — if not, no variant flow active
                        const sessionSnap = await (0, firebase_config_1.getFirestore)()
                            .doc(`companies/${ownerStore.companyId}/stores/${ownerStore.storeId}/sessions/${incoming.from.replace(/\D/g, '')}`)
                            .get().catch(() => null);
                        const hasPending = !!(sessionSnap?.exists && sessionSnap.data()?.lastProductId);
                        if (hasPending && parsed) {
                            const r = await applyVariantsToLastProduct(ownerStore.companyId, ownerStore.storeId, incoming.from, parsed);
                            const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                            if (cfg && r.ok) {
                                const label = parsed.type === 'sizes' ? 'tailles' : 'couleurs';
                                const stockSummary = parsed.stocks
                                    ? parsed.values.map((v, i) => `${v}=${parsed.stocks[i]}`).join(', ')
                                    : parsed.values.join(', ');
                                const totalStock = parsed.stocks
                                    ? parsed.stocks.reduce((s, n) => s + n, 0)
                                    : (r.variantCount ?? 0);
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `✅ ${r.variantCount} ${label} ajoutées à *${r.productName}* (${stockSummary}). Stock total : ${totalStock}.`, companyId);
                                logger_1.logger.info('[Commerce] Variants added', { companyId: ownerStore.companyId, productName: r.productName, count: r.variantCount });
                            }
                            return;
                        }
                        if (hasPending && /^(non|aucun|aucune|pas|skip|rien|c'?est bon|nope|no)\s*$/i.test(finalMessage)) {
                            // Owner skipped — clear pending and confirm
                            await (0, firebase_config_1.getFirestore)()
                                .doc(`companies/${ownerStore.companyId}/stores/${ownerStore.storeId}/sessions/${incoming.from.replace(/\D/g, '')}`)
                                .set({ lastProductId: null, updatedAt: new Date() }, { merge: true });
                            const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                            if (cfg) {
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, '👌 Validé tel quel. Envoie une autre photo pour ajouter un nouveau produit.', companyId);
                            }
                            return;
                        }
                        // NEW: owner replied "oui/yes/ok" with pending product but no actual
                        // variant pattern → re-prompt with examples. Otherwise their "oui"
                        // would fall through to the Clone (which has no idea what's going on).
                        if (hasPending && /^(oui|yes|ok|d'?accord|vas[\s-]?y|👍)\s*$/i.test(finalMessage)) {
                            const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                            if (cfg) {
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `Super 👍 *Quelles variantes* ?\n\n` +
                                    `Tape par exemple :\n` +
                                    `   • _tailles S M L XL_\n` +
                                    `   • _S 2 M 3 L 5 XL 1_  _(stock par taille)_\n` +
                                    `   • _couleurs rouge bleu vert_\n\n` +
                                    `Ou tape *non* pour valider sans variantes.`, companyId);
                            }
                            return;
                        }
                        // Owner is talking but not about variants → fall through to orchestrator
                    }
                }
                catch (err) {
                    logger_1.logger.warn('[Commerce] Variant intercept failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                }
            }
            // ── Commerce Agent: owner admin command intercept ────────────────────
            // Owner can manage products via natural-language WhatsApp text:
            //   "augmente prix Chemise à 7000"
            //   "stock Chemise 10"
            //   "supprime Chemise"
            //   "archive Chemise"
            // Requires authenticated owner session (24h after OTP verification).
            if (incoming.type === 'text' && finalMessage && !/^\s*\d{6}\s*$/.test(finalMessage)) {
                try {
                    const { parseOwnerCommand, executeOwnerCommand, isOwnerSessionValid, startOwnerOtp } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                    const ownerStore = await getOwnerStore();
                    if (ownerStore) {
                        const cmd = parseOwnerCommand(finalMessage);
                        if (cmd) {
                            const sessionOk = await isOwnerSessionValid(ownerStore.companyId, ownerStore.storeId, incoming.from);
                            const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                            if (!sessionOk) {
                                // Trigger OTP — owner must verify before mutating products
                                const code = await startOwnerOtp(ownerStore.companyId, ownerStore.storeId, incoming.from);
                                if (cfg) {
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `🔒 Pour modifier tes produits, envoie-moi ce code de validation : *${code}*\n\n_(Valide 5 minutes — ensuite ta session reste ouverte 24h.)_`, companyId);
                                }
                                logger_1.logger.info('[Commerce] Owner command needs OTP', { type: cmd.type, from: incoming.from });
                                return;
                            }
                            const reply = await executeOwnerCommand(ownerStore.companyId, ownerStore.storeId, cmd);
                            if (cfg)
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, reply, companyId);
                            logger_1.logger.info('[Commerce] Owner command executed', {
                                companyId: ownerStore.companyId, storeId: ownerStore.storeId,
                                type: cmd.type, productQuery: cmd.productQuery,
                            });
                            return;
                        }
                        // Owner is talking but not an admin command → fall through to orchestrator
                    }
                }
                catch (err) {
                    logger_1.logger.warn('[Commerce] Owner command intercept failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                }
            }
            // ── Commerce Agent: conversational owner flow ────────────────────────
            // Replaces the old cheat-sheet dump with a one-question-at-a-time flow.
            // State machine via session.pendingFlow:
            //   awaiting_create_choice → user picked help intent → ask "photo or manual?"
            //   awaiting_manual_details → user picked "manual" → ask for "name, price, stock"
            //
            // Pattern: detect owner-y intent, branch on session.pendingFlow.
            if (incoming.type === 'text' && finalMessage && !/^\s*\d{6}\s*$/.test(finalMessage)) {
                logger_1.logger.info('[Commerce-Conv] entered', {
                    type: incoming.type, preview: finalMessage.slice(0, 60), from: incoming.from,
                });
                try {
                    const ownerStore = await getOwnerStore();
                    logger_1.logger.info('[Commerce-Conv] owner-check', { matched: !!ownerStore });
                    if (ownerStore) {
                        const t = finalMessage.trim().toLowerCase();
                        const phoneKey = incoming.from.replace(/\D/g, '');
                        const sessionRef = (0, firebase_config_1.getFirestore)()
                            .doc(`companies/${ownerStore.companyId}/stores/${ownerStore.storeId}/sessions/${phoneKey}`);
                        const sessionSnap = await sessionRef.get().catch(() => null);
                        const sessionData = sessionSnap?.data();
                        // Expire stale flows after 10 min
                        const flowAt = sessionData?.pendingFlowAt instanceof Date
                            ? sessionData.pendingFlowAt
                            : sessionData?.pendingFlowAt?.toDate?.();
                        const flowExpired = flowAt && Date.now() - flowAt.getTime() > 10 * 60 * 1000;
                        const pendingFlow = !flowExpired ? sessionData?.pendingFlow : undefined;
                        logger_1.logger.info('[Commerce-Conv] state', {
                            pendingFlow,
                            hadSession: sessionSnap?.exists ?? false,
                            flowExpired: !!flowExpired,
                            t: t.slice(0, 60),
                        });
                        const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                        const setFlow = async (flow) => {
                            await sessionRef.set({
                                pendingFlow: flow,
                                pendingFlowAt: flow ? new Date() : null,
                                updatedAt: new Date(),
                            }, { merge: true });
                        };
                        // ── A−2. Admin Chat Mode — owner is in direct-to-orchestrator
                        // session. Every message bypasses Clone and runs through the
                        // Orchestrator. Exit on "fin", "quit", "exit", "/quit". Auto-
                        // expires after 30 min of inactivity.
                        const adminMode = sessionData ? sessionData['adminChatMode'] === true : false;
                        const adminModeAtRaw = sessionData ? sessionData['adminChatModeAt'] : undefined;
                        const adminModeAt = adminModeAtRaw instanceof Date
                            ? adminModeAtRaw
                            : adminModeAtRaw?.toDate?.();
                        const adminModeExpired = adminModeAt && Date.now() - adminModeAt.getTime() > 30 * 60 * 1000;
                        if (adminMode && !adminModeExpired) {
                            if (/^\s*(fin|quit|exit|sortir|stop\s*admin|\/quit|\/exit)\s*$/i.test(t)) {
                                await sessionRef.set({ adminChatMode: false, adminChatModeAt: null }, { merge: true });
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `🔒 Mode admin désactivé. Je suis de retour en mode client (clone).\n\n_Tape *@admin* pour réactiver._`, companyId);
                                logger_1.logger.info('[WhatsApp] Admin Chat Mode OFF', { companyId: ownerStore.companyId, from: incoming.from });
                                return;
                            }
                            // Refresh activity timestamp + force orchestrator for this turn
                            await sessionRef.set({ adminChatModeAt: new Date() }, { merge: true });
                            forceOrchestrator = true;
                            logger_1.logger.info('[WhatsApp] Admin Chat Mode active → Orchestrator', {
                                companyId: ownerStore.companyId, from: incoming.from, preview: t.slice(0, 60),
                            });
                            // Don't return — fall through to handleMessage with brain=orchestrator
                        }
                        else if (adminMode && adminModeExpired) {
                            // Auto-expire silently — back to clone mode
                            await sessionRef.set({ adminChatMode: false, adminChatModeAt: null }, { merge: true });
                            logger_1.logger.info('[WhatsApp] Admin Chat Mode auto-expired (30min idle)', {
                                companyId: ownerStore.companyId, from: incoming.from,
                            });
                        }
                        // ── A−1. Owner is in multi-photo mode → "fini" closes the window
                        // After creating a product from a photo, we keep accepting more
                        // photos for the same article until the owner types "fini" /
                        // "terminé". That clears awaitingMorePhotosFor and prompts the
                        // variants step (the historical follow-up).
                        const awaitingMorePhotosFor = sessionData
                            ? sessionData['awaitingMorePhotosFor']
                            : undefined;
                        if (awaitingMorePhotosFor && /^(fini|fini\.|term[ie]n[eé]|finir|c'?est tout|voil[aà]|stop)\s*$/i.test(t)) {
                            await sessionRef.set({ awaitingMorePhotosFor: null }, { merge: true });
                            const productSnap = await (0, firebase_config_1.getFirestore)()
                                .doc(`companies/${ownerStore.companyId}/stores/${ownerStore.storeId}/products/${awaitingMorePhotosFor}`)
                                .get()
                                .catch(() => null);
                            const data = productSnap?.data();
                            const photoCount = data?.imageUrls?.length ?? 1;
                            if (cfg)
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `✅ *${data?.name ?? 'Produit'}* finalisé avec ${photoCount} photo${photoCount > 1 ? 's' : ''}.\n\n🎯 *Variantes ?* Réponds par exemple :\n   • _tailles S M L XL_\n   • _S 2 M 3 L 5 XL 1_\n   • _couleurs rouge bleu vert_\n\nSinon réponds *non* et c'est validé.`, companyId);
                            logger_1.logger.info('[Commerce] Multi-photo window closed', {
                                companyId: ownerStore.companyId, productId: awaitingMorePhotosFor, photoCount,
                            });
                            return;
                        }
                        // ── A0. Owner is replying to the multi-store photo picker ─────
                        // Earlier we received a photo + asked "à quel pack je l'ajoute ?
                        // 1) Boutique 2) Restaurant ...". Now they reply with a number
                        // or a keyword. Resolve and run the photo upload on the right store.
                        const pendingPhotoRaw = sessionData ? sessionData['pendingPhoto'] : undefined;
                        if (pendingPhotoRaw && typeof pendingPhotoRaw === 'object') {
                            const pp = pendingPhotoRaw;
                            const created = pp.createdAt instanceof Date
                                ? pp.createdAt
                                : pp.createdAt?.toDate?.();
                            const expired = !created || Date.now() - created.getTime() > 5 * 60 * 1000;
                            if (expired) {
                                await sessionRef.set({ pendingPhoto: null }, { merge: true });
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, '⏱ La photo précédente a expiré (>5min). Renvoie-la stp.', companyId);
                                return;
                            }
                            const stores = pp.stores ?? [];
                            let picked;
                            const numMatch = t.match(/^\s*(\d{1,2})\s*$/);
                            if (numMatch) {
                                const idx = parseInt(numMatch[1], 10) - 1;
                                picked = stores[idx];
                            }
                            else {
                                const { detectStoreBusinessType } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                                const keyword = detectStoreBusinessType(t);
                                if (keyword)
                                    picked = stores.find(s => s.businessType === keyword);
                            }
                            if (!picked) {
                                if (cfg) {
                                    const lines = stores.map((s, i) => {
                                        const labelMap = {
                                            boutique: '🛍 Boutique', restaurant: '🍽 Restaurant', hotel: '🏨 Hôtel',
                                            service: '💇 Salon', health: '🏥 Cabinet', realestate: '🏠 Immobilier',
                                        };
                                        return `*${i + 1}.* ${labelMap[s.businessType] ?? s.businessType}`;
                                    });
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `Je n'ai pas compris 🤔\n\n${lines.join('\n')}\n\n_Réponds juste avec le numéro (ex. *1*) ou tape *annuler*._`, companyId);
                                }
                                if (/^(annuler|cancel|stop)/i.test(t)) {
                                    await sessionRef.set({ pendingPhoto: null }, { merge: true });
                                    if (cfg)
                                        await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, '👌 Annulé.', companyId);
                                }
                                return;
                            }
                            // Clear pendingPhoto + run upload on the picked store
                            await sessionRef.set({ pendingPhoto: null }, { merge: true });
                            if (!accessToken) {
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, '⚠️ Photo reçue mais impossible de la télécharger (config serveur).', companyId);
                                return;
                            }
                            if (cfg)
                                void whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `📸 OK, je l'ajoute à *${picked.name || picked.businessType}* — 10-15s…`, companyId);
                            try {
                                const { handleOwnerPhotoUpload } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                                const result = await handleOwnerPhotoUpload({
                                    companyId: ownerStore.companyId,
                                    storeId: picked.storeId,
                                    ownerPhone: incoming.from,
                                    imageId: pp.imageId ?? '',
                                    caption: pp.caption ?? '',
                                    accessToken,
                                });
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, result.reply, companyId);
                                logger_1.logger.info('[Commerce] Photo picker resolved → product created', {
                                    companyId: ownerStore.companyId, storeId: picked.storeId,
                                    type: picked.businessType, productId: result.productId,
                                });
                            }
                            catch (err) {
                                logger_1.logger.error('[Commerce] Photo picker upload failed', { error: err instanceof Error ? err.message : err });
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `❌ Erreur pendant la création. Renvoie la photo stp.`, companyId);
                            }
                            return;
                        }
                        // ── A. User is in awaiting_create_choice → expect "1" or "2" ──
                        if (pendingFlow === 'awaiting_create_choice') {
                            if (/^\s*1\s*$|^(photo|avec photo|📸)/i.test(t)) {
                                await setFlow(null); // photo path is handled by image intercept naturally
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `📸 Super 👍\n\nEnvoie-moi maintenant la photo du produit, avec en légende le *nom* et le *prix*.\n\nExemple :\n\`Chemise African - 5000\``, companyId);
                                logger_1.logger.info('[Commerce] Owner chose photo flow', { companyId: ownerStore.companyId });
                                return;
                            }
                            if (/^\s*2\s*$|^(manuel|manuellement|texte|✍️)/i.test(t)) {
                                await setFlow('awaiting_manual_details');
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `✍️ Parfait 👍\n\nDonne-moi en une seule ligne :\n*nom du produit*, *prix*, et *stock* (optionnel).\n\nExemple :\n\`Chemise African, 5000, stock 10\``, companyId);
                                logger_1.logger.info('[Commerce] Owner chose manual flow', { companyId: ownerStore.companyId });
                                return;
                            }
                            // Unrecognized response, gently re-ask
                            if (cfg)
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `Je n'ai pas compris 🤔\n\nRéponds juste *1* (photo) ou *2* (manuel).\n\nOu tape *annuler* pour arrêter.`, companyId);
                            if (/^(annuler|cancel|stop)/i.test(t)) {
                                await setFlow(null);
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `👌 Annulé.`, companyId);
                            }
                            return;
                        }
                        // ── B0. User is in awaiting_business_confirm → handle yes/no ──
                        // Owner previously asked something mutating ("relance les
                        // impayés"). We asked "tu veux que je m'en occupe ?" — now they
                        // reply oui/non.
                        if (pendingFlow === 'awaiting_business_confirm') {
                            const yesPattern = /^(oui|yes|ok|d'?accord|vas[\s-]?y|fais|go|🙏|👍)\b/i;
                            const noPattern = /^(non|no|annule|stop|cancel|laisse)/i;
                            if (yesPattern.test(t)) {
                                const sessionData2 = sessionSnap?.data();
                                const originalMsg = sessionData2?.pendingBusinessMessage;
                                if (!originalMsg) {
                                    await setFlow(null);
                                    if (cfg)
                                        await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, "🤔 Je n'ai pas retrouvé ta demande. Reformule-la stp.", companyId);
                                    return;
                                }
                                // Replace finalMessage with the original business request,
                                // mark forceOrchestrator, clear flow, fall through to the
                                // orchestrator brain.
                                finalMessage = originalMsg;
                                forceOrchestrator = true;
                                await setFlow(null);
                                logger_1.logger.info('[Commerce] Owner confirmed business action → escalating to Orchestrator', {
                                    companyId: ownerStore.companyId, original: originalMsg.slice(0, 80),
                                });
                                // Don't return — fall through to handleMessage below
                            }
                            else if (noPattern.test(t)) {
                                await setFlow(null);
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, "👌 Annulé. Si tu veux autre chose, dis-le simplement.", companyId);
                                return;
                            }
                            else {
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, "Je n'ai pas compris 🤔 Réponds *oui* pour valider ou *non* pour annuler.", companyId);
                                return;
                            }
                        }
                        // ── B. User is in awaiting_manual_details → parse "name, price, stock" ──
                        if (pendingFlow === 'awaiting_manual_details') {
                            if (/^(annuler|cancel|stop)/i.test(t)) {
                                await setFlow(null);
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `👌 Annulé.`, companyId);
                                return;
                            }
                            // Parse: "name, price [, stock X]" — flexible
                            // Try comma-separated first
                            const parts = finalMessage.split(',').map(s => s.trim()).filter(Boolean);
                            let parsedName = '';
                            let parsedPrice = 0;
                            let parsedStock = 1;
                            if (parts.length >= 2) {
                                parsedName = parts[0];
                                const priceMatch = parts[1].match(/(\d+(?:[.,\s]\d+)*)/);
                                if (priceMatch)
                                    parsedPrice = parseInt(priceMatch[1].replace(/[.,\s]/g, ''), 10);
                                if (parts[2]) {
                                    const stockMatch = parts[2].match(/(\d+)/);
                                    if (stockMatch)
                                        parsedStock = parseInt(stockMatch[1], 10);
                                }
                            }
                            if (!parsedName || !parsedPrice || isNaN(parsedPrice) || parsedPrice <= 0) {
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `🤔 Je n'ai pas pu lire les infos.\n\nFormat attendu :\n*nom*, *prix*, stock\n\nExemple :\n\`Chemise African, 5000, stock 10\`\n\n_Tape *annuler* pour arrêter._`, companyId);
                                return;
                            }
                            const { isOwnerSessionValid, startOwnerOtp, executeOwnerCommand } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                            const sessionOk = await isOwnerSessionValid(ownerStore.companyId, ownerStore.storeId, incoming.from);
                            if (!sessionOk) {
                                const code = await startOwnerOtp(ownerStore.companyId, ownerStore.storeId, incoming.from);
                                if (cfg)
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `🔒 Pour créer ton premier produit, envoie-moi ce code : *${code}*\n_(Valide 5 min, ensuite ta session reste 24h.)_`, companyId);
                                return;
                            }
                            const reply = await executeOwnerCommand(ownerStore.companyId, ownerStore.storeId, {
                                type: 'create_product',
                                productQuery: parsedName,
                                productPrice: parsedPrice,
                                productStock: parsedStock,
                            });
                            await setFlow(null);
                            if (cfg)
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `${reply}\n\n_Tu veux en ajouter un autre ? Tape *je veux ajouter un produit*._`, companyId);
                            logger_1.logger.info('[Commerce] Manual product created via conversational flow', {
                                companyId: ownerStore.companyId, name: parsedName, price: parsedPrice, stock: parsedStock,
                            });
                            return;
                        }
                        // ── C. No active flow — detect intent to start one ────────────
                        const isCreateIntent = /\b(je\s*veux|j'aimerais?|j'aimerai|je\s*voudrais|je\s*souhaite)\b.*\b(ajouter|cr[eé]er|publier|mettre|vendre)\b/i.test(t) ||
                            /\b(ajouter|publier)\b.*\b(produit|article|nouveau)\b/i.test(t);
                        const isManageIntent = /\b(comment|aide|help)\b.*\b(g[eé]rer|fonctionne|marche|utiliser)\b/i.test(t) ||
                            /^(aide|help|menu)\b/i.test(t);
                        logger_1.logger.info('[Commerce-Conv] intent-check', { isCreateIntent, isManageIntent });
                        if (isCreateIntent) {
                            // Detect target businessType (e.g. "ajoute au menu du resto" →
                            // 'restaurant'). Saved alongside pendingFlow so the photo
                            // handler can route the upload to the right store when the
                            // owner has activated multiple packs.
                            const { detectStoreBusinessType } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                            const targetType = detectStoreBusinessType(t);
                            await sessionRef.set({
                                pendingFlow: 'awaiting_create_choice',
                                pendingFlowAt: new Date(),
                                pendingProductBusinessType: targetType ?? null,
                                updatedAt: new Date(),
                            }, { merge: true });
                            if (cfg)
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `Parfait 👍 on va le créer ensemble.\n\nTu préfères :\n*1.* 📸 Avec une photo _(plus rapide)_\n*2.* ✍️ Manuellement\n\nRéponds juste *1* ou *2*.`, companyId);
                            logger_1.logger.info('[Commerce] Owner create intent → asking choice', {
                                companyId: ownerStore.companyId, targetType,
                            });
                            return;
                        }
                        if (isManageIntent) {
                            if (cfg)
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, `👋 Salut ! Pour gérer *${ownerStore.store.name}* depuis WhatsApp, dis-moi simplement ce que tu veux faire :\n\n• *ajouter un produit*\n• *voir mes commandes*\n• *modifier un prix*\n\nJe te guide étape par étape.`, companyId);
                            logger_1.logger.info('[Commerce] Owner help intent → conversational menu', { companyId: ownerStore.companyId });
                            return;
                        }
                    }
                }
                catch (err) {
                    logger_1.logger.warn('[Commerce] Conversational owner flow failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                }
            }
            // ── Commerce Agent: OTP code reply ───────────────────────────────────
            // If a 6-digit code is sent and an owner OTP is pending, verify it.
            if (incoming.type === 'text' && /^\s*\d{6}\s*$/.test(finalMessage)) {
                try {
                    const { verifyOwnerOtp, resumePendingProductPhoto } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                    const ownerStore = await getOwnerStore();
                    if (ownerStore) {
                        const code = finalMessage.trim();
                        const r = await verifyOwnerOtp(ownerStore.companyId, ownerStore.storeId, incoming.from, code);
                        if (r.ok) {
                            const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                            if (cfg) {
                                await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, '✅ Validé. Session valable 24h.', companyId);
                            }
                            // Resume any photo that triggered the OTP gate (real bug observed
                            // with Robe Kevin Klein 2026-05-21: photo was lost after PIN).
                            try {
                                const resume = await resumePendingProductPhoto({
                                    companyId: ownerStore.companyId,
                                    storeId: ownerStore.storeId,
                                    ownerPhone: incoming.from,
                                    accessToken,
                                });
                                if (resume?.reply && cfg) {
                                    await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, resume.reply, companyId);
                                    logger_1.logger.info('[Commerce] Resumed pending product photo after OTP', {
                                        companyId: ownerStore.companyId, storeId: ownerStore.storeId,
                                        productId: resume.productId,
                                    });
                                }
                            }
                            catch (err) {
                                logger_1.logger.warn('[Commerce] Resume pending photo failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                            }
                            logger_1.logger.info('[Commerce] Owner OTP verified', { companyId: ownerStore.companyId, storeId: ownerStore.storeId });
                            return;
                        }
                        // Wrong/expired — let orchestrator handle gracefully (don't error out)
                        const cfg = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                        const reasonMsg = r.reason === 'expired'
                            ? '⏰ Code expiré. Renvoie une photo pour redémarrer.'
                            : r.reason === 'too_many_attempts'
                                ? '🚫 Trop de tentatives. Réessaie dans quelques minutes.'
                                : '❌ Code incorrect. Vérifie et réessaie.';
                        if (cfg)
                            await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, reasonMsg, companyId);
                        return;
                    }
                }
                catch (err) {
                    logger_1.logger.warn('[Commerce] OTP check failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                }
            }
            // ── Cas: transcription vocale échouée → réponse de fallback claire ───
            // Sinon le user reste sans réponse (= "silent fail" perçu comme bug).
            // Intent-aware: vocal raté → "Je n'ai pas compris ton vocal" — explicite.
            if (transcriptionFailed) {
                try {
                    const fallbackText = incoming.type === 'audio'
                        ? "🎙️ J'ai bien reçu ton message vocal mais je n'ai pas pu le comprendre (audio inaudible, silence, ou problème réseau). Peux-tu réessayer en parlant plus clairement, ou m'écrire en texte ?"
                        : "Désolé, je n'ai pas pu traiter ton message. Peux-tu reformuler ?";
                    const cfg = await whatsappService_1.whatsappService.getConfig(companyId).catch(() => null);
                    if (cfg && accessToken && phoneNumberId) {
                        await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, fallbackText, companyId);
                        logger_1.logger.info('[WhatsApp] Sent transcription-fallback reply', { to: incoming.from, type: incoming.type });
                    }
                }
                catch (err) {
                    logger_1.logger.error('[WhatsApp] Fallback reply failed', { error: err });
                }
                return; // skip orchestrator — there's nothing to process
            }
            // ── Déclencher l'Agent Orlode ───────────────────────────────────────
            if (finalMessage) {
                try {
                    // ── Config WhatsApp de l'entreprise ───────────────────────────────
                    const config = await whatsappService_1.whatsappService.getConfig(companyId).catch(() => null);
                    // ── Load conversation history for this contact (last 10 messages) ──
                    let history = [];
                    try {
                        const historySnap = await db.collection(`companies/${companyId}/whatsappMessages`)
                            .where('from', '==', incoming.from)
                            .orderBy('createdAt', 'desc')
                            .limit(10)
                            .get();
                        history = historySnap.docs
                            .map(d => {
                            const data = d.data();
                            return {
                                role: (data['direction'] === 'inbound' ? 'user' : 'model'),
                                content: data['message'] ?? '',
                            };
                        })
                            .reverse(); // oldest first
                    }
                    catch { /* index may not exist yet — continue without history */ }
                    // ── Human Handoff check (before orchestrator) ────────────────────
                    // If the customer is asking for a human or showing frustration AND
                    // handoff is enabled with a notify channel, escalate to the team.
                    // We still let the AI reply with a "un humain te recontacte" message
                    // so the customer isn't left hanging.
                    const handoff = config?.humanHandoff;
                    // ── Conversation flow control ────────────────────────────────────
                    // Even if handoff was previously triggered, decide whether the AI
                    // should reply, stay silent (human is on it), or resume softly
                    // after a timeout. This is the state machine for handoff.
                    const handoffSvc = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/humanHandoffService')));
                    const flow = handoff?.enabled
                        ? await handoffSvc.decideConversationFlow(companyId, incoming.from)
                        : 'ai_should_run';
                    logger_1.logger.info('[Handoff] check', {
                        companyId,
                        enabled: !!handoff?.enabled,
                        hasChannel: !!handoff?.notifyChannelId,
                        threshold: handoff?.threshold,
                        flow,
                        messagePreview: finalMessage.slice(0, 80),
                    });
                    // If a human is actively handling this conversation, stay completely
                    // silent. The customer expects a human reply, not the bot interrupting.
                    if (flow === 'ai_blocked') {
                        logger_1.logger.info('[Handoff] AI blocked — human is on it', { companyId, from: incoming.from });
                        return; // skip orchestrator entirely; no auto-reply
                    }
                    let handoffTriggered = false;
                    let handoffReply = null;
                    let aiResumesSoftly = flow === 'ai_resumes_softly';
                    // Detection runs only if handoff is enabled and we're in the
                    // ai_should_run state (not on a soft-resume — that's a follow-up,
                    // not a fresh escalation).
                    if (handoff?.enabled && handoff.notifyChannelId && finalMessage && flow === 'ai_should_run') {
                        try {
                            const priorFrustration = handoff.threshold === 'sensitive'
                                ? 0
                                : await handoffSvc.recentFrustrationCount(companyId, incoming.from, 5);
                            const detection = handoffSvc.detectEscalationIntent(finalMessage, handoff.threshold ?? 'normal', priorFrustration);
                            logger_1.logger.info('[Handoff] detection result', {
                                triggered: detection.triggered,
                                reason: detection.reason,
                                matchedTerm: detection.matchedTerm,
                                priorFrustration,
                            });
                            if (detection.triggered && detection.reason) {
                                const recentMsgs = history.slice(-5).map(h => `${h.role === 'user' ? '👤' : '🤖'} ${h.content.slice(0, 200)}`);
                                await handoffSvc.notifyTeamOfEscalation({
                                    companyId,
                                    channelId: handoff.notifyChannelId,
                                    customerPhone: incoming.from,
                                    triggerMessage: finalMessage,
                                    reason: detection.reason,
                                    recentHistory: recentMsgs,
                                });
                                // Email the admins (best-effort, non-blocking)
                                handoffSvc.emailEscalationToAdmins({
                                    companyId,
                                    customerPhone: incoming.from,
                                    triggerMessage: finalMessage,
                                    reason: detection.reason,
                                    notifyEmails: handoff.notifyEmails,
                                }).catch(() => null);
                                // WhatsApp internal notif to admin numbers (best-effort)
                                const internalNumbers = handoff.notifyWhatsAppNumbers;
                                if (internalNumbers && internalNumbers.length > 0) {
                                    handoffSvc.notifyAdminsViaWhatsApp({
                                        companyId,
                                        recipients: internalNumbers,
                                        text: `🆘 Client en attente — ${detection.reason === 'explicit' ? 'demande humain' : 'frustré'}\n\n` +
                                            `Numéro : +${incoming.from}\n` +
                                            `Message : « ${finalMessage.slice(0, 200)} »\n\n` +
                                            `Réponds-lui directement, ou attends 5 min — l'IA reprendra.`,
                                    }).catch(() => null);
                                }
                                // Mark the conversation as actively handed off to a human.
                                await handoffSvc.setConversationStatus(companyId, incoming.from, 'handoff_active', {
                                    lastEscalationAt: new Date(),
                                    reason: detection.reason,
                                });
                                handoffTriggered = true;
                                handoffReply = handoff.customerReply
                                    ?? "Bien noté. Un humain de notre équipe va prendre le relais et te recontacter très vite. 🙏";
                                logger_1.logger.info('[WhatsApp] Handoff triggered', { companyId, from: incoming.from, reason: detection.reason });
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn('[WhatsApp] Handoff check failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                        }
                    }
                    // Soft-tone system prompt suffix when the AI is resuming after timeout.
                    const softResumeSuffix = aiResumesSoftly ? handoffSvc.SOFT_RESUME_PROMPT_SUFFIX : '';
                    // If handoff triggered, skip the orchestrator entirely and use the
                    // pre-defined customerReply. The team has been notified separately.
                    let replyText;
                    let extraMessages = [];
                    if (handoffTriggered && handoffReply) {
                        replyText = handoffReply;
                    }
                    else {
                        // If we're resuming softly after a handoff timeout, append the
                        // empathy + lead-capture instruction to the system prompt.
                        let effectiveSystemPrompt = aiResumesSoftly
                            ? `${config?.systemPrompt ?? ''}${softResumeSuffix}`
                            : config?.systemPrompt;
                        // ── Owner-aware Clone ───────────────────────────────────────────
                        // If the sender is the authenticated owner, inject context so the
                        // Clone treats them as admin (not as a customer). Avoids the bug
                        // where Clone says "Je n'ai pas de boutique" to its own owner.
                        try {
                            const ownerStoreCheck = await getOwnerStore();
                            if (ownerStoreCheck) {
                                const { isOwnerSessionValid } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                                const sessionOk = await isOwnerSessionValid(ownerStoreCheck.companyId, ownerStoreCheck.storeId, incoming.from);
                                const ownerSuffix = `\n\n## 🔑 CONTEXTE — TU PARLES AU PROPRIÉTAIRE DE L'ENTREPRISE\n` +
                                    `Le numéro ${incoming.from} est l'admin de ${ownerStoreCheck.store.name}.\n` +
                                    `Session OTP: ${sessionOk ? '✅ vérifiée (peut modifier les données)' : '❌ non vérifiée (lecture seule sans OTP)'}.\n\n` +
                                    `Comportement attendu :\n` +
                                    `- C'est SON entreprise. Réponds-lui directement, pas comme à un client externe.\n` +
                                    `- Pas de "Bonjour comment puis-je vous aider" — il sait pourquoi il écrit.\n` +
                                    `- Pas de pitch commercial, pas de présentation des services.\n` +
                                    `- Pour ses questions techniques (lien boutique, ses produits, ses commandes, ses ventes) — réponds factuellement avec les vraies données via les tools.\n` +
                                    `- Si tu n'as pas un tool pour répondre, dis-le honnêtement plutôt que d'inventer ou rediriger.\n` +
                                    `- Tutoiement direct, ton de partenaire/collègue.`;
                                effectiveSystemPrompt = `${effectiveSystemPrompt ?? ''}${ownerSuffix}`;
                                logger_1.logger.info('[WhatsApp] Owner-aware system prompt injected', {
                                    companyId: ownerStoreCheck.companyId, sessionOk,
                                });
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn('[WhatsApp] Owner-aware injection failed (non-blocking)', {
                                error: err instanceof Error ? err.message : err,
                            });
                        }
                        const { handleMessage } = await Promise.resolve().then(() => __importStar(require('../messaging')));
                        // ── PIN gate for ultra-sensitive owner actions ─────────────────
                        // Export tous clients, refund, suppression massive, rapport
                        // financier complet → exige PIN si pas déjà vérifié dans la
                        // session. Ce gate se déclenche AVANT le brain switch pour que
                        // ni Clone ni Orchestrator n'exécute sans validation.
                        try {
                            const { isUltraSensitive, verifyStorePin, isPinVerifiedInSession, markPinVerifiedInSession } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                            const ownerStorePin = await getOwnerStore();
                            if (ownerStorePin && isUltraSensitive(finalMessage)) {
                                const alreadyVerified = await isPinVerifiedInSession(ownerStorePin.companyId, ownerStorePin.storeId, incoming.from);
                                if (!alreadyVerified) {
                                    const cfgPin = await whatsappService_1.whatsappService.getConfig(ownerStorePin.companyId).catch(() => null);
                                    // If owner sent a 4-6 digit code RIGHT BEFORE this might be the PIN
                                    // — check if the message itself IS the PIN (rare case) or fall through to ask
                                    if (/^\s*\d{4,6}\s*$/.test(finalMessage)) {
                                        const ok = await verifyStorePin(ownerStorePin.companyId, ownerStorePin.storeId, finalMessage.trim());
                                        if (ok) {
                                            await markPinVerifiedInSession(ownerStorePin.companyId, ownerStorePin.storeId, incoming.from);
                                            if (cfgPin)
                                                await whatsappService_1.whatsappService.sendMessage(cfgPin, incoming.from, `✅ PIN validé. Reformule ta demande, je l'exécute maintenant.`, companyId);
                                            return;
                                        }
                                    }
                                    // No PIN — ask for it. Save the original message so the next
                                    // PIN reply can be matched and we re-execute the original ask.
                                    const phoneKeyPin = incoming.from.replace(/\D/g, '');
                                    await (0, firebase_config_1.getFirestore)()
                                        .doc(`companies/${ownerStorePin.companyId}/stores/${ownerStorePin.storeId}/sessions/${phoneKeyPin}`)
                                        .set({
                                        pendingPinFor: finalMessage,
                                        pendingPinAt: new Date(),
                                        updatedAt: new Date(),
                                    }, { merge: true });
                                    if (cfgPin) {
                                        const hasPinSet = !!ownerStorePin.store.pinHash;
                                        await whatsappService_1.whatsappService.sendMessage(cfgPin, incoming.from, hasPinSet
                                            ? `🔐 *Action sensible détectée* — tape ton PIN à 4-6 chiffres pour valider.\n\n_(Si tu l'as oublié, change-le dans /agents/commerce → Paramètres ou tape \`change pin XXXX\`.)_`
                                            : `🔐 *Action sensible* — tu n'as pas encore défini de PIN.\n\nTape : \`set pin 1234\` (4-6 chiffres) pour en créer un.\n_Tu seras protégé contre les modifications massives._`, companyId);
                                    }
                                    logger_1.logger.info('[Commerce] Ultra-sensitive action gated by PIN', {
                                        companyId: ownerStorePin.companyId, hasPinSet: !!ownerStorePin.store.pinHash,
                                    });
                                    return;
                                }
                            }
                            // Also: if user replied with a digit-only code AND there's a pending
                            // sensitive request, try the PIN
                            if (ownerStorePin && /^\s*\d{4,6}\s*$/.test(finalMessage)) {
                                const phoneKeyPin = incoming.from.replace(/\D/g, '');
                                const ssnap = await (0, firebase_config_1.getFirestore)()
                                    .doc(`companies/${ownerStorePin.companyId}/stores/${ownerStorePin.storeId}/sessions/${phoneKeyPin}`)
                                    .get().catch(() => null);
                                const pendingForReq = ssnap?.data()?.pendingPinFor;
                                if (pendingForReq) {
                                    const ok = await verifyStorePin(ownerStorePin.companyId, ownerStorePin.storeId, finalMessage.trim());
                                    const cfgPin2 = await whatsappService_1.whatsappService.getConfig(ownerStorePin.companyId).catch(() => null);
                                    if (ok) {
                                        await markPinVerifiedInSession(ownerStorePin.companyId, ownerStorePin.storeId, incoming.from);
                                        // Replace message with the original sensitive request and
                                        // force orchestrator brain (sensitive = needs full agent stack)
                                        finalMessage = pendingForReq;
                                        forceOrchestrator = true;
                                        await (0, firebase_config_1.getFirestore)()
                                            .doc(`companies/${ownerStorePin.companyId}/stores/${ownerStorePin.storeId}/sessions/${phoneKeyPin}`)
                                            .set({ pendingPinFor: null, pendingPinAt: null, updatedAt: new Date() }, { merge: true });
                                        if (cfgPin2)
                                            await whatsappService_1.whatsappService.sendMessage(cfgPin2, incoming.from, `✅ PIN validé. Je traite ta demande maintenant…`, companyId);
                                        // Fall through to orchestrator
                                    }
                                    else {
                                        if (cfgPin2)
                                            await whatsappService_1.whatsappService.sendMessage(cfgPin2, incoming.from, `❌ PIN incorrect. Réessaie ou tape \`change pin XXXX\` pour en redéfinir un.`, companyId);
                                        return;
                                    }
                                }
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn('[Commerce] PIN gate failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                        }
                        // ── @orlode / @<businessName> mention (Slack-style) ────────────
                        // Universal trigger that forces brain = 'orchestrator' and skips
                        // the "tu veux que je m'en occupe ?" confirmation (the @ mention
                        // IS the consent). Only honored for authenticated owner phones —
                        // anonymous visitors typing "@orlode" should NOT escalate.
                        try {
                            const { detectOrlodeMention } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                            const ownerStoreForMention = await getOwnerStore();
                            if (ownerStoreForMention) {
                                const companyDoc = await db.doc(`companies/${ownerStoreForMention.companyId}`).get().catch(() => null);
                                const companyName = companyDoc?.data()?.['name'] ?? undefined;
                                const storeSlug = ownerStoreForMention.store.slug;
                                const mention = detectOrlodeMention(finalMessage, {
                                    companyName,
                                    storeSlugs: storeSlug ? [storeSlug] : [],
                                });
                                if (mention.matched) {
                                    // "@admin" / "@orlode" alone → toggle Admin Chat Mode ON.
                                    // From this point, every message from this owner phone
                                    // bypasses the Clone and goes straight to the Orchestrator
                                    // (full agent roster) — like the /chat web cockpit but on
                                    // WhatsApp. Mode auto-expires after 30 min of inactivity.
                                    if (!mention.stripped || mention.stripped.length < 2) {
                                        const phoneKeyAM = incoming.from.replace(/\D/g, '');
                                        await db
                                            .doc(`companies/${ownerStoreForMention.companyId}/stores/${ownerStoreForMention.storeId}/sessions/${phoneKeyAM}`)
                                            .set({
                                            adminChatMode: true,
                                            adminChatModeAt: new Date(),
                                            updatedAt: new Date(),
                                        }, { merge: true });
                                        const cfgAM = await whatsappService_1.whatsappService.getConfig(ownerStoreForMention.companyId).catch(() => null);
                                        if (cfgAM) {
                                            await whatsappService_1.whatsappService.sendMessage(cfgAM, incoming.from, `🔓 *Mode admin activé* — ${ownerStoreForMention.store.name}\n\n` +
                                                `Tu es maintenant connecté directement à l'orchestrator (comme sur le /chat web). Toutes tes questions vont aux agents IA, pas au clone client.\n\n` +
                                                `Demande ce que tu veux :\n` +
                                                `• _mes ventes_, _combien de stores_, _mon stock_\n` +
                                                `• _envoie une promo_, _relance les impayés_\n` +
                                                `• _ajouter un produit_, _modifier un prix_\n\n` +
                                                `Tape *fin* ou *quit* pour sortir du mode admin.`, companyId);
                                        }
                                        logger_1.logger.info('[WhatsApp] Admin Chat Mode ON', {
                                            companyId, from: incoming.from,
                                        });
                                        return;
                                    }
                                    // "@admin <command>" → one-shot orchestrator without
                                    // toggling mode (keeps current session behavior).
                                    finalMessage = mention.stripped;
                                    forceOrchestrator = true;
                                    logger_1.logger.info('[WhatsApp] @mention → Orchestrator (skip confirm)', {
                                        companyId, from: incoming.from, preview: finalMessage.slice(0, 80),
                                    });
                                }
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn('[WhatsApp] mention detection failed (non-blocking)', { error: err instanceof Error ? err.message : err });
                        }
                        // ── Brain switch (Clone → Orchestrator) ────────────────────────
                        // Default for whatsapp = 'clone' (customer-facing). But if the
                        // sender is the authenticated owner AND the message is a
                        // business task (relance impayés, campagne, recrutement…), route
                        // to the Orchestrator with the full agent roster.
                        //
                        // Mutating actions (envoie, relance, publie, …) require explicit
                        // owner confirmation FIRST. We send "tu veux que je m'en occupe?"
                        // and route to Orchestrator only after owner replies "oui".
                        //
                        // Read-only intents (résume, analyse, liste) bypass the confirm
                        // step — safe to run immediately.
                        //
                        // forceOrchestrator = true means owner JUST confirmed a previously
                        // pending action — we replay it through Orchestrator without
                        // re-asking.
                        let brain = 'clone';
                        try {
                            if (forceOrchestrator) {
                                brain = 'orchestrator';
                            }
                            else {
                                const { detectBusinessIntent, isMutatingBusinessAction } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
                                const ownerStore = await getOwnerStore();
                                if (ownerStore && detectBusinessIntent(finalMessage)) {
                                    if (isMutatingBusinessAction(finalMessage)) {
                                        // Save pending + ask confirmation, skip handleMessage
                                        const phoneKey = incoming.from.replace(/\D/g, '');
                                        const sessionRef = (0, firebase_config_1.getFirestore)()
                                            .doc(`companies/${ownerStore.companyId}/stores/${ownerStore.storeId}/sessions/${phoneKey}`);
                                        await sessionRef.set({
                                            pendingFlow: 'awaiting_business_confirm',
                                            pendingFlowAt: new Date(),
                                            pendingBusinessMessage: finalMessage,
                                            updatedAt: new Date(),
                                        }, { merge: true });
                                        const cfg2 = await whatsappService_1.whatsappService.getConfig(ownerStore.companyId).catch(() => null);
                                        if (cfg2) {
                                            await whatsappService_1.whatsappService.sendMessage(cfg2, incoming.from, `J'ai détecté une action sur ton business 👇\n\n_"${finalMessage}"_\n\nTu veux que je m'en occupe maintenant ? *oui* ou *non*.`, companyId);
                                        }
                                        logger_1.logger.info('[WhatsApp] Mutating business intent → asking owner confirmation', {
                                            companyId, from: incoming.from, preview: finalMessage.slice(0, 80),
                                        });
                                        return; // wait for confirmation, no handleMessage call
                                    }
                                    // Read-only business intent — go straight to Orchestrator
                                    brain = 'orchestrator';
                                    logger_1.logger.info('[WhatsApp] Owner read-only business intent → Orchestrator brain', {
                                        companyId, from: incoming.from, preview: finalMessage.slice(0, 80),
                                    });
                                }
                            }
                        }
                        catch { /* fall through to clone */ }
                        const msgResult = await handleMessage({
                            text: finalMessage,
                            from: incoming.from,
                            channel: 'whatsapp',
                            wasVoice: incoming.type === 'audio',
                            providerMeta: { phoneNumberId, messageId: incoming.messageId },
                        }, {
                            companyId,
                            history,
                            language: config?.language ?? 'fr',
                            customSystemPrompt: effectiveSystemPrompt,
                            fastReply: true,
                            brain,
                        });
                        replyText = msgResult.messages[0] ?? 'Je n\'ai pas pu traiter votre demande.';
                        extraMessages = msgResult.messages.slice(1);
                        // After a successful soft-resume reply, mark the conversation as
                        // resolved so the AI keeps responding normally going forward
                        // (until the user re-escalates).
                        if (aiResumesSoftly) {
                            await handoffSvc.setConversationStatus(companyId, incoming.from, 'handoff_resolved', {
                                resumedAt: new Date(),
                            });
                        }
                    }
                    const phoneId = phoneNumberId ?? '';
                    const token = accessToken;
                    const fakeConfig = config ?? {
                        accessToken: token, phoneNumberId: phoneId,
                        businessAccountId: process.env['WHATSAPP_BUSINESS_ACCOUNT_ID'] ?? '',
                        webhookVerifyToken: '',
                        autoReply: true, replyMode: 'auto',
                        ttsVoice: 'alloy', language: 'fr',
                    };
                    // ── Réponse selon replyMode ───────────────────────────────────────
                    const mode = fakeConfig.replyMode ?? 'auto';
                    const useVoice = mode === 'voice' || (mode === 'auto' && incoming.type === 'audio');
                    if (useVoice) {
                        await whatsappService_1.whatsappService.sendVoiceReply(fakeConfig, incoming.from, replyText, companyId);
                    }
                    else {
                        await whatsappService_1.whatsappService.sendMessage(fakeConfig, incoming.from, replyText, companyId);
                        // Send extra parts if the response was split (validate() returned an array)
                        for (const extra of extraMessages) {
                            await whatsappService_1.whatsappService.sendMessage(fakeConfig, incoming.from, extra, companyId);
                        }
                    }
                    // Marquer comme traité
                    const msgs = await db.collection(`companies/${companyId}/whatsappMessages`)
                        .where('from', '==', incoming.from)
                        .where('processed', '==', false)
                        .orderBy('createdAt', 'desc').limit(1).get();
                    msgs.docs[0]?.ref.update({ processed: true, agentReply: replyText });
                    logger_1.logger.info('[WhatsApp] Agent replied', { to: incoming.from, type: incoming.type === 'audio' ? 'voice' : 'text' });
                }
                catch (err) {
                    logger_1.logger.error('[WhatsApp] Agent processing failed', { error: err });
                }
            }
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] Webhook processing failed', { error: err });
        }
    });
}));
// ── Webhook par companyId (legacy — gardé pour compatibilité) ─────────────────
router.get('/webhook/:companyId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const { companyId } = req.params;
    const config = await whatsappService_1.whatsappService.getConfig(companyId);
    if (mode === 'subscribe' && config && token === config.webhookVerifyToken) {
        res.status(200).send(challenge);
    }
    else {
        res.status(403).send('Forbidden');
    }
}));
router.post('/webhook/:companyId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    res.status(200).send('OK');
    const { companyId } = req.params;
    const incoming = whatsappService_1.whatsappService.parseWebhook(req.body);
    if (!incoming || !incoming.message)
        return;
    setImmediate(async () => {
        try {
            await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappMessages`).add({
                direction: 'inbound', from: incoming.from, message: incoming.message,
                type: incoming.type, timestamp: new Date(incoming.timestamp), processed: false, createdAt: new Date(),
            });
        }
        catch (err) {
            logger_1.logger.error('[WhatsApp] Failed to save incoming message (per-company)', { error: err });
        }
    });
}));
// ── Public route: Cloud Scheduler cron tick ──────────────────────────────────
// Must be defined BEFORE the auth middleware below so Cloud Scheduler can hit
// it without a Firebase ID token. Auth here is a shared secret in the header.
router.post('/handoff/cron-tick', async (req, res) => {
    const secret = process.env['CRON_SECRET'];
    const provided = req.header('x-cron-secret');
    if (!secret || !provided || secret !== provided) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const [{ processTimeoutCron }, { processAutoBroadcastRules }, { processScheduledPostsCron }] = await Promise.all([
            Promise.resolve().then(() => __importStar(require('../services/whatsapp/humanHandoffService'))),
            Promise.resolve().then(() => __importStar(require('../services/whatsapp/autoBroadcastService'))),
            Promise.resolve().then(() => __importStar(require('../services/social/socialPublishService'))),
        ]);
        const [handoffStats, autoStats, socialStats] = await Promise.all([
            processTimeoutCron(),
            processAutoBroadcastRules(),
            processScheduledPostsCron(),
        ]);
        return res.json({ success: true, data: { handoff: handoffStats, autoBroadcast: autoStats, socialPosts: socialStats } });
    }
    catch (err) {
        logger_1.logger.error('[Cron] tick failed', { error: String(err) });
        return res.status(500).json({ success: false, message: err?.message ?? 'Cron failed' });
    }
});
// ── Routes protégées (admin) ──────────────────────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
router.use(adminOnly_middleware_1.adminOnlyMiddleware);
// GET /api/whatsapp/status — statut de la connexion
router.get('/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const config = await whatsappService_1.whatsappService.getConfig(companyId);
    // Fetch live phone metadata if missing or older than 24h. Best-effort —
    // never block the /status response if Meta is slow or unreachable.
    let displayPhoneNumber = config?.displayPhoneNumber ?? null;
    let verifiedName = config?.verifiedName ?? null;
    if (config && (!config.displayPhoneNumber || isStaleTimestamp(config.phoneInfoFetchedAt, 24 * 3600 * 1000))) {
        const info = await whatsappService_1.whatsappService.fetchPhoneInfo(companyId);
        if (info) {
            displayPhoneNumber = info.displayPhoneNumber;
            verifiedName = info.verifiedName;
        }
    }
    res.json({
        success: true,
        data: {
            connected: !!config,
            phoneNumberId: config?.phoneNumberId ?? null,
            phoneNumber: displayPhoneNumber,
            displayPhoneNumber,
            verifiedName,
            businessAccountId: config?.businessAccountId ?? null,
            coexistenceMode: config?.coexistenceMode ?? false,
            settings: config ? {
                autoReply: config.autoReply ?? true,
                replyMode: config.replyMode ?? 'auto',
                ttsVoice: config.ttsVoice ?? 'Fable',
                language: config.language ?? 'fr',
                systemPrompt: config.systemPrompt ?? null,
                personaId: config.personaId ?? 'pro',
                humanHandoff: config.humanHandoff ?? null,
            } : null,
        },
    });
}));
function isStaleTimestamp(ts, maxAgeMs) {
    if (!ts)
        return true;
    const ms = ts?._seconds ? ts._seconds * 1000 : (ts instanceof Date ? ts.getTime() : 0);
    if (!ms)
        return true;
    return Date.now() - ms > maxAgeMs;
}
// POST /api/whatsapp/connect — connecter WhatsApp (manuel ou Embedded Signup)
router.post('/connect', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { accessToken, phoneNumberId, businessAccountId } = req.body;
    if (!accessToken || !phoneNumberId || !businessAccountId) {
        throw new error_middleware_1.AppError('accessToken, phoneNumberId, and businessAccountId are required', 400);
    }
    await whatsappService_1.whatsappService.saveConfig(companyId, {
        accessToken, phoneNumberId, businessAccountId,
        autoReply: true, replyMode: 'auto', ttsVoice: 'alloy', language: 'fr',
    });
    res.json({ success: true, message: 'WhatsApp connecté avec succès' });
}));
// POST /api/whatsapp/embedded-signup — exchange Facebook code for WhatsApp credentials
router.post('/embedded-signup', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { code, redirectUri, mode } = req.body;
    const coexistenceMode = mode === 'coexistence';
    // eslint-disable-next-line no-console
    console.log('[WhatsApp embedded-signup] Received', { companyId, hasCode: !!code, codePrefix: code?.slice(0, 10), mode: coexistenceMode ? 'coexistence' : 'classic', bodyKeys: Object.keys(req.body ?? {}) });
    if (!code)
        throw new error_middleware_1.AppError('Facebook auth code required — did the Facebook popup close without granting permission?', 400);
    // META_APP_ID / META_APP_SECRET refer to the same Facebook App that hosts
    // WhatsApp. Many envs configure the same value as WHATSAPP_APP_ID /
    // WHATSAPP_APP_SECRET (or use VITE_META_APP_ID for the client) — accept all.
    const META_APP_ID = process.env['META_APP_ID']
        ?? process.env['WHATSAPP_APP_ID']
        ?? process.env['VITE_META_APP_ID']
        ?? process.env['FACEBOOK_APP_ID']
        ?? '';
    const META_APP_SECRET = process.env['META_APP_SECRET']
        ?? process.env['WHATSAPP_APP_SECRET']
        ?? process.env['FACEBOOK_APP_SECRET']
        ?? '';
    if (!META_APP_ID || !META_APP_SECRET) {
        const missing = [];
        if (!META_APP_ID)
            missing.push('META_APP_ID (or WHATSAPP_APP_ID)');
        if (!META_APP_SECRET)
            missing.push('META_APP_SECRET (or WHATSAPP_APP_SECRET)');
        throw new error_middleware_1.AppError(`Meta App not configured. Missing: ${missing.join(', ')}.`, 500);
    }
    // 1. Exchange code for access token.
    // For JS SDK FB.login() flow, redirect_uri MUST be omitted (Meta requirement).
    // For server-side OAuth redirect flow, redirect_uri must match the original.
    // We try without redirect_uri first (JS SDK flow); if it fails, retry with redirect_uri.
    let tokenData = {};
    const buildUrl = (withRedirect) => {
        const params = new URLSearchParams({
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            code,
        });
        if (withRedirect)
            params.set('redirect_uri', withRedirect);
        return `https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`;
    };
    // Attempt 1: JS SDK flow (no redirect_uri)
    const tokenRes1 = await fetch(buildUrl());
    tokenData = await tokenRes1.json();
    // eslint-disable-next-line no-console
    console.log('[WhatsApp embedded-signup] Token exchange (no redirect)', { ok: !!tokenData.access_token, error: tokenData.error });
    if (!tokenData.access_token && redirectUri) {
        // Attempt 2: server-side OAuth flow (with redirect_uri)
        const tokenRes2 = await fetch(buildUrl(redirectUri));
        tokenData = await tokenRes2.json();
        // eslint-disable-next-line no-console
        console.log('[WhatsApp embedded-signup] Token exchange (with redirect)', { ok: !!tokenData.access_token, redirect: redirectUri, error: tokenData.error });
    }
    if (!tokenData.access_token) {
        // eslint-disable-next-line no-console
        console.error('[WhatsApp embedded-signup] Token exchange failed (both modes)', { companyId, fbError: tokenData.error, redirectUri });
        throw new error_middleware_1.AppError(tokenData.error?.message ?? 'Failed to exchange code', 400);
    }
    // 2. Get WhatsApp Business Account ID
    const debugRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${tokenData.access_token}&access_token=${META_APP_ID}|${META_APP_SECRET}`);
    const debugData = await debugRes.json();
    // eslint-disable-next-line no-console
    console.log('[WhatsApp embedded-signup] debug_token response', JSON.stringify(debugData, null, 2));
    const waScope = debugData.data?.granular_scopes?.find(s => s.scope === 'whatsapp_business_management');
    let businessAccountId = waScope?.target_ids?.[0] ?? '';
    // Fallback: try /me/businesses if no target_ids in granular_scopes
    if (!businessAccountId) {
        const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${tokenData.access_token}`);
        const bizData = await bizRes.json();
        // eslint-disable-next-line no-console
        console.log('[WhatsApp embedded-signup] /me/businesses fallback', JSON.stringify(bizData, null, 2));
        if (bizData.data && bizData.data.length > 0) {
            // For each business, list owned WABA
            for (const biz of bizData.data) {
                const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${tokenData.access_token}`);
                const wabaData = await wabaRes.json();
                if (wabaData.data && wabaData.data.length > 0) {
                    businessAccountId = wabaData.data[0].id;
                    break;
                }
            }
        }
    }
    if (!businessAccountId) {
        const grantedScopes = debugData.data?.scopes?.join(', ') ?? 'aucun';
        throw new error_middleware_1.AppError(`Aucune WhatsApp Business Account trouvée. Permissions accordées: [${grantedScopes}]. Vérifiez que vous avez bien sélectionné un WABA dans la popup Facebook et accordé "whatsapp_business_management".`, 400);
    }
    // 3. Get phone number ID from the business account
    const phonesRes = await fetch(`https://graph.facebook.com/v21.0/${businessAccountId}/phone_numbers`, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const phonesData = await phonesRes.json();
    const phoneNumberId = phonesData.data?.[0]?.id ?? '';
    const displayPhone = phonesData.data?.[0]?.display_phone_number ?? '';
    if (!phoneNumberId) {
        throw new error_middleware_1.AppError('No phone number found in this WhatsApp Business Account', 400);
    }
    // 4. Subscribe the app to the webhook
    await fetch(`https://graph.facebook.com/v21.0/${businessAccountId}/subscribed_apps`, { method: 'POST', headers: { Authorization: `Bearer ${tokenData.access_token}` } }).catch(() => { });
    // 5. Register the phone number with Cloud API.
    // CLASSIC MODE → /register migrates the number to the API (the WhatsApp
    // Business app on the user's phone stops working).
    // COEXISTENCE MODE → SKIP /register. The number stays on the user's phone
    // app AND the Cloud API can send/receive in parallel. Required for the
    // "keep your existing WhatsApp Business app" promise.
    const REGISTER_PIN = '124578';
    let registerStatus = { success: false, message: '' };
    if (coexistenceMode) {
        registerStatus = { success: true, message: 'Mode coexistence — /register sauté, le numéro reste actif sur votre WhatsApp Business app.' };
    }
    else {
        try {
            const regRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', pin: REGISTER_PIN }),
            });
            const regData = await regRes.json();
            // eslint-disable-next-line no-console
            console.log('[WhatsApp embedded-signup] /register response', JSON.stringify(regData, null, 2));
            if (regData.success) {
                registerStatus = { success: true, message: `Numéro enregistré avec PIN ${REGISTER_PIN}` };
            }
            else {
                registerStatus = { success: false, message: regData.error?.message ?? 'Échec enregistrement Cloud API' };
            }
        }
        catch (err) {
            registerStatus = { success: false, message: `Échec /register : ${err.message ?? String(err)}` };
        }
    }
    // 6. Save config — include coexistenceMode so we can show a badge later
    // and adjust API behavior (some templates / features differ in coexistence).
    await whatsappService_1.whatsappService.saveConfig(companyId, {
        accessToken: tokenData.access_token,
        phoneNumberId,
        businessAccountId,
        autoReply: true, replyMode: 'auto', ttsVoice: 'alloy', language: 'fr',
        coexistenceMode,
    });
    // 6b. Register this number in the platform-wide business numbers index so
    // the bot-to-bot loop guard skips replies to other Orlode-connected numbers.
    try {
        const fromDigits = (displayPhone ?? '').replace(/\D/g, '');
        if (fromDigits) {
            await (0, firebase_config_1.getFirestore)().collection('_platformBusinessNumbers').doc(fromDigits).set({
                companyId,
                phoneNumberId,
                displayPhone,
                registeredAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
    }
    catch (err) {
        logger_1.logger.warn('[WhatsApp] Failed to register business number in platform index', { error: err });
    }
    logger_1.logger.info(`[WhatsApp] Embedded Signup complete for company ${companyId}: ${displayPhone} | mode=${coexistenceMode ? 'coexistence' : 'classic'} | register=${registerStatus.success}`);
    const baseMsg = `WhatsApp connecté : ${displayPhone}`;
    const modeMsg = coexistenceMode ? ' · mode coexistence (votre app reste active)' : (registerStatus.success ? ` (enregistré, PIN: ${REGISTER_PIN})` : ` — ⚠️ ${registerStatus.message}`);
    res.json({
        success: true,
        data: { phoneNumberId, businessAccountId, displayPhone, coexistenceMode, registered: registerStatus.success, registerNote: registerStatus.message },
        message: baseMsg + modeMsg,
    });
}));
// POST /api/whatsapp/register-phone — register/re-register the phone number with Cloud API
// Required if the user changed the PIN, or if initial register failed
router.post('/register-phone', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { pin, dataLocalizationRegion } = req.body;
    const cfg = await whatsappService_1.whatsappService.getConfig(companyId);
    if (!cfg)
        throw new error_middleware_1.AppError('WhatsApp non connecté', 400);
    const PIN = pin ?? '124578';
    const region = dataLocalizationRegion ? String(dataLocalizationRegion).toUpperCase() : undefined;
    if (region && !/^[A-Z]{2}$/.test(region)) {
        throw new error_middleware_1.AppError('dataLocalizationRegion doit être un code ISO 2 lettres (ex: DE, FR, GB)', 400);
    }
    const result = await whatsappService_1.whatsappService.registerPhoneNumber(cfg, PIN, region);
    if (result.success) {
        res.json({
            success: true,
            message: `Numéro ${cfg.phoneNumberId} enregistré avec PIN ${PIN}${region ? ` (région: ${region})` : ''}.`,
            dataLocalizationRegion: region ?? null,
        });
    }
    else {
        throw new error_middleware_1.AppError(result.error ?? 'Échec enregistrement', 400);
    }
}));
// ──────────────────────────────────────────────────────────────────────────
// MANUAL VERIFICATION FLOW (Solution Partner / programmatic enrollment)
// 3 steps: request-code → verify-code → register-phone (existing)
// ──────────────────────────────────────────────────────────────────────────
// POST /api/whatsapp/request-code — Step 1: ask Meta to send SMS/VOICE OTP
// body: { phoneNumberId, codeMethod: 'SMS'|'VOICE', language?: string, accessToken?: string }
router.post('/request-code', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const codeMethod = (body.codeMethod ?? 'SMS').toUpperCase();
    const language = body.language ?? 'fr';
    // Use stored config if not provided in body
    let phoneNumberId = body.phoneNumberId;
    let accessToken = body.accessToken;
    if (!phoneNumberId || !accessToken) {
        const cfg = await whatsappService_1.whatsappService.getConfig(companyId);
        if (!cfg)
            throw new error_middleware_1.AppError('WhatsApp non configuré : fournissez phoneNumberId + accessToken', 400);
        phoneNumberId = phoneNumberId ?? cfg.phoneNumberId;
        if (!accessToken) {
            const { decrypt } = await Promise.resolve().then(() => __importStar(require('../config/encryption')));
            accessToken = decrypt(cfg.accessToken);
        }
    }
    if (!phoneNumberId || !accessToken)
        throw new error_middleware_1.AppError('phoneNumberId et accessToken requis', 400);
    if (!['SMS', 'VOICE'].includes(codeMethod))
        throw new error_middleware_1.AppError('codeMethod doit être SMS ou VOICE', 400);
    try {
        const r = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/request_code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code_method: codeMethod, language }),
        });
        const data = await r.json();
        if (!r.ok || data.error) {
            const code = Number(data?.error?.code ?? 0);
            const raw = data?.error?.message ?? data?.error?.error_user_msg ?? 'Échec request_code';
            let friendly = raw;
            let httpCode = 400;
            if (code === 133008) {
                friendly = 'Numéro bloqué par Meta (cooldown 24-72h) — trop de demandes consécutives.';
                httpCode = 429;
            }
            else if (code === 133009) {
                friendly = 'Limite quotidienne de demandes de code atteinte.';
                httpCode = 429;
            }
            else if (code === 133010)
                friendly = 'Numéro déjà enregistré sur Cloud API. Passe directement à l\'étape PIN ou désenregistre d\'abord.';
            else if (code === 190) {
                friendly = 'Access token expiré ou invalide.';
                httpCode = 401;
            }
            else if (code === 100)
                friendly = `Paramètres invalides : ${raw}`;
            logger_1.logger.warn('[WhatsApp] request_code error', { phoneNumberId, code, raw });
            throw new error_middleware_1.AppError(friendly, httpCode);
        }
        logger_1.logger.info(`[WhatsApp] request_code OK for ${phoneNumberId} (${codeMethod}/${language})`);
        res.json({ success: true, message: `Code ${codeMethod} envoyé. Le client va recevoir un OTP à 6 chiffres.` });
    }
    catch (e) {
        if (e instanceof error_middleware_1.AppError)
            throw e;
        throw new error_middleware_1.AppError(`Échec request_code : ${e?.message ?? String(e)}`, 500);
    }
}));
// POST /api/whatsapp/verify-code — Step 2: submit the 6-digit OTP received by client
// body: { phoneNumberId, code, accessToken? }
router.post('/verify-code', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const body = req.body;
    const code = (body.code ?? '').trim();
    if (!/^\d{6}$/.test(code))
        throw new error_middleware_1.AppError('code doit être 6 chiffres', 400);
    let phoneNumberId = body.phoneNumberId;
    let accessToken = body.accessToken;
    if (!phoneNumberId || !accessToken) {
        const cfg = await whatsappService_1.whatsappService.getConfig(companyId);
        if (!cfg)
            throw new error_middleware_1.AppError('WhatsApp non configuré', 400);
        phoneNumberId = phoneNumberId ?? cfg.phoneNumberId;
        if (!accessToken) {
            const { decrypt } = await Promise.resolve().then(() => __importStar(require('../config/encryption')));
            accessToken = decrypt(cfg.accessToken);
        }
    }
    if (!phoneNumberId || !accessToken)
        throw new error_middleware_1.AppError('phoneNumberId et accessToken requis', 400);
    try {
        const r = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/verify_code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
        });
        const data = await r.json();
        if (!r.ok || data.error) {
            // Meta verify_code error codes:
            //  133005 → invalid code        133006 → expired
            //  133007 → too many attempts   133008 → number banned (24-72h cooldown)
            //  133009 → reached max requests for the day
            //  100   → bad parameters       190    → token expired/invalid
            const code = Number(data?.error?.code ?? 0);
            const sub = Number(data?.error?.error_subcode ?? 0);
            const raw = data?.error?.message ?? data?.error?.error_user_msg ?? '';
            let friendly = raw;
            let httpCode = 400;
            if (code === 133005)
                friendly = 'Code invalide. Vérifie les 6 chiffres reçus par SMS/Voice.';
            else if (code === 133006)
                friendly = 'Code expiré. Demande un nouveau code (Étape 1).';
            else if (code === 133007)
                friendly = 'Trop de tentatives échouées. Patiente avant de réessayer.';
            else if (code === 133008) {
                friendly = 'Numéro temporairement bloqué par Meta (24-72h). Trop de demandes répétées — attends ou contacte le support Meta.';
                httpCode = 429;
            }
            else if (code === 133009) {
                friendly = 'Limite quotidienne de demandes atteinte. Réessaie demain.';
                httpCode = 429;
            }
            else if (code === 190) {
                friendly = 'Access token expiré ou invalide. Reconnecte le compte Meta.';
                httpCode = 401;
            }
            else if (code === 100)
                friendly = `Paramètres invalides : ${raw}`;
            logger_1.logger.warn('[WhatsApp] verify_code error', { phoneNumberId, code, sub, raw });
            throw new error_middleware_1.AppError(friendly || 'Échec verify_code', httpCode);
        }
        logger_1.logger.info(`[WhatsApp] verify_code OK for ${phoneNumberId}`);
        res.json({
            success: true,
            message: 'Code vérifié. Étape suivante : appelez /register-phone avec un PIN pour activer le numéro.',
        });
    }
    catch (e) {
        if (e instanceof error_middleware_1.AppError)
            throw e;
        throw new error_middleware_1.AppError(`Échec verify_code : ${e?.message ?? String(e)}`, 500);
    }
}));
// DELETE /api/whatsapp/disconnect
router.delete('/disconnect', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await whatsappService_1.whatsappService.disconnect(companyId);
    res.json({ success: true, message: 'WhatsApp déconnecté' });
}));
// POST /api/whatsapp/send — envoyer un message test
router.post('/send', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const config = await whatsappService_1.whatsappService.getConfig(companyId);
    if (!config)
        throw new error_middleware_1.AppError('WhatsApp non connecté', 400);
    const { to, message } = req.body;
    if (!to || !message)
        throw new error_middleware_1.AppError('to and message are required', 400);
    // sendMessage now persists outbound when companyId is provided — the inbox
    // sees the message immediately without us needing a duplicate write here.
    const messageId = await whatsappService_1.whatsappService.sendMessage(config, to, message, companyId, 'admin-inbox');
    res.json({ success: true, data: { messageId } });
}));
// POST /api/whatsapp/send-image — upload an image + optional caption, send
// via Meta. Body: { to, imageBase64, imageMimeType, caption? }.
// 1. Save base64 → Firebase Storage as a public URL
// 2. Send via Meta with type=image
// 3. Persist outbound as direction='outbound' with `mediaUrl` so the inbox
//    can render the thumbnail in the conversation pane.
router.post('/send-image', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const config = await whatsappService_1.whatsappService.getConfig(companyId);
    if (!config)
        throw new error_middleware_1.AppError('WhatsApp non connecté', 400);
    const { to, imageBase64, imageMimeType, caption } = req.body;
    if (!to || !imageBase64)
        throw new error_middleware_1.AppError('to and imageBase64 required', 400);
    const { getStorage } = await Promise.resolve().then(() => __importStar(require('../config/firebase.config')));
    const buffer = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
    if (buffer.length > 5 * 1024 * 1024)
        throw new error_middleware_1.AppError('Image trop lourde (max 5 Mo).', 413);
    const mime = imageMimeType ?? 'image/jpeg';
    const ext = mime.split('/')[1]?.split('+')[0] ?? 'jpg';
    const { randomBytes } = await Promise.resolve().then(() => __importStar(require('crypto')));
    const fileName = `companies/${companyId}/inbox-media/${randomBytes(8).toString('hex')}.${ext}`;
    const bucket = getStorage().bucket();
    await bucket.file(fileName).save(buffer, { metadata: { contentType: mime }, public: true });
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    const messageId = await whatsappService_1.whatsappService.sendImage(config, to, imageUrl, caption);
    if (!messageId)
        throw new error_middleware_1.AppError("Meta n'a pas accepté l'image (24h window ? Domain whitelist ?)", 502);
    // Persist outbound — body holds the caption (or a placeholder), mediaUrl
    // is the resolvable Storage URL so the inbox UI can render the thumbnail.
    try {
        await (0, firebase_config_1.getFirestore)()
            .collection(`companies/${companyId}/whatsappMessages`)
            .add({
            direction: 'outbound',
            to: String(to),
            body: caption ?? '[image]',
            mediaUrl: imageUrl,
            mediaType: 'image',
            messageId,
            waMessageId: messageId,
            processed: true,
            sentFrom: 'admin-inbox',
            createdAt: new Date(),
        });
    }
    catch { /* non-blocking */ }
    res.json({ success: true, data: { messageId, imageUrl } });
}));
// PATCH /api/whatsapp/settings — paramètres conversation (voix, mode, langue, prompt, persona, handoff)
router.patch('/settings', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { autoReply, replyMode, ttsVoice, language, systemPrompt, personaId, humanHandoff } = req.body;
    await whatsappService_1.whatsappService.updateSettings(companyId, {
        autoReply, replyMode, ttsVoice: ttsVoice, language, systemPrompt, personaId, humanHandoff,
    });
    res.json({ success: true, message: 'Paramètres mis à jour' });
}));
// GET /api/whatsapp/templates — list message templates (HSMs) from Meta.
// Cached on the integration doc for 5 min so we don't hammer Meta on every UI render.
router.get('/templates', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const cacheRef = db.collection('companies').doc(companyId).collection('integrations').doc('whatsappTemplatesCache');
    const force = req.query['refresh'] === '1';
    if (!force) {
        const cached = await cacheRef.get();
        const data = cached.data();
        const fetchedAt = data?.['fetchedAt']?.toDate?.();
        if (fetchedAt && Date.now() - fetchedAt.getTime() < 5 * 60 * 1000) {
            // Templates are stored as a JSON string because Meta returns nested arrays
            // (e.g. example.body_text = [["John","Mary"]]) which Firestore rejects.
            const raw = data?.['templatesJson'];
            let list = data?.['templates'] ?? [];
            if (typeof raw === 'string') {
                try {
                    list = JSON.parse(raw);
                }
                catch { /* fall back to legacy field */ }
            }
            return res.json({ success: true, data: list, cached: true });
        }
    }
    const templates = await whatsappService_1.whatsappService.fetchTemplates(companyId);
    // Store as JSON string — Firestore can't serialize nested arrays inside the template components.
    await cacheRef.set({ templatesJson: JSON.stringify(templates), fetchedAt: new Date() }, { merge: true });
    res.json({ success: true, data: templates, cached: false });
}));
// POST /api/whatsapp/templates/send — send a template message to one or more recipients.
// Body: { to: string | string[], templateName, languageCode, bodyParams?: string[], headerParam?: string }
router.post('/templates/send', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { to, templateName, languageCode, bodyParams, headerParam } = req.body;
    if (!to || !templateName || !languageCode) {
        throw new error_middleware_1.AppError('to, templateName, languageCode required', 400);
    }
    const config = await whatsappService_1.whatsappService.getConfig(companyId);
    if (!config)
        throw new error_middleware_1.AppError('WhatsApp non connecté pour cette entreprise', 400);
    // Build Meta `components` array from simple bodyParams + optional headerParam.
    const components = [];
    if (headerParam) {
        components.push({ type: 'header', parameters: [{ type: 'text', text: headerParam }] });
    }
    if (bodyParams && bodyParams.length > 0) {
        components.push({
            type: 'body',
            parameters: bodyParams.map(p => ({ type: 'text', text: p })),
        });
    }
    const recipients = Array.isArray(to) ? to : [to];
    const results = [];
    for (const r of recipients) {
        const out = await whatsappService_1.whatsappService.sendTemplateRich(config, r, templateName, languageCode, components);
        results.push({ to: r, ...out });
        // Audit
        try {
            await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappTemplateSends`).add({
                to: r,
                templateName,
                languageCode,
                bodyParams: bodyParams ?? [],
                headerParam: headerParam ?? null,
                messageId: out.messageId,
                error: out.error ?? null,
                sentBy: userId,
                sentAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch { /* non-blocking */ }
        // Inbox visibility: also persist a regular outbound message so the
        // template send shows up in the conversation thread. Body is a human-
        // readable preview "[Template: <name>] param1, param2…" so the merchant
        // can scan recent activity at a glance.
        if (out.messageId) {
            try {
                const preview = `[Template: ${templateName}]${bodyParams && bodyParams.length ? ' ' + bodyParams.join(' · ') : ''}`;
                await (0, firebase_config_1.getFirestore)()
                    .collection(`companies/${companyId}/whatsappMessages`)
                    .add({
                    direction: 'outbound',
                    to: String(r),
                    body: preview,
                    messageId: out.messageId,
                    waMessageId: out.messageId,
                    processed: true,
                    sentFrom: 'admin-template',
                    templateName,
                    createdAt: new Date(),
                });
            }
            catch { /* non-blocking */ }
        }
    }
    const successCount = results.filter(r => r.messageId).length;
    res.json({ success: true, data: { sent: successCount, total: recipients.length, results } });
}));
// ─── Ads attribution (Click-to-WhatsApp campaigns) ─────────────────────────
//
// Each Meta campaign that drives WhatsApp conversations is tracked in
// `companies/{cid}/whatsappAdCampaigns/{campaignId}` with counters:
//   - conversationsStarted: # of unique conversations from this ad
//   - leadsCreated: # of leads tagged with this campaign
//   - wonCount: # of leads converted (closed_won) from this campaign
//   - revenueTotal: sum of revenue from converted leads
//   - adSpend (manual): the user enters their ad spend so we compute ROAS
router.get('/ads/campaigns', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappAdCampaigns`)
        .orderBy('lastSeenAt', 'desc').limit(100).get().catch(() => null);
    res.json({ success: true, data: snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [] });
}));
// PATCH — user-editable fields: adSpend (manual cost), label (human name)
router.patch('/ads/campaigns/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { adSpend, label } = req.body;
    const update = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    if (typeof adSpend === 'number' && !isNaN(adSpend) && adSpend >= 0)
        update['adSpend'] = adSpend;
    if (typeof label === 'string')
        update['label'] = label;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappAdCampaigns`).doc(req.params.id).set(update, { merge: true });
    res.json({ success: true });
}));
// ─── Catalog (WhatsApp Commerce) ────────────────────────────────────────────
// GET /api/whatsapp/catalog/products — list products from the Meta Catalog
router.get('/catalog/products', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const [catalogId, products] = await Promise.all([
        whatsappService_1.whatsappService.getCatalogId(companyId),
        whatsappService_1.whatsappService.listCatalogProducts(companyId),
    ]);
    res.json({ success: true, data: { catalogId, products } });
}));
// POST /api/whatsapp/catalog/send-product — send a product card to a customer
router.post('/catalog/send-product', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { to, productRetailerId, bodyText, footerText } = req.body;
    if (!to || !productRetailerId || !bodyText) {
        throw new error_middleware_1.AppError('to, productRetailerId, bodyText required', 400);
    }
    const config = await whatsappService_1.whatsappService.getConfig(companyId);
    if (!config)
        throw new error_middleware_1.AppError('WhatsApp non connecté', 400);
    const catalogId = await whatsappService_1.whatsappService.getCatalogId(companyId);
    if (!catalogId)
        throw new error_middleware_1.AppError('Aucun catalogue Meta lié à cette entreprise', 400);
    const out = await whatsappService_1.whatsappService.sendProductMessage(config, to, catalogId, productRetailerId, bodyText, footerText);
    if (!out.messageId)
        throw new error_middleware_1.AppError(out.error ?? 'Échec envoi produit', 502);
    const db = (0, firebase_config_1.getFirestore)();
    // Look up the most recent lead for this customer phone so we can link the
    // product send to it. This is what powers per-product attribution on conversion.
    const phoneDigits = to.replace(/\D/g, '');
    let relatedLeadId = null;
    try {
        const leadSnap = await db.collection(`companies/${companyId}/whatsappLeads`)
            .where('customerPhone', 'in', [to, phoneDigits, `+${phoneDigits}`])
            .orderBy('createdAt', 'desc').limit(1).get().catch(() => null);
        if (leadSnap && !leadSnap.empty) {
            relatedLeadId = leadSnap.docs[0].id;
            await leadSnap.docs[0].ref.update({
                lastProductRetailerId: productRetailerId,
                lastProductSentAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }).catch(() => null);
        }
    }
    catch { /* best-effort */ }
    // Audit row — mirrors whatsappTemplateSends so we can reuse the reply-tracking
    // logic and aggregate per-product stats.
    await db.collection(`companies/${companyId}/whatsappCatalogSends`).add({
        to,
        productRetailerId,
        catalogId,
        bodyText,
        footerText: footerText ?? null,
        messageId: out.messageId,
        relatedLeadId,
        sentBy: userId,
        sentAt: firestore_1.FieldValue.serverTimestamp(),
    });
    res.json({ success: true, data: { messageId: out.messageId } });
}));
// GET /api/whatsapp/catalog/products/stats — per-product send/reply/won/revenue + score
//
// Score formula: (won / sent) * revenue. Captures both conversion rate AND
// monetary impact. A product that converts 90% of the time but earns nothing
// scores 0; a product with one big sale scores high.
router.get('/catalog/products/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
        const sendsSnap = await (0, firebase_config_1.getFirestore)()
            .collection(`companies/${companyId}/whatsappCatalogSends`)
            .where('sentAt', '>=', since)
            .limit(1000)
            .get()
            .catch(() => null);
        const stats = {};
        if (sendsSnap) {
            for (const d of sendsSnap.docs) {
                const data = d.data();
                const id = data['productRetailerId'] ?? 'unknown';
                if (!stats[id])
                    stats[id] = { sent: 0, replied: 0, won: 0, revenue: 0, lastSentAt: null, score: 0 };
                stats[id].sent++;
                if (data['replied'])
                    stats[id].replied++;
                const ts = data['sentAt']?.toDate?.()?.getTime() ?? null;
                if (ts && (!stats[id].lastSentAt || ts > stats[id].lastSentAt))
                    stats[id].lastSentAt = ts;
            }
        }
        const leadsSnap = await (0, firebase_config_1.getFirestore)()
            .collection(`companies/${companyId}/whatsappLeads`)
            .where('status', '==', 'closed_won')
            .limit(500)
            .get()
            .catch(() => null);
        if (leadsSnap) {
            for (const d of leadsSnap.docs) {
                const lead = d.data();
                const pid = lead['lastProductRetailerId'];
                if (!pid || !stats[pid])
                    continue;
                stats[pid].won++;
                const rev = typeof lead['revenue'] === 'number' ? lead['revenue'] : 0;
                if (rev > 0)
                    stats[pid].revenue += rev;
            }
        }
        // Compute score = (won / sent) * revenue. Round to int for clean sorting.
        for (const pid of Object.keys(stats)) {
            const s = stats[pid];
            s.score = s.sent > 0 ? Math.round((s.won / s.sent) * s.revenue) : 0;
        }
        res.json({ success: true, data: stats });
    }
    catch {
        res.json({ success: true, data: {} });
    }
}));
// GET /api/whatsapp/catalog/top-products — ranked products by score, used by
// the orchestrator's getTopWhatsAppProducts tool.
router.get('/catalog/top-products', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const limit = Math.min(parseInt(String(req.query['limit'] ?? '5'), 10) || 5, 20);
    // Reuse the stats path
    const products = await whatsappService_1.whatsappService.listCatalogProducts(companyId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sendsSnap = await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/whatsappCatalogSends`)
        .where('sentAt', '>=', since).limit(1000).get().catch(() => null);
    const leadsSnap = await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/whatsappLeads`)
        .where('status', '==', 'closed_won').limit(500).get().catch(() => null);
    const scored = products.map((p) => {
        const id = p.retailer_id;
        let sent = 0, won = 0, revenue = 0;
        if (sendsSnap)
            for (const d of sendsSnap.docs) {
                if (d.data()['productRetailerId'] === id)
                    sent++;
            }
        if (leadsSnap)
            for (const d of leadsSnap.docs) {
                const ld = d.data();
                if (ld['lastProductRetailerId'] === id) {
                    won++;
                    if (typeof ld['revenue'] === 'number')
                        revenue += ld['revenue'];
                }
            }
        const score = sent > 0 ? Math.round((won / sent) * revenue) : 0;
        return {
            retailerId: id,
            name: p.name,
            price: p.price,
            currency: p.currency,
            availability: p.availability,
            sent, won, revenue, score,
        };
    });
    // Rank: score first, then revenue, then won. Products with no data sink to bottom.
    scored.sort((a, b) => (b.score - a.score) || (b.revenue - a.revenue) || (b.won - a.won));
    res.json({ success: true, data: scored.slice(0, limit) });
}));
// ─── Auto-broadcast rules ───────────────────────────────────────────────────
//
// Rules trigger a broadcast automatically when a condition is met (e.g. "20+
// new leads in 30 min"). Evaluated by the cron tick every 1 min.
router.get('/auto-broadcasts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappAutoBroadcasts`)
        .orderBy('createdAt', 'desc').limit(50).get().catch(() => null);
    res.json({ success: true, data: snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [] });
}));
router.post('/auto-broadcasts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { name, enabled, templateName, languageCode, bodyParams, prefillFromLead, condition, cooldownMinutes } = req.body;
    if (!name?.trim() || !templateName || !languageCode || !condition?.minLeadCount) {
        throw new error_middleware_1.AppError('name, templateName, languageCode, condition.minLeadCount required', 400);
    }
    const ref = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappAutoBroadcasts`).add({
        name: name.trim(),
        enabled: enabled ?? true,
        templateName,
        languageCode,
        bodyParams: bodyParams ?? [],
        prefillFromLead: prefillFromLead ?? true,
        condition,
        cooldownMinutes: cooldownMinutes ?? 60,
        totalTriggered: 0,
        createdBy: userId,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    res.json({ success: true, data: { id: ref.id } });
}));
router.patch('/auto-broadcasts/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { name, enabled, templateName, languageCode, bodyParams, prefillFromLead, condition, cooldownMinutes } = req.body;
    const update = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    if (name !== undefined)
        update['name'] = name;
    if (enabled !== undefined)
        update['enabled'] = enabled;
    if (templateName !== undefined)
        update['templateName'] = templateName;
    if (languageCode !== undefined)
        update['languageCode'] = languageCode;
    if (bodyParams !== undefined)
        update['bodyParams'] = bodyParams;
    if (prefillFromLead !== undefined)
        update['prefillFromLead'] = prefillFromLead;
    if (condition !== undefined)
        update['condition'] = condition;
    if (cooldownMinutes !== undefined)
        update['cooldownMinutes'] = cooldownMinutes;
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappAutoBroadcasts`).doc(req.params.id).update(update);
    res.json({ success: true });
}));
router.delete('/auto-broadcasts/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappAutoBroadcasts`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ─── Segments endpoints (saved audience filters) ────────────────────────────
//
// A segment is a named, reusable audience filter. Power users save segments
// like "clients chauds", "leads urgents 7j" and launch broadcasts in 1 click.
// GET /api/whatsapp/segments
router.get('/segments', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappSegments`)
        .orderBy('createdAt', 'desc').limit(50).get().catch(() => null);
    res.json({ success: true, data: snap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [] });
}));
// POST /api/whatsapp/segments
router.post('/segments', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { name, description, filter } = req.body;
    if (!name?.trim())
        throw new error_middleware_1.AppError('Name required', 400);
    const ref = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappSegments`).add({
        name: name.trim(),
        description: description?.trim() ?? null,
        filter: filter ?? {},
        createdBy: userId,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    res.json({ success: true, data: { id: ref.id } });
}));
// DELETE /api/whatsapp/segments/:id
router.delete('/segments/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappSegments`).doc(req.params.id).delete();
    res.json({ success: true });
}));
// ─── Broadcast endpoints ──────────────────────────────────────────────────
// POST /api/whatsapp/broadcasts/preview — count audience for a filter
router.post('/broadcasts/preview', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { filter } = req.body;
    const { previewAudience } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/broadcastService')));
    const data = await previewAudience(companyId, filter ?? {});
    res.json({ success: true, data });
}));
// POST /api/whatsapp/broadcasts — create + start a broadcast (background send)
router.post('/broadcasts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { name, templateName, languageCode, bodyParams, prefillFromLead, filter } = req.body;
    if (!name || !templateName || !languageCode) {
        throw new error_middleware_1.AppError('name, templateName, languageCode required', 400);
    }
    const { runBroadcast } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/broadcastService')));
    const { broadcastId } = await runBroadcast({
        companyId,
        name,
        templateName,
        languageCode,
        bodyParams,
        prefillFromLead,
        filter: filter ?? {},
        triggeredBy: userId,
        triggeredByName: req.user?.displayName ?? req.user?.email,
    });
    res.json({ success: true, data: { broadcastId } });
}));
// GET /api/whatsapp/broadcasts — list recent broadcasts
router.get('/broadcasts', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappBroadcasts`)
        .orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
}));
// GET /api/whatsapp/broadcasts/:id — single broadcast detail (with recipient sample)
router.get('/broadcasts/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { id } = req.params;
    const ref = (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappBroadcasts`).doc(id);
    const doc = await ref.get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Broadcast not found', 404);
    const recsSnap = await ref.collection('recipients').limit(100).get();
    res.json({ success: true, data: { id: doc.id, ...doc.data(), recipients: recsSnap.docs.map(r => ({ id: r.id, ...r.data() })) } });
}));
// GET /api/whatsapp/leads — list captured leads
router.get('/leads', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const status = req.query['status'] ?? null;
    let q = (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappLeads`).orderBy('createdAt', 'desc').limit(100);
    if (status)
        q = q.where('status', '==', status);
    try {
        const snap = await q.get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// PATCH /api/whatsapp/leads/:leadId — update lead status / notes / assignee.
// Auto-sets `firstContactedAt` when status first moves to 'contacted', and
// `closedAt` when status moves to closed_won/closed_lost. These power the
// avg-response-time KPI shown on the leads dashboard.
router.patch('/leads/:leadId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { leadId } = req.params;
    const { status, notes, urgency, assigneeId, revenue } = req.body;
    const ref = (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappLeads`).doc(leadId);
    const doc = await ref.get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Lead not found', 404);
    const current = doc.data() ?? {};
    const update = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    if (status !== undefined) {
        update['status'] = status;
        // First time this lead is marked 'contacted' → record the response timestamp.
        if (status === 'contacted' && !current['firstContactedAt']) {
            update['firstContactedAt'] = firestore_1.FieldValue.serverTimestamp();
            update['firstContactedBy'] = userId;
        }
        if ((status === 'closed_won' || status === 'closed_lost') && !current['closedAt']) {
            update['closedAt'] = firestore_1.FieldValue.serverTimestamp();
        }
    }
    // Ad campaign attribution: if this lead came from a Meta ad, bump the
    // campaign's wonCount and revenue when it converts.
    if (status === 'closed_won' && current['status'] !== 'closed_won') {
        const adCampaignId = current['adCampaignId'];
        if (adCampaignId) {
            const incBody = {
                wonCount: firestore_1.FieldValue.increment(1),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            };
            if (typeof revenue === 'number' && !isNaN(revenue) && revenue > 0) {
                incBody['revenueTotal'] = firestore_1.FieldValue.increment(revenue);
            }
            await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappAdCampaigns`).doc(adCampaignId)
                .set(incBody, { merge: true })
                .catch(() => null);
        }
    }
    // Conversion attribution: if the lead is being marked closed_won and we
    // have a recent template send linked to a broadcast, bump the broadcast's
    // wonCount so the dashboard can show conversion rate.
    if (status === 'closed_won' && current['status'] !== 'closed_won') {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const lastSend = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappTemplateSends`)
                .where('relatedLeadId', '==', leadId)
                .where('sentAt', '>=', sevenDaysAgo)
                .orderBy('sentAt', 'desc')
                .limit(1)
                .get()
                .catch(() => null);
            const broadcastId = lastSend?.docs[0]?.data()?.['relatedBroadcastId'];
            if (broadcastId) {
                const incrementBody = {
                    wonCount: firestore_1.FieldValue.increment(1),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                };
                if (typeof revenue === 'number' && !isNaN(revenue) && revenue > 0) {
                    incrementBody['revenueTotal'] = firestore_1.FieldValue.increment(revenue);
                }
                await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappBroadcasts`).doc(broadcastId)
                    .update(incrementBody)
                    .catch(() => null);
            }
        }
        catch { /* best-effort */ }
    }
    if (notes !== undefined)
        update['notes'] = notes;
    if (urgency !== undefined)
        update['urgency'] = urgency;
    if (revenue !== undefined && typeof revenue === 'number' && !isNaN(revenue)) {
        update['revenue'] = revenue;
    }
    if (assigneeId !== undefined) {
        if (assigneeId === null) {
            update['assigneeId'] = null;
            update['assigneeName'] = null;
        }
        else {
            update['assigneeId'] = assigneeId;
            // Resolve a display name from the users collection if possible.
            try {
                const userDoc = await (0, firebase_config_1.getFirestore)().collection('users').doc(assigneeId).get();
                update['assigneeName'] = userDoc.exists ? (userDoc.data()?.['displayName'] ?? userDoc.data()?.['email'] ?? null) : null;
            }
            catch { /* best-effort */ }
        }
    }
    await ref.update(update);
    res.json({ success: true });
}));
// POST /api/whatsapp/leads/:leadId/send-template — relance the customer via
// an approved Meta template. Pre-fills variables from the lead (name, need).
// Sets firstContactedAt automatically and writes audit. Refuses if the customer
// has opted out (replied STOP/STOP).
router.post('/leads/:leadId/send-template', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { leadId } = req.params;
    const { templateName, languageCode, bodyParams, headerParam } = req.body;
    if (!templateName || !languageCode)
        throw new error_middleware_1.AppError('templateName + languageCode required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const leadRef = db.collection(`companies/${companyId}/whatsappLeads`).doc(leadId);
    const leadDoc = await leadRef.get();
    if (!leadDoc.exists)
        throw new error_middleware_1.AppError('Lead not found', 404);
    const lead = leadDoc.data();
    if (lead['optedOut'])
        throw new error_middleware_1.AppError("Le client s'est désinscrit (STOP) — l'envoi est bloqué pour respecter le consentement.", 403);
    const config = await whatsappService_1.whatsappService.getConfig(companyId);
    if (!config)
        throw new error_middleware_1.AppError('WhatsApp non connecté', 400);
    // Build components from simple bodyParams + optional header
    const components = [];
    if (headerParam)
        components.push({ type: 'header', parameters: [{ type: 'text', text: headerParam }] });
    if (bodyParams && bodyParams.length > 0) {
        components.push({ type: 'body', parameters: bodyParams.map(p => ({ type: 'text', text: p })) });
    }
    const out = await whatsappService_1.whatsappService.sendTemplateRich(config, lead['customerPhone'], templateName, languageCode, components);
    if (!out.messageId) {
        throw new error_middleware_1.AppError(out.error ?? 'Échec envoi template', 502);
    }
    // Audit + mark lead as contacted
    const updates = {
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        lastTemplateSentAt: firestore_1.FieldValue.serverTimestamp(),
        lastTemplateName: templateName,
    };
    if (!lead['firstContactedAt']) {
        updates['firstContactedAt'] = firestore_1.FieldValue.serverTimestamp();
        updates['firstContactedBy'] = userId;
        if (lead['status'] === 'new')
            updates['status'] = 'contacted';
    }
    await leadRef.update(updates);
    await db.collection(`companies/${companyId}/whatsappTemplateSends`).add({
        to: lead['customerPhone'],
        relatedLeadId: leadId,
        templateName,
        languageCode,
        bodyParams: bodyParams ?? [],
        headerParam: headerParam ?? null,
        messageId: out.messageId,
        sentBy: userId,
        sentAt: firestore_1.FieldValue.serverTimestamp(),
    });
    res.json({ success: true, data: { messageId: out.messageId } });
}));
// GET /api/whatsapp/templates/stats — sends-per-template count for the last 30 days
router.get('/templates/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
        const snap = await (0, firebase_config_1.getFirestore)()
            .collection(`companies/${companyId}/whatsappTemplateSends`)
            .where('sentAt', '>=', since)
            .limit(500)
            .get();
        const byTemplate = {};
        let totalSent = 0;
        for (const d of snap.docs) {
            const data = d.data();
            const name = data['templateName'] ?? 'unknown';
            const ts = data['sentAt']?.toDate?.()?.getTime() ?? null;
            if (!byTemplate[name])
                byTemplate[name] = { sent: 0, lastSentAt: null };
            byTemplate[name].sent++;
            if (ts && (!byTemplate[name].lastSentAt || ts > byTemplate[name].lastSentAt)) {
                byTemplate[name].lastSentAt = ts;
            }
            totalSent++;
        }
        res.json({ success: true, data: { totalSent, byTemplate } });
    }
    catch {
        res.json({ success: true, data: { totalSent: 0, byTemplate: {} } });
    }
}));
// POST /api/whatsapp/leads/:leadId/assign-me — quick self-assign endpoint
router.post('/leads/:leadId/assign-me', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Auth required', 401);
    const { leadId } = req.params;
    const ref = (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappLeads`).doc(leadId);
    const doc = await ref.get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Lead not found', 404);
    let assigneeName = null;
    try {
        const userDoc = await (0, firebase_config_1.getFirestore)().collection('users').doc(userId).get();
        assigneeName = userDoc.exists ? (userDoc.data()?.['displayName'] ?? userDoc.data()?.['email'] ?? null) : null;
    }
    catch { /* best-effort */ }
    await ref.update({
        assigneeId: userId,
        assigneeName,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    res.json({ success: true, data: { assigneeId: userId, assigneeName } });
}));
// POST /api/whatsapp/handoff/resume — humain rend la main à l'IA pour ce client
router.post('/handoff/resume', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { customerPhone } = req.body;
    if (!customerPhone)
        throw new error_middleware_1.AppError('customerPhone required', 400);
    const handoffSvc = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/humanHandoffService')));
    await handoffSvc.setConversationStatus(companyId, customerPhone, 'handoff_resolved', {
        resumedBy: req.user?.uid ?? null,
        resumedAt: new Date(),
    });
    res.json({ success: true });
}));
// GET /api/whatsapp/handoff/conversations — list current handoff-active conversations
router.get('/handoff/conversations', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const snap = await (0, firebase_config_1.getFirestore)()
        .collection(`companies/${companyId}/whatsappConversations`)
        .where('status', 'in', ['handoff_active', 'handoff_timeout'])
        .limit(50)
        .get();
    const conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: conversations });
}));
// GET /api/whatsapp/handoff/stats — last 7 days escalation count + avg response time.
// avgResponseTimeMs = average of (firstContactedAt - createdAt) across leads
// where firstContactedAt is set. Powers the "Temps moyen de réponse" KPI.
router.get('/handoff/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
        const [escalationsSnap, leadsSnap] = await Promise.all([
            (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappEscalations`).where('createdAt', '>=', sevenDaysAgo).limit(200).get(),
            (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/whatsappLeads`).where('createdAt', '>=', sevenDaysAgo).limit(200).get(),
        ]);
        const escalations = escalationsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const explicit = escalations.filter((e) => e.reason === 'explicit').length;
        const frustration = escalations.filter((e) => e.reason === 'frustration').length;
        // Compute avg response time over leads that have been contacted.
        let totalMs = 0;
        let contactedCount = 0;
        for (const d of leadsSnap.docs) {
            const data = d.data();
            const created = data['createdAt']?.toDate?.();
            const contacted = data['firstContactedAt']?.toDate?.();
            if (created && contacted) {
                totalMs += contacted.getTime() - created.getTime();
                contactedCount++;
            }
        }
        const avgResponseTimeMs = contactedCount > 0 ? Math.round(totalMs / contactedCount) : null;
        res.json({
            success: true,
            data: {
                total7d: escalations.length,
                explicit,
                frustration,
                avgResponseTimeMs,
                contactedCount,
                recent: escalations.slice(0, 10),
            },
        });
    }
    catch {
        res.json({ success: true, data: { total7d: 0, explicit: 0, frustration: 0, avgResponseTimeMs: null, recent: [] } });
    }
}));
// GET /api/whatsapp/messages — historique messages
router.get('/messages', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const snap = await (0, firebase_config_1.getFirestore)()
            .collection(`companies/${companyId}/whatsappMessages`)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json({ success: true, data: messages });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// GET /api/whatsapp/stats — analytics dashboard data
router.get('/stats', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection(`companies/${companyId}/whatsappMessages`)
            .limit(500).get();
        const messages = snap.docs.map(d => d.data());
        const total = messages.length;
        const inbound = messages.filter(m => m['direction'] === 'inbound').length;
        const outbound = total - inbound;
        const voiceMessages = messages.filter(m => m['originalType'] === 'audio').length;
        const processed = messages.filter(m => m['processed'] === true).length;
        // Unique contacts
        const contacts = new Set(messages.filter(m => m['from']).map(m => m['from'])).size;
        // Messages by day (last 7 days)
        const now = Date.now();
        const dailyData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now - i * 86400000);
            const dateStr = d.toISOString().split('T')[0];
            const dayStart = new Date(dateStr).getTime();
            const dayEnd = dayStart + 86400000;
            const dayMsgs = messages.filter(m => {
                const ts = m['createdAt']?.['seconds'] ? m['createdAt']['seconds'] * 1000 :
                    m['timestamp'] ? new Date(m['timestamp']).getTime() : 0;
                return ts >= dayStart && ts < dayEnd;
            });
            dailyData.push({
                date: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
                inbound: dayMsgs.filter(m => m['direction'] === 'inbound').length,
                outbound: dayMsgs.filter(m => m['direction'] !== 'inbound').length,
            });
        }
        res.json({
            success: true,
            data: { total, inbound, outbound, voiceMessages, processed, contacts, dailyData },
        });
    }
    catch {
        res.json({ success: true, data: { total: 0, inbound: 0, outbound: 0, voiceMessages: 0, processed: 0, contacts: 0, dailyData: [] } });
    }
}));
exports.default = router;
//# sourceMappingURL=whatsapp.routes.js.map