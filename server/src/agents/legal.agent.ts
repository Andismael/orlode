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
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

const CONTRACT_TYPES = ['nda', 'service', 'freelance', 'employment', 'supplier', 'lease', 'partnership', 'other'] as const;
const CONTRACT_STATUSES = ['draft', 'review', 'approved', 'sent', 'signed', 'active', 'expired', 'terminated'] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 1. CONTRATS — Analyse · Risques · Generation · Comparaison
// ══════════════════════════════════════════════════════════════════════════════

export const analyzeContractTool = ai.defineTool(
  {
    name: 'leg_analyzeContract',
    description: 'Analyze contract text: extract key terms, obligations, risks with severity scoring.',
    inputSchema: z.object({
      companyId: z.string(), contractText: z.string(),
      contractType: z.enum(CONTRACT_TYPES).optional().default('other'),
      language: z.string().optional().default('fr'),
    }),
    outputSchema: z.object({
      summary: z.string(), riskScore: z.number(), keyTerms: z.array(z.string()),
      risks: z.array(z.object({ clause: z.string(), risk: z.string(), severity: z.string() })),
      obligations: z.array(z.string()), expiryDate: z.string().optional(), recommendation: z.string(),
    }),
  },
  async ({ contractText, contractType, language }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Analyze this ${contractType} contract in ${language}. Extract key info.
Contract: ${contractText.slice(0, 6000)}
Return JSON: {"summary":"...","riskScore":0-100,"keyTerms":["..."],"risks":[{"clause":"...","risk":"...","severity":"low|medium|high|critical"}],"obligations":["..."],"expiryDate":"YYYY-MM-DD or null","recommendation":"..."} ONLY JSON.`,
      config: { temperature: 0.1 },
    });
    try {
      const p = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      return { ...p, riskScore: p.riskScore ?? 50 };
    } catch {
      return { summary: text.slice(0, 300), riskScore: 50, keyTerms: [], risks: [], obligations: [], recommendation: 'Revue manuelle recommandee.' };
    }
  }
);

export const generateContractTool = ai.defineTool(
  {
    name: 'leg_generateContract',
    description: 'Generate a contract from template with custom clauses.',
    inputSchema: z.object({
      companyId: z.string(), type: z.enum(CONTRACT_TYPES).default('nda'),
      partyA: z.string(), partyB: z.string(), language: z.string().optional().default('fr'),
      customClauses: z.string().optional(), duration: z.string().optional(),
    }),
    outputSchema: z.object({ contractId: z.string(), content: z.string(), warning: z.string() }),
  },
  async ({ companyId, type, partyA, partyB, language, customClauses, duration }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Generate a ${type} contract in ${language} between "${partyA}" and "${partyB}".${duration ? ` Duration: ${duration}.` : ''}${customClauses ? ` Custom clauses: ${customClauses}` : ''} Include standard clauses. Return only the contract text.`,
      config: { temperature: 0.2 },
    });
    const db = getFirestore();
    const id = generateId();
    const countSnap = await db.collection(`companies/${companyId}/legalContracts`).count().get();
    const num = `CTR-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, '0')}`;
    await db.collection(`companies/${companyId}/legalContracts`).doc(id).set({
      id, contractNumber: num, type, partyA, partyB, content: text, status: 'draft',
      duration: duration ?? null, customClauses: customClauses ?? null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { contractId: id, content: text, warning: 'Document genere par IA — revue juridique obligatoire avant signature.' };
  }
);

export const compareContractsTool = ai.defineTool(
  {
    name: 'leg_compareContracts',
    description: 'Compare two contract versions and highlight differences.',
    inputSchema: z.object({ companyId: z.string(), textA: z.string(), textB: z.string(), language: z.string().optional().default('fr') }),
    outputSchema: z.object({ differences: z.array(z.object({ section: z.string(), versionA: z.string(), versionB: z.string(), impact: z.string() })), summary: z.string() }),
  },
  async ({ textA, textB, language }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Compare these 2 contract versions in ${language}. Highlight key differences.
Version A: ${textA.slice(0, 3000)}
Version B: ${textB.slice(0, 3000)}
Return JSON: {"differences":[{"section":"...","versionA":"...","versionB":"...","impact":"low|medium|high"}],"summary":"..."} ONLY.`,
      config: { temperature: 0.1 },
    });
    try { return JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); }
    catch { return { differences: [], summary: text.slice(0, 300) }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. DOSSIERS (Case Management)
// ══════════════════════════════════════════════════════════════════════════════

export const createCaseTool = ai.defineTool(
  {
    name: 'leg_createCase',
    description: 'Create a legal case/dossier grouping contracts, notes, and deadlines.',
    inputSchema: z.object({
      companyId: z.string(), title: z.string(), description: z.string().optional(),
      type: z.enum(['litigation', 'transaction', 'compliance', 'advisory', 'other']).default('other'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      client: z.string().optional(),
    }),
    outputSchema: z.object({ caseId: z.string(), caseNumber: z.string(), message: z.string() }),
  },
  async ({ companyId, title, description, type, priority, client }) => {
    const db = getFirestore();
    const id = generateId();
    const countSnap = await db.collection(`companies/${companyId}/legalCases`).count().get();
    const num = `DOS-${new Date().getFullYear()}-${String(countSnap.data().count + 1).padStart(4, '0')}`;
    await db.collection(`companies/${companyId}/legalCases`).doc(id).set({
      id, caseNumber: num, title, description: description ?? '', type, priority,
      client: client ?? null, status: 'open', contractIds: [], notes: [], deadlineIds: [],
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    return { caseId: id, caseNumber: num, message: `Dossier ${num} cree.` };
  }
);

export const getCasesTool = ai.defineTool(
  {
    name: 'leg_getCases',
    description: 'List legal cases/dossiers.',
    inputSchema: z.object({ companyId: z.string(), status: z.string().optional() }),
    outputSchema: z.object({ cases: z.array(z.object({ id: z.string(), caseNumber: z.string(), title: z.string(), type: z.string(), status: z.string(), priority: z.string() })) }),
  },
  async ({ companyId, status }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/legalCases`) as FirebaseFirestore.Query;
    if (status) q = q.where('status', '==', status);
    const snap = await q.limit(50).get();
    return { cases: snap.docs.map(d => { const data = d.data(); return { id: d.id, caseNumber: (data['caseNumber'] as string) ?? '', title: (data['title'] as string) ?? '', type: (data['type'] as string) ?? '', status: (data['status'] as string) ?? 'open', priority: (data['priority'] as string) ?? 'medium' }; }) };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. DEADLINES
// ══════════════════════════════════════════════════════════════════════════════

export const getDeadlinesTool = ai.defineTool(
  {
    name: 'leg_getDeadlines',
    description: 'Get upcoming legal deadlines with urgency tracking.',
    inputSchema: z.object({ companyId: z.string(), daysAhead: z.number().optional().default(90) }),
    outputSchema: z.object({
      deadlines: z.array(z.object({ id: z.string(), title: z.string(), type: z.string(), dueDate: z.string(), daysLeft: z.number(), priority: z.string() })),
      urgent: z.number(), overdue: z.number(),
    }),
  },
  async ({ companyId, daysAhead }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/legalDeadlines`).limit(100).get();
    const now = Date.now();
    const deadlines = snap.docs.map(d => {
      const data = d.data();
      const due = data['dueDate']?.toDate?.() ?? new Date(data['dueDate'] as string);
      const daysLeft = Math.ceil((due.getTime() - now) / 86400000);
      return {
        id: d.id, title: (data['title'] as string) ?? '', type: (data['type'] as string) ?? 'other',
        dueDate: due.toISOString().split('T')[0], daysLeft,
        priority: daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'high' : 'medium',
      };
    }).filter(d => d.daysLeft <= (daysAhead ?? 90)).sort((a, b) => a.daysLeft - b.daysLeft);
    return { deadlines, urgent: deadlines.filter(d => d.priority === 'critical').length, overdue: deadlines.filter(d => d.daysLeft < 0).length };
  }
);

export const createDeadlineTool = ai.defineTool(
  {
    name: 'leg_createDeadline',
    description: 'Create a legal deadline/reminder.',
    inputSchema: z.object({
      companyId: z.string(), title: z.string(), dueDate: z.string(),
      type: z.enum(['contract_renewal', 'compliance', 'filing', 'hearing', 'review', 'other']).default('other'),
      description: z.string().optional(), caseId: z.string().optional(),
    }),
    outputSchema: z.object({ deadlineId: z.string(), message: z.string() }),
  },
  async ({ companyId, title, dueDate, type, description, caseId }) => {
    const db = getFirestore();
    const id = generateId();
    await db.collection(`companies/${companyId}/legalDeadlines`).doc(id).set({
      id, title, dueDate: new Date(dueDate), type, description: description ?? '',
      caseId: caseId ?? null, notified: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { deadlineId: id, message: `Echeance "${title}" creee pour le ${dueDate}.` };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. CONFORMITE
// ══════════════════════════════════════════════════════════════════════════════

export const checkComplianceTool = ai.defineTool(
  {
    name: 'leg_checkCompliance',
    description: 'Check compliance status with scoring (GDPR, labor law, corporate, tax).',
    inputSchema: z.object({ companyId: z.string(), area: z.enum(['gdpr', 'labor_law', 'corporate', 'tax', 'all']).default('all') }),
    outputSchema: z.object({ area: z.string(), score: z.number(), status: z.string(), issues: z.array(z.string()), actions: z.array(z.string()) }),
  },
  async ({ companyId, area }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/legalCompliance`).doc(area ?? 'all').get();
    if (doc.exists) {
      const d = doc.data()!;
      return { area: area ?? 'all', score: (d['score'] as number) ?? 50, status: (d['status'] as string) ?? 'needs_review', issues: (d['issues'] as string[]) ?? [], actions: (d['actions'] as string[]) ?? [] };
    }
    const defaults: Record<string, { score: number; issues: string[]; actions: string[] }> = {
      gdpr: { score: 40, issues: ['Politique de confidentialite a revoir', 'Registre des traitements incomplet'], actions: ['Mettre a jour la politique', 'Completer le registre RGPD'] },
      labor_law: { score: 60, issues: ['Contrats de travail a verifier', 'DUERP a mettre a jour'], actions: ['Revue contrats', 'Mise a jour DUERP'] },
      corporate: { score: 55, issues: ['PV AG a preparer', 'Registre beneficiaires effectifs'], actions: ['Planifier AG', 'Mettre a jour RBE'] },
      tax: { score: 70, issues: ['Echeances TVA a verifier'], actions: ['Verifier calendrier fiscal'] },
      all: { score: 55, issues: ['Audit juridique complet recommande'], actions: ['Planifier audit annuel'] },
    };
    const d = defaults[area ?? 'all'] ?? defaults['all'];
    return { area: area ?? 'all', score: d.score, status: d.score >= 70 ? 'compliant' : 'needs_review', issues: d.issues, actions: d.actions };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. CLAUSES LIBRARY
// ══════════════════════════════════════════════════════════════════════════════

export const getClausesTool = ai.defineTool(
  {
    name: 'leg_getClauses',
    description: 'Get reusable clause library.',
    inputSchema: z.object({ companyId: z.string(), category: z.string().optional() }),
    outputSchema: z.object({ clauses: z.array(z.object({ id: z.string(), title: z.string(), content: z.string(), category: z.string() })) }),
  },
  async ({ companyId, category }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/legalClauses`) as FirebaseFirestore.Query;
    if (category) q = q.where('category', '==', category);
    const snap = await q.limit(50).get();
    return { clauses: snap.docs.map(d => { const data = d.data(); return { id: d.id, title: (data['title'] as string) ?? '', content: (data['content'] as string) ?? '', category: (data['category'] as string) ?? 'general' }; }) };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. STATS
// ══════════════════════════════════════════════════════════════════════════════

export const getStatsTool = ai.defineTool(
  {
    name: 'leg_getStats',
    description: 'Get legal department KPIs.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalContracts: z.number(), activeContracts: z.number(), expiringSoon: z.number(),
      totalCases: z.number(), openCases: z.number(),
      totalDeadlines: z.number(), urgentDeadlines: z.number(), overdueDeadlines: z.number(),
      complianceScore: z.number(),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const [contractsSnap, casesSnap, deadlinesSnap, compDoc] = await Promise.all([
      db.collection(`companies/${companyId}/legalContracts`).limit(500).get(),
      db.collection(`companies/${companyId}/legalCases`).limit(100).get(),
      db.collection(`companies/${companyId}/legalDeadlines`).limit(200).get(),
      db.collection(`companies/${companyId}/legalCompliance`).doc('all').get(),
    ]);
    const now = new Date(); const soon = new Date(now.getTime() + 30 * 86400000);
    const contracts = contractsSnap.docs.map(d => d.data());
    const active = contracts.filter(c => c['status'] === 'active' || c['status'] === 'signed').length;
    const expiring = contracts.filter(c => { const exp = c['expiryDate']?.toDate?.(); return exp && exp > now && exp < soon; }).length;
    const cases = casesSnap.docs.map(d => d.data());
    const openCases = cases.filter(c => c['status'] === 'open').length;
    const deadlines = deadlinesSnap.docs.map(d => { const due = d.data()['dueDate']?.toDate?.() ?? new Date(); return { daysLeft: Math.ceil((due.getTime() - now.getTime()) / 86400000) }; });
    const urgent = deadlines.filter(d => d.daysLeft >= 0 && d.daysLeft <= 7).length;
    const overdue = deadlines.filter(d => d.daysLeft < 0).length;
    const compScore = (compDoc.data()?.['score'] as number) ?? 55;
    return { totalContracts: contracts.length, activeContracts: active, expiringSoon: expiring, totalCases: cases.length, openCases, totalDeadlines: deadlines.length, urgentDeadlines: urgent, overdueDeadlines: overdue, complianceScore: compScore };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 7. SIGNATURE WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════

export const sendForSignatureTool = ai.defineTool(
  {
    name: 'leg_sendForSignature',
    description: 'Internal status update for a contract previously created in legalContracts. Use only when the contract was already sent through another channel and you just need to flag the DB status. For ACTUAL email sending with e-signature, use leg_emailContractForSignature instead.',
    inputSchema: z.object({ companyId: z.string(), contractId: z.string(), email: z.string().optional() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, contractId, email }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/legalContracts`).doc(contractId).get();
    if (!doc.exists) return { success: false, message: 'Contrat introuvable.' };
    const data = doc.data()!;
    const to = email ?? (data['partyB'] as string) ?? '';
    await db.collection(`companies/${companyId}/legalContracts`).doc(contractId).update({
      status: 'sent', sentForSignatureAt: FieldValue.serverTimestamp(), sentTo: to,
      updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({ date: new Date().toISOString(), action: 'sent_for_signature', detail: `Envoye a ${to}` }),
    });
    return { success: true, message: `Contrat ${data['contractNumber']} envoye pour signature a ${to}.` };
  }
);

// ── PRIMARY contract-sending tool — generates + emails via Wemas ───────────
// This is what the agent should reach for whenever the user asks to
// "envoyer / emailer / send" a contract. It generates the body via Gemini,
// pushes it through Wemas (which produces a signing URL + sends the
// recipient an e-signature email), and caches the result locally.
export const emailContractForSignatureTool = ai.defineTool(
  {
    name: 'leg_emailContractForSignature',
    description: 'Generate a contract AND email it for e-signature in one step. USE THIS whenever the user asks to "envoyer / send / email" a contract to someone. The recipient receives a Wemas e-signature link by email. Returns the contractId, signingUrl, and confirmation message.',
    inputSchema: z.object({
      companyId: z.string(),
      contractType: z.enum(['nda', 'employment', 'service', 'supplier', 'partnership', 'freelance', 'cdi', 'cdd', 'prestation_services'])
        .describe('Type of contract. "freelance" for freelance/independent contractor, "nda" for confidentiality, "service"/"prestation_services" for service agreements.'),
      partyA: z.string().describe('Sender / company name (the one sending the contract)'),
      partyB: z.string().describe('Recipient name (the person who will receive and sign)'),
      signatoryEmail: z.string().describe('Email address of the recipient (where the signing link will be sent)'),
      signatoryPhone: z.string().optional().describe('Optional WhatsApp phone in E.164 format (e.g. "+12038097112"). When provided, the signing link is also sent via WhatsApp.'),
      duration: z.string().optional().describe('Contract duration (e.g. "6 months", "1 year")'),
      customClauses: z.string().optional().describe('Any specific clauses to include beyond the standard ones'),
      senderName: z.string().optional().describe('Name of the sender for the email signature'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      contractId: z.string().optional(),
      signingUrl: z.string().optional(),
      message: z.string(),
    }),
  },
  async ({ companyId, contractType, partyA, partyB, signatoryEmail, signatoryPhone, duration, customClauses, senderName }) => {
    // 1. Generate the contract body via Gemini
    let contractContent: string;
    try {
      const { text } = await ai.generate({
        model: GEMINI_FLASH,
        prompt: `Tu rédiges un contrat de type "${contractType}" en français entre "${partyA}" (Partie A) et "${partyB}" (Partie B).${duration ? `\n\nDurée du contrat : ${duration}.` : ''}${customClauses ? `\n\nClauses spécifiques à inclure : ${customClauses}` : ''}

Inclus toutes les clauses standards : identification des parties, objet du contrat, obligations de chaque partie, durée et conditions de résiliation, modalités de paiement (si applicable), confidentialité, propriété intellectuelle (si applicable), juridiction et droit applicable.

Format : markdown avec titres (##) et sous-titres (###). Aucun placeholder à remplir — utilise des valeurs réalistes et professionnelles. Ton sobre et juridique. Ne mets pas de disclaimer IA — c'est le corps du contrat qui sera signé.`,
        config: { temperature: 0.3 },
      });
      contractContent = text;
      if (!contractContent || contractContent.trim().length < 200) {
        return { success: false, message: 'La génération du contrat a échoué (contenu trop court). Réessaie.' };
      }
    } catch (err) {
      logger.error('[Legal] Contract generation failed', { error: String(err) });
      return { success: false, message: `Génération du contrat impossible: ${err instanceof Error ? err.message : String(err)}` };
    }

    // 2. Create contract natively in Orlode (Firestore) — no external bridge
    const { wemasService } = await import('../services/wemas/wemasService');
    const ctype = (({
      nda: 'nda',
      employment: 'cdi',
      service: 'prestation_services',
      supplier: 'prestation_services',
      partnership: 'prestation_services',
      freelance: 'freelance',
      cdi: 'cdi',
      cdd: 'cdd',
      prestation_services: 'prestation_services',
    } as Record<string, 'nda' | 'cdi' | 'cdd' | 'freelance' | 'prestation_services'>)[contractType]) ?? 'prestation_services';

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
    } catch (err) {
      logger.error('[Legal] Native createContract failed', { error: String(err) });
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
      const { sendEmail } = await import('../services/email/emailService');
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
      logger.info('[Legal] Signing email sent', {
        companyId, contractId: contract.id, to: signatoryEmail, provider: result.provider,
      });
    } catch (err) {
      // Email failed but contract is saved — surface the error so the agent
      // doesn't lie. Caller can retry by re-using contract.uniqueLink.
      logger.error('[Legal] Signing email send failed', { error: String(err) });
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
        const { whatsappService } = await import('../services/whatsapp/whatsappService');
        const cfg = await whatsappService.getConfig(companyId);
        if (cfg) {
          const senderLabel = senderName ?? partyA;
          const firstName = partyB.split(/\s+/)[0] ?? partyB;
          const waMsg = `Bonjour ${firstName} 👋\n\n*${senderLabel}* vous demande de signer un contrat ${contractType}.\n\n📝 Lire et signer ici :\n${signingUrl}\n\n_Lien valable 30 jours · Signature électronique sécurisée_`;
          const id = await whatsappService.sendMessage(cfg, signatoryPhone, waMsg);
          if (id) {
            whatsappSent = true;
            logger.info('[Legal] Signing WhatsApp sent', { companyId, contractId: contract.id, to: signatoryPhone });
          }
        } else {
          logger.warn('[Legal] WhatsApp not configured, skipping WhatsApp send', { companyId });
        }
      } catch (err) {
        logger.warn('[Legal] WhatsApp send failed (non-blocking)', { error: String(err) });
      }
    }

    const channels = ['email' + (whatsappSent ? ' + WhatsApp' : '')];
    return {
      success: true,
      contractId: contract.id,
      signingUrl,
      message: `Contrat ${contractType} envoyé à ${signatoryEmail} (${channels.join(' & ')}) pour signature électronique. [Lire et signer le contrat](${signingUrl})`,
    };
  }
);

// ── Email HTML templates ─────────────────────────────────────────────────────

interface SigningEmailVars {
  firstName: string;
  signatoryName: string;
  contractType: string;
  senderName: string;
  signingUrl: string;
}

function renderSigningEmail(v: SigningEmailVars): string {
  const orgColor = '#0A4F3C';
  const typeLabel = ({
    nda: 'Accord de confidentialité',
    employment: 'Contrat de travail',
    service: 'Contrat de prestation',
    supplier: 'Contrat fournisseur',
    partnership: 'Accord de partenariat',
    freelance: 'Contrat freelance',
    cdi: 'CDI',
    cdd: 'CDD',
    prestation_services: 'Contrat de prestation',
  } as Record<string, string>)[v.contractType] ?? 'Contrat';

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

export function renderSignedConfirmationEmail(v: {
  signatoryName: string;
  signatoryEmail: string;
  senderName: string;
  contractType: string;
  signedAt: string;
  signatureData: string;       // base64 PNG dataURL
  contractContent: string;
  contractLink: string;
}): string {
  const orgColor = '#0A4F3C';
  const typeLabel = ({
    nda: 'Accord de confidentialité',
    cdi: 'CDI',
    cdd: 'CDD',
    freelance: 'Contrat freelance',
    prestation_services: 'Contrat de prestation',
  } as Record<string, string>)[v.contractType] ?? 'Contrat';
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

export const markSignedTool = ai.defineTool(
  {
    name: 'leg_markAsSigned',
    description: 'Mark a contract as signed.',
    inputSchema: z.object({ companyId: z.string(), contractId: z.string() }),
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ companyId, contractId }) => {
    const db = getFirestore();
    await db.collection(`companies/${companyId}/legalContracts`).doc(contractId).update({
      status: 'signed', signedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      timeline: FieldValue.arrayUnion({ date: new Date().toISOString(), action: 'signed', detail: 'Contrat signe' }),
    });
    return { success: true, message: 'Contrat marque comme signe.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PRO: CONTRACT RISK SCORING
// ══════════════════════════════════════════════════════════════════════════════

export const contractRiskScoringTool = ai.defineTool(
  {
    name: 'leg_scoreContractRisk',
    description: 'AI risk scoring for a contract — identify high-risk clauses, missing protections, liability exposure.',
    inputSchema: z.object({ companyId: z.string(), contractId: z.string().optional(), contractText: z.string().optional() }),
    outputSchema: z.object({ riskScore: z.number(), riskLevel: z.string(), risks: z.array(z.object({ clause: z.string(), severity: z.string(), description: z.string(), recommendation: z.string() })), missingClauses: z.array(z.string()) }),
  },
  async ({ companyId, contractId, contractText }) => {
    let text = contractText ?? '';
    if (contractId && !text) {
      const db = getFirestore();
      const doc = await db.collection(`companies/${companyId}/contracts`).doc(contractId).get();
      text = (doc.data()?.['content'] as string) ?? (doc.data()?.['description'] as string) ?? '';
    }
    if (!text) return { riskScore: 0, riskLevel: 'unknown', risks: [], missingClauses: [] };

    const { text: result } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Analyze this contract for legal risks in French. Score 0-100 (100=very risky).
Contract: "${text.slice(0, 3000)}"
Return JSON: {"riskScore":45,"riskLevel":"low|medium|high|critical","risks":[{"clause":"...","severity":"high|medium|low","description":"...","recommendation":"..."}],"missingClauses":["clause manquante 1"]}`,
      config: { temperature: 0.2 },
    });
    try { return JSON.parse(result.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch { return { riskScore: 50, riskLevel: 'medium', risks: [], missingClauses: [] }; }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: CASE TIMELINE
// ══════════════════════════════════════════════════════════════════════════════

export const caseTimelineTool = ai.defineTool(
  {
    name: 'leg_getCaseTimeline',
    description: 'Get complete case/dossier timeline — documents, actions, deadlines, communications.',
    inputSchema: z.object({ companyId: z.string(), caseId: z.string() }),
    outputSchema: z.object({ caseId: z.string(), title: z.string(), events: z.array(z.object({ type: z.string(), date: z.string(), description: z.string() })) }),
  },
  async ({ companyId, caseId }) => {
    const db = getFirestore();
    const doc = await db.collection(`companies/${companyId}/legalCases`).doc(caseId).get();
    if (!doc.exists) return { caseId, title: '', events: [] };
    const c = doc.data()!;
    const events: { type: string; date: string; description: string }[] = [];
    const ts = (v: unknown) => (v as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? (typeof v === 'string' ? v : '');
    events.push({ type: 'created', date: ts(c['createdAt']), description: `Dossier cree: ${c['title'] ?? ''}` });
    if (c['contracts']) { const contracts = c['contracts'] as string[]; contracts.forEach(cid => events.push({ type: 'contract', date: '', description: `Contrat lie: ${cid}` })); }
    if (c['updatedAt']) events.push({ type: 'updated', date: ts(c['updatedAt']), description: 'Derniere mise a jour' });

    // Get related deadlines
    const dlSnap = await db.collection(`companies/${companyId}/legalDeadlines`).where('caseId', '==', caseId).limit(20).get();
    dlSnap.docs.forEach(d => { const dl = d.data(); events.push({ type: 'deadline', date: ts(dl['dueDate']), description: `Echeance: ${dl['title'] ?? ''}` }); });

    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return { caseId, title: (c['title'] as string) ?? '', events };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: CONTRACT TEMPLATES AI
// ══════════════════════════════════════════════════════════════════════════════

export const contractTemplatesTool = ai.defineTool(
  {
    name: 'leg_getContractTemplates',
    description: 'List or generate contract templates — NDA, employment, service, supplier, partnership.',
    inputSchema: z.object({ companyId: z.string(), action: z.enum(['list', 'generate']), templateType: z.string().optional() }),
    outputSchema: z.object({ templates: z.array(z.object({ type: z.string(), title: z.string(), description: z.string() })).optional(), generatedContent: z.string().optional(), message: z.string() }),
  },
  async ({ companyId, action, templateType }) => {
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
      const { text } = await ai.generate({
        model: GEMINI_FLASH,
        prompt: `Generate a professional ${templateType} contract template in French. Include all standard legal clauses, placeholders for parties, dates, and terms. Format in clean markdown.`,
        config: { temperature: 0.3 },
      });
      return { generatedContent: text, message: `Modele ${templateType} genere.` };
    }
    return { message: 'Action non reconnue.' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: LEGAL AUTOMATION (cross-agent)
// ══════════════════════════════════════════════════════════════════════════════

export const legalAutomationTool = ai.defineTool(
  {
    name: 'leg_runAutomation',
    description: 'Legal automation: deadline alerts, compliance check all, contract expiry → renewal, data breach → RGPD notification.',
    inputSchema: z.object({ companyId: z.string(), type: z.enum(['deadline_alerts', 'compliance_scan', 'contract_expiry', 'breach_rgpd']) }),
    outputSchema: z.object({ actions: z.array(z.string()), message: z.string() }),
  },
  async ({ companyId, type }) => {
    const db = getFirestore();
    const actions: string[] = [];
    const { createNotification } = await import('../services/notificationService');

    if (type === 'deadline_alerts') {
      const snap = await db.collection(`companies/${companyId}/legalDeadlines`).where('status', '==', 'pending').limit(50).get();
      const now = Date.now(); const sevenDays = 7 * 86400000;
      snap.docs.forEach(d => {
        const dl = d.data();
        const due = (dl['dueDate'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        if (due > 0 && due - now < sevenDays && due > now) {
          const daysLeft = Math.round((due - now) / 86400000);
          actions.push(`Echeance "${dl['title']}": ${daysLeft} jour(s) restant(s)`);
        }
      });
      if (actions.length > 0) createNotification({ companyId, type: 'system', title: `${actions.length} echeance(s) juridique(s) proche(s)`, message: actions[0], actionUrl: '/legal', icon: 'Scale', severity: 'warning' }).catch(() => {});
    }

    if (type === 'contract_expiry') {
      const snap = await db.collection(`companies/${companyId}/contracts`).limit(100).get();
      const now = Date.now(); const thirtyDays = 30 * 86400000;
      snap.docs.forEach(d => {
        const c = d.data();
        const exp = (c['expiresAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        if (exp > now && exp - now < thirtyDays) actions.push(`Contrat "${c['title'] ?? c['client'] ?? d.id}" expire dans ${Math.round((exp - now) / 86400000)}j`);
      });
      if (actions.length > 0) createNotification({ companyId, type: 'system', title: `${actions.length} contrat(s) expirent bientot`, message: 'Renouvelez vos contrats avant expiration.', actionUrl: '/contracts', icon: 'FileText', severity: 'warning' }).catch(() => {});
    }

    if (type === 'breach_rgpd') {
      const snap = await db.collection(`companies/${companyId}/securityIncidents`).where('type', '==', 'data_breach').where('status', 'in', ['detected', 'investigating']).limit(10).get();
      for (const doc of snap.docs) {
        const inc = doc.data();
        const caseId = generateId();
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
  }
);

// Cross-domain — Legal can also analyze HR contracts (employment contracts stored at companies/{id}/contracts)
export const getAllCompanyContractsTool = ai.defineTool(
  {
    name: 'leg_getAllContracts',
    description: "Liste TOUS les contrats de l'entreprise — y compris contrats de travail RH, contrats commerciaux, NDAs, prestations. Cherche dans companies/{id}/contracts (RH) ET dans legalContracts (Legal). À utiliser quand l'utilisateur cite un contrat par nom de personne ou type sans préciser la source.",
    inputSchema: z.object({
      companyId: z.string(),
      search: z.string().optional().describe("Filtre par nom d'employé, type, ou client"),
    }),
    outputSchema: z.object({
      contracts: z.array(z.object({
        id: z.string(),
        source: z.enum(['hr', 'legal']),
        type: z.string().optional(),
        contractType: z.string().optional(),
        partyName: z.string().optional(),
        jobTitle: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.string().optional(),
        baseSalary: z.number().optional(),
        currency: z.string().optional(),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, search }) => {
    const db = getFirestore();
    const q = (search ?? '').toLowerCase();
    const dateStr = (v: unknown): string | undefined => {
      if (!v) return undefined;
      if (typeof v === 'string') return v.slice(0, 10);
      if (typeof v === 'object') {
        const o = v as { _seconds?: number; seconds?: number; toDate?: () => Date };
        if (typeof o.toDate === 'function') return o.toDate().toISOString().slice(0, 10);
        const secs = o._seconds ?? o.seconds;
        if (typeof secs === 'number') return new Date(secs * 1000).toISOString().slice(0, 10);
      }
      return undefined;
    };

    const [hrSnap, legalSnap] = await Promise.all([
      db.collection(`companies/${companyId}/contracts`).limit(200).get().catch(() => null),
      db.collection(`companies/${companyId}/legalContracts`).limit(200).get().catch(() => null),
    ]);

    const all: Array<{
      id: string; source: 'hr' | 'legal'; type?: string; contractType?: string;
      partyName?: string; jobTitle?: string; startDate?: string; endDate?: string;
      status?: string; baseSalary?: number; currency?: string;
    }> = [];

    // HR employment contracts — fetch employee names from the contract data or related employee
    for (const d of hrSnap?.docs ?? []) {
      const data = d.data();
      let partyName = (data['employeeName'] as string) ?? '';
      if (!partyName && data['employeeId']) {
        const empDoc = await db.collection(`companies/${companyId}/employees`).doc(data['employeeId'] as string).get().catch(() => null);
        partyName = (empDoc?.data()?.['displayName'] as string) ?? '';
      }
      all.push({
        id: d.id, source: 'hr',
        type: 'employment',
        contractType: data['contractType'] as string | undefined,
        partyName,
        jobTitle: data['jobTitle'] as string | undefined,
        startDate: dateStr(data['startDate']),
        endDate: dateStr(data['endDate']),
        status: (data['status'] as string) ?? 'active',
        baseSalary: data['baseSalary'] as number | undefined,
        currency: data['currency'] as string | undefined,
      });
    }

    // Legal contracts (commercial, NDA, partnership, etc.)
    for (const d of legalSnap?.docs ?? []) {
      const data = d.data();
      all.push({
        id: d.id, source: 'legal',
        type: data['type'] as string | undefined,
        contractType: data['contractType'] as string | undefined,
        partyName: (data['partyName'] as string) ?? (data['client'] as string),
        startDate: dateStr(data['startDate']),
        endDate: dateStr(data['endDate'] ?? data['expiryDate']),
        status: data['status'] as string | undefined,
      });
    }

    // Filter by search query (name, type, jobTitle)
    const matches = q
      ? all.filter(c => `${c.partyName ?? ''} ${c.jobTitle ?? ''} ${c.type ?? ''} ${c.contractType ?? ''}`.toLowerCase().includes(q))
      : all;

    return { contracts: matches, total: matches.length };
  }
);

const ALL_TOOLS = [
  analyzeContractTool, generateContractTool, compareContractsTool,
  getAllCompanyContractsTool,
  createCaseTool, getCasesTool,
  getDeadlinesTool, createDeadlineTool,
  checkComplianceTool, getClausesTool, getStatsTool,
  sendForSignatureTool, emailContractForSignatureTool, markSignedTool,
  // PRO
  contractRiskScoringTool, caseTimelineTool, contractTemplatesTool, legalAutomationTool,
];

const INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string().optional(),
  language: z.string().optional().default('auto'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});
const OUTPUT = z.object({ response: z.string(), requiresLawyer: z.boolean(), urgentDeadlines: z.number() });

export const legalAgentFlow = ai.defineFlow(
  { name: 'legalAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    logger.info(`[LegalAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;

    // Date anchor — for compliance deadlines, contract expiries, etc.
    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    const executors = new Map<string, (i: unknown) => Promise<unknown>>();
    for (const tool of ALL_TOOLS) {
      const name = (tool as unknown as { __action: { name: string } }).__action?.name ?? '';
      if (name) executors.set(name, (i: unknown) => (tool as (args: unknown) => Promise<unknown>)({ ...(i as Record<string, unknown>), companyId }));
    }

    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) {
        messages.push({ role: h.role, content: [{ text: h.content }] });
      }
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_FLASH,
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
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [...response.messages, { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
        tools: ALL_TOOLS, config: { temperature: 0.2 },
      });
    }

    const text = response.text;
    return { response: text, requiresLawyer: /avocat|lawyer|professionnel|high.*risk|critical/i.test(text), urgentDeadlines: 0 };
  }
);

export const legalAgentTool = ai.defineTool(
  {
    name: 'callLegalAgent',
    description: 'Legal PRO: contract risk scoring IA, case timeline, templates AI (NDA/emploi/service), deadline alerts, compliance RGPD, clause library, cross-agent automation (breach → RGPD, contrats → renouvellement).',
    inputSchema: INPUT, outputSchema: OUTPUT,
  },
  (input) => legalAgentFlow(input)
);
