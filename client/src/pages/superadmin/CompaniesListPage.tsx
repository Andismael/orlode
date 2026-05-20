import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { Search, Building2, ChevronRight, Loader2 } from 'lucide-react';
import SuperAdminPage from './_SuperAdminPage';

interface Company {
  id: string; name: string; email: string; plan: string; status: string;
  usersCount: number; selectedAgents: number; paymentMethod: string; createdAt: string;
}

const PLAN_COLOR: Record<string, string> = { free: 'bg-gray-100 text-gray-600', starter: 'bg-blue-100 text-blue-700', business: 'bg-violet-100 text-violet-700', enterprise: 'bg-amber-100 text-amber-700' };
const STATUS_COLOR: Record<string, string> = { active: 'bg-green-100 text-green-700', trial: 'bg-yellow-100 text-yellow-700', suspended: 'bg-red-100 text-red-700' };

export default function CompaniesListPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/superadmin/companies')
      .then((r: any) => {
        const raw = r?.data?.data ?? r?.data;
        setCompanies(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <SuperAdminPage
      title="Entreprises"
      subtitle="Tous les clients connectés à la plateforme"
      icon={<Building2 size={20} />}
      actions={<span className="text-xs md:text-sm text-gray-400">{companies.length} total</span>}
    >
      <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: companies.length, color: 'text-blue-600' },
          { label: 'Actives', value: companies.filter(c => c.status === 'active').length, color: 'text-green-600' },
          { label: 'Free', value: companies.filter(c => c.plan === 'free').length, color: 'text-gray-600' },
          { label: 'Payantes', value: companies.filter(c => c.plan !== 'free').length, color: 'text-violet-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une entreprise..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <button key={c.id} onClick={() => navigate(`/superadmin/companies/${c.id}`)}
              className="w-full flex items-center gap-3 p-4 bg-white hover:bg-gray-50 border border-gray-100 rounded-xl text-left transition-colors shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{c.name || c.id}</p>
                <p className="text-xs text-gray-400">{c.email} · {c.usersCount} users · {c.selectedAgents} agents</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PLAN_COLOR[c.plan] ?? 'bg-gray-100 text-gray-600'}`}>{(c.plan || 'free').toUpperCase()}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status || 'active'}</span>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Aucune entreprise trouvee</p>}
        </div>
      )}
      </div>
    </SuperAdminPage>
  );
}
