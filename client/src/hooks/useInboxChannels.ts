/**
 * useInboxChannels — fetch + merge WhatsApp and Telegram messages into a
 * single unified threads list, with channel tagging per thread.
 *
 * Used by every pack redesign page so the "Inbox" tab shows both channels
 * side-by-side with a channel badge. The server normalizes both endpoints
 * to the same shape ({ id, from, to, body, direction, contactName,
 * createdAt }) plus a `channel` tag.
 *
 * Threads are grouped by contact (from/to for WA, chatId for TG) so a
 * single conversation never splits across rows even if both channels are
 * used by the same person.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/services/api';

export type InboxChannel = 'whatsapp' | 'telegram';

export interface InboxMessage {
  id: string;
  channel: InboxChannel;
  direction?: 'inbound' | 'outbound';
  from?: string;
  to?: string;
  chatId?: string;
  body?: string;
  text?: string;
  message?: string;
  contactName?: string | null;
  customerName?: string | null;
  createdAt?: { _seconds?: number } | string | number | null;
  /** WhatsApp delivery status from Meta status webhook: sent → delivered → read.
   *  Telegram doesn't expose per-message status, so always undefined there. */
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  deliveryErrors?: Array<{ code?: number; title?: string; message?: string }>;
  /** Media attachment — Storage public URL set by the inbox send-image route. */
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
}

export interface InboxThread {
  /** Unique key per conversation: `${channel}:${contactId}`. */
  key: string;
  channel: InboxChannel;
  /** Channel-specific contact identifier — phone for WA, chatId for TG. */
  contactId: string;
  name: string;
  lastMessage: string;
  lastAt: number;
  unread: boolean;
  messages: InboxMessage[];
}

export interface ChannelStatus {
  connected: boolean;
  /** Channel-specific extra (e.g. botUsername for TG, phoneNumberId for WA). */
  meta?: Record<string, unknown>;
}

function getMs(t: InboxMessage['createdAt']): number {
  if (!t) return 0;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') return new Date(t).getTime() || 0;
  if (typeof (t as any)._seconds === 'number') return (t as any)._seconds * 1000;
  return 0;
}

function bodyOf(m: InboxMessage): string {
  return m.body ?? m.text ?? m.message ?? '';
}

function contactKeyOf(m: InboxMessage): string {
  // Inbound → identified by sender. Outbound → by recipient. Falls back to chatId.
  if (m.direction === 'outbound') return String(m.to ?? m.chatId ?? '');
  return String(m.from ?? m.chatId ?? '');
}

export function useInboxChannels(opts?: { autoRefreshMs?: number }) {
  const [waMessages, setWaMessages] = useState<InboxMessage[]>([]);
  const [tgMessages, setTgMessages] = useState<InboxMessage[]>([]);
  const [waStatus, setWaStatus] = useState<ChannelStatus>({ connected: false });
  const [tgStatus, setTgStatus] = useState<ChannelStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [wa, tg, waSt, tgSt] = await Promise.all([
      api.get('/whatsapp/messages').catch(() => ({ data: [] })),
      api.get('/telegram/messages').catch(() => ({ data: [] })),
      api.get('/whatsapp/status').catch(() => ({ data: { connected: false } })),
      api.get('/telegram/status').catch(() => ({ data: { connected: false } })),
    ]);
    // The api axios interceptor already unwraps `{ success, data }` → `data` is
    // the payload directly. But some legacy endpoints (and the .catch fallbacks)
    // can still return the envelope, so we accept both shapes defensively.
    const unwrap = <T>(r: any, fallback: T): T => {
      const d = r?.data;
      if (d == null) return fallback;
      if (Array.isArray(d)) return d as unknown as T;
      if ('data' in d) return (d.data as T) ?? fallback;
      return d as T;
    };
    const waArr = unwrap<any[]>(wa, []);
    const tgArr = unwrap<any[]>(tg, []);
    const waS  = unwrap<Record<string, any>>(waSt, {});
    const tgS  = unwrap<Record<string, any>>(tgSt, {});

    const waList: InboxMessage[] = (Array.isArray(waArr) ? waArr : []).map(m => ({ ...m, channel: 'whatsapp' as const }));
    const tgList: InboxMessage[] = (Array.isArray(tgArr) ? tgArr : []).map(m => ({ ...m, channel: 'telegram' as const }));
    setWaMessages(waList);
    setTgMessages(tgList);
    setWaStatus({ connected: Boolean(waS?.connected), meta: waS });
    setTgStatus({ connected: Boolean(tgS?.connected), meta: tgS });
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!opts?.autoRefreshMs) return;
    const id = setInterval(refetch, opts.autoRefreshMs);
    return () => clearInterval(id);
  }, [refetch, opts?.autoRefreshMs]);

  const threads: InboxThread[] = useMemo(() => {
    const all = [...waMessages, ...tgMessages];
    const grouped = new Map<string, InboxMessage[]>();
    for (const m of all) {
      const cid = contactKeyOf(m);
      if (!cid) continue;
      const key = `${m.channel}:${cid}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }
    const out: InboxThread[] = [];
    for (const [key, list] of grouped) {
      list.sort((a, b) => getMs(a.createdAt) - getMs(b.createdAt));
      const last = list[list.length - 1];
      const [channel, contactId] = key.split(':', 2) as [InboxChannel, string];
      out.push({
        key,
        channel,
        contactId,
        name: last.contactName ?? last.customerName ?? contactId,
        lastMessage: bodyOf(last),
        lastAt: getMs(last.createdAt),
        unread: last.direction === 'inbound',
        messages: list,
      });
    }
    out.sort((a, b) => b.lastAt - a.lastAt);
    return out;
  }, [waMessages, tgMessages]);

  const totals = useMemo(() => ({
    all: threads.length,
    whatsapp: threads.filter(t => t.channel === 'whatsapp').length,
    telegram: threads.filter(t => t.channel === 'telegram').length,
    unread: threads.filter(t => t.unread).length,
  }), [threads]);

  return { threads, totals, waStatus, tgStatus, loading, refetch };
}

/** Build a deep link to reply on the right channel from the current device. */
export function replyLink(thread: InboxThread, text?: string): string {
  if (thread.channel === 'whatsapp') {
    const phone = thread.contactId.replace(/[^0-9]/g, '');
    return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`;
  }
  // Telegram: open Telegram with the chat. Numeric chat IDs use tg://user?id=
  if (/^-?\d+$/.test(thread.contactId)) return `tg://user?id=${thread.contactId}`;
  return `https://t.me/${thread.contactId.replace(/^@/, '')}`;
}
