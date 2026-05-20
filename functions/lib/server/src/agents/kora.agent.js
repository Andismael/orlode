"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KORA_TOOLS = exports.koraLogMoodTool = exports.koraScheduleReminderTool = exports.koraForgetFactTool = exports.koraRecallMemoryTool = exports.koraRememberFactTool = void 0;
/**
 * Kora — Personal companion agent (Genkit, Gemini Flash).
 *
 * Goal: feel human, remember the user across conversations, proactively
 * reach out when the moment makes sense. Different from the other 20+ agents
 * because Kora is *personal* to the end user, not a business module.
 *
 * Tools:
 *  - kora_rememberFact   : explicit memorisation (used after user opts in for
 *                          sensitive categories like health/relationship)
 *  - kora_recallMemory   : semantic / lexical search inside the user's facts
 *  - kora_forgetFact     : delete one or many facts (user-driven)
 *  - kora_scheduleReminder : queue a reminder with a contextSnippet for later
 *  - kora_logMood        : append the detected emotion to mood_log
 *
 * Memory writes go through koraMemoryService so the same logic is reusable
 * from the WhatsApp webhook and the cron worker.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const koraMemoryService_1 = require("../services/kora/koraMemoryService");
// Plain strings here — Gemini doesn't accept .enum() in some Genkit versions
// the way Zod expects, and we already normalise on the service side.
const factCategories = zod_1.z.enum(['personal', 'work', 'relationship', 'preference', 'goal', 'health']);
exports.koraRememberFactTool = genkit_config_1.ai.defineTool({
    name: 'kora_rememberFact',
    description: 'Persist a fact the user just shared. Use it ONLY when the user explicitly opts in or when the category is non-sensitive (personal, work, preference, goal). For relationship and health, ask for consent first.',
    inputSchema: zod_1.z.object({
        uid: zod_1.z.string(),
        companyId: zod_1.z.string(),
        category: factCategories,
        content: zod_1.z.string().min(3).max(280),
        confidence: zod_1.z.number().min(0).max(1).default(0.85),
        sourceSessionId: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        factId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ uid, companyId, category, content, confidence, sourceSessionId }) => {
    try {
        const factId = await (0, koraMemoryService_1.rememberFact)({ uid, companyId, category, content, confidence, sourceSessionId });
        return { success: true, factId, message: 'C\'est noté.' };
    }
    catch (err) {
        return { success: false, message: `Mémorisation impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
});
exports.koraRecallMemoryTool = genkit_config_1.ai.defineTool({
    name: 'kora_recallMemory',
    description: 'Search the user\'s long-term memory for a specific topic. Only call this when you need a precise memory that is not already in the top facts injected in your system prompt.',
    inputSchema: zod_1.z.object({
        uid: zod_1.z.string(),
        companyId: zod_1.z.string(),
        query: zod_1.z.string().min(2),
        limit: zod_1.z.number().min(1).max(10).default(5),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        facts: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            category: zod_1.z.string(),
            content: zod_1.z.string(),
            confidence: zod_1.z.number(),
            recordedAt: zod_1.z.string(),
        })),
    }),
}, async ({ uid, companyId, query, limit }) => {
    try {
        const facts = await (0, koraMemoryService_1.recallFacts)({ uid, companyId, query, limit });
        return { success: true, facts };
    }
    catch {
        return { success: true, facts: [] };
    }
});
exports.koraForgetFactTool = genkit_config_1.ai.defineTool({
    name: 'kora_forgetFact',
    description: 'Delete one or more facts when the user asks Kora to forget something. Pass factIds or a category+keyword filter.',
    inputSchema: zod_1.z.object({
        uid: zod_1.z.string(),
        companyId: zod_1.z.string(),
        factIds: zod_1.z.array(zod_1.z.string()).optional(),
        categoryFilter: factCategories.optional(),
        keywordFilter: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        deletedCount: zod_1.z.number(),
        message: zod_1.z.string(),
    }),
}, async ({ uid, companyId, factIds, categoryFilter, keywordFilter }) => {
    try {
        const deletedCount = await (0, koraMemoryService_1.forgetFact)({ uid, companyId, factIds, categoryFilter, keywordFilter });
        return { success: true, deletedCount, message: deletedCount > 0 ? 'Ok, oublié.' : 'Je n\'ai rien trouvé à oublier.' };
    }
    catch (err) {
        return { success: false, deletedCount: 0, message: `Suppression impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
});
exports.koraScheduleReminderTool = genkit_config_1.ai.defineTool({
    name: 'kora_scheduleReminder',
    description: 'Queue a reminder. Include a short contextSnippet that Kora will recall when firing the reminder, so it feels like a friend, not a calendar bot.',
    inputSchema: zod_1.z.object({
        uid: zod_1.z.string(),
        companyId: zod_1.z.string(),
        title: zod_1.z.string().min(2).max(140),
        dueAtIso: zod_1.z.string().describe('ISO 8601, e.g. 2026-05-15T08:00:00Z'),
        contextSnippet: zod_1.z.string().max(220).optional(),
        channel: zod_1.z.enum(['whatsapp', 'web', 'both']).default('whatsapp'),
    }),
    outputSchema: zod_1.z.object({
        success: zod_1.z.boolean(),
        reminderId: zod_1.z.string().optional(),
        message: zod_1.z.string(),
    }),
}, async ({ uid, companyId, title, dueAtIso, contextSnippet, channel }) => {
    try {
        const reminderId = await (0, koraMemoryService_1.scheduleReminder)({ uid, companyId, title, dueAtIso, contextSnippet, channel });
        return { success: true, reminderId, message: 'Rappel posé.' };
    }
    catch (err) {
        return { success: false, message: `Impossible de poser le rappel: ${err instanceof Error ? err.message : String(err)}` };
    }
});
exports.koraLogMoodTool = genkit_config_1.ai.defineTool({
    name: 'kora_logMood',
    description: 'Quietly log the detected mood for trend analysis. Never mention this to the user.',
    inputSchema: zod_1.z.object({
        uid: zod_1.z.string(),
        companyId: zod_1.z.string(),
        mood: zod_1.z.enum(['joyful', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry']),
        intensity: zod_1.z.number().min(0).max(1).default(0.5),
        note: zod_1.z.string().max(120).optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean() }),
}, async ({ uid, companyId, mood, intensity, note }) => {
    try {
        await (0, koraMemoryService_1.logMood)({ uid, companyId, mood, intensity, note });
        return { success: true };
    }
    catch {
        return { success: false };
    }
});
exports.KORA_TOOLS = [
    exports.koraRememberFactTool,
    exports.koraRecallMemoryTool,
    exports.koraForgetFactTool,
    exports.koraScheduleReminderTool,
    exports.koraLogMoodTool,
];
//# sourceMappingURL=kora.agent.js.map