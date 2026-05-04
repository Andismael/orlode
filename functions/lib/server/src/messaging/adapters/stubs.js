"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webAdapter = exports.voiceAdapter = exports.emailAdapter = exports.messengerAdapter = exports.smsAdapter = exports.telegramAdapter = void 0;
exports.telegramAdapter = {
    channel: 'telegram',
    systemOverride() {
        return `
=== TELEGRAM CHANNEL OVERRIDE ===
- Keep replies concise (5 sentences max).
- Supports Markdown V2 — you can use *bold*, _italic_, [links](url).
- Inline buttons and long messages OK (up to 4096 chars).`.trim();
    },
    postprocess(output) {
        // Telegram accepts more markdown. Just strip internal app links.
        return output.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, '$1').trim();
    },
    validate(output) {
        return output.slice(0, 4096);
    },
};
exports.smsAdapter = {
    channel: 'sms',
    systemOverride() {
        return `
=== SMS CHANNEL OVERRIDE ===
- Hard limit: 160 characters total. Be ultra-concise.
- Plain text only, no markdown, no emojis, no URLs unless strictly needed.
- One sentence answer whenever possible.`.trim();
    },
    postprocess(output) {
        return output
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // strip any markdown links
            .replace(/[*_`]/g, '') // strip markdown emphasis
            .replace(/\s+/g, ' ') // collapse whitespace
            .trim();
    },
    validate(output) {
        // SMS is 160 chars per segment. Split into multi-part if longer.
        const MAX = 160;
        if (output.length <= MAX)
            return output;
        const parts = [];
        let i = 0;
        while (i < output.length) {
            parts.push(output.slice(i, i + MAX));
            i += MAX;
        }
        return parts;
    },
};
exports.messengerAdapter = {
    channel: 'messenger',
    systemOverride() {
        return `
=== MESSENGER CHANNEL OVERRIDE ===
- Keep it short (3-4 sentences).
- Plain text preferred. Facebook Messenger supports quick reply buttons separately.
- No markdown formatting — use plain text.`.trim();
    },
    postprocess(output) {
        return output
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/[*_`#]/g, '')
            .trim();
    },
    validate(output) {
        return output.slice(0, 2000);
    },
};
exports.emailAdapter = {
    channel: 'email',
    systemOverride() {
        return `
=== EMAIL CHANNEL OVERRIDE ===
- Long-form responses are OK.
- Start with a greeting, end with a signature (e.g. "Cordialement,").
- Markdown is fine (will be rendered to HTML).
- Don't use internal app links — external URLs only.`.trim();
    },
    postprocess(output) {
        return output.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, '$1').trim();
    },
    validate(output) {
        return output; // No length cap for email
    },
};
exports.voiceAdapter = {
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
    postprocess(output) {
        return output
            .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
            .replace(/[*_`#]/g, '')
            .replace(/https?:\/\/\S+/g, 'sur notre site web')
            .replace(/\s+/g, ' ')
            .trim();
    },
    validate(output) {
        return output;
    },
};
exports.webAdapter = {
    channel: 'web',
    systemOverride() {
        return ''; // Default rich-response behavior, no override needed
    },
    postprocess(output) {
        return output;
    },
    validate(output) {
        return output;
    },
};
//# sourceMappingURL=stubs.js.map