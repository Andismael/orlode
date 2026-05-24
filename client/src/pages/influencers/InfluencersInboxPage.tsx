/**
 * Orlode Influenceurs — recruiter inbox at /influencers/inbox.
 *
 * Recruiters see all the conversations they've initiated with créateures.
 * Créateure replies (arriving via WhatsApp on the platform number) are
 * routed by the webhook into the same conversation thread. Recruiter can
 * reply from this page — replies go out as WhatsApp messages to the
 * créateure's number (relayed through the Orlode platform).
 *
 * Auth required (Firebase). 2-pane layout: list left, thread right.
 */
import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, RefreshCw, MessageCircle, User } from 'lucide-react';
import api from '@/services/api';
import { useSEO } from '@/hooks/useSEO';
import { M, MOBILE_CSS } from '@/components/mobile/mobileDesign';

interface ConvSummary {
  id: string;
  influencerId: string;
  influencerDisplayName: string;
  lastMessageText: string;
  lastMessageFrom: 'brand' | 'creator';
  lastMessageAt: string | null;
  unreadByBrand: number;
  messageCount: number;
}
interface ThreadMessage {
  id: string;
  from: 'brand' | 'creator';
  text: string;
  sentAt: string | null;
}

export default function InfluenceursInboxPage() {
  useSEO({
    title: 'Inbox Influenceurs — Orlode',
    description: 'Conversations avec les créateurs que tu as contactés sur Orlode Influenceurs.',
    path: '/influencers/inbox',
  });

  const [params, setParams] = useSearchParams();
  const [convs, setConvs] = useState<ConvSummary[] | null>(null);
  const [active, setActive] = useState<string | null>(params.get('c'));
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations list
  const loadConvs = async () => {
    try {
      const r: any = await api.get('/influencers/conversations');
      const list = (r.data ?? r) as ConvSummary[];
      setConvs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
      setConvs([]);
    }
  };
  useEffect(() => { void loadConvs(); }, []);

  // Load thread when active changes
  useEffect(() => {
    if (!active) { setMessages(null); return; }
    setMessages(null);
    api.get(`/influencers/conversations/${active}/messages`)
      .then((r: any) => setMessages((r.data?.messages ?? r.messages) as ThreadMessage[]))
      .catch(err => setError(err instanceof Error ? err.message : 'Erreur chargement thread'));
    // Mark read
    api.post(`/influencers/conversations/${active}/mark-read`, {}).catch(() => {});
    setParams(p => { p.set('c', active); return p; });
  }, [active, setParams]);

  // Scroll to bottom when messages change
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/influencers/conversations/${active}/reply`, { message: draft.trim() });
      setDraft('');
      // Optimistic: refresh thread
      const r: any = await api.get(`/influencers/conversations/${active}/messages`);
      setMessages((r.data?.messages ?? r.messages) as ThreadMessage[]);
      void loadConvs();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message ?? e.message ?? 'Erreur envoi');
    } finally {
      setSending(false);
    }
  };

  const activeConv = convs?.find(c => c.id === active) ?? null;

  return (
    <div className="m-root" style={{ minHeight: '100vh', background: M.cream, display: 'flex', flexDirection: 'column' }}>
      <style>{MOBILE_CSS}</style>

      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, #2E1065, ${M.violetDeep})`,
        color: M.cream,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 30,
      }}>
        <Link to="/influencers" style={{
          color: M.cream, textDecoration: 'none',
          background: 'rgba(255,250,240,0.12)',
          border: `1px solid ${M.cream}25`,
          width: 32, height: 32, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ArrowLeft size={14} />
        </Link>
        <div style={{ flex: 1 }}>
          <div className="m-display" style={{ fontSize: 15, fontWeight: 700 }}>Inbox Influenceurs</div>
          <div style={{ fontSize: 10, opacity: 0.75 }}>
            {convs === null ? 'Chargement…' : `${convs.length} conversation${convs.length > 1 ? 's' : ''}`}
          </div>
        </div>
        <button onClick={loadConvs} className="tap-card" style={{
          background: 'rgba(255,250,240,0.12)', border: `1px solid ${M.cream}25`,
          color: M.cream, width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RefreshCw size={13} />
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left pane — conversations list */}
        <aside style={{
          width: active && messages !== null ? 'min(280px, 35vw)' : '100%',
          borderRight: `1px solid ${M.inkLight}25`,
          overflowY: 'auto',
          background: M.cream,
        }} className={active ? 'hidden md:block' : ''}>
          {convs === null && (
            <div style={{ padding: 40, textAlign: 'center', color: M.inkSoft }}>
              <Loader2 className="animate-spin" size={20} style={{ display: 'inline-block' }} />
            </div>
          )}
          {convs?.length === 0 && (
            <div style={{
              padding: 24, textAlign: 'center',
              color: M.inkSoft, fontSize: 13, lineHeight: 1.55,
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <strong>Aucune conversation</strong><br />
              <span style={{ fontSize: 11 }}>
                Va sur le <Link to="/influencers/feed" style={{ color: M.violetDeep }}>feed</Link> et contacte un talent pour démarrer.
              </span>
            </div>
          )}
          {convs?.map(c => {
            const isActive = c.id === active;
            return (
              <button key={c.id} onClick={() => setActive(c.id)} className="tap-card" style={{
                width: '100%', textAlign: 'left',
                background: isActive ? M.violetSoft : 'transparent',
                border: 'none',
                borderBottom: `1px solid ${M.inkLight}15`,
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex', gap: 10, alignItems: 'flex-start',
                fontFamily: 'inherit',
                color: M.ink,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
                  color: M.cream, fontWeight: 700, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {c.influencerDisplayName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                    <span className="m-display" style={{
                      fontSize: 13, fontWeight: 700, color: M.ink,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{c.influencerDisplayName || 'Créateur'}</span>
                    <span className="m-mono" style={{ fontSize: 9, color: M.inkLight, flexShrink: 0 }}>
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11.5, color: M.inkSoft, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.lastMessageFrom === 'créateure' ? '↪ ' : ''}{c.lastMessageText}
                  </div>
                </div>
                {c.unreadByBrand > 0 && (
                  <span className="m-pill" style={{
                    background: M.coralDeep, color: M.cream,
                    fontSize: 9, padding: '2px 6px',
                    flexShrink: 0, marginTop: 4,
                  }}>{c.unreadByBrand}</span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Right pane — thread */}
        {active && (
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#E5DDD5' }}>
            {/* Mobile back to list */}
            <div className="md:hidden" style={{
              padding: '8px 14px', background: M.violetDeep, color: M.cream,
              display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${M.inkLight}25`,
            }}>
              <button onClick={() => { setActive(null); setMessages(null); }} style={{
                background: 'rgba(255,250,240,0.12)', border: `1px solid ${M.cream}25`,
                color: M.cream, width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <ArrowLeft size={14} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {activeConv?.influencerDisplayName ?? 'Créateur'}
                </div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>via WhatsApp · Orlode Influenceurs</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 6px' }}>
              {messages === null ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Loader2 className="animate-spin" size={20} color={M.violetDeep} />
                </div>
              ) : (
                messages.map(m => {
                  const isMe = m.from === 'brand';
                  return (
                    <div key={m.id} style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 6,
                    }}>
                      <div style={{
                        background: isMe ? M.whatsappBubble : M.cream,
                        color: M.ink,
                        padding: '7px 10px 5px',
                        borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        maxWidth: '78%',
                        boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                        fontSize: 13.5, lineHeight: 1.4,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {m.text}
                        <div style={{
                          fontSize: 10, color: M.inkLight, textAlign: 'right', marginTop: 2,
                        }} className="m-mono">
                          {m.sentAt ? new Date(m.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '10px 12px 14px',
              background: '#F0F0F0',
              borderTop: `1px solid ${M.inkLight}25`,
            }}>
              {error && (
                <div style={{
                  fontSize: 11, color: '#991B1B',
                  background: '#FEE2E2', border: '1px solid #FCA5A5',
                  padding: 8, borderRadius: 10, marginBottom: 8,
                }}>⚠️ {error}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  placeholder="Réponds au créateur…"
                  rows={1}
                  style={{
                    flex: 1, background: M.cream,
                    border: `1px solid ${M.inkLight}30`, borderRadius: 16,
                    padding: '10px 14px', fontSize: 14,
                    fontFamily: 'inherit', resize: 'none',
                    outline: 'none',
                  }}
                />
                <button onClick={() => void send()} disabled={sending || !draft.trim()} className="tap-card" style={{
                  background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
                  color: M.cream, border: 'none',
                  width: 44, height: 44, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: sending ? 'wait' : 'pointer',
                  opacity: !draft.trim() ? 0.4 : 1,
                  boxShadow: `0 6px 14px -4px ${M.violet}`,
                }}>
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Desktop placeholder if no conv selected */}
        {!active && convs && convs.length > 0 && (
          <section className="hidden md:flex" style={{
            flex: 1, alignItems: 'center', justifyContent: 'center',
            background: M.creamWarm, color: M.inkSoft,
            flexDirection: 'column', gap: 10,
          }}>
            <MessageCircle size={40} color={M.inkLight} />
            <div style={{ fontSize: 13 }}>Sélectionne une conversation à gauche</div>
          </section>
        )}
      </div>
    </div>
  );
}
