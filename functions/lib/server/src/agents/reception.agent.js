"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receptionAgentTool = exports.receptionAgentFlow = exports.getVisitorAnalyticsTool = exports.manageParkingTool = exports.getEvacuationStatusTool = exports.getDeliveriesTool = exports.registerDeliveryTool = exports.preRegisterVisitorTool = exports.receptionStatsTool = exports.createEmployeeBadgeTool = exports.directoryLookupTool = exports.leaveStatusTool = exports.checkinByCodeTool = exports.employeeCheckinTool = exports.presenceStatusTool = exports.companyInfoTool = exports.visitorHistoryTool = exports.calendarCheckTool = exports.visitorRegistryTool = void 0;
/**
 * Reception Agent — Gemini Flash
 * Accueil visiteurs, gestion des RDV, présence employés, congés, annuaire, badges.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
// ── Visitor Tools ────────────────────────────────────────────────────────────
exports.visitorRegistryTool = genkit_config_1.ai.defineTool({
    name: 'rec_registerVisitor',
    description: 'Register a visitor arrival and notify the host.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        visitorName: zod_1.z.string(),
        visitorEmail: zod_1.z.string().optional(),
        visitorCompany: zod_1.z.string().optional(),
        hostName: zod_1.z.string(),
        purpose: zod_1.z.string().optional(),
        type: zod_1.z.enum(['walkin', 'appointment', 'delivery', 'vip']).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        visitId: zod_1.z.string(),
        badgeNumber: zod_1.z.string(),
        checkInAt: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, visitorName, visitorEmail, visitorCompany, hostName, purpose, type }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const visitId = (0, helpers_1.generateId)();
    const badgeNumber = `V-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    try {
        await db.collection('visitors').doc(visitId).set({
            companyId, id: visitId, name: visitorName,
            email: visitorEmail ?? null, company: visitorCompany ?? '',
            host: hostName, purpose: purpose ?? 'Non specifie',
            type: type ?? 'walkin', badgeNumber,
            status: 'checked_in',
            checkInAt: firestore_1.FieldValue.serverTimestamp(),
            checkOutAt: null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Reception] visitor registry write failed', { error: String(err) });
        return {
            success: false, visitId: '', badgeNumber: '', checkInAt: now.toISOString(),
            message: `Enregistrement du visiteur impossible: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    return {
        success: true, visitId, badgeNumber, checkInAt: now.toISOString(),
        message: `${visitorName} enregistre(e) pour voir ${hostName}. Badge: ${badgeNumber}.`,
    };
});
exports.calendarCheckTool = genkit_config_1.ai.defineTool({
    name: 'rec_checkAppointment',
    description: 'Check if a visitor has a scheduled appointment.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        visitorName: zod_1.z.string(),
        hostName: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        hasAppointment: zod_1.z.boolean(),
        appointment: zod_1.z.object({
            time: zod_1.z.string(),
            host: zod_1.z.string(),
            location: zod_1.z.string().optional(),
        }).optional(),
    }),
}, async ({ companyId, visitorName, hostName }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('appointments')
        .where('companyId', '==', companyId)
        .where('status', '==', 'confirmed')
        .limit(50).get().catch((err) => {
        logger_1.logger.error('[Reception] checkAppointment read failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { hasAppointment: false };
    const match = snap.docs.map(d => d.data()).find(m => {
        const name = (m['visitorName'] ?? '').toLowerCase();
        const host = (m['host'] ?? '').toLowerCase();
        const nameMatch = name.includes(visitorName.toLowerCase()) || visitorName.toLowerCase().includes(name);
        const hostMatch = !hostName || host.includes(hostName.toLowerCase());
        return nameMatch && hostMatch;
    });
    if (match) {
        return {
            hasAppointment: true,
            appointment: {
                time: match['scheduledAt']?.toDate?.()?.toISOString() ?? 'Aujourd\'hui',
                host: match['host'] ?? hostName ?? 'Inconnu',
                location: match['location'],
            },
        };
    }
    return { hasAppointment: false };
});
exports.visitorHistoryTool = genkit_config_1.ai.defineTool({
    name: 'rec_getVisitorHistory',
    description: 'Get the visitor log for today or a date range.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        dateFilter: zod_1.z.enum(['today', 'week', 'month']).optional().default('today'),
    }),
    outputSchema: zod_1.z.object({
        visitors: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            host: zod_1.z.string(),
            purpose: zod_1.z.string(),
            checkInAt: zod_1.z.string(),
            status: zod_1.z.string(),
            type: zod_1.z.string(),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, dateFilter }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('visitors')
        .where('companyId', '==', companyId)
        .limit(100).get().catch((err) => {
        logger_1.logger.error('[Reception] visitor history read failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { visitors: [], total: 0 };
    const now = Date.now();
    const cutoffs = {
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - (cutoffs[dateFilter ?? 'today'] ?? cutoffs['today']);
    const visitors = snap.docs
        .map(d => d.data())
        .filter(v => {
        const t = v['checkInAt']?.toDate?.()?.getTime() ?? 0;
        return t >= cutoff;
    })
        .map(v => ({
        name: v['name'] ?? v['visitorName'] ?? '',
        host: v['host'] ?? v['hostName'] ?? '',
        purpose: v['purpose'] ?? '',
        checkInAt: v['checkInAt']?.toDate?.()?.toISOString() ?? '',
        status: v['status'] ?? 'checked_in',
        type: v['type'] ?? 'walkin',
    }));
    return { visitors, total: visitors.length };
});
exports.companyInfoTool = genkit_config_1.ai.defineTool({
    name: 'rec_getCompanyInfo',
    description: 'Get company info (address, hours, departments) to answer visitor questions.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        name: zod_1.z.string(),
        address: zod_1.z.string(),
        phone: zod_1.z.string(),
        openingHours: zod_1.z.string(),
        departments: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('companies').doc(companyId).get().catch((err) => {
        logger_1.logger.error('[Reception] company info read failed', { error: String(err) });
        return null;
    });
    const d = doc?.data() ?? {};
    return {
        name: d['name'] ?? 'The Company',
        address: d['address'] ?? 'Adresse non configuree',
        phone: d['phone'] ?? 'Telephone non configure',
        openingHours: d['openingHours'] ?? 'Lundi-Vendredi 9:00-18:00',
        departments: d['departments'] ?? ['Direction', 'RH', 'IT', 'Commercial', 'Marketing'],
    };
});
// ── Presence Tools ───────────────────────────────────────────────────────────
exports.presenceStatusTool = genkit_config_1.ai.defineTool({
    name: 'rec_getPresenceStatus',
    description: 'Get current employee presence status — who is present today, who is absent.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        present: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), department: zod_1.z.string(), checkInAt: zod_1.z.string() })),
        totalPresent: zod_1.z.number(),
        totalEmployees: zod_1.z.number(),
        presenceRate: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const today = new Date().toISOString().split('T')[0];
    const pSnap = await db.collection('presence')
        .where('companyId', '==', companyId)
        .where('date', '==', today)
        .limit(200).get().catch((err) => {
        logger_1.logger.error('[Reception] presence read failed', { error: String(err) });
        return null;
    });
    const present = (pSnap?.docs ?? [])
        .filter(d => d.data()['status'] === 'present')
        .map(d => ({
        name: d.data()['employeeName'] ?? '',
        department: d.data()['department'] ?? '',
        checkInAt: d.data()['checkInAt']?.toDate?.()?.toISOString() ?? '',
    }));
    let totalEmployees = 0;
    try {
        const uSnap = await db.collection('users')
            .where('companyId', '==', companyId).get();
        totalEmployees = uSnap.size;
    }
    catch (err) {
        logger_1.logger.error('[Reception] users count read failed', { error: String(err) });
    }
    return {
        present,
        totalPresent: present.length,
        totalEmployees,
        presenceRate: totalEmployees > 0 ? Math.round((present.length / totalEmployees) * 100) : 0,
    };
});
exports.employeeCheckinTool = genkit_config_1.ai.defineTool({
    name: 'rec_checkinEmployee',
    description: 'Check in an employee for the day (mark them as present).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeId: zod_1.z.string(),
        employeeName: zod_1.z.string(),
        department: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, employeeId, employeeName, department }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const today = new Date().toISOString().split('T')[0];
    const id = `${employeeId}_${today}`;
    const existing = await db.collection('presence').doc(id).get().catch(() => null);
    if (existing?.exists) {
        return { success: false, message: `${employeeName} est deja pointe(e) aujourd'hui.` };
    }
    try {
        await db.collection('presence').doc(id).set({
            companyId, employeeId, employeeName,
            department: department ?? '',
            date: today,
            checkInAt: firestore_1.FieldValue.serverTimestamp(),
            checkOutAt: null,
            status: 'present',
        });
    }
    catch (err) {
        logger_1.logger.error('[Reception] employee checkin write failed', { error: String(err) });
        return { success: false, message: 'Pointage impossible.' };
    }
    return { success: true, message: `${employeeName} pointe(e) comme present(e).` };
});
exports.checkinByCodeTool = genkit_config_1.ai.defineTool({
    name: 'rec_checkinByCode',
    description: 'Check in or out an employee using their 6-digit code. First use = arrival, second use = departure.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        code: zod_1.z.string().describe('6-digit employee code'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        action: zod_1.z.string(),
        employeeName: zod_1.z.string(),
        hoursWorked: zod_1.z.number().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, code }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('users')
        .where('companyId', '==', companyId)
        .where('employeeCode', '==', code)
        .where('codeActive', '==', true)
        .limit(1).get().catch((err) => {
        logger_1.logger.error('[Reception] code lookup read failed', { error: String(err) });
        return null;
    });
    if (!snap || snap.empty) {
        return { success: false, action: 'error', employeeName: '', message: 'Code invalide ou revoque.' };
    }
    const employee = snap.docs[0];
    const empData = employee.data();
    const employeeId = employee.id;
    const employeeName = empData['displayName'] ?? empData['email'] ?? '';
    const today = new Date().toISOString().split('T')[0];
    const presenceId = `${employeeId}_${today}`;
    const existing = await db.collection('presence').doc(presenceId).get().catch(() => null);
    if (existing?.exists) {
        if (existing.data()?.status === 'present') {
            const checkIn = existing.data()?.checkInAt?.toDate?.() ?? existing.data()?.checkInAt;
            const checkOut = new Date();
            const hoursWorked = checkIn ? parseFloat(((checkOut.getTime() - new Date(checkIn).getTime()) / 3600000).toFixed(2)) : 0;
            try {
                await db.collection('presence').doc(presenceId).update({ checkOutAt: checkOut, status: 'checked_out', hoursWorked });
            }
            catch (err) {
                logger_1.logger.error('[Reception] checkout update failed', { error: String(err) });
                return { success: false, action: 'error', employeeName, message: 'Pointage de depart impossible.' };
            }
            return { success: true, action: 'checkout', employeeName, hoursWorked, message: `${employeeName} a pointe son depart (${hoursWorked}h).` };
        }
        return { success: true, action: 'already_done', employeeName, message: `${employeeName} a deja termine sa journee.` };
    }
    try {
        await db.collection('presence').doc(presenceId).set({
            companyId, employeeId, employeeName,
            employeeEmail: empData['email'] ?? '',
            department: empData['department'] ?? '',
            date: today,
            checkInAt: firestore_1.FieldValue.serverTimestamp(),
            checkOutAt: null,
            status: 'present',
        });
    }
    catch (err) {
        logger_1.logger.error('[Reception] checkinByCode write failed', { error: String(err) });
        return { success: false, action: 'error', employeeName, message: 'Pointage impossible.' };
    }
    return { success: true, action: 'checkin', employeeName, message: `${employeeName} pointe(e) comme present(e).` };
});
// ── Leave Tools ──────────────────────────────────────────────────────────────
exports.leaveStatusTool = genkit_config_1.ai.defineTool({
    name: 'rec_getLeaveRequests',
    description: 'Get approved leaves to know who is absent today/this week. Read-only — leave management is handled by HR.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        status: zod_1.z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('pending'),
    }),
    outputSchema: zod_1.z.object({
        requests: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            employeeName: zod_1.z.string(),
            type: zod_1.z.string(),
            startDate: zod_1.z.string(),
            endDate: zod_1.z.string(),
            reason: zod_1.z.string(),
            status: zod_1.z.string(),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, status }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let query = db.collection('leaves').where('companyId', '==', companyId);
    if (status !== 'all') {
        query = query.where('status', '==', status);
    }
    const snap = await query.limit(100).get().catch((err) => {
        logger_1.logger.error('[Reception] leave requests read failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { requests: [], total: 0 };
    const requests = snap.docs.map(d => ({
        id: d.id,
        employeeName: d.data()['employeeName'] ?? '',
        type: d.data()['type'] ?? 'vacation',
        startDate: d.data()['startDate'] ?? '',
        endDate: d.data()['endDate'] ?? '',
        reason: d.data()['reason'] ?? '',
        status: d.data()['status'] ?? 'pending',
    }));
    return { requests, total: requests.length };
});
// ── Directory Tool ───────────────────────────────────────────────────────────
exports.directoryLookupTool = genkit_config_1.ai.defineTool({
    name: 'rec_lookupEmployee',
    description: 'Look up an employee in the company directory by name, department, or role.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        query: zod_1.z.string().describe('Name, department, or role to search for'),
    }),
    outputSchema: zod_1.z.object({
        results: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            email: zod_1.z.string(),
            department: zod_1.z.string(),
            phone: zod_1.z.string(),
            title: zod_1.z.string(),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, query }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('users')
        .where('companyId', '==', companyId)
        .limit(200).get().catch((err) => {
        logger_1.logger.error('[Reception] directory lookup read failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { results: [], total: 0 };
    const q = query.toLowerCase();
    const results = snap.docs
        .map(d => d.data())
        .filter(u => {
        const name = (u['displayName'] ?? '').toLowerCase();
        const dept = (u['department'] ?? '').toLowerCase();
        const role = (u['role'] ?? '').toLowerCase();
        const title = (u['jobTitle'] ?? '').toLowerCase();
        return name.includes(q) || dept.includes(q) || role.includes(q) || title.includes(q);
    })
        .map(u => ({
        name: u['displayName'] ?? '',
        email: u['email'] ?? '',
        department: u['department'] ?? '',
        phone: u['phone'] ?? '',
        title: u['jobTitle'] ?? '',
    }));
    return { results, total: results.length };
});
// ── Employee Badge Tool ─────────────────────────────────────────────────────
exports.createEmployeeBadgeTool = genkit_config_1.ai.defineTool({
    name: 'rec_createEmployeeBadge',
    description: 'Create an employee badge — look up employee info from directory and generate a badge with name, photo, department, job title, and badge number.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeId: zod_1.z.string().optional().describe('Employee user ID if known'),
        employeeName: zod_1.z.string().optional().describe('Employee name to search for if ID not known'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        badgeId: zod_1.z.string().optional(),
        badgeNumber: zod_1.z.string().optional(),
        employeeName: zod_1.z.string(),
        department: zod_1.z.string(),
        jobTitle: zod_1.z.string(),
        photoURL: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, employeeId, employeeName }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Find employee
    let empDoc;
    let empData;
    let resolvedId = employeeId;
    if (employeeId) {
        empDoc = await db.collection('users').doc(employeeId).get().catch(() => null);
        if (!empDoc?.exists) {
            return { success: false, employeeName: '', department: '', jobTitle: '', message: 'Employe non trouve avec cet ID.' };
        }
        empData = empDoc.data();
    }
    else if (employeeName) {
        const snap = await db.collection('users')
            .where('companyId', '==', companyId)
            .limit(200).get().catch((err) => {
            logger_1.logger.error('[Reception] badge employee lookup failed', { error: String(err) });
            return null;
        });
        if (!snap) {
            return { success: false, employeeName: employeeName ?? '', department: '', jobTitle: '', message: 'Lecture de l\'annuaire impossible.' };
        }
        const q = employeeName.toLowerCase();
        const match = snap.docs.find(d => {
            const name = (d.data()['displayName'] ?? '').toLowerCase();
            return name.includes(q) || q.includes(name);
        });
        if (!match) {
            return { success: false, employeeName: employeeName ?? '', department: '', jobTitle: '', message: `Aucun employe trouve avec le nom "${employeeName}".` };
        }
        resolvedId = match.id;
        empData = match.data();
    }
    else {
        return { success: false, employeeName: '', department: '', jobTitle: '', message: 'Veuillez fournir un ID ou un nom d\'employe.' };
    }
    // Check if badge already exists
    const existingSnap = await db.collection('employeeBadges')
        .where('companyId', '==', companyId)
        .where('employeeId', '==', resolvedId)
        .where('status', '==', 'active')
        .limit(1).get().catch((err) => {
        logger_1.logger.error('[Reception] badge existence check failed', { error: String(err) });
        return null;
    });
    if (existingSnap && !existingSnap.empty) {
        const existing = existingSnap.docs[0].data();
        return {
            success: true,
            badgeId: existingSnap.docs[0].id,
            badgeNumber: existing['badgeNumber'] ?? '',
            employeeName: existing['employeeName'] ?? '',
            department: existing['department'] ?? '',
            jobTitle: existing['jobTitle'] ?? '',
            photoURL: existing['photoURL'] ?? undefined,
            message: `Badge existant : ${existing['badgeNumber']}. L'employe a deja un badge actif.`,
        };
    }
    // Create badge
    const badgeId = (0, helpers_1.generateId)();
    const badgeNumber = `EMP-${Date.now().toString().slice(-6)}`;
    const name = empData['displayName'] ?? empData['email'] ?? '';
    const department = empData['department'] ?? '';
    const jobTitle = empData['jobTitle'] ?? '';
    const photoURL = empData['photoURL'] ?? undefined;
    try {
        await db.collection('employeeBadges').doc(badgeId).set({
            companyId,
            employeeId: resolvedId,
            badgeNumber,
            employeeName: name,
            department,
            jobTitle,
            email: empData['email'] ?? '',
            phone: empData['phone'] ?? '',
            photoURL: photoURL ?? null,
            status: 'active',
            issuedAt: firestore_1.FieldValue.serverTimestamp(),
            expiresAt: null,
            createdBy: 'agent',
        });
    }
    catch (err) {
        logger_1.logger.error('[Reception] badge create failed', { error: String(err) });
        return { success: false, employeeName: name, department, jobTitle, message: 'Creation du badge impossible.' };
    }
    try {
        await db.collection('users').doc(resolvedId).update({
            badgeId, badgeNumber, badgeIssuedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.warn('[Reception] badge user update failed (non-blocking)', { error: String(err) });
    }
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
});
// ── Reception Stats Tool ─────────────────────────────────────────────────────
exports.receptionStatsTool = genkit_config_1.ai.defineTool({
    name: 'rec_getStats',
    description: 'Get reception dashboard stats — visitor count, presence rate, appointments, pending leaves.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        visitorsToday: zod_1.z.number(),
        visitorsPresent: zod_1.z.number(),
        employeesPresent: zod_1.z.number(),
        presenceRate: zod_1.z.number(),
        appointmentsToday: zod_1.z.number(),
        pendingLeaves: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    let visitorsToday = 0, visitorsPresent = 0;
    try {
        const snap = await db.collection('visitors')
            .where('companyId', '==', companyId)
            .where('checkInAt', '>=', startOfDay)
            .where('checkInAt', '<=', endOfDay).get();
        visitorsToday = snap.size;
        visitorsPresent = snap.docs.filter(d => d.data()['status'] === 'checked_in').length;
    }
    catch { }
    let employeesPresent = 0, totalEmps = 0;
    try {
        const pSnap = await db.collection('presence')
            .where('companyId', '==', companyId)
            .where('date', '==', today).get();
        employeesPresent = pSnap.docs.filter(d => d.data()['status'] === 'present').length;
    }
    catch { }
    try {
        totalEmps = (await db.collection('users').where('companyId', '==', companyId).get()).size;
    }
    catch { }
    let appointmentsToday = 0;
    try {
        appointmentsToday = (await db.collection('appointments')
            .where('companyId', '==', companyId)
            .where('scheduledAt', '>=', startOfDay)
            .where('scheduledAt', '<=', endOfDay).get()).size;
    }
    catch { }
    let pendingLeaves = 0;
    try {
        pendingLeaves = (await db.collection('leaves')
            .where('companyId', '==', companyId)
            .where('status', '==', 'pending').get()).size;
    }
    catch { }
    return {
        visitorsToday, visitorsPresent, employeesPresent,
        presenceRate: totalEmps > 0 ? Math.round((employeesPresent / totalEmps) * 100) : 0,
        appointmentsToday, pendingLeaves,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRE-REGISTRATION (visiteur s'inscrit en avance, host approuve)
// ══════════════════════════════════════════════════════════════════════════════
exports.preRegisterVisitorTool = genkit_config_1.ai.defineTool({
    name: 'rec_preRegisterVisitor',
    description: 'Pre-register a visitor for a future visit — sends confirmation email, notifies host for approval.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), visitorName: zod_1.z.string(), visitorEmail: zod_1.z.string(),
        visitorCompany: zod_1.z.string().optional(), hostName: zod_1.z.string(), hostEmail: zod_1.z.string().optional(),
        purpose: zod_1.z.string().optional(), scheduledDate: zod_1.z.string(), scheduledTime: zod_1.z.string().optional(),
        requiresNDA: zod_1.z.boolean().optional(), requiresParking: zod_1.z.boolean().optional(),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        registrationId: zod_1.z.string(), qrCode: zod_1.z.string(), status: zod_1.z.string(), message: zod_1.z.string(),
    }),
}, async ({ companyId, visitorName, visitorEmail, visitorCompany, hostName, hostEmail, purpose, scheduledDate, scheduledTime, requiresNDA, requiresParking, notes }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    const qrCode = `PRE-${id.slice(0, 8).toUpperCase()}`;
    try {
        await db.collection(`companies/${companyId}/preRegistrations`).doc(id).set({
            id, visitorName, visitorEmail, visitorCompany: visitorCompany ?? '',
            hostName, hostEmail: hostEmail ?? '', purpose: purpose ?? '',
            scheduledDate, scheduledTime: scheduledTime ?? '09:00',
            requiresNDA: requiresNDA ?? false, requiresParking: requiresParking ?? false,
            notes: notes ?? '', qrCode, status: 'pending_approval',
            ndaSigned: false, checkedIn: false,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[Reception] pre-registration write failed', { error: String(err) });
        return {
            success: false, registrationId: '', qrCode: '', status: 'error',
            message: `Pre-enregistrement impossible: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    return {
        success: true,
        registrationId: id, qrCode, status: 'pending_approval',
        message: `Pre-enregistrement cree pour ${visitorName} le ${scheduledDate}. QR: ${qrCode}. En attente d'approbation par ${hostName}.`,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// DELIVERY MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
exports.registerDeliveryTool = genkit_config_1.ai.defineTool({
    name: 'rec_registerDelivery',
    description: 'Register an incoming delivery — track carrier, items, recipient, signature.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), carrier: zod_1.z.string(), trackingNumber: zod_1.z.string().optional(),
        itemCount: zod_1.z.number().optional().default(1), description: zod_1.z.string().optional(),
        recipientName: zod_1.z.string(), recipientDepartment: zod_1.z.string().optional(),
        signed: zod_1.z.boolean().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), deliveryId: zod_1.z.string(), status: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, carrier, trackingNumber, itemCount, description, recipientName, recipientDepartment, signed }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    try {
        await db.collection(`companies/${companyId}/deliveries`).doc(id).set({
            id, carrier, trackingNumber: trackingNumber ?? '', itemCount: itemCount ?? 1,
            description: description ?? '', recipientName, recipientDepartment: recipientDepartment ?? '',
            signed: signed ?? false, status: 'received',
            receivedAt: firestore_1.FieldValue.serverTimestamp(), collectedAt: null,
        });
    }
    catch (err) {
        logger_1.logger.error('[Reception] delivery write failed', { error: String(err) });
        return { success: false, deliveryId: '', status: 'error', message: 'Enregistrement de la livraison impossible.' };
    }
    return { success: true, deliveryId: id, status: 'received', message: `Livraison ${carrier} enregistree — ${itemCount} colis pour ${recipientName}. En attente de collecte.` };
});
exports.getDeliveriesTool = genkit_config_1.ai.defineTool({
    name: 'rec_getDeliveries',
    description: 'List deliveries — pending, collected, or all.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), status: zod_1.z.enum(['pending', 'collected', 'all']).optional().default('pending') }),
    outputSchema: zod_1.z.object({ deliveries: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), carrier: zod_1.z.string(), recipientName: zod_1.z.string(), itemCount: zod_1.z.number(), status: zod_1.z.string(), receivedAt: zod_1.z.string() })), total: zod_1.z.number() }),
}, async ({ companyId, status }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/deliveries`);
    if (status === 'pending')
        q = q.where('status', '==', 'received');
    else if (status === 'collected')
        q = q.where('status', '==', 'collected');
    const snap = await q.orderBy('receivedAt', 'desc').limit(50).get().catch((err) => {
        logger_1.logger.error('[Reception] deliveries read failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { deliveries: [], total: 0 };
    const deliveries = snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id, carrier: data['carrier'] ?? '', recipientName: data['recipientName'] ?? '',
            itemCount: data['itemCount'] ?? 1, status: data['status'] ?? 'received',
            receivedAt: data['receivedAt']?.toDate?.()?.toISOString() ?? '',
        };
    });
    return { deliveries, total: deliveries.length };
});
// ══════════════════════════════════════════════════════════════════════════════
// EMERGENCY EVACUATION
// ══════════════════════════════════════════════════════════════════════════════
exports.getEvacuationStatusTool = genkit_config_1.ai.defineTool({
    name: 'rec_getEvacuationStatus',
    description: 'Get real-time headcount for emergency evacuation — visitors + employees currently in building.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalInBuilding: zod_1.z.number(),
        employees: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), department: zod_1.z.string() })),
        visitors: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), host: zod_1.z.string(), company: zod_1.z.string() })),
        employeeCount: zod_1.z.number(), visitorCount: zod_1.z.number(),
        lastUpdated: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const today = new Date().toISOString().split('T')[0];
    // Present employees
    const presSnap = await db.collection('presence').where('companyId', '==', companyId).where('date', '==', today).where('status', '==', 'present').limit(500).get().catch((err) => {
        logger_1.logger.error('[Reception] evacuation presence read failed', { error: String(err) });
        return null;
    });
    const employees = (presSnap?.docs ?? []).map(d => ({
        name: d.data()['employeeName'] ?? '', department: d.data()['department'] ?? '',
    }));
    // Checked-in visitors
    const visSnap = await db.collection('visitors').where('companyId', '==', companyId).where('status', '==', 'checked_in').limit(100).get().catch((err) => {
        logger_1.logger.error('[Reception] evacuation visitors read failed', { error: String(err) });
        return null;
    });
    const visitors = (visSnap?.docs ?? []).map(d => ({
        name: d.data()['name'] ?? '', host: d.data()['host'] ?? '',
        company: d.data()['company'] ?? '',
    }));
    return {
        totalInBuilding: employees.length + visitors.length,
        employees, visitors, employeeCount: employees.length, visitorCount: visitors.length,
        lastUpdated: new Date().toISOString(),
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PARKING MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
exports.manageParkingTool = genkit_config_1.ai.defineTool({
    name: 'rec_manageParking',
    description: 'Reserve or release a parking spot for a visitor or employee.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), action: zod_1.z.enum(['reserve', 'release', 'list']),
        visitorName: zod_1.z.string().optional(), plateNumber: zod_1.z.string().optional(),
        spotId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        spots: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), status: zod_1.z.string(), occupant: zod_1.z.string(), plate: zod_1.z.string() })).optional(),
        spotId: zod_1.z.string().optional(), message: zod_1.z.string(),
    }),
}, async ({ companyId, action, visitorName, plateNumber, spotId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const col = db.collection(`companies/${companyId}/parkingSpots`);
    if (action === 'list') {
        const snap = await col.limit(50).get().catch((err) => {
            logger_1.logger.error('[Reception] parking list read failed', { error: String(err) });
            return null;
        });
        if (!snap)
            return { success: false, message: 'Lecture des places de parking impossible.' };
        const spots = snap.docs.map(d => ({
            id: d.id, status: d.data()['status'] ?? 'available',
            occupant: d.data()['occupant'] ?? '', plate: d.data()['plate'] ?? '',
        }));
        return { success: true, spots, message: `${spots.filter(s => s.status === 'available').length} place(s) disponible(s) sur ${spots.length}.` };
    }
    if (action === 'reserve') {
        // Find available spot
        const available = await col.where('status', '==', 'available').limit(1).get().catch((err) => {
            logger_1.logger.error('[Reception] parking reserve read failed', { error: String(err) });
            return null;
        });
        if (!available)
            return { success: false, message: 'Recherche de place impossible.' };
        if (available.empty) {
            // Create new spot
            try {
                const allSnap = await col.get();
                const id = `P-${allSnap.size + 1}`;
                await col.doc(id).set({ id, status: 'reserved', occupant: visitorName ?? '', plate: plateNumber ?? '', reservedAt: new Date() });
                return { success: true, spotId: id, message: `Place ${id} reservee pour ${visitorName ?? 'visiteur'}${plateNumber ? ` (${plateNumber})` : ''}.` };
            }
            catch (err) {
                logger_1.logger.error('[Reception] parking create failed', { error: String(err) });
                return { success: false, message: 'Reservation de place impossible.' };
            }
        }
        const spot = available.docs[0];
        try {
            await spot.ref.update({ status: 'reserved', occupant: visitorName ?? '', plate: plateNumber ?? '', reservedAt: new Date() });
        }
        catch (err) {
            logger_1.logger.error('[Reception] parking reserve update failed', { error: String(err) });
            return { success: false, message: 'Reservation de place impossible.' };
        }
        return { success: true, spotId: spot.id, message: `Place ${spot.id} reservee pour ${visitorName ?? 'visiteur'}.` };
    }
    if (action === 'release' && spotId) {
        try {
            await col.doc(spotId).update({ status: 'available', occupant: '', plate: '', reservedAt: null });
        }
        catch (err) {
            logger_1.logger.error('[Reception] parking release failed', { error: String(err) });
            return { success: false, message: 'Liberation de place impossible.' };
        }
        return { success: true, spotId, message: `Place ${spotId} liberee.` };
    }
    return { success: false, message: 'Action non reconnue.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// VISITOR ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
exports.getVisitorAnalyticsTool = genkit_config_1.ai.defineTool({
    name: 'rec_getVisitorAnalytics',
    description: 'Get visitor analytics — peak hours, purpose breakdown, repeat visitors, average duration, trends.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), period: zod_1.z.enum(['week', 'month', 'quarter']).optional().default('month') }),
    outputSchema: zod_1.z.object({
        totalVisitors: zod_1.z.number(), avgDuration: zod_1.z.number(),
        peakHours: zod_1.z.array(zod_1.z.object({ hour: zod_1.z.number(), count: zod_1.z.number() })),
        purposeBreakdown: zod_1.z.array(zod_1.z.object({ purpose: zod_1.z.string(), count: zod_1.z.number() })),
        typeBreakdown: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), count: zod_1.z.number() })),
        repeatVisitors: zod_1.z.number(), uniqueCompanies: zod_1.z.number(),
        dailyTrend: zod_1.z.array(zod_1.z.object({ date: zod_1.z.string(), count: zod_1.z.number() })),
    }),
}, async ({ companyId, period }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const cutoff = new Date(Date.now() - days * 86400000);
    const snap = await db.collection('visitors').where('companyId', '==', companyId).where('checkInAt', '>=', cutoff).limit(500).get().catch((err) => {
        logger_1.logger.error('[Reception] visitor analytics read failed', { error: String(err) });
        return null;
    });
    if (!snap) {
        return {
            totalVisitors: 0, avgDuration: 0,
            peakHours: [], purposeBreakdown: [], typeBreakdown: [],
            repeatVisitors: 0, uniqueCompanies: 0, dailyTrend: [],
        };
    }
    const visitors = snap.docs.map(d => d.data());
    // Peak hours
    const hourCounts = {};
    visitors.forEach(v => {
        const h = v['checkInAt']?.toDate?.()?.getHours() ?? 10;
        hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    });
    // Purpose breakdown
    const purposes = {};
    visitors.forEach(v => { const p = v['purpose'] ?? 'Non specifie'; purposes[p] = (purposes[p] ?? 0) + 1; });
    // Type breakdown
    const types = {};
    visitors.forEach(v => { const t = v['type'] ?? 'walkin'; types[t] = (types[t] ?? 0) + 1; });
    // Repeat visitors (by email)
    const emails = visitors.map(v => v['email'] ?? '').filter(Boolean);
    const uniqueEmails = new Set(emails);
    const repeatVisitors = emails.length - uniqueEmails.size;
    // Unique companies
    const companies = new Set(visitors.map(v => v['company'] ?? '').filter(Boolean));
    // Average duration
    let totalDuration = 0, durationCount = 0;
    visitors.forEach(v => {
        const checkIn = v['checkInAt']?.toDate?.()?.getTime();
        const checkOut = v['checkOutAt']?.toDate?.()?.getTime();
        if (checkIn && checkOut) {
            totalDuration += (checkOut - checkIn) / 60000;
            durationCount++;
        }
    });
    // Daily trend
    const dailyCounts = {};
    visitors.forEach(v => {
        const d = v['checkInAt']?.toDate?.()?.toISOString().split('T')[0] ?? '';
        if (d)
            dailyCounts[d] = (dailyCounts[d] ?? 0) + 1;
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
});
// ── All tools ────────────────────────────────────────────────────────────────
const ALL_TOOLS = [
    exports.visitorRegistryTool, exports.calendarCheckTool, exports.visitorHistoryTool, exports.companyInfoTool,
    exports.presenceStatusTool, exports.employeeCheckinTool, exports.checkinByCodeTool, exports.leaveStatusTool,
    exports.directoryLookupTool, exports.receptionStatsTool, exports.createEmployeeBadgeTool,
    exports.preRegisterVisitorTool, exports.registerDeliveryTool, exports.getDeliveriesTool,
    exports.getEvacuationStatusTool, exports.manageParkingTool, exports.getVisitorAnalyticsTool,
];
const executors = new Map();
for (const tool of ALL_TOOLS) {
    const name = tool.__action?.name ?? '';
    if (name)
        executors.set(name, (i) => tool(i));
}
// ── Flow ─────────────────────────────────────────────────────────────────────
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    visitId: zod_1.z.string().optional(),
    hostNotified: zod_1.z.boolean(),
});
exports.receptionAgentFlow = genkit_config_1.ai.defineFlow({ name: 'receptionAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, language, history }) => {
    logger_1.logger.info(`[ReceptionAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;
    // Date anchors — visitor logs / appointments must use real dates
    const dateAnchors = (() => {
        const now = new Date();
        const weekdaysFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const today = now.toISOString().slice(0, 10);
        const todayLabel = weekdaysFr[now.getDay()];
        const next = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            next.push(`${weekdaysFr[d.getDay()]} = ${d.toISOString().slice(0, 10)}`);
        }
        return `AUJOURD'HUI : ${today} (${todayLabel}) ${now.toTimeString().slice(0, 5)}. Semaine a venir : ${next.join(', ')}.`;
    })();
    // Build messages with prior history (max 20)
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20))
            messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
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
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = executors.get(name);
            const inp = { ...input, companyId };
            const output = exec ? await exec(inp) : { error: `Outil inconnu: ${name}` };
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [
                ...response.messages,
                { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) },
            ],
            tools: ALL_TOOLS,
            config: { temperature: 0.4 },
        });
    }
    const text = response.text;
    const visitMatch = text.match(/[Vv]isit.*?([a-z0-9]{8})/);
    const hostNotified = /notif|prévenu|host|hôte|enregistr/i.test(text);
    return { response: text, visitId: visitMatch?.[1], hostNotified };
});
exports.receptionAgentTool = genkit_config_1.ai.defineTool({
    name: 'callReceptionAgent',
    description: 'Reception PRO: visitor check-in, pre-registration with QR, appointments, host notification, deliveries, parking, emergency evacuation, visitor analytics, employee presence, badges, company directory.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.receptionAgentFlow)(input));
//# sourceMappingURL=reception.agent.js.map