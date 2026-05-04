/**
 * Public Routes — sans authentification
 * Widget chat landing page → Agent Commercial Orlode
 * Protection : rate limit 20 req/min par IP + max 10 messages/session
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';
import { commercialAgentFlow } from '../agents/commercial/commercialAgent';
import { synthesizeSpeech } from '../services/tts/ttsService';
import { logger } from '../utils/logger';
import type { Request, Response } from 'express';

const router = Router();

// ── State ─────────────────────────────────────────────────────────────────────

interface SessionEntry { messageCount: number; lastAt: number }

const sessions   = new Map<string, SessionEntry>();
const ipCounters = new Map<string, { count: number; resetAt: number }>();

const MAX_MESSAGES = 10;
const MAX_CHARS    = 500;
const RATE_LIMIT   = 20;           // req/min par IP
const SESSION_TTL  = 60 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;
  for (const [id, s] of sessions) if (s.lastAt < cutoff) sessions.delete(id);
  for (const [ip, c] of ipCounters) if (c.resetAt < Date.now()) ipCounters.delete(ip);
}, 10 * 60 * 1000);

// ── GET /api/public/unsubscribe — anti-spam compliance ───────────────────────
// Records the opt-out and returns a friendly HTML confirmation page.
router.get('/unsubscribe', asyncHandler(async (req: Request, res: Response) => {
  const cid = (req.query['cid'] as string ?? '').trim();
  const email = (req.query['e'] as string ?? '').trim().toLowerCase();

  if (cid && email) {
    try {
      const { getFirestore } = await import('../config/firebase.config');
      const db = getFirestore();
      // Idempotent — same email re-clicking just updates the timestamp
      await db.collection(`companies/${cid}/unsubscribes`).doc(Buffer.from(email).toString('base64url')).set({
        email,
        unsubscribedAt: new Date(),
        ip: req.ip ?? 'unknown',
        userAgent: req.header('user-agent')?.slice(0, 200) ?? '',
      }, { merge: true });
      logger.info('[Public] Unsubscribed', { cid, email });
    } catch (err) {
      logger.warn('[Public] Failed to record unsubscribe', { err: String(err), cid, email });
    }
  }

  // Friendly confirmation page (no SPA involvement)
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Désabonné</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6fb;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#fff;border-radius:16px;padding:40px;max-width:480px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="font-size:48px;margin-bottom:12px;">✓</div>
    <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Désabonnement confirmé</h1>
    <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
      ${email ? `<strong>${email}</strong> ne recevra plus d'emails de cette entreprise.` : 'Tu ne recevras plus d\'emails de cette entreprise.'}<br><br>
      Tu peux fermer cette fenêtre.
    </p>
  </div>
</body></html>`);
}));

// ── POST /api/public/chat ─────────────────────────────────────────────────────

router.post('/chat', asyncHandler(async (req: Request, res: Response) => {
  const ip  = req.ip ?? 'unknown';
  const now = Date.now();

  // Rate limit par IP
  const counter = ipCounters.get(ip);
  if (!counter || counter.resetAt < now) {
    ipCounters.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    counter.count++;
    if (counter.count > RATE_LIMIT) {
      throw new AppError('Trop de requêtes. Réessayez dans 1 minute.', 429);
    }
  }

  const { message, language = 'fr', sessionId } = req.body as {
    message: string; language?: string; sessionId?: string;
  };

  if (!message?.trim()) throw new AppError('message requis', 400);
  if (message.length > MAX_CHARS) throw new AppError(`Max ${MAX_CHARS} caractères`, 400);

  // Session
  let sid = sessionId?.trim() || '';
  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomUUID();
    sessions.set(sid, { messageCount: 0, lastAt: now });
  }
  const session = sessions.get(sid)!;

  if (session.messageCount >= MAX_MESSAGES) {
    throw new AppError('Limite de conversation atteinte. Contactez-nous directement.', 429);
  }

  session.messageCount++;
  session.lastAt = now;

  logger.info('[Public/Chat] Agent invoked', { sid, messageCount: session.messageCount });

  const result = await commercialAgentFlow({
    prompt:       message,
    companyId:    'corpmind-public',
    language,
    sessionId:    sid,
    messageCount: session.messageCount,
  });

  res.json({
    success: true,
    data: {
      response:     result.response,
      sessionId:    sid,
      remaining:    MAX_MESSAGES - session.messageCount,
      leadCaptured: result.leadCaptured ?? false,
    },
  });
}));

// ── POST /api/public/tts ──────────────────────────────────────────────────────

router.post('/tts', asyncHandler(async (req: Request, res: Response) => {
  const ip  = req.ip ?? 'unknown';
  const now = Date.now();

  // Rate limit par IP (même compteur)
  const counter = ipCounters.get(ip);
  if (!counter || counter.resetAt < now) {
    ipCounters.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    counter.count++;
    if (counter.count > RATE_LIMIT) {
      throw new AppError('Trop de requêtes. Réessayez dans 1 minute.', 429);
    }
  }

  const { text, language = 'fr-FR', provider = 'google' } = req.body as {
    text: string; language?: string; provider?: 'google' | 'elevenlabs';
  };

  if (!text?.trim()) throw new AppError('text requis', 400);
  if (text.length > 1000) throw new AppError('Max 1000 caractères pour le TTS', 400);

  logger.info('[Public/TTS] Synthesizing', { textLength: text.length, language, provider });

  const result = await synthesizeSpeech({ text, language, provider });

  res.set({
    'Content-Type': result.contentType,
    'Content-Length': result.audioBuffer.length.toString(),
    'Cache-Control': 'public, max-age=3600',
  });
  res.send(result.audioBuffer);
}));

// POST /api/public/cron/reminders — appointment reminders (called by Cloud Scheduler)
router.post('/cron/reminders', asyncHandler(async (req: Request, res: Response) => {
  const { checkAppointmentReminders } = await import('../services/notificationService');
  await checkAppointmentReminders();
  res.json({ success: true });
}));

// GET /api/public/landing — public landing content (cached)
router.get('/landing', asyncHandler(async (req: Request, res: Response) => {
  const { getFirestore } = await import('../config/firebase.config');
  const doc = await getFirestore().doc('platform/landingPage').get();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ success: true, data: doc.exists ? doc.data() : null });
}));

// POST /api/public/lead — capture lead from website form (no auth)
// Rate limit: simple in-memory tracker (1 req / IP / 5 sec)
const leadRateLimit = new Map<string, number>();
router.post('/lead', asyncHandler(async (req: Request, res: Response) => {
  const { companyId, name, email, phone, message, source, website } = req.body as {
    companyId: string; name: string; email?: string; phone?: string; message?: string; source?: string; website?: string;
  };

  // Honeypot: if 'website' field is filled, it's a bot (hidden field)
  if (website) { res.json({ success: true, data: { leadId: 'ok' } }); return; }

  // Rate limit: 1 req per IP per 5 seconds
  const ip = req.ip ?? 'unknown';
  const lastReq = leadRateLimit.get(ip) ?? 0;
  if (Date.now() - lastReq < 5000) { res.status(429).json({ success: false, message: 'Too many requests' }); return; }
  leadRateLimit.set(ip, Date.now());
  // Cleanup old entries every 100 requests
  if (leadRateLimit.size > 1000) { const cutoff = Date.now() - 60000; for (const [k, v] of leadRateLimit) { if (v < cutoff) leadRateLimit.delete(k); } }

  if (!companyId || !name) { res.status(400).json({ success: false, message: 'companyId and name required' }); return; }

  const { getFirestore } = await import('../config/firebase.config');
  const { FieldValue } = await import('firebase-admin/firestore');
  const db = getFirestore();

  const leadRef = db.collection(`companies/${companyId}/website/config/leads`).doc();
  await leadRef.set({
    name, email: email ?? '', phone: phone ?? '', message: message ?? '',
    source: source ?? 'website_form',
    status: 'new',
    createdAt: FieldValue.serverTimestamp(),
  });

  // Also add to main CRM leads if exists
  try {
    await db.collection(`companies/${companyId}/leads`).add({
      name, email: email ?? '', phone: phone ?? '', notes: message ?? '',
      source: 'website', stage: 'nouveau', score: 40,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {}

  // Send email notification to company
  try {
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const ownerEmail = companyDoc.data()?.['ownerEmail'] as string | undefined;
    if (ownerEmail) {
      const { sendEmail } = await import('../services/email/emailService');
      await sendEmail({
        to: ownerEmail,
        subject: `Nouveau lead depuis votre site — ${name}`,
        html: `<div style="font-family:sans-serif;padding:20px"><h2>Nouveau prospect !</h2><p><strong>${name}</strong> a envoye un message depuis votre site web.</p>${email ? `<p>Email: ${email}</p>` : ''}${phone ? `<p>Tel: ${phone}</p>` : ''}${message ? `<p>Message: ${message}</p>` : ''}<a href="https://orlode.com/sales" style="display:inline-block;padding:10px 20px;background:#6c3ce0;color:#fff;border-radius:8px;text-decoration:none;margin-top:10px">Voir dans Orlode</a></div>`,
      });
    }
  } catch {}

  res.json({ success: true, data: { leadId: leadRef.id } });
}));

// GET /api/public/site/:companyId — public website data (no auth)
router.get('/site/:companyId', asyncHandler(async (req: Request, res: Response) => {
  const { companyId } = req.params;
  const { getFirestore } = await import('../config/firebase.config');
  const db = getFirestore();

  const configDoc = await db.collection(`companies/${companyId}/website`).doc('config').get();
  if (!configDoc.exists) {
    res.status(404).json({ success: false, message: 'Site not found' });
    return;
  }

  const data = configDoc.data()!;
  // Also get company basic info
  const companyDoc = await db.collection('companies').doc(companyId).get();
  const company = companyDoc.data() ?? {};

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    success: true,
    data: {
      ...data,
      companyName: data['companyName'] ?? company['name'] ?? '',
      companyLogo: company['logo'] ?? null,
      companyId,
    },
  });
}));

export default router;
