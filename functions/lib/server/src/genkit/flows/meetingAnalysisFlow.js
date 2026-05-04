"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetingAnalysisFlow = void 0;
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const genkit_config_1 = require("../../config/genkit.config");
const firebase_config_1 = require("../../config/firebase.config");
const claudeService_1 = require("../../services/ai/claudeService");
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── Input / Output schemas ───────────────────────────────────────────────────
const MeetingAnalysisInputSchema = zod_1.z.object({
    companyId: zod_1.z.string(),
    meetingId: zod_1.z.string(),
    transcript: zod_1.z.string(),
    participants: zod_1.z.array(zod_1.z.string()),
    meetingType: zod_1.z.enum(['standup', 'planning', 'review', 'client', 'board', 'other']),
});
const ActionItemSchema = zod_1.z.object({
    description: zod_1.z.string(),
    assignee: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high']),
});
const MeetingAnalysisOutputSchema = zod_1.z.object({
    summary: zod_1.z.string(),
    keyDecisions: zod_1.z.array(zod_1.z.string()),
    actionItems: zod_1.z.array(ActionItemSchema),
    sentiment: zod_1.z.enum(['positive', 'neutral', 'negative', 'mixed']),
    entities: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        value: zod_1.z.string(),
    })),
    topics: zod_1.z.array(zod_1.z.string()),
});
// ── Flow definition ──────────────────────────────────────────────────────────
exports.meetingAnalysisFlow = genkit_config_1.ai.defineFlow({
    name: 'meetingAnalysisFlow',
    inputSchema: MeetingAnalysisInputSchema,
    outputSchema: MeetingAnalysisOutputSchema,
}, async (input) => {
    const { companyId, meetingId, transcript, participants, meetingType } = input;
    const db = (0, firebase_config_1.getFirestore)();
    // ── Step 1: Claude — summary, key decisions, action items ─────────────
    let summary = '';
    let keyDecisions = [];
    let actionItems = [];
    try {
        const claudePrompt = `You are analysing the transcript of a ${meetingType} meeting.
Participants: ${participants.join(', ')}

Transcript:
"""
${transcript.slice(0, 12000)}
"""

Produce a JSON object with the following fields:
{
  "summary": "2-3 paragraph executive summary of the meeting",
  "keyDecisions": ["list of key decisions made"],
  "actionItems": [
    { "description": "...", "assignee": "name or null", "dueDate": "YYYY-MM-DD or null", "priority": "low|medium|high" }
  ]
}

Return ONLY the JSON object.`;
        const claudeResponse = await (0, claudeService_1.chat)({
            systemPrompt: 'You are an expert meeting analyst. Return only valid JSON.',
            messages: [{ role: 'user', content: claudePrompt }],
            maxTokens: 3000,
            temperature: 0.2,
        });
        const cleaned = claudeResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);
        summary = parsed['summary'] ?? '';
        keyDecisions = Array.isArray(parsed['keyDecisions'])
            ? parsed['keyDecisions']
            : [];
        if (Array.isArray(parsed['actionItems'])) {
            actionItems = parsed['actionItems'].map((item) => ({
                description: item['description'] ?? '',
                assignee: item['assignee'] ?? undefined,
                dueDate: item['dueDate'] ?? undefined,
                priority: (['low', 'medium', 'high'].includes(item['priority'])
                    ? item['priority']
                    : 'medium'),
            }));
        }
    }
    catch (err) {
        logger_1.logger.error('[meetingAnalysisFlow] Claude analysis failed', { error: err });
    }
    // ── Step 2: Gemini — entity extraction, sentiment, topics ─────────────
    let sentiment = 'neutral';
    let entities = [];
    let topics = [];
    if (env_config_1.env.GOOGLE_AI_API_KEY) {
        try {
            const geminiPrompt = `Analyse the meeting transcript for:
1. Overall sentiment (positive/neutral/negative/mixed)
2. Named entities (people, organisations, products, dates, locations)
3. Main topics discussed (max 8 keywords/phrases)

Transcript:
"""
${transcript.slice(0, 8000)}
"""

Return JSON:
{
  "sentiment": "positive|neutral|negative|mixed",
  "entities": [{"type":"person|organization|product|date|location","value":"..."}],
  "topics": ["topic1","topic2"...]
}

Return ONLY JSON.`;
            const { text: geminiText } = await genkit_config_1.ai.generate({
                model: genkit_config_1.GEMINI_FLASH,
                prompt: geminiPrompt,
                config: { temperature: 0.1 },
            });
            const cleaned = geminiText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const parsed = JSON.parse(cleaned);
            const sentimentVal = parsed['sentiment'];
            if (['positive', 'neutral', 'negative', 'mixed'].includes(sentimentVal ?? '')) {
                sentiment = sentimentVal;
            }
            entities = Array.isArray(parsed['entities'])
                ? parsed['entities']
                : [];
            topics = Array.isArray(parsed['topics']) ? parsed['topics'] : [];
        }
        catch (err) {
            logger_1.logger.warn('[meetingAnalysisFlow] Gemini analysis failed, using defaults', { error: err });
        }
    }
    // ── Step 3: Persist analysis back to Firestore ─────────────────────────
    const result = {
        summary,
        keyDecisions,
        actionItems,
        sentiment,
        entities,
        topics,
    };
    try {
        await db
            .collection('companies')
            .doc(companyId)
            .collection('meetings')
            .doc(meetingId)
            .update({
            analysis: result,
            analysedAt: firestore_1.FieldValue.serverTimestamp(),
            status: 'analysed',
        });
    }
    catch (err) {
        logger_1.logger.warn('[meetingAnalysisFlow] Failed to persist analysis to Firestore', { error: err });
    }
    logger_1.logger.info(`[meetingAnalysisFlow] Analysis complete for meeting ${meetingId}`);
    return result;
});
//# sourceMappingURL=meetingAnalysisFlow.js.map