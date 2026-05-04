/**
 * Security Automation Engine — Notifications, Auto-Remediation, Cross-Agent Linking
 *
 * Flow:
 *   Phishing fail → incident + notification + formation auto
 *   Vuln critique  → notification + ticket IT auto
 *   Data breach    → notification + dossier juridique
 *   Score drop     → notification admins
 *   Compte compromis → desactiver + force reset + notification
 */
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../utils/helpers';
import { createNotification } from './notificationService';
import { logger } from '../utils/logger';

// ══════════════════════════════════════════════════════════════════════════════
// 1. SECURITY NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

/** Notify all admins of a security event */
async function notifyAdmins(companyId: string, title: string, message: string, severity: 'info' | 'warning' | 'error', actionUrl: string) {
  const db = getFirestore();
  const admins = await db.collection('users').where('companyId', '==', companyId).where('role', 'in', ['admin', 'superadmin', 'manager']).limit(20).get();
  for (const admin of admins.docs) {
    createNotification({ companyId, userId: admin.id, type: 'security_alert', title, message, severity, actionUrl, icon: 'ShieldAlert' }).catch(() => {});
  }
}

/** Called when a new security incident is created */
export async function onIncidentCreated(companyId: string, incident: { id: string; type: string; priority: string; description: string; affectedSystems?: string[] }) {
  const isCritical = incident.priority.includes('P1');
  const isHigh = incident.priority.includes('P2');

  if (isCritical || isHigh) {
    await notifyAdmins(companyId,
      isCritical ? '🚨 INCIDENT CRITIQUE' : '⚠️ Incident haute priorite',
      `${incident.type}: ${incident.description.slice(0, 100)}`,
      isCritical ? 'error' : 'warning',
      '/security/incidents'
    );
    logger.info(`[SecurityAutomation] Alert sent for ${incident.priority} incident ${incident.id}`);
  }

  // Cross-link: data breach → create legal case
  if (incident.type === 'data_breach') {
    await createLegalCase(companyId, incident);
  }

  // Cross-link: incident on IT system → create IT ticket
  if (incident.affectedSystems && incident.affectedSystems.length > 0) {
    await createITTicketFromIncident(companyId, incident);
  }
}

/** Called when a critical vulnerability is detected */
export async function onVulnerabilityDetected(companyId: string, vuln: { cve: string; severity: string; asset: string; description: string }) {
  if (vuln.severity === 'critical' || vuln.severity === 'high') {
    await notifyAdmins(companyId,
      `Vulnerabilite ${vuln.severity}: ${vuln.cve}`,
      `${vuln.asset}: ${vuln.description.slice(0, 100)}`,
      vuln.severity === 'critical' ? 'error' : 'warning',
      '/security/vulnerabilities'
    );

    // Cross-link: create IT ticket for remediation
    await createITTicketFromVuln(companyId, vuln);
  }
}

/** Called when phishing campaign results are in */
export async function onPhishingResult(companyId: string, campaign: { id: string; name: string; clickedCount: number; targetCount: number; clickedUserIds?: string[] }) {
  const clickRate = campaign.targetCount > 0 ? Math.round(campaign.clickedCount / campaign.targetCount * 100) : 0;

  if (clickRate > 30) {
    await notifyAdmins(companyId,
      'Phishing: taux de clic eleve',
      `Campagne "${campaign.name}": ${clickRate}% des employes ont clique. Formation recommandee.`,
      'warning',
      '/security/phishing'
    );
  }

  // Cross-link: assign training to users who clicked
  if (campaign.clickedUserIds && campaign.clickedUserIds.length > 0) {
    await assignSecurityTraining(companyId, campaign.clickedUserIds, 'phishing');
  }
}

/** Called when security score changes significantly */
export async function onScoreChange(companyId: string, newScore: number, prevScore: number) {
  const drop = prevScore - newScore;
  if (drop >= 10) {
    await notifyAdmins(companyId,
      'Score securite en baisse',
      `Le score est passe de ${prevScore} a ${newScore} (-${drop} points). Actions requises.`,
      drop >= 20 ? 'error' : 'warning',
      '/security'
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. AUTO-REMEDIATION
// ══════════════════════════════════════════════════════════════════════════════

/** Disable a compromised user account */
export async function disableCompromisedAccount(companyId: string, userId: string, reason: string) {
  const db = getFirestore();
  await db.collection('users').doc(userId).update({
    status: 'disabled', disabledAt: new Date(), disabledReason: reason,
  });

  // Log remediation action
  await logRemediationAction(companyId, 'account_disabled', userId, reason);

  // Notify the user and admins
  createNotification({ companyId, userId, type: 'security_alert', title: 'Compte desactive', message: `Votre compte a ete desactive pour raison de securite: ${reason}. Contactez l'administrateur.`, severity: 'error', actionUrl: '/security', icon: 'UserX' }).catch(() => {});
  await notifyAdmins(companyId, 'Compte desactive (auto)', `Compte ${userId} desactive: ${reason}`, 'warning', '/security/access');

  logger.info(`[SecurityAutomation] Account ${userId} disabled: ${reason}`);
}

/** Force password reset for a user */
export async function forcePasswordReset(companyId: string, userId: string, reason: string) {
  const db = getFirestore();
  await db.collection('users').doc(userId).update({
    forcePasswordReset: true, forceResetReason: reason, forceResetAt: new Date(),
  });

  await logRemediationAction(companyId, 'password_reset_forced', userId, reason);

  createNotification({ companyId, userId, type: 'security_alert', title: 'Reset mot de passe requis', message: `Vous devez changer votre mot de passe: ${reason}`, severity: 'warning', actionUrl: '/settings/security', icon: 'Key' }).catch(() => {});

  logger.info(`[SecurityAutomation] Force password reset for ${userId}: ${reason}`);
}

/** Isolate an asset (mark as quarantined) */
export async function isolateAsset(companyId: string, assetName: string, reason: string) {
  const db = getFirestore();
  const id = generateId();
  await db.collection(`companies/${companyId}/quarantinedAssets`).doc(id).set({
    id, asset: assetName, reason, status: 'quarantined',
    isolatedAt: FieldValue.serverTimestamp(),
  });

  await logRemediationAction(companyId, 'asset_isolated', assetName, reason);
  await notifyAdmins(companyId, `Asset isole: ${assetName}`, reason, 'error', '/security/incidents');

  logger.info(`[SecurityAutomation] Asset ${assetName} isolated: ${reason}`);
}

/** Log a remediation action for audit trail */
async function logRemediationAction(companyId: string, action: string, target: string, reason: string) {
  const db = getFirestore();
  await db.collection(`companies/${companyId}/remediationLog`).doc(generateId()).set({
    action, target, reason, automated: true, timestamp: FieldValue.serverTimestamp(),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. CROSS-AGENT LINKING
// ══════════════════════════════════════════════════════════════════════════════

/** Security → Training: assign cybersecurity course to users who failed phishing */
async function assignSecurityTraining(companyId: string, userIds: string[], reason: 'phishing' | 'incident' | 'compliance') {
  const db = getFirestore();

  // Find or create a security training course
  const coursesSnap = await db.collection(`companies/${companyId}/trainingCourses`)
    .where('category', '==', 'security').where('status', '==', 'published').limit(1).get();

  let courseId: string;
  if (coursesSnap.empty) {
    // Auto-create a cybersecurity course
    courseId = generateId();
    await db.collection(`companies/${companyId}/trainingCourses`).doc(courseId).set({
      id: courseId, title: 'Cybersecurite : Phishing et bonnes pratiques',
      topic: 'cybersecurite phishing', category: 'security', difficulty: 'beginner',
      duration: '30min', status: 'published',
      modules: [
        { title: 'Reconnaitre un email de phishing', content: 'Les emails de phishing imitent des communications legitimes. Verifiez toujours l\'expediteur, les liens, et ne cliquez jamais sur des liens suspects.', duration: '10min', type: 'text', order: 0, contentBlocks: [{ type: 'text', value: 'Les emails de phishing imitent des communications legitimes. Verifiez toujours l\'expediteur, les liens, et ne cliquez jamais sur des liens suspects.' }] },
        { title: 'Bonnes pratiques mot de passe', content: 'Utilisez des mots de passe forts et uniques. Activez le MFA. Ne reutilisez jamais un mot de passe.', duration: '10min', type: 'text', order: 1, contentBlocks: [{ type: 'text', value: 'Utilisez des mots de passe forts et uniques. Activez le MFA. Ne reutilisez jamais un mot de passe.' }] },
        { title: 'Signaler un incident', content: 'Si vous detectez une activite suspecte, signalez-la immediatement a l\'equipe securite via le bouton "Declarer un incident".', duration: '10min', type: 'text', order: 2, contentBlocks: [{ type: 'text', value: 'Si vous detectez une activite suspecte, signalez-la immediatement a l\'equipe securite.' }] },
      ],
      enrolledCount: 0, completedCount: 0, avgScore: 0, isMultimedia: false,
      autoAssigned: true, assignReason: reason,
      createdAt: new Date(), updatedAt: new Date(),
    });
    logger.info(`[SecurityAutomation] Auto-created security training course ${courseId}`);
  } else {
    courseId = coursesSnap.docs[0].id;
  }

  // Assign to each user
  let assigned = 0;
  for (const userId of userIds) {
    // Check not already assigned
    const existing = await db.collection(`companies/${companyId}/trainingProgress`)
      .where('userId', '==', userId).where('courseId', '==', courseId).limit(1).get();
    if (!existing.empty) continue;

    const id = generateId();
    await db.collection(`companies/${companyId}/trainingProgress`).doc(id).set({
      id, courseId, userId, status: 'assigned', completionPct: 0, score: 0,
      assignedAt: new Date(), autoAssigned: true, assignReason: `security_${reason}`,
    });

    createNotification({ companyId, userId, type: 'system', title: 'Formation securite assignee', message: `Une formation cybersecurite vous a ete assignee suite a un test de phishing. Completez-la pour renforcer vos competences.`, severity: 'warning', actionUrl: '/training', icon: 'GraduationCap' }).catch(() => {});

    assigned++;
  }

  await db.collection(`companies/${companyId}/trainingCourses`).doc(courseId).update({
    enrolledCount: FieldValue.increment(assigned),
  }).catch(() => {});

  logger.info(`[SecurityAutomation] Assigned security training to ${assigned} users (reason: ${reason})`);
}

/** Security → IT: create IT ticket from security incident */
async function createITTicketFromIncident(companyId: string, incident: { id: string; type: string; priority: string; description: string; affectedSystems?: string[] }) {
  const db = getFirestore();
  const id = generateId();
  const itPriority = incident.priority.includes('P1') ? 'critical' : incident.priority.includes('P2') ? 'high' : 'medium';

  await db.collection(`companies/${companyId}/itTickets`).doc(id).set({
    id, title: `[SECURITE] ${incident.type}: ${incident.description.slice(0, 80)}`,
    description: `Ticket auto-genere depuis incident securite #${incident.id}.\n\nType: ${incident.type}\nPriorite: ${incident.priority}\nSystemes: ${(incident.affectedSystems ?? []).join(', ')}\n\nDescription: ${incident.description}`,
    category: 'security', priority: itPriority,
    status: 'open', assignee: null,
    source: 'security_automation', securityIncidentId: incident.id,
    createdAt: new Date(), updatedAt: new Date(),
  });

  logger.info(`[SecurityAutomation] Created IT ticket ${id} from security incident ${incident.id}`);
}

/** Security → IT: create IT ticket from vulnerability */
async function createITTicketFromVuln(companyId: string, vuln: { cve: string; severity: string; asset: string; description: string }) {
  const db = getFirestore();
  const id = generateId();

  await db.collection(`companies/${companyId}/itTickets`).doc(id).set({
    id, title: `[VULN ${vuln.severity.toUpperCase()}] ${vuln.cve} — ${vuln.asset}`,
    description: `Ticket auto-genere pour vulnerabilite detectee.\n\nCVE: ${vuln.cve}\nSeverite: ${vuln.severity}\nAsset: ${vuln.asset}\n\n${vuln.description}`,
    category: 'security', priority: vuln.severity === 'critical' ? 'critical' : 'high',
    status: 'open', assignee: null,
    source: 'security_automation', cve: vuln.cve,
    createdAt: new Date(), updatedAt: new Date(),
  });

  logger.info(`[SecurityAutomation] Created IT ticket for ${vuln.cve}`);
}

/** Security → Legal: create legal case from data breach */
async function createLegalCase(companyId: string, incident: { id: string; type: string; description: string }) {
  const db = getFirestore();
  const id = generateId();

  await db.collection(`companies/${companyId}/legalCases`).doc(id).set({
    id, title: `[BREACH] Fuite de donnees — Incident #${incident.id}`,
    description: `Dossier juridique auto-genere suite a un incident de type "${incident.type}".\n\nNotification RGPD requise sous 72h.\n\n${incident.description}`,
    type: 'data_breach', status: 'open', priority: 'urgent',
    securityIncidentId: incident.id,
    rgpdDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(), updatedAt: new Date(),
  });

  await notifyAdmins(companyId,
    'Dossier juridique cree (data breach)',
    `Un dossier juridique a ete cree automatiquement. Notification RGPD requise sous 72h.`,
    'error', '/legal'
  );

  logger.info(`[SecurityAutomation] Created legal case ${id} from data breach incident ${incident.id}`);
}

/** Security → Support: create support ticket when client data is affected */
export async function createSupportTicketFromIncident(companyId: string, incident: { id: string; type: string; description: string }) {
  const db = getFirestore();
  const id = generateId();

  await db.collection(`companies/${companyId}/supportTickets`).doc(id).set({
    id, subject: `[SECURITE] Impact client — ${incident.type}`,
    description: `Ticket support auto-genere suite a un incident securite pouvant affecter les clients.\n\nIncident: #${incident.id}\n${incident.description}`,
    priority: 'high', status: 'open', category: 'security',
    source: 'security_automation', securityIncidentId: incident.id,
    createdAt: new Date(), updatedAt: new Date(),
  });

  logger.info(`[SecurityAutomation] Created support ticket ${id} from security incident ${incident.id}`);
}
