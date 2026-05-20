/**
 * Kora memory service — Firestore-backed long-term memory for the personal
 * companion agent.
 *
 * Schema (multi-tenant compliant, lives under each company):
 *   companies/{cid}/koraProfiles/{uid}                   — config (firstName, language, checkInHour, voice, personality, timezone)
 *   companies/{cid}/koraProfiles/{uid}/facts/{factId}    — long-term facts (preferences, work, goals, optional health/relationship after consent)
 *   companies/{cid}/koraProfiles/{uid}/sessions/{sid}    — chat session with summary
 *   companies/{cid}/koraProfiles/{uid}/messages/{mid}    — raw messages (90d retention)
 *   companies/{cid}/koraProfiles/{uid}/reminders/{rid}   — reminders with contextSnippet
 *   companies/{cid}/koraProfiles/{uid}/moodLog/{lid}     — detected mood per message/session
 *   companies/{cid}/koraProfiles/{uid}/events/{eid}      — milestones (first client, contract signed, birthday)
 *
 * Recall today is lexical (Firestore where + JS scoring). When we are ready
 * we can plug Vertex AI Embeddings into the same readFacts API without
 * changing callers.
 */
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { generateId } from '../../utils/helpers';
import { logger } from '../../utils/logger';

const FACT_CATEGORIES = ['personal', 'work', 'relationship', 'preference', 'goal', 'health'] as const;
export type FactCategory = typeof FACT_CATEGORIES[number];

const MOOD_VALUES = ['joyful', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry'] as const;
export type Mood = typeof MOOD_VALUES[number];

export interface KoraProfile {
  uid: string;
  companyId: string;
  firstName: string;
  /**
   * Display name of the assistant the user chose. Defaults to "Kora" but
   * each user can rename their companion ("Léa", "Yao", "Aïda", …).
   * Used in the system prompt and the chat UI. WhatsApp keeps "kora" as a
   * universal trigger AND accepts this name once we resolve the user by phone.
   */
  assistantName: string;
  language: 'fr' | 'en' | 'pt' | 'de';
  timezone: string;          // IANA, e.g. "Africa/Abidjan"
  checkInHour: number;       // 0-23 local
  voiceId: string | null;
  personality: 'warm' | 'direct' | 'playful';
  enabled: boolean;
  phoneE164: string | null;  // for proactive WhatsApp messages
  /**
   * How to route OWNER-sent WhatsApp messages on the tenant's number:
   *   'business' (default) — only @kora explicit mentions go to Kora. Everything
   *                          else goes to Commerce / Orchestrator. Safe default.
   *   'personal'           — every owner-sent message goes to Kora (implicit @kora).
   *                          Use when the number is purely your private line.
   *   'auto'               — heuristic classifier picks: personal markers ("rappelle-moi",
   *                          "j'ai oublié", "demain je"…) → Kora; business markers
   *                          ("prix", "livraison", "commande"…) → Commerce.
   *
   * Customers (non-owner phones) ALWAYS go to Commerce regardless of this setting.
   */
  ownerMessageRouting: 'business' | 'personal' | 'auto';
  /**
   * Free-form personal directives the user set during onboarding/settings.
   * Injected verbatim into the system prompt so Kora adapts behaviour per user.
   * Examples: "ne me parle jamais de politique", "rappelle-moi de boire de l'eau",
   * "sois plus direct quand je suis fatigué".
   * Max 5 directives, 200 chars each.
   */
  directives: string[];
  /**
   * Addon subscription gate:
   *   'none'     — never activated. Chat/cron endpoints return 402.
   *   'trial'    — 7-day free trial running, full access.
   *   'active'   — paid subscription.
   *   'expired'  — trial ended without conversion OR subscription cancelled.
   */
  subscriptionStatus: 'none' | 'trial' | 'active' | 'expired';
  /** When the trial started, used to compute remaining days. */
  trialStartedAt: any | null;
  createdAt: any;
  updatedAt: any;
}

export interface KoraFact {
  id: string;
  uid: string;
  companyId: string;
  category: FactCategory;
  content: string;
  confidence: number;        // 0-1, decays if unused
  recordedAt: any;
  lastUsedAt: any | null;
  sourceSessionId: string | null;
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function getOrCreateProfile(params: {
  uid: string;
  companyId: string;
  defaults?: Partial<KoraProfile>;
}): Promise<KoraProfile> {
  const { uid, companyId } = params;
  const db = getFirestore();
  const ref = db.doc(`companies/${companyId}/koraProfiles/${uid}`);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as KoraProfile;

  const profile: KoraProfile = {
    uid,
    companyId,
    firstName: params.defaults?.firstName ?? '',
    assistantName: params.defaults?.assistantName ?? 'Kora',
    language: params.defaults?.language ?? 'fr',
    timezone: params.defaults?.timezone ?? 'Africa/Abidjan',
    checkInHour: params.defaults?.checkInHour ?? 8,
    voiceId: params.defaults?.voiceId ?? null,
    personality: params.defaults?.personality ?? 'warm',
    // Kora is opt-in by design. Owners must explicitly activate via the UI —
    // we don't want existing Orlode tenants to be surprised by a new personality.
    enabled: params.defaults?.enabled ?? false,
    phoneE164: params.defaults?.phoneE164 ?? null,
    ownerMessageRouting: params.defaults?.ownerMessageRouting ?? 'business',
    directives: params.defaults?.directives ?? [],
    subscriptionStatus: params.defaults?.subscriptionStatus ?? 'none',
    trialStartedAt: params.defaults?.trialStartedAt ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(profile);
  return profile;
}

export async function updateProfile(uid: string, companyId: string, patch: Partial<KoraProfile>): Promise<void> {
  const db = getFirestore();
  await db.doc(`companies/${companyId}/koraProfiles/${uid}`).set(
    { ...patch, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

// ── Facts ───────────────────────────────────────────────────────────────────

export async function rememberFact(params: {
  uid: string;
  companyId: string;
  category: FactCategory;
  content: string;
  confidence?: number;
  sourceSessionId?: string;
}): Promise<string> {
  const { uid, companyId, category, content } = params;
  const id = generateId();
  await getFirestore().doc(`companies/${companyId}/koraProfiles/${uid}/facts/${id}`).set({
    id, uid, companyId, category,
    content: content.trim(),
    confidence: typeof params.confidence === 'number' ? params.confidence : 0.85,
    sourceSessionId: params.sourceSessionId ?? null,
    recordedAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
  });
  return id;
}

export async function recallFacts(params: {
  uid: string;
  companyId: string;
  query?: string;
  limit?: number;
}): Promise<Array<{ id: string; category: string; content: string; confidence: number; recordedAt: string }>> {
  const { uid, companyId } = params;
  const limit = params.limit ?? 20;
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/facts`)
    .orderBy('confidence', 'desc')
    .limit(200)
    .get();

  const all = snap.docs.map(d => {
    const data = d.data() as any;
    const recordedAt = data.recordedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
    return {
      id: d.id,
      category: data.category,
      content: data.content,
      confidence: data.confidence ?? 0.5,
      recordedAt,
    };
  });

  if (!params.query) return all.slice(0, limit);

  // Cheap lexical relevance: weight by overlap of query tokens.
  const tokens = params.query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = all.map(f => {
    const haystack = f.content.toLowerCase();
    const hits = tokens.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0);
    return { fact: f, score: hits + f.confidence * 0.1 };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.fact);
}

export async function topFactsForPrompt(uid: string, companyId: string, max = 20): Promise<KoraFact[]> {
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/facts`)
    .orderBy('confidence', 'desc')
    .limit(max)
    .get();
  return snap.docs.map(d => d.data() as KoraFact);
}

export async function markFactsUsed(uid: string, companyId: string, factIds: string[]): Promise<void> {
  if (factIds.length === 0) return;
  const db = getFirestore();
  const batch = db.batch();
  for (const id of factIds) {
    batch.set(
      db.doc(`companies/${companyId}/koraProfiles/${uid}/facts/${id}`),
      { lastUsedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  await batch.commit();
}

export async function forgetFact(params: {
  uid: string;
  companyId: string;
  factIds?: string[];
  categoryFilter?: FactCategory;
  keywordFilter?: string;
}): Promise<number> {
  const { uid, companyId } = params;
  const db = getFirestore();
  const col = db.collection(`companies/${companyId}/koraProfiles/${uid}/facts`);

  let toDelete: string[] = [];
  if (params.factIds && params.factIds.length > 0) {
    toDelete = params.factIds;
  } else {
    const snap = await col.limit(500).get();
    const kw = params.keywordFilter?.toLowerCase();
    toDelete = snap.docs.filter(d => {
      const data = d.data() as any;
      if (params.categoryFilter && data.category !== params.categoryFilter) return false;
      if (kw && !String(data.content || '').toLowerCase().includes(kw)) return false;
      return true;
    }).map(d => d.id);
  }

  if (toDelete.length === 0) return 0;

  const batch = db.batch();
  for (const id of toDelete) batch.delete(col.doc(id));
  await batch.commit();
  return toDelete.length;
}

// ── Sessions & messages ─────────────────────────────────────────────────────

export interface KoraMessage {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string | null;
  createdAt: any;
}

export async function appendMessage(params: {
  uid: string;
  companyId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string | null;
}): Promise<void> {
  const db = getFirestore();
  const id = generateId();
  await db.doc(`companies/${params.companyId}/koraProfiles/${params.uid}/messages/${id}`).set({
    sessionId: params.sessionId,
    role: params.role,
    content: params.content,
    audioUrl: params.audioUrl ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  // Touch the session
  await db.doc(`companies/${params.companyId}/koraProfiles/${params.uid}/sessions/${params.sessionId}`).set(
    { sessionId: params.sessionId, lastMessageAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function getRecentMessages(uid: string, companyId: string, sessionId: string, limit = 12): Promise<KoraMessage[]> {
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/messages`)
    .where('sessionId', '==', sessionId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.reverse().map(d => d.data() as KoraMessage);
}

export async function summarizeAndCloseSession(uid: string, companyId: string, sessionId: string, summary: string, detectedMood: Mood | null): Promise<void> {
  const db = getFirestore();
  await db.doc(`companies/${companyId}/koraProfiles/${uid}/sessions/${sessionId}`).set({
    summary,
    detectedMood,
    endedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ── Reminders ───────────────────────────────────────────────────────────────

export async function scheduleReminder(params: {
  uid: string;
  companyId: string;
  title: string;
  dueAtIso: string;
  contextSnippet?: string;
  channel?: 'whatsapp' | 'web' | 'both';
}): Promise<string> {
  const id = generateId();
  const due = new Date(params.dueAtIso);
  if (Number.isNaN(due.getTime())) throw new Error('Invalid dueAtIso');
  await getFirestore().doc(`companies/${params.companyId}/koraProfiles/${params.uid}/reminders/${id}`).set({
    id,
    uid: params.uid,
    companyId: params.companyId,
    title: params.title,
    dueAt: due,
    contextSnippet: params.contextSnippet ?? null,
    channel: params.channel ?? 'whatsapp',
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });
  return id;
}

export async function getDueReminders(now: Date, lookbackMinutes = 2, lookaheadMinutes = 1): Promise<Array<{
  id: string; uid: string; companyId: string; title: string; contextSnippet: string | null; channel: string;
}>> {
  const db = getFirestore();
  const from = new Date(now.getTime() - lookbackMinutes * 60_000);
  const to = new Date(now.getTime() + lookaheadMinutes * 60_000);
  // Collection-group query across every company's reminders.
  const snap = await db.collectionGroup('reminders')
    .where('status', '==', 'pending')
    .where('dueAt', '>=', from)
    .where('dueAt', '<=', to)
    .limit(200)
    .get();
  return snap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      uid: data.uid,
      companyId: data.companyId,
      title: data.title,
      contextSnippet: data.contextSnippet ?? null,
      channel: data.channel ?? 'whatsapp',
    };
  });
}

export async function markReminderFired(uid: string, companyId: string, reminderId: string): Promise<void> {
  await getFirestore().doc(`companies/${companyId}/koraProfiles/${uid}/reminders/${reminderId}`).set({
    status: 'fired',
    firedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ── Mood log ────────────────────────────────────────────────────────────────

export async function logMood(params: {
  uid: string;
  companyId: string;
  mood: Mood;
  intensity?: number;
  note?: string;
}): Promise<void> {
  const id = generateId();
  await getFirestore().doc(`companies/${params.companyId}/koraProfiles/${params.uid}/moodLog/${id}`).set({
    mood: params.mood,
    intensity: params.intensity ?? 0.5,
    note: params.note ?? null,
    detectedAt: FieldValue.serverTimestamp(),
  });
}

export async function getRecentMood(uid: string, companyId: string, limit = 5): Promise<Mood | null> {
  try {
    const db = getFirestore();
    const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/moodLog`)
      .orderBy('detectedAt', 'desc')
      .limit(limit)
      .get();
    if (snap.empty) return null;
    // Return the most common mood across the last N entries.
    const counts: Record<string, number> = {};
    for (const d of snap.docs) {
      const m = (d.data() as any).mood as string;
      counts[m] = (counts[m] ?? 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] as Mood;
  } catch (err) {
    logger.warn('[Kora] getRecentMood failed', { error: String(err) });
    return null;
  }
}

// ── Iteration helpers (used by cron workers) ────────────────────────────────

export async function listEnabledProfilesForHour(localHour: number, limit = 500): Promise<KoraProfile[]> {
  // Collection-group across every company. We filter on checkInHour & enabled
  // and then on actual local time using each profile's timezone in the worker.
  const db = getFirestore();
  const snap = await db.collectionGroup('koraProfiles')
    .where('enabled', '==', true)
    .where('checkInHour', '==', localHour)
    .limit(limit)
    .get();
  return snap.docs.map(d => d.data() as KoraProfile);
}

export async function lastSessionSummary(uid: string, companyId: string): Promise<{ summary: string; endedAt: Date | null } | null> {
  const db = getFirestore();
  const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/sessions`)
    .orderBy('lastMessageAt', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const data = snap.docs[0].data() as any;
  return {
    summary: data.summary ?? '',
    endedAt: data.endedAt?.toDate?.() ?? null,
  };
}
