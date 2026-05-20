/**
 * HR Agent V1+ — Gemini Flash
 * Full HR: conges, recrutement, profil employe, documents RH, calendrier equipe,
 * presence, onboarding, annuaire, politiques, tickets RH.
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

// ══════════════════════════════════════════════════════════════════════════════
// 1. CONGES (existants, ameliores)
// ══════════════════════════════════════════════════════════════════════════════

export const leaveBalanceTool = ai.defineTool(
  {
    name: 'hr_getLeaveBalance',
    description: 'Get employee leave balance (paid leave, sick, RTT, etc.).',
    inputSchema: z.object({ companyId: z.string(), userId: z.string() }),
    outputSchema: z.object({ success: z.boolean().optional(), message: z.string().optional(), paidLeave: z.number(), sickDays: z.number(), rtt: z.number(), other: z.number(), year: z.number() }),
  },
  async ({ companyId, userId }) => {
    const db = getFirestore();
    const year = new Date().getFullYear();
    const doc = await db.collection(`companies/${companyId}/leaveBalances`).doc(`${userId}_${year}`).get().catch(() => null);
    if (doc?.exists) {
      const d = doc.data()!;
      return { success: true, paidLeave: (d['paidLeave'] as number) ?? 25, sickDays: (d['sickDays'] as number) ?? 0, rtt: (d['rtt'] as number) ?? 10, other: (d['other'] as number) ?? 0, year };
    }
    return { success: true, paidLeave: 25, sickDays: 0, rtt: 10, other: 0, year };
  }
);

export const leaveRequestTool = ai.defineTool(
  {
    name: 'hr_submitLeaveRequest',
    description: 'Submit a leave request. Requires manager approval.',
    inputSchema: z.object({
      companyId: z.string(), userId: z.string(),
      type: z.enum(['paid', 'sick', 'rtt', 'unpaid', 'other']).default('paid'),
      startDate: z.string(), endDate: z.string(), reason: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean().optional(), requestId: z.string(), status: z.string(), message: z.string() }),
  },
  async ({ companyId, userId, type, startDate, endDate, reason }) => {
    const db = getFirestore();
    const id = generateId();
    // Get employee name
    let empName = '';
    try { const u = await db.collection('users').doc(userId).get(); empName = (u.data()?.['displayName'] as string) ?? ''; } catch {}
    try {
      await db.collection(`companies/${companyId}/leaveRequests`).doc(id).set({
        id, userId, employeeName: empName, type, startDate, endDate,
        reason: reason ?? '', status: 'pending',
        submittedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('[HR] submitLeaveRequest write failed', { error: String(err) });
      return { success: false, requestId: '', status: 'error', message: 'Sauvegarde de la demande de congé impossible.' };
    }
    return { success: true, requestId: id, status: 'pending', message: `Demande #${id.slice(0, 8)} soumise (${type}, ${startDate} → ${endDate}). En attente d'approbation manager.` };
  }
);

export const leaveStatusTool = ai.defineTool(
  {
    name: 'hr_getLeaveRequestStatus',
    description: 'Check the status of a leave request or list pending requests for a user.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string(), requestId: z.string().optional() }),
    outputSchema: z.object({
      success: z.boolean().optional(), message: z.string().optional(),
      requests: z.array(z.object({ id: z.string(), type: z.string(), startDate: z.string(), endDate: z.string(), status: z.string(), reason: z.string() })),
    }),
  },
  async ({ companyId, userId, requestId }) => {
    const db = getFirestore();
    if (requestId) {
      const doc = await db.collection(`companies/${companyId}/leaveRequests`).doc(requestId).get().catch(() => null);
      if (!doc?.exists) return { success: true, requests: [] };
      const d = doc.data()!;
      return { success: true, requests: [{ id: doc.id, type: (d['type'] as string) ?? '', startDate: (d['startDate'] as string) ?? '', endDate: (d['endDate'] as string) ?? '', status: (d['status'] as string) ?? '', reason: (d['reason'] as string) ?? '' }] };
    }
    const snap = await db.collection(`companies/${companyId}/leaveRequests`).where('userId', '==', userId).orderBy('createdAt', 'desc').limit(10).get().catch((err) => {
      logger.error('[HR] getLeaveRequestStatus query failed', { error: String(err) });
      return null;
    });
    if (!snap) return { success: false, message: 'Lecture des demandes impossible.', requests: [] };
    return { success: true, requests: snap.docs.map(d => { const x = d.data(); return { id: d.id, type: (x['type'] as string) ?? '', startDate: (x['startDate'] as string) ?? '', endDate: (x['endDate'] as string) ?? '', status: (x['status'] as string) ?? '', reason: (x['reason'] as string) ?? '' }; }) };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. RECRUTEMENT (nouveau)
// ══════════════════════════════════════════════════════════════════════════════

export const createJobPostingTool = ai.defineTool(
  {
    name: 'hr_createJobPosting',
    description: 'Create a new job posting / job offer.',
    inputSchema: z.object({
      companyId: z.string(), title: z.string(), department: z.string().optional(),
      description: z.string(), requirements: z.string().optional(),
      employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship']).optional().default('full-time'),
      location: z.string().optional(), salary: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean().optional(), jobId: z.string(), message: z.string() }),
  },
  async ({ companyId, title, department, description, requirements, employmentType, location, salary }) => {
    const db = getFirestore();
    const id = generateId();
    try {
      await db.collection(`companies/${companyId}/jobPostings`).doc(id).set({
        id, title, department: department ?? '', description, requirements: requirements ?? '',
        employmentType, location: location ?? '', salary: salary ?? '',
        status: 'open', applicantCount: 0,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('[HR] createJobPosting write failed', { error: String(err) });
      return { success: false, jobId: '', message: 'Sauvegarde de l\'offre impossible.' };
    }
    return { success: true, jobId: id, message: `Offre "${title}" creee (${employmentType}). Statut: ouverte.` };
  }
);

export const listJobsTool = ai.defineTool(
  {
    name: 'hr_listJobs',
    description: 'List open job postings for the company.',
    inputSchema: z.object({ companyId: z.string(), status: z.enum(['open', 'closed', 'all']).optional().default('open') }),
    outputSchema: z.object({ success: z.boolean().optional(), message: z.string().optional(), jobs: z.array(z.object({ id: z.string(), title: z.string(), department: z.string(), status: z.string(), applicantCount: z.number() })) }),
  },
  async ({ companyId, status }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/jobPostings`) as FirebaseFirestore.Query;
    if (status !== 'all') q = q.where('status', '==', status);
    const snap = await q.limit(50).get().catch((err) => {
      logger.error('[HR] listJobs query failed', { error: String(err) });
      return null;
    });
    if (!snap) return { success: false, message: 'Lecture des offres impossible.', jobs: [] };
    return { success: true, jobs: snap.docs.map(d => { const x = d.data(); return { id: d.id, title: (x['title'] as string) ?? '', department: (x['department'] as string) ?? '', status: (x['status'] as string) ?? '', applicantCount: (x['applicantCount'] as number) ?? 0 }; }) };
  }
);

export const addCandidateTool = ai.defineTool(
  {
    name: 'hr_addCandidate',
    description: 'Add a candidate to a job posting. Score their CV if description provided.',
    inputSchema: z.object({
      companyId: z.string(), jobId: z.string(),
      name: z.string(), email: z.string().optional(), phone: z.string().optional(),
      cvSummary: z.string().optional().describe('Summary or key points from their CV'),
      notes: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean().optional(), candidateId: z.string(), score: z.number().optional(), message: z.string() }),
  },
  async ({ companyId, jobId, name, email, phone, cvSummary, notes }) => {
    const db = getFirestore();
    const id = generateId();

    // Auto-score if CV provided
    let score: number | undefined;
    if (cvSummary) {
      try {
        const jobDoc = await db.collection(`companies/${companyId}/jobPostings`).doc(jobId).get();
        const jobData = jobDoc.data();
        if (jobData) {
          const { text } = await ai.generate({
            model: GEMINI_FLASH,
            prompt: `Score this candidate from 0 to 100 based on job fit.\nJob: ${jobData['title']} - ${jobData['description']}\nRequirements: ${jobData['requirements']}\n\nCandidate CV: ${cvSummary}\n\nReturn ONLY a number (0-100).`,
            config: { temperature: 0.1 },
          });
          score = parseInt(text.trim()) || undefined;
        }
      } catch (err) {
        logger.warn('[HR] addCandidate scoring failed (non-blocking)', { error: String(err) });
      }
    }

    try {
      await db.collection(`companies/${companyId}/candidates`).doc(id).set({
        id, jobId, name, email: email ?? '', phone: phone ?? '',
        cvSummary: cvSummary ?? '', notes: notes ?? '',
        score: score ?? null, status: 'new',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('[HR] addCandidate write failed', { error: String(err) });
      return { success: false, candidateId: '', message: 'Sauvegarde du candidat impossible.' };
    }

    // Increment applicant count
    try { await db.collection(`companies/${companyId}/jobPostings`).doc(jobId).update({ applicantCount: FieldValue.increment(1) }); } catch {}

    return { success: true, candidateId: id, score, message: `Candidat "${name}" ajoute${score ? ` (score: ${score}/100)` : ''}. Statut: nouveau.` };
  }
);

export const listCandidatesTool = ai.defineTool(
  {
    name: 'hr_listCandidates',
    description: 'List candidates for a job posting, with scores and status.',
    inputSchema: z.object({ companyId: z.string(), jobId: z.string() }),
    outputSchema: z.object({ success: z.boolean().optional(), message: z.string().optional(), candidates: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), score: z.number().optional(), status: z.string() })) }),
  },
  async ({ companyId, jobId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/candidates`).where('jobId', '==', jobId).limit(100).get().catch((err) => {
      logger.error('[HR] listCandidates query failed', { error: String(err) });
      return null;
    });
    if (!snap) return { success: false, message: 'Lecture des candidats impossible.', candidates: [] };
    return { success: true, candidates: snap.docs.map(d => { const x = d.data(); return { id: d.id, name: (x['name'] as string) ?? '', email: (x['email'] as string) ?? '', score: x['score'] as number | undefined, status: (x['status'] as string) ?? '' }; }) };
  }
);

export const scheduleInterviewTool = ai.defineTool(
  {
    name: 'hr_scheduleInterview',
    description: 'Schedule an interview with a candidate.',
    inputSchema: z.object({
      companyId: z.string(), candidateId: z.string(),
      date: z.string(), time: z.string(), interviewer: z.string().optional(),
      type: z.enum(['phone', 'video', 'onsite']).optional().default('video'),
      notes: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean().optional(), interviewId: z.string(), message: z.string() }),
  },
  async ({ companyId, candidateId, date, time, interviewer, type, notes }) => {
    const db = getFirestore();
    const id = generateId();
    // Get candidate name
    let candidateName = '';
    try { const c = await db.collection(`companies/${companyId}/candidates`).doc(candidateId).get(); candidateName = (c.data()?.['name'] as string) ?? ''; } catch {}

    try {
      await db.collection(`companies/${companyId}/interviews`).doc(id).set({
        id, candidateId, candidateName, date, time, interviewer: interviewer ?? '',
        type, notes: notes ?? '', status: 'scheduled',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('[HR] scheduleInterview write failed', { error: String(err) });
      return { success: false, interviewId: '', message: 'Sauvegarde de l\'entretien impossible.' };
    }

    // Update candidate status
    try { await db.collection(`companies/${companyId}/candidates`).doc(candidateId).update({ status: 'interview_scheduled' }); } catch {}

    return { success: true, interviewId: id, message: `Entretien ${type} planifie pour "${candidateName}" le ${date} a ${time}.` };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. PROFIL EMPLOYE (nouveau)
// ══════════════════════════════════════════════════════════════════════════════

export const employeeProfileTool = ai.defineTool(
  {
    name: 'hr_getEmployeeProfile',
    description: 'Get detailed employee profile — personal info, department, manager, start date, work mode.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string().optional(), employeeName: z.string().optional() }),
    outputSchema: z.object({
      success: z.boolean().optional(), message: z.string().optional(),
      found: z.boolean(), name: z.string(), email: z.string(), department: z.string(),
      jobTitle: z.string(), manager: z.string(), startDate: z.string(),
      employmentType: z.string(), workMode: z.string(), phone: z.string(),
    }),
  },
  async ({ companyId, userId, employeeName }) => {
    const db = getFirestore();
    let data: Record<string, unknown> | undefined;

    if (userId) {
      const doc = await db.collection('users').doc(userId).get().catch(() => null);
      if (doc?.exists) data = doc.data() as Record<string, unknown>;
    } else if (employeeName) {
      const snap = await db.collection('users').where('companyId', '==', companyId).limit(200).get().catch((err) => {
        logger.error('[HR] getEmployeeProfile query failed', { error: String(err) });
        return null;
      });
      if (snap) {
        const q = employeeName.toLowerCase();
        const match = snap.docs.find(d => ((d.data()['displayName'] as string) ?? '').toLowerCase().includes(q));
        if (match) data = match.data() as Record<string, unknown>;
      }
    }

    if (!data) return { success: true, found: false, name: '', email: '', department: '', jobTitle: '', manager: '', startDate: '', employmentType: '', workMode: '', phone: '' };

    // Convert Firestore Timestamp (object with _seconds) to ISO date string
    const toDateString = (v: unknown): string => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'object' && v !== null) {
        const o = v as { _seconds?: number; seconds?: number; toDate?: () => Date };
        if (typeof o.toDate === 'function') return o.toDate().toISOString().split('T')[0];
        const secs = o._seconds ?? o.seconds;
        if (typeof secs === 'number') return new Date(secs * 1000).toISOString().split('T')[0];
      }
      return '';
    };

    return {
      success: true,
      found: true,
      name: (data['displayName'] as string) ?? '',
      email: (data['email'] as string) ?? '',
      department: (data['department'] as string) ?? '',
      jobTitle: (data['jobTitle'] as string) ?? '',
      manager: (data['managerId'] as string) ?? (data['manager'] as string) ?? '',
      startDate: toDateString(data['startDate']) || toDateString(data['createdAt']) || '',
      employmentType: (data['employmentType'] as string) ?? 'full-time',
      workMode: (data['workMode'] as string) ?? 'onsite',
      phone: (data['phone'] as string) ?? '',
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. DOCUMENTS RH (nouveau)
// ══════════════════════════════════════════════════════════════════════════════

export const listEmployeeDocsTool = ai.defineTool(
  {
    name: 'hr_listEmployeeDocuments',
    description: 'List HR documents for an employee (contract, attestation, certificates, payslips).',
    inputSchema: z.object({ companyId: z.string(), userId: z.string() }),
    outputSchema: z.object({ success: z.boolean().optional(), message: z.string().optional(), documents: z.array(z.object({ id: z.string(), type: z.string(), title: z.string(), date: z.string() })) }),
  },
  async ({ companyId, userId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/hrDocuments`).where('userId', '==', userId).limit(50).get().catch((err) => {
      logger.error('[HR] listEmployeeDocuments query failed', { error: String(err) });
      return null;
    });
    if (!snap) return { success: false, message: 'Lecture des documents impossible.', documents: [] };
    return { success: true, documents: snap.docs.map(d => { const x = d.data(); return { id: d.id, type: (x['type'] as string) ?? '', title: (x['title'] as string) ?? '', date: (x['createdAt']?.toDate?.()?.toISOString?.() ?? '') as string }; }) };
  }
);

export const generateCertificateTool = ai.defineTool(
  {
    name: 'hr_generateEmploymentCertificate',
    description: 'Generate an employment certificate / attestation for an employee.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string(), certificateType: z.enum(['employment', 'salary', 'training', 'recommendation']).optional().default('employment') }),
    outputSchema: z.object({ success: z.boolean().optional(), documentId: z.string(), content: z.string(), message: z.string() }),
  },
  async ({ companyId, userId, certificateType }) => {
    const db = getFirestore();
    // Get employee + company info
    const [empDoc, compDoc] = await Promise.all([
      db.collection('users').doc(userId).get().catch(() => null),
      db.collection('companies').doc(companyId).get().catch(() => null),
    ]);
    const emp = empDoc?.data() ?? {};
    const comp = compDoc?.data() ?? {};

    let text: string;
    try {
      const result = await ai.generate({
        model: GEMINI_FLASH,
        prompt: `Genere une attestation de type "${certificateType}" en francais, professionnelle et formelle.
Entreprise: ${comp['name'] ?? 'Orlode'}, ${comp['address'] ?? ''}
Employe: ${emp['displayName'] ?? ''}, poste: ${emp['jobTitle'] ?? ''}, departement: ${emp['department'] ?? ''}
Date d'embauche: ${emp['startDate'] ?? emp['createdAt'] ?? 'non specifiee'}
Date du jour: ${new Date().toLocaleDateString('fr-FR')}

Retourne UNIQUEMENT le texte de l'attestation, formate proprement.`,
        config: { temperature: 0.2 },
      });
      text = result.text;
    } catch (err) {
      logger.error('[HR] generateCertificate AI generation failed', { error: String(err) });
      return { success: false, documentId: '', content: '', message: `Génération de l'attestation impossible: ${err instanceof Error ? err.message : String(err)}` };
    }

    const docId = generateId();
    try {
      await db.collection(`companies/${companyId}/hrDocuments`).doc(docId).set({
        id: docId, userId, type: certificateType, title: `Attestation ${certificateType} - ${emp['displayName'] ?? ''}`,
        content: text, createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('[HR] generateCertificate write failed', { error: String(err) });
      return { success: false, documentId: '', content: text, message: 'Sauvegarde de l\'attestation impossible.' };
    }

    return { success: true, documentId: docId, content: text, message: `Attestation "${certificateType}" generee pour ${emp['displayName'] ?? 'l\'employe'}.` };
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Payslip generator — generates a monthly payslip for an employee.
// Uses: employee base salary + presence/hours + bonuses/deductions if stored.
// ──────────────────────────────────────────────────────────────────────────────

export const generatePayslipTool = ai.defineTool(
  {
    name: 'hr_generatePayslip',
    description: 'Generate a monthly payslip (fiche de paie) for an employee. Includes gross salary, deductions, net pay. Returns a downloadable document.',
    inputSchema: z.object({
      companyId: z.string(),
      employeeId: z.string().describe('User ID of the employee'),
      month: z.number().min(1).max(12).describe('Month number 1-12'),
      year: z.number().min(2020).max(2100),
      grossSalary: z.number().optional().describe('Override gross salary. Falls back to employee profile baseSalary.'),
      bonuses: z.number().optional().default(0).describe('Additional bonuses/primes'),
      overtime: z.number().optional().default(0).describe('Overtime amount'),
      deductions: z.number().optional().default(0).describe('Extra deductions (advances, etc.)'),
      currency: z.string().optional().default('XOF'),
    }),
    outputSchema: z.object({
      success: z.boolean().optional(),
      documentId: z.string(),
      employeeName: z.string(),
      grossTotal: z.number(),
      socialCharges: z.number(),
      netPay: z.number(),
      pdfUrl: z.string().optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, employeeId, month, year, grossSalary, bonuses, overtime, deductions, currency }) => {
    const db = getFirestore();
    // Check the formal employees collection first (has salary), then fall back to users
    const [empDocHR, empDocUser, compDoc] = await Promise.all([
      db.collection(`companies/${companyId}/employees`).doc(employeeId).get().catch(() => null),
      db.collection('users').doc(employeeId).get().catch(() => null),
      db.collection('companies').doc(companyId).get().catch(() => null),
    ]);
    // Merge: prefer HR employee data for salary, fall back to user profile for name/email
    const emp = { ...(empDocUser?.data() ?? {}), ...(empDocHR?.data() ?? {}) } as Record<string, unknown>;
    const comp = compDoc?.data() ?? {};

    const baseSalary = grossSalary ?? (emp['baseSalary'] as number) ?? 0;
    if (baseSalary === 0) {
      return {
        success: false,
        documentId: '',
        employeeName: (emp['displayName'] as string) ?? employeeId,
        grossTotal: 0,
        socialCharges: 0,
        netPay: 0,
        message: `Aucun salaire de base trouvé pour ${emp['displayName'] ?? employeeId}. Renseignez baseSalary dans le profil ou fournissez grossSalary en paramètre.`,
      };
    }

    const gross = baseSalary + (bonuses ?? 0) + (overtime ?? 0);
    // Simplified social charges (CNPS Côte d'Ivoire ~6.3% employee, adjust per country):
    const socialChargesPct = (emp['socialChargesPct'] as number) ?? 0.063;
    const socialCharges = Math.round(gross * socialChargesPct);
    const taxableBase = gross - socialCharges;
    // Simplified IUTS tax approximation (real calc needs brackets):
    const taxPct = (emp['taxPct'] as number) ?? 0.10;
    const incomeTax = Math.round(taxableBase * taxPct);
    const netPay = gross - socialCharges - incomeTax - (deductions ?? 0);

    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const docId = generateId();

    const content = {
      payslipNumber: `PAY-${year}${String(month).padStart(2, '0')}-${docId.slice(0, 6).toUpperCase()}`,
      period: `${monthNames[month - 1]} ${year}`,
      employee: {
        id: employeeId,
        name: (emp['displayName'] as string) ?? 'Employé',
        jobTitle: (emp['jobTitle'] as string) ?? '',
        department: (emp['department'] as string) ?? '',
        email: (emp['email'] as string) ?? '',
        startDate: emp['startDate'] ?? emp['createdAt'] ?? null,
      },
      company: {
        name: (comp['name'] as string) ?? 'Orlode',
        address: (comp['address'] as string) ?? '',
        taxId: (comp['taxId'] as string) ?? '',
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
        createdAt: FieldValue.serverTimestamp(),
      });

      // Also add to employee documents for easy retrieval
      await db.collection(`companies/${companyId}/hrDocuments`).doc(docId).set({
        id: docId,
        userId: employeeId,
        type: 'payslip',
        title: `Fiche de paie — ${monthNames[month - 1]} ${year}`,
        period: content.period,
        payslipId: docId,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('[HR] generatePayslip write failed', { error: String(err) });
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
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Employee portfolio — uploads, lists, and generates upload links for the
// employee's document folder. Reuses the WEMAS portfolio system (per email).
// ──────────────────────────────────────────────────────────────────────────────

export const uploadEmployeeDocTool = ai.defineTool(
  {
    name: 'hr_uploadEmployeeDocument',
    description: "Upload a document to an employee's portfolio folder (ID card, RIB, diploma, etc.). Use when a file URL is already available.",
    inputSchema: z.object({
      companyId: z.string(),
      employeeEmail: z.string(),
      employeeName: z.string(),
      documentType: z.enum(['id_card', 'passport', 'driver_license', 'rib', 'kbis', 'photo', 'diploma', 'medical', 'contract', 'autre']),
      label: z.string(),
      fileUrl: z.string(),
      fileName: z.string(),
      fileSize: z.number().optional().default(0),
    }),
    outputSchema: z.object({ success: z.boolean().optional(), documentId: z.string(), message: z.string() }),
  },
  async ({ companyId, employeeEmail, employeeName, documentType, label, fileUrl, fileName, fileSize }) => {
    const db = getFirestore();
    const docId = generateId();
    try {
      await db.collection(`companies/${companyId}/portfolioDocuments`).doc(docId).set({
        id: docId, companyId, signatoryEmail: employeeEmail, signatoryName: employeeName,
        documentType, label, fileUrl, fileName, fileSize: fileSize ?? 0,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('[HR] uploadEmployeeDocument write failed', { error: String(err) });
      return { success: false, documentId: '', message: 'Sauvegarde du document impossible.' };
    }
    return { success: true, documentId: docId, message: `Document "${label}" ajouté au portfolio de ${employeeName}.` };
  }
);

export const listEmployeePortfolioTool = ai.defineTool(
  {
    name: 'hr_listEmployeePortfolio',
    description: "List all documents in an employee's portfolio folder.",
    inputSchema: z.object({ companyId: z.string(), employeeEmail: z.string() }),
    outputSchema: z.object({
      success: z.boolean().optional(), message: z.string().optional(),
      documents: z.array(z.object({ id: z.string(), type: z.string(), label: z.string(), fileName: z.string(), fileUrl: z.string(), createdAt: z.string() })),
      total: z.number(),
    }),
  },
  async ({ companyId, employeeEmail }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/portfolioDocuments`)
      .where('signatoryEmail', '==', employeeEmail).limit(100).get().catch((err) => {
        logger.error('[HR] listEmployeePortfolio query failed', { error: String(err) });
        return null;
      });
    if (!snap) return { success: false, message: 'Lecture du portfolio impossible.', documents: [], total: 0 };
    const documents = snap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id, type: (x['documentType'] as string) ?? 'autre', label: (x['label'] as string) ?? '',
        fileName: (x['fileName'] as string) ?? '', fileUrl: (x['fileUrl'] as string) ?? '',
        createdAt: (x['createdAt'] as string) ?? '',
      };
    });
    return { success: true, documents, total: documents.length };
  }
);

export const generateEmployeeUploadLinkTool = ai.defineTool(
  {
    name: 'hr_generateEmployeeUploadLink',
    description: "Generate a magic link that an employee can use to upload their own documents (ID, RIB, diplomas, etc.). Send this link by email or WhatsApp.",
    inputSchema: z.object({
      companyId: z.string(),
      employeeEmail: z.string(),
      employeeName: z.string(),
      requestedDocs: z.array(z.string()).optional(),
      expiresInDays: z.number().optional().default(7),
    }),
    outputSchema: z.object({ success: z.boolean().optional(), uploadUrl: z.string(), expiresAt: z.string(), message: z.string() }),
  },
  async ({ companyId, employeeEmail, employeeName, requestedDocs, expiresInDays }) => {
    try {
      const { wemasService } = await import('../services/wemas/wemasService');
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
    } catch (err) {
      logger.error('[HR] generateEmployeeUploadLink failed', { error: String(err) });
      return {
        success: false,
        uploadUrl: '',
        expiresAt: '',
        message: `Génération du lien d'upload impossible: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Generate employment contract PDF — creates a ready-to-sign contract with all
// standard clauses (engagement, trial, hours, salary, leaves, confidentiality).
// ──────────────────────────────────────────────────────────────────────────────

export const generateContractTool = ai.defineTool(
  {
    name: 'hr_generateContract',
    description: 'Generate a full employment contract PDF for an employee with all standard clauses (engagement, trial period, hours, salary, leaves, confidentiality, termination). Returns a downloadable URL.',
    inputSchema: z.object({
      companyId: z.string(),
      employeeId: z.string(),
      contractType: z.enum(['CDI', 'CDD', 'Stage', 'Freelance']).optional().default('CDI'),
      startDate: z.string().optional().describe('YYYY-MM-DD'),
      endDate: z.string().optional().describe('YYYY-MM-DD — required for CDD'),
      trialPeriodMonths: z.number().optional(),
      workHours: z.string().optional(),
      jobTitle: z.string().optional(),
      department: z.string().optional(),
      baseSalary: z.number().optional(),
      currency: z.string().optional().default('XOF'),
    }),
    outputSchema: z.object({
      success: z.boolean().optional(),
      contractId: z.string(),
      employeeName: z.string(),
      contractType: z.string(),
      pdfUrl: z.string(),
      message: z.string(),
    }),
  },
  async ({ companyId, employeeId, contractType, startDate, endDate, trialPeriodMonths, workHours, jobTitle, department, baseSalary, currency }) => {
    const db = getFirestore();
    // Gather employee info — check both employees/ and users/ collections
    const [empDocHR, empDocUser] = await Promise.all([
      db.collection(`companies/${companyId}/employees`).doc(employeeId).get().catch(() => null),
      db.collection('users').doc(employeeId).get().catch(() => null),
    ]);
    const emp = { ...(empDocUser?.data() ?? {}), ...(empDocHR?.data() ?? {}) } as Record<string, unknown>;

    const contractId = generateId();
    const accessToken = generateId() + generateId(); // ~48 chars, unguessable
    // Always resolve contractType to a concrete value — Firestore rejects undefined
    const resolvedContractType: 'CDI' | 'CDD' | 'Stage' | 'Freelance' = contractType ?? 'CDI';
    const contractData = {
      id: contractId,
      employeeId,
      type: 'employment_contract',
      contractType: resolvedContractType,
      startDate: startDate ?? (emp['startDate'] as string) ?? new Date().toISOString().split('T')[0],
      endDate: endDate ?? null,
      trialPeriodMonths: trialPeriodMonths ?? (resolvedContractType === 'CDI' ? 3 : 1),
      workHours: workHours ?? '40 heures hebdomadaires',
      jobTitle: jobTitle ?? (emp['jobTitle'] as string) ?? 'Collaborateur',
      department: department ?? (emp['department'] as string) ?? '',
      baseSalary: baseSalary ?? (emp['baseSalary'] as number) ?? 0,
      currency: currency ?? (emp['currency'] as string) ?? 'XOF',
      status: 'draft',
      accessToken,
      createdAt: FieldValue.serverTimestamp(),
    };
    // Strip any remaining undefined before Firestore write
    const safeContractData = Object.fromEntries(
      Object.entries(contractData).filter(([, v]) => v !== undefined)
    );

    try {
      await db.collection(`companies/${companyId}/contracts`).doc(contractId).set(safeContractData);
      await db.collection(`companies/${companyId}/hrDocuments`).doc(contractId).set({
        id: contractId,
        userId: employeeId,
        type: 'contract',
        title: `Contrat ${resolvedContractType} — ${emp['displayName'] ?? 'Employé'}`,
        contractId,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('[HR] generateContract write failed', { error: String(err) });
      return {
        success: false,
        contractId: '',
        employeeName: (emp['displayName'] as string) ?? 'Employé',
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
      employeeName: (emp['displayName'] as string) ?? 'Employé',
      contractType: resolvedContractType,
      pdfUrl,
      message: `Contrat ${resolvedContractType} généré pour ${emp['displayName'] ?? 'l\'employé'}. PDF téléchargeable : ${pdfUrl}`,
    };
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// Create employee — agent can call this when an employee is missing from the DB
// but mentioned in conversation. Minimal info required.
// ──────────────────────────────────────────────────────────────────────────────

export const createEmployeeTool = ai.defineTool(
  {
    name: 'hr_createEmployee',
    description: 'Create a new employee record in the HR system. Use when the user mentions an employee that doesn\'t exist yet in the DB. Auto-reuses the existing user/member if they are already in the team.',
    inputSchema: z.object({
      companyId: z.string(),
      displayName: z.string().describe('Full name'),
      email: z.string().optional(),
      phone: z.string().optional(),
      jobTitle: z.string().optional(),
      department: z.string().optional(),
      baseSalary: z.number().optional().describe('Monthly gross salary'),
      currency: z.string().optional().default('XOF'),
      startDate: z.string().optional().describe('ISO date YYYY-MM-DD — defaults to today'),
    }),
    outputSchema: z.object({
      success: z.boolean().optional(),
      employeeId: z.string(),
      message: z.string(),
      reusedExisting: z.boolean().optional(),
    }),
  },
  async ({ companyId, displayName, email, phone, jobTitle, department, baseSalary, currency, startDate }) => {
    const db = getFirestore();

    // Try to find existing user by email first (to reuse uid as employeeId)
    let employeeId = generateId();
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      logger.error('[HR] createEmployee write failed', { error: String(err) });
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
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4a. SEND EMAIL — real outbound email (Gmail if connected, Resend fallback)
// ══════════════════════════════════════════════════════════════════════════════

export const hrSendEmailTool = ai.defineTool(
  {
    name: 'hr_sendEmail',
    description: "Envoie un VRAI email depuis la boîte de l'entreprise (Gmail si connecté, sinon Resend). À utiliser pour transmettre un contrat, une fiche de paie, une attestation, un lien d'onboarding. Ne confonds pas avec la signature électronique qui reste un ticket pour l'instant.",
    inputSchema: z.object({
      companyId: z.string(),
      to: z.string().describe('Destinataire — email de l\'employé ou candidat'),
      subject: z.string(),
      body: z.string().describe('Corps du message — peut inclure des liens (ex: PDF contrat)'),
      cc: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      provider: z.string().optional(),
      from: z.string().optional(),
      messageId: z.string().optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, to, subject, body, cc }) => {
    try {
      const { sendEmail } = await import('../services/email/emailService');
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
    } catch (err) {
      logger.error('[hr_sendEmail] Failed:', err);
      return {
        success: false,
        message: `Échec de l'envoi : ${(err as Error).message ?? String(err)}. Gmail pas connecté ? Vérifie /admin/gmail ou utilise Resend.`,
      };
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// 4b. UPDATE EMPLOYEE — patch existing fields without full re-creation
// ══════════════════════════════════════════════════════════════════════════════

export const updateEmployeeTool = ai.defineTool(
  {
    name: 'hr_updateEmployee',
    description: "Mettre à jour les champs d'une fiche employé existante (email, téléphone, poste, département, salaire, contrat). À utiliser quand l'utilisateur donne de nouvelles infos sur un employé déjà créé (ex: 'ajoute son email', 'change son salaire', 'met à jour son poste').",
    inputSchema: z.object({
      companyId: z.string(),
      employeeId: z.string().describe('ID de l\'employé (celui retourné par createEmployee ou findEmployee)'),
      email: z.string().optional(),
      phone: z.string().optional(),
      jobTitle: z.string().optional(),
      department: z.string().optional(),
      baseSalary: z.number().optional(),
      currency: z.string().optional(),
      startDate: z.string().optional(),
      status: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string(), updatedFields: z.array(z.string()) }),
  },
  async ({ companyId, employeeId, ...fields }) => {
    const db = getFirestore();
    // Only include fields that were actually provided (drop undefineds)
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const updatedFields: string[] = [];
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
    } catch (err) {
      logger.error('[HR] updateEmployee write failed', { error: String(err) });
      return { success: false, message: 'Mise à jour impossible.', updatedFields: [] };
    }
    return {
      success: true,
      message: `Mis à jour : ${updatedFields.join(', ')}.`,
      updatedFields,
    };
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. CALENDRIER EQUIPE & PRESENCE (nouveau)
// ══════════════════════════════════════════════════════════════════════════════

export const teamCalendarTool = ai.defineTool(
  {
    name: 'hr_getTeamCalendar',
    description: 'Get team availability — who is on leave, absent, remote, or present today/this week.',
    inputSchema: z.object({ companyId: z.string(), department: z.string().optional(), date: z.string().optional() }),
    outputSchema: z.object({
      success: z.boolean().optional(), message: z.string().optional(),
      present: z.array(z.string()), onLeave: z.array(z.string()), remote: z.array(z.string()), absent: z.array(z.string()),
      totalEmployees: z.number(), presenceRate: z.number(),
    }),
  },
  async ({ companyId, department, date }) => {
    const db = getFirestore();
    const today = date ?? new Date().toISOString().split('T')[0];

    // Get employees
    let empQ = db.collection('users').where('companyId', '==', companyId) as FirebaseFirestore.Query;
    if (department) empQ = empQ.where('department', '==', department);
    const empSnap = await empQ.limit(200).get().catch((err) => {
      logger.error('[HR] teamCalendar employees query failed', { error: String(err) });
      return null;
    });
    if (!empSnap) return { success: false, message: 'Lecture des employés impossible.', present: [], onLeave: [], remote: [], absent: [], totalEmployees: 0, presenceRate: 0 };
    const empNames = new Map(empSnap.docs.map(d => [d.id, (d.data()['displayName'] as string) ?? (d.data()['email'] as string) ?? '']));

    // Get presence
    const presSnap = await db.collection('presence').where('companyId', '==', companyId).where('date', '==', today).limit(200).get().catch(() => null);
    const presentIds = new Set(presSnap?.docs.filter(d => d.data()['status'] === 'present').map(d => (d.data()['employeeId'] as string) ?? '') ?? []);

    // Get leaves
    const leaveSnap = await db.collection(`companies/${companyId}/leaveRequests`).where('status', '==', 'approved').limit(200).get().catch(() => null);
    const onLeaveIds = new Set<string>();
    leaveSnap?.docs.forEach(d => {
      const data = d.data();
      if ((data['startDate'] as string) <= today && (data['endDate'] as string) >= today) {
        onLeaveIds.add((data['userId'] as string) ?? '');
      }
    });

    const present: string[] = [];
    const onLeave: string[] = [];
    const absent: string[] = [];
    const remote: string[] = [];

    empNames.forEach((name, id) => {
      if (onLeaveIds.has(id)) { onLeave.push(name); }
      else if (presentIds.has(id)) { present.push(name); }
      else { absent.push(name); }
    });

    const total = empNames.size;
    return { success: true, present, onLeave, remote, absent, totalEmployees: total, presenceRate: total > 0 ? Math.round((present.length / total) * 100) : 0 };
  }
);

export const attendanceSummaryTool = ai.defineTool(
  {
    name: 'hr_getAttendanceSummary',
    description: 'Get attendance summary for an employee or team (hours worked, late arrivals, absences).',
    inputSchema: z.object({ companyId: z.string(), userId: z.string().optional(), period: z.enum(['today', 'week', 'month']).optional().default('week') }),
    outputSchema: z.object({ success: z.boolean().optional(), message: z.string().optional(), totalHours: z.number(), daysPresent: z.number(), daysAbsent: z.number(), lateArrivals: z.number(), avgArrivalTime: z.string() }),
  },
  async ({ companyId, userId, period }) => {
    const db = getFirestore();
    const now = new Date();
    const cutoff = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    const from = new Date(now.getTime() - cutoff * 86400000).toISOString().split('T')[0];

    let q = db.collection('presence').where('companyId', '==', companyId).where('date', '>=', from) as FirebaseFirestore.Query;
    if (userId) q = q.where('employeeId', '==', userId);
    const snap = await q.limit(500).get().catch((err) => {
      logger.error('[HR] attendanceSummary query failed', { error: String(err) });
      return null;
    });
    if (!snap) return { success: false, message: 'Lecture de la présence impossible.', totalHours: 0, daysPresent: 0, daysAbsent: 0, lateArrivals: 0, avgArrivalTime: '09:00' };

    let totalHours = 0; let lateCount = 0; const arrivalTimes: number[] = [];
    snap.docs.forEach(d => {
      const data = d.data();
      totalHours += (data['hoursWorked'] as number) ?? 0;
      const checkIn = data['checkInAt']?.toDate?.() ?? data['checkInAt'];
      if (checkIn) {
        const hour = new Date(checkIn).getHours();
        arrivalTimes.push(hour);
        if (hour >= 10) lateCount++;
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
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. TICKETS RH & POLITIQUES (nouveau)
// ══════════════════════════════════════════════════════════════════════════════

export const createHRTicketTool = ai.defineTool(
  {
    name: 'hr_createTicket',
    description: 'Create an HR support ticket (question, complaint, request).',
    inputSchema: z.object({
      companyId: z.string(), userId: z.string(),
      subject: z.string(), description: z.string(),
      category: z.enum(['question', 'complaint', 'request', 'payroll', 'benefits', 'other']).optional().default('question'),
      priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    }),
    outputSchema: z.object({ success: z.boolean().optional(), ticketId: z.string(), message: z.string() }),
  },
  async ({ companyId, userId, subject, description, category, priority }) => {
    const db = getFirestore();
    const id = generateId();
    try {
      await db.collection(`companies/${companyId}/hrTickets`).doc(id).set({
        id, userId, subject, description, category, priority,
        status: 'open', createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('[HR] createTicket write failed', { error: String(err) });
      return { success: false, ticketId: '', message: 'Sauvegarde du ticket impossible.' };
    }
    return { success: true, ticketId: id, message: `Ticket RH #${id.slice(0, 8)} cree: "${subject}" (${category}, priorite ${priority}).` };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6bis. PUBLIER OFFRE SUR LINKEDIN / RESEAUX (nouveau)
// ══════════════════════════════════════════════════════════════════════════════

export const publishJobTool = ai.defineTool(
  {
    name: 'hr_publishJobPosting',
    description: 'Publish a job posting to LinkedIn, Facebook, Twitter, or the company website. Generates an attractive post from the job details.',
    inputSchema: z.object({
      companyId: z.string(),
      jobId: z.string(),
      platforms: z.array(z.enum(['linkedin', 'facebook', 'twitter', 'instagram', 'website'])).default(['linkedin']),
      customMessage: z.string().optional().describe('Optional custom intro or message to add'),
    }),
    outputSchema: z.object({
      success: z.boolean().optional(),
      results: z.array(z.object({ platform: z.string(), success: z.boolean(), url: z.string().optional(), error: z.string().optional() })),
      postContent: z.string(),
      message: z.string(),
    }),
  },
  async ({ companyId, jobId, platforms, customMessage }) => {
    const db = getFirestore();

    // Get job details
    const jobDoc = await db.collection(`companies/${companyId}/jobPostings`).doc(jobId).get().catch(() => null);
    if (!jobDoc?.exists) return { success: false, results: [], postContent: '', message: 'Offre non trouvee.' };
    const job = jobDoc.data()!;

    // Get company name
    let companyName = 'Notre entreprise';
    try { const c = await db.collection('companies').doc(companyId).get(); companyName = (c.data()?.['name'] as string) ?? companyName; } catch {}

    // Generate attractive social post
    let postContent: string;
    try {
      const result = await ai.generate({
        model: GEMINI_FLASH,
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
    } catch (err) {
      logger.error('[HR] publishJobPosting AI generation failed', { error: String(err) });
      return { success: false, results: [], postContent: '', message: `Génération du post impossible: ${err instanceof Error ? err.message : String(err)}` };
    }

    // Publish to social platforms
    const socialPlatforms = platforms.filter(p => p !== 'website') as Array<'linkedin' | 'facebook' | 'twitter' | 'instagram'>;
    const results: Array<{ platform: string; success: boolean; url?: string; error?: string }> = [];

    if (socialPlatforms.length > 0) {
      try {
        const { socialPublishService } = await import('../services/social/socialPublishService');
        const publishResults = await socialPublishService.publishToAll(companyId, socialPlatforms, {
          text: postContent,
          hashtags: postContent.match(/#\w+/g) ?? [],
        });
        publishResults.forEach(r => results.push({ platform: r.platform, success: r.success, url: r.url, error: r.error }));
      } catch (err) {
        socialPlatforms.forEach(p => results.push({ platform: p, success: false, error: String(err) }));
      }
    }

    // Publish to company website (save as public job listing)
    if (platforms.includes('website')) {
      try {
        await db.collection(`companies/${companyId}/publicJobListings`).doc(jobId).set({
          ...job, postContent, publishedAt: FieldValue.serverTimestamp(), status: 'published',
        });
        results.push({ platform: 'website', success: true, url: `/careers/${jobId}` });
      } catch (err) {
        results.push({ platform: 'website', success: false, error: String(err) });
      }
    }

    // Update job status
    try { await db.collection(`companies/${companyId}/jobPostings`).doc(jobId).update({ publishedPlatforms: platforms, publishedAt: FieldValue.serverTimestamp() }); } catch {}

    const successCount = results.filter(r => r.success).length;
    return {
      success: true,
      results,
      postContent,
      message: `Offre "${job['title']}" publiee sur ${successCount}/${results.length} plateforme(s).`,
    };
  }
);

// Keep existing tools
export const policySearchTool = ai.defineTool(
  {
    name: 'hr_searchPolicy',
    description: 'Search HR policies, employee handbook, internal rules.',
    inputSchema: z.object({ companyId: z.string(), query: z.string() }),
    outputSchema: z.object({ success: z.boolean().optional(), message: z.string().optional(), results: z.array(z.object({ title: z.string(), content: z.string() })) }),
  },
  async ({ companyId, query }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/hrPolicies`).limit(20).get().catch((err) => {
      logger.error('[HR] searchPolicy query failed', { error: String(err) });
      return null;
    });
    if (!snap) return { success: false, message: 'Lecture des politiques impossible.', results: [] };
    const kw = query.toLowerCase().split(/\s+/);
    const results = snap.docs.map(d => ({ title: (d.data()['title'] as string) ?? '', content: (d.data()['content'] as string) ?? '' }))
      .filter(r => kw.some(k => r.content.toLowerCase().includes(k) || r.title.toLowerCase().includes(k)));
    if (results.length === 0) results.push({ title: 'Politique RH generale', content: 'Contactez votre responsable RH ou consultez le handbook de l\'entreprise.' });
    return { success: true, results };
  }
);

export const onboardingChecklistTool = ai.defineTool(
  {
    name: 'hr_getOnboardingChecklist',
    description: 'Get or create onboarding checklist for a new employee.',
    inputSchema: z.object({ companyId: z.string(), userId: z.string(), department: z.string().optional() }),
    outputSchema: z.object({ success: z.boolean().optional(), message: z.string().optional(), steps: z.array(z.object({ step: z.string(), category: z.string(), completed: z.boolean() })), completionPct: z.number() }),
  },
  async ({ companyId, userId, department }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/onboarding`).doc(userId).get().catch(() => null);
    if (doc?.exists) {
      const steps = (doc.data()!['steps'] as Array<{ step: string; category: string; completed: boolean }>) ?? [];
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
  }
);

export const employeeDirectoryTool = ai.defineTool(
  {
    name: 'hr_getEmployeeDirectory',
    description: 'Search the unified people directory: merges employees, team members (invited users), and Firestore users. Use this BEFORE refusing to act on a person — they may exist under a different collection.',
    inputSchema: z.object({ companyId: z.string(), query: z.string().optional(), department: z.string().optional() }),
    outputSchema: z.object({
      success: z.boolean().optional(), message: z.string().optional(),
      employees: z.array(z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().optional(),
        department: z.string().optional(),
        role: z.string().optional(),
        source: z.string().describe('Where this person was found: employees | members | users'),
        isFullEmployee: z.boolean().describe('true if a full HR employee record exists'),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, query, department }) => {
    const db = getFirestore();

    // Run 3 queries in parallel — we merge results after
    const [employeesSnap, membersSnap, usersSnap] = await Promise.all([
      db.collection(`companies/${companyId}/employees`).limit(100).get().catch(() => null),
      db.collection(`companies/${companyId}/members`).limit(100).get().catch(() => null),
      db.collection('users').where('companyId', '==', companyId).limit(100).get().catch(() => null),
    ]);

    // Dedupe by email (or id if no email) — employees take priority, then members, then users
    const byKey = new Map<string, { id: string; name: string; email?: string; department?: string; role?: string; source: string; isFullEmployee: boolean }>();
    const keyOf = (email: string | undefined, id: string) => (email ? email.toLowerCase() : `id:${id}`);

    // 1. Employees (priority source — they have payroll data)
    (employeesSnap?.docs ?? []).forEach(d => {
      const x = d.data();
      const email = x['email'] as string | undefined;
      byKey.set(keyOf(email, d.id), {
        id: d.id,
        name: (x['displayName'] as string) ?? email ?? d.id,
        email,
        department: x['department'] as string | undefined,
        role: x['role'] as string | undefined,
        source: 'employees',
        isFullEmployee: true,
      });
    });

    // 2. Members (if not already in employees — missing baseSalary/jobTitle but we know who they are)
    (membersSnap?.docs ?? []).forEach(d => {
      const x = d.data();
      const email = x['email'] as string | undefined;
      const k = keyOf(email, d.id);
      if (!byKey.has(k)) {
        byKey.set(k, {
          id: d.id,
          name: (x['displayName'] as string) ?? email ?? d.id,
          email,
          department: x['department'] as string | undefined,
          role: x['role'] as string | undefined,
          source: 'members',
          isFullEmployee: false,
        });
      }
    });

    // 3. Users (last fallback — someone who signed in but isn't yet a formal member)
    (usersSnap?.docs ?? []).forEach(d => {
      const x = d.data();
      const email = x['email'] as string | undefined;
      const k = keyOf(email, d.id);
      if (!byKey.has(k)) {
        byKey.set(k, {
          id: d.id,
          name: (x['displayName'] as string) ?? email ?? d.id,
          email,
          department: x['department'] as string | undefined,
          role: x['role'] as string | undefined,
          source: 'users',
          isFullEmployee: false,
        });
      }
    });

    let all = Array.from(byKey.values());
    if (department) all = all.filter(e => e.department === department);
    const kw = query?.toLowerCase().split(/\s+/) ?? [];
    if (kw.length > 0) {
      all = all.filter(e =>
        kw.some(k =>
          e.name.toLowerCase().includes(k) ||
          (e.email ?? '').toLowerCase().includes(k) ||
          (e.department ?? '').toLowerCase().includes(k),
        ),
      );
    }
    return { success: true, employees: all, total: all.length };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// ALL TOOLS + FLOW
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PRO: ORG CHART
// ══════════════════════════════════════════════════════════════════════════════

export const getOrgChartTool = ai.defineTool(
  {
    name: 'hr_getOrgChart',
    description: 'Get organizational hierarchy — departments, managers, reporting lines, headcount.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      success: z.boolean().optional(), message: z.string().optional(),
      departments: z.array(z.object({ name: z.string(), headcount: z.number(), manager: z.string(), members: z.array(z.object({ name: z.string(), title: z.string(), role: z.string() })) })),
      totalEmployees: z.number(), totalDepartments: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection('users').where('companyId', '==', companyId).limit(200).get().catch((err) => {
      logger.error('[HR] getOrgChart query failed', { error: String(err) });
      return null;
    });
    if (!snap) return { success: false, message: 'Lecture de l\'organigramme impossible.', departments: [], totalEmployees: 0, totalDepartments: 0 };
    const deptMap = new Map<string, { manager: string; members: { name: string; title: string; role: string }[] }>();
    snap.docs.forEach(d => {
      const u = d.data();
      const dept = (u['department'] as string) ?? 'Autre';
      if (!deptMap.has(dept)) deptMap.set(dept, { manager: '', members: [] });
      const entry = deptMap.get(dept)!;
      const name = (u['displayName'] as string) ?? (u['email'] as string) ?? '';
      const role = (u['role'] as string) ?? 'employee';
      entry.members.push({ name, title: (u['jobTitle'] as string) ?? role, role });
      if (role === 'manager' || role === 'admin') entry.manager = name;
    });
    return {
      success: true,
      departments: Array.from(deptMap.entries()).map(([name, d]) => ({ name, headcount: d.members.length, manager: d.manager || (d.members[0]?.name ?? ''), members: d.members })),
      totalEmployees: snap.size, totalDepartments: deptMap.size,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: PERFORMANCE REVIEWS
// ══════════════════════════════════════════════════════════════════════════════

export const createPerformanceReviewTool = ai.defineTool(
  {
    name: 'hr_createPerformanceReview',
    description: 'Create or get performance reviews — goals, ratings, feedback.',
    inputSchema: z.object({
      companyId: z.string(), action: z.enum(['create', 'list', 'get']),
      employeeId: z.string().optional(), period: z.string().optional(),
      goals: z.array(z.object({ title: z.string(), target: z.string(), progress: z.number() })).optional(),
      rating: z.number().optional(), feedback: z.string().optional(), reviewerId: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean().optional(),
      reviews: z.array(z.object({ id: z.string(), employeeName: z.string(), period: z.string(), rating: z.number(), status: z.string(), goalsCount: z.number() })).optional(),
      reviewId: z.string().optional(), message: z.string(),
    }),
  },
  async ({ companyId, action, employeeId, period, goals, rating, feedback, reviewerId }) => {
    const db = getFirestore();
    if (action === 'list') {
      const snap = await db.collection(`companies/${companyId}/performanceReviews`).orderBy('createdAt', 'desc').limit(50).get().catch((err) => {
        logger.error('[HR] createPerformanceReview list failed', { error: String(err) });
        return null;
      });
      if (!snap) return { success: false, message: 'Lecture des évaluations impossible.' };
      return { success: true, reviews: snap.docs.map(d => { const data = d.data(); return { id: d.id, employeeName: (data['employeeName'] as string) ?? '', period: (data['period'] as string) ?? '', rating: (data['rating'] as number) ?? 0, status: (data['status'] as string) ?? 'draft', goalsCount: ((data['goals'] as unknown[]) ?? []).length }; }), message: `${snap.size} evaluations trouvees.` };
    }
    if (action === 'create' && employeeId) {
      const id = generateId();
      const empDoc = await db.collection('users').doc(employeeId).get().catch(() => null);
      const empName = (empDoc?.data()?.['displayName'] as string) ?? '';
      try {
        await db.collection(`companies/${companyId}/performanceReviews`).doc(id).set({
          id, employeeId, employeeName: empName, period: period ?? `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
          goals: goals ?? [], rating: rating ?? 0, feedback: feedback ?? '', reviewerId: reviewerId ?? '',
          status: 'draft', createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.error('[HR] createPerformanceReview write failed', { error: String(err) });
        return { success: false, message: 'Sauvegarde de l\'évaluation impossible.' };
      }
      return { success: true, reviewId: id, message: `Evaluation creee pour ${empName}.` };
    }
    return { success: false, message: 'Action non reconnue.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: OFFBOARDING
// ══════════════════════════════════════════════════════════════════════════════

export const offboardingTool = ai.defineTool(
  {
    name: 'hr_manageOffboarding',
    description: 'Manage employee offboarding — checklist, exit survey, access revocation, equipment return.',
    inputSchema: z.object({
      companyId: z.string(), action: z.enum(['start', 'get', 'update_item']),
      employeeId: z.string(), itemId: z.string().optional(), completed: z.boolean().optional(),
    }),
    outputSchema: z.object({ success: z.boolean().optional(), checklistId: z.string().optional(), items: z.array(z.object({ id: z.string(), category: z.string(), task: z.string(), completed: z.boolean() })).optional(), progress: z.number().optional(), message: z.string() }),
  },
  async ({ companyId, action, employeeId, itemId, completed }) => {
    const db = getFirestore();
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
        await docRef.set({ employeeId, items, status: 'in_progress', startedAt: FieldValue.serverTimestamp() });
      } catch (err) {
        logger.error('[HR] offboarding start failed', { error: String(err) });
        return { success: false, message: 'Démarrage de l\'offboarding impossible.' };
      }

      // Cross-agent: notify Security to revoke access
      const { createNotification } = await import('../services/notificationService');
      createNotification({ companyId, type: 'security_alert', title: 'Offboarding: revocation acces requise', message: `Un employe quitte l'entreprise. Revoquer tous les acces IT et securite.`, actionUrl: '/security/access', icon: 'UserX', severity: 'warning' }).catch(() => {});

      return { success: true, checklistId: employeeId, items, progress: 0, message: 'Offboarding demarre — 12 etapes a completer.' };
    }
    if (action === 'get') {
      const doc = await docRef.get().catch(() => null);
      if (!doc?.exists) return { success: false, message: 'Aucun offboarding en cours pour cet employe.' };
      const items = (doc.data()!['items'] as { id: string; category: string; task: string; completed: boolean }[]) ?? [];
      const progress = items.length > 0 ? Math.round(items.filter(i => i.completed).length / items.length * 100) : 0;
      return { success: true, checklistId: employeeId, items, progress, message: `Offboarding ${progress}% complete.` };
    }
    if (action === 'update_item' && itemId != null) {
      const doc = await docRef.get().catch(() => null);
      if (!doc?.exists) return { success: false, message: 'Offboarding non trouve.' };
      const items = (doc.data()!['items'] as { id: string; category: string; task: string; completed: boolean }[]) ?? [];
      const updated = items.map(i => i.id === itemId ? { ...i, completed: completed ?? true } : i);
      try {
        await docRef.update({ items: updated });
      } catch (err) {
        logger.error('[HR] offboarding update_item failed', { error: String(err) });
        return { success: false, message: 'Mise à jour de l\'étape impossible.' };
      }
      const progress = Math.round(updated.filter(i => i.completed).length / updated.length * 100);
      return { success: true, items: updated, progress, message: `Etape mise a jour (${progress}%).` };
    }
    return { success: false, message: 'Action non reconnue.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: EMPLOYEE ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export const employeeAnalyticsTool = ai.defineTool(
  {
    name: 'hr_getEmployeeAnalytics',
    description: 'HR analytics — headcount by department, turnover, seniority, role distribution.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      success: z.boolean().optional(), message: z.string().optional(),
      totalEmployees: z.number(),
      byDepartment: z.array(z.object({ department: z.string(), count: z.number() })),
      byRole: z.array(z.object({ role: z.string(), count: z.number() })),
      avgSeniorityMonths: z.number(),
      recentHires: z.number(), recentDepartures: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection('users').where('companyId', '==', companyId).limit(500).get().catch((err) => {
      logger.error('[HR] employeeAnalytics query failed', { error: String(err) });
      return null;
    });
    if (!snap) return { success: false, message: 'Lecture des analytics impossible.', totalEmployees: 0, byDepartment: [], byRole: [], avgSeniorityMonths: 0, recentHires: 0, recentDepartures: 0 };
    const users = snap.docs.map(d => d.data());
    const byDept: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    let totalMonths = 0;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    let recentHires = 0;

    users.forEach(u => {
      const dept = (u['department'] as string) ?? 'Autre'; byDept[dept] = (byDept[dept] ?? 0) + 1;
      const role = (u['role'] as string) ?? 'employee'; byRole[role] = (byRole[role] ?? 0) + 1;
      const created = (u['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? Date.now();
      totalMonths += (Date.now() - created) / (30 * 86400000);
      if (created > thirtyDaysAgo) recentHires++;
    });

    return {
      success: true,
      totalEmployees: users.length,
      byDepartment: Object.entries(byDept).map(([d, c]) => ({ department: d, count: c })).sort((a, b) => b.count - a.count),
      byRole: Object.entries(byRole).map(([r, c]) => ({ role: r, count: c })).sort((a, b) => b.count - a.count),
      avgSeniorityMonths: users.length > 0 ? Math.round(totalMonths / users.length) : 0,
      recentHires, recentDepartures: 0,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: EMPLOYEE SURVEYS
// ══════════════════════════════════════════════════════════════════════════════

export const employeeSurveyTool = ai.defineTool(
  {
    name: 'hr_manageSurvey',
    description: 'Create and manage employee satisfaction surveys — eNPS, pulse surveys, anonymous feedback.',
    inputSchema: z.object({
      companyId: z.string(), action: z.enum(['create', 'list', 'submit_response']),
      title: z.string().optional(), questions: z.array(z.string()).optional(),
      surveyId: z.string().optional(), answers: z.array(z.object({ question: z.string(), answer: z.string(), score: z.number().optional() })).optional(),
    }),
    outputSchema: z.object({
      success: z.boolean().optional(),
      surveys: z.array(z.object({ id: z.string(), title: z.string(), responseCount: z.number(), status: z.string(), avgScore: z.number() })).optional(),
      surveyId: z.string().optional(), message: z.string(),
    }),
  },
  async ({ companyId, action, title, questions, surveyId, answers }) => {
    const db = getFirestore();
    if (action === 'list') {
      const snap = await db.collection(`companies/${companyId}/hrSurveys`).orderBy('createdAt', 'desc').limit(20).get().catch((err) => {
        logger.error('[HR] manageSurvey list failed', { error: String(err) });
        return null;
      });
      if (!snap) return { success: false, message: 'Lecture des enquêtes impossible.' };
      return { success: true, surveys: snap.docs.map(d => { const data = d.data(); return { id: d.id, title: (data['title'] as string) ?? '', responseCount: (data['responseCount'] as number) ?? 0, status: (data['status'] as string) ?? 'active', avgScore: (data['avgScore'] as number) ?? 0 }; }), message: `${snap.size} enquete(s).` };
    }
    if (action === 'create') {
      const id = generateId();
      const defaultQuestions = questions ?? ['Comment evaluez-vous votre satisfaction au travail ? (1-10)', 'Recommanderiez-vous cette entreprise ? (1-10)', 'Comment evaluez-vous votre manager ? (1-10)', 'Avez-vous les outils necessaires ? (1-10)', 'Suggestion d\'amelioration ?'];
      try {
        await db.collection(`companies/${companyId}/hrSurveys`).doc(id).set({ id, title: title ?? 'Enquete satisfaction', questions: defaultQuestions, status: 'active', responseCount: 0, avgScore: 0, anonymous: true, createdAt: FieldValue.serverTimestamp() });
      } catch (err) {
        logger.error('[HR] manageSurvey create failed', { error: String(err) });
        return { success: false, message: 'Création de l\'enquête impossible.' };
      }
      return { success: true, surveyId: id, message: `Enquete "${title ?? 'Enquete satisfaction'}" creee avec ${defaultQuestions.length} questions.` };
    }
    if (action === 'submit_response' && surveyId && answers) {
      try {
        await db.collection(`companies/${companyId}/hrSurveys/${surveyId}/responses`).doc(generateId()).set({ answers, submittedAt: FieldValue.serverTimestamp() });
        const scores = answers.filter(a => a.score != null).map(a => a.score!);
        const avgResponse = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10 : 0;
        await db.collection(`companies/${companyId}/hrSurveys`).doc(surveyId).update({ responseCount: FieldValue.increment(1), avgScore: avgResponse });
      } catch (err) {
        logger.error('[HR] manageSurvey submit_response failed', { error: String(err) });
        return { success: false, message: 'Enregistrement de la réponse impossible.' };
      }
      return { success: true, message: 'Reponse enregistree. Merci !' };
    }
    return { success: false, message: 'Action non reconnue.' };
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// E-SIGNATURE via Wemas — send contract to employee for electronic signature.
// Flow: build the contract content → push to Wemas → email signing link to employee.
// ──────────────────────────────────────────────────────────────────────────────

export const sendContractForSignatureTool = ai.defineTool(
  {
    name: 'hr_sendContractForSignature',
    description: 'Envoie un contrat de travail à un employé pour signature électronique via Wemas. Génère le contenu (CDI/CDD/Stage/Freelance), crée le contrat dans Wemas, envoie le lien de signature par email à l\'employé. Utilise APRÈS création de l\'employé (createEmployee). Retourne l\'URL de signature.',
    inputSchema: z.object({
      companyId: z.string(),
      employeeId: z.string().describe('Employee ID (UUID) — required to fetch name/email/role/salary'),
      contractType: z.enum(['CDI', 'CDD', 'Stage', 'Freelance']).optional().default('CDI'),
      startDate: z.string().optional().describe('YYYY-MM-DD — defaults to today'),
      endDate: z.string().optional().describe('YYYY-MM-DD — required for CDD'),
      trialPeriodMonths: z.number().optional().describe('Trial period in months (defaults: CDI=3, others=1)'),
      jobTitle: z.string().optional(),
      baseSalary: z.number().optional(),
      currency: z.string().optional().default('XOF'),
      senderName: z.string().optional().describe('Name of the person sending — defaults to company name'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      contractId: z.string().optional(),
      signingUrl: z.string().optional(),
      verificationCode: z.string().optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, employeeId, contractType, startDate, endDate, trialPeriodMonths, jobTitle, baseSalary, currency, senderName }) => {
    const db = getFirestore();
    const { isWemasConfigured, createAndSendContract } = await import('../services/wemas/wemasBridge');

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
    const emp = { ...(empDocUser?.data() ?? {}), ...(empDocHR?.data() ?? {}) } as Record<string, unknown>;
    if (!emp || Object.keys(emp).length === 0) {
      return { success: false, message: `Employé ${employeeId} introuvable. Crée-le d'abord avec hr_createEmployee.` };
    }
    const employeeName = (emp['displayName'] as string) ?? (emp['name'] as string) ?? 'Employé';
    const employeeEmail = (emp['email'] as string) ?? '';
    const employeePhone = (emp['phone'] as string) ?? undefined;
    if (!employeeEmail) {
      return { success: false, message: `L'employé ${employeeName} n'a pas d'email. Mets-le à jour avec hr_updateEmployee avant d'envoyer le contrat.` };
    }

    // Resolve company branding
    const companyDoc = await db.collection('companies').doc(companyId).get().catch(() => null);
    const company = companyDoc?.data() ?? {};
    const companyName = (company['name'] as string) ?? 'Notre entreprise';

    // Build contract content (plain-text — Wemas wraps it in their signing UI)
    const resolved = contractType ?? 'CDI';
    const finalStart = startDate ?? new Date().toISOString().slice(0, 10);
    const finalSalary = baseSalary ?? (emp['baseSalary'] as number) ?? 0;
    const finalCurrency = currency ?? (emp['currency'] as string) ?? 'XOF';
    const finalJobTitle = jobTitle ?? (emp['jobTitle'] as string) ?? 'Collaborateur';
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

Fait à ${(company['city'] as string) ?? '____________'}, le ${finalStart}.

L'Employeur                         L'Employé
${companyName}                      ${employeeName}`;

    try {
      const result = await createAndSendContract({
        companyId,
        signatoryName:   employeeName,
        signatoryEmail:  employeeEmail,
        signatoryPhone:  employeePhone,
        contractContent,
        contractType:    resolved.toLowerCase(),
        senderName:      senderName ?? companyName,
        sendNow:         true,
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
        createdAt: FieldValue.serverTimestamp(),
      }).catch(() => { /* portfolio cross-link is best-effort */ });

      return {
        success: true,
        contractId: result.id,
        signingUrl: result.signingUrl,
        verificationCode: result.verificationCode,
        message: `Contrat ${resolved} envoyé à ${employeeName} (${employeeEmail}) pour signature électronique. Code de vérification : ${result.verificationCode}. URL de signature : ${result.signingUrl}.`,
      };
    } catch (err) {
      logger.error('[HR] sendContractForSignature failed', { err: String(err), employeeId });
      return {
        success: false,
        message: `Échec de l'envoi à Wemas : ${(err as Error).message ?? String(err)}. Le contrat n'a pas été envoyé.`,
      };
    }
  }
);

const ALL_TOOLS = [
  // Conges
  leaveBalanceTool, leaveRequestTool, leaveStatusTool,
  // Recrutement
  createJobPostingTool, listJobsTool, addCandidateTool, listCandidatesTool, scheduleInterviewTool, publishJobTool,
  // Profil
  employeeProfileTool,
  // Documents & employees
  listEmployeeDocsTool, generateCertificateTool, generatePayslipTool, createEmployeeTool, updateEmployeeTool, generateContractTool, hrSendEmailTool,
  uploadEmployeeDocTool, listEmployeePortfolioTool, generateEmployeeUploadLinkTool,
  // E-signature (Wemas bridge)
  sendContractForSignatureTool,
  // Calendrier & presence
  teamCalendarTool, attendanceSummaryTool,
  // Tickets & politiques
  createHRTicketTool, policySearchTool,
  // Onboarding & annuaire
  onboardingChecklistTool, employeeDirectoryTool,
  // PRO
  getOrgChartTool, createPerformanceReviewTool, offboardingTool, employeeAnalyticsTool, employeeSurveyTool,
];

const EXECUTORS = new Map<string, (i: unknown) => Promise<unknown>>(
  ALL_TOOLS.map(t => [t.__action.name!, (i: unknown) => (t as any)(i)])
);

const INPUT = z.object({
  request: z.string(), companyId: z.string(), userId: z.string().optional(), language: z.string().optional().default('auto'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional().describe('Conversation history so the agent remembers what was just discussed'),
});
const OUTPUT = z.object({
  response: z.string(), requestId: z.string().optional(), requiresManagerApproval: z.boolean(),
});

export const hrAgentFlow = ai.defineFlow(
  { name: 'hrAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[HRAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const lang = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;

    // Date anchors — prevent hallucinated dates like "14 mai 2025" when today is 23/04/2026
    const dateAnchors = (() => {
      const now = new Date();
      const weekdaysFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const today = now.toISOString().slice(0, 10);
      const todayLabel = weekdaysFr[now.getDay()];
      const next: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i);
        next.push(`${weekdaysFr[d.getDay()]} = ${d.toISOString().slice(0, 10)}`);
      }
      return `AUJOURD'HUI : ${today} (${todayLabel}). Semaine à venir : ${next.join(', ')}.`;
    })();

    // Build message list with prior history so the agent keeps context
    // (e.g. "createEmployee for Herve" → "tu veux une photo?" refers to Herve, not user)
    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) {
        messages.push({ role: h.role, content: [{ text: h.content }] });
      }
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_FLASH,
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
      const toolResults = await Promise.all(
        response.toolRequests.map(async (p) => {
          const { name, input, ref } = p.toolRequest;
          const exec = EXECUTORS.get(name);
          const inp = { ...(input as Record<string, unknown>), companyId, userId };
          let output: unknown;
          try { output = exec ? await exec(inp) : { error: `Outil inconnu: ${name}` }; }
          catch (err) { output = { error: String(err) }; }
          return { name, ref, output };
        })
      );
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [...response.messages, { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
        tools: ALL_TOOLS, config: { temperature: 0.3 },
      });
    }

    const text = response.text;
    const reqMatch = text.match(/#([a-z0-9]{8})/i);
    const requiresApproval = /approv|manager|validat|pending|attente/i.test(text);
    return { response: text, requestId: reqMatch?.[1], requiresManagerApproval: requiresApproval };
  }
);

export const hrAgentTool = ai.defineTool(
  {
    name: 'callHRAgent',
    description: 'HR PRO: conges, recrutement (publication LinkedIn/Facebook + CV scoring + entretiens), organigramme, evaluations performance, offboarding (12 etapes + cross-agent securite), analytics RH, enquetes satisfaction eNPS, profil employe, documents, calendrier equipe, onboarding, annuaire, politiques, tickets.',
    inputSchema: INPUT, outputSchema: OUTPUT,
  },
  async (input) => {
    try { return await hrAgentFlow(input); }
    catch (err) { logger.error('[callHRAgent] Error:', err); return { response: 'Erreur dans l\'agent RH. Reessayez.', requiresManagerApproval: false }; }
  }
);
