/**
 * Orlode Influenceurs API — brand ↔ creator messaging via WhatsApp.
 *
 * Direct mirror of talents.routes.ts but adapted to influencer profiles
 * and the brand-to-creator semantic (brands initiate, creators reply).
 * Shared platform WhatsApp number (Orlode mediates so creators don't
 * get spammed by random unknown numbers, and replies are routed back
 * to the brand's inbox automatically).
 *
 * Routes:
 *   POST  /api/influencers/contact                         — brand sends first message
 *   GET   /api/influencers/conversations                   — brand's conversation list
 *   GET   /api/influencers/conversations/:id/messages      — full thread
 *   POST  /api/influencers/conversations/:id/reply         — brand follow-up
 *   POST  /api/influencers/conversations/:id/mark-read     — clear unread
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { whatsappService } from '../services/whatsapp/whatsappService';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';

const router = Router();

const PLATFORM_COMPANY_ID = process.env['ORLODE_PLATFORM_COMPANY_ID'] ?? 'J4vwyMVHP3ZeHdTsC1gOMjeOTRA2';

// ── POST /api/influencers/contact ─────────────────────────────────────────
const CONTACT_INPUT = z.object({
  influencerId: z.string().min(1),
  message:      z.string().min(10).max(1500),
});

router.post('/contact', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = CONTACT_INPUT.safeParse(req.body);
  if (!parsed.success) throw new AppError(`Invalid input: ${parsed.error.message}`, 400);
  const { influencerId, message } = parsed.data;

  const brandUid = req.user?.uid;
  if (!brandUid) throw new AppError('Auth required', 401);

  const db = getFirestore();

  const profileRef = db.collection('influencers_profiles').doc(influencerId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) throw new AppError('Influencer not found', 404);
  const profile = profileSnap.data() as { displayName?: string; status?: string };
  if (profile.status !== 'active') throw new AppError("Ce créateur n'est pas disponible actuellement", 403);

  const privateSnap = await profileRef.collection('private').doc('contact').get();
  const privateData = privateSnap.data() as { whatsappNumber?: string } | undefined;
  const creatorWhatsApp = privateData?.whatsappNumber;
  if (!creatorWhatsApp) throw new AppError("Ce créateur n'a pas de numéro WhatsApp configuré", 422);

  const brandUserSnap = await db.collection('users').doc(brandUid).get();
  const brandUser = brandUserSnap.data() as { displayName?: string; email?: string; companyId?: string } | undefined;
  const brandCompanyId = brandUser?.companyId;
  let brandCompanyName = '';
  if (brandCompanyId) {
    const companySnap = await db.collection('companies').doc(brandCompanyId).get();
    brandCompanyName = (companySnap.data() as { name?: string } | undefined)?.name ?? '';
  }

  const signature = brandCompanyName
    ? `\n\n— ${brandUser?.displayName ?? 'Une marque'} · *${brandCompanyName}* · via Orlode Influenceurs`
    : `\n\n— ${brandUser?.displayName ?? 'Une marque'} · via Orlode Influenceurs`;
  const finalText = message + signature;

  const config = await whatsappService.getConfig(PLATFORM_COMPANY_ID).catch(() => null);
  if (!config) throw new AppError('Le service WhatsApp est temporairement indisponible.', 503);

  const messageId = await whatsappService.sendMessage(
    config, creatorWhatsApp, finalText, PLATFORM_COMPANY_ID, 'influencers-brand-contact',
  );
  if (!messageId) throw new AppError("Le message n'a pas pu être envoyé.", 502);

  // Conversation upsert
  const normalizedCreatorPhone = creatorWhatsApp.replace(/\D/g, '');
  const conversationId = `${brandUid}__${influencerId}`;
  const convRef = db.collection('influencer_conversations').doc(conversationId);
  const convSnap = await convRef.get();
  const now = new Date();
  if (!convSnap.exists) {
    await convRef.set({
      id: conversationId,
      brandUid,
      brandName: brandUser?.displayName ?? '',
      brandEmail: brandUser?.email ?? '',
      brandCompanyId: brandCompanyId ?? null,
      brandCompanyName,
      influencerId,
      influencerDisplayName: profile.displayName ?? '',
      creatorPhone: normalizedCreatorPhone,
      createdAt: now,
      lastMessageAt: now,
      lastMessageText: message,
      lastMessageFrom: 'brand',
      unreadByBrand: 0,
      messageCount: 1,
    });
  } else {
    await convRef.update({
      lastMessageAt: now,
      lastMessageText: message,
      lastMessageFrom: 'brand',
      messageCount: (convSnap.data()?.['messageCount'] ?? 0) + 1,
    });
  }

  const messageDocId = generateId();
  await convRef.collection('messages').doc(messageDocId).set({
    id: messageDocId,
    from: 'brand',
    text: message,
    whatsappMessageId: messageId,
    sentAt: now,
  });

  // Audit
  const contactId = generateId();
  await db.collection('influencer_contacts').doc(contactId).set({
    id: contactId,
    conversationId,
    influencerId,
    influencerDisplayName: profile.displayName ?? '',
    brandUid,
    brandName: brandUser?.displayName ?? '',
    brandEmail: brandUser?.email ?? '',
    brandCompanyId: brandCompanyId ?? null,
    brandCompanyName,
    message,
    whatsappMessageId: messageId,
    sentAt: now,
    status: 'sent',
  });

  try {
    const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
    await profileRef.update({ contactsCount: FieldValue.increment(1) });
  } catch (err) {
    logger.warn('[InfluencersContact] Failed to increment contactsCount', { error: err instanceof Error ? err.message : err });
  }

  logger.info('[InfluencersContact] Brand → Creator message sent', { influencerId, brandUid, contactId, messageId });

  res.json({
    success: true,
    contactId,
    whatsappMessageId: messageId,
    message: 'Message envoyé sur WhatsApp. Le créateur te répondra directement.',
  });
}));

// ── GET /api/influencers/conversations ────────────────────────────────────
router.get('/conversations', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const brandUid = req.user?.uid;
  if (!brandUid) throw new AppError('Auth required', 401);
  const db = getFirestore();
  const snap = await db.collection('influencer_conversations')
    .where('brandUid', '==', brandUid)
    .orderBy('lastMessageAt', 'desc')
    .limit(100)
    .get();
  const conversations = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      influencerId: data['influencerId'],
      influencerDisplayName: data['influencerDisplayName'] ?? '',
      lastMessageText: data['lastMessageText'] ?? '',
      lastMessageFrom: data['lastMessageFrom'] ?? 'brand',
      lastMessageAt: data['lastMessageAt']?.toDate?.()?.toISOString?.() ?? null,
      unreadByBrand: data['unreadByBrand'] ?? 0,
      messageCount: data['messageCount'] ?? 0,
    };
  });
  res.json({ success: true, data: conversations });
}));

// ── GET /api/influencers/conversations/:id/messages ───────────────────────
router.get('/conversations/:id/messages', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const brandUid = req.user?.uid;
  if (!brandUid) throw new AppError('Auth required', 401);
  const convId = req.params['id']!;
  const db = getFirestore();
  const convSnap = await db.collection('influencer_conversations').doc(convId).get();
  if (!convSnap.exists) throw new AppError('Conversation not found', 404);
  if (convSnap.data()?.['brandUid'] !== brandUid) throw new AppError('Access denied', 403);
  const msgSnap = await db.collection('influencer_conversations').doc(convId)
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
    data: { conversation: { id: convId, ...convSnap.data() }, messages },
  });
}));

// ── POST /api/influencers/conversations/:id/reply ─────────────────────────
const REPLY_INPUT = z.object({ message: z.string().min(1).max(1500) });
router.post('/conversations/:id/reply', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const brandUid = req.user?.uid;
  if (!brandUid) throw new AppError('Auth required', 401);
  const parsed = REPLY_INPUT.safeParse(req.body);
  if (!parsed.success) throw new AppError(`Invalid input: ${parsed.error.message}`, 400);
  const { message } = parsed.data;
  const convId = req.params['id']!;
  const db = getFirestore();
  const convRef = db.collection('influencer_conversations').doc(convId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) throw new AppError('Conversation not found', 404);
  const conv = convSnap.data() as { brandUid?: string; creatorPhone?: string; brandName?: string; brandCompanyName?: string };
  if (conv.brandUid !== brandUid) throw new AppError('Access denied', 403);
  if (!conv.creatorPhone) throw new AppError('Conversation has no creator phone', 422);

  const config = await whatsappService.getConfig(PLATFORM_COMPANY_ID).catch(() => null);
  if (!config) throw new AppError('Service WhatsApp Influenceurs indisponible', 503);

  const sig = conv.brandCompanyName
    ? `\n— ${conv.brandName ?? 'Marque'} · ${conv.brandCompanyName}`
    : `\n— ${conv.brandName ?? 'Marque'} · via Orlode`;
  const messageId = await whatsappService.sendMessage(
    config, conv.creatorPhone, message + sig, PLATFORM_COMPANY_ID, 'influencers-brand-reply',
  );
  if (!messageId) throw new AppError('Message non envoyé. Réessaie.', 502);

  const now = new Date();
  await convRef.update({
    lastMessageAt: now,
    lastMessageText: message,
    lastMessageFrom: 'brand',
    messageCount: (convSnap.data()?.['messageCount'] ?? 0) + 1,
  });
  const messageDocId = generateId();
  await convRef.collection('messages').doc(messageDocId).set({
    id: messageDocId, from: 'brand', text: message, whatsappMessageId: messageId, sentAt: now,
  });

  res.json({ success: true, whatsappMessageId: messageId });
}));

// ── POST /api/influencers/conversations/:id/mark-read ─────────────────────
router.post('/conversations/:id/mark-read', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const brandUid = req.user?.uid;
  if (!brandUid) throw new AppError('Auth required', 401);
  const convId = req.params['id']!;
  const db = getFirestore();
  const convRef = db.collection('influencer_conversations').doc(convId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) throw new AppError('Not found', 404);
  if (convSnap.data()?.['brandUid'] !== brandUid) throw new AppError('Access denied', 403);
  await convRef.update({ unreadByBrand: 0 });
  res.json({ success: true });
}));

export default router;
