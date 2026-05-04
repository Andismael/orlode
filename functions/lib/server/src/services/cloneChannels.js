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
exports.handleWhatsAppMessage = handleWhatsAppMessage;
exports.handleTelegramMessage = handleTelegramMessage;
exports.handleEmailMessage = handleEmailMessage;
exports.getChannelStatus = getChannelStatus;
/**
 * Clone Channels — Multi-channel messaging for the company clone
 *
 * Connects the Clone Engine to:
 *   1. WhatsApp (Meta Cloud API — incoming webhook → clone → reply)
 *   2. Telegram (Bot API — incoming update → clone → reply)
 *   3. Email (receive → clone → send reply via Resend)
 *   4. Web (already working via /api/clone/:companyId/chat)
 *
 * Architecture:
 *   Incoming message (any channel)
 *     → normalize to { companyId, message, sender, channel }
 *     → cloneChat() from cloneEngine
 *     → send reply back via same channel
 */
const cloneEngine_1 = require("./cloneEngine");
const telegramService_1 = require("./telegram/telegramService");
const emailService_1 = require("./email/emailService");
const firebase_config_1 = require("../config/firebase.config");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
// ══════════════════════════════════════════════════════════════════════════════
// 1. WHATSAPP CHANNEL
// ══════════════════════════════════════════════════════════════════════════════
/** Handle incoming WhatsApp message → clone → reply */
async function handleWhatsAppMessage(companyId, from, // phone number
message, messageId) {
    logger_1.logger.info(`[CloneChannel:WhatsApp] ${from}: "${message.slice(0, 60)}"`);
    // Use phone as session key
    const sessionId = `wa_${companyId}_${from.replace(/\D/g, '')}`;
    const result = await (0, cloneEngine_1.cloneChat)({
        companyId, message, sessionId,
        channel: 'whatsapp',
        visitorName: from,
    });
    // Send reply via WhatsApp
    try {
        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('./whatsapp/whatsappService')));
        const config = await whatsappService.getConfig(companyId);
        if (config) {
            await whatsappService.sendMessage(config, from, result.reply);
        }
    }
    catch (err) {
        logger_1.logger.error('[CloneChannel:WhatsApp] Reply failed:', err);
    }
    // Log
    await logChannelMessage(companyId, 'whatsapp', from, message, result.reply, sessionId);
    return { reply: result.reply, sessionId };
}
// ══════════════════════════════════════════════════════════════════════════════
// 2. TELEGRAM CHANNEL
// ══════════════════════════════════════════════════════════════════════════════
/** Handle incoming Telegram message → clone → reply */
async function handleTelegramMessage(companyId, chatId, from, // username or first_name
message) {
    logger_1.logger.info(`[CloneChannel:Telegram] ${from} (${chatId}): "${message.slice(0, 60)}"`);
    const sessionId = `tg_${companyId}_${chatId}`;
    const result = await (0, cloneEngine_1.cloneChat)({
        companyId, message, sessionId,
        channel: 'telegram',
        visitorName: from,
    });
    // Send reply via Telegram
    await (0, telegramService_1.sendTelegramMessage)(companyId, chatId, result.reply).catch(err => {
        logger_1.logger.error('[CloneChannel:Telegram] Reply failed:', err);
    });
    await logChannelMessage(companyId, 'telegram', `${from}:${chatId}`, message, result.reply, sessionId);
    return { reply: result.reply, sessionId };
}
// ══════════════════════════════════════════════════════════════════════════════
// 3. EMAIL CHANNEL
// ══════════════════════════════════════════════════════════════════════════════
/** Handle incoming email → clone → reply */
async function handleEmailMessage(companyId, fromEmail, fromName, subject, body) {
    logger_1.logger.info(`[CloneChannel:Email] ${fromEmail}: "${subject}"`);
    const sessionId = `email_${companyId}_${fromEmail.replace(/[^a-z0-9]/gi, '_')}`;
    // Combine subject + body as the message
    const message = subject ? `${subject}\n\n${body}` : body;
    const result = await (0, cloneEngine_1.cloneChat)({
        companyId, message, sessionId,
        channel: 'api',
        visitorName: fromName || fromEmail,
        visitorEmail: fromEmail,
    });
    // Get company info for reply branding
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const companyName = companyDoc.data()?.['name'] ?? 'Orlode';
    // Send reply via email
    await (0, emailService_1.sendEmail)({
        to: fromEmail,
        subject: `Re: ${subject || 'Votre message'}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="padding: 20px; background: linear-gradient(135deg, #0019FF, #0092FF); border-radius: 12px 12px 0 0;">
          <h2 style="color: white; margin: 0; font-size: 18px;">${companyName}</h2>
        </div>
        <div style="padding: 24px; background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${result.reply}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">Cet email a ete genere automatiquement par l'assistant de ${companyName}.</p>
        </div>
      </div>
    `,
    }).catch(err => {
        logger_1.logger.error('[CloneChannel:Email] Reply failed:', err);
    });
    await logChannelMessage(companyId, 'email', fromEmail, message, result.reply, sessionId);
    return { reply: result.reply, sessionId };
}
// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED MESSAGE LOG
// ══════════════════════════════════════════════════════════════════════════════
async function logChannelMessage(companyId, channel, sender, incoming, reply, sessionId) {
    try {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/cloneMessages`).doc((0, helpers_1.generateId)()).set({
            channel, sender, incoming: incoming.slice(0, 500), reply: reply.slice(0, 500),
            sessionId, timestamp: new Date(),
        });
    }
    catch { }
}
// ══════════════════════════════════════════════════════════════════════════════
// CHANNEL STATUS (check which channels are configured)
// ══════════════════════════════════════════════════════════════════════════════
async function getChannelStatus(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const company = companyDoc.data() ?? {};
    const hasWhatsApp = !!(company['whatsappPhoneNumberId'] || process.env['WHATSAPP_PHONE_NUMBER_ID']);
    const hasTelegram = !!(company['telegramBotToken'] || process.env['TELEGRAM_BOT_TOKEN']);
    const hasEmail = true; // Resend always configured
    return {
        web: { enabled: true, configured: true, info: 'Toujours actif' },
        whatsapp: { enabled: hasWhatsApp, configured: hasWhatsApp, info: hasWhatsApp ? 'Configure' : 'Ajoutez votre WhatsApp Business dans Admin > Integrations' },
        telegram: { enabled: hasTelegram, configured: hasTelegram, info: hasTelegram ? 'Configure' : 'Ajoutez votre bot Telegram dans Admin > Integrations' },
        email: { enabled: hasEmail, configured: hasEmail, info: 'Actif via Resend' },
    };
}
//# sourceMappingURL=cloneChannels.js.map