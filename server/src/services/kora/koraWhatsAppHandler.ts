/**
 * Kora WhatsApp handler — keyword-triggered session, isolated from the
 * Commerce/Orchestrator flow so PMEs can keep using the same business number.
 *
 * Activation modes (any one of them is enough):
 *   1. Inbound message matches a Kora trigger keyword: "kora", "/kora", "salut kora", "hey kora".
 *   2. The sender has an active koraSession (no exit phrase + last interaction < 30 min).
 *
 * Deactivation: user says "fini", "stop kora", "merci kora", "bye kora", OR 30 min idle.
 *
 * The handler returns:
 *   - `handled: true`  → Kora replied; caller MUST skip Commerce/Orchestrator.
 *   - `handled: false` → not a Kora flow; caller proceeds with normal routing.
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { koraReply } from './koraChatService';
import { getOrCreateProfile, updateProfile } from './koraMemoryService';
import { logger } from '../../utils/logger';

// Two trigger styles:
//   ONE_SHOT_RE — "@kora note ça" — owner-style command, no session lock.
//   SESSION_RE  — "salut kora" / "kora" — opens a 30 min conversational session.
// Universal "kora" name works for everyone; we also accept the user's chosen
// assistant name once we've resolved them by phone.
const ONE_SHOT_RE = /^\s*@kora\b/i;
const SESSION_RE  = /^\s*(\/?kora|salut\s+kora|hey\s+kora|coucou\s+kora|bonjour\s+kora)\b/i;
const EXIT_RE     = /^\s*(fini|stop\s*kora|merci\s+kora|bye\s+kora|ciao\s+kora|fin\s+kora|kora\s+stop)\b/i;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min idle window

/**
 * Build per-user trigger regexes that accept their chosen assistant name —
 * both as "@léa note ça" (one-shot) and "salut léa" (session).
 */
function customNameTriggers(name: string | null | undefined): { oneShot: RegExp | null; session: RegExp | null } {
  const n = (name || '').trim();
  if (!n || n.toLowerCase() === 'kora') return { oneShot: null, session: null };
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    oneShot: new RegExp(`^\\s*@${escaped}\\b`, 'i'),
    session: new RegExp(`^\\s*(\\/?${escaped}|salut\\s+${escaped}|hey\\s+${escaped}|coucou\\s+${escaped}|bonjour\\s+${escaped})\\b`, 'i'),
  };
}

export interface KoraWhatsAppResult {
  handled: boolean;
  reply?: string;
}

/**
 * Resolve which uid this WhatsApp number belongs to inside the given company.
 * We look for koraProfiles whose phoneE164 matches the inbound number.
 */
async function resolveUidByPhone(companyId: string, fromPhoneE164: string): Promise<string | null> {
  if (!fromPhoneE164) return null;
  const norm = fromPhoneE164.replace(/\D/g, '');
  if (!norm) return null;
  try {
    const db = getFirestore();
    // Try a direct match first (faster path when phoneE164 is normalised consistently).
    const snap = await db.collection(`companies/${companyId}/koraProfiles`)
      .where('phoneE164', 'in', [fromPhoneE164, `+${norm}`, norm])
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;
    // Fallback: scan a small batch and normalise digits server-side.
    const fallback = await db.collection(`companies/${companyId}/koraProfiles`).limit(50).get();
    const hit = fallback.docs.find(d => String((d.data() as any).phoneE164 ?? '').replace(/\D/g, '') === norm);
    return hit?.id ?? null;
  } catch (err) {
    logger.warn('[Kora] resolveUidByPhone failed', { companyId, error: String(err) });
    return null;
  }
}

interface SessionDoc {
  active: boolean;
  uid: string;
  lastMessageAt: any;
}

async function readSession(companyId: string, fromKey: string): Promise<SessionDoc | null> {
  try {
    const snap = await getFirestore().doc(`companies/${companyId}/koraWaSessions/${fromKey}`).get();
    return snap.exists ? (snap.data() as SessionDoc) : null;
  } catch { return null; }
}

/**
 * 3-way intent classifier (business | admin | kora) for the `auto` routing
 * mode. Order matters — admin and business markers WIN over personal ones so
 * sensitive flows (OTP, "@admin valider", payment confirmations) never get
 * hijacked by Kora.
 *
 * Upgrade path: replace with a single Gemini Flash call (~$0.0001/msg) when
 * the heuristic misses edge cases.
 */
type Intent = 'business' | 'admin' | 'kora';

function classifyOwnerMessage(message: string): Intent {
  const msg = message.trim();

  // 1. Admin / sensitive — never Kora.
  if (/^\s*@admin\b/i.test(msg)) return 'admin';
  if (/^\s*\d{4,6}\s*$/.test(msg)) return 'admin';                  // bare OTP code
  if (/\b(otp|code\s+(de\s+)?confirmation|valider\s+la\s+commande|confirme\s+le\s+paiement|annuler\s+la\s+commande)\b/i.test(msg)) return 'admin';

  // 2. Business — commerce/customer-flow language.
  if (/\b(prix|tarif|disponible|en\s+stock|livraison|commande|facture|r[ée]server|catalogue|offre|devis|paiement|wave|orange\s*money|cash|combien\s+coûte|c'est\s+combien|menu|chambre)\b/i.test(msg)) return 'business';

  // 3. Kora — personal markers.
  if (/\b(rappelle[- ]moi|note\s+que|j'ai\s+oubli[ée]|j'ai\s+un\s+rdv|demain\s+je|hier\s+je|je\s+(suis|me\s+sens)\s+(fatigu[ée]|content|stress[eé]?|[ée]puis[eé]|seul|triste|heureux)|je\s+galère|aide[- ]moi\s+à\s+organiser|tu\s+te\s+souviens|comment\s+je\s+vais|qu'est[- ]ce\s+que\s+tu\s+sais\s+de\s+moi|j'ai\s+besoin\s+de\s+(parler|réfléchir)|note\s+ça|enregistre\s+ça)\b/i.test(msg)) return 'kora';

  // Default — let normal commerce/orchestrator handle.
  return 'business';
}

/** Legacy helper kept for clarity at call sites. */
function looksPersonal(message: string): boolean {
  return classifyOwnerMessage(message) === 'kora';
}

async function writeSession(companyId: string, fromKey: string, uid: string, active: boolean): Promise<void> {
  await getFirestore().doc(`companies/${companyId}/koraWaSessions/${fromKey}`).set(
    { uid, active, lastMessageAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/**
 * Decide whether this inbound message should be handled by Kora and, if so,
 * generate the reply. Caller (the WhatsApp webhook) sends the reply if
 * `handled` is true.
 */
export async function tryHandleKoraWhatsApp(params: {
  companyId: string;
  fromPhoneE164: string;
  message: string;
}): Promise<KoraWhatsAppResult> {
  const { companyId, fromPhoneE164, message } = params;
  if (!message || !companyId) return { handled: false };

  const fromKey = fromPhoneE164.replace(/\D/g, '');
  const session = await readSession(companyId, fromKey);

  const isExit = EXIT_RE.test(message);
  let isOneShot = ONE_SHOT_RE.test(message);   // "@kora note ça"
  let isSession = SESSION_RE.test(message);    // "salut kora", "kora"

  // Decide whether we treat this turn as Kora.
  const sessionFresh = session?.active === true
    && session.lastMessageAt
    && (Date.now() - (session.lastMessageAt.toDate?.() ?? new Date(session.lastMessageAt)).getTime?.()) < SESSION_TTL_MS;

  if (isExit && session?.uid) {
    await writeSession(companyId, fromKey, session.uid, false);
    return { handled: true, reply: 'Ok, je m\'efface. À tout moment, dis "kora" et je reviens.' };
  }

  // Resolve the user — needed both to look up a custom assistant name and to
  // run the reply. Either from an active session, or by phone match.
  let uid = session?.uid;
  if (!uid) {
    uid = (await resolveUidByPhone(companyId, fromPhoneE164)) || undefined;
  }

  // If the user has a custom assistant name, accept it as a trigger too.
  // Both "@léa ..." (one-shot) and "salut léa" (session) work after resolution.
  if ((!isOneShot && !isSession) && uid) {
    try {
      const profilePeek = await getOrCreateProfile({ uid, companyId });
      const { oneShot, session: sessionRe } = customNameTriggers(profilePeek.assistantName);
      if (oneShot && oneShot.test(message)) isOneShot = true;
      if (!isOneShot && sessionRe && sessionRe.test(message)) isSession = true;
    } catch { /* fall through */ }
  }

  // @-mention is OWNER-ONLY. If the sender isn't a known Kora user in this
  // company, we silently ignore — they're treated as a regular customer and
  // the normal commerce/orchestrator flow takes over.
  if (isOneShot && !uid) return { handled: false };

  // No explicit trigger, no fresh session → check the owner-routing setting.
  // Customers (uid not resolved) always go through the normal flow.
  if (!isOneShot && !isSession && !sessionFresh) {
    if (!uid) return { handled: false };
    try {
      const profilePeek = await getOrCreateProfile({ uid, companyId });
      const routing = profilePeek.ownerMessageRouting ?? 'business';
      if (routing === 'personal') {
        // Owner has set the line as personal — every inbound from them is Kora.
        isOneShot = true;
      } else if (routing === 'auto') {
        if (looksPersonal(message)) {
          isOneShot = true;
        } else {
          return { handled: false }; // classifier says business → normal flow
        }
      } else {
        // 'business' default — without an explicit @kora, stay out.
        return { handled: false };
      }
    } catch {
      return { handled: false };
    }
  }

  // Session-mode trigger from an unknown number: gentle nudge to set up.
  if ((isSession && !uid)) {
    return {
      handled: true,
      reply: "Je suis Kora, ton compagnon personnel. Pour que je te reconnaisse, ouvre l'app Orlode > /agents/kora et associe ton numéro.",
    };
  }

  if (!uid) return { handled: false };

  // Make sure the profile exists and is enabled. Auto-create with the phone bound.
  const profile = await getOrCreateProfile({ uid, companyId, defaults: { phoneE164: fromPhoneE164 } });
  if (!profile.enabled) return { handled: false };
  // Subscription gate — silently bail when the trial has lapsed or the user
  // never activated. We don't reply (no spam); the message falls through to
  // commerce/orchestrator as if Kora wasn't here.
  const subStatus = profile.subscriptionStatus ?? 'none';
  if (subStatus === 'none' || subStatus === 'expired') return { handled: false };
  if (subStatus === 'trial' && profile.trialStartedAt) {
    const started = profile.trialStartedAt?.toDate?.() ?? new Date(profile.trialStartedAt);
    const days = (Date.now() - started.getTime()) / 86_400_000;
    if (days >= 7) {
      await updateProfile(uid, companyId, { subscriptionStatus: 'expired' });
      return { handled: false };
    }
  }
  if (!profile.phoneE164) {
    await updateProfile(uid, companyId, { phoneE164: fromPhoneE164 });
  }

  // Strip the trigger word so the model focuses on the real content.
  const { oneShot: customOneShot, session: customSession } = customNameTriggers(profile.assistantName);
  let cleaned = message;
  if (isOneShot) {
    cleaned = cleaned.replace(ONE_SHOT_RE, '').trim();
    if (customOneShot) cleaned = cleaned.replace(customOneShot, '').trim();
  } else if (isSession) {
    cleaned = cleaned.replace(SESSION_RE, '').trim();
    if (customSession) cleaned = cleaned.replace(customSession, '').trim();
  }
  const userMessage = cleaned || `Salut ${profile.assistantName || 'Kora'}.`;

  const result = await koraReply({ uid, companyId, userMessage });

  // ONE-SHOT mode (@kora ...) doesn't open a session — next message goes
  // straight back to commerce / orchestrator. Only "salut kora" opens a 30 min
  // conversational session.
  if (isSession || sessionFresh) {
    await writeSession(companyId, fromKey, uid, true);
  }
  return { handled: true, reply: result.text };
}
