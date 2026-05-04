import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import api from '@/services/api';

interface InviteInfo { companyName: string; role: string; email: string; }

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useLangStore();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [form, setForm] = useState({ name: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/auth/invite/${token}`).then(r => setInvite(r.data)).catch(() => setError('Invitation invalide ou expirée')).finally(() => setLoading(false));
  }, [token]);

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccepting(true); setError('');
    try {
      if (!user && invite) {
        const cred = await createUserWithEmailAndPassword(auth, invite.email, form.password);
        if (form.name.trim()) {
          try { await updateProfile(cred.user, { displayName: form.name.trim() }); } catch { /* non-critical */ }
        }
      } else if (user && form.name.trim() && auth.currentUser) {
        try { await updateProfile(auth.currentUser, { displayName: form.name.trim() }); } catch { /* non-critical */ }
      }
      await api.post('/auth/accept-invite', { token, displayName: form.name.trim() || undefined });
      // Force refresh the Firebase ID token to pick up the new companyId custom claim.
      // Without this, subsequent API calls would still use the old token (no companyId)
      // and the invited user wouldn't see their new company's agents/data.
      try {
        await auth.currentUser?.getIdToken(true);
      } catch { /* non-critical */ }
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setAccepting(false); }
  };

  if (loading) return <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-sm text-gray-500">{`${t('loading')}`}</div>;
  if (error && !invite) return <div className="bg-white rounded-2xl shadow-lg p-8 text-center"><p className="text-red-600">{error}</p></div>;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Invitation reçue</h2>
      <p className="text-sm text-gray-600 mb-6">Vous êtes invité à rejoindre <strong>{invite?.companyName}</strong> en tant que <strong>{invite?.role}</strong>.</p>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4 border border-red-200">{error}</div>}
      <form onSubmit={accept} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={invite?.email ?? ''} disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{`${t('name')}`} complet *</label>
          <input type="text" required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
            placeholder="Ex: Adelin Nguessan"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {!user && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Créer un mot de passe *</label>
            <input type="password" required value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <button type="submit" disabled={accepting}
          className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          {accepting ? 'Acceptation...' : 'Accepter l\'invitation'}
        </button>
      </form>
    </div>
  );
}
