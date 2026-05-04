import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  createConversation,
  getConversation,
  getConversationHistory,
  saveMessage,
  formatHistoryForClaude,
  listConversations,
  deleteConversation,
} from '../services/ai/conversationManager';
import { buildContext } from '../services/rag/retrievalService';
import { ragRetrievalFlow } from '../genkit/flows/ragRetrievalFlow';
import { aiRouter } from '../services/ai/aiRouter';
import { chatStream } from '../services/ai/claudeService';
import { QA_SYSTEM_PROMPT } from '../services/ai/promptTemplates';
import { getFirestore } from '../config/firebase.config';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import type { MessageSource } from '../models/Conversation';
import type { RetrievedChunk } from '../genkit/flows/ragRetrievalFlow';

// GET /api/chat/conversations
export async function getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
  const companyId = (req.query['companyId'] as string | undefined) ?? req.user?.companyId;
  if (!companyId) throw new AppError('Company ID required', 400);

  const conversations = await listConversations(companyId, req.user?.uid);
  res.json({ success: true, data: conversations });
}

// POST /api/chat/conversations
export async function postCreateConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { companyId, title = 'New conversation' } = req.body as { companyId?: string; title?: string };
  const resolvedCompanyId = companyId ?? req.user?.companyId;
  if (!resolvedCompanyId) throw new AppError('Company ID required', 400);
  if (!req.user?.uid) throw new AppError('User not authenticated', 401);

  const conversation = await createConversation(resolvedCompanyId, req.user.uid, title);
  res.status(201).json({ success: true, data: conversation });
}

// GET /api/chat/conversations/:id/messages
export async function getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const messages = await getConversationHistory(id);
  res.json({ success: true, data: messages });
}

// DELETE /api/chat/conversations/:id
export async function deleteConversationHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  await deleteConversation(id);
  res.json({ success: true, message: 'Conversation deleted' });
}

// PATCH /api/chat/conversations/:id/messages/:messageId/feedback
export async function submitFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id: conversationId, messageId } = req.params as { id: string; messageId: string };
  const { rating, comment } = req.body as { rating?: string; comment?: string };

  if (!req.user?.uid) throw new AppError('User not authenticated', 401);
  if (rating !== 'up' && rating !== 'down') throw new AppError('rating must be "up" or "down"', 400);

  const db = getFirestore();
  const msgRef = db
    .collection('conversations')
    .doc(conversationId)
    .collection('messages')
    .doc(messageId);

  const msgDoc = await msgRef.get();
  if (!msgDoc.exists) throw new AppError('Message not found', 404);
  if (msgDoc.data()?.['role'] !== 'assistant') throw new AppError('Feedback only applies to assistant messages', 400);

  await msgRef.update({
    feedback: {
      rating,
      comment: comment?.trim() ?? null,
      submittedAt: new Date(),
      userId: req.user.uid,
    },
  });

  // Aggregate feedback in company stats (non-blocking)
  const conversation = await getConversation(conversationId);
  if (conversation?.companyId) {
    setImmediate(async () => {
      const statsRef = db.collection('companies').doc(conversation.companyId).collection('usageMetrics').doc('feedback');
      const field = rating === 'up' ? 'thumbsUp' : 'thumbsDown';
      try {
        await statsRef.set({ [field]: 1, updatedAt: new Date() }, { merge: true });
        const snap = await statsRef.get();
        const up = (snap.data()?.['thumbsUp'] as number) ?? 0;
        const down = (snap.data()?.['thumbsDown'] as number) ?? 0;
        const total = up + down;
        if (total > 0) {
          await statsRef.update({ satisfactionRate: Math.round((up / total) * 100) });
        }
      } catch { /* non-critical */ }
    });
  }

  logger.info(`[feedback] ${rating} on message ${messageId} by user ${req.user.uid}`);
  res.json({ success: true });
}

// POST /api/chat/conversations/:id/messages (SSE streaming)
export async function sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id: conversationId } = req.params as { id: string };
  const { content } = req.body as { content: string };

  if (!content?.trim()) throw new AppError('Message content is required', 400);
  if (!req.user?.uid) throw new AppError('User not authenticated', 401);

  // Verify conversation exists
  const conversation = await getConversation(conversationId);
  if (!conversation) throw new AppError('Conversation not found', 404);

  const companyId = conversation.companyId;

  // Get company info for system prompt
  const db = getFirestore();
  const companyDoc = await db.collection('companies').doc(companyId).get();
  const company = companyDoc.data();
  const companyName = (company?.['name'] as string | undefined) ?? 'Your Company';
  const settings = (company?.['settings'] as Record<string, unknown> | undefined) ?? {};
  const aiPersonality = (settings['aiPersonality'] as string | undefined) ?? 'professional';
  const systemContext = (settings['systemContext'] as string | undefined) ?? '';
  const maxTokens = (settings['maxTokens'] as number | undefined) ?? 2000;
  const temperature = (settings['temperature'] as number | undefined) ?? 0.3;

  // Save user message
  await saveMessage(conversationId, {
    conversationId,
    role: 'user',
    content: content.trim(),
    createdAt: new Date(),
  });

  // Get conversation history
  const history = await getConversationHistory(conversationId);
  const formattedHistory = formatHistoryForClaude(history.slice(0, -1)); // exclude just-saved user msg

  // ── RAG Retrieval via Genkit ragRetrievalFlow ──────────────────────────────
  let chunks: RetrievedChunk[] = [];

  // Determine task type for AI routing (default to 'qa' for chat)
  const task = aiRouter.route('qa');

  try {
    const ragResult = await ragRetrievalFlow({
      companyId,
      query: content,
      topK: 6,
    });
    chunks = ragResult.chunks;
    logger.debug(`[chat.controller] RAG returned ${chunks.length} chunks via Genkit flow`);
  } catch (err) {
    logger.warn('[chat.controller] Genkit ragRetrievalFlow failed, continuing without context', {
      error: (err as Error).message,
    });
  }

  // Build context string from RAG chunks
  const ragChunksForContext = chunks.map((c) => ({
    id: c.documentId,
    text: c.content,
    documentId: c.documentId,
    documentName: c.documentName,
    chunkIndex: 0,
    score: c.relevanceScore,
    metadata: c.metadata,
  }));
  const context = buildContext(ragChunksForContext);

  const historyText = formattedHistory
    .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Orlode'}: ${m.content}`)
    .join('\n');

  // Build system prompt (Claude is always used for Q&A streaming)
  const systemPrompt = QA_SYSTEM_PROMPT(companyName, context, historyText, aiPersonality, systemContext);

  logger.debug(`[chat.controller] AI routing: task=qa → backend=${task}`);

  // ── Set up SSE ────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Keep-alive ping
  const pingInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(':ping\n\n');
    }
  }, 15000);

  let fullContent = '';

  try {
    const messages = [
      ...formattedHistory,
      { role: 'user' as const, content: content.trim() },
    ];

    // Gemini 3 Pro — streaming Q&A avec contexte RAG
    const stream = chatStream({ systemPrompt, messages, maxTokens, temperature });

    for await (const chunk of stream) {
      if (res.writableEnded) break;

      if (chunk.type === 'text' && chunk.content) {
        fullContent += chunk.content;
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      } else if (chunk.type === 'error') {
        res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
        break;
      }
    }

    // Send sources
    const sources: MessageSource[] = chunks.map((c) => ({
      documentId: c.documentId,
      documentName: c.documentName,
      excerpt: c.content.slice(0, 200),
      score: c.relevanceScore,
    }));

    if (sources.length > 0) {
      res.write(`data: ${JSON.stringify({ sources })}\n\n`);
    }

    // Save assistant message
    await saveMessage(conversationId, {
      conversationId,
      role: 'assistant',
      content: fullContent,
      sources,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.error('[chat.controller] Chat streaming error', { error: err });
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
    }
  } finally {
    clearInterval(pingInterval);
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}
