/**
 * AgentPermissionsPage — Per-agent RBAC matrix
 * Admin assigns each team member a role (Admin / User / No access) for each agent.
 */
import { useEffect, useState } from 'react';
import { Shield, ShieldCheck, UserMinus, Save, Search, Loader2, Info } from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';

interface Member {
  id: string; uid?: string; email?: string; displayName?: string;
  role?: string; photoURL?: string | null; isOwner?: boolean;
}

// All agents available across the app — keep in sync with the agent dashboard list
const ALL_AGENTS: Array<{ id: string; label: string; icon: string; category: string }> = [
  { id: 'hr',            label: 'Ressources Humaines', icon: '👩', category: 'Opérations' },
  { id: 'reception',     label: 'Réception',            icon: '🚪', category: 'Opérations' },
  { id: 'accounting',    label: 'Comptabilité',         icon: '💰', category: 'Finance' },
  { id: 'sales',         label: 'Ventes',               icon: '🤝', category: 'Business' },
  { id: 'marketing',     label: 'Marketing',            icon: '📣', category: 'Business' },
  { id: 'support',       label: 'Support',              icon: '📞', category: 'Business' },
  { id: 'it',            label: 'IT',                   icon: '🖥', category: 'Technique' },
  { id: 'cybersecurity', label: 'Cybersécurité',        icon: '🛡', category: 'Technique' },
  { id: 'legal',         label: 'Juridique',            icon: '⚖', category: 'Gouvernance' },
  { id: 'insights',      label: 'Insights',             icon: '📊', category: 'Analytique' },
  { id: 'knowledge',     label: 'Base de connaissance', icon: '📚', category: 'Analytique' },
  { id: 'comms',         label: 'Communications',       icon: '📧', category: 'Opérations' },
  { id: 'meeting',       label: 'Réunions',             icon: '🎤', category: 'Opérations' },
  { id: 'coach',         label: 'Coach',                icon: '🧑‍🏫', category: 'Équipe' },
  { id: 'training',      label: 'Formation',            icon: '🎓', category: 'Équipe' },
  { id: 'news',          label: 'Veille',               icon: '⭐', category: 'Business' },
  { id: 'orchestrator',  label: 'Orchestrateur',        icon: '🧠', category: 'IA' },
];

type Role = 'admin' | 'user' | 'none';

export default function AgentPermissionsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Member | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/team').then(r => {
      const d = r.data as { members?: Member[] } | Member[];
      const list = Array.isArray(d) ? d : (d?.members ?? []);
      setMembers(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selected?.uid && !selected?.id) return;
    const id = selected.uid ?? selected.id;
    api.get(`/team/members/${id}/agent-roles`)
      .then(r => {
        const data = (r.data ?? {}) as Record<string, Role | null>;
        const normalized: Record<string, Role> = {};
        for (const a of ALL_AGENTS) {
          normalized[a.id] = (data[a.id] as Role) ?? 'none';
        }
        setRoles(normalized);
      })
      .catch(() => setRoles(Object.fromEntries(ALL_AGENTS.map(a => [a.id, 'none' as Role]))));
  }, [selected]);

  const save = async () => {
    if (!selected) return;
    const id = selected.uid ?? selected.id;
    setSaving(true);
    try {
      const agentRoles = Object.fromEntries(
        Object.entries(roles).map(([k, v]) => [k, v === 'none' ? null : v])
      );
      await api.put(`/team/members/${id}/agent-roles`, { agentRoles });
      toast.success('Rôles enregistrés', `Mis à jour pour ${selected.displayName ?? selected.email}`);
    } catch {
      toast.error('Échec', 'Réessaie');
    } finally {
      setSaving(false);
    }
  };

  const setAll = (value: Role) => {
    setRoles(prev => Object.fromEntries(Object.keys(prev).map(k => [k, value])));
  };

  const filtered = members.filter(m => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (m.displayName ?? '').toLowerCase().includes(s) || (m.email ?? '').toLowerCase().includes(s);
  });

  const categories = Array.from(new Set(ALL_AGENTS.map(a => a.category)));

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="p-6 max-w-7xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-violet-600" />
            Permissions par agent
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Définis qui peut accéder à quel agent, en tant qu'admin (tout voir) ou simple utilisateur (données perso uniquement).
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <Info size={14} className="flex-shrink-0" />
        <span>
          <strong>Admin</strong> = peut tout voir et modifier (ex: voir tous les salaires).
          <strong className="ml-2">Utilisateur</strong> = voit ses propres données uniquement.
          <strong className="ml-2">Aucun accès</strong> = l'agent est invisible dans la sidebar.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Members list */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {filtered.map(m => {
              const active = selected?.uid === m.uid || selected?.id === m.id;
              return (
                <button key={m.uid ?? m.id} onClick={() => setSelected(m)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${active ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                  {m.photoURL ? (
                    <img src={m.photoURL} alt={m.displayName} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                      {(m.displayName ?? m.email ?? '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${active ? 'text-violet-900' : 'text-gray-900'}`}>
                      {m.displayName ?? m.email ?? 'Inconnu'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                  {m.isOwner && <Shield size={12} className="text-amber-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Role matrix */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
              Sélectionne un membre pour configurer ses accès.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selected.displayName ?? selected.email}</p>
                  <p className="text-xs text-gray-500">{selected.email}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAll('admin')} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium">
                    Tout admin
                  </button>
                  <button onClick={() => setAll('user')} className="px-3 py-1.5 rounded-lg text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">
                    Tout utilisateur
                  </button>
                  <button onClick={() => setAll('none')} className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium">
                    Tout refuser
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-5 max-h-[540px] overflow-y-auto">
                {categories.map(cat => (
                  <div key={cat}>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-2">{cat}</p>
                    <div className="space-y-2">
                      {ALL_AGENTS.filter(a => a.category === cat).map(a => {
                        const current = roles[a.id] ?? 'none';
                        return (
                          <div key={a.id} className="flex items-center gap-3 p-2.5 border border-gray-100 rounded-xl">
                            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-lg flex-shrink-0">
                              {a.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{a.label}</p>
                              <p className="text-xs text-gray-400">{a.id}</p>
                            </div>
                            <div className="flex gap-1">
                              {(['admin', 'user', 'none'] as Role[]).map(r => (
                                <button key={r}
                                  onClick={() => setRoles(prev => ({ ...prev, [a.id]: r }))}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                                    current === r
                                      ? r === 'admin' ? 'bg-emerald-600 text-white'
                                      : r === 'user' ? 'bg-blue-600 text-white'
                                      : 'bg-gray-500 text-white'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}>
                                  {r === 'admin' ? <ShieldCheck size={11} /> : r === 'user' ? null : <UserMinus size={11} />}
                                  {r === 'admin' ? 'Admin' : r === 'user' ? 'Utilisateur' : 'Aucun'}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-100 flex justify-end">
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
