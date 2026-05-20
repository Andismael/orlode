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

interface WindowState {
  count: number;
  windowStart: number;
}

const windows = new Map<string, WindowState>();

const DEFAULT_WINDOW_MS = 60_000;     // 1 minute
const DEFAULT_MAX_MESSAGES = 20;      // 20 messages / window / sender

/** Returns true if the message should be processed, false to drop. */
export function checkRateLimit(
  key: string,
  opts: { windowMs?: number; maxMessages?: number } = {},
): boolean {
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
setInterval(cleanup, 5 * 60_000).unref?.();

// ── Anti-spam heuristics ────────────────────────────────────────────────────

const SPAM_PATTERNS: RegExp[] = [
  /(.)\1{15,}/,                              // 15+ repeated chars
  /https?:\/\/(?!wa\.me|api\.whatsapp\.com)/i, // external links (allow WA only)
  /\b(?:viagra|cialis|porn|crypto|bitcoin|forex|btc.*pump)\b/i,
];

/** Returns true if the message looks like spam (drop it). */
export function isSpam(text: string | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length === 0) return false;
  if (t.length === 1 && /[^a-z0-9]/i.test(t)) return true; // single punctuation
  if (SPAM_PATTERNS.some(p => p.test(t))) return true;
  return false;
}

const recentMessages = new Map<string, { text: string; count: number; lastAt: number }>();

/** Returns true if the same exact text has been sent 4+ times in 60s. */
export function isRepeatSpam(key: string, text: string): boolean {
  if (!text) return false;
  const now = Date.now();
  const prev = recentMessages.get(key);
  if (!prev || prev.text !== text || now - prev.lastAt > 60_000) {
    recentMessages.set(key, { text, count: 1, lastAt: now });
    return false;
  }
  prev.count++;
  prev.lastAt = now;
  return prev.count >= 4;
}
