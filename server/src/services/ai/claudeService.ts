/**
 * claudeService.ts — 100% Gemini 3 Pro
 * Garde la même interface publique (chat, chatStream, ClaudeMessage, ChatOptions, StreamChunk)
 * pour ne pas casser les imports existants.
 */
import { ai, GEMINI_PRO } from '../../config/genkit.config';
import { logger } from '../../utils/logger';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  content?: string;
  error?: string;
}

/**
 * Non-streaming completion via Gemini 3 Pro.
 */
export async function chat(options: ChatOptions): Promise<string> {
  const { text } = await ai.generate({
    model: GEMINI_PRO,
    system: options.systemPrompt,
    messages: options.messages.map((m) => ({
      role: (m.role === 'assistant' ? 'model' : m.role) as 'user' | 'model',
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
export async function* chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
  try {
    const { stream } = await ai.generateStream({
      model: GEMINI_PRO,
      system: options.systemPrompt,
      messages: options.messages.map((m) => ({
        role: (m.role === 'assistant' ? 'model' : m.role) as 'user' | 'model',
        content: [{ text: m.content }],
      })),
      config: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxTokens ?? 2000,
      },
    });

    for await (const chunk of stream) {
      const text = (chunk as unknown as { text: string }).text;
      if (text) {
        yield { type: 'text', content: text };
      }
    }

    yield { type: 'done' };
  } catch (error) {
    logger.error('[Gemini] Stream error', { error });
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown stream error',
    };
  }
}
