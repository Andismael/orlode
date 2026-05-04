import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Loader2, Ban, RotateCcw, Shield, Trash2, Mic, CheckCircle2, XCircle, MoreVertical, Database, Plug2 } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
type Status = 'active' | 'invited' | 'suspended';

interface Member {
  uid: string;
  id?: string;
  displayName?: string;
  email?: string;
  role?: Role;
  status?: Status;
  permissions?: string[];
  photoURL?: string;
  joinedAt?: { seconds?: number } | string;
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'owner',   label: 'Owner' },
  { value: 'admin',   label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member',  label: 'Member' },
  { value: 'viewer',  label: 'Viewer' },
];

const ROLE_COLOR: Record<Role, string> = {
  owner:   'bg-purple-100 text-purple-700',
  admin:   'bg-blue-100 text-blue-700',
  manager: 'bg-indigo-100 text-indigo-700',
  member:  'bg-gray-100 text-gray-600',
  viewer:  'bg-gray-100 text-gray-500',
};

export default function UserManagementPage() {
  const current = useAuthStore(s => s.user);
  const canManage = current?.role === 'admin' || current?.superAdmin;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/team');
      const raw = r.data as unknown as Record<string, unknown>;
      const payload = (raw?.data ?? raw) as Record<string, unknown>;
      const list = (payload?.['members'] as Member[]) ?? [];
      setMembers(Array.isArray(list) ? list : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setFeedback(null);
    try { await fn(); setFeedback({ type: 'success', text: `${label} effectué.` }); load(); }
    catch (err) { setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' }); }
    finally { setBusy(null); setOpenMenu(null); }
  };

  const changeRole = (m: Member, role: Role) => act(`Rôle → ${role}`, () => api.patch(`/team/members/${m.uid}/role`, { role }));
  const togglePerm = (m: Member, permKey: string, label: string) => {
    const perms = m.permissions ?? [];
    const has = perms.includes(permKey);
    const next = has ? perms.filter(p => p !== permKey) : [...perms, permKey];
    return act(`${label} ${has ? 'retiré' : 'accordé'}`, () => api.patch(`/team/members/${m.uid}/permissions`, { permissions: next }));
  };
  const toggleVoice    = (m: Member) => togglePerm(m, 'useVoiceLive',       'Voice Live');
  const toggleShared   = (m: Member) => togglePerm(m, 'connectorsShared',   'Connecteurs partagés');
  const toggleCritical = (m: Member) => togglePerm(m, 'connectorsCritical', 'Connecteurs critiques');
  const toggleApiKeys  = (m: Member) => togglePerm(m, 'useApiKeys',         'Clés API');
  const suspend = (m: Member) => act('Suspendu', () => api.patch(`/team/members/${m.uid}/suspend`));
  const reactivate = (m: Member) => act('Réactivé', () => api.patch(`/team/members/${m.uid}/reactivate`));
  const remove = (m: Member) => {
    if (!confirm(`Retirer ${m.displayName ?? m.email} de l'équipe ?`)) return;
    return act('Retiré', () => api.delete(`/team/members/${m.uid}`));
  };

  if (!canManage) {
    return <div className="p-8 text-center text-sm text-gray-600">Accès réservé aux administrateurs.</div>;
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  const stats = {
    total: members.length,
    active: members.filter(m => !m.status || m.status === 'active').length,
    invited: members.filter(m => m.status === 'invited').length,
    suspended: members.filter(m => m.status === 'suspended').length,
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total} membres · {stats.active} actifs · {stats.invited} invités · {stats.suspended} suspendus
          </p>
        </div>
        <Link to="/admin/users/invite"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-sm hover:shadow"
          style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          <UserPlus size={15} /> Inviter
        </Link>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {members.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
          Aucun membre. Invite quelqu'un pour commencer.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Membre</th>
                <th className="px-4 py-2.5 text-left font-semibold">Rôle</th>
                <th className="px-4 py-2.5 text-left font-semibold">Statut</th>
                <th className="px-4 py-2.5 text-center font-semibold">Voice</th>
                <th className="px-4 py-2.5 text-center font-semibold">Conn. partagés</th>
                <th className="px-4 py-2.5 text-center font-semibold">Conn. critiques</th>
                <th className="px-4 py-2.5 text-center font-semibold">Clés API</th>
                <th className="px-4 py-2.5 text-right font-semibold w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const role = (m.role ?? 'member') as Role;
                const status = (m.status ?? 'active') as Status;
                const hasVoice = (m.permissions ?? []).includes('useVoiceLive');
                const isOwner = role === 'owner';
                const isSelf = m.uid === current?.uid;
                return (
                  <tr key={m.uid} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {m.photoURL ? (
                          <img src={m.photoURL} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                            {(m.displayName ?? m.email ?? '?').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{m.displayName ?? '—'}</p>
                          {m.email && <p className="text-xs text-gray-500">{m.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isOwner || isSelf ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_COLOR[role]}`}>{role}</span>
                      ) : (
                        <select value={role}
                          onChange={e => changeRole(m, e.target.value as Role)}
                          disabled={busy !== null}
                          className={`text-xs px-2 py-1 rounded-full font-medium capitalize border border-transparent cursor-pointer ${ROLE_COLOR[role]}`}>
                          {ROLES.filter(r => r.value !== 'owner').map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        status === 'active' ? 'bg-green-100 text-green-700' :
                        status === 'invited' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PermToggle on={hasVoice} onClick={() => toggleVoice(m)} disabled={busy !== null} color="violet" title="Voice Live" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PermToggle on={(m.permissions ?? []).includes('connectorsShared')}
                        onClick={() => toggleShared(m)} disabled={busy !== null} color="blue"
                        title="Connecteurs partagés (Slack, Teams, SharePoint, WhatsApp…)" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PermToggle on={(m.permissions ?? []).includes('connectorsCritical')}
                        onClick={() => toggleCritical(m)} disabled={busy !== null} color="red"
                        title="Connecteurs critiques (DB, API Custom, Shopify, Site crawler)" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PermToggle on={(m.permissions ?? []).includes('useApiKeys')}
                        onClick={() => toggleApiKeys(m)} disabled={busy !== null} color="green"
                        title="Autoriser à créer/gérer ses propres clés API" />
                    </td>
                    <td className="px-4 py-3 text-right relative">
                      {!isOwner && !isSelf && (
                        <>
                          <button onClick={() => setOpenMenu(openMenu === m.uid ? null : m.uid)}
                            className="p-1.5 hover:bg-gray-100 rounded">
                            <MoreVertical size={16} className="text-gray-500" />
                          </button>
                          {openMenu === m.uid && (
                            <div className="absolute right-4 top-10 z-10 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[180px]">
                              {status === 'active' ? (
                                <button onClick={() => suspend(m)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                                  <Ban size={14} className="text-amber-600" /> Suspendre
                                </button>
                              ) : (
                                <button onClick={() => reactivate(m)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                                  <RotateCcw size={14} className="text-green-600" /> Réactiver
                                </button>
                              )}
                              <button onClick={() => remove(m)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-red-600">
                                <Trash2 size={14} /> Retirer
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        <Shield size={11} className="inline mr-1" />
        Seul l'owner ne peut pas être modifié. Les actions de gestion nécessitent la permission <code>manageTeam</code>.
      </p>
    </div>
  );
}

function PermToggle({ on, onClick, disabled, color, title }: {
  on: boolean; onClick: () => void; disabled?: boolean; color: 'violet' | 'blue' | 'red' | 'green'; title?: string;
}) {
  const bg = on
    ? (color === 'violet' ? 'bg-violet-600' : color === 'blue' ? 'bg-blue-600' : color === 'green' ? 'bg-green-600' : 'bg-red-600')
    : 'bg-gray-300';
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 ${bg}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
        on ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  );
}
