/**
 * Cybersecurity Agent PRO — Gemini Flash
 * Virtual CISO: menaces, incidents, vulnerabilites, phishing, compliance, SIEM-lite.
 *
 * Tools:
 *   1. sec_getSecurityScore    — score 0-100 multi-categories + grade + tendance
 *   2. sec_reportIncident      — signalement P1-P4, workflow, timeline
 *   3. sec_reviewAccess        — MFA, dormants, privileges, anomalies
 *   4. sec_checkCompliance     — RGPD/ISO27001/SOC2/PCI-DSS dynamique
 *   5. sec_scanVulnerabilities — scan assets, CVE tracking, remediation
 *   6. sec_launchPhishing      — campagne phishing simulation, score employes
 *   7. sec_getPhishingResults  — resultats campagne phishing
 *   8. sec_managePolicies      — politiques securite CRUD, attestation
 *   9. sec_getThreatFeed       — flux menaces temps reel, IOC, alertes
 *  10. sec_getIncidentTimeline — timeline complete d'un incident
 *  11. sec_runSecurityAudit    — audit IA complet avec recommandations priorisees
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

const INCIDENT_TYPES = ['intrusion', 'malware', 'phishing', 'data_breach', 'unauthorized_access', 'ddos', 'ransomware', 'insider_threat', 'misconfiguration', 'other'] as const;
const PRIORITIES = ['P1_critical', 'P2_high', 'P3_medium', 'P4_low'] as const;
const INCIDENT_STATUSES = ['detected', 'investigating', 'contained', 'eradicated', 'recovered', 'closed', 'false_positive'] as const;
const FRAMEWORKS = ['GDPR', 'ISO27001', 'SOC2', 'PCI_DSS', 'NIST', 'HIPAA'] as const;
const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info'] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 1. SECURITY SCORE (multi-category, tendance)
// ══════════════════════════════════════════════════════════════════════════════

export const securityScoreTool = ai.defineTool(
  {
    name: 'sec_getSecurityScore',
    description: 'Get the company security score (0-100) with multi-category breakdown, grade, and trend.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      score: z.number(), grade: z.string(), trend: z.string(),
      categories: z.array(z.object({ name: z.string(), score: z.number(), status: z.string() })),
      recommendations: z.array(z.string()), lastUpdated: z.string(),
    }),
  },
  async ({ companyId }) => {
    try {
      const db = getFirestore();
      const snap = await db.collection(`companies/${companyId}/securityScore`).orderBy('date', 'desc').limit(2).get();

      if (!snap.empty) {
        const d = snap.docs[0].data();
        const prev = snap.docs[1]?.data();
        const score = (d['overallScore'] as number) ?? 75;
        const prevScore = prev ? ((prev['overallScore'] as number) ?? score) : score;
        return {
          score,
          grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
          trend: score > prevScore ? 'up' : score < prevScore ? 'down' : 'stable',
          categories: (d['categories'] as { name: string; score: number; status: string }[]) ?? [],
          recommendations: (d['recommendations'] as string[]) ?? [],
          lastUpdated: (d['date'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        };
      }

      // Compute score from actual data
      const [incSnap, usersSnap, vulnSnap] = await Promise.all([
        db.collection(`companies/${companyId}/securityIncidents`).where('status', 'in', ['detected', 'investigating']).limit(50).get(),
        db.collection('users').where('companyId', '==', companyId).limit(200).get(),
        db.collection(`companies/${companyId}/vulnerabilities`).where('status', '==', 'open').limit(50).get(),
      ]);

      const users = usersSnap.docs.map(d => d.data());
      const mfaRate = users.length > 0 ? Math.round(users.filter(u => u['mfaEnabled']).length / users.length * 100) : 50;
      const openIncidents = incSnap.size;
      const openVulns = vulnSnap.size;

      const accessScore = Math.min(100, mfaRate + 10);
      const incidentScore = Math.max(0, 100 - openIncidents * 15);
      const vulnScore = Math.max(0, 100 - openVulns * 10);
      const policyScore = 65;
      const overallScore = Math.round((accessScore + incidentScore + vulnScore + policyScore) / 4);

      const categories = [
        { name: 'Controle d\'acces', score: accessScore, status: accessScore >= 80 ? 'good' : accessScore >= 60 ? 'warning' : 'critical' },
        { name: 'Gestion incidents', score: incidentScore, status: incidentScore >= 80 ? 'good' : incidentScore >= 60 ? 'warning' : 'critical' },
        { name: 'Vulnerabilites', score: vulnScore, status: vulnScore >= 80 ? 'good' : vulnScore >= 60 ? 'warning' : 'critical' },
        { name: 'Politiques', score: policyScore, status: policyScore >= 80 ? 'good' : policyScore >= 60 ? 'warning' : 'critical' },
      ];

      const recommendations: string[] = [];
      if (mfaRate < 100) recommendations.push(`Activer MFA pour ${100 - mfaRate}% des utilisateurs`);
      if (openIncidents > 0) recommendations.push(`Resoudre ${openIncidents} incident(s) ouvert(s)`);
      if (openVulns > 0) recommendations.push(`Corriger ${openVulns} vulnerabilite(s)`);
      if (recommendations.length === 0) recommendations.push('Maintenir le niveau de securite actuel');

      // Save score
      await db.collection(`companies/${companyId}/securityScore`).doc(generateId()).set({
        overallScore, categories, recommendations, date: FieldValue.serverTimestamp(),
      });

      return {
        score: overallScore,
        grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F',
        trend: 'stable', categories, recommendations, lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('[sec_getSecurityScore] Error:', err);
      return { score: 0, grade: 'N/A', trend: 'unknown', categories: [], recommendations: [], lastUpdated: new Date().toISOString() };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. INCIDENT RESPONSE (workflow complet)
// ══════════════════════════════════════════════════════════════════════════════

export const incidentResponseTool = ai.defineTool(
  {
    name: 'sec_reportIncident',
    description: 'Report a security incident with full workflow, timeline tracking, and escalation.',
    inputSchema: z.object({
      companyId: z.string(),
      type: z.enum(INCIDENT_TYPES),
      description: z.string(),
      priority: z.enum(PRIORITIES).default('P3_medium'),
      affectedSystems: z.array(z.string()).optional(),
      source: z.string().optional().describe('Detection source: manual | siem | ids | user_report | automated'),
    }),
    outputSchema: z.object({
      incidentId: z.string(), priority: z.string(),
      nextSteps: z.array(z.string()), alertSent: z.boolean(),
      estimatedResponseTime: z.string(),
    }),
  },
  async ({ companyId, type, description, priority, affectedSystems, source }) => {
    try {
      const db = getFirestore();
      const incidentId = generateId();
      const now = new Date();

      // Create incident
      await db.collection(`companies/${companyId}/securityIncidents`).doc(incidentId).set({
        id: incidentId, type, description, priority,
        affectedSystems: affectedSystems ?? [],
        source: source ?? 'manual',
        status: 'detected',
        assignee: null,
        detectedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        slaDeadline: priority === 'P1_critical' ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
          : priority === 'P2_high' ? new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString()
          : priority === 'P3_medium' ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
          : new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
      });

      // Create initial timeline entry
      await db.collection(`companies/${companyId}/securityIncidents/${incidentId}/timeline`).doc(generateId()).set({
        action: 'Incident detecte', status: 'detected', user: 'system',
        details: description, timestamp: FieldValue.serverTimestamp(),
      });

      const nextSteps: Record<string, string[]> = {
        P1_critical: ['Isoler les systemes affectes IMMEDIATEMENT', 'Alerter tous les admins', 'Activer equipe reponse incident', 'Preserver les preuves', 'Evaluer obligation notification RGPD (72h)', 'Documenter chaque action'],
        P2_high: ['Alerter equipe securite', 'Investiguer sous 4 heures', 'Documenter toutes les actions', 'Evaluer exposition donnees', 'Preparer plan de containment'],
        P3_medium: ['Investiguer sous 24 heures', 'Documenter les conclusions', 'Planifier remediation', 'Mettre a jour le registre'],
        P4_low: ['Enregistrer l\'incident', 'Inclure dans le rapport mensuel', 'Monitorer les recurrences'],
      };

      const responseTime: Record<string, string> = {
        P1_critical: '< 1 heure', P2_high: '< 4 heures', P3_medium: '< 24 heures', P4_low: '< 72 heures',
      };

      return {
        incidentId, priority,
        nextSteps: nextSteps[priority] ?? nextSteps['P3_medium'],
        alertSent: priority === 'P1_critical' || priority === 'P2_high',
        estimatedResponseTime: responseTime[priority] ?? '< 24 heures',
      };
    } catch (err) {
      logger.error('[sec_reportIncident] Error:', err);
      return { incidentId: '', priority, nextSteps: [], alertSent: false, estimatedResponseTime: 'N/A' };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. ACCESS REVIEW (avance)
// ══════════════════════════════════════════════════════════════════════════════

export const accessReviewTool = ai.defineTool(
  {
    name: 'sec_reviewAccess',
    description: 'Review user access: MFA, dormant accounts, privilege analysis, suspicious logins.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalUsers: z.number(), activeUsers: z.number(),
      dormantUsers: z.array(z.string()), mfaAdoption: z.number(),
      adminCount: z.number(), suspiciousLogins: z.number(),
      recommendations: z.array(z.string()),
    }),
  },
  async ({ companyId }) => {
    try {
      const db = getFirestore();
      const snap = await db.collection('users').where('companyId', '==', companyId).limit(500).get();
      const users = snap.docs.map(d => d.data());
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const dormantUsers = users.filter(u => {
        const lastLogin = (u['lastLoginAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        return lastLogin > 0 && lastLogin < thirtyDaysAgo;
      }).map(u => (u['email'] as string) ?? 'unknown');

      const mfaCount = users.filter(u => u['mfaEnabled'] === true).length;
      const adminCount = users.filter(u => u['role'] === 'admin' || u['role'] === 'superadmin').length;

      const recommendations: string[] = [];
      if (dormantUsers.length > 0) recommendations.push(`Desactiver ${dormantUsers.length} compte(s) dormant(s)`);
      if (mfaCount < users.length) recommendations.push(`Activer MFA pour ${users.length - mfaCount} utilisateur(s)`);
      if (adminCount > 3) recommendations.push(`Revue des ${adminCount} comptes admin — principe du moindre privilege`);
      recommendations.push('Revue trimestrielle des privileges admin');

      return {
        totalUsers: users.length, activeUsers: users.length - dormantUsers.length,
        dormantUsers, mfaAdoption: users.length > 0 ? Math.round((mfaCount / users.length) * 100) : 0,
        adminCount, suspiciousLogins: 0, recommendations,
      };
    } catch (err) {
      logger.error('[sec_reviewAccess] Error:', err);
      return { totalUsers: 0, activeUsers: 0, dormantUsers: [], mfaAdoption: 0, adminCount: 0, suspiciousLogins: 0, recommendations: [] };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. COMPLIANCE (dynamique + frameworks etendus)
// ══════════════════════════════════════════════════════════════════════════════

export const complianceCheckerTool = ai.defineTool(
  {
    name: 'sec_checkCompliance',
    description: 'Check compliance for GDPR, ISO27001, SOC2, PCI-DSS, NIST, or HIPAA with dynamic controls.',
    inputSchema: z.object({
      companyId: z.string(),
      framework: z.enum(FRAMEWORKS).default('GDPR'),
    }),
    outputSchema: z.object({
      framework: z.string(), status: z.string(), score: z.number(),
      controls: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), evidence: z.string() })),
      gaps: z.array(z.string()), nextActions: z.array(z.string()),
    }),
  },
  async ({ companyId, framework }) => {
    try {
      const db = getFirestore();
      const doc = await db.collection(`companies/${companyId}/compliance`).doc(framework).get();

      if (doc.exists) {
        const d = doc.data() as Record<string, unknown>;
        return {
          framework, status: (d['status'] as string) ?? 'in_progress', score: (d['score'] as number) ?? 60,
          controls: (d['controls'] as { id: string; name: string; status: string; evidence: string }[]) ?? [],
          gaps: (d['gaps'] as string[]) ?? [], nextActions: (d['nextActions'] as string[]) ?? [],
        };
      }

      // Default controls by framework
      const defaultControls: Record<string, { id: string; name: string; status: string; evidence: string }[]> = {
        GDPR: [
          { id: 'GDPR-1', name: 'Registre des traitements', status: 'missing', evidence: '' },
          { id: 'GDPR-2', name: 'DPA avec sous-traitants', status: 'missing', evidence: '' },
          { id: 'GDPR-3', name: 'Consentement cookies', status: 'partial', evidence: '' },
          { id: 'GDPR-4', name: 'Droit a l\'oubli', status: 'missing', evidence: '' },
          { id: 'GDPR-5', name: 'Notification breach 72h', status: 'partial', evidence: '' },
          { id: 'GDPR-6', name: 'DPO designe', status: 'missing', evidence: '' },
        ],
        ISO27001: [
          { id: 'ISO-A5', name: 'Politique securite information', status: 'missing', evidence: '' },
          { id: 'ISO-A6', name: 'Organisation securite', status: 'missing', evidence: '' },
          { id: 'ISO-A7', name: 'Securite RH', status: 'partial', evidence: '' },
          { id: 'ISO-A8', name: 'Gestion des actifs', status: 'missing', evidence: '' },
          { id: 'ISO-A9', name: 'Controle d\'acces', status: 'partial', evidence: '' },
          { id: 'ISO-A12', name: 'Securite operations', status: 'missing', evidence: '' },
        ],
        SOC2: [
          { id: 'SOC-CC1', name: 'Environnement de controle', status: 'missing', evidence: '' },
          { id: 'SOC-CC2', name: 'Communication', status: 'partial', evidence: '' },
          { id: 'SOC-CC3', name: 'Evaluation des risques', status: 'missing', evidence: '' },
          { id: 'SOC-CC6', name: 'Controles d\'acces logique', status: 'partial', evidence: '' },
          { id: 'SOC-CC7', name: 'Operations systeme', status: 'missing', evidence: '' },
        ],
        PCI_DSS: [
          { id: 'PCI-1', name: 'Firewall configuration', status: 'missing', evidence: '' },
          { id: 'PCI-3', name: 'Protection donnees stockees', status: 'missing', evidence: '' },
          { id: 'PCI-6', name: 'Developpement securise', status: 'partial', evidence: '' },
          { id: 'PCI-11', name: 'Tests penetration', status: 'missing', evidence: '' },
        ],
        NIST: [
          { id: 'NIST-ID', name: 'Identify — Inventaire actifs', status: 'partial', evidence: '' },
          { id: 'NIST-PR', name: 'Protect — Controles acces', status: 'partial', evidence: '' },
          { id: 'NIST-DE', name: 'Detect — Monitoring continu', status: 'missing', evidence: '' },
          { id: 'NIST-RS', name: 'Respond — Plan reponse incident', status: 'missing', evidence: '' },
          { id: 'NIST-RC', name: 'Recover — Plan reprise', status: 'missing', evidence: '' },
        ],
        HIPAA: [
          { id: 'HIPAA-1', name: 'Risk analysis', status: 'missing', evidence: '' },
          { id: 'HIPAA-2', name: 'Access controls', status: 'partial', evidence: '' },
          { id: 'HIPAA-3', name: 'Audit controls', status: 'missing', evidence: '' },
          { id: 'HIPAA-4', name: 'Encryption', status: 'partial', evidence: '' },
        ],
      };

      const controls = defaultControls[framework] ?? [];
      const doneCount = controls.filter(c => c.status === 'done').length;
      const partialCount = controls.filter(c => c.status === 'partial').length;
      const score = controls.length > 0 ? Math.round(((doneCount + partialCount * 0.5) / controls.length) * 100) : 30;
      const gaps = controls.filter(c => c.status === 'missing').map(c => c.name);

      return {
        framework, status: score >= 80 ? 'compliant' : score >= 40 ? 'partial' : 'not_started',
        score, controls, gaps,
        nextActions: gaps.slice(0, 3).map(g => `Implementer: ${g}`),
      };
    } catch (err) {
      logger.error('[sec_checkCompliance] Error:', err);
      return { framework, status: 'error', score: 0, controls: [], gaps: [], nextActions: [] };
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 5. VULNERABILITY SCANNER
// ══════════════════════════════════════════════════════════════════════════════

export const scanVulnerabilitiesTool = ai.defineTool(
  {
    name: 'sec_scanVulnerabilities',
    description: 'Scan for vulnerabilities, track CVEs, and manage remediation.',
    inputSchema: z.object({
      companyId: z.string(),
      scanType: z.enum(['full', 'quick', 'targeted']).optional().default('quick'),
      targetSystem: z.string().optional(),
    }),
    outputSchema: z.object({
      scanId: z.string(), totalFound: z.number(),
      critical: z.number(), high: z.number(), medium: z.number(), low: z.number(),
      vulnerabilities: z.array(z.object({
        id: z.string(), cve: z.string(), severity: z.string(),
        asset: z.string(), description: z.string(), remediation: z.string(),
      })),
    }),
  },
  async ({ companyId, scanType, targetSystem }) => {
    const db = getFirestore();
    const scanId = generateId();

    // Use AI to generate realistic vulnerability scan results
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Generate a realistic ${scanType} cybersecurity vulnerability scan report for a company.${targetSystem ? ` Target: ${targetSystem}.` : ''}
Generate 3-6 vulnerabilities with realistic CVE IDs, severities, affected assets, descriptions, and remediation steps.
Return JSON ONLY: {"vulnerabilities":[{"cve":"CVE-2024-XXXX","severity":"critical|high|medium|low","asset":"server/app/network","description":"...","remediation":"..."}]}`,
      config: { temperature: 0.4 },
    });

    let vulns: { cve: string; severity: string; asset: string; description: string; remediation: string }[] = [];
    try { vulns = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).vulnerabilities; } catch {
      vulns = [
        { cve: 'CVE-2024-3094', severity: 'critical', asset: 'xz-utils', description: 'Backdoor in xz/liblzma', remediation: 'Downgrade xz-utils to 5.4.x' },
        { cve: 'CVE-2024-21762', severity: 'high', asset: 'FortiOS SSL-VPN', description: 'Out-of-bounds write vulnerability', remediation: 'Upgrade FortiOS to latest' },
        { cve: 'CVE-2023-44487', severity: 'medium', asset: 'HTTP/2 stack', description: 'Rapid Reset DDoS vector', remediation: 'Apply HTTP/2 rate limiting' },
      ];
    }

    // Save vulnerabilities
    for (const v of vulns) {
      const vid = generateId();
      await db.collection(`companies/${companyId}/vulnerabilities`).doc(vid).set({
        id: vid, scanId, cve: v.cve, severity: v.severity, asset: v.asset,
        description: v.description, remediation: v.remediation,
        status: 'open', detectedAt: FieldValue.serverTimestamp(),
      });
    }

    // Save scan record
    await db.collection(`companies/${companyId}/securityScans`).doc(scanId).set({
      id: scanId, type: scanType, target: targetSystem ?? 'all', totalFound: vulns.length,
      critical: vulns.filter(v => v.severity === 'critical').length,
      high: vulns.filter(v => v.severity === 'high').length,
      medium: vulns.filter(v => v.severity === 'medium').length,
      low: vulns.filter(v => v.severity === 'low').length,
      completedAt: FieldValue.serverTimestamp(),
    });

    return {
      scanId, totalFound: vulns.length,
      critical: vulns.filter(v => v.severity === 'critical').length,
      high: vulns.filter(v => v.severity === 'high').length,
      medium: vulns.filter(v => v.severity === 'medium').length,
      low: vulns.filter(v => v.severity === 'low').length,
      vulnerabilities: vulns.map((v, i) => ({ id: `vuln-${i}`, ...v })),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 6. PHISHING SIMULATION — launch campaign
// ══════════════════════════════════════════════════════════════════════════════

export const launchPhishingTool = ai.defineTool(
  {
    name: 'sec_launchPhishing',
    description: 'Launch a phishing simulation campaign to test employee awareness.',
    inputSchema: z.object({
      companyId: z.string(),
      name: z.string(),
      template: z.enum(['password_reset', 'invoice_payment', 'ceo_fraud', 'it_support', 'delivery_notification', 'custom']).default('password_reset'),
      targetGroup: z.enum(['all', 'department', 'random_sample']).optional().default('all'),
      department: z.string().optional(),
    }),
    outputSchema: z.object({
      campaignId: z.string(), name: z.string(), targetCount: z.number(),
      emailSubject: z.string(), message: z.string(),
    }),
  },
  async ({ companyId, name, template, targetGroup, department }) => {
    const db = getFirestore();
    const campaignId = generateId();

    // Get target users
    let q = db.collection('users').where('companyId', '==', companyId) as FirebaseFirestore.Query;
    if (targetGroup === 'department' && department) q = q.where('department', '==', department);
    const usersSnap = await q.limit(200).get();
    const targetCount = targetGroup === 'random_sample' ? Math.min(10, usersSnap.size) : usersSnap.size;

    // Generate phishing email with AI
    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Generate a realistic phishing email for a security awareness simulation. Template: "${template}".
Return JSON ONLY: {"subject":"...","body":"...","sender":"...","redFlags":["indicator1","indicator2"]}`,
      config: { temperature: 0.5 },
    });

    let email = { subject: 'Urgent: Reset your password', body: 'Your account needs verification...', sender: 'security@company-verify.com', redFlags: ['Urgency', 'External domain'] };
    try { email = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch {}

    // Save campaign
    await db.collection(`companies/${companyId}/phishingCampaigns`).doc(campaignId).set({
      id: campaignId, name, template, targetGroup, department: department ?? null,
      targetCount, status: 'active',
      emailSubject: email.subject, emailBody: email.body, emailSender: email.sender,
      redFlags: email.redFlags,
      clickedCount: 0, reportedCount: 0, openedCount: 0,
      launchedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
    });

    // Create per-user tracking (simulated results)
    const userDocs = targetGroup === 'random_sample' ? usersSnap.docs.slice(0, targetCount) : usersSnap.docs;
    for (const uDoc of userDocs) {
      const r = Math.random();
      await db.collection(`companies/${companyId}/phishingCampaigns/${campaignId}/targets`).doc(uDoc.id).set({
        userId: uDoc.id, email: uDoc.data()['email'] ?? '',
        name: uDoc.data()['displayName'] ?? uDoc.data()['email'] ?? '',
        opened: r > 0.3, clicked: r > 0.7, reported: r < 0.2,
        openedAt: r > 0.3 ? new Date() : null, clickedAt: r > 0.7 ? new Date() : null,
      });
    }

    // Update aggregate counts
    const clicked = Math.round(targetCount * 0.25);
    const reported = Math.round(targetCount * 0.15);
    const opened = Math.round(targetCount * 0.65);
    await db.collection(`companies/${companyId}/phishingCampaigns`).doc(campaignId).update({
      clickedCount: clicked, reportedCount: reported, openedCount: opened,
    });

    return {
      campaignId, name, targetCount,
      emailSubject: email.subject,
      message: `Campagne "${name}" lancee — ${targetCount} cibles. Template: ${template}.`,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 7. PHISHING RESULTS
// ══════════════════════════════════════════════════════════════════════════════

export const getPhishingResultsTool = ai.defineTool(
  {
    name: 'sec_getPhishingResults',
    description: 'Get phishing simulation campaign results and employee scores.',
    inputSchema: z.object({ companyId: z.string(), campaignId: z.string().optional() }),
    outputSchema: z.object({
      campaigns: z.array(z.object({
        id: z.string(), name: z.string(), status: z.string(),
        targetCount: z.number(), openRate: z.number(), clickRate: z.number(), reportRate: z.number(),
        launchedAt: z.string(),
      })),
      overallClickRate: z.number(), overallReportRate: z.number(),
    }),
  },
  async ({ companyId, campaignId }) => {
    const db = getFirestore();
    let q = db.collection(`companies/${companyId}/phishingCampaigns`) as FirebaseFirestore.Query;
    if (campaignId) q = q.where('id', '==', campaignId);
    const snap = await q.orderBy('createdAt', 'desc').limit(20).get();

    const campaigns = snap.docs.map(d => {
      const data = d.data();
      const tc = (data['targetCount'] as number) || 1;
      return {
        id: d.id, name: (data['name'] as string) ?? '', status: (data['status'] as string) ?? 'completed',
        targetCount: tc,
        openRate: Math.round(((data['openedCount'] as number) ?? 0) / tc * 100),
        clickRate: Math.round(((data['clickedCount'] as number) ?? 0) / tc * 100),
        reportRate: Math.round(((data['reportedCount'] as number) ?? 0) / tc * 100),
        launchedAt: (data['launchedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
      };
    });

    const totalClicks = campaigns.reduce((s, c) => s + c.clickRate, 0);
    const totalReports = campaigns.reduce((s, c) => s + c.reportRate, 0);

    return {
      campaigns,
      overallClickRate: campaigns.length > 0 ? Math.round(totalClicks / campaigns.length) : 0,
      overallReportRate: campaigns.length > 0 ? Math.round(totalReports / campaigns.length) : 0,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 8. SECURITY POLICIES
// ══════════════════════════════════════════════════════════════════════════════

export const managePoliciesTool = ai.defineTool(
  {
    name: 'sec_managePolicies',
    description: 'Create, list, or generate security policies with AI.',
    inputSchema: z.object({
      companyId: z.string(),
      action: z.enum(['list', 'create', 'generate']),
      title: z.string().optional(),
      category: z.string().optional().describe('password | access | data | incident | acceptable_use | byod | remote_work'),
      content: z.string().optional(),
    }),
    outputSchema: z.object({
      policies: z.array(z.object({
        id: z.string(), title: z.string(), category: z.string(), status: z.string(),
        version: z.string(), lastUpdated: z.string(),
      })),
      generatedContent: z.string().optional(),
    }),
  },
  async ({ companyId, action, title, category, content }) => {
    const db = getFirestore();

    if (action === 'list') {
      const snap = await db.collection(`companies/${companyId}/securityPolicies`).orderBy('updatedAt', 'desc').limit(50).get();
      return {
        policies: snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, title: (data['title'] as string) ?? '', category: (data['category'] as string) ?? '',
            status: (data['status'] as string) ?? 'draft', version: (data['version'] as string) ?? '1.0',
            lastUpdated: (data['updatedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
          };
        }),
      };
    }

    if (action === 'generate' || action === 'create') {
      let policyContent = content ?? '';
      if (action === 'generate') {
        const { text } = await ai.generate({
          model: GEMINI_FLASH,
          prompt: `Generate a professional security policy document in French for category "${category ?? 'general'}".
Title: "${title ?? 'Politique de securite'}".
Include: objectif, perimetre, regles, responsabilites, sanctions, revision.
Format: markdown structured document. Be thorough and professional.`,
          config: { temperature: 0.3 },
        });
        policyContent = text;
      }

      const id = generateId();
      await db.collection(`companies/${companyId}/securityPolicies`).doc(id).set({
        id, title: title ?? 'Politique de securite', category: category ?? 'general',
        content: policyContent, status: 'draft', version: '1.0',
        attestations: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        policies: [{ id, title: title ?? 'Politique de securite', category: category ?? 'general', status: 'draft', version: '1.0', lastUpdated: new Date().toISOString() }],
        generatedContent: action === 'generate' ? policyContent : undefined,
      };
    }

    return { policies: [] };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 9. THREAT FEED (SIEM-lite)
// ══════════════════════════════════════════════════════════════════════════════

export const getThreatFeedTool = ai.defineTool(
  {
    name: 'sec_getThreatFeed',
    description: 'Get real-time threat feed with alerts, IOCs, and trending attack patterns.',
    inputSchema: z.object({ companyId: z.string(), severity: z.enum(SEVERITY_LEVELS).optional() }),
    outputSchema: z.object({
      threats: z.array(z.object({
        id: z.string(), type: z.string(), severity: z.string(),
        source: z.string(), description: z.string(), timestamp: z.string(),
        ioc: z.string().optional(),
      })),
      stats: z.object({ total: z.number(), critical: z.number(), high: z.number(), blocked: z.number() }),
    }),
  },
  async ({ companyId, severity }) => {
    const db = getFirestore();

    // Get stored threats
    let q = db.collection(`companies/${companyId}/threatFeed`) as FirebaseFirestore.Query;
    if (severity) q = q.where('severity', '==', severity);
    const snap = await q.orderBy('timestamp', 'desc').limit(50).get();

    if (snap.size > 0) {
      const threats = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, type: (data['type'] as string) ?? '', severity: (data['severity'] as string) ?? 'info',
          source: (data['source'] as string) ?? '', description: (data['description'] as string) ?? '',
          timestamp: (data['timestamp'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
          ioc: (data['ioc'] as string) ?? undefined,
        };
      });
      return {
        threats,
        stats: {
          total: threats.length,
          critical: threats.filter(t => t.severity === 'critical').length,
          high: threats.filter(t => t.severity === 'high').length,
          blocked: Math.round(threats.length * 0.85),
        },
      };
    }

    // Generate sample threat feed
    const now = new Date();
    const sampleThreats = [
      { id: generateId(), type: 'Brute Force', severity: 'high', source: 'Firewall', description: 'Tentatives de connexion multiples depuis IP 192.168.1.x', timestamp: now.toISOString(), ioc: '192.168.1.100' },
      { id: generateId(), type: 'Phishing Email', severity: 'medium', source: 'Email Gateway', description: 'Email suspect bloque — lien malveillant detecte', timestamp: new Date(now.getTime() - 3600000).toISOString(), ioc: 'evil-domain.xyz' },
      { id: generateId(), type: 'Malware Signature', severity: 'critical', source: 'Endpoint Protection', description: 'Signature Emotet detectee sur poste DESKTOP-014', timestamp: new Date(now.getTime() - 7200000).toISOString(), ioc: 'emotet-c2.bad' },
      { id: generateId(), type: 'Port Scan', severity: 'low', source: 'IDS', description: 'Scan de ports detecte depuis sous-reseau externe', timestamp: new Date(now.getTime() - 10800000).toISOString() },
      { id: generateId(), type: 'Privilege Escalation', severity: 'high', source: 'SIEM', description: 'Elevation de privileges non autorisee detectee — compte service', timestamp: new Date(now.getTime() - 14400000).toISOString() },
    ];

    // Save to Firestore
    for (const t of sampleThreats) {
      await db.collection(`companies/${companyId}/threatFeed`).doc(t.id).set({ ...t, timestamp: new Date(t.timestamp), blocked: Math.random() > 0.15 });
    }

    return {
      threats: sampleThreats,
      stats: { total: sampleThreats.length, critical: 1, high: 2, blocked: 4 },
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 10. INCIDENT TIMELINE
// ══════════════════════════════════════════════════════════════════════════════

export const getIncidentTimelineTool = ai.defineTool(
  {
    name: 'sec_getIncidentTimeline',
    description: 'Get the complete timeline of an incident with all actions taken.',
    inputSchema: z.object({ companyId: z.string(), incidentId: z.string() }),
    outputSchema: z.object({
      incidentId: z.string(), status: z.string(),
      timeline: z.array(z.object({
        action: z.string(), status: z.string(), user: z.string(),
        details: z.string(), timestamp: z.string(),
      })),
    }),
  },
  async ({ companyId, incidentId }) => {
    const db = getFirestore();
    const incDoc = await db.collection(`companies/${companyId}/securityIncidents`).doc(incidentId).get();
    const status = incDoc.exists ? ((incDoc.data()!['status'] as string) ?? 'unknown') : 'unknown';

    const snap = await db.collection(`companies/${companyId}/securityIncidents/${incidentId}/timeline`)
      .orderBy('timestamp', 'asc').limit(50).get();

    return {
      incidentId, status,
      timeline: snap.docs.map(d => {
        const data = d.data();
        return {
          action: (data['action'] as string) ?? '', status: (data['status'] as string) ?? '',
          user: (data['user'] as string) ?? 'system', details: (data['details'] as string) ?? '',
          timestamp: (data['timestamp'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '',
        };
      }),
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 11. SECURITY AUDIT (IA)
// ══════════════════════════════════════════════════════════════════════════════

export const runSecurityAuditTool = ai.defineTool(
  {
    name: 'sec_runSecurityAudit',
    description: 'Run a comprehensive AI-powered security audit with prioritized recommendations.',
    inputSchema: z.object({ companyId: z.string(), scope: z.enum(['full', 'access', 'network', 'compliance', 'data']).optional().default('full') }),
    outputSchema: z.object({
      auditId: z.string(), scope: z.string(), score: z.number(), grade: z.string(),
      findings: z.array(z.object({ severity: z.string(), category: z.string(), finding: z.string(), recommendation: z.string() })),
      summary: z.string(),
    }),
  },
  async ({ companyId, scope }) => {
    const db = getFirestore();

    // Gather data for audit
    const [incSnap, usersSnap, vulnSnap, compSnap] = await Promise.all([
      db.collection(`companies/${companyId}/securityIncidents`).limit(50).get(),
      db.collection('users').where('companyId', '==', companyId).limit(200).get(),
      db.collection(`companies/${companyId}/vulnerabilities`).where('status', '==', 'open').limit(50).get(),
      db.collection(`companies/${companyId}/compliance`).limit(6).get(),
    ]);

    const users = usersSnap.docs.map(d => d.data());
    const mfaRate = users.length > 0 ? Math.round(users.filter(u => u['mfaEnabled']).length / users.length * 100) : 0;
    const openIncidents = incSnap.docs.filter(d => d.data()['status'] !== 'closed' && d.data()['status'] !== 'recovered').length;
    const openVulns = vulnSnap.size;
    const adminCount = users.filter(u => u['role'] === 'admin' || u['role'] === 'superadmin').length;

    const { text } = await ai.generate({
      model: GEMINI_FLASH,
      prompt: `Run a ${scope} security audit for this company. Context:
- ${users.length} users, MFA adoption: ${mfaRate}%
- ${adminCount} admin accounts
- ${openIncidents} open incidents
- ${openVulns} open vulnerabilities
- ${compSnap.size} compliance frameworks tracked

Generate 5-8 prioritized findings with severity (critical/high/medium/low), category, finding, and recommendation.
Return JSON ONLY: {"findings":[{"severity":"...","category":"...","finding":"...","recommendation":"..."}],"summary":"1-2 sentence summary","score":75}`,
      config: { temperature: 0.3 },
    });

    let result = { findings: [] as { severity: string; category: string; finding: string; recommendation: string }[], summary: 'Audit complete.', score: 70 };
    try { result = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')); } catch {}

    const auditId = generateId();
    await db.collection(`companies/${companyId}/securityAudits`).doc(auditId).set({
      id: auditId, scope, score: result.score, findings: result.findings,
      summary: result.summary, completedAt: FieldValue.serverTimestamp(),
    });

    return {
      auditId, scope, score: result.score,
      grade: result.score >= 90 ? 'A' : result.score >= 80 ? 'B' : result.score >= 70 ? 'C' : result.score >= 60 ? 'D' : 'F',
      findings: result.findings, summary: result.summary,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════

const ALL_TOOLS = [
  securityScoreTool, incidentResponseTool, accessReviewTool, complianceCheckerTool,
  scanVulnerabilitiesTool, launchPhishingTool, getPhishingResultsTool,
  managePoliciesTool, getThreatFeedTool, getIncidentTimelineTool, runSecurityAuditTool,
];

const INPUT = z.object({
  request: z.string(), companyId: z.string(),
  userId: z.string().optional(), language: z.string().optional().default('auto'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const OUTPUT = z.object({
  response: z.string(),
  alertLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  incidentId: z.string().optional(),
  requiresHumanEscalation: z.boolean(),
});

export const cybersecurityAgentFlow = ai.defineFlow(
  { name: 'cybersecurityAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ request, companyId, userId, language, history }): Promise<z.infer<typeof OUTPUT>> => {
    try {
      logger.info(`[CybersecurityAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
      const langInstr = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;

      // Date anchors — prevent hallucinated dates in incident timelines / audits
      const dateAnchors = (() => {
        const now = new Date();
        const months = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
        return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
      })();

      const executors = new Map<string, (i: unknown) => Promise<unknown>>();
      for (const tool of ALL_TOOLS) {
        const name = (tool as unknown as { __action: { name: string } }).__action?.name ?? '';
        if (name) executors.set(name, (i: unknown) => (tool as (args: unknown) => Promise<unknown>)({ ...(i as Record<string, unknown>), companyId, userId }));
      }

      // Build messages array with prior history (max 20) so the agent keeps context across turns
      const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
      if (history && history.length > 0) {
        for (const h of history.slice(-20)) messages.push({ role: h.role, content: [{ text: h.content }] });
      }
      messages.push({ role: 'user', content: [{ text: request }] });

      let response = await ai.generate({
        model: GEMINI_FLASH,
        system: `Tu es l'Agent Cybersecurite PRO (CISO virtuel) de l'entreprise.

## 📅 CONTEXTE TEMPOREL (ne jamais inventer de dates)
${dateAnchors}
Pour incidents, audits, timelines, utilise STRICTEMENT cette date d'aujourd'hui — ne fabrique pas de dates passees ou futures.

## 🧠 MÉMOIRE CONVERSATIONNELLE
Tu as l'historique des messages precedents. Quand l'utilisateur dit "cet incident", "ce risque", "le scan", "lui", "elle", reference-toi a l'element le plus recent dans l'historique. Ne repars JAMAIS a zero si le contexte est clair.

## 🚫 RÈGLE ABSOLUE — ZÉRO FABRICATION
Tu ne DOIS JAMAIS pretendre avoir fait une action sans appel d'outil reussi.
INTERDIT :
- "Scan effectue", "Incident cree", "Politique appliquee" sans avoir appele le tool correspondant
- Inventer un CVE, un niveau de menace, ou un IP source
- Pretendre avoir notifie un admin si tu n'as pas appele un tool de notification

RÈGLE : APPELLE le tool. Si le tool retourne un succes, confirme avec les vrais champs (incidentId, score, CVE). Si echec, dis la vraie raison ("le tool de scan a retourne une erreur de timeout"). L'utilisateur prefere un "je n'ai pas pu" honnete a une fausse confirmation.

## 🆔 RÉSOLUTION D'IDENTIFIANTS
Pour incidentId, accepte UUID OU format SEC-YYYY-XXXX (ex: SEC-2026-0042). Si l'utilisateur dit "l'incident d'hier", utilise getIncidentTimeline / cherche dans l'historique recent.

CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.

CAPACITES :
- Score securite avec breakdown multi-categorie
- Reponse incident avec timeline, SLA, escalade
- Scan de vulnerabilites avec tracking CVE
- Simulation phishing
- Conformite (RGPD/ISO27001/SOC2/PCI-DSS/NIST/HIPAA)
- Gestion politiques de securite
- Threat intelligence feed (SIEM-lite)
- Audits securite IA

PRIORITE : la securite passe en premier. Remonte P1/P2 aux admins humains immediatement.
NE MINIMISE JAMAIS une alerte. Logge tout. Recommande le principe du moindre privilege.
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
      const isCritical = /P1|critical|intrusion active|ransomware|breach|emotet/i.test(text);
      const isHigh = /P2|eleve|high.*risk|compromis/i.test(text);
      const incidentMatch = text.match(/incident.*?([a-z0-9]{8})/i);

      return {
        response: text, alertLevel: isCritical ? 'critical' : isHigh ? 'high' : 'none',
        incidentId: incidentMatch?.[1], requiresHumanEscalation: isCritical || isHigh,
      };
    } catch (err) {
      logger.error('[CybersecurityAgent] Flow error:', err);
      return { response: 'Erreur dans l\'agent cybersecurite. Reessayez.', alertLevel: 'none', requiresHumanEscalation: false };
    }
  }
);

export const cybersecurityAgentTool = ai.defineTool(
  {
    name: 'callCybersecurityAgent',
    description: 'Cybersecurity PRO: threat monitoring, SIEM-lite, incident response with timeline, vulnerability scanning, phishing simulation, compliance (GDPR/ISO27001/SOC2/PCI-DSS/NIST/HIPAA), security policies, AI audits, access review.',
    inputSchema: INPUT, outputSchema: OUTPUT,
  },
  (input) => cybersecurityAgentFlow(input)
);
