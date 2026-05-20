/**
 * InboxTab — shared, channel-agnostic inbox used by every pack redesign page.
 *
 * - Loads WhatsApp + Telegram threads via useInboxChannels()
 * - Shows status pill per channel (connected / not connected)
 * - Channel filter pills: All · WhatsApp · Telegram
 * - Thread list with channel badge (WA green / TG blue)
 * - Selected conversation view + "Répondre" button that opens the right
 *   channel app (wa.me or t.me / tg://)
 *
 * Styling adapts to the pack's accent color via props so each vertical
 * keeps its visual identity while sharing the underlying mechanics.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Send, ExternalLink, FileText, Paperclip } from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useInboxChannels, replyLink, type InboxThread } from '@/hooks/useInboxChannels';
import TemplateSendModal from '@/components/inbox/TemplateSendModal';

interface InboxTabProps {
  /** Accent color — used for pack's branded touches (badges, highlights). */
  accent: string;
  accentDeep: string;
  ink: string;
  inkSoft: string;
  inkLight: string;
  cream: string;
  creamDeep: string;
  /** Optional empty-state copy override (e.g. "Dès qu'un patient t'écrit…"). */
  emptyHint?: string;
}

const WA = '#25D366';
const WA_DEEP = '#128C7E';
const TG = '#0088CC';
const TG_DEEP = '#006699';

function initials(name: string): string {
  return name.trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

function getMs(t: unknown): number {
  if (!t) return 0;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') return new Date(t).getTime() || 0;
  if (typeof (t as any)._seconds === 'number') return (t as any)._seconds * 1000;
  return 0;
}

/** WhatsApp-style delivery tick. Shows ✓ (sent), ✓✓ grey (delivered), ✓✓
 *  green-blue (read), or a clock/cross for queued/failed. Telegram doesn't
 *  expose per-message status so the tick is hidden in that case. */
function ReceiptTick({ status, channel }: { status?: 'sent' | 'delivered' | 'read' | 'failed'; channel: 'whatsapp' | 'telegram' }) {
  // Telegram: no status webhook → hide ticks entirely to avoid lying.
  if (channel === 'telegram') return null;
  if (!status || status === 'sent') {
    // Single grey check.
    return (
      <svg width="14" height="10" viewBox="0 0 14 10" aria-label="Envoyé" fill="none" stroke="#94A3A0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 5l3 3L13 1" />
      </svg>
    );
  }
  if (status === 'failed') {
    return (
      <svg width="11" height="11" viewBox="0 0 11 11" aria-label="Échec" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
        <path d="M2 2l7 7M9 2l-7 7" />
      </svg>
    );
  }
  // delivered or read → double tick, grey or blue.
  const color = status === 'read' ? '#0EA5E9' : '#94A3A0';
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" aria-label={status === 'read' ? 'Lu' : 'Livré'} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 5l3 3L11 1" />
      <path d="M5 8L7 6m-1 1L13 1" />
    </svg>
  );
}

function ChannelBadge({ channel }: { channel: 'whatsapp' | 'telegram' }) {
  const color = channel === 'whatsapp' ? WA : TG;
  const label = channel === 'whatsapp' ? 'WA' : 'TG';
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
      background: `${color}1a`, color, letterSpacing: '0.04em',
      fontFamily: 'JetBrains Mono, monospace',
    }}>{label}</span>
  );
}

export function InboxTab({ accent, accentDeep, ink, inkSoft, inkLight, cream, creamDeep, emptyHint }: InboxTabProps) {
  const { threads, totals, waStatus, tgStatus, loading, refetch } = useInboxChannels({ autoRefreshMs: 15000 });
  const [filter, setFilter] = useState<'all' | 'whatsapp' | 'telegram'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // ── Reply input state — keyed by thread.key so switching threads doesn't
  //    wipe a half-typed draft from another conversation.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const visible = useMemo(() => {
    if (filter === 'all') return threads;
    return threads.filter(t => t.channel === filter);
  }, [threads, filter]);

  const selected: InboxThread | undefined = useMemo(() => {
    if (selectedKey) return visible.find(t => t.key === selectedKey) ?? visible[0];
    return visible[0];
  }, [visible, selectedKey]);

  const bothDisconnected = !waStatus.connected && !tgStatus.connected;

  // Auto-scroll to the latest message when switching threads or after sending.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [selected?.key, selected?.messages.length]);

  // Send the draft message via the right backend endpoint based on channel.
  // Both endpoints accept `{ to|chatId, message }` and persist the outbound
  // message in the same Firestore collection that /messages reads from, so a
  // refetch picks up the new line. Optimistic UI: refresh on success.
  async function sendReply() {
    if (!selected) return;
    const text = (drafts[selected.key] ?? '').trim();
    if (!text || sending) return;
    setSending(true);
    try {
      if (selected.channel === 'whatsapp') {
        await api.post('/whatsapp/send', { to: selected.contactId, message: text });
      } else {
        await api.post('/telegram/send', { chatId: selected.contactId, message: text });
      }
      setDrafts(d => ({ ...d, [selected.key]: '' }));
      // Refetch so the outbound message appears in the thread. The backend
      // persists outbound messages alongside inbound ones in the same store.
      await refetch();
    } catch (e: any) {
      toast.error('Envoi impossible', e?.response?.data?.message ?? e?.message ?? 'Réessaie.');
    } finally {
      setSending(false);
    }
  }

  // Image attachment send — WhatsApp only (Telegram bot image upload is a
  // separate flow we'll add later if needed). Reads the file, base64s it,
  // posts to /send-image. The caption is whatever the user typed in the
  // composer textarea.
  async function sendImage(file: File) {
    if (!selected || selected.channel !== 'whatsapp') return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde', 'Max 5 Mo.'); return; }
    setSending(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result ?? '');
      try {
        const caption = (drafts[selected.key] ?? '').trim();
        await api.post('/whatsapp/send-image', {
          to: selected.contactId,
          imageBase64: dataUrl.replace(/^data:image\/[^;]+;base64,/, ''),
          imageMimeType: file.type,
          ...(caption ? { caption } : {}),
        });
        setDrafts(d => ({ ...d, [selected.key]: '' }));
        toast.success('Image envoyée');
        await refetch();
      } catch (e: any) {
        toast.error('Envoi image échoué', e?.response?.data?.message ?? e?.message ?? '');
      } finally {
        setSending(false);
      }
    };
    reader.onerror = () => { setSending(false); toast.error('Lecture image échouée'); };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Mobile responsiveness: on phones we collapse the side-by-side
          threads/conversation layout into a vertical stack so each pane uses
          the full screen width and isn't squashed into 30px columns.
          Auto-injected stylesheet — scoped via the .inbox-* classnames so it
          can't bleed onto unrelated grids. */}
      <style>{`
        @media (max-width: 720px) {
          .inbox-split { flex-direction: column !important; }
          .inbox-threads { width: 100% !important; max-height: 320px !important; min-height: 200px !important; height: auto !important; }
          .inbox-conv { width: 100% !important; min-height: 420px !important; }
        }
      `}</style>
      {/* Header: per-channel status pills + filter pills */}
      <div style={{ background: cream, borderRadius: 14, padding: 14, border: `1px solid ${ink}10` }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
            background: waStatus.connected ? `${WA}15` : creamDeep,
            color: waStatus.connected ? WA_DEEP : inkSoft,
            letterSpacing: '0.04em',
          }}>
            {waStatus.connected ? '● ' : '○ '}WHATSAPP {waStatus.connected ? 'CONNECTÉ' : 'NON CONNECTÉ'}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
            background: tgStatus.connected ? `${TG}15` : creamDeep,
            color: tgStatus.connected ? TG_DEEP : inkSoft,
            letterSpacing: '0.04em',
          }}>
            {tgStatus.connected ? '● ' : '○ '}TELEGRAM {tgStatus.connected ? 'CONNECTÉ' : 'NON CONNECTÉ'}
          </span>
        </div>
        <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 700, color: ink, margin: 0 }}>
          Inbox <em style={{ fontStyle: 'italic', fontWeight: 500, color: accentDeep }}>multi-canal</em>
        </h3>
        <p style={{ fontSize: 11, color: inkSoft, margin: '4px 0 12px' }}>
          {totals.all} conversation{totals.all > 1 ? 's' : ''} ·{' '}
          <a href="/admin/inbox" style={{ color: accentDeep, fontWeight: 600, textDecoration: 'none' }}>Inbox unifié plein écran</a>{' '}·{' '}
          <a href="/admin/whatsapp" style={{ color: inkLight, fontWeight: 500, textDecoration: 'none' }}>Config WA</a>{' '}·{' '}
          <a href="/admin/telegram" style={{ color: inkLight, fontWeight: 500, textDecoration: 'none' }}>Config TG</a>
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { id: 'all',       label: `Tout (${totals.all})`,           color: ink },
            { id: 'whatsapp',  label: `WhatsApp (${totals.whatsapp})`,  color: WA_DEEP },
            { id: 'telegram',  label: `Telegram (${totals.telegram})`,  color: TG_DEEP },
          ] as const).map(o => {
            const on = filter === o.id;
            return (
              <button
                key={o.id}
                onClick={() => { setFilter(o.id); setSelectedKey(null); }}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 999,
                  background: on ? o.color : 'transparent',
                  color: on ? cream : o.color,
                  border: `1px solid ${o.color}40`,
                  cursor: 'pointer',
                }}
              >
                {o.label}
              </button>
            );
          })}
          <button
            onClick={refetch}
            style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 600,
              padding: '5px 10px', borderRadius: 999,
              background: 'transparent', color: inkSoft,
              border: `1px solid ${ink}15`, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <RefreshCw size={11} className={loading ? 'spin' : ''} /> {loading ? '...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Empty state — different copy/buttons depending on what's connected.
          The pre-fix bug: two big "WhatsApp" / "Telegram" buttons always sent
          the user to the config page even when channels were already wired
          up. Now: if a channel is already connected, no button for it (just
          "wait for first message"); if it isn't, a CLEAR "Connecter X" button
          that openly signals the user is about to set up integration. */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: cream, borderRadius: 14, border: `1px dashed ${ink}20` }}>
          <MessageCircle size={48} color={accent} style={{ marginBottom: 12, opacity: 0.7 }} />
          <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: ink, margin: '0 0 6px', fontWeight: 800 }}>
            {bothDisconnected ? 'Aucun canal connecté' : 'Pas encore de message'}
          </h3>
          <p style={{ fontSize: 13, color: inkSoft, margin: '0 0 16px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            {bothDisconnected
              ? 'Connecte WhatsApp Business et/ou Telegram Bot pour commencer à recevoir.'
              : (emptyHint ?? 'Dès qu\'un contact écrit sur WhatsApp ou Telegram, sa conversation apparaît ici.')}
          </p>
          {(!waStatus.connected || !tgStatus.connected) && (
            <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {!waStatus.connected && (
                <a href="/admin/whatsapp" style={{ textDecoration: 'none' }}>
                  <button style={{
                    fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
                    background: WA, color: cream, border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    <MessageCircle size={13} /> Connecter WhatsApp
                  </button>
                </a>
              )}
              {!tgStatus.connected && (
                <a href="/admin/telegram" style={{ textDecoration: 'none' }}>
                  <button style={{
                    fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10,
                    background: TG, color: cream, border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    <Send size={13} /> Connecter Telegram
                  </button>
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="inbox-split" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Thread list — full-width on mobile, fixed 340px sidebar on desktop */}
          <div className="scroll-thin inbox-threads" style={{
            width: 340, flexShrink: 0, background: cream, borderRadius: 16, overflow: 'auto',
            border: `1px solid ${ink}10`, height: 'calc(100vh - 320px)', minHeight: 460,
          }}>
            <div style={{ padding: '14px 16px', background: `linear-gradient(135deg, ${accent}, ${accentDeep})`, color: cream, position: 'sticky', top: 0, zIndex: 1 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 800, letterSpacing: '.1em', opacity: 0.9 }}>INBOX UNIFIÉE</div>
              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 800, margin: 0 }}>{visible.length} conversations</h3>
            </div>
            {visible.map(t => {
              const isSel = selected?.key === t.key;
              const channelColor = t.channel === 'whatsapp' ? WA : TG;
              return (
                <div key={t.key} onClick={() => setSelectedKey(t.key)} style={{
                  padding: '12px 16px', borderBottom: `1px solid ${ink}06`, cursor: 'pointer',
                  background: isSel ? `${channelColor}10` : (t.unread ? `${channelColor}05` : 'transparent'),
                  borderLeft: isSel ? `3px solid ${channelColor}` : (t.unread ? `3px solid ${channelColor}80` : '3px solid transparent'),
                  display: 'flex', gap: 10,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${channelColor}, ${t.channel === 'whatsapp' ? WA_DEEP : TG_DEEP})`,
                    color: cream, fontWeight: 700, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Fraunces, serif', flexShrink: 0,
                  }}>
                    {initials(t.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </span>
                      <ChannelBadge channel={t.channel} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <p style={{
                        fontSize: 11, color: t.unread ? ink : inkSoft, margin: 0,
                        fontWeight: t.unread ? 600 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>{t.lastMessage || '—'}</p>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: inkLight, flexShrink: 0 }}>
                        {timeAgo(t.lastAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected conversation */}
          <div className="inbox-conv" style={{ flex: 1, minWidth: 0, background: cream, borderRadius: 16, overflow: 'hidden', border: `1px solid ${ink}10`, height: 'calc(100vh - 320px)', minHeight: 460, display: 'flex', flexDirection: 'column' }}>
            {selected && (
              <>
                <div style={{
                  padding: '14px 18px',
                  background: `linear-gradient(135deg, ${selected.channel === 'whatsapp' ? WA : TG}, ${selected.channel === 'whatsapp' ? WA_DEEP : TG_DEEP})`,
                  color: cream, display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,250,240,.2)', color: cream, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces, serif', border: '2px solid rgba(255,250,240,.3)' }}>
                    {initials(selected.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 700, margin: 0 }}>{selected.name}</h3>
                    <div style={{ fontSize: 11, opacity: 0.9, fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ChannelBadge channel={selected.channel} />
                      <span>{selected.contactId}</span>
                    </div>
                  </div>
                </div>
                <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 18, background: `linear-gradient(180deg, ${cream}, ${creamDeep}50)`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.messages.map(m => {
                    const inbound = m.direction === 'inbound';
                    const body = m.body ?? m.text ?? m.message ?? '';
                    const channelColor = selected.channel === 'whatsapp' ? WA : TG;
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: inbound ? 'flex-start' : 'flex-end' }}>
                        <div style={{
                          background: inbound ? cream : `${channelColor}15`,
                          border: inbound ? `1px solid ${ink}10` : `1px solid ${channelColor}30`,
                          padding: m.mediaUrl ? 6 : '10px 14px',
                          borderRadius: inbound ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                          maxWidth: '75%', fontSize: 13, color: ink, lineHeight: 1.5,
                        }}>
                          {/* Image attachments — clickable to open full-size in
                              a new tab. Caption (if any) rendered below. */}
                          {m.mediaUrl && m.mediaType === 'image' && (
                            <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginBottom: body ? 6 : 0 }}>
                              <img
                                src={m.mediaUrl}
                                alt={body || 'image'}
                                style={{
                                  display: 'block', maxWidth: '100%', maxHeight: 280,
                                  borderRadius: 10, objectFit: 'cover',
                                  background: creamDeep,
                                }}
                                loading="lazy"
                              />
                            </a>
                          )}
                          {m.mediaUrl && body ? (
                            <div style={{ padding: '4px 8px' }}>{body}</div>
                          ) : (
                            body || (m.mediaUrl ? null : <em style={{ color: inkLight }}>(message vide)</em>)
                          )}
                          {/* Failed delivery — surface Meta's error inline so the
                              user knows the message didn't reach the customer
                              (typically: outside the 24h customer service window). */}
                          {!inbound && m.deliveryStatus === 'failed' && (
                            <div style={{ fontSize: 10, color: '#DC2626', marginTop: 4, fontStyle: 'italic' }}>
                              ⚠ Non délivré
                              {m.deliveryErrors?.[0]?.message && <> · {m.deliveryErrors[0].message}</>}
                            </div>
                          )}
                          {/* Delivery receipts WA-style: clock → ✓ → ✓✓ (sent
                              → delivered → read). Tail color goes WA-green when
                              read. Only shown on outbound messages. */}
                          <div style={{
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                            color: inkLight, marginTop: 4, textAlign: 'right',
                            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5,
                          }}>
                            <span>{timeAgo(getMs(m.createdAt))}</span>
                            {!inbound && (
                              <ReceiptTick status={m.deliveryStatus} channel={selected.channel} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Inline reply composer — sends through the backend so the
                    user doesn't have to leave the page. Enter sends, Shift+Enter
                    adds a newline. A small "Open in app" link remains for power
                    users who want voice / media / forwards (out of MVP scope). */}
                <div ref={messagesEndRef} />
                <div style={{ padding: 12, borderTop: `1px solid ${ink}10`, background: cream, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    {/* Image attachment — WhatsApp only for now. The chosen
                        file is uploaded to Firebase Storage and sent via Meta
                        as type=image; any text in the textarea becomes its
                        caption. Telegram image upload is on the roadmap. */}
                    {selected.channel === 'whatsapp' && (
                      <label style={{
                        height: 44, width: 44, borderRadius: 10,
                        background: `${WA}15`, color: WA_DEEP,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        cursor: sending ? 'wait' : 'pointer', flexShrink: 0,
                        border: `1.5px solid ${WA}30`,
                      }} title="Joindre une image (la zone de texte devient la légende)">
                        <Paperclip size={16} />
                        <input type="file" accept="image/*" hidden disabled={sending}
                          onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f); e.currentTarget.value = ''; }} />
                      </label>
                    )}
                    <textarea
                      value={drafts[selected.key] ?? ''}
                      onChange={e => setDrafts(d => ({ ...d, [selected.key]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
                      }}
                      placeholder={`Répondre à ${selected.name}… (Entrée pour envoyer)`}
                      rows={2}
                      disabled={sending}
                      style={{
                        flex: 1, resize: 'none', minHeight: 44, maxHeight: 120,
                        padding: '10px 12px', borderRadius: 10,
                        border: `1.5px solid ${ink}10`,
                        background: '#fff', color: ink, fontSize: 13, fontFamily: 'inherit',
                        outline: 'none', lineHeight: 1.45,
                      }}
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !(drafts[selected.key] ?? '').trim()}
                      style={{
                        height: 44, minWidth: 44, padding: '0 16px', borderRadius: 10,
                        background: selected.channel === 'whatsapp' ? WA : TG,
                        color: cream, border: 'none', fontFamily: 'inherit',
                        cursor: sending ? 'wait' : 'pointer',
                        fontSize: 13, fontWeight: 800,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        opacity: !(drafts[selected.key] ?? '').trim() || sending ? 0.6 : 1,
                        flexShrink: 0,
                      }}
                    >
                      {sending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                      {sending ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 10, color: inkLight, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      Envoyé via {selected.channel === 'whatsapp' ? 'WhatsApp Business' : 'Telegram Bot'}
                    </span>
                    <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                      {/* WhatsApp-only: template send for re-engagement outside
                          the 24h window. Hidden on Telegram (no such limit). */}
                      {selected.channel === 'whatsapp' && (
                        <button
                          onClick={() => setTemplateOpen(true)}
                          style={{ background: 'transparent', border: 'none', color: WA_DEEP, cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', fontSize: 11 }}
                          title="Envoyer un template Meta (hors fenêtre 24h)">
                          <FileText size={11} /> Template
                        </button>
                      )}
                      <a href={replyLink(selected)} target="_blank" rel="noreferrer" style={{ color: inkLight, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ExternalLink size={11} /> App
                      </a>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* WhatsApp template modal — only relevant for the WA channel. Hidden
          when the selected thread is Telegram (templates are a WA-API thing). */}
      {templateOpen && selected && selected.channel === 'whatsapp' && (
        <TemplateSendModal
          recipient={selected.contactId}
          recipientName={selected.name}
          onClose={() => setTemplateOpen(false)}
          onSent={() => refetch()}
        />
      )}
    </div>
  );
}

export default InboxTab;
