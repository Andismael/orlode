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
    const msg = update?.message;
    if (!msg?.text || !msg.from)
        return; // ignore non-text updates for now
    // Handle Telegram /start and /help specially — send greeting from Clone config instead of hitting AI
    if (msg.text === '/start' || msg.text === '/help') {
        try {
            const { getCloneConfig } = await Promise.resolve().then(() => __importStar(require('../services/cloneEngine')));
            const cfg = await getCloneConfig(companyId);
            await (0, telegramService_1.sendTelegramMessage)(companyId, String(msg.chat.id), cfg.greeting, 'Markdown');
            return;
        }
        catch { /* fall through to AI */ }
    }
    // Dedup by message_id
    const db = (0, firebase_config_1.getFirestore)();
    const dedupKey = `tg_${companyId}_${msg.chat.id}_${msg.message_id}`;
    const dedup = await db.collection('_telegramDedup').doc(dedupKey).get().catch(() => null);
    if (dedup?.exists)
        return;
    await db.collection('_telegramDedup').doc(dedupKey).set({ at: new Date() }).catch(() => { });
    // Persist inbound message
    await db.collection(`companies/${companyId}/telegramMessages`).add({
        direction: 'inbound',
        chatId: String(msg.chat.id),
        fromId: String(msg.from.id),
        fromName: msg.from.first_name ?? msg.from.username ?? 'User',
        message: msg.text,
        telegramMsgId: msg.message_id,
        createdAt: new Date(),
    });
    try {
        const { handleMessage } = await Promise.resolve().then(() => __importStar(require('../messaging')));
        const result = await handleMessage({
            text: msg.text,
            from: String(msg.from.id),
            channel: 'telegram',
            providerMeta: { chatId: msg.chat.id, messageId: msg.message_id },
        }, {
            companyId,
            language: 'fr',
            visitorName: msg.from.first_name ?? msg.from.username,
            fastReply: true,
        });
        for (const reply of result.messages) {
            await (0, telegramService_1.sendTelegramMessage)(companyId, String(msg.chat.id), reply, 'Markdown');
        }
        // Persist outbound reply
        await db.collection(`companies/${companyId}/telegramMessages`).add({
            direction: 'outbound',
            chatId: String(msg.chat.id),
            message: result.messages.join('\n'),
            processed: true,
            createdAt: new Date(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Telegram] Agent processing failed', { companyId, err: String(err) });
    }
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
    res.json({ success: result.success, data: result });
}));
exports.default = router;
//# sourceMappingURL=telegram.routes.js.map