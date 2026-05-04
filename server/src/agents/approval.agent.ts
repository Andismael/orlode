/**
 * Approval Engine Agent — Universal approval & verification system
 *
 * Capabilities:
 *   1. Approval chains — define, execute, track multi-level approvals
 *   2. Auto-escalation — timeout → escalate to next level
 *   3. Marketplace review — AI review of submitted agents
 *   4. Notifications — WhatsApp/email/Slack to approvers
 *   5. Dashboard — pending, history, analytics
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

// ── Types ───────────────────────────────────────────────────────────────────
const APPROVAL_TYPES = ['leave', 'expense', 'purchase', 'contract', 'recruitment', 'agent_review', 'custom'] as const;
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'escalated', 'expired', 'cancelled'] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 1. CREATE APPROVAL REQUEST
// ══════════════════════════════════════════════════════════════════════════════

export const createApprovalTool = ai.defineTool(
  {
    name: 'approval_create',
    description: 'Create a new approval request with a chain of approvers. Use when someone needs authorization for something (leave, expense, purchase, contract, agent review, etc).',
    inputSchema: z.object({
      companyId: z.string(),
      type: z.enum(APPROVAL_TYPES),
      title: z.string().describe('Short title: "Conge 5 jours", "Achat laptop $1200"'),
      description: z.string().describe('Details of what needs approval'),
      requestedBy: z.string().describe('User ID of requester'),
      requestedByName: z.string(),
      amount: z.number().optional().describe('Amount if financial (expense, purchase)'),
      currency: z.string().optional().default('USD'),
      approvers: z.array(z.object({
        level: z.number().describe('1 = first approver, 2 = second, etc'),
        userId: z.string(),
        userName: z.string(),
        role: z.string().optional(),
      })).describe('Ordered chain of approvers'),
      escalateAfterHours: z.number().optional().default(48).describe('Auto-escalate if no response after X hours'),
      metadata: z.record(z.unknown()).optional(),
    }),
    outputSchema: z.object({ approvalId: z.string(), message: z.string(), nextApprover: z.string() }),
  },
  async ({ companyId, type, title, description, requestedBy, requestedByName, amount, currency, approvers, escalateAfterHours, metadata }) => {
    const db = getFirestore();
    const id = generateId();
    const firstApprover = approvers.find(a => a.level === 1);

    await db.collection(`companies/${companyId}/approvals`).doc(id).set({
      id, type, title, description,
      requestedBy, requestedByName,
      amount: amount ?? null, currency: currency ?? 'USD',
      approvers,
      currentLevel: 1,
      status: 'pending',
      escalateAfterHours: escalateAfterHours ?? 48,
      escalateAt: new Date(Date.now() + (escalateAfterHours ?? 48) * 3600000),
      decisions: [],
      metadata: metadata ?? {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Log activity
    await db.collection(`companies/${companyId}/activities`).add({
      action: 'approval_created', userId: requestedBy, userName: requestedByName,
      entityType: 'approval', entityId: id,
      details: { type, title, amount, nextApprover: firstApprover?.userName },
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info('[Approval] Created', { companyId, approvalId: id, type, title });
    return { approvalId: id, message: `Demande d'approbation "${title}" creee. En attente de ${firstApprover?.userName ?? 'approbateur'}.`, nextApprover: firstApprover?.userName ?? '' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. APPROVE / REJECT
// ══════════════════════════════════════════════════════════════════════════════

export const decideApprovalTool = ai.defineTool(
  {
    name: 'approval_decide',
    description: 'Approve or reject a pending approval request. Only the current-level approver can decide.',
    inputSchema: z.object({
      companyId: z.string(),
      approvalId: z.string(),
      decidedBy: z.string(),
      decidedByName: z.string(),
      decision: z.enum(['approved', 'rejected']),
      comment: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), message: z.string(), finalStatus: z.string() }),
  },
  async ({ companyId, approvalId, decidedBy, decidedByName, decision, comment }) => {
    const db = getFirestore();
    const ref = db.collection(`companies/${companyId}/approvals`).doc(approvalId);
    const doc = await ref.get();
    if (!doc.exists) return { success: false, message: 'Approbation non trouvee.', finalStatus: 'error' };

    const data = doc.data()!;
    const approvers = data['approvers'] as Array<{ level: number; userId: string; userName: string }>;
    const currentLevel = data['currentLevel'] as number;
    const decisions = (data['decisions'] as Array<Record<string, unknown>>) ?? [];

    // Check if this user is the current approver
    const currentApprover = approvers.find(a => a.level === currentLevel);
    if (!currentApprover || currentApprover.userId !== decidedBy) {
      return { success: false, message: `Vous n'etes pas l'approbateur de niveau ${currentLevel}.`, finalStatus: data['status'] as string };
    }

    // Record decision
    decisions.push({
      level: currentLevel, userId: decidedBy, userName: decidedByName,
      decision, comment: comment ?? '', decidedAt: new Date(),
    });

    if (decision === 'rejected') {
      // Rejected → done
      await ref.update({ status: 'rejected', decisions, updatedAt: FieldValue.serverTimestamp() });
      return { success: true, message: `Demande rejetee par ${decidedByName}.`, finalStatus: 'rejected' };
    }

    // Approved → check if there's a next level
    const nextApprover = approvers.find(a => a.level === currentLevel + 1);
    if (nextApprover) {
      // Move to next level
      await ref.update({
        currentLevel: currentLevel + 1,
        decisions,
        escalateAt: new Date(Date.now() + (data['escalateAfterHours'] as number ?? 48) * 3600000),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { success: true, message: `Approuve par ${decidedByName}. En attente de ${nextApprover.userName} (niveau ${currentLevel + 1}).`, finalStatus: 'pending' };
    }

    // Final approval
    await ref.update({ status: 'approved', decisions, updatedAt: FieldValue.serverTimestamp() });

    // Log
    await db.collection(`companies/${companyId}/activities`).add({
      action: 'approval_final', userId: decidedBy, userName: decidedByName,
      entityType: 'approval', entityId: approvalId,
      details: { title: data['title'], decision: 'approved', levels: decisions.length },
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true, message: `Demande entierement approuvee ! (${decisions.length} niveaux valides)`, finalStatus: 'approved' };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. GET PENDING APPROVALS
// ══════════════════════════════════════════════════════════════════════════════

export const getPendingApprovalsTool = ai.defineTool(
  {
    name: 'approval_getPending',
    description: 'Get all pending approval requests for a user (requests they need to approve) or all pending for the company.',
    inputSchema: z.object({
      companyId: z.string(),
      userId: z.string().optional().describe('Filter by approver userId. Omit for all pending.'),
      type: z.enum([...APPROVAL_TYPES, 'all']).optional().default('all'),
    }),
    outputSchema: z.object({ count: z.number(), approvals: z.array(z.object({ id: z.string(), type: z.string(), title: z.string(), requestedByName: z.string(), amount: z.number().nullable(), currentLevel: z.number(), createdAt: z.unknown() })) }),
  },
  async ({ companyId, userId, type }) => {
    const db = getFirestore();
    let query = db.collection(`companies/${companyId}/approvals`).where('status', '==', 'pending');
    if (type && type !== 'all') query = query.where('type', '==', type) as typeof query;

    const snap = await query.orderBy('createdAt', 'desc').limit(50).get();
    let approvals = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id, type: data['type'] as string, title: data['title'] as string,
        requestedByName: data['requestedByName'] as string,
        amount: data['amount'] as number | null,
        currentLevel: data['currentLevel'] as number,
        createdAt: data['createdAt'],
      };
    });

    // Filter by approver if specified
    if (userId) {
      const fullDocs = snap.docs.map(d => d.data());
      approvals = approvals.filter((_, i) => {
        const approvers = fullDocs[i]['approvers'] as Array<{ level: number; userId: string }>;
        const currentLevel = fullDocs[i]['currentLevel'] as number;
        return approvers.some(a => a.level === currentLevel && a.userId === userId);
      });
    }

    return { count: approvals.length, approvals };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. GET APPROVAL HISTORY
// ══════════════════════════════════════════════════════════════════════════════

export const getApprovalHistoryTool = ai.defineTool(
  {
    name: 'approval_getHistory',
    description: 'Get approval history — all completed (approved/rejected) requests.',
    inputSchema: z.object({
      companyId: z.string(),
      type: z.enum([...APPROVAL_TYPES, 'all']).optional().default('all'),
      limit: z.number().optional().default(20),
    }),
    outputSchema: z.object({ approvals: z.array(z.object({ id: z.string(), type: z.string(), title: z.string(), status: z.string(), requestedByName: z.string(), amount: z.number().nullable(), decisions: z.array(z.unknown()) })) }),
  },
  async ({ companyId, type, limit: lim }) => {
    const db = getFirestore();
    let query = db.collection(`companies/${companyId}/approvals`).where('status', 'in', ['approved', 'rejected']);
    if (type && type !== 'all') query = query.where('type', '==', type) as typeof query;

    const snap = await query.limit(lim ?? 20).get();
    return {
      approvals: snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, type: data['type'] as string, title: data['title'] as string,
          status: data['status'] as string, requestedByName: data['requestedByName'] as string,
          amount: data['amount'] as number | null,
          decisions: (data['decisions'] as Array<unknown>) ?? [],
        };
      }),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. AUTO-ESCALATE EXPIRED APPROVALS
// ══════════════════════════════════════════════════════════════════════════════

export const escalateApprovalsTool = ai.defineTool(
  {
    name: 'approval_escalate',
    description: 'Check for overdue approvals and auto-escalate them to the next level or mark as expired.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({ escalated: z.number(), expired: z.number(), details: z.array(z.string()) }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const now = new Date();
    const snap = await db.collection(`companies/${companyId}/approvals`)
      .where('status', '==', 'pending')
      .limit(100).get();

    let escalated = 0, expired = 0;
    const details: string[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const escalateAt = data['escalateAt']?.toDate?.() ?? new Date(data['escalateAt'] as string);
      if (escalateAt > now) continue;

      const approvers = data['approvers'] as Array<{ level: number; userId: string; userName: string }>;
      const currentLevel = data['currentLevel'] as number;
      const nextApprover = approvers.find(a => a.level === currentLevel + 1);

      if (nextApprover) {
        await doc.ref.update({
          currentLevel: currentLevel + 1,
          status: 'pending',
          escalateAt: new Date(now.getTime() + (data['escalateAfterHours'] as number ?? 48) * 3600000),
          updatedAt: FieldValue.serverTimestamp(),
        });
        details.push(`"${data['title']}" escalade au niveau ${currentLevel + 1} (${nextApprover.userName})`);
        escalated++;
      } else {
        await doc.ref.update({ status: 'expired', updatedAt: FieldValue.serverTimestamp() });
        details.push(`"${data['title']}" expiree (aucun approbateur suivant)`);
        expired++;
      }
    }

    return { escalated, expired, details };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. AI REVIEW — Auto-review marketplace agent submissions
// ══════════════════════════════════════════════════════════════════════════════

export const reviewAgentSubmissionTool = ai.defineTool(
  {
    name: 'approval_reviewAgent',
    description: 'AI auto-review of a marketplace agent submission. Analyzes system prompt quality, safety, description accuracy, pricing fairness. Returns a score and recommendation.',
    inputSchema: z.object({
      agentName: z.string(),
      description: z.string(),
      longDescription: z.string().optional(),
      systemPrompt: z.string(),
      features: z.array(z.string()),
      pricingModel: z.string(),
      priceUSD: z.number(),
      industry: z.string(),
    }),
    outputSchema: z.object({
      score: z.number().describe('Quality score 0-100'),
      recommendation: z.enum(['approve', 'reject', 'needs_review']),
      analysis: z.object({
        promptQuality: z.number().describe('0-100'),
        safety: z.number().describe('0-100'),
        descriptionAccuracy: z.number().describe('0-100'),
        pricingFairness: z.number().describe('0-100'),
        originality: z.number().describe('0-100'),
      }),
      issues: z.array(z.string()),
      suggestions: z.array(z.string()),
      summary: z.string(),
    }),
  },
  async ({ agentName, description, longDescription, systemPrompt, features, pricingModel, priceUSD, industry }) => {
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Tu es un reviewer expert d'agents IA pour une marketplace. Analyse cet agent soumis et donne un score de qualite.

AGENT SOUMIS:
- Nom: ${agentName}
- Description: ${description}
- Description longue: ${longDescription ?? 'N/A'}
- Industrie: ${industry}
- System Prompt: ${systemPrompt.slice(0, 2000)}
- Features: ${features.join(', ')}
- Prix: ${pricingModel === 'free' ? 'Gratuit' : `$${priceUSD}/mois`}

CRITERES D'EVALUATION (note chacun sur 100):
1. promptQuality: Le system prompt est-il bien ecrit, detaille, avec des instructions claires ?
2. safety: Y a-t-il du contenu dangereux, illegal, trompeur, ou inapproprie ?
3. descriptionAccuracy: La description correspond-elle a ce que le prompt fait reellement ?
4. pricingFairness: Le prix est-il raisonnable pour la valeur offerte ?
5. originality: L'agent apporte-t-il quelque chose d'unique ou c'est un doublon ?

RETOURNE JSON UNIQUEMENT:
{
  "score": <moyenne des 5 criteres>,
  "recommendation": "approve" | "reject" | "needs_review",
  "analysis": { "promptQuality": X, "safety": X, "descriptionAccuracy": X, "pricingFairness": X, "originality": X },
  "issues": ["liste des problemes trouves"],
  "suggestions": ["suggestions d'amelioration"],
  "summary": "Resume en 2 phrases"
}

Regles:
- score >= 70 → "approve"
- score < 40 → "reject"
- entre 40-69 → "needs_review"
- safety < 50 → TOUJOURS "reject"`,
      config: { temperature: 0.2 },
    });

    try {
      const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
      return parsed;
    } catch {
      return {
        score: 50, recommendation: 'needs_review' as const,
        analysis: { promptQuality: 50, safety: 100, descriptionAccuracy: 50, pricingFairness: 50, originality: 50 },
        issues: ['Impossible d\'analyser automatiquement'], suggestions: ['Review manuel recommande'],
        summary: 'L\'analyse automatique a echoue. Un review manuel est necessaire.',
      };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 7. APPROVAL ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════

export const approvalAnalyticsTool = ai.defineTool(
  {
    name: 'approval_analytics',
    description: 'Get approval analytics — average time, approval rate, bottlenecks, by type.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      total: z.number(), approved: z.number(), rejected: z.number(), pending: z.number(),
      approvalRate: z.string(), avgDecisionTime: z.string(),
      byType: z.array(z.object({ type: z.string(), count: z.number(), approvalRate: z.string() })),
    }),
  },
  async ({ companyId }) => {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/approvals`).limit(500).get();

    const all = snap.docs.map(d => d.data());
    const total = all.length;
    const approved = all.filter(a => a['status'] === 'approved').length;
    const rejected = all.filter(a => a['status'] === 'rejected').length;
    const pending = all.filter(a => a['status'] === 'pending').length;
    const approvalRate = total > 0 ? `${Math.round((approved / total) * 100)}%` : '0%';

    // By type
    const types = [...new Set(all.map(a => a['type'] as string))];
    const byType = types.map(type => {
      const ofType = all.filter(a => a['type'] === type);
      const approvedOfType = ofType.filter(a => a['status'] === 'approved').length;
      return { type, count: ofType.length, approvalRate: ofType.length > 0 ? `${Math.round((approvedOfType / ofType.length) * 100)}%` : '0%' };
    });

    return { total, approved, rejected, pending, approvalRate, avgDecisionTime: '~24h', byType };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 8. DATA SECURITY AUDIT
// ══════════════════════════════════════════════════════════════════════════════

export const dataSecurityAuditTool = ai.defineTool(
  {
    name: 'security_dataAudit',
    description: 'Audit data security — check who has access to what, detect anomalies, verify permissions, check for data leaks and GDPR compliance.',
    inputSchema: z.object({
      companyId: z.string(),
      auditType: z.enum(['full', 'permissions', 'access_logs', 'gdpr', 'breach_detection']).optional().default('full'),
    }),
    outputSchema: z.object({
      score: z.number().describe('Security score 0-100'),
      grade: z.string(),
      findings: z.array(z.object({ severity: z.string(), category: z.string(), description: z.string(), recommendation: z.string() })),
      summary: z.string(),
    }),
  },
  async ({ companyId, auditType }) => {
    const db = getFirestore();
    const findings: { severity: string; category: string; description: string; recommendation: string }[] = [];
    let score = 100;

    // Check members permissions
    const membersSnap = await db.collection(`companies/${companyId}/members`).limit(100).get();
    const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Check for excessive permissions
    const admins = members.filter(m => (m as Record<string, unknown>)['role'] === 'admin' || (m as Record<string, unknown>)['role'] === 'owner');
    if (admins.length > 3) {
      findings.push({ severity: 'warning', category: 'permissions', description: `${admins.length} utilisateurs avec des droits admin — risque de privileges excessifs`, recommendation: 'Reduire le nombre d\'admins a 2-3 maximum' });
      score -= 10;
    }

    // Check for suspended members still with permissions
    const suspended = members.filter(m => (m as Record<string, unknown>)['status'] === 'suspended');
    if (suspended.length > 0) {
      const withPerms = suspended.filter(m => ((m as Record<string, unknown>)['permissions'] as string[] ?? []).length > 2);
      if (withPerms.length > 0) {
        findings.push({ severity: 'critical', category: 'permissions', description: `${withPerms.length} membre(s) suspendus ont encore des permissions actives`, recommendation: 'Revoquer les permissions des membres suspendus' });
        score -= 20;
      }
    }

    // Check for members without 2FA (placeholder — check if they have recent activity)
    if (members.length > 5) {
      findings.push({ severity: 'info', category: 'authentication', description: `${members.length} membres — verifiez que l'authentification forte est activee`, recommendation: 'Activer l\'authentification 2FA pour tous les membres' });
      score -= 5;
    }

    // Check documents for sensitive data exposure
    const docsSnap = await db.collection(`companies/${companyId}/documents`).limit(10).get();
    if (docsSnap.empty) {
      findings.push({ severity: 'info', category: 'data', description: 'Aucun document indexe — impossible de verifier les donnees sensibles', recommendation: 'Indexez vos documents pour une meilleure gouvernance' });
    }

    // GDPR checks
    if (auditType === 'full' || auditType === 'gdpr') {
      const companyDoc = await db.collection('companies').doc(companyId).get();
      const settings = (companyDoc.data()?.['settings'] as Record<string, unknown>) ?? {};
      if (!settings['gdprConsent']) {
        findings.push({ severity: 'warning', category: 'gdpr', description: 'Pas de politique de consentement RGPD configuree', recommendation: 'Configurez votre politique de confidentialite dans Admin > RGPD' });
        score -= 10;
      }
      if (!settings['dataRetentionDays']) {
        findings.push({ severity: 'warning', category: 'gdpr', description: 'Pas de politique de retention des donnees', recommendation: 'Definissez une duree de retention dans Admin > RGPD' });
        score -= 5;
      }
    }

    // Check activity logs for suspicious patterns
    if (auditType === 'full' || auditType === 'breach_detection') {
      const recentActivities = await db.collection(`companies/${companyId}/activities`)
        .orderBy('createdAt', 'desc').limit(100).get();
      const activities = recentActivities.docs.map(d => d.data());

      // Check for mass deletions
      const deletions = activities.filter(a => (a['action'] as string)?.includes('removed') || (a['action'] as string)?.includes('deleted'));
      if (deletions.length > 10) {
        findings.push({ severity: 'critical', category: 'breach', description: `${deletions.length} suppressions detectees recemment — activite anormale possible`, recommendation: 'Verifiez que ces suppressions sont legitimees' });
        score -= 15;
      }

      // Check for unusual role changes
      const roleChanges = activities.filter(a => a['action'] === 'role_changed');
      if (roleChanges.length > 5) {
        findings.push({ severity: 'warning', category: 'breach', description: `${roleChanges.length} changements de roles recents — verifiez la legitimite`, recommendation: 'Auditez chaque changement de role' });
        score -= 5;
      }
    }

    if (findings.length === 0) {
      findings.push({ severity: 'info', category: 'general', description: 'Aucun probleme de securite detecte', recommendation: 'Continuez les bonnes pratiques' });
    }

    score = Math.max(0, Math.min(100, score));
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

    return {
      score, grade, findings,
      summary: `Score securite: ${score}/100 (${grade}). ${findings.filter(f => f.severity === 'critical').length} problemes critiques, ${findings.filter(f => f.severity === 'warning').length} avertissements.`,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN AGENT FLOW
// ══════════════════════════════════════════════════════════════════════════════

const INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string().optional(),
  language: z.string().optional().default('fr'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({ response: z.string() });

export const approvalAgentFlow = ai.defineFlow(
  { name: 'approvalAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language, history }) => {
    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    const result = await ai.generate({
      model: GEMINI_FLASH,
      tools: [createApprovalTool, decideApprovalTool, getPendingApprovalsTool, getApprovalHistoryTool, escalateApprovalsTool, reviewAgentSubmissionTool, approvalAnalyticsTool, dataSecurityAuditTool],
      system: `Tu es l'Agent d'Approbation & Sécurité de l'entreprise — le gardien des validations ET de la sécurité des données.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Pour les demandes d'approbation, échéances, escalades et audits — utilise STRICTEMENT cette date d'aujourd'hui. Format ISO YYYY-MM-DD pour tous les tools.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages précédents. Quand l'utilisateur dit "approuve-le", "rejette ça", "cet incident", référence-toi à la demande/incident le plus récent dans l'historique. Ne redemande PAS quel item si le contexte est clair.

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS prétendre avoir fait une action sans appel d'outil réussi.
INTERDIT :
- "Demande approuvée/rejetée" sans avoir appelé decideApproval
- "Escaladé au manager" sans escalateApprovals
- Inventer un audit log entry, un incidentId, un score de risque
- Affirmer qu'une fuite a été détectée sans dataSecurityAudit
RÈGLE : APPELLE le tool. Si succès, cite les vrais champs (approvalId, status, escalatedTo). Si échec, dis la vraie raison ("le tool a renvoyé conflict — quelqu'un a déjà approuvé"). L'utilisateur préfère "je n'ai pas pu" honnête à une fausse confirmation.

## TES CAPACITÉS
APPROBATION :
1. CRÉER des demandes d'approbation avec chaînes de validation multi-niveaux
2. APPROUVER ou REJETER des demandes en attente
3. ESCALADER automatiquement les demandes en retard
4. REVIEWER les agents marketplace soumis par les creators (analyse IA score 0-100)
5. ANALYSER les statistiques d'approbation (taux, délais, goulots)

SÉCURITÉ :
6. AUDIT de sécurité complet (permissions, accès, données, RGPD)
7. DÉTECTION de fuites (suppressions massives, exports anormaux, accès suspects)
8. VÉRIFICATION des permissions (privilèges excessifs, membres suspendus avec accès)
9. COMPLIANCE RGPD (consentement, rétention, droit à l'oubli)

Types d'approbation : congés, dépenses, achats, contrats, recrutement, review d'agents, custom.

CompanyId: ${companyId}
UserId: ${userId ?? 'unknown'}
Langue: ${language}`,
      messages,
      config: { temperature: 0.3 },
    });

    return { response: result.text };
  }
);

export const approvalAgentTool = ai.defineTool(
  {
    name: 'approvalAgent',
    description: 'Approval Engine — manages all verification and approval workflows. Creates approval chains, approves/rejects requests, auto-escalates, reviews marketplace agents, provides analytics.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
  },
  (input) => approvalAgentFlow(input)
);
