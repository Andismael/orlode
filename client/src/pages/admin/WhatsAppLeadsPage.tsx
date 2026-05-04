/**
 * WhatsApp Leads — leads captured by the AI during human-handoff timeouts.
 *
 * The AI calls the captureWhatsAppLead tool when a customer gives their info
 * after the team didn't pick up the escalation. Each lead has phone, name,
 * need, urgency, status. This page lets a human triage them: filter, update
 * status, copy the phone for callback.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ArrowLeft, Phone, Copy, Filter, Search, Clock, AlertTriangle,
  Mail, MessageCircle, CheckCircle2, XCircle, RefreshCw, User,
  Sparkles, Inbox, ChevronDown,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#475467', inkLight: '#94A3A0',
  wa: '#25D366', waDeep: '#128C7E', waSoft: '#DCF8C6',
  ai: '#F59E0B', aiSoft: '#FEF3C7',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  red: '#EF4444', redSoft: '#FEE2E2',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  purple: '#6D28D9', purpleSoft: '#EDE9FE',
};

type LeadStatus = 'new' | 'contacted' | 'closed_won' | 'closed_lost';
type Urgency = 'low' | 'normal' | 'high' | 'urgent';

interface Lead {
  id: string;
  customerPhone: string;
  name?: string;
  need?: string;
  urgency?: Urgency;
  status: LeadStatus;
  source: string;
  notes?: string;
  createdAt?: { _seconds: number };
  firstContactedAt?: { _seconds: number };
  closedAt?: { _seconds: number };
  assigneeId?: string | null;
  assigneeName?: string | null;
  optedOut?: boolean;
  lastTemplateName?: string;
  lastTemplateSentAt?: { _seconds: number };
  lastProductRetailerId?: string;
  lastProductSentAt?: { _seconds: number };
  revenue?: number;
  source?: string;
  adCampaignId?: string;
  adReferral?: { headline?: string; body?: string; source_url?: string };
}

interface Template {
  name: string;
  status: string;
  language: string;
  components: Array<{ type: string; text?: string; format?: string }>;
}

const URGENCY_ORDER: Record<Urgency, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const STATUS_ORDER: Record<LeadStatus, number> = { new: 0, contacted: 1, closed_won: 2, closed_lost: 3 };

const STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new:         { label: 'Nouveau',    color: C.blue,         bg: C.blueSoft },
  contacted:   { label: 'Contacté',   color: C.ai,           bg: C.aiSoft },
  closed_won:  { label: 'Gagné',      color: C.emeraldDeep,  bg: C.emeraldSoft },
  closed_lost: { label: 'Perdu',      color: C.red,          bg: C.redSoft },
};

const URGENCY_META: Record<Urgency, { label: string; color: string }> = {
  low:    { label: 'Faible',  color: C.inkLight },
  normal: { label: 'Normale', color: C.blue },
  high:   { label: 'Haute',   color: C.ai },
  urgent: { label: 'Urgente', color: C.red },
};

function fmtRel(ts?: { _seconds: number }): string {
  if (!ts?._seconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - ts._seconds);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

function fmtDuration(ms: number | null): string {
  if (ms == null || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

export default function WhatsAppLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | 'all' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [stats, setStats] = useState<{ avgResponseTimeMs: number | null; contactedCount: number }>({ avgResponseTimeMs: null, contactedCount: 0 });
  const [me, setMe] = useState<{ uid: string; name: string } | null>(null);
  // Relance modal state — open when user clicks "Relancer via template" on a lead
  const [relanceLead, setRelanceLead] = useState<Lead | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [pickedTemplate, setPickedTemplate] = useState<Template | null>(null);
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [sendingRelance, setSendingRelance] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [leadsR, statsR, meR]: any[] = await Promise.all([
        api.get('/whatsapp/leads').catch(() => null),
        api.get('/whatsapp/handoff/stats').catch(() => null),
        api.get('/auth/verify-token').catch(() => null),
      ]);
      const list = Array.isArray(leadsR?.data) ? leadsR.data : (Array.isArray(leadsR?.data?.data) ? leadsR.data.data : []);
      setLeads(list);
      const s = statsR?.data ?? statsR?.data?.data;
      if (s && typeof s === 'object') setStats({
        avgResponseTimeMs: s.avgResponseTimeMs ?? null,
        contactedCount: s.contactedCount ?? 0,
      });
      const meData = meR?.data ?? meR?.data?.data;
      if (meData) setMe({ uid: meData.uid, name: meData.profile?.displayName ?? meData.email ?? '' });
    } catch {
      setLeads([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const assignToMe = async (id: string) => {
    setUpdating(id);
    try {
      const r: any = await api.post(`/whatsapp/leads/${id}/assign-me`);
      const newAssignee = r?.data ?? r?.data?.data;
      setLeads(prev => prev.map(l => l.id === id ? { ...l, assigneeId: newAssignee?.assigneeId ?? me?.uid, assigneeName: newAssignee?.assigneeName ?? me?.name } : l));
      toast.success('Assigné à toi');
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally { setUpdating(null); }
  };

  const unassign = async (id: string) => {
    setUpdating(id);
    try {
      await api.patch(`/whatsapp/leads/${id}`, { assigneeId: null });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, assigneeId: null, assigneeName: null } : l));
    } catch {
      toast.error('Échec');
    } finally { setUpdating(null); }
  };

  // Open the relance modal for a lead — fetch templates lazily on first open
  const openRelance = async (lead: Lead) => {
    if (lead.optedOut) {
      toast.error('Client désinscrit', "Ce client a répondu STOP — l'envoi est bloqué pour respecter le consentement.");
      return;
    }
    setRelanceLead(lead);
    setPickedTemplate(null);
    setBodyParams([]);
    if (templates.length === 0) {
      try {
        const r: any = await api.get('/whatsapp/templates');
        const list: Template[] = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
        setTemplates(list.filter(t => t.status === 'APPROVED'));
      } catch {
        toast.error('Impossible de charger les templates');
      }
    }
  };

  const pickTemplate = (t: Template) => {
    setPickedTemplate(t);
    const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
    const matches = body.match(/\{\{\d+\}\}/g) ?? [];
    const n = new Set(matches).size;
    // Pre-fill: {{1}} → name (or first word of phone), {{2}} → need
    const prefilled: string[] = [];
    for (let i = 0; i < n; i++) {
      if (i === 0) prefilled.push(relanceLead?.name ?? '');
      else if (i === 1) prefilled.push(relanceLead?.need ?? '');
      else prefilled.push('');
    }
    setBodyParams(prefilled);
  };

  const sendRelance = async () => {
    if (!relanceLead || !pickedTemplate) return;
    if (bodyParams.some(v => !v.trim())) {
      toast.error('Variables manquantes', 'Remplis toutes les {{N}}');
      return;
    }
    setSendingRelance(true);
    try {
      await api.post(`/whatsapp/leads/${relanceLead.id}/send-template`, {
        templateName: pickedTemplate.name,
        languageCode: pickedTemplate.language,
        bodyParams,
      });
      toast.success('Relance envoyée', `${pickedTemplate.name} → +${relanceLead.customerPhone}`);
      // Update lead locally — mark as contacted, store last template
      setLeads(prev => prev.map(l => l.id === relanceLead.id ? {
        ...l,
        status: l.status === 'new' ? 'contacted' : l.status,
        firstContactedAt: l.firstContactedAt ?? { _seconds: Math.floor(Date.now() / 1000) },
        lastTemplateName: pickedTemplate.name,
        lastTemplateSentAt: { _seconds: Math.floor(Date.now() / 1000) },
      } : l));
      setRelanceLead(null);
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally {
      setSendingRelance(false);
    }
  };

  const updateStatus = async (id: string, status: LeadStatus) => {
    // When marking as 'closed_won' (Gagné), prompt for revenue. Optional —
    // empty answer = save without revenue. This drives the revenue/template
    // attribution metric on the broadcast dashboard.
    let revenue: number | undefined;
    if (status === 'closed_won') {
      const raw = window.prompt('💰 Revenu généré par ce lead (€) ?\n\nLaisse vide si tu ne veux pas tracker le revenu.');
      if (raw === null) return; // cancelled
      const parsed = parseFloat(raw.replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) revenue = parsed;
    }
    setUpdating(id);
    try {
      const body: any = { status };
      if (revenue !== undefined) body.revenue = revenue;
      await api.patch(`/whatsapp/leads/${id}`, body);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status, ...(revenue !== undefined ? { revenue } : {}) } : l));
      toast.success('Statut mis à jour', revenue ? `${STATUS_META[status].label} · ${revenue}€ tracké` : STATUS_META[status].label);
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally { setUpdating(null); }
  };

  const saveNotes = async (id: string) => {
    setUpdating(id);
    try {
      await api.patch(`/whatsapp/leads/${id}`, { notes: notesDraft });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, notes: notesDraft } : l));
      setEditingNotes(null);
      toast.success('Note enregistrée');
    } catch {
      toast.error('Échec');
    } finally { setUpdating(null); }
  };

  const filtered = leads
    .filter(l => {
      if (filter === 'mine') {
        if (l.assigneeId !== me?.uid) return false;
      } else if (filter !== 'all') {
        if (l.status !== filter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay = `${l.customerPhone} ${l.name ?? ''} ${l.need ?? ''} ${l.assigneeName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    // Auto-sort: urgency first (urgent → low), then status (new → closed),
    // then most-recent first. Urgent unanswered leads bubble to the top.
    .sort((a, b) => {
      const ua = URGENCY_ORDER[a.urgency ?? 'normal'];
      const ub = URGENCY_ORDER[b.urgency ?? 'normal'];
      if (ua !== ub) return ua - ub;
      const sa = STATUS_ORDER[a.status];
      const sb = STATUS_ORDER[b.status];
      if (sa !== sb) return sa - sb;
      return (b.createdAt?._seconds ?? 0) - (a.createdAt?._seconds ?? 0);
    });

  const mineCount = leads.filter(l => l.assigneeId === me?.uid).length;
  const counts = {
    all: leads.length,
    mine: mineCount,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    closed_won: leads.filter(l => l.status === 'closed_won').length,
    closed_lost: leads.filter(l => l.status === 'closed_lost').length,
  };

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/admin/whatsapp" style={{ color: C.cream, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> WhatsApp
        </Link>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Leads <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.waSoft }}>WhatsApp</em>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', margin: '2px 0 0' }}>
            Capturés automatiquement par l'IA quand un client demande un humain mais personne n'a répondu à temps.
          </p>
        </div>
        <button onClick={load} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Rafraîchir
        </button>
      </div>

      {/* KPI strip — temps moyen de réponse */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.12)', borderRadius: 12, padding: '10px 14px' }}>
          <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.emeraldSoft, lineHeight: 1 }}>{fmtDuration(stats.avgResponseTimeMs)}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,250,240,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>
            Temps moyen de réponse
          </div>
        </div>
        <div style={{ background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.12)', borderRadius: 12, padding: '10px 14px' }}>
          <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.aiSoft, lineHeight: 1 }}>{stats.contactedCount}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,250,240,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>
            Leads contactés (7j)
          </div>
        </div>
        <div style={{ background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.12)', borderRadius: 12, padding: '10px 14px' }}>
          <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.cream, lineHeight: 1 }}>{mineCount}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,250,240,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>
            Assignés à moi
          </div>
        </div>
      </div>

      {/* Stats / filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { id: 'all',         label: 'Tous',          count: counts.all,         color: C.cream },
          { id: 'mine',        label: '👤 À moi',       count: counts.mine,        color: C.purple },
          { id: 'new',         label: 'Nouveau',       count: counts.new,         color: C.blue },
          { id: 'contacted',   label: 'Contacté',      count: counts.contacted,   color: C.ai },
          { id: 'closed_won',  label: 'Gagné',         count: counts.closed_won,  color: C.emeraldDeep },
          { id: 'closed_lost', label: 'Perdu',         count: counts.closed_lost, color: C.red },
        ] as const).map(f => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              style={{
                background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'rgba(255,250,240,0.06)',
                color: active ? (f.id === 'all' ? C.greenDeep : C.cream) : C.cream,
                padding: '8px 14px', borderRadius: 100,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: active ? 'none' : '1px solid rgba(255,250,240,0.12)',
                fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {f.label}
              <span className="mono-font" style={{
                background: active ? 'rgba(0,0,0,0.15)' : 'rgba(255,250,240,0.1)',
                padding: '1px 6px', borderRadius: 6, fontSize: 10,
              }}>{f.count}</span>
            </button>
          );
        })}
        <div style={{ flex: 1, minWidth: 180, marginLeft: 'auto' }}>
          <div style={{
            background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.12)',
            borderRadius: 100, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Search size={12} color="rgba(255,250,240,0.6)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer (numéro, nom, besoin)…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.cream, fontSize: 12, fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </div>

      {/* Empty / loading */}
      {loading && (
        <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkSoft }}>
          Chargement…
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)' }}>
          <Inbox size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
            {leads.length === 0 ? 'Aucun lead capturé' : 'Aucun lead avec ce filtre'}
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 12px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            {leads.length === 0
              ? "L'IA capture automatiquement les leads quand un client demande un humain via WhatsApp et que personne n'a répondu dans les 5 minutes. Apparaîtront ici dès le premier."
              : 'Essaie un autre filtre ou efface ta recherche.'}
          </p>
          {leads.length === 0 && (
            <Link to="/admin/whatsapp" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.purple, fontWeight: 600, textDecoration: 'none' }}>
              <Sparkles size={12} /> Vérifier la config Handoff
            </Link>
          )}
        </div>
      )}

      {/* Leads grid */}
      {/* Relance modal */}
      {relanceLead && (
        <div onClick={() => setRelanceLead(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.cream, borderRadius: 18,
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.wa}, ${C.waDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
                  Relancer {relanceLead.name || relanceLead.customerPhone}
                </h3>
                <div className="mono-font" style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
                  +{relanceLead.customerPhone}
                </div>
              </div>
              <button onClick={() => setRelanceLead(null)} className="icon-btn ghost"><XCircle size={16} /></button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Template picker */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                  Template approuvé
                </label>
                {templates.length === 0 ? (
                  <div style={{ padding: 12, background: C.creamDeep, borderRadius: 10, fontSize: 12, color: C.inkSoft, textAlign: 'center' }}>
                    Aucun template approuvé. <Link to="/admin/whatsapp/templates" style={{ color: C.purple, fontWeight: 600 }}>Créer ou refresh →</Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {templates.map(t => {
                      const active = pickedTemplate?.name === t.name;
                      const body = t.components.find(c => c.type === 'BODY')?.text ?? '';
                      return (
                        <button
                          key={t.name + t.language}
                          onClick={() => pickTemplate(t)}
                          style={{
                            background: active ? C.purpleSoft : C.creamDeep,
                            border: active ? `1.5px solid ${C.purple}` : '1.5px solid transparent',
                            borderRadius: 10, padding: '8px 12px',
                            cursor: 'pointer', textAlign: 'left',
                            fontFamily: 'inherit',
                            display: 'flex', flexDirection: 'column', gap: 2,
                          }}
                        >
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

              {/* Body params */}
              {pickedTemplate && bodyParams.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                    Variables (pré-remplies depuis le lead)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {bodyParams.map((v, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.purple, minWidth: 40 }}>{`{{${i + 1}}}`}</span>
                        <input
                          value={v}
                          onChange={(e: any) => {
                            const next = [...bodyParams]; next[i] = e.target.value; setBodyParams(next);
                          }}
                          placeholder={i === 0 ? 'Nom' : i === 1 ? 'Besoin' : `Variable ${i + 1}`}
                          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid rgba(10,42,32,0.1)', background: C.creamDeep, fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {pickedTemplate && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
                    Aperçu
                  </label>
                  <div style={{ background: C.waSoft, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.ink, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {(pickedTemplate.components.find(c => c.type === 'BODY')?.text ?? '').replace(/\{\{(\d+)\}\}/g, (m, n) => bodyParams[parseInt(n, 10) - 1] || m)}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(10,42,32,0.06)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setRelanceLead(null)} className="btn-secondary" disabled={sendingRelance}>Annuler</button>
              <button onClick={sendRelance} disabled={!pickedTemplate || sendingRelance} className="btn-primary">
                <Sparkles size={14} /> {sendingRelance ? 'Envoi…' : 'Envoyer la relance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(lead => {
            const sm = STATUS_META[lead.status];
            const um = lead.urgency ? URGENCY_META[lead.urgency] : null;
            const isUpdating = updating === lead.id;
            const isEditing = editingNotes === lead.id;
            return (
              <div key={lead.id} style={{
                background: C.cream, borderRadius: 14,
                border: `1.5px solid ${sm.color}25`,
                borderLeft: `5px solid ${sm.color}`,
                padding: 16,
                display: 'flex', flexDirection: 'column', gap: 12,
                opacity: isUpdating ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `linear-gradient(135deg, ${C.wa}, ${C.waDeep})`,
                    color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <User size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                        {lead.name || 'Inconnu'}
                      </span>
                      <span className="pill" style={{ background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700 }}>
                        {sm.label}
                      </span>
                      {um && (
                        <span style={{ fontSize: 11, color: um.color, fontWeight: 600 }}>
                          ⚡ {um.label}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span className="mono-font" style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
                        +{lead.customerPhone}
                      </span>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(`+${lead.customerPhone}`); toast.success('Numéro copié'); }}
                        className="icon-btn ghost"
                        style={{ width: 24, height: 24, padding: 0, display: 'inline-flex' }}
                        title="Copier le numéro"
                      >
                        <Copy size={11} />
                      </button>
                      <a
                        href={`https://wa.me/${lead.customerPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: C.wa, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <MessageCircle size={11} /> Ouvrir WhatsApp
                      </a>
                      <span style={{ fontSize: 11, color: C.inkLight, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {fmtRel(lead.createdAt)}
                      </span>
                    </div>

                    {/* Response time + assignee row */}
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                      {lead.firstContactedAt ? (
                        <span style={{ color: C.emeraldDeep, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={11} /> Contacté en {fmtDuration(((lead.firstContactedAt._seconds ?? 0) - (lead.createdAt?._seconds ?? 0)) * 1000)}
                        </span>
                      ) : (
                        <span style={{ color: C.red, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={11} /> Pas encore contacté
                        </span>
                      )}
                      {lead.assigneeId ? (
                        <span style={{ color: C.purple, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          👤 {lead.assigneeName ?? 'Assigné'}
                          {lead.assigneeId === me?.uid && (
                            <button
                              onClick={() => unassign(lead.id)}
                              disabled={isUpdating}
                              style={{ marginLeft: 4, background: 'transparent', border: 'none', color: C.inkLight, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
                              title="Me retirer"
                            >
                              retirer
                            </button>
                          )}
                        </span>
                      ) : (
                        <button
                          onClick={() => assignToMe(lead.id)}
                          disabled={isUpdating}
                          style={{
                            background: C.purpleSoft, color: C.purple, border: 'none',
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                          title="M'assigner ce lead"
                        >
                          + Prendre en charge
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {lead.need && (
                  <div style={{
                    background: C.creamDeep, borderRadius: 10, padding: '10px 12px',
                    fontSize: 13, color: C.ink, lineHeight: 1.55, fontStyle: 'italic',
                    borderLeft: `3px solid ${sm.color}80`,
                  }}>
                    « {lead.need} »
                  </div>
                )}

                {/* Notes */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Notes internes
                    </span>
                    {!isEditing && (
                      <button
                        onClick={() => { setEditingNotes(lead.id); setNotesDraft(lead.notes ?? ''); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, color: C.purple, fontWeight: 600, fontFamily: 'inherit' }}
                      >
                        {lead.notes ? 'Modifier' : '+ Ajouter'}
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <>
                      <textarea
                        value={notesDraft}
                        onChange={e => setNotesDraft(e.target.value)}
                        rows={2}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${C.purple}40`, background: C.creamDeep, fontSize: 12, color: C.ink, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                        placeholder="Ex: appelé à 14h, indispo, à recontacter mardi"
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <button onClick={() => setEditingNotes(null)} className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }}>Annuler</button>
                        <button onClick={() => saveNotes(lead.id)} disabled={isUpdating} className="btn-primary" style={{ padding: '5px 10px', fontSize: 11 }}>
                          Enregistrer
                        </button>
                      </div>
                    </>
                  ) : lead.notes ? (
                    <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>{lead.notes}</div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.inkLight, fontStyle: 'italic' }}>Aucune note</div>
                  )}
                </div>

                {/* Opt-out warning */}
                {lead.optedOut && (
                  <div style={{
                    background: C.redSoft, color: C.red,
                    padding: '6px 10px', borderRadius: 8,
                    fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    🚫 Désinscrit (STOP) — relance bloquée
                  </div>
                )}
                {lead.lastTemplateName && (
                  <div style={{ fontSize: 11, color: C.inkSoft }}>
                    📤 Dernière relance : <strong className="mono-font">{lead.lastTemplateName}</strong> · {fmtRel(lead.lastTemplateSentAt)}
                  </div>
                )}
                {lead.lastProductRetailerId && (
                  <div style={{ fontSize: 11, color: C.inkSoft }}>
                    🛒 Dernier produit envoyé : <strong className="mono-font">{lead.lastProductRetailerId}</strong> · {fmtRel(lead.lastProductSentAt)}
                  </div>
                )}
                {lead.source === 'meta_ad' && (
                  <div style={{
                    background: '#DCE7F8', color: '#0866FF',
                    padding: '6px 10px', borderRadius: 8,
                    fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    alignSelf: 'flex-start',
                  }}>
                    📢 Vient d'une <strong>pub Meta</strong>
                    {lead.adReferral?.headline && <> — « {lead.adReferral.headline.slice(0, 50)} »</>}
                  </div>
                )}

                {/* Status actions + Relance */}
                <div style={{
                  display: 'flex', gap: 6, flexWrap: 'wrap',
                  paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)',
                }}>
                  {(['new', 'contacted', 'closed_won', 'closed_lost'] as LeadStatus[]).map(s => {
                    const active = lead.status === s;
                    const m = STATUS_META[s];
                    return (
                      <button
                        key={s}
                        onClick={() => !active && updateStatus(lead.id, s)}
                        disabled={isUpdating || active}
                        style={{
                          background: active ? m.color : 'transparent',
                          color: active ? C.cream : m.color,
                          border: `1.5px solid ${m.color}${active ? 'ff' : '40'}`,
                          padding: '5px 11px', borderRadius: 8,
                          fontSize: 11, fontWeight: 700, cursor: active ? 'default' : 'pointer',
                          fontFamily: 'inherit',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          opacity: active ? 1 : 0.85,
                        }}
                      >
                        {s === 'closed_won' && <CheckCircle2 size={11} />}
                        {s === 'closed_lost' && <XCircle size={11} />}
                        {m.label}
                      </button>
                    );
                  })}
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => openRelance(lead)}
                    disabled={isUpdating || lead.optedOut}
                    style={{
                      background: lead.optedOut ? C.creamDeep : `linear-gradient(135deg, ${C.wa}, ${C.waDeep})`,
                      color: lead.optedOut ? C.inkLight : C.cream,
                      border: 'none', padding: '5px 11px', borderRadius: 8,
                      fontSize: 11, fontWeight: 700,
                      cursor: lead.optedOut ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      opacity: lead.optedOut ? 0.5 : 1,
                    }}
                  >
                    <Sparkles size={11} /> Relancer via template
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
