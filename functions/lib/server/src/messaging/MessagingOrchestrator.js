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
exports.getAdapter = getAdapter;
exports.handleMessage = handleMessage;
/**
 * MessagingOrchestrator — routes a normalized inbound message through the
 * common AI brain (orchestrator.agent.ts) and applies the channel-specific
 * adapter for formatting/length constraints.
 *
 * Caller responsibility:
 *   - Decode incoming webhook payload → NormalizedMessage
 *   - Pass to `handle()`
 *   - Send the returned string(s) via the channel's transport
 */
const whatsapp_1 = require("./adapters/whatsapp");
const stubs_1 = require("./adapters/stubs");
const logger_1 = require("../utils/logger");
const adapters = {
    whatsapp: whatsapp_1.whatsappAdapter,
    telegram: stubs_1.telegramAdapter,
    sms: stubs_1.smsAdapter,
    messenger: stubs_1.messengerAdapter,
    email: stubs_1.emailAdapter,
    web: stubs_1.webAdapter,
    voice: stubs_1.voiceAdapter,
};
function getAdapter(channel) {
    return adapters[channel] ?? adapters.web;
}
/**
 * Main entrypoint: normalized message in → list of ready-to-send strings out.
 * The channel adapter handles formatting; the orchestrator handles intelligence.
 */
async function handleMessage(msg, opts) {
    const adapter = getAdapter(msg.channel);
    const start = Date.now();
    // Default brain selection:
    //   - external channels (whatsapp/telegram/sms/messenger/email) → Clone (public persona)
    //   - web channel → Orchestrator (internal employee brain)
    const brain = opts.brain ?? (msg.channel === 'web' ? 'orchestrator' : 'clone');
    let rawReply = '';
    let toolsCalled = [];
    let agentsUsed = [];
    let cloneSignals;
    if (brain === 'clone') {
        const { cloneChat } = await Promise.resolve().then(() => __importStar(require('../services/cloneEngine')));
        // Map our Channel to Clone's channel type (clone supports fewer explicitly)
        const cloneChannel = (['whatsapp', 'telegram', 'web'].includes(msg.channel) ? msg.channel : 'api');
        const sessionId = `${msg.channel}_${opts.companyId}_${msg.from.replace(/\D/g, '')}`;
        const result = await cloneChat({
            companyId: opts.companyId,
            message: msg.text,
            sessionId,
            channel: cloneChannel,
            visitorName: opts.visitorName ?? msg.from,
        });
        rawReply = result.reply;
        cloneSignals = {
            leadCaptured: result.leadCaptured,
            escalateToHuman: result.escalateToHuman,
            escalateReason: result.escalateReason,
            suggestedActions: result.suggestedActions,
        };
    }
    else {
        const { runOrchestrator } = await Promise.resolve().then(() => __importStar(require('../agents/orchestrator.agent')));
        const customPrompt = opts.customSystemPrompt ? `[Instructions: ${opts.customSystemPrompt}]\n\n` : '';
        const result = await runOrchestrator({
            message: customPrompt + msg.text,
            companyId: opts.companyId,
            userId: `${msg.channel}:${msg.from}`,
            language: opts.language ?? 'fr',
            history: opts.history ?? [],
            channel: msg.channel,
            fastReply: opts.fastReply ?? (msg.channel !== 'web'),
        });
        rawReply = result.reply ?? '';
        toolsCalled = result.toolsCalled ?? [];
        agentsUsed = result.agentsUsed ?? [];
    }
    // Apply channel-specific formatting
    const cleaned = adapter.postprocess(rawReply);
    const validated = adapter.validate(cleaned);
    const messages = Array.isArray(validated) ? validated : [validated];
    const elapsed = Date.now() - start;
    logger_1.logger.info('[MessagingOrchestrator] handled', {
        brain,
        channel: msg.channel,
        from: msg.from,
        parts: messages.length,
        totalChars: messages.reduce((a, m) => a + m.length, 0),
        elapsedMs: elapsed,
        fastReply: !!opts.fastReply,
        escalate: cloneSignals?.escalateToHuman,
    });
    return { messages, toolsCalled, agentsUsed, cloneSignals };
}
//# sourceMappingURL=MessagingOrchestrator.js.map