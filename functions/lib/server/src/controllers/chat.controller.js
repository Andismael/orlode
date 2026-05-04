"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversations = getConversations;
exports.postCreateConversation = postCreateConversation;
exports.getMessages = getMessages;
exports.deleteConversationHandler = deleteConversationHandler;
exports.submitFeedback = submitFeedback;
exports.sendMessage = sendMessage;
const conversationManager_1 = require("../services/ai/conversationManager");
const retrievalService_1 = require("../services/rag/retrievalService");
const ragRetrievalFlow_1 = require("../genkit/flows/ragRetrievalFlow");
const aiRouter_1 = require("../services/ai/aiRouter");
const claudeService_1 = require("../services/ai/claudeService");
const promptTemplates_1 = require("../services/ai/promptTemplates");
const firebase_config_1 = require("../config/firebase.config");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
// GET /api/chat/conversations
async function getConversations(req, res) {
    const companyId = req.query['companyId'] ?? req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const conversations = await (0, conversationManager_1.listConversations)(companyId, req.user?.uid);
    res.json({ success: true, data: conversations });
}
// POST /api/chat/conversations
async function postCreateConversation(req, res) {
    const { companyId, title = 'New conversation' } = req.body;
    const resolvedCompanyId = companyId ?? req.user?.companyId;
    if (!resolvedCompanyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (!req.user?.uid)
        throw new error_middleware_1.AppError('User not authenticated', 401);
    const conversation = await (0, conversationManager_1.createConversation)(resolvedCompanyId, req.user.uid, title);
    res.status(201).json({ success: true, data: conversation });
}
// GET /api/chat/conversations/:id/messages
async function getMessages(req, res) {
    const { id } = req.params;
    const messages = await (0, conversationManager_1.getConversationHistory)(id);
    res.json({ success: true, data: messages });
}
// DELETE /api/chat/conversations/:id
async function deleteConversationHandler(req, res) {
    const { id } = req.params;
    await (0, conversationManager_1.deleteConversation)(id);
    res.json({ success: true, message: 'Conversation deleted' });
}
// PATCH /api/chat/conversations/:id/messages/:messageId/feedback
async function submitFeedback(req, res) {
    const { id: conversationId, messageId } = req.params;
    const { rating, comment } = req.body;
    if (!req.user?.uid)
        throw new error_middleware_1.AppError('User not authenticated', 401);
    if (rating !== 'up' && rating !== 'down')
        throw new error_middleware_1.AppError('rating must be "up" or "down"', 400);
    const db = (0, firebase_config_1.getFirestore)();
    const msgRef = db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(messageId);
    const msgDoc = await msgRef.get();
    if (!msgDoc.exists)
        throw new error_middleware_1.AppError('Message not found', 404);
    if (msgDoc.data()?.['role'] !== 'assistant')
        throw new error_middleware_1.AppError('Feedback only applies to assistant messages', 400);
    await msgRef.update({
        feedback: {
            rating,
            comment: comment?.trim() ?? null,
            submittedAt: new Date(),
            userId: req.user.uid,
        },
    });
    // Aggregate feedback in company stats (non-blocking)
    const conversation = await (0, conversationManager_1.getConversation)(conversationId);
    if (conversation?.companyId) {
        setImmediate(async () => {
            const statsRef = db.collection('companies').doc(conversation.companyId).collection('usageMetrics').doc('feedback');
            const field = rating === 'up' ? 'thumbsUp' : 'thumbsDown';
            try {
                await statsRef.set({ [field]: 1, updatedAt: new Date() }, { merge: true });
                const snap = await statsRef.get();
                const up = snap.data()?.['thumbsUp'] ?? 0;
                const down = snap.data()?.['thumbsDown'] ?? 0;
                const total = up + down;
                if (total > 0) {
                    await statsRef.update({ satisfactionRate: Math.round((up / total) * 100) });
                }
            }
            catch { /* non-critical */ }
        });
    }
    logger_1.logger.info(`[feedback] ${rating} on message ${messageId} by user ${req.user.uid}`);
    res.json({ success: true });
}
// POST /api/chat/conversations/:id/messages (SSE streaming)
async function sendMessage(req, res) {
    const { id: conversationId } = req.params;
    const { content } = req.body;
    if (!content?.trim())
        throw new error_middleware_1.AppError('Message content is required', 400);
    if (!req.user?.uid)
        throw new error_middleware_1.AppError('User not authenticated', 401);
    // Verify conversation exists
    const conversation = await (0, conversationManager_1.getConversation)(conversationId);
    if (!conversation)
        throw new error_middleware_1.AppError('Conversation not found', 404);
    const companyId = conversation.companyId;
    // Get company info for system prompt
    const db = (0, firebase_config_1.getFirestore)();
    const companyDoc = await db.collection('companies').doc(companyId).get();
    const company = companyDoc.data();
    const companyName = company?.['name'] ?? 'Your Company';
    const settings = company?.['settings'] ?? {};
    const aiPersonality = settings['aiPersonality'] ?? 'professional';
    const systemContext = settings['systemContext'] ?? '';
    const maxTokens = settings['maxTokens'] ?? 2000;
    const temperature = settings['temperature'] ?? 0.3;
    // Save user message
    await (0, conversationManager_1.saveMessage)(conversationId, {
        conversationId,
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
    });
    // Get conversation history
    const history = await (0, conversationManager_1.getConversationHistory)(conversationId);
    const formattedHistory = (0, conversationManager_1.formatHistoryForClaude)(history.slice(0, -1)); // exclude just-saved user msg
    // ── RAG Retrieval via Genkit ragRetrievalFlow ──────────────────────────────
    let chunks = [];
    // Determine task type for AI routing (default to 'qa' for chat)
    const task = aiRouter_1.aiRouter.route('qa');
    try {
        const ragResult = await (0, ragRetrievalFlow_1.ragRetrievalFlow)({
            companyId,
            query: content,
            topK: 6,
        });
        chunks = ragResult.chunks;
        logger_1.logger.debug(`[chat.controller] RAG returned ${chunks.length} chunks via Genkit flow`);
    }
    catch (err) {
        logger_1.logger.warn('[chat.controller] Genkit ragRetrievalFlow failed, continuing without context', {
            error: err.message,
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
    const context = (0, retrievalService_1.buildContext)(ragChunksForContext);
    const historyText = formattedHistory
        .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Orlode'}: ${m.content}`)
        .join('\n');
    // Build system prompt (Claude is always used for Q&A streaming)
    const systemPrompt = (0, promptTemplates_1.QA_SYSTEM_PROMPT)(companyName, context, historyText, aiPersonality, systemContext);
    logger_1.logger.debug(`[chat.controller] AI routing: task=qa → backend=${task}`);
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
            { role: 'user', content: content.trim() },
        ];
        // Gemini 3 Pro — streaming Q&A avec contexte RAG
        const stream = (0, claudeService_1.chatStream)({ systemPrompt, messages, maxTokens, temperature });
        for await (const chunk of stream) {
            if (res.writableEnded)
                break;
            if (chunk.type === 'text' && chunk.content) {
                fullContent += chunk.content;
                res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
            }
            else if (chunk.type === 'error') {
                res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
                break;
            }
        }
        // Send sources
        const sources = chunks.map((c) => ({
            documentId: c.documentId,
            documentName: c.documentName,
            excerpt: c.content.slice(0, 200),
            score: c.relevanceScore,
        }));
        if (sources.length > 0) {
            res.write(`data: ${JSON.stringify({ sources })}\n\n`);
        }
        // Save assistant message
        await (0, conversationManager_1.saveMessage)(conversationId, {
            conversationId,
            role: 'assistant',
            content: fullContent,
            sources,
            createdAt: new Date(),
        });
    }
    catch (err) {
        logger_1.logger.error('[chat.controller] Chat streaming error', { error: err });
        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
        }
    }
    finally {
        clearInterval(pingInterval);
        if (!res.writableEnded) {
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }
}
//# sourceMappingURL=chat.controller.js.map