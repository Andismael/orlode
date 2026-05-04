import { useEffect, useState } from 'react';
import { Mic, Loader2, CheckCircle2, XCircle, Save, ShieldAlert } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface Member {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  permissions?: string[];
}

export default function VoicePermissionsPage() {
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.superAdmin;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasByoe, setHasByoe] = useState<boolean>(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get('/team').catch(() => ({ data: {} })),
        api.get('/ai/live-key-status').catch(() => ({ data: {} })),
      ]);
      const rawM = r1.data as unknown as Record<string, unknown>;
      // /api/team returns { success, data: { team, members: [...] } }
      const payload = (rawM?.data ?? rawM) as Record<string, unknown>;
      const list = (payload?.['members'] as Member[]) ?? (Array.isArray(payload) ? (payload as unknown as Member[]) : []);
      setMembers(Array.isArray(list) ? list : []);

      const rawS = r2.data as unknown as Record<string, unknown>;
      const statusPayload = (rawS?.data ?? rawS) as { hasTenantKey?: boolean };
      setHasByoe(statusPayload?.hasTenantKey === true);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleVoice = async (m: Member) => {
    setSavingUid(m.uid);
    setFeedback(null);
    try {
      const current = m.permissions ?? [];
      const has = current.includes('useVoiceLive');
      const next = has ? current.filter(p => p !== 'useVoiceLive') : [...current, 'useVoiceLive'];
      await api.patch(`/team/members/${m.uid}/permissions`, { permissions: next });
      setMembers(prev => prev.map(x => x.uid === m.uid ? { ...x, permissions: next } : x));
      setFeedback({ type: 'success', text: `Accès Voice Live ${has ? 'retiré' : 'accordé'} à ${m.displayName ?? m.email}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setSavingUid(null); }
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center text-sm text-gray-600">Accès réservé aux admins/managers.</div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-violet-100"><Mic size={24} className="text-violet-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accès Voice Live</h1>
          <p className="text-sm text-gray-500">Autorise individuellement chaque employé à utiliser Gemini Live (voix temps réel).</p>
        </div>
      </div>

      {!hasByoe && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-900">Clé Gemini entreprise non configurée</p>
            <p className="text-amber-700 mt-1">
              Avant que les employés puissent utiliser Voice Live, configure ta propre clé Gemini dans{' '}
              <a href="/admin/byoe" className="underline font-medium">Hébergement BYOE</a>. Les employés autorisés partageront ensuite cette clé.
            </p>
          </div>
        </div>
      )}

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {members.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Aucun employé. Invite quelqu'un via <a href="/admin/users/invite" className="text-blue-600 hover:underline">Inviter</a>.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Employé</th>
                <th className="px-4 py-2.5 text-left font-semibold">Rôle</th>
                <th className="px-4 py-2.5 text-right font-semibold">Voice Live</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const has = (m.permissions ?? []).includes('useVoiceLive');
                const isSaving = savingUid === m.uid;
                return (
                  <tr key={m.uid} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                          {(m.displayName ?? m.email ?? '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{m.displayName ?? m.email}</p>
                          {m.email && m.displayName && <p className="text-xs text-gray-500">{m.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{m.role ?? 'member'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleVoice(m)} disabled={isSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                          has ? 'bg-violet-600' : 'bg-gray-300'
                        } disabled:opacity-50`}>
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                          has ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                        {isSaving && <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-gray-400" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        ℹ️ Les employés autorisés utilisent la clé Gemini configurée dans BYOE — le coût va sur ton compte Google.
        Tu peux révoquer l'accès à tout moment, prend effet immédiatement à la prochaine connexion.
      </p>
    </div>
  );
}
