/**
 * Clone-safe Reservation tools.
 *
 * Covers: table (restaurant), room (hotel), hall (event space), vehicle, generic resource.
 * Uses the same safeguards as appointment tools:
 *   - Validation (date, time, phone/email)
 *   - Technical idempotency
 *   - Logical dedup (same contact + resource + date/time)
 *   - Auto-confirm toggle
 *   - Audit trail in cloneAuditLog
 *   - Voice-gated confirm (sourceChannel='voice' refuses confirmReservation)
 *
 * Data model:
 *   companies/{id}/resources/{resId}      — { id, name, type, capacity, active }
 *   companies/{id}/reservations/{resvId}  — full reservation doc
 */
import { z } from 'zod';
import { ai } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizePhone(p: string | undefined): string { return (p ?? '').replace(/[^0-9+]/g, ''); }
function normalizeEmail(e: string | undefined): string { return (e ?? '').toLowerCase().trim(); }

async function audit(companyId: string, action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await getFirestore().collection(`companies/${companyId}/cloneAuditLog`).add({
      action, details, createdAt: new Date(),
    });
  } catch { /* non-critical */ }
}

async function getCompanyReservationPrefs(companyId: string): Promise<{ timezone: string; autoConfirm: boolean }> {
  try {
    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId).get();
    const d = doc.data() ?? {};
    const settings = (d['settings'] as Record<string, unknown>) ?? {};
    return {
      timezone: (settings['timezone'] as string) || (d['timezone'] as string) || 'Africa/Abidjan',
      autoConfirm: (settings['autoConfirmReservations'] as boolean) === true,
    };
  } catch {
    return { timezone: 'Africa/Abidjan', autoConfirm: false };
  }
}

const RESOURCE_TYPES = ['table', 'room', 'hall', 'vehicle', 'other'] as const;
type ResourceType = typeof RESOURCE_TYPES[number];

interface ResourceDoc {
  id: string;
  name: string;
  type: ResourceType;
  capacity?: number;
  active?: boolean;
}

/** Find the best matching resource for a type + optional capacity. Returns the first active match. */
async function resolveResource(
  companyId: string,
  opts: { resourceId?: string; resourceType?: ResourceType; requiredCapacity?: number },
): Promise<ResourceDoc | null> {
  try {
    const db = getFirestore();
    const coll = db.collection(`companies/${companyId}/resources`);

    if (opts.resourceId) {
      const snap = await coll.doc(opts.resourceId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...(snap.data() as Omit<ResourceDoc, 'id'>) };
    }

    // Find resource by type + capacity
    const snap = await coll.where('type', '==', opts.resourceType ?? 'other').get();
    const candidates: ResourceDoc[] = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<ResourceDoc, 'id'>) }))
      .filter(r => r.active !== false);
    if (opts.requiredCapacity != null) {
      const fit = candidates.filter(r => !r.capacity || r.capacity >= (opts.requiredCapacity ?? 0));
      if (fit.length > 0) {
        fit.sort((a, b) => (a.capacity ?? 999) - (b.capacity ?? 999)); // smallest that fits
        return fit[0];
      }
    }
    return candidates[0] ?? null;
  } catch { return null; }
}

// ── findReservation ─────────────────────────────────────────────────────────
export const cloneFindReservationTool = ai.defineTool(
  {
    name: 'findReservation',
    description: "Search for an existing reservation by the client contact (phone or email) and optional date. Call FIRST when the user asks about an existing reservation (table/room/hall/car).",
    inputSchema: z.object({
      companyId: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      date: z.string().optional().describe('Optional YYYY-MM-DD'),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      reservationId: z.string().optional(),
      clientName: z.string().optional(),
      resourceName: z.string().optional(),
      resourceType: z.string().optional(),
      date: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      guests: z.number().optional(),
      status: z.string().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { found: false, message: 'Impossible de chercher sans téléphone ou email.' };
    try {
      const db = getFirestore();
      const coll = db.collection(`companies/${input.companyId}/reservations`);
      let q: FirebaseFirestore.Query = phone ? coll.where('clientPhone', '==', phone) : coll.where('clientEmail', '==', email);
      if (input.date && DATE_REGEX.test(input.date)) q = q.where('date', '==', input.date);
      const snap = await q.limit(5).get();
      if (snap.empty) return { found: false, message: 'Aucune réservation trouvée.' };
      const doc = snap.docs[0].data();
      return {
        found: true,
        reservationId: snap.docs[0].id,
        clientName:    doc['clientName']    as string,
        resourceName:  doc['resourceName']  as string,
        resourceType:  doc['resourceType']  as string,
        date:          doc['date']          as string,
        startTime:     doc['startTime']     as string,
        endTime:       doc['endTime']       as string,
        guests:        doc['guests']        as number,
        status:        doc['status']        as string,
        message: `Réservation trouvée: ${doc['clientName']} — ${doc['resourceName'] ?? doc['resourceType']} le ${doc['date']} ${doc['startTime'] ?? ''} (${doc['status']}).`,
      };
    } catch (err) {
      logger.error('[ResvTools] findReservation failed', { err: String(err) });
      return { found: false, message: 'Erreur lors de la recherche.' };
    }
  }
);

// ── createReservation ───────────────────────────────────────────────────────
export const cloneCreateReservationTool = ai.defineTool(
  {
    name: 'createReservation',
    description: "Create a reservation (table / room / hall / vehicle). Call when the user has given: name, contact, resource type OR specific resourceId, date, startTime, guests count. Status will be 'pending' unless auto-confirm is enabled. endTime is optional (defaults to startTime + 2h for tables, next day for hotel rooms).",
    inputSchema: z.object({
      companyId: z.string(),
      clientName: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      resourceType: z.enum(['table', 'room', 'hall', 'vehicle', 'other']).describe("Type: 'table' (restaurant), 'room' (hotel), 'hall' (event space), 'vehicle' (car rental), 'other'"),
      resourceId: z.string().optional().describe('Specific resource ID if the user requested one by name'),
      date: z.string().describe('YYYY-MM-DD'),
      startTime: z.string().describe('HH:MM in 24h format — check-in time or reservation start'),
      endTime: z.string().optional().describe('HH:MM — optional end/checkout time'),
      guests: z.number().optional().describe('Number of people (required for tables/rooms)'),
      notes: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      reservationId: z.string().optional(),
      resourceName: z.string().optional(),
      status: z.string().optional(),
      alreadyExisted: z.boolean().optional(),
      message: z.string(),
    }),
  },
  async (input) => {
    if (!input.clientName?.trim()) return { success: false, message: 'Nom du client requis.' };
    if (!input.clientPhone && !input.clientEmail) return { success: false, message: 'Téléphone ou email requis.' };
    if (!DATE_REGEX.test(input.date)) return { success: false, message: 'Date invalide (YYYY-MM-DD).' };
    if (!TIME_REGEX.test(input.startTime)) return { success: false, message: 'Heure de début invalide (HH:MM).' };
    if (input.endTime && !TIME_REGEX.test(input.endTime)) return { success: false, message: 'Heure de fin invalide (HH:MM).' };

    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);

    try {
      const db = getFirestore();
      const coll = db.collection(`companies/${input.companyId}/reservations`);

      // Resolve resource
      const resource = await resolveResource(input.companyId, {
        resourceId: input.resourceId,
        resourceType: input.resourceType,
        requiredCapacity: input.guests,
      });

      // Logical dedup: same contact + resource + date + startTime
      const contactField = phone ? 'clientPhone' : 'clientEmail';
      const contactVal = phone || email;
      const dupSnap = await coll
        .where(contactField, '==', contactVal)
        .where('date', '==', input.date)
        .where('startTime', '==', input.startTime)
        .limit(1).get();
      if (!dupSnap.empty) {
        const existing = dupSnap.docs[0].data();
        return {
          success: true,
          reservationId: dupSnap.docs[0].id,
          resourceName: existing['resourceName'] as string,
          status: (existing['status'] as string) ?? 'pending',
          alreadyExisted: true,
          message: `Une réservation existe déjà pour ${input.clientName} le ${input.date} à ${input.startTime}.`,
        };
      }

      // Technical idempotency
      const idempotencyKey = `${input.sourceChannel ?? 'clone'}:${contactVal}:${input.resourceType}:${input.date}:${input.startTime}`;
      const byIdem = await coll.where('idempotencyKey', '==', idempotencyKey).limit(1).get();
      if (!byIdem.empty) {
        const existing = byIdem.docs[0].data();
        return {
          success: true,
          reservationId: byIdem.docs[0].id,
          resourceName: existing['resourceName'] as string,
          status: (existing['status'] as string) ?? 'pending',
          alreadyExisted: true,
          message: `Demande déjà enregistrée (référence ${byIdem.docs[0].id}).`,
        };
      }

      // Load prefs
      const prefs = await getCompanyReservationPrefs(input.companyId);
      const status = prefs.autoConfirm ? 'confirmed' : 'pending';

      // Compute endTime default
      const defaultEnd = (() => {
        if (input.endTime) return input.endTime;
        if (input.resourceType === 'room') return '12:00'; // next-day checkout default 12:00
        // tables/halls/vehicle/other → +2h
        const [h, m] = input.startTime.split(':').map(Number);
        const totalMin = h * 60 + m + 120;
        const eh = Math.floor(totalMin / 60) % 24;
        const em = totalMin % 60;
        return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      })();

      const id = generateId();
      await coll.doc(id).set({
        id,
        clientName: input.clientName.trim(),
        clientPhone: phone,
        clientEmail: email,
        resourceType: input.resourceType,
        resourceId: resource?.id ?? null,
        resourceName: resource?.name ?? input.resourceType,
        resourceCapacity: resource?.capacity ?? null,
        date: input.date,
        startTime: input.startTime,
        endTime: defaultEnd,
        guests: input.guests ?? null,
        notes: input.notes ?? '',
        status,
        assignedTo: null,
        assignedToName: null,
        sourceChannel: input.sourceChannel ?? 'unknown',
        sourceType: 'clone',
        createdBy: 'clone',
        idempotencyKey,
        createdAt: new Date(),
      });

      await audit(input.companyId, 'createReservation', {
        reservationId: id, clientName: input.clientName, resourceType: input.resourceType,
        resourceName: resource?.name, date: input.date, startTime: input.startTime, status,
      });

      // Side-effects (non-blocking): email + in-app notif
      if (email) {
        (async () => {
          try {
            const { sendEmail: sendMail } = await import('../../services/email/emailService');
            const subject = status === 'confirmed'
              ? `Réservation confirmée — ${input.date} ${input.startTime}`
              : `Demande de réservation reçue — ${input.date} ${input.startTime}`;
            const lead = status === 'confirmed'
              ? `Votre réservation est confirmée pour le ${input.date} à ${input.startTime}.`
              : `Votre demande de réservation pour le ${input.date} à ${input.startTime} a été enregistrée. Un agent va valider sous peu.`;
            await sendMail({
              to: email, subject,
              html: `<p>Bonjour ${input.clientName},</p><p>${lead}</p><p>${resource?.name ?? input.resourceType}${input.guests ? ` · ${input.guests} personne(s)` : ''}</p><p>Référence: ${id}</p>`,
              companyId: input.companyId,
              tags: [{ name: 'type', value: 'reservation-created' }],
            });
          } catch (err) { logger.warn('[ResvTools] email failed', { err: String(err) }); }
        })().catch(() => { });
      }

      (async () => {
        try {
          const { createNotification } = await import('../../services/notificationService');
          await createNotification({
            companyId: input.companyId,
            type: 'appointment_created',
            title: status === 'confirmed' ? 'Nouvelle réservation confirmée' : 'Nouvelle réservation en attente',
            message: `${input.clientName} — ${resource?.name ?? input.resourceType} le ${input.date} à ${input.startTime}`,
            actionUrl: '/admin/reservations',
            icon: 'Calendar',
            severity: status === 'confirmed' ? 'info' : 'warning',
            metadata: { reservationId: id, source: input.sourceChannel ?? 'unknown' },
          });
        } catch { /* non-critical */ }
      })().catch(() => { });

      return {
        success: true,
        reservationId: id,
        resourceName: resource?.name ?? input.resourceType,
        status,
        alreadyExisted: false,
        message: status === 'confirmed'
          ? `Réservation confirmée pour ${input.clientName} le ${input.date} à ${input.startTime}.`
          : `Demande enregistrée pour ${input.clientName} le ${input.date} à ${input.startTime}. Vous serez contacté pour validation.`,
      };
    } catch (err) {
      logger.error('[ResvTools] createReservation failed', { err: String(err) });
      return { success: false, message: "Impossible d'enregistrer la réservation. Un humain vous recontactera." };
    }
  }
);

// ── confirmReservation (voice-blocked for safety) ───────────────────────────
export const cloneConfirmReservationTool = ai.defineTool(
  {
    name: 'confirmReservation',
    description: "Confirm an existing PENDING reservation. Requires identity proof (phone or email that matches the record). BLOCKED on voice channel — the voice user must wait for human validation.",
    inputSchema: z.object({
      companyId: z.string(),
      reservationId: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(), status: z.string().optional(), message: z.string(), requiresHuman: z.boolean().optional(),
    }),
  },
  async (input) => {
    if (input.sourceChannel === 'voice') {
      await audit(input.companyId, 'confirmReservation.voiceBlocked', { reservationId: input.reservationId });
      return { success: false, requiresHuman: true, message: "Pour confirmer cette réservation, un agent va vous rappeler." };
    }
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { success: false, requiresHuman: true, message: "Téléphone ou email requis pour vérifier." };

    try {
      const db = getFirestore();
      const ref = db.collection(`companies/${input.companyId}/reservations`).doc(input.reservationId);
      const doc = await ref.get();
      if (!doc.exists) return { success: false, message: 'Réservation introuvable.' };
      const data = doc.data() ?? {};
      const storedPhone = normalizePhone((data['clientPhone'] as string) ?? '');
      const storedEmail = normalizeEmail((data['clientEmail'] as string) ?? '');
      if (!((phone && phone === storedPhone) || (email && email === storedEmail))) {
        await audit(input.companyId, 'confirmReservation.identityFailed', { reservationId: input.reservationId });
        return { success: false, requiresHuman: true, message: "Les informations fournies ne correspondent pas. Un agent vous recontactera." };
      }
      const currentStatus = (data['status'] as string) ?? 'pending';
      if (currentStatus === 'confirmed') return { success: true, status: 'confirmed', message: 'Réservation déjà confirmée.' };
      if (currentStatus !== 'pending') return { success: false, requiresHuman: true, message: `Statut "${currentStatus}" — un agent vous recontactera.` };
      await ref.update({ status: 'confirmed', confirmedAt: new Date(), confirmedBy: 'clone' });
      await audit(input.companyId, 'confirmReservation', { reservationId: input.reservationId });
      return { success: true, status: 'confirmed', message: `Réservation confirmée pour le ${data['date']} à ${data['startTime']}.` };
    } catch (err) {
      logger.error('[ResvTools] confirmReservation failed', { err: String(err) });
      return { success: false, requiresHuman: true, message: 'Impossible de confirmer. Un agent vous recontactera.' };
    }
  }
);

// ── cancelReservation (identity-gated) ──────────────────────────────────────
export const cloneCancelReservationTool = ai.defineTool(
  {
    name: 'cancelReservation',
    description: "Cancel an existing reservation. Requires identity proof (phone or email matching the record). Allowed on all channels (less risky than confirmation).",
    inputSchema: z.object({
      companyId: z.string(),
      reservationId: z.string(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      reason: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string(), requiresHuman: z.boolean().optional() }),
  },
  async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { success: false, requiresHuman: true, message: 'Téléphone ou email requis.' };
    try {
      const db = getFirestore();
      const ref = db.collection(`companies/${input.companyId}/reservations`).doc(input.reservationId);
      const doc = await ref.get();
      if (!doc.exists) return { success: false, message: 'Réservation introuvable.' };
      const data = doc.data() ?? {};
      const storedPhone = normalizePhone((data['clientPhone'] as string) ?? '');
      const storedEmail = normalizeEmail((data['clientEmail'] as string) ?? '');
      if (!((phone && phone === storedPhone) || (email && email === storedEmail))) {
        await audit(input.companyId, 'cancelReservation.identityFailed', { reservationId: input.reservationId });
        return { success: false, requiresHuman: true, message: "Vérification impossible. Un agent vous recontactera." };
      }
      await ref.update({ status: 'cancelled', cancelledAt: new Date(), cancelReason: input.reason ?? '' });
      await audit(input.companyId, 'cancelReservation', { reservationId: input.reservationId, reason: input.reason });
      return { success: true, message: 'Réservation annulée.' };
    } catch (err) {
      logger.error('[ResvTools] cancelReservation failed', { err: String(err) });
      return { success: false, requiresHuman: true, message: 'Impossible d\'annuler. Un agent vous recontactera.' };
    }
  }
);

// ── rescheduleReservation (identity-gated, voice-allowed) ───────────────────
export const cloneRescheduleReservationTool = ai.defineTool(
  {
    name: 'rescheduleReservation',
    description: "Reschedule an existing reservation (table/room/hall/vehicle) to a new date/time. Requires identity (phone or email matching).",
    inputSchema: z.object({
      companyId: z.string(),
      reservationId: z.string(),
      newDate: z.string().describe('YYYY-MM-DD'),
      newStartTime: z.string().describe('HH:MM 24h'),
      newEndTime: z.string().optional(),
      clientPhone: z.string().optional(),
      clientEmail: z.string().optional(),
      sourceChannel: z.enum(['web', 'whatsapp', 'telegram', 'sms', 'messenger', 'email', 'voice']).optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string(), requiresHuman: z.boolean().optional() }),
  },
  async (input) => {
    const phone = normalizePhone(input.clientPhone);
    const email = normalizeEmail(input.clientEmail);
    if (!phone && !email) return { success: false, requiresHuman: true, message: 'Téléphone ou email requis.' };
    if (!DATE_REGEX.test(input.newDate)) return { success: false, message: 'Date invalide.' };
    if (!TIME_REGEX.test(input.newStartTime)) return { success: false, message: 'Heure invalide.' };
    try {
      const db = getFirestore();
      const ref = db.collection(`companies/${input.companyId}/reservations`).doc(input.reservationId);
      const doc = await ref.get();
      if (!doc.exists) return { success: false, message: 'Réservation introuvable.' };
      const data = doc.data() ?? {};
      const storedPhone = normalizePhone((data['clientPhone'] as string) ?? '');
      const storedEmail = normalizeEmail((data['clientEmail'] as string) ?? '');
      if (!((phone && phone === storedPhone) || (email && email === storedEmail))) {
        await audit(input.companyId, 'rescheduleReservation.identityFailed', { reservationId: input.reservationId });
        return { success: false, requiresHuman: true, message: 'Vérification impossible. Un agent vous recontactera.' };
      }
      const updates: Record<string, unknown> = {
        previousDate: data['date'], previousStartTime: data['startTime'],
        date: input.newDate, startTime: input.newStartTime,
        status: 'rescheduled', rescheduledAt: new Date(), rescheduledBy: 'clone',
      };
      if (input.newEndTime && TIME_REGEX.test(input.newEndTime)) updates['endTime'] = input.newEndTime;
      await ref.update(updates);
      await audit(input.companyId, 'rescheduleReservation', { reservationId: input.reservationId, newDate: input.newDate, newStartTime: input.newStartTime });
      return { success: true, message: `Réservation déplacée au ${input.newDate} à ${input.newStartTime}.` };
    } catch (err) {
      logger.error('[ResvTools] rescheduleReservation failed', { err: String(err) });
      return { success: false, requiresHuman: true, message: "Impossible de déplacer. Un agent vous recontactera." };
    }
  }
);

// ── listResources (read-only helper for the Clone to answer "what tables?") ─
export const cloneListResourcesTool = ai.defineTool(
  {
    name: 'listResources',
    description: "List available resources (tables/rooms/halls/vehicles) of a given type. Use to answer 'do you have tables for 4?' before calling createReservation.",
    inputSchema: z.object({
      companyId: z.string(),
      resourceType: z.enum(['table', 'room', 'hall', 'vehicle', 'other']),
      minCapacity: z.number().optional(),
    }),
    outputSchema: z.object({
      resources: z.array(z.object({
        id: z.string(), name: z.string(), capacity: z.number().optional(), type: z.string(),
      })),
      message: z.string(),
    }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      const snap = await db.collection(`companies/${input.companyId}/resources`)
        .where('type', '==', input.resourceType).get();
      const items = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<ResourceDoc, 'id'>) }))
        .filter(r => r.active !== false)
        .filter(r => input.minCapacity == null || !r.capacity || r.capacity >= input.minCapacity)
        .map(r => ({ id: r.id, name: r.name, capacity: r.capacity, type: r.type }));
      return {
        resources: items,
        message: items.length === 0
          ? `Aucune ressource de type "${input.resourceType}" disponible.`
          : `${items.length} ressource(s) disponible(s).`,
      };
    } catch (err) {
      logger.error('[ResvTools] listResources failed', { err: String(err) });
      return { resources: [], message: 'Erreur lors du chargement.' };
    }
  }
);

export const CLONE_RESERVATION_TOOLS = [
  cloneFindReservationTool,
  cloneCreateReservationTool,
  cloneConfirmReservationTool,
  cloneCancelReservationTool,
  cloneRescheduleReservationTool,
  cloneListResourcesTool,
];

export const CLONE_RESERVATION_TOOL_NAMES = [
  'findReservation', 'createReservation', 'confirmReservation', 'cancelReservation', 'rescheduleReservation', 'listResources',
];
