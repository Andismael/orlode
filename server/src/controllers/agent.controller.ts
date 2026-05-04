/**
 * Agent Controller
 * Handles requests routed through the multi-agent orchestrator (Phase 3).
 * Supports SSE streaming and direct JSON responses.
 */
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { runOrchestrator } from '../agents/orchestrator.agent';
import { getFirestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';
import { runScheduledNewsBriefing, newsAgentFlow } from '../agents/news.agent';
import {
  createConversation,
  getConversation,
  getConversationHistory,
  saveMessage,
} from '../services/ai/conversationManager';
import { insightsAgentFlow } from '../agents/insights.agent';
import { documentsAgentFlow } from '../agents/documents.agent';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// ── POST /api/agent/conversations/:id/messages (SSE streaming via orchestrator)
export async function agentSendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id: conversationId } = req.params as { id: string };
  const { content, language, agentId } = req.body as { content: string; language?: string; agentId?: string };

  if (!content?.trim()) throw new AppError('Message content is required', 400);
  if (!req.user?.uid) throw new AppError('User not authenticated', 401);

  // Detect agent ID from body or from [Agent: XYZ] prefix in content
  let targetAgent = agentId?.trim();
  if (!targetAgent) {
    const match = content.match(/^\[Agent:\s*([^\]]+)\]\s*/i);
    if (match) targetAgent = match[1].trim().toLowerCase();
  }

  const conversation = await getConversation(conversationId);
  if (!conversation) throw new AppError('Conversation not found', 404);

  const companyId = conversation.companyId;

  // Save user message
  await saveMessage(conversationId, {
    conversationId,
    role:      'user',
    content:   content.trim(),
    createdAt: new Date(),
  });

  // Fetch conversation history (last 20 messages for context)
  const history = await getConversationHistory(conversationId);
  const chatHistory = history
    .slice(-21, -1) // exclude just-saved user msg, keep last 20
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user' as 'user' | 'model', content: m.content }));

  // ── Set up SSE ────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const pingInterval = setInterval(() => {
    if (!res.writableEnded) res.write(':ping\n\n');
  }, 15000);

  let fullReply = '';
  const startTime = Date.now();

  try {
    // Stream chunks to the client as they come
    const streamCb = (chunk: string) => {
      if (!res.writableEnded) {
        fullReply += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    };

    // Direct agent dispatch — bypass Orchestrator for agent-specific dashboards.
    // Map agent IDs → direct agent tool functions. Each direct call avoids the
    // Orchestrator's routing layer so the specialized agent's prompt is used directly.
    const cleanContent = content.replace(/^\[Agent:\s*[^\]]+\]\s*/i, '').trim();
    const directArgs = {
      request: cleanContent,
      companyId,
      userId: req.user!.uid,
      language: language ?? 'auto',
      history: chatHistory, // keep context across turns (Herve creation → "tu veux une photo ?")
    };
    // Only include agents with the standard `{ request, companyId, userId, language }` signature.
    // Meeting, insights, comms use different schemas and stay on the Orchestrator.
    // Args without history for agents that don't accept it (avoid zod strict errors)
    const baseArgs = { request: cleanContent, companyId, userId: req.user!.uid, language: language ?? 'auto' };
    const DIRECT_AGENTS: Record<string, () => Promise<unknown>> = {
      hr:            async () => (await import('../agents/hr.agent')).hrAgentTool(directArgs),
      rh:            async () => (await import('../agents/hr.agent')).hrAgentTool(directArgs),
      accounting:    async () => (await import('../agents/accounting.agent')).accountingAgentTool(directArgs),
      comptabilite:  async () => (await import('../agents/accounting.agent')).accountingAgentTool(directArgs),
      sales:         async () => (await import('../agents/sales.agent')).salesAgentTool(directArgs),
      ventes:        async () => (await import('../agents/sales.agent')).salesAgentTool(directArgs),
      support:       async () => (await import('../agents/support.agent')).supportAgentTool(directArgs),
      marketing:     async () => (await import('../agents/marketing.agent')).marketingAgentTool(directArgs),
      legal:         async () => (await import('../agents/legal.agent')).legalAgentTool(directArgs),
      juridique:     async () => (await import('../agents/legal.agent')).legalAgentTool(directArgs),
      reception:     async () => (await import('../agents/reception.agent')).receptionAgentTool(directArgs),
      training:      async () => (await import('../agents/training.agent')).trainingAgentTool(directArgs),
      formation:     async () => (await import('../agents/training.agent')).trainingAgentTool(directArgs),
      knowledge:     async () => (await import('../agents/knowledge.agent')).knowledgeAgentTool(directArgs),
      comms:         async () => (await import('../agents/comms.agent')).commsAgentChatTool(directArgs),
      communication: async () => (await import('../agents/comms.agent')).commsAgentChatTool(directArgs),
      meeting:       async () => (await import('../agents/meeting.agent')).meetingAgentChatTool(directArgs),
      reunion:       async () => (await import('../agents/meeting.agent')).meetingAgentChatTool(directArgs),
      // qa uses different input schema — stays on the orchestrator
      wildcard:      async () => (await import('../agents/wildcard.agent')).wildcardAgentTool(baseArgs),
      news:          async () => (await import('../agents/news.agent')).newsAgentTool(directArgs),
      veille:        async () => (await import('../agents/news.agent')).newsAgentTool(directArgs),
      coach:         async () => (await import('../agents/coach.agent')).coachAgentTool(directArgs),
      it:            async () => (await import('../agents/it.agent')).itAgentTool(directArgs),
      datascientist: async () => (await import('../agents/datascientist.agent')).dataScientistAgentTool(directArgs),
      cybersecurity: async () => (await import('../agents/cybersecurity.agent')).cybersecurityAgentTool(directArgs),
      security:      async () => (await import('../agents/cybersecurity.agent')).cybersecurityAgentTool(directArgs),
      // Approval / workflow agent — core platform agent included with every $20 pack
      approval:      async () => (await import('../agents/approval.agent')).approvalAgentTool(baseArgs),
      workflow:      async () => (await import('../agents/approval.agent')).approvalAgentTool(baseArgs),
    };

    let result: { reply: string; agentsUsed: string[]; toolsCalled: string[] };
    if (targetAgent && DIRECT_AGENTS[targetAgent]) {
      const direct = await DIRECT_AGENTS[targetAgent]();
      const directRes = direct as { reply?: string; response?: string };
      const reply = directRes?.reply ?? directRes?.response ?? JSON.stringify(direct);
      if (reply) streamCb(reply);
      result = { reply, agentsUsed: [targetAgent], toolsCalled: [] };
    } else {
      result = await runOrchestrator({
        message:   content.trim(),
        companyId,
        userId:    req.user.uid,
        history:   chatHistory,
        language:  language ?? 'auto',
        streamCb,
      });
    }

    // If streaming didn't fire (no streamCb used), send full reply now
    if (!fullReply && result.reply) {
      fullReply = result.reply;
      res.write(`data: ${JSON.stringify({ content: result.reply })}\n\n`);
    }

    // Send metadata (agents used, tools called)
    if (result.agentsUsed.length > 0) {
      res.write(`data: ${JSON.stringify({ agentsUsed: result.agentsUsed, toolsCalled: result.toolsCalled })}\n\n`);
    }

    // Save assistant reply
    await saveMessage(conversationId, {
      conversationId,
      role:      'assistant',
      content:   fullReply || result.reply,
      createdAt: new Date(),
      metadata:  { agentsUsed: result.agentsUsed, toolsCalled: result.toolsCalled },
    });

    // Track agent stats (fire-and-forget)
    const elapsedMs = Date.now() - startTime;
    const tokenEstimate = Math.round((fullReply || result.reply).length / 4);
    const db = getFirestore();
    const agentsToTrack = result.agentsUsed.length > 0 ? result.agentsUsed : ['orchestrator'];
    for (const agentName of agentsToTrack) {
      const docId = `${companyId}_${agentName}`;
      db.collection('agentStatus').doc(docId).set({
        companyId,
        agentId: agentName,
        enabled: true,
        callsToday: FieldValue.increment(1),
        tokensToday: FieldValue.increment(tokenEstimate),
        avgLatencyMs: elapsedMs,
        lastCallAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true }).catch(() => {});
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    logger.error('[AgentController] Orchestrator error', { message: errMsg, stack: errStack, error: err });
    if (!res.writableEnded) {
      const userMsg = process.env['NODE_ENV'] === 'production'
        ? 'Something went wrong, please try again'
        : errMsg;
      res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
    }
  } finally {
    clearInterval(pingInterval);
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}

// ── POST /api/agent/insights — trigger insights agent manually ────────────────
export async function runInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { companyId, mode = 'full', maxInsights = 5 } = req.body as {
    companyId?: string; mode?: string; maxInsights?: number;
  };
  const resolvedCompanyId = companyId ?? req.user?.companyId;
  if (!resolvedCompanyId) throw new AppError('Company ID required', 400);

  logger.info(`[AgentController] Running insights for company ${resolvedCompanyId}`);

  try {
    const result = await insightsAgentFlow({
      companyId: resolvedCompanyId,
      mode:      mode as 'full' | 'quick' | 'documents' | 'meetings' | 'conversations',
      maxInsights,
    });
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    // Genkit/AI keys not configured — return empty insights so UI doesn't crash
    logger.warn('[AgentController] insightsAgentFlow failed', { error: err });
    res.json({ success: true, data: { insights: [] }, warning: 'AI service unavailable' });
  }
}

// ── POST /api/agent/process-document — trigger documents agent ────────────────
export async function processDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { documentId, companyId, fileBuffer, fileName, mimeType } = req.body as {
    documentId: string;
    companyId?:  string;
    fileBuffer:  string;
    fileName:    string;
    mimeType:    string;
  };

  const resolvedCompanyId = companyId ?? req.user?.companyId;
  if (!resolvedCompanyId) throw new AppError('Company ID required', 400);
  if (!documentId || !fileBuffer || !fileName) throw new AppError('documentId, fileBuffer, fileName required', 400);

  logger.info(`[AgentController] Processing document ${documentId}`);

  const result = await documentsAgentFlow({
    documentId,
    companyId: resolvedCompanyId,
    fileBuffer,
    fileName,
    mimeType: mimeType ?? 'application/pdf',
  });

  res.json({ success: true, data: result });
}

// ── GET /api/agent/insights — list saved insights from Firestore ──────────────
export async function getInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = (req.query['companyId'] as string | undefined) ?? req.user?.companyId;
  const limit     = parseInt((req.query['limit'] as string | undefined) ?? '20', 10);
  const unreadOnly = req.query['unread'] === 'true';

  if (!companyId) throw new AppError('Company ID required', 400);

  const db = getFirestore();
  let query = db.collection('insights').where('companyId', '==', companyId);
  if (unreadOnly) query = query.where('read', '==', false) as typeof query;

  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await query.limit(limit).get();
  } catch {
    res.json({ success: true, data: [] });
    return;
  }

  const insights = snap.docs
    .sort((a, b) => {
      const aT = (a.data()['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      const bT = (b.data()['createdAt'] as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
      return bT - aT;
    })
    .map((doc) => {
    const d = doc.data();
    return {
      id:        doc.id,
      type:      d['type'],
      title:     d['title'],
      body:      d['body'],
      priority:  d['priority'],
      source:    d['source'],
      read:      d['read'] ?? false,
      createdAt: d['createdAt']?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  });

  res.json({ success: true, data: insights });
}

// ── PATCH /api/agent/insights/:id/read — mark insight as read ────────────────
export async function markInsightRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const db = getFirestore();
  await db.collection('insights').doc(id).update({ read: true });
  res.json({ success: true });
}

// ── POST /api/agent/news/briefing — trigger scheduled news briefing (cron) ───
// Called by Cloud Scheduler or cron every 4h: 07:00 | 09:00 | 12:00 | 15:00 | 18:00 | 21:00
// Secured by X-Cron-Secret header
export async function triggerNewsBriefing(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const language = (req.body as { language?: string }).language ?? 'fr';

  // Fire & forget — don't block the response
  setImmediate(() => {
    runScheduledNewsBriefing(companyId, language).catch((err) =>
      logger.error('[NewsAgent] Briefing trigger failed', { error: err })
    );
  });

  res.json({ success: true, message: 'News briefing scheduled', companyId });
}

// ── GET /api/agent/news — fetch news on demand ────────────────────────────────
export async function getNews(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);
  const { topics, language } = req.query as { topics?: string; language?: string };

  const topicList = topics ? topics.split(',').map((t) => t.trim()) : undefined;

  const result = await newsAgentFlow({
    request:   `Fetch the latest news briefing${topicList ? ` on: ${topicList.join(', ')}` : ''}.`,
    companyId,
    language:  language ?? 'fr',
  });

  res.json({ success: true, data: result });
}
