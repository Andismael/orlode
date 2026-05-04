import { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Loader2, CheckCircle2, XCircle, Copy, Shield, Users, UserPlus, UserMinus } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdBy: string;
  sharedWith?: string[];
  relation?: 'owner' | 'shared' | 'admin-view';
  createdAt?: { seconds?: number };
  lastUsedAt?: { seconds?: number };
  expiresAt?: { seconds?: number };
  enabled?: boolean;
  usageCount?: number;
}

interface Member { uid: string; displayName?: string; email?: string; }

interface CreateResult { id: string; key: string; name: string; }

export default function ApiKeysPage() {
  const { user } = useAuthStore();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [scopes, setScopes] = useState(['read', 'agent']);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createdKey, setCreatedKey] = useState<CreateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<ApiKey | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const isAdmin = user?.role === 'admin' || user?.role === 'manager' || user?.superAdmin;

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/apikeys');
      const raw = r.data as unknown as Record<string, unknown>;
      const list = ((raw?.data ?? raw) as ApiKey[]) ?? [];
      setKeys(list);
      setPermError(null);
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      if (e?.response?.status === 403) setPermError(e.response.data?.message ?? "Permission refusée.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // Load team members (to pick who to share with)
    api.get('/team').then(r => {
      const raw = r.data as unknown as Record<string, unknown>;
      const payload = (raw?.data ?? raw) as Record<string, unknown>;
      const list = ((payload?.['members'] as Member[]) ?? []).filter(m => m.uid !== user?.uid);
      setMembers(list);
    }).catch(() => { /* ignore */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleShare = async (key: ApiKey, memberId: string) => {
    const isCurrentlyShared = (key.sharedWith ?? []).includes(memberId);
    try {
      if (isCurrentlyShared) {
        await api.delete(`/apikeys/${key.id}/share/${memberId}`);
      } else {
        await api.post(`/apikeys/${key.id}/share`, { userIds: [memberId] });
      }
      await load();
      // Refresh the shareTarget local state with fresh data
      setShareTarget(prev => prev ? ({
        ...prev,
        sharedWith: isCurrentlyShared
          ? (prev.sharedWith ?? []).filter(u => u !== memberId)
          : [...(prev.sharedWith ?? []), memberId],
      }) : null);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    }
  };

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true); setFeedback(null);
    try {
      const r = await api.post('/apikeys', { name: newName.trim(), scopes });
      const raw = r.data as unknown as Record<string, unknown>;
      const result = (raw?.data ?? raw) as CreateResult;
      setCreatedKey(result);
      setNewName('');
      setFeedback({ type: 'success', text: 'Clé créée. Copie-la maintenant — elle ne sera plus affichée.' });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setCreating(false); }
  };

  const revoke = async (k: ApiKey) => {
    if (!confirm(`Révoquer "${k.name}" ?`)) return;
    try {
      await api.delete(`/apikeys/${k.id}`);
      setFeedback({ type: 'success', text: `"${k.name}" révoquée.` });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    }
  };

  const copyToClipboard = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  if (permError) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <Shield size={48} className="mx-auto text-amber-400 mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">Permission requise</h1>
        <p className="text-sm text-gray-600">{permError}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-green-100"><Key size={24} className="text-green-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes clés API</h1>
          <p className="text-sm text-gray-500">
            {isAdmin
              ? 'Admin: toutes les clés de ton entreprise (tous les employés).'
              : 'Utilise tes clés pour accéder à l\'API Orlode depuis tes scripts/outils.'}
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {createdKey && (
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <p className="text-sm font-semibold text-gray-900">Ta nouvelle clé — copie-la maintenant !</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2">
            <code className="flex-1 text-xs font-mono text-gray-900 overflow-auto">{createdKey.key}</code>
            <button onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded text-xs hover:bg-violet-700">
              <Copy size={12} /> {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
          <p className="text-xs text-amber-700">⚠️ Cette clé ne sera plus affichée. Si tu la perds, supprime-la et crée-en une nouvelle.</p>
          <button onClick={() => setCreatedKey(null)} className="text-xs text-gray-500 hover:text-gray-700">J'ai copié, fermer</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Plus size={16} /> Nouvelle clé</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <input type="text" placeholder="Nom (ex: Intégration CRM)" value={newName}
            onChange={e => setNewName(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <select value={scopes.join(',')} onChange={e => setScopes(e.target.value.split(','))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="read,agent">Lecture + Agents</option>
            <option value="read">Lecture seule</option>
            <option value="read,write,agent">Lecture + Écriture + Agents</option>
          </select>
          <button onClick={create} disabled={!newName.trim() || creating}
            className="flex items-center justify-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer
          </button>
        </div>
      </div>

      {keys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Aucune clé API. Crée ta première clé ci-dessus.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Nom</th>
                <th className="px-4 py-2.5 text-left font-semibold">Prefix</th>
                <th className="px-4 py-2.5 text-left font-semibold">Scopes</th>
                {isAdmin && <th className="px-4 py-2.5 text-left font-semibold">Propriétaire</th>}
                <th className="px-4 py-2.5 text-left font-semibold">Usage</th>
                <th className="px-4 py-2.5 text-right font-semibold w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => {
                const isOwner = k.relation === 'owner';
                const isShared = k.relation === 'shared';
                const sharedCount = (k.sharedWith ?? []).length;
                return (
                <tr key={k.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{k.name}</span>
                      {isShared && (
                        <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-xs font-medium flex items-center gap-1">
                          <Users size={10} /> Partagée avec vous
                        </span>
                      )}
                      {isOwner && sharedCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium flex items-center gap-1">
                          <Users size={10} /> {sharedCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{k.keyPrefix}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {k.scopes.map(s => (
                        <span key={s} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">{s}</span>
                      ))}
                    </div>
                  </td>
                  {isAdmin && <td className="px-4 py-3 text-xs text-gray-500 font-mono">{k.createdBy === user?.uid ? 'Vous' : k.createdBy.slice(0, 8)}…</td>}
                  <td className="px-4 py-3 text-xs text-gray-600">{k.usageCount ?? 0} requêtes</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {isOwner && (
                        <button onClick={() => setShareTarget(k)}
                          className="p-1.5 text-violet-500 hover:bg-violet-50 rounded" title="Partager">
                          <UserPlus size={14} />
                        </button>
                      )}
                      {isOwner && (
                        <button onClick={() => revoke(k)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Révoquer">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <strong>Utilisation:</strong> ajoute le header <code className="bg-blue-100 px-1 rounded">X-API-Key: ta_clé</code> dans tes requêtes HTTP.<br/>
        <strong>Base URL:</strong> <code className="bg-blue-100 px-1 rounded">https://api-15262322885.us-central1.run.app/api</code>
      </div>

      {shareTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShareTarget(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Users size={18} className="text-violet-600" />
              <h3 className="font-semibold text-gray-900">Partager « {shareTarget.name} »</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Les personnes ci-dessous pourront utiliser cette clé. ⚠️ Elles peuvent voir et utiliser la clé, mais pas la révoquer ni la partager à leur tour. Tu gardes le contrôle — révoque à tout moment.
            </p>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {members.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">Aucun autre membre dans l'entreprise.</p>
              ) : members.map(m => {
                const shared = (shareTarget.sharedWith ?? []).includes(m.uid);
                return (
                  <div key={m.uid} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {(m.displayName ?? m.email ?? '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.displayName ?? m.email}</p>
                      {m.email && m.displayName && <p className="text-xs text-gray-500 truncate">{m.email}</p>}
                    </div>
                    <button onClick={() => toggleShare(shareTarget, m.uid)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                        shared ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                      }`}>
                      {shared ? <><UserMinus size={11} /> Retirer</> : <><UserPlus size={11} /> Partager</>}
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShareTarget(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
