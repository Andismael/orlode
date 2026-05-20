/**
 * Sales Leads Page — Premium edition (green/orange palette + Fraunces)
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Flame, Snowflake, Thermometer, Trash2, X, Eye, Mail,
  Filter, ArrowLeft, AlertTriangle, Zap, LayoutGrid, List, Phone,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import SalesNav from './_SalesNav';

interface Lead {
  id: string; name: string; email: string; phone: string; company: string;
  score: number; stage: string; source: string; estimatedValue: number;
  notes: string; owner: string; createdAt: string;
  interactions?: { date: string }[];
}

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E', greenMid: '#0F6B52',
  greenSoft: '#E8F5EE', cream: '#FFFAF0',
  orange: '#FF6B1A', orangeDeep: '#E5530C', orangeSoft: '#FFE8D6',
  yellow: '#FFB347', yellowSoft: '#FFF4E0',
  red: '#FF3D00', redSoft: '#FFE0DA',
  blue: '#3B82F6', blueSoft: '#DBEAFE',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  ink: '#0A2A20', inkSoft: '#5A6B62',
};

const STAGES = ['nouveau', 'contacte', 'interesse', 'devis_envoye', 'negociation', 'gagne', 'perdu'];
const SOURCES = ['website', 'referral', 'linkedin', 'whatsapp', 'cold_call', 'event', 'ads', 'other'];
const STAGE_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', contacte: 'Contacté', interesse: 'Intéressé',
  devis_envoye: 'Devis envoyé', negociation: 'Négociation', gagne: 'Gagné', perdu: 'Perdu',
};
const STAGE_PILL: Record<string, { bg: string; color: string }> = {
  nouveau: { bg: C.blueSoft, color: C.blue },
  contacte: { bg: C.purpleSoft, color: C.purple },
  interesse: { bg: C.yellowSoft, color: '#A87800' },
  devis_envoye: { bg: C.orangeSoft, color: C.orangeDeep },
  negociation: { bg: C.redSoft, color: C.red },
  gagne: { bg: C.greenSoft, color: C.greenDeep },
  perdu: { bg: '#E8E5DD', color: C.inkSoft },
};

const heatStyle = (score: number) => {
  if (score >= 80) return { bg: C.redSoft, color: C.red, icon: Flame, label: 'Très chaud' };
  if (score >= 60) return { bg: C.orangeSoft, color: C.orangeDeep, icon: Flame, label: 'Chaud' };
  if (score >= 40) return { bg: C.yellowSoft, color: '#A87800', icon: Thermometer, label: 'Tiède' };
  return { bg: C.blueSoft, color: C.blue, icon: Snowflake, label: 'Froid' };
};

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || 'L';
const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

export default function SalesLeadsPage() {
  const { symbol } = useCurrency();
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showHotOnly, setShowHotOnly] = useState(searchParams.get('hot') === 'true');
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', source: 'other', estimatedValue: 0, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (localStorage.getItem('sales-leads-view') as 'list' | 'grid') ?? 'list');
  useEffect(() => { localStorage.setItem('sales-leads-view', viewMode); }, [viewMode]);

  const load = () => {
    setLoading(true);
    api.get<Lead[]>('/sales/leads')
      .then(r => {
        const d = r.data as unknown;
        const arr = Array.isArray(d) ? d : (d as { leads?: Lead[] })?.leads ?? [];
        setLeads(arr);
      })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name) return;
    setSubmitting(true);
    try {
      const stageParam = searchParams.get('stage');
      await api.post('/sales/leads', stageParam ? { ...form, stage: stageParam } : form);
      setShowCreate(false);
      setForm({ name: '', email: '', phone: '', company: '', source: 'other', estimatedValue: 0, notes: '' });
      load();
    } catch {} finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce lead ?')) return;
    await api.delete(`/sales/leads/${id}`).catch(() => {});
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  let filtered = leads;
  if (search) filtered = filtered.filter(l => `${l.name} ${l.email} ${l.company}`.toLowerCase().includes(search.toLowerCase()));
  if (stageFilter) filtered = filtered.filter(l => l.stage === stageFilter);
  if (sourceFilter) filtered = filtered.filter(l => l.source === sourceFilter);
  if (showHotOnly) filtered = filtered.filter(l => l.score >= 70);

  const hotCount = leads.filter(l => l.score >= 70).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
        .lp-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,sans-serif;padding:32px}
        .lp-display{font-family:'Fraunces',serif;font-optical-sizing:auto;letter-spacing:-.02em}
        .lp-mono{font-family:'JetBrains Mono',monospace}

        .lp-hero{background:linear-gradient(135deg,${C.orange} 0%,${C.orangeDeep} 100%);border-radius:24px;padding:32px 36px;position:relative;overflow:hidden;color:${C.cream};box-shadow:0 30px 60px -20px rgba(255,107,26,.4)}
        .lp-grain::before{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");opacity:.06;pointer-events:none;mix-blend-mode:overlay;border-radius:inherit}

        .lp-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600;letter-spacing:.02em}
        .lp-livedot{width:8px;height:8px;border-radius:50%;background:${C.orange};position:relative;flex-shrink:0}
        .lp-livedot::after{content:'';position:absolute;inset:-4px;border-radius:50%;background:${C.orange};opacity:.4;animation:lpPulse 2s ease-in-out infinite}
        @keyframes lpPulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.6);opacity:0}}

        .lp-btn-primary{background:${C.orange};color:${C.cream};border:none;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all .2s;box-shadow:0 8px 24px -8px rgba(255,107,26,.5);font-family:inherit}
        .lp-btn-primary:hover{background:${C.orangeDeep};transform:translateY(-2px)}
        .lp-btn-secondary{background:${C.cream};color:${C.greenDeep};border:1px solid rgba(10,42,32,.1);padding:11px 18px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:all .2s;font-family:inherit}
        .lp-btn-secondary:hover{background:${C.greenDeep};color:${C.cream};border-color:${C.greenDeep}}
        .lp-btn-hero{background:rgba(255,250,240,.15);border:1px solid rgba(255,250,240,.25);color:${C.cream};padding:11px 18px;border-radius:12px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-family:inherit}
        .lp-btn-hero:hover{background:rgba(255,250,240,.25)}

        .lp-row{background:${C.cream};border-radius:16px;padding:18px 20px;border:1px solid rgba(10,42,32,.06);transition:all .2s;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
        .lp-row:hover{transform:translateX(4px);border-color:${C.orange};box-shadow:0 12px 24px -12px rgba(255,107,26,.25)}
        .lp-card{background:${C.cream};border-radius:16px;padding:20px;border:1px solid rgba(10,42,32,.06);transition:all .25s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column}
        .lp-card:hover{transform:translateY(-4px);border-color:${C.orange};box-shadow:0 16px 32px -12px rgba(255,107,26,.25)}
        .lp-avatar{border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-weight:700;color:${C.cream};flex-shrink:0;width:52px;height:52px;font-size:18px}
        .lp-icon-btn{width:36px;height:36px;border-radius:10px;background:${C.greenSoft};color:${C.greenDeep};display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:all .2s}
        .lp-icon-btn:hover{background:${C.orange};color:${C.cream}}
        .lp-icon-btn.danger:hover{background:${C.red};color:${C.cream}}
        .lp-progress{height:6px;border-radius:3px;background:rgba(10,42,32,.08);overflow:hidden}
        .lp-progress-fill{height:100%;border-radius:3px;transition:width .4s}

        .lp-skel{background:rgba(255,250,240,.06);border-radius:16px;height:88px;animation:lpShimmer 1.5s infinite}
        @keyframes lpShimmer{0%,100%{opacity:.5}50%{opacity:.8}}

        .lp-modal-overlay{position:fixed;inset:0;background:rgba(10,42,32,.7);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;animation:lpFade .2s ease}
        @keyframes lpFade{from{opacity:0}to{opacity:1}}
        .lp-modal{background:${C.cream};border-radius:24px;width:100%;max-width:560px;max-height:90vh;overflow:auto;box-shadow:0 40px 80px -20px rgba(0,0,0,.5);animation:lpSlide .3s cubic-bezier(.4,0,.2,1)}
        @keyframes lpSlide{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        .lp-input{width:100%;background:${C.cream};border:1.5px solid rgba(10,42,32,.1);border-radius:10px;padding:11px 14px;font-size:14px;color:${C.ink};font-family:inherit;outline:none;transition:all .2s}
        .lp-input:focus{border-color:${C.orange};box-shadow:0 0 0 3px rgba(255,107,26,.15)}
        .lp-label{display:block;font-size:11px;font-weight:700;color:${C.ink};letter-spacing:.05em;margin-bottom:6px;text-transform:uppercase}

        .stagger>*{animation:lpSlideIn .4s ease-out backwards}
        @keyframes lpSlideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .stagger>*:nth-child(1){animation-delay:.05s}.stagger>*:nth-child(2){animation-delay:.1s}.stagger>*:nth-child(3){animation-delay:.15s}.stagger>*:nth-child(4){animation-delay:.2s}.stagger>*:nth-child(5){animation-delay:.25s}.stagger>*:nth-child(6){animation-delay:.3s}

        @media(max-width:1024px){.lp-row{font-size:13px}}
        @media(max-width:700px){.lp-root{padding:16px}.lp-hero{padding:24px}.lp-hero h1{font-size:32px !important}.lp-row{flex-wrap:wrap;gap:10px}.lp-row .lp-row-meta{order:99;width:100%}}
      `}</style>

      <div className="lp-root">
        {/* Hero */}
        <div className="lp-hero lp-grain">
          <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="280" height="280" viewBox="0 0 280 280">
            <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="140" cy="140" r="40" stroke={C.greenDeep} strokeWidth="2" fill="none" />
            <circle cx="140" cy="140" r="14" fill={C.greenDeep} />
          </svg>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <a href="/sales" className="lp-btn-hero" style={{ padding: 8 }}><ArrowLeft size={16} /></a>
                <span className="lp-pill" style={{ background: C.greenDeep, color: C.cream }}>
                  <span className="lp-livedot" style={{ background: C.cream }}></span>
                  {leads.length} PROSPECTS
                </span>
                {hotCount > 0 && (
                  <span className="lp-pill" style={{ background: 'rgba(255,250,240,.18)', color: C.cream }}>
                    <Flame size={11} /> {hotCount} CHAUDS
                  </span>
                )}
              </div>
              <h1 className="lp-display" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, margin: 0, color: C.cream, letterSpacing: '-.03em' }}>
                Vos leads, <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.greenDeep }}>à conquérir.</em>
              </h1>
              <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,.85)', maxWidth: 540 }}>
                {leads.length} prospect{leads.length > 1 ? 's' : ''} dans le pipeline · {hotCount} attendent un suivi prioritaire
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="lp-btn-secondary"
                onClick={() => {
                  const el = document.querySelector<HTMLInputElement>('.lp-root input[placeholder^="Rechercher"]');
                  el?.focus();
                }}
              ><Filter size={14} /> Filtres</button>
              <button className="lp-btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Nouveau lead</button>
            </div>
          </div>
        </div>

        <SalesNav />

        {/* Filters bar */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280, background: C.cream, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(10,42,32,.06)' }}>
            <Search size={16} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un lead par nom, email…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.ink, fontFamily: 'inherit' }} />
          </div>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="lp-btn-secondary" style={{ paddingRight: 32 }}>
            <option value="">Toutes les étapes</option>
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="lp-btn-secondary" style={{ paddingRight: 32 }}>
            <option value="">Toutes les sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowHotOnly(v => !v)} style={{
            background: showHotOnly ? C.orange : C.orangeSoft,
            color: showHotOnly ? C.cream : C.orangeDeep,
            border: `1px solid ${C.orange}`,
            padding: '11px 18px', borderRadius: 12,
            fontWeight: 600, fontSize: 13, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: 'inherit',
          }}>
            <Flame size={14} /> Chauds uniquement
          </button>

          {/* View toggle */}
          <div style={{ display: 'inline-flex', background: C.cream, borderRadius: 12, padding: 4, border: '1px solid rgba(10,42,32,.08)' }}>
            <button onClick={() => setViewMode('list')} style={{
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: viewMode === 'list' ? C.greenDeep : 'transparent',
              color: viewMode === 'list' ? C.cream : C.inkSoft,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all .2s',
            }} title="Vue liste">
              <List size={14} /> Liste
            </button>
            <button onClick={() => setViewMode('grid')} style={{
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: viewMode === 'grid' ? C.greenDeep : 'transparent',
              color: viewMode === 'grid' ? C.cream : C.inkSoft,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all .2s',
            }} title="Vue grille">
              <LayoutGrid size={14} /> Grille
            </button>
          </div>
        </div>

        {/* Leads list */}
        <div style={{ marginTop: 24 }}>
          {loading ? (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="lp-skel" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: C.cream, borderRadius: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: C.orange, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 8px 24px -8px rgba(255,107,26,.5)' }}>
                <Plus size={28} color={C.cream} />
              </div>
              <h3 className="lp-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{leads.length === 0 ? 'Aucun lead pour le moment' : 'Aucun lead ne correspond'}</h3>
              <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 24 }}>Créez votre premier prospect pour activer le scoring IA.</p>
              <button onClick={() => setShowCreate(true)} className="lp-btn-primary"><Plus size={15} /> Créer un lead</button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filtered.map(lead => {
                const heat = heatStyle(lead.score);
                const HeatIcon = heat.icon;
                const stage = STAGE_PILL[lead.stage] ?? STAGE_PILL.nouveau;
                const avatarColors = [C.orange, C.greenDeep, C.purple, C.blue, C.red];
                const avColor = avatarColors[lead.name.length % avatarColors.length];
                return (
                  <div key={lead.id} className="lp-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div className="lp-avatar" style={{ background: `linear-gradient(135deg, ${avColor} 0%, ${avColor}cc 100%)`, boxShadow: `0 8px 16px -8px ${avColor}` }}>{initials(lead.name)}</div>
                      <span className="lp-pill" style={{ background: heat.bg, color: heat.color }}>
                        <HeatIcon size={11} /> {heat.label}
                      </span>
                    </div>
                    <div className="lp-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{lead.name}</div>
                    {lead.company && <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>{lead.company}</div>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: C.inkSoft, marginBottom: 14 }}>
                      {lead.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={12} /> {lead.email}</span>}
                      {lead.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Phone size={12} /> {lead.phone}</span>}
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
                        <span style={{ color: C.inkSoft, fontWeight: 600 }}>SCORE IA</span>
                        <span className="lp-mono" style={{ color: heat.color, fontWeight: 700 }}>{lead.score}</span>
                      </div>
                      <div className="lp-progress">
                        <div className="lp-progress-fill" style={{ width: `${lead.score}%`, background: `linear-gradient(90deg, ${heat.color}, ${heat.color}aa)` }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                      <span className="lp-pill" style={{ background: stage.bg, color: stage.color }}>{STAGE_LABELS[lead.stage] ?? lead.stage}</span>
                      <span className="lp-mono" style={{ fontSize: 14, fontWeight: 700, color: C.greenDeep }}>
                        {lead.estimatedValue ? `${fmt(lead.estimatedValue)} ${symbol}` : '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${C.greenSoft}` }}>
                      <span className="lp-mono" style={{ fontSize: 11, color: C.inkSoft }}>{lead.source}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link to={`/sales/leads/${lead.id}`} className="lp-icon-btn" title="Voir"><Eye size={14} /></Link>
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`} className="lp-icon-btn" title="Email"><Mail size={14} /></a>
                        ) : (
                          <button className="lp-icon-btn" title="Email" disabled><Mail size={14} /></button>
                        )}
                        <button className="lp-icon-btn danger" onClick={() => handleDelete(lead.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(lead => {
                const heat = heatStyle(lead.score);
                const HeatIcon = heat.icon;
                const stage = STAGE_PILL[lead.stage] ?? STAGE_PILL.nouveau;
                const interactions = lead.interactions?.length ?? 0;
                const avatarColors = [C.orange, C.greenDeep, C.purple, C.blue, C.red];
                const avColor = avatarColors[lead.name.length % avatarColors.length];
                return (
                  <div key={lead.id} className="lp-row">
                    <div className="lp-avatar" style={{ background: `linear-gradient(135deg, ${avColor} 0%, ${avColor}cc 100%)`, boxShadow: `0 8px 16px -8px ${avColor}` }}>{initials(lead.name)}</div>

                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span className="lp-display" style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{lead.name}</span>
                        <span className="lp-pill" style={{ background: heat.bg, color: heat.color }}>
                          <HeatIcon size={11} /> {heat.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: C.inkSoft, flexWrap: 'wrap' }}>
                        {lead.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {lead.email}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Zap size={12} /> {interactions} interactions</span>
                        {lead.company && <span>· {lead.company}</span>}
                      </div>
                    </div>

                    <div className="lp-row-meta" style={{ width: 140 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
                        <span style={{ color: C.inkSoft, fontWeight: 600 }}>SCORE IA</span>
                        <span className="lp-mono" style={{ color: heat.color, fontWeight: 700 }}>{lead.score}</span>
                      </div>
                      <div className="lp-progress">
                        <div className="lp-progress-fill" style={{ width: `${lead.score}%`, background: `linear-gradient(90deg, ${heat.color}, ${heat.color}aa)` }} />
                      </div>
                    </div>

                    <span className="lp-pill" style={{ background: stage.bg, color: stage.color, minWidth: 90, justifyContent: 'center' }}>{STAGE_LABELS[lead.stage] ?? lead.stage}</span>

                    <div style={{ fontSize: 11, color: C.inkSoft, minWidth: 80, textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>SOURCE</div>
                      <div className="lp-mono" style={{ fontSize: 11, color: C.greenDeep }}>{lead.source}</div>
                    </div>

                    <span className="lp-mono" style={{ fontSize: 14, fontWeight: 700, color: C.ink, minWidth: 100, textAlign: 'right' }}>
                      {lead.estimatedValue ? `${fmt(lead.estimatedValue)} ${symbol}` : '—'}
                    </span>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/sales/leads/${lead.id}`} className="lp-icon-btn" title="Voir"><Eye size={14} /></Link>
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="lp-icon-btn" title="Email"><Mail size={14} /></a>
                      ) : (
                        <button className="lp-icon-btn" title="Email" disabled><Mail size={14} /></button>
                      )}
                      <button className="lp-icon-btn danger" onClick={() => handleDelete(lead.id)} title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="lp-modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="lp-modal" onClick={e => e.stopPropagation()}>
              <div style={{ padding: 28, borderBottom: `1px solid ${C.greenSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span className="lp-pill" style={{ background: C.orangeSoft, color: C.orangeDeep, marginBottom: 8 }}><AlertTriangle size={11} /> NOUVEAU</span>
                  <h2 className="lp-display" style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: '8px 0 0' }}>Nouveau lead</h2>
                </div>
                <button className="lp-icon-btn" onClick={() => setShowCreate(false)}><X size={16} /></button>
              </div>
              <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="lp-label">Nom *</label>
                  <input className="lp-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Marie Diallo" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label className="lp-label">Email</label><input className="lp-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="marie@diallo.ci" /></div>
                  <div><label className="lp-label">Téléphone</label><input className="lp-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+225 …" /></div>
                </div>
                <div><label className="lp-label">Entreprise</label><input className="lp-input" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="lp-label">Source</label>
                    <select className="lp-input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                      {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="lp-label">Valeur estimée ({symbol})</label><input className="lp-input" type="number" value={form.estimatedValue} onChange={e => setForm({ ...form, estimatedValue: Number(e.target.value) })} /></div>
                </div>
                <div><label className="lp-label">Notes</label><textarea className="lp-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
              </div>
              <div style={{ padding: '20px 28px', borderTop: `1px solid ${C.greenSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="lp-btn-secondary" onClick={() => setShowCreate(false)}>Annuler</button>
                <button className="lp-btn-primary" onClick={handleCreate} disabled={submitting || !form.name}>
                  {submitting ? '...' : (<><Plus size={15} /> Créer le lead</>)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
