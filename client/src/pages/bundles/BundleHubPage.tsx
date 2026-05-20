/**
 * BundleHubPage — generic 4-agent pack hub factory.
 *
 * Same visual / functional template as PMEHubPage + EnterpriseHubPage (those
 * two stay as standalone files because their dashboard logic depends on
 * specific data sources — sales/comms/marketing/support and sales/finance/
 * support/comms respectively). For the other 11 marketplace bundles
 * (Santé, Artisan, Agriculture, Sécurité Totale/Site, Mode & Luxe,
 * Éducation, Super Pack, etc.) the hub is essentially:
 *
 *   - branded hero (palette per pack)
 *   - 4 ModuleCards linking to existing agent pages (or /marketplace if the
 *     agent doesn't have a dedicated admin page yet)
 *   - activity / insights / inbox tabs reusing shared components
 *
 * Use by composing a thin wrapper: `<BundleHubPage config={SANTE_CONFIG} />`.
 * Lines saved per pack = ~400 (the wrapper is ~30 lines).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import {
  ArrowRight, Loader2, TrendingUp, Sparkles, Activity as ActivityIcon,
  LayoutDashboard, Inbox, BarChart3, Settings, Plus, Package, MessageCircle,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { InboxTab } from '@/components/inbox/InboxTab';
import VoiceAssistantFAB from '@/components/ai/VoiceAssistantFAB';

const C = {
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  creamWarm:   '#FAEBD7',
  gold:        '#D4A017',
  goldDeep:    '#B8860B',
  goldSoft:    '#FEF3C7',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  whatsappSoft:'#DCF8C6',
  coralDeep:   '#E11D48',
  purple:      '#7C3AED',
  purpleSoft:  '#EDE9FE',
  purpleDeep:  '#5B21B6',
};

export interface BundleAgent {
  /** Existing admin route to deep-link to (e.g. `/sales`, `/agents/cabinet`). */
  href: string;
  emoji: string;
  label: string;
  desc: string;
  color: string;
  bg: string;
  /** Function that returns the live count for this agent (best-effort). */
  fetchCount?: () => Promise<number>;
  countLabel?: string;
}

export interface BundleConfig {
  /** URL slug — also used for analytics. */
  slug: string;
  /** Display name (without the "Pack " prefix). */
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  /** Primary hero gradient color (3 stops). */
  primary: string;
  primaryDeep: string;
  primaryInk: string;
  primaryLight: string;
  agents: BundleAgent[];
  /** Optional primary CTA in the hero (defaults to /marketplace). */
  cta?: { label: string; href: string; icon?: any };
}

const STYLES = (primary: string, primaryDeep: string, primaryLight: string) => `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  .spin { animation: spin .9s linear infinite; }
  @keyframes slowRotate { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  .slow-rotate { animation: slowRotate 35s linear infinite; }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.6); opacity: 0; } }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${primary}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${primary}; opacity: .4; animation: pulse 1.8s infinite; }
  @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  .shimmer-text {
    background: linear-gradient(90deg, ${primaryLight}, ${C.gold}, ${primaryLight});
    background-size: 200% auto; background-clip: text;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }
  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }
  .bundle-page { font-family: 'Inter', sans-serif; color: ${C.ink}; background: ${C.creamWarm}; min-height: 100vh; padding-bottom: 90px; }
  .bundle-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
  .bundle-tab-strip { display: flex; gap: 4px; overflow-x: auto; padding: 6px 0; border-bottom: 1px solid rgba(10,42,32,.08); margin-bottom: 18px; }
  .bundle-tab { padding: 10px 16px; border-radius: 10px 10px 0 0; font-size: 13px; font-weight: 600; color: ${C.inkSoft}; background: transparent; border: none; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .bundle-tab.active { color: ${primaryDeep}; background: ${C.cream}; border-bottom: 2px solid ${primaryDeep}; }
  .bundle-tab:hover:not(.active) { background: ${C.creamDeep}; color: ${C.ink}; }
  .card { background: ${C.cream}; border-radius: 16px; padding: 18px; border: 1px solid rgba(10,42,32,.06); }
  .card-lift { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
  .card-lift:hover { transform: translateY(-3px); }
  @media (max-width: 768px) { .bundle-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .bundle-grid-3 { grid-template-columns: 1fr !important; } }
  @media (max-width: 480px) { .bundle-grid-4 { grid-template-columns: 1fr !important; } .hero-bundle-title { font-size: 26px !important; } .hero-bundle-pad { padding: 18px 18px !important; } }
`;

type TabId = 'dashboard' | 'agents' | 'insights' | 'inbox';

export default function BundleHubPage({ config }: { config: BundleConfig }) {
  const company = useAuthStore(s => s.company);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [counts, setCounts] = useState<number[]>(() => config.agents.map(() => 0));
  const [insights, setInsights] = useState<Array<{ id: string; title: string; desc: string; severity?: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Fetch live counts for each agent in parallel + insights.
  useEffect(() => {
    Promise.all([
      ...config.agents.map(a => a.fetchCount ? a.fetchCount().catch(() => 0) : Promise.resolve(0)),
      api.get('/insights/active').catch(() => ({ data: [] })),
    ]).then((results: any[]) => {
      const cnts = results.slice(0, config.agents.length) as number[];
      setCounts(cnts);
      const insightsRes = results[config.agents.length];
      const list = (insightsRes?.data?.data ?? insightsRes?.data ?? []) as any[];
      setInsights(Array.isArray(list) ? list.slice(0, 5) : []);
    }).finally(() => setLoading(false));
  }, [config.slug]);

  const totalActions = useMemo(() => counts.reduce((a, b) => a + b, 0), [counts]);

  return (
    <div className="bundle-page">
      <style>{STYLES(config.primary, config.primaryDeep, config.primaryLight)}</style>

      {/* Hero */}
      <div className="hero-bundle-pad" style={{
        position: 'relative',
        background: `linear-gradient(135deg, ${config.primaryInk} 0%, ${config.primaryDeep} 50%, ${config.primary} 130%)`,
        color: C.cream, padding: '32px 36px', overflow: 'hidden',
      }}>
        <div className="grain" />
        <div className="slow-rotate" style={{ position: 'absolute', top: -130, right: -130, width: 420, height: 420, borderRadius: '50%', border: `1px dashed ${config.primaryLight}30` }} />
        <div className="slow-rotate" style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, borderRadius: '50%', border: `1px dashed ${C.goldSoft}30`, animationDirection: 'reverse', animationDuration: '50s' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3, pointerEvents: 'none' }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <circle key={i} cx={`${(i * 37) % 100}%`} cy={`${(i * 71) % 100}%`} r={((i * 11) % 12) / 7 + 0.3} fill={i % 2 === 0 ? C.goldSoft : config.primaryLight} opacity={0.4 + ((i * 13) % 60) / 200} />
          ))}
        </svg>

        <div className="bundle-container" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, border: `1px solid ${C.goldSoft}30` }}>
            <span style={{ fontSize: 14 }}>{config.emoji}</span> PACK {config.name.toUpperCase()} · {config.agents.length} AGENTS · WHATSAPP
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h1 className="display-font hero-bundle-title" style={{ fontSize: 'clamp(30px, 5vw, 44px)', fontWeight: 800, margin: 0, lineHeight: 1.05 }}>
                {company?.name ? company.name.split(' ')[0] : 'Pack'}{' '}
                <em className="shimmer-text" style={{ fontStyle: 'italic', fontWeight: 500 }}>{config.name}</em>
              </h1>
              <p style={{ marginTop: 10, fontSize: 14, color: 'rgba(255,250,240,.85)', maxWidth: 620, lineHeight: 1.5 }}>
                {config.tagline} — depuis <strong style={{ color: C.whatsappSoft }}>WhatsApp</strong>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {config.cta && (
                <Link to={config.cta.href} style={{
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: config.primaryInk,
                  textDecoration: 'none', padding: '11px 18px', borderRadius: 12,
                  fontWeight: 800, fontSize: 13, fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  boxShadow: `0 10px 24px -10px ${C.gold}80`,
                }}>
                  {config.cta.icon ? <config.cta.icon size={13} /> : <Plus size={13} />} {config.cta.label}
                </Link>
              )}
              <Link to="/admin" style={{
                background: 'rgba(255,250,240,.1)', color: C.cream,
                textDecoration: 'none', padding: '11px 16px', borderRadius: 12,
                fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                border: '1px solid rgba(255,250,240,.2)',
              }}>
                <Settings size={13} /> Paramètres
              </Link>
            </div>
          </div>

          {/* KPI strip — 1 per agent */}
          <div className="bundle-grid-4" style={{ marginTop: 22, display: 'grid', gridTemplateColumns: `repeat(${Math.min(config.agents.length, 4)}, 1fr)`, gap: 12 }}>
            {config.agents.slice(0, 4).map((a, i) => (
              <div key={a.href + i} style={{
                background: 'rgba(255,250,240,.14)', backdropFilter: 'blur(10px)',
                borderRadius: 14, padding: '14px 16px',
                border: `1px solid ${a.color}30`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{a.emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', opacity: 0.92, textTransform: 'uppercase' }}>
                    {a.countLabel ?? a.label}
                  </span>
                </div>
                <div className="display-font" style={{ fontSize: 28, fontWeight: 800 }}>{counts[i] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bundle-container">
        <div className="bundle-tab-strip" role="tablist">
          {([
            { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard, badge: null },
            { id: 'agents',    label: 'Agents',     icon: Package,         badge: config.agents.length },
            { id: 'insights',  label: 'Insights IA',icon: Sparkles,        badge: insights.length },
            { id: 'inbox',     label: 'Inbox',      icon: Inbox,           badge: null },
          ] as Array<{ id: TabId; label: string; icon: any; badge: number | null }>).map(t => (
            <button key={t.id} className={`bundle-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <t.icon size={14} /> {t.label}
              {t.badge != null && t.badge > 0 && (
                <span style={{ background: tab === t.id ? config.primaryDeep : C.creamDeep, color: tab === t.id ? C.cream : C.inkSoft, fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <DashboardTab config={config} counts={counts} loading={loading} totalActions={totalActions} />
        )}
        {tab === 'agents' && (
          <AgentsTab config={config} counts={counts} loading={loading} />
        )}
        {tab === 'insights' && (
          <InsightsTab insights={insights} loading={loading} primaryDeep={config.primaryDeep} />
        )}
        {tab === 'inbox' && (
          <InboxTab
            accent={config.primary} accentDeep={config.primaryDeep}
            ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
            cream={C.cream} creamDeep={C.creamDeep}
            emptyHint="Dès qu'un client écrit (un des agents du pack), sa conversation arrive ici."
          />
        )}
      </div>

      <VoiceAssistantFAB
        agentName={`Assistant ${config.name}`}
        systemInstruction={`Tu es l'assistant vocal du pack ${config.name} de ${company?.name ?? 'mon entreprise'}. ${config.description} Sois concis, francophone, oriente vers le bon agent du pack.`}
      />
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function DashboardTab({ config, counts, loading, totalActions }: {
  config: BundleConfig; counts: number[]; loading: boolean; totalActions: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 30 }}>
      {/* Focus du jour */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: `${config.primary}1a`, color: config.primaryDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="display-font" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
              Focus du <em style={{ fontStyle: 'italic', color: config.primaryDeep }}>jour</em>
            </h3>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>
              {totalActions === 0
                ? `Aucune urgence sur les ${config.agents.length} agents. Bonne journée 🌟`
                : `${totalActions} élément${totalActions > 1 ? 's' : ''} actif${totalActions > 1 ? 's' : ''} à travers ${config.agents.length} agents.`}
            </p>
          </div>
        </div>
        {totalActions > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {config.agents.map((a, i) => counts[i] > 0 && (
              <Link key={a.href + i} to={a.href} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 11,
                background: a.bg, textDecoration: 'none',
                borderLeft: `3px solid ${a.color}`,
                transition: 'transform .15s ease',
              }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateX(3px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateX(0)'}>
                <span style={{ fontSize: 18 }}>{a.emoji}</span>
                <span style={{ flex: 1, fontSize: 13, color: C.ink, fontWeight: 600 }}>
                  {counts[i]} {a.countLabel?.toLowerCase() ?? a.label.toLowerCase()}
                </span>
                <ArrowRight size={14} color={a.color} />
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ padding: 22, textAlign: 'center', background: C.creamDeep, borderRadius: 12 }}>
            <TrendingUp size={28} color={config.primaryDeep} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}>Tu es à jour</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>{loading ? 'Synchronisation en cours…' : 'Aucune urgence — bon moment pour anticiper la prochaine action.'}</div>
          </div>
        )}
      </div>

      {/* Description card */}
      <div className="card" style={{ padding: 22 }}>
        <h3 className="display-font" style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>
          À propos de ce <em style={{ fontStyle: 'italic', color: config.primaryDeep }}>pack</em>
        </h3>
        <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>
          {config.description}
        </p>
      </div>

      {/* Module cards inline */}
      <AgentsTab config={config} counts={counts} loading={loading} compact />
    </div>
  );
}

function AgentsTab({ config, counts, loading, compact }: {
  config: BundleConfig; counts: number[]; loading: boolean; compact?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 className="display-font" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
              Tes <em style={{ fontStyle: 'italic', color: config.primaryDeep }}>{config.agents.length} agents</em>
            </h3>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>Click un agent pour ouvrir sa page dédiée.</p>
          </div>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkSoft }}>
              <Loader2 size={14} className="spin" /> Sync stats…
            </div>
          )}
        </div>
      )}
      <div className="bundle-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {config.agents.map((a, i) => (
          <Link key={a.href + i} to={a.href} className="card-lift" style={{
            display: 'block', textDecoration: 'none', color: 'inherit',
            background: C.cream, borderRadius: 16, padding: 18,
            border: '1px solid rgba(10,42,32,.06)',
            borderLeft: `4px solid ${a.color}`,
          }}
            onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 16px 36px -16px ${a.color}50`; }}
            onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none'; }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: a.bg, color: a.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, boxShadow: `0 8px 18px -8px ${a.color}50`,
              }}>
                {a.emoji}
              </div>
              <ArrowRight size={16} color={C.inkLight} />
            </div>
            <h4 className="display-font" style={{ fontSize: 17, fontWeight: 800, margin: 0, color: C.ink }}>{a.label}</h4>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 12px', lineHeight: 1.5 }}>{a.desc}</p>
            {a.fetchCount && (
              <div style={{ paddingTop: 10, borderTop: '1px solid rgba(10,42,32,.06)' }}>
                <div className="mono-font" style={{ fontSize: 16, fontWeight: 800, color: a.color, lineHeight: 1 }}>
                  {counts[i] ?? 0}
                </div>
                <div style={{ fontSize: 10, color: C.inkLight, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {a.countLabel ?? 'live'}
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function InsightsTab({ insights, loading, primaryDeep }: {
  insights: Array<{ id: string; title: string; desc: string; severity?: string }>;
  loading: boolean; primaryDeep: string;
}) {
  return (
    <div className="card" style={{ minHeight: 360 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: C.purpleSoft, color: C.purpleDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="display-font" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
            Insights <em style={{ fontStyle: 'italic', color: C.purpleDeep }}>cross-modules</em>
          </h3>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>L'IA détecte les opportunités à travers tous les agents du pack.</p>
        </div>
        {loading && <Loader2 size={14} className="spin" style={{ marginLeft: 'auto' }} color={C.inkSoft} />}
      </div>
      {insights.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.inkSoft, background: C.creamDeep, borderRadius: 12 }}>
          <BarChart3 size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Pas encore d'insight</div>
          <div style={{ fontSize: 12, maxWidth: 380, margin: '0 auto', lineHeight: 1.5 }}>
            L'agent Insights analyse tes données et propose des recommandations.{' '}
            <Link to="/insights" style={{ color: primaryDeep, fontWeight: 700 }}>Ouvrir Insights →</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insights.map(i => (
            <div key={i.id} className="card-lift" style={{
              padding: 14, borderRadius: 12, background: C.creamDeep,
              borderLeft: `3px solid ${i.severity === 'urgent' ? C.coralDeep : C.purpleDeep}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{i.title}</div>
              <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>{i.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Catalog of bundle configs ────────────────────────────────────────────────
// Each pack maps to its 4 (or 8 for Super) agents with their existing routes.
// Agents that don't have a dedicated page yet link to /marketplace where they
// can be discovered / activated.

const safeCount = async (endpoint: string): Promise<number> => {
  try {
    const r: any = await api.get(endpoint);
    const list = r?.data?.data ?? r?.data ?? [];
    return Array.isArray(list) ? list.length : 0;
  } catch { return 0; }
};

export const BUNDLE_CONFIGS: Record<string, BundleConfig> = {
  sante: {
    slug: 'sante', name: 'Santé', emoji: '🏥',
    tagline: 'Patients, formations, prescriptions et base médicale',
    description: 'Dossier patient, formation continue, validation prescriptions et base de connaissances médicale.',
    primary: '#EF4444', primaryDeep: '#B91C1C', primaryInk: '#7F1D1D', primaryLight: '#FCA5A5',
    agents: [
      { href: '/agents/cabinet', emoji: '🩺', label: 'Cabinet',       desc: 'Patients, RDV, dossiers confidentiels.',  color: '#0F766E', bg: '#CCFBF1', fetchCount: () => safeCount('/cabinet/patients'), countLabel: 'Patients' },
      { href: '/training',       emoji: '🎓', label: 'Formation',     desc: 'Cours, quiz, certifications.',             color: '#7C3AED', bg: '#EDE9FE', fetchCount: () => safeCount('/training/courses'), countLabel: 'Cours' },
      { href: '/legal',          emoji: '📋', label: 'Validation',    desc: 'Workflows d\'approbation prescriptions.',  color: '#0EA5E9', bg: '#E0F2FE' },
      { href: '/knowledge',      emoji: '📚', label: 'Knowledge',     desc: 'Base médicale RAG sur tous tes docs.',     color: '#D97706', bg: '#FEF3C7' },
    ],
    cta: { label: 'Nouveau patient', href: '/agents/cabinet' },
  },

  artisan: {
    slug: 'artisan', name: 'Artisan', emoji: '🛠️',
    tagline: 'Menuiserie, dépannage, suivi chantier et compta OHADA',
    description: 'Bundle pour artisans BTP : devis et factures auto, suivi de chantier, dépannage et menuiserie. Comptabilité OHADA intégrée.',
    primary: '#F59E0B', primaryDeep: '#B45309', primaryInk: '#78350F', primaryLight: '#FCD34D',
    agents: [
      { href: '/marketplace', emoji: '🪚', label: 'Menuiserie',    desc: 'Devis sur mesure, planning chantier.',     color: '#B45309', bg: '#FEF3C7' },
      { href: '/marketplace', emoji: '🔧', label: 'Dépannage',     desc: 'Interventions urgentes, planning équipe.',  color: '#DC2626', bg: '#FEE2E2' },
      { href: '/marketplace', emoji: '🏗️', label: 'BTP',          desc: 'Suivi de chantier, matériaux, livraisons.', color: '#0EA5E9', bg: '#E0F2FE' },
      { href: '/finance',     emoji: '💰', label: 'Comptabilité', desc: 'OHADA, factures, paie. Conforme DGI.',     color: '#059669', bg: '#D1FAE5', fetchCount: () => safeCount('/finance/invoices'), countLabel: 'Factures' },
    ],
    cta: { label: 'Nouveau devis', href: '/sales/quotes' },
  },

  agriculture: {
    slug: 'agriculture', name: 'Agriculture', emoji: '🌾',
    tagline: 'Agronomie, élevage, topographie et compta coopérative',
    description: 'Tout le cycle de la ferme : agronomie, élevage, géomètre/topographie et comptabilité de coopérative agricole.',
    primary: '#10B981', primaryDeep: '#047857', primaryInk: '#064E3B', primaryLight: '#6EE7B7',
    agents: [
      { href: '/marketplace', emoji: '🌱', label: 'Agronomie',  desc: 'Conseils cultures, rotation, intrants.',   color: '#059669', bg: '#D1FAE5' },
      { href: '/marketplace', emoji: '🐄', label: 'Élevage',    desc: 'Vaccinations, ration, suivi troupeau.',   color: '#B45309', bg: '#FEF3C7' },
      { href: '/marketplace', emoji: '📐', label: 'Géomètre',   desc: 'Cadastre, parcelles, levés topographiques.', color: '#0EA5E9', bg: '#E0F2FE' },
      { href: '/finance',     emoji: '💰', label: 'Comptabilité', desc: 'Compta coop, subventions, ventes lots.', color: '#7C3AED', bg: '#EDE9FE', fetchCount: () => safeCount('/finance/invoices'), countLabel: 'Factures' },
    ],
    cta: { label: 'Marketplace', href: '/marketplace' },
  },

  'securite-totale': {
    slug: 'securite-totale', name: 'Sécurité Totale', emoji: '🛡️',
    tagline: 'Gardes, caméras IA, communications chiffrées, SOC virtuel',
    description: 'Protection 360° : sécurité physique (gardes), surveillance IA des caméras, communications chiffrées (CallShield) et cybersécurité (SOC virtuel).',
    primary: '#DC2626', primaryDeep: '#991B1B', primaryInk: '#7F1D1D', primaryLight: '#FCA5A5',
    agents: [
      { href: '/marketplace', emoji: '👮', label: 'Sécurité physique', desc: 'Gardes, rondes, badges d\'accès.',      color: '#7F1D1D', bg: '#FEE2E2' },
      { href: '/marketplace', emoji: '📹', label: 'Surveillance IA',   desc: 'Détection événements caméras live.',    color: '#0369A1', bg: '#E0F2FE' },
      { href: '/marketplace', emoji: '🔒', label: 'CallShield',         desc: 'Communications chiffrées E2E.',          color: '#7C3AED', bg: '#EDE9FE' },
      { href: '/security',    emoji: '🛡️', label: 'Cybersécurité',      desc: 'SOC virtuel, audit, RGPD.',              color: '#D97706', bg: '#FEF3C7', fetchCount: () => safeCount('/security/incidents'), countLabel: 'Incidents' },
    ],
    cta: { label: 'Centre Sécurité', href: '/security' },
  },

  'securite-site': {
    slug: 'securite-site', name: 'Sécurité Site', emoji: '📹',
    tagline: 'Gardes site, caméras IA, cybersécurité périmétrique',
    description: 'Protection d\'un site unique : gardes, caméras IA, cybersécurité périmétrique et workflows d\'approbation.',
    primary: '#475569', primaryDeep: '#1E293B', primaryInk: '#0F172A', primaryLight: '#94A3B8',
    agents: [
      { href: '/marketplace', emoji: '👮', label: 'Gardes site',      desc: 'Planning gardes, registre visiteurs.', color: '#7F1D1D', bg: '#FEE2E2' },
      { href: '/marketplace', emoji: '📹', label: 'Surveillance IA',  desc: 'Caméras + détection intrusion.',        color: '#0369A1', bg: '#E0F2FE' },
      { href: '/security',    emoji: '🛡️', label: 'Cybersécurité',    desc: 'Réseau interne, audit, conformité.',    color: '#D97706', bg: '#FEF3C7', fetchCount: () => safeCount('/security/incidents'), countLabel: 'Incidents' },
      { href: '/workflow',    emoji: '✅', label: 'Approbation',     desc: 'Workflows accès, autorisations.',       color: '#059669', bg: '#D1FAE5' },
    ],
    cta: { label: 'Centre Sécurité', href: '/security' },
  },

  mode: {
    slug: 'mode', name: 'Mode & Luxe', emoji: '👗',
    tagline: 'Concept stores premium — stocks, styliste IA, ventes, marketing',
    description: 'Boutique mode : stocks et variantes, styliste IA pour conseils, ventes WhatsApp et campagnes marketing automatisées.',
    primary: '#EC4899', primaryDeep: '#BE185D', primaryInk: '#831843', primaryLight: '#F9A8D4',
    agents: [
      { href: '/agents/commerce', emoji: '👗', label: 'Boutique mode', desc: 'Variantes tailles/couleurs, stock multi-magasins.', color: '#BE185D', bg: '#FCE7F3', fetchCount: () => safeCount('/commerce/stores'), countLabel: 'Boutiques' },
      { href: '/marketplace',     emoji: '💄', label: 'Styliste IA',   desc: 'Conseils tenue + matchmaking produits.',           color: '#7C3AED', bg: '#EDE9FE' },
      { href: '/sales',           emoji: '💼', label: 'Sales · CRM',  desc: 'Pipeline VIP, devis sur mesure.',                 color: '#0EA5E9', bg: '#E0F2FE', fetchCount: () => safeCount('/sales/leads'), countLabel: 'Leads' },
      { href: '/marketing',       emoji: '📣', label: 'Marketing',     desc: 'Campagnes Insta/FB/TikTok automatisées.',         color: '#D97706', bg: '#FEF3C7', fetchCount: () => safeCount('/marketing/campaigns'), countLabel: 'Campagnes' },
    ],
    cta: { label: 'Ouvrir ma boutique', href: '/agents/commerce' },
  },

  education: {
    slug: 'education', name: 'Éducation', emoji: '🎓',
    tagline: 'Cours, coaching, inscriptions et base pédagogique',
    description: 'Enseignement et coaching : gestion des cours, accompagnement individuel, validation des inscriptions et base de connaissances pédagogique.',
    primary: '#6366F1', primaryDeep: '#4338CA', primaryInk: '#312E81', primaryLight: '#A5B4FC',
    agents: [
      { href: '/training',     emoji: '🎓', label: 'Formation',  desc: 'Cours, quiz, certificats, leaderboard.',  color: '#4338CA', bg: '#E0E7FF', fetchCount: () => safeCount('/training/courses'), countLabel: 'Cours' },
      { href: '/marketplace',  emoji: '🧑‍🏫', label: 'Coach IA',   desc: 'Accompagnement individuel post-cours.',   color: '#7C3AED', bg: '#EDE9FE' },
      { href: '/workflow',     emoji: '✅', label: 'Approbation', desc: 'Validation inscriptions + bourses.',     color: '#059669', bg: '#D1FAE5' },
      { href: '/knowledge',    emoji: '📚', label: 'Knowledge',   desc: 'Base pédagogique RAG.',                  color: '#D97706', bg: '#FEF3C7' },
    ],
    cta: { label: 'Nouveau cours', href: '/training' },
  },

  super: {
    slug: 'super', name: 'Super Entreprise', emoji: '👑',
    tagline: 'La stack complète — 8 agents métiers pour scaler',
    description: 'Stack tout-en-un pour entreprises moyennes/grandes : ventes, marketing, comms, support, compta, RH, accueil, cybersécurité + Knowledge brain RAG + Workflows d\'approbation. -25% vs achat séparé.',
    primary: '#F59E0B', primaryDeep: '#B45309', primaryInk: '#78350F', primaryLight: '#FCD34D',
    agents: [
      { href: '/sales',       emoji: '💼', label: 'Sales · CRM',    desc: 'Pipeline, leads, deals, clients.',     color: '#0EA5E9', bg: '#E0F2FE', fetchCount: () => safeCount('/sales/leads'),     countLabel: 'Leads' },
      { href: '/marketing',   emoji: '📣', label: 'Marketing',      desc: 'Campagnes, ROI, segmentations.',        color: '#EC4899', bg: '#FCE7F3', fetchCount: () => safeCount('/marketing/campaigns'), countLabel: 'Campagnes' },
      { href: '/comms',       emoji: '✉️', label: 'Communications',  desc: 'Email · WhatsApp · Telegram.',           color: '#7C3AED', bg: '#EDE9FE', fetchCount: () => safeCount('/comms/messages'), countLabel: 'Messages' },
      { href: '/support',     emoji: '🆘', label: 'Support',        desc: 'Tickets, SLA, KB.',                    color: '#F59E0B', bg: '#FEF3C7', fetchCount: () => safeCount('/support/tickets'), countLabel: 'Tickets' },
      { href: '/finance',     emoji: '💰', label: 'Comptabilité',   desc: 'Factures, paiements, budget.',          color: '#10B981', bg: '#D1FAE5', fetchCount: () => safeCount('/finance/invoices'), countLabel: 'Factures' },
      { href: '/hr',          emoji: '👥', label: 'RH',              desc: 'Effectifs, congés, paie OHADA.',         color: '#6366F1', bg: '#E0E7FF' },
      { href: '/reception',   emoji: '🚪', label: 'Réception',       desc: 'Accueil, badges, kiosk.',               color: '#06B6D4', bg: '#CFFAFE' },
      { href: '/security',    emoji: '🛡️', label: 'Cybersécurité',   desc: 'SOC, audit, RGPD.',                     color: '#DC2626', bg: '#FEE2E2', fetchCount: () => safeCount('/security/incidents'), countLabel: 'Incidents' },
    ],
    cta: { label: 'Marketplace', href: '/marketplace' },
  },
};

// ── Thin wrappers per pack — one per route ───────────────────────────────────
export const SantePack       = () => <BundleHubPage config={BUNDLE_CONFIGS.sante} />;
export const ArtisanPack     = () => <BundleHubPage config={BUNDLE_CONFIGS.artisan} />;
export const AgriculturePack = () => <BundleHubPage config={BUNDLE_CONFIGS.agriculture} />;
export const SecuriteTotPack = () => <BundleHubPage config={BUNDLE_CONFIGS['securite-totale']} />;
export const SecuriteSitePack = () => <BundleHubPage config={BUNDLE_CONFIGS['securite-site']} />;
export const ModePack        = () => <BundleHubPage config={BUNDLE_CONFIGS.mode} />;
export const EducationPack   = () => <BundleHubPage config={BUNDLE_CONFIGS.education} />;
export const SuperPack       = () => <BundleHubPage config={BUNDLE_CONFIGS.super} />;
