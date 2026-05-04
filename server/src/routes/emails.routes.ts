import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { generateId } from '../utils/helpers';
import { sendReplyEmail } from '../services/email/emailService';

const router = Router();
router.use(authMiddleware);

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

// ─── FOLDERS ─────────────────────────────────────────────────────────────────

// GET /api/emails/inbox
router.get('/inbox', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const snap = await getFirestore().collection('emails')
      .where('companyId', '==', companyId).where('folder', '==', 'inbox')
      .limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch { res.json({ success: true, data: [] }); }
}));

// GET /api/emails/sent
router.get('/sent', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const snap = await getFirestore().collection('emails')
      .where('companyId', '==', companyId).where('folder', '==', 'sent')
      .limit(50).get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // eslint-disable-next-line no-console
    console.log('[emails/sent]', { companyId, count: data.length });
    res.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[emails/sent] ERROR', { companyId, err: String(err) });
    res.json({ success: true, data: [] });
  }
}));

// GET /api/emails/drafts
router.get('/drafts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const snap = await getFirestore().collection('emails')
      .where('companyId', '==', companyId).where('folder', '==', 'draft')
      .limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch { res.json({ success: true, data: [] }); }
}));

// GET /api/emails/archived
router.get('/archived', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  try {
    const snap = await getFirestore().collection('emails')
      .where('companyId', '==', companyId).where('folder', '==', 'archive')
      .limit(50).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch { res.json({ success: true, data: [] }); }
}));

// ─── CRUD ────────────────────────────────────────────────────────────────────

// GET /api/emails/:id
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const doc = await getFirestore().collection('emails').doc(req.params.id).get();
  if (!doc.exists) throw new AppError('Email not found', 404);
  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
}));

// PATCH /api/emails/:id/read
router.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await getFirestore().collection('emails').doc(req.params.id).update({ read: true });
  res.json({ success: true });
}));

// PATCH /api/emails/:id/archive
router.patch('/:id/archive', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await getFirestore().collection('emails').doc(req.params.id).update({ folder: 'archive' });
  res.json({ success: true });
}));

// PATCH /api/emails/:id/star
router.patch('/:id/star', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const doc = await getFirestore().collection('emails').doc(req.params.id).get();
  const starred = doc.data()?.['starred'] ?? false;
  await getFirestore().collection('emails').doc(req.params.id).update({ starred: !starred });
  res.json({ success: true, data: { starred: !starred } });
}));

// DELETE /api/emails/:id
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await getFirestore().collection('emails').doc(req.params.id).delete();
  res.json({ success: true });
}));

// ─── COMPOSE & SEND ──────────────────────────────────────────────────────────

// POST /api/emails/compose — compose new email (send or save as draft)
router.post('/compose', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const body = req.body as Record<string, unknown>;
  const to = body['to'] as string;
  const subject = body['subject'] as string;
  const content = body['body'] as string;
  const cc = body['cc'] as string | undefined;
  const isDraft = body['draft'] === true;

  if (!isDraft && (!to || !subject || !content)) {
    throw new AppError('to, subject, and body required', 400);
  }

  const id = generateId();

  if (isDraft) {
    // Save as draft
    await getFirestore().collection('emails').doc(id).set({
      companyId, folder: 'draft', to: to ?? '', cc: cc ?? '',
      subject: subject ?? '', body: content ?? '',
      createdAt: new Date(), updatedAt: new Date(),
      createdBy: req.user?.uid,
    });
    return res.status(201).json({ success: true, data: { id, folder: 'draft' } });
  }

  // Send via Resend
  const result = await sendReplyEmail({
    to, subject, bodyHtml: (content ?? '').replace(/\n/g, '<br>'), replyTo: cc,
  });

  // Archive in sent folder
  await getFirestore().collection('emails').doc(id).set({
    companyId, folder: 'sent', to, cc: cc ?? '', subject, body: content,
    sentAt: new Date().toISOString(), resendId: result.id,
    createdBy: req.user?.uid, aiGenerated: false,
  });

  res.status(201).json({ success: true, data: { id, resendId: result.id, folder: 'sent' } });
}));

// POST /api/emails/:id/reply — reply to existing email
router.post('/:id/reply', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { draft, to, subject, replyTo } = req.body as {
    draft: string; to: string; subject?: string; replyTo?: string;
  };
  if (!draft || !to) throw new AppError('draft and to required', 400);

  const db = getFirestore();
  const doc = await db.collection('emails').doc(req.params.id).get();
  const emailData = doc.exists ? doc.data() : null;

  const result = await sendReplyEmail({
    to, subject: subject ?? `Re: ${emailData?.['subject'] ?? ''}`,
    bodyHtml: draft.replace(/\n/g, '<br>'), replyTo,
  });

  await db.collection('emails').add({
    companyId: req.user?.companyId, folder: 'sent', to,
    subject: subject ?? `Re: ${emailData?.['subject'] ?? ''}`,
    body: draft, sentAt: new Date().toISOString(),
    resendId: result.id, aiGenerated: true, replyToId: req.params.id,
  });

  res.json({ success: true, resendId: result.id });
}));

// ─── AI GENERATE ─────────────────────────────────────────────────────────────

// POST /api/emails/generate — AI drafts an email
router.post('/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const { prompt, to, tone } = req.body as { prompt: string; to?: string; tone?: string };
  if (!prompt) throw new AppError('Prompt required', 400);

  let generated = '';
  let generatedSubject = '';
  try {
    const { commsAgentFlow } = await import('../agents/comms.agent');
    const result = await commsAgentFlow({
      companyId, type: 'email', language: 'fr',
      context: `Redige un email ${tone ?? 'professionnel'} pour: ${prompt}. Retourne le sujet et le corps de l'email.`,
      tone: (tone as 'professional' | 'formal' | 'friendly' | 'urgent') ?? 'professional',
      sendVia: 'none',
    });
    const text = result.body ?? '';
    generatedSubject = result.subject ?? prompt.slice(0, 60);
    generated = text;
  } catch {
    generated = `[Email sur: ${prompt}]\n\nBonjour,\n\n[Contenu a rediger]\n\nCordialement`;
    generatedSubject = prompt.slice(0, 60);
  }

  res.json({ success: true, data: { subject: generatedSubject, body: generated, to: to ?? '' } });
}));

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

// GET /api/emails/templates
router.get('/templates/list', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const snap = await getFirestore().collection('emailTemplates')
      .where('companyId', '==', companyId).limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, []);
  res.json({ success: true, data });
}));

// POST /api/emails/templates
router.post('/templates', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const body = req.body as Record<string, unknown>;
  const id = generateId();
  const template = {
    companyId, name: body['name'] ?? '', subject: body['subject'] ?? '',
    body: body['body'] ?? '', category: body['category'] ?? 'general',
    createdBy: req.user?.uid, createdAt: new Date(),
  };
  await getFirestore().collection('emailTemplates').doc(id).set(template);
  res.status(201).json({ success: true, data: { id, ...template } });
}));

// DELETE /api/emails/templates/:id
router.delete('/templates/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await getFirestore().collection('emailTemplates').doc(req.params.id).delete();
  res.json({ success: true });
}));

// ─── STATS ───────────────────────────────────────────────────────────────────

// GET /api/emails/stats
router.get('/stats/overview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const data = await safe(async () => {
    const db = getFirestore();
    const snap = await db.collection('emails').where('companyId', '==', companyId).limit(500).get();
    const emails = snap.docs.map(d => d.data());
    return {
      inbox: emails.filter(e => e['folder'] === 'inbox').length,
      unread: emails.filter(e => e['folder'] === 'inbox' && !e['read']).length,
      sent: emails.filter(e => e['folder'] === 'sent').length,
      drafts: emails.filter(e => e['folder'] === 'draft').length,
      archived: emails.filter(e => e['folder'] === 'archive').length,
      aiGenerated: emails.filter(e => e['aiGenerated'] === true).length,
    };
  }, { inbox: 0, unread: 0, sent: 0, drafts: 0, archived: 0, aiGenerated: 0 });
  res.json({ success: true, data });
}));

export default router;
