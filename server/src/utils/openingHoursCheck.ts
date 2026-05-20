/**
 * Heuristic French-format openingHours parser.
 *
 * Stores keep `openingHours` as free text (e.g. "Lun-Ven 12h-22h, Sam-Dim 18h-23h",
 * "Tous les jours 8h-20h", "Fermé le dimanche", "7j/7 24h/24"). We parse the most
 * common shapes and return whether the establishment is open at a given moment.
 *
 * Philosophy: only refuse when we are CONFIDENT the place is closed. If the text
 * is unparseable, return `{ status: 'unknown' }` so callers can let the request
 * through (better to accept an out-of-hours order than to wrongly block an
 * in-hours one because the owner used a format we don't understand).
 */

const DAYS_FR: Record<string, number> = {
  // Long forms first so longer matches win in the regex alternation
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6,
};

const ALL_DAYS_PATTERNS = [
  /tous les jours/i,
  /\b7\s*j\s*\/\s*7\b/i,
  /\b7j7\b/i,
  /\bchaque jour\b/i,
];

const ALWAYS_OPEN_PATTERNS = [
  /\b24\s*h\s*\/\s*24\b/i,
  /\b24h24\b/i,
  /\bnon[-\s]?stop\b/i,
];

interface OpenSlot { days: Set<number>; startMin: number; endMin: number }

interface CheckResult {
  status: 'open' | 'closed' | 'unknown';
  /** Human-readable reason — only set when status === 'closed'. */
  reason?: string;
}

function parseTime(s: string): number | null {
  // "8h", "8h00", "8:00", "08h30", "22h"
  const m = s.match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (Number.isNaN(h) || Number.isNaN(min) || h > 24 || min >= 60) return null;
  return h * 60 + min;
}

function parseDayList(s: string): Set<number> | null {
  const lower = s.toLowerCase();
  if (ALL_DAYS_PATTERNS.some(p => p.test(lower))) {
    return new Set([0, 1, 2, 3, 4, 5, 6]);
  }
  // "Lun-Ven", "Lundi au Vendredi", "Mar-Sam", "Lun"
  const range = lower.match(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)\s*(?:-|au|à)\s*(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)/i);
  if (range) {
    const a = DAYS_FR[range[1]];
    const b = DAYS_FR[range[2]];
    if (a == null || b == null) return null;
    const days = new Set<number>();
    // Walk from a to b modulo 7 (handles "Sam-Dim" wrap)
    let cur = a;
    for (let i = 0; i < 7; i++) {
      days.add(cur);
      if (cur === b) break;
      cur = (cur + 1) % 7;
    }
    return days;
  }
  // Single day
  const single = lower.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)\b/);
  if (single) {
    const d = DAYS_FR[single[1]];
    return d == null ? null : new Set([d]);
  }
  return null;
}

function parseClosedDays(text: string): Set<number> {
  // "Fermé le dimanche", "Fermé les lundis", "Fermé dimanche"
  const closed = new Set<number>();
  const matches = text.matchAll(/ferm[ée]s?\s+(?:le\s+|les\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)s?/gi);
  for (const m of matches) {
    const d = DAYS_FR[m[1].toLowerCase()];
    if (d != null) closed.add(d);
  }
  return closed;
}

function parseSlots(text: string): OpenSlot[] {
  const slots: OpenSlot[] = [];
  // Split on `,` `;` `·` `|` and newlines
  const segments = text.split(/[,;·|\n]+/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    if (/ferm[ée]/i.test(seg)) continue; // closed-day segments handled separately
    const days = parseDayList(seg);
    // Hour range "12h-22h", "12h00-22h00", "12:00-22:00", "12h - 22h"
    const hourMatch = seg.match(/(\d{1,2}\s*[h:]\s*\d{0,2})\s*[-–à]+\s*(\d{1,2}\s*[h:]\s*\d{0,2})/);
    if (!days || !hourMatch) continue;
    const startMin = parseTime(hourMatch[1]);
    const endMin = parseTime(hourMatch[2]);
    if (startMin == null || endMin == null) continue;
    slots.push({ days, startMin, endMin });
  }
  return slots;
}

export interface IsOpenInput {
  openingHours?: string;
  /** Day of week 0-6 (0 = Sunday, JS getDay() convention). Defaults to now. */
  dayOfWeek?: number;
  /** Minutes since midnight (0-1439). Defaults to now. */
  minuteOfDay?: number;
}

export function isStoreOpen(input: IsOpenInput): CheckResult {
  const text = (input.openingHours ?? '').trim();
  if (!text) return { status: 'unknown' };

  if (ALWAYS_OPEN_PATTERNS.some(p => p.test(text))) {
    // 24h/24 + no day restriction → always open. If text also has a day list,
    // we honour it (e.g., "Lun-Ven 24h/24" = open all day weekdays).
    const onlyAllDays = parseSlots(text).length === 0;
    if (onlyAllDays && !/lun|mar|mer|jeu|ven|sam|dim/i.test(text)) {
      return { status: 'open' };
    }
  }

  const now = new Date();
  const dow = input.dayOfWeek ?? now.getDay();
  const mod = input.minuteOfDay ?? (now.getHours() * 60 + now.getMinutes());

  const closedDays = parseClosedDays(text);
  if (closedDays.has(dow)) {
    return { status: 'closed', reason: `Fermé ce jour (${text})` };
  }

  const slots = parseSlots(text);
  if (slots.length === 0) return { status: 'unknown' };

  // Match any slot containing today
  const todaySlots = slots.filter(s => s.days.has(dow));
  if (todaySlots.length === 0) {
    return { status: 'closed', reason: `Fermé aujourd'hui (${text})` };
  }
  for (const s of todaySlots) {
    // Handle slots crossing midnight (e.g. "20h-2h" = 20:00 to 02:00 next day)
    if (s.endMin > s.startMin) {
      if (mod >= s.startMin && mod < s.endMin) return { status: 'open' };
    } else {
      if (mod >= s.startMin || mod < s.endMin) return { status: 'open' };
    }
  }
  return { status: 'closed', reason: `Hors horaires (${text})` };
}

/** Parse a "YYYY-MM-DD" date + "HH:mm" time and check against openingHours. */
export function isStoreOpenAt(args: { openingHours?: string; date: string; time: string }): CheckResult {
  const m = args.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = args.time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || !t) return { status: 'unknown' };
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return isStoreOpen({
    openingHours: args.openingHours,
    dayOfWeek: d.getDay(),
    minuteOfDay: parseInt(t[1]) * 60 + parseInt(t[2]),
  });
}
