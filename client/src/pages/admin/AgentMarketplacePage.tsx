/**
 * AgentMarketplacePage — Agent marketplace
 * Browse Orlode included + industry premium agents
 * Install/uninstall agents for your company
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Loader2, Sparkles, Download, Trash2, Check, Crown, Star,
  Filter, ShoppingBag, CreditCard, Smartphone, MessageCircle, Package, Zap,
  Wallet, Phone,
} from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useCurrency } from '@/hooks/useCurrency';

interface MarketplaceAgent {
  id: string; slug: string; name: string; icon: string; category: string;
  industry: string; description: string; features: string[];
  creatorName: string; creatorType: string;
  pricingModel: string; priceUSD: number;
  installCount: number; avgRating: number; ratingCount: number;
  status: string; color: string;
}

interface InstalledAgent { id: string; agentId: string; status: string }

interface Bundle {
  id: string; name: string; icon: string; color: string; description: string;
  agentIds: string[]; agents: { id: string; name: string; icon: string; priceUSD: number }[];
  originalPrice: number; bundlePrice: number; discount: number; savings: number;
  isCustom?: boolean; pickCount?: number;
}

export default function AgentMarketplacePage() {
  const { t } = useLangStore();
  const { formatShort } = useCurrency();

  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [pricingFilter, setPricingFilter] = useState('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgent | null>(null);
  const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string }[]>([]);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [bundleCheckingOut, setBundleCheckingOut] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Fetch agents — try api first, fallback to fetch
      let agentsList: MarketplaceAgent[] = [];
      try {
        const agentsRes = await api.get('/marketplace/agents');
        // Interceptor unwraps {success,data} → agentsRes.data IS the array
        const raw = agentsRes.data;
        agentsList = (Array.isArray(raw) ? raw : raw?.data ?? []) as MarketplaceAgent[];
      } catch (apiErr) {
        console.warn('[Marketplace] api.get failed, trying fetch:', apiErr);
        const res = await fetch('/api/marketplace/agents');
        const json = await res.json();
        agentsList = (json?.data ?? []) as MarketplaceAgent[];
      }
      setAgents(agentsList);
      console.log('[Marketplace] Loaded:', agentsList.length, 'agents');
    } catch (err) {
      console.error('[Marketplace] Failed to load agents:', err);
    }

    // Fetch installed (protected — may fail if not logged in)
    try {
      const installedRes = await api.get('/marketplace/my-installed');
      const instRaw = installedRes.data;
      const inst = (Array.isArray(instRaw) ? instRaw : instRaw?.data ?? []) as InstalledAgent[];
      setInstalled(new Set(inst.map(i => i.agentId ?? i.id)));
    } catch {}

    // Fetch bundles
    try {
      const bundlesRes = await api.get('/marketplace/bundles');
      const bRaw = bundlesRes.data;
      setBundles(Array.isArray(bRaw) ? bRaw : []);
    } catch {}

    // Fetch categories
    try {
      const catsRes = await api.get('/marketplace/categories');
      const cats = catsRes.data;
      setCategories((cats?.categories ?? []) as string[]);
      setIndustries((cats?.industries ?? []) as string[]);
    } catch {}

    setLoading(false);
  };

  const handleInstall = async (agentId: string) => {
    setInstalling(agentId);
    try {
      await api.post(`/marketplace/agents/${agentId}/install`);
      setInstalled(prev => new Set([...prev, agentId]));
    } catch {}
    finally { setInstalling(null); }
  };

  const handleUninstall = async (agentId: string) => {
    setInstalling(agentId);
    try {
      await api.post(`/marketplace/agents/${agentId}/uninstall`);
      setInstalled(prev => { const n = new Set(prev); n.delete(agentId); return n; });
    } catch {}
    finally { setInstalling(null); }
  };

  const handleCheckout = async (agentId: string, method: 'stripe' | 'paypal' | 'wave' | 'manual') => {
    setCheckingOut(true);
    try {
      const res = await api.post(`/marketplace/agents/${agentId}/checkout`, { method });
      // Axios interceptor unwraps { success, data } → r.data is the payload
      const raw = res.data as Record<string, unknown>;
      const data = (raw?.data ?? raw) as Record<string, unknown>;
      if (data?.method === 'manual' && data?.contact) {
        const contact = data.contact as { whatsappLink: string; emailLink: string; phone: string };
        if (confirm(`Demande enregistrée (ref: ${data.reference}). Contacter via WhatsApp maintenant ?`)) {
          window.open(contact.whatsappLink, '_blank');
        }
      } else if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
      } else if (data?.instructions) {
        alert(data.instructions as string);
      } else if (data?.method === 'stripe_pending' || data?.method === 'stripe_error') {
        alert('Paiement carte indisponible pour l\'instant. Essayez PayPal, Wave ou Paiement local.');
      } else {
        alert('Paiement en cours de traitement...');
      }
    } catch (err) { console.error(err); }
    setCheckingOut(false);
  };

  const openDetail = async (agent: MarketplaceAgent) => {
    setSelectedAgent(agent);
    setMyRating(0);
    setMyComment('');
    try {
      const res = await api.get(`/marketplace/agents/${agent.id}/reviews`);
      const raw = res.data;
      setReviews(Array.isArray(raw) ? raw : []);
    } catch { setReviews([]); }
  };

  const submitReview = async () => {
    if (!selectedAgent || myRating < 1) return;
    setSubmittingReview(true);
    try {
      await api.post(`/marketplace/agents/${selectedAgent.id}/review`, { rating: myRating, comment: myComment });
      const res = await api.get(`/marketplace/agents/${selectedAgent.id}/reviews`);
      const raw = res.data;
      setReviews(Array.isArray(raw) ? raw : []);
      setMyRating(0);
      setMyComment('');
    } catch {}
    setSubmittingReview(false);
  };

  const handleBundleCheckout = async (bundleId: string, method: 'stripe' | 'paypal' | 'wave' | 'manual') => {
    setBundleCheckingOut(true);
    try {
      const res = await api.post(`/marketplace/bundles/${bundleId}/checkout`, { method });
      const raw = res.data as Record<string, unknown>;
      const data = (raw?.data ?? raw) as Record<string, unknown>;
      if (data?.method === 'manual' && data?.contact) {
        const contact = data.contact as { whatsappLink: string; emailLink: string; phone: string };
        if (confirm(`Demande enregistrée (ref: ${data.reference}). Contacter via WhatsApp maintenant ?`)) {
          window.open(contact.whatsappLink, '_blank');
        }
      } else if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
      } else if (data?.instructions) {
        alert(data.instructions as string);
      } else if (data?.method === 'stripe_error' || data?.method === 'stripe_pending') {
        alert('Carte bancaire indisponible. Essayez PayPal, Wave ou Paiement local.');
      } else {
        alert('Impossible de démarrer le paiement. Réessayez plus tard.');
      }
    } catch (err) { console.error(err); }
    setBundleCheckingOut(false);
    setSelectedBundle(null);
  };

  const filtered = agents.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.industry?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || a.category === catFilter;
    const matchPricing = pricingFilter === 'all' || a.pricingModel === pricingFilter;
    return matchSearch && matchCat && matchPricing;
  });

  const includedAgents = filtered.filter(a => a.pricingModel === 'included');
  const premiumAgents = filtered.filter(a => a.pricingModel !== 'included');

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B5CF6, #A855F7)' }}>
              <ShoppingBag size={20} className="text-white" />
            </div>
            Marketplace
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-semibold text-violet-600">{agents.length} agents</span> disponibles · {installed.size} installes · {bundles.length} bundles
          </p>
        </div>
        <Link to="/agents" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
          Mes Agents
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder={t('search')} />
        </div>
        <div className="flex gap-1">
          {['all', 'included', 'free', 'monthly'].map(p => (
            <button key={p} onClick={() => setPricingFilter(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${pricingFilter === p ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p === 'all' ? 'Tous' : p === 'included' ? 'Inclus' : p === 'free' ? 'Gratuit' : 'Premium'}
            </button>
          ))}
        </div>
        {categories.length > 1 && (
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
            <option value="all">Toutes categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Bundles */}
      {bundles.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Package size={14} className="text-blue-500" /> Bundles — Economisez jusqu'a 27%</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bundles.filter(b => b.bundlePrice > 0 || b.isCustom).map(bundle => (
              <div key={bundle.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedBundle(bundle)}>
                <div className={`h-1.5 bg-gradient-to-r ${bundle.color}`} />
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{bundle.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{bundle.name}</p>
                      <p className="text-xs text-gray-500">{bundle.agents?.length || bundle.pickCount} agents</p>
                    </div>
                    <div className="text-right shrink-0">
                      {bundle.bundlePrice > 0 ? (
                        <>
                          <p className="text-sm font-bold text-gray-900">{formatShort(bundle.bundlePrice)}<span className="text-[10px] text-gray-400">/mo</span></p>
                          <p className="text-[10px] text-red-500 line-through">{formatShort(bundle.originalPrice)}</p>
                        </>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-bold">-{bundle.discount}%</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{bundle.description}</p>
                  <div className="flex items-center gap-1">
                    {(bundle.agents ?? []).map(a => (
                      <span key={a.id} className="text-lg" title={a.name as string}>{a.icon}</span>
                    ))}
                    {bundle.discount > 0 && (
                      <span className="ml-auto text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">
                        -{bundle.discount}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bundle detail modal */}
      {selectedBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedBundle(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`h-3 bg-gradient-to-r ${selectedBundle.color}`} />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{selectedBundle.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedBundle.name}</h2>
                  <p className="text-sm text-gray-500">{selectedBundle.agents?.length || selectedBundle.pickCount} agents · -{selectedBundle.discount}% de reduction</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4">{selectedBundle.description}</p>

              {/* Agents in bundle */}
              <div className="space-y-2 mb-4">
                {(selectedBundle.agents ?? []).map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-sm text-gray-700 flex-1">{a.name}</span>
                    <span className="text-xs text-gray-400">{formatShort(a.priceUSD)}/mo</span>
                  </div>
                ))}
              </div>

              {/* Pricing */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Prix individuel</span>
                  <span className="line-through">{formatShort(selectedBundle.originalPrice)}/mo</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 mt-1">
                  <span>Prix bundle</span>
                  <span className="text-green-600">{formatShort(selectedBundle.bundlePrice)}/mo</span>
                </div>
                <div className="flex justify-between text-xs text-green-600 mt-1">
                  <span>Vous economisez</span>
                  <span>{formatShort(selectedBundle.savings)}/mo ({selectedBundle.discount}%)</span>
                </div>
              </div>

              {/* CTA — 4 payment methods */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleBundleCheckout(selectedBundle.id, 'stripe')} disabled={bundleCheckingOut}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
                    <CreditCard size={14} /> Carte
                  </button>
                  <button onClick={() => handleBundleCheckout(selectedBundle.id, 'paypal')} disabled={bundleCheckingOut}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-xl bg-[#0070BA] hover:bg-[#005a94] disabled:opacity-50">
                    <Wallet size={14} /> PayPal
                  </button>
                  <button onClick={() => handleBundleCheckout(selectedBundle.id, 'wave')} disabled={bundleCheckingOut}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50">
                    <Smartphone size={14} /> Wave
                  </button>
                  <button onClick={() => handleBundleCheckout(selectedBundle.id, 'manual')} disabled={bundleCheckingOut}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-orange-700 border-2 border-dashed border-orange-300 rounded-xl hover:bg-orange-50 disabled:opacity-50">
                    <Phone size={14} /> Local / Cash
                  </button>
                </div>
                <button onClick={() => setSelectedBundle(null)}
                  className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
                {bundleCheckingOut && <p className="text-xs text-center text-gray-400"><Loader2 className="inline animate-spin mr-1" size={12} /> Création du paiement…</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Included agents */}
      {includedAgents.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Crown size={14} className="text-amber-500" /> Inclus dans votre plan ({includedAgents.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {includedAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent} isInstalled={installed.has(agent.id)} installing={installing === agent.id}
                onInstall={() => handleInstall(agent.id)} onUninstall={() => handleUninstall(agent.id)}
                onDetail={() => openDetail(agent)} formatPrice={formatShort} />
            ))}
          </div>
        </div>
      )}

      {/* Premium agents */}
      {premiumAgents.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Sparkles size={14} className="text-violet-500" /> Agents Marketplace ({premiumAgents.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {premiumAgents.map(agent => (
              <AgentCard key={agent.id} agent={agent} isInstalled={installed.has(agent.id)} installing={installing === agent.id}
                onInstall={() => handleInstall(agent.id)} onUninstall={() => handleUninstall(agent.id)}
                onDetail={() => openDetail(agent)} formatPrice={formatShort} />
            ))}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedAgent(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className={`h-3 bg-gradient-to-r ${selectedAgent.color ?? 'from-blue-600 to-violet-600'}`} />
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-5xl">{selectedAgent.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedAgent.name}</h2>
                  <p className="text-sm text-gray-500">{selectedAgent.industry} · par {selectedAgent.creatorName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedAgent.pricingModel === 'included' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Inclus</span>}
                    {selectedAgent.pricingModel === 'free' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Gratuit</span>}
                    {selectedAgent.pricingModel === 'monthly' && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">{formatShort(selectedAgent.priceUSD)}/mois</span>}
                    {selectedAgent.installCount > 0 && <span className="text-xs text-gray-400">{selectedAgent.installCount} installations</span>}
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-4">{selectedAgent.description}</p>

              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fonctionnalites</h3>
              <ul className="space-y-2 mb-4">
                {(selectedAgent.features ?? []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 shrink-0 mt-0.5">✓</span> {f}
                  </li>
                ))}
              </ul>

              <div className="flex justify-end gap-3">
                <button onClick={() => setSelectedAgent(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{t('close')}</button>
                {installed.has(selectedAgent.id) ? (
                  <button onClick={() => { handleUninstall(selectedAgent.id); setSelectedAgent(null); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50">
                    <Trash2 size={14} /> Desinstaller
                  </button>
                ) : (selectedAgent.pricingModel === 'included' || selectedAgent.pricingModel === 'free') ? (
                  <button onClick={() => { handleInstall(selectedAgent.id); setSelectedAgent(null); }}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
                    <Download size={14} /> Installer
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="text-xs text-gray-500 text-center mb-1">
                      {formatShort(selectedAgent.priceUSD)}/mois — choisissez un mode de paiement
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleCheckout(selectedAgent.id, 'stripe')} disabled={checkingOut}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
                        <CreditCard size={14} /> Carte
                      </button>
                      <button onClick={() => handleCheckout(selectedAgent.id, 'paypal')} disabled={checkingOut}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-xl bg-[#0070BA] hover:bg-[#005a94] disabled:opacity-50">
                        <Wallet size={14} /> PayPal
                      </button>
                      <button onClick={() => handleCheckout(selectedAgent.id, 'wave')} disabled={checkingOut}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50">
                        <Smartphone size={14} /> Wave
                      </button>
                      <button onClick={() => handleCheckout(selectedAgent.id, 'manual')} disabled={checkingOut}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-orange-700 border-2 border-dashed border-orange-300 rounded-xl hover:bg-orange-50 disabled:opacity-50">
                        <Phone size={14} /> Local / Cash
                      </button>
                    </div>
                    {checkingOut && <div className="text-xs text-gray-400 text-center"><Loader2 size={12} className="inline animate-spin mr-1" /> Création du paiement…</div>}
                  </div>
                )}
              </div>

              {/* Reviews section */}
              {installed.has(selectedAgent.id) && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <MessageCircle size={12} /> Avis ({reviews.length})
                  </h3>
                  {reviews.slice(0, 5).map((r, i) => (
                    <div key={i} className="mb-2 pb-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={10} className={s <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
                        ))}
                      </div>
                      {r.comment && <p className="text-xs text-gray-600 mt-1">{r.comment}</p>}
                    </div>
                  ))}
                  {/* Write review */}
                  <div className="mt-3">
                    <div className="flex items-center gap-1 mb-2">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setMyRating(s)}>
                          <Star size={16} className={s <= myRating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={myComment} onChange={e => setMyComment(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                        placeholder="Votre avis..." />
                      <button onClick={submitReview} disabled={myRating < 1 || submittingReview}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg disabled:opacity-50">
                        {submittingReview ? <Loader2 className="animate-spin" size={10} /> : 'Envoyer'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Agent Card Component ─────────────────────────────────────────────────────

function AgentCard({ agent, isInstalled, installing, onInstall, onUninstall, onDetail, formatPrice }: {
  agent: MarketplaceAgent; isInstalled: boolean; installing: boolean;
  onInstall: () => void; onUninstall: () => void; onDetail: () => void;
  formatPrice: (n: number) => string;
}) {
  const COLOR_MAP: Record<string, string> = {
    'from-blue-600 to-blue-400': '#3B82F6', 'from-blue-500 to-cyan-500': '#0EA5E9', 'from-blue-500 to-cyan-400': '#0EA5E9',
    'from-emerald-600 to-emerald-400': '#10B981', 'from-teal-600 to-teal-400': '#14B8A6', 'from-teal-500 to-cyan-600': '#14B8A6',
    'from-indigo-600 to-indigo-400': '#6366F1', 'from-green-600 to-green-400': '#16A34A', 'from-green-600 to-lime-500': '#16A34A', 'from-green-500 to-emerald-500': '#10B981',
    'from-orange-600 to-orange-400': '#F97316', 'from-cyan-600 to-cyan-400': '#06B6D4',
    'from-slate-600 to-slate-400': '#64748B', 'from-slate-700 to-red-600': '#475569', 'from-slate-600 to-blue-600': '#475569', 'from-slate-700 to-blue-600': '#475569',
    'from-rose-600 to-rose-400': '#E11D48', 'from-fuchsia-600 to-fuchsia-400': '#D946EF',
    'from-amber-600 to-amber-400': '#F59E0B', 'from-amber-500 to-orange-500': '#F59E0B', 'from-amber-600 to-yellow-500': '#F59E0B', 'from-amber-500 to-yellow-400': '#EAB308',
    'from-pink-600 to-pink-400': '#EC4899', 'from-pink-500 to-rose-500': '#EC4899',
    'from-violet-600 to-violet-400': '#8B5CF6', 'from-violet-500 to-purple-500': '#8B5CF6', 'from-violet-500 to-purple-600': '#8B5CF6', 'from-violet-700 to-indigo-600': '#7C3AED',
    'from-red-600 to-red-400': '#EF4444', 'from-red-500 to-pink-500': '#EF4444', 'from-red-700 to-orange-600': '#DC2626',
    'from-stone-700 to-stone-500': '#78716C', 'from-sky-600 to-sky-400': '#0284C7',
    'from-lime-600 to-lime-400': '#84CC16', 'from-cyan-700 to-blue-500': '#0891B2',
    'from-purple-600 to-pink-500': '#A855F7', 'from-amber-700 to-orange-500': '#EA580C',
    'from-blue-600 to-violet-600': '#6366F1', 'from-blue-600 to-emerald-500': '#3B82F6',
    'from-indigo-500 to-blue-500': '#6366F1', 'from-blue-700 to-cyan-500': '#1D4ED8',
    'from-gray-700 to-blue-600': '#475569', 'from-gray-800 to-blue-700': '#374151', 'from-gray-600 to-gray-800': '#4B5563',
    'from-yellow-500 to-orange-500': '#F59E0B', 'from-yellow-600 to-amber-600': '#CA8A04',
    'from-emerald-600 to-teal-500': '#10B981',
  };
  const bgColor = (agent.color && agent.color.startsWith('#')) ? agent.color : COLOR_MAP[agent.color] ?? '#8B5CF6';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-6px) scale(1.02)`;
    card.style.boxShadow = `${-x * 20}px ${y * 20}px 40px rgba(0,0,0,0.15), 0 0 30px ${bgColor}30`;
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateY(0px) scale(1)';
    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
  };

  return (
    <div onClick={onDetail} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
      className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden cursor-pointer"
      style={{ transformStyle: 'preserve-3d', transition: 'transform 0.15s ease, box-shadow 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

      {/* Header with gradient + floating elements */}
      <div className="relative p-5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColor}CC)` }}>
        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="absolute -right-2 -bottom-10 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="absolute left-1/2 top-0 w-32 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />

        {/* Shimmer on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', transform: 'translateZ(20px)' }}>
            <span className="text-3xl">{agent.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-white truncate">{agent.name}</p>
            <p className="text-xs text-white/60 mt-0.5">{agent.industry ?? agent.category}</p>
          </div>
        </div>

        {/* Price badge floating */}
        <div className="absolute top-3 right-3" style={{ transform: 'translateZ(30px)' }}>
          {agent.pricingModel === 'included' && (
            <span className="text-[10px] px-3 py-1.5 rounded-full font-bold" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(8px)' }}>INCLUS</span>
          )}
          {agent.pricingModel === 'free' && (
            <span className="text-[10px] px-3 py-1.5 rounded-full font-bold" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(8px)' }}>GRATUIT</span>
          )}
          {agent.pricingModel === 'monthly' && (
            <span className="text-[10px] px-3 py-1.5 rounded-full font-bold" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(8px)' }}>{formatPrice(agent.priceUSD)}/mo</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 min-h-[32px] leading-relaxed">{agent.description}</p>

        {/* Features preview */}
        {agent.features && agent.features.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {agent.features.slice(0, 3).filter(f => !f.startsWith('📊')).map((f, i) => (
              <span key={i} className="text-[9px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full truncate max-w-[120px]">{f}</span>
            ))}
            {agent.features.length > 3 && (
              <span className="text-[9px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full">+{agent.features.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          {agent.avgRating > 0 && (
            <div className="flex items-center gap-1">
              <Star size={11} className="text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{agent.avgRating.toFixed(1)}</span>
            </div>
          )}
          {agent.installCount > 0 && <span className="text-[10px] text-gray-400">{agent.installCount} installs</span>}
          {isInstalled && <span className="ml-auto text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full font-bold flex items-center gap-1"><Check size={9} /> Installe</span>}
        </div>

        {isInstalled ? (
          <button onClick={e => { e.stopPropagation(); onUninstall(); }} disabled={installing}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-green-700 dark:text-green-400 rounded-xl border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
            style={{ background: 'transparent' }}>
            {installing ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Installe
          </button>
        ) : (agent.pricingModel === 'included' || agent.pricingModel === 'free') ? (
          <button onClick={e => { e.stopPropagation(); onInstall(); }} disabled={installing}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColor}CC)`, boxShadow: `0 4px 15px ${bgColor}40` }}>
            {installing ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} Installer
          </button>
        ) : (
          <button onClick={e => { e.stopPropagation(); onDetail(); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-all"
            style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColor}CC)`, boxShadow: `0 4px 15px ${bgColor}40` }}>
            <Zap size={14} /> Obtenir — {formatPrice(agent.priceUSD)}/mo
          </button>
        )}
      </div>
    </div>
  );
}
