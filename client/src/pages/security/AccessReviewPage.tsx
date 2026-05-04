/**
 * AccessReviewPage — User access review, MFA status, dormant accounts
 */
import { useEffect, useState } from 'react';
import { Users, ShieldCheck, AlertTriangle, Loader2, Search, Shield } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface UserAccess {
  id: string; name: string; email: string; role: string;
  lastLogin: string | null; mfaEnabled: boolean; status: string;
}
interface AccessData { users: UserAccess[]; totalUsers: number; mfaRate: number; dormantCount: number }

export default function AccessReviewPage() {
  const { t } = useLangStore();
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/security/access-review').then(r => setData(r.data as AccessData)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const d = data ?? { users: [], totalUsers: 0, mfaRate: 0, dormantCount: 0 };

  const filtered = d.users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' ||
      (filter === 'no_mfa' && !u.mfaEnabled) ||
      (filter === 'dormant' && (!u.lastLogin || (Date.now() - new Date(u.lastLogin).getTime()) / 86400000 > 30));
    return matchSearch && matchFilter;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('access_review')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">MFA, comptes dormants, permissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
          <Users size={16} className="text-blue-600" />
          <div><div className="text-lg font-extrabold text-blue-700">{d.totalUsers}</div><div className="text-xs text-gray-500">{`${t('employees')}`}</div></div>
        </div>
        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${d.mfaRate >= 80 ? 'bg-green-50' : 'bg-amber-50'}`}>
          <ShieldCheck size={16} className={d.mfaRate >= 80 ? 'text-green-600' : 'text-amber-600'} />
          <div><div className={`text-lg font-extrabold ${d.mfaRate >= 80 ? 'text-green-700' : 'text-amber-700'}`}>{d.mfaRate}%</div><div className="text-xs text-gray-500">MFA active</div></div>
        </div>
        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${d.dormantCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <AlertTriangle size={16} className={d.dormantCount > 0 ? 'text-red-500' : 'text-green-600'} />
          <div><div className={`text-lg font-extrabold ${d.dormantCount > 0 ? 'text-red-700' : 'text-green-700'}`}>{d.dormantCount}</div><div className="text-xs text-gray-500">Comptes dormants</div></div>
        </div>
      </div>

      {d.mfaRate < 80 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <Shield size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm font-bold text-amber-800">Seulement {d.mfaRate}% des utilisateurs ont active le MFA. Objectif recommande : 100%.</p>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"  placeholder={t('search')} />
        </div>
        <div className="flex gap-1">
          {[{k:'all',l:t('all')},{k:'no_mfa',l:'Sans MFA'},{k:'dormant',l:'Dormants'}].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filter === f.k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100"><tr>{[t('name'),t('role'),'Dernier login','MFA',t('status')].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-sm text-gray-400 py-8">{`${t('no_data')}`}</td></tr>}
            {filtered.map(u => {
              const isDormant = !u.lastLogin || (Date.now() - new Date(u.lastLogin).getTime()) / 86400000 > 30;
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><div><p className="text-sm font-medium text-gray-900">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'manager' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
                  <td className="px-4 py-3"><span className={`text-sm ${isDormant ? 'text-red-500 font-medium' : 'text-gray-600'}`}>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}{isDormant && ' ⚠'}</span></td>
                  <td className="px-4 py-3">{u.mfaEnabled ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{`${t('enabled')}`}</span> : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{`${t('disabled')}`}</span>}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{u.status === 'active' ? 'Actif' : 'Inactif'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
