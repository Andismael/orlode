/**
 * Telegram Bot Service — Send/receive messages via Telegram Bot API
 * Supports: text, markdown, photos, documents, groups, channels
 */
import { getFirestore } from '../../config/firebase.config';
import { encrypt, decrypt, isEncrypted } from '../../config/encryption';
import { logger } from '../../utils/logger';

const TELEGRAM_API = 'https://api.telegram.org';

interface TelegramConfig {
  botToken: string;
  defaultChatId?: string;
  channelId?: string;
}

/** Get Telegram config for a company. Decrypts token if stored encrypted. */
export async function getTelegramConfig(companyId: string): Promise<TelegramConfig | null> {
  return getConfig(companyId);
}
async function getConfig(companyId: string): Promise<TelegramConfig | null> {
  try {
    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId)
      .collection('integrations').doc('telegram').get();
    const data = doc.data();
    if (!data) {
      // Fallback to legacy location on company root (old docs)
      const legacyDoc = await db.collection('companies').doc(companyId).get();
      const legacy = legacyDoc.data();
      const raw = (legacy?.['telegramBotToken'] as string) ?? process.env['TELEGRAM_BOT_TOKEN'] ?? '';
      if (!raw) return null;
      return {
        botToken: isEncrypted(raw) ? decrypt(raw) : raw,
        defaultChatId: legacy?.['telegramDefaultChatId'] as string | undefined,
        channelId:     legacy?.['telegramChannelId']   as string | undefined,
      };
    }
    const stored = data['botToken'] as string;
    if (!stored) return null;
    return {
      botToken:      isEncrypted(stored) ? decrypt(stored) : stored,
      defaultChatId: data['defaultChatId'] as string | undefined,
      channelId:     data['channelId']     as string | undefined,
    };
  } catch { return null; }
}

/** Save Telegram config (encrypted) */
export async function saveTelegramConfig(
  companyId: string,
  botToken: string,
  opts: { defaultChatId?: string; channelId?: string; botUsername?: string; botName?: string } = {},
): Promise<void> {
  await getFirestore()
    .collection('companies').doc(companyId)
    .collection('integrations').doc('telegram')
    .set({
      botToken: encrypt(botToken),
      defaultChatId: opts.defaultChatId ?? null,
      channelId:     opts.channelId     ?? null,
      botUsername:   opts.botUsername   ?? null,
      botName:       opts.botName       ?? null,
      connectedAt:   new Date(),
    });
}

/** Remove Telegram config */
export async function removeTelegramConfig(companyId: string): Promise<void> {
  await getFirestore()
    .collection('companies').doc(companyId)
    .collection('integrations').doc('telegram')
    .delete();
}

/** Register this company's webhook URL with Telegram. Uses per-company secret path. */
export async function setTelegramWebhook(botToken: string, webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    return data;
  } catch (err) {
    return { ok: false, description: String(err) };
  }
}

/** Remove webhook from Telegram side */
export async function deleteTelegramWebhook(botToken: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/bot${botToken}/deleteWebhook`, { method: 'POST' });
  } catch { /* ignore */ }
}

/** Get bot info directly from a token (used during /connect validation) */
export async function getBotInfoByToken(botToken: string): Promise<{ id: number; name: string; username: string } | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { id: number; first_name: string; username: string } };
    if (!data.ok || !data.result) return null;
    return { id: data.result.id, name: data.result.first_name, username: data.result.username };
  } catch { return null; }
}

/** Send a text message via Telegram */
export async function sendTelegramMessage(companyId: string, chatId: string, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const config = await getConfig(companyId);
  if (!config) return { success: false, error: 'Telegram not configured' };

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId || config.defaultChatId, text, parse_mode: parseMode }),
    });
    const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string };
    if (data.ok) {
      logger.info(`[Telegram] Message sent to ${chatId}: ${text.slice(0, 50)}`);
      return { success: true, messageId: data.result?.message_id };
    }
    return { success: false, error: data.description ?? 'Send failed' };
  } catch (err) {
    logger.error('[Telegram] Send error:', err);
    return { success: false, error: String(err) };
  }
}

/** Send a message to the company's Telegram channel */
export async function sendTelegramChannelMessage(companyId: string, text: string): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const config = await getConfig(companyId);
  if (!config?.channelId) return { success: false, error: 'Telegram channel not configured' };
  return sendTelegramMessage(companyId, config.channelId, text);
}

/** Send a photo via Telegram */
export async function sendTelegramPhoto(companyId: string, chatId: string, photoUrl: string, caption?: string): Promise<{ success: boolean; error?: string }> {
  const config = await getConfig(companyId);
  if (!config) return { success: false, error: 'Telegram not configured' };

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId || config.defaultChatId, photo: photoUrl, caption, parse_mode: 'Markdown' }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    return data.ok ? { success: true } : { success: false, error: data.description };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Send a document via Telegram */
export async function sendTelegramDocument(companyId: string, chatId: string, documentUrl: string, caption?: string): Promise<{ success: boolean; error?: string }> {
  const config = await getConfig(companyId);
  if (!config) return { success: false, error: 'Telegram not configured' };

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId || config.defaultChatId, document: documentUrl, caption, parse_mode: 'Markdown' }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    return data.ok ? { success: true } : { success: false, error: data.description };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Download a file from Telegram (photo, voice, document). Returns buffer + mimeType.
 *  Telegram requires a 2-step process: getFile (resolves file_id → file_path),
 *  then https://api.telegram.org/file/bot{token}/{file_path}. */
export async function downloadTelegramFile(
  companyId: string,
  fileId: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const config = await getConfig(companyId);
  if (!config) return null;
  try {
    const meta = await fetch(`${TELEGRAM_API}/bot${config.botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const metaJson = await meta.json() as { ok: boolean; result?: { file_path?: string } };
    const path = metaJson?.result?.file_path;
    if (!metaJson.ok || !path) return null;
    const file = await fetch(`${TELEGRAM_API}/file/bot${config.botToken}/${path}`);
    if (!file.ok) return null;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const mimeType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      ext === 'oga' || ext === 'ogg' ? 'audio/ogg' :
      ext === 'mp3' ? 'audio/mpeg' :
      ext === 'm4a' ? 'audio/mp4' :
      'application/octet-stream';
    return { buffer, mimeType };
  } catch (err) {
    logger.error('[Telegram] downloadTelegramFile failed', { fileId, err: String(err) });
    return null;
  }
}

/** Send a native location pin on Telegram. */
export async function sendTelegramLocation(
  companyId: string, chatId: string, latitude: number, longitude: number,
): Promise<{ success: boolean; error?: string }> {
  const config = await getConfig(companyId);
  if (!config) return { success: false, error: 'Telegram not configured' };
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendLocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, latitude, longitude }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    return data.ok ? { success: true } : { success: false, error: data.description };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Send a message with inline keyboard buttons (equivalent to WhatsApp quick replies).
 *  buttons = array of rows, each row = array of {text, callback_data?, url?}. */
export async function sendTelegramKeyboard(
  companyId: string, chatId: string, text: string,
  buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>>,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
): Promise<{ success: boolean; error?: string }> {
  const config = await getConfig(companyId);
  if (!config) return { success: false, error: 'Telegram not configured' };
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text, parse_mode: parseMode,
        reply_markup: { inline_keyboard: buttons },
      }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    return data.ok ? { success: true } : { success: false, error: data.description };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Get bot info */
export async function getTelegramBotInfo(companyId: string): Promise<{ name: string; username: string } | null> {
  const config = await getConfig(companyId);
  if (!config) return null;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${config.botToken}/getMe`);
    const data = await res.json() as { ok: boolean; result?: { first_name: string; username: string } };
    return data.ok ? { name: data.result?.first_name ?? '', username: data.result?.username ?? '' } : null;
  } catch { return null; }
}
