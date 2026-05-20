/**
 * Kora chat service — single call site for web chat, WhatsApp webhook, and
 * the proactive check-in worker. Keeps the LLM invocation in one place.
 */
import { ai, GEMINI_FLASH } from '../../config/genkit.config';
import { KORA_TOOLS } from '../../agents/kora.agent';
import { buildKoraSystemPrompt } from './koraSystemPrompt';
import {
  KoraProfile,
  appendMessage,
  getOrCreateProfile,
  getRecentMessages,
} from './koraMemoryService';
import { generateId } from '../../utils/helpers';

export interface KoraReplyResult {
  text: string;
  sessionId: string;
  toolsUsed: string[];
}

/**
 * Run one chat turn for Kora. The caller passes the user message; we attach
 * profile + recent messages + tools, persist both sides of the exchange, and
 * return the assistant reply.
 */
export async function koraReply(params: {
  uid: string;
  companyId: string;
  userMessage: string;
  sessionId?: string;
  audioInputUrl?: string | null;
  defaultProfile?: Partial<KoraProfile>;
}): Promise<KoraReplyResult> {
  const { uid, companyId, userMessage } = params;
  const profile = await getOrCreateProfile({ uid, companyId, defaults: params.defaultProfile });
  const sessionId = params.sessionId || generateId();

  // Persist the inbound message first so it always lands even if the LLM call fails.
  await appendMessage({
    uid, companyId, sessionId,
    role: 'user',
    content: userMessage,
    audioUrl: params.audioInputUrl ?? null,
  });

  const history = await getRecentMessages(uid, companyId, sessionId, 12);
  const systemPrompt = await buildKoraSystemPrompt({ profile });

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

  const result = await ai.generate({
    model: GEMINI_FLASH,
    prompt: `${compositePrompt}\n\n${toolHint}`,
    tools: KORA_TOOLS,
    config: { temperature: 0.7, maxOutputTokens: 400 },
  });

  const text = (result.text ?? '').trim() || '…';
  const toolsUsed: string[] = [];
  try {
    // Genkit Result exposes the chosen tool calls under different keys across versions.
    const anyResult = result as any;
    const requests = anyResult?.toolRequests ?? anyResult?.toolRequest ? [anyResult.toolRequest] : [];
    for (const r of requests) if (r?.name) toolsUsed.push(r.name);
  } catch { /* best-effort */ }

  await appendMessage({
    uid, companyId, sessionId,
    role: 'assistant',
    content: text,
  });

  return { text, sessionId, toolsUsed };
}
