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
exports.hrAgentTool = exports.hrAgentFlow = exports.sendContractForSignatureTool = exports.employeeSurveyTool = exports.employeeAnalyticsTool = exports.offboardingTool = exports.createPerformanceReviewTool = exports.getOrgChartTool = exports.employeeDirectoryTool = exports.onboardingChecklistTool = exports.policySearchTool = exports.publishJobTool = exports.createHRTicketTool = exports.attendanceSummaryTool = exports.teamCalendarTool = exports.updateEmployeeTool = exports.hrSendEmailTool = exports.createEmployeeTool = exports.generateContractTool = exports.generateEmployeeUploadLinkTool = exports.listEmployeePortfolioTool = exports.uploadEmployeeDocTool = exports.generatePayslipTool = exports.generateCertificateTool = exports.listEmployeeDocsTool = exports.employeeProfileTool = exports.scheduleInterviewTool = exports.listCandidatesTool = exports.addCandidateTool = exports.listJobsTool = exports.createJobPostingTool = exports.leaveStatusTool = exports.leaveRequestTool = exports.leaveBalanceTool = void 0;
/**
 * HR Agent V1+ — Gemini Flash
 * Full HR: conges, recrutement, profil employe, documents RH, calendrier equipe,
 * presence, onboarding, annuaire, politiques, tickets RH.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
// ══════════════════════════════════════════════════════════════════════════════
// 1. CONGES (existants, ameliores)
// ══════════════════════════════════════════════════════════════════════════════
exports.leaveBalanceTool = genkit_config_1.ai.defineTool({
    name: 'hr_getLeaveBalance',
    description: 'Get employee leave balance (paid leave, sick, RTT, etc.).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(), paidLeave: zod_1.z.number(), sickDays: zod_1.z.number(), rtt: zod_1.z.number(), other: zod_1.z.number(), year: zod_1.z.number() }),
}, async ({ companyId, userId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const year = new Date().getFullYear();
    const doc = await db.collection(`companies/${companyId}/leaveBalances`).doc(`${userId}_${year}`).get().catch(() => null);
    if (doc?.exists) {
        const d = doc.data();
        return { success: true, paidLeave: d['paidLeave'] ?? 25, sickDays: d['sickDays'] ?? 0, rtt: d['rtt'] ?? 10, other: d['other'] ?? 0, year };
    }
    return { success: true, paidLeave: 25, sickDays: 0, rtt: 10, other: 0, year };
});
exports.leaveRequestTool = genkit_config_1.ai.defineTool({
    name: 'hr_submitLeaveRequest',
    description: 'Submit a leave request. Requires manager approval.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), userId: zod_1.z.string(),
        type: zod_1.z.enum(['paid', 'sick', 'rtt', 'unpaid', 'other']).default('paid'),
        startDate: zod_1.z.string(), endDate: zod_1.z.string(), reason: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), requestId: zod_1.z.string(), status: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, userId, type, startDate, endDate, reason }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    // Get employee name
    let empName = '';
    try {
        const u = await db.collection('users').doc(userId).get();
        empName = u.data()?.['displayName'] ?? '';
    }
    catch { }
    try {
        await db.collection(`companies/${companyId}/leaveRequests`).doc(id).set({
            id, userId, employeeName: empName, type, startDate, endDate,
            reason: reason ?? '', status: 'pending',
            submittedAt: firestore_1.FieldValue.serverTimestamp(), createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] submitLeaveRequest write failed', { error: String(err) });
        return { success: false, requestId: '', status: 'error', message: 'Sauvegarde de la demande de congé impossible.' };
    }
    return { success: true, requestId: id, status: 'pending', message: `Demande #${id.slice(0, 8)} soumise (${type}, ${startDate} → ${endDate}). En attente d'approbation manager.` };
});
exports.leaveStatusTool = genkit_config_1.ai.defineTool({
    name: 'hr_getLeaveRequestStatus',
    description: 'Check the status of a leave request or list pending requests for a user.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string(), requestId: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(),
        requests: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), type: zod_1.z.string(), startDate: zod_1.z.string(), endDate: zod_1.z.string(), status: zod_1.z.string(), reason: zod_1.z.string() })),
    }),
}, async ({ companyId, userId, requestId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    if (requestId) {
        const doc = await db.collection(`companies/${companyId}/leaveRequests`).doc(requestId).get().catch(() => null);
        if (!doc?.exists)
            return { success: true, requests: [] };
        const d = doc.data();
        return { success: true, requests: [{ id: doc.id, type: d['type'] ?? '', startDate: d['startDate'] ?? '', endDate: d['endDate'] ?? '', status: d['status'] ?? '', reason: d['reason'] ?? '' }] };
    }
    const snap = await db.collection(`companies/${companyId}/leaveRequests`).where('userId', '==', userId).orderBy('createdAt', 'desc').limit(10).get().catch((err) => {
        logger_1.logger.error('[HR] getLeaveRequestStatus query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des demandes impossible.', requests: [] };
    return { success: true, requests: snap.docs.map(d => { const x = d.data(); return { id: d.id, type: x['type'] ?? '', startDate: x['startDate'] ?? '', endDate: x['endDate'] ?? '', status: x['status'] ?? '', reason: x['reason'] ?? '' }; }) };
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. RECRUTEMENT (nouveau)
// ══════════════════════════════════════════════════════════════════════════════
exports.createJobPostingTool = genkit_config_1.ai.defineTool({
    name: 'hr_createJobPosting',
    description: 'Create a new job posting / job offer.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), title: zod_1.z.string(), department: zod_1.z.string().optional(),
        description: zod_1.z.string(), requirements: zod_1.z.string().optional(),
        employmentType: zod_1.z.enum(['full-time', 'part-time', 'contract', 'internship']).optional().default('full-time'),
        location: zod_1.z.string().optional(), salary: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), jobId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, title, department, description, requirements, employmentType, location, salary }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    try {
        await db.collection(`companies/${companyId}/jobPostings`).doc(id).set({
            id, title, department: department ?? '', description, requirements: requirements ?? '',
            employmentType, location: location ?? '', salary: salary ?? '',
            status: 'open', applicantCount: 0,
            createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] createJobPosting write failed', { error: String(err) });
        return { success: false, jobId: '', message: 'Sauvegarde de l\'offre impossible.' };
    }
    return { success: true, jobId: id, message: `Offre "${title}" creee (${employmentType}). Statut: ouverte.` };
});
exports.listJobsTool = genkit_config_1.ai.defineTool({
    name: 'hr_listJobs',
    description: 'List open job postings for the company.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), status: zod_1.z.enum(['open', 'closed', 'all']).optional().default('open') }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(), jobs: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), department: zod_1.z.string(), status: zod_1.z.string(), applicantCount: zod_1.z.number() })) }),
}, async ({ companyId, status }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/jobPostings`);
    if (status !== 'all')
        q = q.where('status', '==', status);
    const snap = await q.limit(50).get().catch((err) => {
        logger_1.logger.error('[HR] listJobs query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des offres impossible.', jobs: [] };
    return { success: true, jobs: snap.docs.map(d => { const x = d.data(); return { id: d.id, title: x['title'] ?? '', department: x['department'] ?? '', status: x['status'] ?? '', applicantCount: x['applicantCount'] ?? 0 }; }) };
});
exports.addCandidateTool = genkit_config_1.ai.defineTool({
    name: 'hr_addCandidate',
    description: 'Add a candidate to a job posting. Score their CV if description provided.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), jobId: zod_1.z.string(),
        name: zod_1.z.string(), email: zod_1.z.string().optional(), phone: zod_1.z.string().optional(),
        cvSummary: zod_1.z.string().optional().describe('Summary or key points from their CV'),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), candidateId: zod_1.z.string(), score: zod_1.z.number().optional(), message: zod_1.z.string() }),
}, async ({ companyId, jobId, name, email, phone, cvSummary, notes }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    // Auto-score if CV provided
    let score;
    if (cvSummary) {
        try {
            const jobDoc = await db.collection(`companies/${companyId}/jobPostings`).doc(jobId).get();
            const jobData = jobDoc.data();
            if (jobData) {
                const { text } = await genkit_config_1.ai.generate({
                    model: genkit_config_1.GEMINI_FLASH,
                    prompt: `Score this candidate from 0 to 100 based on job fit.\nJob: ${jobData['title']} - ${jobData['description']}\nRequirements: ${jobData['requirements']}\n\nCandidate CV: ${cvSummary}\n\nReturn ONLY a number (0-100).`,
                    config: { temperature: 0.1 },
                });
                score = parseInt(text.trim()) || undefined;
            }
        }
        catch (err) {
            logger_1.logger.warn('[HR] addCandidate scoring failed (non-blocking)', { error: String(err) });
        }
    }
    try {
        await db.collection(`companies/${companyId}/candidates`).doc(id).set({
            id, jobId, name, email: email ?? '', phone: phone ?? '',
            cvSummary: cvSummary ?? '', notes: notes ?? '',
            score: score ?? null, status: 'new',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] addCandidate write failed', { error: String(err) });
        return { success: false, candidateId: '', message: 'Sauvegarde du candidat impossible.' };
    }
    // Increment applicant count
    try {
        await db.collection(`companies/${companyId}/jobPostings`).doc(jobId).update({ applicantCount: firestore_1.FieldValue.increment(1) });
    }
    catch { }
    return { success: true, candidateId: id, score, message: `Candidat "${name}" ajoute${score ? ` (score: ${score}/100)` : ''}. Statut: nouveau.` };
});
exports.listCandidatesTool = genkit_config_1.ai.defineTool({
    name: 'hr_listCandidates',
    description: 'List candidates for a job posting, with scores and status.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), jobId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(), candidates: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string(), email: zod_1.z.string(), score: zod_1.z.number().optional(), status: zod_1.z.string() })) }),
}, async ({ companyId, jobId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/candidates`).where('jobId', '==', jobId).limit(100).get().catch((err) => {
        logger_1.logger.error('[HR] listCandidates query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des candidats impossible.', candidates: [] };
    return { success: true, candidates: snap.docs.map(d => { const x = d.data(); return { id: d.id, name: x['name'] ?? '', email: x['email'] ?? '', score: x['score'], status: x['status'] ?? '' }; }) };
});
exports.scheduleInterviewTool = genkit_config_1.ai.defineTool({
    name: 'hr_scheduleInterview',
    description: 'Schedule an interview with a candidate.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), candidateId: zod_1.z.string(),
        date: zod_1.z.string(), time: zod_1.z.string(), interviewer: zod_1.z.string().optional(),
        type: zod_1.z.enum(['phone', 'video', 'onsite']).optional().default('video'),
        notes: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), interviewId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, candidateId, date, time, interviewer, type, notes }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    // Get candidate name
    let candidateName = '';
    try {
        const c = await db.collection(`companies/${companyId}/candidates`).doc(candidateId).get();
        candidateName = c.data()?.['name'] ?? '';
    }
    catch { }
    try {
        await db.collection(`companies/${companyId}/interviews`).doc(id).set({
            id, candidateId, candidateName, date, time, interviewer: interviewer ?? '',
            type, notes: notes ?? '', status: 'scheduled',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] scheduleInterview write failed', { error: String(err) });
        return { success: false, interviewId: '', message: 'Sauvegarde de l\'entretien impossible.' };
    }
    // Update candidate status
    try {
        await db.collection(`companies/${companyId}/candidates`).doc(candidateId).update({ status: 'interview_scheduled' });
    }
    catch { }
    return { success: true, interviewId: id, message: `Entretien ${type} planifie pour "${candidateName}" le ${date} a ${time}.` };
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. PROFIL EMPLOYE (nouveau)
// ══════════════════════════════════════════════════════════════════════════════
exports.employeeProfileTool = genkit_config_1.ai.defineTool({
    name: 'hr_getEmployeeProfile',
    description: 'Get detailed employee profile — personal info, department, manager, start date, work mode.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string().optional(), employeeName: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(),
        found: zod_1.z.boolean(), name: zod_1.z.string(), email: zod_1.z.string(), department: zod_1.z.string(),
        jobTitle: zod_1.z.string(), manager: zod_1.z.string(), startDate: zod_1.z.string(),
        employmentType: zod_1.z.string(), workMode: zod_1.z.string(), phone: zod_1.z.string(),
    }),
}, async ({ companyId, userId, employeeName }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let data;
    if (userId) {
        const doc = await db.collection('users').doc(userId).get().catch(() => null);
        if (doc?.exists)
            data = doc.data();
    }
    else if (employeeName) {
        const snap = await db.collection('users').where('companyId', '==', companyId).limit(200).get().catch((err) => {
            logger_1.logger.error('[HR] getEmployeeProfile query failed', { error: String(err) });
            return null;
        });
        if (snap) {
            const q = employeeName.toLowerCase();
            const match = snap.docs.find(d => (d.data()['displayName'] ?? '').toLowerCase().includes(q));
            if (match)
                data = match.data();
        }
    }
    if (!data)
        return { success: true, found: false, name: '', email: '', department: '', jobTitle: '', manager: '', startDate: '', employmentType: '', workMode: '', phone: '' };
    // Convert Firestore Timestamp (object with _seconds) to ISO date string
    const toDateString = (v) => {
        if (!v)
            return '';
        if (typeof v === 'string')
            return v;
        if (typeof v === 'object' && v !== null) {
            const o = v;
            if (typeof o.toDate === 'function')
                return o.toDate().toISOString().split('T')[0];
            const secs = o._seconds ?? o.seconds;
            if (typeof secs === 'number')
                return new Date(secs * 1000).toISOString().split('T')[0];
        }
        return '';
    };
    return {
        success: true,
        found: true,
        name: data['displayName'] ?? '',
        email: data['email'] ?? '',
        department: data['department'] ?? '',
        jobTitle: data['jobTitle'] ?? '',
        manager: data['managerId'] ?? data['manager'] ?? '',
        startDate: toDateString(data['startDate']) || toDateString(data['createdAt']) || '',
        employmentType: data['employmentType'] ?? 'full-time',
        workMode: data['workMode'] ?? 'onsite',
        phone: data['phone'] ?? '',
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. DOCUMENTS RH (nouveau)
// ══════════════════════════════════════════════════════════════════════════════
exports.listEmployeeDocsTool = genkit_config_1.ai.defineTool({
    name: 'hr_listEmployeeDocuments',
    description: 'List HR documents for an employee (contract, attestation, certificates, payslips).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(), documents: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), type: zod_1.z.string(), title: zod_1.z.string(), date: zod_1.z.string() })) }),
}, async ({ companyId, userId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/hrDocuments`).where('userId', '==', userId).limit(50).get().catch((err) => {
        logger_1.logger.error('[HR] listEmployeeDocuments query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des documents impossible.', documents: [] };
    return { success: true, documents: snap.docs.map(d => { const x = d.data(); return { id: d.id, type: x['type'] ?? '', title: x['title'] ?? '', date: (x['createdAt']?.toDate?.()?.toISOString?.() ?? '') }; }) };
});
exports.generateCertificateTool = genkit_config_1.ai.defineTool({
    name: 'hr_generateEmploymentCertificate',
    description: 'Generate an employment certificate / attestation for an employee.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string(), certificateType: zod_1.z.enum(['employment', 'salary', 'training', 'recommendation']).optional().default('employment') }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), documentId: zod_1.z.string(), content: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, userId, certificateType }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Get employee + company info
    const [empDoc, compDoc] = await Promise.all([
        db.collection('users').doc(userId).get().catch(() => null),
        db.collection('companies').doc(companyId).get().catch(() => null),
    ]);
    const emp = empDoc?.data() ?? {};
    const comp = compDoc?.data() ?? {};
    let text;
    try {
        const result = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Genere une attestation de type "${certificateType}" en francais, professionnelle et formelle.
Entreprise: ${comp['name'] ?? 'Orlode'}, ${comp['address'] ?? ''}
Employe: ${emp['displayName'] ?? ''}, poste: ${emp['jobTitle'] ?? ''}, departement: ${emp['department'] ?? ''}
Date d'embauche: ${emp['startDate'] ?? emp['createdAt'] ?? 'non specifiee'}
Date du jour: ${new Date().toLocaleDateString('fr-FR')}

Retourne UNIQUEMENT le texte de l'attestation, formate proprement.`,
            config: { temperature: 0.2 },
        });
        text = result.text;
    }
    catch (err) {
        logger_1.logger.error('[HR] generateCertificate AI generation failed', { error: String(err) });
        return { success: false, documentId: '', content: '', message: `Génération de l'attestation impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
    const docId = (0, helpers_1.generateId)();
    try {
        await db.collection(`companies/${companyId}/hrDocuments`).doc(docId).set({
            id: docId, userId, type: certificateType, title: `Attestation ${certificateType} - ${emp['displayName'] ?? ''}`,
            content: text, createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] generateCertificate write failed', { error: String(err) });
        return { success: false, documentId: '', content: text, message: 'Sauvegarde de l\'attestation impossible.' };
    }
    return { success: true, documentId: docId, content: text, message: `Attestation "${certificateType}" generee pour ${emp['displayName'] ?? 'l\'employe'}.` };
});
// ──────────────────────────────────────────────────────────────────────────────
// Payslip generator — generates a monthly payslip for an employee.
// Uses: employee base salary + presence/hours + bonuses/deductions if stored.
// ──────────────────────────────────────────────────────────────────────────────
exports.generatePayslipTool = genkit_config_1.ai.defineTool({
    name: 'hr_generatePayslip',
    description: 'Generate a monthly payslip (fiche de paie) for an employee. Includes gross salary, deductions, net pay. Returns a downloadable document.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeId: zod_1.z.string().describe('User ID of the employee'),
        month: zod_1.z.number().min(1).max(12).describe('Month number 1-12'),
        year: zod_1.z.number().min(2020).max(2100),
        grossSalary: zod_1.z.number().optional().describe('Override gross salary. Falls back to employee profile baseSalary.'),
        bonuses: zod_1.z.number().optional().default(0).describe('Additional bonuses/primes'),
        overtime: zod_1.z.number().optional().default(0).describe('Overtime amount'),
        deductions: zod_1.z.number().optional().default(0).describe('Extra deductions (advances, etc.)'),
        currency: zod_1.z.string().optional().default('XOF'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(),
        documentId: zod_1.z.string(),
        employeeName: zod_1.z.string(),
        grossTotal: zod_1.z.number(),
        socialCharges: zod_1.z.number(),
        netPay: zod_1.z.number(),
        pdfUrl: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, employeeId, month, year, grossSalary, bonuses, overtime, deductions, currency }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Check the formal employees collection first (has salary), then fall back to users
    const [empDocHR, empDocUser, compDoc] = await Promise.all([
        db.collection(`companies/${companyId}/employees`).doc(employeeId).get().catch(() => null),
        db.collection('users').doc(employeeId).get().catch(() => null),
        db.collection('companies').doc(companyId).get().catch(() => null),
    ]);
    // Merge: prefer HR employee data for salary, fall back to user profile for name/email
    const emp = { ...(empDocUser?.data() ?? {}), ...(empDocHR?.data() ?? {}) };
    const comp = compDoc?.data() ?? {};
    const baseSalary = grossSalary ?? emp['baseSalary'] ?? 0;
    if (baseSalary === 0) {
        return {
            success: false,
            documentId: '',
            employeeName: emp['displayName'] ?? employeeId,
            grossTotal: 0,
            socialCharges: 0,
            netPay: 0,
            message: `Aucun salaire de base trouvé pour ${emp['displayName'] ?? employeeId}. Renseignez baseSalary dans le profil ou fournissez grossSalary en paramètre.`,
        };
    }
    const gross = baseSalary + (bonuses ?? 0) + (overtime ?? 0);
    // Simplified social charges (CNPS Côte d'Ivoire ~6.3% employee, adjust per country):
    const socialChargesPct = emp['socialChargesPct'] ?? 0.063;
    const socialCharges = Math.round(gross * socialChargesPct);
    const taxableBase = gross - socialCharges;
    // Simplified IUTS tax approximation (real calc needs brackets):
    const taxPct = emp['taxPct'] ?? 0.10;
    const incomeTax = Math.round(taxableBase * taxPct);
    const netPay = gross - socialCharges - incomeTax - (deductions ?? 0);
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const docId = (0, helpers_1.generateId)();
    const content = {
        payslipNumber: `PAY-${year}${String(month).padStart(2, '0')}-${docId.slice(0, 6).toUpperCase()}`,
        period: `${monthNames[month - 1]} ${year}`,
        employee: {
            id: employeeId,
            name: emp['displayName'] ?? 'Employé',
            jobTitle: emp['jobTitle'] ?? '',
            department: emp['department'] ?? '',
            email: emp['email'] ?? '',
            startDate: emp['startDate'] ?? emp['createdAt'] ?? null,
        },
        company: {
            name: comp['name'] ?? 'Orlode',
            address: comp['address'] ?? '',
            taxId: comp['taxId'] ?? '',
        },
        earnings: {
            baseSalary,
            bonuses: bonuses ?? 0,
            overtime: overtime ?? 0,
            grossTotal: gross,
        },
        deductions: {
            socialCharges,
            incomeTax,
            other: deductions ?? 0,
            totalDeductions: socialCharges + incomeTax + (deductions ?? 0),
        },
        netPay,
        currency,
        generatedAt: new Date().toISOString(),
    };
    try {
        await db.collection(`companies/${companyId}/payslips`).doc(docId).set({
            id: docId,
            type: 'payslip',
            ...content,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Also add to employee documents for easy retrieval
        await db.collection(`companies/${companyId}/hrDocuments`).doc(docId).set({
            id: docId,
            userId: employeeId,
            type: 'payslip',
            title: `Fiche de paie — ${monthNames[month - 1]} ${year}`,
            period: content.period,
            payslipId: docId,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] generatePayslip write failed', { error: String(err) });
        return {
            success: false,
            documentId: '',
            employeeName: content.employee.name,
            grossTotal: gross,
            socialCharges,
            netPay,
            message: 'Sauvegarde de la fiche de paie impossible.',
        };
    }
    return {
        success: true,
        documentId: docId,
        employeeName: content.employee.name,
        grossTotal: gross,
        socialCharges,
        netPay,
        pdfUrl: `/api/hr/payslips/${docId}/pdf`,
        message: `Fiche de paie générée pour ${content.employee.name} — ${content.period}. Net à payer : ${netPay.toLocaleString()} ${currency}.`,
    };
});
// ──────────────────────────────────────────────────────────────────────────────
// Employee portfolio — uploads, lists, and generates upload links for the
// employee's document folder. Reuses the WEMAS portfolio system (per email).
// ──────────────────────────────────────────────────────────────────────────────
exports.uploadEmployeeDocTool = genkit_config_1.ai.defineTool({
    name: 'hr_uploadEmployeeDocument',
    description: "Upload a document to an employee's portfolio folder (ID card, RIB, diploma, etc.). Use when a file URL is already available.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeEmail: zod_1.z.string(),
        employeeName: zod_1.z.string(),
        documentType: zod_1.z.enum(['id_card', 'passport', 'driver_license', 'rib', 'kbis', 'photo', 'diploma', 'medical', 'contract', 'autre']),
        label: zod_1.z.string(),
        fileUrl: zod_1.z.string(),
        fileName: zod_1.z.string(),
        fileSize: zod_1.z.number().optional().default(0),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), documentId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, employeeEmail, employeeName, documentType, label, fileUrl, fileName, fileSize }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docId = (0, helpers_1.generateId)();
    try {
        await db.collection(`companies/${companyId}/portfolioDocuments`).doc(docId).set({
            id: docId, companyId, signatoryEmail: employeeEmail, signatoryName: employeeName,
            documentType, label, fileUrl, fileName, fileSize: fileSize ?? 0,
            createdAt: new Date().toISOString(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] uploadEmployeeDocument write failed', { error: String(err) });
        return { success: false, documentId: '', message: 'Sauvegarde du document impossible.' };
    }
    return { success: true, documentId: docId, message: `Document "${label}" ajouté au portfolio de ${employeeName}.` };
});
exports.listEmployeePortfolioTool = genkit_config_1.ai.defineTool({
    name: 'hr_listEmployeePortfolio',
    description: "List all documents in an employee's portfolio folder.",
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), employeeEmail: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(),
        documents: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), type: zod_1.z.string(), label: zod_1.z.string(), fileName: zod_1.z.string(), fileUrl: zod_1.z.string(), createdAt: zod_1.z.string() })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, employeeEmail }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/portfolioDocuments`)
        .where('signatoryEmail', '==', employeeEmail).limit(100).get().catch((err) => {
        logger_1.logger.error('[HR] listEmployeePortfolio query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture du portfolio impossible.', documents: [], total: 0 };
    const documents = snap.docs.map(d => {
        const x = d.data();
        return {
            id: d.id, type: x['documentType'] ?? 'autre', label: x['label'] ?? '',
            fileName: x['fileName'] ?? '', fileUrl: x['fileUrl'] ?? '',
            createdAt: x['createdAt'] ?? '',
        };
    });
    return { success: true, documents, total: documents.length };
});
exports.generateEmployeeUploadLinkTool = genkit_config_1.ai.defineTool({
    name: 'hr_generateEmployeeUploadLink',
    description: "Generate a magic link that an employee can use to upload their own documents (ID, RIB, diplomas, etc.). Send this link by email or WhatsApp.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeEmail: zod_1.z.string(),
        employeeName: zod_1.z.string(),
        requestedDocs: zod_1.z.array(zod_1.z.string()).optional(),
        expiresInDays: zod_1.z.number().optional().default(7),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), uploadUrl: zod_1.z.string(), expiresAt: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, employeeEmail, employeeName, requestedDocs, expiresInDays }) => {
    try {
        const { wemasService } = await Promise.resolve().then(() => __importStar(require('../services/wemas/wemasService')));
        const request = await wemasService.createUploadRequest(companyId, {
            signatoryEmail: employeeEmail,
            signatoryName: employeeName,
            requestedTypes: requestedDocs ?? ['id_card', 'rib', 'photo'],
            message: `Merci de fournir les documents demandés pour compléter ton dossier RH.`,
            expiresInDays: expiresInDays ?? 7,
        });
        const uploadUrl = `https://mon-assistant-86bbd.web.app/upload/${request.token}`;
        const expiresDate = request.expiresAt ? new Date(request.expiresAt).toLocaleDateString('fr-FR') : 'jamais';
        return {
            success: true,
            uploadUrl,
            expiresAt: request.expiresAt ? request.expiresAt.split('T')[0] : '',
            message: `Lien d'upload généré pour ${employeeName} (expire le ${expiresDate}) : ${uploadUrl}`,
        };
    }
    catch (err) {
        logger_1.logger.error('[HR] generateEmployeeUploadLink failed', { error: String(err) });
        return {
            success: false,
            uploadUrl: '',
            expiresAt: '',
            message: `Génération du lien d'upload impossible: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
});
// ──────────────────────────────────────────────────────────────────────────────
// Generate employment contract PDF — creates a ready-to-sign contract with all
// standard clauses (engagement, trial, hours, salary, leaves, confidentiality).
// ──────────────────────────────────────────────────────────────────────────────
exports.generateContractTool = genkit_config_1.ai.defineTool({
    name: 'hr_generateContract',
    description: 'Generate a full employment contract PDF for an employee with all standard clauses (engagement, trial period, hours, salary, leaves, confidentiality, termination). Returns a downloadable URL.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeId: zod_1.z.string(),
        contractType: zod_1.z.enum(['CDI', 'CDD', 'Stage', 'Freelance']).optional().default('CDI'),
        startDate: zod_1.z.string().optional().describe('YYYY-MM-DD'),
        endDate: zod_1.z.string().optional().describe('YYYY-MM-DD — required for CDD'),
        trialPeriodMonths: zod_1.z.number().optional(),
        workHours: zod_1.z.string().optional(),
        jobTitle: zod_1.z.string().optional(),
        department: zod_1.z.string().optional(),
        baseSalary: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional().default('XOF'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(),
        contractId: zod_1.z.string(),
        employeeName: zod_1.z.string(),
        contractType: zod_1.z.string(),
        pdfUrl: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, employeeId, contractType, startDate, endDate, trialPeriodMonths, workHours, jobTitle, department, baseSalary, currency }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Gather employee info — check both employees/ and users/ collections
    const [empDocHR, empDocUser] = await Promise.all([
        db.collection(`companies/${companyId}/employees`).doc(employeeId).get().catch(() => null),
        db.collection('users').doc(employeeId).get().catch(() => null),
    ]);
    const emp = { ...(empDocUser?.data() ?? {}), ...(empDocHR?.data() ?? {}) };
    const contractId = (0, helpers_1.generateId)();
    const accessToken = (0, helpers_1.generateId)() + (0, helpers_1.generateId)(); // ~48 chars, unguessable
    // Always resolve contractType to a concrete value — Firestore rejects undefined
    const resolvedContractType = contractType ?? 'CDI';
    const contractData = {
        id: contractId,
        employeeId,
        type: 'employment_contract',
        contractType: resolvedContractType,
        startDate: startDate ?? emp['startDate'] ?? new Date().toISOString().split('T')[0],
        endDate: endDate ?? null,
        trialPeriodMonths: trialPeriodMonths ?? (resolvedContractType === 'CDI' ? 3 : 1),
        workHours: workHours ?? '40 heures hebdomadaires',
        jobTitle: jobTitle ?? emp['jobTitle'] ?? 'Collaborateur',
        department: department ?? emp['department'] ?? '',
        baseSalary: baseSalary ?? emp['baseSalary'] ?? 0,
        currency: currency ?? emp['currency'] ?? 'XOF',
        status: 'draft',
        accessToken,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    };
    // Strip any remaining undefined before Firestore write
    const safeContractData = Object.fromEntries(Object.entries(contractData).filter(([, v]) => v !== undefined));
    try {
        await db.collection(`companies/${companyId}/contracts`).doc(contractId).set(safeContractData);
        await db.collection(`companies/${companyId}/hrDocuments`).doc(contractId).set({
            id: contractId,
            userId: employeeId,
            type: 'contract',
            title: `Contrat ${resolvedContractType} — ${emp['displayName'] ?? 'Employé'}`,
            contractId,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] generateContract write failed', { error: String(err) });
        return {
            success: false,
            contractId: '',
            employeeName: emp['displayName'] ?? 'Employé',
            contractType: resolvedContractType,
            pdfUrl: '',
            message: 'Sauvegarde du contrat impossible.',
        };
    }
    const baseUrl = process.env['APP_PUBLIC_URL'] ?? 'https://mon-assistant-86bbd.web.app';
    const pdfUrl = `${baseUrl}/api/hr/contracts/${contractId}/pdf?t=${accessToken}`;
    return {
        success: true,
        contractId,
        employeeName: emp['displayName'] ?? 'Employé',
        contractType: resolvedContractType,
        pdfUrl,
        message: `Contrat ${resolvedContractType} généré pour ${emp['displayName'] ?? 'l\'employé'}. PDF téléchargeable : ${pdfUrl}`,
    };
});
// ──────────────────────────────────────────────────────────────────────────────
// Create employee — agent can call this when an employee is missing from the DB
// but mentioned in conversation. Minimal info required.
// ──────────────────────────────────────────────────────────────────────────────
exports.createEmployeeTool = genkit_config_1.ai.defineTool({
    name: 'hr_createEmployee',
    description: 'Create a new employee record in the HR system. Use when the user mentions an employee that doesn\'t exist yet in the DB. Auto-reuses the existing user/member if they are already in the team.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        displayName: zod_1.z.string().describe('Full name'),
        email: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        jobTitle: zod_1.z.string().optional(),
        department: zod_1.z.string().optional(),
        baseSalary: zod_1.z.number().optional().describe('Monthly gross salary'),
        currency: zod_1.z.string().optional().default('XOF'),
        startDate: zod_1.z.string().optional().describe('ISO date YYYY-MM-DD — defaults to today'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(),
        employeeId: zod_1.z.string(),
        message: zod_1.z.string(),
        reusedExisting: zod_1.z.boolean().optional(),
    }),
}, async ({ companyId, displayName, email, phone, jobTitle, department, baseSalary, currency, startDate }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Try to find existing user by email first (to reuse uid as employeeId)
    let employeeId = (0, helpers_1.generateId)();
    let reused = false;
    if (email) {
        const existing = await db.collection('users').where('email', '==', email).limit(1).get().catch(() => null);
        if (existing && !existing.empty) {
            employeeId = existing.docs[0].id;
            reused = true;
        }
    }
    try {
        await db.collection(`companies/${companyId}/employees`).doc(employeeId).set({
            id: employeeId,
            userId: reused ? employeeId : null,
            displayName,
            email: email ?? '',
            phone: phone ?? '',
            jobTitle: jobTitle ?? '',
            department: department ?? '',
            baseSalary: baseSalary ?? 0,
            currency: currency ?? 'XOF',
            startDate: startDate ?? new Date().toISOString().split('T')[0],
            status: 'active',
            source: 'hr_agent_created',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (err) {
        logger_1.logger.error('[HR] createEmployee write failed', { error: String(err) });
        return { success: false, employeeId: '', message: 'Création de l\'employé impossible.' };
    }
    return {
        success: true,
        employeeId,
        message: reused
            ? `${displayName} lié à son compte utilisateur existant. Employé créé.`
            : `${displayName} ajouté comme nouvel employé.`,
        reusedExisting: reused,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4a. SEND EMAIL — real outbound email (Gmail if connected, Resend fallback)
// ══════════════════════════════════════════════════════════════════════════════
exports.hrSendEmailTool = genkit_config_1.ai.defineTool({
    name: 'hr_sendEmail',
    description: "Envoie un VRAI email depuis la boîte de l'entreprise (Gmail si connecté, sinon Resend). À utiliser pour transmettre un contrat, une fiche de paie, une attestation, un lien d'onboarding. Ne confonds pas avec la signature électronique qui reste un ticket pour l'instant.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        to: zod_1.z.string().describe('Destinataire — email de l\'employé ou candidat'),
        subject: zod_1.z.string(),
        body: zod_1.z.string().describe('Corps du message — peut inclure des liens (ex: PDF contrat)'),
        cc: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        provider: zod_1.z.string().optional(),
        from: zod_1.z.string().optional(),
        messageId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, to, subject, body, cc }) => {
    try {
        const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
        // Convert plain-text / markdown-ish body to HTML (preserve line breaks + auto-link URLs)
        const html = body.includes('<')
            ? body
            : `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111">${body
                .replace(/(https?:\/\/\S+)/g, '<a href="$1" style="color:#7c3aed">$1</a>')
                .replace(/\n/g, '<br>')}</div>`;
        const result = await sendEmail({
            to, subject, html, cc, companyId,
            tags: [{ name: 'type', value: 'hr-agent-outbound' }],
        });
        return {
            success: true,
            provider: result.provider,
            from: result.from,
            messageId: result.id,
            message: `Email envoyé à ${to} via ${result.provider}${result.from ? ` (de ${result.from})` : ''}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[hr_sendEmail] Failed:', err);
        return {
            success: false,
            message: `Échec de l'envoi : ${err.message ?? String(err)}. Gmail pas connecté ? Vérifie /admin/gmail ou utilise Resend.`,
        };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 4b. UPDATE EMPLOYEE — patch existing fields without full re-creation
// ══════════════════════════════════════════════════════════════════════════════
exports.updateEmployeeTool = genkit_config_1.ai.defineTool({
    name: 'hr_updateEmployee',
    description: "Mettre à jour les champs d'une fiche employé existante (email, téléphone, poste, département, salaire, contrat). À utiliser quand l'utilisateur donne de nouvelles infos sur un employé déjà créé (ex: 'ajoute son email', 'change son salaire', 'met à jour son poste').",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeId: zod_1.z.string().describe('ID de l\'employé (celui retourné par createEmployee ou findEmployee)'),
        email: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        jobTitle: zod_1.z.string().optional(),
        department: zod_1.z.string().optional(),
        baseSalary: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional(),
        startDate: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string(), updatedFields: zod_1.z.array(zod_1.z.string()) }),
}, async ({ companyId, employeeId, ...fields }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Only include fields that were actually provided (drop undefineds)
    const update = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    const updatedFields = [];
    for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined && v !== null && v !== '') {
            update[k] = v;
            updatedFields.push(k);
        }
    }
    if (updatedFields.length === 0) {
        return { success: false, message: 'Aucun champ à mettre à jour.', updatedFields: [] };
    }
    try {
        await db.collection(`companies/${companyId}/employees`).doc(employeeId).set(update, { merge: true });
    }
    catch (err) {
        logger_1.logger.error('[HR] updateEmployee write failed', { error: String(err) });
        return { success: false, message: 'Mise à jour impossible.', updatedFields: [] };
    }
    return {
        success: true,
        message: `Mis à jour : ${updatedFields.join(', ')}.`,
        updatedFields,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. CALENDRIER EQUIPE & PRESENCE (nouveau)
// ══════════════════════════════════════════════════════════════════════════════
exports.teamCalendarTool = genkit_config_1.ai.defineTool({
    name: 'hr_getTeamCalendar',
    description: 'Get team availability — who is on leave, absent, remote, or present today/this week.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), department: zod_1.z.string().optional(), date: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(),
        present: zod_1.z.array(zod_1.z.string()), onLeave: zod_1.z.array(zod_1.z.string()), remote: zod_1.z.array(zod_1.z.string()), absent: zod_1.z.array(zod_1.z.string()),
        totalEmployees: zod_1.z.number(), presenceRate: zod_1.z.number(),
    }),
}, async ({ companyId, department, date }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const today = date ?? new Date().toISOString().split('T')[0];
    // Get employees
    let empQ = db.collection('users').where('companyId', '==', companyId);
    if (department)
        empQ = empQ.where('department', '==', department);
    const empSnap = await empQ.limit(200).get().catch((err) => {
        logger_1.logger.error('[HR] teamCalendar employees query failed', { error: String(err) });
        return null;
    });
    if (!empSnap)
        return { success: false, message: 'Lecture des employés impossible.', present: [], onLeave: [], remote: [], absent: [], totalEmployees: 0, presenceRate: 0 };
    const empNames = new Map(empSnap.docs.map(d => [d.id, d.data()['displayName'] ?? d.data()['email'] ?? '']));
    // Get presence
    const presSnap = await db.collection('presence').where('companyId', '==', companyId).where('date', '==', today).limit(200).get().catch(() => null);
    const presentIds = new Set(presSnap?.docs.filter(d => d.data()['status'] === 'present').map(d => d.data()['employeeId'] ?? '') ?? []);
    // Get leaves
    const leaveSnap = await db.collection(`companies/${companyId}/leaveRequests`).where('status', '==', 'approved').limit(200).get().catch(() => null);
    const onLeaveIds = new Set();
    leaveSnap?.docs.forEach(d => {
        const data = d.data();
        if (data['startDate'] <= today && data['endDate'] >= today) {
            onLeaveIds.add(data['userId'] ?? '');
        }
    });
    const present = [];
    const onLeave = [];
    const absent = [];
    const remote = [];
    empNames.forEach((name, id) => {
        if (onLeaveIds.has(id)) {
            onLeave.push(name);
        }
        else if (presentIds.has(id)) {
            present.push(name);
        }
        else {
            absent.push(name);
        }
    });
    const total = empNames.size;
    return { success: true, present, onLeave, remote, absent, totalEmployees: total, presenceRate: total > 0 ? Math.round((present.length / total) * 100) : 0 };
});
exports.attendanceSummaryTool = genkit_config_1.ai.defineTool({
    name: 'hr_getAttendanceSummary',
    description: 'Get attendance summary for an employee or team (hours worked, late arrivals, absences).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string().optional(), period: zod_1.z.enum(['today', 'week', 'month']).optional().default('week') }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(), totalHours: zod_1.z.number(), daysPresent: zod_1.z.number(), daysAbsent: zod_1.z.number(), lateArrivals: zod_1.z.number(), avgArrivalTime: zod_1.z.string() }),
}, async ({ companyId, userId, period }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const now = new Date();
    const cutoff = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    const from = new Date(now.getTime() - cutoff * 86400000).toISOString().split('T')[0];
    let q = db.collection('presence').where('companyId', '==', companyId).where('date', '>=', from);
    if (userId)
        q = q.where('employeeId', '==', userId);
    const snap = await q.limit(500).get().catch((err) => {
        logger_1.logger.error('[HR] attendanceSummary query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture de la présence impossible.', totalHours: 0, daysPresent: 0, daysAbsent: 0, lateArrivals: 0, avgArrivalTime: '09:00' };
    let totalHours = 0;
    let lateCount = 0;
    const arrivalTimes = [];
    snap.docs.forEach(d => {
        const data = d.data();
        totalHours += data['hoursWorked'] ?? 0;
        const checkIn = data['checkInAt']?.toDate?.() ?? data['checkInAt'];
        if (checkIn) {
            const hour = new Date(checkIn).getHours();
            arrivalTimes.push(hour);
            if (hour >= 10)
                lateCount++;
        }
    });
    const daysPresent = snap.docs.length;
    const avgHour = arrivalTimes.length > 0 ? Math.round(arrivalTimes.reduce((a, b) => a + b, 0) / arrivalTimes.length) : 9;
    return {
        success: true,
        totalHours: Math.round(totalHours * 10) / 10,
        daysPresent,
        daysAbsent: Math.max(0, cutoff - daysPresent),
        lateArrivals: lateCount,
        avgArrivalTime: `${String(avgHour).padStart(2, '0')}:00`,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. TICKETS RH & POLITIQUES (nouveau)
// ══════════════════════════════════════════════════════════════════════════════
exports.createHRTicketTool = genkit_config_1.ai.defineTool({
    name: 'hr_createTicket',
    description: 'Create an HR support ticket (question, complaint, request).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), userId: zod_1.z.string(),
        subject: zod_1.z.string(), description: zod_1.z.string(),
        category: zod_1.z.enum(['question', 'complaint', 'request', 'payroll', 'benefits', 'other']).optional().default('question'),
        priority: zod_1.z.enum(['low', 'medium', 'high']).optional().default('medium'),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), ticketId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, userId, subject, description, category, priority }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    try {
        await db.collection(`companies/${companyId}/hrTickets`).doc(id).set({
            id, userId, subject, description, category, priority,
            status: 'open', createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    catch (err) {
        logger_1.logger.error('[HR] createTicket write failed', { error: String(err) });
        return { success: false, ticketId: '', message: 'Sauvegarde du ticket impossible.' };
    }
    return { success: true, ticketId: id, message: `Ticket RH #${id.slice(0, 8)} cree: "${subject}" (${category}, priorite ${priority}).` };
});
// ══════════════════════════════════════════════════════════════════════════════
// 6bis. PUBLIER OFFRE SUR LINKEDIN / RESEAUX (nouveau)
// ══════════════════════════════════════════════════════════════════════════════
exports.publishJobTool = genkit_config_1.ai.defineTool({
    name: 'hr_publishJobPosting',
    description: 'Publish a job posting to LinkedIn, Facebook, Twitter, or the company website. Generates an attractive post from the job details.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        jobId: zod_1.z.string(),
        platforms: zod_1.z.array(zod_1.z.enum(['linkedin', 'facebook', 'twitter', 'instagram', 'website'])).default(['linkedin']),
        customMessage: zod_1.z.string().optional().describe('Optional custom intro or message to add'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(),
        results: zod_1.z.array(zod_1.z.object({ platform: zod_1.z.string(), success: zod_1.z.boolean(), url: zod_1.z.string().optional(), error: zod_1.z.string().optional() })),
        postContent: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, jobId, platforms, customMessage }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Get job details
    const jobDoc = await db.collection(`companies/${companyId}/jobPostings`).doc(jobId).get().catch(() => null);
    if (!jobDoc?.exists)
        return { success: false, results: [], postContent: '', message: 'Offre non trouvee.' };
    const job = jobDoc.data();
    // Get company name
    let companyName = 'Notre entreprise';
    try {
        const c = await db.collection('companies').doc(companyId).get();
        companyName = c.data()?.['name'] ?? companyName;
    }
    catch { }
    // Generate attractive social post
    let postContent;
    try {
        const result = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Genere un post de recrutement attractif pour les reseaux sociaux (LinkedIn, Facebook).

Entreprise: ${companyName}
Poste: ${job['title']}
Type: ${job['employmentType']}
Departement: ${job['department']}
Lieu: ${job['location'] || 'A definir'}
Salaire: ${job['salary'] || 'Selon experience'}
Description: ${job['description']}
Exigences: ${job['requirements']}
${customMessage ? `Message personnalise: ${customMessage}` : ''}

Regles:
- Commence par un hook accrocheur avec emoji
- Inclus les points cles du poste
- Termine par un call-to-action
- Ajoute 3-5 hashtags pertinents (#recrutement #emploi etc.)
- Maximum 300 mots
- Ton professionnel mais engageant`,
            config: { temperature: 0.5 },
        });
        postContent = result.text;
    }
    catch (err) {
        logger_1.logger.error('[HR] publishJobPosting AI generation failed', { error: String(err) });
        return { success: false, results: [], postContent: '', message: `Génération du post impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
    // Publish to social platforms
    const socialPlatforms = platforms.filter(p => p !== 'website');
    const results = [];
    if (socialPlatforms.length > 0) {
        try {
            const { socialPublishService } = await Promise.resolve().then(() => __importStar(require('../services/social/socialPublishService')));
            const publishResults = await socialPublishService.publishToAll(companyId, socialPlatforms, {
                text: postContent,
                hashtags: postContent.match(/#\w+/g) ?? [],
            });
            publishResults.forEach(r => results.push({ platform: r.platform, success: r.success, url: r.url, error: r.error }));
        }
        catch (err) {
            socialPlatforms.forEach(p => results.push({ platform: p, success: false, error: String(err) }));
        }
    }
    // Publish to company website (save as public job listing)
    if (platforms.includes('website')) {
        try {
            await db.collection(`companies/${companyId}/publicJobListings`).doc(jobId).set({
                ...job, postContent, publishedAt: firestore_1.FieldValue.serverTimestamp(), status: 'published',
            });
            results.push({ platform: 'website', success: true, url: `/careers/${jobId}` });
        }
        catch (err) {
            results.push({ platform: 'website', success: false, error: String(err) });
        }
    }
    // Update job status
    try {
        await db.collection(`companies/${companyId}/jobPostings`).doc(jobId).update({ publishedPlatforms: platforms, publishedAt: firestore_1.FieldValue.serverTimestamp() });
    }
    catch { }
    const successCount = results.filter(r => r.success).length;
    return {
        success: true,
        results,
        postContent,
        message: `Offre "${job['title']}" publiee sur ${successCount}/${results.length} plateforme(s).`,
    };
});
// Keep existing tools
exports.policySearchTool = genkit_config_1.ai.defineTool({
    name: 'hr_searchPolicy',
    description: 'Search HR policies, employee handbook, internal rules.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), query: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(), results: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), content: zod_1.z.string() })) }),
}, async ({ companyId, query }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/hrPolicies`).limit(20).get().catch((err) => {
        logger_1.logger.error('[HR] searchPolicy query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des politiques impossible.', results: [] };
    const kw = query.toLowerCase().split(/\s+/);
    const results = snap.docs.map(d => ({ title: d.data()['title'] ?? '', content: d.data()['content'] ?? '' }))
        .filter(r => kw.some(k => r.content.toLowerCase().includes(k) || r.title.toLowerCase().includes(k)));
    if (results.length === 0)
        results.push({ title: 'Politique RH generale', content: 'Contactez votre responsable RH ou consultez le handbook de l\'entreprise.' });
    return { success: true, results };
});
exports.onboardingChecklistTool = genkit_config_1.ai.defineTool({
    name: 'hr_getOnboardingChecklist',
    description: 'Get or create onboarding checklist for a new employee.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), userId: zod_1.z.string(), department: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(), steps: zod_1.z.array(zod_1.z.object({ step: zod_1.z.string(), category: zod_1.z.string(), completed: zod_1.z.boolean() })), completionPct: zod_1.z.number() }),
}, async ({ companyId, userId, department }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/onboarding`).doc(userId).get().catch(() => null);
    if (doc?.exists) {
        const steps = doc.data()['steps'] ?? [];
        return { success: true, steps, completionPct: steps.length > 0 ? Math.round(steps.filter(s => s.completed).length / steps.length * 100) : 0 };
    }
    const steps = [
        { step: 'Paperasse RH', category: 'Admin', completed: false },
        { step: 'Poste de travail + comptes', category: 'IT', completed: false },
        { step: 'Rencontre equipe', category: 'Social', completed: false },
        { step: 'Lecture reglement', category: 'Politiques', completed: false },
        { step: 'Formation securite', category: 'Securite', completed: false },
        { step: 'Check-in J+30', category: 'Management', completed: false },
        ...(department ? [{ step: `Orientation ${department}`, category: 'Onboarding', completed: false }] : []),
    ];
    return { success: true, steps, completionPct: 0 };
});
exports.employeeDirectoryTool = genkit_config_1.ai.defineTool({
    name: 'hr_getEmployeeDirectory',
    description: 'Search the unified people directory: merges employees, team members (invited users), and Firestore users. Use this BEFORE refusing to act on a person — they may exist under a different collection.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), query: zod_1.z.string().optional(), department: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(),
        employees: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            email: zod_1.z.string().optional(),
            department: zod_1.z.string().optional(),
            role: zod_1.z.string().optional(),
            source: zod_1.z.string().describe('Where this person was found: employees | members | users'),
            isFullEmployee: zod_1.z.boolean().describe('true if a full HR employee record exists'),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, query, department }) => {
    const db = (0, firebase_config_1.getFirestore)();
    // Run 3 queries in parallel — we merge results after
    const [employeesSnap, membersSnap, usersSnap] = await Promise.all([
        db.collection(`companies/${companyId}/employees`).limit(100).get().catch(() => null),
        db.collection(`companies/${companyId}/members`).limit(100).get().catch(() => null),
        db.collection('users').where('companyId', '==', companyId).limit(100).get().catch(() => null),
    ]);
    // Dedupe by email (or id if no email) — employees take priority, then members, then users
    const byKey = new Map();
    const keyOf = (email, id) => (email ? email.toLowerCase() : `id:${id}`);
    // 1. Employees (priority source — they have payroll data)
    (employeesSnap?.docs ?? []).forEach(d => {
        const x = d.data();
        const email = x['email'];
        byKey.set(keyOf(email, d.id), {
            id: d.id,
            name: x['displayName'] ?? email ?? d.id,
            email,
            department: x['department'],
            role: x['role'],
            source: 'employees',
            isFullEmployee: true,
        });
    });
    // 2. Members (if not already in employees — missing baseSalary/jobTitle but we know who they are)
    (membersSnap?.docs ?? []).forEach(d => {
        const x = d.data();
        const email = x['email'];
        const k = keyOf(email, d.id);
        if (!byKey.has(k)) {
            byKey.set(k, {
                id: d.id,
                name: x['displayName'] ?? email ?? d.id,
                email,
                department: x['department'],
                role: x['role'],
                source: 'members',
                isFullEmployee: false,
            });
        }
    });
    // 3. Users (last fallback — someone who signed in but isn't yet a formal member)
    (usersSnap?.docs ?? []).forEach(d => {
        const x = d.data();
        const email = x['email'];
        const k = keyOf(email, d.id);
        if (!byKey.has(k)) {
            byKey.set(k, {
                id: d.id,
                name: x['displayName'] ?? email ?? d.id,
                email,
                department: x['department'],
                role: x['role'],
                source: 'users',
                isFullEmployee: false,
            });
        }
    });
    let all = Array.from(byKey.values());
    if (department)
        all = all.filter(e => e.department === department);
    const kw = query?.toLowerCase().split(/\s+/) ?? [];
    if (kw.length > 0) {
        all = all.filter(e => kw.some(k => e.name.toLowerCase().includes(k) ||
            (e.email ?? '').toLowerCase().includes(k) ||
            (e.department ?? '').toLowerCase().includes(k)));
    }
    return { success: true, employees: all, total: all.length };
});
// ══════════════════════════════════════════════════════════════════════════════
// ALL TOOLS + FLOW
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// PRO: ORG CHART
// ══════════════════════════════════════════════════════════════════════════════
exports.getOrgChartTool = genkit_config_1.ai.defineTool({
    name: 'hr_getOrgChart',
    description: 'Get organizational hierarchy — departments, managers, reporting lines, headcount.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(),
        departments: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), headcount: zod_1.z.number(), manager: zod_1.z.string(), members: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), title: zod_1.z.string(), role: zod_1.z.string() })) })),
        totalEmployees: zod_1.z.number(), totalDepartments: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('users').where('companyId', '==', companyId).limit(200).get().catch((err) => {
        logger_1.logger.error('[HR] getOrgChart query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture de l\'organigramme impossible.', departments: [], totalEmployees: 0, totalDepartments: 0 };
    const deptMap = new Map();
    snap.docs.forEach(d => {
        const u = d.data();
        const dept = u['department'] ?? 'Autre';
        if (!deptMap.has(dept))
            deptMap.set(dept, { manager: '', members: [] });
        const entry = deptMap.get(dept);
        const name = u['displayName'] ?? u['email'] ?? '';
        const role = u['role'] ?? 'employee';
        entry.members.push({ name, title: u['jobTitle'] ?? role, role });
        if (role === 'manager' || role === 'admin')
            entry.manager = name;
    });
    return {
        success: true,
        departments: Array.from(deptMap.entries()).map(([name, d]) => ({ name, headcount: d.members.length, manager: d.manager || (d.members[0]?.name ?? ''), members: d.members })),
        totalEmployees: snap.size, totalDepartments: deptMap.size,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: PERFORMANCE REVIEWS
// ══════════════════════════════════════════════════════════════════════════════
exports.createPerformanceReviewTool = genkit_config_1.ai.defineTool({
    name: 'hr_createPerformanceReview',
    description: 'Create or get performance reviews — goals, ratings, feedback.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), action: zod_1.z.enum(['create', 'list', 'get']),
        employeeId: zod_1.z.string().optional(), period: zod_1.z.string().optional(),
        goals: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string(), target: zod_1.z.string(), progress: zod_1.z.number() })).optional(),
        rating: zod_1.z.number().optional(), feedback: zod_1.z.string().optional(), reviewerId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(),
        reviews: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), employeeName: zod_1.z.string(), period: zod_1.z.string(), rating: zod_1.z.number(), status: zod_1.z.string(), goalsCount: zod_1.z.number() })).optional(),
        reviewId: zod_1.z.string().optional(), message: zod_1.z.string(),
    }),
}, async ({ companyId, action, employeeId, period, goals, rating, feedback, reviewerId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    if (action === 'list') {
        const snap = await db.collection(`companies/${companyId}/performanceReviews`).orderBy('createdAt', 'desc').limit(50).get().catch((err) => {
            logger_1.logger.error('[HR] createPerformanceReview list failed', { error: String(err) });
            return null;
        });
        if (!snap)
            return { success: false, message: 'Lecture des évaluations impossible.' };
        return { success: true, reviews: snap.docs.map(d => { const data = d.data(); return { id: d.id, employeeName: data['employeeName'] ?? '', period: data['period'] ?? '', rating: data['rating'] ?? 0, status: data['status'] ?? 'draft', goalsCount: (data['goals'] ?? []).length }; }), message: `${snap.size} evaluations trouvees.` };
    }
    if (action === 'create' && employeeId) {
        const id = (0, helpers_1.generateId)();
        const empDoc = await db.collection('users').doc(employeeId).get().catch(() => null);
        const empName = empDoc?.data()?.['displayName'] ?? '';
        try {
            await db.collection(`companies/${companyId}/performanceReviews`).doc(id).set({
                id, employeeId, employeeName: empName, period: period ?? `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
                goals: goals ?? [], rating: rating ?? 0, feedback: feedback ?? '', reviewerId: reviewerId ?? '',
                status: 'draft', createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            logger_1.logger.error('[HR] createPerformanceReview write failed', { error: String(err) });
            return { success: false, message: 'Sauvegarde de l\'évaluation impossible.' };
        }
        return { success: true, reviewId: id, message: `Evaluation creee pour ${empName}.` };
    }
    return { success: false, message: 'Action non reconnue.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: OFFBOARDING
// ══════════════════════════════════════════════════════════════════════════════
exports.offboardingTool = genkit_config_1.ai.defineTool({
    name: 'hr_manageOffboarding',
    description: 'Manage employee offboarding — checklist, exit survey, access revocation, equipment return.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), action: zod_1.z.enum(['start', 'get', 'update_item']),
        employeeId: zod_1.z.string(), itemId: zod_1.z.string().optional(), completed: zod_1.z.boolean().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean().optional(), checklistId: zod_1.z.string().optional(), items: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), category: zod_1.z.string(), task: zod_1.z.string(), completed: zod_1.z.boolean() })).optional(), progress: zod_1.z.number().optional(), message: zod_1.z.string() }),
}, async ({ companyId, action, employeeId, itemId, completed }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const docRef = db.collection(`companies/${companyId}/offboarding`).doc(employeeId);
    if (action === 'start') {
        const items = [
            { id: 'off-1', category: 'Admin', task: 'Lettre de demission/licenciement signee', completed: false },
            { id: 'off-2', category: 'Admin', task: 'Solde de tout compte prepare', completed: false },
            { id: 'off-3', category: 'Admin', task: 'Certificat de travail genere', completed: false },
            { id: 'off-4', category: 'IT', task: 'Desactiver compte email et acces', completed: false },
            { id: 'off-5', category: 'IT', task: 'Recuperer ordinateur portable', completed: false },
            { id: 'off-6', category: 'IT', task: 'Revoquer badges et acces physiques', completed: false },
            { id: 'off-7', category: 'Securite', task: 'Revoquer acces VPN et cloud', completed: false },
            { id: 'off-8', category: 'Securite', task: 'Changer mots de passe partages', completed: false },
            { id: 'off-9', category: 'Manager', task: 'Transfert de responsabilites', completed: false },
            { id: 'off-10', category: 'Manager', task: 'Entretien de sortie realise', completed: false },
            { id: 'off-11', category: 'RH', task: 'Enquete de sortie envoyee', completed: false },
            { id: 'off-12', category: 'RH', task: 'Fin de contrat enregistree', completed: false },
        ];
        try {
            await docRef.set({ employeeId, items, status: 'in_progress', startedAt: firestore_1.FieldValue.serverTimestamp() });
        }
        catch (err) {
            logger_1.logger.error('[HR] offboarding start failed', { error: String(err) });
            return { success: false, message: 'Démarrage de l\'offboarding impossible.' };
        }
        // Cross-agent: notify Security to revoke access
        const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
        createNotification({ companyId, type: 'security_alert', title: 'Offboarding: revocation acces requise', message: `Un employe quitte l'entreprise. Revoquer tous les acces IT et securite.`, actionUrl: '/security/access', icon: 'UserX', severity: 'warning' }).catch(() => { });
        return { success: true, checklistId: employeeId, items, progress: 0, message: 'Offboarding demarre — 12 etapes a completer.' };
    }
    if (action === 'get') {
        const doc = await docRef.get().catch(() => null);
        if (!doc?.exists)
            return { success: false, message: 'Aucun offboarding en cours pour cet employe.' };
        const items = doc.data()['items'] ?? [];
        const progress = items.length > 0 ? Math.round(items.filter(i => i.completed).length / items.length * 100) : 0;
        return { success: true, checklistId: employeeId, items, progress, message: `Offboarding ${progress}% complete.` };
    }
    if (action === 'update_item' && itemId != null) {
        const doc = await docRef.get().catch(() => null);
        if (!doc?.exists)
            return { success: false, message: 'Offboarding non trouve.' };
        const items = doc.data()['items'] ?? [];
        const updated = items.map(i => i.id === itemId ? { ...i, completed: completed ?? true } : i);
        try {
            await docRef.update({ items: updated });
        }
        catch (err) {
            logger_1.logger.error('[HR] offboarding update_item failed', { error: String(err) });
            return { success: false, message: 'Mise à jour de l\'étape impossible.' };
        }
        const progress = Math.round(updated.filter(i => i.completed).length / updated.length * 100);
        return { success: true, items: updated, progress, message: `Etape mise a jour (${progress}%).` };
    }
    return { success: false, message: 'Action non reconnue.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: EMPLOYEE ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
exports.employeeAnalyticsTool = genkit_config_1.ai.defineTool({
    name: 'hr_getEmployeeAnalytics',
    description: 'HR analytics — headcount by department, turnover, seniority, role distribution.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(), message: zod_1.z.string().optional(),
        totalEmployees: zod_1.z.number(),
        byDepartment: zod_1.z.array(zod_1.z.object({ department: zod_1.z.string(), count: zod_1.z.number() })),
        byRole: zod_1.z.array(zod_1.z.object({ role: zod_1.z.string(), count: zod_1.z.number() })),
        avgSeniorityMonths: zod_1.z.number(),
        recentHires: zod_1.z.number(), recentDepartures: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('users').where('companyId', '==', companyId).limit(500).get().catch((err) => {
        logger_1.logger.error('[HR] employeeAnalytics query failed', { error: String(err) });
        return null;
    });
    if (!snap)
        return { success: false, message: 'Lecture des analytics impossible.', totalEmployees: 0, byDepartment: [], byRole: [], avgSeniorityMonths: 0, recentHires: 0, recentDepartures: 0 };
    const users = snap.docs.map(d => d.data());
    const byDept = {};
    const byRole = {};
    let totalMonths = 0;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    let recentHires = 0;
    users.forEach(u => {
        const dept = u['department'] ?? 'Autre';
        byDept[dept] = (byDept[dept] ?? 0) + 1;
        const role = u['role'] ?? 'employee';
        byRole[role] = (byRole[role] ?? 0) + 1;
        const created = u['createdAt']?.toDate?.()?.getTime() ?? Date.now();
        totalMonths += (Date.now() - created) / (30 * 86400000);
        if (created > thirtyDaysAgo)
            recentHires++;
    });
    return {
        success: true,
        totalEmployees: users.length,
        byDepartment: Object.entries(byDept).map(([d, c]) => ({ department: d, count: c })).sort((a, b) => b.count - a.count),
        byRole: Object.entries(byRole).map(([r, c]) => ({ role: r, count: c })).sort((a, b) => b.count - a.count),
        avgSeniorityMonths: users.length > 0 ? Math.round(totalMonths / users.length) : 0,
        recentHires, recentDepartures: 0,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: EMPLOYEE SURVEYS
// ══════════════════════════════════════════════════════════════════════════════
exports.employeeSurveyTool = genkit_config_1.ai.defineTool({
    name: 'hr_manageSurvey',
    description: 'Create and manage employee satisfaction surveys — eNPS, pulse surveys, anonymous feedback.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), action: zod_1.z.enum(['create', 'list', 'submit_response']),
        title: zod_1.z.string().optional(), questions: zod_1.z.array(zod_1.z.string()).optional(),
        surveyId: zod_1.z.string().optional(), answers: zod_1.z.array(zod_1.z.object({ question: zod_1.z.string(), answer: zod_1.z.string(), score: zod_1.z.number().optional() })).optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean().optional(),
        surveys: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), responseCount: zod_1.z.number(), status: zod_1.z.string(), avgScore: zod_1.z.number() })).optional(),
        surveyId: zod_1.z.string().optional(), message: zod_1.z.string(),
    }),
}, async ({ companyId, action, title, questions, surveyId, answers }) => {
    const db = (0, firebase_config_1.getFirestore)();
    if (action === 'list') {
        const snap = await db.collection(`companies/${companyId}/hrSurveys`).orderBy('createdAt', 'desc').limit(20).get().catch((err) => {
            logger_1.logger.error('[HR] manageSurvey list failed', { error: String(err) });
            return null;
        });
        if (!snap)
            return { success: false, message: 'Lecture des enquêtes impossible.' };
        return { success: true, surveys: snap.docs.map(d => { const data = d.data(); return { id: d.id, title: data['title'] ?? '', responseCount: data['responseCount'] ?? 0, status: data['status'] ?? 'active', avgScore: data['avgScore'] ?? 0 }; }), message: `${snap.size} enquete(s).` };
    }
    if (action === 'create') {
        const id = (0, helpers_1.generateId)();
        const defaultQuestions = questions ?? ['Comment evaluez-vous votre satisfaction au travail ? (1-10)', 'Recommanderiez-vous cette entreprise ? (1-10)', 'Comment evaluez-vous votre manager ? (1-10)', 'Avez-vous les outils necessaires ? (1-10)', 'Suggestion d\'amelioration ?'];
        try {
            await db.collection(`companies/${companyId}/hrSurveys`).doc(id).set({ id, title: title ?? 'Enquete satisfaction', questions: defaultQuestions, status: 'active', responseCount: 0, avgScore: 0, anonymous: true, createdAt: firestore_1.FieldValue.serverTimestamp() });
        }
        catch (err) {
            logger_1.logger.error('[HR] manageSurvey create failed', { error: String(err) });
            return { success: false, message: 'Création de l\'enquête impossible.' };
        }
        return { success: true, surveyId: id, message: `Enquete "${title ?? 'Enquete satisfaction'}" creee avec ${defaultQuestions.length} questions.` };
    }
    if (action === 'submit_response' && surveyId && answers) {
        try {
            await db.collection(`companies/${companyId}/hrSurveys/${surveyId}/responses`).doc((0, helpers_1.generateId)()).set({ answers, submittedAt: firestore_1.FieldValue.serverTimestamp() });
            const scores = answers.filter(a => a.score != null).map(a => a.score);
            const avgResponse = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10 : 0;
            await db.collection(`companies/${companyId}/hrSurveys`).doc(surveyId).update({ responseCount: firestore_1.FieldValue.increment(1), avgScore: avgResponse });
        }
        catch (err) {
            logger_1.logger.error('[HR] manageSurvey submit_response failed', { error: String(err) });
            return { success: false, message: 'Enregistrement de la réponse impossible.' };
        }
        return { success: true, message: 'Reponse enregistree. Merci !' };
    }
    return { success: false, message: 'Action non reconnue.' };
});
// ──────────────────────────────────────────────────────────────────────────────
// E-SIGNATURE via Wemas — send contract to employee for electronic signature.
// Flow: build the contract content → push to Wemas → email signing link to employee.
// ──────────────────────────────────────────────────────────────────────────────
exports.sendContractForSignatureTool = genkit_config_1.ai.defineTool({
    name: 'hr_sendContractForSignature',
    description: 'Envoie un contrat de travail à un employé pour signature électronique via Wemas. Génère le contenu (CDI/CDD/Stage/Freelance), crée le contrat dans Wemas, envoie le lien de signature par email à l\'employé. Utilise APRÈS création de l\'employé (createEmployee). Retourne l\'URL de signature.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        employeeId: zod_1.z.string().describe('Employee ID (UUID) — required to fetch name/email/role/salary'),
        contractType: zod_1.z.enum(['CDI', 'CDD', 'Stage', 'Freelance']).optional().default('CDI'),
        startDate: zod_1.z.string().optional().describe('YYYY-MM-DD — defaults to today'),
        endDate: zod_1.z.string().optional().describe('YYYY-MM-DD — required for CDD'),
        trialPeriodMonths: zod_1.z.number().optional().describe('Trial period in months (defaults: CDI=3, others=1)'),
        jobTitle: zod_1.z.string().optional(),
        baseSalary: zod_1.z.number().optional(),
        currency: zod_1.z.string().optional().default('XOF'),
        senderName: zod_1.z.string().optional().describe('Name of the person sending — defaults to company name'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        contractId: zod_1.z.string().optional(),
        signingUrl: zod_1.z.string().optional(),
        verificationCode: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, employeeId, contractType, startDate, endDate, trialPeriodMonths, jobTitle, baseSalary, currency, senderName }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const { isWemasConfigured, createAndSendContract } = await Promise.resolve().then(() => __importStar(require('../services/wemas/wemasBridge')));
    if (!isWemasConfigured()) {
        return {
            success: false,
            message: 'Signature électronique non disponible : Wemas n\'est pas configuré (WEMAS_BRIDGE_URL manquant). Le contrat doit être signé manuellement.',
        };
    }
    // Resolve employee
    const [empDocHR, empDocUser] = await Promise.all([
        db.collection(`companies/${companyId}/employees`).doc(employeeId).get().catch(() => null),
        db.collection('users').doc(employeeId).get().catch(() => null),
    ]);
    const emp = { ...(empDocUser?.data() ?? {}), ...(empDocHR?.data() ?? {}) };
    if (!emp || Object.keys(emp).length === 0) {
        return { success: false, message: `Employé ${employeeId} introuvable. Crée-le d'abord avec hr_createEmployee.` };
    }
    const employeeName = emp['displayName'] ?? emp['name'] ?? 'Employé';
    const employeeEmail = emp['email'] ?? '';
    const employeePhone = emp['phone'] ?? undefined;
    if (!employeeEmail) {
        return { success: false, message: `L'employé ${employeeName} n'a pas d'email. Mets-le à jour avec hr_updateEmployee avant d'envoyer le contrat.` };
    }
    // Resolve company branding
    const companyDoc = await db.collection('companies').doc(companyId).get().catch(() => null);
    const company = companyDoc?.data() ?? {};
    const companyName = company['name'] ?? 'Notre entreprise';
    // Build contract content (plain-text — Wemas wraps it in their signing UI)
    const resolved = contractType ?? 'CDI';
    const finalStart = startDate ?? new Date().toISOString().slice(0, 10);
    const finalSalary = baseSalary ?? emp['baseSalary'] ?? 0;
    const finalCurrency = currency ?? emp['currency'] ?? 'XOF';
    const finalJobTitle = jobTitle ?? emp['jobTitle'] ?? 'Collaborateur';
    const finalTrial = trialPeriodMonths ?? (resolved === 'CDI' ? 3 : 1);
    const endLine = endDate ? `Date de fin : ${endDate}` : (resolved === 'CDD' ? 'Date de fin : à préciser' : 'Durée indéterminée');
    const contractContent = `CONTRAT ${resolved}

Entre ${companyName}, ci-après dénommé "l'Employeur"
Et ${employeeName}, ci-après dénommé "l'Employé"

ARTICLE 1 — ENGAGEMENT
L'Employeur engage l'Employé en qualité de ${finalJobTitle}, à compter du ${finalStart}.
${endLine}

ARTICLE 2 — PÉRIODE D'ESSAI
Une période d'essai de ${finalTrial} mois est convenue, durant laquelle chaque partie peut mettre fin au contrat sans indemnité moyennant un préavis raisonnable.

ARTICLE 3 — RÉMUNÉRATION
Salaire mensuel brut : ${finalSalary.toLocaleString()} ${finalCurrency}.
Versé à terme échu, par virement bancaire, le dernier jour ouvré du mois.

ARTICLE 4 — HORAIRES
40 heures hebdomadaires, du lundi au vendredi, sauf disposition contraire prévue par accord.

ARTICLE 5 — CONFIDENTIALITÉ
L'Employé s'engage à respecter la confidentialité absolue des informations dont il aura connaissance dans l'exercice de ses fonctions, pendant et après l'exécution du contrat.

ARTICLE 6 — CONGÉS
L'Employé bénéficie de 30 jours ouvrables de congés payés par année de service.

ARTICLE 7 — RUPTURE
La rupture du contrat respecte les dispositions du Code du Travail applicable, avec un préavis de ${resolved === 'CDI' ? '1 mois' : '15 jours'}.

Fait à ${company['city'] ?? '____________'}, le ${finalStart}.

L'Employeur                         L'Employé
${companyName}                      ${employeeName}`;
    try {
        const result = await createAndSendContract({
            companyId,
            signatoryName: employeeName,
            signatoryEmail: employeeEmail,
            signatoryPhone: employeePhone,
            contractContent,
            contractType: resolved.toLowerCase(),
            senderName: senderName ?? companyName,
            sendNow: true,
        });
        // Cross-link this contract to the employee's HR portfolio for visibility
        await db.collection(`companies/${companyId}/hrDocuments`).add({
            userId: employeeId,
            type: 'contract',
            title: `Contrat ${resolved} — ${employeeName}`,
            wemasContractId: result.id,
            signingUrl: result.signingUrl,
            verificationCode: result.verificationCode,
            status: result.status,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        }).catch(() => { });
        return {
            success: true,
            contractId: result.id,
            signingUrl: result.signingUrl,
            verificationCode: result.verificationCode,
            message: `Contrat ${resolved} envoyé à ${employeeName} (${employeeEmail}) pour signature électronique. Code de vérification : ${result.verificationCode}. URL de signature : ${result.signingUrl}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[HR] sendContractForSignature failed', { err: String(err), employeeId });
        return {
            success: false,
            message: `Échec de l'envoi à Wemas : ${err.message ?? String(err)}. Le contrat n'a pas été envoyé.`,
        };
    }
});
const ALL_TOOLS = [
    // Conges
    exports.leaveBalanceTool, exports.leaveRequestTool, exports.leaveStatusTool,
    // Recrutement
    exports.createJobPostingTool, exports.listJobsTool, exports.addCandidateTool, exports.listCandidatesTool, exports.scheduleInterviewTool, exports.publishJobTool,
    // Profil
    exports.employeeProfileTool,
    // Documents & employees
    exports.listEmployeeDocsTool, exports.generateCertificateTool, exports.generatePayslipTool, exports.createEmployeeTool, exports.updateEmployeeTool, exports.generateContractTool, exports.hrSendEmailTool,
    exports.uploadEmployeeDocTool, exports.listEmployeePortfolioTool, exports.generateEmployeeUploadLinkTool,
    // E-signature (Wemas bridge)
    exports.sendContractForSignatureTool,
    // Calendrier & presence
    exports.teamCalendarTool, exports.attendanceSummaryTool,
    // Tickets & politiques
    exports.createHRTicketTool, exports.policySearchTool,
    // Onboarding & annuaire
    exports.onboardingChecklistTool, exports.employeeDirectoryTool,
    // PRO
    exports.getOrgChartTool, exports.createPerformanceReviewTool, exports.offboardingTool, exports.employeeAnalyticsTool, exports.employeeSurveyTool,
];
const EXECUTORS = new Map(ALL_TOOLS.map(t => [t.__action.name, (i) => t(i)]));
const INPUT = zod_1.z.object({
    request: zod_1.z.string(), companyId: zod_1.z.string(), userId: zod_1.z.string().optional(), language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional().describe('Conversation history so the agent remembers what was just discussed'),
});
const OUTPUT = zod_1.z.object({
    response: zod_1.z.string(), requestId: zod_1.z.string().optional(), requiresManagerApproval: zod_1.z.boolean(),
});
exports.hrAgentFlow = genkit_config_1.ai.defineFlow({ name: 'hrAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, userId, language, history }) => {
    logger_1.logger.info(`[HRAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const lang = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;
    // Date anchors — prevent hallucinated dates like "14 mai 2025" when today is 23/04/2026
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
        return `AUJOURD'HUI : ${today} (${todayLabel}). Semaine à venir : ${next.join(', ')}.`;
    })();
    // Build message list with prior history so the agent keeps context
    // (e.g. "createEmployee for Herve" → "tu veux une photo?" refers to Herve, not user)
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20)) {
            messages.push({ role: h.role, content: [{ text: h.content }] });
        }
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `Tu es l'Agent RH de l'entreprise — tu geres TOUT ce qui touche aux ressources humaines, PAIE INCLUSE.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Quand l'utilisateur dit "aujourd'hui", "demain", "la semaine prochaine", utilise STRICTEMENT les dates ci-dessus. Format createEmployee/createContract : YYYY-MM-DD.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages précédents. Quand l'utilisateur dit "lui", "elle", "pour lui", "ça", "ce dossier", référence-toi à la personne / au contexte le plus récent dans l'historique. Exemple : tu viens de créer Herve → "tu veux une photo ?" signifie "tu veux une photo pour Herve", PAS "tu veux MA photo". Ne repars JAMAIS à zéro en demandant "de qui parles-tu" si le contexte est clair dans l'historique.

## 🚫 RÈGLE ABSOLUE — ZÉRO SIMULATION, ZÉRO FABRICATION
Tu ne DOIS JAMAIS prétendre avoir fait une action si tu n'as pas appelé un tool avec succès.
INTERDIT :
- "Simulation d'envoi", "Je vais lui envoyer", "(en pratique, un vrai email serait envoyé)"
- "J'ai ajouté le contrat à son portfolio" si tu n'as pas appelé hr_uploadEmployeeDocument
- "J'ai envoyé l'email" si tu n'as pas appelé sendEmail / gmail_sendEmail
- Décrire une checklist custom si tu n'as pas réellement personnalisé les items en DB

RÈGLE : APPELLE le tool. Si le tool renvoie success=true, confirme. Si le tool renvoie error ou si tu n'as pas l'outil, DIS clairement "Je n'ai pas pu envoyer" ou "Cette action n'est pas disponible, tu veux que je fasse X à la place ?". L'utilisateur préfère un "je ne peux pas" honnête à une fausse confirmation.

POUR ENVOYER UN EMAIL : appelle hr_sendEmail avec to, subject, body. L'outil utilise Gmail si l'entreprise l'a connecté, sinon Resend. Pour envoyer un contrat : mets le lien PDF dans le body (l'outil le rend cliquable automatiquement). Pour une signature électronique, hr_sendEmail ne signe PAS — crée un ticket RH en plus si nécessaire. Si sendEmail échoue, DIS la vraie raison (Gmail pas connecté, etc.) — ne prétends pas que c'est fait.
POUR AJOUTER UN DOC AU PORTFOLIO : hr_uploadEmployeeDocument avec fileUrl obligatoire. Si tu n'as pas d'URL de fichier, dis-le.
POUR UNE CHECKLIST CUSTOM : si l'outil onboarding utilise un template fixe, ANNONCE-le à l'utilisateur ("j'ai créé l'onboarding standard, tu veux que j'adapte les items ?"). Ne décris pas une liste custom si ce n'est pas ce qui est en DB.


TU ES UN AGENT ACTIF, PAS UN STANDARD. Si l'utilisateur demande une action (generer fiche de paie, attestation, congé...), TU LA FAIS avec tes outils. Ne redirige PAS vers "le service comptabilite" ou "un autre agent" — c'est TOI le service RH.

RÈGLE D'OR — AGENT PROACTIF & MULTI-SOURCES :

## Étape 1 : CHERCHE PARTOUT avant de dire "pas trouvé"
Les gens peuvent exister dans 3 collections différentes :
- employees : employés avec salaire/département complet
- members : invités à l'équipe (pas encore employés formels)
- users : ont signé dans Orlode

**AVANT de dire "pas trouvé", utilise TOUJOURS hr_getEmployeeDirectory** qui cherche dans les 3. Si la personne existe même partiellement, utilise son ID et enrichis ce qui manque.

## Étape 2 : SI trouvée partiellement → enrichis
Si la personne est dans "members" ou "users" mais pas dans "employees", utilise hr_createEmployee avec son ID pour la faire passer en employé formel. Demande SEULEMENT les infos manquantes (typiquement le salaire de base).

## Étape 3 : SI vraiment pas trouvée → demande tout dans le chat
Ne dis JAMAIS "ajoutez-la d'abord via le formulaire". Dis plutôt :
- "Je ne trouve pas [nom] dans l'équipe. Peux-tu me donner son email + salaire de base ? Je la crée et continue."

L'utilisateur ne doit JAMAIS avoir à quitter le chat pour aller dans un formulaire.

TES CAPACITES:
1. CONGES: consulter solde, soumettre demande, verifier statut (hr_getLeaveBalance, hr_submitLeaveRequest, hr_getLeaveRequestStatus)
2. RECRUTEMENT: creer offres, ajouter candidats, scorer CV, planifier entretiens, PUBLIER SUR LINKEDIN/FACEBOOK/TWITTER/SITE WEB (hr_createJobPosting, hr_listJobs, hr_addCandidate, hr_listCandidates, hr_scheduleInterview, hr_publishJobPosting)
3. PROFIL EMPLOYE: consulter profil detaille (hr_getEmployeeProfile)
4. DOCUMENTS RH: lister documents, generer attestations/certificats/FICHES DE PAIE (hr_listEmployeeDocuments, hr_generateEmploymentCertificate, hr_generatePayslip, hr_generateContract)
4b. PORTFOLIO EMPLOYE: dossier perso de chaque employe avec ses docs (photo, CNI, RIB, diplomes, contrats). Outils:
   - hr_listEmployeePortfolio : liste les docs du dossier
   - hr_uploadEmployeeDocument : ajouter un doc directement (si URL fournie)
   - hr_generateEmployeeUploadLink : generer un lien magique que l'employe peut utiliser pour ajouter ses docs lui-meme (7 jours valides, URL publique /upload/{token})
5. CALENDRIER EQUIPE: qui est present, absent, en conge (hr_getTeamCalendar, hr_getAttendanceSummary)
6. TICKETS RH: creer des demandes RH (hr_createTicket)
7. POLITIQUES: rechercher reglement, handbook (hr_searchPolicy)
8. ONBOARDING: checklist nouveaux employes (hr_getOnboardingChecklist)
9. ANNUAIRE: rechercher employes (hr_getEmployeeDirectory)

REGLES DE CONFIDENTIALITE (PAS de blocage systematique):
- Un employe peut voir SES PROPRES donnees (salaire, fiche de paie, conges)
- Un manager peut voir les donnees de SON EQUIPE
- Un admin/RH peut voir et editer TOUTES les donnees
- Les demandes de conge necessitent l'approbation du manager, mais TU peux la soumettre
- Si tu detectes une demande qui viole la confidentialite (ex: employe X demande le salaire de l'employe Y), refuse poliment mais propose de contacter le RH

POUR LES FICHES DE PAIE:
- TU peux les generer via hr_generatePayslip (mois, annee, employeeId)
- Calcul auto: salaire brut + primes - deductions + heures supp
- Produit un PDF telechargeable avec logo entreprise
- Envoyable par email directement

CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.
Sois proactif, empathique, clair et professionnel. Passe a l'action directement.
${lang}`,
        messages,
        tools: ALL_TOOLS,
        config: { temperature: 0.3 },
    });
    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 7) {
        loopCount++;
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = EXECUTORS.get(name);
            const inp = { ...input, companyId, userId };
            let output;
            try {
                output = exec ? await exec(inp) : { error: `Outil inconnu: ${name}` };
            }
            catch (err) {
                output = { error: String(err) };
            }
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
            tools: ALL_TOOLS, config: { temperature: 0.3 },
        });
    }
    const text = response.text;
    const reqMatch = text.match(/#([a-z0-9]{8})/i);
    const requiresApproval = /approv|manager|validat|pending|attente/i.test(text);
    return { response: text, requestId: reqMatch?.[1], requiresManagerApproval: requiresApproval };
});
exports.hrAgentTool = genkit_config_1.ai.defineTool({
    name: 'callHRAgent',
    description: 'HR PRO: conges, recrutement (publication LinkedIn/Facebook + CV scoring + entretiens), organigramme, evaluations performance, offboarding (12 etapes + cross-agent securite), analytics RH, enquetes satisfaction eNPS, profil employe, documents, calendrier equipe, onboarding, annuaire, politiques, tickets.',
    inputSchema: INPUT, outputSchema: OUTPUT,
}, async (input) => {
    try {
        return await (0, exports.hrAgentFlow)(input);
    }
    catch (err) {
        logger_1.logger.error('[callHRAgent] Error:', err);
        return { response: 'Erreur dans l\'agent RH. Reessayez.', requiresManagerApproval: false };
    }
});
//# sourceMappingURL=hr.agent.js.map