import type { ChannelAdapter } from '../types';

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',

  systemOverride() {
    return `
=== WHATSAPP CHANNEL OVERRIDE ===
The response is sent as a WhatsApp message. Apply these rules strictly:
- Keep it VERY SHORT (2-4 sentences, ideally under 300 characters).
- NO internal markdown links like [Label](/path) — the user cannot open them from WhatsApp.
- NO long bullet lists (max 3 items if absolutely needed).
- Use WhatsApp formatting only: *bold* (single stars), _italic_ (underscores), \`code\`.
- If the user must use the web app, just say "Ouvrez votre espace Orlode" without pasting links.
- Answer directly, no preamble, no apologies.`.trim();
  },

  postprocess(output: string): string {
    if (!output) return '';
    let s = output;

    // Strip internal app links: [Label](/path) → "Label"
    s = s.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, '$1');

    // Convert external markdown links [Label](https://...) → "Label: https://..."
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1: $2');

    // Collapse excess blank lines (WhatsApp renders them as wasted space)
    s = s.replace(/\n{3,}/g, '\n\n');

    // Remove heading markers (# Title → Title)
    s = s.replace(/^#{1,6}\s+/gm, '');

    return s.trim();
  },

  validate(output: string): string | string[] {
    // WhatsApp supports up to 4096 chars per message. Split only if extreme.
    const MAX = 1600;
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
