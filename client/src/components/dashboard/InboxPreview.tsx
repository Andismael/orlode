/**
 * InboxPreview — compact "last conversations" card for the Dashboard.
 *
 * Shows the 5 most recent WhatsApp + Telegram threads at a glance, with
 * channel badge, unread indicator, last message snippet and relative time.
 * Clicking a row opens the full unified inbox at /admin/inbox; the global
 * "Voir tout" link does the same.
 *
 * Reuses useInboxChannels — same data source as the per-pack InboxTab and
 * the standalone /admin/inbox page, so the merchant sees consistent state.
 */
import { Link } from 'react-router-dom';
import { MessageCircle, Send, Inbox, ArrowRight } from 'lucide-react';
import { useInboxChannels, type InboxThread } from '@/hooks/useInboxChannels';

const WA = '#25D366';
const TG = '#0088CC';

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

function Row({ thread }: { thread: InboxThread }) {
  const ch = thread.channel === 'whatsapp' ? { color: WA, label: 'WA' } : { color: TG, label: 'TG' };
  return (
    <Link to="/admin/inbox" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 10,
      background: thread.unread ? `${ch.color}06` : 'transparent',
      borderLeft: `3px solid ${thread.unread ? ch.color : 'transparent'}`,
      textDecoration: 'none', cursor: 'pointer',
      transition: 'background .15s ease',
    }}
      onMouseEnter={e => e.currentTarget.style.background = `${ch.color}10`}
      onMouseLeave={e => e.currentTarget.style.background = thread.unread ? `${ch.color}06` : 'transparent'}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: `linear-gradient(135deg, ${ch.color}, ${ch.color}cc)`,
        color: '#fff', fontWeight: 800, fontSize: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontFamily: 'Fraunces, serif',
      }}>
        {initials(thread.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0A2A20', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {thread.name}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
            background: `${ch.color}1a`, color: ch.color,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em',
          }}>{ch.label}</span>
        </div>
        <p style={{
          fontSize: 11, color: thread.unread ? '#0A2A20' : '#5A6B62',
          margin: 0, fontWeight: thread.unread ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>{thread.lastMessage || '—'}</p>
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#94A3A0', flexShrink: 0 }}>
        {timeAgo(thread.lastAt)}
      </span>
    </Link>
  );
}

export default function InboxPreview() {
  const { threads, totals, waStatus, tgStatus, loading } = useInboxChannels({ autoRefreshMs: 20000 });
  const recent = threads.slice(0, 5);

  return (
    <div style={{
      background: '#FFFAF0', borderRadius: 18, padding: 18,
      border: '1px solid rgba(31,41,55,0.06)',
      fontFamily: 'Inter, sans-serif',
      minHeight: 280,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 800,
            color: '#0F766E', letterSpacing: '0.08em', marginBottom: 2,
          }}>
            <Inbox size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
            INBOX · WA + TG
          </div>
          <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 800, color: '#0A2A20', margin: 0, letterSpacing: '-0.02em' }}>
            Tes derniers <em style={{ fontStyle: 'italic', color: WA }}>messages</em>
          </h3>
        </div>
        <Link to="/admin/inbox" style={{
          fontSize: 11, fontWeight: 700, color: '#0F766E',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          Voir tout ({totals.all}) <ArrowRight size={11} />
        </Link>
      </div>

      {/* Channel status pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
          background: waStatus.connected ? `${WA}15` : '#F5F0E8',
          color: waStatus.connected ? '#128C7E' : '#94A3A0',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {waStatus.connected ? '●' : '○'} WA · {totals.whatsapp}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
          background: tgStatus.connected ? `${TG}15` : '#F5F0E8',
          color: tgStatus.connected ? '#006699' : '#94A3A0',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {tgStatus.connected ? '●' : '○'} TG · {totals.telegram}
        </span>
        {totals.unread > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
            background: '#FEE2E2', color: '#DC2626',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {totals.unread} non lu{totals.unread > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Threads */}
      {loading && recent.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: '#94A3A0', fontSize: 12, fontStyle: 'italic' }}>
          Chargement…
        </div>
      ) : recent.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', borderRadius: 12, background: '#F5F0E8', border: '1px dashed rgba(31,41,55,.15)' }}>
          <MessageCircle size={30} color={WA} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontSize: 12, color: '#5A6B62', margin: '0 0 12px', lineHeight: 1.5 }}>
            Pas encore de conversation.<br />
            <span style={{ fontSize: 11, color: '#94A3A0' }}>Dès qu'un client écrit, ça apparaît ici.</span>
          </p>
          {(!waStatus.connected || !tgStatus.connected) && (
            <div style={{ display: 'inline-flex', gap: 6 }}>
              {!waStatus.connected && (
                <Link to="/admin/whatsapp" style={{
                  fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8,
                  background: WA, color: '#fff', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <MessageCircle size={11} /> Connecter WA
                </Link>
              )}
              {!tgStatus.connected && (
                <Link to="/admin/telegram" style={{
                  fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8,
                  background: TG, color: '#fff', textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <Send size={11} /> Connecter TG
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {recent.map(t => <Row key={t.key} thread={t} />)}
        </div>
      )}
    </div>
  );
}
