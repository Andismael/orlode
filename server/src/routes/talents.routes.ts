/**
 * Orlode Talents API — server endpoints for the talents marketplace.
 *
 * Public read endpoints + the recruiter↔candidate WhatsApp conversation
 * flow with an integrated inbox on orlode.com (no need for the recruiter
 * to use WhatsApp on their phone — replies are routed via webhook into
 * Firestore conversations and surfaced in /talents/inbox).
 *
 * Routes:
 *   POST  /api/talents/contact                         — first message from recruiter (creates conversation)
 *   GET   /api/talents/:id/public                      — public talent profile (no private fields)
 *   GET   /api/talents/conversations                   — recruiter's conversation list
 *   GET   /api/talents/conversations/:id/messages      — full thread for a conversation
 *   POST  /api/talents/conversations/:id/reply         — recruiter sends a follow-up (already in conv)
 *   POST  /api/talents/conversations/:id/mark-read     — clear unread badge
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { whatsappService } from '../services/whatsapp/whatsappService';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';

const router = Router();

// Orlode platform's own companyId — used as the WhatsApp sender for Talents
// contact messages (the platform mediates between recruiter and candidate so
// the candidate doesn't get spammed from many unknown numbers). The master
// SuperAdmin uid is also the platform companyId by convention.
const PLATFORM_COMPANY_ID = process.env['ORLODE_PLATFORM_COMPANY_ID'] ?? 'J4vwyMVHP3ZeHdTsC1gOMjeOTRA2';

// ── POST /api/talents/contact ─────────────────────────────────────────────
// Body: { talentId, message }
// Auth: required (recruiter must be logged in via Firebase Auth)
// Flow:
//   1. Read talent's private WhatsApp number from talents_profiles/{id}/private/contact
//   2. Send the message via Orlode's platform WhatsApp Business
//   3. Audit-log to talent_contacts/{contactId}
//   4. Atomically increment talents_profiles/{id}.contactsCount
const CONTACT_INPUT = z.object({
  talentId: z.string().min(1),
  message:  z.string().min(10).max(1000),
});

router.post('/contact', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = CONTACT_INPUT.safeParse(req.body);
  if (!parsed.success) throw new AppError(`Invalid input: ${parsed.error.message}`, 400);
  const { talentId, message } = parsed.data;

  const recruiterUid = req.user?.uid;
  if (!recruiterUid) throw new AppError('Auth required', 401);

  const db = getFirestore();

  // 1. Talent must exist and be active
  const talentRef = db.collection('talents_profiles').doc(talentId);
  const talentSnap = await talentRef.get();
  if (!talentSnap.exists) throw new AppError('Talent not found', 404);
  const talent = talentSnap.data() as { displayName?: string; status?: string };
  if (talent.status !== 'active') throw new AppError('This talent is not currently accepting contacts', 403);

  // 2. Get the private WhatsApp number (subcollection, locked by Firestore rules)
  const privateSnap = await talentRef.collection('private').doc('contact').get();
  const privateData = privateSnap.data() as { whatsappNumber?: string } | undefined;
  const candidateWhatsApp = privateData?.whatsappNumber;
  if (!candidateWhatsApp) throw new AppError('This talent has no WhatsApp number on file', 422);

  // 3. Lookup recruiter info for the audit + outbound message attribution
  const recruiterUserSnap = await db.collection('users').doc(recruiterUid).get();
  const recruiterUser = recruiterUserSnap.data() as { displayName?: string; email?: string; companyId?: string } | undefined;
  const recruiterCompanyId = recruiterUser?.companyId;
  let recruiterCompanyName = '';
  if (recruiterCompanyId) {
    const companySnap = await db.collection('companies').doc(recruiterCompanyId).get();
    recruiterCompanyName = (companySnap.data() as { name?: string } | undefined)?.name ?? '';
  }

  // 4. Compose the WhatsApp message (signature so the candidate knows it's not spam)
  const signature = recruiterCompanyName
    ? `\n\n— ${recruiterUser?.displayName ?? 'Un recruteur'} · *${recruiterCompanyName}* · via Orlode Talents`
    : `\n\n— ${recruiterUser?.displayName ?? 'Un recruteur'} · via Orlode Talents`;
  const finalText = message + signature;

  // 5. Send via Orlode's platform WhatsApp (the recruiter doesn't expose their
  //    own number — Orlode mediates and stores the routing so candidate replies
  //    can be routed back to the recruiter).
  const config = await whatsappService.getConfig(PLATFORM_COMPANY_ID).catch(() => null);
  if (!config) {
    logger.error('[TalentsContact] Platform WhatsApp not configured', { platform: PLATFORM_COMPANY_ID });
    throw new AppError('Le service WhatsApp Talents est temporairement indisponible. Réessaie dans quelques minutes.', 503);
  }
  const messageId = await whatsappService.sendMessage(
    config, candidateWhatsApp, finalText, PLATFORM_COMPANY_ID, 'talents-recruiter-contact',
  );
  if (!messageId) {
    logger.warn('[TalentsContact] WhatsApp send returned no messageId', { talentId, recruiterUid });
    throw new AppError('Le message n\'a pas pu être envoyé. Réessaie ou contacte le support.', 502);
  }

  // 6. Conversation — create-or-update so this recruiter-talent pair gets
  //    one persistent thread. Key = `${recruiterUid}__${talentId}` for
  //    deterministic upsert without a query.
  const normalizedCandidatePhone = candidateWhatsApp.replace(/\D/g, '');
  const conversationId = `${recruiterUid}__${talentId}`;
  const convRef = db.collection('talent_conversations').doc(conversationId);
  const convSnap = await convRef.get();
  const now = new Date();
  if (!convSnap.exists) {
    await convRef.set({
      id: conversationId,
      recruiterUid,
      recruiterName: recruiterUser?.displayName ?? '',
      recruiterEmail: recruiterUser?.email ?? '',
      recruiterCompanyId: recruiterCompanyId ?? null,
      recruiterCompanyName,
      talentId,
      talentDisplayName: talent.displayName ?? '',
      candidatePhone: normalizedCandidatePhone,
      createdAt: now,
      lastMessageAt: now,
      lastMessageText: message,
      lastMessageFrom: 'recruiter',
      unreadByRecruiter: 0,
      messageCount: 1,
    });
  } else {
    await convRef.update({
      lastMessageAt: now,
      lastMessageText: message,
      lastMessageFrom: 'recruiter',
      messageCount: (convSnap.data()?.['messageCount'] ?? 0) + 1,
    });
  }

  // Append the message to the thread (subcollection).
  const messageDocId = generateId();
  await convRef.collection('messages').doc(messageDocId).set({
    id: messageDocId,
    from: 'recruiter',
    text: message,
    whatsappMessageId: messageId,
    sentAt: now,
  });

  // 6b. Legacy audit log — still kept for compliance / 1-row-per-send analytics.
  const contactId = generateId();
  await db.collection('talent_contacts').doc(contactId).set({
    id: contactId,
    conversationId,
    talentId,
    talentDisplayName: talent.displayName ?? '',
    recruiterUid,
    recruiterName: recruiterUser?.displayName ?? '',
    recruiterEmail: recruiterUser?.email ?? '',
    recruiterCompanyId: recruiterCompanyId ?? null,
    recruiterCompanyName,
    message,
    whatsappMessageId: messageId,
    sentAt: now,
    status: 'sent',
  });

  // 7. Public counter on the talent doc — non-blocking, ok if it lags
  try {
    const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
    await talentRef.update({ contactsCount: FieldValue.increment(1) });
  } catch (err) {
    logger.warn('[TalentsContact] Failed to increment contactsCount', { error: err instanceof Error ? err.message : err });
  }

  logger.info('[TalentsContact] Recruiter → Talent message sent', {
    talentId, recruiterUid, contactId, messageId,
  });

  res.json({
    success: true,
    contactId,
    whatsappMessageId: messageId,
    message: 'Message envoyé sur WhatsApp. Le candidat te répondra directement.',
  });
}));

// ── GET /api/talents/conversations ────────────────────────────────────────
// Auth: recruiter. Lists their own conversations, newest activity first.
router.get('/conversations', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const recruiterUid = req.user?.uid;
  if (!recruiterUid) throw new AppError('Auth required', 401);
  const db = getFirestore();
  const snap = await db.collection('talent_conversations')
    .where('recruiterUid', '==', recruiterUid)
    .orderBy('lastMessageAt', 'desc')
    .limit(100)
    .get();
  const conversations = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      talentId: data['talentId'],
      talentDisplayName: data['talentDisplayName'] ?? '',
      lastMessageText: data['lastMessageText'] ?? '',
      lastMessageFrom: data['lastMessageFrom'] ?? 'recruiter',
      lastMessageAt: data['lastMessageAt']?.toDate?.()?.toISOString?.() ?? null,
      unreadByRecruiter: data['unreadByRecruiter'] ?? 0,
      messageCount: data['messageCount'] ?? 0,
    };
  });
  res.json({ success: true, data: conversations });
}));

// ── GET /api/talents/conversations/:id/messages ───────────────────────────
router.get('/conversations/:id/messages', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const recruiterUid = req.user?.uid;
  if (!recruiterUid) throw new AppError('Auth required', 401);
  const convId = req.params['id']!;
  const db = getFirestore();
  const convSnap = await db.collection('talent_conversations').doc(convId).get();
  if (!convSnap.exists) throw new AppError('Conversation not found', 404);
  if (convSnap.data()?.['recruiterUid'] !== recruiterUid) throw new AppError('Access denied', 403);
  const msgSnap = await db.collection('talent_conversations').doc(convId)
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
    data: {
      conversation: { id: convId, ...convSnap.data() },
      messages,
    },
  });
}));

// ── POST /api/talents/conversations/:id/reply ─────────────────────────────
// Recruiter sends a follow-up message in an existing conversation.
// Re-uses the same platform WhatsApp number as the original /contact.
const REPLY_INPUT = z.object({ message: z.string().min(1).max(1000) });
router.post('/conversations/:id/reply', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const recruiterUid = req.user?.uid;
  if (!recruiterUid) throw new AppError('Auth required', 401);
  const parsed = REPLY_INPUT.safeParse(req.body);
  if (!parsed.success) throw new AppError(`Invalid input: ${parsed.error.message}`, 400);
  const { message } = parsed.data;
  const convId = req.params['id']!;
  const db = getFirestore();
  const convRef = db.collection('talent_conversations').doc(convId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) throw new AppError('Conversation not found', 404);
  const conv = convSnap.data() as { recruiterUid?: string; candidatePhone?: string; recruiterName?: string; recruiterCompanyName?: string };
  if (conv.recruiterUid !== recruiterUid) throw new AppError('Access denied', 403);
  if (!conv.candidatePhone) throw new AppError('Conversation has no candidate phone', 422);

  const config = await whatsappService.getConfig(PLATFORM_COMPANY_ID).catch(() => null);
  if (!config) throw new AppError('Service WhatsApp Talents indisponible', 503);

  // Lightweight signature so the candidate keeps the context across replies.
  const sig = conv.recruiterCompanyName
    ? `\n— ${conv.recruiterName ?? 'Recruteur'} · ${conv.recruiterCompanyName}`
    : `\n— ${conv.recruiterName ?? 'Recruteur'} · via Orlode`;
  const messageId = await whatsappService.sendMessage(
    config, conv.candidatePhone, message + sig, PLATFORM_COMPANY_ID, 'talents-recruiter-reply',
  );
  if (!messageId) throw new AppError('Message non envoyé. Réessaie.', 502);

  const now = new Date();
  await convRef.update({
    lastMessageAt: now,
    lastMessageText: message,
    lastMessageFrom: 'recruiter',
    messageCount: (convSnap.data()?.['messageCount'] ?? 0) + 1,
  });
  const messageDocId = generateId();
  await convRef.collection('messages').doc(messageDocId).set({
    id: messageDocId,
    from: 'recruiter',
    text: message,
    whatsappMessageId: messageId,
    sentAt: now,
  });

  res.json({ success: true, whatsappMessageId: messageId });
}));

// ── POST /api/talents/conversations/:id/mark-read ─────────────────────────
router.post('/conversations/:id/mark-read', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const recruiterUid = req.user?.uid;
  if (!recruiterUid) throw new AppError('Auth required', 401);
  const convId = req.params['id']!;
  const db = getFirestore();
  const convRef = db.collection('talent_conversations').doc(convId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) throw new AppError('Not found', 404);
  if (convSnap.data()?.['recruiterUid'] !== recruiterUid) throw new AppError('Access denied', 403);
  await convRef.update({ unreadByRecruiter: 0 });
  res.json({ success: true });
}));

// ── GET /api/talents/:id/public ───────────────────────────────────────────
// Public read — no auth required. Returns only safe fields (no whatsappNumber).
// Used by orlode.com /talents/feed and talents.orlode.com profile page.
router.get('/:id/public', asyncHandler(async (req: Request, res: Response) => {
  const db = getFirestore();
  const snap = await db.collection('talents_profiles').doc(req.params['id']!).get();
  if (!snap.exists) throw new AppError('Talent not found', 404);
  const data = snap.data() as Record<string, unknown>;
  if (data['status'] !== 'active') throw new AppError('Talent not available', 403);
  // Strip private fields — never return whatsappNumber via this endpoint
  const safe: Record<string, unknown> = { ...data, id: snap.id };
  delete safe['whatsappNumber'];
  res.json({ success: true, data: safe });
}));

export default router;
