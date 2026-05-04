"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTelegramConfig = getTelegramConfig;
exports.saveTelegramConfig = saveTelegramConfig;
exports.removeTelegramConfig = removeTelegramConfig;
exports.setTelegramWebhook = setTelegramWebhook;
exports.deleteTelegramWebhook = deleteTelegramWebhook;
exports.getBotInfoByToken = getBotInfoByToken;
exports.sendTelegramMessage = sendTelegramMessage;
exports.sendTelegramChannelMessage = sendTelegramChannelMessage;
exports.sendTelegramPhoto = sendTelegramPhoto;
exports.sendTelegramDocument = sendTelegramDocument;
exports.getTelegramBotInfo = getTelegramBotInfo;
/**
 * Telegram Bot Service — Send/receive messages via Telegram Bot API
 * Supports: text, markdown, photos, documents, groups, channels
 */
const firebase_config_1 = require("../../config/firebase.config");
const encryption_1 = require("../../config/encryption");
const logger_1 = require("../../utils/logger");
const TELEGRAM_API = 'https://api.telegram.org';
/** Get Telegram config for a company. Decrypts token if stored encrypted. */
async function getTelegramConfig(companyId) {
    return getConfig(companyId);
}
async function getConfig(companyId) {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection('companies').doc(companyId)
            .collection('integrations').doc('telegram').get();
        const data = doc.data();
        if (!data) {
            // Fallback to legacy location on company root (old docs)
            const legacyDoc = await db.collection('companies').doc(companyId).get();
            const legacy = legacyDoc.data();
            const raw = legacy?.['telegramBotToken'] ?? process.env['TELEGRAM_BOT_TOKEN'] ?? '';
            if (!raw)
                return null;
            return {
                botToken: (0, encryption_1.isEncrypted)(raw) ? (0, encryption_1.decrypt)(raw) : raw,
                defaultChatId: legacy?.['telegramDefaultChatId'],
                channelId: legacy?.['telegramChannelId'],
            };
        }
        const stored = data['botToken'];
        if (!stored)
            return null;
        return {
            botToken: (0, encryption_1.isEncrypted)(stored) ? (0, encryption_1.decrypt)(stored) : stored,
            defaultChatId: data['defaultChatId'],
            channelId: data['channelId'],
        };
    }
    catch {
        return null;
    }
}
/** Save Telegram config (encrypted) */
async function saveTelegramConfig(companyId, botToken, opts = {}) {
    await (0, firebase_config_1.getFirestore)()
        .collection('companies').doc(companyId)
        .collection('integrations').doc('telegram')
        .set({
        botToken: (0, encryption_1.encrypt)(botToken),
        defaultChatId: opts.defaultChatId ?? null,
        channelId: opts.channelId ?? null,
        botUsername: opts.botUsername ?? null,
        botName: opts.botName ?? null,
        connectedAt: new Date(),
    });
}
/** Remove Telegram config */
async function removeTelegramConfig(companyId) {
    await (0, firebase_config_1.getFirestore)()
        .collection('companies').doc(companyId)
        .collection('integrations').doc('telegram')
        .delete();
}
/** Register this company's webhook URL with Telegram. Uses per-company secret path. */
async function setTelegramWebhook(botToken, webhookUrl) {
    try {
        const res = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
        });
        const data = await res.json();
        return data;
    }
    catch (err) {
        return { ok: false, description: String(err) };
    }
}
/** Remove webhook from Telegram side */
async function deleteTelegramWebhook(botToken) {
    try {
        await fetch(`${TELEGRAM_API}/bot${botToken}/deleteWebhook`, { method: 'POST' });
    }
    catch { /* ignore */ }
}
/** Get bot info directly from a token (used during /connect validation) */
async function getBotInfoByToken(botToken) {
    try {
        const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
        const data = await res.json();
        if (!data.ok || !data.result)
            return null;
        return { id: data.result.id, name: data.result.first_name, username: data.result.username };
    }
    catch {
        return null;
    }
}
/** Send a text message via Telegram */
async function sendTelegramMessage(companyId, chatId, text, parseMode = 'Markdown') {
    const config = await getConfig(companyId);
    if (!config)
        return { success: false, error: 'Telegram not configured' };
    try {
        const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId || config.defaultChatId, text, parse_mode: parseMode }),
        });
        const data = await res.json();
        if (data.ok) {
            logger_1.logger.info(`[Telegram] Message sent to ${chatId}: ${text.slice(0, 50)}`);
            return { success: true, messageId: data.result?.message_id };
        }
        return { success: false, error: data.description ?? 'Send failed' };
    }
    catch (err) {
        logger_1.logger.error('[Telegram] Send error:', err);
        return { success: false, error: String(err) };
    }
}
/** Send a message to the company's Telegram channel */
async function sendTelegramChannelMessage(companyId, text) {
    const config = await getConfig(companyId);
    if (!config?.channelId)
        return { success: false, error: 'Telegram channel not configured' };
    return sendTelegramMessage(companyId, config.channelId, text);
}
/** Send a photo via Telegram */
async function sendTelegramPhoto(companyId, chatId, photoUrl, caption) {
    const config = await getConfig(companyId);
    if (!config)
        return { success: false, error: 'Telegram not configured' };
    try {
        const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId || config.defaultChatId, photo: photoUrl, caption, parse_mode: 'Markdown' }),
        });
        const data = await res.json();
        return data.ok ? { success: true } : { success: false, error: data.description };
    }
    catch (err) {
        return { success: false, error: String(err) };
    }
}
/** Send a document via Telegram */
async function sendTelegramDocument(companyId, chatId, documentUrl, caption) {
    const config = await getConfig(companyId);
    if (!config)
        return { success: false, error: 'Telegram not configured' };
    try {
        const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendDocument`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId || config.defaultChatId, document: documentUrl, caption, parse_mode: 'Markdown' }),
        });
        const data = await res.json();
        return data.ok ? { success: true } : { success: false, error: data.description };
    }
    catch (err) {
        return { success: false, error: String(err) };
    }
}
/** Get bot info */
async function getTelegramBotInfo(companyId) {
    const config = await getConfig(companyId);
    if (!config)
        return null;
    try {
        const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/getMe`);
        const data = await res.json();
        return data.ok ? { name: data.result?.first_name ?? '', username: data.result?.username ?? '' } : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=telegramService.js.map