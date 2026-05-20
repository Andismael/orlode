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
import { z } from 'zod';
import { ai } from '../config/genkit.config';
import {
  rememberFact,
  recallFacts,
  forgetFact,
  scheduleReminder,
  logMood,
} from '../services/kora/koraMemoryService';

// Plain strings here — Gemini doesn't accept .enum() in some Genkit versions
// the way Zod expects, and we already normalise on the service side.
const factCategories = z.enum(['personal', 'work', 'relationship', 'preference', 'goal', 'health']);

export const koraRememberFactTool = ai.defineTool(
  {
    name: 'kora_rememberFact',
    description:
      'Persist a fact the user just shared. Use it ONLY when the user explicitly opts in or when the category is non-sensitive (personal, work, preference, goal). For relationship and health, ask for consent first.',
    inputSchema: z.object({
      uid: z.string(),
      companyId: z.string(),
      category: factCategories,
      content: z.string().min(3).max(280),
      confidence: z.number().min(0).max(1).default(0.85),
      sourceSessionId: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      factId: z.string().optional(),
      message: z.string(),
    }),
  },
  async ({ uid, companyId, category, content, confidence, sourceSessionId }) => {
    try {
      const factId = await rememberFact({ uid, companyId, category, content, confidence, sourceSessionId });
      return { success: true, factId, message: 'C\'est noté.' };
    } catch (err) {
      return { success: false, message: `Mémorisation impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
);

export const koraRecallMemoryTool = ai.defineTool(
  {
    name: 'kora_recallMemory',
    description:
      'Search the user\'s long-term memory for a specific topic. Only call this when you need a precise memory that is not already in the top facts injected in your system prompt.',
    inputSchema: z.object({
      uid: z.string(),
      companyId: z.string(),
      query: z.string().min(2),
      limit: z.number().min(1).max(10).default(5),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      facts: z.array(z.object({
        id: z.string(),
        category: z.string(),
        content: z.string(),
        confidence: z.number(),
        recordedAt: z.string(),
      })),
    }),
  },
  async ({ uid, companyId, query, limit }) => {
    try {
      const facts = await recallFacts({ uid, companyId, query, limit });
      return { success: true, facts };
    } catch {
      return { success: true, facts: [] };
    }
  },
);

export const koraForgetFactTool = ai.defineTool(
  {
    name: 'kora_forgetFact',
    description: 'Delete one or more facts when the user asks Kora to forget something. Pass factIds or a category+keyword filter.',
    inputSchema: z.object({
      uid: z.string(),
      companyId: z.string(),
      factIds: z.array(z.string()).optional(),
      categoryFilter: factCategories.optional(),
      keywordFilter: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deletedCount: z.number(),
      message: z.string(),
    }),
  },
  async ({ uid, companyId, factIds, categoryFilter, keywordFilter }) => {
    try {
      const deletedCount = await forgetFact({ uid, companyId, factIds, categoryFilter, keywordFilter });
      return { success: true, deletedCount, message: deletedCount > 0 ? 'Ok, oublié.' : 'Je n\'ai rien trouvé à oublier.' };
    } catch (err) {
      return { success: false, deletedCount: 0, message: `Suppression impossible: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
);

export const koraScheduleReminderTool = ai.defineTool(
  {
    name: 'kora_scheduleReminder',
    description: 'Queue a reminder. Include a short contextSnippet that Kora will recall when firing the reminder, so it feels like a friend, not a calendar bot.',
    inputSchema: z.object({
      uid: z.string(),
      companyId: z.string(),
      title: z.string().min(2).max(140),
      dueAtIso: z.string().describe('ISO 8601, e.g. 2026-05-15T08:00:00Z'),
      contextSnippet: z.string().max(220).optional(),
      channel: z.enum(['whatsapp', 'web', 'both']).default('whatsapp'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      reminderId: z.string().optional(),
      message: z.string(),
    }),
  },
  async ({ uid, companyId, title, dueAtIso, contextSnippet, channel }) => {
    try {
      const reminderId = await scheduleReminder({ uid, companyId, title, dueAtIso, contextSnippet, channel });
      return { success: true, reminderId, message: 'Rappel posé.' };
    } catch (err) {
      return { success: false, message: `Impossible de poser le rappel: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
);

export const koraLogMoodTool = ai.defineTool(
  {
    name: 'kora_logMood',
    description: 'Quietly log the detected mood for trend analysis. Never mention this to the user.',
    inputSchema: z.object({
      uid: z.string(),
      companyId: z.string(),
      mood: z.enum(['joyful', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry']),
      intensity: z.number().min(0).max(1).default(0.5),
      note: z.string().max(120).optional(),
    }),
    outputSchema: z.object({ success: z.boolean() }),
  },
  async ({ uid, companyId, mood, intensity, note }) => {
    try {
      await logMood({ uid, companyId, mood, intensity, note });
      return { success: true };
    } catch {
      return { success: false };
    }
  },
);

export const KORA_TOOLS = [
  koraRememberFactTool,
  koraRecallMemoryTool,
  koraForgetFactTool,
  koraScheduleReminderTool,
  koraLogMoodTool,
];
