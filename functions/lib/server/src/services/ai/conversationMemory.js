"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeConversation = summarizeConversation;
exports.buildCompressedContext = buildCompressedContext;
exports.loadUserMemory = loadUserMemory;
exports.saveUserMemory = saveUserMemory;
exports.extractUserFacts = extractUserFacts;
exports.buildMemoryContext = buildMemoryContext;
exports.persistConversationSummary = persistConversationSummary;
/**
 * Conversation Memory — Summarization, compression, cross-conversation recall
 *
 * Solves: "only 20 messages in context" limitation
 * Strategy:
 *   1. Summarize older messages periodically
 *   2. Keep recent messages + summary = full context with less tokens
 *   3. Store key facts learned per user for cross-conversation recall
 */
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const RECENT_MESSAGES = 10; // Keep last 10 messages as-is
const SUMMARY_THRESHOLD = 15; // Summarize when > 15 messages in history
// ══════════════════════════════════════════════════════════════════════════════
// 1. CONVERSATION SUMMARIZATION
// ══════════════════════════════════════════════════════════════════════════════
/** Summarize older messages to compress context */
async function summarizeConversation(messages) {
    if (messages.length < SUMMARY_THRESHOLD)
        return null;
    const olderMessages = messages.slice(0, messages.length - RECENT_MESSAGES);
    const text = olderMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    try {
        const { text: summary } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Summarize this conversation in 3-5 sentences. Extract key facts, decisions, and context needed for continuity.

Conversation:
${text.slice(0, 3000)}

Return JSON: {"summary":"concise summary","keyFacts":["fact1","fact2"],"agentsUsed":["agent1"]}`,
            config: { temperature: 0.2 },
        });
        const parsed = JSON.parse(summary.trim().replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return {
            summary: parsed.summary ?? 'Conversation en cours.',
            keyFacts: parsed.keyFacts ?? [],
            agentsUsed: parsed.agentsUsed ?? [],
            messageCount: olderMessages.length,
            generatedAt: new Date(),
        };
    }
    catch {
        // Simple fallback: take first and last message
        return {
            summary: `Conversation de ${olderMessages.length} messages. Debut: "${olderMessages[0]?.content?.slice(0, 100)}". Dernier sujet: "${olderMessages[olderMessages.length - 1]?.content?.slice(0, 100)}"`,
            keyFacts: [], agentsUsed: [], messageCount: olderMessages.length, generatedAt: new Date(),
        };
    }
}
/** Build compressed context: summary + recent messages */
function buildCompressedContext(summary, recentMessages) {
    const compressed = [];
    if (summary) {
        compressed.push({
            role: 'model',
            content: `[Resume de la conversation precedente (${summary.messageCount} messages)]\n${summary.summary}${summary.keyFacts.length > 0 ? `\nFaits cles: ${summary.keyFacts.join('; ')}` : ''}`,
        });
    }
    compressed.push(...recentMessages.slice(-RECENT_MESSAGES));
    return compressed;
}
// ══════════════════════════════════════════════════════════════════════════════
// 2. CROSS-CONVERSATION MEMORY (user-level)
// ══════════════════════════════════════════════════════════════════════════════
/** Load user memory from Firestore */
async function loadUserMemory(companyId, userId) {
    try {
        const doc = await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/userMemory`).doc(userId).get();
        return doc.exists ? doc.data() : null;
    }
    catch {
        return null;
    }
}
/** Save/update user memory */
async function saveUserMemory(companyId, userId, memory) {
    try {
        await (0, firebase_config_1.getFirestore)().collection(`companies/${companyId}/userMemory`).doc(userId).set({
            userId, companyId, ...memory, updatedAt: new Date(),
        }, { merge: true });
    }
    catch { }
}
/** Extract key facts from current conversation to save in memory */
async function extractUserFacts(messages) {
    if (messages.length < 3)
        return [];
    try {
        const text = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
        const { text: result } = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            prompt: `Extract 1-3 key facts about the user from this conversation that would be useful to remember for future conversations. Only extract stable facts (role, preferences, common requests), not ephemeral ones.

Conversation:
${text.slice(0, 2000)}

Return JSON: {"facts":["fact1","fact2"]}. Return {"facts":[]} if nothing notable.`,
            config: { temperature: 0.1 },
        });
        return (JSON.parse(result.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')).facts ?? []);
    }
    catch {
        return [];
    }
}
/** Build memory context string to inject into system prompt */
function buildMemoryContext(memory) {
    if (!memory)
        return '';
    const parts = [];
    if (memory.facts?.length > 0)
        parts.push(`Known facts about this user: ${memory.facts.join('; ')}`);
    if (memory.preferences?.length > 0)
        parts.push(`Preferences: ${memory.preferences.join('; ')}`);
    if (memory.lastTopics?.length > 0)
        parts.push(`Recent topics: ${memory.lastTopics.join(', ')}`);
    return parts.length > 0 ? `\n\n## User context (from previous conversations):\n${parts.join('\n')}` : '';
}
// ══════════════════════════════════════════════════════════════════════════════
// 3. SAVE CONVERSATION SUMMARY TO FIRESTORE
// ══════════════════════════════════════════════════════════════════════════════
async function persistConversationSummary(conversationId, summary) {
    try {
        await (0, firebase_config_1.getFirestore)().collection('conversations').doc(conversationId).update({
            summary: summary.summary,
            keyFacts: summary.keyFacts,
            summaryGeneratedAt: summary.generatedAt,
            summarizedMessageCount: summary.messageCount,
        });
    }
    catch { }
}
//# sourceMappingURL=conversationMemory.js.map