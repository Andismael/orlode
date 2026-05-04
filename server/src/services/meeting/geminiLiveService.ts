import { chat } from '../ai/claudeService';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MeetingLiveConfig {
  language?: string;
  enableDiarisation?: boolean;
  enableActionItemExtraction?: boolean;
  companyContext?: string;
}

export interface LiveSessionConfig {
  meetingId: string;
  sessionToken: string;
  model: string;
  systemInstruction: string;
  config: {
    language: string;
    enableDiarisation: boolean;
  };
  expiresAt: string;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: number;
  confidence: number;
}

export interface ProcessedTranscript {
  fullText: string;
  segments: TranscriptSegment[];
  durationSeconds: number;
  speakers: string[];
  wordCount: number;
}

export interface ActionItem {
  description: string;
  assignee?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
}

export interface AIIntervention {
  type: 'summary' | 'question' | 'action_item' | 'clarification' | 'insight';
  text: string;
  relevanceScore: number;
}

// ── GeminiLiveService ─────────────────────────────────────────────────────────
//
// The Gemini Live streaming API is primarily consumed client-side via the
// Firebase AI Logic SDK. Server-side we handle:
// 1. Session configuration (telling the client which model + system prompt to use)
// 2. Post-processing of completed transcripts
// 3. AI interventions for in-meeting assistance

export class GeminiLiveService {
  /**
   * Create a session configuration object for the client-side Gemini Live connection.
   * The client uses this config to initialise a LiveSession via Firebase AI Logic SDK.
   */
  async createSessionConfig(
    meetingId: string,
    config: MeetingLiveConfig
  ): Promise<LiveSessionConfig> {
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
    const sessionToken = Buffer.from(
      JSON.stringify({ meetingId, created: Date.now() })
    ).toString('base64');

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours

    logger.info(`[GeminiLiveService] Created session config for meeting ${meetingId}`);

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
  async processTranscript(segments: TranscriptSegment[]): Promise<ProcessedTranscript> {
    const fullText = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
    const speakers = [...new Set(segments.map((s) => s.speaker))];
    const wordCount = segments.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0);
    const durationSeconds =
      segments.length > 0
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
  async extractLiveActionItems(recentTranscript: string): Promise<ActionItem[]> {
    if (!recentTranscript.trim()) return [];

    try {
      const response = await chat({
        systemPrompt:
          'You are a precise action-item extractor. Return only valid JSON arrays.',
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
      const items = JSON.parse(cleaned) as Array<Record<string, unknown>>;

      return items.map((item) => ({
        description: (item['description'] as string | undefined) ?? '',
        assignee: (item['assignee'] as string | undefined) ?? undefined,
        priority: (['low', 'medium', 'high'].includes(item['priority'] as string)
          ? item['priority']
          : 'medium') as ActionItem['priority'],
        dueDate: (item['dueDate'] as string | undefined) ?? undefined,
      }));
    } catch (err) {
      logger.error('[GeminiLiveService] extractLiveActionItems failed', { error: err });
      return [];
    }
  }

  /**
   * Determine whether the AI should intervene in the meeting, and if so, generate
   * a short helpful response (e.g. a summary, clarification, or insight).
   *
   * Returns null if no intervention is warranted.
   */
  async generateIntervention(
    context: string,
    recentSpeech: string,
    companyKnowledge: string
  ): Promise<AIIntervention | null> {
    if (!env.GOOGLE_AI_API_KEY) return null;
    if (!recentSpeech.trim()) return null;

    try {
      const response = await chat({
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
      if (trimmed === 'null' || trimmed === '') return null;

      const cleaned = trimmed.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      if (!parsed || !parsed['text']) return null;

      return {
        type: (parsed['type'] as AIIntervention['type'] | undefined) ?? 'insight',
        text: parsed['text'] as string,
        relevanceScore: (parsed['relevanceScore'] as number | undefined) ?? 0.5,
      };
    } catch (err) {
      logger.warn('[GeminiLiveService] generateIntervention failed', { error: err });
      return null;
    }
  }
}

export const geminiLiveService = new GeminiLiveService();
