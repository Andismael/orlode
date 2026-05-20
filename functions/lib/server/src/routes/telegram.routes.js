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
 * Telegram Bot routes — per-company connect/disconnect + webhook receiver.
 *
 * Flow:
 *   1. User creates a bot via @BotFather on Telegram, gets token
 *   2. POST /api/telegram/connect { token } — we validate, save encrypted, set webhook
 *   3. Telegram delivers updates to POST /api/telegram/webhook/:companyId
 *   4. We route through MessagingOrchestrator (Clone brain) → reply
 */
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const telegramService_1 = require("../services/telegram/telegramService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
function webhookUrl(companyId) {
    const base = process.env['API_BASE_URL']
        ?? process.env['CORS_ORIGIN']?.replace('mon-assistant-86bbd.web.app', 'api-15262322885.us-central1.run.app')
        ?? 'https://api-15262322885.us-central1.run.app';
    return `${base}/api/telegram/webhook/${companyId}`;
}
// ─── PUBLIC WEBHOOK (Telegram → our server) ─────────────────────────────────
// POST /api/telegram/webhook/:companyId — Telegram delivers updates here
router.post('/webhook/:companyId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    // Always respond 200 immediately so Telegram doesn't retry
    res.status(200).send('OK');
    const { companyId } = req.params;
    const update = req.body;
    // ── Inline keyboard callback (admin cockpit buttons) ─────────────────
    if (update?.callback_query) {
        const cb = update.callback_query;
        const cbChatId = String(cb.message?.chat.id ?? '');
        const cbTelegramId = String(cb.from.id);
        const action = cb.data ?? '';
        if (!cbChatId)
            return;
        // Translate the button click to a free-text query for the orchestrator
        const queryMap = {
            list_products: 'Liste mes produits actifs (top 10)',
            list_orders: 'Donne-moi les 5 dernières commandes',
            today_stats: 'Donne-moi un résumé des ventes d\'aujourd\'hui',
        };
        if (action === 'exit_admin') {
            await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/telegramSessions/${cbTelegramId}`)
                .set({ adminChatMode: false, adminChatModeAt: null }, { merge: true });
            await (0, telegramService_1.sendTelegramMessage)(companyId, cbChatId, '🔒 Mode admin désactivé.');
            return;
        }
        const translated = queryMap[action];
        if (translated) {
            try {
                const { handleMessage } = await Promise.resolve().then(() => __importStar(require('../messaging')));
                const r = await handleMessage({ text: translated, from: cbTelegramId, channel: 'telegram',
                    providerMeta: { chatId: cbChatId, forceOrchestrator: true } }, { companyId, language: 'fr', visitorName: cb.from.first_name ?? 'Admin', fastReply: true });
                for (const reply of r.messages) {
                    await (0, telegramService_1.sendTelegramMessage)(companyId, cbChatId, reply, 'Markdown');
                }
            }
            catch (err) {
                logger_1.logger.error('[Telegram] callback_query handler failed', { companyId, err: String(err) });
            }
        }
        return;
    }
    const msg = update?.message;
    if (!msg?.from)
        return;
    const chatId = String(msg.chat.id);
    const telegramId = String(msg.from.id);
    const fromName = msg.from.first_name ?? msg.from.username ?? 'User';
    // Rate limit + spam check (silent drop)
    {
        const { checkRateLimit, isSpam, isRepeatSpam } = await Promise.resolve().then(() => __importStar(require('../utils/rateLimit')));
        const rlKey = `tg:${telegramId}`;
        if (!checkRateLimit(rlKey, { windowMs: 60000, maxMessages: 25 })) {
            logger_1.logger.warn('[Telegram] Rate-limited', { telegramId });
            return;
        }
        const text = msg.text ?? msg.caption ?? '';
        if (isSpam(text)) {
            logger_1.logger.warn('[Telegram] Spam dropped', { telegramId, preview: text.slice(0, 40) });
            return;
        }
        if (isRepeatSpam(rlKey, text)) {
            logger_1.logger.warn('[Telegram] Repeat spam dropped', { telegramId });
            return;
        }
    }
    // Dedup by message_id
    const db = (0, firebase_config_1.getFirestore)();
    const dedupKey = `tg_${companyId}_${msg.chat.id}_${msg.message_id}`;
    const dedup = await db.collection('_telegramDedup').doc(dedupKey).get().catch(() => null);
    if (dedup?.exists)
        return;
    await db.collection('_telegramDedup').doc(dedupKey).set({ at: new Date() }).catch(() => { });
    // ── 1. PHOTO PATH — owner uploads photo + caption → Agent Catalogue ──
    if (msg.photo && msg.photo.length > 0) {
        // Pick the LARGEST size for best AI vision quality
        const largest = msg.photo.reduce((max, p) => (p.width > max.width ? p : max), msg.photo[0]);
        const file = await (0, telegramService_1.downloadTelegramFile)(companyId, largest.file_id);
        if (!file) {
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, '⚠️ Impossible de télécharger la photo. Réessaie stp.');
            return;
        }
        try {
            const { handleOwnerTelegramPhoto } = await Promise.resolve().then(() => __importStar(require('../agents/commerce.agent')));
            const r = await handleOwnerTelegramPhoto({
                companyId, telegramId, telegramName: fromName,
                imageBuffer: file.buffer, mimeType: file.mimeType,
                caption: msg.caption,
            });
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, r.reply, 'Markdown');
        }
        catch (err) {
            logger_1.logger.error('[Telegram] Photo handler failed', { companyId, err: String(err) });
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, '❌ Une erreur a empêché la création du produit. Réessaie.');
        }
        return;
    }
    // ── 2. LOCATION PATH — client shared their GPS → echo + log ──
    if (msg.location) {
        await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, `📍 Position reçue (${msg.location.latitude.toFixed(4)}, ${msg.location.longitude.toFixed(4)}). On l'utilise pour calculer la livraison.`);
        await db.collection(`companies/${companyId}/telegramMessages`).add({
            direction: 'inbound', chatId, fromId: telegramId, fromName,
            message: `[Location: ${msg.location.latitude}, ${msg.location.longitude}]`,
            telegramMsgId: msg.message_id, createdAt: new Date(),
        });
        return;
    }
    // ── 3. VOICE PATH — transcribe + treat as text ──
    let transcribedText = null;
    if (msg.voice && !msg.text) {
        const file = await (0, telegramService_1.downloadTelegramFile)(companyId, msg.voice.file_id);
        if (file) {
            try {
                const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
                transcribedText = await whatsappService.transcribeAudioBuffer(file.buffer, file.mimeType, companyId);
            }
            catch (err) {
                logger_1.logger.warn('[Telegram] Voice transcription failed', { err: String(err) });
            }
        }
        if (transcribedText) {
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, `🎙 _"${transcribedText}"_`, 'Markdown');
        }
        else {
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, '⚠️ Je n\'arrive pas à transcrire ton vocal. Renvoie-le ou écris-le.');
            return;
        }
    }
    const text = msg.text ?? transcribedText;
    if (!text)
        return;
    // Handle Telegram /start and /help specially
    if (text === '/start' || text === '/help') {
        try {
            const { getCloneConfig } = await Promise.resolve().then(() => __importStar(require('../services/cloneEngine')));
            const cfg = await getCloneConfig(companyId);
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, cfg.greeting, 'Markdown');
            return;
        }
        catch { /* fall through to AI */ }
    }
    // ── 4. TEXT PATH — route through MessagingOrchestrator ──
    // 4a. Per-Telegram-user session (admin chat mode + pending OTP)
    const sessionRef = db.doc(`companies/${companyId}/telegramSessions/${telegramId}`);
    const sessionSnap = await sessionRef.get().catch(() => null);
    const sessionData = (sessionSnap?.data() ?? {});
    // 4a-bis. Pending OTP verification — owner mentioned @admin earlier and
    // we sent a code to their ownerPhone on WhatsApp. If they now reply with a
    // 6-digit code, verify + bind.
    const otpInput = text.trim().match(/^(\d{6})$/);
    if (otpInput && sessionData.pendingOtp) {
        const pending = sessionData.pendingOtp;
        const expiresAt = pending.expiresAt instanceof Date
            ? pending.expiresAt
            : pending.expiresAt?.toDate?.();
        const expired = !expiresAt || expiresAt.getTime() < Date.now();
        const { createHash } = await Promise.resolve().then(() => __importStar(require('crypto')));
        const hash = createHash('sha256').update(otpInput[1]).digest('hex');
        if (expired) {
            await sessionRef.set({ pendingOtp: null }, { merge: true });
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, '⏰ Code expiré (5 min). Tape *@admin* pour réessayer.');
            return;
        }
        if (hash !== pending.hashedCode) {
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, '❌ Code incorrect. Réessaie ou tape *@admin* pour relancer.');
            return;
        }
        // Match — bind + activate
        await db.doc(`companies/${companyId}/stores/${pending.storeId}`)
            .set({ ownerTelegramId: telegramId, updatedAt: new Date() }, { merge: true });
        await sessionRef.set({
            pendingOtp: null,
            adminChatMode: true, adminChatModeAt: new Date(),
        }, { merge: true });
        logger_1.logger.info('[Telegram] Owner verified via OTP', { companyId, storeId: pending.storeId, telegramId });
        await (0, telegramService_1.sendTelegramKeyboard)(companyId, chatId, `✅ *Identité vérifiée*\n\nTu es maintenant lié·e à la boutique en tant qu'admin. Mode admin activé.\n\n_Tape *fin* pour sortir._`, [
            [{ text: '📦 Mes produits', callback_data: 'list_products' }, { text: '📋 Commandes', callback_data: 'list_orders' }],
            [{ text: '📊 Stats du jour', callback_data: 'today_stats' }, { text: '👋 Sortir', callback_data: 'exit_admin' }],
        ]);
        return;
    }
    // 4b. @admin / @orlode mention — activate admin chat mode.
    //     Identification flow:
    //       - Already bound to this telegramId → enter admin mode
    //       - Claimable store with ownerPhone → send OTP via WhatsApp, ask for code
    //       - Claimable store without ownerPhone → first-claim auto-bind (legacy/demo)
    //       - All bound to someone else → reject
    const mentionMatch = /@\s*(orlode|admin|cockpit|patron)\b/i.test(text);
    let forceOrchestrator = false;
    if (mentionMatch) {
        const storesSnap = await db.collection(`companies/${companyId}/stores`).get().catch(() => null);
        const owned = storesSnap?.docs.find(d => d.data().ownerTelegramId === telegramId);
        const claimable = storesSnap?.docs.find(d => !d.data().ownerTelegramId);
        if (!owned && claimable) {
            const claimableData = claimable.data();
            const phone = claimableData.ownerPhone;
            if (phone && /^\+?\d{8,}/.test(phone)) {
                // Send OTP to the registered owner phone via WhatsApp
                const code = String(Math.floor(100000 + Math.random() * 900000));
                const { createHash } = await Promise.resolve().then(() => __importStar(require('crypto')));
                const hashedCode = createHash('sha256').update(code).digest('hex');
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
                await sessionRef.set({
                    pendingOtp: { storeId: claimable.id, hashedCode, expiresAt, phone },
                }, { merge: true });
                // Try to send via WhatsApp; gracefully degrade if WhatsApp not configured
                let waSent = false;
                try {
                    const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
                    const cfg = await whatsappService.getConfig(companyId).catch(() => null);
                    if (cfg) {
                        await whatsappService.sendMessage(cfg, phone, `🔐 *Orlode — Vérification Telegram*\n\nQuelqu'un essaie de gérer *${claimableData.name ?? 'ta boutique'}* depuis Telegram.\n\nCode : *${code}*\n\nValide 5 min. Ignore si ce n'est pas toi.`);
                        waSent = true;
                    }
                }
                catch (err) {
                    logger_1.logger.warn('[Telegram] OTP via WA failed', { err: String(err) });
                }
                const masked = phone.replace(/^(\+?\d{3})\d+(\d{2})$/, '$1••••$2');
                await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, waSent
                    ? `🔐 *Vérification owner*\n\nJ'ai envoyé un code à 6 chiffres sur WhatsApp ${masked}. Tape-le ici pour activer le mode admin.\n\n_Code valable 5 min._`
                    : `🔐 Code généré : *${code}*\n\n(WhatsApp n'est pas configuré — utilise ce code une fois pour bootstrap.)`);
                return;
            }
            // No phone on store → fall through to legacy auto-bind
            await claimable.ref.set({ ownerTelegramId: telegramId, updatedAt: new Date() }, { merge: true });
            logger_1.logger.info('[Telegram] Owner first-claim (no phone)', { companyId, storeId: claimable.id, telegramId });
        }
        else if (!owned && !claimable) {
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, `🔒 Cette boutique est déjà liée à un autre utilisateur Telegram. Si c'est une erreur, contacte l'admin.`);
            return;
        }
        // Enter admin mode (owned OR just claimed)
        await sessionRef.set({
            adminChatMode: true, adminChatModeAt: new Date(), updatedAt: new Date(),
        }, { merge: true });
        await (0, telegramService_1.sendTelegramKeyboard)(companyId, chatId, `🛠 *Mode admin activé*\n\nPose-moi des questions sur ta boutique : *combien de commandes hier ?*, *quels produits en rupture ?*, *envoie une promo aux 10 derniers clients*.\n\n_Tape *fin* pour sortir._`, [
            [{ text: '📦 Mes produits', callback_data: 'list_products' }, { text: '📋 Commandes', callback_data: 'list_orders' }],
            [{ text: '📊 Stats du jour', callback_data: 'today_stats' }, { text: '👋 Sortir', callback_data: 'exit_admin' }],
        ]);
        return;
    }
    // 4c. In admin chat mode → force orchestrator + handle exit commands
    const adminMode = sessionData.adminChatMode === true;
    const adminModeAtRaw = sessionData.adminChatModeAt;
    const adminModeAt = adminModeAtRaw instanceof Date
        ? adminModeAtRaw
        : adminModeAtRaw?.toDate?.();
    const adminExpired = adminModeAt && Date.now() - adminModeAt.getTime() > 30 * 60 * 1000;
    if (adminMode && !adminExpired) {
        if (/^\s*(fin|quit|exit|sortir|stop\s*admin|\/quit|\/exit)\s*$/i.test(text)) {
            await sessionRef.set({ adminChatMode: false, adminChatModeAt: null }, { merge: true });
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, `🔒 Mode admin désactivé. Je suis de retour en mode client.\n\n_Tape *@admin* pour réactiver._`);
            return;
        }
        await sessionRef.set({ adminChatModeAt: new Date() }, { merge: true });
        forceOrchestrator = true;
    }
    else if (adminMode && adminExpired) {
        await sessionRef.set({ adminChatMode: false, adminChatModeAt: null }, { merge: true });
    }
    // Persist inbound message
    await db.collection(`companies/${companyId}/telegramMessages`).add({
        direction: 'inbound', chatId, fromId: telegramId, fromName,
        message: text, telegramMsgId: msg.message_id, createdAt: new Date(),
    });
    try {
        const { handleMessage } = await Promise.resolve().then(() => __importStar(require('../messaging')));
        const result = await handleMessage({
            text, from: telegramId, channel: 'telegram',
            providerMeta: { chatId: msg.chat.id, messageId: msg.message_id, forceOrchestrator },
        }, { companyId, language: 'fr', visitorName: fromName, fastReply: true });
        for (const reply of result.messages) {
            await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, reply, 'Markdown');
        }
        await db.collection(`companies/${companyId}/telegramMessages`).add({
            direction: 'outbound', chatId, message: result.messages.join('\n'),
            processed: true, createdAt: new Date(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Telegram] Agent processing failed', { companyId, err: String(err) });
    }
    // Bonus: if the store has a GPS pinned, send a native location ping when
    // the customer asks for the address (cheap text-match heuristic)
    try {
        const lower = text.toLowerCase();
        if (/(adresse|où es-tu|ou es tu|localisation|gps|map|maps)/.test(lower)) {
            const storesSnap = await db.collection(`companies/${companyId}/stores`).limit(1).get().catch(() => null);
            const store = storesSnap?.docs[0]?.data();
            if (store && typeof store.latitude === 'number' && typeof store.longitude === 'number') {
                await (0, telegramService_1.sendTelegramLocation)(companyId, chatId, store.latitude, store.longitude);
            }
        }
    }
    catch { /* non-blocking */ }
}));
// ─── PROTECTED ROUTES (company admin) ───────────────────────────────────────
router.use(auth_middleware_1.authMiddleware);
// GET /api/telegram/status
router.get('/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const doc = await (0, firebase_config_1.getFirestore)()
        .collection('companies').doc(companyId)
        .collection('integrations').doc('telegram').get();
    const data = doc.exists ? doc.data() ?? {} : {};
    res.json({
        success: true,
        data: {
            connected: Boolean(data['botToken']),
            botName: data['botName'] ?? null,
            botUsername: data['botUsername'] ?? null,
            connectedAt: data['connectedAt'] ?? null,
        },
    });
}));
// GET /api/telegram/messages — last 50 messages, normalized to the
// shared inbox shape (matches /api/whatsapp/messages):
//   { id, from, to, body, direction, contactName, createdAt, channel: 'telegram' }
// Mapping from raw fields:
//   inbound  → from = chatId, contactName = fromName, body = message
//   outbound → to   = chatId,                           body = message
router.get('/messages', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    try {
        const snap = await (0, firebase_config_1.getFirestore)()
            .collection(`companies/${companyId}/telegramMessages`)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        const messages = snap.docs.map(d => {
            const raw = d.data() ?? {};
            const isInbound = raw.direction === 'inbound';
            const chatId = String(raw.chatId ?? '');
            return {
                id: d.id,
                channel: 'telegram',
                direction: raw.direction ?? 'inbound',
                from: isInbound ? chatId : undefined,
                to: isInbound ? undefined : chatId,
                chatId,
                body: raw.message ?? raw.body ?? raw.text ?? '',
                contactName: raw.fromName ?? null,
                createdAt: raw.createdAt ?? null,
            };
        });
        res.json({ success: true, data: messages });
    }
    catch {
        res.json({ success: true, data: [] });
    }
}));
// POST /api/telegram/connect — validate token, save encrypted, register webhook
router.post('/connect', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { token } = req.body;
    if (!token)
        throw new error_middleware_1.AppError('Bot token required', 400);
    // Step 1: validate via Telegram /getMe
    const info = await (0, telegramService_1.getBotInfoByToken)(token);
    if (!info)
        throw new error_middleware_1.AppError('Bot token invalide. Vérifiez que vous avez bien copié le token complet depuis @BotFather.', 400);
    // Step 2: register webhook on Telegram's side
    const wh = await (0, telegramService_1.setTelegramWebhook)(token, webhookUrl(companyId));
    if (!wh.ok)
        throw new error_middleware_1.AppError(`Impossible de configurer le webhook: ${wh.description ?? 'erreur inconnue'}`, 400);
    // Step 3: save encrypted config in Firestore
    await (0, telegramService_1.saveTelegramConfig)(companyId, token, { botName: info.name, botUsername: info.username });
    logger_1.logger.info('[Telegram] Connected', { companyId, bot: `@${info.username}` });
    res.json({ success: true, data: { botName: info.name, botUsername: info.username, webhookUrl: webhookUrl(companyId) } });
}));
// DELETE /api/telegram/disconnect
router.delete('/disconnect', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    // Fetch the token to deregister the webhook on Telegram's side
    const doc = await (0, firebase_config_1.getFirestore)()
        .collection('companies').doc(companyId)
        .collection('integrations').doc('telegram').get();
    const data = doc.exists ? doc.data() : null;
    if (data?.['botToken']) {
        try {
            const { decrypt, isEncrypted } = await Promise.resolve().then(() => __importStar(require('../config/encryption')));
            const t = data['botToken'];
            const plain = isEncrypted(t) ? decrypt(t) : t;
            await (0, telegramService_1.deleteTelegramWebhook)(plain);
        }
        catch { /* ignore */ }
    }
    await (0, telegramService_1.removeTelegramConfig)(companyId);
    res.json({ success: true });
}));
// POST /api/telegram/send — manual test send from admin panel
router.post('/send', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { chatId, message } = req.body;
    if (!chatId || !message)
        throw new error_middleware_1.AppError('chatId and message required', 400);
    const result = await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, message);
    // Persist the outbound message so the in-app Inbox reflects it immediately.
    try {
        await (0, firebase_config_1.getFirestore)()
            .collection(`companies/${companyId}/telegramMessages`)
            .add({
            direction: 'outbound',
            chatId: String(chatId),
            message,
            processed: true,
            sentFrom: 'admin-inbox',
            createdAt: new Date(),
        });
    }
    catch { /* non-blocking — Telegram already received the message */ }
    res.json({ success: result.success, data: result });
}));
exports.default = router;
//# sourceMappingURL=telegram.routes.js.map