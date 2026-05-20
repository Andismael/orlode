"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.koraReply = koraReply;
/**
 * Kora chat service — single call site for web chat, WhatsApp webhook, and
 * the proactive check-in worker. Keeps the LLM invocation in one place.
 */
const genkit_config_1 = require("../../config/genkit.config");
const kora_agent_1 = require("../../agents/kora.agent");
const koraSystemPrompt_1 = require("./koraSystemPrompt");
const koraMemoryService_1 = require("./koraMemoryService");
const helpers_1 = require("../../utils/helpers");
/**
 * Run one chat turn for Kora. The caller passes the user message; we attach
 * profile + recent messages + tools, persist both sides of the exchange, and
 * return the assistant reply.
 */
async function koraReply(params) {
    const { uid, companyId, userMessage } = params;
    const profile = await (0, koraMemoryService_1.getOrCreateProfile)({ uid, companyId, defaults: params.defaultProfile });
    const sessionId = params.sessionId || (0, helpers_1.generateId)();
    // Persist the inbound message first so it always lands even if the LLM call fails.
    await (0, koraMemoryService_1.appendMessage)({
        uid, companyId, sessionId,
        role: 'user',
        content: userMessage,
        audioUrl: params.audioInputUrl ?? null,
    });
    const history = await (0, koraMemoryService_1.getRecentMessages)(uid, companyId, sessionId, 12);
    const systemPrompt = await (0, koraSystemPrompt_1.buildKoraSystemPrompt)({ profile });
    // Genkit ai.generate accepts a single prompt string. We compose system + history + user.
    const formattedHistory = history
        .slice(0, -1) // drop the message we just appended; we'll add it explicitly below
        .map(m => `${m.role === 'user' ? profile.firstName || 'User' : 'Kora'}: ${m.content}`)
        .join('\n');
    const compositePrompt = [
        systemPrompt,
        '',
        formattedHistory ? `HISTORIQUE RÉCENT:\n${formattedHistory}` : '',
        '',
        `${profile.firstName || 'User'}: ${userMessage}`,
        'Kora:',
    ].filter(Boolean).join('\n');
    // Pass companyId + uid through tool input via prompt — Gemini fills them via the schema.
    const toolHint = `(Quand tu appelles un outil, utilise uid="${uid}" et companyId="${companyId}".)`;
    const result = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_FLASH,
        prompt: `${compositePrompt}\n\n${toolHint}`,
        tools: kora_agent_1.KORA_TOOLS,
        config: { temperature: 0.7, maxOutputTokens: 400 },
    });
    const text = (result.text ?? '').trim() || '…';
    const toolsUsed = [];
    try {
        // Genkit Result exposes the chosen tool calls under different keys across versions.
        const anyResult = result;
        const requests = anyResult?.toolRequests ?? anyResult?.toolRequest ? [anyResult.toolRequest] : [];
        for (const r of requests)
            if (r?.name)
                toolsUsed.push(r.name);
    }
    catch { /* best-effort */ }
    await (0, koraMemoryService_1.appendMessage)({
        uid, companyId, sessionId,
        role: 'assistant',
        content: text,
    });
    return { text, sessionId, toolsUsed };
}
//# sourceMappingURL=koraChatService.js.map