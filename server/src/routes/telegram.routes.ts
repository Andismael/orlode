/**
 * Telegram Bot routes — per-company connect/disconnect + webhook receiver.
 *
 * Flow:
 *   1. User creates a bot via @BotFather on Telegram, gets token
 *   2. POST /api/telegram/connect { token } — we validate, save encrypted, set webhook
 *   3. Telegram delivers updates to POST /api/telegram/webhook/:companyId
 *   4. We route through MessagingOrchestrator (Clone brain) → reply
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import {
  getBotInfoByToken, saveTelegramConfig, removeTelegramConfig,
  setTelegramWebhook, deleteTelegramWebhook, sendTelegramMessage,
} from '../services/telegram/telegramService';
import { logger } from '../utils/logger';

const router = Router();

function webhookUrl(companyId: string): string {
  const base = process.env['API_BASE_URL']
    ?? process.env['CORS_ORIGIN']?.replace('mon-assistant-86bbd.web.app', 'api-15262322885.us-central1.run.app')
    ?? 'https://api-15262322885.us-central1.run.app';
  return `${base}/api/telegram/webhook/${companyId}`;
}

// ─── PUBLIC WEBHOOK (Telegram → our server) ─────────────────────────────────
// POST /api/telegram/webhook/:companyId — Telegram delivers updates here
router.post('/webhook/:companyId', asyncHandler(async (req: Request, res: Response) => {
  // Always respond 200 immediately so Telegram doesn't retry
  res.status(200).send('OK');

  const { companyId } = req.params;
  const update = req.body as {
    message?: {
      message_id: number;
      from?: { id: number; first_name?: string; username?: string };
      chat: { id: number; type: string };
      text?: string;
      voice?: { file_id: string };
    };
  };
  const msg = update?.message;
  if (!msg?.text || !msg.from) return; // ignore non-text updates for now

  // Handle Telegram /start and /help specially — send greeting from Clone config instead of hitting AI
  if (msg.text === '/start' || msg.text === '/help') {
    try {
      const { getCloneConfig } = await import('../services/cloneEngine');
      const cfg = await getCloneConfig(companyId);
      await sendTelegramMessage(companyId, String(msg.chat.id), cfg.greeting, 'Markdown');
      return;
    } catch { /* fall through to AI */ }
  }

  // Dedup by message_id
  const db = getFirestore();
  const dedupKey = `tg_${companyId}_${msg.chat.id}_${msg.message_id}`;
  const dedup = await db.collection('_telegramDedup').doc(dedupKey).get().catch(() => null);
  if (dedup?.exists) return;
  await db.collection('_telegramDedup').doc(dedupKey).set({ at: new Date() }).catch(() => {});

  // Persist inbound message
  await db.collection(`companies/${companyId}/telegramMessages`).add({
    direction:    'inbound',
    chatId:       String(msg.chat.id),
    fromId:       String(msg.from.id),
    fromName:     msg.from.first_name ?? msg.from.username ?? 'User',
    message:      msg.text,
    telegramMsgId: msg.message_id,
    createdAt:    new Date(),
  });

  try {
    const { handleMessage } = await import('../messaging');
    const result = await handleMessage(
      {
        text: msg.text,
        from: String(msg.from.id),
        channel: 'telegram',
        providerMeta: { chatId: msg.chat.id, messageId: msg.message_id },
      },
      {
        companyId,
        language: 'fr',
        visitorName: msg.from.first_name ?? msg.from.username,
        fastReply: true,
      },
    );

    for (const reply of result.messages) {
      await sendTelegramMessage(companyId, String(msg.chat.id), reply, 'Markdown');
    }

    // Persist outbound reply
    await db.collection(`companies/${companyId}/telegramMessages`).add({
      direction:  'outbound',
      chatId:     String(msg.chat.id),
      message:    result.messages.join('\n'),
      processed:  true,
      createdAt:  new Date(),
    });
  } catch (err) {
    logger.error('[Telegram] Agent processing failed', { companyId, err: String(err) });
  }
}));

// ─── PROTECTED ROUTES (company admin) ───────────────────────────────────────

router.use(authMiddleware);

// GET /api/telegram/status
router.get('/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const doc = await getFirestore()
    .collection('companies').doc(companyId)
    .collection('integrations').doc('telegram').get();
  const data = doc.exists ? doc.data() ?? {} : {};
  res.json({
    success: true,
    data: {
      connected:   Boolean(data['botToken']),
      botName:     data['botName']     ?? null,
      botUsername: data['botUsername'] ?? null,
      connectedAt: data['connectedAt'] ?? null,
    },
  });
}));

// POST /api/telegram/connect — validate token, save encrypted, register webhook
router.post('/connect', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { token } = req.body as { token?: string };
  if (!token) throw new AppError('Bot token required', 400);

  // Step 1: validate via Telegram /getMe
  const info = await getBotInfoByToken(token);
  if (!info) throw new AppError('Bot token invalide. Vérifiez que vous avez bien copié le token complet depuis @BotFather.', 400);

  // Step 2: register webhook on Telegram's side
  const wh = await setTelegramWebhook(token, webhookUrl(companyId));
  if (!wh.ok) throw new AppError(`Impossible de configurer le webhook: ${wh.description ?? 'erreur inconnue'}`, 400);

  // Step 3: save encrypted config in Firestore
  await saveTelegramConfig(companyId, token, { botName: info.name, botUsername: info.username });

  logger.info('[Telegram] Connected', { companyId, bot: `@${info.username}` });
  res.json({ success: true, data: { botName: info.name, botUsername: info.username, webhookUrl: webhookUrl(companyId) } });
}));

// DELETE /api/telegram/disconnect
router.delete('/disconnect', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  // Fetch the token to deregister the webhook on Telegram's side
  const doc = await getFirestore()
    .collection('companies').doc(companyId)
    .collection('integrations').doc('telegram').get();
  const data = doc.exists ? doc.data() : null;
  if (data?.['botToken']) {
    try {
      const { decrypt, isEncrypted } = await import('../config/encryption');
      const t = data['botToken'] as string;
      const plain = isEncrypted(t) ? decrypt(t) : t;
      await deleteTelegramWebhook(plain);
    } catch { /* ignore */ }
  }
  await removeTelegramConfig(companyId);
  res.json({ success: true });
}));

// POST /api/telegram/send — manual test send from admin panel
router.post('/send', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { chatId, message } = req.body as { chatId: string; message: string };
  if (!chatId || !message) throw new AppError('chatId and message required', 400);
  const result = await sendTelegramMessage(companyId, chatId, message);
  res.json({ success: result.success, data: result });
}));

export default router;
