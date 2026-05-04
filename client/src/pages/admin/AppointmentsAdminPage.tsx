import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, XCircle, UserPlus, Clock, Loader2, Phone, Mail, Filter, RefreshCw, MessageCircle, Send, Globe } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

type Status = 'pending' | 'confirmed' | 'rejected' | 'rescheduled' | 'cancelled';

interface Appointment {
  id: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  service?: string;
  date: string;
  time: string;
  status: Status;
  assignedTo?: string | null;
  assignedToName?: string | null;
  sourceChannel?: 'web' | 'whatsapp' | 'telegram' | 'sms' | 'messenger' | 'email' | 'unknown';
  sourceType?: 'clone' | 'reception' | 'admin' | 'self';
  notes?: string;
  createdAt?: { seconds?: number } | string;
}

interface Employee {
  uid: string;
  displayName?: string;
  email?: string;
}

const STATUS_META: Record<Status, { label: string; bg: string; text: string }> = {
  pending:    { label: 'En attente',   bg: 'bg-amber-100',  text: 'text-amber-700' },
  confirmed:  { label: 'Confirmé',     bg: 'bg-green-100',  text: 'text-green-700' },
  rejected:   { label: 'Refusé',       bg: 'bg-red-100',    text: 'text-red-700' },
  rescheduled:{ label: 'Reprogrammé',  bg: 'bg-blue-100',   text: 'text-blue-700' },
  cancelled:  { label: 'Annulé',       bg: 'bg-gray-100',   text: 'text-gray-600' },
};

const CHANNEL_ICON: Record<string, typeof Send> = {
  whatsapp: MessageCircle, telegram: Send, web: Globe, email: Mail, sms: MessageCircle, messenger: MessageCircle,
};

export default function AppointmentsAdminPage() {
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager' || (user?.role as string) === 'reception' || user?.superAdmin;

  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignTarget, setAssignTarget] = useState<{ id: string; clientName: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; clientName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const r = await api.get<Appointment[]>('/appointments');
      const raw = r.data as unknown as Record<string, unknown>;
      const data = (raw?.data ?? raw ?? []) as Appointment[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const loadEmployees = async () => {
    try {
      const r = await api.get('/team');
      const raw = r.data as unknown as Record<string, unknown>;
      // /api/team returns { success, data: { team, members: [...] } }
      const payload = (raw?.data ?? raw) as Record<string, unknown>;
      const list = (payload?.['members'] as Employee[]) ?? (Array.isArray(payload) ? (payload as unknown as Employee[]) : []);
      setEmployees(Array.isArray(list) ? list : []);
    } catch { /* optional */ }
  };

  useEffect(() => { load(); loadEmployees(); }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(i => i.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: items.length, pending: 0, confirmed: 0, rejected: 0, rescheduled: 0, cancelled: 0 };
    items.forEach(i => { base[i.status] = (base[i.status] ?? 0) + 1; });
    return base;
  }, [items]);

  const act = async (id: string, action: 'confirm' | 'reject' | 'assign' | 'reschedule', payload: Record<string, unknown> = {}) => {
    setBusy(id + ':' + action);
    setFeedback(null);
    try {
      await api.patch(`/appointments/${id}`, { action, ...payload });
      setFeedback({ type: 'success', text: `Action "${action}" effectuée.` });
      load(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      setFeedback({ type: 'error', text: msg });
    } finally { setBusy(null); }
  };

  const openReject = (appt: Appointment) => {
    setRejectTarget({ id: appt.id, clientName: appt.clientName });
    setRejectReason('');
  };
  const submitReject = async () => {
    if (!rejectTarget) return;
    await act(rejectTarget.id, 'reject', { reason: rejectReason });
    setRejectTarget(null);
    setRejectReason('');
  };

  const openReschedule = (appt: Appointment) => {
    setRescheduleTarget(appt);
    setRescheduleDate(appt.date);
    setRescheduleTime(appt.time);
  };
  const submitReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    await act(rescheduleTarget.id, 'reschedule', { date: rescheduleDate, time: rescheduleTime });
    setRescheduleTarget(null);
  };

  if (!canManage) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <p className="text-sm text-gray-600">Accès réservé aux administrateurs, managers et réceptionnistes.</p>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-blue-100"><Calendar size={24} className="text-blue-600" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Rendez-vous</h1>
          <p className="text-sm text-gray-500">Vue centrale — valider, refuser, attribuer, reprogrammer</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Rafraîchir
        </button>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Filtres par statut */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <Filter size={14} className="text-gray-400 shrink-0" />
        {(['pending', 'confirmed', 'rescheduled', 'rejected', 'cancelled', 'all'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s === 'all' ? 'Tous' : STATUS_META[s].label}
            <span className={`ml-1.5 text-xs ${filter === s ? 'text-white/80' : 'text-gray-400'}`}>({counts[s] ?? 0})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
          Aucun rendez-vous {filter !== 'all' ? `avec le statut "${STATUS_META[filter as Status].label.toLowerCase()}"` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(appt => {
            const meta = STATUS_META[appt.status] ?? STATUS_META.pending;
            const ChannelIcon = CHANNEL_ICON[appt.sourceChannel ?? ''] ?? Globe;
            return (
              <div key={appt.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">{appt.clientName}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>{meta.label}</span>
                      {appt.sourceChannel && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <ChannelIcon size={11} /> {appt.sourceChannel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                      <span className="flex items-center gap-1"><Clock size={11} /> {appt.date} {appt.time}</span>
                      {appt.clientPhone && <span className="flex items-center gap-1"><Phone size={11} /> {appt.clientPhone}</span>}
                      {appt.clientEmail && <span className="flex items-center gap-1"><Mail size={11} /> {appt.clientEmail}</span>}
                      {appt.service && <span className="text-gray-500">· {appt.service}</span>}
                    </div>
                    <div className="mt-1.5 text-xs text-gray-500">
                      {appt.assignedToName
                        ? <span className="text-violet-700">Attribué à <strong>{appt.assignedToName}</strong></span>
                        : <span className="italic text-gray-400">Non attribué</span>}
                      {appt.notes && <span className="ml-2">· {appt.notes}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {appt.status === 'pending' && (
                      <>
                        <button onClick={() => act(appt.id, 'confirm')} disabled={busy === appt.id + ':confirm'}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50">
                          {busy === appt.id + ':confirm' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Confirmer
                        </button>
                        <button onClick={() => openReject(appt)} disabled={busy === appt.id + ':reject'}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100 disabled:opacity-50">
                          <XCircle size={12} /> Refuser
                        </button>
                      </>
                    )}
                    <button onClick={() => setAssignTarget({ id: appt.id, clientName: appt.clientName })}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs hover:bg-violet-100">
                      <UserPlus size={12} /> Attribuer
                    </button>
                    <button onClick={() => openReschedule(appt)} disabled={busy === appt.id + ':reschedule'}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs hover:bg-blue-100 disabled:opacity-50">
                      <Clock size={12} /> Reprogrammer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Attribuer */}
      {assignTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAssignTarget(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-1">Attribuer à un employé</h3>
            <p className="text-xs text-gray-500 mb-4">Client: <strong>{assignTarget.clientName}</strong></p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun employé chargé. Vérifiez /admin/users.</p>
              ) : employees.map(emp => (
                <button key={emp.uid}
                  onClick={async () => {
                    await act(assignTarget.id, 'assign', {
                      assignedTo: emp.uid,
                      assignedToName: emp.displayName ?? emp.email ?? emp.uid,
                    });
                    setAssignTarget(null);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-semibold">
                    {(emp.displayName ?? emp.email ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.displayName ?? emp.email}</p>
                    {emp.email && emp.displayName && <p className="text-xs text-gray-500">{emp.email}</p>}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setAssignTarget(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modal Refuser */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRejectTarget(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-1">Refuser le RDV</h3>
            <p className="text-xs text-gray-500 mb-4">Client: <strong>{rejectTarget.clientName}</strong></p>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Raison (optionnelle)</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={3} autoFocus
              placeholder="Ex: Créneau plus disponible, fournisseur absent…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRejectTarget(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                Annuler
              </button>
              <button onClick={submitReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reprogrammer */}
      {rescheduleTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRescheduleTarget(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-1">Reprogrammer le RDV</h3>
            <p className="text-xs text-gray-500 mb-4">Client: <strong>{rescheduleTarget.clientName}</strong> · Actuellement {rescheduleTarget.date} à {rescheduleTarget.time}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nouvelle date</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nouvelle heure</label>
                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRescheduleTarget(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                Annuler
              </button>
              <button onClick={submitReschedule} disabled={!rescheduleDate || !rescheduleTime}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
