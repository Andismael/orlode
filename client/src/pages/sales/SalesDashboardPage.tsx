/**
 * Sales Dashboard — Premium edition (green/orange palette, Fraunces serif)
 * Hero header + tabs + KPIs + pipeline chart + donut + recent leads
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ArrowLeft, ArrowRight, ArrowUpRight,
  Users, Target, FileText, TrendingUp, Clock, Sparkles,
  Plus, Filter, Shield,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import SalesNav from './_SalesNav';

interface Stats {
  totalLeads: number; hotLeads: number; totalClients: number;
  totalQuotes: number; acceptedQuotes: number; pendingQuotes: number;
  totalRevenue: number; pipelineValue: number;
  conversionRate: number; avgDealSize: number;
  stages: Record<string, { count: number; value: number }>;
}
interface FollowUp { id: string; leadId: string; scheduledAt: string; type: string; overdue: boolean }
interface Lead { id: string; name: string; company?: string; stage: string; estimatedValue?: number; score?: number }

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E', greenMid: '#0F6B52',
  greenSoft: '#E8F5EE', cream: '#FFFAF0',
  orange: '#FF6B1A', orangeDeep: '#E5530C', orangeSoft: '#FFE8D6',
  ink: '#0A2A20', inkSoft: '#5A6B62',
  onGreenSoft: '#A8C9B8',
};

const STAGE_LABELS: Record<string, string> = {
  nouveau: 'Nouveau', contacte: 'Contacté', interesse: 'Intéressé',
  devis_envoye: 'Devis envoyé', negociation: 'Négociation', gagne: 'Gagné', perdu: 'Perdu',
};
const STAGE_COLORS = ['#FF6B1A', '#FFB347', '#5BBF95', '#E5530C', C.greenDeep, C.greenMid, '#94A3B8'];

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const heatStyle = (score?: number): { bg: string; dot: string; label: string } => {
  if (!score && score !== 0) return { bg: C.greenSoft, dot: '#5BBF95', label: '—' };
  if (score >= 70) return { bg: '#FFE8D6', dot: '#FF3D00', label: 'Chaud' };
  if (score >= 40) return { bg: '#FFF4E0', dot: '#FFB347', label: 'Tiède' };
  return { bg: C.greenSoft, dot: '#5BBF95', label: 'Froid' };
};

const initials = (name: string) => name.trim().charAt(0).toUpperCase() || 'L';

export default function SalesDashboardPage() {
  const { symbol } = useCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unwrap = <T,>(v: unknown): T => {
      if (v && typeof v === 'object' && 'data' in (v as Record<string, unknown>)) return (v as { data: T }).data;
      return v as T;
    };
    Promise.all([
      api.get('/sales/stats').then(r => setStats(unwrap<Stats>(r.data) ?? null)).catch(() => {}),
      api.get('/sales/followups/pending').then(r => {
        const d = unwrap<FollowUp[]>(r.data);
        setFollowups(Array.isArray(d) ? d : []);
      }).catch(() => {}),
      api.get('/sales/leads?limit=4').then(r => {
        const d = unwrap<{ leads?: Lead[] } | Lead[]>(r.data);
        const list = Array.isArray(d) ? d : (d?.leads ?? []);
        setRecentLeads(list.slice(0, 4));
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const overdueCount = followups.filter(f => f.overdue).length;

  const pipelineStages = stats ? Object.entries(stats.stages)
    .filter(([s]) => s !== 'perdu')
    .map(([stage, d], i) => ({
      name: STAGE_LABELS[stage] ?? stage,
      count: d.count,
      value: d.value,
      color: STAGE_COLORS[i % STAGE_COLORS.length],
    })) : [];

  const maxStageCount = Math.max(...pipelineStages.map(s => s.count), 1);

  const leadDist = stats ? [
    { label: 'Chauds', value: stats.hotLeads, color: '#FF3D00' },
    { label: 'Tièdes', value: Math.max(0, Math.floor(stats.totalLeads * 0.3)), color: '#FFB347' },
    { label: 'Nouveaux', value: stats.stages?.['nouveau']?.count ?? 0, color: C.orange },
    { label: 'Froids', value: Math.max(0, stats.totalLeads - stats.hotLeads - Math.floor(stats.totalLeads * 0.3) - (stats.stages?.['nouveau']?.count ?? 0)), color: '#5BBF95' },
  ].filter(s => s.value > 0) : [];
  const donutTotal = leadDist.reduce((s, d) => s + d.value, 0) || 1;

  const kpis = stats ? [
    { id: 'leads', label: 'Leads', value: String(stats.totalLeads), trend: stats.hotLeads > 0 ? `${stats.hotLeads} chauds` : '—', trendDir: stats.hotLeads > 0 ? 'up' : 'flat', sub: 'Cette semaine', icon: Users, style: 'orange' as const },
    { id: 'clients', label: 'Clients', value: String(stats.totalClients), trend: '—', trendDir: 'flat' as const, sub: 'Total actifs', icon: Target, style: 'cream' as const },
    { id: 'pipeline', label: 'Pipeline', value: fmt(stats.pipelineValue), prefix: `${symbol} `, trend: '—', trendDir: 'flat' as const, sub: 'À engager', icon: FileText, style: 'cream' as const },
    { id: 'devis', label: 'Devis', value: String(stats.totalQuotes), trend: stats.acceptedQuotes > 0 ? `${stats.acceptedQuotes} acceptés` : '—', trendDir: stats.acceptedQuotes > 0 ? 'up' : 'flat', sub: 'En cours', icon: TrendingUp, style: 'cream' as const },
    { id: 'conversion', label: 'Conversion', value: String(stats.conversionRate), suffix: '%', trend: stats.conversionRate > 0 ? `${stats.conversionRate}%` : 'À optimiser', trendDir: stats.conversionRate > 50 ? 'up' : 'flat', sub: 'Lead → Client', icon: Sparkles, style: 'cream' as const },
    { id: 'relances', label: 'Relances', value: String(overdueCount), trend: overdueCount > 0 ? `${overdueCount} retard` : 'À jour', trendDir: overdueCount > 0 ? 'down' : 'up', sub: "Aujourd'hui", icon: Clock, style: 'cream' as const },
  ] : [];

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
        .csd-root{background:${C.greenDeep};min-height:100vh;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;padding:32px}
        .csd-display{font-family:'Fraunces',serif;font-optical-sizing:auto;letter-spacing:-.02em}
        .csd-mono{font-family:'JetBrains Mono',monospace}

        .csd-hero{background:linear-gradient(135deg,${C.orange} 0%,${C.orangeDeep} 100%);border-radius:24px;padding:36px 40px;position:relative;overflow:hidden;color:${C.cream};box-shadow:0 30px 60px -20px rgba(255,107,26,.4)}
        .csd-hero-bg{position:absolute;right:-60px;top:-60px;opacity:.18}
        .csd-grain::before{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");opacity:.06;pointer-events:none;mix-blend-mode:overlay;border-radius:inherit}

        .csd-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:600;letter-spacing:.02em}
        .csd-back-btn{background:rgba(255,250,240,.15);border:1px solid rgba(255,250,240,.25);border-radius:10px;padding:8px;cursor:pointer;color:${C.cream};display:inline-flex;align-items:center}
        .csd-back-btn:hover{background:rgba(255,250,240,.25)}

        .csd-live-dot{width:8px;height:8px;border-radius:50%;background:${C.orange};position:relative;flex-shrink:0}
        .csd-live-dot::after{content:'';position:absolute;inset:-4px;border-radius:50%;background:${C.orange};opacity:.4;animation:csdPulse 2s ease-in-out infinite}
        @keyframes csdPulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.6);opacity:0}}

        .csd-tabs{display:flex;gap:4px;background:${C.greenDark};padding:4px;border-radius:14px;border:1px solid rgba(255,250,240,.06)}
        .csd-tab{padding:10px 18px;font-size:14px;font-weight:500;color:${C.onGreenSoft};cursor:pointer;border-radius:10px;transition:all .2s;background:transparent;border:none;font-family:inherit}
        .csd-tab:hover{color:${C.cream}}
        .csd-tab.active{background:${C.orange};color:${C.cream};box-shadow:0 4px 14px -4px rgba(255,107,26,.5)}

        .csd-qa{background:rgba(255,250,240,.08);border:1px solid rgba(255,250,240,.12);border-radius:12px;padding:10px 16px;display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:${C.cream};cursor:pointer;transition:all .2s;font-family:inherit}
        .csd-qa:hover{background:${C.orange};border-color:${C.orange};color:${C.cream};transform:translateY(-1px)}
        .csd-qa-light{background:${C.cream};border:1px solid rgba(10,42,32,.08);border-radius:12px;padding:10px 16px;display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:${C.ink};cursor:pointer;transition:all .2s;font-family:inherit;text-decoration:none}
        .csd-qa-light:hover{background:${C.orange};color:${C.cream};border-color:${C.orange}}

        .csd-kpi{border-radius:20px;padding:24px;position:relative;overflow:hidden;transition:all .3s cubic-bezier(.4,0,.2,1);cursor:pointer}
        .csd-kpi.cream{background:${C.cream};border:1px solid rgba(10,42,32,.06)}
        .csd-kpi.orange{background:linear-gradient(135deg,${C.orange} 0%,${C.orangeDeep} 100%);color:${C.cream}}
        .csd-kpi:hover{transform:translateY(-4px);box-shadow:0 24px 50px -20px rgba(0,0,0,.4)}
        .csd-kpi .corner-mark{position:absolute;top:16px;right:16px;width:8px;height:8px;border-top:2px solid currentColor;border-right:2px solid currentColor;opacity:.3}

        .csd-icon-badge{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
        .csd-icon-badge.green{background:${C.greenDeep};color:${C.cream}}
        .csd-icon-badge.cream-on-orange{background:rgba(255,250,240,.2);color:${C.cream};border:1px solid rgba(255,250,240,.3)}

        .csd-card{background:${C.cream};border-radius:20px;padding:28px;border:1px solid rgba(10,42,32,.06)}

        .csd-stage-bar{position:relative;height:100%;border-radius:8px 8px 0 0;transition:all .4s ease}
        .csd-stage-bar:hover{filter:brightness(1.1);transform:scaleY(1.02)}

        .csd-lead-row{display:grid;grid-template-columns:40px 1fr auto auto auto;align-items:center;gap:16px;padding:14px 16px;border-radius:12px;transition:all .2s;cursor:pointer}
        .csd-lead-row:hover{background:${C.greenSoft}}

        .csd-avatar{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-weight:700;font-size:16px;color:${C.cream}}

        .csd-skel{background:rgba(255,250,240,.06);border-radius:20px;height:140px;animation:csdShimmer 1.5s infinite}
        @keyframes csdShimmer{0%,100%{opacity:.5}50%{opacity:.8}}

        @media(max-width:1100px){.csd-kpi-grid{grid-template-columns:repeat(3,1fr) !important}.csd-charts{grid-template-columns:1fr !important}}
        @media(max-width:700px){.csd-kpi-grid{grid-template-columns:repeat(2,1fr) !important}.csd-root{padding:16px !important}.csd-hero{padding:24px !important}.csd-hero h1{font-size:36px !important}}
      `}</style>

      <div className="csd-root">

        {/* HERO HEADER */}
        <div className="csd-hero csd-grain">
          <svg className="csd-hero-bg" width="320" height="320" viewBox="0 0 320 320">
            <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="160" cy="160" r="60" stroke={C.greenDeep} strokeWidth="2" fill="none" />
            <circle cx="160" cy="160" r="20" fill={C.greenDeep} />
          </svg>
          <svg style={{ position: 'absolute', left: 24, bottom: 24, opacity: 0.2 }} width="80" height="40">
            {[...Array(5)].map((_, row) =>
              [...Array(10)].map((_, col) => (
                <circle key={`${row}-${col}`} cx={col * 8 + 4} cy={row * 8 + 4} r="1.5" fill={C.cream} />
              ))
            )}
          </svg>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <Link to="/dashboard" className="csd-back-btn"><ArrowLeft size={16} /></Link>
                <span className="csd-pill" style={{ background: C.greenDeep, color: C.cream }}>
                  <span className="csd-live-dot" style={{ background: C.cream }}></span>
                  COMMERCIAL · PRO
                </span>
                <span className="csd-pill" style={{ background: 'rgba(255,250,240,.18)', color: C.cream }}>OPÉRATIONS</span>
              </div>

              <h1 className="csd-display" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, margin: 0, color: C.cream, letterSpacing: '-.03em' }}>
                Tableau de bord <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.greenDeep }}>commercial.</em>
              </h1>
              <p style={{ marginTop: 14, fontSize: 15, color: 'rgba(255,250,240,.85)', maxWidth: 540, lineHeight: 1.5 }}>
                Pipeline, leads chauds, prévisions et relances en temps réel — orchestrés par votre agent IA.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="csd-back-btn" style={{ padding: '12px 20px', fontSize: 14, fontWeight: 500, gap: 8, fontFamily: 'inherit' }}>
                <Filter size={15} /> Filtres
              </button>
              <Link to="/sales/leads" style={{ background: C.greenDeep, color: C.cream, padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px -8px rgba(6,61,46,.6)', textDecoration: 'none' }}>
                <Plus size={16} /> Nouveau lead
              </Link>
            </div>
          </div>
        </div>

        <SalesNav />

        {/* KPIs */}
        <div className="csd-kpi-grid" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 16 }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="csd-skel" />)
            : kpis.map(kpi => {
                const Icon = kpi.icon;
                const isOrange = kpi.style === 'orange';
                return (
                  <div key={kpi.id} className={`csd-kpi ${kpi.style}`}>
                    <span className="corner-mark"></span>
                    <div className={`csd-icon-badge ${isOrange ? 'cream-on-orange' : 'green'}`}>
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                      {kpi.prefix && (
                        <span className="csd-mono" style={{ fontSize: 14, color: isOrange ? 'rgba(255,250,240,.7)' : C.inkSoft, fontWeight: 600 }}>{kpi.prefix}</span>
                      )}
                      <span className="csd-display" style={{ fontSize: 38, fontWeight: 700, color: isOrange ? C.cream : C.ink, lineHeight: 1, letterSpacing: '-.02em' }}>{kpi.value}</span>
                      {kpi.suffix && (
                        <span className="csd-display" style={{ fontSize: 24, color: isOrange ? C.cream : C.ink, fontWeight: 600 }}>{kpi.suffix}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isOrange ? C.cream : C.ink, marginBottom: 10 }}>{kpi.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: isOrange ? 'rgba(255,250,240,.75)' : C.inkSoft }}>{kpi.sub}</span>
                      <span className="csd-pill" style={{ background: isOrange ? 'rgba(255,250,240,.2)' : C.greenSoft, color: isOrange ? C.cream : C.greenDeep }}>
                        {kpi.trendDir === 'up' && <ArrowUpRight size={10} />}
                        {kpi.trend}
                      </span>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* CHARTS ROW */}
        <div className="csd-charts" style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
          {/* Pipeline */}
          <div className="csd-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span className="csd-live-dot"></span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.orange, letterSpacing: '.08em' }}>EN DIRECT</span>
                </div>
                <h3 className="csd-display" style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: 0 }}>Pipeline par étape</h3>
                <p style={{ fontSize: 13, color: C.inkSoft, margin: '4px 0 0' }}>
                  {pipelineStages.reduce((s, p) => s + p.count, 0)} opportunités · <span className="csd-mono" style={{ color: C.ink, fontWeight: 600 }}>{symbol}{fmt(pipelineStages.reduce((s, p) => s + p.value, 0))}</span>
                </p>
              </div>
              <Link to="/sales/pipeline" className="csd-qa-light">Voir tout <ArrowRight size={14} /></Link>
            </div>

            {pipelineStages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.inkSoft }}>
                <TrendingUp size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ fontSize: 14 }}>Aucun lead dans le pipeline. <Link to="/sales/leads" style={{ color: C.orange, fontWeight: 600 }}>Créer un lead →</Link></p>
              </div>
            ) : (
              <div style={{ height: 240, display: 'flex', alignItems: 'flex-end', gap: 16, padding: '20px 0', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                  {[maxStageCount, Math.ceil(maxStageCount * 0.75), Math.ceil(maxStageCount * 0.5), Math.ceil(maxStageCount * 0.25), 0].map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="csd-mono" style={{ fontSize: 10, color: '#B5C0BA', width: 16 }}>{v}</span>
                      <div style={{ flex: 1, height: 1, borderTop: '1px dashed rgba(10,42,32,.08)' }}></div>
                    </div>
                  ))}
                </div>
                {pipelineStages.map((stage, idx) => (
                  <div key={stage.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 1, marginLeft: idx === 0 ? 24 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', width: '100%' }}>
                      <div className="csd-mono" style={{ fontSize: 11, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{symbol}{fmt(stage.value)}</div>
                      <div className="csd-stage-bar" style={{ background: stage.color, width: '70%', height: `${(stage.count / maxStageCount) * 100}%`, minHeight: 20 }}></div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{stage.name}</div>
                      <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>{stage.count} deals</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Donut */}
          <div className="csd-card">
            <div style={{ marginBottom: 20 }}>
              <h3 className="csd-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>Répartition leads</h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '4px 0 0' }}>Par température</p>
            </div>

            {leadDist.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft }}>
                <Target size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p style={{ fontSize: 13 }}>Aucun lead</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: '8px 0 16px' }}>
                  <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
                    {leadDist.map((slice, idx) => {
                      const fraction = slice.value / donutTotal;
                      const segLen = fraction * circumference;
                      const visibleArc = `${segLen} ${circumference}`;
                      const offset = -cumulativeOffset * circumference;
                      cumulativeOffset += fraction;
                      return <circle key={idx} cx="90" cy="90" r={radius} fill="none" stroke={slice.color} strokeWidth="22" strokeDasharray={visibleArc} strokeDashoffset={offset} />;
                    })}
                  </svg>
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <div className="csd-display" style={{ fontSize: 36, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-.02em' }}>{donutTotal}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4, letterSpacing: '.05em' }}>LEADS TOTAL</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {leadDist.map(slice => (
                    <div key={slice.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: slice.color }}></div>
                        <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{slice.label}</span>
                      </div>
                      <span className="csd-mono" style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>{slice.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RECENT LEADS */}
        <div style={{ marginTop: 20 }}>
          <div className="csd-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 className="csd-display" style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: 0 }}>
                Leads récents <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.orange, fontSize: 18 }}>— priorité haute</em>
              </h3>
              <Link to="/sales/leads" className="csd-qa-light">Tous les leads <ArrowRight size={14} /></Link>
            </div>

            {recentLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft }}>
                <Users size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p style={{ fontSize: 14 }}>Aucun lead pour le moment. <Link to="/sales/leads" style={{ color: C.orange, fontWeight: 600, textDecoration: 'none' }}>Créer le premier →</Link></p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recentLeads.map((lead, idx) => {
                  const heat = heatStyle(lead.score);
                  const colors = [C.greenDeep, C.orange, C.orangeDeep, C.greenMid];
                  return (
                    <Link key={lead.id} to={`/sales/leads/${lead.id}`} className="csd-lead-row" style={{ textDecoration: 'none' }}>
                      <div className="csd-avatar" style={{ background: colors[idx % colors.length] }}>{initials(lead.name)}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{lead.name}</div>
                        <div style={{ fontSize: 12, color: C.inkSoft }}>{lead.company || '—'}</div>
                      </div>
                      <span className="csd-pill" style={{ background: C.greenSoft, color: C.greenDeep }}>{STAGE_LABELS[lead.stage] ?? lead.stage}</span>
                      <span className="csd-pill" style={{ background: heat.bg, color: heat.dot }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: heat.dot, display: 'inline-block' }}></span>
                        {heat.label}
                      </span>
                      <span className="csd-mono" style={{ fontSize: 14, fontWeight: 600, color: C.ink, minWidth: 110, textAlign: 'right' }}>
                        {lead.estimatedValue ? `${fmt(lead.estimatedValue)} ${symbol}` : '—'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Empty state global */}
        {!loading && stats && stats.totalLeads === 0 && stats.totalClients === 0 && (
          <div style={{ marginTop: 20, textAlign: 'center', padding: 60, background: C.cream, borderRadius: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: C.orange, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, boxShadow: '0 8px 24px -8px rgba(255,107,26,.5)' }}>
              <Sparkles size={28} color={C.cream} />
            </div>
            <h3 className="csd-display" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Commencez votre activité commerciale</h3>
            <p style={{ fontSize: 13, color: C.inkSoft, marginBottom: 24 }}>Créez votre premier lead pour activer l'IA commerciale et démarrer le pipeline.</p>
            <Link to="/sales/leads" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, background: C.orange, color: C.cream, fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 8px 24px -8px rgba(255,107,26,.5)' }}>
              <Sparkles size={15} /> Créer un lead
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
