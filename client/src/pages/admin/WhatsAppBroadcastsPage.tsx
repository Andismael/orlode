/**
 * WhatsApp Broadcasts — send a Meta template to a filtered audience of leads.
 *
 * Wizard: pick template → filter audience → preview count → send.
 * Shows recent broadcasts with sent/failed/skipped counts. Polls the active
 * broadcast every 3s while it's running.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ArrowLeft, Send, Sparkles, Users2, RefreshCw, X, CheckCircle2, AlertTriangle,
  Filter, Calendar, ExternalLink, Megaphone,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#475467', inkLight: '#94A3A0',
  wa: '#25D366', waDeep: '#128C7E', waSoft: '#DCF8C6',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  red: '#EF4444', redSoft: '#FEE2E2',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  ai: '#F59E0B', aiSoft: '#FEF3C7',
  purple: '#6D28D9', purpleSoft: '#EDE9FE',
};

interface Template {
  name: string;
  status: string;
  language: string;
  components: Array<{ type: string; text?: string }>;
}

interface Broadcast {
  id: string;
  name: string;
  templateName: string;
  languageCode: string;
  status: 'sending' | 'sent' | 'failed';
  totalRecipients: number;
  willSend: number;
  skippedOptedOut: number;
  sentCount: number;
  failedCount: number;
  repliedCount?: number;
  wonCount?: number;
  revenueTotal?: number;
  filter?: { status?: string; urgency?: string; sinceDays?: number };
  createdAt?: { _seconds: number };
  completedAt?: { _seconds: number };
}

interface Segment {
  id: string;
  name: string;
  description?: string | null;
  filter: { status?: string; urgency?: string; sinceDays?: number };
  createdAt?: { _seconds: number };
}

function fmtRel(ts?: { _seconds: number }): string {
  if (!ts?._seconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - ts._seconds);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function WhatsAppBroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [seedFilter, setSeedFilter] = useState<Segment['filter'] | null>(null); // pre-fills wizard from a segment

  const load = async () => {
    setLoading(true);
    try {
      const [bR, sR]: any[] = await Promise.all([
        api.get('/whatsapp/broadcasts'),
        api.get('/whatsapp/segments').catch(() => null),
      ]);
      const list: Broadcast[] = Array.isArray(bR?.data) ? bR.data : (Array.isArray(bR?.data?.data) ? bR.data.data : []);
      setBroadcasts(list);
      const segs: Segment[] = Array.isArray(sR?.data) ? sR.data : (Array.isArray(sR?.data?.data) ? sR.data.data : []);
      setSegments(segs);
    } catch {
      setBroadcasts([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const launchFromSegment = (seg: Segment) => {
    setSeedFilter(seg.filter);
    setShowNew(true);
  };

  const deleteSegment = async (id: string) => {
    if (!confirm('Supprimer ce segment ?')) return;
    try {
      await api.delete(`/whatsapp/segments/${id}`);
      setSegments(prev => prev.filter(s => s.id !== id));
      toast.success('Segment supprimé');
    } catch {
      toast.error('Échec');
    }
  };

  // Auto-poll while a broadcast is sending
  useEffect(() => {
    const isSending = broadcasts.some(b => b.status === 'sending');
    if (!isSending) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [broadcasts]);

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/admin/whatsapp" style={{ color: C.cream, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> WhatsApp
        </Link>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Broadcasts <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.waSoft }}>WhatsApp</em>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', margin: '2px 0 0' }}>
            Diffusion d'un template à une audience segmentée. Les opt-outs sont automatiquement exclus.
          </p>
        </div>
        <button onClick={load} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <RefreshCw size={13} /> Rafraîchir
        </button>
        <button onClick={() => setShowNew(true)} className="btn-primary" style={{ padding: '9px 16px', fontSize: 13 }}>
          <Megaphone size={13} /> Nouveau broadcast
        </button>
      </div>

      {/* List */}
      {loading && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkSoft }}>
          Chargement…
        </div>
      )}
      {!loading && broadcasts.length === 0 && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)' }}>
          <Megaphone size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            Aucun broadcast pour l'instant
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 14px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            Lance ton premier broadcast — segmente tes leads (statut, urgence, date) puis envoie un template approuvé en 1 click.
          </p>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Megaphone size={14} /> Lancer mon premier broadcast
          </button>
        </div>
      )}

      {/* Saved segments */}
      {segments.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,250,240,0.8)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            🎯 Mes segments — 1 click pour lancer
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {segments.map(seg => (
              <div key={seg.id} style={{
                background: C.cream, borderRadius: 12,
                padding: 12,
                border: `1.5px solid ${C.purple}30`,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                    🎯 {seg.name}
                  </span>
                  <button onClick={() => deleteSegment(seg.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkLight, fontSize: 11, fontFamily: 'inherit' }}>
                    ✕
                  </button>
                </div>
                {seg.description && (
                  <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.4 }}>{seg.description}</div>
                )}
                <div style={{ fontSize: 11, color: C.inkLight }}>
                  {[seg.filter.status && seg.filter.status !== 'all' ? seg.filter.status : null,
                    seg.filter.urgency && seg.filter.urgency !== 'all' ? `urgence: ${seg.filter.urgency}` : null,
                    seg.filter.sinceDays ? `${seg.filter.sinceDays}j` : null,
                  ].filter(Boolean).join(' · ') || 'Tous'}
                </div>
                <button onClick={() => launchFromSegment(seg)} className="btn-primary" style={{ padding: '5px 10px', fontSize: 11, marginTop: 4 }}>
                  <Send size={11} /> Lancer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && broadcasts.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {broadcasts.map(b => <BroadcastCard key={b.id} broadcast={b} />)}
        </div>
      )}

      {/* New broadcast modal */}
      {showNew && (
        <NewBroadcastModal
          onClose={() => { setShowNew(false); setSeedFilter(null); }}
          onCreated={() => { setShowNew(false); setSeedFilter(null); load(); }}
          seedFilter={seedFilter}
        />
      )}
    </div>
  );
}

function BroadcastCard({ broadcast: b }: { broadcast: Broadcast }) {
  const isSending = b.status === 'sending';
  const isFailed = b.status === 'failed';
  const total = b.willSend ?? 0;
  const progress = total > 0 ? Math.round((b.sentCount / total) * 100) : 0;
  const filter = [
    b.filter?.status && b.filter.status !== 'all' ? b.filter.status : null,
    b.filter?.urgency && b.filter.urgency !== 'all' ? `urgence: ${b.filter.urgency}` : null,
    b.filter?.sinceDays ? `${b.filter.sinceDays}j max` : null,
  ].filter(Boolean).join(' · ') || 'Tous les leads';

  return (
    <div style={{
      background: C.cream, borderRadius: 14,
      borderLeft: `5px solid ${isFailed ? C.red : isSending ? C.ai : C.emeraldDeep}`,
      border: `1.5px solid ${isFailed ? C.redSoft : isSending ? C.aiSoft : C.emeraldSoft}`,
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `linear-gradient(135deg, ${C.wa}, ${C.waDeep})`,
          color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Megaphone size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
              {b.name}
            </span>
            {isSending && <span className="pill" style={{ background: C.aiSoft, color: C.ai, fontSize: 10, fontWeight: 700 }}>⏳ Envoi en cours</span>}
            {b.status === 'sent' && <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep, fontSize: 10, fontWeight: 700 }}>✅ Terminé</span>}
            {isFailed && <span className="pill" style={{ background: C.redSoft, color: C.red, fontSize: 10, fontWeight: 700 }}>❌ Échec</span>}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11, color: C.inkSoft }}>
            <span className="mono-font" style={{ color: C.purpleDeep ?? C.purple, fontWeight: 600 }}>{b.templateName} · {b.languageCode}</span>
            <span>· {filter}</span>
            <span style={{ marginLeft: 'auto' }}>{fmtRel(b.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>
          <span><strong style={{ color: C.ink }}>{b.sentCount}</strong> / {total} envoyés{b.failedCount > 0 ? <> · <span style={{ color: C.red }}>{b.failedCount} échecs</span></> : null}{b.skippedOptedOut > 0 ? <> · <span style={{ color: C.inkLight }}>{b.skippedOptedOut} opt-outs ignorés</span></> : null}</span>
          <span className="mono-font" style={{ fontWeight: 700 }}>{progress}%</span>
        </div>
        <div style={{ height: 6, background: C.creamDeep, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: isFailed ? C.red : `linear-gradient(135deg, ${C.wa}, ${C.waDeep})`, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Conversion KPIs — reply rate + win rate (+ revenue if any) */}
      {(b.sentCount > 0) && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${(b.revenueTotal ?? 0) > 0 ? 4 : 3}, 1fr)`, gap: 8,
          paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)',
        }}>
          {(() => {
            const replied = b.repliedCount ?? 0;
            const won = b.wonCount ?? 0;
            const replyRate = b.sentCount > 0 ? Math.round((replied / b.sentCount) * 100) : 0;
            const winRate = b.sentCount > 0 ? Math.round((won / b.sentCount) * 100) : 0;
            const revenue = b.revenueTotal ?? 0;
            const items = [
              { label: '📤 Envoyés', value: String(b.sentCount), color: C.blue, accent: '' },
              { label: '💬 Réponses', value: String(replied), color: C.ai, accent: ` (${replyRate}%)` },
              { label: '🏆 Convertis', value: String(won), color: C.emeraldDeep, accent: ` (${winRate}%)` },
            ];
            if (revenue > 0) {
              items.push({ label: '💰 Revenu', value: `${revenue.toLocaleString('fr-FR')}€`, color: C.purple, accent: '' });
            }
            return items.map((k, i) => (
              <div key={i} style={{ background: C.creamDeep, borderRadius: 8, padding: '8px 10px' }}>
                <div className="display-font mono-font" style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>
                  {k.value}<span style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft }}>{k.accent}</span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 3 }}>
                  {k.label}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

interface NewBroadcastModalProps {
  onClose: () => void;
  onCreated: () => void;
  seedFilter?: { status?: string; urgency?: string; sinceDays?: number } | null;
}

function NewBroadcastModal({ onClose, onCreated, seedFilter }: NewBroadcastModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState('');
  const [pickedTemplate, setPickedTemplate] = useState<Template | null>(null);
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [prefillFromLead, setPrefillFromLead] = useState(true);
  const [filter, setFilter] = useState<{ status: string; urgency: string; sinceDays: number }>({
    status: seedFilter?.status ?? 'new',
    urgency: seedFilter?.urgency ?? 'all',
    sinceDays: seedFilter?.sinceDays ?? 30,
  });
  const [preview, setPreview] = useState<{ total: number; optedOutCount: number; willSend: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  // Save-segment state
  const [saveAsSegment, setSaveAsSegment] = useState(false);
  const [segmentName, setSegmentName] = useState('');

  useEffect(() => {
    api.get('/whatsapp/templates').then((r: any) => {
      const list: Template[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
      setTemplates(list.filter(t => t.status === 'APPROVED'));
    }).catch(() => setTemplates([]));
  }, []);

  const placeholdersCount = useMemo(() => {
    if (!pickedTemplate) return 0;
    const body = pickedTemplate.components.find(c => c.type === 'BODY')?.text ?? '';
    const matches = body.match(/\{\{\d+\}\}/g) ?? [];
    return new Set(matches).size;
  }, [pickedTemplate]);

  const pickTemplate = (t: Template) => {
    setPickedTemplate(t);
    const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
    const matches = body.match(/\{\{\d+\}\}/g) ?? [];
    const n = new Set(matches).size;
    setBodyParams(new Array(n).fill(''));
    if (!name) setName(`${t.name} — ${new Date().toLocaleDateString('fr-FR')}`);
  };

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const r: any = await api.post('/whatsapp/broadcasts/preview', { filter });
      const d = r?.data ?? r?.data?.data;
      setPreview(d);
      setStep(3);
    } catch (e: any) {
      toast.error('Impossible de prévisualiser', e?.response?.data?.message ?? '');
    } finally { setPreviewing(false); }
  };

  const send = async () => {
    if (!pickedTemplate) return;
    setSending(true);
    try {
      // Save segment first (best-effort, non-blocking on failure)
      if (saveAsSegment && segmentName.trim()) {
        await api.post('/whatsapp/segments', { name: segmentName.trim(), filter }).catch(() => null);
      }
      await api.post('/whatsapp/broadcasts', {
        name: name || `${pickedTemplate.name} — ${new Date().toLocaleDateString('fr-FR')}`,
        templateName: pickedTemplate.name,
        languageCode: pickedTemplate.language,
        bodyParams,
        prefillFromLead,
        filter,
      });
      toast.success('Broadcast lancé', `${preview?.willSend ?? 0} destinataires en cours d'envoi`);
      onCreated();
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally { setSending(false); }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 18,
        width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.wa}, ${C.waDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
              Nouveau broadcast
            </h3>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
              Étape {step} / 3 · {step === 1 ? 'Choix du template' : step === 2 ? 'Audience' : 'Confirmation'}
            </div>
          </div>
          <button onClick={onClose} className="icon-btn ghost"><X size={16} /></button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Step 1 — pick template */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                  Nom du broadcast (interne)
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="ex: Promo Black Friday — clients chauds"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                  Template approuvé
                </label>
                {templates.length === 0 ? (
                  <div style={{ padding: 14, background: C.creamDeep, borderRadius: 10, fontSize: 12, color: C.inkSoft, textAlign: 'center' }}>
                    Aucun template approuvé. <Link to="/admin/whatsapp/templates" style={{ color: C.purple, fontWeight: 600 }}>Gérer →</Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                    {templates.map(t => {
                      const active = pickedTemplate?.name === t.name && pickedTemplate?.language === t.language;
                      const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
                      return (
                        <button key={t.name + t.language} onClick={() => pickTemplate(t)} style={{
                          background: active ? C.purpleSoft : C.creamDeep,
                          border: active ? `1.5px solid ${C.purple}` : '1.5px solid transparent',
                          borderRadius: 10, padding: '10px 12px',
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          display: 'flex', flexDirection: 'column', gap: 3,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{t.name}</span>
                            <span style={{ fontSize: 10, color: C.inkLight }}>· {t.language}</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {body}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Body params + prefill toggle */}
              {pickedTemplate && placeholdersCount > 0 && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                    Variables ({placeholdersCount})
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: C.aiSoft, borderRadius: 10, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      id="prefill"
                      checked={prefillFromLead}
                      onChange={e => setPrefillFromLead(e.target.checked)}
                    />
                    <label htmlFor="prefill" style={{ fontSize: 12, color: C.ink, cursor: 'pointer' }}>
                      <strong>Pré-remplir par lead</strong> : {`{{1}}`} = nom du lead, {`{{2}}`} = besoin du lead. Les valeurs ci-dessous servent de fallback si le lead n'a pas l'info.
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {bodyParams.map((v, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.purple, minWidth: 40 }}>{`{{${i + 1}}}`}</span>
                        <input
                          value={v}
                          onChange={e => { const next = [...bodyParams]; next[i] = e.target.value; setBodyParams(next); }}
                          placeholder={prefillFromLead && i === 0 ? 'Fallback nom (si vide)' : prefillFromLead && i === 1 ? 'Fallback besoin (si vide)' : `Variable ${i + 1}`}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(10,42,32,0.1)', background: C.creamDeep, fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
                <button onClick={onClose} className="btn-secondary">Annuler</button>
                <button onClick={() => setStep(2)} disabled={!pickedTemplate || !name.trim()} className="btn-primary">
                  Suivant — Audience
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — audience */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                  Statut des leads
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    { id: 'all',         label: 'Tous' },
                    { id: 'new',         label: 'Nouveaux' },
                    { id: 'contacted',   label: 'Déjà contactés' },
                    { id: 'closed_won',  label: 'Gagnés' },
                    { id: 'closed_lost', label: 'Perdus' },
                  ] as const).map(s => {
                    const active = filter.status === s.id;
                    return (
                      <button key={s.id} onClick={() => setFilter({ ...filter, status: s.id })} style={{
                        background: active ? `linear-gradient(135deg, ${C.wa}, ${C.waDeep})` : C.creamDeep,
                        color: active ? C.cream : C.ink,
                        border: active ? 'none' : '1px solid rgba(10,42,32,0.1)',
                        padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                  Urgence
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['all', 'urgent', 'high', 'normal', 'low'] as const).map(u => {
                    const active = filter.urgency === u;
                    return (
                      <button key={u} onClick={() => setFilter({ ...filter, urgency: u })} style={{
                        background: active ? C.ai : C.creamDeep, color: active ? C.cream : C.ink,
                        border: active ? 'none' : '1px solid rgba(10,42,32,0.1)',
                        padding: '7px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                      }}>
                        {u}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                  Période — leads créés dans les
                </label>
                <input
                  type="number" min={1} max={365}
                  value={filter.sinceDays}
                  onChange={e => setFilter({ ...filter, sinceDays: parseInt(e.target.value, 10) || 30 })}
                  style={{ width: 120, padding: '8px 12px', borderRadius: 8, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
                <span style={{ marginLeft: 8, fontSize: 12, color: C.inkSoft }}>derniers jours</span>
              </div>

              {/* Save as segment */}
              <div style={{ background: C.purpleSoft, borderRadius: 10, padding: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink, fontWeight: 600 }}>
                  <input type="checkbox" checked={saveAsSegment} onChange={e => setSaveAsSegment(e.target.checked)} />
                  🎯 Sauvegarder comme segment réutilisable
                </label>
                {saveAsSegment && (
                  <input
                    value={segmentName}
                    onChange={e => setSegmentName(e.target.value)}
                    placeholder="Nom du segment — ex: clients chauds, leads urgents 7j…"
                    style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, background: C.cream, border: `1.5px solid ${C.purple}40`, fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 8 }}>
                <button onClick={() => setStep(1)} className="btn-secondary">← Retour</button>
                <button onClick={runPreview} disabled={previewing} className="btn-primary">
                  {previewing ? 'Calcul…' : 'Calculer l\'audience →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — confirm */}
          {step === 3 && preview && pickedTemplate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: C.creamDeep, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.inkSoft }}>Template</span>
                  <span className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{pickedTemplate.name} · {pickedTemplate.language}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.inkSoft }}>Total leads matchés</span>
                  <span className="mono-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{preview.total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.red }}>🚫 Opt-outs ignorés</span>
                  <span className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.red }}>−{preview.optedOutCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(10,42,32,0.1)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.emeraldDeep }}>✅ À envoyer</span>
                  <span className="mono-font" style={{ fontSize: 18, fontWeight: 800, color: C.emeraldDeep }}>{preview.willSend}</span>
                </div>
              </div>

              {preview.willSend === 0 && (
                <div style={{ background: C.aiSoft, padding: 12, borderRadius: 10, fontSize: 12, color: C.ai, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <AlertTriangle size={14} /> Aucun destinataire avec ce filtre. Élargis l'audience.
                </div>
              )}

              <div style={{ fontSize: 11, color: C.inkSoft }}>
                ⏱ Le broadcast s'envoie à ~4 messages/seconde. {preview.willSend} envois ≈ {Math.ceil(preview.willSend / 4)}s.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button onClick={() => setStep(2)} className="btn-secondary">← Modifier l'audience</button>
                <button onClick={send} disabled={sending || preview.willSend === 0} className="btn-primary">
                  <Send size={14} /> {sending ? 'Lancement…' : `Envoyer à ${preview.willSend}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
