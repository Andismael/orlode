/**
 * HostNotificationsWidget — shows pending visitor notifications for the current user.
 * Visible on /hr portal and anywhere else an employee might need it.
 * Each notification has three buttons: J'arrive / Faites patienter / Pas dispo.
 */
import { useEffect, useState } from 'react';
import { UserCheck, Clock, XCircle, Loader2, UserPlus, Phone } from 'lucide-react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';

interface HostNotification {
  id: string;
  hostName: string;
  visitorName: string;
  visitorContact?: string;
  reason?: string;
  status: 'pending' | 'accepted' | 'asked_to_wait' | 'rejected' | 'handled';
  hostPresent?: boolean;
  createdAt?: string | { _seconds: number };
}

function timeAgo(ts: HostNotification['createdAt']): string {
  if (!ts) return '';
  const d = typeof ts === 'string' ? new Date(ts) : new Date((ts as { _seconds: number })._seconds * 1000);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return d.toLocaleDateString('fr-FR');
}

export default function HostNotificationsWidget() {
  const [notifications, setNotifications] = useState<HostNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await api.get('/hr/host-notifications');
      const list = (r.data ?? []) as HostNotification[];
      setNotifications(list.filter(n => n.status === 'pending'));
    } catch { /* empty silently */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000); // refresh every 15 s
    return () => clearInterval(poll);
  }, []);

  const act = async (id: string, action: 'accept' | 'wait' | 'reject') => {
    setActingOn(id);
    const statusMap = { accept: 'accepted', wait: 'asked_to_wait', reject: 'rejected' } as const;
    try {
      await api.patch(`/hr/host-notifications/${id}`, { status: statusMap[action], replyAction: action });
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success(action === 'accept' ? 'Visiteur prévenu : vous arrivez' : action === 'wait' ? 'Visiteur invité à patienter' : 'Visiteur informé');
    } catch {
      toast.error('Erreur, réessaie');
    } finally {
      setActingOn(null);
    }
  };

  if (loading) return null;
  if (notifications.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-violet-50 border-b border-violet-100">
        <UserPlus size={16} className="text-violet-600" />
        <span className="text-sm font-bold text-violet-900">
          {notifications.length} visiteur{notifications.length > 1 ? 's' : ''} à l'accueil
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {notifications.map(n => (
          <div key={n.id} className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                {n.visitorName?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{n.visitorName}</p>
                {n.reason && <p className="text-xs text-gray-500 truncate">{n.reason}</p>}
                {n.visitorContact && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone size={11} /> {n.visitorContact}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => act(n.id, 'accept')} disabled={actingOn === n.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50">
                {actingOn === n.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                J'arrive
              </button>
              <button onClick={() => act(n.id, 'wait')} disabled={actingOn === n.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-50">
                <Clock size={12} />
                Patience
              </button>
              <button onClick={() => act(n.id, 'reject')} disabled={actingOn === n.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50">
                <XCircle size={12} />
                Pas dispo
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
