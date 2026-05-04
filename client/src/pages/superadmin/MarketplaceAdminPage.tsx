import { useEffect, useState } from 'react';
import { Loader2, Check, X, Eye, Bot, Trash2, MoreVertical, Star as StarIcon, Power, Search } from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';

interface Agent {
  id: string; name: string; icon: string; description: string; category: string;
  industry: string; creatorName: string; creatorType: string; pricingModel: string;
  priceUSD: number; status: string; installCount: number; avgRating: number;
  ratingCount: number; features: string[]; systemPrompt: string; featured?: boolean;
}

export default function MarketplaceAdminPage() {
  const { formatShort } = useCurrency();
  const [all, setAll] = useState<Agent[]>([]);
  const [tab, setTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Agent | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/marketplace/all');
      setAll(Array.isArray(res.data) ? res.data : []);
    } catch {}
    setLoading(false);
  };

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActing(true);
    try { await api.post(`/superadmin/marketplace/${id}/review`, { action }); load(); } catch {}
    setActing(false);
  };

  const handleAction = async (id: string, action: string) => {
    if (action === 'delete' && !confirm('Supprimer cet agent definitivement ?')) return;
    setActing(true);
    try { await api.post(`/superadmin/marketplace/${id}/action`, { action }); load(); } catch {}
    setActing(false);
    setMenuOpen(null);
  };

  const STATUS_COLOR: Record<string, string> = {
    approved: 'bg-green-100 text-green-700', pending_review: 'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-700', draft: 'bg-gray-100 text-gray-600',
  };

  const filtered = all.filter(a => {
    const matchTab = tab === 'all' || a.status === (tab === 'pending' ? 'pending_review' : tab);
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.industry?.toLowerCase().includes(search.toLowerCase()) || a.creatorName?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const pending = all.filter(a => a.status === 'pending_review');

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Bot size={22} className="text-violet-500" /> Marketplace Admin</h1>

      <div className="grid grid-cols-5 gap-3">
        <Stat label="Total" value={all.length} color="text-blue-600" />
        <Stat label="Approuves" value={all.filter(a => a.status === 'approved').length} color="text-green-600" />
        <Stat label="En attente" value={pending.length} color="text-yellow-600" />
        <Stat label="Rejetes" value={all.filter(a => a.status === 'rejected').length} color="text-red-600" />
        <Stat label="Installs" value={all.reduce((s, a) => s + (a.installCount ?? 0), 0)} color="text-violet-600" />
      </div>

      {/* Search + Tabs */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un agent..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <div className="flex gap-1">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${tab === t ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t === 'all' ? `Tous (${all.length})` : t === 'pending' ? `Attente (${pending.length})` : t === 'approved' ? 'Approuves' : 'Rejetes'}
            </button>
          ))}
        </div>
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {filtered.map(a => (
          <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <span className="text-2xl shrink-0">{a.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-900 text-sm">{a.name}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                {a.creatorType === 'third_party' && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">Tiers</span>}
                {a.featured && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full">Featured</span>}
                {a.pricingModel !== 'included' && a.pricingModel !== 'free' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full">{formatShort(a.priceUSD)}/mo</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{a.industry} · {a.creatorName} · {a.installCount ?? 0} installs · {a.avgRating ? `${a.avgRating}⭐` : 'pas de note'}</p>
            </div>
            <div className="flex gap-1.5 shrink-0 items-center">
              {/* Quick actions for pending */}
              {a.status === 'pending_review' && (
                <>
                  <button onClick={() => handleReview(a.id, 'approve')} disabled={acting}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Approuver"><Check size={14} /></button>
                  <button onClick={() => handleReview(a.id, 'reject')} disabled={acting}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Rejeter"><X size={14} /></button>
                </>
              )}
              <button onClick={() => setDetail(a)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Eye size={14} /></button>

              {/* More actions menu */}
              <div className="relative">
                <button onClick={() => setMenuOpen(menuOpen === a.id ? null : a.id)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><MoreVertical size={14} /></button>
                {menuOpen === a.id && (
                  <div className="absolute right-0 top-10 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48"
                    onMouseLeave={() => setMenuOpen(null)}>
                    {a.status !== 'approved' && (
                      <button onClick={() => { handleReview(a.id, 'approve'); setMenuOpen(null); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2">
                        <Check size={12} /> Approuver
                      </button>
                    )}
                    {a.status === 'approved' && (
                      <button onClick={() => { handleAction(a.id, 'suspend'); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-50 flex items-center gap-2">
                        <Power size={12} /> Suspendre
                      </button>
                    )}
                    {a.status === 'rejected' && (
                      <button onClick={() => { handleAction(a.id, 'activate'); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2">
                        <Power size={12} /> Reactiver
                      </button>
                    )}
                    {!a.featured ? (
                      <button onClick={() => { handleAction(a.id, 'feature'); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2">
                        <StarIcon size={12} /> Mettre en avant
                      </button>
                    ) : (
                      <button onClick={() => { handleAction(a.id, 'unfeature'); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <StarIcon size={12} /> Retirer de la une
                      </button>
                    )}
                    <hr className="my-1 border-gray-100" />
                    <button onClick={() => { handleAction(a.id, 'delete'); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2">
                      <Trash2 size={12} /> Supprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Aucun agent</p>}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{detail.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{detail.name}</h2>
                <p className="text-sm text-gray-500">{detail.industry} · {detail.creatorName}</p>
                <div className="flex gap-1 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[detail.status] ?? 'bg-gray-100'}`}>{detail.status}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{detail.creatorType}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-3">{detail.description}</p>

            {detail.features?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Fonctionnalites</p>
                <ul className="space-y-1">
                  {detail.features.map((f, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1"><span className="text-green-500">✓</span> {f}</li>
                  ))}
                </ul>
              </div>
            )}

            {detail.systemPrompt && (
              <div className="mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">System Prompt</p>
                <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">{detail.systemPrompt}</pre>
              </div>
            )}

            <div className="text-xs text-gray-500 space-y-1 mb-4">
              <p>ID: <span className="font-mono">{detail.id}</span></p>
              <p>Prix: {detail.pricingModel === 'free' || detail.pricingModel === 'included' ? detail.pricingModel : `${formatShort(detail.priceUSD)}/mo`}</p>
              <p>Installs: {detail.installCount ?? 0} · Note: {detail.avgRating || '—'} ({detail.ratingCount ?? 0} avis)</p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setDetail(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Fermer</button>
              {detail.status === 'pending_review' && (
                <>
                  <button onClick={() => { handleReview(detail.id, 'approve'); setDetail(null); }}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Approuver</button>
                  <button onClick={() => { handleReview(detail.id, 'reject'); setDetail(null); }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Rejeter</button>
                </>
              )}
              {detail.status === 'approved' && (
                <button onClick={() => { handleAction(detail.id, 'suspend'); setDetail(null); }}
                  className="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100">Suspendre</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
