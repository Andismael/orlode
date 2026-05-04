"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetingAgentChatTool = exports.meetingAgentChatFlow = exports.meetingAgentTool = exports.meetingAgentFlow = void 0;
exports.routeMeetingActions = routeMeetingActions;
exports.searchMeetings = searchMeetings;
exports.getMeetingStats = getMeetingStats;
/**
 * Meeting Agent — Gemini Flash + Q&A Agent (as tool)
 *
 * Pattern: parallel execution
 * Responsibility: Transcribe + analyze meetings simultaneously.
 * Transcription (audio→text) and Vision analysis run in parallel via Promise.all.
 * Q&A agent is available as a tool to answer questions about meeting content.
 */
const zod_1 = require("zod");
const genkit_config_1 = require("../config/genkit.config");
const firebase_config_1 = require("../config/firebase.config");
const qa_agent_1 = require("./qa.agent");
const vision_agent_1 = require("./vision.agent");
const googleWorkspace_1 = require("./tools/mcp/googleWorkspace");
const slack_1 = require("./tools/mcp/slack");
const mcp_config_1 = require("../config/mcp.config");
const translationService_1 = require("../services/firebase-ml/translationService");
const logger_1 = require("../utils/logger");
const INPUT = zod_1.z.object({
    meetingId: zod_1.z.string(),
    companyId: zod_1.z.string(),
    audioBase64: zod_1.z.string().optional().describe('Base64 audio/video for transcription'),
    audioMime: zod_1.z.string().optional().default('audio/webm'),
    frameBase64: zod_1.z.string().optional().describe('Base64 thumbnail/frame for visual analysis'),
    title: zod_1.z.string().optional(),
    participants: zod_1.z.array(zod_1.z.string()).optional(),
    question: zod_1.z.string().optional().describe('Optional question to answer about this meeting'),
});
const OUTPUT = zod_1.z.object({
    transcript: zod_1.z.string().optional(),
    language: zod_1.z.string().optional(),
    summary: zod_1.z.string(),
    actionItems: zod_1.z.array(zod_1.z.object({
        task: zod_1.z.string(),
        assignee: zod_1.z.string().optional(),
        dueDate: zod_1.z.string().optional(),
        priority: zod_1.z.enum(['high', 'medium', 'low']),
    })),
    keyDecisions: zod_1.z.array(zod_1.z.string()),
    sentiment: zod_1.z.enum(['positive', 'neutral', 'negative', 'mixed']),
    topics: zod_1.z.array(zod_1.z.string()),
    visualNotes: zod_1.z.string().optional(),
    qaAnswer: zod_1.z.string().optional(),
});
// ── Transcribe audio via Gemini multimodal ────────────────────────────────────
async function transcribeAudio(base64, mime) {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: [
            {
                media: {
                    contentType: mime,
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
        const parsed = JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
        return parsed;
    }
    catch {
        return { text, language: 'en' };
    }
}
// ── Analyze transcript → structured insights ──────────────────────────────────
async function analyzeTranscript(transcript, title, participants) {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
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
        return JSON.parse(text.replace(/^```json\s*/, '').replace(/\s*```$/, ''));
    }
    catch {
        return {
            summary: text,
            actionItems: [],
            keyDecisions: [],
            sentiment: 'neutral',
            topics: [],
        };
    }
}
// ── The flow (parallel pattern) ───────────────────────────────────────────────
exports.meetingAgentFlow = genkit_config_1.ai.defineFlow({ name: 'meetingAgent', inputSchema: INPUT, outputSchema: OUTPUT }, async ({ meetingId, companyId, audioBase64, audioMime, frameBase64, title, participants, question }) => {
    logger_1.logger.info(`[MeetingAgent] Processing meeting ${meetingId}`);
    const db = (0, firebase_config_1.getFirestore)();
    // ── PARALLEL: transcription + visual analysis ─────────────────────────
    const [transcriptionResult, visualResult] = await Promise.all([
        // Task 1: Transcribe audio (if provided)
        audioBase64
            ? transcribeAudio(audioBase64, audioMime ?? 'audio/webm')
            : Promise.resolve({ text: '', language: 'en' }),
        // Task 2: Analyze visual frame (if provided) using Vision agent
        frameBase64
            ? (0, vision_agent_1.visionAgentTool)({
                imageBase64: frameBase64,
                mimeType: 'image/jpeg',
                task: 'analyze',
                context: title ?? 'Meeting frame',
            })
            : Promise.resolve(null),
    ]);
    let transcript = transcriptionResult.text;
    const language = transcriptionResult.language;
    // ── Auto-translate transcript to company language if different ───────────
    // Fetches the company's preferred language from Firestore
    try {
        const db2 = (0, firebase_config_1.getFirestore)();
        const companyDoc = await db2.collection('companies').doc(companyId).get();
        const companyLang = companyDoc.data()?.['settings']?.['language'];
        if (companyLang && companyLang !== language && companyLang !== 'auto') {
            const translated = await translationService_1.translationService.translateIfNeeded(transcript, companyLang);
            if (translated.wasTranslated) {
                logger_1.logger.info(`[MeetingAgent] Transcript translated ${language} → ${companyLang}`);
                transcript = `[Translated from ${language} to ${companyLang}]\n\n${translated.translatedText}`;
            }
        }
    }
    catch {
        // Translation is non-critical — continue with original transcript
    }
    logger_1.logger.info(`[MeetingAgent] Transcription: ${transcript.length} chars | Visual: ${visualResult ? 'yes' : 'no'}`);
    // ── Sequential: analyze transcript if we have content ────────────────
    let analysis;
    if (transcript.length > 50) {
        analysis = await analyzeTranscript(transcript, title ?? 'Meeting', participants ?? []);
    }
    else {
        // No audio — generate a basic summary from context
        analysis = {
            summary: title ? `Meeting: ${title}` : 'No transcript available.',
            actionItems: [],
            keyDecisions: [],
            sentiment: 'neutral',
            topics: [],
        };
    }
    // ── Optional: answer a specific question about this meeting ──────────
    let qaAnswer;
    if (question && transcript.length > 50) {
        logger_1.logger.info(`[MeetingAgent] Answering question: "${question.slice(0, 60)}"`);
        const qaResult = await (0, qa_agent_1.qaAgentTool)({
            question,
            companyId,
            context: `Meeting transcript:\n${transcript.slice(0, 3000)}`,
            language,
        });
        qaAnswer = qaResult.answer;
    }
    // ── Save to Firestore ─────────────────────────────────────────────────
    const updateData = {
        hasTranscript: !!transcript,
        transcript: transcript || null,
        language,
        summary: analysis.summary,
        actionItems: analysis.actionItems,
        keyDecisions: analysis.keyDecisions,
        sentiment: analysis.sentiment,
        topics: analysis.topics,
        status: 'analyzed',
        analyzedAt: new Date(),
    };
    if (visualResult)
        updateData['visualNotes'] = visualResult.description;
    await db.collection('meetings').doc(meetingId).update(updateData);
    logger_1.logger.info(`[MeetingAgent] Saved analysis for meeting ${meetingId}`);
    // ── MCP Phase 3: post-meeting automations (fire & forget) ────────────
    if (analysis.actionItems.length > 0 || analysis.summary) {
        setImmediate(async () => {
            // Create Google Tasks for each action item
            if (mcp_config_1.mcpAvailability.googleWorkspace && analysis.actionItems.length > 0) {
                logger_1.logger.info(`[MeetingAgent] Creating ${analysis.actionItems.length} Google Tasks via MCP`);
                await Promise.allSettled(analysis.actionItems.slice(0, 10).map((item) => (0, googleWorkspace_1.tasksCreateTool)({
                    title: item.task,
                    notes: item.assignee ? `Assignee: ${item.assignee}` : undefined,
                    due: item.dueDate ?? undefined,
                }).catch((err) => logger_1.logger.warn('[MeetingAgent] Task creation failed', { error: err }))));
            }
            // Post summary to Slack
            if (mcp_config_1.mcpAvailability.slack && analysis.summary) {
                logger_1.logger.info('[MeetingAgent] Posting meeting summary to Slack');
                const slackText = `*Meeting Summary${title ? ': ' + title : ''}*\n\n${analysis.summary}\n\n*Action Items:* ${analysis.actionItems.length}`;
                await (0, slack_1.slackSendMessageTool)({ channel: '#general', text: slackText })
                    .catch((err) => logger_1.logger.warn('[MeetingAgent] Slack notification failed', { error: err }));
            }
            // Draft follow-up email via Gmail
            if (mcp_config_1.mcpAvailability.googleWorkspace && participants && participants.length > 0 && analysis.summary) {
                logger_1.logger.info('[MeetingAgent] Creating Gmail draft for meeting follow-up');
                await (0, googleWorkspace_1.gmailDraftTool)({
                    to: participants.join(', '),
                    subject: `Meeting Summary${title ? ': ' + title : ''} — ${new Date().toLocaleDateString()}`,
                    body: `Hi team,\n\nHere is the summary of our meeting:\n\n${analysis.summary}\n\n**Action Items:**\n${analysis.actionItems.map((a) => `- ${a.task}${a.assignee ? ' (' + a.assignee + ')' : ''}`).join('\n')}\n\nBest regards,\nOrlode AI`,
                }).catch((err) => logger_1.logger.warn('[MeetingAgent] Gmail draft failed', { error: err }));
            }
        });
    }
    return {
        transcript: transcript || undefined,
        language,
        summary: analysis.summary,
        actionItems: analysis.actionItems,
        keyDecisions: analysis.keyDecisions,
        sentiment: analysis.sentiment,
        topics: analysis.topics,
        visualNotes: visualResult?.description,
        qaAnswer,
    };
});
// ══════════════════════════════════════════════════════════════════════════════
// PRO: ACTION ROUTING (cross-agent — route actions to the right department)
// ══════════════════════════════════════════════════════════════════════════════
const helpers_1 = require("../utils/helpers");
async function routeMeetingActions(companyId, meetingId, actions) {
    const db = (0, firebase_config_1.getFirestore)();
    const routed = [];
    for (const action of actions) {
        const lower = (action.task + ' ' + (action.assignee ?? '')).toLowerCase();
        // Route to Sales
        if (/devis|quote|client|prospect|commercial|vente/i.test(lower)) {
            await db.collection(`companies/${companyId}/leads`).doc((0, helpers_1.generateId)()).set({
                id: (0, helpers_1.generateId)(), name: action.task.slice(0, 80), source: 'meeting', stage: 'nouveau',
                notes: `Action de reunion ${meetingId}: ${action.task}. Assigne: ${action.assignee ?? 'non assigne'}`,
                createdAt: new Date(),
            });
            routed.push(`Sales: "${action.task}" → lead cree`);
        }
        // Route to IT
        if (/bug|serveur|deploiement|technique|IT|infrastructure|code/i.test(lower)) {
            await db.collection(`companies/${companyId}/itTickets`).doc((0, helpers_1.generateId)()).set({
                id: (0, helpers_1.generateId)(), subject: `[MEETING] ${action.task}`, description: `Action de reunion: ${action.task}`,
                priority: action.priority === 'high' ? 'high' : 'medium', status: 'open', source: 'meeting', meetingId, createdAt: new Date(),
            });
            routed.push(`IT: "${action.task}" → ticket cree`);
        }
        // Route to HR
        if (/recrutement|embauche|conge|formation|onboarding|RH/i.test(lower)) {
            await db.collection(`companies/${companyId}/hrTickets`).doc((0, helpers_1.generateId)()).set({
                id: (0, helpers_1.generateId)(), subject: `[MEETING] ${action.task}`, description: action.task,
                category: 'request', priority: 'medium', status: 'open', source: 'meeting', meetingId, createdAt: new Date(),
            });
            routed.push(`HR: "${action.task}" → ticket cree`);
        }
        // Route to Legal
        if (/contrat|juridique|legal|conformite|rgpd|signature/i.test(lower)) {
            await db.collection(`companies/${companyId}/legalCases`).doc((0, helpers_1.generateId)()).set({
                id: (0, helpers_1.generateId)(), title: `[MEETING] ${action.task}`, type: 'task', status: 'open',
                description: action.task, source: 'meeting', meetingId, createdAt: new Date(),
            });
            routed.push(`Legal: "${action.task}" → dossier cree`);
        }
    }
    // Log routing
    if (routed.length > 0) {
        await db.collection('meetings').doc(meetingId).update({ actionsRouted: routed, routedAt: new Date() }).catch(() => { });
    }
    return routed;
}
// ══════════════════════════════════════════════════════════════════════════════
// PRO: MEETING SEARCH (find across all meetings)
// ══════════════════════════════════════════════════════════════════════════════
async function searchMeetings(companyId, query) {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('meetings').where('companyId', '==', companyId).where('status', '==', 'analyzed').limit(50).get();
    const q = query.toLowerCase();
    const results = snap.docs.filter(d => {
        const data = d.data();
        const text = `${data['title'] ?? ''} ${data['transcript'] ?? ''} ${data['summary'] ?? ''} ${data['topics']?.join(' ') ?? ''}`.toLowerCase();
        return text.includes(q);
    }).map(d => {
        const data = d.data();
        const transcript = data['transcript'] ?? '';
        const idx = transcript.toLowerCase().indexOf(q);
        const match = idx >= 0 ? `...${transcript.slice(Math.max(0, idx - 50), idx + query.length + 50)}...` : data['summary']?.slice(0, 100) ?? '';
        return { id: d.id, title: data['title'] ?? '', date: data['analyzedAt']?.toDate?.()?.toISOString() ?? '', match };
    });
    return { meetings: results };
}
// ══════════════════════════════════════════════════════════════════════════════
// PRO: MEETING STATS
// ══════════════════════════════════════════════════════════════════════════════
async function getMeetingStats(companyId) {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('meetings').where('companyId', '==', companyId).limit(100).get();
    const meetings = snap.docs.map(d => d.data());
    const totalActions = meetings.reduce((s, m) => s + (m['actionItems']?.length ?? 0), 0);
    const totalDecisions = meetings.reduce((s, m) => s + (m['keyDecisions']?.length ?? 0), 0);
    const sentiments = {};
    const topicCounts = {};
    let actionsRouted = 0;
    meetings.forEach(m => {
        const s = m['sentiment'] ?? 'neutral';
        sentiments[s] = (sentiments[s] ?? 0) + 1;
        (m['topics'] ?? []).forEach(t => { topicCounts[t] = (topicCounts[t] ?? 0) + 1; });
        if (m['actionsRouted'])
            actionsRouted += (m['actionsRouted']?.length ?? 0);
    });
    return {
        totalMeetings: meetings.length, totalActions, totalDecisions,
        avgDurationMin: 0, sentimentDistribution: sentiments,
        topTopics: Object.entries(topicCounts).map(([t, c]) => ({ topic: t, count: c })).sort((a, b) => b.count - a.count).slice(0, 10),
        actionsRoutedCount: actionsRouted,
    };
}
// ── Expose as a tool ──────────────────────────────────────────────────────────
exports.meetingAgentTool = genkit_config_1.ai.defineTool({
    name: 'analyzeMeeting',
    description: 'Meeting PRO: transcribe, translate, analyze, extract actions, detect speakers, route actions to Sales/IT/HR/Legal, search across meetings.',
    inputSchema: INPUT,
    outputSchema: OUTPUT,
}, (input) => (0, exports.meetingAgentFlow)(input));
// ══════════════════════════════════════════════════════════════════════════════
// CHAT-MODE WRAPPER — manage meetings via conversation
// ══════════════════════════════════════════════════════════════════════════════
const listMeetingsTool = genkit_config_1.ai.defineTool({
    name: 'mtg_listMeetings',
    description: 'List recent meetings for the company.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), limit: zod_1.z.number().optional().default(20) }),
    outputSchema: zod_1.z.object({
        meetings: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(), title: zod_1.z.string(), date: zod_1.z.string(), status: zod_1.z.string(),
            participantsCount: zod_1.z.number(), actionItemsCount: zod_1.z.number(), sentiment: zod_1.z.string(),
        })),
        total: zod_1.z.number(),
    }),
}, async ({ companyId, limit }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const snap = await db.collection('meetings').where('companyId', '==', companyId).limit(limit ?? 20).get();
    const meetings = snap.docs
        .map(d => {
        const data = d.data();
        const ts = data['analyzedAt']?.toDate?.()?.toISOString() ??
            data['createdAt']?.toDate?.()?.toISOString() ?? '';
        return {
            id: d.id,
            title: data['title'] ?? 'Sans titre',
            date: ts,
            status: data['status'] ?? 'pending',
            participantsCount: (data['participants'] ?? []).length,
            actionItemsCount: (data['actionItems'] ?? []).length,
            sentiment: data['sentiment'] ?? 'neutral',
        };
    })
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return { meetings, total: meetings.length };
});
const getMeetingTool = genkit_config_1.ai.defineTool({
    name: 'mtg_getMeeting',
    description: 'Get full details of a specific meeting (transcript, summary, action items, decisions).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), meetingId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        id: zod_1.z.string(), title: zod_1.z.string(), summary: zod_1.z.string(), transcript: zod_1.z.string(),
        actionItems: zod_1.z.array(zod_1.z.object({ task: zod_1.z.string(), assignee: zod_1.z.string().optional(), priority: zod_1.z.string() })),
        keyDecisions: zod_1.z.array(zod_1.z.string()), sentiment: zod_1.z.string(),
        topics: zod_1.z.array(zod_1.z.string()), participants: zod_1.z.array(zod_1.z.string()),
        found: zod_1.z.boolean(),
    }),
}, async ({ meetingId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('meetings').doc(meetingId).get();
    if (!doc.exists)
        return { id: meetingId, title: '', summary: '', transcript: '', actionItems: [], keyDecisions: [], sentiment: 'neutral', topics: [], participants: [], found: false };
    const d = doc.data() ?? {};
    return {
        id: meetingId,
        title: d['title'] ?? '',
        summary: d['summary'] ?? '',
        transcript: (d['transcript'] ?? '').slice(0, 4000),
        actionItems: (d['actionItems'] ?? []),
        keyDecisions: d['keyDecisions'] ?? [],
        sentiment: d['sentiment'] ?? 'neutral',
        topics: d['topics'] ?? [],
        participants: d['participants'] ?? [],
        found: true,
    };
});
const searchMeetingsTool = genkit_config_1.ai.defineTool({
    name: 'mtg_searchMeetings',
    description: 'Full-text search across all analyzed meetings (transcript, summary, topics).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), query: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        meetings: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), date: zod_1.z.string(), match: zod_1.z.string() })),
    }),
}, ({ companyId, query }) => searchMeetings(companyId, query));
const meetingStatsTool = genkit_config_1.ai.defineTool({
    name: 'mtg_getStats',
    description: 'Get aggregated stats: total meetings, actions, decisions, sentiment distribution, top topics.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({
        totalMeetings: zod_1.z.number(), totalActions: zod_1.z.number(), totalDecisions: zod_1.z.number(),
        avgDurationMin: zod_1.z.number(),
        sentimentDistribution: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        topTopics: zod_1.z.array(zod_1.z.object({ topic: zod_1.z.string(), count: zod_1.z.number() })),
        actionsRoutedCount: zod_1.z.number(),
    }),
}, ({ companyId }) => getMeetingStats(companyId));
const routeActionsTool = genkit_config_1.ai.defineTool({
    name: 'mtg_routeActions',
    description: 'Route the action items of a meeting to the right department (Sales/IT/HR/Legal). Creates leads, tickets, cases automatically.',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), meetingId: zod_1.z.string() }),
    outputSchema: zod_1.z.object({ routed: zod_1.z.array(zod_1.z.string()), message: zod_1.z.string() }),
}, async ({ companyId, meetingId }) => {
    const db = (0, firebase_config_1.getFirestore)();
    const doc = await db.collection('meetings').doc(meetingId).get();
    if (!doc.exists)
        return { routed: [], message: `Réunion ${meetingId} introuvable.` };
    const actions = doc.data()?.['actionItems'] ?? [];
    if (actions.length === 0)
        return { routed: [], message: `Aucune action à router dans la réunion ${meetingId}.` };
    const routed = await routeMeetingActions(companyId, meetingId, actions);
    return { routed, message: routed.length > 0 ? `${routed.length} action(s) routée(s).` : 'Aucune action n\'a matché un département.' };
});
const scheduleMeetingTool = genkit_config_1.ai.defineTool({
    name: 'mtg_scheduleMeeting',
    description: 'Schedule a new meeting in Google Calendar (requires MCP googleWorkspace).',
    inputSchema: zod_1.z.object({
        companyId: zod_1.z.string(),
        title: zod_1.z.string(),
        startDateTime: zod_1.z.string().describe('ISO 8601 datetime'),
        endDateTime: zod_1.z.string().describe('ISO 8601 datetime'),
        attendees: zod_1.z.array(zod_1.z.string()).optional(),
        description: zod_1.z.string().optional(),
    }),
    outputSchema: zod_1.z.object({ success: zod_1.z.boolean(), eventId: zod_1.z.string().optional(), message: zod_1.z.string() }),
}, async ({ title, startDateTime, endDateTime, attendees, description }) => {
    if (!mcp_config_1.mcpAvailability.googleWorkspace) {
        return { success: false, message: 'Google Calendar non configuré (MCP googleWorkspace requis). Configurer dans /admin/integrations.' };
    }
    try {
        const result = await (0, googleWorkspace_1.calendarCreateEventTool)({ summary: title, start: startDateTime, end: endDateTime, attendees, description });
        return { success: true, eventId: result?.eventId, message: `Réunion "${title}" créée dans Google Calendar.` };
    }
    catch (err) {
        return { success: false, message: `Échec création événement Calendar: ${err.message ?? String(err)}` };
    }
});
const listUpcomingMeetingsTool = genkit_config_1.ai.defineTool({
    name: 'mtg_listUpcoming',
    description: 'List upcoming meetings from Google Calendar (requires MCP googleWorkspace).',
    inputSchema: zod_1.z.object({ companyId: zod_1.z.string(), maxResults: zod_1.z.number().optional().default(10) }),
    outputSchema: zod_1.z.object({
        events: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string(), start: zod_1.z.string(), end: zod_1.z.string(), attendees: zod_1.z.array(zod_1.z.string()).optional() })),
        message: zod_1.z.string(),
    }),
}, async ({ maxResults }) => {
    if (!mcp_config_1.mcpAvailability.googleWorkspace)
        return { events: [], message: 'Google Calendar non configuré.' };
    try {
        const raw = await (0, googleWorkspace_1.calendarListEventsTool)({ maxResults: maxResults ?? 10 });
        const r = raw;
        const events = (r?.events ?? []).map(e => ({
            id: e['id'] ?? '',
            title: (e['title'] ?? e['summary']) ?? '',
            start: e['start'] ?? '',
            end: e['end'] ?? '',
            attendees: e['attendees'],
        }));
        return { events, message: `${events.length} réunion(s) à venir.` };
    }
    catch (err) {
        return { events: [], message: `Échec lecture Calendar: ${err.message ?? String(err)}` };
    }
});
const CHAT_INPUT = zod_1.z.object({
    request: zod_1.z.string(),
    companyId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    language: zod_1.z.string().optional().default('auto'),
    history: zod_1.z.array(zod_1.z.object({ role: zod_1.z.enum(['user', 'model']), content: zod_1.z.string() })).optional(),
});
const CHAT_OUTPUT = zod_1.z.object({
    response: zod_1.z.string(),
    meetingId: zod_1.z.string().optional(),
});
exports.meetingAgentChatFlow = genkit_config_1.ai.defineFlow({ name: 'meetingAgentChat', inputSchema: CHAT_INPUT, outputSchema: CHAT_OUTPUT }, async ({ request, companyId, userId, language, history }) => {
    logger_1.logger.info(`[MeetingAgentChat] Request: "${request.slice(0, 80)}" (history=${history?.length ?? 0})`);
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
    const messages = [];
    if (history && history.length > 0) {
        for (const h of history.slice(-20))
            messages.push({ role: h.role, content: [{ text: h.content }] });
    }
    messages.push({ role: 'user', content: [{ text: request }] });
    let response = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
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
            const tool = tools.find(t => t.__action?.name === name);
            let output;
            try {
                output = tool ? await tool({ ...input, companyId }) : { error: `Tool inconnu: ${name}` };
            }
            catch (err) {
                output = { error: String(err) };
            }
            return { name, ref, output };
        }));
        response = await genkit_config_1.ai.generate({
            model: genkit_config_1.GEMINI_FLASH,
            messages: [...response.messages, { role: 'tool', content: toolResults.map(r => ({ toolResponse: { name: r.name, ref: r.ref, output: r.output } })) }],
            tools, config: { temperature: 0.3 },
        });
    }
    const text = response.text;
    return { response: text };
});
exports.meetingAgentChatTool = genkit_config_1.ai.defineTool({
    name: 'callMeetingAgent',
    description: 'Meeting PRO chat-mode: lister/chercher/router les réunions, stats, planification Google Calendar.',
    inputSchema: CHAT_INPUT,
    outputSchema: CHAT_OUTPUT,
}, (input) => (0, exports.meetingAgentChatFlow)(input));
//# sourceMappingURL=meeting.agent.js.map