"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiLiveService = exports.GeminiLiveService = void 0;
const claudeService_1 = require("../ai/claudeService");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── GeminiLiveService ─────────────────────────────────────────────────────────
//
// The Gemini Live streaming API is primarily consumed client-side via the
// Firebase AI Logic SDK. Server-side we handle:
// 1. Session configuration (telling the client which model + system prompt to use)
// 2. Post-processing of completed transcripts
// 3. AI interventions for in-meeting assistance
class GeminiLiveService {
    /**
     * Create a session configuration object for the client-side Gemini Live connection.
     * The client uses this config to initialise a LiveSession via Firebase AI Logic SDK.
     */
    async createSessionConfig(meetingId, config) {
        const systemInstruction = [
            'You are an AI meeting assistant for a corporate knowledge management system.',
            config.companyContext ? `Company context: ${config.companyContext}` : '',
            'Listen carefully to the meeting. When asked, provide concise summaries, identify action items, and answer questions.',
            'Keep interventions brief and relevant. Do not interrupt unless asked.',
        ]
            .filter(Boolean)
            .join('\n');
        // In production, generate a signed short-lived token here.
        // For now we generate a pseudo-token that the client can use.
        const sessionToken = Buffer.from(JSON.stringify({ meetingId, created: Date.now() })).toString('base64');
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours
        logger_1.logger.info(`[GeminiLiveService] Created session config for meeting ${meetingId}`);
        return {
            meetingId,
            sessionToken,
            model: 'gemini-3-flash-live-001',
            systemInstruction,
            config: {
                language: config.language ?? 'en',
                enableDiarisation: config.enableDiarisation ?? true,
            },
            expiresAt,
        };
    }
    /**
     * Process a completed transcript (array of segments) from a Gemini Live session.
     */
    async processTranscript(segments) {
        const fullText = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
        const speakers = [...new Set(segments.map((s) => s.speaker))];
        const wordCount = segments.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0);
        const durationSeconds = segments.length > 0
            ? segments[segments.length - 1].timestamp - segments[0].timestamp
            : 0;
        return {
            fullText,
            segments,
            durationSeconds,
            speakers,
            wordCount,
        };
    }
    /**
     * Extract action items from the most recent portion of a live transcript.
     */
    async extractLiveActionItems(recentTranscript) {
        if (!recentTranscript.trim())
            return [];
        try {
            const response = await (0, claudeService_1.chat)({
                systemPrompt: 'You are a precise action-item extractor. Return only valid JSON arrays.',
                messages: [
                    {
                        role: 'user',
                        content: `Extract action items from this meeting transcript segment. Return a JSON array:
[{"description":"...","assignee":"name or null","priority":"low|medium|high","dueDate":"YYYY-MM-DD or null"}]

Transcript:
"""
${recentTranscript.slice(0, 3000)}
"""

Return ONLY the JSON array.`,
                    },
                ],
                maxTokens: 1024,
                temperature: 0.1,
            });
            const cleaned = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const items = JSON.parse(cleaned);
            return items.map((item) => ({
                description: item['description'] ?? '',
                assignee: item['assignee'] ?? undefined,
                priority: (['low', 'medium', 'high'].includes(item['priority'])
                    ? item['priority']
                    : 'medium'),
                dueDate: item['dueDate'] ?? undefined,
            }));
        }
        catch (err) {
            logger_1.logger.error('[GeminiLiveService] extractLiveActionItems failed', { error: err });
            return [];
        }
    }
    /**
     * Determine whether the AI should intervene in the meeting, and if so, generate
     * a short helpful response (e.g. a summary, clarification, or insight).
     *
     * Returns null if no intervention is warranted.
     */
    async generateIntervention(context, recentSpeech, companyKnowledge) {
        if (!env_config_1.env.GOOGLE_AI_API_KEY)
            return null;
        if (!recentSpeech.trim())
            return null;
        try {
            const response = await (0, claudeService_1.chat)({
                systemPrompt: `You are a meeting AI assistant. Analyse the recent speech and decide if a helpful AI intervention is warranted.

Company knowledge:
${companyKnowledge.slice(0, 1000)}

Meeting context:
${context.slice(0, 500)}`,
                messages: [
                    {
                        role: 'user',
                        content: `Recent speech:
"""
${recentSpeech.slice(0, 1000)}
"""

Should the AI intervene? If yes, return:
{"type":"summary|question|action_item|clarification|insight","text":"...","relevanceScore":0.0-1.0}

If no intervention is needed, return: null

Return ONLY JSON or the word null.`,
                    },
                ],
                maxTokens: 512,
                temperature: 0.3,
            });
            const trimmed = response.trim();
            if (trimmed === 'null' || trimmed === '')
                return null;
            const cleaned = trimmed.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = JSON.parse(cleaned);
            if (!parsed || !parsed['text'])
                return null;
            return {
                type: parsed['type'] ?? 'insight',
                text: parsed['text'],
                relevanceScore: parsed['relevanceScore'] ?? 0.5,
            };
        }
        catch (err) {
            logger_1.logger.warn('[GeminiLiveService] generateIntervention failed', { error: err });
            return null;
        }
    }
}
exports.GeminiLiveService = GeminiLiveService;
exports.geminiLiveService = new GeminiLiveService();
//# sourceMappingURL=geminiLiveService.js.map