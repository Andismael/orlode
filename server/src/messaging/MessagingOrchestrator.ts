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
import { whatsappAdapter } from './adapters/whatsapp';
import { telegramAdapter, smsAdapter, messengerAdapter, emailAdapter, webAdapter, voiceAdapter } from './adapters/stubs';
import type { Channel, ChannelAdapter, NormalizedMessage } from './types';
import { logger } from '../utils/logger';

const adapters: Record<Channel, ChannelAdapter> = {
  whatsapp: whatsappAdapter,
  telegram: telegramAdapter,
  sms: smsAdapter,
  messenger: messengerAdapter,
  email: emailAdapter,
  web: webAdapter,
  voice: voiceAdapter,
};

export function getAdapter(channel: Channel): ChannelAdapter {
  return adapters[channel] ?? adapters.web;
}

export interface HandleOptions {
  /** Conversation history for the AI (provider-normalized) */
  history?: Array<{ role: 'user' | 'model'; content: string }>;
  /** Company that owns this conversation */
  companyId: string;
  /** Preferred UI language code */
  language?: string;
  /** Optional extra instructions prepended to the AI prompt (e.g. company persona) */
  customSystemPrompt?: string;
  /** When true, skip slower steps (memory, multi-agent decomposition, AI intent fallback) */
  fastReply?: boolean;
  /**
   * Brain to use:
   *  - 'clone' = public persona (default for external channels — customers talking to the company)
   *  - 'orchestrator' = internal employee brain (web /chat for logged-in staff)
   */
  brain?: 'clone' | 'orchestrator';
  /** Optional display name of the visitor (used by Clone for greeting / lead capture) */
  visitorName?: string;
}

export interface HandleResult {
  /** Ready-to-send messages, already post-processed and length-validated */
  messages: string[];
  /** Tools the AI invoked during processing (orchestrator path only) */
  toolsCalled: string[];
  /** Agents involved (orchestrator path only) */
  agentsUsed: string[];
  /** Clone-specific signals — escalation, lead, CTA buttons */
  cloneSignals?: {
    leadCaptured?: boolean;
    escalateToHuman?: boolean;
    escalateReason?: string;
    suggestedActions?: string[];
  };
}

/**
 * Main entrypoint: normalized message in → list of ready-to-send strings out.
 * The channel adapter handles formatting; the orchestrator handles intelligence.
 */
export async function handleMessage(
  msg: NormalizedMessage,
  opts: HandleOptions,
): Promise<HandleResult> {
  const adapter = getAdapter(msg.channel);
  const start = Date.now();

  // Default brain selection:
  //   - external channels (whatsapp/telegram/sms/messenger/email) → Clone (public persona)
  //   - web channel → Orchestrator (internal employee brain)
  const brain = opts.brain ?? (msg.channel === 'web' ? 'orchestrator' : 'clone');

  let rawReply = '';
  let toolsCalled: string[] = [];
  let agentsUsed: string[] = [];
  let cloneSignals: HandleResult['cloneSignals'] | undefined;

  if (brain === 'clone') {
    const { cloneChat } = await import('../services/cloneEngine');
    // Map our Channel to Clone's channel type (clone supports fewer explicitly)
    const cloneChannel = (['whatsapp', 'telegram', 'web'].includes(msg.channel) ? msg.channel : 'api') as 'web' | 'widget' | 'whatsapp' | 'telegram' | 'api';
    const sessionId = `${msg.channel}_${opts.companyId}_${msg.from.replace(/\D/g, '')}`;
    const result = await cloneChat({
      companyId:    opts.companyId,
      message:      msg.text,
      sessionId,
      channel:      cloneChannel,
      visitorName:  opts.visitorName ?? msg.from,
    });
    rawReply = result.reply;
    cloneSignals = {
      leadCaptured:     result.leadCaptured,
      escalateToHuman:  result.escalateToHuman,
      escalateReason:   result.escalateReason,
      suggestedActions: result.suggestedActions,
    };
  } else {
    const { runOrchestrator } = await import('../agents/orchestrator.agent');
    const customPrompt = opts.customSystemPrompt ? `[Instructions: ${opts.customSystemPrompt}]\n\n` : '';
    const result = await runOrchestrator({
      message:   customPrompt + msg.text,
      companyId: opts.companyId,
      userId:    `${msg.channel}:${msg.from}`,
      language:  opts.language ?? 'fr',
      history:   opts.history ?? [],
      channel:   msg.channel,
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
  logger.info('[MessagingOrchestrator] handled', {
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
