/**
 * MyAgentsPage — Mes agents installes
 * Affiche les agents que l'utilisateur a choisi/paye/installe
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Bot, Trash2, MessageCircle, ShoppingBag, Star, Check,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';

interface InstalledAgent {
  id: string; agentId: string; status: string; pricingModel: string;
  installedAt: string;
  cachedConfig?: { name?: string; systemPrompt?: string };
}

interface MarketplaceAgent {
  id: string; name: string; icon: string; description: string; industry: string;
  pricingModel: string; priceUSD: number; avgRating: number; ratingCount: number;
  color: string; features: string[];
}

export default function MyAgentsPage() {
  const { formatShort } = useCurrency();
  const [installed, setInstalled] = useState<InstalledAgent[]>([]);
  const [agentDetails, setAgentDetails] = useState<Map<string, MarketplaceAgent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [uninstalling, setUninstalling] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Fetch marketplace-installed agents
      const instRes = await api.get('/marketplace/my-installed');
      const raw = instRes.data;
      const marketplaceInstalled = (Array.isArray(raw) ? raw : []) as InstalledAgent[];

      // Core agents are ALWAYS available to every plan — even Free / no subscription.
      const CORE_AGENTS = ['orchestrator', 'knowledge', 'wildcard'];

      // Plan-selected agents (best-effort — never blocks the core display).
      let selectedAgents: string[] = [];
      try {
        const subRes: any = await api.get('/subscription/my-agents');
        const subPayload = subRes?.data?.data ?? subRes?.data ?? {};
        selectedAgents = Array.isArray(subPayload.selectedAgents) ? subPayload.selectedAgents : [];
      } catch { /* fall through — core agents still rendered */ }

      // Free catalog used to resolve names/icons (best-effort).
      const catalogMap = new Map<string, { id: string; name: string; icon: string; description: string; category?: string }>();
      try {
        const availRes: any = await api.get('/subscription/available/free');
        const availPayload = availRes?.data?.data ?? availRes?.data ?? {};
        const catalog = Array.isArray(availPayload.agents) ? availPayload.agents : [];
        catalog.forEach((a: { id: string; name: string; icon: string; description: string; category?: string }) => catalogMap.set(a.id, a));
      } catch { /* fall through */ }

      const builtInList: InstalledAgent[] = [];
      const idsToShow = new Set<string>([...CORE_AGENTS, ...selectedAgents]);
      for (const agentId of idsToShow) {
        if (marketplaceInstalled.some(m => (m.agentId ?? m.id) === agentId)) continue;
        const info = catalogMap.get(agentId);
        const isCore = CORE_AGENTS.includes(agentId);
        builtInList.push({
          agentId,
          id: agentId,
          status: 'active',
          pricingModel: isCore ? 'core' : 'included',
          installedAt: new Date().toISOString(),
          cachedConfig: info ? { name: info.name, icon: info.icon } : undefined,
        } as unknown as InstalledAgent);
      }

      setInstalled([...marketplaceInstalled, ...builtInList]);

      // Fetch marketplace agent details (for pricing/descriptions of paid agents)
      const allAgentsRes = await api.get('/marketplace/agents');
      const allRaw = allAgentsRes.data;
      const allAgents = (Array.isArray(allRaw) ? allRaw : []) as MarketplaceAgent[];
      const map = new Map<string, MarketplaceAgent>();
      allAgents.forEach(a => map.set(a.id, a));
      setAgentDetails(map);
    } catch {}
    setLoading(false);
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  const activeAgents = installed.filter(a => a.status === 'active');
  const paidAgents = installed.filter(a => a.pricingModel === 'monthly' || a.pricingModel === 'one_time');
  const freeAgents = installed.filter(a => a.pricingModel === 'included' || a.pricingModel === 'free');

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot size={22} className="text-violet-500" /> Mes Agents
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeAgents.length} agent{activeAgents.length > 1 ? 's' : ''} installe{activeAgents.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/marketplace"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-600 bg-violet-50 rounded-xl hover:bg-violet-100">
          <ShoppingBag size={16} /> Marketplace
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-blue-600">{activeAgents.length}</p>
          <p className="text-xs text-gray-500">Agents actifs</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-green-600">{freeAgents.length}</p>
          <p className="text-xs text-gray-500">Gratuits / Inclus</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-violet-600">{paidAgents.length}</p>
          <p className="text-xs text-gray-500">Premium</p>
        </div>
      </div>

      {/* Empty state */}
      {installed.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <Bot size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Vous n'avez pas encore installe d'agent</p>
          <p className="text-sm text-gray-400 mb-4">Explorez le marketplace pour trouver des agents adaptes a votre activite</p>
          <Link to="/marketplace"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl bg-violet-600 hover:bg-violet-700">
            <ShoppingBag size={16} /> Explorer le marketplace
          </Link>
        </div>
      )}

      {/* Agent list */}
      {installed.length > 0 && (
        <div className="space-y-3">
          {installed.map(inst => {
            const agentId = inst.agentId ?? inst.id;
            const detail = agentDetails.get(agentId);
            const name = detail?.name ?? inst.cachedConfig?.name ?? agentId;
            const icon = detail?.icon ?? '🤖';
            const description = detail?.description ?? inst.cachedConfig?.systemPrompt?.slice(0, 100) ?? '';
            const color = detail?.color ?? 'from-blue-600 to-violet-600';

            return (
              <div key={agentId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className={`h-1.5 bg-gradient-to-r ${color}`} />
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900">{name}</p>
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">
                          <Check size={8} /> INSTALLE
                        </span>
                        {inst.pricingModel === 'monthly' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">
                            {formatShort(detail?.priceUSD ?? 0)}/mo
                          </span>
                        )}
                        {(inst.pricingModel === 'included') && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">INCLUS</span>
                        )}
                        {inst.pricingModel === 'free' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">GRATUIT</span>
                        )}
                      </div>
                      {detail?.industry && <p className="text-xs text-gray-400 mb-1">{detail.industry}</p>}
                      <p className="text-sm text-gray-600 line-clamp-2">{description}</p>

                      {/* Features */}
                      {detail?.features && detail.features.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {detail.features.slice(0, 5).map((f, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-full">{f.replace('📊 ', '')}</span>
                          ))}
                          {detail.features.length > 5 && (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-400 rounded-full">+{detail.features.length - 5}</span>
                          )}
                        </div>
                      )}

                      {/* Rating + actions */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {detail?.avgRating ? (
                            <span className="flex items-center gap-1"><Star size={10} className="text-amber-400 fill-amber-400" /> {detail.avgRating}</span>
                          ) : null}
                          {inst.installedAt && (
                            <span>Installe le {new Date(inst.installedAt).toLocaleDateString('fr-FR')}</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Link to="/chat"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100">
                            <MessageCircle size={12} /> Utiliser
                          </Link>
                          <button onClick={() => handleUninstall(agentId)} disabled={uninstalling === agentId}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50">
                            {uninstalling === agentId ? <Loader2 className="animate-spin" size={12} /> : <Trash2 size={12} />}
                            Desinstaller
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
