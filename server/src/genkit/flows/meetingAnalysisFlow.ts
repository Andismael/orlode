import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { getFirestore } from '../../config/firebase.config';
import { chat } from '../../services/ai/claudeService';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Input / Output schemas ───────────────────────────────────────────────────

const MeetingAnalysisInputSchema = z.object({
  companyId: z.string(),
  meetingId: z.string(),
  transcript: z.string(),
  participants: z.array(z.string()),
  meetingType: z.enum(['standup', 'planning', 'review', 'client', 'board', 'other']),
});

const ActionItemSchema = z.object({
  description: z.string(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
});

const MeetingAnalysisOutputSchema = z.object({
  summary: z.string(),
  keyDecisions: z.array(z.string()),
  actionItems: z.array(ActionItemSchema),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  entities: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
    })
  ),
  topics: z.array(z.string()),
});

export type MeetingAnalysisInput = z.infer<typeof MeetingAnalysisInputSchema>;
export type MeetingAnalysisOutput = z.infer<typeof MeetingAnalysisOutputSchema>;

// ── Flow definition ──────────────────────────────────────────────────────────

export const meetingAnalysisFlow = ai.defineFlow(
  {
    name: 'meetingAnalysisFlow',
    inputSchema: MeetingAnalysisInputSchema,
    outputSchema: MeetingAnalysisOutputSchema,
  },
  async (input): Promise<MeetingAnalysisOutput> => {
    const { companyId, meetingId, transcript, participants, meetingType } = input;
    const db = getFirestore();

    // ── Step 1: Claude — summary, key decisions, action items ─────────────
    let summary = '';
    let keyDecisions: string[] = [];
    let actionItems: z.infer<typeof ActionItemSchema>[] = [];

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

      const claudeResponse = await chat({
        systemPrompt: 'You are an expert meeting analyst. Return only valid JSON.',
        messages: [{ role: 'user', content: claudePrompt }],
        maxTokens: 3000,
        temperature: 0.2,
      });

      const cleaned = claudeResponse.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      summary = (parsed['summary'] as string | undefined) ?? '';
      keyDecisions = Array.isArray(parsed['keyDecisions'])
        ? (parsed['keyDecisions'] as string[])
        : [];
      if (Array.isArray(parsed['actionItems'])) {
        actionItems = (parsed['actionItems'] as Array<Record<string, unknown>>).map((item) => ({
          description: (item['description'] as string | undefined) ?? '',
          assignee: (item['assignee'] as string | undefined) ?? undefined,
          dueDate: (item['dueDate'] as string | undefined) ?? undefined,
          priority: (['low', 'medium', 'high'].includes(item['priority'] as string)
            ? item['priority']
            : 'medium') as 'low' | 'medium' | 'high',
        }));
      }
    } catch (err) {
      logger.error('[meetingAnalysisFlow] Claude analysis failed', { error: err });
    }

    // ── Step 2: Gemini — entity extraction, sentiment, topics ─────────────
    let sentiment: z.infer<typeof MeetingAnalysisOutputSchema>['sentiment'] = 'neutral';
    let entities: Array<{ type: string; value: string }> = [];
    let topics: string[] = [];

    if (env.GOOGLE_AI_API_KEY) {
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

        const { text: geminiText } = await ai.generate({
          model: GEMINI_FLASH,
          prompt: geminiPrompt,
          config: { temperature: 0.1 },
        });

        const cleaned = geminiText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;

        const sentimentVal = parsed['sentiment'] as string | undefined;
        if (['positive', 'neutral', 'negative', 'mixed'].includes(sentimentVal ?? '')) {
          sentiment = sentimentVal as typeof sentiment;
        }
        entities = Array.isArray(parsed['entities'])
          ? (parsed['entities'] as Array<{ type: string; value: string }>)
          : [];
        topics = Array.isArray(parsed['topics']) ? (parsed['topics'] as string[]) : [];
      } catch (err) {
        logger.warn('[meetingAnalysisFlow] Gemini analysis failed, using defaults', { error: err });
      }
    }

    // ── Step 3: Persist analysis back to Firestore ─────────────────────────
    const result: MeetingAnalysisOutput = {
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
          analysedAt: FieldValue.serverTimestamp(),
          status: 'analysed',
        });
    } catch (err) {
      logger.warn('[meetingAnalysisFlow] Failed to persist analysis to Firestore', { error: err });
    }

    logger.info(`[meetingAnalysisFlow] Analysis complete for meeting ${meetingId}`);
    return result;
  }
);
