/**
 * Data Scientist Pack — Premium redesign.
 *
 * 4 tabs:
 *   1. Vue d'ensemble — module mini-cards with sparklines
 *   2. Corrélations   — 7×7 heatmap + clickable cells
 *   3. Prédictions    — recharts AreaChart with confidence band
 *   4. Scénarios      — interactive simulator (3 sliders)
 *
 * Pitch: "Comprends ton business — corrélations, prédictions, scénarios sur tous tes modules."
 *
 * Backend: /api/datascientist/* (snapshot, correlations, analyze, predict, auto-insights)
 */
import React, { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  Activity, BarChart3, Brain, Briefcase, ChevronRight,
  Cpu, Download, Headphones, LineChart as LineChartIcon, Loader2,
  MessageCircle, Megaphone, RefreshCw, Send, Sparkles, TrendingUp, TrendingDown,
  Users, Wallet, X, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis,
  Tooltip, ReferenceLine,
} from 'recharts';

const C = {
  navy:        '#0F172A',
  navyDeep:    '#020617',
  navyMid:     '#1E3A5F',
  cyan:        '#06B6D4',
  cyanDeep:    '#0E7490',
  cyanSoft:    '#CFFAFE',
  teal:        '#14B8A6',
  tealSoft:    '#CCFBF1',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  emerald:     '#10B981',
  emeraldSoft: '#D1FAE5',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  purple:      '#8B5CF6',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulseSoft { 0%,100% { opacity:1 } 50% { opacity: 0.55 } }
  .spin { animation: spin .9s linear infinite; }
  .fade-in { animation: slideIn 0.35s ease-out backwards; }
  .pulse-soft { animation: pulseSoft 1.6s ease-in-out infinite; }

  .btn-cyan {
    display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:10px;
    background:linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep}); color:#fff; border:none; cursor:pointer;
    font-weight:700; font-size:13px; font-family:'Inter',sans-serif;
    box-shadow:0 6px 18px -6px ${C.cyan}80; transition:transform .15s ease, box-shadow .15s ease;
  }
  .btn-cyan:hover { transform: translateY(-1px); box-shadow:0 10px 24px -8px ${C.cyan}; }
  .btn-cyan:disabled { opacity:.5; cursor:not-allowed; transform:none; }

  .btn-ghost {
    display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border-radius:10px;
    background:transparent; color:${C.ink}; border:1.5px solid rgba(10,42,32,0.12); cursor:pointer;
    font-weight:600; font-size:13px; font-family:'Inter',sans-serif;
    transition: background .15s ease, border-color .15s ease;
  }
  .btn-ghost:hover { background:${C.creamDeep}; border-color:${C.cyan}; color:${C.cyanDeep}; }

  .pill { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:100px; font-weight:700; font-size:11px; }

  .tab {
    padding: 14px 18px; background: transparent; border: none;
    border-bottom: 3px solid transparent; color: ${C.inkSoft};
    font-weight: 700; font-size: 13px; cursor: pointer;
    display: flex; align-items: center; gap: 7px; font-family: inherit;
    transition: color .15s ease;
  }
  .tab:hover { color: ${C.cyanDeep}; }
  .tab.active { color: ${C.cyanDeep}; border-bottom-color: ${C.cyanDeep}; }

  .module-card {
    background: ${C.cream}; border: 1px solid rgba(10,42,32,0.06); border-radius: 16px;
    padding: 16px; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    cursor: default;
  }
  .module-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 16px 32px -16px rgba(6,182,212,0.35);
    border-color: ${C.cyan}40;
  }

  .heat-cell {
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 700;
    transition: transform .12s ease, box-shadow .12s ease;
    font-family: 'JetBrains Mono', monospace;
    min-height: 42px;
  }
  .heat-cell:hover { transform: scale(1.07); box-shadow: 0 0 0 2px ${C.cyan}; z-index: 1; }
  .heat-cell.diag { cursor: default; opacity: 0.45; }
  .heat-cell.diag:hover { transform: none; box-shadow: none; }

  .slider {
    width: 100%; appearance: none; -webkit-appearance: none;
    height: 6px; border-radius: 100px; background: ${C.creamDeep};
    outline: none;
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 20px; height: 20px; border-radius: 50%;
    background: linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep});
    cursor: pointer; box-shadow: 0 4px 10px -2px ${C.cyan}60;
    transition: transform .12s ease;
  }
  .slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .slider::-moz-range-thumb {
    width: 20px; height: 20px; border-radius: 50%; border: none;
    background: linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep}); cursor: pointer;
  }

  .insight-card {
    background: ${C.cream}; border: 1px solid rgba(10,42,32,0.06);
    border-radius: 14px; padding: 14px;
    transition: transform .15s ease, border-color .15s ease;
  }
  .insight-card:hover { transform: translateY(-2px); border-color: ${C.cyan}40; }

  .modal-overlay {
    position: fixed; inset: 0; background: rgba(2,6,23,0.55); z-index: 100;
    display: flex; align-items: center; justify-content: center; padding: 20px;
    backdrop-filter: blur(4px);
  }
  .modal-card {
    background: ${C.cream}; border-radius: 18px; max-width: 520px; width: 100%;
    box-shadow: 0 24px 60px -16px rgba(2,6,23,0.4); overflow: hidden;
    animation: slideIn 0.25s ease-out;
  }
`;

// ── Types ───────────────────────────────────────────────────────────────────
type ModuleKey = 'sales' | 'marketing' | 'hr' | 'support' | 'finance' | 'it' | 'reception';

interface ModuleStats {
  value: number;
  delta: number;
  sparkline: number[];
}

interface Snapshot {
  modules: Record<ModuleKey, ModuleStats>;
  generatedAt: string;
}

interface AutoInsight {
  id: string;
  score: number;
  message: string;
  pair: [string, string];
}

interface PredictionPoint {
  month: string;
  value: number;
  low?: number;
  high?: number;
  type: 'past' | 'predicted';
}

interface PredictionResp {
  metric: string;
  horizonMonths: number;
  past: PredictionPoint[];
  predicted: PredictionPoint[];
  factors: string[];
}

const MODULE_META: Record<ModuleKey, { label: string; icon: any; unit?: string; hint: string }> = {
  sales:     { label: 'Ventes',     icon: TrendingUp,  unit: 'leads',  hint: 'Total leads ce mois' },
  marketing: { label: 'Marketing',  icon: Megaphone,   unit: 'reach',  hint: 'Portée des publications' },
  hr:        { label: 'RH',         icon: Users,       unit: 'pers.',  hint: 'Effectif actif' },
  support:   { label: 'Support',    icon: Headphones,  unit: 'open',   hint: 'Tickets ouverts' },
  finance:   { label: 'Finance',    icon: Wallet,      unit: 'XOF k',  hint: 'Cash flow (milliers)' },
  it:        { label: 'IT',         icon: Cpu,         unit: 'open',   hint: 'Tickets IT' },
  reception: { label: 'Réception',  icon: Briefcase,   unit: 'visit.', hint: 'Visiteurs ce mois' },
};

const MODULE_ORDER: ModuleKey[] = ['sales', 'marketing', 'hr', 'support', 'finance', 'it', 'reception'];

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function DataScientistRedesignPage() {
  const [tab, setTab] = useState<'overview' | 'correlations' | 'predictions' | 'scenarios'>('overview');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [autoInsights, setAutoInsights] = useState<AutoInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  const isFeatureDisabledError = (err: any): boolean => {
    const status = err?.response?.status ?? err?.status;
    const body = err?.response?.data ?? err?.data;
    return status === 403 && body?.error === 'feature_disabled';
  };

  const fetchAll = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get('/datascientist/snapshot').catch((err: any) => {
          if (isFeatureDisabledError(err)) {
            setFeatureDisabled(true);
            return { data: { data: null, __disabled: true } };
          }
          return { data: { data: null } };
        }),
        api.get('/datascientist/auto-insights').catch((err: any) => {
          if (isFeatureDisabledError(err)) {
            setFeatureDisabled(true);
            return { data: { data: [], __disabled: true } };
          }
          return { data: { data: [] } };
        }),
      ]);
      // If the feature was disabled, stop further loading — don't overwrite state with empty data
      // that would trigger the "not enough data" empty state instead of the beta gate.
      if ((r1 as any)?.data?.__disabled || (r2 as any)?.data?.__disabled) {
        return;
      }
      setSnapshot((r1 as any)?.data?.data ?? null);
      setAutoInsights(((r2 as any)?.data?.data ?? []) as AutoInsight[]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  const exportCsv = () => {
    if (!snapshot) return;
    const rows = ['module,value,delta'];
    for (const k of MODULE_ORDER) {
      const m = snapshot.modules[k];
      rows.push(`${k},${m.value},${m.delta}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corpmind-data-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV', 'Téléchargement démarré.');
  };

  // Beta gate — company not in the Data Scientist whitelist yet.
  // Rendered before the loading check so non-whitelisted tenants never see the spinner flicker.
  if (featureDisabled) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, padding: 32, fontFamily: "'Inter', sans-serif" }}>
        <style>{STYLES}</style>
        <div style={{
          maxWidth: 560, margin: '80px auto', background: C.cream, borderRadius: 22,
          padding: '36px 32px', textAlign: 'center',
          boxShadow: '0 24px 60px -16px rgba(2,6,23,0.18)',
          border: `1px solid ${C.cyan}30`,
        }}>
          <div style={{
            display: 'inline-flex', width: 64, height: 64, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`,
            alignItems: 'center', justifyContent: 'center', marginBottom: 18,
            border: `1px solid ${C.cyan}60`,
          }}>
            <Brain size={30} color={C.cyanSoft} />
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 100,
            background: `${C.cyan}18`, border: `1px solid ${C.cyan}40`,
            color: C.cyanDeep, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            <Sparkles size={10} /> Bêta privée
          </div>
          <h1 className="display-font" style={{ fontSize: 26, fontWeight: 800, margin: 0, color: C.ink }}>
            L'agent <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>Data Scientist</em> arrive bientôt
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: C.inkSoft, lineHeight: 1.55 }}>
            On affine les modèles de corrélation et de prédiction avec de vraies données.
            Cet agent sera réactivé sur ton espace dans les prochains jours.
          </p>
          <p style={{ marginTop: 14, fontSize: 12, color: C.inkLight, lineHeight: 1.5 }}>
            Si tu veux être notifié à l'ouverture, envoie un message à l'équipe Orlode.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <div style={{ textAlign: 'center', color: C.inkSoft }}>
          <Loader2 size={32} className="spin" color={C.cyan} />
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600 }}>Analyse de tes modules…</div>
        </div>
      </div>
    );
  }

  // Empty state — not enough data
  if (!snapshot) {
    return (
      <div style={{ minHeight: '100vh', background: C.creamDeep, padding: 32, fontFamily: "'Inter', sans-serif" }}>
        <style>{STYLES}</style>
        <div style={{
          maxWidth: 560, margin: '80px auto', background: C.cream, borderRadius: 22,
          padding: '36px 32px', textAlign: 'center',
          boxShadow: '0 24px 60px -16px rgba(2,6,23,0.18)',
          border: `1px solid ${C.cyan}30`,
        }}>
          <div style={{
            display: 'inline-flex', width: 64, height: 64, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
            alignItems: 'center', justifyContent: 'center', marginBottom: 18,
          }}>
            <Brain size={30} color="#fff" />
          </div>
          <h1 className="display-font" style={{ fontSize: 26, fontWeight: 800, margin: 0, color: C.ink }}>
            On collecte tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>premiers chiffres</em>
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: C.inkSoft, lineHeight: 1.55 }}>
            Reviens dans 7 jours — j'aurai assez d'historique pour te montrer les premières corrélations
            entre tes ventes, ton marketing, ton support et tes finances.
          </p>
          <button className="btn-cyan" onClick={() => fetchAll()} style={{ marginTop: 18 }}>
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  const sales     = snapshot.modules.sales;
  const support   = snapshot.modules.support;
  const finance   = snapshot.modules.finance;
  const hr        = snapshot.modules.hr;

  return (
    <div style={{ minHeight: '100vh', background: C.creamDeep, color: C.ink, fontFamily: "'Inter', sans-serif" }}>
      <style>{STYLES}</style>

      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 100%)`,
        padding: '36px 32px 32px', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', right: -60, top: -60, opacity: 0.15 }} width="360" height="360" viewBox="0 0 360 360">
          <circle cx="180" cy="180" r="160" stroke={C.cyan} strokeWidth="1" fill="none" />
          <circle cx="180" cy="180" r="120" stroke={C.cyan} strokeWidth="1" fill="none" />
          <circle cx="180" cy="180" r="80"  stroke={C.cyan} strokeWidth="1.5" fill="none" />
          <circle cx="180" cy="180" r="40"  stroke={C.cyan} strokeWidth="2" fill="none" />
        </svg>
        <svg style={{ position: 'absolute', left: -40, bottom: -80, opacity: 0.08 }} width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="120" stroke={C.cyan} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="80"  stroke={C.cyan} strokeWidth="1" fill="none" />
        </svg>

        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
          {/* Pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 100,
            background: 'rgba(6,182,212,0.18)', border: `1px solid ${C.cyan}50`,
            color: C.cyanSoft, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 14, backdropFilter: 'blur(8px)',
          }}>
            <Brain size={11} /> DATA SCIENTIST · INSIGHTS CROSS-MODULES
          </div>

          {/* Title + action buttons */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 360px', minWidth: 0 }}>
              <h1 className="display-font" style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: 0, lineHeight: 1.05 }}>
                Comprends ton{' '}
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanSoft }}>business</em>
              </h1>
              <p style={{ marginTop: 10, fontSize: 14, color: 'rgba(207,250,254,0.85)', maxWidth: 560 }}>
                Corrélations · Prédictions · Scénarios — sur l'ensemble de tes modules.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => fetchAll(true)} disabled={refreshing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)',
                  color: '#fff', border: '1px solid rgba(255,255,255,0.18)',
                  cursor: refreshing ? 'wait' : 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                }}>
                {refreshing ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                Refresh
              </button>
              <button onClick={() => setAskOpen(true)} className="btn-cyan">
                <MessageCircle size={13} /> Poser une question
              </button>
            </div>
          </div>

          {/* Inline KPIs */}
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <HeroKpi label="Total leads"        value={sales.value}   delta={sales.delta}   icon={TrendingUp} />
            <HeroKpi label="Tickets ouverts"    value={support.value} delta={support.delta} icon={Headphones} invertDelta />
            <HeroKpi label="Cash flow (ce mois)" value={finance.value} delta={finance.delta} icon={Wallet} suffix=" k" />
            <HeroKpi label="Effectif"           value={hr.value}      delta={hr.delta}      icon={Users} />
          </div>
        </div>
      </div>

      {/* ─── ACTION BAR ────────────────────────────────────────────────── */}
      <div style={{ background: C.cream, borderBottom: '1px solid rgba(10,42,32,0.06)' }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto', padding: '14px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.inkSoft }}>
            <Activity size={13} color={C.cyanDeep} />
            <span>Données générées le <strong className="mono-font" style={{ color: C.ink }}>
              {new Date(snapshot.generatedAt).toLocaleString('fr-FR')}
            </strong></span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={exportCsv}>
              <Download size={13} /> Export CSV
            </button>
            <button className="btn-cyan" onClick={() => setAskOpen(true)}>
              <Sparkles size={13} /> Poser à l'IA
            </button>
          </div>
        </div>
      </div>

      {/* ─── TABS ──────────────────────────────────────────────────────── */}
      <div style={{ background: C.cream, borderBottom: '1px solid rgba(10,42,32,0.06)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'flex', gap: 4, overflowX: 'auto' }}>
          {[
            { id: 'overview' as const,     label: "Vue d'ensemble", icon: BarChart3 },
            { id: 'correlations' as const, label: 'Corrélations',   icon: Activity },
            { id: 'predictions' as const,  label: 'Prédictions',    icon: LineChartIcon },
            { id: 'scenarios' as const,    label: 'Scénarios',      icon: Zap },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`tab ${tab === t.id ? 'active' : ''}`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── BODY ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 64px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          gap: 22,
        }}
        className="ds-body-grid">
          <div style={{ minWidth: 0 }} className="fade-in" key={tab}>
            {tab === 'overview'     && <OverviewTab snapshot={snapshot} />}
            {tab === 'correlations' && <CorrelationsTab />}
            {tab === 'predictions'  && <PredictionsTab />}
            {tab === 'scenarios'    && <ScenariosTab />}
          </div>
          <InsightsSidebar insights={autoInsights} onSeeDetails={() => setTab('correlations')} />
        </div>
      </div>

      {/* Modal */}
      {askOpen && <AskQuestionModal onClose={() => setAskOpen(false)} />}

      {/* Inline responsive override for the side panel */}
      <style>{`
        @media (max-width: 1279px) {
          .ds-body-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .ds-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Hero KPI ────────────────────────────────────────────────────────────────
function HeroKpi({ label, value, delta, icon: Icon, suffix, invertDelta }: {
  label: string; value: number; delta: number; icon: any; suffix?: string; invertDelta?: boolean;
}) {
  // If invertDelta is set, positive delta is BAD (e.g. more tickets = bad).
  const isGood = invertDelta ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 14, padding: '14px 16px',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(207,250,254,0.70)', textTransform: 'uppercase' }}>
          {label}
        </span>
        <Icon size={14} color={C.cyanSoft} style={{ opacity: 0.7 }} />
      </div>
      <div className="display-font mono-font" style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
        {value.toLocaleString('fr-FR')}{suffix ?? ''}
      </div>
      {!isNeutral && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          {delta > 0 ? <TrendingUp size={11} color={isGood ? C.emerald : C.red} /> : <TrendingDown size={11} color={isGood ? C.emerald : C.red} />}
          <span className="mono-font" style={{
            fontSize: 11, fontWeight: 700,
            color: isGood ? C.emerald : C.red,
          }}>
            {delta > 0 ? '+' : ''}{delta}% <span style={{ opacity: 0.7, fontWeight: 500 }}>vs mois dernier</span>
          </span>
        </div>
      )}
      {isNeutral && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(207,250,254,0.55)', fontWeight: 600 }}>
          Stable
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW
// ══════════════════════════════════════════════════════════════════════════
function OverviewTab({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
      <header style={{ marginBottom: 18 }}>
        <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0, color: C.ink }}>
          Tes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>modules</em> en un coup d'œil
        </h2>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
          7 modules · agrégation temps réel · tendance sur 30 jours
        </p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {MODULE_ORDER.map(k => (
          <ModuleCard key={k} moduleKey={k} stats={snapshot.modules[k]} />
        ))}
      </div>
    </section>
  );
}

function ModuleCard({ moduleKey, stats }: { moduleKey: ModuleKey; stats: ModuleStats }) {
  const meta = MODULE_META[moduleKey];
  const Icon = meta.icon;
  const sparkData = stats.sparkline.map((v, i) => ({ i, value: v }));
  const isGood = stats.delta > 0;
  const isNeutral = stats.delta === 0;
  return (
    <div className="module-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={17} color={C.cyanSoft} />
        </div>
        {!isNeutral && (
          <span className="pill mono-font" style={{
            background: isGood ? C.emeraldSoft : C.redSoft,
            color: isGood ? '#047857' : '#b91c1c',
          }}>
            {isGood ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {stats.delta > 0 ? '+' : ''}{stats.delta}%
          </span>
        )}
        {isNeutral && (
          <span className="pill" style={{ background: C.creamDeep, color: C.inkSoft }}>—</span>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {meta.label}
        </div>
        <div className="display-font mono-font" style={{ fontSize: 26, fontWeight: 800, color: C.ink, marginTop: 2, lineHeight: 1 }}>
          {stats.value.toLocaleString('fr-FR')}
        </div>
        <div style={{ fontSize: 11, color: C.inkLight, marginTop: 2 }}>{meta.hint}</div>
      </div>
      <div style={{ marginTop: 10, height: 36 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Line
              type="monotone" dataKey="value"
              stroke={isGood ? C.emerald : (isNeutral ? C.cyan : C.red)}
              strokeWidth={1.8} dot={false} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 2 — CORRELATIONS
// ══════════════════════════════════════════════════════════════════════════
function CorrelationsTab() {
  const [labels, setLabels] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [selected, setSelected] = useState<{ a: number; b: number } | null>(null);
  const [runOpen, setRunOpen] = useState(false);

  useEffect(() => {
    api.get('/datascientist/correlations').then((r: any) => {
      const d = r?.data?.data;
      if (d) { setLabels(d.labels); setMatrix(d.matrix); }
    }).catch(() => null);
  }, []);

  const labelFor = (k: string) => {
    const m: Record<string, string> = {
      sales: 'Ventes', marketing: 'Marketing', hr: 'RH',
      support: 'Support', finance: 'Finance', it: 'IT', reception: 'Réception',
    };
    return m[k] ?? k;
  };

  const interpret = (a: string, b: string, r: number): string => {
    const abs = Math.abs(r);
    if (a === b) return 'Module identique — corrélation parfaite (référence).';
    if (abs < 0.15) return `Pas de relation détectée entre ${labelFor(a)} et ${labelFor(b)} sur la période actuelle.`;
    const strength = abs > 0.7 ? 'forte' : abs > 0.4 ? 'modérée' : 'faible';
    const dir = r > 0 ? 'monte' : 'baisse';
    const pct = Math.round(abs * 35);
    return `Corrélation ${strength} (r = ${r.toFixed(2)}). Quand ${labelFor(a)} monte, ${labelFor(b)} ${dir} d'environ ${pct}%.`;
  };

  if (!matrix.length) {
    return (
      <section style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', textAlign: 'center', color: C.inkSoft }}>
        <Loader2 size={20} className="spin" style={{ display: 'inline-block', marginBottom: 8 }} color={C.cyan} />
        <div style={{ fontSize: 13 }}>Calcul de la matrice…</div>
      </section>
    );
  }

  return (
    <>
      <section style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0, color: C.ink }}>
              Matrice de <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>corrélations</em>
            </h2>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
              Clique une cellule pour comprendre la relation entre deux modules.
            </p>
          </div>
          <button className="btn-cyan" onClick={() => setRunOpen(true)}>
            <Sparkles size={13} /> Lancer une analyse
          </button>
        </header>

        {/* Heatmap */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(0, 1fr))', gap: 4, alignItems: 'stretch' }}>
          {/* Top header row */}
          <div />
          {labels.map(l => (
            <div key={`top-${l}`} style={{
              fontSize: 10, fontWeight: 700, color: C.inkSoft,
              textAlign: 'center', padding: '6px 2px', letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {labelFor(l)}
            </div>
          ))}
          {/* Rows */}
          {labels.map((rowLabel, i) => (
            <React.Fragment key={`row-${rowLabel}`}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.ink,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 8, letterSpacing: '0.02em',
              }}>
                {labelFor(rowLabel)}
              </div>
              {labels.map((colLabel, j) => {
                const v = matrix[i]![j]!;
                const diag = i === j;
                const color = heatColor(v);
                const text = v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
                return (
                  <div key={`c-${i}-${j}`}
                    className={`heat-cell ${diag ? 'diag' : ''}`}
                    onClick={() => { if (!diag) setSelected({ a: i, b: j }); }}
                    style={{
                      background: color.bg, color: color.fg,
                      boxShadow: selected?.a === i && selected?.b === j ? `0 0 0 2px ${C.cyanDeep}` : 'none',
                    }}>
                    {text}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: C.inkSoft, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: C.ink }}>Force :</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 14, borderRadius: 4, background: heatColor(-0.9).bg }} />
            <span>-1 (négative)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 14, borderRadius: 4, background: heatColor(0).bg, border: '1px solid #e5e7eb' }} />
            <span>0 (neutre)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 18, height: 14, borderRadius: 4, background: heatColor(0.9).bg }} />
            <span>+1 (positive)</span>
          </div>
        </div>

        {/* Selected pair interpretation */}
        {selected && (
          <div className="fade-in" style={{
            marginTop: 20, padding: 16, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.cyanSoft} 0%, ${C.tealSoft} 100%)`,
            border: `1px solid ${C.cyan}40`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Analyse · {labelFor(labels[selected.a]!)} ↔ {labelFor(labels[selected.b]!)}
                </div>
                <div style={{ fontSize: 14, color: C.ink, marginTop: 6, lineHeight: 1.45 }}>
                  {interpret(labels[selected.a]!, labels[selected.b]!, matrix[selected.a]![selected.b]!)}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 6, borderRadius: 8, color: C.inkSoft,
              }}>
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {runOpen && <RunCorrelationModal onClose={() => setRunOpen(false)} />}
    </>
  );
}

// Color scale: r=-1 red, r=0 white, r=+1 cyan
function heatColor(r: number): { bg: string; fg: string } {
  const clamp = Math.max(-1, Math.min(1, r));
  if (clamp >= 0) {
    // 0 -> #ffffff, 1 -> cyan
    const t = clamp; // 0..1
    const bg = `rgb(${Math.round(255 - t * (255 - 6))}, ${Math.round(255 - t * (255 - 182))}, ${Math.round(255 - t * (255 - 212))})`;
    const fg = t > 0.55 ? '#ffffff' : C.ink;
    return { bg, fg };
  } else {
    // 0 -> #ffffff, -1 -> red
    const t = -clamp;
    const bg = `rgb(${Math.round(255 - t * (255 - 239))}, ${Math.round(255 - t * (255 - 68))}, ${Math.round(255 - t * (255 - 68))})`;
    const fg = t > 0.55 ? '#ffffff' : C.ink;
    return { bg, fg };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 3 — PREDICTIONS
// ══════════════════════════════════════════════════════════════════════════
function PredictionsTab() {
  const [metric, setMetric] = useState<'revenue' | 'leads' | 'tickets' | 'effectif'>('revenue');
  const [horizon, setHorizon] = useState<1 | 3 | 6>(3);
  const [data, setData] = useState<PredictionResp | null>(null);
  const [busy, setBusy] = useState(false);

  const predict = async () => {
    setBusy(true);
    try {
      const r: any = await api.post('/datascientist/predict', { metric, horizonMonths: horizon });
      setData(r?.data?.data ?? null);
    } catch {
      toast.error('Erreur', 'Prédiction impossible. Réessaie.');
    } finally { setBusy(false); }
  };

  // Auto-load on mount
  useEffect(() => { predict(); /* eslint-disable-next-line */ }, []);

  const chartData = useMemo(() => {
    if (!data) return [];
    const past = data.past.map(p => ({
      month: p.month,
      past: p.value,
      predicted: null as number | null,
      low: null as number | null,
      high: null as number | null,
    }));
    // Bridge point: last past also appears as start of predicted line
    const bridge = data.past.length > 0 ? data.past[data.past.length - 1] : null;
    const pred = data.predicted.map((p, i) => ({
      month: p.month,
      past: null as number | null,
      predicted: p.value,
      low: p.low ?? null,
      high: p.high ?? null,
    }));
    // Prepend a "bridge" so the dashed line starts visually at the last solid point
    if (bridge) {
      pred.unshift({
        month: bridge.month + '·',
        past: null,
        predicted: bridge.value,
        low: bridge.value,
        high: bridge.value,
      });
    }
    return [...past, ...pred];
  }, [data]);

  const metricLabel: Record<typeof metric, string> = {
    revenue: 'Revenue',
    leads: 'Leads',
    tickets: 'Tickets',
    effectif: 'Effectif',
  };
  const metricSuffix: Record<typeof metric, string> = {
    revenue: ' XOF',
    leads: '',
    tickets: '',
    effectif: '',
  };

  return (
    <section style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
      <header style={{ marginBottom: 16 }}>
        <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0, color: C.ink }}>
          <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>Prédiction</em> sur les mois à venir
        </h2>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
          Choisis une métrique et un horizon, lance la prédiction. La zone ombrée représente l'intervalle de confiance.
        </p>
      </header>

      {/* Selector row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Métrique</label>
          <select value={metric} onChange={e => setMetric(e.target.value as typeof metric)}
            style={{
              display: 'block', marginTop: 4, padding: '9px 12px',
              borderRadius: 10, border: `1.5px solid ${C.creamDeep}`,
              fontSize: 13, fontFamily: 'inherit', background: '#fff',
              minWidth: 160, outline: 'none', cursor: 'pointer',
            }}>
            <option value="revenue">Revenue</option>
            <option value="leads">Leads</option>
            <option value="tickets">Tickets</option>
            <option value="effectif">Effectif</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Horizon</label>
          <select value={horizon} onChange={e => setHorizon(Number(e.target.value) as 1 | 3 | 6)}
            style={{
              display: 'block', marginTop: 4, padding: '9px 12px',
              borderRadius: 10, border: `1.5px solid ${C.creamDeep}`,
              fontSize: 13, fontFamily: 'inherit', background: '#fff',
              minWidth: 140, outline: 'none', cursor: 'pointer',
            }}>
            <option value={1}>1 mois</option>
            <option value={3}>3 mois</option>
            <option value={6}>6 mois</option>
          </select>
        </div>
        <button className="btn-cyan" onClick={predict} disabled={busy}>
          {busy ? <Loader2 size={13} className="spin" /> : <LineChartIcon size={13} />}
          Prédire
        </button>
      </div>

      {/* Chart */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 8px 8px', border: `1px solid ${C.creamDeep}` }}>
        <div style={{ height: 320 }}>
          {data ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ciFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor={C.cyan} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={C.cyan} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="pastFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor={C.cyanDeep} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={C.cyanDeep} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.creamDeep }} />
                <YAxis tick={{ fontSize: 11, fill: C.inkSoft }} tickLine={false} axisLine={{ stroke: C.creamDeep }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${C.cyan}40`, fontFamily: 'inherit', fontSize: 12 }}
                  formatter={(v: any) => v == null ? '—' : `${Number(v).toLocaleString('fr-FR')}${metricSuffix[metric]}`}
                />
                {/* Confidence interval (high - low band, drawn as 2 stacked areas) */}
                <Area type="monotone" dataKey="high" stroke="none" fill="url(#ciFill)" isAnimationActive={false} />
                <Area type="monotone" dataKey="low"  stroke="none" fill="#fff" isAnimationActive={false} />
                {/* Past line (solid) */}
                <Area type="monotone" dataKey="past" stroke={C.cyanDeep} strokeWidth={2.5}
                  fill="url(#pastFill)" connectNulls={false} isAnimationActive={false}
                  dot={{ r: 3, fill: C.cyanDeep, stroke: '#fff', strokeWidth: 1.5 }}
                />
                {/* Predicted line (dashed) */}
                <Area type="monotone" dataKey="predicted" stroke={C.cyan} strokeWidth={2.5}
                  strokeDasharray="6 4" fill="transparent" connectNulls={false} isAnimationActive={false}
                  dot={{ r: 3, fill: C.cyan, stroke: '#fff', strokeWidth: 1.5 }}
                />
                {data.past.length > 0 && (
                  <ReferenceLine
                    x={data.past[data.past.length - 1]!.month}
                    stroke={C.inkLight} strokeDasharray="3 3"
                    label={{ value: 'aujourd\'hui', fontSize: 10, fill: C.inkSoft, position: 'top' }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.inkSoft, fontSize: 13 }}>
              {busy ? <Loader2 size={20} className="spin" /> : 'Aucune prédiction encore.'}
            </div>
          )}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 11, color: C.inkSoft, paddingTop: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 22, height: 2, background: C.cyanDeep }} /> Passé
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 22, height: 2, background: C.cyan, borderTop: `2px dashed ${C.cyan}` }} /> Prédiction
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 10, background: `${C.cyan}40`, borderRadius: 2 }} /> Intervalle de confiance
          </span>
        </div>
      </div>

      {/* Factors */}
      {data && data.factors.length > 0 && (
        <div style={{ marginTop: 18, background: C.creamDeep, borderRadius: 14, padding: 16, border: `1px solid ${C.cyan}20` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Sparkles size={14} color={C.cyanDeep} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Facteurs influents
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {data.factors.map((f, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 10, padding: '10px 12px',
                fontSize: 12, color: C.ink, border: `1px solid ${C.cyan}15`,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 7,
                  background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontWeight: 800, fontSize: 11,
                }}>{i + 1}</div>
                <span style={{ lineHeight: 1.45 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predicted endpoint summary */}
      {data && data.predicted.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 13, color: C.inkSoft }}>
          Prédiction <strong style={{ color: C.ink }}>{metricLabel[metric]}</strong> dans{' '}
          <strong style={{ color: C.cyanDeep }} className="mono-font">{horizon}</strong> mois :{' '}
          <strong className="display-font mono-font" style={{ color: C.cyanDeep, fontSize: 16 }}>
            {data.predicted[data.predicted.length - 1]!.value.toLocaleString('fr-FR')}{metricSuffix[metric]}
          </strong>
        </div>
      )}
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB 4 — SCENARIOS
// ══════════════════════════════════════════════════════════════════════════
function ScenariosTab() {
  // Baseline values
  const baseline = { budget: 100_000, commerciaux: 5, delai: 30 };
  const [budget, setBudget] = useState(baseline.budget);
  const [commerciaux, setCommerciaux] = useState(baseline.commerciaux);
  const [delai, setDelai] = useState(baseline.delai);
  const [simulated, setSimulated] = useState(false);

  // Mock formula
  const compute = (b: number, c: number, d: number) => {
    const revenue = Math.round(b * 1.8 + c * 8000);
    const cash = Math.round(revenue * 0.6 - d * 100);
    const risk = c > 15 ? 80 : c > 10 ? 55 : 30;
    return { revenue, cash, risk };
  };

  const sim = compute(budget, commerciaux, delai);
  const base = compute(baseline.budget, baseline.commerciaux, baseline.delai);

  const deltaPct = (cur: number, ref: number) => ref === 0 ? 0 : Math.round(((cur - ref) / ref) * 100);

  const riskEmoji = sim.risk > 70 ? '🔥' : sim.risk > 50 ? '😟' : '😊';
  const riskColor = sim.risk > 70 ? C.red : sim.risk > 50 ? C.yellow : C.emerald;
  const riskLabel = sim.risk > 70 ? 'Burnout élevé' : sim.risk > 50 ? 'Tension' : 'Sain';

  const reset = () => {
    setBudget(baseline.budget);
    setCommerciaux(baseline.commerciaux);
    setDelai(baseline.delai);
    setSimulated(false);
  };

  return (
    <section style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
      <header style={{ marginBottom: 18 }}>
        <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, margin: 0, color: C.ink }}>
          Simule un <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>scénario</em>
        </h2>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>
          Ajuste les leviers, lance la simulation, vois l'impact sur revenue, cash et risque équipe.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <SliderControl
          label="Budget marketing"
          value={budget} min={0} max={300_000} step={5_000}
          onChange={(v) => { setBudget(v); setSimulated(false); }}
          format={(v) => `${(v / 1000).toFixed(0)}k FCFA`}
        />
        <SliderControl
          label="Nombre de commerciaux"
          value={commerciaux} min={1} max={20} step={1}
          onChange={(v) => { setCommerciaux(v); setSimulated(false); }}
          format={(v) => `${v} pers.`}
        />
        <SliderControl
          label="Délai paiement clients"
          value={delai} min={0} max={90} step={1}
          onChange={(v) => { setDelai(v); setSimulated(false); }}
          format={(v) => `${v} jours`}
        />
      </div>

      <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-ghost" onClick={reset}>
          <RefreshCw size={13} /> Reset baseline
        </button>
        <button className="btn-cyan" onClick={() => setSimulated(true)} style={{ padding: '12px 24px', fontSize: 14 }}>
          <Zap size={14} /> Simuler
        </button>
      </div>

      {/* Results */}
      <div style={{
        marginTop: 24, padding: 22, borderRadius: 16,
        background: simulated
          ? `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`
          : C.creamDeep,
        color: simulated ? '#fff' : C.inkSoft,
        transition: 'all .35s ease',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {/* Revenue */}
          <ResultCard
            label="Revenue projeté"
            value={`${(sim.revenue / 1000).toFixed(0)}k`}
            unit="FCFA"
            delta={deltaPct(sim.revenue, base.revenue)}
            active={simulated} positiveIsGood
            icon={TrendingUp}
          />
          <ResultCard
            label="Cash flow"
            value={`${(sim.cash / 1000).toFixed(0)}k`}
            unit="FCFA"
            delta={deltaPct(sim.cash, base.cash)}
            active={simulated} positiveIsGood
            icon={Wallet}
          />
          <div style={{
            background: simulated ? 'rgba(255,255,255,0.08)' : '#fff',
            border: simulated ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${C.creamDeep}`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: simulated ? 'rgba(207,250,254,0.7)' : C.inkSoft,
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
            }}>Risque burnout équipe</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="display-font mono-font" style={{
                fontSize: 32, fontWeight: 800,
                color: simulated ? '#fff' : C.ink,
              }}>{sim.risk}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: simulated ? 'rgba(255,255,255,0.7)' : C.inkSoft }}>/100</span>
              <span style={{ marginLeft: 'auto', fontSize: 22 }}>{riskEmoji}</span>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, marginTop: 4,
              color: riskColor,
            }}>{riskLabel}</div>
          </div>
        </div>

        {!simulated && (
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: C.inkSoft }}>
            Ajuste les leviers puis clique <strong style={{ color: C.cyanDeep }}>Simuler</strong> pour voir l'impact projeté.
          </div>
        )}
      </div>
    </section>
  );
}

function SliderControl({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{label}</label>
        <span className="mono-font" style={{
          fontSize: 13, fontWeight: 800, color: C.cyanDeep,
          background: C.cyanSoft, padding: '3px 10px', borderRadius: 100,
        }}>{format(value)}</span>
      </div>
      <input type="range" className="slider"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: C.inkLight, fontWeight: 600 }}>
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function ResultCard({ label, value, unit, delta, active, positiveIsGood, icon: Icon }: {
  label: string; value: string; unit: string; delta: number;
  active: boolean; positiveIsGood: boolean; icon: any;
}) {
  const isGood = positiveIsGood ? delta >= 0 : delta <= 0;
  return (
    <div style={{
      background: active ? 'rgba(255,255,255,0.08)' : '#fff',
      border: active ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${C.creamDeep}`,
      borderRadius: 14, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 800,
          color: active ? 'rgba(207,250,254,0.7)' : C.inkSoft,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{label}</span>
        <Icon size={13} color={active ? C.cyanSoft : C.inkSoft} style={{ opacity: 0.75 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="display-font mono-font" style={{
          fontSize: 30, fontWeight: 800,
          color: active ? '#fff' : C.ink,
        }}>{value}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: active ? 'rgba(255,255,255,0.65)' : C.inkSoft }}>{unit}</span>
      </div>
      {active && delta !== 0 && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          {delta > 0 ? <TrendingUp size={11} color={isGood ? C.emerald : C.red} /> : <TrendingDown size={11} color={isGood ? C.emerald : C.red} />}
          <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: isGood ? C.emerald : C.red }}>
            {delta > 0 ? '+' : ''}{delta}% <span style={{ opacity: 0.7, fontWeight: 500 }}>vs baseline</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SIDEBAR (insights, desktop only)
// ══════════════════════════════════════════════════════════════════════════
function InsightsSidebar({ insights, onSeeDetails }: { insights: AutoInsight[]; onSeeDetails: () => void }) {
  return (
    <aside className="ds-sidebar" style={{ position: 'sticky', top: 20, alignSelf: 'flex-start' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} color={C.cyanDeep} />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Insights auto-détectés
          </h3>
        </div>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '4px 0 0' }}>
          Corrélations à fort impact identifiées cette semaine.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {insights.length === 0 && (
          <div style={{ background: C.cream, borderRadius: 12, padding: 14, fontSize: 12, color: C.inkSoft, border: `1px solid ${C.creamDeep}` }}>
            Pas encore d'insights — reviens dans quelques jours.
          </div>
        )}
        {insights.map(ins => (
          <div key={ins.id} className="insight-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="mono-font" style={{
                padding: '3px 10px', borderRadius: 100,
                background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
                color: '#fff', fontSize: 11, fontWeight: 800,
              }}>impact {ins.score}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.inkLight, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {ins.pair.join(' ↔ ')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.45 }}>
              {ins.message}
            </div>
            <button onClick={onSeeDetails} style={{
              marginTop: 8, background: 'transparent', border: 'none', padding: 0,
              color: C.cyanDeep, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'inherit',
            }}>
              Voir détails <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════════════════
function AskQuestionModal({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ summary: string; detail: string } | null>(null);

  const submit = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      const r: any = await api.post('/datascientist/analyze', { question: question.trim() });
      setAnswer(r?.data?.data ?? null);
    } catch {
      toast.error('Erreur', 'Analyse impossible. Réessaie.');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, color: '#fff', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MessageCircle size={16} color="#fff" />
              </div>
              <div>
                <h2 className="display-font" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Pose ta question</h2>
                <div style={{ fontSize: 11, opacity: 0.8 }}>L'IA fouille tes modules pour te répondre</div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
              padding: 6, color: '#fff', cursor: 'pointer',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Question
          </label>
          <textarea
            value={question} onChange={e => setQuestion(e.target.value)} rows={3}
            placeholder="Ex: Comment le marketing impacte mes ventes ?"
            autoFocus
            style={{
              display: 'block', marginTop: 6, width: '100%', padding: '12px 14px',
              borderRadius: 10, border: `1.5px solid ${C.creamDeep}`,
              fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              background: '#fff',
            }}
          />
          {answer && (
            <div className="fade-in" style={{
              marginTop: 14, padding: 14, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.cyanSoft} 0%, ${C.tealSoft} 100%)`,
              border: `1px solid ${C.cyan}40`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                Réponse
              </div>
              <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 4 }}>{answer.summary}</div>
              <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{answer.detail}</div>
            </div>
          )}
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Fermer</button>
            <button className="btn-cyan" onClick={submit} disabled={!question.trim() || busy}>
              {busy ? <><Loader2 size={13} className="spin" /> Analyse…</> : <><Send size={13} /> Envoyer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RunCorrelationModal({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ summary: string; detail: string } | null>(null);

  const submit = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      const r: any = await api.post('/datascientist/analyze', { question: question.trim() });
      setAnswer(r?.data?.data ?? null);
    } catch {
      toast.error('Erreur', 'Analyse impossible. Réessaie.');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyMid})`, color: '#fff', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={16} color="#fff" />
              </div>
              <div>
                <h2 className="display-font" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Nouvelle analyse</h2>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Décris ce que tu veux mesurer</div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
              padding: 6, color: '#fff', cursor: 'pointer',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>
        <div style={{ padding: 22 }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Quelle question ?
          </label>
          <textarea
            value={question} onChange={e => setQuestion(e.target.value)} rows={3}
            placeholder="Ex: Est-ce que le manque de présence RH ralentit mon support ?"
            autoFocus
            style={{
              display: 'block', marginTop: 6, width: '100%', padding: '12px 14px',
              borderRadius: 10, border: `1.5px solid ${C.creamDeep}`,
              fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
              background: '#fff',
            }}
          />
          {answer && (
            <div className="fade-in" style={{
              marginTop: 14, padding: 14, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.cyanSoft} 0%, ${C.tealSoft} 100%)`,
              border: `1px solid ${C.cyan}40`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                Résultat
              </div>
              <div style={{ fontSize: 14, color: C.ink, fontWeight: 700, marginBottom: 4 }}>{answer.summary}</div>
              <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{answer.detail}</div>
            </div>
          )}
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Fermer</button>
            <button className="btn-cyan" onClick={submit} disabled={!question.trim() || busy}>
              {busy ? <><Loader2 size={13} className="spin" /> Analyse…</> : <><Sparkles size={13} /> Lancer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
