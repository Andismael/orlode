/**
 * Messaging layer — shared types for channel-aware conversations.
 * Each channel (WhatsApp, Telegram, SMS, Messenger, Email) has its own adapter
 * that pre/post-processes the message around the common AI brain.
 */

export type Channel = 'whatsapp' | 'telegram' | 'sms' | 'messenger' | 'email' | 'web' | 'voice';

export interface NormalizedMessage {
  /** Canonical text content (already transcribed if inbound was audio) */
  text: string;
  /** Sender identifier (phone number, telegram user_id, email, etc.) */
  from: string;
  /** Channel the message came from */
  channel: Channel;
  /** Whether the original inbound was audio/voice — tells us to reply vocally */
  wasVoice?: boolean;
  /** Raw provider metadata (phone_number_id, chat_id, etc.) */
  providerMeta?: Record<string, unknown>;
  /** Subject line for email inbound */
  subject?: string;
}

export interface ChannelAdapter {
  /** Which channel this adapter handles */
  readonly channel: Channel;
  /**
   * Append to the orchestrator system prompt to constrain the AI to this
   * channel's UX (length, formatting, link rules).
   */
  systemOverride(): string;
  /**
   * Clean up the AI's raw output before sending to the user. Strip unsupported
   * markdown, rewrite links, etc. Runs after the LLM, before the network send.
   */
  postprocess(output: string): string;
  /**
   * Enforce hard limits (char cap, message split). Returns the final string(s)
   * that will actually leave the server. Never called in the AI path — this is
   * the last guardrail.
   */
  validate(output: string): string | string[];
}
