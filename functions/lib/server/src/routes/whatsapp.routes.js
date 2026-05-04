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
        setImmediate(async () => {
            try {
                const db = (0, firebase_config_1.getFirestore)();
                for (const st of statuses) {
                    // Update message status in Firestore
                    const snap = await db.collectionGroup('whatsappMessages')
                        .where('waMessageId', '==', st.messageId)
                        .limit(1).get();
                    if (!snap.empty) {
                        await snap.docs[0].ref.update({
                            deliveryStatus: st.status,
                            deliveryTimestamp: new Date(st.timestamp),
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
    const hasContent = !!incoming.message || (incoming.type === 'audio' && !!incoming.audioId);
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
            });
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
                        await whatsappService_1.whatsappService.sendMessage(cfg, incoming.from, fallbackText);
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
                    // Route through the channel-aware MessagingOrchestrator
                    const { handleMessage } = await Promise.resolve().then(() => __importStar(require('../messaging')));
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
                        customSystemPrompt: config?.systemPrompt,
                        fastReply: true, // WhatsApp wants speed
                    });
                    // First message is the main reply; extras (split) get sent below if any
                    const replyText = msgResult.messages[0] ?? 'Je n\'ai pas pu traiter votre demande.';
                    const extraMessages = msgResult.messages.slice(1);
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
                        await whatsappService_1.whatsappService.sendMessage(fakeConfig, incoming.from, replyText);
                        // Send extra parts if the response was split (validate() returned an array)
                        for (const extra of extraMessages) {
                            await whatsappService_1.whatsappService.sendMessage(fakeConfig, incoming.from, extra);
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
// ── Routes protégées (admin) ──────────────────────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
router.use(adminOnly_middleware_1.adminOnlyMiddleware);
// GET /api/whatsapp/status — statut de la connexion
router.get('/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const config = await whatsappService_1.whatsappService.getConfig(companyId);
    res.json({
        success: true,
        data: {
            connected: !!config,
            phoneNumberId: config?.phoneNumberId ?? null,
            businessAccountId: config?.businessAccountId ?? null,
            coexistenceMode: config?.coexistenceMode ?? false,
        },
    });
}));
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
    const messageId = await whatsappService_1.whatsappService.sendMessage(config, to, message);
    res.json({ success: true, data: { messageId } });
}));
// PATCH /api/whatsapp/settings — paramètres conversation (voix, mode, langue, prompt)
router.patch('/settings', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { autoReply, replyMode, ttsVoice, language, systemPrompt } = req.body;
    await whatsappService_1.whatsappService.updateSettings(companyId, { autoReply, replyMode, ttsVoice: ttsVoice, language, systemPrompt });
    res.json({ success: true, message: 'Paramètres mis à jour' });
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