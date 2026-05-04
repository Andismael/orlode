"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
exports.chatStream = chatStream;
/**
 * claudeService.ts — 100% Gemini 3 Pro
 * Garde la même interface publique (chat, chatStream, ClaudeMessage, ChatOptions, StreamChunk)
 * pour ne pas casser les imports existants.
 */
const genkit_config_1 = require("../../config/genkit.config");
const logger_1 = require("../../utils/logger");
/**
 * Non-streaming completion via Gemini 3 Pro.
 */
async function chat(options) {
    const { text } = await genkit_config_1.ai.generate({
        model: genkit_config_1.GEMINI_PRO,
        system: options.systemPrompt,
        messages: options.messages.map((m) => ({
            role: (m.role === 'assistant' ? 'model' : m.role),
            content: [{ text: m.content }],
        })),
        config: {
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: options.maxTokens ?? 2000,
        },
    });
    return text;
}
/**
 * Streaming completion via Gemini 3 Pro — yields chunks via async generator.
 */
async function* chatStream(options) {
    try {
        const { stream } = await genkit_config_1.ai.generateStream({
            model: genkit_config_1.GEMINI_PRO,
            system: options.systemPrompt,
            messages: options.messages.map((m) => ({
                role: (m.role === 'assistant' ? 'model' : m.role),
                content: [{ text: m.content }],
            })),
            config: {
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.maxTokens ?? 2000,
            },
        });
        for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
                yield { type: 'text', content: text };
            }
        }
        yield { type: 'done' };
    }
    catch (error) {
        logger_1.logger.error('[Gemini] Stream error', { error });
        yield {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown stream error',
        };
    }
}
//# sourceMappingURL=claudeService.js.map