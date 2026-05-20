"use strict";
/**
 * In-memory rate limiter — lightweight, instance-local.
 *
 * Used to protect WhatsApp + Telegram webhooks from spam/abuse. Each phone
 * (or telegram_id) gets a sliding window. If they exceed the threshold, the
 * webhook silently drops the message (we still 200-ack to Meta/Telegram).
 *
 * Why in-memory: Cloud Run instances are ephemeral, but the average phone
 * sending 100 msg/min would hammer a single instance long before round-robin
 * load balancing distributes them. In-memory works for the 95% case.
 * Firestore-backed alternative available below if multi-instance accuracy
 * matters later.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
exports.isSpam = isSpam;
exports.isRepeatSpam = isRepeatSpam;
const windows = new Map();
const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_MESSAGES = 20; // 20 messages / window / sender
/** Returns true if the message should be processed, false to drop. */
function checkRateLimit(key, opts = {}) {
    const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
    const maxMessages = opts.maxMessages ?? DEFAULT_MAX_MESSAGES;
    const now = Date.now();
    const state = windows.get(key);
    if (!state || now - state.windowStart > windowMs) {
        windows.set(key, { count: 1, windowStart: now });
        return true;
    }
    state.count++;
    if (state.count > maxMessages) {
        return false;
    }
    return true;
}
/** Periodic cleanup to keep the map small (called opportunistically). */
function cleanup() {
    const now = Date.now();
    for (const [k, v] of windows.entries()) {
        if (now - v.windowStart > DEFAULT_WINDOW_MS * 5) {
            windows.delete(k);
        }
    }
}
setInterval(cleanup, 5 * 60000).unref?.();
// ── Anti-spam heuristics ────────────────────────────────────────────────────
const SPAM_PATTERNS = [
    /(.)\1{15,}/, // 15+ repeated chars
    /https?:\/\/(?!wa\.me|api\.whatsapp\.com)/i, // external links (allow WA only)
    /\b(?:viagra|cialis|porn|crypto|bitcoin|forex|btc.*pump)\b/i,
];
/** Returns true if the message looks like spam (drop it). */
function isSpam(text) {
    if (!text)
        return false;
    const t = text.trim();
    if (t.length === 0)
        return false;
    if (t.length === 1 && /[^a-z0-9]/i.test(t))
        return true; // single punctuation
    if (SPAM_PATTERNS.some(p => p.test(t)))
        return true;
    return false;
}
const recentMessages = new Map();
/** Returns true if the same exact text has been sent 4+ times in 60s. */
function isRepeatSpam(key, text) {
    if (!text)
        return false;
    const now = Date.now();
    const prev = recentMessages.get(key);
    if (!prev || prev.text !== text || now - prev.lastAt > 60000) {
        recentMessages.set(key, { text, count: 1, lastAt: now });
        return false;
    }
    prev.count++;
    prev.lastAt = now;
    return prev.count >= 4;
}
//# sourceMappingURL=rateLimit.js.map