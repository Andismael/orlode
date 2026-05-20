import { useEffect, useState } from 'react';
import { Boxes, Building2, DollarSign, TrendingUp, Loader2, ExternalLink } from 'lucide-react';
import api from '@/services/api';

interface Pack {
  id: string;
  businessType: string | null;
  label: string;
  pitch: string;
  emoji: string;
  color: string;
  monthlyPriceUSD: number;
  companies: number;
  stores: number;
  latestActivation: string | null;
  monthlyRevenueUSD: number;
}

interface PackCompany {
  companyId: string;
  companyName: string;
  storeName: string;
  storeSlug: string;
  activatedAt: string | null;
}

export default function PacksPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [totalMRR, setTotalMRR] = useState(0);
  const [totalActivations, setTotalActivations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pack | null>(null);
  const [companies, setCompanies] = useState<PackCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r: any = await api.get('/superadmin/packs');
        setPacks(r?.data?.data?.packs ?? []);
        setTotalMRR(r?.data?.data?.totalMRR ?? 0);
        setTotalActivations(r?.data?.data?.totalActivations ?? 0);
      } catch (e) {
        console.error('Failed to load packs', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openCompanies = async (pack: Pack) => {
    if (!pack.businessType) return;
    setSelected(pack);
    setCompanies([]);
    setCompaniesLoading(true);
    try {
      const r: any = await api.get(`/superadmin/packs/${pack.id}/companies`);
      setCompanies(r?.data?.data?.companies ?? []);
    } catch (e) {
      console.error('Failed to load pack companies', e);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return '—'; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Boxes size={26} className="text-blue-600" />
          Packs
        </h1>
        <p className="text-sm text-gray-500 mt-1">Catalogue $20/mois par pack métier + adoption cross-clients</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">
            <DollarSign size={14} /> MRR estimé
          </div>
          <div className="text-2xl font-bold text-gray-900">${totalMRR.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-1">Pack-related, hors marketplace</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">
            <Building2 size={14} /> Activations
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalActivations}</div>
          <div className="text-xs text-gray-400 mt-1">Toutes verticales confondues</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">
            <TrendingUp size={14} /> Packs au catalogue
          </div>
          <div className="text-2xl font-bold text-gray-900">{packs.length}</div>
          <div className="text-xs text-gray-400 mt-1">6 verticaux + 2 hubs</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {packs.map(pack => (
          <button
            key={pack.id}
            onClick={() => openCompanies(pack)}
            disabled={!pack.businessType}
            className={`text-left bg-white rounded-xl p-4 border-2 transition-all ${
              pack.businessType
                ? 'border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer'
                : 'border-gray-100 opacity-70 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: `${pack.color}15` }}
              >
                {pack.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-gray-900">{pack.label}</h3>
                  {pack.monthlyPriceUSD > 0 ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${pack.color}15`, color: pack.color }}>
                      ${pack.monthlyPriceUSD}/mo
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Hub</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{pack.pitch}</p>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-gray-400">Clients : </span>
                    <span className="font-bold text-gray-800">{pack.companies}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Stores : </span>
                    <span className="font-bold text-gray-800">{pack.stores}</span>
                  </div>
                  {pack.monthlyRevenueUSD > 0 && (
                    <div>
                      <span className="text-gray-400">MRR : </span>
                      <span className="font-bold" style={{ color: pack.color }}>${pack.monthlyRevenueUSD}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Drawer companies */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end md:items-center md:justify-end" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full md:max-w-md md:h-full max-h-[85vh] md:max-h-full rounded-t-2xl md:rounded-none overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center gap-3" style={{ background: `${selected.color}10` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl bg-white">
                {selected.emoji}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{selected.label}</h3>
                <p className="text-xs text-gray-500">{selected.companies} client(s) · {selected.stores} store(s)</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {companiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-gray-400" />
                </div>
              ) : companies.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-500">
                  Aucun client n'a encore activé ce pack.
                </div>
              ) : (
                <ul className="space-y-2">
                  {companies.map((c, i) => (
                    <li key={`${c.companyId}-${i}`} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-semibold text-sm text-gray-900 truncate">{c.companyName}</div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatDate(c.activatedAt)}</span>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">Store : {c.storeName || '(sans nom)'}</div>
                      {c.storeSlug && (
                        <a
                          href={`/${selected.businessType === 'boutique' ? 'shop' : selected.businessType === 'restaurant' ? 'menu' : selected.businessType === 'hotel' ? 'hotel' : selected.businessType === 'service' ? 'salon' : selected.businessType === 'health' ? 'cabinet' : 'biens'}/${c.storeSlug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium"
                          style={{ color: selected.color }}
                        >
                          Voir page publique <ExternalLink size={11} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
