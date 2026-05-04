"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentSendMessage = agentSendMessage;
exports.runInsights = runInsights;
exports.processDocument = processDocument;
exports.getInsights = getInsights;
exports.markInsightRead = markInsightRead;
exports.triggerNewsBriefing = triggerNewsBriefing;
exports.getNews = getNews;
const orchestrator_agent_1 = require("../agents/orchestrator.agent");
const firebase_config_1 = require("../config/firebase.config");
const firestore_1 = require("firebase-admin/firestore");
const news_agent_1 = require("../agents/news.agent");
const conversationManager_1 = require("../services/ai/conversationManager");
const insights_agent_1 = require("../agents/insights.agent");
const documents_agent_1 = require("../agents/documents.agent");
const error_middleware_1 = require("../middleware/error.middleware");
const logger_1 = require("../utils/logger");
// ── POST /api/agent/conversations/:id/messages (SSE streaming via orchestrator)
async function agentSendMessage(req, res) {
    const { id: conversationId } = req.params;
    const { content, language, agentId } = req.body;
    if (!content?.trim())
        throw new error_middleware_1.AppError('Message content is required', 400);
    if (!req.user?.uid)
        throw new error_middleware_1.AppError('User not authenticated', 401);
    // Detect agent ID from body or from [Agent: XYZ] prefix in content
    let targetAgent = agentId?.trim();
    if (!targetAgent) {
        const match = content.match(/^\[Agent:\s*([^\]]+)\]\s*/i);
        if (match)
            targetAgent = match[1].trim().toLowerCase();
    }
    const conversation = await (0, conversationManager_1.getConversation)(conversationId);
    if (!conversation)
        throw new error_middleware_1.AppError('Conversation not found', 404);
    const companyId = conversation.companyId;
    // Save user message
    await (0, conversationManager_1.saveMessage)(conversationId, {
        conversationId,
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
    });
    // Fetch conversation history (last 20 messages for context)
    const history = await (0, conversationManager_1.getConversationHistory)(conversationId);
    const chatHistory = history
        .slice(-21, -1) // exclude just-saved user msg, keep last 20
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));
    // ── Set up SSE ────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const pingInterval = setInterval(() => {
        if (!res.writableEnded)
            res.write(':ping\n\n');
    }, 15000);
    let fullReply = '';
    const startTime = Date.now();
    try {
        // Stream chunks to the client as they come
        const streamCb = (chunk) => {
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
            userId: req.user.uid,
            language: language ?? 'auto',
            history: chatHistory, // keep context across turns (Herve creation → "tu veux une photo ?")
        };
        // Only include agents with the standard `{ request, companyId, userId, language }` signature.
        // Meeting, insights, comms use different schemas and stay on the Orchestrator.
        // Args without history for agents that don't accept it (avoid zod strict errors)
        const baseArgs = { request: cleanContent, companyId, userId: req.user.uid, language: language ?? 'auto' };
        const DIRECT_AGENTS = {
            hr: async () => (await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')))).hrAgentTool(directArgs),
            rh: async () => (await Promise.resolve().then(() => __importStar(require('../agents/hr.agent')))).hrAgentTool(directArgs),
            accounting: async () => (await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')))).accountingAgentTool(directArgs),
            comptabilite: async () => (await Promise.resolve().then(() => __importStar(require('../agents/accounting.agent')))).accountingAgentTool(directArgs),
            sales: async () => (await Promise.resolve().then(() => __importStar(require('../agents/sales.agent')))).salesAgentTool(directArgs),
            ventes: async () => (await Promise.resolve().then(() => __importStar(require('../agents/sales.agent')))).salesAgentTool(directArgs),
            support: async () => (await Promise.resolve().then(() => __importStar(require('../agents/support.agent')))).supportAgentTool(directArgs),
            marketing: async () => (await Promise.resolve().then(() => __importStar(require('../agents/marketing.agent')))).marketingAgentTool(directArgs),
            legal: async () => (await Promise.resolve().then(() => __importStar(require('../agents/legal.agent')))).legalAgentTool(directArgs),
            juridique: async () => (await Promise.resolve().then(() => __importStar(require('../agents/legal.agent')))).legalAgentTool(directArgs),
            reception: async () => (await Promise.resolve().then(() => __importStar(require('../agents/reception.agent')))).receptionAgentTool(baseArgs),
            training: async () => (await Promise.resolve().then(() => __importStar(require('../agents/training.agent')))).trainingAgentTool(directArgs),
            formation: async () => (await Promise.resolve().then(() => __importStar(require('../agents/training.agent')))).trainingAgentTool(directArgs),
            knowledge: async () => (await Promise.resolve().then(() => __importStar(require('../agents/knowledge.agent')))).knowledgeAgentTool(baseArgs),
            comms: async () => (await Promise.resolve().then(() => __importStar(require('../agents/comms.agent')))).commsAgentChatTool(directArgs),
            communication: async () => (await Promise.resolve().then(() => __importStar(require('../agents/comms.agent')))).commsAgentChatTool(directArgs),
            meeting: async () => (await Promise.resolve().then(() => __importStar(require('../agents/meeting.agent')))).meetingAgentChatTool(directArgs),
            reunion: async () => (await Promise.resolve().then(() => __importStar(require('../agents/meeting.agent')))).meetingAgentChatTool(directArgs),
            // qa uses different input schema — stays on the orchestrator
            wildcard: async () => (await Promise.resolve().then(() => __importStar(require('../agents/wildcard.agent')))).wildcardAgentTool(baseArgs),
            news: async () => (await Promise.resolve().then(() => __importStar(require('../agents/news.agent')))).newsAgentTool(directArgs),
            veille: async () => (await Promise.resolve().then(() => __importStar(require('../agents/news.agent')))).newsAgentTool(directArgs),
            coach: async () => (await Promise.resolve().then(() => __importStar(require('../agents/coach.agent')))).coachAgentTool(directArgs),
            it: async () => (await Promise.resolve().then(() => __importStar(require('../agents/it.agent')))).itAgentTool(directArgs),
            datascientist: async () => (await Promise.resolve().then(() => __importStar(require('../agents/datascientist.agent')))).dataScientistAgentTool(baseArgs),
            cybersecurity: async () => (await Promise.resolve().then(() => __importStar(require('../agents/cybersecurity.agent')))).cybersecurityAgentTool(baseArgs),
            security: async () => (await Promise.resolve().then(() => __importStar(require('../agents/cybersecurity.agent')))).cybersecurityAgentTool(baseArgs),
        };
        let result;
        if (targetAgent && DIRECT_AGENTS[targetAgent]) {
            const direct = await DIRECT_AGENTS[targetAgent]();
            const directRes = direct;
            const reply = directRes?.reply ?? directRes?.response ?? JSON.stringify(direct);
            if (reply)
                streamCb(reply);
            result = { reply, agentsUsed: [targetAgent], toolsCalled: [] };
        }
        else {
            result = await (0, orchestrator_agent_1.runOrchestrator)({
                message: content.trim(),
                companyId,
                userId: req.user.uid,
                history: chatHistory,
                language: language ?? 'auto',
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
        await (0, conversationManager_1.saveMessage)(conversationId, {
            conversationId,
            role: 'assistant',
            content: fullReply || result.reply,
            createdAt: new Date(),
            metadata: { agentsUsed: result.agentsUsed, toolsCalled: result.toolsCalled },
        });
        // Track agent stats (fire-and-forget)
        const elapsedMs = Date.now() - startTime;
        const tokenEstimate = Math.round((fullReply || result.reply).length / 4);
        const db = (0, firebase_config_1.getFirestore)();
        const agentsToTrack = result.agentsUsed.length > 0 ? result.agentsUsed : ['orchestrator'];
        for (const agentName of agentsToTrack) {
            const docId = `${companyId}_${agentName}`;
            db.collection('agentStatus').doc(docId).set({
                companyId,
                agentId: agentName,
                enabled: true,
                callsToday: firestore_1.FieldValue.increment(1),
                tokensToday: firestore_1.FieldValue.increment(tokenEstimate),
                avgLatencyMs: elapsedMs,
                lastCallAt: new Date(),
                updatedAt: new Date(),
            }, { merge: true }).catch(() => { });
        }
    }
    catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        logger_1.logger.error('[AgentController] Orchestrator error', { message: errMsg, stack: errStack, error: err });
        if (!res.writableEnded) {
            const userMsg = process.env['NODE_ENV'] === 'production'
                ? 'Something went wrong, please try again'
                : errMsg;
            res.write(`data: ${JSON.stringify({ error: userMsg })}\n\n`);
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
// ── POST /api/agent/insights — trigger insights agent manually ────────────────
async function runInsights(req, res) {
    const { companyId, mode = 'full', maxInsights = 5 } = req.body;
    const resolvedCompanyId = companyId ?? req.user?.companyId;
    if (!resolvedCompanyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    logger_1.logger.info(`[AgentController] Running insights for company ${resolvedCompanyId}`);
    try {
        const result = await (0, insights_agent_1.insightsAgentFlow)({
            companyId: resolvedCompanyId,
            mode: mode,
            maxInsights,
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        // Genkit/AI keys not configured — return empty insights so UI doesn't crash
        logger_1.logger.warn('[AgentController] insightsAgentFlow failed', { error: err });
        res.json({ success: true, data: { insights: [] }, warning: 'AI service unavailable' });
    }
}
// ── POST /api/agent/process-document — trigger documents agent ────────────────
async function processDocument(req, res) {
    const { documentId, companyId, fileBuffer, fileName, mimeType } = req.body;
    const resolvedCompanyId = companyId ?? req.user?.companyId;
    if (!resolvedCompanyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    if (!documentId || !fileBuffer || !fileName)
        throw new error_middleware_1.AppError('documentId, fileBuffer, fileName required', 400);
    logger_1.logger.info(`[AgentController] Processing document ${documentId}`);
    const result = await (0, documents_agent_1.documentsAgentFlow)({
        documentId,
        companyId: resolvedCompanyId,
        fileBuffer,
        fileName,
        mimeType: mimeType ?? 'application/pdf',
    });
    res.json({ success: true, data: result });
}
// ── GET /api/agent/insights — list saved insights from Firestore ──────────────
async function getInsights(req, res) {
    const companyId = req.query['companyId'] ?? req.user?.companyId;
    const limit = parseInt(req.query['limit'] ?? '20', 10);
    const unreadOnly = req.query['unread'] === 'true';
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const db = (0, firebase_config_1.getFirestore)();
    let query = db.collection('insights').where('companyId', '==', companyId);
    if (unreadOnly)
        query = query.where('read', '==', false);
    let snap;
    try {
        snap = await query.limit(limit).get();
    }
    catch {
        res.json({ success: true, data: [] });
        return;
    }
    const insights = snap.docs
        .sort((a, b) => {
        const aT = a.data()['createdAt']?.toDate?.()?.getTime() ?? 0;
        const bT = b.data()['createdAt']?.toDate?.()?.getTime() ?? 0;
        return bT - aT;
    })
        .map((doc) => {
        const d = doc.data();
        return {
            id: doc.id,
            type: d['type'],
            title: d['title'],
            body: d['body'],
            priority: d['priority'],
            source: d['source'],
            read: d['read'] ?? false,
            createdAt: d['createdAt']?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        };
    });
    res.json({ success: true, data: insights });
}
// ── PATCH /api/agent/insights/:id/read — mark insight as read ────────────────
async function markInsightRead(req, res) {
    const { id } = req.params;
    const db = (0, firebase_config_1.getFirestore)();
    await db.collection('insights').doc(id).update({ read: true });
    res.json({ success: true });
}
// ── POST /api/agent/news/briefing — trigger scheduled news briefing (cron) ───
// Called by Cloud Scheduler or cron every 4h: 07:00 | 09:00 | 12:00 | 15:00 | 18:00 | 21:00
// Secured by X-Cron-Secret header
async function triggerNewsBriefing(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const language = req.body.language ?? 'fr';
    // Fire & forget — don't block the response
    setImmediate(() => {
        (0, news_agent_1.runScheduledNewsBriefing)(companyId, language).catch((err) => logger_1.logger.error('[NewsAgent] Briefing trigger failed', { error: err }));
    });
    res.json({ success: true, message: 'News briefing scheduled', companyId });
}
// ── GET /api/agent/news — fetch news on demand ────────────────────────────────
async function getNews(req, res) {
    const companyId = req.user?.companyId;
    if (!companyId)
        throw new error_middleware_1.AppError('Company ID required', 400);
    const { topics, language } = req.query;
    const topicList = topics ? topics.split(',').map((t) => t.trim()) : undefined;
    const result = await (0, news_agent_1.newsAgentFlow)({
        request: `Fetch the latest news briefing${topicList ? ` on: ${topicList.join(', ')}` : ''}.`,
        companyId,
        language: language ?? 'fr',
    });
    res.json({ success: true, data: result });
}
//# sourceMappingURL=agent.controller.js.map