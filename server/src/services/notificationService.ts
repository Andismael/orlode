/**
 * NotificationService — Unified notification system
 * Persists to Firestore, emits via Socket.io, optionally sends email
 */
import { getFirestore } from '../config/firebase.config';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

// io is lazily imported to avoid circular dependency
let _io: import('socket.io').Server | null = null;
function getIO(): import('socket.io').Server | null {
  if (!_io) {
    try { _io = require('../app').io; } catch { /* not yet initialized */ }
  }
  return _io;
}

export type NotificationType =
  | 'visitor_arrived'
  | 'visitor_checkout'
  | 'leave_requested'
  | 'leave_approved'
  | 'leave_rejected'
  | 'presence_checkin'
  | 'presence_checkout'
  | 'contract_signed'
  | 'contract_reminder'
  | 'onboarding_complete'
  | 'appointment_reminder'
  | 'appointment_created'
  | 'quote_created'
  | 'quote_sent'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'lead_created'
  | 'deal_won'
  | 'invoice_from_quote'
  | 'followup_overdue'
  | 'agent_alert'
  | 'agent_installed'
  | 'payment_received'
  | 'security_alert'
  | 'system'
  | 'info';

export interface CreateNotificationInput {
  companyId: string;
  userId?: string;         // specific user, or null for company-wide
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;      // link to navigate to
  icon?: string;           // lucide icon name
  severity?: 'info' | 'success' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}

export interface Notification extends CreateNotificationInput {
  id: string;
  read: boolean;
  createdAt: Date;
}

/**
 * Create and dispatch a notification
 * 1. Save to Firestore
 * 2. Emit via Socket.io to the company room (or specific user)
 * 3. Optionally send email (if sendEmail=true)
 */
export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const db = getFirestore();
  const id = generateId();

  const notification: Record<string, unknown> = {
    id,
    companyId: input.companyId,
    userId: input.userId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl ?? null,
    icon: input.icon ?? null,
    severity: input.severity ?? 'info',
    metadata: input.metadata ?? {},
    read: false,
    createdAt: new Date(),
  };

  // 1. Persist to Firestore
  try {
    await db.collection('notifications').doc(id).set(notification);
  } catch (err) {
    logger.error('[NotificationService] Failed to persist:', err);
  }

  // 2. Emit via Socket.io
  try {
    const io = getIO();
    if (io) {
      const room = input.userId
        ? `user:${input.userId}`
        : `company:${input.companyId}`;
      io.to(room).emit('notification', notification);
      // Also emit to company room for the bell
      if (input.userId) {
        io.to(`company:${input.companyId}`).emit('notification', notification);
      }
    }
  } catch (err) {
    logger.error('[NotificationService] Socket emit failed:', err);
  }

  logger.info(`[NotificationService] Created: ${input.type} for ${input.userId ?? 'company'}`);
  return id;
}

/**
 * Notify host that a visitor has arrived — multi-channel push.
 * Fires (in parallel, best-effort):
 *   1. In-app notification (Firestore + socket.io)
 *   2. WhatsApp message (if host has phone + company WhatsApp configured)
 *   3. Email (Gmail-first, Resend fallback) with accept/wait/decline magic links
 *
 * Resolves host user from companies/{cid}/users by displayName/email match.
 * All channel failures are logged but do not throw.
 */
export async function notifyVisitorArrived(
  companyId: string,
  visitorName: string,
  hostName: string,
  hostUserId?: string,
  visitorId?: string,
  visitorCompany?: string,
) {
  const db = getFirestore();

  // ── 1. Resolve host user (if userId not provided) ────────────────────────
  let resolvedUserId = hostUserId;
  let hostEmail: string | undefined;
  let hostPhone: string | undefined;

  try {
    if (resolvedUserId) {
      const userDoc = await db.collection('users').doc(resolvedUserId).get();
      const ud = userDoc.data() ?? {};
      hostEmail = ud['email'] as string | undefined;
      hostPhone = (ud['phoneNumber'] ?? ud['phone'] ?? ud['whatsappNumber']) as string | undefined;
    } else if (hostName) {
      // Fuzzy lookup by name
      const snap = await db.collection('users')
        .where('companyId', '==', companyId)
        .limit(50).get();
      const needle = hostName.toLowerCase().trim();
      const match = snap.docs.find(d => {
        const dn = ((d.data()['displayName'] as string) ?? '').toLowerCase();
        const em = ((d.data()['email'] as string) ?? '').toLowerCase();
        return dn.includes(needle) || em.startsWith(needle.split(' ')[0]);
      });
      if (match) {
        resolvedUserId = match.id;
        hostEmail = match.data()['email'] as string | undefined;
        hostPhone = (match.data()['phoneNumber'] ?? match.data()['phone'] ?? match.data()['whatsappNumber']) as string | undefined;
      }
    }
  } catch (err) {
    logger.warn('[notifyVisitorArrived] host resolution failed', { hostName, error: String(err) });
  }

  // ── 2. In-app notification (always) ──────────────────────────────────────
  const notifId = await createNotification({
    companyId,
    userId: resolvedUserId,
    type: 'visitor_arrived',
    title: 'Visiteur arrive',
    message: `${visitorName}${visitorCompany ? ` (${visitorCompany})` : ''} est arrive(e) a l'accueil et demande a voir ${hostName}.`,
    actionUrl: '/reception',
    icon: 'UserCheck',
    severity: 'info',
  });

  // ── 3. WhatsApp push (best-effort) ───────────────────────────────────────
  if (hostPhone && visitorId) {
    void (async () => {
      try {
        const { whatsappService } = await import('./whatsapp/whatsappService');
        const config = await whatsappService.getConfig(companyId);
        if (!config) return;
        const text = `🔔 *Visiteur à l'accueil*\n\n${visitorName}${visitorCompany ? ` (${visitorCompany})` : ''} vous attend.\n\nRépondez :\n✅ ACCEPTER\n⏰ PATIENTER\n❌ REFUSER\n\nOu ouvrez Orlode → Réception pour répondre directement.`;
        await whatsappService.sendMessage(config, hostPhone, text);
        logger.info('[notifyVisitorArrived] WhatsApp sent', { hostPhone, visitorId });
      } catch (err) {
        logger.warn('[notifyVisitorArrived] WhatsApp failed', { error: String(err) });
      }
    })();
  }

  // ── 4. Email push (best-effort) ──────────────────────────────────────────
  if (hostEmail && visitorId) {
    void (async () => {
      try {
        const { sendEmail, getBranding } = await import('./email/emailService');
        const branding = await getBranding(companyId);
        const baseUrl = process.env['APP_BASE_URL'] ?? 'https://orlode.com';
        const acceptUrl = `${baseUrl}/reception?action=allow_entry&visitorId=${visitorId}`;
        const waitUrl   = `${baseUrl}/reception?action=wait&visitorId=${visitorId}`;
        const declineUrl= `${baseUrl}/reception?action=decline&visitorId=${visitorId}`;

        await sendEmail({
          companyId,
          to: hostEmail,
          subject: `🔔 ${visitorName} vous attend à l'accueil`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;background:#FFFAF0;padding:24px;border-radius:14px;">
<h2 style="margin:0 0 8px;color:#0A2A20;">Visiteur à l'accueil</h2>
<p style="font-size:14px;color:#5A6B62;margin:0 0 16px;">
  <strong style="color:#0A4F3C;">${visitorName}</strong>${visitorCompany ? ` (${visitorCompany})` : ''} est arrivé(e) à l'accueil et vous attend.
</p>
<div style="background:#fff;border-radius:10px;padding:14px;margin:16px 0;border:1px solid #E5E7EB;">
  <p style="margin:0;font-size:13px;color:#374151;"><strong>Que voulez-vous faire ?</strong></p>
</div>
<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;">
  <tr>
    <td style="padding:0 4px;"><a href="${acceptUrl}" style="display:block;background:#10B981;color:#fff;padding:12px;text-align:center;border-radius:10px;font-weight:700;text-decoration:none;font-size:13px;">✓ Accepter</a></td>
    <td style="padding:0 4px;"><a href="${waitUrl}"   style="display:block;background:#F59E0B;color:#fff;padding:12px;text-align:center;border-radius:10px;font-weight:700;text-decoration:none;font-size:13px;">⏰ Patienter</a></td>
    <td style="padding:0 4px;"><a href="${declineUrl}" style="display:block;background:#EF4444;color:#fff;padding:12px;text-align:center;border-radius:10px;font-weight:700;text-decoration:none;font-size:13px;">✗ Refuser</a></td>
  </tr>
</table>
<p style="font-size:11px;color:#9CA3AF;margin:16px 0 0;text-align:center;">${branding.slogan ?? 'Propulsé par Orlode AI'}</p>
</div>`,
        });
        logger.info('[notifyVisitorArrived] Email sent', { hostEmail, visitorId });
      } catch (err) {
        logger.warn('[notifyVisitorArrived] Email failed', { error: String(err) });
      }
    })();
  }

  return notifId;
}

/**
 * Notify when a leave request is submitted
 */
export async function notifyLeaveRequested(
  companyId: string,
  employeeName: string,
  type: string,
  days: number,
) {
  return createNotification({
    companyId,
    type: 'leave_requested',
    title: 'Nouvelle demande de conge',
    message: `${employeeName} demande ${days} jour(s) de ${type}.`,
    actionUrl: '/hr/leaves',
    icon: 'Calendar',
    severity: 'warning',
  });
}

/**
 * Notify employee when their leave is approved/rejected
 */
export async function notifyLeaveReviewed(
  companyId: string,
  userId: string,
  employeeName: string,
  status: 'approved' | 'rejected',
) {
  return createNotification({
    companyId,
    userId,
    type: status === 'approved' ? 'leave_approved' : 'leave_rejected',
    title: status === 'approved' ? 'Conge approuve' : 'Conge refuse',
    message: status === 'approved'
      ? `Votre demande de conge a ete approuvee.`
      : `Votre demande de conge a ete refusee.`,
    actionUrl: '/hr/leaves',
    icon: status === 'approved' ? 'CheckCircle' : 'XCircle',
    severity: status === 'approved' ? 'success' : 'error',
  });
}

/**
 * Notify when an employee checks in
 */
export async function notifyPresenceCheckin(
  companyId: string,
  employeeName: string,
) {
  return createNotification({
    companyId,
    type: 'presence_checkin',
    title: 'Pointage arrivee',
    message: `${employeeName} a pointe son arrivee.`,
    actionUrl: '/reception/presence',
    icon: 'LogIn',
    severity: 'success',
  });
}

// ── Marketplace Agent notifications ─────────────────────────────────────────

export async function notifyAppointmentReminder(
  companyId: string, clientName: string, time: string, service: string,
) {
  return createNotification({
    companyId,
    type: 'appointment_reminder',
    title: `Rappel RDV — ${clientName}`,
    message: `Rendez-vous a ${time} pour ${service}`,
    actionUrl: '/agents',
    icon: 'Calendar',
    severity: 'info',
  });
}

export async function notifyAppointmentCreated(
  companyId: string, clientName: string, date: string, time: string, service: string,
) {
  return createNotification({
    companyId,
    type: 'appointment_created',
    title: `Nouveau RDV — ${clientName}`,
    message: `${date} a ${time} — ${service}`,
    actionUrl: '/agents',
    icon: 'CalendarPlus',
    severity: 'success',
  });
}

export async function notifyQuoteCreated(
  companyId: string, clientName: string, total: number,
) {
  return createNotification({
    companyId,
    type: 'quote_created',
    title: `Nouveau devis — ${clientName}`,
    message: `Devis de $${total.toFixed(2)} cree`,
    actionUrl: '/agents',
    icon: 'FileText',
    severity: 'info',
  });
}

export async function notifyAgentAlert(
  companyId: string, agentName: string, title: string, message: string, severity: 'info' | 'warning' | 'error' = 'warning',
) {
  return createNotification({
    companyId,
    type: 'agent_alert',
    title: `${agentName} — ${title}`,
    message,
    actionUrl: '/agents',
    icon: 'AlertTriangle',
    severity,
  });
}

export async function notifySecurityAlert(
  companyId: string, title: string, message: string,
) {
  return createNotification({
    companyId,
    type: 'security_alert',
    title,
    message,
    actionUrl: '/agents',
    icon: 'Shield',
    severity: 'error',
  });
}

// ── Sales / Commercial notifications ────────────────────────────────────────

export async function notifyLeadCreated(
  companyId: string, leadName: string, source: string,
) {
  return createNotification({
    companyId,
    type: 'lead_created',
    title: `Nouveau lead — ${leadName}`,
    message: `Un prospect a ete ajoute depuis ${source}.`,
    actionUrl: '/sales/leads',
    icon: 'UserPlus',
    severity: 'info',
  });
}

export async function notifyQuoteSent(
  companyId: string, quoteNumber: string, clientName: string, recipientEmail: string,
) {
  return createNotification({
    companyId,
    type: 'quote_sent',
    title: `Devis envoye — ${quoteNumber}`,
    message: `Le devis ${quoteNumber} a ete envoye a ${clientName} (${recipientEmail}).`,
    actionUrl: '/sales/quotes',
    icon: 'Send',
    severity: 'success',
  });
}

export async function notifyQuoteAccepted(
  companyId: string, quoteNumber: string, clientName: string, total: number,
) {
  return createNotification({
    companyId,
    type: 'quote_accepted',
    title: `Devis accepte — ${quoteNumber}`,
    message: `${clientName} a accepte le devis ${quoteNumber} (${total} EUR).`,
    actionUrl: '/sales/quotes',
    icon: 'CheckCircle',
    severity: 'success',
  });
}

export async function notifyQuoteRejected(
  companyId: string, quoteNumber: string, clientName: string,
) {
  return createNotification({
    companyId,
    type: 'quote_rejected',
    title: `Devis refuse — ${quoteNumber}`,
    message: `${clientName} a refuse le devis ${quoteNumber}.`,
    actionUrl: '/sales/quotes',
    icon: 'XCircle',
    severity: 'warning',
  });
}

export async function notifyDealWon(
  companyId: string, clientName: string, invoiceNumber: string, total: number,
) {
  return createNotification({
    companyId,
    type: 'deal_won',
    title: `Vente conclue — ${clientName}`,
    message: `Facture ${invoiceNumber} creee pour ${total} EUR. Bravo !`,
    actionUrl: '/finance/invoices',
    icon: 'Trophy',
    severity: 'success',
  });
}

export async function notifyFollowupOverdue(
  companyId: string, leadName: string, daysSilent: number,
) {
  return createNotification({
    companyId,
    type: 'followup_overdue',
    title: `Relance en retard — ${leadName}`,
    message: `${daysSilent} jour(s) sans contact avec ${leadName}. Relance recommandee.`,
    actionUrl: '/sales/followups',
    icon: 'Clock',
    severity: 'warning',
  });
}

// ── Appointment reminder cron (call every 5-10 min) ─────────────────────────
// Sends reminders at 3 stages: 1h, 30min, 15min before appointment
// Via: in-app notification + WhatsApp (if connected)

const REMINDER_STAGES = [
  { key: 'reminder60', minutes: 60, label: 'dans 1 heure' },
  { key: 'reminder30', minutes: 30, label: 'dans 30 minutes' },
  { key: 'reminder15', minutes: 15, label: 'dans 15 minutes' },
];

export async function checkAppointmentReminders(): Promise<void> {
  const db = getFirestore();
  const companiesSnap = await db.collection('companies').limit(100).get();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowH = now.getHours();
  const nowM = now.getMinutes();
  const nowTotal = nowH * 60 + nowM;

  for (const companyDoc of companiesSnap.docs) {
    try {
      const companyId = companyDoc.id;
      const snap = await db.collection(`companies/${companyId}/appointments`)
        .where('date', '==', todayStr).get();

      // Load WhatsApp config for this company (if connected)
      let waConfig: Record<string, unknown> | null = null;
      try {
        const waDoc = await db.collection(`companies/${companyId}/settings`).doc('whatsapp').get();
        if (waDoc.exists && waDoc.data()?.['accessToken']) waConfig = waDoc.data() as Record<string, unknown>;
      } catch {}

      for (const apptDoc of snap.docs) {
        const appt = apptDoc.data();
        const [h, m] = (appt['time'] as string ?? '00:00').split(':').map(Number);
        const apptTotal = h * 60 + m;
        const diffMin = apptTotal - nowTotal;

        const clientName = (appt['clientName'] as string) ?? 'Client';
        const clientPhone = (appt['clientPhone'] as string) ?? '';
        const service = (appt['service'] as string) ?? 'RDV';
        const time = (appt['time'] as string) ?? '';

        for (const stage of REMINDER_STAGES) {
          // Check if this stage should fire (within 10 min window)
          if (appt[stage.key]) continue; // Already sent
          if (diffMin <= 0) continue; // Past
          if (diffMin > stage.minutes + 5) continue; // Too early
          if (diffMin < stage.minutes - 5) continue; // Too late for this stage

          // 1. In-app notification
          await notifyAppointmentReminder(companyId, clientName, time, `${service} — ${stage.label}`);

          // 2. WhatsApp notification (if connected + client has phone)
          if (waConfig && clientPhone) {
            try {
              const { whatsappService } = await import('../services/whatsapp/whatsappService');
              const config = await whatsappService.getConfig(companyId).catch(() => null);
              if (config) {
                const message = `📅 Rappel RDV — ${stage.label}\n\n` +
                  `👤 ${clientName}\n` +
                  `🕐 Aujourd'hui à ${time}\n` +
                  `📋 ${service}\n\n` +
                  `À bientôt !`;
                await whatsappService.sendMessage(config, clientPhone, message);
                logger.info(`[Reminders] WhatsApp sent to ${clientPhone} — ${stage.key}`);
              }
            } catch (err) {
              logger.warn(`[Reminders] WhatsApp failed for ${clientPhone}`, { error: (err as Error).message });
            }
          }

          // Mark this stage as sent
          await apptDoc.ref.update({ [stage.key]: true });
          logger.info(`[Reminders] ${stage.key} sent for ${clientName} at ${time}`);
        }
      }
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 24h-ahead reminder — multi-channel (WhatsApp / Telegram / Email)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Sends a "tomorrow" reminder for confirmed appointments.
 * Dedup: the `reminder24h` boolean field on the appointment.
 * Channel fallback: tries sourceChannel first, then email as backup.
 */
export async function sendAppointmentReminders24h(): Promise<{ scanned: number; sent: number }> {
  const db = getFirestore();
  const companiesSnap = await db.collection('companies').limit(200).get();

  const now = new Date();
  // Target date = tomorrow (UTC date string YYYY-MM-DD)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  let scanned = 0;
  let sent = 0;

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    try {
      const snap = await db.collection(`companies/${companyId}/appointments`)
        .where('date', '==', tomorrowStr).get();

      for (const apptDoc of snap.docs) {
        scanned++;
        const appt = apptDoc.data();

        // Skip non-confirmed and already-reminded
        const status = (appt['status'] as string) ?? 'pending';
        if (status !== 'confirmed') continue;
        if (appt['reminder24h'] === true) continue;

        const clientName = (appt['clientName'] as string) ?? 'Client';
        const clientPhone = (appt['clientPhone'] as string) ?? '';
        const clientEmail = (appt['clientEmail'] as string) ?? '';
        const service = (appt['service'] as string) ?? 'RDV';
        const time = (appt['time'] as string) ?? '';
        const date = (appt['date'] as string) ?? '';
        const channel = (appt['sourceChannel'] as string) ?? 'unknown';

        const smsText = `Rappel RDV demain ${time} — ${service}. À bientôt !`;
        const richText = `📅 Rappel — Demain ${date} à ${time}\n\n👤 ${clientName}\n📋 ${service}\n\nÀ bientôt !`;

        let anySent = false;

        // 1. Primary channel — match the original booking channel
        if (channel === 'whatsapp' && clientPhone) {
          try {
            const { whatsappService } = await import('./whatsapp/whatsappService');
            const config = await whatsappService.getConfig(companyId).catch(() => null);
            if (config) { await whatsappService.sendMessage(config, clientPhone, richText); anySent = true; }
          } catch (err) { logger.warn('[Reminders24h] WhatsApp failed', { err: String(err) }); }
        } else if (channel === 'telegram') {
          // Lookup chatId from last inbound Telegram message for this client
          try {
            const lookup = await db.collection(`companies/${companyId}/telegramMessages`)
              .where('direction', '==', 'inbound')
              .where('fromName', '==', clientName)
              .orderBy('createdAt', 'desc').limit(1).get().catch(() => null);
            const chatId = lookup && !lookup.empty ? (lookup.docs[0].data()['chatId'] as string) : null;
            if (chatId) {
              const { sendTelegramMessage } = await import('./telegram/telegramService');
              await sendTelegramMessage(companyId, chatId, richText);
              anySent = true;
            }
          } catch (err) { logger.warn('[Reminders24h] Telegram failed', { err: String(err) }); }
        }

        // 2. Email backup — always send if email available and primary didn't send
        if (clientEmail) {
          try {
            const { sendEmail } = await import('./email/emailService');
            await sendEmail({
              to: clientEmail,
              subject: `Rappel — Rendez-vous demain ${date} à ${time}`,
              html: `<p>Bonjour ${clientName},</p><p>Petit rappel: votre rendez-vous pour <strong>${service}</strong> est prévu <strong>demain ${date} à ${time}</strong>.</p><p>À bientôt !</p>`,
              companyId,
              tags: [{ name: 'type', value: 'appointment-reminder-24h' }],
            });
            anySent = true;
          } catch (err) { logger.warn('[Reminders24h] Email failed', { err: String(err) }); }
        }

        // 3. SMS fallback if still nothing sent and we have a phone
        if (!anySent && clientPhone) {
          logger.info(`[Reminders24h] No channel worked for ${clientName} — phone ${clientPhone}, SMS not yet wired`);
          // Suppress dedup so we retry next scan
        }

        if (anySent) {
          await apptDoc.ref.update({ reminder24h: true, reminder24hAt: new Date() });
          sent++;
          logger.info(`[Reminders24h] Sent to ${clientName} (${channel}) for ${date} ${time}`);
        }
      }
    } catch (err) {
      logger.warn('[Reminders24h] Company iteration failed', { companyId, err: String(err) });
    }
  }

  return { scanned, sent };
}
