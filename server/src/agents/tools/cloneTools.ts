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
import { z } from 'zod';
import { ai } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';

async function audit(companyId: string, action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await getFirestore().collection(`companies/${companyId}/cloneAuditLog`).add({
      action, details, createdAt: new Date(),
    });
  } catch { /* non-critical */ }
}

// ── Validation helpers ───────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizePhone(p: string | undefined): string {
  if (!p) return '';
  return p.replace(/[^0-9+]/g, '');
}

function normalizeEmail(e: string | undefined): string {
  return (e ?? '').toLowerCase().trim();
}

/** Convert `date + time + timezone` to a UTC ISO string. Falls back to UTC if tz is invalid. */
function toUtcIso(date: string, time: string, timezone: string): string {
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
    const parts = dtf.formatToParts(asUtc).reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const reconstructed = new Date(Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour === '24' ? '00' : parts.hour), Number(parts.minute)
    ));
    const offsetMs = reconstructed.getTime() - asUtc.getTime();
    const utc = new Date(asUtc.getTime() - offsetMs);
    return utc.toISOString();
  } catch {
    // Fallback — treat as UTC
    return `${date}T${time}:00Z`;
  }
}

export type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type DayHours = { open: string; close: string; closed?: boolean };
export type BusinessHours = Record<DayOfWeek, DayHours>;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: { open: '09:00', close: '18:00' }, tue: { open: '09:00', close: '18:00' },
  wed: { open: '09:00', close: '18:00' }, thu: { open: '09:00', close: '18:00' },
  fri: { open: '09:00', close: '18:00' }, sat: { open: '09:00', close: '13:00' },
  sun: { open: '09:00', close: '18:00', closed: true },
};

interface BookingPrefs {
  timezone: string;
  autoConfirm: boolean;
  businessHours: BusinessHours;
  slotDurationMinutes: number;
}

/** Load company preferences (timezone, auto-confirm, hours) with sensible defaults */
async function getCompanyBookingPrefs(companyId: string): Promise<BookingPrefs> {
  try {
    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId).get();
    const d = doc.data() ?? {};
    const settings = (d['settings'] as Record<string, unknown>) ?? {};
    const hours = (settings['businessHours'] as Partial<BusinessHours>) ?? {};
    const merged: BusinessHours = {
      ...DEFAULT_BUSINESS_HOURS,
      ...hours,
    } as BusinessHours;
    return {
      timezone: (settings['timezone'] as string) || (d['timezone'] as string) || 'Africa/Abidjan',
      autoConfirm: (settings['autoConfirmAppointments'] as boolean) === true,
      businessHours: merged,
      slotDurationMinutes: Math.max(5, Number(settings['slotDurationMinutes']) || 30),
    };
  } catch {
    return { timezone: 'Africa/Abidjan', autoConfirm: false, businessHours: DEFAULT_BUSINESS_HOURS, slotDurationMinutes: 30 };
  }
}

/**
 * Resolve which employee should be auto-assigned for a given service.
 * Returns { userId, displayName } or null.
 *
 * Matching is case-insensitive and handles partial matches
 * (e.g., service "Coupe homme express" matches mapping "coupe homme").
 */
async function resolveAutoAssignment(
  companyId: string,
  service: string | undefined,
): Promise<{ userId: string; displayName: string } | null> {
  if (!service?.trim()) return null;
  try {
    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId).get();
    const settings = (doc.data()?.['settings'] as Record<string, unknown>) ?? {};
    const mapping = (settings['serviceAssignments'] as Record<string, { userId: string; displayName: string }>) ?? {};

    const needle = service.toLowerCase().trim();
    // 1) Exact match
    if (mapping[needle]) return mapping[needle];
    // 2) Case-insensitive on keys
    for (const key of Object.keys(mapping)) {
      if (key.toLowerCase() === needle) return mapping[key];
    }
    // 3) Partial match — service contains mapping key or vice versa
    for (const key of Object.keys(mapping)) {
      const k = key.toLowerCase();
      if (needle.includes(k) || k.includes(needle)) return mapping[key];
    }
    return null;
  } catch { return null; }
}

/** Check if a time (HH:MM) is within a day's opening window (inclusive start, exclusive end). */
function isWithinHours(time: string, day: DayHours): boolean {
  if (day.closed) return false;
  return time >= day.open && time < day.close;
}

const WEEKDAY_KEYS: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function dayKeyForDate(date: string): DayOfWeek {
  const [y, m, d] = date.split('-').map(Number);
  const js = new Date(Date.UTC(y, (m ?? 1) - 1, d)).getUTCDay();
  return WEEKDAY_KEYS[js];
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ── findAppointment — check before creating or opening a ticket ──────────────
export const cloneFindAppointmentTool = ai.defineTool(
  {
    name: 'findAppointment',
    description: 'Search for an existing appointment by the client contact (phone or email) and optional date. ALWAYS call this first when a user asks about an appointment they think they made. Returns the appointment if found.',
    inputSchema: z.object({
      companyId: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      date: z.string().optional().describe('Optional YYYY-MM-DD to narrow down'),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      appointmentId: z.string().optional(),
      clientName: z.string().optional(),
      service: z.string().optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      status: z.string().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { found: false, message: 'Impossible de chercher sans numéro ou email.' };
    try {
      const db = getFirestore();
      const coll = db.collection(`companies/${input.companyId}/appointments`);
      let q: FirebaseFirestore.Query = phone ? coll.where('clientPhone', '==', phone) : coll.where('clientEmail', '==', email);
      if (input.date && DATE_REGEX.test(input.date)) q = q.where('date', '==', input.date);
      const snap = await q.orderBy('createdAt', 'desc').limit(1).get().catch(async () => {
        // If composite index missing, fall back without orderBy
        return await q.limit(5).get();
      });
      if (snap.empty) return { found: false, message: 'Aucun rendez-vous trouvé pour ce contact.' };
      const doc = snap.docs[0].data();
      return {
        found: true,
        appointmentId: snap.docs[0].id,
        clientName: doc['clientName'] as string,
        service:    doc['service']    as string,
        date:       doc['date']       as string,
        time:       doc['time']       as string,
        status:     doc['status']     as string,
        message: `Rendez-vous trouvé: ${doc['clientName']} le ${doc['date']} à ${doc['time']} (${doc['status']}).`,
      };
    } catch (err) {
      logger.error('[CloneTools] findAppointment failed', { err: String(err) });
      return { found: false, message: 'Erreur lors de la recherche.' };
    }
  }
);

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
export const cloneCreateAppointmentTool = ai.defineTool(
  {
    name: 'clone_createAppointment',
    description: 'Create an appointment. Only call after confirming: name, service, date (YYYY-MM-DD), time (HH:MM 24h), and at least one contact (phone OR email). Returns appointmentId on success. The status will be "pending" unless the company has auto-confirm enabled.',
    inputSchema: z.object({
      companyId: z.string(),
      clientName: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      service: z.string(),
      date: z.string().describe('YYYY-MM-DD'),
      time: z.string().describe('HH:MM in 24h format, e.g. 14:30'),
      notes: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      appointmentId: z.string().optional(),
      status: z.string().optional(),
      alreadyExisted: z.boolean().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    // ── 1. Validation ─────────────────────────────────────────────────────
    if (!input.clientName?.trim()) return { success: false, message: 'Nom du client requis.' };
    if (!input.clientPhone && !input.clientEmail) return { success: false, message: 'Au moins un moyen de contact requis (téléphone ou email).' };
    if (!DATE_REGEX.test(input.date)) return { success: false, message: `Date invalide (attendu: YYYY-MM-DD, reçu: "${input.date}").` };
    if (!TIME_REGEX.test(input.time)) return { success: false, message: `Heure invalide (attendu: HH:MM, reçu: "${input.time}").` };

    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);

    try {
      const db = getFirestore();
      const coll = db.collection(`companies/${input.companyId}/appointments`);

      // ── 2. Logical dedup — same contact + date + time = reuse ──────────
      const contactField = phone ? 'clientPhone' : 'clientEmail';
      const contactVal   = phone || email;
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
            status: (existing['status'] as string) ?? 'pending',
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
          status: (existing['status'] as string) ?? 'pending',
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
          const s = (data['status'] as string) ?? 'pending';
          if (s === 'rejected' || s === 'cancelled') continue;
          const existingStart = (data['time'] as string) ?? '';
          if (!existingStart) continue;
          const existingEnd = addMinutes(existingStart, prefs.slotDurationMinutes);
          if (timesOverlap(input.time, slotEnd, existingStart, existingEnd)) {
            return { success: false, message: `Ce créneau (${input.time}) n'est plus disponible. Essayez un autre horaire.` };
          }
        }
      } catch { /* non-critical — fall through to creation */ }

      // ── 5. Auto-assignment based on service → employee mapping ─────────
      const assignment = await resolveAutoAssignment(input.companyId, input.service);

      // ── 6. Create ──────────────────────────────────────────────────────
      const id = generateId();
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
            const { sendEmail: sendMail } = await import('../../services/email/emailService');
            const { buildMagicLink } = await import('../../utils/magicToken');
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
          } catch (err) { logger.warn('[CloneTools] auto email failed', { err: String(err) }); }
        })().catch(() => { /* swallow */ });
      }

      // In-app notification — company-wide + assigned employee if any
      (async () => {
        try {
          const { createNotification } = await import('../../services/notificationService');
          const baseNotif = {
            companyId: input.companyId,
            type: 'appointment_created' as const,
            title: status === 'confirmed' ? 'Nouveau RDV confirmé' : 'Nouveau RDV en attente',
            message: `${input.clientName} — ${input.date} à ${input.time}${input.service ? ` (${input.service})` : ''}${assignment ? ` → ${assignment.displayName}` : ''}`,
            actionUrl: '/admin/appointments',
            icon: 'Calendar',
            severity: (status === 'confirmed' ? 'info' : 'warning') as 'info' | 'warning',
            metadata: { appointmentId: id, source: input.sourceChannel ?? 'unknown', assignedTo: assignment?.userId ?? null },
          };
          await createNotification(baseNotif);
          if (assignment?.userId) {
            await createNotification({ ...baseNotif, userId: assignment.userId, actionUrl: '/calendar' });
          }
        } catch (err) { logger.warn('[CloneTools] auto notification failed', { err: String(err) }); }
      })().catch(() => { /* swallow */ });

      return {
        success: true,
        appointmentId: id,
        status,
        alreadyExisted: false,
        message: status === 'confirmed'
          ? `Rendez-vous confirmé pour ${input.clientName} le ${input.date} à ${input.time} (${prefs.timezone}).`
          : `Demande enregistrée pour ${input.clientName} le ${input.date} à ${input.time} (${prefs.timezone}). Vous serez contacté pour validation.`,
      };
    } catch (err) {
      logger.error('[CloneTools] createAppointment failed', { err: String(err) });
      return { success: false, message: `Impossible d'enregistrer le rendez-vous. Un humain vous recontactera.` };
    }
  }
);

// ── confirmAppointment — identity-gated status update ───────────────────────
//
// Rules:
//   - Must be called with an appointmentId AND a proof of identity (phone OR email)
//   - The proof MUST match the appointment record, otherwise the tool refuses
//   - Only `pending` appointments can be self-confirmed by the client
//   - Confirmed/Rejected/Cancelled states are final — the Clone must tell the client to call
//   - Every action is audit-logged
//
export const cloneConfirmAppointmentTool = ai.defineTool(
  {
    name: 'confirmAppointment',
    description: 'Confirm an existing PENDING appointment ONLY when the client has provided a proof of identity (phone or email) that matches the record. Call this after findAppointment returned a pending appointment and the same client is asking for confirmation. Never claim confirmation without calling this tool. If identity does not match, you MUST tell the client a human will recontact them.',
    inputSchema: z.object({
      companyId: z.string(),
      appointmentId: z.string(),
      clientPhone: z.string().optional().describe('Identity proof — phone number the client provided in this conversation'),
      clientEmail: z.string().optional().describe('Identity proof — email the client provided in this conversation'),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      status: z.string().optional(),
      message: z.string(),
      requiresHuman: z.boolean().optional(),
    }),
  },
  async (input) => {
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
      const db = getFirestore();
      const ref = db.collection(`companies/${input.companyId}/appointments`).doc(input.appointmentId);
      const doc = await ref.get();
      if (!doc.exists) return { success: false, message: 'Rendez-vous introuvable.' };
      const data = doc.data() ?? {};

      // Identity check — strict equality on normalized values
      const storedPhone = normalizePhone((data['clientPhone'] as string) ?? '');
      const storedEmail = normalizeEmail((data['clientEmail'] as string) ?? '');
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

      const currentStatus = (data['status'] as string) ?? 'pending';
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
    } catch (err) {
      logger.error('[CloneTools] confirmAppointment failed', { err: String(err) });
      return { success: false, requiresHuman: true, message: "Impossible de confirmer maintenant. Un agent vous recontactera." };
    }
  }
);

// ── addClient / createLead (with dedup by phone/email) ──────────────────────
export const cloneAddClientTool = ai.defineTool(
  {
    name: 'clone_addClient',
    description: 'Register a new client/lead in the CRM. Call when you have captured at least the name and one contact (phone or email). If the contact already exists, returns the existing clientId without creating a duplicate.',
    inputSchema: z.object({
      companyId: z.string(),
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(), clientId: z.string().optional(), alreadyExisted: z.boolean().optional(), message: z.string(),
    }),
  },
  async (input) => {
    if (!input.name?.trim()) return { success: false, message: 'Nom requis.' };
    const phone = normalizePhone(input.phone);
    const email = normalizeEmail(input.email);
    if (!phone && !email) return { success: false, message: 'Téléphone ou email requis.' };

    try {
      const db = getFirestore();
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

      const id = generateId();
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
    } catch (err) {
      logger.error('[CloneTools] addClient failed', { err: String(err) });
      return { success: false, message: `Impossible d'enregistrer le contact.` };
    }
  }
);

// ── createSupportTicket (pending) ─────────────────────────────────────────────
export const cloneCreateSupportTicketTool = ai.defineTool(
  {
    name: 'createSupportTicket',
    description: 'Create a pending support ticket when a visitor reports a problem. Include what they reported and urgency.',
    inputSchema: z.object({
      companyId: z.string(),
      subject: z.string(),
      description: z.string(),
      clientName: z.string().optional(),
      clientContact: z.string().optional().describe('phone or email'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), ticketId: z.string().optional(), message: z.string() }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      const id = generateId();
      await db.collection(`companies/${input.companyId}/supportTickets`).doc(id).set({
        id, subject: input.subject, description: input.description,
        clientName: input.clientName ?? 'Anonyme',
        clientContact: input.clientContact ?? '',
        priority: input.priority ?? 'medium',
        status: 'pending',                                    // ← key difference
        source: `clone:${input.sourceChannel ?? 'unknown'}`,
        createdBy: 'clone',
        createdAt: new Date(),
      });
      await audit(input.companyId, 'createSupportTicket', { ticketId: id, subject: input.subject });
      return { success: true, ticketId: id, message: `Ticket cree: ${input.subject}` };
    } catch (err) {
      logger.error('[CloneTools] createSupportTicket failed', { err: String(err) });
      return { success: false, message: `Impossible de creer le ticket: ${String(err)}` };
    }
  }
);

// ── sendEmail (reuses the orchestrator's unified service — Gmail-first) ──────
// IMPORTANT: tool name must NOT collide with `sendEmail` from externalTools.ts.
// When two tools share the same name, the second registration silently replaces
// the first in Genkit's global registry, breaking the orchestrator's
// `sendEmailTool` lookup ("NOT_FOUND: Tool sendEmail not found").
export const cloneSendEmailTool = ai.defineTool(
  {
    name: 'clone_sendEmail',
    description: 'Send a confirmation or follow-up email to a visitor after capturing their email. Use for appointment confirmations or sending info. Be polite and concise.',
    inputSchema: z.object({
      companyId: z.string(),
      to: z.string(),
      subject: z.string(),
      body: z.string(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string(), requiresHuman: z.boolean().optional() }),
  },
  async (input) => {
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
      const { sendEmail } = await import('../../services/email/emailService');
      const html = input.body.includes('<') ? input.body : `<p>${input.body.replace(/\n/g, '<br>')}</p>`;
      const result = await sendEmail({
        to: input.to, subject: input.subject, html,
        companyId: input.companyId,
        tags: [{ name: 'type', value: 'clone-outbound' }],
      });
      await audit(input.companyId, 'sendEmail', { to: input.to, subject: input.subject, provider: result.provider });
      return { success: true, message: `Email envoye a ${input.to} (via ${result.provider})` };
    } catch (err) {
      logger.error('[CloneTools] sendEmail failed', { err: String(err) });
      return { success: false, message: `Echec envoi email: ${String(err)}` };
    }
  }
);

import { CLONE_RESERVATION_TOOLS, CLONE_RESERVATION_TOOL_NAMES } from './reservationTools';
import { CLONE_SALES_TOOLS, CLONE_SALES_TOOL_NAMES } from './salesTools';
import { CLONE_COMMERCE_TOOLS, CLONE_COMMERCE_TOOL_NAMES } from './commerceTools';

// ── extractInvoiceData — Azure Document Intelligence ────────────────────────
export const cloneExtractInvoiceTool = ai.defineTool(
  {
    name: 'extractInvoiceData',
    description: "Extract structured data (vendor, total, items, dates) from an invoice image/PDF URL using Azure Document Intelligence. Use when the user sends a photo of an invoice.",
    inputSchema: z.object({
      companyId: z.string(),
      documentUrl: z.string().describe('Public URL of the invoice image or PDF'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      vendor: z.string().optional(),
      invoiceId: z.string().optional(),
      invoiceDate: z.string().optional(),
      dueDate: z.string().optional(),
      total: z.number().optional(),
      subtotal: z.number().optional(),
      tax: z.number().optional(),
      currency: z.string().optional(),
      itemsCount: z.number().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    try {
      const { analyzeInvoice } = await import('../../services/azure/azureService');
      const result = await analyzeInvoice(input.companyId, input.documentUrl);
      await audit(input.companyId, 'extractInvoiceData', { success: result.success, total: result.data?.total, vendor: result.data?.vendor });
      if (!result.success) return { success: false, message: result.message };
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
    } catch (err) {
      logger.error('[CloneTools] extractInvoiceData failed', { err: String(err) });
      return { success: false, message: "Impossible d'analyser le document." };
    }
  }
);

// ── rescheduleAppointment (identity-gated, voice-allowed) ───────────────────
export const cloneRescheduleAppointmentTool = ai.defineTool(
  {
    name: 'rescheduleAppointment',
    description: 'Reschedule an existing appointment to a new date/time. Requires identity proof (phone or email matching the record). Works on all channels including voice.',
    inputSchema: z.object({
      companyId: z.string(),
      appointmentId: z.string(),
      newDate: z.string().describe('YYYY-MM-DD'),
      newTime: z.string().describe('HH:MM 24h'),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(), message: z.string(), requiresHuman: z.boolean().optional(),
    }),
  },
  async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { success: false, requiresHuman: true, message: "Téléphone ou email requis pour vérifier." };
    if (!DATE_REGEX.test(input.newDate)) return { success: false, message: 'Nouvelle date invalide (YYYY-MM-DD).' };
    if (!TIME_REGEX.test(input.newTime)) return { success: false, message: 'Nouvelle heure invalide (HH:MM).' };
    try {
      const db = getFirestore();
      const ref = db.collection(`companies/${input.companyId}/appointments`).doc(input.appointmentId);
      const doc = await ref.get();
      if (!doc.exists) return { success: false, message: 'Rendez-vous introuvable.' };
      const data = doc.data() ?? {};
      const storedPhone = normalizePhone((data['clientPhone'] as string) ?? '');
      const storedEmail = normalizeEmail((data['clientEmail'] as string) ?? '');
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
    } catch (err) {
      logger.error('[CloneTools] rescheduleAppointment failed', { err: String(err) });
      return { success: false, requiresHuman: true, message: 'Impossible de déplacer. Un agent vous recontactera.' };
    }
  }
);

// Find an employee/host by name — critical for kiosk reception use case
// ("Je viens voir Sara" → check if Sara exists + her department)
export const cloneFindEmployeeTool = ai.defineTool(
  {
    name: 'findEmployee',
    description: "Recherche un employé/collaborateur de l'entreprise par nom. À utiliser quand un visiteur demande à voir quelqu'un ou pour confirmer qu'une personne travaille bien ici.",
    inputSchema: z.object({
      companyId: z.string(),
      name: z.string().describe("Nom de la personne recherchée (prénom, nom, ou partiel)"),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      matches: z.array(z.object({
        name: z.string(),
        email: z.string().optional(),
        department: z.string().optional(),
        role: z.string().optional(),
        jobTitle: z.string().optional(),
      })),
      message: z.string(),
    }),
  },
  async ({ companyId, name }) => {
    const db = getFirestore();
    const q = name.toLowerCase().trim();
    // Search 3 sources in parallel
    const [empSnap, userSnap, memberSnap] = await Promise.all([
      db.collection(`companies/${companyId}/employees`).limit(500).get().catch(() => null),
      db.collection('users').where('companyId', '==', companyId).limit(500).get().catch(() => null),
      db.collection(`companies/${companyId}/members`).limit(500).get().catch(() => null),
    ]);
    const all: Array<{ name: string; email?: string; department?: string; role?: string; jobTitle?: string }> = [];
    const push = (d: Record<string, unknown>) => {
      const nm = ((d['displayName'] ?? d['name'] ?? d['email']) as string | undefined) ?? '';
      if (!nm) return;
      all.push({
        name: nm,
        email: d['email'] as string | undefined,
        department: d['department'] as string | undefined,
        role: d['role'] as string | undefined,
        jobTitle: d['jobTitle'] as string | undefined,
      });
    };
    empSnap?.docs.forEach(d => push(d.data()));
    userSnap?.docs.forEach(d => push(d.data()));
    memberSnap?.docs.forEach(d => push(d.data()));
    // Dedup by email/name
    const seen = new Set<string>();
    const unique = all.filter(p => {
      const key = (p.email ?? p.name).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Fuzzy match: check if query is substring of any name or email
    const matches = unique.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q),
    );
    return {
      found: matches.length > 0,
      matches: matches.slice(0, 5),
      message: matches.length === 0
        ? `Aucun employé trouvé avec "${name}". Vérifiez l'orthographe.`
        : matches.length === 1
          ? `Trouvé : ${matches[0].name}${matches[0].jobTitle ? ` (${matches[0].jobTitle})` : ''}${matches[0].department ? ` — ${matches[0].department}` : ''}`
          : `${matches.length} personnes correspondent : ${matches.slice(0, 3).map(m => m.name).join(', ')}`,
    };
  },
);

// Shared helper — resolves an employee by name across 3 collections
interface ResolvedHost {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notificationChannels?: {
    email?: boolean;
    whatsapp?: { enabled: boolean; phone?: string };
    telegram?: { enabled: boolean; chatId?: string };
    dashboard?: boolean;
  };
}

async function resolveHostByName(companyId: string, hostName: string): Promise<ResolvedHost | null> {
  const db = getFirestore();
  const [empSnap, userSnap, memberSnap] = await Promise.all([
    db.collection(`companies/${companyId}/employees`).limit(500).get().catch(() => null),
    db.collection('users').where('companyId', '==', companyId).limit(500).get().catch(() => null),
    db.collection(`companies/${companyId}/members`).limit(500).get().catch(() => null),
  ]);
  const all: ResolvedHost[] = [];
  const push = (id: string, d: Record<string, unknown>) => {
    const nm = ((d['displayName'] ?? d['name'] ?? d['email']) as string | undefined) ?? '';
    if (!nm) return;
    all.push({
      id, name: nm,
      email: d['email'] as string | undefined,
      phone: d['phone'] as string | undefined,
      notificationChannels: d['notificationChannels'] as ResolvedHost['notificationChannels'],
    });
  };
  empSnap?.docs.forEach(d => push(d.id, d.data()));
  userSnap?.docs.forEach(d => push(d.id, d.data()));
  memberSnap?.docs.forEach(d => push(d.id, d.data()));
  const q = hostName.toLowerCase();
  return all.find(p => p.name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)) ?? null;
}

// Check if an employee is present today
async function checkHostPresence(companyId: string, hostId: string): Promise<{ present: boolean; checkedInAt?: string; status?: string }> {
  try {
    const db = getFirestore();
    const today = new Date().toISOString().slice(0, 10);
    const snap = await db.collection('presence')
      .where('companyId', '==', companyId)
      .where('employeeId', '==', hostId)
      .where('date', '==', today)
      .limit(1).get();
    if (snap.empty) return { present: false, status: 'absent' };
    const data = snap.docs[0].data();
    const checkedIn = (data['checkedInAt'] ?? data['checkInTime']) as string | undefined;
    const checkedOut = (data['checkedOutAt'] ?? data['checkOutTime']) as string | undefined;
    return {
      present: Boolean(checkedIn) && !checkedOut,
      checkedInAt: checkedIn,
      status: checkedOut ? 'left' : checkedIn ? 'present' : 'absent',
    };
  } catch {
    return { present: false, status: 'unknown' };
  }
}

// notifyHost — full multi-channel notification with presence check and reply link
export const cloneNotifyHostTool = ai.defineTool(
  {
    name: 'notifyHost',
    description: "APPELLE TOUJOURS quand un visiteur veut voir un employé, MÊME si l'employé est absent. Le tool envoie la notification sur tous les canaux configurés (email, WhatsApp, Telegram, dashboard) — les canaux mobiles (WhatsApp/Telegram) atteignent l'employé même hors du bureau. N'assume JAMAIS que c'est inutile parce que la personne est absente. Toujours notifier.",
    inputSchema: z.object({
      companyId: z.string(),
      hostName: z.string().describe("Nom de l'employé à prévenir"),
      visitorName: z.string(),
      visitorContact: z.string().optional(),
      reason: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      hostPresent: z.boolean(),
      hostStatus: z.string().optional(),
      notifiedBy: z.array(z.string()),
      message: z.string(),
      notificationId: z.string().optional().describe("ID to poll for the host's reply"),
    }),
  },
  async (input) => {
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
    const db = getFirestore();
    const notifId = generateId();
    const replyToken = `${generateId()}${generateId()}`; // ~48 chars
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
    }).catch(err => logger.warn('[notifyHost] dashboard write failed', { err: String(err) }));

    // 4. Determine channels based on host preferences (default: email only)
    const prefs = host.notificationChannels ?? { email: true, dashboard: true };
    const notifiedBy: string[] = ['dashboard'];

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
        const { sendEmail } = await import('../../services/email/emailService');
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
      } catch (err) { logger.warn('[notifyHost] email failed', { err: String(err) }); }
    }

    // WhatsApp
    if (prefs.whatsapp?.enabled && prefs.whatsapp.phone) {
      try {
        const { whatsappService } = await import('../../services/whatsapp/whatsappService');
        const config = await whatsappService.getConfig(input.companyId);
        if (config) {
          await whatsappService.sendMessage(config, prefs.whatsapp.phone, plainText);
          notifiedBy.push('whatsapp');
        }
      } catch (err) { logger.warn('[notifyHost] whatsapp failed', { err: String(err) }); }
    }

    // Telegram
    if (prefs.telegram?.enabled && prefs.telegram.chatId) {
      try {
        const { sendTelegramMessage } = await import('../../services/telegram/telegramService');
        await sendTelegramMessage(input.companyId, prefs.telegram.chatId, plainText);
        notifiedBy.push('telegram');
      } catch (err) { logger.warn('[notifyHost] telegram failed', { err: String(err) }); }
    }

    // Bell notification — shows up in header bell + real-time via Socket.io
    try {
      const { createNotification } = await import('../../services/notificationService');
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
    } catch (err) { logger.warn('[notifyHost] bell notification failed', { err: String(err) }); }

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
  },
);

// Standalone presence check — AI can call before notifyHost or independently
export const cloneCheckEmployeePresenceTool = ai.defineTool(
  {
    name: 'checkEmployeePresence',
    description: "Vérifie si un employé est au bureau aujourd'hui (présent, parti, absent). À appeler quand un visiteur demande 'Est-ce que [Nom] est là ?' avant de le notifier.",
    inputSchema: z.object({
      companyId: z.string(),
      employeeName: z.string(),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      present: z.boolean(),
      status: z.string(),
      checkedInAt: z.string().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
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
  },
);

export const CLONE_SAFE_TOOLS = [
  cloneFindAppointmentTool,
  cloneCreateAppointmentTool,
  cloneConfirmAppointmentTool,
  cloneRescheduleAppointmentTool,
  cloneAddClientTool,
  cloneFindEmployeeTool,
  cloneNotifyHostTool,
  cloneCheckEmployeePresenceTool,
  cloneCreateSupportTicketTool,
  cloneSendEmailTool,
  cloneExtractInvoiceTool,
  ...CLONE_RESERVATION_TOOLS,
  ...CLONE_SALES_TOOLS,
  ...CLONE_COMMERCE_TOOLS,
];

export const CLONE_SAFE_TOOL_NAMES = [
  'findAppointment', 'createAppointment', 'confirmAppointment', 'rescheduleAppointment', 'addClient', 'findEmployee', 'notifyHost', 'checkEmployeePresence', 'createSupportTicket', 'sendEmail',
  'extractInvoiceData',
  ...CLONE_RESERVATION_TOOL_NAMES,
  ...CLONE_SALES_TOOL_NAMES,
  ...CLONE_COMMERCE_TOOL_NAMES,
];
