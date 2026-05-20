/**
 * AgentMonitorPage — Mes Agents (3D immersive design)
 * 3-col grid laptop, 1 col phone, dynamic 3D cards
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useAgentRolesStore } from '@/store/agentRolesStore';
import api from '@/services/api';
import {
  Activity, Clock, RefreshCw, Bot, ShoppingBag,
  Trash2, Loader2, Star, Zap, ArrowRight, MessageSquare, Boxes,
  ChefHat, BedDouble, Scissors, Stethoscope, Home, Briefcase, Building2, Plus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';

interface AgentStatus {
  name: string; displayName: string; model: string;
  status: 'active' | 'idle' | 'error'; callsToday: number;
  tokensToday: number; avgLatencyMs: number; enabled: boolean;
  icon?: string; category?: string; skills?: number;
}

interface InstalledAgent {
  id: string; agentId: string; status: string; pricingModel: string; installedAt: string;
  cachedConfig?: { name?: string };
}

interface MarketplaceAgent {
  id: string; name: string; icon: string; description: string; industry: string;
  pricingModel: string; priceUSD: number; avgRating: number; color: string; features: string[];
}

const AGENT_COLORS: Record<string, string> = {
  orchestrator: '#6366F1', knowledge: '#0EA5E9', reception: '#14B8A6',
  hr: '#6366F1', accounting: '#16A34A', sales: '#F97316', support: '#06B6D4',
  it: '#64748B', meeting: '#E11D48', vision: '#D946EF', insights: '#F59E0B',
  comms: '#EC4899', marketing: '#8B5CF6', cybersecurity: '#EF4444', legal: '#78716C',
  training: '#0284C7', news: '#EAB308', coach: '#84CC16', datascientist: '#0891B2',
  wildcard: '#A855F7', commercial: '#EA580C', physical_security: '#475569',
  surveillance: '#1E40AF', workflow: '#F59E0B', kora: '#F59E0B',
};

// Pack catalog (mirrors MultiPackHomePage). Used by the "Packs" tab on /agents.
interface PackDef {
  id: string; businessType: string; emoji: string; label: string; pitch: string;
  href: string; color: string; bg: string; icon: typeof ShoppingBag;
}
const VERTICAL_PACKS: PackDef[] = [
  { id: 'boutique',   businessType: 'boutique',   emoji: '🛍', label: 'Boutique',    pitch: 'Vends sur WhatsApp avec une photo.',          href: '/agents/commerce',   color: '#0A4F3C', bg: '#D1FAE5', icon: ShoppingBag },
  { id: 'restaurant', businessType: 'restaurant', emoji: '🍽', label: 'Restaurant',  pitch: 'Menu, commandes, réservations.',              href: '/agents/restaurant', color: '#C2410C', bg: '#FFEDD5', icon: ChefHat },
  { id: 'hotel',      businessType: 'hotel',      emoji: '🏨', label: 'Hôtel',       pitch: 'Chambres et séjours.',                        href: '/agents/hotel',      color: '#0369A1', bg: '#E0F2FE', icon: BedDouble },
  { id: 'service',    businessType: 'service',    emoji: '💇', label: 'Salon',       pitch: 'Coiffure, beauté — RDV auto.',                href: '/agents/service',    color: '#DB2777', bg: '#FCE7F3', icon: Scissors },
  { id: 'health',     businessType: 'health',     emoji: '🏥', label: 'Cabinet',     pitch: 'Patients et consultations confidentielles.',  href: '/agents/health',     color: '#0F766E', bg: '#CCFBF1', icon: Stethoscope },
  { id: 'realestate', businessType: 'realestate', emoji: '🏠', label: 'Immobilier',  pitch: 'Biens et visites — qualif leads.',            href: '/agents/realestate', color: '#5B21B6', bg: '#EDE9FE', icon: Home },
  { id: 'residence',  businessType: 'residence',  emoji: '🏘', label: 'Résidences',  pitch: 'Booking/Airbnb — N unités indépendantes.',   href: '/agents/residences', color: '#9F1239', bg: '#FFE4E6', icon: Home },
];
const HUB_PACKS: PackDef[] = [
  { id: 'pme',        businessType: 'pme',        emoji: '🚀', label: 'PME',         pitch: 'Sales · Comms · Marketing · Support.',        href: '/agents/pme',        color: '#059669', bg: '#D1FAE5', icon: Briefcase },
  { id: 'enterprise', businessType: 'enterprise', emoji: '🏢', label: 'Entreprise',  pitch: 'Sales · Compta · Support · Comms.',           href: '/agents/enterprise', color: '#0E7490', bg: '#CFFAFE', icon: Building2 },
];

const AGENT_EMOJIS: Record<string, string> = {
  orchestrator: '🧠', knowledge: '📚', reception: '🚪', hr: '👩', accounting: '💰',
  sales: '🤝', support: '📞', it: '🖥', meeting: '🎤', vision: '👁', insights: '📊',
  comms: '📧', marketing: '📣', cybersecurity: '🛡', legal: '⚖', training: '🎓', news: '⭐',
  coach: '🧑‍🏫', datascientist: '🔬', wildcard: '🔮', commercial: '💼',
  physical_security: '🛡️', surveillance: '📹', workflow: '⚡', kora: '🪕',
};

export default function AgentMonitorPage() {
  const { company } = useAuthStore();
  const { formatShort } = useCurrency();
  const hasAccess = useAgentRolesStore(s => s.hasAccess);
  const [tab, setTab] = useState<'builtin' | 'packs' | 'marketplace'>('builtin');

  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loadingBuiltin, setLoadingBuiltin] = useState(true);

  const [installed, setInstalled] = useState<InstalledAgent[]>([]);
  const [agentDetails, setAgentDetails] = useState<Map<string, MarketplaceAgent>>(new Map());
  const [loadingMk, setLoadingMk] = useState(true);
  const [uninstalling, setUninstalling] = useState<string | null>(null);

  const [activatedTypes, setActivatedTypes] = useState<Set<string>>(new Set());
  const [loadingPacks, setLoadingPacks] = useState(true);

  useEffect(() => { loadBuiltin(); loadMarketplace(); loadPacks(); }, [company?.id]);

  const loadPacks = async () => {
    setLoadingPacks(true);
    try {
      const r: any = await api.get('/commerce/stores');
      const stores = (r?.data?.stores ?? []) as Array<{ businessType?: string }>;
      setActivatedTypes(new Set(stores.map(s => s.businessType ?? 'boutique')));
    } catch {}
    setLoadingPacks(false);
  };

  const loadBuiltin = async () => {
    setLoadingBuiltin(true);
    try {
      const res = await api.get('/agents/status');
      const raw = res.data ?? res.data;
      const list = (Array.isArray(raw) ? raw : []) as AgentStatus[];
      // Filter out agents the current user doesn't have access to
      setAgents(list.filter(a => hasAccess(a.name)));
    } catch {}
    setLoadingBuiltin(false);
  };

  const loadMarketplace = async () => {
    setLoadingMk(true);
    try {
      const [instRes, allRes] = await Promise.all([
        api.get('/marketplace/my-installed'),
        api.get('/marketplace/agents'),
      ]);
      const instData = instRes.data?.data ?? instRes.data;
      setInstalled(Array.isArray(instData) ? instData : []);
      const allData = allRes.data?.data ?? allRes.data;
      const map = new Map<string, MarketplaceAgent>();
      (Array.isArray(allData) ? allData : []).forEach((a: MarketplaceAgent) => map.set(a.id, a));
      setAgentDetails(map);
    } catch {}
    setLoadingMk(false);
  };

  const handleUninstall = async (agentId: string) => {
    if (!confirm('Desinstaller cet agent ?')) return;
    setUninstalling(agentId);
    try {
      await api.post(`/marketplace/agents/${agentId}/uninstall`);
      setInstalled(prev => prev.filter(a => (a.agentId ?? a.id) !== agentId));
    } catch {}
    setUninstalling(null);
  };

  const totalCalls = agents.reduce((s, a) => s + a.callsToday, 0);
  const totalTokens = agents.reduce((s, a) => s + a.tokensToday, 0);
  const avgLatency = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.avgLatencyMs, 0) / agents.length) : 0;

  // Tab-aware accent color (used in hero + tab pill background)
  const tabAccent = tab === 'builtin'
    ? { from: '#3B82F6', to: '#6366F1', shadow: 'shadow-blue-500/20' }
    : tab === 'packs'
    ? { from: '#059669', to: '#10B981', shadow: 'shadow-emerald-500/20' }
    : { from: '#8B5CF6', to: '#A855F7', shadow: 'shadow-violet-500/20' };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-violet-50/40 dark:from-gray-900 dark:via-gray-900 dark:to-violet-950/40">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5 md:space-y-6">
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl md:rounded-3xl p-5 md:p-7 text-white shadow-xl"
          style={{ background: `linear-gradient(135deg, ${tabAccent.from}, ${tabAccent.to})` }}
        >
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute right-12 bottom-0 w-32 h-32 rounded-full bg-white/5 blur-xl" />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <Bot size={26} className="text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-3xl font-bold tracking-tight">Mes Agents</h1>
                <p className="text-sm md:text-base text-white/80 mt-0.5">
                  {agents.length} Orlode · {activatedTypes.size} packs · {installed.length} marketplace
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => { loadBuiltin(); loadMarketplace(); loadPacks(); }}
                aria-label="Actualiser"
                className="flex items-center justify-center gap-2 w-10 h-10 md:w-auto md:h-auto md:px-4 md:py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-sm font-medium text-white transition-colors"
              >
                <RefreshCw size={14} />
                <span className="hidden md:inline">Actualiser</span>
              </button>
              <Link
                to="/marketplace"
                className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-semibold text-gray-900 bg-white rounded-xl hover:bg-white/90 transition-colors shadow-sm"
              >
                <ShoppingBag size={14} /> Explorer
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stats (only on Orlode tab — these are runtime metrics) ── */}
        {tab === 'builtin' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3">
            <GlassStatCard icon={<Activity size={18} />} iconBg="#10B981" label="Agents actifs" value={agents.filter(a => a.status === 'active').length} loading={loadingBuiltin} />
            <GlassStatCard icon={<MessageSquare size={18} />} iconBg="#3B82F6" label="Appels aujourd'hui" value={totalCalls} loading={loadingBuiltin} />
            <GlassStatCard icon={<Zap size={18} />} iconBg="#F59E0B" label="Tokens aujourd'hui" value={totalTokens > 1000 ? `${Math.round(totalTokens / 1000)}k` : totalTokens} loading={loadingBuiltin} />
            <GlassStatCard icon={<Clock size={18} />} iconBg="#EF4444" label="Latence moyenne" value={`${avgLatency}ms`} loading={loadingBuiltin} />
          </div>
        )}

        {/* ── Segmented tab bar ─────────────────────────────────────── */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200/70 dark:border-gray-700/70 rounded-2xl p-1.5 inline-flex gap-1 w-full md:w-auto overflow-x-auto no-scrollbar">
          <SegBtn active={tab === 'builtin'} onClick={() => setTab('builtin')} accent="from-blue-500 to-indigo-600" icon={<Bot size={14} />} label="Orlode" count={agents.length} />
          <SegBtn active={tab === 'packs'} onClick={() => setTab('packs')} accent="from-emerald-600 to-emerald-500" icon={<Boxes size={14} />} label="Packs" count={activatedTypes.size} />
          <SegBtn active={tab === 'marketplace'} onClick={() => setTab('marketplace')} accent="from-violet-500 to-fuchsia-500" icon={<ShoppingBag size={14} />} label="Marketplace" count={installed.length} />
        </div>

      {/* ── Packs ─────────────────────────────────────────────────── */}
      {tab === 'packs' && (
        <div className="space-y-5">
          {loadingPacks ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
          ) : (
            <>
              {/* Activated verticals */}
              {VERTICAL_PACKS.some(p => activatedTypes.has(p.businessType)) && (
                <div>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mes packs activés</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {VERTICAL_PACKS.filter(p => activatedTypes.has(p.businessType)).map(p => (
                      <Link key={p.id} to={p.href}
                        className="bg-white dark:bg-gray-800 rounded-2xl border-2 p-4 hover:shadow-lg transition-all group"
                        style={{ borderColor: `${p.color}30` }}>
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: p.bg }}>
                            {p.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-bold text-gray-900 dark:text-white">{p.label}</h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: p.bg, color: p.color }}>ACTIF</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{p.pitch}</p>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all" style={{ color: p.color }}>
                              Ouvrir <ArrowRight size={12} />
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Available verticals */}
              {VERTICAL_PACKS.some(p => !activatedTypes.has(p.businessType)) && (
                <div>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">À découvrir</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {VERTICAL_PACKS.filter(p => !activatedTypes.has(p.businessType)).map(p => (
                      <Link key={p.id} to={p.href}
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-400 hover:shadow-md transition-all group">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl flex-shrink-0 grayscale group-hover:grayscale-0 transition-all">
                            {p.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-bold text-gray-700 dark:text-gray-300">{p.label}</h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">$20/mo</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{p.pitch}</p>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 group-hover:gap-2 transition-all">
                              <Plus size={12} /> Activer
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Hubs (always available) */}
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Hubs cross-fonctionnels</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {HUB_PACKS.map(p => (
                    <Link key={p.id} to={p.href}
                      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all group"
                      style={{ borderColor: `${p.color}25` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: p.bg }}>
                          {p.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-white mb-1">{p.label}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{p.pitch}</p>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all" style={{ color: p.color }}>
                            Ouvrir <ArrowRight size={12} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Built-in agents ───────────────────────────────────────── */}
      {tab === 'builtin' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingBuiltin ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 animate-pulse h-56" />
            ))
          ) : agents.length > 0 ? agents.map((agent, idx) => {
            const color = AGENT_COLORS[agent.name] ?? '#6366F1';
            const emoji = agent.icon ?? AGENT_EMOJIS[agent.name] ?? '🤖';
            return (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, y: 30, rotateX: -10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.05, type: 'spring', bounce: 0.3 }}
              >
                <Link to={`/agents/${agent.name}`}
                  className="group block rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                  style={{ perspective: '800px' }}>
                  {/* Top gradient section */}
                  <div className="relative p-5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
                    {/* Decorative circles */}
                    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20" style={{ background: 'white' }} />
                    <div className="absolute -right-2 -bottom-8 w-16 h-16 rounded-full opacity-10" style={{ background: 'white' }} />

                    <div className="relative flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                        <span className="text-3xl">{emoji}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-white truncate">{agent.displayName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wide">
                            {agent.status === 'active' ? 'En ligne' : agent.status}
                          </span>
                          <span className="text-xs text-white/60">{agent.skills ?? 0} skills</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom stats section */}
                  <div className="bg-white dark:bg-gray-800 p-4">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <StatMini label="Appels" value={agent.callsToday} color={color} />
                      <StatMini label="Tokens" value={agent.tokensToday > 1000 ? `${Math.round(agent.tokensToday / 1000)}k` : agent.tokensToday} color={color} />
                      <StatMini label="Latence" value={`${agent.avgLatencyMs}ms`} color={color} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{agent.category}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all" style={{ color }}>
                        Dashboard <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          }) : (
            <div className="col-span-full text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
              <Bot size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 mb-4">Aucun agent actif</p>
              <Link to="/admin/subscription" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                Choisir mes agents
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Marketplace agents ────────────────────────────────────── */}
      {tab === 'marketplace' && (
        loadingMk ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
        ) : installed.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {installed.map((inst, idx) => {
              const agentId = inst.agentId ?? inst.id;
              const detail = agentDetails.get(agentId);
              const name = detail?.name ?? inst.cachedConfig?.name ?? agentId;
              const icon = detail?.icon ?? '🤖';
              const color = AGENT_COLORS[agentId] ?? '#8B5CF6';
              return (
                <motion.div
                  key={agentId}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className="group rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="relative p-5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
                    <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20" style={{ background: 'white' }} />
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <span className="text-3xl">{icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-white truncate">{name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-white/70">{detail?.industry ?? ''}</span>
                          {detail?.avgRating ? (
                            <span className="flex items-center gap-0.5 text-xs text-white/80">
                              <Star size={10} className="fill-white/80" /> {detail.avgRating}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/20 text-white font-bold">
                        {inst.pricingModel === 'monthly' ? `${formatShort(detail?.priceUSD ?? 0)}/mo` : inst.pricingModel === 'included' ? 'INCLUS' : 'GRATUIT'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 min-h-[32px]">{detail?.description ?? ''}</p>
                    <div className="flex gap-2">
                      <Link to={`/agent/${agentId}`}
                        className="flex-1 py-2.5 text-center text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
                        style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
                        Ouvrir <ArrowRight size={13} />
                      </Link>
                      <button onClick={() => handleUninstall(agentId)} disabled={uninstalling === agentId}
                        className="px-3 py-2.5 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 transition-colors">
                        {uninstalling === agentId ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <ShoppingBag size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">Aucun agent marketplace installé</p>
            <Link to="/marketplace"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #A855F7)' }}>
              <ShoppingBag size={16} /> Explorer le marketplace
            </Link>
          </div>
        )
      )}
      </div>
    </div>
  );
}

// ── Segmented tab button ────────────────────────────────────────────────────
function SegBtn({ active, onClick, accent, icon, label, count }: {
  active: boolean; onClick: () => void; accent: string;
  icon: React.ReactNode; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 md:px-5 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
        active
          ? `text-white shadow-md bg-gradient-to-r ${accent}`
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
      }`}
    >
      {icon} {label}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
        {count}
      </span>
    </button>
  );
}

// ── Glass stat card ─────────────────────────────────────────────────────────
function GlassStatCard({ icon, iconBg, label, value, loading }: {
  icon: React.ReactNode; iconBg: string; label: string; value: string | number; loading: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: iconBg }}>{icon}</div>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? '—' : value}</p>
    </div>
  );
}

// ── Mini stat inside card ───────────────────────────────────────────────────
function StatMini({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50">
      <p className="text-base font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
