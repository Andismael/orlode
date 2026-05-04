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
exports.createNotification = createNotification;
exports.notifyVisitorArrived = notifyVisitorArrived;
exports.notifyLeaveRequested = notifyLeaveRequested;
exports.notifyLeaveReviewed = notifyLeaveReviewed;
exports.notifyPresenceCheckin = notifyPresenceCheckin;
exports.notifyAppointmentReminder = notifyAppointmentReminder;
exports.notifyAppointmentCreated = notifyAppointmentCreated;
exports.notifyQuoteCreated = notifyQuoteCreated;
exports.notifyAgentAlert = notifyAgentAlert;
exports.notifySecurityAlert = notifySecurityAlert;
exports.notifyLeadCreated = notifyLeadCreated;
exports.notifyQuoteSent = notifyQuoteSent;
exports.notifyQuoteAccepted = notifyQuoteAccepted;
exports.notifyQuoteRejected = notifyQuoteRejected;
exports.notifyDealWon = notifyDealWon;
exports.notifyFollowupOverdue = notifyFollowupOverdue;
exports.checkAppointmentReminders = checkAppointmentReminders;
exports.sendAppointmentReminders24h = sendAppointmentReminders24h;
/**
 * NotificationService — Unified notification system
 * Persists to Firestore, emits via Socket.io, optionally sends email
 */
const firebase_config_1 = require("../config/firebase.config");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
// io is lazily imported to avoid circular dependency
let _io = null;
function getIO() {
    if (!_io) {
        try {
            _io = require('../app').io;
        }
        catch { /* not yet initialized */ }
    }
    return _io;
}
/**
 * Create and dispatch a notification
 * 1. Save to Firestore
 * 2. Emit via Socket.io to the company room (or specific user)
 * 3. Optionally send email (if sendEmail=true)
 */
async function createNotification(input) {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    const notification = {
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
    }
    catch (err) {
        logger_1.logger.error('[NotificationService] Failed to persist:', err);
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
    }
    catch (err) {
        logger_1.logger.error('[NotificationService] Socket emit failed:', err);
    }
    logger_1.logger.info(`[NotificationService] Created: ${input.type} for ${input.userId ?? 'company'}`);
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
async function notifyVisitorArrived(companyId, visitorName, hostName, hostUserId, visitorId, visitorCompany) {
    const db = (0, firebase_config_1.getFirestore)();
    // ── 1. Resolve host user (if userId not provided) ────────────────────────
    let resolvedUserId = hostUserId;
    let hostEmail;
    let hostPhone;
    try {
        if (resolvedUserId) {
            const userDoc = await db.collection('users').doc(resolvedUserId).get();
            const ud = userDoc.data() ?? {};
            hostEmail = ud['email'];
            hostPhone = (ud['phoneNumber'] ?? ud['phone'] ?? ud['whatsappNumber']);
        }
        else if (hostName) {
            // Fuzzy lookup by name
            const snap = await db.collection('users')
                .where('companyId', '==', companyId)
                .limit(50).get();
            const needle = hostName.toLowerCase().trim();
            const match = snap.docs.find(d => {
                const dn = (d.data()['displayName'] ?? '').toLowerCase();
                const em = (d.data()['email'] ?? '').toLowerCase();
                return dn.includes(needle) || em.startsWith(needle.split(' ')[0]);
            });
            if (match) {
                resolvedUserId = match.id;
                hostEmail = match.data()['email'];
                hostPhone = (match.data()['phoneNumber'] ?? match.data()['phone'] ?? match.data()['whatsappNumber']);
            }
        }
    }
    catch (err) {
        logger_1.logger.warn('[notifyVisitorArrived] host resolution failed', { hostName, error: String(err) });
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
                const { whatsappService } = await Promise.resolve().then(() => __importStar(require('./whatsapp/whatsappService')));
                const config = await whatsappService.getConfig(companyId);
                if (!config)
                    return;
                const text = `🔔 *Visiteur à l'accueil*\n\n${visitorName}${visitorCompany ? ` (${visitorCompany})` : ''} vous attend.\n\nRépondez :\n✅ ACCEPTER\n⏰ PATIENTER\n❌ REFUSER\n\nOu ouvrez Orlode → Réception pour répondre directement.`;
                await whatsappService.sendMessage(config, hostPhone, text);
                logger_1.logger.info('[notifyVisitorArrived] WhatsApp sent', { hostPhone, visitorId });
            }
            catch (err) {
                logger_1.logger.warn('[notifyVisitorArrived] WhatsApp failed', { error: String(err) });
            }
        })();
    }
    // ── 4. Email push (best-effort) ──────────────────────────────────────────
    if (hostEmail && visitorId) {
        void (async () => {
            try {
                const { sendEmail, getBranding } = await Promise.resolve().then(() => __importStar(require('./email/emailService')));
                const branding = await getBranding(companyId);
                const baseUrl = process.env['APP_BASE_URL'] ?? 'https://orlode.com';
                const acceptUrl = `${baseUrl}/reception?action=allow_entry&visitorId=${visitorId}`;
                const waitUrl = `${baseUrl}/reception?action=wait&visitorId=${visitorId}`;
                const declineUrl = `${baseUrl}/reception?action=decline&visitorId=${visitorId}`;
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
                logger_1.logger.info('[notifyVisitorArrived] Email sent', { hostEmail, visitorId });
            }
            catch (err) {
                logger_1.logger.warn('[notifyVisitorArrived] Email failed', { error: String(err) });
            }
        })();
    }
    return notifId;
}
/**
 * Notify when a leave request is submitted
 */
async function notifyLeaveRequested(companyId, employeeName, type, days) {
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
async function notifyLeaveReviewed(companyId, userId, employeeName, status) {
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
async function notifyPresenceCheckin(companyId, employeeName) {
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
async function notifyAppointmentReminder(companyId, clientName, time, service) {
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
async function notifyAppointmentCreated(companyId, clientName, date, time, service) {
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
async function notifyQuoteCreated(companyId, clientName, total) {
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
async function notifyAgentAlert(companyId, agentName, title, message, severity = 'warning') {
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
async function notifySecurityAlert(companyId, title, message) {
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
async function notifyLeadCreated(companyId, leadName, source) {
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
async function notifyQuoteSent(companyId, quoteNumber, clientName, recipientEmail) {
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
async function notifyQuoteAccepted(companyId, quoteNumber, clientName, total) {
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
async function notifyQuoteRejected(companyId, quoteNumber, clientName) {
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
async function notifyDealWon(companyId, clientName, invoiceNumber, total) {
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
async function notifyFollowupOverdue(companyId, leadName, daysSilent) {
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
async function checkAppointmentReminders() {
    const db = (0, firebase_config_1.getFirestore)();
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
            let waConfig = null;
            try {
                const waDoc = await db.collection(`companies/${companyId}/settings`).doc('whatsapp').get();
                if (waDoc.exists && waDoc.data()?.['accessToken'])
                    waConfig = waDoc.data();
            }
            catch { }
            for (const apptDoc of snap.docs) {
                const appt = apptDoc.data();
                const [h, m] = (appt['time'] ?? '00:00').split(':').map(Number);
                const apptTotal = h * 60 + m;
                const diffMin = apptTotal - nowTotal;
                const clientName = appt['clientName'] ?? 'Client';
                const clientPhone = appt['clientPhone'] ?? '';
                const service = appt['service'] ?? 'RDV';
                const time = appt['time'] ?? '';
                for (const stage of REMINDER_STAGES) {
                    // Check if this stage should fire (within 10 min window)
                    if (appt[stage.key])
                        continue; // Already sent
                    if (diffMin <= 0)
                        continue; // Past
                    if (diffMin > stage.minutes + 5)
                        continue; // Too early
                    if (diffMin < stage.minutes - 5)
                        continue; // Too late for this stage
                    // 1. In-app notification
                    await notifyAppointmentReminder(companyId, clientName, time, `${service} — ${stage.label}`);
                    // 2. WhatsApp notification (if connected + client has phone)
                    if (waConfig && clientPhone) {
                        try {
                            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
                            const config = await whatsappService.getConfig(companyId).catch(() => null);
                            if (config) {
                                const message = `📅 Rappel RDV — ${stage.label}\n\n` +
                                    `👤 ${clientName}\n` +
                                    `🕐 Aujourd'hui à ${time}\n` +
                                    `📋 ${service}\n\n` +
                                    `À bientôt !`;
                                await whatsappService.sendMessage(config, clientPhone, message);
                                logger_1.logger.info(`[Reminders] WhatsApp sent to ${clientPhone} — ${stage.key}`);
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn(`[Reminders] WhatsApp failed for ${clientPhone}`, { error: err.message });
                        }
                    }
                    // Mark this stage as sent
                    await apptDoc.ref.update({ [stage.key]: true });
                    logger_1.logger.info(`[Reminders] ${stage.key} sent for ${clientName} at ${time}`);
                }
            }
        }
        catch { }
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
async function sendAppointmentReminders24h() {
    const db = (0, firebase_config_1.getFirestore)();
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
                const status = appt['status'] ?? 'pending';
                if (status !== 'confirmed')
                    continue;
                if (appt['reminder24h'] === true)
                    continue;
                const clientName = appt['clientName'] ?? 'Client';
                const clientPhone = appt['clientPhone'] ?? '';
                const clientEmail = appt['clientEmail'] ?? '';
                const service = appt['service'] ?? 'RDV';
                const time = appt['time'] ?? '';
                const date = appt['date'] ?? '';
                const channel = appt['sourceChannel'] ?? 'unknown';
                const smsText = `Rappel RDV demain ${time} — ${service}. À bientôt !`;
                const richText = `📅 Rappel — Demain ${date} à ${time}\n\n👤 ${clientName}\n📋 ${service}\n\nÀ bientôt !`;
                let anySent = false;
                // 1. Primary channel — match the original booking channel
                if (channel === 'whatsapp' && clientPhone) {
                    try {
                        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('./whatsapp/whatsappService')));
                        const config = await whatsappService.getConfig(companyId).catch(() => null);
                        if (config) {
                            await whatsappService.sendMessage(config, clientPhone, richText);
                            anySent = true;
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn('[Reminders24h] WhatsApp failed', { err: String(err) });
                    }
                }
                else if (channel === 'telegram') {
                    // Lookup chatId from last inbound Telegram message for this client
                    try {
                        const lookup = await db.collection(`companies/${companyId}/telegramMessages`)
                            .where('direction', '==', 'inbound')
                            .where('fromName', '==', clientName)
                            .orderBy('createdAt', 'desc').limit(1).get().catch(() => null);
                        const chatId = lookup && !lookup.empty ? lookup.docs[0].data()['chatId'] : null;
                        if (chatId) {
                            const { sendTelegramMessage } = await Promise.resolve().then(() => __importStar(require('./telegram/telegramService')));
                            await sendTelegramMessage(companyId, chatId, richText);
                            anySent = true;
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn('[Reminders24h] Telegram failed', { err: String(err) });
                    }
                }
                // 2. Email backup — always send if email available and primary didn't send
                if (clientEmail) {
                    try {
                        const { sendEmail } = await Promise.resolve().then(() => __importStar(require('./email/emailService')));
                        await sendEmail({
                            to: clientEmail,
                            subject: `Rappel — Rendez-vous demain ${date} à ${time}`,
                            html: `<p>Bonjour ${clientName},</p><p>Petit rappel: votre rendez-vous pour <strong>${service}</strong> est prévu <strong>demain ${date} à ${time}</strong>.</p><p>À bientôt !</p>`,
                            companyId,
                            tags: [{ name: 'type', value: 'appointment-reminder-24h' }],
                        });
                        anySent = true;
                    }
                    catch (err) {
                        logger_1.logger.warn('[Reminders24h] Email failed', { err: String(err) });
                    }
                }
                // 3. SMS fallback if still nothing sent and we have a phone
                if (!anySent && clientPhone) {
                    logger_1.logger.info(`[Reminders24h] No channel worked for ${clientName} — phone ${clientPhone}, SMS not yet wired`);
                    // Suppress dedup so we retry next scan
                }
                if (anySent) {
                    await apptDoc.ref.update({ reminder24h: true, reminder24hAt: new Date() });
                    sent++;
                    logger_1.logger.info(`[Reminders24h] Sent to ${clientName} (${channel}) for ${date} ${time}`);
                }
            }
        }
        catch (err) {
            logger_1.logger.warn('[Reminders24h] Company iteration failed', { companyId, err: String(err) });
        }
    }
    return { scanned, sent };
}
//# sourceMappingURL=notificationService.js.map