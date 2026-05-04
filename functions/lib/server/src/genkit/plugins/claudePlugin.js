"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAUDE_MODEL_ID = void 0;
exports.claudeGenerate = claudeGenerate;
exports.claudeGenerateStream = claudeGenerateStream;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const env_config_1 = require("../../config/env.config");
const logger_1 = require("../../utils/logger");
// ── Claude model wrapper ──────────────────────────────────────────────────────
//
// Genkit's genkitPlugin / defineModel API varies significantly between minor
// versions. Rather than risk a runtime type mismatch, we expose Claude as a
// plain async function that can be called from within any Genkit flow or
// service. It is registered here as a named "plugin" for organisational clarity.
exports.CLAUDE_MODEL_ID = `claude/${env_config_1.env.CLAUDE_MODEL}`;
/**
 * Generate text using the Anthropic Claude API.
 * Drop-in equivalent of ai.generate() for Claude-specific tasks.
 */
async function claudeGenerate(options) {
    const client = new sdk_1.default({ apiKey: env_config_1.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
        model: env_config_1.env.CLAUDE_MODEL,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.2,
        system: options.systemPrompt ?? 'You are a helpful AI assistant.',
        messages: [{ role: 'user', content: options.prompt }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) {
        throw new Error('[claudePlugin] No text block in Claude response');
    }
    logger_1.logger.debug('[claudePlugin] Claude generate complete', {
        model: env_config_1.env.CLAUDE_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
    });
    return {
        text: textBlock.text,
        usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
        },
    };
}
/**
 * Streaming variant — yields text chunks.
 */
async function* claudeGenerateStream(options) {
    const client = new sdk_1.default({ apiKey: env_config_1.env.ANTHROPIC_API_KEY });
    const stream = client.messages.stream({
        model: env_config_1.env.CLAUDE_MODEL,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.2,
        system: options.systemPrompt ?? 'You are a helpful AI assistant.',
        messages: [{ role: 'user', content: options.prompt }],
    });
    for await (const event of stream) {
        if (event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta') {
            yield event.delta.text;
        }
    }
}
//# sourceMappingURL=claudePlugin.js.map