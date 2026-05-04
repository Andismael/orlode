/**
 * Meeting Agent — Gemini Flash + Q&A Agent (as tool)
 *
 * Pattern: parallel execution
 * Responsibility: Transcribe + analyze meetings simultaneously.
 * Transcription (audio→text) and Vision analysis run in parallel via Promise.all.
 * Q&A agent is available as a tool to answer questions about meeting content.
 */
import { z } from 'zod';
import { ai, GEMINI_FLASH } from '../config/genkit.config';
import { getFirestore } from '../config/firebase.config';
import { qaAgentTool } from './qa.agent';
import { visionAgentTool } from './vision.agent';
import {
  calendarListEventsTool,
  calendarCreateEventTool,
  tasksCreateTool,
  tasksListTool,
  gmailDraftTool,
} from './tools/mcp/googleWorkspace';
import { slackSendMessageTool } from './tools/mcp/slack';
import { mcpAvailability } from '../config/mcp.config';
import { translationService } from '../services/firebase-ml/translationService';
import { logger } from '../utils/logger';

const INPUT = z.object({
  meetingId:    z.string(),
  companyId:    z.string(),
  audioBase64:  z.string().optional().describe('Base64 audio/video for transcription'),
  audioMime:    z.string().optional().default('audio/webm'),
  frameBase64:  z.string().optional().describe('Base64 thumbnail/frame for visual analysis'),
  title:        z.string().optional(),
  participants: z.array(z.string()).optional(),
  question:     z.string().optional().describe('Optional question to answer about this meeting'),
});

const OUTPUT = z.object({
  transcript:   z.string().optional(),
  language:     z.string().optional(),
  summary:      z.string(),
  actionItems:  z.array(z.object({
    task:       z.string(),
    assignee:   z.string().optional(),
    dueDate:    z.string().optional(),
    priority:   z.enum(['high', 'medium', 'low']),
  })),
  keyDecisions: z.array(z.string()),
  sentiment:    z.enum(['positive', 'neutral', 'negative', 'mixed']),
  topics:       z.array(z.string()),
  visualNotes:  z.string().optional(),
  qaAnswer:     z.string().optional(),
});

export type MeetingInput  = z.infer<typeof INPUT>;
export type MeetingOutput = z.infer<typeof OUTPUT>;

// ── Transcribe audio via Gemini multimodal ────────────────────────────────────
async function transcribeAudio(base64: string, mime: string): Promise<{ text: string; language: string }> {
  const { text } = await ai.generate({
    model: GEMINI_FLASH,
    prompt: [
      {
        media: {
          contentType: mime as 'audio/webm' | 'audio/mp4' | 'audio/mpeg' | 'video/mp4',
          url: `data:${mime};base64,${base64}`,
        },
      },
      {
        text: `Transcribe this audio/video recording. Include speaker identification where possible.
Return JSON: {"text": "full transcript with speaker labels", "language": "detected language code"}
Return ONLY JSON.`,
      },
    ],
    config: { temperature: 0 },
  });

  try {
    const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, '')) as {
      text: string; language: string;
    };
    return parsed;
  } catch {
    return { text, language: 'en' };
  }
}

// ── Analyze transcript → structured insights ──────────────────────────────────
async function analyzeTranscript(
  transcript: string,
  title: string,
  participants: string[],
): Promise<Omit<MeetingOutput, 'transcript' | 'language' | 'visualNotes' | 'qaAnswer'>> {
  const { text } = await ai.generate({
    model: GEMINI_FLASH,
    system: `You are an expert meeting analyst. Extract structured insights from meeting transcripts.
Be concise, actionable, and precise.`,
    prompt: `Analyze this meeting transcript and extract structured data.

Meeting: ${title || 'Untitled Meeting'}
Participants: ${participants.join(', ') || 'Unknown'}

TRANSCRIPT:
${transcript.slice(0, 12000)}

Return JSON:
{
  "summary": "2-3 paragraph executive summary",
  "actionItems": [
    {"task": "action description", "assignee": "name or null", "dueDate": "YYYY-MM-DD or null", "priority": "high|medium|low"}
  ],
  "keyDecisions": ["decision 1", "decision 2"],
  "sentiment": "positive|neutral|negative|mixed",
  "topics": ["topic1", "topic2", "topic3"]
}

Return ONLY JSON.`,
    config: { temperature: 0.2 },
  });

  try {
    return JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, '')) as Omit<MeetingOutput, 'transcript' | 'language' | 'visualNotes' | 'qaAnswer'>;
  } catch {
    return {
      summary:      text,
      actionItems:  [],
      keyDecisions: [],
      sentiment:    'neutral',
      topics:       [],
    };
  }
}

// ── The flow (parallel pattern) ───────────────────────────────────────────────
export const meetingAgentFlow = ai.defineFlow(
  { name: 'meetingAgent', inputSchema: INPUT, outputSchema: OUTPUT },
  async ({ meetingId, companyId, audioBase64, audioMime, frameBase64, title, participants, question }): Promise<MeetingOutput> => {
    logger.info(`[MeetingAgent] Processing meeting ${meetingId}`);
    const db = getFirestore();

    // ── PARALLEL: transcription + visual analysis ─────────────────────────
    const [transcriptionResult, visualResult] = await Promise.all([
      // Task 1: Transcribe audio (if provided)
      audioBase64
        ? transcribeAudio(audioBase64, audioMime ?? 'audio/webm')
        : Promise.resolve({ text: '', language: 'en' }),

      // Task 2: Analyze visual frame (if provided) using Vision agent
      frameBase64
        ? visionAgentTool({
            imageBase64: frameBase64,
            mimeType:    'image/jpeg',
            task:        'analyze',
            context:     title ?? 'Meeting frame',
          })
        : Promise.resolve(null),
    ]);

    let transcript = transcriptionResult.text;
    const language = transcriptionResult.language;

    // ── Auto-translate transcript to company language if different ───────────
    // Fetches the company's preferred language from Firestore
    try {
      const db2 = getFirestore();
      const companyDoc = await db2.collection('companies').doc(companyId).get();
      const companyLang = (companyDoc.data()?.['settings'] as Record<string, unknown>)?.['language'] as string | undefined;
      if (companyLang && companyLang !== language && companyLang !== 'auto') {
        const translated = await translationService.translateIfNeeded(transcript, companyLang);
        if (translated.wasTranslated) {
          logger.info(`[MeetingAgent] Transcript translated ${language} → ${companyLang}`);
          transcript = `[Translated from ${language} to ${companyLang}]\n\n${translated.translatedText}`;
        }
      }
    } catch {
      // Translation is non-critical — continue with original transcript
    }

    logger.info(`[MeetingAgent] Transcription: ${transcript.length} chars | Visual: ${visualResult ? 'yes' : 'no'}`);

    // ── Sequential: analyze transcript if we have content ────────────────
    let analysis: Omit<MeetingOutput, 'transcript' | 'language' | 'visualNotes' | 'qaAnswer'>;

    if (transcript.length > 50) {
      analysis = await analyzeTranscript(transcript, title ?? 'Meeting', participants ?? []);
    } else {
      // No audio — generate a basic summary from context
      analysis = {
        summary:      title ? `Meeting: ${title}` : 'No transcript available.',
        actionItems:  [],
        keyDecisions: [],
        sentiment:    'neutral',
        topics:       [],
      };
    }

    // ── Optional: answer a specific question about this meeting ──────────
    let qaAnswer: string | undefined;
    if (question && transcript.length > 50) {
      logger.info(`[MeetingAgent] Answering question: "${question.slice(0, 60)}"`);
      const qaResult = await qaAgentTool({
        question,
        companyId,
        context: `Meeting transcript:\n${transcript.slice(0, 3000)}`,
        language,
      });
      qaAnswer = qaResult.answer;
    }

    // ── Save to Firestore ─────────────────────────────────────────────────
    const updateData: Record<string, unknown> = {
      hasTranscript:  !!transcript,
      transcript:     transcript || null,
      language,
      summary:        analysis.summary,
      actionItems:    analysis.actionItems,
      keyDecisions:   analysis.keyDecisions,
      sentiment:      analysis.sentiment,
      topics:         analysis.topics,
      status:         'analyzed',
      analyzedAt:     new Date(),
    };
    if (visualResult) updateData['visualNotes'] = visualResult.description;

    await db.collection('meetings').doc(meetingId).update(updateData);
    logger.info(`[MeetingAgent] Saved analysis for meeting ${meetingId}`);

    // ── MCP Phase 3: post-meeting automations (fire & forget) ────────────
    if (analysis.actionItems.length > 0 || analysis.summary) {
      setImmediate(async () => {
        // Create Google Tasks for each action item
        if (mcpAvailability.googleWorkspace && analysis.actionItems.length > 0) {
          logger.info(`[MeetingAgent] Creating ${analysis.actionItems.length} Google Tasks via MCP`);
          await Promise.allSettled(
            analysis.actionItems.slice(0, 10).map((item) =>
              tasksCreateTool({
                title: item.task,
                notes: item.assignee ? `Assignee: ${item.assignee}` : undefined,
                due:   item.dueDate ?? undefined,
              }).catch((err) => logger.warn('[MeetingAgent] Task creation failed', { error: err }))
            )
          );
        }

        // Post summary to Slack
        if (mcpAvailability.slack && analysis.summary) {
          logger.info('[MeetingAgent] Posting meeting summary to Slack');
          const slackText = `*Meeting Summary${title ? ': ' + title : ''}*\n\n${analysis.summary}\n\n*Action Items:* ${analysis.actionItems.length}`;
          await slackSendMessageTool({ channel: '#general', text: slackText })
            .catch((err) => logger.warn('[MeetingAgent] Slack notification failed', { error: err }));
        }

        // Draft follow-up email via Gmail
        if (mcpAvailability.googleWorkspace && participants && participants.length > 0 && analysis.summary) {
          logger.info('[MeetingAgent] Creating Gmail draft for meeting follow-up');
          await gmailDraftTool({
            to:      participants.join(', '),
            subject: `Meeting Summary${title ? ': ' + title : ''} — ${new Date().toLocaleDateString()}`,
            body:    `Hi team,\n\nHere is the summary of our meeting:\n\n${analysis.summary}\n\n**Action Items:**\n${analysis.actionItems.map((a) => `- ${a.task}${a.assignee ? ' (' + a.assignee + ')' : ''}`).join('\n')}\n\nBest regards,\nOrlode AI`,
          }).catch((err) => logger.warn('[MeetingAgent] Gmail draft failed', { error: err }));
        }
      });
    }

    return {
      transcript:   transcript || undefined,
      language,
      summary:      analysis.summary,
      actionItems:  analysis.actionItems,
      keyDecisions: analysis.keyDecisions,
      sentiment:    analysis.sentiment,
      topics:       analysis.topics,
      visualNotes:  visualResult?.description,
      qaAnswer,
    };
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// PRO: ACTION ROUTING (cross-agent — route actions to the right department)
// ══════════════════════════════════════════════════════════════════════════════

import { generateId } from '../utils/helpers';

export async function routeMeetingActions(companyId: string, meetingId: string, actions: MeetingOutput['actionItems']): Promise<string[]> {
  const db = getFirestore();
  const routed: string[] = [];

  for (const action of actions) {
    const lower = (action.task + ' ' + (action.assignee ?? '')).toLowerCase();

    // Route to Sales
    if (/devis|quote|client|prospect|commercial|vente/i.test(lower)) {
      await db.collection(`companies/${companyId}/leads`).doc(generateId()).set({
        id: generateId(), name: action.task.slice(0, 80), source: 'meeting', stage: 'nouveau',
        notes: `Action de reunion ${meetingId}: ${action.task}. Assigne: ${action.assignee ?? 'non assigne'}`,
        createdAt: new Date(),
      });
      routed.push(`Sales: "${action.task}" → lead cree`);
    }

    // Route to IT
    if (/bug|serveur|deploiement|technique|IT|infrastructure|code/i.test(lower)) {
      await db.collection(`companies/${companyId}/itTickets`).doc(generateId()).set({
        id: generateId(), subject: `[MEETING] ${action.task}`, description: `Action de reunion: ${action.task}`,
        priority: action.priority === 'high' ? 'high' : 'medium', status: 'open', source: 'meeting', meetingId, createdAt: new Date(),
      });
      routed.push(`IT: "${action.task}" → ticket cree`);
    }

    // Route to HR
    if (/recrutement|embauche|conge|formation|onboarding|RH/i.test(lower)) {
      await db.collection(`companies/${companyId}/hrTickets`).doc(generateId()).set({
        id: generateId(), subject: `[MEETING] ${action.task}`, description: action.task,
        category: 'request', priority: 'medium', status: 'open', source: 'meeting', meetingId, createdAt: new Date(),
      });
      routed.push(`HR: "${action.task}" → ticket cree`);
    }

    // Route to Legal
    if (/contrat|juridique|legal|conformite|rgpd|signature/i.test(lower)) {
      await db.collection(`companies/${companyId}/legalCases`).doc(generateId()).set({
        id: generateId(), title: `[MEETING] ${action.task}`, type: 'task', status: 'open',
        description: action.task, source: 'meeting', meetingId, createdAt: new Date(),
      });
      routed.push(`Legal: "${action.task}" → dossier cree`);
    }
  }

  // Log routing
  if (routed.length > 0) {
    await db.collection('meetings').doc(meetingId).update({ actionsRouted: routed, routedAt: new Date() }).catch(() => {});
  }

  return routed;
}

// ══════════════════════════════════════════════════════════════════════════════
// PRO: MEETING SEARCH (find across all meetings)
// ══════════════════════════════════════════════════════════════════════════════

export async function searchMeetings(companyId: string, query: string): Promise<{ meetings: { id: string; title: string; date: string; match: string }[] }> {
  const db = getFirestore();
  const snap = await db.collection('meetings').where('companyId', '==', companyId).where('status', '==', 'analyzed').limit(50).get();
  const q = query.toLowerCase();
  const results = snap.docs.filter(d => {
    const data = d.data();
    const text = `${data['title'] ?? ''} ${data['transcript'] ?? ''} ${data['summary'] ?? ''} ${(data['topics'] as string[])?.join(' ') ?? ''}`.toLowerCase();
    return text.includes(q);
  }).map(d => {
    const data = d.data();
    const transcript = (data['transcript'] as string) ?? '';
    const idx = transcript.toLowerCase().indexOf(q);
    const match = idx >= 0 ? `...${transcript.slice(Math.max(0, idx - 50), idx + query.length + 50)}...` : (data['summary'] as string)?.slice(0, 100) ?? '';
    return { id: d.id, title: (data['title'] as string) ?? '', date: (data['analyzedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '', match };
  });
  return { meetings: results };
}

// ══════════════════════════════════════════════════════════════════════════════
// PRO: MEETING STATS
// ══════════════════════════════════════════════════════════════════════════════

export async function getMeetingStats(companyId: string): Promise<{
  totalMeetings: number; totalActions: number; totalDecisions: number;
  avgDurationMin: number; sentimentDistribution: Record<string, number>;
  topTopics: { topic: string; count: number }[];
  actionsRoutedCount: number;
}> {
  const db = getFirestore();
  const snap = await db.collection('meetings').where('companyId', '==', companyId).limit(100).get();
  const meetings = snap.docs.map(d => d.data());
  const totalActions = meetings.reduce((s, m) => s + ((m['actionItems'] as unknown[])?.length ?? 0), 0);
  const totalDecisions = meetings.reduce((s, m) => s + ((m['keyDecisions'] as unknown[])?.length ?? 0), 0);
  const sentiments: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  let actionsRouted = 0;

  meetings.forEach(m => {
    const s = (m['sentiment'] as string) ?? 'neutral'; sentiments[s] = (sentiments[s] ?? 0) + 1;
    ((m['topics'] as string[]) ?? []).forEach(t => { topicCounts[t] = (topicCounts[t] ?? 0) + 1; });
    if (m['actionsRouted']) actionsRouted += ((m['actionsRouted'] as string[])?.length ?? 0);
  });

  return {
    totalMeetings: meetings.length, totalActions, totalDecisions,
    avgDurationMin: 0, sentimentDistribution: sentiments,
    topTopics: Object.entries(topicCounts).map(([t, c]) => ({ topic: t, count: c })).sort((a, b) => b.count - a.count).slice(0, 10),
    actionsRoutedCount: actionsRouted,
  };
}

// ── Expose as a tool ──────────────────────────────────────────────────────────
export const meetingAgentTool = ai.defineTool(
  {
    name: 'analyzeMeeting',
    description: 'Meeting PRO: transcribe, translate, analyze, extract actions, detect speakers, route actions to Sales/IT/HR/Legal, search across meetings.',
    inputSchema:  INPUT,
    outputSchema: OUTPUT,
  },
  (input) => meetingAgentFlow(input)
);

// ══════════════════════════════════════════════════════════════════════════════
// CHAT-MODE WRAPPER — manage meetings via conversation
// ══════════════════════════════════════════════════════════════════════════════

const listMeetingsTool = ai.defineTool(
  {
    name: 'mtg_listMeetings',
    description: 'List recent meetings for the company.',
    inputSchema: z.object({ companyId: z.string(), limit: z.number().optional().default(20) }),
    outputSchema: z.object({
      meetings: z.array(z.object({
        id: z.string(), title: z.string(), date: z.string(), status: z.string(),
        participantsCount: z.number(), actionItemsCount: z.number(), sentiment: z.string(),
      })),
      total: z.number(),
    }),
  },
  async ({ companyId, limit }) => {
    const db = getFirestore();
    const snap = await db.collection('meetings').where('companyId', '==', companyId).limit(limit ?? 20).get();
    const meetings = snap.docs
      .map(d => {
        const data = d.data();
        const ts = (data['analyzedAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ??
                   (data['createdAt'] as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? '';
        return {
          id: d.id,
          title: (data['title'] as string) ?? 'Sans titre',
          date: ts,
          status: (data['status'] as string) ?? 'pending',
          participantsCount: ((data['participants'] as unknown[]) ?? []).length,
          actionItemsCount: ((data['actionItems'] as unknown[]) ?? []).length,
          sentiment: (data['sentiment'] as string) ?? 'neutral',
        };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return { meetings, total: meetings.length };
  }
);

const getMeetingTool = ai.defineTool(
  {
    name: 'mtg_getMeeting',
    description: 'Get full details of a specific meeting (transcript, summary, action items, decisions).',
    inputSchema: z.object({ companyId: z.string(), meetingId: z.string() }),
    outputSchema: z.object({
      id: z.string(), title: z.string(), summary: z.string(), transcript: z.string(),
      actionItems: z.array(z.object({ task: z.string(), assignee: z.string().optional(), priority: z.string() })),
      keyDecisions: z.array(z.string()), sentiment: z.string(),
      topics: z.array(z.string()), participants: z.array(z.string()),
      found: z.boolean(),
    }),
  },
  async ({ meetingId }) => {
    const db = getFirestore();
    const doc = await db.collection('meetings').doc(meetingId).get();
    if (!doc.exists) return { id: meetingId, title: '', summary: '', transcript: '', actionItems: [], keyDecisions: [], sentiment: 'neutral', topics: [], participants: [], found: false };
    const d = doc.data() ?? {};
    return {
      id: meetingId,
      title: (d['title'] as string) ?? '',
      summary: (d['summary'] as string) ?? '',
      transcript: ((d['transcript'] as string) ?? '').slice(0, 4000),
      actionItems: ((d['actionItems'] as { task: string; assignee?: string; priority: string }[]) ?? []),
      keyDecisions: (d['keyDecisions'] as string[]) ?? [],
      sentiment: (d['sentiment'] as string) ?? 'neutral',
      topics: (d['topics'] as string[]) ?? [],
      participants: (d['participants'] as string[]) ?? [],
      found: true,
    };
  }
);

const searchMeetingsTool = ai.defineTool(
  {
    name: 'mtg_searchMeetings',
    description: 'Full-text search across all analyzed meetings (transcript, summary, topics).',
    inputSchema: z.object({ companyId: z.string(), query: z.string() }),
    outputSchema: z.object({
      meetings: z.array(z.object({ id: z.string(), title: z.string(), date: z.string(), match: z.string() })),
    }),
  },
  ({ companyId, query }) => searchMeetings(companyId, query)
);

const meetingStatsTool = ai.defineTool(
  {
    name: 'mtg_getStats',
    description: 'Get aggregated stats: total meetings, actions, decisions, sentiment distribution, top topics.',
    inputSchema: z.object({ companyId: z.string() }),
    outputSchema: z.object({
      totalMeetings: z.number(), totalActions: z.number(), totalDecisions: z.number(),
      avgDurationMin: z.number(),
      sentimentDistribution: z.record(z.string(), z.number()),
      topTopics: z.array(z.object({ topic: z.string(), count: z.number() })),
      actionsRoutedCount: z.number(),
    }),
  },
  ({ companyId }) => getMeetingStats(companyId)
);

const routeActionsTool = ai.defineTool(
  {
    name: 'mtg_routeActions',
    description: 'Route the action items of a meeting to the right department (Sales/IT/HR/Legal). Creates leads, tickets, cases automatically.',
    inputSchema: z.object({ companyId: z.string(), meetingId: z.string() }),
    outputSchema: z.object({ routed: z.array(z.string()), message: z.string() }),
  },
  async ({ companyId, meetingId }) => {
    const db = getFirestore();
    const doc = await db.collection('meetings').doc(meetingId).get();
    if (!doc.exists) return { routed: [], message: `Réunion ${meetingId} introuvable.` };
    const actions = (doc.data()?.['actionItems'] as MeetingOutput['actionItems']) ?? [];
    if (actions.length === 0) return { routed: [], message: `Aucune action à router dans la réunion ${meetingId}.` };
    const routed = await routeMeetingActions(companyId, meetingId, actions);
    return { routed, message: routed.length > 0 ? `${routed.length} action(s) routée(s).` : 'Aucune action n\'a matché un département.' };
  }
);

const scheduleMeetingTool = ai.defineTool(
  {
    name: 'mtg_scheduleMeeting',
    description: 'Schedule a new meeting in Google Calendar (requires MCP googleWorkspace).',
    inputSchema: z.object({
      companyId: z.string(),
      title: z.string(),
      startDateTime: z.string().describe('ISO 8601 datetime'),
      endDateTime: z.string().describe('ISO 8601 datetime'),
      attendees: z.array(z.string()).optional(),
      description: z.string().optional(),
    }),
    outputSchema: z.object({ success: z.boolean(), eventId: z.string().optional(), message: z.string() }),
  },
  async ({ title, startDateTime, endDateTime, attendees, description }) => {
    if (!mcpAvailability.googleWorkspace) {
      return { success: false, message: 'Google Calendar non configuré (MCP googleWorkspace requis). Configurer dans /admin/integrations.' };
    }
    try {
      const result = await calendarCreateEventTool({ summary: title, start: startDateTime, end: endDateTime, attendees, description } as never) as { eventId?: string; htmlLink?: string };
      return { success: true, eventId: result?.eventId, message: `Réunion "${title}" créée dans Google Calendar.` };
    } catch (err) {
      return { success: false, message: `Échec création événement Calendar: ${(err as Error).message ?? String(err)}` };
    }
  }
);

const listUpcomingMeetingsTool = ai.defineTool(
  {
    name: 'mtg_listUpcoming',
    description: 'List upcoming meetings from Google Calendar (requires MCP googleWorkspace).',
    inputSchema: z.object({ companyId: z.string(), maxResults: z.number().optional().default(10) }),
    outputSchema: z.object({
      events: z.array(z.object({ id: z.string(), title: z.string(), start: z.string(), end: z.string(), attendees: z.array(z.string()).optional() })),
      message: z.string(),
    }),
  },
  async ({ maxResults }) => {
    if (!mcpAvailability.googleWorkspace) return { events: [], message: 'Google Calendar non configuré.' };
    try {
      const raw = await calendarListEventsTool({ maxResults: maxResults ?? 10 } as never) as unknown;
      const r = raw as { events?: Array<Record<string, unknown>> };
      const events = (r?.events ?? []).map(e => ({
        id: (e['id'] as string) ?? '',
        title: ((e['title'] as string) ?? (e['summary'] as string)) ?? '',
        start: (e['start'] as string) ?? '',
        end: (e['end'] as string) ?? '',
        attendees: (e['attendees'] as string[] | undefined),
      }));
      return { events, message: `${events.length} réunion(s) à venir.` };
    } catch (err) {
      return { events: [], message: `Échec lecture Calendar: ${(err as Error).message ?? String(err)}` };
    }
  }
);

const CHAT_INPUT = z.object({
  request: z.string(),
  companyId: z.string(),
  userId: z.string().optional(),
  language: z.string().optional().default('auto'),
  history: z.array(z.object({ role: z.enum(['user', 'model']), content: z.string() })).optional(),
});

const CHAT_OUTPUT = z.object({
  response: z.string(),
  meetingId: z.string().optional(),
});

export const meetingAgentChatFlow = ai.defineFlow(
  { name: 'meetingAgentChat', inputSchema: CHAT_INPUT, outputSchema: CHAT_OUTPUT },
  async ({ request, companyId, userId, language, history }): Promise<z.infer<typeof CHAT_OUTPUT>> => {
    logger.info(`[MeetingAgentChat] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
    const langInstr = language === 'auto' ? 'Réponds dans la même langue que la demande (français par défaut).' : `Réponds en ${language}.`;

    const dateAnchors = (() => {
      const now = new Date();
      const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      return `AUJOURD'HUI : ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)} (${months[now.getMonth()]} ${now.getFullYear()}).`;
    })();

    const tools = [
      listMeetingsTool, getMeetingTool, searchMeetingsTool, meetingStatsTool,
      routeActionsTool, scheduleMeetingTool, listUpcomingMeetingsTool,
    ];

    const messages: Array<{ role: 'user' | 'model'; content: [{ text: string }] }> = [];
    if (history && history.length > 0) {
      for (const h of history.slice(-20)) messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });

    let response = await ai.generate({
      model: GEMINI_FLASH,
      system: `Tu es l'Agent Réunion PRO de l'entreprise — gardien de la mémoire des réunions, assistant de planification, routeur d'actions.
CompanyID: ${companyId}. UserID: ${userId ?? 'unknown'}.

## 📅 CONTEXTE TEMPOREL
${dateAnchors}
Pour les "réunions de la semaine", "du mois", planifications futures — utilise cette ancre.

## 🧠 MÉMOIRE CONVERSATIONNELLE
RÈGLE D'OR : conserve TOUJOURS la DERNIÈRE réunion mentionnée dans ta mémoire active.
• "cette réunion" / "celle-là" / "le #1" → utilise la réunion de TA DERNIÈRE liste/réponse
• "Route ses actions" → appelle mtg_routeActions avec le meetingId courant
• "Donne-moi le résumé" → mtg_getMeeting puis affiche \`summary\` + \`actionItems\`

## TON RÔLE
Tu pilotes la mémoire collective des réunions. Les transcriptions audio sont déjà analysées (via le pipeline upstream — tu ne fais PAS de transcription en chat). Toi tu interroges, tu cherches, tu routes, tu planifies.

CAPACITÉS :
1. RÉUNIONS PASSÉES : lister, ouvrir le détail, chercher dans les transcriptions (mtg_listMeetings, mtg_getMeeting, mtg_searchMeetings)
2. STATS : KPIs globaux — sentiment, top topics, actions routées (mtg_getStats)
3. ROUTAGE : envoyer les actions d'une réunion vers Sales/IT/HR/Legal (mtg_routeActions)
4. PLANIFICATION : créer un événement Google Calendar (mtg_scheduleMeeting), lister les réunions à venir (mtg_listUpcoming)

WORKFLOW TYPIQUE :
- "Liste mes réunions" → mtg_listMeetings (mémorise les IDs)
- "Donne-moi le résumé de la première" → mtg_getMeeting(meetingId=<#1>)
- "Quelles décisions ont été prises ?" → réponds depuis le keyDecisions du dernier mtg_getMeeting
- "Route les actions de cette réunion" → mtg_routeActions(meetingId=<courant>)
- "Cherche les réunions où on a parlé de Marie" → mtg_searchMeetings(query='Marie')
- "Programme une réunion vendredi 10h-11h avec Adelin et Sara" → mtg_scheduleMeeting(...) — nécessite MCP Google

RÈGLES :
- 🚫 ZÉRO FABRICATION : si un tool renvoie 0 réunions ou un message d'erreur, dis-le. Ne fabrique JAMAIS un résumé de réunion qui n'existe pas.
- Pour la planification, demande TOUJOURS confirmation date/heure/participants avant d'appeler mtg_scheduleMeeting.
- Si MCP Google n'est pas configuré, propose le planifying mais préviens l'utilisateur que l'envoi nécessite la config.
- Format des dates : ISO 8601 pour les tools, mais affiche en français pour l'utilisateur ("vendredi 25 avril 2026 à 10h").
${langInstr}`,
      messages,
      tools,
      config: { temperature: 0.3 },
    });

    let loopCount = 0;
    while (response.toolRequests.length > 0 && loopCount < 6) {
      loopCount++;
      const toolResults = await Promise.all(response.toolRequests.map(async (p) => {
        const { name, input, ref } = p.toolRequest;
        const tool = tools.find(t => (t as unknown as { __action?: { name?: string } }).__action?.name === name);
        let output: unknown;
        try { output = tool ? await (tool as (a: unknown) => Promise<unknown>)({ ...(input as Record<string, unknown>), companyId }) : { error: `Tool inconnu: ${name}` }; }
        catch (err) { output = { error: String(err) }; }
        return { name, ref, output };
      }));
      response = await ai.generate({
        model: GEMINI_FLASH,
        messages: [...response.messages, { role: 'tool' as const, content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
        tools, config: { temperature: 0.3 },
      });
    }

    const text = response.text;
    return { response: text };
  }
);

export const meetingAgentChatTool = ai.defineTool(
  {
    name: 'callMeetingAgent',
    description: 'Meeting PRO chat-mode: lister/chercher/router les réunions, stats, planification Google Calendar.',
    inputSchema: CHAT_INPUT,
    outputSchema: CHAT_OUTPUT,
  },
  (input) => meetingAgentChatFlow(input)
);
