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
  Trash2, Loader2, Star, Zap, ArrowRight, MessageSquare,
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
  surveillance: '#1E40AF', workflow: '#F59E0B',
};

const AGENT_EMOJIS: Record<string, string> = {
  orchestrator: '🧠', knowledge: '📚', reception: '🚪', hr: '👩', accounting: '💰',
  sales: '🤝', support: '📞', it: '🖥', meeting: '🎤', vision: '👁', insights: '📊',
  comms: '📧', marketing: '📣', cybersecurity: '🛡', legal: '⚖', training: '🎓', news: '⭐',
  coach: '🧑‍🏫', datascientist: '🔬', wildcard: '🔮', commercial: '💼',
  physical_security: '🛡️', surveillance: '📹', workflow: '⚡',
};

export default function AgentMonitorPage() {
  const { company } = useAuthStore();
  const { formatShort } = useCurrency();
  const hasAccess = useAgentRolesStore(s => s.hasAccess);
  const [tab, setTab] = useState<'builtin' | 'marketplace'>('builtin');

  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loadingBuiltin, setLoadingBuiltin] = useState(true);

  const [installed, setInstalled] = useState<InstalledAgent[]>([]);
  const [agentDetails, setAgentDetails] = useState<Map<string, MarketplaceAgent>>(new Map());
  const [loadingMk, setLoadingMk] = useState(true);
  const [uninstalling, setUninstalling] = useState<string | null>(null);

  useEffect(() => { loadBuiltin(); loadMarketplace(); }, [company?.id]);

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              <Bot size={20} className="text-white" />
            </div>
            Mes Agents
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {agents.length} Orlode · {installed.length} marketplace · <span className="font-semibold text-violet-600">{agents.length + installed.length} total</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadBuiltin(); loadMarketplace(); }}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
            <RefreshCw size={14} /> Actualiser
          </button>
          <Link to="/marketplace"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:shadow-xl hover:shadow-violet-500/30"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
            <ShoppingBag size={14} /> Marketplace
          </Link>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassStatCard icon={<Activity size={18} />} iconBg="#10B981" label="Agents actifs" value={agents.filter(a => a.status === 'active').length} loading={loadingBuiltin} />
        <GlassStatCard icon={<MessageSquare size={18} />} iconBg="#3B82F6" label="Appels aujourd'hui" value={totalCalls} loading={loadingBuiltin} />
        <GlassStatCard icon={<Zap size={18} />} iconBg="#F59E0B" label="Tokens aujourd'hui" value={totalTokens > 1000 ? `${Math.round(totalTokens / 1000)}k` : totalTokens} loading={loadingBuiltin} />
        <GlassStatCard icon={<Clock size={18} />} iconBg="#EF4444" label="Latence moyenne" value={`${avgLatency}ms`} loading={loadingBuiltin} />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <button onClick={() => setTab('builtin')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            tab === 'builtin'
              ? 'text-white shadow-lg shadow-blue-500/20'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
          }`}
          style={tab === 'builtin' ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)' } : {}}>
          Orlode ({agents.length})
        </button>
        <button onClick={() => setTab('marketplace')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            tab === 'marketplace'
              ? 'text-white shadow-lg shadow-violet-500/20'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
          }`}
          style={tab === 'marketplace' ? { background: 'linear-gradient(135deg, #8B5CF6, #A855F7)' } : {}}>
          Marketplace ({installed.length})
        </button>
      </div>

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
            <p className="text-gray-500 mb-4">Aucun agent marketplace installe</p>
            <Link to="/marketplace"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #A855F7)' }}>
              <ShoppingBag size={16} /> Explorer le marketplace
            </Link>
          </div>
        )
      )}
    </div>
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
