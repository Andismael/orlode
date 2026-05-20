/**
 * Free-text French openingHours parser — client-side mirror of the server
 * helper at `server/src/utils/openingHoursCheck.ts`. Recognises:
 *
 *   "Lun-Ven 12h-22h, Sam-Dim 18h-23h"
 *   "Tous les jours 8h-20h"
 *   "7j/7 24h/24"
 *   "Fermé le dimanche"
 *   "Mar-Sam 10h00-19h00"
 *
 * Returns null when the format is unparseable (caller should NOT block on null).
 *
 * Shared by PublicMenuPage + RestaurantRedesignPage (and any future caller).
 */

const DAYS_FR: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6,
};

const DAY_LABELS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

interface OpenSlot { days: Set<number>; startMin: number; endMin: number }

function parseSlots(text: string): OpenSlot[] {
  const slots: OpenSlot[] = [];
  const segs = text.split(/[,;·|\n]+/).map(s => s.trim()).filter(Boolean);
  for (const seg of segs) {
    if (/ferm[ée]/i.test(seg)) continue;
    let days: Set<number> | null = null;
    if (/tous les jours|7\s*j\s*\/\s*7|7j7|chaque jour/i.test(seg)) {
      days = new Set([0, 1, 2, 3, 4, 5, 6]);
    } else {
      const range = seg.match(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)\s*(?:-|au|à)\s*(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)/i);
      if (range) {
        const a = DAYS_FR[range[1].toLowerCase()];
        const b = DAYS_FR[range[2].toLowerCase()];
        if (a != null && b != null) {
          days = new Set();
          let cur = a;
          for (let i = 0; i < 7; i++) { days.add(cur); if (cur === b) break; cur = (cur + 1) % 7; }
        }
      } else {
        const single = seg.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)\b/i);
        if (single) {
          const d = DAYS_FR[single[1].toLowerCase()];
          if (d != null) days = new Set([d]);
        }
      }
    }
    const hours = seg.match(/(\d{1,2})\s*[h:]\s*(\d{0,2})\s*[-–à]+\s*(\d{1,2})\s*[h:]\s*(\d{0,2})/);
    if (!days || !hours) continue;
    const startMin = parseInt(hours[1]) * 60 + (hours[2] ? parseInt(hours[2]) : 0);
    const endMin = parseInt(hours[3]) * 60 + (hours[4] ? parseInt(hours[4]) : 0);
    slots.push({ days, startMin, endMin });
  }
  return slots;
}

function parseClosedDays(text: string): Set<number> {
  const closed = new Set<number>();
  const matches = text.matchAll(/ferm[ée]s?\s+(?:le\s+|les\s+)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun|mar|mer|jeu|ven|sam|dim)s?/gi);
  for (const m of matches) {
    const d = DAYS_FR[m[1].toLowerCase()];
    if (d != null) closed.add(d);
  }
  return closed;
}

/** Returns true/false when we can tell, null when the format is unparseable. */
export function isStoreOpenNowClient(openingHours?: string | null): boolean | null {
  if (!openingHours || !openingHours.trim()) return null;
  const text = openingHours.toLowerCase();
  if (/24\s*h\s*\/\s*24|24h24|non[-\s]?stop/.test(text)
      && !/lun|mar|mer|jeu|ven|sam|dim/.test(text)) return true;
  const now = new Date();
  const dow = now.getDay();
  const min = now.getHours() * 60 + now.getMinutes();
  if (parseClosedDays(text).has(dow)) return false;
  const slots = parseSlots(text);
  if (slots.length === 0) return null;
  const today = slots.filter(s => s.days.has(dow));
  if (today.length === 0) return false;
  for (const s of today) {
    if (s.endMin > s.startMin) {
      if (min >= s.startMin && min < s.endMin) return true;
    } else {
      if (min >= s.startMin || min < s.endMin) return true;
    }
  }
  return false;
}

/** Returns the next opening as a formatted FR string ("demain 12h00", "lundi 8h00")
 *  or null if we can't determine it. */
export function getNextOpeningTime(openingHours?: string | null): string | null {
  if (!openingHours) return null;
  const slots = parseSlots(openingHours.toLowerCase());
  const closed = parseClosedDays(openingHours.toLowerCase());
  if (slots.length === 0) return null;
  const now = new Date();
  const dowToday = now.getDay();
  const minToday = now.getHours() * 60 + now.getMinutes();
  // Walk through today + next 7 days, find the soonest slot start
  for (let i = 0; i < 8; i++) {
    const dow = (dowToday + i) % 7;
    if (closed.has(dow)) continue;
    const daySlots = slots
      .filter(s => s.days.has(dow))
      .filter(s => i > 0 || s.startMin > minToday)
      .sort((a, b) => a.startMin - b.startMin);
    if (daySlots.length > 0) {
      const s = daySlots[0];
      const h = Math.floor(s.startMin / 60);
      const m = s.startMin % 60;
      const time = m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
      const dayLabel = i === 0 ? "aujourd'hui" : i === 1 ? 'demain' : DAY_LABELS_LONG[dow];
      return `${dayLabel} ${time}`;
    }
  }
  return null;
}

/** Convenience wrapper combining status + next opening. */
export function getServiceStatus(openingHours?: string | null): {
  open: boolean | null;
  nextOpening: string | null;
} {
  return {
    open: isStoreOpenNowClient(openingHours),
    nextOpening: getNextOpeningTime(openingHours),
  };
}
