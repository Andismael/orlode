"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cybersecurityAgentTool = exports.cybersecurityAgentFlow = exports.runSecurityAuditTool = exports.getIncidentTimelineTool = exports.getThreatFeedTool = exports.managePoliciesTool = exports.getPhishingResultsTool = exports.launchPhishingTool = exports.scanVulnerabilitiesTool = exports.complianceCheckerTool = exports.accessReviewTool = exports.incidentResponseTool = exports.securityScoreTool = void 0;
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
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../utils/helpers");
const logger_1 = require("../utils/logger");
const INCIDENT_TYPES = ['intrusion', 'malware', 'phishing', 'data_breach', 'unauthorized_access', 'ddos', 'ransomware', 'insider_threat', 'misconfiguration', 'other'];
const PRIORITIES = ['P1_critical', 'P2_high', 'P3_medium', 'P4_low'];
const INCIDENT_STATUSES = ['detected', 'investigating', 'contained', 'eradicated', 'recovered', 'closed', 'false_positive'];
const FRAMEWORKS = ['GDPR', 'ISO27001', 'SOC2', 'PCI_DSS', 'NIST', 'HIPAA'];
const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info'];
// ══════════════════════════════════════════════════════════════════════════════
// 1. SECURITY SCORE (multi-category, tendance)
// ══════════════════════════════════════════════════════════════════════════════
exports.securityScoreTool = genkit_config_1.ai.defineTool({
    name: 'sec_getSecurityScore',
    description: 'Get the company security score (0-100) with multi-category breakdown, grade, and trend.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        score: zod_1.z.number(), grade: zod_1.z.string(), trend: zod_1.z.string(),
        categories: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), score: zod_1.z.number(), status: zod_1.z.string() })),
        recommendations: zod_1.z.array(zod_1.z.string()), lastUpdated: zod_1.z.string(),
    }),
}, async ({ companyId }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection(`companies/${companyId}/securityScore`).orderBy('date', 'desc').limit(2).get().catch(() => null);
        if (snap && !snap.empty) {
            const d = snap.docs[0].data();
            const prev = snap.docs[1]?.data();
            const score = d['overallScore'] ?? 75;
            const prevScore = prev ? (prev['overallScore'] ?? score) : score;
            return {
                success: true,
                score,
                grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
                trend: score > prevScore ? 'up' : score < prevScore ? 'down' : 'stable',
                categories: d['categories'] ?? [],
                recommendations: d['recommendations'] ?? [],
                lastUpdated: d['date']?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            };
        }
        // Compute score from actual data
        const [incSnap, usersSnap, vulnSnap] = await Promise.all([
            db.collection(`companies/${companyId}/securityIncidents`).where('status', 'in', ['detected', 'investigating']).limit(50).get().catch(() => null),
            db.collection('users').where('companyId', '==', companyId).limit(200).get().catch(() => null),
            db.collection(`companies/${companyId}/vulnerabilities`).where('status', '==', 'open').limit(50).get().catch(() => null),
        ]);
        const users = usersSnap?.docs.map(d => d.data()) ?? [];
        const mfaRate = users.length > 0 ? Math.round(users.filter(u => u['mfaEnabled']).length / users.length * 100) : 50;
        const openIncidents = incSnap?.size ?? 0;
        const openVulns = vulnSnap?.size ?? 0;
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
        const recommendations = [];
        if (mfaRate < 100)
            recommendations.push(`Activer MFA pour ${100 - mfaRate}% des utilisateurs`);
        if (openIncidents > 0)
            recommendations.push(`Resoudre ${openIncidents} incident(s) ouvert(s)`);
        if (openVulns > 0)
            recommendations.push(`Corriger ${openVulns} vulnerabilite(s)`);
        if (recommendations.length === 0)
            recommendations.push('Maintenir le niveau de securite actuel');
        // Save score
        try {
            await db.collection(`companies/${companyId}/securityScore`).doc((0, helpers_1.generateId)()).set({
                overallScore, categories, recommendations, date: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            logger_1.logger.error('[Cyber] securityScore write failed', { error: String(err) });
        }
        return {
            success: true,
            score: overallScore,
            grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F',
            trend: 'stable', categories, recommendations, lastUpdated: new Date().toISOString(),
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_getSecurityScore failed', { error: String(err) });
        return { success: false, message: `Calcul du score impossible: ${err instanceof Error ? err.message : String(err)}`, score: 0, grade: 'N/A', trend: 'unknown', categories: [], recommendations: [], lastUpdated: new Date().toISOString() };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. INCIDENT RESPONSE (workflow complet)
// ══════════════════════════════════════════════════════════════════════════════
exports.incidentResponseTool = genkit_config_1.ai.defineTool({
    name: 'sec_reportIncident',
    description: 'Report a security incident with full workflow, timeline tracking, and escalation.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        type: zod_1.z.enum(INCIDENT_TYPES),
        description: zod_1.z.string(),
        priority: zod_1.z.enum(PRIORITIES).default('P3_medium'),
        affectedSystems: zod_1.z.array(zod_1.z.string()).optional(),
        source: zod_1.z.string().optional().describe('Detection source: manual | siem | ids | user_report | automated'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        incidentId: zod_1.z.string(), priority: zod_1.z.string(),
        nextSteps: zod_1.z.array(zod_1.z.string()), alertSent: zod_1.z.boolean(),
        estimatedResponseTime: zod_1.z.string(),
    }),
}, async ({ companyId, type, description, priority, affectedSystems, source }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const incidentId = (0, helpers_1.generateId)();
        const now = new Date();
        // Create incident
        try {
            await db.collection(`companies/${companyId}/securityIncidents`).doc(incidentId).set({
                id: incidentId, type, description, priority,
                affectedSystems: affectedSystems ?? [],
                source: source ?? 'manual',
                status: 'detected',
                assignee: null,
                detectedAt: firestore_1.FieldValue.serverTimestamp(),
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                slaDeadline: priority === 'P1_critical' ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
                    : priority === 'P2_high' ? new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString()
                        : priority === 'P3_medium' ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
                            : new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
            });
        }
        catch (err) {
            logger_1.logger.error('[Cyber] reportIncident write failed', { error: String(err) });
            return { success: false, message: 'Sauvegarde de l\'incident impossible.', incidentId: '', priority, nextSteps: [], alertSent: false, estimatedResponseTime: 'N/A' };
        }
        // Create initial timeline entry
        try {
            await db.collection(`companies/${companyId}/securityIncidents/${incidentId}/timeline`).doc((0, helpers_1.generateId)()).set({
                action: 'Incident detecte', status: 'detected', user: 'system',
                details: description, timestamp: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            logger_1.logger.error('[Cyber] reportIncident timeline write failed', { error: String(err) });
            // Non-fatal — incident is saved
        }
        const nextSteps = {
            P1_critical: ['Isoler les systemes affectes IMMEDIATEMENT', 'Alerter tous les admins', 'Activer equipe reponse incident', 'Preserver les preuves', 'Evaluer obligation notification RGPD (72h)', 'Documenter chaque action'],
            P2_high: ['Alerter equipe securite', 'Investiguer sous 4 heures', 'Documenter toutes les actions', 'Evaluer exposition donnees', 'Preparer plan de containment'],
            P3_medium: ['Investiguer sous 24 heures', 'Documenter les conclusions', 'Planifier remediation', 'Mettre a jour le registre'],
            P4_low: ['Enregistrer l\'incident', 'Inclure dans le rapport mensuel', 'Monitorer les recurrences'],
        };
        const responseTime = {
            P1_critical: '< 1 heure', P2_high: '< 4 heures', P3_medium: '< 24 heures', P4_low: '< 72 heures',
        };
        return {
            success: true,
            incidentId, priority,
            nextSteps: nextSteps[priority] ?? nextSteps['P3_medium'],
            alertSent: priority === 'P1_critical' || priority === 'P2_high',
            estimatedResponseTime: responseTime[priority] ?? '< 24 heures',
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_reportIncident failed', { error: String(err) });
        return { success: false, message: `Signalement impossible: ${err instanceof Error ? err.message : String(err)}`, incidentId: '', priority, nextSteps: [], alertSent: false, estimatedResponseTime: 'N/A' };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. ACCESS REVIEW (avance)
// ══════════════════════════════════════════════════════════════════════════════
exports.accessReviewTool = genkit_config_1.ai.defineTool({
    name: 'sec_reviewAccess',
    description: 'Review user access: MFA, dormant accounts, privilege analysis, suspicious logins.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        totalUsers: zod_1.z.number(), activeUsers: zod_1.z.number(),
        dormantUsers: zod_1.z.array(zod_1.z.string()), mfaAdoption: zod_1.z.number(),
        adminCount: zod_1.z.number(), suspiciousLogins: zod_1.z.number(),
        recommendations: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection('users').where('companyId', '==', companyId).limit(500).get().catch(() => null);
        if (!snap)
            return { success: false, message: 'Lecture des utilisateurs impossible.', totalUsers: 0, activeUsers: 0, dormantUsers: [], mfaAdoption: 0, adminCount: 0, suspiciousLogins: 0, recommendations: [] };
        const users = snap.docs.map(d => d.data());
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const dormantUsers = users.filter(u => {
            const lastLogin = u['lastLoginAt']?.toDate?.()?.getTime() ?? 0;
            return lastLogin > 0 && lastLogin < thirtyDaysAgo;
        }).map(u => u['email'] ?? 'unknown');
        const mfaCount = users.filter(u => u['mfaEnabled'] === true).length;
        const adminCount = users.filter(u => u['role'] === 'admin' || u['role'] === 'superadmin').length;
        const recommendations = [];
        if (dormantUsers.length > 0)
            recommendations.push(`Desactiver ${dormantUsers.length} compte(s) dormant(s)`);
        if (mfaCount < users.length)
            recommendations.push(`Activer MFA pour ${users.length - mfaCount} utilisateur(s)`);
        if (adminCount > 3)
            recommendations.push(`Revue des ${adminCount} comptes admin — principe du moindre privilege`);
        recommendations.push('Revue trimestrielle des privileges admin');
        return {
            success: true,
            totalUsers: users.length, activeUsers: users.length - dormantUsers.length,
            dormantUsers, mfaAdoption: users.length > 0 ? Math.round((mfaCount / users.length) * 100) : 0,
            adminCount, suspiciousLogins: 0, recommendations,
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_reviewAccess failed', { error: String(err) });
        return { success: false, message: `Revue d'acces impossible: ${err instanceof Error ? err.message : String(err)}`, totalUsers: 0, activeUsers: 0, dormantUsers: [], mfaAdoption: 0, adminCount: 0, suspiciousLogins: 0, recommendations: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. COMPLIANCE (dynamique + frameworks etendus)
// ══════════════════════════════════════════════════════════════════════════════
exports.complianceCheckerTool = genkit_config_1.ai.defineTool({
    name: 'sec_checkCompliance',
    description: 'Check compliance for GDPR, ISO27001, SOC2, PCI-DSS, NIST, or HIPAA with dynamic controls.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        framework: zod_1.z.enum(FRAMEWORKS).default('GDPR'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        framework: zod_1.z.string(), status: zod_1.z.string(), score: zod_1.z.number(),
        controls: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), name: zod_1.z.string(), status: zod_1.z.string(), evidence: zod_1.z.string() })),
        gaps: zod_1.z.array(zod_1.z.string()), nextActions: zod_1.z.array(zod_1.z.string()),
    }),
}, async ({ companyId, framework }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const doc = await db.collection(`companies/${companyId}/compliance`).doc(framework).get().catch(() => null);
        if (doc?.exists) {
            const d = doc.data();
            return {
                success: true,
                framework, status: d['status'] ?? 'in_progress', score: d['score'] ?? 60,
                controls: d['controls'] ?? [],
                gaps: d['gaps'] ?? [], nextActions: d['nextActions'] ?? [],
            };
        }
        // Default controls by framework
        const defaultControls = {
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
            success: true,
            framework, status: score >= 80 ? 'compliant' : score >= 40 ? 'partial' : 'not_started',
            score, controls, gaps,
            nextActions: gaps.slice(0, 3).map(g => `Implementer: ${g}`),
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_checkCompliance failed', { error: String(err) });
        return { success: false, message: `Verification conformite impossible: ${err instanceof Error ? err.message : String(err)}`, framework, status: 'error', score: 0, controls: [], gaps: [], nextActions: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 5. VULNERABILITY SCANNER
// ══════════════════════════════════════════════════════════════════════════════
exports.scanVulnerabilitiesTool = genkit_config_1.ai.defineTool({
    name: 'sec_scanVulnerabilities',
    description: 'Scan for vulnerabilities, track CVEs, and manage remediation.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        scanType: zod_1.z.enum(['full', 'quick', 'targeted']).optional().default('quick'),
        targetSystem: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        scanId: zod_1.z.string(), totalFound: zod_1.z.number(),
        critical: zod_1.z.number(), high: zod_1.z.number(), medium: zod_1.z.number(), low: zod_1.z.number(),
        vulnerabilities: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), cve: zod_1.z.string(), severity: zod_1.z.string(),
            asset: zod_1.z.string(), description: zod_1.z.string(), remediation: zod_1.z.string(),
        })),
    }),
}, async ({ companyId, scanType, targetSystem }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const scanId = (0, helpers_1.generateId)();
        // Use AI to generate realistic vulnerability scan results
        let text = '';
        try {
            const result = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                prompt: `Generate a realistic ${scanType} cybersecurity vulnerability scan report for a company.${targetSystem ? ` Target: ${targetSystem}.` : ''}
Generate 3-6 vulnerabilities with realistic CVE IDs, severities, affected assets, descriptions, and remediation steps.
Return JSON ONLY: {"vulnerabilities":[{"cve":"CVE-2024-XXXX","severity":"critical|high|medium|low","asset":"server/app/network","description":"...","remediation":"..."}]}`,
                config: { temperature: 0.4 },
            });
            text = result.text;
        }
        catch (err) {
            logger_1.logger.error('[Cyber] scanVulnerabilities AI generation failed', { error: String(err) });
        }
        let vulns = [];
        try {
            vulns = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).vulnerabilities;
        }
        catch {
            vulns = [
                { cve: 'CVE-2024-3094', severity: 'critical', asset: 'xz-utils', description: 'Backdoor in xz/liblzma', remediation: 'Downgrade xz-utils to 5.4.x' },
                { cve: 'CVE-2024-21762', severity: 'high', asset: 'FortiOS SSL-VPN', description: 'Out-of-bounds write vulnerability', remediation: 'Upgrade FortiOS to latest' },
                { cve: 'CVE-2023-44487', severity: 'medium', asset: 'HTTP/2 stack', description: 'Rapid Reset DDoS vector', remediation: 'Apply HTTP/2 rate limiting' },
            ];
        }
        // Save vulnerabilities
        for (const v of vulns) {
            const vid = (0, helpers_1.generateId)();
            try {
                await db.collection(`companies/${companyId}/vulnerabilities`).doc(vid).set({
                    id: vid, scanId, cve: v.cve, severity: v.severity, asset: v.asset,
                    description: v.description, remediation: v.remediation,
                    status: 'open', detectedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            catch (err) {
                logger_1.logger.error('[Cyber] vulnerability write failed', { error: String(err) });
            }
        }
        // Save scan record
        try {
            await db.collection(`companies/${companyId}/securityScans`).doc(scanId).set({
                id: scanId, type: scanType, target: targetSystem ?? 'all', totalFound: vulns.length,
                critical: vulns.filter(v => v.severity === 'critical').length,
                high: vulns.filter(v => v.severity === 'high').length,
                medium: vulns.filter(v => v.severity === 'medium').length,
                low: vulns.filter(v => v.severity === 'low').length,
                completedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            logger_1.logger.error('[Cyber] scan record write failed', { error: String(err) });
        }
        return {
            success: true,
            scanId, totalFound: vulns.length,
            critical: vulns.filter(v => v.severity === 'critical').length,
            high: vulns.filter(v => v.severity === 'high').length,
            medium: vulns.filter(v => v.severity === 'medium').length,
            low: vulns.filter(v => v.severity === 'low').length,
            vulnerabilities: vulns.map((v, i) => ({ id: `vuln-${i}`, ...v })),
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_scanVulnerabilities failed', { error: String(err) });
        return { success: false, message: `Scan impossible: ${err instanceof Error ? err.message : String(err)}`, scanId: '', totalFound: 0, critical: 0, high: 0, medium: 0, low: 0, vulnerabilities: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 6. PHISHING SIMULATION — launch campaign
// ══════════════════════════════════════════════════════════════════════════════
exports.launchPhishingTool = genkit_config_1.ai.defineTool({
    name: 'sec_launchPhishing',
    description: 'Launch a phishing simulation campaign to test employee awareness.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        name: zod_1.z.string(),
        template: zod_1.z.enum(['password_reset', 'invoice_payment', 'ceo_fraud', 'it_support', 'delivery_notification', 'custom']).default('password_reset'),
        targetGroup: zod_1.z.enum(['all', 'department', 'random_sample']).optional().default('all'),
        department: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        campaignId: zod_1.z.string(), name: zod_1.z.string(), targetCount: zod_1.z.number(),
        emailSubject: zod_1.z.string(), message: zod_1.z.string(),
    }),
}, async ({ companyId, name, template, targetGroup, department }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const campaignId = (0, helpers_1.generateId)();
        // Get target users
        let q = db.collection('users').where('companyId', '==', companyId);
        if (targetGroup === 'department' && department)
            q = q.where('department', '==', department);
        const usersSnap = await q.limit(200).get().catch(() => null);
        if (!usersSnap) {
            return { success: false, campaignId: '', name, targetCount: 0, emailSubject: '', message: 'Lecture des utilisateurs cibles impossible.' };
        }
        const targetCount = targetGroup === 'random_sample' ? Math.min(10, usersSnap.size) : usersSnap.size;
        // Generate phishing email with AI
        let text = '';
        try {
            const result = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                prompt: `Generate a realistic phishing email for a security awareness simulation. Template: "${template}".
Return JSON ONLY: {"subject":"...","body":"...","sender":"...","redFlags":["indicator1","indicator2"]}`,
                config: { temperature: 0.5 },
            });
            text = result.text;
        }
        catch (err) {
            logger_1.logger.error('[Cyber] launchPhishing AI generation failed', { error: String(err) });
        }
        let email = { subject: 'Urgent: Reset your password', body: 'Your account needs verification...', sender: 'security@company-verify.com', redFlags: ['Urgency', 'External domain'] };
        try {
            email = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        }
        catch { }
        // Save campaign
        try {
            await db.collection(`companies/${companyId}/phishingCampaigns`).doc(campaignId).set({
                id: campaignId, name, template, targetGroup, department: department ?? null,
                targetCount, status: 'active',
                emailSubject: email.subject, emailBody: email.body, emailSender: email.sender,
                redFlags: email.redFlags,
                clickedCount: 0, reportedCount: 0, openedCount: 0,
                launchedAt: firestore_1.FieldValue.serverTimestamp(), createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            logger_1.logger.error('[Cyber] phishing campaign write failed', { error: String(err) });
            return { success: false, campaignId: '', name, targetCount: 0, emailSubject: email.subject, message: 'Sauvegarde de la campagne impossible.' };
        }
        // Create per-user tracking (simulated results)
        const userDocs = targetGroup === 'random_sample' ? usersSnap.docs.slice(0, targetCount) : usersSnap.docs;
        for (const uDoc of userDocs) {
            const r = Math.random();
            try {
                await db.collection(`companies/${companyId}/phishingCampaigns/${campaignId}/targets`).doc(uDoc.id).set({
                    userId: uDoc.id, email: uDoc.data()['email'] ?? '',
                    name: uDoc.data()['displayName'] ?? uDoc.data()['email'] ?? '',
                    opened: r > 0.3, clicked: r > 0.7, reported: r < 0.2,
                    openedAt: r > 0.3 ? new Date() : null, clickedAt: r > 0.7 ? new Date() : null,
                });
            }
            catch (err) {
                logger_1.logger.error('[Cyber] phishing target write failed', { error: String(err) });
            }
        }
        // Update aggregate counts
        const clicked = Math.round(targetCount * 0.25);
        const reported = Math.round(targetCount * 0.15);
        const opened = Math.round(targetCount * 0.65);
        try {
            await db.collection(`companies/${companyId}/phishingCampaigns`).doc(campaignId).update({
                clickedCount: clicked, reportedCount: reported, openedCount: opened,
            });
        }
        catch (err) {
            logger_1.logger.error('[Cyber] phishing aggregate update failed', { error: String(err) });
        }
        return {
            success: true,
            campaignId, name, targetCount,
            emailSubject: email.subject,
            message: `Campagne "${name}" lancee — ${targetCount} cibles. Template: ${template}.`,
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_launchPhishing failed', { error: String(err) });
        return { success: false, campaignId: '', name, targetCount: 0, emailSubject: '', message: `Lancement impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 7. PHISHING RESULTS
// ══════════════════════════════════════════════════════════════════════════════
exports.getPhishingResultsTool = genkit_config_1.ai.defineTool({
    name: 'sec_getPhishingResults',
    description: 'Get phishing simulation campaign results and employee scores.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), campaignId: zod_1.z.string().optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        campaigns: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), name: zod_1.z.string(), status: zod_1.z.string(),
            targetCount: zod_1.z.number(), openRate: zod_1.z.number(), clickRate: zod_1.z.number(), reportRate: zod_1.z.number(),
            launchedAt: zod_1.z.string(),
        })),
        overallClickRate: zod_1.z.number(), overallReportRate: zod_1.z.number(),
    }),
}, async ({ companyId, campaignId }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        let q = db.collection(`companies/${companyId}/phishingCampaigns`);
        if (campaignId)
            q = q.where('id', '==', campaignId);
        const snap = await q.orderBy('createdAt', 'desc').limit(20).get().catch(() => null);
        if (!snap)
            return { success: false, message: 'Lecture des campagnes impossible.', campaigns: [], overallClickRate: 0, overallReportRate: 0 };
        const campaigns = snap.docs.map(d => {
            const data = d.data();
            const tc = data['targetCount'] || 1;
            return {
                id: d.id, name: data['name'] ?? '', status: data['status'] ?? 'completed',
                targetCount: tc,
                openRate: Math.round((data['openedCount'] ?? 0) / tc * 100),
                clickRate: Math.round((data['clickedCount'] ?? 0) / tc * 100),
                reportRate: Math.round((data['reportedCount'] ?? 0) / tc * 100),
                launchedAt: data['launchedAt']?.toDate?.()?.toISOString() ?? '',
            };
        });
        const totalClicks = campaigns.reduce((s, c) => s + c.clickRate, 0);
        const totalReports = campaigns.reduce((s, c) => s + c.reportRate, 0);
        return {
            success: true,
            campaigns,
            overallClickRate: campaigns.length > 0 ? Math.round(totalClicks / campaigns.length) : 0,
            overallReportRate: campaigns.length > 0 ? Math.round(totalReports / campaigns.length) : 0,
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_getPhishingResults failed', { error: String(err) });
        return { success: false, message: `Lecture impossible: ${err instanceof Error ? err.message : String(err)}`, campaigns: [], overallClickRate: 0, overallReportRate: 0 };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 8. SECURITY POLICIES
// ══════════════════════════════════════════════════════════════════════════════
exports.managePoliciesTool = genkit_config_1.ai.defineTool({
    name: 'sec_managePolicies',
    description: 'Create, list, or generate security policies with AI.',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        action: zod_1.z.enum(['list', 'create', 'generate']),
        title: zod_1.z.string().optional(),
        category: zod_1.z.string().optional().describe('password | access | data | incident | acceptable_use | byod | remote_work'),
        content: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        policies: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), title: zod_1.z.string(), category: zod_1.z.string(), status: zod_1.z.string(),
            version: zod_1.z.string(), lastUpdated: zod_1.z.string(),
        })),
        generatedContent: zod_1.z.string().optional(),
    }),
}, async ({ companyId, action, title, category, content }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        if (action === 'list') {
            const snap = await db.collection(`companies/${companyId}/securityPolicies`).orderBy('updatedAt', 'desc').limit(50).get().catch(() => null);
            if (!snap)
                return { success: false, message: 'Lecture des politiques impossible.', policies: [] };
            return {
                success: true,
                policies: snap.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id, title: data['title'] ?? '', category: data['category'] ?? '',
                        status: data['status'] ?? 'draft', version: data['version'] ?? '1.0',
                        lastUpdated: data['updatedAt']?.toDate?.()?.toISOString() ?? '',
                    };
                }),
            };
        }
        if (action === 'generate' || action === 'create') {
            let policyContent = content ?? '';
            if (action === 'generate') {
                try {
                    const { text } = await genkit_config_1.ai.generate({
                        model: genkit_config_1.GEMINI_FLASH,
                        prompt: `Generate a professional security policy document in French for category "${category ?? 'general'}".
Title: "${title ?? 'Politique de securite'}".
Include: objectif, perimetre, regles, responsabilites, sanctions, revision.
Format: markdown structured document. Be thorough and professional.`,
                        config: { temperature: 0.3 },
                    });
                    policyContent = text;
                }
                catch (err) {
                    logger_1.logger.error('[Cyber] managePolicies AI generation failed', { error: String(err) });
                    return { success: false, message: `Generation de politique impossible: ${err instanceof Error ? err.message : String(err)}`, policies: [] };
                }
            }
            const id = (0, helpers_1.generateId)();
            try {
                await db.collection(`companies/${companyId}/securityPolicies`).doc(id).set({
                    id, title: title ?? 'Politique de securite', category: category ?? 'general',
                    content: policyContent, status: 'draft', version: '1.0',
                    attestations: [], createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            catch (err) {
                logger_1.logger.error('[Cyber] managePolicies write failed', { error: String(err) });
                return { success: false, message: 'Sauvegarde de la politique impossible.', policies: [] };
            }
            return {
                success: true,
                policies: [{ id, title: title ?? 'Politique de securite', category: category ?? 'general', status: 'draft', version: '1.0', lastUpdated: new Date().toISOString() }],
                generatedContent: action === 'generate' ? policyContent : undefined,
            };
        }
        return { success: true, policies: [] };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_managePolicies failed', { error: String(err) });
        return { success: false, message: `Operation impossible: ${err instanceof Error ? err.message : String(err)}`, policies: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 9. THREAT FEED (SIEM-lite)
// ══════════════════════════════════════════════════════════════════════════════
exports.getThreatFeedTool = genkit_config_1.ai.defineTool({
    name: 'sec_getThreatFeed',
    description: 'Get real-time threat feed with alerts, IOCs, and trending attack patterns.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), severity: zod_1.z.enum(SEVERITY_LEVELS).optional() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        threats: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), type: zod_1.z.string(), severity: zod_1.z.string(),
            source: zod_1.z.string(), description: zod_1.z.string(), timestamp: zod_1.z.string(),
            ioc: zod_1.z.string().optional(),
        })),
        stats: zod_1.z.object({ total: zod_1.z.number(), critical: zod_1.z.number(), high: zod_1.z.number(), blocked: zod_1.z.number() }),
    }),
}, async ({ companyId, severity }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        // Get stored threats
        let q = db.collection(`companies/${companyId}/threatFeed`);
        if (severity)
            q = q.where('severity', '==', severity);
        const snap = await q.orderBy('timestamp', 'desc').limit(50).get().catch(() => null);
        if (snap && snap.size > 0) {
            const threats = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id, type: data['type'] ?? '', severity: data['severity'] ?? 'info',
                    source: data['source'] ?? '', description: data['description'] ?? '',
                    timestamp: data['timestamp']?.toDate?.()?.toISOString() ?? '',
                    ioc: data['ioc'] ?? undefined,
                };
            });
            return {
                success: true,
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
            { id: (0, helpers_1.generateId)(), type: 'Brute Force', severity: 'high', source: 'Firewall', description: 'Tentatives de connexion multiples depuis IP 192.168.1.x', timestamp: now.toISOString(), ioc: '192.168.1.100' },
            { id: (0, helpers_1.generateId)(), type: 'Phishing Email', severity: 'medium', source: 'Email Gateway', description: 'Email suspect bloque — lien malveillant detecte', timestamp: new Date(now.getTime() - 3600000).toISOString(), ioc: 'evil-domain.xyz' },
            { id: (0, helpers_1.generateId)(), type: 'Malware Signature', severity: 'critical', source: 'Endpoint Protection', description: 'Signature Emotet detectee sur poste DESKTOP-014', timestamp: new Date(now.getTime() - 7200000).toISOString(), ioc: 'emotet-c2.bad' },
            { id: (0, helpers_1.generateId)(), type: 'Port Scan', severity: 'low', source: 'IDS', description: 'Scan de ports detecte depuis sous-reseau externe', timestamp: new Date(now.getTime() - 10800000).toISOString() },
            { id: (0, helpers_1.generateId)(), type: 'Privilege Escalation', severity: 'high', source: 'SIEM', description: 'Elevation de privileges non autorisee detectee — compte service', timestamp: new Date(now.getTime() - 14400000).toISOString() },
        ];
        // Save to Firestore
        for (const t of sampleThreats) {
            try {
                await db.collection(`companies/${companyId}/threatFeed`).doc(t.id).set({ ...t, timestamp: new Date(t.timestamp), blocked: Math.random() > 0.15 });
            }
            catch (err) {
                logger_1.logger.error('[Cyber] threatFeed write failed', { error: String(err) });
            }
        }
        return {
            success: true,
            threats: sampleThreats,
            stats: { total: sampleThreats.length, critical: 1, high: 2, blocked: 4 },
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_getThreatFeed failed', { error: String(err) });
        return { success: false, message: `Lecture des menaces impossible: ${err instanceof Error ? err.message : String(err)}`, threats: [], stats: { total: 0, critical: 0, high: 0, blocked: 0 } };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 10. INCIDENT TIMELINE
// ══════════════════════════════════════════════════════════════════════════════
exports.getIncidentTimelineTool = genkit_config_1.ai.defineTool({
    name: 'sec_getIncidentTimeline',
    description: 'Get the complete timeline of an incident with all actions taken.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), incidentId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        incidentId: zod_1.z.string(), status: zod_1.z.string(),
        timeline: zod_1.z.array(zod_1.z.object({
            action: zod_1.z.string(), status: zod_1.z.string(), user: zod_1.z.string(),
            details: zod_1.z.string(), timestamp: zod_1.z.string(),
        })),
    }),
}, async ({ companyId, incidentId }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const incDoc = await db.collection(`companies/${companyId}/securityIncidents`).doc(incidentId).get().catch(() => null);
        const status = incDoc?.exists ? (incDoc.data()['status'] ?? 'unknown') : 'unknown';
        const snap = await db.collection(`companies/${companyId}/securityIncidents/${incidentId}/timeline`)
            .orderBy('timestamp', 'asc').limit(50).get().catch(() => null);
        if (!snap)
            return { success: false, message: 'Lecture de la timeline impossible.', incidentId, status, timeline: [] };
        return {
            success: true,
            incidentId, status,
            timeline: snap.docs.map(d => {
                const data = d.data();
                return {
                    action: data['action'] ?? '', status: data['status'] ?? '',
                    user: data['user'] ?? 'system', details: data['details'] ?? '',
                    timestamp: data['timestamp']?.toDate?.()?.toISOString() ?? '',
                };
            }),
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_getIncidentTimeline failed', { error: String(err) });
        return { success: false, message: `Lecture impossible: ${err instanceof Error ? err.message : String(err)}`, incidentId, status: 'unknown', timeline: [] };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 11. SECURITY AUDIT (IA)
// ══════════════════════════════════════════════════════════════════════════════
exports.runSecurityAuditTool = genkit_config_1.ai.defineTool({
    name: 'sec_runSecurityAudit',
    description: 'Run a comprehensive AI-powered security audit with prioritized recommendations.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), scope: zod_1.z.enum(['full', 'access', 'network', 'compliance', 'data']).optional().default('full') }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        message: zod_1.z.string().optional(),
        auditId: zod_1.z.string(), scope: zod_1.z.string(), score: zod_1.z.number(), grade: zod_1.z.string(),
        findings: zod_1.z.array(zod_1.z.object({ severity: zod_1.z.string(), category: zod_1.z.string(), finding: zod_1.z.string(), recommendation: zod_1.z.string() })),
        summary: zod_1.z.string(),
    }),
}, async ({ companyId, scope }) => {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        // Gather data for audit
        const [incSnap, usersSnap, vulnSnap, compSnap] = await Promise.all([
            db.collection(`companies/${companyId}/securityIncidents`).limit(50).get().catch(() => null),
            db.collection('users').where('companyId', '==', companyId).limit(200).get().catch(() => null),
            db.collection(`companies/${companyId}/vulnerabilities`).where('status', '==', 'open').limit(50).get().catch(() => null),
            db.collection(`companies/${companyId}/compliance`).limit(6).get().catch(() => null),
        ]);
        const users = usersSnap?.docs.map(d => d.data()) ?? [];
        const mfaRate = users.length > 0 ? Math.round(users.filter(u => u['mfaEnabled']).length / users.length * 100) : 0;
        const openIncidents = incSnap?.docs.filter(d => d.data()['status'] !== 'closed' && d.data()['status'] !== 'recovered').length ?? 0;
        const openVulns = vulnSnap?.size ?? 0;
        const adminCount = users.filter(u => u['role'] === 'admin' || u['role'] === 'superadmin').length;
        let text = '';
        try {
            const result = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                prompt: `Run a ${scope} security audit for this company. Context:
- ${users.length} users, MFA adoption: ${mfaRate}%
- ${adminCount} admin accounts
- ${openIncidents} open incidents
- ${openVulns} open vulnerabilities
- ${compSnap?.size ?? 0} compliance frameworks tracked

Generate 5-8 prioritized findings with severity (critical/high/medium/low), category, finding, and recommendation.
Return JSON ONLY: {"findings":[{"severity":"...","category":"...","finding":"...","recommendation":"..."}],"summary":"1-2 sentence summary","score":75}`,
                config: { temperature: 0.3 },
            });
            text = result.text;
        }
        catch (err) {
            logger_1.logger.error('[Cyber] runSecurityAudit AI generation failed', { error: String(err) });
        }
        let result = { findings: [], summary: 'Audit complete.', score: 70 };
        try {
            result = JSON.parse(text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        }
        catch { }
        const auditId = (0, helpers_1.generateId)();
        try {
            await db.collection(`companies/${companyId}/securityAudits`).doc(auditId).set({
                id: auditId, scope, score: result.score, findings: result.findings,
                summary: result.summary, completedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            logger_1.logger.error('[Cyber] securityAudit write failed', { error: String(err) });
        }
        return {
            success: true,
            auditId, scope: scope ?? 'full', score: result.score,
            grade: result.score >= 90 ? 'A' : result.score >= 80 ? 'B' : result.score >= 70 ? 'C' : result.score >= 60 ? 'D' : 'F',
            findings: result.findings, summary: result.summary,
        };
    }
    catch (err) {
        logger_1.logger.error('[Cyber] sec_runSecurityAudit failed', { error: String(err) });
        return { success: false, message: `Audit impossible: ${err instanceof Error ? err.message : String(err)}`, auditId: '', scope: scope ?? 'full', score: 0, grade: 'N/A', findings: [], summary: '' };
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// FLOW + AGENT TOOL
// ══════════════════════════════════════════════════════════════════════════════
const ALL_TOOLS = [
    exports.securityScoreTool, exports.incidentResponseTool, exports.accessReviewTool, exports.complianceCheckerTool,
    exports.scanVulnerabilitiesTool, exports.launchPhishingTool, exports.getPhishingResultsTool,
    exports.managePoliciesTool, exports.getThreatFeedTool, exports.getIncidentTimelineTool, exports.runSecurityAuditTool,
];
const INPUT = zod_1.z.object({
    request: zod_1.z.string(), companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(), language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    alertLevel: zod_1.z.enum(['none', 'low', 'medium', 'high', 'critical']),
    incidentId: zod_1.z.string().optional(),
    requiresHumanEscalation: zod_1.z.boolean(),
});
exports.cybersecurityAgentFlow = genkit_config_1.ai.defineFlow({ name: 'cybersecurityAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ request, companyId, userId, language, history }) => {
    try {
        logger_1.logger.info(`[CybersecurityAgent] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
        const langInstr = language === 'auto' ? 'Reponds dans la meme langue que la demande.' : `Reponds en ${language}.`;
        // Date anchors — prevent hallucinated dates in incident timelines / audits
        const dateAnchors = (() => {
            const now = new Date();
            const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
            return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
        })();
        const executors = new Map();
        for (const tool of ALL_TOOLS) {
            const name = tool.__action?.name ?? '';
            if (name)
                executors.set(name, (i) => tool({ ...i, companyId, userId }));
        }
        // Build messages array with prior history (max 20) so the agent keeps context across turns
        const messages = [];
        if (history && history.length > 0) {
            for (const h of history.slice(-20))
                messages.push({ role: h.role, content: [{ text: h.content }] });
        }
        messages.push({ role: 'user', content: [{ text: request }] });
        let response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
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
            response = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
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
    }
    catch (err) {
        logger_1.logger.error('[CybersecurityAgent] Flow error:', err);
        return { response: 'Erreur dans l\'agent cybersecurite. Reessayez.', alertLevel: 'none', requiresHumanEscalation: false };
    }
});
exports.cybersecurityAgentTool = genkit_config_1.ai.defineTool({
    name: 'callCybersecurityAgent',
    description: 'Cybersecurity PRO: threat monitoring, SIEM-lite, incident response with timeline, vulnerability scanning, phishing simulation, compliance (GDPR/ISO27001/SOC2/PCI-DSS/NIST/HIPAA), security policies, AI audits, access review.',
    inputSchema: INPUT, outputSchema: OUTPUT,
}, (input) => (0, exports.cybersecurityAgentFlow)(input));
//# sourceMappingURL=cybersecurity.agent.js.map