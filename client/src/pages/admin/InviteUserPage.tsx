import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Plus, X, Send } from 'lucide-react';

interface InviteEntry { email: string; role: string; }

export default function InviteUserPage() {
  const navigate = useNavigate();
  const { t } = useLangStore();
  const [invites, setInvites] = useState<InviteEntry[]>([{ email: '', role: 'employee' }]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const add = () => setInvites(p => [...p, { email: '', role: 'employee' }]);
  const remove = (i: number) => setInvites(p => p.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof InviteEntry, value: string) =>
    setInvites(p => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await api.post('/users/invite', { invites, message });
      navigate('/admin/users');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inviter des utilisateurs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Un email d'invitation sera envoyé à chaque adresse</p>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>}
      <form onSubmit={send} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="space-y-2">
          {invites.map((inv, i) => (
            <div key={i} className="flex gap-2">
              <input type="email" required value={inv.email} onChange={e => update(i, 'email', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@entreprise.com" />
              <select value={inv.role} onChange={e => update(i, 'role', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="employee">Employé</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              {invites.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
          <Plus size={14} /> Ajouter une adresse
        </button>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message personnalisé (optionnel)</label>
          <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Bienvenue dans notre équipe Orlode !" />
        </div>
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={() => navigate('/admin/users')}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
            <Send size={14} /> {loading ? 'Envoi...' : `Envoyer ${invites.length} invitation${invites.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
}
