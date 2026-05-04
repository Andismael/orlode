/**
 * SupportCenterPage — Premium support hub (coral + cyan accent)
 * 4 tabs: Accueil / Centre Support / Base de connaissances / Chat IA
 * Wired to real APIs: /support/tickets, /support/stats, /support/kb, /team/members.
 * No mocks. Empty states everywhere.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Sparkles, Inbox, BookOpen, Bot, LayoutDashboard,
  Headset, Gauge, Settings, MessageCircle,
  ArrowRight, ArrowUpRight, ArrowDownRight, Minus, Star, Clock, Trophy,
  CheckCircle2, AlertTriangle, BarChart3, ChevronRight, Award, Send,
  Eye, ThumbsUp, Edit3, MoreVertical, X, Flame, User, Users, RefreshCw,
  TrendingUp, ChevronLeft, SlidersHorizontal, Paperclip, Mic, Zap,
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const C = {
  greenInk: '#042A1F',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  gold: '#D4A017', goldDeep: '#B8860B', goldDark: '#8B6914', goldSoft: '#FEF3C7', goldLight: '#FCD34D',
  coral: '#FB7185', coralDeep: '#E11D48', coralDark: '#9F1239', coralSoft: '#FFE4E6', coralLight: '#FDA4AF',
  cyan: '#06B6D4', cyanDeep: '#0891B2', cyanDark: '#155E75', cyanSoft: '#CFFAFE', cyanLight: '#67E8F9',
  sage: '#86C5A0', sageDeep: '#5BA47C', sageDark: '#2D6A4F', sageSoft: '#D4F1DF',
  terraDeep: '#C25C3D', terraSoft: '#FFEDE5',
  indigo: '#4338CA', indigoSoft: '#E0E7FF',
  red: '#EF4444', redSoft: '#FEE2E2', redDeep: '#DC2626',
  blue: '#0EA5E9', blueSoft: '#E0F2FE', blueDeep: '#0284C7',
  purple: '#7C3AED', purpleSoft: '#F3E8FF', purpleDeep: '#5B21B6',
  ink: '#0A2A20', inkSoft: '#5A6B62', inkLight: '#94A3A0',
} as const;

type Tab = 'home' | 'tickets' | 'kb' | 'chat';
type Channel = 'whatsapp' | 'email' | 'phone' | 'live';

interface RawTicket {
  id: string; ticketNumber?: string; title?: string; description?: string;
  customerName?: string; customerEmail?: string; status?: string; priority?: string;
  category?: string; assignedTo?: string; assignedToName?: string;
  channel?: string; satisfaction?: number | null;
  slaResolutionDeadline?: string | { _seconds?: number };
  createdAt?: string | { _seconds?: number };
}
interface UiTicket {
  id: string; refId: string; title: string; customer: string; channel: Channel;
  priority: 'urgent' | 'high' | 'medium' | 'low'; status: 'open' | 'pending' | 'resolved';
  sla: number; slaMax: number; agent: 'ai' | 'human';
  time: string; unread: boolean; satisfaction: number | null;
  raw: RawTicket;
}

interface Stats {
  total: number; open: number; assigned: number; inProgress: number;
  waitingClient: number; escalated: number; resolved: number; closed: number;
  avgSatisfaction: number; avgFirstResponseMin: number; avgResolutionMin: number;
  slaBreachCount: number; highPriority: number;
  byCategory: { category: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

interface KbArticle {
  id: string; title: string; content?: string; category?: string;
  views?: number; helpful?: number; updatedAt?: any; popular?: boolean;
}

const STATUS_CONFIG: Record<UiTicket['status'], { label: string; color: string; bg: string }> = {
  open:     { label: 'Ouvert',     color: C.coral, bg: C.coralSoft },
  pending:  { label: 'En attente', color: C.gold,  bg: C.goldSoft  },
  resolved: { label: 'Résolu',     color: C.sage,  bg: C.sageSoft  },
};
const PRIORITY_CONFIG: Record<UiTicket['priority'], { label: string; color: string; bg: string }> = {
  urgent: { label: 'URGENT', color: C.red,        bg: C.redSoft },
  high:   { label: 'ÉLEVÉE', color: C.terraDeep,  bg: C.terraSoft },
  medium: { label: 'MOYEN',  color: C.goldDark,   bg: C.goldSoft },
  low:    { label: 'BAS',    color: C.sageDark,   bg: C.sageSoft },
};
const CHANNEL_ICONS: Record<Channel, { emoji: string; color: string; bg: string }> = {
  whatsapp: { emoji: '💬', color: '#25D366', bg: '#DCF8C6' },
  email:    { emoji: '📧', color: C.blue,    bg: C.blueSoft },
  phone:    { emoji: '📞', color: C.coral,   bg: C.coralSoft },
  live:     { emoji: '⚡', color: C.purple,  bg: C.purpleSoft },
};
const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp Business', email: 'Email', phone: 'Téléphone', live: 'Live chat',
};
const CHANNEL_DEEP: Record<Channel, string> = {
  whatsapp: '#128C7E', email: C.blueDeep, phone: C.coralDeep, live: C.purpleDeep,
};

const KB_CATEGORIES = [
  { id: 'all',     label: 'Tous',                color: C.coral },
  { id: 'compte',  label: 'Compte & connexion',  color: C.cyan },
  { id: 'fact',    label: 'Facturation',         color: C.gold },
  { id: 'tech',    label: 'Technique',           color: C.indigo },
  { id: 'pay',     label: 'Paiement',            color: C.sage },
  { id: 'integ',   label: 'Intégrations',        color: C.purple },
];

const ICON_FOR_CAT: Record<string, string> = {
  compte: '🔑', fact: '🧾', tech: '🤖', pay: '📱', integ: '💬', general: '📘',
};

function getColorVar(name: 'coral' | 'cyan' | 'sage' | 'gold') {
  return ({
    coral: { main: C.coral, deep: C.coralDeep, soft: C.coralSoft, ink: C.coralDark },
    cyan:  { main: C.cyan,  deep: C.cyanDeep,  soft: C.cyanSoft,  ink: C.cyanDark },
    sage:  { main: C.sage,  deep: C.sageDeep,  soft: C.sageSoft,  ink: C.sageDark },
    gold:  { main: C.gold,  deep: C.goldDeep,  soft: C.goldSoft,  ink: C.goldDark },
  } as const)[name];
}
function getSlaColor(percent: number) {
  if (percent < 50) return C.sage;
  if (percent < 80) return C.gold;
  return C.red;
}
function tsToMs(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string') { const d = Date.parse(v); return isNaN(d) ? 0 : d; }
  if (typeof v === 'object') {
    const s = v._seconds ?? v.seconds;
    if (typeof s === 'number') return s * 1000;
  }
  return 0;
}
function fmtRel(ms: number): string {
  if (!ms) return '—';
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'Hier';
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function mapTicket(raw: RawTicket): UiTicket {
  const channel: Channel = (['whatsapp', 'email', 'phone', 'live'].includes(raw.channel ?? '') ? raw.channel : 'email') as Channel;
  const rawStatus = raw.status ?? 'open';
  const status: UiTicket['status'] =
    rawStatus === 'resolved' || rawStatus === 'closed' ? 'resolved'
    : rawStatus === 'open' ? 'open' : 'pending';
  const rawPrio = raw.priority ?? 'normal';
  const priority: UiTicket['priority'] =
    rawPrio === 'urgent' ? 'urgent'
    : rawPrio === 'high' ? 'high'
    : rawPrio === 'low' ? 'low' : 'medium';
  const createdMs = tsToMs(raw.createdAt);
  const deadlineMs = tsToMs(raw.slaResolutionDeadline);
  const slaMax = deadlineMs && createdMs ? Math.max(15, Math.round((deadlineMs - createdMs) / 60000)) : 60;
  const elapsed = createdMs ? Math.round((Date.now() - createdMs) / 60000) : 0;
  const sla = Math.min(slaMax, Math.max(0, elapsed));
  const isAssignedHuman = !!raw.assignedTo && raw.assignedTo !== 'ai' && raw.assignedTo !== 'bot';
  return {
    id: raw.id,
    refId: raw.ticketNumber ?? raw.id,
    title: raw.title ?? 'Sans titre',
    customer: raw.customerName ?? raw.customerEmail ?? 'Client',
    channel,
    priority,
    status,
    sla, slaMax,
    agent: isAssignedHuman ? 'human' : 'ai',
    time: fmtRel(createdMs),
    unread: status === 'open' && (Date.now() - createdMs) < 30 * 60 * 1000,
    satisfaction: typeof raw.satisfaction === 'number' ? raw.satisfaction : null,
    raw,
  };
}

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  .sup-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .sup-mono { font-family: 'JetBrains Mono', monospace; }
  .sup-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .sup-grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .sup-icon-btn { width: 34px; height: 34px; border-radius: 9px; background: ${C.coralSoft}; color: ${C.coralDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; flex-shrink: 0; }
  .sup-icon-btn:hover { background: ${C.coralDeep}; color: ${C.cream}; }
  .sup-icon-btn.cyan { background: ${C.cyanSoft}; color: ${C.cyanDeep}; }
  .sup-icon-btn.cyan:hover { background: ${C.cyanDeep}; color: ${C.cream}; }
  .sup-icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .sup-icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.coralDeep}; }
  .sup-live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.sage}; position: relative; flex-shrink: 0; }
  .sup-live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.sage}; opacity: 0.4; animation: supPulse 1.8s ease-in-out infinite; }
  @keyframes supPulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.6); opacity: 0; } }
  @keyframes supRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .sup-rotate { animation: supRotate 30s linear infinite; }
  @keyframes supFloat { 0%,100% { transform: translateY(0) rotate(0deg); opacity: 0.5; } 50% { transform: translateY(-8px) rotate(180deg); opacity: 1; } }
  .sup-float { animation: supFloat 4s ease-in-out infinite; }
  @keyframes supShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  .sup-shimmer { background: linear-gradient(90deg, ${C.coralLight}, ${C.gold}, ${C.coralLight}, ${C.gold}, ${C.coralLight}); background-size: 200% auto; background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: supShimmer 4s linear infinite; }
  @keyframes supUrgent { 0%,100% { box-shadow: 0 0 0 0 ${C.red}80; } 50% { box-shadow: 0 0 0 6px ${C.red}00; } }
  .sup-urgent { animation: supUrgent 2s ease-in-out infinite; }
  @keyframes supSlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .sup-stagger > * { animation: supSlideIn 0.4s ease-out backwards; }
  .sup-stagger > *:nth-child(1){animation-delay:.05s}.sup-stagger > *:nth-child(2){animation-delay:.10s}.sup-stagger > *:nth-child(3){animation-delay:.15s}.sup-stagger > *:nth-child(4){animation-delay:.20s}.sup-stagger > *:nth-child(5){animation-delay:.25s}.sup-stagger > *:nth-child(n+6){animation-delay:.30s}
  .sup-card-lift { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .sup-card-lift:hover { transform: translateY(-2px); }
  .sup-row { transition: all 0.2s ease; }
  .sup-row:hover { transform: translateX(2px); box-shadow: 0 8px 24px -8px ${C.coral}30; }
  .sup-row.selected { background: ${C.coralSoft} !important; border-color: ${C.coral} !important; box-shadow: 0 0 0 1px ${C.coral}, 0 8px 24px -8px ${C.coral}40 !important; }
  @keyframes supSlideRight { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .sup-slide-right { animation: supSlideRight 0.3s ease-out; }
  .sup-thin::-webkit-scrollbar { width: 6px; }
  .sup-thin::-webkit-scrollbar-thumb { background: rgba(10,42,32,0.15); border-radius: 100px; }
  @keyframes supTyping { 0%,60%,100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
  .sup-type-1 { animation: supTyping 1.4s ease-in-out infinite; }
  .sup-type-2 { animation: supTyping 1.4s ease-in-out infinite 0.2s; }
  .sup-type-3 { animation: supTyping 1.4s ease-in-out infinite 0.4s; }
  @media (max-width: 1280px) { .sup-detail { display: none !important; } }
  @media (max-width: 1024px) {
    .sup-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .sup-grid-3 { grid-template-columns: 1fr !important; }
    .sup-grid-2 { grid-template-columns: 1fr !important; }
    .sup-shell { padding: 14px !important; }
  }
  @media (max-width: 768px) {
    .sup-hide-mobile { display: none !important; }
    .sup-grid-4 { grid-template-columns: 1fr !important; }
    .sup-hero-title { font-size: 26px !important; }
    .sup-shell { padding: 10px !important; gap: 10px !important; }
    .sup-hero-pad { padding: 20px 18px !important; }
  }
`;

export default function SupportCenterPage() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [tickets, setTickets] = useState<UiTicket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [kb, setKb] = useState<KbArticle[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<UiTicket | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, sRes, kRes, mRes] = await Promise.all([
        api.get('/support/tickets').then(r => r.data).catch(() => null),
        api.get('/support/stats').then(r => r.data).catch(() => null),
        api.get('/support/kb').then(r => r.data).catch(() => null),
        api.get('/team/members').then(r => r.data).catch(() => null),
      ]);
      const tArr: RawTicket[] = Array.isArray(tRes) ? tRes : (tRes?.data ?? []);
      setTickets(tArr.map(mapTicket).sort((a, b) => tsToMs(b.raw.createdAt) - tsToMs(a.raw.createdAt)));
      setStats((sRes?.data ?? sRes) ?? null);
      const kbArr: KbArticle[] = Array.isArray(kRes) ? kRes : (kRes?.data ?? []);
      setKb(kbArr);
      const mArr: any[] = Array.isArray(mRes) ? mRes : (mRes?.data?.data ?? mRes?.data ?? mRes?.members ?? []);
      setMembers(mArr);
    } catch { /* swallow */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="sup-shell" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: '100vh', background: C.creamDeep, fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      <HeroSection stats={stats} loading={loading} onChat={() => setActiveTab('chat')} />
      <TabsBar activeTab={activeTab} setActiveTab={setActiveTab} ticketsCount={tickets.filter(t => t.status !== 'resolved').length} kbCount={kb.length} />

      {activeTab === 'home' && (
        <HomeTab
          tickets={tickets} stats={stats} members={members} loading={loading}
          onSelectTicket={t => { setSelectedTicket(t); setActiveTab('tickets'); }}
        />
      )}
      {activeTab === 'tickets' && (
        <TicketsTab
          tickets={tickets} loading={loading}
          selectedTicket={selectedTicket} setSelectedTicket={setSelectedTicket}
        />
      )}
      {activeTab === 'kb' && <KbTab articles={kb} loading={loading} />}
      {activeTab === 'chat' && <ChatTab />}
    </div>
  );
}

interface HeroProps { stats: Stats | null; loading: boolean; onChat: () => void }
function HeroSection({ stats, loading, onChat }: HeroProps) {
  const treatedToday = stats?.resolved ?? 0;
  return (
    <div className="sup-hero-pad" style={{ position: 'relative', background: `linear-gradient(135deg, ${C.coralDark} 0%, ${C.coralDeep} 50%, ${C.cyanDark} 100%)`, borderRadius: 22, padding: '24px 28px', overflow: 'hidden', border: `1px solid ${C.coral}40`, boxShadow: `0 20px 50px -20px ${C.coralDeep}` }}>
      <div className="sup-grain" />
      <div className="sup-rotate" style={{ position: 'absolute', top: -100, right: -100, width: 320, height: 320, borderRadius: '50%', border: `1px dashed ${C.gold}30`, pointerEvents: 'none' }} />
      <div className="sup-float" style={{ position: 'absolute', top: 40, right: 100, opacity: 0.6 }}><Sparkles size={18} color={C.gold} /></div>
      <div className="sup-float" style={{ position: 'absolute', top: 100, right: 240, opacity: 0.5, animationDelay: '1s' }}><Sparkles size={14} color={C.coralLight} /></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 11, fontWeight: 600, color: 'rgba(255,250,240,0.7)', position: 'relative', zIndex: 2 }}>
        <span>Mes Agents</span>
        <ChevronRight size={11} />
        <span>Opérations</span>
        <ChevronRight size={11} />
        <span style={{ color: C.cream, fontWeight: 700 }}>Support Client</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -6px ${C.gold}` }}>
              <Headset size={28} color={C.greenInk} strokeWidth={2} />
            </div>
            <div>
              <h1 className="sup-display sup-hero-title" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Support <em className="sup-shimmer" style={{ fontStyle: 'italic', fontWeight: 500 }}>Client</em>
              </h1>
              <div style={{ fontSize: 12, color: 'rgba(255,250,240,0.85)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sup-live-dot" style={{ background: C.gold }} />
                <span style={{ fontWeight: 600 }}>Agent IA actif · {loading ? '…' : `${treatedToday} tickets traités au total`}</span>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.85)', margin: '0 0 14px', lineHeight: 1.5, maxWidth: 600 }}>
            Tickets <strong style={{ color: C.cream }}>SLA</strong>, suggestions IA, auto-assignation, base de connaissances et satisfaction client.
            <strong style={{ color: C.gold }}> WhatsApp first</strong> · Multi-canal · Multi-langue.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onChat} style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.greenInk, border: 'none', padding: '10px 18px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: `0 8px 20px -6px ${C.gold}` }}>
              <MessageCircle size={14} /> Discuter avec l'agent
            </button>
            <button style={{ background: 'rgba(255,250,240,0.1)', color: C.cream, border: '1px solid rgba(255,250,240,0.2)', padding: '10px 16px', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Plus size={13} /> Créer un ticket
            </button>
            <button style={{ background: 'rgba(255,250,240,0.1)', color: C.cream, border: '1px solid rgba(255,250,240,0.2)', padding: '10px 16px', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Settings size={13} /> Configurer
            </button>
          </div>
        </div>

        <div className="sup-hide-mobile" style={{ background: 'rgba(255,250,240,0.06)', border: `1px solid ${C.gold}30`, borderRadius: 16, padding: 16, minWidth: 240, backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Gauge size={14} color={C.gold} />
            <span style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '0.1em' }}>SLA · TEMPS RÉEL</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '1ère réponse', value: stats ? `${stats.avgFirstResponseMin} min` : '—', good: !!(stats && stats.avgFirstResponseMin <= 30) },
              { label: 'Résolution',   value: stats ? `${stats.avgResolutionMin} min` : '—', good: !!(stats && stats.avgResolutionMin <= 240) },
              { label: 'SLA dépassés', value: stats ? String(stats.slaBreachCount) : '—', good: !!(stats && stats.slaBreachCount === 0) },
              { label: 'Satisfaction', value: stats ? `${stats.avgSatisfaction} / 5` : '—', good: !!(stats && stats.avgSatisfaction >= 4) },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <span style={{ color: 'rgba(255,250,240,0.7)' }}>{s.label}</span>
                <span className="sup-mono" style={{ color: s.good ? C.sage : C.gold, fontWeight: 700, fontSize: 11 }}>● {s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface TabsBarProps { activeTab: Tab; setActiveTab: (t: Tab) => void; ticketsCount: number; kbCount: number }
function TabsBar({ activeTab, setActiveTab, ticketsCount, kbCount }: TabsBarProps) {
  const tabs: { id: Tab; label: string; icon: any; count: number | null }[] = [
    { id: 'home',    label: 'Accueil',                 icon: LayoutDashboard, count: null },
    { id: 'tickets', label: 'Centre Support',           icon: Inbox,           count: ticketsCount },
    { id: 'kb',      label: 'Base de connaissances',    icon: BookOpen,        count: kbCount },
    { id: 'chat',    label: 'Chat IA',                  icon: Bot,             count: null },
  ];
  return (
    <div className="sup-thin" style={{ background: C.cream, borderRadius: 14, padding: 6, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', gap: 4, overflowX: 'auto' }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: active ? `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})` : 'transparent',
            color: active ? C.cream : C.inkSoft,
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: active ? `0 6px 14px -4px ${C.coral}` : 'none',
            flexShrink: 0, transition: 'all 0.2s ease',
          }}>
            <Icon size={14} strokeWidth={2} />
            {t.label}
            {t.count !== null && (
              <span className="sup-mono" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 7px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface HomeProps { tickets: UiTicket[]; stats: Stats | null; members: any[]; loading: boolean; onSelectTicket: (t: UiTicket) => void }
function HomeTab({ tickets, stats, members, loading, onSelectTicket }: HomeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <KPICards tickets={tickets} stats={stats} loading={loading} />
      <div className="sup-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <LiveTicketsFeed tickets={tickets.slice(0, 5)} loading={loading} onSelect={onSelectTicket} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ChannelsBreakdown tickets={tickets} />
          <TopAgentsWidget tickets={tickets} members={members} />
        </div>
      </div>
    </div>
  );
}

function KPICards({ tickets, stats, loading }: { tickets: UiTicket[]; stats: Stats | null; loading: boolean }) {
  const open = stats?.open ?? tickets.filter(t => t.status === 'open').length;
  const urgent = tickets.filter(t => t.priority === 'urgent').length;
  const resolved = stats?.resolved ?? tickets.filter(t => t.status === 'resolved').length;
  const avgFirstResp = stats?.avgFirstResponseMin ?? 0;
  const avgSat = stats?.avgSatisfaction ?? 0;
  const cards: { id: string; label: string; value: string; sub: string; trend: 'up' | 'down' | 'flat'; change: string; icon: any; color: 'coral' | 'sage' | 'cyan' | 'gold' }[] = [
    { id: 'open',     label: 'Tickets ouverts', value: String(open),     sub: `${urgent} urgent${urgent > 1 ? 's' : ''}`,        change: open === 0 ? 'à jour' : 'temps réel', trend: 'flat', icon: Inbox,        color: 'coral' },
    { id: 'resolved', label: 'Résolus (total)', value: String(resolved), sub: 'tous tickets',                                    change: '—',                                  trend: 'up',   icon: CheckCircle2, color: 'sage' },
    { id: 'time',     label: 'Réponse moyenne', value: avgFirstResp ? String(avgFirstResp) : '—', sub: 'min · 1ère réponse',     change: avgFirstResp <= 30 ? 'rapide' : 'à améliorer', trend: avgFirstResp <= 30 ? 'down' : 'up', icon: Clock, color: 'cyan' },
    { id: 'sat',      label: 'Satisfaction',     value: avgSat ? avgSat.toFixed(1) : '—',         sub: '/5',                       change: avgSat >= 4 ? 'élevée' : (avgSat ? 'moyenne' : '—'), trend: avgSat >= 4 ? 'up' : 'flat', icon: Star,  color: 'gold' },
  ];
  return (
    <div className="sup-grid-4 sup-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map(s => {
        const colors = getColorVar(s.color);
        const Icon = s.icon;
        const TrendIcon = s.trend === 'up' ? ArrowUpRight : s.trend === 'down' ? ArrowDownRight : Minus;
        return (
          <div key={s.id} className="sup-card-lift" style={{ background: C.cream, borderRadius: 16, padding: 16, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${colors.main}, ${colors.deep})` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: colors.soft, color: colors.deep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} />
              </div>
              <span className="sup-pill" style={{ background: C.sageSoft, color: C.sageDark, fontWeight: 700, fontSize: 10 }}>
                <TrendIcon size={9} /> {loading ? '…' : s.change}
              </span>
            </div>
            <div className="sup-display sup-mono" style={{ fontSize: 32, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 6 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 1 }}>{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

function LiveTicketsFeed({ tickets, loading, onSelect }: { tickets: UiTicket[]; loading: boolean; onSelect: (t: UiTicket) => void }) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(10,42,32,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className="sup-live-dot" />
            <span style={{ fontSize: 10, fontWeight: 800, color: C.sageDark, letterSpacing: '0.1em' }}>EN DIRECT · {tickets.length} DERNIERS</span>
          </div>
          <h3 className="sup-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
            Tickets <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.coral }}>récents</em>
          </h3>
        </div>
      </div>

      {loading && <div style={{ padding: 30, textAlign: 'center', color: C.inkSoft }}>Chargement…</div>}
      {!loading && tickets.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.12)', borderRadius: 12 }}>
          <Inbox size={32} color={C.inkLight} style={{ marginBottom: 8 }} />
          <div className="sup-display" style={{ fontSize: 14, color: C.ink, fontWeight: 700 }}>Aucun ticket pour l'instant</div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>Les nouveaux tickets apparaîtront ici en direct.</div>
        </div>
      )}

      <div className="sup-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tickets.map(t => <TicketRow key={t.id} t={t} onClick={() => onSelect(t)} compact />)}
      </div>
    </div>
  );
}

function TicketRow({ t, onClick, compact = false, isSelected = false }: { t: UiTicket; onClick: () => void; compact?: boolean; isSelected?: boolean }) {
  const ch = CHANNEL_ICONS[t.channel];
  const status = STATUS_CONFIG[t.status];
  const priority = PRIORITY_CONFIG[t.priority];
  const slaPercent = (t.sla / t.slaMax) * 100;
  const slaColor = getSlaColor(slaPercent);
  return (
    <div onClick={onClick} className={`sup-row sup-card-lift ${isSelected ? 'selected' : ''}`} style={{
      background: t.unread ? `${C.coralSoft}40` : C.cream,
      borderRadius: 12, padding: compact ? 12 : 14,
      border: t.unread ? `1px solid ${C.coral}40` : '1px solid rgba(10,42,32,0.06)',
      borderLeft: t.priority === 'urgent' ? `4px solid ${C.red}` : (t.unread ? `4px solid ${C.coral}` : '1px solid rgba(10,42,32,0.06)'),
      cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ width: compact ? 38 : 44, height: compact ? 38 : 44, borderRadius: compact ? 11 : 12, background: ch.bg, color: ch.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 18 : 20, flexShrink: 0 }}>{ch.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span className="sup-mono" style={{ fontSize: 10, color: C.inkLight, fontWeight: 700 }}>#{t.refId}</span>
          <span className="sup-display" style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{t.title}</span>
          {t.priority === 'urgent' && (
            <span className="sup-pill sup-urgent" style={{ background: C.red, color: C.cream, fontSize: 9, fontWeight: 800 }}>🔥 URGENT</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.inkSoft, marginBottom: 6, flexWrap: 'wrap' }}>
          <span><strong style={{ color: C.ink }}>{t.customer}</strong></span>
          <span>·</span>
          <span>{t.time}</span>
          <span>·</span>
          <span className="sup-pill" style={{ background: status.bg, color: status.color, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>● {status.label}</span>
          {!compact && (
            <span className="sup-pill" style={{ background: priority.bg, color: priority.color, fontSize: 9, fontWeight: 700 }}>{priority.label}</span>
          )}
          {t.agent === 'ai' ? (
            <span className="sup-pill" style={{ background: C.cyanSoft, color: C.cyanDeep, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>
              <Bot size={9} /> IA
            </span>
          ) : (
            <span className="sup-pill" style={{ background: C.coralSoft, color: C.coralDeep, fontSize: 9, fontWeight: 700, padding: '2px 7px' }}>
              <User size={9} /> HUMAIN
            </span>
          )}
          {t.satisfaction && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: C.goldDark, fontWeight: 700 }}>
              <Star size={11} fill={C.gold} color={C.gold} /> {t.satisfaction}/5
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!compact && <Clock size={11} color={slaColor} />}
          <span className="sup-mono" style={{ fontSize: compact ? 9 : 10, color: slaColor, fontWeight: 700, minWidth: compact ? 50 : 80 }}>
            SLA {t.sla}/{t.slaMax} min
          </span>
          <div style={{ flex: 1, height: 4, background: 'rgba(10,42,32,0.06)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, slaPercent)}%`, background: `linear-gradient(90deg, ${slaColor}, ${slaColor}cc)`, borderRadius: 100 }} />
          </div>
          {!compact && (
            <span className="sup-mono" style={{ fontSize: 10, color: C.inkLight, fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{Math.round(slaPercent)}%</span>
          )}
        </div>
      </div>
      <ChevronRight size={16} color={C.inkLight} style={{ flexShrink: 0, marginTop: compact ? 12 : 14 }} />
    </div>
  );
}

function ChannelsBreakdown({ tickets }: { tickets: UiTicket[] }) {
  const total = tickets.length;
  const channels: Channel[] = ['whatsapp', 'email', 'phone', 'live'];
  const breakdown = channels.map(c => ({
    id: c,
    name: CHANNEL_LABEL[c],
    emoji: CHANNEL_ICONS[c].emoji,
    color: CHANNEL_ICONS[c].color,
    deep: CHANNEL_DEEP[c],
    count: tickets.filter(t => t.channel === c).length,
  })).map(c => ({ ...c, percent: total > 0 ? Math.round((c.count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(10,42,32,0.06)', height: '100%' }}>
      <div style={{ marginBottom: 14 }}>
        <div className="sup-pill" style={{ background: C.coralSoft, color: C.coralDeep, fontWeight: 700, marginBottom: 4, fontSize: 10 }}>
          <BarChart3 size={10} /> CANAUX · TOTAL
        </div>
        <h3 className="sup-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
          <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.coral }}>Sources</em> des tickets
        </h3>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
          <strong style={{ color: C.ink }}>{total}</strong> ticket{total > 1 ? 's' : ''}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {total === 0 ? (
          <div style={{ fontSize: 12, color: C.inkLight, textAlign: 'center', padding: 16 }}>Pas encore de tickets</div>
        ) : breakdown.map(c => (
          <div key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{c.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{c.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="sup-mono" style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.percent}%</span>
                <span className="sup-mono" style={{ fontSize: 10, color: C.inkLight }}>({c.count})</span>
              </div>
            </div>
            <div style={{ height: 6, background: 'rgba(10,42,32,0.06)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${c.percent}%`, background: `linear-gradient(90deg, ${c.color}, ${c.deep})`, borderRadius: 100 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopAgentsWidget({ tickets, members }: { tickets: UiTicket[]; members: any[] }) {
  const aiCount = tickets.filter(t => t.agent === 'ai').length;
  const aiSat = (() => {
    const aiTickets = tickets.filter(t => t.agent === 'ai' && t.satisfaction != null);
    if (aiTickets.length === 0) return null;
    return (aiTickets.reduce((s, t) => s + (t.satisfaction || 0), 0) / aiTickets.length).toFixed(1);
  })();
  const byAgent = new Map<string, { count: number; sumSat: number; nSat: number }>();
  for (const t of tickets) {
    if (t.agent !== 'human' || !t.raw.assignedTo) continue;
    const a = byAgent.get(t.raw.assignedTo) ?? { count: 0, sumSat: 0, nSat: 0 };
    a.count++;
    if (typeof t.satisfaction === 'number') { a.sumSat += t.satisfaction; a.nSat++; }
    byAgent.set(t.raw.assignedTo, a);
  }
  const human = Array.from(byAgent.entries())
    .map(([uid, data]) => {
      const m = members.find((x: any) => (x.id ?? x.uid) === uid);
      return {
        id: uid,
        name: m?.displayName ?? m?.name ?? m?.email ?? 'Agent',
        emoji: m?.initials ?? (m?.displayName ?? 'A')[0],
        resolved: data.count,
        satisfaction: data.nSat > 0 ? Number((data.sumSat / data.nSat).toFixed(1)) : null,
        color: m?.color ?? C.coral,
      };
    })
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 3);
  const list = [
    ...(aiCount > 0 ? [{ id: 'ai', name: 'Agent IA Support', emoji: '🤖', resolved: aiCount, satisfaction: aiSat ? Number(aiSat) : null, color: C.cyan, isBot: true }] : []),
    ...human,
  ].slice(0, 4);
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 18, border: '1px solid rgba(10,42,32,0.06)', height: '100%' }}>
      <div style={{ marginBottom: 14 }}>
        <div className="sup-pill" style={{ background: C.goldSoft, color: C.goldDark, fontWeight: 700, marginBottom: 4, fontSize: 10 }}>
          <Trophy size={10} /> TICKETS RÉSOLUS
        </div>
        <h3 className="sup-display" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
          Top <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>agents</em>
        </h3>
      </div>
      {list.length === 0 ? (
        <div style={{ fontSize: 12, color: C.inkLight, textAlign: 'center', padding: 16 }}>Pas encore d'agent classé</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((a: any, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="sup-mono" style={{ fontSize: 11, fontWeight: 800, color: C.inkLight, width: 18 }}>#{i + 1}</span>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${a.color}, ${a.color}cc)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, boxShadow: `0 4px 10px -3px ${a.color}` }}>
                {a.isBot ? <Bot size={18} /> : a.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                  <span className="sup-mono" style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.resolved}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.inkLight }}>
                  {a.satisfaction != null ? (
                    <>
                      <Star size={9} fill={C.gold} color={C.gold} />
                      <span className="sup-mono" style={{ fontWeight: 700, color: C.goldDark }}>{a.satisfaction}</span>
                      <span>· tickets résolus</span>
                    </>
                  ) : <span>tickets résolus</span>}
                </div>
              </div>
              {i === 0 && <Award size={16} fill={C.gold} color={C.goldDeep} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TicketsTabProps { tickets: UiTicket[]; loading: boolean; selectedTicket: UiTicket | null; setSelectedTicket: (t: UiTicket | null) => void }
function TicketsTab({ tickets, loading, selectedTicket, setSelectedTicket }: TicketsTabProps) {
  const [filter, setFilter] = useState<'all' | 'urgent' | 'open' | 'pending' | 'resolved' | 'ai'>('all');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | Channel>('all');

  const filtered = useMemo(() => tickets.filter(t => {
    if (filter === 'urgent' && t.priority !== 'urgent') return false;
    if (filter === 'open' && t.status !== 'open') return false;
    if (filter === 'pending' && t.status !== 'pending') return false;
    if (filter === 'resolved' && t.status !== 'resolved') return false;
    if (filter === 'ai' && t.agent !== 'ai') return false;
    if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.customer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tickets, filter, search, channelFilter]);

  const filters: { id: typeof filter; label: string; count: number; color: string }[] = [
    { id: 'all',      label: 'Tous',       count: tickets.length, color: C.coral },
    { id: 'urgent',   label: 'Urgents',    count: tickets.filter(t => t.priority === 'urgent').length, color: C.red },
    { id: 'open',     label: 'Ouverts',    count: tickets.filter(t => t.status === 'open').length,     color: C.coral },
    { id: 'pending',  label: 'En attente', count: tickets.filter(t => t.status === 'pending').length,  color: C.gold },
    { id: 'resolved', label: 'Résolus',    count: tickets.filter(t => t.status === 'resolved').length, color: C.sage },
    { id: 'ai',       label: 'IA',         count: tickets.filter(t => t.agent === 'ai').length,        color: C.cyan },
  ];

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: C.cream, borderRadius: 14, padding: 12, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {filters.map(f => {
              const active = filter === f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                  background: active ? `linear-gradient(135deg, ${f.color}, ${f.color}cc)` : 'transparent',
                  color: active ? C.cream : C.inkSoft,
                  padding: '7px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: active ? 'none' : '1px solid rgba(10,42,32,0.1)', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                }}>
                  {f.label}
                  <span className="sup-mono" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800 }}>{f.count}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, background: C.creamDeep, borderRadius: 10, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={13} color={C.inkSoft} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par titre, client…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: C.ink, fontFamily: 'inherit', minWidth: 0 }} />
            </div>
            <select value={channelFilter} onChange={e => setChannelFilter(e.target.value as 'all' | Channel)} style={{ background: C.creamDeep, color: C.ink, border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              <option value="all">Tous canaux</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="phone">Téléphone</option>
              <option value="live">Live chat</option>
            </select>
            <button style={{ background: 'transparent', color: C.inkSoft, border: '1px solid rgba(10,42,32,0.1)', padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <SlidersHorizontal size={12} /> Plus
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center' }}>
            <RefreshCw size={28} color={C.coral} className="sup-rotate" style={{ marginBottom: 12 }} />
            <div className="sup-display" style={{ fontSize: 16, color: C.ink }}>Chargement…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.15)' }}>
            <Inbox size={48} color={C.inkLight} style={{ marginBottom: 12 }} />
            <h3 className="sup-display" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px' }}>
              {tickets.length === 0 ? 'Aucun ticket pour l\'instant' : 'Aucun ticket ne correspond aux filtres'}
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
              {tickets.length === 0 ? 'Les nouveaux tickets s\'afficheront ici.' : 'Essayez d\'ajuster vos filtres.'}
            </p>
          </div>
        ) : (
          <div className="sup-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(t => (
              <TicketRow key={t.id} t={t} onClick={() => setSelectedTicket(t)} isSelected={selectedTicket?.id === t.id} />
            ))}
          </div>
        )}
      </div>

      {selectedTicket && <TicketDetailPanel ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
    </div>
  );
}

function TicketDetailPanel({ ticket, onClose }: { ticket: UiTicket; onClose: () => void }) {
  const ch = CHANNEL_ICONS[ticket.channel];
  const status = STATUS_CONFIG[ticket.status];
  const slaPercent = (ticket.sla / ticket.slaMax) * 100;
  const slaColor = getSlaColor(slaPercent);
  return (
    <div className="sup-detail sup-slide-right" style={{ width: 380, flexShrink: 0, background: C.cream, borderRadius: 18, border: '1px solid rgba(10,42,32,0.08)', overflow: 'hidden', position: 'sticky', top: 90, maxHeight: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})`, padding: 20, color: C.cream, position: 'relative' }}>
        <div className="sup-grain" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(255,250,240,0.2)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{ch.emoji}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,250,240,0.15)', border: 'none', borderRadius: 10, width: 32, height: 32, color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div className="sup-mono" style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>#{ticket.refId}</div>
        <h3 className="sup-display" style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em', lineHeight: 1.25 }}>{ticket.title}</h3>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{ticket.customer} · {ticket.time}</div>
      </div>

      <div className="sup-thin" style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 8 }}>SLA · {ticket.sla} / {ticket.slaMax} MIN</div>
          <div style={{ background: `${slaColor}15`, borderRadius: 12, padding: 12, border: `1px solid ${slaColor}40` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: slaColor, fontWeight: 700 }}>
                {slaPercent < 50 ? '✓ Dans les temps' : slaPercent < 80 ? '⚠ Attention' : '🔥 SLA en danger'}
              </span>
              <span className="sup-mono" style={{ fontSize: 11, color: slaColor, fontWeight: 700 }}>{Math.round(slaPercent)}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(10,42,32,0.06)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, slaPercent)}%`, background: `linear-gradient(90deg, ${slaColor}, ${slaColor}cc)`, borderRadius: 100 }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 8 }}>STATUT</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="sup-pill" style={{ background: status.bg, color: status.color, fontWeight: 700 }}>● {status.label}</span>
            <span className="sup-pill" style={{ background: PRIORITY_CONFIG[ticket.priority].bg, color: PRIORITY_CONFIG[ticket.priority].color, fontWeight: 700 }}>{PRIORITY_CONFIG[ticket.priority].label}</span>
            {ticket.agent === 'ai' ? (
              <span className="sup-pill" style={{ background: C.cyanSoft, color: C.cyanDeep, fontWeight: 700 }}><Bot size={10} /> Agent IA</span>
            ) : (
              <span className="sup-pill" style={{ background: C.coralSoft, color: C.coralDeep, fontWeight: 700 }}><User size={10} /> {ticket.raw.assignedToName ?? 'Humain'}</span>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 8 }}>CLIENT</div>
          <div style={{ background: C.creamDeep, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})`, color: C.cream, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: 'Fraunces, serif' }}>
              {ticket.customer.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{ticket.customer}</div>
              {ticket.raw.customerEmail && <div style={{ fontSize: 10, color: C.inkLight }}>{ticket.raw.customerEmail}</div>}
            </div>
          </div>
        </div>

        {ticket.raw.description && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 8 }}>DESCRIPTION</div>
            <div style={{ background: C.creamDeep, borderRadius: 12, padding: 12 }}>
              <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.5 }}>{ticket.raw.description}</p>
            </div>
          </div>
        )}

        {ticket.raw.category && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 8 }}>ANALYSE IA</div>
            <div style={{ background: `linear-gradient(135deg, ${C.cyanSoft}, ${C.indigoSoft})`, borderRadius: 12, padding: 12, border: `1px solid ${C.cyan}30` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Sparkles size={12} color={C.cyanDeep} />
                <span style={{ fontSize: 10, fontWeight: 800, color: C.cyanDark, letterSpacing: '0.08em' }}>CLASSIFICATION</span>
              </div>
              <p style={{ fontSize: 12, color: C.ink, margin: 0, lineHeight: 1.5 }}>
                <strong>Catégorie</strong> : {ticket.raw.category} · <strong>Priorité</strong> : {ticket.priority}
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: 14, borderTop: `1px solid ${C.creamDeep}`, background: C.cream, display: 'flex', gap: 6 }}>
        <button onClick={async () => { try { await api.patch(`/support/tickets/${ticket.id}`, { status: 'resolved' }); window.location.reload(); } catch { /* ignore */ } }} style={{ flex: 1, padding: '10px', justifyContent: 'center', fontSize: 12, background: `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})`, color: C.cream, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
          <CheckCircle2 size={13} /> Résoudre
        </button>
        <button onClick={async () => { try { await api.patch(`/support/tickets/${ticket.id}`, { status: 'escalated' }); window.location.reload(); } catch { /* ignore */ } }} className="sup-icon-btn" style={{ width: 38, height: 38 }} title="Escalader">
          <AlertTriangle size={15} />
        </button>
        <button className="sup-icon-btn ghost" style={{ width: 38, height: 38 }}><MoreVertical size={15} /></button>
      </div>
    </div>
  );
}

function KbTab({ articles, loading }: { articles: KbArticle[]; loading: boolean }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const totalViews = articles.reduce((s, a) => s + (a.views ?? 0), 0);
  const filtered = articles.filter(a => {
    if (activeCategory !== 'all' && a.category !== activeCategory) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const popular = articles.filter(a => a.popular || (a.views ?? 0) >= 1000).slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: `linear-gradient(135deg, ${C.cream}, ${C.creamDeep})`, borderRadius: 18, padding: 28, border: '1px solid rgba(10,42,32,0.06)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="sup-rotate" style={{ position: 'absolute', top: -100, right: -100, width: 250, height: 250, borderRadius: '50%', border: `1px dashed ${C.coral}30`, pointerEvents: 'none' }} />
        <div className="sup-pill" style={{ background: C.coralSoft, color: C.coralDeep, fontWeight: 700, marginBottom: 12 }}>
          <BookOpen size={11} /> {articles.length} ARTICLE{articles.length > 1 ? 'S' : ''} · {totalViews.toLocaleString('fr-FR')} VUES
        </div>
        <h2 className="sup-display" style={{ fontSize: 28, fontWeight: 800, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Comment pouvons-nous <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.coral }}>vous aider</em> ?
        </h2>
        <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 18px' }}>
          Trouvez des réponses dans notre base de connaissances · Mise à jour quotidienne
        </p>
        <div style={{ background: C.cream, borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 580, margin: '0 auto', border: `1px solid ${C.coral}30`, boxShadow: `0 8px 20px -8px ${C.coral}40` }}>
          <Search size={18} color={C.coral} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Recherchez un article, une question…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.ink, fontFamily: 'inherit' }} />
        </div>
      </div>

      <div className="sup-thin" style={{ background: C.cream, borderRadius: 14, padding: 12, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {KB_CATEGORIES.map(cat => {
          const active = activeCategory === cat.id;
          const count = cat.id === 'all' ? articles.length : articles.filter(a => a.category === cat.id).length;
          return (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
              background: active ? `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` : 'transparent',
              color: active ? C.cream : C.inkSoft,
              padding: '8px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(10,42,32,0.1)', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
            }}>
              {cat.label}
              <span className="sup-mono" style={{ background: active ? 'rgba(255,250,240,0.25)' : C.creamDeep, color: active ? C.cream : C.inkSoft, padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center' }}>
          <RefreshCw size={28} color={C.coral} className="sup-rotate" style={{ marginBottom: 12 }} />
          <div className="sup-display" style={{ fontSize: 16, color: C.ink }}>Chargement…</div>
        </div>
      ) : articles.length === 0 ? (
        <div style={{ background: C.cream, borderRadius: 18, padding: 60, textAlign: 'center', border: '1px dashed rgba(10,42,32,0.15)' }}>
          <BookOpen size={48} color={C.inkLight} style={{ marginBottom: 12 }} />
          <h3 className="sup-display" style={{ fontSize: 18, color: C.ink, margin: '0 0 6px' }}>Aucun article publié</h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>Crée le premier article pour aider tes clients.</p>
        </div>
      ) : (
        <>
          {activeCategory === 'all' && !search && popular.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 4px' }}>
                <Flame size={14} color={C.coral} />
                <span className="sup-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                  <em style={{ fontStyle: 'italic', fontWeight: 500 }}>Populaires</em> en ce moment
                </span>
              </div>
              <div className="sup-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {popular.map(a => (
                  <div key={a.id} className="sup-card-lift" style={{ background: `linear-gradient(135deg, ${C.coralSoft}30, ${C.goldSoft}40)`, borderRadius: 14, padding: 14, border: `1px solid ${C.coral}30`, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: `0 4px 10px -4px ${C.coral}` }}>{ICON_FOR_CAT[a.category ?? 'general'] ?? '📘'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span className="sup-pill" style={{ background: C.coral, color: C.cream, fontSize: 9, fontWeight: 800 }}>🔥 POPULAIRE</span>
                      </div>
                      <h4 className="sup-display" style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: '0 0 3px', letterSpacing: '-0.01em' }}>{a.title}</h4>
                      <div style={{ fontSize: 10, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Eye size={9} /> <span className="sup-mono">{(a.views ?? 0).toLocaleString('fr-FR')}</span> vues
                        {typeof a.helpful === 'number' && (<><span>·</span><ThumbsUp size={9} /><span className="sup-mono">{a.helpful}%</span></>)}
                      </div>
                    </div>
                    <ArrowRight size={16} color={C.coral} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 4px' }}>
              <span className="sup-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                {filtered.length} article{filtered.length > 1 ? 's' : ''}
              </span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ background: C.cream, borderRadius: 12, padding: 30, textAlign: 'center', color: C.inkSoft, fontSize: 12 }}>
                Aucun article ne correspond
              </div>
            ) : (
              <div className="sup-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(a => {
                  const cat = KB_CATEGORIES.find(c => c.id === a.category);
                  return (
                    <div key={a.id} className="sup-card-lift" style={{ background: C.cream, borderRadius: 12, padding: 12, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: C.creamDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{ICON_FOR_CAT[a.category ?? 'general'] ?? '📘'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                          <h4 className="sup-display" style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>{a.title}</h4>
                          {cat && (
                            <span className="sup-pill" style={{ background: `${cat.color}15`, color: cat.color, fontSize: 9, fontWeight: 700 }}>{cat.label}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: C.inkLight, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={9} /><span className="sup-mono" style={{ fontWeight: 700 }}>{(a.views ?? 0).toLocaleString('fr-FR')}</span></span>
                          {typeof a.helpful === 'number' && (<><span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.sageDark, fontWeight: 700 }}><ThumbsUp size={9} /><span className="sup-mono">{a.helpful}%</span></span></>)}
                          {a.updatedAt && (<><span>·</span><span>{fmtRel(tsToMs(a.updatedAt))}</span></>)}
                        </div>
                      </div>
                      <ChevronRight size={16} color={C.inkLight} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface ChatMsg { id: string; from: 'ai' | 'user'; text: string; time: string }
function ChatTab() {
  const { user } = useAuthStore();
  const userInitial = (user?.displayName ?? user?.email ?? '?')[0].toUpperCase();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 'welcome', from: 'ai', text: `Bonjour ${user?.displayName?.split(' ')[0] ?? ''} 👋 Je suis l'agent Support Client IA d'Orlode. Pose-moi une question, je suis branché sur tes tickets, ta base de connaissances et tes stats.`, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [sending, setSending] = useState(false);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: `u_${Date.now()}`, from: 'user', text: msg, time: now }]);
    setInput('');
    setSending(true);
    try {
      const r = await api.post('/support/chat', { message: msg });
      const reply = r?.data?.data?.response ?? r?.data?.response ?? 'Je n\'ai pas pu générer de réponse.';
      setMessages(prev => [...prev, { id: `a_${Date.now()}`, from: 'ai', text: reply, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    } catch {
      setMessages(prev => [...prev, { id: `a_err_${Date.now()}`, from: 'ai', text: '⚠️ Impossible de joindre l\'agent IA. Réessaie dans un instant.', time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    } finally { setSending(false); }
  };

  const quickPrompts = [
    { icon: Inbox, label: 'Combien de tickets ouverts ?' },
    { icon: TrendingUp, label: 'Stats satisfaction cette semaine' },
    { icon: BookOpen, label: 'Crée un article FAQ sur les paiements' },
    { icon: AlertTriangle, label: 'Tickets en danger SLA' },
    { icon: User, label: 'Historique d\'un client' },
    { icon: BarChart3, label: 'Analyse des canaux' },
  ];

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, borderRadius: 16, padding: '16px 20px', color: C.cream, position: 'relative', overflow: 'hidden' }}>
          <div className="sup-grain" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(255,250,240,0.25)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={26} color={C.cream} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="sup-display" style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Agent IA Support Client</h3>
              <div style={{ fontSize: 11, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span className="sup-live-dot" style={{ background: C.gold }} />
                Actif · branché sur tes tickets
              </div>
            </div>
            <button onClick={() => setMessages(messages.slice(0, 1))} className="sup-icon-btn" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream }} title="Réinitialiser">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div className="sup-thin" style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', minHeight: 380, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map(m => {
            const isUser = m.from === 'user';
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: isUser ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})` : `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: isUser ? C.greenInk : C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, fontFamily: 'Fraunces, serif' }}>
                  {isUser ? userInitial : <Bot size={16} />}
                </div>
                <div style={{ maxWidth: '80%' }}>
                  <div style={{ background: isUser ? `linear-gradient(135deg, ${C.coral}, ${C.coralDeep})` : C.creamDeep, color: isUser ? C.cream : C.ink, padding: '11px 14px', borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px', fontSize: 13, lineHeight: 1.5, boxShadow: isUser ? `0 6px 14px -6px ${C.coral}` : 'none', whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </div>
                  <div className="sup-mono" style={{ fontSize: 9, color: C.inkLight, marginTop: 3, textAlign: isUser ? 'right' : 'left', padding: '0 4px' }}>{m.time}</div>
                </div>
              </div>
            );
          })}
          {sending && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={16} /></div>
              <div style={{ background: C.creamDeep, padding: '10px 14px', borderRadius: '4px 14px 14px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <div className="sup-type-1" style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyanDeep }} />
                <div className="sup-type-2" style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyanDeep }} />
                <div className="sup-type-3" style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyanDeep }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ background: C.cream, borderRadius: 16, padding: 14, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ background: C.creamDeep, borderRadius: 12, padding: 8, display: 'flex', alignItems: 'flex-end', gap: 6, border: '1.5px solid rgba(10,42,32,0.08)' }}>
            <button className="sup-icon-btn ghost" style={{ width: 32, height: 32 }}><Paperclip size={14} /></button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Posez une question à l'agent IA…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: C.ink, fontFamily: 'inherit', padding: '8px 4px' }}
            />
            <button className="sup-icon-btn ghost" style={{ width: 32, height: 32 }}><Mic size={14} /></button>
            <button onClick={() => send()} disabled={!input.trim() || sending} style={{ background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!input.trim() || sending) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="sup-detail" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 90 }}>
        <div style={{ background: C.cream, borderRadius: 16, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div className="sup-pill" style={{ background: C.cyanSoft, color: C.cyanDeep, fontWeight: 700, fontSize: 10, marginBottom: 8 }}>
            <Zap size={10} /> SUGGESTIONS RAPIDES
          </div>
          <h4 className="sup-display" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Que voulez-vous <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>faire</em> ?
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {quickPrompts.map((p, i) => {
              const Icon = p.icon;
              return (
                <button key={i} onClick={() => send(p.label)} style={{ background: 'transparent', border: '1px solid rgba(10,42,32,0.08)', borderRadius: 9, padding: '8px 10px', fontSize: 11, color: C.ink, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.15s ease' }}>
                  <Icon size={12} color={C.cyanDeep} />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${C.cyanSoft}, ${C.indigoSoft})`, borderRadius: 16, padding: 14, border: `1px solid ${C.cyan}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Sparkles size={12} color={C.cyanDeep} />
            <span style={{ fontSize: 10, fontWeight: 800, color: C.cyanDark, letterSpacing: '0.08em' }}>CAPACITÉS</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: C.ink }}>
            {[
              '✓ Lire & créer des tickets',
              '✓ Générer des articles FAQ',
              '✓ Analyser la satisfaction',
              '✓ Auto-classifier les requêtes',
              '✓ Escalader vers un humain',
            ].map((c, i) => (
              <div key={i}>{c}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
