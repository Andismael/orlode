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
exports.legalAgentTool = exports.legalAgentFlow = exports.getAllCompanyContractsTool = exports.legalAutomationTool = exports.contractTemplatesTool = exports.caseTimelineTool = exports.contractRiskScoringTool = exports.markSignedTool = exports.emailContractForSignatureTool = exports.sendForSignatureTool = exports.getStatsTool = exports.getClausesTool = exports.checkComplianceTool = exports.createDeadlineTool = exports.getDeadlinesTool = exports.getCasesTool = exports.createCaseTool = exports.compareContractsTool = exports.generateContractTool = exports.analyzeContractTool = void 0;
exports.renderSignedConfirmationEmail = renderSignedConfirmationEmail;
/**
 * Legal Agent PRO — Gemini Flash
 * Mission : Proteger l'entreprise, zero deadline manquee, conformite totale.
 *
 * Capabilities:
 *   1. Contrats — analyse, risques, generation, comparaison, workflow approbation
 *   2. Dossiers — case management, regrouper contrats + notes + deadlines
 *   3. Deadlines — suivi, alertes, calendrier juridique
 *   4. Conformite — RGPD, droit du travail, corporate, scoring
 *   5. Clauses — bibliotheque reutilisable
 *   6. Analytics — KPIs, contrats actifs, risques, conformite
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const CONTRACT_TYPES = ['nda', 'service', 'freelance', 'employment', 'supplier', 'lease', 'partnership', 'other'];
const CONTRACT_STATUSES = ['draft', 'review', 'approved', 'sent', 'signed', 'active', 'expired', 'terminated'];
// ══════════════════════════════════════════════════════════════════════════════
// 1. CONTRATS — Analyse · Risques · Generation · Comparaison
// ══════════════════════════════════════════════════════════════════════════════
exports.analyzeContractTool = genkit_config_1.ai.defineTool({
    name: 'leg_analyzeContract',
    description: 'Analyze contract text: extract key terms, obligations, risks with severity scoring.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), contractText: zod_1.z.string(),
        contractType: zod_1.z.enum(CONTRACT_TYPES).optional().default('other'),
        language: zod_1.z.string().optional().default('fr'),
    }),
    outputSchema: zod_1.z.object({
        summary: zod_1.z.string(), riskScore: zod_1.z.number(), keyTerms: zod_1.z.array(zod_1.z.string()),
        risks: zod_1.z.array(zod_1.z.object({ clause: zod_1.z.string(), risk: zod_1.z.string(), severity: zod_1.z.string() })),
        obligations: zod_1.z.array(zod_1.z.string()), expiryDate: zod_1.z.string().optional(), recommendation: zod_1.z.string(),
    }),
}, async ({ contractText, contractType, language }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Analyze this ${contractType} contract in ${language}. Extract key info.
Contract: ${contractText.slice(0, 6000)}
Return JSON: {"summary":"...","riskScore":0-100,"keyTerms":["..."],"risks":[{"clause":"...","risk":"...","severity":"low|medium|high|critical"}],"obligations":["..."],"expiryDate":"YYYY-MM-DD or null","recommendation":"..."} ONLY JSON.`,
        config: { temperature: 0.1 },
    });
    try {
        const p = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return { ...p, riskScore: p.riskScore ?? 50 };
    }
    catch {
        return { summary: text.slice(0, 300), riskScore: 50, keyTerms: [], risks: [], obligations: [], recommendation: 'Revue manuelle recommandee.' };
    }
});
exports.generateContractTool = genkit_config_1.ai.defineTool({
    name: 'leg_generateContract',
    description: 'Generate a contract from template with custom clauses.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), type: zod_1.z.enum(CONTRACT_TYPES).default('nda'),
        partyA: zod_1.z.string(), partyB: zod_1.z.string(), language: zod_1.z.string().optional().default('fr'),
        customClauses: zod_1.z.string().optional(), duration: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ contractId: zod_1.z.string(), content: zod_1.z.string(), warning: zod_1.z.string() }),
}, async ({ companyId, type, partyA, partyB, language, customClauses, duration }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Generate a ${type} contract in ${language} between "${partyA}" and "${partyB}".${duration ? ` Duration: ${duration}.` : ''}${customClauses ? ` Custom clauses: ${customClauses}` : ''} Include standard clauses. Return only the contract text.`,
        config: { temperature: 0.2 },
    });
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    const countSnap = await db.collection(`companies/${companyId}/legalContracts`).count().get();
    const num = `CTR-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, '0')}`;
    await db.collection(`companies/${companyId}/legalContracts`).doc(id).set({
        id, contractNumber: num, type, partyA, partyB, content: text, status: 'draft',
        duration: duration ?? null, customClauses: customClauses ?? null,
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { contractId: id, content: text, warning: 'Document genere par IA — revue juridique obligatoire avant signature.' };
});
exports.compareContractsTool = genkit_config_1.ai.defineTool({
    name: 'leg_compareContracts',
    description: 'Compare two contract versions and highlight differences.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), textA: zod_1.z.string(), textB: zod_1.z.string(), language: zod_1.z.string().optional().default('fr') }),
    outputSchema: zod_1.z.object({ differences: zod_1.z.array(zod_1.z.object({ section: zod_1.z.string(), versionA: zod_1.z.string(), versionB: zod_1.z.string(), impact: zod_1.z.string() })), summary: zod_1.z.string() }),
}, async ({ textA, textB, language }) => {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Compare these 2 contract versions in ${language}. Highlight key differences.
Version A: ${textA.slice(0, 3000)}
Version B: ${textB.slice(0, 3000)}
Return JSON: {"differences":[{"section":"...","versionA":"...","versionB":"...","impact":"low|medium|high"}],"summary":"..."} ONLY.`,
        config: { temperature: 0.1 },
    });
    try {
        return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return { differences: [], summary: text.slice(0, 300) };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. DOSSIERS (Case Management)
// ══════════════════════════════════════════════════════════════════════════════
exports.createCaseTool = genkit_config_1.ai.defineTool({
    name: 'leg_createCase',
    description: 'Create a legal case/dossier grouping contracts, notes, and deadlines.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), title: zod_1.z.string(), description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['litigation', 'transaction', 'compliance', 'advisory', 'other']).default('other'),
        priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
        client: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ caseId: zod_1.z.string(), caseNumber: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, title, description, type, priority, client }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    const countSnap = await db.collection(`companies/${companyId}/legalCases`).count().get();
    const num = `DOS-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, '0')}`;
    await db.collection(`companies/${companyId}/legalCases`).doc(id).set({
        id, caseNumber: num, title, description: description ?? '', type, priority,
        client: client ?? null, status: 'open', contractIds: [], notes: [], deadlineIds: [],
        createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { caseId: id, caseNumber: num, message: `Dossier ${num} cree.` };
});
exports.getCasesTool = genkit_config_1.ai.defineTool({
    name: 'leg_getCases',
    description: 'List legal cases/dossiers.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), status: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ cases: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), caseNumber: zod_1.z.string(), title: zod_1.z.string(), type: zod_1.z.string(), status: zod_1.z.string(), priority: zod_1.z.string() })) }),
}, async ({ companyId, status }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/legalCases`);
    if (status)
        q = q.where('status', '==', status);
    const snap = await q.limit(50).get();
    return { cases: snap.docs.map(d => { const data = d.data(); return { id: d.id, caseNumber: data['caseNumber'] ?? '', title: data['title'] ?? '', type: data['type'] ?? '', status: data['status'] ?? 'open', priority: data['priority'] ?? 'medium' }; }) };
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. DEADLINES
// ══════════════════════════════════════════════════════════════════════════════
exports.getDeadlinesTool = genkit_config_1.ai.defineTool({
    name: 'leg_getDeadlines',
    description: 'Get upcoming legal deadlines with urgency tracking.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), daysAhead: zod_1.z.number().optional().default(90) }),
    outputSchema: zod_1.z.object({
        deadlines: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), type: zod_1.z.string(), dueDate: zod_1.z.string(), daysLeft: zod_1.z.number(), priority: zod_1.z.string() })),
        urgent: zod_1.z.number(), overdue: zod_1.z.number(),
    }),
}, async ({ companyId, daysAhead }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/legalDeadlines`).limit(100).get();
    const now = Date.now();
    const deadlines = snap.docs.map(d => {
        const data = d.data();
        const due = data['dueDate']?.toDate?.() ?? new Date(data['dueDate']);
        const daysLeft = Math.ceil((due.getTime() - now) / 86400000);
        return {
            id: d.id, title: data['title'] ?? '', type: data['type'] ?? 'other',
            dueDate: due.toISOString().split('T')[0], daysLeft,
            priority: daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'high' : 'medium',
        };
    }).filter(d => d.daysLeft <= (daysAhead ?? 90)).sort((a, b) => a.daysLeft - b.daysLeft);
    return { deadlines, urgent: deadlines.filter(d => d.priority === 'critical').length, overdue: deadlines.filter(d => d.daysLeft < 0).length };
});
exports.createDeadlineTool = genkit_config_1.ai.defineTool({
    name: 'leg_createDeadline',
    description: 'Create a legal deadline/reminder.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(), title: zod_1.z.string(), dueDate: zod_1.z.string(),
        type: zod_1.z.enum(['contract_renewal', 'compliance', 'filing', 'hearing', 'review', 'other']).default('other'),
        description: zod_1.z.string().optional(), caseId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ deadlineId: zod_1.z.string(), message: zod_1.z.string() }),
}, async ({ companyId, title, dueDate, type, description, caseId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.collection(`companies/${companyId}/legalDeadlines`).doc(id).set({
        id, title, dueDate: new Date(dueDate), type, description: description ?? '',
        caseId: caseId ?? null, notified: false,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { deadlineId: id, message: `Echeance "${title}" creee pour le ${dueDate}.` };
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. CONFORMITE
// ══════════════════════════════════════════════════════════════════════════════
exports.checkComplianceTool = genkit_config_1.ai.defineTool({
    name: 'leg_checkCompliance',
    description: 'Check compliance status with scoring (GDPR, labor law, corporate, tax).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), area: zod_1.z.enum(['gdpr', 'labor_law', 'corporate', 'tax', 'all']).default('all') }),
    outputSchema: zod_1.z.object({ area: zod_1.z.string(), score: zod_1.z.number(), status: zod_1.z.string(), issues: zod_1.z.array(zod_1.z.string()), actions: zod_1.z.array(zod_1.z.string()) }),
}, async ({ companyId, area }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/legalCompliance`).doc(area ?? 'all').get();
    if (doc.exists) {
        const d = doc.data();
        return { area: area ?? 'all', score: d['score'] ?? 50, status: d['status'] ?? 'needs_review', issues: d['issues'] ?? [], actions: d['actions'] ?? [] };
    }
    const defaults = {
        gdpr: { score: 40, issues: ['Politique de confidentialite a revoir', 'Registre des traitements incomplet'], actions: ['Mettre a jour la politique', 'Completer le registre RGPD'] },
        labor_law: { score: 60, issues: ['Contrats de travail a verifier', 'DUERP a mettre a jour'], actions: ['Revue contrats', 'Mise a jour DUERP'] },
        corporate: { score: 55, issues: ['PV AG a preparer', 'Registre beneficiaires effectifs'], actions: ['Planifier AG', 'Mettre a jour RBE'] },
        tax: { score: 70, issues: ['Echeances TVA a verifier'], actions: ['Verifier calendrier fiscal'] },
        all: { score: 55, issues: ['Audit juridique complet recommande'], actions: ['Planifier audit annuel'] },
    };
    const d = defaults[area ?? 'all'] ?? defaults['all'];
    return { area: area ?? 'all', score: d.score, status: d.score >= 70 ? 'compliant' : 'needs_review', issues: d.issues, actions: d.actions };
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. CLAUSES LIBRARY
// ══════════════════════════════════════════════════════════════════════════════
exports.getClausesTool = genkit_config_1.ai.defineTool({
    name: 'leg_getClauses',
    description: 'Get reusable clause library.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), category: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ clauses: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), content: zod_1.z.string(), category: zod_1.z.string() })) }),
}, async ({ companyId, category }) => {
    const db = (0, firebase_config_1.getFirestore)();
    let q = db.collection(`companies/${companyId}/legalClauses`);
    if (category)
        q = q.where('category', '==', category);
    const snap = await q.limit(50).get();
    return { clauses: snap.docs.map(d => { const data = d.data(); return { id: d.id, title: data['title'] ?? '', content: data['content'] ?? '', category: data['category'] ?? 'general' }; }) };
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. STATS
// ══════════════════════════════════════════════════════════════════════════════
exports.getStatsTool = genkit_config_1.ai.defineTool({
    name: 'leg_getStats',
    description: 'Get legal department KPIs.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalContracts: zod_1.z.number(), activeContracts: zod_1.z.number(), expiringSoon: zod_1.z.number(),
        totalCases: zod_1.z.number(), openCases: zod_1.z.number(),
        totalDeadlines: zod_1.z.number(), urgentDeadlines: zod_1.z.number(), overdueDeadlines: zod_1.z.number(),
        complianceScore: zod_1.z.number(),
    }),
}, async ({ companyId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const [contractsSnap, casesSnap, deadlinesSnap, compDoc] = await Promise.all([
        db.collection(`companies/${companyId}/legalContracts`).limit(500).get(),
        db.collection(`companies/${companyId}/legalCases`).limit(100).get(),
        db.collection(`companies/${companyId}/legalDeadlines`).limit(200).get(),
        db.collection(`companies/${companyId}/legalCompliance`).doc('all').get(),
    ]);
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 86400000);
    const contracts = contractsSnap.docs.map(d => d.data());
    const active = contracts.filter(c => c['status'] === 'active' || c['status'] === 'signed').length;
    const expiring = contracts.filter(c => { const exp = c['expiryDate']?.toDate?.(); return exp && exp > now && exp < soon; }).length;
    const cases = casesSnap.docs.map(d => d.data());
    const openCases = cases.filter(c => c['status'] === 'open').length;
    const deadlines = deadlinesSnap.docs.map(d => { const due = d.data()['dueDate']?.toDate?.() ?? new Date(); return { daysLeft: Math.ceil((due.getTime() - now.getTime()) / 86400000) }; });
    const urgent = deadlines.filter(d => d.daysLeft >= 0 && d.daysLeft <= 7).length;
    const overdue = deadlines.filter(d => d.daysLeft < 0).length;
    const compScore = compDoc.data()?.['score'] ?? 55;
    return { totalContracts: contracts.length, activeContracts: active, expiringSoon: expiring, totalCases: cases.length, openCases, totalDeadlines: deadlines.length, urgentDeadlines: urgent, overdueDeadlines: overdue, complianceScore: compScore };
});
// ══════════════════════════════════════════════════════════════════════════════
// 7. SIGNATURE WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════
exports.sendForSignatureTool = genkit_config_1.ai.defineTool({
    name: 'leg_sendForSignature',
    description: 'Internal status update for a contract previously created in legalContracts. Use only when the contract was already sent through another channel and you just need to flag the DB status. For ACTUAL email sending with e-signature, use leg_emailContractForSignature instead.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), contractId: zod_1.z.string(), email: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, contractId, email }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/legalContracts`).doc(contractId).get();
    if (!doc.exists)
        return { success: false, message: 'Contrat introuvable.' };
    const data = doc.data();
    const to = email ?? data['partyB'] ?? '';
    await db.collection(`companies/${companyId}/legalContracts`).doc(contractId).update({
        status: 'sent', sentForSignatureAt: firestore_1.FieldValue.serverTimestamp(), sentTo: to,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        timeline: firestore_1.FieldValue.arrayUnion({ date: new Date().toISOString(), action: 'sent_for_signature', detail: `Envoye a ${to}` }),
    });
    return { success: true, message: `Contrat ${data['contractNumber']} envoye pour signature a ${to}.` };
});
// ── PRIMARY contract-sending tool — generates + emails via Wemas ───────────
// This is what the agent should reach for whenever the user asks to
// "envoyer / emailer / send" a contract. It generates the body via Gemini,
// pushes it through Wemas (which produces a signing URL + sends the
// recipient an e-signature email), and caches the result locally.
exports.emailContractForSignatureTool = genkit_config_1.ai.defineTool({
    name: 'leg_emailContractForSignature',
    description: 'Generate a contract AND email it for e-signature in one step. USE THIS whenever the user asks to "envoyer / send / email" a contract to someone. The recipient receives a Wemas e-signature link by email. Returns the contractId, signingUrl, and confirmation message.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        contractType: zod_1.z.enum(['nda', 'employment', 'service', 'supplier', 'partnership', 'freelance', 'cdi', 'cdd', 'prestation_services'])
            .describe('Type of contract. "freelance" for freelance/independent contractor, "nda" for confidentiality, "service"/"prestation_services" for service agreements.'),
        partyA: zod_1.z.string().describe('Sender / company name (the one sending the contract)'),
        partyB: zod_1.z.string().describe('Recipient name (the person who will receive and sign)'),
        signatoryEmail: zod_1.z.string().describe('Email address of the recipient (where the signing link will be sent)'),
        signatoryPhone: zod_1.z.string().optional().describe('Optional WhatsApp phone in E.164 format (e.g. "+12038097112"). When provided, the signing link is also sent via WhatsApp.'),
        duration: zod_1.z.string().optional().describe('Contract duration (e.g. "6 months", "1 year")'),
        customClauses: zod_1.z.string().optional().describe('Any specific clauses to include beyond the standard ones'),
        senderName: zod_1.z.string().optional().describe('Name of the sender for the email signature'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        contractId: zod_1.z.string().optional(),
        signingUrl: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ companyId, contractType, partyA, partyB, signatoryEmail, signatoryPhone, duration, customClauses, senderName }) => {
    // 1. Generate the contract body via Gemini
    let contractContent;
    try {
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Tu rédiges un contrat de type "${contractType}" en français entre "${partyA}" (Partie A) et "${partyB}" (Partie B).${duration ? `\n\nDurée du contrat : ${duration}.` : ''}${customClauses ? `\n\nClauses spécifiques à inclure : ${customClauses}` : ''}

Inclus toutes les clauses standards : identification des parties, objet du contrat, obligations de chaque partie, durée et conditions de résiliation, modalités de paiement (si applicable), confidentialité, propriété intellectuelle (si applicable), juridiction et droit applicable.

Format : markdown avec titres (##) et sous-titres (###). Aucun placeholder à remplir — utilise des valeurs réalistes et professionnelles. Ton sobre et juridique. Ne mets pas de disclaimer IA — c'est le corps du contrat qui sera signé.`,
            config: { temperature: 0.3 },
        });
        contractContent = text;
        if (!contractContent || contractContent.trim().length < 200) {
            return { success: false, message: 'La génération du contrat a échoué (contenu trop court). Réessaie.' };
        }
    }
    catch (err) {
        logger_1.logger.error('[Legal] Contract generation failed', { error: String(err) });
        return { success: false, message: `Génération du contrat impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
    // 2. Create contract natively in Orlode (Firestore) — no external bridge
    const { wemasService } = await Promise.resolve().then(() => __importStar(require('../services/wemas/wemasService')));
    const ctype = ({
        nda: 'nda',
        employment: 'cdi',
        service: 'prestation_services',
        supplier: 'prestation_services',
        partnership: 'prestation_services',
        freelance: 'freelance',
        cdi: 'cdi',
        cdd: 'cdd',
        prestation_services: 'prestation_services',
    }[contractType]) ?? 'prestation_services';
    let contract;
    try {
        contract = await wemasService.createContract({
            companyId,
            signatoryName: partyB,
            signatoryEmail,
            signatoryPhone,
            contractContent,
            contractType: ctype,
            mainContractType: ctype === 'nda' || ctype === 'prestation_services' ? 'standard' : 'standard',
            senderName: senderName ?? partyA,
            expiresInDays: 30,
            status: 'pending_signature',
            tags: [contractType],
        });
    }
    catch (err) {
        logger_1.logger.error('[Legal] Native createContract failed', { error: String(err) });
        return {
            success: false,
            message: `Création du contrat impossible : ${err instanceof Error ? err.message : 'erreur inconnue'}.`,
        };
    }
    // 3. Build the signing URL pointing to Orlode's public sign page
    const PUBLIC_APP_URL = process.env['PUBLIC_APP_URL'] ?? 'https://mon-assistant-86bbd.web.app';
    const signingUrl = `${PUBLIC_APP_URL}/sign/${contract.uniqueLink}`;
    // 4. Send the signing email via the unified email service
    try {
        const { sendEmail } = await Promise.resolve().then(() => __importStar(require('../services/email/emailService')));
        const firstName = partyB.split(/\s+/)[0] ?? partyB;
        const senderLabel = senderName ?? partyA;
        const html = renderSigningEmail({
            firstName, signatoryName: partyB, contractType,
            senderName: senderLabel, signingUrl,
        });
        const result = await sendEmail({
            companyId,
            to: signatoryEmail,
            subject: `${senderLabel} vous demande votre signature — ${contractType}`,
            html,
        });
        logger_1.logger.info('[Legal] Signing email sent', {
            companyId, contractId: contract.id, to: signatoryEmail, provider: result.provider,
        });
    }
    catch (err) {
        // Email failed but contract is saved — surface the error so the agent
        // doesn't lie. Caller can retry by re-using contract.uniqueLink.
        logger_1.logger.error('[Legal] Signing email send failed', { error: String(err) });
        return {
            success: false,
            contractId: contract.id,
            signingUrl,
            message: `Contrat créé mais l'email n'a pas pu être envoyé. Tu peux partager ce lien manuellement : [${signingUrl}](${signingUrl})`,
        };
    }
    // 5. Optional WhatsApp send — fire-and-forget, doesn't block success
    let whatsappSent = false;
    if (signatoryPhone) {
        try {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp/whatsappService')));
            const cfg = await whatsappService.getConfig(companyId);
            if (cfg) {
                const senderLabel = senderName ?? partyA;
                const firstName = partyB.split(/\s+/)[0] ?? partyB;
                const waMsg = `Bonjour ${firstName} 👋\n\n*${senderLabel}* vous demande de signer un contrat ${contractType}.\n\n📝 Lire et signer ici :\n${signingUrl}\n\n_Lien valable 30 jours · Signature électronique sécurisée_`;
                const id = await whatsappService.sendMessage(cfg, signatoryPhone, waMsg);
                if (id) {
                    whatsappSent = true;
                    logger_1.logger.info('[Legal] Signing WhatsApp sent', { companyId, contractId: contract.id, to: signatoryPhone });
                }
            }
            else {
                logger_1.logger.warn('[Legal] WhatsApp not configured, skipping WhatsApp send', { companyId });
            }
        }
        catch (err) {
            logger_1.logger.warn('[Legal] WhatsApp send failed (non-blocking)', { error: String(err) });
        }
    }
    const channels = ['email' + (whatsappSent ? ' + WhatsApp' : '')];
    return {
        success: true,
        contractId: contract.id,
        signingUrl,
        message: `Contrat ${contractType} envoyé à ${signatoryEmail} (${channels.join(' & ')}) pour signature électronique. [Lire et signer le contrat](${signingUrl})`,
    };
});
function renderSigningEmail(v) {
    const orgColor = '#0A4F3C';
    const typeLabel = {
        nda: 'Accord de confidentialité',
        employment: 'Contrat de travail',
        service: 'Contrat de prestation',
        supplier: 'Contrat fournisseur',
        partnership: 'Accord de partenariat',
        freelance: 'Contrat freelance',
        cdi: 'CDI',
        cdd: 'CDD',
        prestation_services: 'Contrat de prestation',
    }[v.contractType] ?? 'Contrat';
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>${typeLabel} — Signature requise</title></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:48px 16px;">
  <tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">
      <tr><td style="background:${orgColor};padding:52px 40px 44px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.18);border-radius:50%;width:72px;height:72px;line-height:72px;text-align:center;margin-bottom:20px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-top:18px;"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
        </div>
        <h1 style="color:white;margin:0 0 8px 0;font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.15;">Signature requise</h1>
        <p style="color:rgba(255,255,255,0.90);margin:0;font-size:15px;">${typeLabel}</p>
      </td></tr>
      <tr><td style="padding:40px 40px 0;">
        <p style="color:#111827;font-size:18px;font-weight:600;margin:0 0 8px 0;">Bonjour ${v.firstName},</p>
        <p style="color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 20px 0;"><strong>${v.senderName}</strong> vous demande de signer un ${typeLabel.toLowerCase()}. Ouvrez le lien ci-dessous pour le lire et le signer électroniquement.</p>
      </td></tr>
      <tr><td style="padding:8px 40px 0;text-align:center;">
        <a href="${v.signingUrl}" style="display:inline-block;background:${orgColor};color:white;padding:16px 44px;text-decoration:none;border-radius:14px;font-weight:700;font-size:15px;box-shadow:0 4px 16px rgba(10,79,60,0.30);">Lire et signer le contrat</a>
        <p style="color:#9ca3af;font-size:12px;margin:14px 0 0 0;">Ou copiez ce lien dans votre navigateur :<br><span style="color:#6b7280;font-size:11px;word-break:break-all;">${v.signingUrl}</span></p>
      </td></tr>
      <tr><td style="padding:32px 40px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;">
          <tr><td style="padding:18px 22px;">
            <p style="color:#92400e;font-size:13px;font-weight:700;margin:0 0 5px 0;">Signature électronique sécurisée</p>
            <p style="color:#78350f;font-size:12px;line-height:1.6;margin:0;">Lien valable 30 jours. Votre signature est horodatée et conservée comme preuve légale. Une copie de confirmation vous sera envoyée après signature.</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #f3f4f6;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by Orlode &mdash; Email automatique, merci de ne pas répondre.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
function renderSignedConfirmationEmail(v) {
    const orgColor = '#0A4F3C';
    const typeLabel = {
        nda: 'Accord de confidentialité',
        cdi: 'CDI',
        cdd: 'CDD',
        freelance: 'Contrat freelance',
        prestation_services: 'Contrat de prestation',
    }[v.contractType] ?? 'Contrat';
    const signedDate = new Date(v.signedAt);
    const formattedDate = signedDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedTime = signedDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const preview = v.contractContent.slice(0, 1200) + (v.contractContent.length > 1200 ? '...' : '');
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Contrat signé</title></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:48px 16px;">
  <tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">
      <tr><td style="background:${orgColor};padding:52px 40px 44px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.18);border-radius:50%;width:72px;height:72px;line-height:72px;text-align:center;margin-bottom:20px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-top:18px;"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 style="color:white;margin:0 0 8px 0;font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.15;">Contrat signé avec succès</h1>
        <p style="color:rgba(255,255,255,0.90);margin:0;font-size:15px;">${typeLabel}</p>
      </td></tr>
      <tr><td style="padding:40px 40px 0;">
        <p style="color:#111827;font-size:18px;font-weight:600;margin:0 0 8px 0;">Bonjour ${v.signatoryName.split(/\s+/)[0]},</p>
        <p style="color:#6b7280;font-size:15px;line-height:1.7;margin:0;">Votre contrat avec <strong>${v.senderName}</strong> a été signé électroniquement. Conservez cet email comme preuve légale.</p>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:16px;border:1px solid #d1fae5;"><tr><td style="padding:24px 28px;">
          <p style="color:#065f46;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 16px 0;">Signature</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:7px 0;border-bottom:1px solid #d1fae5;"><table width="100%"><tr><td style="color:#6b7280;font-size:13px;">Signataire</td><td style="color:#111827;font-size:13px;font-weight:700;text-align:right;">${v.signatoryName}</td></tr></table></td></tr>
            <tr><td style="padding:7px 0;border-bottom:1px solid #d1fae5;"><table width="100%"><tr><td style="color:#6b7280;font-size:13px;">Email</td><td style="color:#111827;font-size:13px;font-weight:700;text-align:right;">${v.signatoryEmail}</td></tr></table></td></tr>
            <tr><td style="padding:7px 0;border-bottom:1px solid #d1fae5;"><table width="100%"><tr><td style="color:#6b7280;font-size:13px;">Date</td><td style="color:#111827;font-size:13px;font-weight:700;text-align:right;">${formattedDate}</td></tr></table></td></tr>
            <tr><td style="padding:7px 0;"><table width="100%"><tr><td style="color:#6b7280;font-size:13px;">Heure</td><td style="color:#111827;font-size:13px;font-weight:700;text-align:right;">${formattedTime}</td></tr></table></td></tr>
          </table>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #6ee7b7;border-radius:12px;overflow:hidden;background:#f0fdf4;">
          <tr><td style="background:#d1fae5;padding:10px 16px;"><p style="color:#065f46;font-size:11px;font-weight:700;text-transform:uppercase;margin:0;">Signature de ${v.signatoryName}</p></td></tr>
          <tr><td style="padding:16px;text-align:center;background:white;">
            <div style="background:white;border:1px dashed #10b981;border-radius:8px;padding:12px;">
              <img src="${v.signatureData}" alt="Signature" style="max-width:100%;max-height:70px;display:block;margin:0 auto;" />
            </div>
            <p style="color:#047857;font-size:12px;font-weight:600;margin:8px 0 0 0;">${v.signatoryName} &mdash; ${formattedDate} ${formattedTime}</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#f9fafb;padding:16px 24px;border-bottom:1px solid #e5e7eb;"><p style="color:#374151;font-size:12px;font-weight:700;margin:0;">Extrait du contrat</p></td></tr>
          <tr><td style="padding:24px;background:white;"><div style="color:#4b5563;font-size:13px;line-height:1.9;white-space:pre-wrap;font-family:Georgia,'Times New Roman',serif;">${preview.replace(/[<>&]/g, c => c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;')}</div></td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:32px 40px 0;text-align:center;">
        <a href="${v.contractLink}" style="display:inline-block;background:${orgColor};color:white;padding:16px 44px;text-decoration:none;border-radius:14px;font-weight:700;font-size:15px;">Consulter mon contrat signé</a>
      </td></tr>
      <tr><td style="padding:24px 40px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;"><tr><td style="padding:18px 22px;">
          <p style="color:#92400e;font-size:13px;font-weight:700;margin:0 0 5px 0;">Conservez cet email</p>
          <p style="color:#78350f;font-size:12px;line-height:1.6;margin:0;">Ce document constitue une preuve légale de votre engagement contractuel.</p>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #f3f4f6;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by Orlode &mdash; Email automatique.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
exports.markSignedTool = genkit_config_1.ai.defineTool({
    name: 'leg_markAsSigned',
    description: 'Mark a contract as signed.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), contractId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), message: zod_1.z.string() }),
}, async ({ companyId, contractId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection(`companies/${companyId}/legalContracts`).doc(contractId).update({
        status: 'signed', signedAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
        timeline: firestore_1.FieldValue.arrayUnion({ date: new Date().toISOString(), action: 'signed', detail: 'Contrat signe' }),
    });
    return { success: true, message: 'Contrat marque comme signe.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// PRO: CONTRACT RISK SCORING
// ══════════════════════════════════════════════════════════════════════════════
exports.contractRiskScoringTool = genkit_config_1.ai.defineTool({
    name: 'leg_scoreContractRisk',
    description: 'AI risk scoring for a contract — identify high-risk clauses, missing protections, liability exposure.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), contractId: zod_1.z.string().optional(), contractText: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ riskScore: zod_1.z.number(), riskLevel: zod_1.z.string(), risks: zod_1.z.array(zod_1.z.object({ clause: zod_1.z.string(), severity: zod_1.z.string(), description: zod_1.z.string(), recommendation: zod_1.z.string() })), missingClauses: zod_1.z.array(zod_1.z.string()) }),
}, async ({ companyId, contractId, contractText }) => {
    let text = contractText ?? '';
    if (contractId && !text) {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection(`companies/${companyId}/contracts`).doc(contractId).get();
        text = doc.data()?.['content'] ?? doc.data()?.['description'] ?? '';
    }
    if (!text)
        return { riskScore: 0, riskLevel: 'unknown', risks: [], missingClauses: [] };
    const { text: result } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `Analyze this contract for legal risks in French. Score 0-100 (100=very risky).
Contract: "${text.slice(0, 3000)}"
Return JSON: {"riskScore":45,"riskLevel":"low|medium|high|critical","risks":[{"clause":"...","severity":"high|medium|low","description":"...","recommendation":"..."}],"missingClauses":["clause manquante 1"]}`,
        config: { temperature: 0.2 },
    });
    try {
        return JSON.parse(result.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return { riskScore: 50, riskLevel: 'medium', risks: [], missingClauses: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: CASE TIMELINE
// ══════════════════════════════════════════════════════════════════════════════
exports.caseTimelineTool = genkit_config_1.ai.defineTool({
    name: 'leg_getCaseTimeline',
    description: 'Get complete case/dossier timeline — documents, actions, deadlines, communications.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), caseId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ caseId: zod_1.z.string(), title: zod_1.z.string(), events: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), date: zod_1.z.string(), description: zod_1.z.string() })) }),
}, async ({ companyId, caseId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection(`companies/${companyId}/legalCases`).doc(caseId).get();
    if (!doc.exists)
        return { caseId, title: '', events: [] };
    const c = doc.data();
    const events = [];
    const ts = (v) => v?.toDate?.()?.toISOString() ?? (typeof v === 'string' ? v : '');
    events.push({ type: 'created', date: ts(c['createdAt']), description: `Dossier cree: ${c['title'] ?? ''}` });
    if (c['contracts']) {
        const contracts = c['contracts'];
        contracts.forEach(cid => events.push({ type: 'contract', date: '', description: `Contrat lie: ${cid}` }));
    }
    if (c['updatedAt'])
        events.push({ type: 'updated', date: ts(c['updatedAt']), description: 'Derniere mise a jour' });
    // Get related deadlines
    const dlSnap = await db.collection(`companies/${companyId}/legalDeadlines`).where('caseId', '==', caseId).limit(20).get();
    dlSnap.docs.forEach(d => { const dl = d.data(); events.push({ type: 'deadline', date: ts(dl['dueDate']), description: `Echeance: ${dl['title'] ?? ''}` }); });
    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return { caseId, title: c['title'] ?? '', events };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: CONTRACT TEMPLATES AI
// ══════════════════════════════════════════════════════════════════════════════
exports.contractTemplatesTool = genkit_config_1.ai.defineTool({
    name: 'leg_getContractTemplates',
    description: 'List or generate contract templates — NDA, employment, service, supplier, partnership.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), action: zod_1.z.enum(['list', 'generate']), templateType: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({ templates: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), title: zod_1.z.string(), description: zod_1.z.string() })).optional(), generatedContent: zod_1.z.string().optional(), message: zod_1.z.string() }),
}, async ({ companyId, action, templateType }) => {
    if (action === 'list') {
        return { templates: [
                { type: 'nda', title: 'Accord de confidentialite (NDA)', description: 'Protection des informations sensibles' },
                { type: 'employment', title: 'Contrat de travail', description: 'CDI/CDD avec clauses standards' },
                { type: 'service', title: 'Contrat de prestation', description: 'Services professionnels' },
                { type: 'supplier', title: 'Contrat fournisseur', description: 'Approvisionnement et conditions' },
                { type: 'partnership', title: 'Accord de partenariat', description: 'Collaboration inter-entreprises' },
                { type: 'freelance', title: 'Contrat freelance', description: 'Mission independante' },
            ], message: '6 modeles disponibles.' };
    }
    if (action === 'generate' && templateType) {
        const { text } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Generate a professional ${templateType} contract template in French. Include all standard legal clauses, placeholders for parties, dates, and terms. Format in clean markdown.`,
            config: { temperature: 0.3 },
        });
        return { generatedContent: text, message: `Modele ${templateType} genere.` };
    }
    return { message: 'Action non reconnue.' };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: LEGAL AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════
exports.legalAutomationTool = genkit_config_1.ai.defineTool({
    name: 'leg_runAutomation',
    description: 'Legal automation: deadline alerts, compliance check all, contract expiry → renewal, data breach → RGPD notification.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), type: zod_1.z.enum(['deadline_alerts', 'compliance_scan', 'contract_expiry', 'breach_rgpd']) }),
    outputSchema: zod_1.z.object({ actions: zod_1.z.array(zod_1.z.string()), message: zod_1.z.string() }),
}, async ({ companyId, type }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const actions = [];
    const { createNotification } = await Promise.resolve().then(() => __importStar(require('../services/notificationService')));
    if (type === 'deadline_alerts') {
        const snap = await db.collection(`companies/${companyId}/legalDeadlines`).where('status', '==', 'pending').limit(50).get();
        const now = Date.now();
        const sevenDays = 7 * 86400000;
        snap.docs.forEach(d => {
            const dl = d.data();
            const due = dl['dueDate']?.toDate?.()?.getTime() ?? 0;
            if (due > 0 && due - now < sevenDays && due > now) {
                const daysLeft = Math.round((due - now) / 86400000);
                actions.push(`Echeance "${dl['title']}": ${daysLeft} jour(s) restant(s)`);
            }
        });
        if (actions.length > 0)
            createNotification({ companyId, type: 'system', title: `${actions.length} echeance(s) juridique(s) proche(s)`, message: actions[0], actionUrl: '/legal', icon: 'Scale', severity: 'warning' }).catch(() => { });
    }
    if (type === 'contract_expiry') {
        const snap = await db.collection(`companies/${companyId}/contracts`).limit(100).get();
        const now = Date.now();
        const thirtyDays = 30 * 86400000;
        snap.docs.forEach(d => {
            const c = d.data();
            const exp = c['expiresAt']?.toDate?.()?.getTime() ?? 0;
            if (exp > now && exp - now < thirtyDays)
                actions.push(`Contrat "${c['title'] ?? c['client'] ?? d.id}" expire dans ${Math.round((exp - now) / 86400000)}j`);
        });
        if (actions.length > 0)
            createNotification({ companyId, type: 'system', title: `${actions.length} contrat(s) expirent bientot`, message: 'Renouvelez vos contrats avant expiration.', actionUrl: '/contracts', icon: 'FileText', severity: 'warning' }).catch(() => { });
    }
    if (type === 'breach_rgpd') {
        const snap = await db.collection(`companies/${companyId}/securityIncidents`).where('type', '==', 'data_breach').where('status', 'in', ['detected', 'investigating']).limit(10).get();
        for (const doc of snap.docs) {
            const inc = doc.data();
            const caseId = (0, helpers_1.generateId)();
            await db.collection(`companies/${companyId}/legalCases`).doc(caseId).set({
                id: caseId, title: `[RGPD] Data breach — Notification 72h obligatoire`, type: 'data_breach', status: 'open', priority: 'urgent',
                description: `Incident: ${inc['description'] ?? ''}\n\nNotification CNIL requise sous 72h.\nNotification personnes concernees si risque eleve.`,
                securityIncidentId: doc.id, rgpdDeadline: new Date(Date.now() + 72 * 3600000).toISOString(),
                createdAt: new Date(),
            });
            actions.push(`Dossier RGPD cree pour incident ${doc.id} — deadline 72h`);
        }
    }
    return { actions, message: actions.length > 0 ? `${actions.length} action(s).` : 'Aucune action.' };
});
// Cross-domain — Legal can also analyze HR contracts (employment contracts stored at companies/{id}/contracts)
exports.getAllCompanyContractsTool = genkit_config_1.ai.defineTool({
    name: 'leg_getAllContracts',
    description: "Liste TOUS les contrats de l'entreprise — y compris contrats de travail RH, contrats commerciaux, NDAs, prestations. Cherche dans companies/{id}/contracts (RH) ET dans legalContracts (Legal). À utiliser quand l'utilisateur cite un contrat par nom de personne ou type sans préciser la source.",
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        search: zod_1.z.string().optional().describe("Filtre par nom d'employé, type, ou client"),
    }),
    outputSchema: zod_1.z.object({
        contracts: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            source: zod_1.z.enum(['hr', 'legal']),
            type: zod_1.z.string().optional(),
            contractType: zod_1.z.string().optional(),
            partyName: zod_1.z.string().optional(),
            jobTitle: zod_1.z.string().optional(),
            startDate: zod_1.z.string().optional(),
            endDate: zod_1.z.string().optional(),
            status: zod_1.z.string().optional(),
            baseSalary: zod_1.z.number().optional(),
            currency: zod_1.z.string().optional(),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, search }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const q = (search ?? '').toLowerCase();
    const dateStr = (v) => {
        if (!v)
            return undefined;
        if (typeof v === 'string')
            return v.slice(0, 10);
        if (typeof v === 'object') {
            const o = v;
            if (typeof o.toDate === 'function')
                return o.toDate().toISOString().slice(0, 10);
            const secs = o._seconds ?? o.seconds;
            if (typeof secs === 'number')
                return new Date(secs * 1000).toISOString().slice(0, 10);
        }
        return undefined;
    };
    const [hrSnap, legalSnap] = await Promise.all([
        db.collection(`companies/${companyId}/contracts`).limit(200).get().catch(() => null),
        db.collection(`companies/${companyId}/legalContracts`).limit(200).get().catch(() => null),
    ]);
    const all = [];
    // HR employment contracts — fetch employee names from the contract data or related employee
    for (const d of hrSnap?.docs ?? []) {
        const data = d.data();
        let partyName = data['employeeName'] ?? '';
        if (!partyName && data['employeeId']) {
            const empDoc = await db.collection(`companies/${companyId}/employees`).doc(data['employeeId']).get().catch(() => null);
            partyName = empDoc?.data()?.['displayName'] ?? '';
        }
        all.push({
            id: d.id, source: 'hr',
            type: 'employment',
            contractType: data['contractType'],
            partyName,
            jobTitle: data['jobTitle'],
            startDate: dateStr(data['startDate']),
            endDate: dateStr(data['endDate']),
            status: data['status'] ?? 'active',
            baseSalary: data['baseSalary'],
            currency: data['currency'],
        });
    }
    // Legal contracts (commercial, NDA, partnership, etc.)
    for (const d of legalSnap?.docs ?? []) {
        const data = d.data();
        all.push({
            id: d.id, source: 'legal',
            type: data['type'],
            contractType: data['contractType'],
            partyName: data['partyName'] ?? data['client'],
            startDate: dateStr(data['startDate']),
            endDate: dateStr(data['endDate'] ?? data['expiryDate']),
            status: data['status'],
        });
    }
    // Filter by search query (name, type, jobTitle)
    const matches = q
        ? all.filter(c => `${c.partyName ?? ''} ${c.jobTitle ?? ''} ${c.type ?? ''} ${c.contractType ?? ''}`.toLowerCase().includes(q))
        : all;
    return { contracts: matches, total: matches.length };
});
const ALL_TOOLS = [
    exports.analyzeContractTool, exports.generateContractTool, exports.compareContractsTool,
    exports.getAllCompanyContractsTool,
    exports.createCaseTool, exports.getCasesTool,
    exports.getDeadlinesTool, exports.createDeadlineTool,
    exports.checkComplianceTool, exports.getClausesTool, exports.getStatsTool,
    exports.sendForSignatureTool, exports.emailContractForSignatureTool, exports.markSignedTool,
    // PRO
    exports.contractRiskScoringTool, exports.caseTimelineTool, exports.contractTemplatesTool, exports.legalAutomationTool,
];
const INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({ response: zod_1.z.string(), requiresLawyer: zod_1.z.boolean(), urgentDeadlines: zod_1.z.number() });
exports.legalAgentFlow = genkit_config_1.ai.defineFlow({ name: 'legalAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, language, history }) => {
    logger_1.logger.info(`[LegalAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;
    // Date anchor — for compliance deadlines, contract expiries, etc.
    const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();
    const executors = new Map();
    for (const tool of ALL_TOOLS) {
        const name = tool.__action?.name ?? '';
        if (name)
            executors.set(name, (i) => tool({ ...i, companyId }));
    }
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20)) {
            messages.push({ role: h.role, content: [{ text: h.content }] });
        }
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        system: `Tu es l'Agent Juridique PRO de l'entreprise — assistant juridique virtuel.
CompanyID: ${companyId}.

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
Pour les délais (préavis, échéances, prescriptions), calcule à partir de cette date.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages. Si l'utilisateur dit "cette clause", "ce contrat", "celui-là", références-toi à TON DERNIER document/clause analysé. Ne jamais redémarrer un "Bonjour, je suis l'agent juridique" si le contexte est clair.

## TON RÔLE
Tu analyses les contrats, gères les dossiers juridiques, suis les échéances, vérifies la conformité (RGPD, droit du travail, droit commercial), et génères des modèles (NDA, contrat de prestation, CGV).

CAPACITÉS :
- Analyser une clause : risques, ambiguïtés, recommandations de reformulation
- Comparer deux contrats / versions (leg_compareContracts)
- Lister TOUS les contrats de l'entreprise (RH + Legal) → leg_getAllContracts (cross-domain)
- Repérer les clauses manquantes (force majeure, juridiction, propriété intellectuelle)
- Suivre les échéances (renouvellements, fins de bail, NDA expirant)
- Conformité : RGPD, lois locales (Côte d'Ivoire, OHADA, France)
- Génération de templates ajustés au contexte

⚠️ CROSS-DOMAIN : Les contrats de travail (RH) sont dans companies/{id}/contracts (créés par l'agent RH). Les contrats commerciaux (NDA, prestation, partenariat) sont dans companies/{id}/legalContracts. Utilise leg_getAllContracts pour TOUT lister sans demander à l'utilisateur de préciser la source.

🔥 RÈGLE CRITIQUE — ENVOI DE CONTRATS :
Quand l'utilisateur dit "envoyer / envoie / send / email / emailer" un contrat à quelqu'un avec son adresse email, tu DOIS appeler **leg_emailContractForSignature** (en un seul appel : génère + envoie via Wemas pour signature électronique). N'utilise JAMAIS leg_generateContract seul puis leg_sendForSignature — ça ne fait QUE mettre à jour la DB sans envoyer d'email réel. Ne jamais répondre "envoyé" sans avoir reçu success=true de leg_emailContractForSignature. Si tu n'as pas tous les paramètres (type, partyA, partyB, signatoryEmail), DEMANDE-les à l'utilisateur en une seule question. Si Wemas n'est pas configuré, dis-le clairement à l'utilisateur — ne prétends pas avoir envoyé.

⚠️ DISCLAIMER OBLIGATOIRE :
Toujours préciser que ton analyse est une ASSISTANCE IA, PAS un conseil juridique professionnel. Recommander un avocat qualifié pour toute décision contraignante. Ne JAMAIS donner de jugement définitif — présenter l'analyse et recommander une revue par un professionnel.

STYLE :
- Précis, structuré, professionnel
- Cite les articles de loi quand pertinent (Code du travail, Code civil, AUOHADA, RGPD article X)
- Présente les risques par niveau (faible / moyen / élevé / critique)
- Propose toujours une reformulation alternative pour les clauses problématiques
${langInstr}`,
        messages, tools: ALL_TOOLS, config: { temperature: 0.2 },
    });
    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 8) {
        loopCount++;
        const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
            const { name, input, ref } = p.toolRequest;
            const exec = executors.get(name);
            const output = exec ? await exec(input) : { error: `Unknown tool: ${name}` };
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
            tools: ALL_TOOLS, config: { temperature: 0.2 },
        });
    }
    const text = response.text;
    return { response: text, requiresLawyer: /avocat|lawyer|professionnel|high.*risk|critical/i.test(text), urgentDeadlines: 0 };
});
exports.legalAgentTool = genkit_config_1.ai.defineTool({
    name: 'callLegalAgent',
    description: 'Legal PRO: contract risk scoring IA, case timeline, templates AI (NDA/emploi/service), deadline alerts, compliance RGPD, clause library, cross-agent automation (breach → RGPD, contrats → renouvellement).',
    inputSchema: INPUT, outputSchema: OUTPUT,
}, (input) => (0, exports.legalAgentFlow)(input));
//# sourceMappingURL=legal.agent.js.map