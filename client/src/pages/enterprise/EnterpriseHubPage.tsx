/**
 * Pack Entreprise — hub redesigné au niveau des verticales.
 *
 * Bundle de 4 modules : Sales, Comptabilité, Support, Communications.
 * Jumeau du PMEHubPage avec un mix différent (Compta au lieu de Marketing) +
 * une palette cyan / azur pour le différencier visuellement.
 *
 * Mêmes tabs : Dashboard · Activité · Insights IA · Inbox.
 * Toutes les data en parallèle, voice FAB, responsive mobile.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import {
  Briefcase, Mail, DollarSign, LifeBuoy, ArrowRight, Loader2,
  TrendingUp, Sparkles, MessageCircle, FileText,
  Activity as ActivityIcon, LayoutDashboard, Inbox, BarChart3,
  Settings, Plus, Building2, Receipt,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { InboxTab } from '@/components/inbox/InboxTab';
import VoiceAssistantFAB from '@/components/ai/VoiceAssistantFAB';

const C = {
  // Pack Entreprise palette — cyan / azur / cream
  cyanInk:    '#082E40',
  cyanDeep:   '#0E7490',
  cyanDark:   '#155E75',
  cyan:       '#06B6D4',
  cyanSoft:   '#CFFAFE',
  cyanLight:  '#67E8F9',
  gold:       '#D4A017',
  goldDeep:   '#B8860B',
  goldSoft:   '#FEF3C7',
  cream:      '#FFFAF0',
  creamDeep:  '#F5EDD6',
  creamWarm:  '#FAEBD7',
  ink:        '#0A2A20',
  inkSoft:    '#5A6B62',
  inkLight:   '#94A3A0',
  whatsapp:   '#25D366',
  whatsappSoft:'#DCF8C6',
  // Module accents
  blue:       '#0EA5E9',
  blueSoft:   '#E0F2FE',
  blueDeep:   '#0284C7',
  green:      '#10B981',
  greenSoft:  '#D1FAE5',
  greenDeep:  '#059669',
  yellow:     '#F59E0B',
  yellowSoft: '#FEF3C7',
  yellowDeep: '#D97706',
  purple:     '#7C3AED',
  purpleSoft: '#EDE9FE',
  purpleDeep: '#5B21B6',
  coral:      '#FB7185',
  coralDeep:  '#E11D48',
  red:        '#EF4444',
  redSoft:    '#FEE2E2',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  .spin { animation: spin .9s linear infinite; }
  @keyframes slowRotate { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  .slow-rotate { animation: slowRotate 35s linear infinite; }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity: .55; } 50% { transform: scale(1.6); opacity: 0; } }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.cyan}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.cyan}; opacity: .4; animation: pulse 1.8s infinite; }
  @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  .shimmer-text {
    background: linear-gradient(90deg, ${C.cyanLight}, ${C.gold}, ${C.cyanLight});
    background-size: 200% auto; background-clip: text;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }
  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }
  .ent-page { font-family: 'Inter', sans-serif; color: ${C.ink}; background: ${C.creamWarm}; min-height: 100vh; padding-bottom: 90px; }
  .ent-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
  .ent-tab-strip { display: flex; gap: 4px; overflow-x: auto; padding: 6px 0; border-bottom: 1px solid rgba(10,42,32,.08); margin-bottom: 18px; }
  .ent-tab { padding: 10px 16px; border-radius: 10px 10px 0 0; font-size: 13px; font-weight: 600; color: ${C.inkSoft}; background: transparent; border: none; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .ent-tab.active { color: ${C.cyanDeep}; background: ${C.cream}; border-bottom: 2px solid ${C.cyanDeep}; }
  .ent-tab:hover:not(.active) { background: ${C.creamDeep}; color: ${C.ink}; }
  .card { background: ${C.cream}; border-radius: 16px; padding: 18px; border: 1px solid rgba(10,42,32,.06); }
  .card-lift { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
  .card-lift:hover { transform: translateY(-3px); }
  @media (max-width: 768px) { .ent-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .ent-grid-3 { grid-template-columns: 1fr !important; } }
  @media (max-width: 480px) { .ent-grid-4 { grid-template-columns: 1fr !important; } .hero-ent-title { font-size: 28px !important; } .hero-ent-pad { padding: 18px 18px !important; } }
`;

type TabId = 'dashboard' | 'activity' | 'insights' | 'inbox';

interface ModuleStats {
  sales:      { leads: number; pipeline: number; clients: number };
  accounting: { invoices: number; pending: number; overdue: number };
  support:    { open: number; total: number };
  comms:      { conversations: number };
}

interface ActivityItem {
  id: string; kind: 'lead' | 'invoice' | 'ticket' | 'message';
  title: string; desc: string; time: number;
  color: string; icon: any; href: string;
}

export default function EnterpriseHubPage() {
  const company = useAuthStore(s => s.company);
  const [tab, setTab] = useState<TabId>('dashboard');
  const [stats, setStats] = useState<ModuleStats>({
    sales: { leads: 0, pipeline: 0, clients: 0 },
    accounting: { invoices: 0, pending: 0, overdue: 0 },
    support: { open: 0, total: 0 },
    comms: { conversations: 0 },
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [insights, setInsights] = useState<Array<{ id: string; title: string; desc: string; severity?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/sales/leads').catch(() => ({ data: [] })),
      api.get('/sales/quotes').catch(() => ({ data: [] })),
      api.get('/sales/clients').catch(() => ({ data: [] })),
      api.get('/finance/invoices').catch(() => ({ data: [] })),
      api.get('/support/tickets').catch(() => ({ data: [] })),
      api.get('/comms/messages').catch(() => ({ data: [] })),
      api.get('/insights/active').catch(() => ({ data: [] })),
    ]).then(([leadsR, quotesR, clientsR, invoicesR, ticketsR, commsR, insightsR]: any[]) => {
      const leads = unwrap<any[]>(leadsR.data, []);
      const quotes = unwrap<any[]>(quotesR.data, []);
      const clients = unwrap<any[]>(clientsR.data, []);
      const invoices = unwrap<any[]>(invoicesR.data, []);
      const tickets = unwrap<any[]>(ticketsR.data, []);
      const convos = unwrap<any[]>(commsR.data, []);
      const insightsList = unwrap<any[]>(insightsR.data, []);

      setStats({
        sales: {
          leads: leads.filter((l: any) => l?.status !== 'closed_won' && l?.status !== 'closed_lost').length,
          pipeline: quotes.length,
          clients: clients.length,
        },
        accounting: {
          invoices: invoices.length,
          pending: invoices.filter((i: any) => i?.status === 'sent' || i?.status === 'pending').length,
          overdue: invoices.filter((i: any) => i?.status === 'overdue').length,
        },
        support: {
          open: tickets.filter((t: any) => t?.status !== 'resolved' && t?.status !== 'closed').length,
          total: tickets.length,
        },
        comms: { conversations: convos.length },
      });
      setInsights(Array.isArray(insightsList) ? insightsList.slice(0, 5) : []);

      const feed: ActivityItem[] = [];
      leads.slice(0, 4).forEach((l: any) => feed.push({
        id: `lead:${l.id}`, kind: 'lead',
        title: `Lead · ${l.name ?? l.fullName ?? 'Sans nom'}`,
        desc: l.email ?? l.phone ?? l.company ?? '—',
        time: getMs(l.createdAt ?? l.updatedAt),
        color: C.blue, icon: Briefcase, href: '/sales/leads',
      }));
      invoices.slice(0, 4).forEach((i: any) => feed.push({
        id: `inv:${i.id}`, kind: 'invoice',
        title: `Facture · ${i.client ?? i.customerName ?? 'Sans client'}`,
        desc: `${i.amount ?? 0} · ${i.status ?? '—'}`,
        time: getMs(i.createdAt ?? i.issuedAt),
        color: C.green, icon: Receipt, href: '/finance',
      }));
      tickets.slice(0, 4).forEach((t: any) => feed.push({
        id: `tk:${t.id}`, kind: 'ticket',
        title: `Ticket · ${t.subject ?? 'Support'}`,
        desc: `${t.priority ?? 'normal'} · ${t.status ?? 'open'}`,
        time: getMs(t.createdAt ?? t.updatedAt),
        color: C.yellow, icon: LifeBuoy, href: '/support',
      }));
      convos.slice(0, 3).forEach((c: any) => feed.push({
        id: `msg:${c.id ?? c.threadId}`, kind: 'message',
        title: `Message · ${c.from ?? c.contactName ?? 'WhatsApp'}`,
        desc: (c.body ?? c.lastMessage ?? '').slice(0, 60),
        time: getMs(c.createdAt ?? c.lastAt),
        color: C.purple, icon: MessageCircle, href: '/admin/inbox',
      }));
      setActivity(feed.sort((a, b) => b.time - a.time).slice(0, 12));
    }).finally(() => setLoading(false));
  }, []);

  const totalActions = stats.sales.leads + stats.accounting.overdue + stats.support.open;

  return (
    <div className="ent-page">
      <style>{STYLES}</style>

      {/* Hero */}
      <div className="hero-ent-pad" style={{
        position: 'relative',
        background: `linear-gradient(135deg, ${C.cyanInk} 0%, ${C.cyanDark} 50%, ${C.cyan} 130%)`,
        color: C.cream, padding: '32px 36px', overflow: 'hidden',
      }}>
        <div className="grain" />
        <div className="slow-rotate" style={{ position: 'absolute', top: -130, right: -130, width: 420, height: 420, borderRadius: '50%', border: `1px dashed ${C.cyanLight}30` }} />
        <div className="slow-rotate" style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, borderRadius: '50%', border: `1px dashed ${C.goldSoft}30`, animationDirection: 'reverse', animationDuration: '50s' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3, pointerEvents: 'none' }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <circle key={i} cx={`${(i * 37) % 100}%`} cy={`${(i * 71) % 100}%`} r={((i * 11) % 12) / 7 + 0.3} fill={i % 2 === 0 ? C.goldSoft : C.cyanLight} opacity={0.4 + ((i * 13) % 60) / 200} />
          ))}
        </svg>

        <div className="ent-container" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, border: `1px solid ${C.goldSoft}30` }}>
            <Building2 size={11} color={C.goldSoft} /> PACK ENTREPRISE · 4 MODULES · WHATSAPP
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <h1 className="display-font hero-ent-title" style={{ fontSize: 'clamp(32px, 5vw, 46px)', fontWeight: 800, margin: 0, lineHeight: 1.05 }}>
                {company?.name ? company.name.split(' ')[0] : 'Pack'}{' '}
                <em className="shimmer-text" style={{ fontStyle: 'italic', fontWeight: 500 }}>Entreprise</em>
              </h1>
              <p style={{ marginTop: 10, fontSize: 14, color: 'rgba(255,250,240,.85)', maxWidth: 580, lineHeight: 1.5 }}>
                Pilote ton entreprise — ventes, factures, support, comms — depuis <strong style={{ color: C.whatsappSoft }}>WhatsApp</strong>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to="/finance" style={{
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cyanInk,
                textDecoration: 'none', padding: '11px 18px', borderRadius: 12,
                fontWeight: 800, fontSize: 13, fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                boxShadow: `0 10px 24px -10px ${C.gold}80`,
              }}>
                <Plus size={13} /> Nouvelle facture
              </Link>
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

          <div className="ent-grid-4" style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <KpiHero label="Leads actifs"    value={stats.sales.leads}        icon={Briefcase}   accent={C.blue} />
            <KpiHero label="Factures dues"   value={stats.accounting.pending} icon={Receipt}     accent={C.green} />
            <KpiHero label="Tickets ouverts" value={stats.support.open}       icon={LifeBuoy}    accent={C.yellow} />
            <KpiHero label="Conversations"   value={stats.comms.conversations} icon={MessageCircle} accent={C.purple} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ent-container">
        <div className="ent-tab-strip" role="tablist">
          {([
            { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard, badge: null },
            { id: 'activity',  label: 'Activité',   icon: ActivityIcon,    badge: activity.length },
            { id: 'insights',  label: 'Insights IA',icon: Sparkles,        badge: insights.length },
            { id: 'inbox',     label: 'Inbox',      icon: Inbox,           badge: stats.comms.conversations },
          ] as Array<{ id: TabId; label: string; icon: any; badge: number | null }>).map(t => (
            <button key={t.id} className={`ent-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <t.icon size={14} /> {t.label}
              {t.badge != null && t.badge > 0 && (
                <span style={{ background: tab === t.id ? C.cyanDeep : C.creamDeep, color: tab === t.id ? C.cream : C.inkSoft, fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <DashboardTab stats={stats} loading={loading} totalActions={totalActions} />
        )}
        {tab === 'activity' && (
          <ActivityTab feed={activity} loading={loading} />
        )}
        {tab === 'insights' && (
          <InsightsTab insights={insights} loading={loading} />
        )}
        {tab === 'inbox' && (
          <InboxTab
            accent={C.cyan} accentDeep={C.cyanDeep}
            ink={C.ink} inkSoft={C.inkSoft} inkLight={C.inkLight}
            cream={C.cream} creamDeep={C.creamDeep}
            emptyHint="Dès qu'un client écrit (vente, support, factures), sa conversation arrive ici — peu importe le canal."
          />
        )}
      </div>

      <VoiceAssistantFAB
        agentName="Assistant Entreprise"
        systemInstruction={`Tu es l'assistant vocal du pack Entreprise de ${company?.name ?? 'mon entreprise'}. Aide à gérer leads (Sales), factures (Compta), tickets (Support) et conversations (Comms). Sois concis, oriente vers le module pertinent.`}
      />
    </div>
  );
}

// ── Tab views ────────────────────────────────────────────────────────────────

function DashboardTab({ stats, loading, totalActions }: { stats: ModuleStats; loading: boolean; totalActions: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 30 }}>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: C.cyanSoft, color: C.cyanDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="display-font" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
              Focus du <em style={{ fontStyle: 'italic', color: C.cyanDeep }}>jour</em>
            </h3>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>
              {totalActions === 0
                ? 'Tout est en ordre. Bonne journée 🌟'
                : `${totalActions} action${totalActions > 1 ? 's' : ''} qui demandent ton attention.`}
            </p>
          </div>
        </div>
        {totalActions > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.sales.leads > 0 && (
              <FocusItem icon={Briefcase} color={C.blue} bg={C.blueSoft}
                text={`${stats.sales.leads} lead${stats.sales.leads > 1 ? 's' : ''} à qualifier`}
                href="/sales/leads" />
            )}
            {stats.accounting.overdue > 0 && (
              <FocusItem icon={FileText} color={C.coralDeep} bg={C.redSoft}
                text={`${stats.accounting.overdue} facture${stats.accounting.overdue > 1 ? 's' : ''} en retard — à relancer`}
                href="/finance" />
            )}
            {stats.support.open > 0 && (
              <FocusItem icon={LifeBuoy} color={C.yellow} bg={C.yellowSoft}
                text={`${stats.support.open} ticket${stats.support.open > 1 ? 's' : ''} ouvert${stats.support.open > 1 ? 's' : ''}`}
                href="/support" />
            )}
          </div>
        ) : (
          <div style={{ padding: 22, textAlign: 'center', background: C.creamDeep, borderRadius: 12 }}>
            <TrendingUp size={28} color={C.cyanDeep} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, color: C.ink, marginBottom: 4 }}>Tu es à jour</div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>Aucune urgence — bon moment pour préparer la prochaine campagne.</div>
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 className="display-font" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
              Tes <em style={{ fontStyle: 'italic', color: C.cyanDeep }}>4 modules</em>
            </h3>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>Clique sur un module pour ouvrir sa page dédiée.</p>
          </div>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkSoft }}>
              <Loader2 size={14} className="spin" /> Sync stats…
            </div>
          )}
        </div>
        <div className="ent-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          <ModuleCard icon={Briefcase}    color={C.blue}    bg={C.blueSoft}   accent={C.blueDeep}   href="/sales"    title="Sales · CRM"
            desc="Pipeline, leads, devis, clients."
            stats={[
              { label: 'Leads',   value: stats.sales.leads },
              { label: 'Devis',   value: stats.sales.pipeline },
              { label: 'Clients', value: stats.sales.clients },
            ]} />
          <ModuleCard icon={DollarSign}   color={C.green}   bg={C.greenSoft}  accent={C.greenDeep}  href="/finance"  title="Compta · Factures"
            desc="Factures, paiements, suivi."
            stats={[
              { label: 'Total',    value: stats.accounting.invoices },
              { label: 'En attente', value: stats.accounting.pending },
              { label: 'Retard',   value: stats.accounting.overdue },
            ]} />
          <ModuleCard icon={LifeBuoy}     color={C.yellow}  bg={C.yellowSoft} accent={C.yellowDeep} href="/support"  title="Support · Tickets"
            desc="Tickets, SLA, KB."
            stats={[
              { label: 'Ouverts', value: stats.support.open },
              { label: 'Total',   value: stats.support.total },
            ]} />
          <ModuleCard icon={Mail}         color={C.purple}  bg={C.purpleSoft} accent={C.purpleDeep} href="/comms"    title="Communications"
            desc="Email · WhatsApp · Telegram."
            stats={[
              { label: 'Conversations', value: stats.comms.conversations },
            ]} />
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ feed, loading }: { feed: ActivityItem[]; loading: boolean }) {
  return (
    <div className="card" style={{ minHeight: 380 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="mono-font" style={{ fontSize: 10, fontWeight: 800, color: C.cyanDeep, letterSpacing: '0.08em' }}>
            <span className="live-dot" style={{ display: 'inline-block', verticalAlign: -1, marginRight: 6 }} /> LIVE · 4 MODULES
          </div>
          <h3 className="display-font" style={{ fontSize: 19, fontWeight: 800, margin: '2px 0 0' }}>
            Tout ce qui <em style={{ fontStyle: 'italic', color: C.cyanDeep }}>bouge</em>
          </h3>
        </div>
        {loading && <Loader2 size={14} className="spin" color={C.inkSoft} />}
      </div>
      {feed.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.inkSoft }}>
          <ActivityIcon size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Aucune activité récente</div>
          <div style={{ fontSize: 12 }}>Leads, factures, tickets et messages s'affichent ici en temps réel.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {feed.map(item => (
            <Link key={item.id} to={item.href} className="card-lift" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 11,
              background: C.creamDeep, textDecoration: 'none', color: 'inherit',
              borderLeft: `3px solid ${item.color}`,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${item.color}1a`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <item.icon size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.desc}</div>
              </div>
              <span className="mono-font" style={{ fontSize: 9, color: C.inkLight, flexShrink: 0 }}>{timeAgo(item.time)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function InsightsTab({ insights, loading }: { insights: Array<{ id: string; title: string; desc: string; severity?: string }>; loading: boolean }) {
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
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>L'IA détecte les opportunités à travers Sales + Compta + Support + Comms.</p>
        </div>
        {loading && <Loader2 size={14} className="spin" style={{ marginLeft: 'auto' }} color={C.inkSoft} />}
      </div>
      {insights.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.inkSoft, background: C.creamDeep, borderRadius: 12 }}>
          <BarChart3 size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Pas encore d'insight</div>
          <div style={{ fontSize: 12, maxWidth: 380, margin: '0 auto', lineHeight: 1.5 }}>
            L'agent Insights analyse tes données et propose des recommandations.{' '}
            <Link to="/insights" style={{ color: C.cyanDeep, fontWeight: 700 }}>Ouvrir Insights →</Link>
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

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiHero({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent: string }) {
  return (
    <div style={{
      background: 'rgba(255,250,240,.14)', backdropFilter: 'blur(10px)',
      borderRadius: 14, padding: '14px 16px',
      border: `1px solid ${accent}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={accent} style={{ filter: 'brightness(1.4)' }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', opacity: 0.92, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div className="display-font" style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function FocusItem({ icon: Icon, color, bg, text, href }: { icon: any; color: string; bg: string; text: string; href: string }) {
  return (
    <Link to={href} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 11,
      background: bg, textDecoration: 'none',
      borderLeft: `3px solid ${color}`,
      transition: 'transform .15s ease',
    }}
      onMouseOver={e => e.currentTarget.style.transform = 'translateX(3px)'}
      onMouseOut={e => e.currentTarget.style.transform = 'translateX(0)'}>
      <Icon size={16} color={color} />
      <span style={{ flex: 1, fontSize: 13, color: C.ink, fontWeight: 600 }}>{text}</span>
      <ArrowRight size={14} color={color} />
    </Link>
  );
}

function ModuleCard({ icon: Icon, color, bg, accent, href, title, desc, stats }: {
  icon: any; color: string; bg: string; accent: string; href: string;
  title: string; desc: string; stats: Array<{ label: string; value: number }>;
}) {
  return (
    <Link to={href} className="card-lift" style={{
      display: 'block', textDecoration: 'none', color: 'inherit',
      background: C.cream, borderRadius: 16, padding: 18,
      border: '1px solid rgba(10,42,32,.06)',
      borderLeft: `4px solid ${color}`,
    }}
      onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 16px 36px -16px ${color}50`; }}
      onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none'; }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 18px -8px ${color}50` }}>
          <Icon size={20} />
        </div>
        <ArrowRight size={16} color={C.inkLight} />
      </div>
      <h4 className="display-font" style={{ fontSize: 17, fontWeight: 800, margin: 0, color: C.ink }}>{title}</h4>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 12px', lineHeight: 1.5 }}>{desc}</p>
      <div style={{ display: 'flex', gap: 14, paddingTop: 10, borderTop: '1px solid rgba(10,42,32,.06)' }}>
        {stats.map(s => (
          <div key={s.label}>
            <div className="mono-font" style={{ fontSize: 16, fontWeight: 800, color: accent, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.inkLight, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </Link>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function unwrap<T>(data: any, fallback: T): T {
  if (data == null) return fallback;
  if (Array.isArray(data)) return data as unknown as T;
  if (typeof data === 'object' && 'data' in data) return (data.data as T) ?? fallback;
  return data as T;
}

function getMs(t: any): number {
  if (!t) return 0;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') return new Date(t).getTime() || 0;
  if (typeof t._seconds === 'number') return t._seconds * 1000;
  return 0;
}

function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}
