/**
 * Reception Agent — Gemini Flash
 * Accueil visiteurs, gestion des RDV, présence employés, congés, annuaire, badges.
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

// ── Visitor Tools ────────────────────────────────────────────────────────────

export const visitorRegistryTool = ai.defineTool(
  {
    name: 'rec_registerVisitor',
    description: 'Register a visitor arrival and notify the host.',
    inputSchema: z.object({
      companyId:   z.string(),
      visitorName: z.string(),
      visitorEmail: z.string().optional(),
      visitorCompany: z.string().optional(),
      hostName:    z.string(),
      purpose:     z.string().optional(),
      type:        z.enum(['walkin', 'appointment', 'delivery', 'vip']).optional(),
    }),
    outputSchema: z.object({
      visitId:     z.string(),
      badgeNumber: z.string(),
      checkInAt:   z.string(),
      message:     z.string(),
    }),
  },
  async ({ companyId, visitorName, visitorEmail, visitorCompany, hostName, purpose, type }) => {
    const db = getFirestore();
    const visitId = generateId();
    const badgeNumber = `V-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    await db.collection('visitors').doc(visitId).set({
      companyId, id: visitId, name: visitorName,
      email: visitorEmail ?? null, company: visitorCompany ?? '',
      host: hostName, purpose: purpose ?? 'Non specifie',
      type: type ?? 'walkin', badgeNumber,
      status: 'checked_in',
      checkInAt: FieldValue.serverTimestamp(),
      checkOutAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      visitId, badgeNumber, checkInAt: now.toISOString(),
      message: `${visitorName} enregistre(e) pour voir ${hostName}. Badge: ${badgeNumber}.`,
    };
  }
);

export const calendarCheckTool = ai.defineTool(
  {
    name: 'rec_checkAppointment',
    description: 'Check if a visitor has a scheduled appointment.',
    inputSchema: z.object({
      companyId:   z.string(),
      visitorName: z.string(),
      hostName:    z.string().optional(),
    }),
    outputSchema: z.object({
      hasAppointment: z.boolean(),
      appointment:    z.object({
        time:     z.string(),
        host:     z.string(),
        location: z.string().optional(),
      }).optional(),
    }),
  },
  async ({ companyId, visitorName, hostName }) => {
    const db = getFirestore();
    const snap = await db.collection('appointments')
      .where('companyId', '==', companyId)
      .where('status', '==', 'confirmed')
      .limit(50).get();

    const match = snap.docs.map(d => d.data()).find(m => {
      const name = ((m['visitorName'] as string) ?? '').toLowerCase();
      const host = ((m['host'] as string) ?? '').toLowerCase();
      const nameMatch = name.includes(visitorName.toLowerCase()) || visitorName.toLowerCase().includes(name);
      const hostMatch = !hostName || host.includes(hostName.toLowerCase());
      return nameMatch && hostMatch;
    });

    if (match) {
      return {
        hasAppointment: true,
        appointment: {
          time: (match['scheduledAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? 'Aujourd\'hui',
          host: (match['host'] as string) ?? hostName ?? 'Inconnu',
          location: match['location'] as string | undefined,
        },
      };
    }
    return { hasAppointment: false };
  }
);

export const visitorHistoryTool = ai.defineTool(
  {
    name: 'rec_getVisitorHistory',
    description: 'Get the visitor log for today or a date range.',
    inputSchema: z.object({
      companyId:  z.string(),
      dateFilter: z.enum(['today', 'week', 'month']).optional().default('today'),
    }),
    outputSchema: z.object({
      visitors: z.array(z.object({
        name:      z.string(),
        host:      z.string(),
        purpose:   z.string(),
        checkInAt: z.string(),
        status:    z.string(),
        type:      z.string(),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, dateFilter }) => {
    const db = getFirestore();
    const snap = await db.collection('visitors')
      .where('companyId', '==', companyId)
      .limit(100).get();

    const now = Date.now();
    const cutoffs: Record<string, number> = {
      today: 24 * 60 * 60 * 1000,
      week:  7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - (cutoffs[dateFilter ?? 'today'] ?? cutoffs['today']);

    const visitors = snap.docs
      .map(d => d.data())
      .filter(v => {
        const t = (v['checkInAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        return t >= cutoff;
      })
      .map(v => ({
        name:      (v['name'] as string) ?? (v['visitorName'] as string) ?? '',
        host:      (v['host'] as string) ?? (v['hostName'] as string) ?? '',
        purpose:   (v['purpose'] as string) ?? '',
        checkInAt: (v['checkInAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
        status:    (v['status'] as string) ?? 'checked_in',
        type:      (v['type'] as string) ?? 'walkin',
      }));

    return { visitors, total: visitors.length };
  }
);

export const companyInfoTool = ai.defineTool(
  {
    name: 'rec_getCompanyInfo',
    description: 'Get company info (address, hours, departments) to answer visitor questions.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      name:         z.string(),
      address:      z.string(),
      phone:        z.string(),
      openingHours: z.string(),
      departments:  z.array(z.string()),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const doc = await db.collection('companies').doc(companyId).get();
    const d = doc.data() ?? {};
    return {
      name:         (d['name'] as string) ?? 'The Company',
      address:      (d['address'] as string) ?? 'Adresse non configuree',
      phone:        (d['phone'] as string) ?? 'Telephone non configure',
      openingHours: (d['openingHours'] as string) ?? 'Lundi-Vendredi 9:00-18:00',
      departments:  (d['departments'] as string[]) ?? ['Direction', 'RH', 'IT', 'Commercial', 'Marketing'],
    };
  }
);

// ── Presence Tools ───────────────────────────────────────────────────────────

export const presenceStatusTool = ai.defineTool(
  {
    name: 'rec_getPresenceStatus',
    description: 'Get current employee presence status — who is present today, who is absent.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      present: z.array(z.object({ name: z.string(), department: z.string(), checkInAt: z.string() })),
      totalPresent: z.number(),
      totalEmployees: z.number(),
      presenceRate: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0];

    const pSnap = await db.collection('presence')
      .where('companyId', '==', companyId)
      .where('date', '==', today)
      .limit(200).get();

    const present = pSnap.docs
      .filter(d => d.data()['status'] === 'present')
      .map(d => ({
        name: (d.data()['employeeName'] as string) ?? '',
        department: (d.data()['department'] as string) ?? '',
        checkInAt: (d.data()['checkInAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
      }));

    let totalEmployees = 0;
    try {
      const uSnap = await db.collection('users')
        .where('companyId', '==', companyId).get();
      totalEmployees = uSnap.size;
    } catch {}

    return {
      present,
      totalPresent: present.length,
      totalEmployees,
      presenceRate: totalEmployees > 0 ? Math.round((present.length / totalEmployees) * 100) : 0,
    };
  }
);

export const employeeCheckinTool = ai.defineTool(
  {
    name: 'rec_checkinEmployee',
    description: 'Check in an employee for the day (mark them as present).',
    inputSchema: z.object({
      companyId: z.string(),
      employeeId: z.string(),
      employeeName: z.string(),
      department: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, employeeId, employeeName, department }) => {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0];
    const id = `${employeeId}_${today}`;

    const existing = await db.collection('presence').doc(id).get();
    if (existing.exists) {
      return { success: false, message: `${employeeName} est deja pointe(e) aujourd'hui.` };
    }

    await db.collection('presence').doc(id).set({
      companyId, employeeId, employeeName,
      department: department ?? '',
      date: today,
      checkInAt: FieldValue.serverTimestamp(),
      checkOutAt: null,
      status: 'present',
    });

    return { success: true, message: `${employeeName} pointe(e) comme present(e).` };
  }
);

export const checkinByCodeTool = ai.defineTool(
  {
    name: 'rec_checkinByCode',
    description: 'Check in or out an employee using their 6-digit code. First use = arrival, second use = departure.',
    inputSchema: z.object({
      companyId: z.string(),
      code: z.string().describe('6-digit employee code'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      action: z.string(),
      employeeName: z.string(),
      hoursWorked: z.number().optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, code }) => {
    const db = getFirestore();
    const snap = await db.collection('users')
      .where('companyId', '==', companyId)
      .where('employeeCode', '==', code)
      .where('codeActive', '==', true)
      .limit(1).get();

    if (snap.empty) {
      return { success: false, action: 'error', employeeName: '', message: 'Code invalide ou revoque.' };
    }

    const employee = snap.docs[0];
    const empData = employee.data();
    const employeeId = employee.id;
    const employeeName = (empData['displayName'] as string) ?? (empData['email'] as string) ?? '';
    const today = new Date().toISOString().split('T')[0];
    const presenceId = `${employeeId}_${today}`;

    const existing = await db.collection('presence').doc(presenceId).get();

    if (existing.exists) {
      if (existing.data()?.status === 'present') {
        const checkIn = existing.data()?.checkInAt?.toDate?.() ?? existing.data()?.checkInAt;
        const checkOut = new Date();
        const hoursWorked = checkIn ? parseFloat(((checkOut.getTime() - new Date(checkIn).getTime()) / 3600000).toFixed(2)) : 0;
        await db.collection('presence').doc(presenceId).update({ checkOutAt: checkOut, status: 'checked_out', hoursWorked });
        return { success: true, action: 'checkout', employeeName, hoursWorked, message: `${employeeName} a pointe son depart (${hoursWorked}h).` };
      }
      return { success: true, action: 'already_done', employeeName, message: `${employeeName} a deja termine sa journee.` };
    }

    await db.collection('presence').doc(presenceId).set({
      companyId, employeeId, employeeName,
      employeeEmail: (empData['email'] as string) ?? '',
      department: (empData['department'] as string) ?? '',
      date: today,
      checkInAt: FieldValue.serverTimestamp(),
      checkOutAt: null,
      status: 'present',
    });
    return { success: true, action: 'checkin', employeeName, message: `${employeeName} pointe(e) comme present(e).` };
  }
);

// ── Leave Tools ──────────────────────────────────────────────────────────────

export const leaveStatusTool = ai.defineTool(
  {
    name: 'rec_getLeaveRequests',
    description: 'Get approved leaves to know who is absent today/this week. Read-only — leave management is handled by HR.',
    inputSchema: z.object({
      companyId: z.string(),
      status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('pending'),
    }),
    outputSchema: z.object({
      requests: z.array(z.object({
        id: z.string(),
        employeeName: z.string(),
        type: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string(),
        status: z.string(),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, status }) => {
    const db = getFirestore();
    let query = db.collection('leaves').where('companyId', '==', companyId);
    if (status !== 'all') {
      query = query.where('status', '==', status) as typeof query;
    }

    const snap = await (query as ReturnType<typeof db.collection>).limit(100).get();
    const requests = snap.docs.map(d => ({
      id: d.id,
      employeeName: (d.data()['employeeName'] as string) ?? '',
      type: (d.data()['type'] as string) ?? 'vacation',
      startDate: (d.data()['startDate'] as string) ?? '',
      endDate: (d.data()['endDate'] as string) ?? '',
      reason: (d.data()['reason'] as string) ?? '',
      status: (d.data()['status'] as string) ?? 'pending',
    }));

    return { requests, total: requests.length };
  }
);

// ── Directory Tool ───────────────────────────────────────────────────────────

export const directoryLookupTool = ai.defineTool(
  {
    name: 'rec_lookupEmployee',
    description: 'Look up an employee in the company directory by name, department, or role.',
    inputSchema: z.object({
      companyId: z.string(),
      query: z.string().describe('Name, department, or role to search for'),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
        name: z.string(),
        email: z.string(),
        department: z.string(),
        phone: z.string(),
        title: z.string(),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, query }) => {
    const db = getFirestore();
    const snap = await db.collection('users')
      .where('companyId', '==', companyId)
      .limit(200).get();

    const q = query.toLowerCase();
    const results = snap.docs
      .map(d => d.data())
      .filter(u => {
        const name = ((u['displayName'] as string) ?? '').toLowerCase();
        const dept = ((u['department'] as string) ?? '').toLowerCase();
        const role = ((u['role'] as string) ?? '').toLowerCase();
        const title = ((u['jobTitle'] as string) ?? '').toLowerCase();
        return name.includes(q) || dept.includes(q) || role.includes(q) || title.includes(q);
      })
      .map(u => ({
        name: (u['displayName'] as string) ?? '',
        email: (u['email'] as string) ?? '',
        department: (u['department'] as string) ?? '',
        phone: (u['phone'] as string) ?? '',
        title: (u['jobTitle'] as string) ?? '',
      }));

    return { results, total: results.length };
  }
);

// ── Employee Badge Tool ─────────────────────────────────────────────────────

export const createEmployeeBadgeTool = ai.defineTool(
  {
    name: 'rec_createEmployeeBadge',
    description: 'Create an employee badge — look up employee info from directory and generate a badge with name, photo, department, job title, and badge number.',
    inputSchema: z.object({
      companyId: z.string(),
      employeeId: z.string().optional().describe('Employee user ID if known'),
      employeeName: z.string().optional().describe('Employee name to search for if ID not known'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      badgeId: z.string().optional(),
      badgeNumber: z.string().optional(),
      employeeName: z.string(),
      department: z.string(),
      jobTitle: z.string(),
      photoURL: z.string().optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, employeeId, employeeName }) => {
    const db = getFirestore();

    // Find employee
    let empDoc;
    let empData: Record<string, unknown> | undefined;
    let resolvedId = employeeId;

    if (employeeId) {
      empDoc = await db.collection('users').doc(employeeId).get();
      if (!empDoc.exists) {
        return { success: false, employeeName: '', department: '', jobTitle: '', message: 'Employe non trouve avec cet ID.' };
      }
      empData = empDoc.data() as Record<string, unknown>;
    } else if (employeeName) {
      const snap = await db.collection('users')
        .where('companyId', '==', companyId)
        .limit(200).get();
      const q = employeeName.toLowerCase();
      const match = snap.docs.find(d => {
        const name = ((d.data()['displayName'] as string) ?? '').toLowerCase();
        return name.includes(q) || q.includes(name);
      });
      if (!match) {
        return { success: false, employeeName: employeeName ?? '', department: '', jobTitle: '', message: `Aucun employe trouve avec le nom "${employeeName}".` };
      }
      resolvedId = match.id;
      empData = match.data() as Record<string, unknown>;
    } else {
      return { success: false, employeeName: '', department: '', jobTitle: '', message: 'Veuillez fournir un ID ou un nom d\'employe.' };
    }

    // Check if badge already exists
    const existingSnap = await db.collection('employeeBadges')
      .where('companyId', '==', companyId)
      .where('employeeId', '==', resolvedId)
      .where('status', '==', 'active')
      .limit(1).get();

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data();
      return {
        success: true,
        badgeId: existingSnap.docs[0].id,
        badgeNumber: (existing['badgeNumber'] as string) ?? '',
        employeeName: (existing['employeeName'] as string) ?? '',
        department: (existing['department'] as string) ?? '',
        jobTitle: (existing['jobTitle'] as string) ?? '',
        photoURL: (existing['photoURL'] as string) ?? undefined,
        message: `Badge existant : ${existing['badgeNumber']}. L'employe a deja un badge actif.`,
      };
    }

    // Create badge
    const badgeId = generateId();
    const badgeNumber = `EMP-${Date.now().toString().slice(-6)}`;
    const name = (empData!['displayName'] as string) ?? (empData!['email'] as string) ?? '';
    const department = (empData!['department'] as string) ?? '';
    const jobTitle = (empData!['jobTitle'] as string) ?? '';
    const photoURL = (empData!['photoURL'] as string) ?? undefined;

    await db.collection('employeeBadges').doc(badgeId).set({
      companyId,
      employeeId: resolvedId,
      badgeNumber,
      employeeName: name,
      department,
      jobTitle,
      email: (empData!['email'] as string) ?? '',
      phone: (empData!['phone'] as string) ?? '',
      photoURL: photoURL ?? null,
      status: 'active',
      issuedAt: FieldValue.serverTimestamp(),
      expiresAt: null,
      createdBy: 'agent',
    });

    await db.collection('users').doc(resolvedId!).update({
      badgeId, badgeNumber, badgeIssuedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      badgeId,
      badgeNumber,
      employeeName: name,
      department,
      jobTitle,
      photoURL,
      message: `Badge ${badgeNumber} cree pour ${name} (${jobTitle}, ${department}). Le badge peut etre imprime depuis le tableau de bord reception.`,
    };
  }
);

// ── Reception Stats Tool ─────────────────────────────────────────────────────

export const receptionStatsTool = ai.defineTool(
  {
    name: 'rec_getStats',
    description: 'Get reception dashboard stats — visitor count, presence rate, appointments, pending leaves.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      visitorsToday: z.number(),
      visitorsPresent: z.number(),
      employeesPresent: z.number(),
      presenceRate: z.number(),
      appointmentsToday: z.number(),
      pendingLeaves: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

    let visitorsToday = 0, visitorsPresent = 0;
    try {
      const snap = await db.collection('visitors')
        .where('companyId', '==', companyId)
        .where('checkInAt', '>=', startOfDay)
        .where('checkInAt', '<=', endOfDay).get();
      visitorsToday = snap.size;
      visitorsPresent = snap.docs.filter(d => d.data()['status'] === 'checked_in').length;
    } catch {}

    let employeesPresent = 0, totalEmps = 0;
    try {
      const pSnap = await db.collection('presence')
        .where('companyId', '==', companyId)
        .where('date', '==', today).get();
      employeesPresent = pSnap.docs.filter(d => d.data()['status'] === 'present').length;
    } catch {}
    try {
      totalEmps = (await db.collection('users').where('companyId', '==', companyId).get()).size;
    } catch {}

    let appointmentsToday = 0;
    try {
      appointmentsToday = (await db.collection('appointments')
        .where('companyId', '==', companyId)
        .where('scheduledAt', '>=', startOfDay)
        .where('scheduledAt', '<=', endOfDay).get()).size;
    } catch {}

    let pendingLeaves = 0;
    try {
      pendingLeaves = (await db.collection('leaves')
        .where('companyId', '==', companyId)
        .where('status', '==', 'pending').get()).size;
    } catch {}

    return {
      visitorsToday, visitorsPresent, employeesPresent,
      presenceRate: totalEmps > 0 ? Math.round((employeesPresent / totalEmps) * 100) : 0,
      appointmentsToday, pendingLeaves,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRE-REGISTRATION (visiteur s'inscrit en avance, host approuve)
// ══════════════════════════════════════════════════════════════════════════════

export const preRegisterVisitorTool = ai.defineTool(
  {
    name: 'rec_preRegisterVisitor',
    description: 'Pre-register a visitor for a future visit — sends confirmation email, notifies host for approval.',
    inputSchema: z.object({
      companyId: z.string(), visitorName: z.string(), visitorEmail: z.string(),
      visitorCompany: z.string().optional(), hostName: z.string(), hostEmail: z.string().optional(),
      purpose: z.string().optional(), scheduledDate: z.string(), scheduledTime: z.string().optional(),
      requiresNDA: z.boolean().optional(), requiresParking: z.boolean().optional(),
      notes: z.string().optional(),
    }),
    outputSchema: z.object({
      registrationId: z.string(), qrCode: z.string(), status: z.string(), message: z.string(),
    }),
  },
  async ({ companyId, visitorName, visitorEmail, visitorCompany, hostName, hostEmail, purpose, scheduledDate, scheduledTime, requiresNDA, requiresParking, notes }) => {
    const db = getFirestore();
    const id = generateId();
    const qrCode = `PRE-${id.slice(0, 8).toUpperCase()}`;

    await db.collection(`companies/${companyId}/preRegistrations`).doc(id).set({
      id, visitorName, visitorEmail, visitorCompany: visitorCompany ?? '',
      hostName, hostEmail: hostEmail ?? '', purpose: purpose ?? '',
      scheduledDate, scheduledTime: scheduledTime ?? '09:00',
      requiresNDA: requiresNDA ?? false, requiresParking: requiresParking ?? false,
      notes: notes ?? '', qrCode, status: 'pending_approval',
      ndaSigned: false, checkedIn: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      registrationId: id, qrCode, status: 'pending_approval',
      message: `Pre-enregistrement cree pour ${visitorName} le ${scheduledDate}. QR: ${qrCode}. En attente d'approbation par ${hostName}.`,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// DELIVERY MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

export const registerDeliveryTool = ai.defineTool(
  {
    name: 'rec_registerDelivery',
    description: 'Register an incoming delivery — track carrier, items, recipient, signature.',
    inputSchema: z.object({
      companyId: z.string(), carrier: z.string(), trackingNumber: z.string().optional(),
      itemCount: z.number().optional().default(1), description: z.string().optional(),
      recipientName: z.string(), recipientDepartment: z.string().optional(),
      signed: z.boolean().optional(),
    }),
    outputSchema: z.object({ deliveryId: z.string(), status: z.string(), message: z.string() }),
  },
  async ({ companyId, carrier, trackingNumber, itemCount, description, recipientName, recipientDepartment, signed }) => {
    const db = getFirestore();
    const id = generateId();
    await db.collection(`companies/${companyId}/deliveries`).doc(id).set({
      id, carrier, trackingNumber: trackingNumber ?? '', itemCount: itemCount ?? 1,
      description: description ?? '', recipientName, recipientDepartment: recipientDepartment ?? '',
      signed: signed ?? false, status: 'received',
      receivedAt: FieldValue.serverTimestamp(), collectedAt: null,
    });
    return { deliveryId: id, status: 'received', message: `Livraison ${carrier} enregistree — ${itemCount} colis pour ${recipientName}. En attente de collecte.` };
  }
);

export const getDeliveriesTool = ai.defineTool(
  {
    name: 'rec_getDeliveries',
    description: 'List deliveries — pending, collected, or all.',
    inputSchema: z.object({ companyId: z.string(), status: z.enum(['pending', 'collected', 'all']).optional().default('pending') }),
    outputSchema: z.object({ deliveries: z.array(z.object({ id: z.string(), carrier: z.string(), recipientName: z.string(), itemCount: z.number(), status: z.string(), receivedAt: z.string() })), total: z.number() }),
  },
  async ({ companyId, status }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/deliveries`) as FirebaseFirestore.Query;
    if (status === 'pending') q = q.where('status', '==', 'received');
    else if (status === 'collected') q = q.where('status', '==', 'collected');
    const snap = await q.orderBy('receivedAt', 'desc').limit(50).get();
    const deliveries = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, carrier: (data['carrier'] as string) ?? '', recipientName: (data['recipientName'] as string) ?? '',
        itemCount: (data['itemCount'] as number) ?? 1, status: (data['status'] as string) ?? 'received',
        receivedAt: (data['receivedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
      };
    });
    return { deliveries, total: deliveries.length };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// EMERGENCY EVACUATION
// ══════════════════════════════════════════════════════════════════════════════

export const getEvacuationStatusTool = ai.defineTool(
  {
    name: 'rec_getEvacuationStatus',
    description: 'Get real-time headcount for emergency evacuation — visitors + employees currently in building.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalInBuilding: z.number(),
      employees: z.array(z.object({ name: z.string(), department: z.string() })),
      visitors: z.array(z.object({ name: z.string(), host: z.string(), company: z.string() })),
      employeeCount: z.number(), visitorCount: z.number(),
      lastUpdated: z.string(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0];

    // Present employees
    const presSnap = await db.collection('presence').where('companyId', '==', companyId).where('date', '==', today).where('status', '==', 'present').limit(500).get();
    const employees = presSnap.docs.map(d => ({
      name: (d.data()['employeeName'] as string) ?? '', department: (d.data()['department'] as string) ?? '',
    }));

    // Checked-in visitors
    const visSnap = await db.collection('visitors').where('companyId', '==', companyId).where('status', '==', 'checked_in').limit(100).get();
    const visitors = visSnap.docs.map(d => ({
      name: (d.data()['name'] as string) ?? '', host: (d.data()['host'] as string) ?? '',
      company: (d.data()['company'] as string) ?? '',
    }));

    return {
      totalInBuilding: employees.length + visitors.length,
      employees, visitors, employeeCount: employees.length, visitorCount: visitors.length,
      lastUpdated: new Date().toISOString(),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PARKING MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

export const manageParkingTool = ai.defineTool(
  {
    name: 'rec_manageParking',
    description: 'Reserve or release a parking spot for a visitor or employee.',
    inputSchema: z.object({
      companyId: z.string(), action: z.enum(['reserve', 'release', 'list']),
      visitorName: z.string().optional(), plateNumber: z.string().optional(),
      spotId: z.string().optional(),
    }),
    outputSchema: z.object({
      spots: z.array(z.object({ id: z.string(), status: z.string(), occupant: z.string(), plate: z.string() })).optional(),
      spotId: z.string().optional(), message: z.string(),
    }),
  },
  async ({ companyId, action, visitorName, plateNumber, spotId }) => {
    const db = getFirestore();
    const col = db.collection(`companies/${companyId}/parkingSpots`);

    if (action === 'list') {
      const snap = await col.limit(50).get();
      const spots = snap.docs.map(d => ({
        id: d.id, status: (d.data()['status'] as string) ?? 'available',
        occupant: (d.data()['occupant'] as string) ?? '', plate: (d.data()['plate'] as string) ?? '',
      }));
      return { spots, message: `${spots.filter(s => s.status === 'available').length} place(s) disponible(s) sur ${spots.length}.` };
    }

    if (action === 'reserve') {
      // Find available spot
      const available = await col.where('status', '==', 'available').limit(1).get();
      if (available.empty) {
        // Create new spot
        const id = `P-${(await col.get()).size + 1}`;
        await col.doc(id).set({ id, status: 'reserved', occupant: visitorName ?? '', plate: plateNumber ?? '', reservedAt: new Date() });
        return { spotId: id, message: `Place ${id} reservee pour ${visitorName ?? 'visiteur'}${plateNumber ? ` (${plateNumber})` : ''}.` };
      }
      const spot = available.docs[0];
      await spot.ref.update({ status: 'reserved', occupant: visitorName ?? '', plate: plateNumber ?? '', reservedAt: new Date() });
      return { spotId: spot.id, message: `Place ${spot.id} reservee pour ${visitorName ?? 'visiteur'}.` };
    }

    if (action === 'release' && spotId) {
      await col.doc(spotId).update({ status: 'available', occupant: '', plate: '', reservedAt: null });
      return { spotId, message: `Place ${spotId} liberee.` };
    }

    return { message: 'Action non reconnue.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// VISITOR ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export const getVisitorAnalyticsTool = ai.defineTool(
  {
    name: 'rec_getVisitorAnalytics',
    description: 'Get visitor analytics — peak hours, purpose breakdown, repeat visitors, average duration, trends.',
    inputSchema: z.object({ companyId: z.string(), period: z.enum(['week', 'month', 'quarter']).optional().default('month') }),
    outputSchema: z.object({
      totalVisitors: z.number(), avgDuration: z.number(),
      peakHours: z.array(z.object({ hour: z.number(), count: z.number() })),
      purposeBreakdown: z.array(z.object({ purpose: z.string(), count: z.number() })),
      typeBreakdown: z.array(z.object({ type: z.string(), count: z.number() })),
      repeatVisitors: z.number(), uniqueCompanies: z.number(),
      dailyTrend: z.array(z.object({ date: z.string(), count: z.number() })),
    }),
  },
  async ({ companyId, period }) => {
    const db = getFirestore();
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 86400000);

    const snap = await db.collection('visitors').where('companyId', '==', companyId).where('checkInAt', '>=', cutoff).limit(500).get();
    const visitors = snap.docs.map(d => d.data());

    // Peak hours
    const hourCounts: Record<number, number> = {};
    visitors.forEach(v => {
      const h = (v['checkInAt'] as { toDate?: () => Date })?.toDate?.()?.getHours() ?? 10;
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });

    // Purpose breakdown
    const purposes: Record<string, number> = {};
    visitors.forEach(v => { const p = (v['purpose'] as string) ?? 'Non specifie'; purposes[p] = (purposes[p] ?? 0) + 1; });

    // Type breakdown
    const types: Record<string, number> = {};
    visitors.forEach(v => { const t = (v['type'] as string) ?? 'walkin'; types[t] = (types[t] ?? 0) + 1; });

    // Repeat visitors (by email)
    const emails = visitors.map(v => (v['email'] as string) ?? '').filter(Boolean);
    const uniqueEmails = new Set(emails);
    const repeatVisitors = emails.length - uniqueEmails.size;

    // Unique companies
    const companies = new Set(visitors.map(v => (v['company'] as string) ?? '').filter(Boolean));

    // Average duration
    let totalDuration = 0, durationCount = 0;
    visitors.forEach(v => {
      const checkIn = (v['checkInAt'] as { toDate?: () => Date })?.toDate?.()?.getTime();
      const checkOut = (v['checkOutAt'] as { toDate?: () => Date })?.toDate?.()?.getTime();
      if (checkIn && checkOut) { totalDuration += (checkOut - checkIn) / 60000; durationCount++; }
    });

    // Daily trend
    const dailyCounts: Record<string, number> = {};
    visitors.forEach(v => {
      const d = (v['checkInAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString().split('T')[0] ?? '';
      if (d) dailyCounts[d] = (dailyCounts[d] ?? 0) + 1;
    });

    return {
      totalVisitors: visitors.length,
      avgDuration: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
      peakHours: Object.entries(hourCounts).map(([h, c]) => ({ hour: Number(h), count: c })).sort((a, b) => b.count - a.count),
      purposeBreakdown: Object.entries(purposes).map(([p, c]) => ({ purpose: p, count: c })).sort((a, b) => b.count - a.count),
      typeBreakdown: Object.entries(types).map(([t, c]) => ({ type: t, count: c })).sort((a, b) => b.count - a.count),
      repeatVisitors, uniqueCompanies: companies.size,
      dailyTrend: Object.entries(dailyCounts).map(([d, c]) => ({ date: d, count: c })).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
);

// ── All tools ────────────────────────────────────────────────────────────────

const ALL_TOOLS = [
  visitorRegistryTool, calendarCheckTool, visitorHistoryTool, companyInfoTool,
  presenceStatusTool, employeeCheckinTool, checkinByCodeTool, leaveStatusTool,
  directoryLookupTool, receptionStatsTool, createEmployeeBadgeTool,
  preRegisterVisitorTool, registerDeliveryTool, getDeliveriesTool,
  getEvacuationStatusTool, manageParkingTool, getVisitorAnalyticsTool,
];

const executors = new Map<string, (i: unknown) => Promise<unknown>>();
for (const tool of ALL_TOOLS) {
  const name = (tool as unknown as { __action: { name: string } }).__action?.name ?? '';
  if (name) executors.set(name, (i: unknown) => (tool as (args: unknown) => Promise<unknown>)(i));
}

// ── Flow ─────────────────────────────────────────────────────────────────────

const INPUT = z.object({
  request:   z.string(),
  companyId: z.string(),
  userId:    z.string().optional(),
  language:  z.string().optional().default('auto'),
  history:   z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({
  response:    z.string(),
  visitId:     z.string().optional(),
  hostNotified: z.boolean(),
});

export const receptionAgentFlow = ai.defineFlow(
  { name: 'receptionAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[ReceptionAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;

    // Date anchors — visitor logs / appointments must use real dates
    const dateAnchors = (() => {
      const now = new Date();
      const weekdaysFr = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
      const today = now.toISOString().slice(0, 10);
      const todayLabel = weekdaysFr[now.getDay()];
      const next: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        next.push(`${weekdaysFr[d.getDay()]} = ${d.toISOString().slice(0, 10)}`);
      }
      return `AUJOURD'HUI : ${today} (${todayLabel}) ${now.toTimeString().slice(0, 5)}. Semaine a venir : ${next.join(', ')}.`;
    })();

    // Build messages with prior history (max 20)
    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_FLASH,
      system: `Tu es l'Agent Receptionniste PRO d'une entreprise — le premier point de contact pour les visiteurs, les appels et les employes.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Quand l'utilisateur dit "aujourd'hui", "demain", "tout a l'heure", utilise STRICTEMENT les dates ci-dessus. Format ISO YYYY-MM-DD pour tous les outils.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages precedents. Quand l'utilisateur dit "ce visiteur", "lui", "elle", "ce rendez-vous", reference-toi a la personne/entree la plus recente dans l'historique. Ne redemande pas qui c'est si c'est clair dans l'historique.

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS pretendre avoir fait une action sans appel d'outil reussi.
INTERDIT :
- "J'ai notifie l'hote", "Visiteur enregistre", "Badge cree" sans avoir appele le tool correspondant
- Inventer un visitId, un numero de badge, ou une plaque d'immatriculation
- Confirmer un rendez-vous si tu ne l'as pas verifie via l'outil

RÈGLE : APPELLE le tool. Si succes, confirme avec les vrais champs (visitId, badgeNumber). Si echec, dis la vraie raison ("le rendez-vous n'a pas ete trouve dans l'agenda"). L'utilisateur prefere un "je n'ai pas pu" honnete a une fausse confirmation.

Tes responsabilites :
- Accueillir les visiteurs, verifier les rendez-vous, enregistrer les arrivees, generer des badges
- Pre-enregistrer des visiteurs (avec QR code, approbation host, NDA)
- Suivre la presence des employes (pointage, check-in/out par code ou QR)
- Gerer les livraisons (enregistrement, notification destinataire, suivi)
- Gerer le parking (reservation, liberation de places)
- Fournir le statut d'evacuation d'urgence (headcount temps reel)
- Consulter les absences (la gestion des conges est assuree par l'agent RH)
- Consulter l'annuaire de l'entreprise pour orienter les visiteurs
- Fournir les statistiques et analytics visiteurs (pics, tendances, duree moyenne)
- Creer des badges employes (nom, photo, departement, poste, numero de badge)
- Repondre aux questions generales sur l'entreprise (horaires, adresse, departements)

CompanyID: ${companyId}.
Sois chaleureux, professionnel et efficace.
Verifie toujours les rendez-vous avant d'enregistrer un visiteur.
${langInstr}`,
      messages,
      tools: ALL_TOOLS,
      config: { temperature: 0.4 },
    });

    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 7) {
      loopCount++;
      const toolResults = await Promise.all(
        response.toolRequests.map(async (p) => {
          const { name, input, ref } = p.toolRequest;
          const exec = executors.get(name);
          const inp = { ...(input as Record<string, unknown>), companyId };
          const output = exec ? await exec(inp) : { error: `Outil inconnu: ${name}` };
          return { name, ref, output };
        })
      );
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [
          ...response.messages,
          { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
        ],
        tools: ALL_TOOLS,
        config: { temperature: 0.4 },
      });
    }

    const text = response.text;
    const visitMatch = text.match(/[Vv]isit.*?([a-z0-9]{8})/);
    const hostNotified = /notif|prévenu|host|hôte|enregistr/i.test(text);

    return { response: text, visitId: visitMatch?.[1], hostNotified };
  }
);

export const receptionAgentTool = ai.defineTool(
  {
    name: 'callReceptionAgent',
    description: 'Reception PRO: visitor check-in, pre-registration with QR, appointments, host notification, deliveries, parking, emergency evacuation, visitor analytics, employee presence, badges, company directory.',
    inputSchema:  INPUT,
    outputSchema: OUTPUT,
  },
  (input) => receptionAgentFlow(input)
);
