/**
 * Kora — Standalone (B2C) mode.
 *
 * For users who are NOT part of an Orlode workspace and just want Kora as a
 * personal companion via WhatsApp. They text the dedicated Kora WhatsApp
 * Business number; we identify them by phoneE164.
 *
 * Implementation trick: every standalone user lives under a synthetic company
 * `_standalone` inside Firestore (`companies/_standalone/koraProfiles/{phoneKey}/...`).
 * This lets us reuse the entire koraMemoryService + koraSystemPrompt + koraChatService
 * stack without forking. When a B2C user later upgrades to a real Orlode tenant,
 * we copy the documents over with their new companyId — the memory survives.
 *
 * Lifecycle:
 *   inbound → resolveStandaloneProfile → if first-time, walk onboarding state machine
 *   ↓
 *   if onboarding done → check trial/paywall → koraReply()
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import {
  KoraProfile,
  getOrCreateProfile,
  updateProfile,
} from './koraMemoryService';
import { koraReply, KoraReplyResult } from './koraChatService';
import { logger } from '../../utils/logger';

export const STANDALONE_COMPANY_ID = '_standalone';
export const TRIAL_DAYS = 7;

export type OnboardingStep = 'ask_firstname' | 'ask_assistant_name' | 'ask_language' | 'ready';

export interface StandaloneState {
  /** Where we are in the onboarding conversation. */
  onboardingStep: OnboardingStep;
  /** Trial started at this date (UTC). */
  trialStartedAt: Date | null;
  /** "trialing" | "active" | "trial_expired" | "cancelled" */
  subscriptionStatus: 'trialing' | 'active' | 'trial_expired' | 'cancelled';
  /** Optional Stripe subscription id once they upgrade. */
  stripeSubscriptionId: string | null;
}

interface StandaloneDoc extends StandaloneState {
  phoneE164: string;
  createdAt: any;
  updatedAt: any;
}

/** Normalise a phone number to a Firestore-safe key. */
function phoneKey(phoneE164: string): string {
  return phoneE164.replace(/[^0-9]/g, '');
}

/** Path to the standalone state document for this phone. */
function stateDocPath(phoneE164: string): string {
  return `companies/${STANDALONE_COMPANY_ID}/koraStandaloneState/${phoneKey(phoneE164)}`;
}

async function readStandaloneState(phoneE164: string): Promise<StandaloneDoc | null> {
  try {
    const snap = await getFirestore().doc(stateDocPath(phoneE164)).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return {
      phoneE164: data.phoneE164,
      onboardingStep: data.onboardingStep ?? 'ask_firstname',
      trialStartedAt: data.trialStartedAt?.toDate?.() ?? null,
      subscriptionStatus: data.subscriptionStatus ?? 'trialing',
      stripeSubscriptionId: data.stripeSubscriptionId ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (err) {
    logger.warn('[KoraStandalone] readState failed', { error: String(err) });
    return null;
  }
}

async function writeStandaloneState(phoneE164: string, patch: Partial<StandaloneDoc>): Promise<void> {
  await getFirestore().doc(stateDocPath(phoneE164)).set(
    { ...patch, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/** Days remaining in the free trial (negative if expired). */
function trialDaysRemaining(state: StandaloneDoc): number {
  if (!state.trialStartedAt) return TRIAL_DAYS;
  const elapsedDays = (Date.now() - state.trialStartedAt.getTime()) / 86_400_000;
  return TRIAL_DAYS - Math.floor(elapsedDays);
}

/**
 * Top-level: handle one inbound WhatsApp message for a standalone user.
 * Returns the text to reply with.
 */
export async function processStandaloneInbound(params: {
  phoneE164: string;
  message: string;
}): Promise<{ reply: string; sessionId?: string }> {
  const { phoneE164, message } = params;
  const uid = phoneKey(phoneE164);

  // 1. Bootstrap state + profile if first contact.
  let state = await readStandaloneState(phoneE164);
  if (!state) {
    await writeStandaloneState(phoneE164, {
      phoneE164,
      onboardingStep: 'ask_firstname',
      trialStartedAt: null,
      subscriptionStatus: 'trialing',
      stripeSubscriptionId: null,
      createdAt: FieldValue.serverTimestamp(),
    } as any);
    // Also create the underlying KoraProfile (firstName empty for now).
    await getOrCreateProfile({
      uid,
      companyId: STANDALONE_COMPANY_ID,
      defaults: { phoneE164, assistantName: 'Kora' },
    });
    return {
      reply:
        "Salut. Je suis Kora — ton compagnon personnel sur WhatsApp.\n\nJe me souviendrai de ce que tu me dis, je te poserai des questions de suivi, et je t'enverrai un check-in matinal quand il y a une vraie raison.\n\nPour commencer : comment je peux t'appeler ?",
    };
  }

  // 2. Walk the onboarding state machine.
  if (state.onboardingStep !== 'ready') {
    return await advanceOnboarding(phoneE164, uid, state, message);
  }

  // 3. Check trial / subscription gate.
  const days = trialDaysRemaining(state);
  if (state.subscriptionStatus === 'trial_expired' || (state.subscriptionStatus === 'trialing' && days <= 0)) {
    if (state.subscriptionStatus === 'trialing') {
      await writeStandaloneState(phoneE164, { subscriptionStatus: 'trial_expired' });
    }
    return {
      reply:
        "Ton essai de 7 jours est terminé. Pour continuer (et garder tout ce que je sais de toi) : https://orlode.com/kora/upgrade?phone=" +
        encodeURIComponent(phoneE164) +
        "\n\nÀ tout moment, écris UPGRADE pour le lien.",
    };
  }

  // Allow the user to ask for the upgrade link explicitly.
  if (/^upgrade\b/i.test(message.trim())) {
    return {
      reply: "Lien d'upgrade : https://orlode.com/kora/upgrade?phone=" + encodeURIComponent(phoneE164),
    };
  }

  // 4. Normal chat — delegate to the reusable chat service.
  const reply: KoraReplyResult = await koraReply({
    uid,
    companyId: STANDALONE_COMPANY_ID,
    userMessage: message,
  });

  // Light upsell: if user is in last 2 days of trial, append a soft nudge.
  let suffix = '';
  if (state.subscriptionStatus === 'trialing' && days <= 2 && days >= 0) {
    suffix = `\n\n_(Plus que ${days} jour${days > 1 ? 's' : ''} d'essai. Tape UPGRADE quand tu veux continuer.)_`;
  }

  return { reply: reply.text + suffix, sessionId: reply.sessionId };
}

/**
 * Step the onboarding state machine using the user's latest reply.
 */
async function advanceOnboarding(
  phoneE164: string,
  uid: string,
  state: StandaloneDoc,
  message: string,
): Promise<{ reply: string }> {
  const trimmed = message.trim();

  switch (state.onboardingStep) {
    case 'ask_firstname': {
      const firstName = trimmed.slice(0, 40);
      if (!firstName) return { reply: 'Juste ton prénom suffit.' };
      await updateProfile(uid, STANDALONE_COMPANY_ID, { firstName });
      await writeStandaloneState(phoneE164, { onboardingStep: 'ask_assistant_name' });
      return {
        reply: `Enchantée ${firstName}. Et moi, tu veux m'appeler "Kora" ou tu me trouves un autre nom ? (Tape juste le nom, ou "Kora" pour garder.)`,
      };
    }
    case 'ask_assistant_name': {
      const name = trimmed.slice(0, 40) || 'Kora';
      await updateProfile(uid, STANDALONE_COMPANY_ID, { assistantName: name });
      await writeStandaloneState(phoneE164, { onboardingStep: 'ask_language' });
      return {
        reply: `Ok, ${name} c'est moi. Dernière chose : tu préfères qu'on parle en français, anglais, ou les deux ? (FR / EN / FREN)`,
      };
    }
    case 'ask_language': {
      const t = trimmed.toUpperCase();
      const language: 'fr' | 'en' = t.startsWith('EN') && !t.startsWith('FR') ? 'en' : 'fr';
      await updateProfile(uid, STANDALONE_COMPANY_ID, { language });
      await writeStandaloneState(phoneE164, {
        onboardingStep: 'ready',
        trialStartedAt: new Date(),
      } as any);
      // Re-read the profile to fetch the name we just set.
      const profile = await getOrCreateProfile({ uid, companyId: STANDALONE_COMPANY_ID });
      const name = profile.assistantName || 'Kora';
      return {
        reply:
          `C'est bon, on est prêts.\n\nTu as ${TRIAL_DAYS} jours d'essai. Parle-moi de ce qui se passe dans ta vie, de tes projets, de ce qui te trotte dans la tête. Plus tu m'en dis, plus je deviens vraiment ton ${name}.\n\nQuelques exemples pour commencer :\n• "Rappelle-moi demain 9h d'appeler mon banquier"\n• "Je galère sur un dossier client, je sais pas comment relancer"\n• "Je suis content, j'ai signé un nouveau contrat"\n\nÀ toi.`,
      };
    }
    default:
      return { reply: 'On peut continuer normalement.' };
  }
}

/**
 * Mark a user as paid (called by the Stripe / Wave webhook after checkout success).
 */
export async function markStandaloneActive(phoneE164: string, stripeSubscriptionId: string | null): Promise<void> {
  await writeStandaloneState(phoneE164, {
    subscriptionStatus: 'active',
    stripeSubscriptionId,
  } as any);
}

/**
 * Bridge from B2C → B2B: when a standalone user joins an Orlode workspace,
 * copy their profile + facts + reminders + sessions over to the new
 * (companyId, uid). Their memory survives.
 */
export async function migrateStandaloneToWorkspace(params: {
  phoneE164: string;
  targetCompanyId: string;
  targetUid: string;
}): Promise<{ factsCopied: number; remindersCopied: number; sessionsCopied: number }> {
  const { phoneE164, targetCompanyId, targetUid } = params;
  const srcUid = phoneKey(phoneE164);
  const db = getFirestore();

  const srcRoot = `companies/${STANDALONE_COMPANY_ID}/koraProfiles/${srcUid}`;
  const dstRoot = `companies/${targetCompanyId}/koraProfiles/${targetUid}`;

  // Copy the profile doc first.
  const srcProfile = await db.doc(srcRoot).get();
  if (srcProfile.exists) {
    await db.doc(dstRoot).set({ ...(srcProfile.data() as any), uid: targetUid, companyId: targetCompanyId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  const subs: Array<'facts' | 'sessions' | 'messages' | 'reminders' | 'moodLog' | 'events'> = ['facts', 'sessions', 'messages', 'reminders', 'moodLog', 'events'];
  const counts: Record<string, number> = {};
  for (const sub of subs) {
    const snap = await db.collection(`${srcRoot}/${sub}`).limit(1000).get();
    let n = 0;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.set(db.doc(`${dstRoot}/${sub}/${doc.id}`), doc.data());
      n++;
    }
    if (n > 0) await batch.commit();
    counts[sub] = n;
  }

  return {
    factsCopied: counts['facts'] ?? 0,
    remindersCopied: counts['reminders'] ?? 0,
    sessionsCopied: counts['sessions'] ?? 0,
  };
}
