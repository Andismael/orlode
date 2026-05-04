import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.config';
import { logger } from '../../utils/logger';

// ── Types for the Claude Genkit-compatible model wrapper ─────────────────────

export interface ClaudeGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ClaudeGenerateResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ── Claude model wrapper ──────────────────────────────────────────────────────
//
// Genkit's genkitPlugin / defineModel API varies significantly between minor
// versions. Rather than risk a runtime type mismatch, we expose Claude as a
// plain async function that can be called from within any Genkit flow or
// service. It is registered here as a named "plugin" for organisational clarity.

export const CLAUDE_MODEL_ID = `claude/${env.CLAUDE_MODEL}`;

/**
 * Generate text using the Anthropic Claude API.
 * Drop-in equivalent of ai.generate() for Claude-specific tasks.
 */
export async function claudeGenerate(options: ClaudeGenerateOptions): Promise<ClaudeGenerateResult> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: env.CLAUDE_MODEL,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.2,
    system: options.systemPrompt ?? 'You are a helpful AI assistant.',
    messages: [{ role: 'user', content: options.prompt }],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text'
  );

  if (!textBlock) {
    throw new Error('[claudePlugin] No text block in Claude response');
  }

  logger.debug('[claudePlugin] Claude generate complete', {
    model: env.CLAUDE_MODEL,
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
export async function* claudeGenerateStream(
  options: ClaudeGenerateOptions
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: env.CLAUDE_MODEL,
    max_tokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.2,
    system: options.systemPrompt ?? 'You are a helpful AI assistant.',
    messages: [{ role: 'user', content: options.prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
