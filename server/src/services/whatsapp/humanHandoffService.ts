/**
 * Human Handoff for WhatsApp conversations.
 *
 * Detects when a customer wants a human (or is too frustrated for the AI
 * to be useful) and posts a notification in the configured team channel
 * so a real person can take over. Stores the escalation in Firestore for
 * audit + stats.
 *
 * V1 detection: keyword-based. Two signals:
 *   - Explicit ("je veux un humain", "passe-moi un agent", "manager")
 *   - Frustration ("ça marche pas", "vous comprenez rien", "nul")
 *
 * The threshold setting controls how aggressive frustration detection is:
 *   - 'sensitive': triggers on any frustration keyword
 *   - 'normal':    needs explicit OR 2+ frustration signals in a row
 *   - 'strict':    only explicit demand triggers
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../utils/logger';

export type HandoffThreshold = 'sensitive' | 'normal' | 'strict';

export interface HumanHandoffSettings {
  enabled: boolean;
  notifyChannelId: string;       // team channel id where escalation is posted
  threshold: HandoffThreshold;
  customerReply?: string;         // what to tell the customer when handing off
}

// Keywords that trigger explicit handoff (user wants a human directly).
// Multilingual: French + English are the most common WhatsApp business cases.
// We accept short single-word triggers (humain, manager) as well as full phrases.
const EXPLICIT_KEYWORDS = [
  // FR — short triggers
  'humain', 'manager', 'vraie personne',
  // FR — phrases
  'je veux un humain', 'je veux parler à quelqu', "j'veux un humain",
  'parler à un agent', 'parler à un manager', 'parler à quelqu',
  'passe-moi un humain', 'passe moi un humain', 'passe moi quelqu',
  "j'ai besoin d'un humain", "j'ai besoin de parler à",
  'pas un bot', "j'en ai marre du bot", 'pas avec un robot',
  'parle à quelqu', 'donne moi un humain',
  // EN — short triggers
  'human please',
  // EN — phrases
  'i want a human', 'speak to a human', 'real person', 'real agent',
  'not a bot', 'talk to someone', 'human agent', 'speak to an agent',
  'speak to manager', 'real person please',
];

// Frustration markers — softer signal, requires multiple in a row depending on threshold.
const FRUSTRATION_KEYWORDS = [
  // FR
  'ça ne marche pas', 'ca marche pas', 'ne marche pas', 'tu comprends rien',
  "vous comprenez rien", "vous ne comprenez pas", 'tu comprends pas',
  "c'est nul", 'nul', 'inutile', "j'en ai marre", 'énervé', 'enerve',
  'je suis fâché', 'fâché', 'pas du tout ce que je veux', "n'est pas ce que",
  'arrête', "arrete de", "tu réponds n'importe quoi", 'absurde',
  // EN
  'this is not working', "doesn't work", 'not working', 'useless',
  'frustrated', 'angry', "you don't understand", 'understand nothing',
  'stupid bot', 'wrong answer', 'this is ridiculous',
];

function lc(s: string): string { return (s ?? '').toLowerCase().trim(); }

export interface DetectionResult {
  triggered: boolean;
  reason: 'explicit' | 'frustration' | null;
  matchedTerm?: string;
}

/**
 * Detect if a single message should trigger handoff.
 * For "frustration" detection above 'sensitive' threshold, the caller is
 * expected to provide recent history so we can count consecutive signals.
 */
export function detectEscalationIntent(
  text: string,
  threshold: HandoffThreshold = 'normal',
  recentFrustrationCount: number = 0,
): DetectionResult {
  const lowered = lc(text);
  if (!lowered) return { triggered: false, reason: null };

  for (const k of EXPLICIT_KEYWORDS) {
    if (lowered.includes(k)) return { triggered: true, reason: 'explicit', matchedTerm: k };
  }

  if (threshold === 'strict') return { triggered: false, reason: null };

  for (const k of FRUSTRATION_KEYWORDS) {
    if (lowered.includes(k)) {
      // 'sensitive' triggers on a single frustration hit.
      // 'normal' requires 2+ consecutive (current message + at least 1 prior).
      if (threshold === 'sensitive' || recentFrustrationCount >= 1) {
        return { triggered: true, reason: 'frustration', matchedTerm: k };
      }
      return { triggered: false, reason: 'frustration', matchedTerm: k };
    }
  }

  return { triggered: false, reason: null };
}

/**
 * Sends a WhatsApp notification to internal team admins (their own phone numbers).
 * Uses the company's own connected WhatsApp number to send. Best-effort.
 */
export async function notifyAdminsViaWhatsApp(args: {
  companyId: string;
  recipients: string[]; // admin phone numbers (e.g., ["+225...", "+33..."])
  text: string;
}): Promise<void> {
  const { companyId, recipients, text } = args;
  if (!recipients || recipients.length === 0) return;
  try {
    const { whatsappService } = await import('./whatsappService');
    const cfg = await whatsappService.getConfig(companyId);
    if (!cfg) return;
    for (const to of recipients) {
      try {
        await whatsappService.sendMessage(cfg, to, text);
      } catch (err) {
        logger.warn('[Handoff/WA] failed to notify admin via WhatsApp', { to, error: String(err) });
      }
    }
    logger.info('[Handoff/WA] admin WhatsApp notifs sent', { companyId, count: recipients.length });
  } catch (err) {
    logger.warn('[Handoff/WA] notifyAdminsViaWhatsApp failed', { error: String(err) });
  }
}

/**
 * Sends an email notification to the configured recipients (admins by default)
 * when an escalation triggers. Best-effort — never throws.
 */
export async function emailEscalationToAdmins(args: {
  companyId: string;
  customerPhone: string;
  customerName?: string;
  triggerMessage: string;
  reason: 'explicit' | 'frustration';
  notifyEmails?: string[]; // explicit list; if empty, fall back to all admins
}): Promise<void> {
  const { companyId, customerPhone, customerName, triggerMessage, reason, notifyEmails } = args;
  try {
    const db = getFirestore();
    let recipients = notifyEmails ?? [];
    if (recipients.length === 0) {
      // Fall back: any company member with role admin/owner
      const usersSnap = await db.collection('users').where('companyId', '==', companyId).limit(20).get();
      recipients = usersSnap.docs
        .map(d => d.data())
        .filter((u: any) => ['admin', 'owner'].includes(u.role) && u.email)
        .map((u: any) => u.email as string);
    }
    if (recipients.length === 0) return;

    const reasonLabel = reason === 'explicit' ? 'Demande explicite' : 'Frustration détectée';
    const subject = `🆘 Client WhatsApp en attente d'un humain — ${customerName ?? customerPhone}`;
    const body = `<p><strong>Un client demande un humain sur WhatsApp.</strong></p>
<ul>
  <li><strong>Numéro :</strong> +${customerPhone}</li>
  <li><strong>Nom :</strong> ${customerName ?? 'Inconnu'}</li>
  <li><strong>Raison :</strong> ${reasonLabel}</li>
  <li><strong>Message déclencheur :</strong><br><em>« ${triggerMessage.slice(0, 500)} »</em></li>
</ul>
<p>L'IA a temporairement passé la main. Réponds via WhatsApp ou via le canal Équipe d'escalade. Si personne ne répond dans 5 minutes, l'IA reprendra automatiquement avec un message empathique.</p>
<p style="color:#888;font-size:12px;margin-top:16px">— Orlode AI · Handoff</p>`;

    const { sendEmail } = await import('../email/emailService');
    for (const to of recipients) {
      try {
        await sendEmail({ companyId, to, subject, html: body });
      } catch (err) {
        logger.warn('[Handoff] email send failed for one recipient', { to, error: String(err) });
      }
    }
    logger.info('[Handoff] escalation emails sent', { companyId, count: recipients.length });
  } catch (err) {
    logger.warn('[Handoff] emailEscalationToAdmins failed', { error: String(err) });
  }
}

/**
 * Posts an escalation message into the configured team channel and records
 * the escalation in Firestore for audit + stats. Returns true on success.
 */
export async function notifyTeamOfEscalation(args: {
  companyId: string;
  channelId: string;
  customerPhone: string;
  customerName?: string;
  triggerMessage: string;
  reason: 'explicit' | 'frustration';
  recentHistory?: string[]; // last few messages, oldest-first, for context in the post
}): Promise<boolean> {
  const { companyId, channelId, customerPhone, customerName, triggerMessage, reason, recentHistory = [] } = args;

  try {
    const db = getFirestore();

    // 1. Write a message in the team channel — appears as an "agent" post so
    //    it shows up with the Orlode AI identity and is filterable.
    const reasonLabel = reason === 'explicit' ? 'demande explicite' : 'frustration détectée';
    const historyBlock = recentHistory.length > 0
      ? `\n\n**Derniers messages :**\n${recentHistory.map(m => `• ${m}`).join('\n')}`
      : '';

    const escalationContent =
      `🆘 **Intervention humaine requise** — ${reasonLabel}\n` +
      `Client : **${customerName ?? 'Inconnu'}** · ${customerPhone}\n` +
      `Dernier message : « ${triggerMessage.slice(0, 280)} »` +
      historyBlock +
      `\n\n_Réponds au client directement via WhatsApp ou via Conversations._`;

    const authorId = 'agent:orlode';
    const authorName = 'Orlode AI · Handoff';
    const msgRef = db.collection(`companies/${companyId}/channels/${channelId}/messages`).doc();
    await msgRef.set({
      content: escalationContent,
      authorId,
      authorName,
      authorPhoto: null,
      agentName: 'Handoff',
      attachments: [],
      createdBy: authorId,
      createdByName: authorName,
      createdByType: 'agent',
      escalation: true,
      escalationReason: reason,
      customerPhone,
      customerName: customerName ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(`companies/${companyId}/channels`).doc(channelId).update({
      lastMessage: '🆘 Intervention humaine requise',
      lastMessageBy: authorName,
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Audit log for stats (count last-7-days escalations)
    await db.collection(`companies/${companyId}/whatsappEscalations`).add({
      customerPhone,
      customerName: customerName ?? null,
      triggerMessage: triggerMessage.slice(0, 500),
      reason,
      channelId,
      messageId: msgRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info('[Handoff] notified team', { companyId, channelId, customerPhone, reason });
    return true;
  } catch (err) {
    logger.error('[Handoff] notifyTeamOfEscalation failed', { error: err instanceof Error ? err.message : err });
    return false;
  }
}

/**
 * Counts how many of the last N inbound messages from this customer matched
 * a frustration keyword. Used to decide whether to escalate under 'normal'
 * threshold (requires 2+ in a row).
 */
export async function recentFrustrationCount(
  companyId: string,
  customerPhone: string,
  lookback: number = 5,
): Promise<number> {
  try {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/whatsappMessages`)
      .where('from', '==', customerPhone)
      .where('direction', '==', 'inbound')
      .orderBy('createdAt', 'desc')
      .limit(lookback)
      .get();
    let count = 0;
    for (const doc of snap.docs) {
      const text = lc((doc.data()['message'] as string) ?? '');
      if (FRUSTRATION_KEYWORDS.some(k => text.includes(k))) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversation state machine
// ─────────────────────────────────────────────────────────────────────────────
//
// Each customer phone has a state doc that controls whether the AI replies:
//   - ai_active        : default, IA répond
//   - handoff_active   : escalade en cours, IA reste silencieuse
//   - handoff_timeout  : aucun humain n'a pris en X min → IA reprend avec ton doux
//   - handoff_resolved : un humain a cliqué "Reprendre IA" ou répondu manuellement
//
// Path: companies/{cid}/whatsappConversations/{phoneDigitsOnly}

export type ConversationStatus =
  | 'ai_active'
  | 'handoff_active'
  | 'handoff_timeout'
  | 'handoff_resolved';

const HANDOFF_TIMEOUT_MS = 5 * 60 * 1000; // 5 min — adjust later as setting

function convoDocRef(companyId: string, customerPhone: string) {
  const phoneKey = customerPhone.replace(/\D/g, '');
  return getFirestore().collection(`companies/${companyId}/whatsappConversations`).doc(phoneKey);
}

export async function getConversationStatus(
  companyId: string,
  customerPhone: string,
): Promise<{ status: ConversationStatus; lastEscalationAt?: Date | null }> {
  try {
    const doc = await convoDocRef(companyId, customerPhone).get();
    if (!doc.exists) return { status: 'ai_active' };
    const data = doc.data() ?? {};
    return {
      status: (data['status'] as ConversationStatus) ?? 'ai_active',
      lastEscalationAt: data['lastEscalationAt']?.toDate?.() ?? null,
    };
  } catch {
    return { status: 'ai_active' };
  }
}

export async function setConversationStatus(
  companyId: string,
  customerPhone: string,
  status: ConversationStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    await convoDocRef(companyId, customerPhone).set({
      status,
      customerPhone,
      ...extra,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    logger.info('[Handoff] conversation status', { companyId, customerPhone, status });
  } catch (err) {
    logger.error('[Handoff] setConversationStatus failed', { error: String(err) });
  }
}

/**
 * Decides what to do for an incoming customer message based on current state.
 *  - 'ai_should_run'      : run the orchestrator normally
 *  - 'ai_blocked'         : AI is silent, human is taking over (no reply)
 *  - 'ai_resumes_softly'  : timeout passed, AI takes back over with softer tone
 */
export async function decideConversationFlow(
  companyId: string,
  customerPhone: string,
): Promise<'ai_should_run' | 'ai_blocked' | 'ai_resumes_softly'> {
  const { status, lastEscalationAt } = await getConversationStatus(companyId, customerPhone);

  if (status === 'ai_active' || status === 'handoff_resolved') return 'ai_should_run';
  if (status === 'handoff_timeout') return 'ai_resumes_softly';

  if (status === 'handoff_active') {
    // Lazy timeout: if too much time has passed since escalation and no human
    // has resumed manually, promote to timeout so the AI can take back over.
    if (lastEscalationAt && Date.now() - lastEscalationAt.getTime() > HANDOFF_TIMEOUT_MS) {
      await setConversationStatus(companyId, customerPhone, 'handoff_timeout', {
        timeoutAt: FieldValue.serverTimestamp(),
      });
      return 'ai_resumes_softly';
    }
    return 'ai_blocked';
  }

  return 'ai_should_run';
}

/**
 * Cron job — runs every 1-2 minutes via Cloud Scheduler. For each conversation
 * in 'handoff_active' state where the escalation is older than HANDOFF_TIMEOUT_MS,
 * proactively sends a follow-up message to the customer ("Tous nos agents sont
 * occupés, je peux t'aider en attendant…") and flips the status to 'handoff_timeout'.
 *
 * This is the proactive version of the lazy timeout — it ensures a customer
 * never sits in silence even if they don't send a follow-up message themselves.
 */
export async function processTimeoutCron(): Promise<{ processed: number; promoted: number; errors: number }> {
  const stats = { processed: 0, promoted: 0, errors: 0 };
  try {
    const db = getFirestore();
    // Iterate companies — a single company doc per tenant
    const companiesSnap = await db.collection('companies').limit(500).get();
    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      const convosSnap = await db.collection(`companies/${companyId}/whatsappConversations`)
        .where('status', '==', 'handoff_active')
        .limit(100)
        .get();

      for (const convoDoc of convosSnap.docs) {
        stats.processed++;
        const convo = convoDoc.data();
        const lastEscalation = convo['lastEscalationAt']?.toDate?.();
        if (!lastEscalation) continue;
        if (Date.now() - lastEscalation.getTime() < HANDOFF_TIMEOUT_MS) continue;

        try {
          // Send the proactive follow-up via WhatsApp
          const customerPhone = convoDoc.id; // doc id = phone digits
          const { whatsappService } = await import('./whatsappService');
          const cfg = await whatsappService.getConfig(companyId);
          if (cfg) {
            const followUp =
              `🙏 Désolé pour l'attente — tous nos agents sont occupés pour le moment.\n\n` +
              `Je peux continuer à t'aider en attendant : pose-moi ta question, ou laisse-moi ton nom et la nature de ta demande, ` +
              `et un humain te recontacte dès qu'il est dispo.`;
            await whatsappService.sendMessage(cfg, customerPhone, followUp).catch(() => null);
          }

          await convoDoc.ref.set({
            status: 'handoff_timeout',
            timeoutAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          stats.promoted++;
          logger.info('[Handoff/Cron] promoted to timeout', { companyId, customerPhone });
        } catch (err) {
          stats.errors++;
          logger.warn('[Handoff/Cron] failed to promote', { error: String(err) });
        }
      }
    }
  } catch (err) {
    logger.error('[Handoff/Cron] sweep failed', { error: String(err) });
  }
  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead capture
// ─────────────────────────────────────────────────────────────────────────────

export interface WhatsAppLead {
  customerPhone: string;
  name?: string;
  need?: string;
  urgency?: 'low' | 'normal' | 'high' | 'urgent';
  source: 'handoff_timeout' | 'voluntary' | 'agent';
  status: 'new' | 'contacted' | 'closed_won' | 'closed_lost';
  notes?: string;
  assigneeId?: string;       // uid of the team member who took ownership
  assigneeName?: string;     // display name for UI
  firstContactedAt?: Date;   // set automatically when status moves to 'contacted'
  closedAt?: Date;           // set when status moves to closed_won/closed_lost
}

export async function captureWhatsAppLead(
  companyId: string,
  lead: WhatsAppLead,
): Promise<string | null> {
  try {
    const db = getFirestore();
    const ref = db.collection(`companies/${companyId}/whatsappLeads`).doc();
    await ref.set({
      ...lead,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info('[Handoff/Lead] captured', { companyId, customerPhone: lead.customerPhone });
    return ref.id;
  } catch (err) {
    logger.error('[Handoff/Lead] capture failed', { error: String(err) });
    return null;
  }
}

/**
 * Soft-tone prompt suffix injected when the AI takes over after a timeout.
 * Appended to the system prompt for that one reply only.
 */
export const SOFT_RESUME_PROMPT_SUFFIX = `

⚠️ CONTEXTE — REPRISE APRÈS HANDOFF
Le client a demandé un humain mais personne n'est encore disponible. Tu dois :
1. Reconnaître la situation avec empathie ("Je comprends que tu attends quelqu'un de notre équipe…")
2. Proposer de continuer à aider EN ATTENDANT ("…en attendant qu'ils prennent le relais, je peux peut-être déjà t'aider sur ta demande")
3. OU proposer de prendre ses infos pour rappel ("…ou tu peux me laisser ton nom et la nature de ta demande, et un humain te rappelle dès que possible")

📝 CAPTURE LEAD — IMPORTANT
Si le client te donne son nom, sa demande, ou son urgence pendant cette conversation, APPELLE le tool captureWhatsAppLead avec ces infos. Ne demande JAMAIS deux fois la même info — extrait ce que tu as déjà du contexte. Une fois le lead capturé, dis : "C'est noté, un humain te recontacte dès que possible 🙏".

Ton chaleureux, jamais robotique. Pas d'excuses interminables — efficace.`;
