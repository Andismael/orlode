/**
 * Appointments routes — central + personal views, action-based updates.
 *
 * GET /api/appointments
 *   ?mine=true      → only appointments where assignedTo === current user
 *   ?status=pending → filter by status (pending|confirmed|rejected|cancelled|rescheduled)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD → date range
 *
 * PATCH /api/appointments/:id
 *   { action: 'confirm' | 'reject' | 'assign' | 'reschedule', ...payload }
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

const router = Router();

// ── Cron endpoint (PUBLIC but requires secret header) ─────────────────────────
// POST /api/appointments/cron/reminders-24h
// Triggered by Cloud Scheduler every 15 minutes.
// Sends reminder on booking channel (WhatsApp/Telegram) + email backup, dedup via reminder24h field.
router.post('/cron/reminders-24h', asyncHandler(async (req: Request, res: Response) => {
  const expected = process.env['CRON_SECRET'] ?? '';
  const got = (req.headers['x-cron-secret'] as string | undefined) ?? (req.query['secret'] as string | undefined) ?? '';
  if (!expected || got !== expected) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const { sendAppointmentReminders24h } = await import('../services/notificationService');
  const result = await sendAppointmentReminders24h();
  logger.info('[Cron] reminders-24h completed', result);
  res.json({ success: true, ...result });
}));

router.use(authMiddleware);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

async function audit(companyId: string, action: string, actorId: string, details: Record<string, unknown>): Promise<void> {
  try {
    await getFirestore().collection(`companies/${companyId}/appointmentAuditLog`).add({
      action, actorId, details, createdAt: new Date(),
    });
  } catch { /* non-critical */ }
}

// GET /api/appointments
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  if (!companyId || !userId) throw new AppError('Unauthorized', 401);

  const { mine, status, from, to } = req.query as Record<string, string | undefined>;
  const db = getFirestore();
  let q: FirebaseFirestore.Query = db.collection(`companies/${companyId}/appointments`);

  if (mine === 'true') q = q.where('assignedTo', '==', userId);
  if (status) q = q.where('status', '==', status);
  if (from && DATE_REGEX.test(from)) q = q.where('date', '>=', from);
  if (to && DATE_REGEX.test(to)) q = q.where('date', '<=', to);

  const snap = await q.limit(500).get().catch(async (err) => {
    logger.warn('[Appointments] query needs index, falling back', { err: String(err) });
    return await db.collection(`companies/${companyId}/appointments`).limit(500).get();
  });
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Sort client-side to avoid composite index requirements
  items.sort((a: any, b: any) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || String(b.time ?? '').localeCompare(String(a.time ?? '')));
  res.json({ success: true, data: items });
}));

// PATCH /api/appointments/:id — action-based
router.patch('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.user?.companyId;
  const userId = req.user?.uid;
  const userName = req.user?.email ?? 'Admin';
  if (!companyId || !userId) throw new AppError('Unauthorized', 401);

  const { id } = req.params;
  const { action } = req.body as { action?: string };
  if (!action || !['confirm', 'reject', 'assign', 'reschedule'].includes(action)) {
    throw new AppError('Invalid action (must be confirm | reject | assign | reschedule)', 400);
  }

  const db = getFirestore();
  const ref = db.collection(`companies/${companyId}/appointments`).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new AppError('Appointment not found', 404);
  const data = doc.data() ?? {};

  const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy: userId };

  if (action === 'confirm') {
    if (data['status'] === 'confirmed') {
      res.json({ success: true, data: { ...data, status: 'confirmed' }, message: 'Already confirmed' });
      return;
    }
    updates['status'] = 'confirmed';
    updates['confirmedAt'] = new Date();
    updates['confirmedBy'] = userId;
  } else if (action === 'reject') {
    const { reason } = req.body as { reason?: string };
    updates['status'] = 'rejected';
    updates['rejectedAt'] = new Date();
    updates['rejectedBy'] = userId;
    if (reason) updates['rejectReason'] = reason;
  } else if (action === 'assign') {
    const { assignedTo, assignedToName } = req.body as { assignedTo?: string; assignedToName?: string };
    if (!assignedTo) throw new AppError('assignedTo required', 400);
    updates['assignedTo'] = assignedTo;
    updates['assignedToName'] = assignedToName ?? '';
    updates['assignedAt'] = new Date();
    updates['assignedBy'] = userId;
    // if previously unassigned + pending → keep pending; admin confirms separately
  } else if (action === 'reschedule') {
    const { date, time } = req.body as { date?: string; time?: string };
    if (!date || !DATE_REGEX.test(date)) throw new AppError('Invalid date (YYYY-MM-DD)', 400);
    if (!time || !TIME_REGEX.test(time)) throw new AppError('Invalid time (HH:MM)', 400);
    updates['previousDate'] = data['date'];
    updates['previousTime'] = data['time'];
    updates['date'] = date;
    updates['time'] = time;
    updates['status'] = 'rescheduled';
    updates['rescheduledAt'] = new Date();
    updates['rescheduledBy'] = userId;
  }

  await ref.update(updates);
  await audit(companyId, `appointment.${action}`, userId, { appointmentId: id, by: userName, ...req.body });

  // Fire notifications — best-effort, non-blocking
  if (action === 'confirm' || action === 'reschedule') {
    notifyClient(companyId, id, action).catch(err => logger.warn('[Appointments] notify client failed', { err: String(err) }));
  }
  if (action === 'assign') {
    const assignedTo = (updates['assignedTo'] as string) ?? '';
    if (assignedTo) {
      notifyAssignedEmployee(companyId, id, assignedTo, data).catch(err => logger.warn('[Appointments] notify employee failed', { err: String(err) }));
    }
  }

  const updated = (await ref.get()).data();
  res.json({ success: true, data: { id, ...updated } });
}));

async function notifyClient(companyId: string, appointmentId: string, action: 'confirm' | 'reschedule'): Promise<void> {
  const db = getFirestore();
  const doc = await db.collection(`companies/${companyId}/appointments`).doc(appointmentId).get();
  const d = doc.data();
  if (!d) return;

  const clientName = (d['clientName'] as string) ?? 'Client';
  const date = d['date'] as string;
  const time = d['time'] as string;
  const channel = (d['sourceChannel'] as string) ?? '';
  const phone = (d['clientPhone'] as string) ?? '';
  const email = (d['clientEmail'] as string) ?? '';

  const actionLabel = action === 'confirm' ? 'confirmé' : 'reprogrammé';
  const msg = `Bonjour ${clientName}, votre rendez-vous a été ${actionLabel} pour le ${date} à ${time}. Merci !`;

  // Email
  if (email) {
    try {
      const { sendEmail } = await import('../services/email/emailService');
      await sendEmail({
        to: email,
        subject: `Rendez-vous ${actionLabel} — ${date} ${time}`,
        html: `<p>${msg}</p>`,
        companyId,
        tags: [{ name: 'type', value: 'appointment-confirmation' }],
      });
    } catch (err) { logger.warn('[Appointments] email notify failed', { err: String(err) }); }
  }

  // Telegram / WhatsApp — reply on same channel if we can resolve a destination
  try {
    if (channel === 'whatsapp' && phone) {
      const { whatsappService } = await import('../services/whatsapp/whatsappService');
      const config = await whatsappService.getConfig(companyId).catch(() => null);
      if (config) await whatsappService.sendMessage(config, phone, msg).catch(() => null);
    }
    if (channel === 'telegram') {
      // Lookup the chatId from the most recent inbound message for this client
      const lookup = await db
        .collection(`companies/${companyId}/telegramMessages`)
        .where('direction', '==', 'inbound')
        .where('fromName', '==', clientName)
        .orderBy('createdAt', 'desc').limit(1).get().catch(() => null);
      const chatId = lookup && !lookup.empty ? (lookup.docs[0].data()['chatId'] as string) : null;
      if (chatId) {
        const { sendTelegramMessage } = await import('../services/telegram/telegramService');
        await sendTelegramMessage(companyId, chatId, msg).catch(() => {});
      }
    }
  } catch { /* non-critical */ }
}

async function notifyAssignedEmployee(companyId: string, appointmentId: string, employeeId: string, apptData: FirebaseFirestore.DocumentData): Promise<void> {
  try {
    const { createNotification } = await import('../services/notificationService');
    const clientName = (apptData['clientName'] as string) ?? 'Client';
    const date = apptData['date'] as string;
    const time = apptData['time'] as string;
    await createNotification({
      companyId,
      userId: employeeId,
      type: 'appointment_created',
      title: 'Nouveau rendez-vous attribué',
      message: `${clientName} — ${date} à ${time}`,
      actionUrl: '/calendar',
      icon: 'Calendar',
      severity: 'info',
      metadata: { appointmentId },
    });
  } catch { /* non-critical */ }
}

export default router;
