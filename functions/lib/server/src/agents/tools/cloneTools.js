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
exports.CLONE_SAFE_TOOL_NAMES = exports.CLONE_SAFE_TOOLS = exports.cloneCheckEmployeePresenceTool = exports.cloneNotifyHostTool = exports.cloneFindEmployeeTool = exports.cloneRescheduleAppointmentTool = exports.cloneExtractInvoiceTool = exports.cloneSendEmailTool = exports.cloneCreateSupportTicketTool = exports.cloneAddClientTool = exports.cloneConfirmAppointmentTool = exports.cloneCreateAppointmentTool = exports.cloneFindAppointmentTool = exports.DEFAULT_BUSINESS_HOURS = void 0;
/**
 * Clone-safe tools — subset of business actions that the PUBLIC Clone can invoke.
 *
 * Philosophy:
 *   - Only write operations, no delete / no financial
 *   - Force `status: 'pending'` on sensitive objects (appointments, support tickets)
 *   - Tag everything with `source: clone:<channel>` + `createdBy: 'clone'` for audit
 *   - Return clear success/failure so the Clone only confirms after real execution
 *
 * These wrappers call Firestore directly (same collections as the orchestrator's
 * marketplaceTools) but with the safety metadata baked in.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const helpers_1 = require("../../utils/helpers");
const logger_1 = require("../../utils/logger");
async function audit(companyId, action, details) {
    try {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/cloneAuditLog`).add({
            action, details, createdAt: new Date(),
        });
    }
    catch { /* non-critical */ }
}
// ── Validation helpers ───────────────────────────────────────────────────────
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
function normalizePhone(p) {
    if (!p)
        return '';
    return p.replace(/[^0-9+]/g, '');
}
function normalizeEmail(e) {
    return (e ?? '').toLowerCase().trim();
}
/** Convert `date + time + timezone` to a UTC ISO string. Falls back to UTC if tz is invalid. */
function toUtcIso(date, time, timezone) {
    // Parse YYYY-MM-DD HH:mm in the given timezone using Intl.DateTimeFormat offset
    try {
        // We construct a date assuming local components and let Intl resolve the tz.
        // Trick: build a string and parse with the tz-aware formatter's inverse — not native in JS.
        // Simpler approach: get the tz offset at that wall-clock time via Intl, then shift.
        const [y, m, d] = date.split('-').map(Number);
        const [h, min] = time.split(':').map(Number);
        // Start from UTC, then find how the tz shifts it
        const asUtc = new Date(Date.UTC(y, (m ?? 1) - 1, d, h, min));
        // Format back in the tz to compute the offset
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const parts = dtf.formatToParts(asUtc).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
        const reconstructed = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour === '24' ? '00' : parts.hour), Number(parts.minute)));
        const offsetMs = reconstructed.getTime() - asUtc.getTime();
        const utc = new Date(asUtc.getTime() - offsetMs);
        return utc.toISOString();
    }
    catch {
        // Fallback — treat as UTC
        return `${date}T${time}:00Z`;
    }
}
exports.DEFAULT_BUSINESS_HOURS = {
    mon: { open: '09:00', close: '18:00' }, tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' }, thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '18:00' }, sat: { open: '09:00', close: '13:00' },
    sun: { open: '09:00', close: '18:00', closed: true },
};
/** Load company preferences (timezone, auto-confirm, hours) with sensible defaults */
async function getCompanyBookingPrefs(companyId) {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection('companies').doc(companyId).get();
        const d = doc.data() ?? {};
        const settings = d['settings'] ?? {};
        const hours = settings['businessHours'] ?? {};
        const merged = {
            ...exports.DEFAULT_BUSINESS_HOURS,
            ...hours,
        };
        return {
            timezone: settings['timezone'] || d['timezone'] || 'Africa/Abidjan',
            autoConfirm: settings['autoConfirmAppointments'] === true,
            businessHours: merged,
            slotDurationMinutes: Math.max(5, Number(settings['slotDurationMinutes']) || 30),
        };
    }
    catch {
        return { timezone: 'Africa/Abidjan', autoConfirm: false, businessHours: exports.DEFAULT_BUSINESS_HOURS, slotDurationMinutes: 30 };
    }
}
/**
 * Resolve which employee should be auto-assigned for a given service.
 * Returns { userId, displayName } or null.
 *
 * Matching is case-insensitive and handles partial matches
 * (e.g., service "Coupe homme express" matches mapping "coupe homme").
 */
async function resolveAutoAssignment(companyId, service) {
    if (!service?.trim())
        return null;
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection('companies').doc(companyId).get();
        const settings = doc.data()?.['settings'] ?? {};
        const mapping = settings['serviceAssignments'] ?? {};
        const needle = service.toLowerCase().trim();
        // 1) Exact match
        if (mapping[needle])
            return mapping[needle];
        // 2) Case-insensitive on keys
        for (const key of Object.keys(mapping)) {
            if (key.toLowerCase() === needle)
                return mapping[key];
        }
        // 3) Partial match — service contains mapping key or vice versa
        for (const key of Object.keys(mapping)) {
            const k = key.toLowerCase();
            if (needle.includes(k) || k.includes(needle))
                return mapping[key];
        }
        return null;
    }
    catch {
        return null;
    }
}
/** Check if a time (HH:MM) is within a day's opening window (inclusive start, exclusive end). */
function isWithinHours(time, day) {
    if (day.closed)
        return false;
    return time >= day.open && time < day.close;
}
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function dayKeyForDate(date) {
    const [y, m, d] = date.split('-').map(Number);
    const js = new Date(Date.UTC(y, (m ?? 1) - 1, d)).getUTCDay();
    return WEEKDAY_KEYS[js];
}
function addMinutes(hhmm, minutes) {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}
function timesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}
// ── findAppointment — check before creating or opening a ticket ──────────────
exports.cloneFindAppointmentTool = genkit_config_1.ai.defineTool({
    name: 'findAppointment',
    description: 'Search for an existing appointment by the client contact (phone or email) and optional date. ALWAYS call this first when a user asks about an appointment they think they made. Returns the appointment if found.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        clientPhone: zod_1.z.string().optional(),
        clientEmail: zod_1.z.string().optional(),
        date: zod_1.z.string().optional().describe('Optional YYYY-MM-DD to narrow down'),
    }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(),
        appointmentId: zod_1.z.string().optional(),
        clientName: zod_1.z.string().optional(),
        service: zod_1.z.string().optional(),
        date: zod_1.z.string().optional(),
        time: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email)
        return { found: false, message: 'Impossible de chercher sans numéro ou email.' };
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const coll = db.collection(`companies/${input.companyId}/appointments`);
        let q = phone ? coll.where('clientPhone', '==', phone) : coll.where('clientEmail', '==', email);
        if (input.date && DATE_REGEX.test(input.date))
            q = q.where('date', '==', input.date);
        const snap = await q.orderBy('createdAt', 'desc').limit(1).get().catch(async () => {
            // If composite index missing, fall back without orderBy
            return await q.limit(5).get();
        });
        if (snap.empty)
            return { found: false, message: 'Aucun rendez-vous trouvé pour ce contact.' };
        const doc = snap.docs[0].data();
        return {
            found: true,
            appointmentId: snap.docs[0].id,
            clientName: doc['clientName'],
            service: doc['service'],
            date: doc['date'],
            time: doc['time'],
            status: doc['status'],
            message: `Rendez-vous trouvé: ${doc['clientName']} le ${doc['date']} à ${doc['time']} (${doc['status']}).`,
        };
    }
    catch (err) {
        logger_1.logger.error('[CloneTools] findAppointment failed', { err: String(err) });
        return { found: false, message: 'Erreur lors de la recherche.' };
    }
});
// ── createAppointment (production-ready) ─────────────────────────────────────
//
// Safeguards:
//   1. Validation — name + contact + valid date/time required
//   2. Timezone aware — stores datetimeUTC + timezone
//   3. Technical idempotency — idempotencyKey prevents retries creating duplicates
//   4. Logical dedup — same (phone|email) + date + time returns existing record
//   5. Auto-confirm — status is 'confirmed' only if the company enabled it; else 'pending'
//   6. Audit trail — every creation is logged in cloneAuditLog
//
exports.cloneCreateAppointmentTool = genkit_config_1.ai.defineTool({
    name: 'clone_createAppointment',
    description: 'Create an appointment. Only call after confirming: name, service, date (YYYY-MM-DD), time (HH:MM 24h), and at least one contact (phone OR email). Returns appointmentId on success. The status will be "pending" unless the company has auto-confirm enabled.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        clientName: zod_1.z.string(),
        clientPhone: zod_1.z.string().optional(),
        clientEmail: zod_1.z.string().optional(),
        service: zod_1.z.string(),
        date: zod_1.z.string().describe('YYYY-MM-DD'),
        time: zod_1.z.string().describe('HH:MM in 24h format, e.g. 14:30'),
        notes: zod_1.z.string().optional(),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        appointmentId: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        alreadyExisted: zod_1.z.boolean().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    // ── 1. Validation ─────────────────────────────────────────────────────
    if (!input.clientName?.trim())
        return { success: false, message: 'Nom du client requis.' };
    if (!input.clientPhone && !input.clientEmail)
        return { success: false, message: 'Au moins un moyen de contact requis (téléphone ou email).' };
    if (!DATE_REGEX.test(input.date))
        return { success: false, message: `Date invalide (attendu: YYYY-MM-DD, reçu: "${input.date}").` };
    if (!TIME_REGEX.test(input.time))
        return { success: false, message: `Heure invalide (attendu: HH:MM, reçu: "${input.time}").` };
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const coll = db.collection(`companies/${input.companyId}/appointments`);
        // ── 2. Logical dedup — same contact + date + time = reuse ──────────
        const contactField = phone ? 'clientPhone' : 'clientEmail';
        const contactVal = phone || email;
        if (contactVal) {
            const dupSnap = await coll
                .where(contactField, '==', contactVal)
                .where('date', '==', input.date)
                .where('time', '==', input.time)
                .limit(1).get();
            if (!dupSnap.empty) {
                const existing = dupSnap.docs[0].data();
                return {
                    success: true,
                    appointmentId: dupSnap.docs[0].id,
                    status: existing['status'] ?? 'pending',
                    alreadyExisted: true,
                    message: `Un rendez-vous existe déjà pour ${input.clientName} le ${input.date} à ${input.time}.`,
                };
            }
        }
        // ── 3. Technical idempotency — stable key survives retries ─────────
        const idempotencyKey = `${input.sourceChannel ?? 'clone'}:${contactVal}:${input.date}:${input.time}`;
        const byIdemSnap = await coll.where('idempotencyKey', '==', idempotencyKey).limit(1).get();
        if (!byIdemSnap.empty) {
            const existing = byIdemSnap.docs[0].data();
            return {
                success: true,
                appointmentId: byIdemSnap.docs[0].id,
                status: existing['status'] ?? 'pending',
                alreadyExisted: true,
                message: `Demande déjà enregistrée (référence ${byIdemSnap.docs[0].id}).`,
            };
        }
        // ── 4. Load company prefs (timezone + auto-confirm + hours) ────────
        const prefs = await getCompanyBookingPrefs(input.companyId);
        const datetimeUTC = toUtcIso(input.date, input.time, prefs.timezone);
        const status = prefs.autoConfirm ? 'confirmed' : 'pending';
        // ── 4b. Business hours check ───────────────────────────────────────
        const dayKey = dayKeyForDate(input.date);
        const dayWindow = prefs.businessHours[dayKey];
        if (!isWithinHours(input.time, dayWindow)) {
            if (dayWindow.closed) {
                return { success: false, message: `Nous sommes fermés ce jour-là. Merci de choisir un autre jour.` };
            }
            return { success: false, message: `Cet horaire est en dehors de nos heures d'ouverture (${dayWindow.open}–${dayWindow.close}). Merci de choisir un autre créneau.` };
        }
        // ── 4c. Slot availability — reject if another non-rejected appointment overlaps ──
        const slotEnd = addMinutes(input.time, prefs.slotDurationMinutes);
        try {
            const dayAppts = await coll.where('date', '==', input.date).get();
            for (const d of dayAppts.docs) {
                const data = d.data();
                const s = data['status'] ?? 'pending';
                if (s === 'rejected' || s === 'cancelled')
                    continue;
                const existingStart = data['time'] ?? '';
                if (!existingStart)
                    continue;
                const existingEnd = addMinutes(existingStart, prefs.slotDurationMinutes);
                if (timesOverlap(input.time, slotEnd, existingStart, existingEnd)) {
                    return { success: false, message: `Ce créneau (${input.time}) n'est plus disponible. Essayez un autre horaire.` };
                }
            }
        }
        catch { /* non-critical — fall through to creation */ }
        // ── 5. Auto-assignment based on service → employee mapping ─────────
        const assignment = await resolveAutoAssignment(input.companyId, input.service);
        // ── 6. Create ──────────────────────────────────────────────────────
        const id = (0, helpers_1.generateId)();
        await coll.doc(id).set({
            id,
            clientName: input.clientName.trim(),
            clientPhone: phone,
            clientEmail: email,
            service: input.service,
            date: input.date,
            time: input.time,
            timezone: prefs.timezone,
            datetimeUTC,
            notes: input.notes ?? '',
            status,
            assignedTo: assignment?.userId ?? null,
            assignedToName: assignment?.displayName ?? null,
            assignedBy: assignment ? 'auto' : null,
            sourceChannel: input.sourceChannel ?? 'unknown',
            sourceType: 'clone',
            source: `clone:${input.sourceChannel ?? 'unknown'}`,
            createdBy: 'clone',
            idempotencyKey,
            createdAt: new Date(),
        });
        await audit(input.companyId, 'createAppointment', {
            appointmentId: id, clientName: input.clientName, date: input.date, time: input.time,
            timezone: prefs.timezone, status, source: input.sourceChannel,
        });
        // ── 6. Side-effects (non-blocking) ──────────────────────────────────
        // Email to client (if email provided) — "demande reçue" or "confirmé"
        if (email) {
            (async () => {
                try {
                    const { sendEmail: sendMail } = await Promise.resolve().then(() => __importStar(require('../../services/email/emailService')));
                    const { buildMagicLink } = await Promise.resolve().then(() => __importStar(require('../../utils/magicToken')));
                    const subject = status === 'confirmed'
                        ? `Rendez-vous confirmé — ${input.date} ${input.time}`
                        : `Demande de rendez-vous reçue — ${input.date} ${input.time}`;
                    const lead = status === 'confirmed'
                        ? `Votre rendez-vous est confirmé pour le ${input.date} à ${input.time}.`
                        : `Votre demande de rendez-vous pour le ${input.date} à ${input.time} a été enregistrée. Un agent va valider sous peu.`;
                    const magic = buildMagicLink(input.companyId, { email, phone });
                    const magicHtml = magic ? `<p style="margin-top:16px"><a href="${magic}">Gérer mes rendez-vous</a></p>` : '';
                    await sendMail({
                        to: email, subject,
                        html: `<p>Bonjour ${input.clientName},</p><p>${lead}</p><p>Service: ${input.service}</p><p>Référence: ${id}</p>${magicHtml}`,
                        companyId: input.companyId,
                        tags: [{ name: 'type', value: 'appointment-created' }],
                    });
                }
                catch (err) {
                    logger_1.logger.warn('[CloneTools] auto email failed', { err: String(err) });
                }
            })().catch(() => { });
        }
        // In-app notification — company-wide + assigned employee if any
        (async () => {
            try {
                const { createNotification } = await Promise.resolve().then(() => __importStar(require('../../services/notificationService')));
                const baseNotif = {
                    companyId: input.companyId,
                    type: 'appointment_created',
                    title: status === 'confirmed' ? 'Nouveau RDV confirmé' : 'Nouveau RDV en attente',
                    message: `${input.clientName} — ${input.date} à ${input.time}${input.service ? ` (${input.service})` : ''}${assignment ? ` → ${assignment.displayName}` : ''}`,
                    actionUrl: '/admin/appointments',
                    icon: 'Calendar',
                    severity: (status === 'confirmed' ? 'info' : 'warning'),
                    metadata: { appointmentId: id, source: input.sourceChannel ?? 'unknown', assignedTo: assignment?.userId ?? null },
                };
                await createNotification(baseNotif);
                if (assignment?.userId) {
                    await createNotification({ ...baseNotif, userId: assignment.userId, actionUrl: '/calendar' });
                }
            }
            catch (err) {
                logger_1.logger.warn('[CloneTools] auto notification failed', { err: String(err) });
            }
        })().catch(() => { });
        return {
            success: true,
            appointmentId: id,
            status,
            alreadyExisted: false,
            message: status === 'confirmed'
                ? `Rendez-vous confirmé pour ${input.clientName} le ${input.date} à ${input.time} (${prefs.timezone}).`
                : `Demande enregistrée pour ${input.clientName} le ${input.date} à ${input.time} (${prefs.timezone}). Vous serez contacté pour validation.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[CloneTools] createAppointment failed', { err: String(err) });
        return { success: false, message: `Impossible d'enregistrer le rendez-vous. Un humain vous recontactera.` };
    }
});
// ── confirmAppointment — identity-gated status update ───────────────────────
//
// Rules:
//   - Must be called with an appointmentId AND a proof of identity (phone OR email)
//   - The proof MUST match the appointment record, otherwise the tool refuses
//   - Only `pending` appointments can be self-confirmed by the client
//   - Confirmed/Rejected/Cancelled states are final — the Clone must tell the client to call
//   - Every action is audit-logged
//
exports.cloneConfirmAppointmentTool = genkit_config_1.ai.defineTool({
    name: 'confirmAppointment',
    description: 'Confirm an existing PENDING appointment ONLY when the client has provided a proof of identity (phone or email) that matches the record. Call this after findAppointment returned a pending appointment and the same client is asking for confirmation. Never claim confirmation without calling this tool. If identity does not match, you MUST tell the client a human will recontact them.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        appointmentId: zod_1.z.string(),
        clientPhone: zod_1.z.string().optional().describe('Identity proof — phone number the client provided in this conversation'),
        clientEmail: zod_1.z.string().optional().describe('Identity proof — email the client provided in this conversation'),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        status: zod_1.z.string().optional(),
        message: zod_1.z.string(),
        requiresHuman: zod_1.z.boolean().optional(),
    }),
}, async (input) => {
    // ── Voice guardrail — never confirm vocally, always escalate to admin ──
    if (input.sourceChannel === 'voice') {
        await audit(input.companyId, 'confirmAppointment.voiceBlocked', { appointmentId: input.appointmentId });
        return {
            success: false,
            requiresHuman: true,
            message: "Pour confirmer ce rendez-vous, un agent va vous recontacter sous peu. Nous ne validons pas les confirmations à la voix pour votre sécurité.",
        };
    }
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) {
        return { success: false, requiresHuman: true, message: "Impossible de confirmer sans vérification d'identité (téléphone ou email)." };
    }
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(`companies/${input.companyId}/appointments`).doc(input.appointmentId);
        const doc = await ref.get();
        if (!doc.exists)
            return { success: false, message: 'Rendez-vous introuvable.' };
        const data = doc.data() ?? {};
        // Identity check — strict equality on normalized values
        const storedPhone = normalizePhone(data['clientPhone'] ?? '');
        const storedEmail = normalizeEmail(data['clientEmail'] ?? '');
        const phoneMatch = phone && storedPhone && phone === storedPhone;
        const emailMatch = email && storedEmail && email === storedEmail;
        if (!phoneMatch && !emailMatch) {
            await audit(input.companyId, 'confirmAppointment.identityFailed', {
                appointmentId: input.appointmentId, providedPhone: phone ? '[redacted]' : undefined, providedEmail: email ? '[redacted]' : undefined,
            });
            return {
                success: false,
                requiresHuman: true,
                message: "Les informations fournies ne correspondent pas au rendez-vous. Un agent vous recontactera pour vérification.",
            };
        }
        const currentStatus = data['status'] ?? 'pending';
        if (currentStatus === 'confirmed') {
            return { success: true, status: 'confirmed', message: 'Rendez-vous déjà confirmé.' };
        }
        if (currentStatus !== 'pending') {
            return {
                success: false,
                requiresHuman: true,
                message: `Le rendez-vous est au statut "${currentStatus}" et ne peut être confirmé automatiquement. Un agent vous recontactera.`,
            };
        }
        await ref.update({
            status: 'confirmed',
            confirmedAt: new Date(),
            confirmedBy: 'clone',
        });
        await audit(input.companyId, 'confirmAppointment', {
            appointmentId: input.appointmentId,
            via: phoneMatch ? 'phone' : 'email',
        });
        return {
            success: true,
            status: 'confirmed',
            message: `Rendez-vous confirmé pour le ${data['date']} à ${data['time']}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[CloneTools] confirmAppointment failed', { err: String(err) });
        return { success: false, requiresHuman: true, message: "Impossible de confirmer maintenant. Un agent vous recontactera." };
    }
});
// ── addClient / createLead (with dedup by phone/email) ──────────────────────
exports.cloneAddClientTool = genkit_config_1.ai.defineTool({
    name: 'clone_addClient',
    description: 'Register a new client/lead in the CRM. Call when you have captured at least the name and one contact (phone or email). If the contact already exists, returns the existing clientId without creating a duplicate.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        name: zod_1.z.string(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(), clientId: zod_1.z.string().optional(), alreadyExisted: zod_1.z.boolean().optional(), message: zod_1.z.string(),
    }),
}, async (input) => {
    if (!input.name?.trim())
        return { success: false, message: 'Nom requis.' };
    const phone = normalizePhone(input.phone);
    const email = normalizeEmail(input.email);
    if (!phone && !email)
        return { success: false, message: 'Téléphone ou email requis.' };
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const coll = db.collection(`companies/${input.companyId}/clients`);
        // Dedup by phone first, then email
        if (phone) {
            const snap = await coll.where('phone', '==', phone).limit(1).get();
            if (!snap.empty) {
                return { success: true, clientId: snap.docs[0].id, alreadyExisted: true, message: `Contact déjà connu: ${input.name}.` };
            }
        }
        if (email) {
            const snap = await coll.where('email', '==', email).limit(1).get();
            if (!snap.empty) {
                return { success: true, clientId: snap.docs[0].id, alreadyExisted: true, message: `Contact déjà connu: ${input.name}.` };
            }
        }
        const id = (0, helpers_1.generateId)();
        await coll.doc(id).set({
            id, name: input.name.trim(), phone, email,
            notes: input.notes ?? '',
            tags: ['prospect', `source:${input.sourceChannel ?? 'clone'}`],
            source: `clone:${input.sourceChannel ?? 'unknown'}`,
            createdBy: 'clone',
            visits: 0, totalSpent: 0, createdAt: new Date(),
        });
        await audit(input.companyId, 'addClient', { clientId: id, name: input.name, source: input.sourceChannel });
        return { success: true, clientId: id, alreadyExisted: false, message: `Contact enregistré: ${input.name}` };
    }
    catch (err) {
        logger_1.logger.error('[CloneTools] addClient failed', { err: String(err) });
        return { success: false, message: `Impossible d'enregistrer le contact.` };
    }
});
// ── createSupportTicket (pending) ─────────────────────────────────────────────
exports.cloneCreateSupportTicketTool = genkit_config_1.ai.defineTool({
    name: 'createSupportTicket',
    description: 'Create a pending support ticket when a visitor reports a problem. Include what they reported and urgency.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        subject: zod_1.z.string(),
        description: zod_1.z.string(),
        clientName: zod_1.z.string().optional(),
        clientContact: zod_1.z.string().optional().describe('phone or email'),
        priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), ticketId: zod_1.z.string().optional(), message: zod_1.z.string() }),
}, async (input) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const id = (0, helpers_1.generateId)();
        await db.collection(`companies/${input.companyId}/supportTickets`).doc(id).set({
            id, subject: input.subject, description: input.description,
            clientName: input.clientName ?? 'Anonyme',
            clientContact: input.clientContact ?? '',
            priority: input.priority ?? 'medium',
            status: 'pending', // ← key difference
            source: `clone:${input.sourceChannel ?? 'unknown'}`,
            createdBy: 'clone',
            createdAt: new Date(),
        });
        await audit(input.companyId, 'createSupportTicket', { ticketId: id, subject: input.subject });
        return { success: true, ticketId: id, message: `Ticket cree: ${input.subject}` };
    }
    catch (err) {
        logger_1.logger.error('[CloneTools] createSupportTicket failed', { err: String(err) });
        return { success: false, message: `Impossible de creer le ticket: ${String(err)}` };
    }
});
// ── sendEmail (reuses the orchestrator's unified service — Gmail-first) ──────
// IMPORTANT: tool name must NOT collide with `sendEmail` from externalTools.ts.
// When two tools share the same name, the second registration silently replaces
// the first in Genkit's global registry, breaking the orchestrator's
// `sendEmailTool` lookup ("NOT_FOUND: Tool sendEmail not found").
exports.cloneSendEmailTool = genkit_config_1.ai.defineTool({
    name: 'clone_sendEmail',
    description: 'Send a confirmation or follow-up email to a visitor after capturing their email. Use for appointment confirmations or sending info. Be polite and concise.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        to: zod_1.z.string(),
        subject: zod_1.z.string(),
        body: zod_1.z.string(),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string(), requiresHuman: zod_1.z.boolean().optional() }),
}, async (input) => {
    // ── Voice guardrail — never send emails from voice, escalate to admin ──
    if (input.sourceChannel === 'voice') {
        await audit(input.companyId, 'sendEmail.voiceBlocked', { to: input.to, subject: input.subject });
        return {
            success: false,
            requiresHuman: true,
            message: "L'envoi d'email par la voix nécessite une validation. Un agent va s'en occuper.",
        };
    }
    try {
        const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../../services/email/emailService')));
        const html = input.body.includes('<') ? input.body : `<p>${input.body.replace(/\n/g, '<br>')}</p>`;
        const result = await sendEmail({
            to: input.to, subject: input.subject, html,
            companyId: input.companyId,
            tags: [{ name: 'type', value: 'clone-outbound' }],
        });
        await audit(input.companyId, 'sendEmail', { to: input.to, subject: input.subject, provider: result.provider });
        return { success: true, message: `Email envoye a ${input.to} (via ${result.provider})` };
    }
    catch (err) {
        logger_1.logger.error('[CloneTools] sendEmail failed', { err: String(err) });
        return { success: false, message: `Echec envoi email: ${String(err)}` };
    }
});
const reservationTools_1 = require("./reservationTools");
const salesTools_1 = require("./salesTools");
const commerceTools_1 = require("./commerceTools");
// ── extractInvoiceData — Azure Document Intelligence ────────────────────────
exports.cloneExtractInvoiceTool = genkit_config_1.ai.defineTool({
    name: 'extractInvoiceData',
    description: "Extract structured data (vendor, total, items, dates) from an invoice image/PDF URL using Azure Document Intelligence. Use when the user sends a photo of an invoice.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        documentUrl: zod_1.z.string().describe('Public URL of the invoice image or PDF'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        vendor: zod_1.z.string().optional(),
        invoiceId: zod_1.z.string().optional(),
        invoiceDate: zod_1.z.string().optional(),
        dueDate: zod_1.z.string().optional(),
        total: zod_1.z.number().optional(),
        subtotal: zod_1.z.number().optional(),
        tax: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        itemsCount: zod_1.z.number().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    try {
        const { analyzeInvoice } = await Promise.resolve().then(() => __importStar(require('../../services/azure/azureService')));
        const result = await analyzeInvoice(input.companyId, input.documentUrl);
        await audit(input.companyId, 'extractInvoiceData', { success: result.success, total: result.data?.total, vendor: result.data?.vendor });
        if (!result.success)
            return { success: false, message: result.message };
        return {
            success: true,
            vendor: result.data?.vendor,
            invoiceId: result.data?.invoiceId,
            invoiceDate: result.data?.invoiceDate,
            dueDate: result.data?.dueDate,
            total: result.data?.total,
            subtotal: result.data?.subtotal,
            tax: result.data?.tax,
            currency: result.data?.currency,
            itemsCount: result.data?.items?.length ?? 0,
            message: `Facture: ${result.data?.vendor ?? 'fournisseur inconnu'}, total ${result.data?.total ?? '?'} ${result.data?.currency ?? ''}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[CloneTools] extractInvoiceData failed', { err: String(err) });
        return { success: false, message: "Impossible d'analyser le document." };
    }
});
// ── rescheduleAppointment (identity-gated, voice-allowed) ───────────────────
exports.cloneRescheduleAppointmentTool = genkit_config_1.ai.defineTool({
    name: 'rescheduleAppointment',
    description: 'Reschedule an existing appointment to a new date/time. Requires identity proof (phone or email matching the record). Works on all channels including voice.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        appointmentId: zod_1.z.string(),
        newDate: zod_1.z.string().describe('YYYY-MM-DD'),
        newTime: zod_1.z.string().describe('HH:MM 24h'),
        clientPhone: zod_1.z.string().optional(),
        clientEmail: zod_1.z.string().optional(),
        sourceChannel: zod_1.z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(), message: zod_1.z.string(), requiresHuman: zod_1.z.boolean().optional(),
    }),
}, async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email)
        return { success: false, requiresHuman: true, message: "Téléphone ou email requis pour vérifier." };
    if (!DATE_REGEX.test(input.newDate))
        return { success: false, message: 'Nouvelle date invalide (YYYY-MM-DD).' };
    if (!TIME_REGEX.test(input.newTime))
        return { success: false, message: 'Nouvelle heure invalide (HH:MM).' };
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const ref = db.collection(`companies/${input.companyId}/appointments`).doc(input.appointmentId);
        const doc = await ref.get();
        if (!doc.exists)
            return { success: false, message: 'Rendez-vous introuvable.' };
        const data = doc.data() ?? {};
        const storedPhone = normalizePhone(data['clientPhone'] ?? '');
        const storedEmail = normalizeEmail(data['clientEmail'] ?? '');
        if (!((phone && phone === storedPhone) || (email && email === storedEmail))) {
            await audit(input.companyId, 'rescheduleAppointment.identityFailed', { appointmentId: input.appointmentId });
            return { success: false, requiresHuman: true, message: 'Vérification impossible. Un agent vous recontactera.' };
        }
        await ref.update({
            previousDate: data['date'], previousTime: data['time'],
            date: input.newDate, time: input.newTime,
            status: 'rescheduled', rescheduledAt: new Date(), rescheduledBy: 'clone',
            reminder24h: false, // reset reminder flag so it fires for the new slot
        });
        await audit(input.companyId, 'rescheduleAppointment', { appointmentId: input.appointmentId, newDate: input.newDate, newTime: input.newTime });
        return { success: true, message: `Rendez-vous déplacé au ${input.newDate} à ${input.newTime}.` };
    }
    catch (err) {
        logger_1.logger.error('[CloneTools] rescheduleAppointment failed', { err: String(err) });
        return { success: false, requiresHuman: true, message: 'Impossible de déplacer. Un agent vous recontactera.' };
    }
});
// Find an employee/host by name — critical for kiosk reception use case
// ("Je viens voir Sara" → check if Sara exists + her department)
exports.cloneFindEmployeeTool = genkit_config_1.ai.defineTool({
    name: 'findEmployee',
    description: "Recherche un employé/collaborateur de l'entreprise par nom. À utiliser quand un visiteur demande à voir quelqu'un ou pour confirmer qu'une personne travaille bien ici.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        name: zod_1.z.string().describe("Nom de la personne recherchée (prénom, nom, ou partiel)"),
    }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(),
        matches: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            email: zod_1.z.string().optional(),
            department: zod_1.z.string().optional(),
            role: zod_1.z.string().optional(),
            jobTitle: zod_1.z.string().optional(),
        })),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, name }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const q = name.toLowerCase().trim();
    // Search 3 sources in parallel
    const [empSnap, userSnap, memberSnap] = await Promise.all([
        db.collection(`companies/${companyId}/employees`).limit(500).get().catch(() => null),
        db.collection('users').where('companyId', '==', companyId).limit(500).get().catch(() => null),
        db.collection(`companies/${companyId}/members`).limit(500).get().catch(() => null),
    ]);
    const all = [];
    const push = (d) => {
        const nm = (d['displayName'] ?? d['name'] ?? d['email']) ?? '';
        if (!nm)
            return;
        all.push({
            name: nm,
            email: d['email'],
            department: d['department'],
            role: d['role'],
            jobTitle: d['jobTitle'],
        });
    };
    empSnap?.docs.forEach(d => push(d.data()));
    userSnap?.docs.forEach(d => push(d.data()));
    memberSnap?.docs.forEach(d => push(d.data()));
    // Dedup by email/name
    const seen = new Set();
    const unique = all.filter(p => {
        const key = (p.email ?? p.name).toLowerCase();
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    // Fuzzy match: check if query is substring of any name or email
    const matches = unique.filter(p => p.name.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q));
    return {
        found: matches.length > 0,
        matches: matches.slice(0, 5),
        message: matches.length === 0
            ? `Aucun employé trouvé avec "${name}". Vérifiez l'orthographe.`
            : matches.length === 1
                ? `Trouvé : ${matches[0].name}${matches[0].jobTitle ? ` (${matches[0].jobTitle})` : ''}${matches[0].department ? ` — ${matches[0].department}` : ''}`
                : `${matches.length} personnes correspondent : ${matches.slice(0, 3).map(m => m.name).join(', ')}`,
    };
});
async function resolveHostByName(companyId, hostName) {
    const db = (0, firebase_config_1.getFirestore)();
    const [empSnap, userSnap, memberSnap] = await Promise.all([
        db.collection(`companies/${companyId}/employees`).limit(500).get().catch(() => null),
        db.collection('users').where('companyId', '==', companyId).limit(500).get().catch(() => null),
        db.collection(`companies/${companyId}/members`).limit(500).get().catch(() => null),
    ]);
    const all = [];
    const push = (id, d) => {
        const nm = (d['displayName'] ?? d['name'] ?? d['email']) ?? '';
        if (!nm)
            return;
        all.push({
            id, name: nm,
            email: d['email'],
            phone: d['phone'],
            notificationChannels: d['notificationChannels'],
        });
    };
    empSnap?.docs.forEach(d => push(d.id, d.data()));
    userSnap?.docs.forEach(d => push(d.id, d.data()));
    memberSnap?.docs.forEach(d => push(d.id, d.data()));
    const q = hostName.toLowerCase();
    return all.find(p => p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)) ?? null;
}
// Check if an employee is present today
async function checkHostPresence(companyId, hostId) {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const today = new Date().toISOString().slice(0, 10);
        const snap = await db.collection('presence')
            .where('companyId', '==', companyId)
            .where('employeeId', '==', hostId)
            .where('date', '==', today)
            .limit(1).get();
        if (snap.empty)
            return { present: false, status: 'absent' };
        const data = snap.docs[0].data();
        const checkedIn = (data['checkedInAt'] ?? data['checkInTime']);
        const checkedOut = (data['checkedOutAt'] ?? data['checkOutTime']);
        return {
            present: Boolean(checkedIn) && !checkedOut,
            checkedInAt: checkedIn,
            status: checkedOut ? 'left' : checkedIn ? 'present' : 'absent',
        };
    }
    catch {
        return { present: false, status: 'unknown' };
    }
}
// notifyHost — full multi-channel notification with presence check and reply link
exports.cloneNotifyHostTool = genkit_config_1.ai.defineTool({
    name: 'notifyHost',
    description: "APPELLE TOUJOURS quand un visiteur veut voir un employé, MÊME si l'employé est absent. Le tool envoie la notification sur tous les canaux configurés (email, WhatsApp, Telegram, dashboard) — les canaux mobiles (WhatsApp/Telegram) atteignent l'employé même hors du bureau. N'assume JAMAIS que c'est inutile parce que la personne est absente. Toujours notifier.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        hostName: zod_1.z.string().describe("Nom de l'employé à prévenir"),
        visitorName: zod_1.z.string(),
        visitorContact: zod_1.z.string().optional(),
        reason: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        hostPresent: zod_1.z.boolean(),
        hostStatus: zod_1.z.string().optional(),
        notifiedBy: zod_1.z.array(zod_1.z.string()),
        message: zod_1.z.string(),
        notificationId: zod_1.z.string().optional().describe("ID to poll for the host's reply"),
    }),
}, async (input) => {
    const host = await resolveHostByName(input.companyId, input.hostName);
    if (!host) {
        return {
            success: false, hostPresent: false, notifiedBy: [],
            message: `Impossible de prévenir ${input.hostName} : personne introuvable dans l'entreprise.`,
        };
    }
    // 1. Presence check
    const presence = await checkHostPresence(input.companyId, host.id);
    const presenceLabel = presence.status === 'present' ? 'au bureau'
        : presence.status === 'left' ? 'déjà parti(e)'
            : presence.status === 'absent' ? 'absent(e) aujourd\'hui' : 'statut inconnu';
    // 2. Build reply token for employee actions
    const db = (0, firebase_config_1.getFirestore)();
    const notifId = (0, helpers_1.generateId)();
    const replyToken = `${(0, helpers_1.generateId)()}${(0, helpers_1.generateId)()}`; // ~48 chars
    const replyBaseUrl = process.env['APP_PUBLIC_URL'] ?? 'https://mon-assistant-86bbd.web.app';
    const replyLinks = {
        accept: `${replyBaseUrl}/host-reply/${replyToken}?action=accept`,
        wait: `${replyBaseUrl}/host-reply/${replyToken}?action=wait`,
        reject: `${replyBaseUrl}/host-reply/${replyToken}?action=reject`,
    };
    // 3. Create hostNotifications doc (always — dashboard channel)
    await db.collection(`companies/${input.companyId}/hostNotifications`).doc(notifId).set({
        id: notifId,
        hostId: host.id,
        hostName: host.name,
        hostEmail: host.email ?? null,
        visitorName: input.visitorName,
        visitorContact: input.visitorContact ?? null,
        reason: input.reason ?? 'Visite à l\'accueil',
        status: 'pending',
        replyToken,
        hostPresent: presence.present,
        hostPresenceStatus: presence.status,
        source: 'clone:voice',
        createdAt: new Date(),
    }).catch(err => logger_1.logger.warn('[notifyHost] dashboard write failed', { err: String(err) }));
    // 4. Determine channels based on host preferences (default: email only)
    const prefs = host.notificationChannels ?? { email: true, dashboard: true };
    const notifiedBy = ['dashboard'];
    const bodyLines = [
        `${input.visitorName} est à l'accueil et souhaite vous voir.`,
        input.reason ? `Motif : ${input.reason}` : null,
        input.visitorContact ? `Contact : ${input.visitorContact}` : null,
        `Que souhaitez-vous faire ?`,
    ].filter(Boolean);
    const plainText = `🔔 ${bodyLines.join('\n')}\n\n✅ J'arrive : ${replyLinks.accept}\n⏳ Faites-le patienter : ${replyLinks.wait}\n❌ Pas disponible : ${replyLinks.reject}`;
    // Email
    if (prefs.email !== false && host.email) {
        try {
            const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../../services/email/emailService')));
            const html = `<p>Bonjour ${host.name},</p>
<p><strong>${input.visitorName}</strong> est à l'accueil et souhaite vous voir.</p>
${input.reason ? `<p>Motif : ${input.reason}</p>` : ''}
${input.visitorContact ? `<p>Contact visiteur : ${input.visitorContact}</p>` : ''}
<p>Réponse rapide :</p>
<p>
  <a href="${replyLinks.accept}" style="display:inline-block;padding:10px 16px;margin:4px;background:#16a34a;color:white;border-radius:8px;text-decoration:none">✅ J'arrive</a>
  <a href="${replyLinks.wait}" style="display:inline-block;padding:10px 16px;margin:4px;background:#eab308;color:white;border-radius:8px;text-decoration:none">⏳ Faites patienter</a>
  <a href="${replyLinks.reject}" style="display:inline-block;padding:10px 16px;margin:4px;background:#dc2626;color:white;border-radius:8px;text-decoration:none">❌ Pas dispo</a>
</p>`;
            await sendEmail({
                to: host.email, subject: `Visiteur à l'accueil : ${input.visitorName}`, html,
                companyId: input.companyId, tags: [{ name: 'type', value: 'host-notification' }],
            });
            notifiedBy.push('email');
        }
        catch (err) {
            logger_1.logger.warn('[notifyHost] email failed', { err: String(err) });
        }
    }
    // WhatsApp
    if (prefs.whatsapp?.enabled && prefs.whatsapp.phone) {
        try {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../../services/whatsapp/whatsappService')));
            const config = await whatsappService.getConfig(input.companyId);
            if (config) {
                await whatsappService.sendMessage(config, prefs.whatsapp.phone, plainText);
                notifiedBy.push('whatsapp');
            }
        }
        catch (err) {
            logger_1.logger.warn('[notifyHost] whatsapp failed', { err: String(err) });
        }
    }
    // Telegram
    if (prefs.telegram?.enabled && prefs.telegram.chatId) {
        try {
            const { sendTelegramMessage } = await Promise.resolve().then(() => __importStar(require('../../services/telegram/telegramService')));
            await sendTelegramMessage(input.companyId, prefs.telegram.chatId, plainText);
            notifiedBy.push('telegram');
        }
        catch (err) {
            logger_1.logger.warn('[notifyHost] telegram failed', { err: String(err) });
        }
    }
    // Bell notification — shows up in header bell + real-time via Socket.io
    try {
        const { createNotification } = await Promise.resolve().then(() => __importStar(require('../../services/notificationService')));
        await createNotification({
            companyId: input.companyId,
            userId: host.id,
            type: 'visitor_arrived',
            title: `${input.visitorName} vous attend à l'accueil`,
            message: input.reason
                ? `Motif : ${input.reason}${input.visitorContact ? ` · Contact : ${input.visitorContact}` : ''}`
                : 'Cliquez pour voir et répondre (J\'arrive / Patience / Pas dispo)',
            icon: 'UserCheck',
            severity: 'warning',
            actionUrl: '/hr',
            metadata: { notificationId: notifId, replyToken, visitorName: input.visitorName },
        });
    }
    catch (err) {
        logger_1.logger.warn('[notifyHost] bell notification failed', { err: String(err) });
    }
    await audit(input.companyId, 'notifyHost', {
        hostName: host.name, visitorName: input.visitorName, notifiedBy,
        hostPresent: presence.present, hostStatus: presence.status,
    });
    const presenceWarning = presence.status === 'absent' || presence.status === 'left'
        ? ` ⚠️ ${host.name} est ${presenceLabel} — l'alerte est quand même envoyée.`
        : '';
    return {
        success: true,
        hostPresent: presence.present,
        hostStatus: presence.status,
        notifiedBy,
        message: `${host.name} (${presenceLabel}) a été prévenu(e) via ${notifiedBy.join(' + ')}.${presenceWarning}`,
        notificationId: notifId,
    };
});
// Standalone presence check — AI can call before notifyHost or independently
exports.cloneCheckEmployeePresenceTool = genkit_config_1.ai.defineTool({
    name: 'checkEmployeePresence',
    description: "Vérifie si un employé est au bureau aujourd'hui (présent, parti, absent). À appeler quand un visiteur demande 'Est-ce que [Nom] est là ?' avant de le notifier.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeName: zod_1.z.string(),
    }),
    outputSchema: zod_1.z.object({
        found: zod_1.z.boolean(),
        present: zod_1.z.boolean(),
        status: zod_1.z.string(),
        checkedInAt: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async (input) => {
    const host = await resolveHostByName(input.companyId, input.employeeName);
    if (!host) {
        return { found: false, present: false, status: 'not_found', message: `Aucun employé trouvé avec "${input.employeeName}".` };
    }
    const presence = await checkHostPresence(input.companyId, host.id);
    const label = presence.status === 'present' ? `${host.name} est au bureau`
        : presence.status === 'left' ? `${host.name} est déjà parti(e)`
            : presence.status === 'absent' ? `${host.name} n'a pas pointé aujourd'hui`
                : `Statut inconnu pour ${host.name}`;
    return {
        found: true,
        present: presence.present,
        status: presence.status ?? 'unknown',
        checkedInAt: presence.checkedInAt,
        message: label,
    };
});
exports.CLONE_SAFE_TOOLS = [
    exports.cloneFindAppointmentTool,
    exports.cloneCreateAppointmentTool,
    exports.cloneConfirmAppointmentTool,
    exports.cloneRescheduleAppointmentTool,
    exports.cloneAddClientTool,
    exports.cloneFindEmployeeTool,
    exports.cloneNotifyHostTool,
    exports.cloneCheckEmployeePresenceTool,
    exports.cloneCreateSupportTicketTool,
    exports.cloneSendEmailTool,
    exports.cloneExtractInvoiceTool,
    ...reservationTools_1.CLONE_RESERVATION_TOOLS,
    ...salesTools_1.CLONE_SALES_TOOLS,
    ...commerceTools_1.CLONE_COMMERCE_TOOLS,
];
exports.CLONE_SAFE_TOOL_NAMES = [
    'findAppointment', 'createAppointment', 'confirmAppointment', 'rescheduleAppointment', 'addClient', 'findEmployee', 'notifyHost', 'checkEmployeePresence', 'createSupportTicket', 'sendEmail',
    'extractInvoiceData',
    ...reservationTools_1.CLONE_RESERVATION_TOOL_NAMES,
    ...salesTools_1.CLONE_SALES_TOOL_NAMES,
    ...commerceTools_1.CLONE_COMMERCE_TOOL_NAMES,
];
//# sourceMappingURL=cloneTools.js.map