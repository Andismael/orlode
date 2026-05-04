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
import { cloneChat } from './cloneEngine';
import { sendTelegramMessage } from './telegram/telegramService';
import { sendEmail } from './email/emailService';
import { getFirestore } from '../config/firebase.config';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

// ══════════════════════════════════════════════════════════════════════════════
// 1. WHATSAPP CHANNEL
// ══════════════════════════════════════════════════════════════════════════════

/** Handle incoming WhatsApp message → clone → reply */
export async function handleWhatsAppMessage(
  companyId: string,
  from: string,       // phone number
  message: string,
  messageId: string,
): Promise<{ reply: string; sessionId: string }> {
  logger.info(`[CloneChannel:WhatsApp] ${from}: "${message.slice(0, 60)}"`);

  // Use phone as session key
  const sessionId = `wa_${companyId}_${from.replace(/\D/g, '')}`;

  const result = await cloneChat({
    companyId, message, sessionId,
    channel: 'whatsapp',
    visitorName: from,
  });

  // Send reply via WhatsApp
  try {
    const { whatsappService } = await import('./whatsapp/whatsappService');
    const config = await whatsappService.getConfig(companyId);
    if (config) {
      await whatsappService.sendMessage(config, from, result.reply);
    }
  } catch (err) {
    logger.error('[CloneChannel:WhatsApp] Reply failed:', err);
  }

  // Log
  await logChannelMessage(companyId, 'whatsapp', from, message, result.reply, sessionId);

  return { reply: result.reply, sessionId };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. TELEGRAM CHANNEL
// ══════════════════════════════════════════════════════════════════════════════

/** Handle incoming Telegram message → clone → reply */
export async function handleTelegramMessage(
  companyId: string,
  chatId: string,
  from: string,        // username or first_name
  message: string,
): Promise<{ reply: string; sessionId: string }> {
  logger.info(`[CloneChannel:Telegram] ${from} (${chatId}): "${message.slice(0, 60)}"`);

  const sessionId = `tg_${companyId}_${chatId}`;

  const result = await cloneChat({
    companyId, message, sessionId,
    channel: 'telegram',
    visitorName: from,
  });

  // Send reply via Telegram
  await sendTelegramMessage(companyId, chatId, result.reply).catch(err => {
    logger.error('[CloneChannel:Telegram] Reply failed:', err);
  });

  await logChannelMessage(companyId, 'telegram', `${from}:${chatId}`, message, result.reply, sessionId);

  return { reply: result.reply, sessionId };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. EMAIL CHANNEL
// ══════════════════════════════════════════════════════════════════════════════

/** Handle incoming email → clone → reply */
export async function handleEmailMessage(
  companyId: string,
  fromEmail: string,
  fromName: string,
  subject: string,
  body: string,
): Promise<{ reply: string; sessionId: string }> {
  logger.info(`[CloneChannel:Email] ${fromEmail}: "${subject}"`);

  const sessionId = `email_${companyId}_${fromEmail.replace(/[^a-z0-9]/gi, '_')}`;

  // Combine subject + body as the message
  const message = subject ? `${subject}\n\n${body}` : body;

  const result = await cloneChat({
    companyId, message, sessionId,
    channel: 'api',
    visitorName: fromName || fromEmail,
    visitorEmail: fromEmail,
  });

  // Get company info for reply branding
  const db = getFirestore();
  const companyDoc = await db.collection('companies').doc(companyId).get();
  const companyName = (companyDoc.data()?.['name'] as string) ?? 'Orlode';

  // Send reply via email
  await sendEmail({
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
    logger.error('[CloneChannel:Email] Reply failed:', err);
  });

  await logChannelMessage(companyId, 'email', fromEmail, message, result.reply, sessionId);

  return { reply: result.reply, sessionId };
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIFIED MESSAGE LOG
// ══════════════════════════════════════════════════════════════════════════════

async function logChannelMessage(companyId: string, channel: string, sender: string, incoming: string, reply: string, sessionId: string) {
  try {
    await getFirestore().collection(`companies/${companyId}/cloneMessages`).doc(generateId()).set({
      channel, sender, incoming: incoming.slice(0, 500), reply: reply.slice(0, 500),
      sessionId, timestamp: new Date(),
    });
  } catch {}
}

// ══════════════════════════════════════════════════════════════════════════════
// CHANNEL STATUS (check which channels are configured)
// ══════════════════════════════════════════════════════════════════════════════

export async function getChannelStatus(companyId: string): Promise<Record<string, { enabled: boolean; configured: boolean; info: string }>> {
  const db = getFirestore();
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
