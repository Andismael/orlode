import { useEffect, useState } from 'react';
import api from '@/services/api';
import { MessageSquare, AlertCircle, Clock, Loader2, HeadphonesIcon } from 'lucide-react';
import SuperAdminPage from './_SuperAdminPage';

interface Ticket { id: string; company: string; subject: string; status: 'open' | 'pending' | 'resolved'; priority: 'P1' | 'P2' | 'P3'; createdAt: string; }

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
};
const PRIORITY_STYLE: Record<string, string> = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-blue-100 text-blue-700',
};

export default function PlatformSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    api.get('/superadmin/support/tickets').then(r => {
      const raw = r.data;
      setTickets(Array.isArray(raw) ? raw : []);
    }).catch(() => {
      setTickets([
        { id: '1', company: 'Acme Corp', subject: 'Impossible de se connecter apres MFA', status: 'open', priority: 'P1', createdAt: new Date().toISOString() },
        { id: '2', company: 'Beta SAS', subject: 'Agent HR ne repond plus', status: 'pending', priority: 'P2', createdAt: new Date().toISOString() },
        { id: '3', company: 'Gamma Inc', subject: 'Question facturation', status: 'resolved', priority: 'P3', createdAt: new Date().toISOString() },
      ]);
    }).finally(() => setLoading(false));
  }, []);

  const sendReply = async () => {
    if (!reply?.text.trim()) return;
    await api.post(`/superadmin/support/tickets/${reply.id}/reply`, { message: reply.text }).catch(() => {});
    setReply(null);
    setTickets(prev => prev.map(tk => tk.id === reply.id ? { ...tk, status: 'resolved' as const } : tk));
  };

  if (loading) return (
    <SuperAdminPage title="Support Plateforme" icon={<HeadphonesIcon size={20} />}>
      <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
    </SuperAdminPage>
  );

  return (
    <SuperAdminPage
      title="Support Plateforme"
      subtitle="Tickets clients par priorité"
      icon={<HeadphonesIcon size={20} />}
      actions={<span className="text-xs md:text-sm text-gray-400">{tickets.filter(t => t.status === 'open').length} ouvert(s)</span>}
    >
      <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: AlertCircle, label: 'Ouverts', value: tickets.filter(t => t.status === 'open').length, color: 'text-red-600' },
          { icon: Clock, label: 'En attente', value: tickets.filter(t => t.status === 'pending').length, color: 'text-yellow-600' },
          { icon: MessageSquare, label: 'Resolus', value: tickets.filter(t => t.status === 'resolved').length, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <s.icon size={18} className={`${s.color} mx-auto mb-1`} />
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Ticket list */}
      <div className="space-y-2">
        {tickets.map(t => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{t.subject}</p>
                <p className="text-xs text-gray-400">{t.company} · {new Date(t.createdAt).toLocaleDateString('fr-FR')}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[t.status]}`}>{t.status}</span>
            </div>
            {t.status !== 'resolved' && (
              reply?.id === t.id ? (
                <div className="space-y-2">
                  <textarea value={reply.text} onChange={e => setReply({ ...reply, text: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    rows={3} placeholder="Votre reponse..." />
                  <div className="flex gap-2">
                    <button onClick={sendReply}
                      className="px-4 py-1.5 text-white text-xs rounded-lg font-medium bg-violet-600 hover:bg-violet-700">Envoyer</button>
                    <button onClick={() => setReply(null)}
                      className="px-4 py-1.5 text-gray-500 text-xs rounded-lg hover:bg-gray-100">Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setReply({ id: t.id, text: '' })}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium">Repondre →</button>
              )
            )}
          </div>
        ))}
        {tickets.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Aucun ticket</p>}
      </div>
      </div>
    </SuperAdminPage>
  );
}
