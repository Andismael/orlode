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
const express_1 = require("express");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// ── Cron endpoint (PUBLIC but requires secret header) ─────────────────────────
// POST /api/appointments/cron/reminders-24h
// Triggered by Cloud Scheduler every 15 minutes.
// Sends reminder on booking channel (WhatsApp/Telegram) + email backup, dedup via reminder24h field.
router.post('/cron/reminders-24h', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const expected = process.env['CRON_SECRET'] ?? '';
    const got = req.headers['x-cron-secret'] ?? req.query['secret'] ?? '';
    if (!expected || got !== expected) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const { sendAppointmentReminders24h } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    const result = await sendAppointmentReminders24h();
    logger_1.logger.info('[Cron] reminders-24h completed', result);
    res.json({ success: true, ...result });
}));
router.use(auth_middleware_1.authMiddleware);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
async function audit(companyId, action, actorId, details) {
    try {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/appointmentAuditLog`).add({
            action, actorId, details, createdAt: new Date(),
        });
    }
    catch { /* non-critical */ }
}
// GET /api/appointments
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { mine, status, from, to } = req.query;
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/appointments`);
    if (mine === 'true')
        q = q.where('assignedTo', '==', userId);
    if (status)
        q = q.where('status', '==', status);
    if (from && DATE_REGEX.test(from))
        q = q.where('date', '>=', from);
    if (to && DATE_REGEX.test(to))
        q = q.where('date', '<=', to);
    const snap = await q.limit(500).get().catch(async (err) => {
        logger_1.logger.warn('[Appointments] query needs index, falling back', { err: String(err) });
        return await db.collection(`companies/${companyId}/appointments`).limit(500).get();
    });
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort client-side to avoid composite index requirements
    items.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || String(b.time ?? '').localeCompare(String(a.time ?? '')));
    res.json({ success: true, data: items });
}));
// PATCH /api/appointments/:id — action-based
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const companyId = req.user?.companyId;
    const userId = req.user?.uid;
    const userName = req.user?.email ?? 'Admin';
    if (!companyId || !userId)
        throw new error_middleware_1.AppError('Unauthorized', 401);
    const { id } = req.params;
    const { action } = req.body;
    if (!action || !['confirm', 'reject', 'assign', 'reschedule'].includes(action)) {
        throw new error_middleware_1.AppError('Invalid action (must be confirm | reject | assign | reschedule)', 400);
    }
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.collection(`companies/${companyId}/appointments`).doc(id);
    const doc = await ref.get();
    if (!doc.exists)
        throw new error_middleware_1.AppError('Appointment not found', 404);
    const data = doc.data() ?? {};
    const updates = { updatedAt: new Date(), updatedBy: userId };
    if (action === 'confirm') {
        if (data['status'] === 'confirmed') {
            res.json({ success: true, data: { ...data, status: 'confirmed' }, message: 'Already confirmed' });
            return;
        }
        updates['status'] = 'confirmed';
        updates['confirmedAt'] = new Date();
        updates['confirmedBy'] = userId;
    }
    else if (action === 'reject') {
        const { reason } = req.body;
        updates['status'] = 'rejected';
        updates['rejectedAt'] = new Date();
        updates['rejectedBy'] = userId;
        if (reason)
            updates['rejectReason'] = reason;
    }
    else if (action === 'assign') {
        const { assignedTo, assignedToName } = req.body;
        if (!assignedTo)
            throw new error_middleware_1.AppError('assignedTo required', 400);
        updates['assignedTo'] = assignedTo;
        updates['assignedToName'] = assignedToName ?? '';
        updates['assignedAt'] = new Date();
        updates['assignedBy'] = userId;
        // if previously unassigned + pending → keep pending; admin confirms separately
    }
    else if (action === 'reschedule') {
        const { date, time } = req.body;
        if (!date || !DATE_REGEX.test(date))
            throw new error_middleware_1.AppError('Invalid date (YYYY-MM-DD)', 400);
        if (!time || !TIME_REGEX.test(time))
            throw new error_middleware_1.AppError('Invalid time (HH:MM)', 400);
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
        notifyClient(companyId, id, action).catch(err => logger_1.logger.warn('[Appointments] notify client failed', { err: String(err) }));
    }
    if (action === 'assign') {
        const assignedTo = updates['assignedTo'] ?? '';
        if (assignedTo) {
            notifyAssignedEmployee(companyId, id, assignedTo, data).catch(err => logger_1.logger.warn('[Appointments] notify employee failed', { err: String(err) }));
        }
    }
    const updated = (await ref.get()).data();
    res.json({ success: true, data: { id, ...updated } });
}));
async function notifyClient(companyId, appointmentId, action) {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/appointments`).doc(appointmentId).get();
    const d = doc.data();
    if (!d)
        return;
    const clientName = d['clientName'] ?? 'Client';
    const date = d['date'];
    const time = d['time'];
    const channel = d['sourceChannel'] ?? '';
    const phone = d['clientPhone'] ?? '';
    const email = d['clientEmail'] ?? '';
    const actionLabel = action === 'confirm' ? 'confirmé' : 'reprogrammé';
    const msg = `Bonjour ${clientName}, votre rendez-vous a été ${actionLabel} pour le ${date} à ${time}. Merci !`;
    // Email
    if (email) {
        try {
            const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
            await sendEmail({
                to: email,
                subject: `Rendez-vous ${actionLabel} — ${date} ${time}`,
                html: `<p>${msg}</p>`,
                companyId,
                tags: [{ name: 'type', value: 'appointment-confirmation' }],
            });
        }
        catch (err) {
            logger_1.logger.warn('[Appointments] email notify failed', { err: String(err) });
        }
    }
    // Telegram / WhatsApp — reply on same channel if we can resolve a destination
    try {
        if (channel === 'whatsapp' && phone) {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
            const config = await whatsappService.getConfig(companyId).catch(() => null);
            if (config)
                await whatsappService.sendMessage(config, phone, msg).catch(() => null);
        }
        if (channel === 'telegram') {
            // Lookup the chatId from the most recent inbound message for this client
            const lookup = await db
                .collection(`companies/${companyId}/telegramMessages`)
                .where('direction', '==', 'inbound')
                .where('fromName', '==', clientName)
                .orderBy('createdAt', 'desc').limit(1).get().catch(() => null);
            const chatId = lookup && !lookup.empty ? lookup.docs[0].data()['chatId'] : null;
            if (chatId) {
                const { sendTelegramMessage } = await Promise.resolve().then(() => __importStar(require('../services/telegram/telegramService')));
                await sendTelegramMessage(companyId, chatId, msg).catch(() => { });
            }
        }
    }
    catch { /* non-critical */ }
}
async function notifyAssignedEmployee(companyId, appointmentId, employeeId, apptData) {
    try {
        const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
        const clientName = apptData['clientName'] ?? 'Client';
        const date = apptData['date'];
        const time = apptData['time'];
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
    }
    catch { /* non-critical */ }
}
exports.default = router;
//# sourceMappingURL=appointments.routes.js.map