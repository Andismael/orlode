/**
 * iCal IMPORT — fetch external calendar feeds (Booking.com, Airbnb, Google
 * Calendar) and turn them into "external_blocks" docs that the booking tools
 * consult before accepting a new reservation.
 *
 * Storage shape:
 *   companies/{cid}/stores/{id}/external_blocks/{uid}
 *     {
 *       uid: string,        // VEVENT UID (or hash if absent) — used as doc id
 *       from: string,       // YYYY-MM-DD inclusive
 *       to:   string,       // YYYY-MM-DD exclusive (Airbnb/Booking convention)
 *       summary: string,    // VEVENT SUMMARY (often empty / "Reserved")
 *       source: string,     // friendly name set on the import (e.g. "Airbnb")
 *       sourceUrl: string,  // feed url
 *       roomId?: string,    // optional — if the import is scoped to a room
 *       syncedAt: Date,
 *     }
 *
 * Store-doc shape (multiple imports allowed per store):
 *   stores/{id}.icalImports = [{ url, name, roomId?, lastSyncedAt }]
 */

import { getFirestore } from '../../config/firebase.config';
import { logger } from '../../utils/logger';
import { createHash } from 'crypto';

export interface IcalImportConfig {
  url: string;
  name: string;
  roomId?: string;
  lastSyncedAt?: Date;
}

interface ParsedEvent {
  uid: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD (exclusive)
  summary: string;
}

// ── Parser ──────────────────────────────────────────────────────────────────
// Minimal RFC 5545 parser — handles line folding, VEVENT blocks, DTSTART/DTEND
// in both DATE (`YYYYMMDD`) and DATE-TIME (`YYYYMMDDTHHMMSSZ`) forms.
function unfoldLines(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseIcsDate(s: string): string | null {
  // "20260510" or "20260510T140000Z" or "20260510T140000"
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseIcs(raw: string): ParsedEvent[] {
  const lines = unfoldLines(raw);
  const events: ParsedEvent[] = [];
  let cur: Partial<ParsedEvent> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.from && cur.to) {
        const uid = cur.uid ?? createHash('sha1').update(`${cur.from}|${cur.to}|${cur.summary ?? ''}`).digest('hex').slice(0, 24);
        events.push({
          uid,
          from: cur.from,
          to: cur.to,
          summary: cur.summary ?? '',
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    // Property line — `KEY[;PARAMS]:VALUE`
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    const head = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const key = head.split(';')[0].toUpperCase();
    if (key === 'UID') cur.uid = value.trim();
    else if (key === 'SUMMARY') cur.summary = value.replace(/\\,/g, ',').replace(/\\n/gi, ' ').trim();
    else if (key === 'DTSTART') {
      const d = parseIcsDate(value); if (d) cur.from = d;
    }
    else if (key === 'DTEND') {
      const d = parseIcsDate(value); if (d) cur.to = d;
    }
  }
  return events;
}

// ── Fetch & sync ────────────────────────────────────────────────────────────
const FETCH_TIMEOUT_MS = 12_000;
const MAX_FUTURE_DAYS = 400;

export async function fetchIcalFeed(url: string): Promise<ParsedEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/calendar' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Not a valid iCal feed');
    return parseIcs(text);
  } finally {
    clearTimeout(timer);
  }
}

interface SyncResult {
  url: string;
  name: string;
  imported: number;
  pruned: number;
  error?: string;
}

/**
 * Sync ONE iCal feed into Firestore. Returns counts of imported/pruned events.
 * Events outside [today-1d, today+400d] are ignored. Stale events (present in
 * Firestore but missing from the latest fetch) are pruned.
 */
export async function syncOneFeed(
  companyId: string, storeId: string, cfg: IcalImportConfig,
): Promise<SyncResult> {
  const db = getFirestore();
  const sourceKey = cfg.name || cfg.url;
  const result: SyncResult = { url: cfg.url, name: cfg.name, imported: 0, pruned: 0 };
  let events: ParsedEvent[];
  try {
    events = await fetchIcalFeed(cfg.url);
  } catch (e: unknown) {
    result.error = (e as Error).message ?? 'fetch failed';
    return result;
  }
  const today = new Date();
  const minDate = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  const maxDate = new Date(today.getTime() + MAX_FUTURE_DAYS * 86400000).toISOString().slice(0, 10);
  const fresh = events.filter(ev => ev.to > minDate && ev.from < maxDate);

  const col = db.collection(`companies/${companyId}/stores/${storeId}/external_blocks`);
  // Upsert each fresh event keyed by `${sourceKey}::${uid}` so multiple imports
  // can coexist without colliding.
  const seen = new Set<string>();
  for (const ev of fresh) {
    const docId = sanitizeDocId(`${sourceKey}::${ev.uid}`);
    seen.add(docId);
    await col.doc(docId).set({
      uid: ev.uid,
      from: ev.from,
      to: ev.to,
      summary: ev.summary,
      source: cfg.name,
      sourceUrl: cfg.url,
      ...(cfg.roomId ? { roomId: cfg.roomId } : {}),
      syncedAt: new Date(),
    }, { merge: true });
    result.imported++;
  }
  // Prune stale entries from this source
  const existing = await col.where('source', '==', cfg.name).get().catch(() => null);
  if (existing) {
    for (const d of existing.docs) {
      if (!seen.has(d.id)) {
        await d.ref.delete();
        result.pruned++;
      }
    }
  }

  // Update lastSyncedAt on the store's icalImports list
  try {
    const ref = db.doc(`companies/${companyId}/stores/${storeId}`);
    const snap = await ref.get();
    const current = ((snap.data() as { icalImports?: IcalImportConfig[] })?.icalImports ?? [])
      .map(x => x.url === cfg.url ? { ...x, lastSyncedAt: new Date() } : x);
    await ref.set({ icalImports: current, updatedAt: new Date() }, { merge: true });
  } catch (err) {
    logger.warn('[iCalImport] failed to update lastSyncedAt', { companyId, storeId, err: String(err) });
  }
  return result;
}

function sanitizeDocId(s: string): string {
  return s.replace(/[\/\.\#\$\[\]]/g, '_').slice(0, 1500);
}

/**
 * Check if any external_block overlaps the requested date range.
 * Convention: existing.from inclusive, existing.to exclusive (Airbnb/Booking).
 * `from < existing.to && to > existing.from` = overlap.
 */
export async function findExternalBlockConflict(args: {
  companyId: string; storeId: string;
  from: string; to: string;          // YYYY-MM-DD ; to exclusive
  roomId?: string;
}): Promise<{ from: string; to: string; source: string } | null> {
  const db = getFirestore();
  const snap = await db.collection(`companies/${args.companyId}/stores/${args.storeId}/external_blocks`).get().catch(() => null);
  if (!snap) return null;
  for (const d of snap.docs) {
    const b = d.data() as { from?: string; to?: string; source?: string; roomId?: string };
    if (!b.from || !b.to) continue;
    if (args.roomId && b.roomId && b.roomId !== args.roomId) continue;
    if (args.from < b.to && args.to > b.from) {
      return { from: b.from, to: b.to, source: b.source ?? 'externe' };
    }
  }
  return null;
}
