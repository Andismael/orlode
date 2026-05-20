"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateProfile = getOrCreateProfile;
exports.updateProfile = updateProfile;
exports.rememberFact = rememberFact;
exports.recallFacts = recallFacts;
exports.topFactsForPrompt = topFactsForPrompt;
exports.markFactsUsed = markFactsUsed;
exports.forgetFact = forgetFact;
exports.appendMessage = appendMessage;
exports.getRecentMessages = getRecentMessages;
exports.summarizeAndCloseSession = summarizeAndCloseSession;
exports.scheduleReminder = scheduleReminder;
exports.getDueReminders = getDueReminders;
exports.markReminderFired = markReminderFired;
exports.logMood = logMood;
exports.getRecentMood = getRecentMood;
exports.listEnabledProfilesForHour = listEnabledProfilesForHour;
exports.lastSessionSummary = lastSessionSummary;
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
const firebase_config_1 = require("../../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const helpers_1 = require("../../utils/helpers");
const logger_1 = require("../../utils/logger");
const FACT_CATEGORIES = ['personal', 'work', 'relationship', 'preference', 'goal', 'health'];
const MOOD_VALUES = ['joyful', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry'];
// ── Profile ─────────────────────────────────────────────────────────────────
async function getOrCreateProfile(params) {
    const { uid, companyId } = params;
    const db = (0, firebase_config_1.getFirestore)();
    const ref = db.doc(`companies/${companyId}/koraProfiles/${uid}`);
    const snap = await ref.get();
    if (snap.exists)
        return snap.data();
    const profile = {
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
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await ref.set(profile);
    return profile;
}
async function updateProfile(uid, companyId, patch) {
    const db = (0, firebase_config_1.getFirestore)();
    await db.doc(`companies/${companyId}/koraProfiles/${uid}`).set({ ...patch, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
}
// ── Facts ───────────────────────────────────────────────────────────────────
async function rememberFact(params) {
    const { uid, companyId, category, content } = params;
    const id = (0, helpers_1.generateId)();
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/koraProfiles/${uid}/facts/${id}`).set({
        id, uid, companyId, category,
        content: content.trim(),
        confidence: typeof params.confidence === 'number' ? params.confidence : 0.85,
        sourceSessionId: params.sourceSessionId ?? null,
        recordedAt: firestore_1.FieldValue.serverTimestamp(),
        lastUsedAt: null,
    });
    return id;
}
async function recallFacts(params) {
    const { uid, companyId } = params;
    const limit = params.limit ?? 20;
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/facts`)
        .orderBy('confidence', 'desc')
        .limit(200)
        .get();
    const all = snap.docs.map(d => {
        const data = d.data();
        const recordedAt = data.recordedAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString();
        return {
            id: d.id,
            category: data.category,
            content: data.content,
            confidence: data.confidence ?? 0.5,
            recordedAt,
        };
    });
    if (!params.query)
        return all.slice(0, limit);
    // Cheap lexical relevance: weight by overlap of query tokens.
    const tokens = params.query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = all.map(f => {
        const haystack = f.content.toLowerCase();
        const hits = tokens.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0);
        return { fact: f, score: hits + f.confidence * 0.1 };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.fact);
}
async function topFactsForPrompt(uid, companyId, max = 20) {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/facts`)
        .orderBy('confidence', 'desc')
        .limit(max)
        .get();
    return snap.docs.map(d => d.data());
}
async function markFactsUsed(uid, companyId, factIds) {
    if (factIds.length === 0)
        return;
    const db = (0, firebase_config_1.getFirestore)();
    const batch = db.batch();
    for (const id of factIds) {
        batch.set(db.doc(`companies/${companyId}/koraProfiles/${uid}/facts/${id}`), { lastUsedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
}
async function forgetFact(params) {
    const { uid, companyId } = params;
    const db = (0, firebase_config_1.getFirestore)();
    const col = db.collection(`companies/${companyId}/koraProfiles/${uid}/facts`);
    let toDelete = [];
    if (params.factIds && params.factIds.length > 0) {
        toDelete = params.factIds;
    }
    else {
        const snap = await col.limit(500).get();
        const kw = params.keywordFilter?.toLowerCase();
        toDelete = snap.docs.filter(d => {
            const data = d.data();
            if (params.categoryFilter && data.category !== params.categoryFilter)
                return false;
            if (kw && !String(data.content || '').toLowerCase().includes(kw))
                return false;
            return true;
        }).map(d => d.id);
    }
    if (toDelete.length === 0)
        return 0;
    const batch = db.batch();
    for (const id of toDelete)
        batch.delete(col.doc(id));
    await batch.commit();
    return toDelete.length;
}
async function appendMessage(params) {
    const db = (0, firebase_config_1.getFirestore)();
    const id = (0, helpers_1.generateId)();
    await db.doc(`companies/${params.companyId}/koraProfiles/${params.uid}/messages/${id}`).set({
        sessionId: params.sessionId,
        role: params.role,
        content: params.content,
        audioUrl: params.audioUrl ?? null,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Touch the session
    await db.doc(`companies/${params.companyId}/koraProfiles/${params.uid}/sessions/${params.sessionId}`).set({ sessionId: params.sessionId, lastMessageAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
}
async function getRecentMessages(uid, companyId, sessionId, limit = 12) {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/messages`)
        .where('sessionId', '==', sessionId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    return snap.docs.reverse().map(d => d.data());
}
async function summarizeAndCloseSession(uid, companyId, sessionId, summary, detectedMood) {
    const db = (0, firebase_config_1.getFirestore)();
    await db.doc(`companies/${companyId}/koraProfiles/${uid}/sessions/${sessionId}`).set({
        summary,
        detectedMood,
        endedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
// ── Reminders ───────────────────────────────────────────────────────────────
async function scheduleReminder(params) {
    const id = (0, helpers_1.generateId)();
    const due = new Date(params.dueAtIso);
    if (Number.isNaN(due.getTime()))
        throw new Error('Invalid dueAtIso');
    await (0, firebase_config_1.getFirestore)().doc(`companies/${params.companyId}/koraProfiles/${params.uid}/reminders/${id}`).set({
        id,
        uid: params.uid,
        companyId: params.companyId,
        title: params.title,
        dueAt: due,
        contextSnippet: params.contextSnippet ?? null,
        channel: params.channel ?? 'whatsapp',
        status: 'pending',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return id;
}
async function getDueReminders(now, lookbackMinutes = 2, lookaheadMinutes = 1) {
    const db = (0, firebase_config_1.getFirestore)();
    const from = new Date(now.getTime() - lookbackMinutes * 60000);
    const to = new Date(now.getTime() + lookaheadMinutes * 60000);
    // Collection-group query across every company's reminders.
    const snap = await db.collectionGroup('reminders')
        .where('status', '==', 'pending')
        .where('dueAt', '>=', from)
        .where('dueAt', '<=', to)
        .limit(200)
        .get();
    return snap.docs.map(d => {
        const data = d.data();
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
async function markReminderFired(uid, companyId, reminderId) {
    await (0, firebase_config_1.getFirestore)().doc(`companies/${companyId}/koraProfiles/${uid}/reminders/${reminderId}`).set({
        status: 'fired',
        firedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
// ── Mood log ────────────────────────────────────────────────────────────────
async function logMood(params) {
    const id = (0, helpers_1.generateId)();
    await (0, firebase_config_1.getFirestore)().doc(`companies/${params.companyId}/koraProfiles/${params.uid}/moodLog/${id}`).set({
        mood: params.mood,
        intensity: params.intensity ?? 0.5,
        note: params.note ?? null,
        detectedAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
async function getRecentMood(uid, companyId, limit = 5) {
    try {
        const db = (0, firebase_config_1.getFirestore)();
        const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/moodLog`)
            .orderBy('detectedAt', 'desc')
            .limit(limit)
            .get();
        if (snap.empty)
            return null;
        // Return the most common mood across the last N entries.
        const counts = {};
        for (const d of snap.docs) {
            const m = d.data().mood;
            counts[m] = (counts[m] ?? 0) + 1;
        }
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return sorted[0]?.[0];
    }
    catch (err) {
        logger_1.logger.warn('[Kora] getRecentMood failed', { error: String(err) });
        return null;
    }
}
// ── Iteration helpers (used by cron workers) ────────────────────────────────
async function listEnabledProfilesForHour(localHour, limit = 500) {
    // Collection-group across every company. We filter on checkInHour & enabled
    // and then on actual local time using each profile's timezone in the worker.
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collectionGroup('koraProfiles')
        .where('enabled', '==', true)
        .where('checkInHour', '==', localHour)
        .limit(limit)
        .get();
    return snap.docs.map(d => d.data());
}
async function lastSessionSummary(uid, companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection(`companies/${companyId}/koraProfiles/${uid}/sessions`)
        .orderBy('lastMessageAt', 'desc')
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    const data = snap.docs[0].data();
    return {
        summary: data.summary ?? '',
        endedAt: data.endedAt?.toDate?.() ?? null,
    };
}
//# sourceMappingURL=koraMemoryService.js.map