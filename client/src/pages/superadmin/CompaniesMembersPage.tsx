import { useEffect, useMemo, useState } from 'react';
import { Building2, Users, Mic, Ban, RotateCcw, Trash2, Loader2, CheckCircle2, XCircle, Search, ChevronRight } from 'lucide-react';
import api from '@/services/api';
import SuperAdminPage from './_SuperAdminPage';

interface Company { id: string; name: string; email?: string; plan?: string; status?: string; usersCount?: number; createdAt?: string; }
interface Member { uid: string; id?: string; email?: string; displayName?: string; role?: string; status?: string; permissions?: string[]; photoURL?: string; }

const ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];
const ROLE_COLOR: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  manager: 'bg-indigo-100 text-indigo-700',
  member: 'bg-gray-100 text-gray-600',
  viewer: 'bg-gray-100 text-gray-500',
};

export default function CompaniesMembersPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/superadmin/companies');
        const raw = r.data as unknown as Record<string, unknown>;
        setCompanies(((raw?.data ?? raw ?? []) as Company[]) || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  }, [companies, search]);

  const loadMembers = async (companyId: string) => {
    setSelected(companyId);
    setMembersLoading(true);
    setMembers([]);
    try {
      const r = await api.get(`/superadmin/companies/${companyId}`);
      const raw = r.data as unknown as Record<string, unknown>;
      const payload = (raw?.data ?? raw) as Record<string, unknown>;
      const userList = (payload?.['users'] as Member[]) ?? [];
      // Also try pulling from companies/{id}/members via team-like endpoint (via superadmin — reuse team shape if members subcollection exists)
      setMembers(userList);
    } finally { setMembersLoading(false); }
  };

  const act = async (memberId: string, action: string, payload: Record<string, unknown> = {}) => {
    if (!selected) return;
    setBusy(memberId + action); setFeedback(null);
    try {
      await api.post(`/superadmin/companies/${selected}/members/${memberId}/action`, { action, ...payload });
      setFeedback({ type: 'success', text: `Action "${action}" effectuée.` });
      loadMembers(selected);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setBusy(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  const selectedCompany = companies.find(c => c.id === selected);

  return (
    <SuperAdminPage
      title="Entreprises & Utilisateurs"
      subtitle="Vue super admin — gère les membres de chaque entreprise"
      icon={<Building2 size={20} />}
      maxWidth="7xl"
      actions={
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-44 md:w-64" />
        </div>
      }
    >
      <div className="space-y-6">
      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: companies grid */}
        <div className="lg:col-span-5 space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">Aucune entreprise.</div>
          ) : filtered.map(c => (
            <button key={c.id} onClick={() => loadMembers(c.id)}
              className={`w-full text-left bg-white rounded-xl border p-3 hover:shadow-sm transition-all flex items-center gap-3 ${
                selected === c.id ? 'border-purple-500 ring-2 ring-purple-100' : 'border-gray-200'
              }`}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">{c.email || c.id.slice(0, 12)}</span>
                  {c.plan && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] uppercase">{c.plan}</span>}
                  <span className="flex items-center gap-0.5"><Users size={10} /> {c.usersCount ?? 0}</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </div>

        {/* RIGHT: members of selected company */}
        <div className="lg:col-span-7">
          {!selected ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
              <Building2 size={32} className="mx-auto mb-2 opacity-30" />
              Sélectionne une entreprise à gauche pour voir ses membres.
            </div>
          ) : membersLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-purple-500" size={24} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{selectedCompany?.name} — {members.length} membre(s)</p>
                <p className="text-xs text-gray-500">{selectedCompany?.email}</p>
              </div>
              {members.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">Aucun membre.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Membre</th>
                      <th className="px-3 py-2 text-left font-semibold">Rôle</th>
                      <th className="px-3 py-2 text-center font-semibold">Voice</th>
                      <th className="px-3 py-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => {
                      const role = m.role ?? 'member';
                      const hasVoice = (m.permissions ?? []).includes('useVoiceLive');
                      const isOwner = role === 'owner';
                      return (
                        <tr key={m.uid} className="border-t border-gray-100">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {m.photoURL ? (
                                <img src={m.photoURL} alt="" className="w-7 h-7 rounded-full" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[10px] font-bold">
                                  {(m.displayName ?? m.email ?? '?').slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{m.displayName ?? m.email}</p>
                                {m.email && m.displayName && <p className="text-xs text-gray-500 truncate">{m.email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {isOwner ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLOR[role]}`}>{role}</span>
                            ) : (
                              <select value={role}
                                onChange={e => act(m.uid, 'change-role', { role: e.target.value })}
                                disabled={!!busy}
                                className={`text-xs px-2 py-1 rounded-full font-medium capitalize cursor-pointer ${ROLE_COLOR[role] ?? ROLE_COLOR.member}`}>
                                {ROLES.filter(r => r !== 'owner').map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => act(m.uid, 'toggle-voice')} disabled={!!busy}
                              title={hasVoice ? 'Retirer Voice Live' : 'Accorder Voice Live'}
                              className={`relative inline-flex h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
                                hasVoice ? 'bg-violet-600' : 'bg-gray-300'
                              }`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                                hasVoice ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {!isOwner && (
                              <div className="flex items-center gap-1 justify-end">
                                {m.status === 'suspended' ? (
                                  <button onClick={() => act(m.uid, 'reactivate')} disabled={!!busy} title="Réactiver"
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                                    <RotateCcw size={14} />
                                  </button>
                                ) : (
                                  <button onClick={() => act(m.uid, 'suspend')} disabled={!!busy} title="Suspendre"
                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded">
                                    <Ban size={14} />
                                  </button>
                                )}
                                <button onClick={() => {
                                  if (confirm(`Supprimer ${m.displayName ?? m.email} de cette entreprise ?`)) act(m.uid, 'delete');
                                }} disabled={!!busy} title="Supprimer"
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </SuperAdminPage>
  );
}
