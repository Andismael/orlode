import { useEffect, useState } from 'react';
import { Loader2, Search, Shield, UserX, MoreVertical, Trash2, UserCheck, Crown, Users } from 'lucide-react';
import api from '@/services/api';
import SuperAdminPage from './_SuperAdminPage';

interface User {
  uid: string; email: string; displayName: string; companyId: string;
  role: string; superAdmin: boolean; suspended?: boolean; createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => { load(); }, []);

  const load = () => {
    setLoading(true);
    api.get('/superadmin/users')
      .then(r => { const raw = r.data; setUsers(Array.isArray(raw) ? raw : []); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  const handleAction = async (uid: string, action: string, extra?: Record<string, unknown>) => {
    if (action === 'delete' && !confirm('Supprimer cet utilisateur definitivement ?')) return;
    setActing(true);
    try {
      await api.post(`/superadmin/users/${uid}/action`, { action, ...extra });
      load();
    } catch (err) { alert(String(err)); }
    setActing(false);
    setMenuOpen(null);
  };

  const filtered = users.filter(u => !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.companyId?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <SuperAdminPage title="Utilisateurs" icon={<Users size={20} />}>
      <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
    </SuperAdminPage>
  );

  return (
    <SuperAdminPage
      title="Utilisateurs"
      subtitle="Tous les comptes (admins, super admins, suspendus)"
      icon={<Users size={20} />}
      maxWidth="6xl"
      actions={<span className="text-xs md:text-sm text-gray-400">{users.length} total</span>}
    >
      <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={users.length} color="text-blue-600" />
        <Stat label="Admins" value={users.filter(u => u.role === 'admin').length} color="text-violet-600" />
        <Stat label="Super Admins" value={users.filter(u => u.superAdmin).length} color="text-amber-600" />
        <Stat label="Suspendus" value={users.filter(u => u.suspended).length} color="text-red-600" />
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (nom, email, company ID)..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Utilisateur</th>
              <th className="px-4 py-3 text-left">Entreprise</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.uid} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{u.displayName || 'Sans nom'}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 font-mono">{u.companyId?.slice(0, 12) || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.role === 'admin' ? 'bg-violet-100 text-violet-700' :
                      u.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                    {u.superAdmin && <Crown size={12} className="text-amber-500" title="Super Admin" />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.suspended ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">SUSPENDU</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">ACTIF</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-4 py-3 text-right relative">
                  <button onClick={() => setMenuOpen(menuOpen === u.uid ? null : u.uid)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                    <MoreVertical size={14} />
                  </button>
                  {menuOpen === u.uid && (
                    <div className="absolute right-4 top-12 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-52"
                      onMouseLeave={() => setMenuOpen(null)}>
                      <p className="px-3 py-1.5 text-[10px] text-gray-400 uppercase font-bold">Changer le role</p>
                      {['admin', 'manager', 'employee'].map(role => (
                        <button key={role} onClick={() => handleAction(u.uid, `make_${role}`)} disabled={acting || u.role === role}
                          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-30 flex items-center gap-2">
                          <UserCheck size={12} /> {role.charAt(0).toUpperCase() + role.slice(1)}
                          {u.role === role && <span className="text-[10px] text-green-600 ml-auto">actuel</span>}
                        </button>
                      ))}
                      <hr className="my-1 border-gray-100" />
                      {!u.superAdmin ? (
                        <button onClick={() => handleAction(u.uid, 'make_superadmin')} disabled={acting}
                          className="w-full text-left px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-30 flex items-center gap-2">
                          <Crown size={12} /> Promouvoir Super Admin
                        </button>
                      ) : (
                        <button onClick={() => handleAction(u.uid, 'remove_superadmin')} disabled={acting}
                          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-30 flex items-center gap-2">
                          <Shield size={12} /> Retirer Super Admin
                        </button>
                      )}
                      <hr className="my-1 border-gray-100" />
                      {!u.suspended ? (
                        <button onClick={() => handleAction(u.uid, 'suspend')} disabled={acting}
                          className="w-full text-left px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-50 disabled:opacity-30 flex items-center gap-2">
                          <UserX size={12} /> Suspendre
                        </button>
                      ) : (
                        <button onClick={() => handleAction(u.uid, 'activate')} disabled={acting}
                          className="w-full text-left px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 disabled:opacity-30 flex items-center gap-2">
                          <UserCheck size={12} /> Reactiver
                        </button>
                      )}
                      <button onClick={() => handleAction(u.uid, 'delete')} disabled={acting}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-30 flex items-center gap-2">
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Aucun utilisateur</p>}
      </div>
      </div>
    </SuperAdminPage>
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
