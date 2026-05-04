import { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, XCircle, Clock, Loader2, Phone, Mail, RefreshCw, Plus, Trash2, Users, Ban } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

type Status = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'rescheduled';
type ResType = 'table' | 'room' | 'hall' | 'vehicle' | 'other';

interface Reservation {
  id: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  resourceType: ResType;
  resourceName?: string;
  date: string;
  startTime: string;
  endTime?: string;
  guests?: number;
  status: Status;
  assignedToName?: string | null;
  sourceChannel?: string;
  notes?: string;
}

interface Resource {
  id: string;
  name: string;
  type: ResType;
  capacity?: number;
  notes?: string;
  active?: boolean;
}

const STATUS_META: Record<Status, { label: string; bg: string; text: string }> = {
  pending:    { label: 'En attente',   bg: 'bg-amber-100',  text: 'text-amber-700' },
  confirmed:  { label: 'Confirmé',     bg: 'bg-green-100',  text: 'text-green-700' },
  rejected:   { label: 'Refusé',       bg: 'bg-red-100',    text: 'text-red-700' },
  cancelled:  { label: 'Annulé',       bg: 'bg-gray-100',   text: 'text-gray-600' },
  rescheduled:{ label: 'Reprogrammé',  bg: 'bg-blue-100',   text: 'text-blue-700' },
};

const RES_LABEL: Record<ResType, string> = {
  table: 'Table', room: 'Chambre', hall: 'Salle', vehicle: 'Véhicule', other: 'Autre',
};

export default function ReservationsAdminPage() {
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager' || (user?.role as string) === 'reception' || user?.superAdmin;

  const [tab, setTab] = useState<'list' | 'resources'>('list');
  const [items, setItems] = useState<Reservation[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newRes, setNewRes] = useState<{ name: string; type: ResType; capacity: string }>({ name: '', type: 'table', capacity: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get<Reservation[]>('/reservations').catch(() => ({ data: [] })),
        api.get<Resource[]>('/reservations/resources').catch(() => ({ data: [] })),
      ]);
      const rawR = r1.data as unknown as Record<string, unknown>;
      const rawRes = r2.data as unknown as Record<string, unknown>;
      setItems(((rawR?.data ?? rawR ?? []) as Reservation[]) || []);
      setResources(((rawRes?.data ?? rawRes ?? []) as Resource[]) || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filter === 'all' ? items : items.filter(i => i.status === filter), [items, filter]);
  const counts = useMemo(() => {
    const base: Record<string, number> = { all: items.length, pending: 0, confirmed: 0, rejected: 0, cancelled: 0, rescheduled: 0 };
    items.forEach(i => { base[i.status] = (base[i.status] ?? 0) + 1; });
    return base;
  }, [items]);

  const act = async (id: string, action: string, payload: Record<string, unknown> = {}) => {
    setBusy(id + ':' + action); setFeedback(null);
    try {
      await api.patch(`/reservations/${id}`, { action, ...payload });
      setFeedback({ type: 'success', text: `Action "${action}" effectuée.` });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setBusy(null); }
  };

  const createResource = async () => {
    if (!newRes.name.trim()) return;
    try {
      await api.post('/reservations/resources', {
        name: newRes.name.trim(),
        type: newRes.type,
        capacity: newRes.capacity ? Number(newRes.capacity) : null,
      });
      setNewRes({ name: '', type: 'table', capacity: '' });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    }
  };

  const deleteResource = async (id: string) => {
    if (!confirm('Supprimer cette ressource ?')) return;
    try {
      await api.delete(`/reservations/resources/${id}`);
      load();
    } catch { /* ignore */ }
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
        <div className="p-2 rounded-xl bg-indigo-100"><Calendar size={24} className="text-indigo-600" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Réservations</h1>
          <p className="text-sm text-gray-500">Tables, chambres, salles, véhicules — gestion centrale</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('list')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'list' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}>
          Réservations
        </button>
        <button onClick={() => setTab('resources')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'resources' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}>
          Ressources ({resources.length})
        </button>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div className="flex items-center gap-2 overflow-x-auto">
            {(['pending', 'confirmed', 'rescheduled', 'rejected', 'cancelled', 'all'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                  filter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {s === 'all' ? 'Tous' : STATUS_META[s].label}
                <span className={`ml-1.5 ${filter === s ? 'text-white/80' : 'text-gray-400'}`}>({counts[s] ?? 0})</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
              Aucune réservation{filter !== 'all' ? ` avec le statut "${STATUS_META[filter as Status].label.toLowerCase()}"` : ''}.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => {
                const meta = STATUS_META[r.status] ?? STATUS_META.pending;
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-gray-900">{r.clientName}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>{meta.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">{RES_LABEL[r.resourceType]}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span className="flex items-center gap-1"><Clock size={11} /> {r.date} {r.startTime}{r.endTime ? ` → ${r.endTime}` : ''}</span>
                          {r.resourceName && <span>· {r.resourceName}</span>}
                          {r.guests && <span className="flex items-center gap-1"><Users size={11} /> {r.guests}</span>}
                          {r.clientPhone && <span className="flex items-center gap-1"><Phone size={11} /> {r.clientPhone}</span>}
                          {r.clientEmail && <span className="flex items-center gap-1"><Mail size={11} /> {r.clientEmail}</span>}
                        </div>
                        {r.notes && <p className="text-xs text-gray-500 mt-1">{r.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {r.status === 'pending' && (
                          <>
                            <button onClick={() => act(r.id, 'confirm')} disabled={busy === r.id + ':confirm'}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50">
                              {busy === r.id + ':confirm' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Confirmer
                            </button>
                            <button onClick={() => {
                              const reason = prompt('Raison du refus ?') ?? '';
                              act(r.id, 'reject', { reason });
                            }}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100">
                              <XCircle size={12} /> Refuser
                            </button>
                          </>
                        )}
                        {r.status !== 'cancelled' && r.status !== 'rejected' && (
                          <button onClick={() => {
                            const reason = prompt('Raison de l\'annulation ?') ?? '';
                            act(r.id, 'cancel', { reason });
                          }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                            <Ban size={12} /> Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'resources' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Ajouter une ressource</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input type="text" placeholder="Nom (ex: Table 3, Suite 101)" value={newRes.name}
                onChange={e => setNewRes(r => ({ ...r, name: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <select value={newRes.type} onChange={e => setNewRes(r => ({ ...r, type: e.target.value as ResType }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="table">Table (resto)</option>
                <option value="room">Chambre (hôtel)</option>
                <option value="hall">Salle événement</option>
                <option value="vehicle">Véhicule</option>
                <option value="other">Autre</option>
              </select>
              <input type="number" placeholder="Capacité" value={newRes.capacity}
                onChange={e => setNewRes(r => ({ ...r, capacity: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <button onClick={createResource} disabled={!newRes.name.trim()}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                <Plus size={14} /> Ajouter
              </button>
            </div>
          </div>

          {resources.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
              Aucune ressource. Ajoute au moins une table / chambre / salle pour que le Clone puisse prendre des réservations.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resources.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                    {RES_LABEL[r.type].slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-500">
                      {RES_LABEL[r.type]}{r.capacity ? ` · ${r.capacity} pers.` : ''}{r.active === false ? ' · inactive' : ''}
                    </p>
                  </div>
                  <button onClick={() => deleteResource(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
