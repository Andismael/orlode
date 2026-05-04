/**
 * Stub adapters for channels not yet connected. They exist so the
 * MessagingOrchestrator and routing logic can be written once and extended
 * when each integration is wired up.
 */
import type { ChannelAdapter } from '../types';

export const telegramAdapter: ChannelAdapter = {
  channel: 'telegram',
  systemOverride() {
    return `
=== TELEGRAM CHANNEL OVERRIDE ===
- Keep replies concise (5 sentences max).
- Supports Markdown V2 — you can use *bold*, _italic_, [links](url).
- Inline buttons and long messages OK (up to 4096 chars).`.trim();
  },
  postprocess(output: string): string {
    // Telegram accepts more markdown. Just strip internal app links.
    return output.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, '$1').trim();
  },
  validate(output: string): string {
    return output.slice(0, 4096);
  },
};

export const smsAdapter: ChannelAdapter = {
  channel: 'sms',
  systemOverride() {
    return `
=== SMS CHANNEL OVERRIDE ===
- Hard limit: 160 characters total. Be ultra-concise.
- Plain text only, no markdown, no emojis, no URLs unless strictly needed.
- One sentence answer whenever possible.`.trim();
  },
  postprocess(output: string): string {
    return output
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // strip any markdown links
      .replace(/[*_`]/g, '')                     // strip markdown emphasis
      .replace(/\s+/g, ' ')                      // collapse whitespace
      .trim();
  },
  validate(output: string): string | string[] {
    // SMS is 160 chars per segment. Split into multi-part if longer.
    const MAX = 160;
    if (output.length <= MAX) return output;
    const parts: string[] = [];
    let i = 0;
    while (i < output.length) {
      parts.push(output.slice(i, i + MAX));
      i += MAX;
    }
    return parts;
  },
};

export const messengerAdapter: ChannelAdapter = {
  channel: 'messenger',
  systemOverride() {
    return `
=== MESSENGER CHANNEL OVERRIDE ===
- Keep it short (3-4 sentences).
- Plain text preferred. Facebook Messenger supports quick reply buttons separately.
- No markdown formatting — use plain text.`.trim();
  },
  postprocess(output: string): string {
    return output
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`#]/g, '')
      .trim();
  },
  validate(output: string): string {
    return output.slice(0, 2000);
  },
};

export const emailAdapter: ChannelAdapter = {
  channel: 'email',
  systemOverride() {
    return `
=== EMAIL CHANNEL OVERRIDE ===
- Long-form responses are OK.
- Start with a greeting, end with a signature (e.g. "Cordialement,").
- Markdown is fine (will be rendered to HTML).
- Don't use internal app links — external URLs only.`.trim();
  },
  postprocess(output: string): string {
    return output.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, '$1').trim();
  },
  validate(output: string): string {
    return output; // No length cap for email
  },
};

export const voiceAdapter: ChannelAdapter = {
  channel: 'voice',
  systemOverride() {
    return `
=== VOICE CHANNEL OVERRIDE ===
- Responses will be synthesized to speech. Short sentences, max 15 words each.
- No markdown, URLs, bullet lists, or special characters.
- Speak numbers and dates naturally (e.g. "le vingt avril" not "20/04").
- Never confirm sensitive actions vocally (RDV confirm, email send, signatures).
  Always say a human will validate and call back.`.trim();
  },
  postprocess(output: string): string {
    return output
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`#]/g, '')
      .replace(/https?:\/\/\S+/g, 'sur notre site web')
      .replace(/\s+/g, ' ')
      .trim();
  },
  validate(output: string): string {
    return output;
  },
};

export const webAdapter: ChannelAdapter = {
  channel: 'web',
  systemOverride() {
    return ''; // Default rich-response behavior, no override needed
  },
  postprocess(output: string): string {
    return output;
  },
  validate(output: string): string {
    return output;
  },
};
