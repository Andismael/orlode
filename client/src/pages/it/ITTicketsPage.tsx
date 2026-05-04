/**
 * IT Tickets PRO — SLA badges, priority, category, create, filters
 */
import { useEffect, useState } from 'react';
import { Plus, Search, Loader2, Trash2, X, Ticket, Flame, Clock } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface ITTicket {
  id: string; ticketNumber: string; title: string; description: string;
  status: string; priority: string; category: string;
  assignedTo: string; reportedBy: string;
  slaResolutionDeadline: string; createdAt: string;
}

const STATUS_S: Record<string, { l: string; s: string }> = {
  open: { l: 'Ouvert', s: 'bg-blue-100 text-blue-700' }, assigned: { l: 'Assigne', s: 'bg-purple-100 text-purple-700' },
  in_progress: { l: 'En cours', s: 'bg-yellow-100 text-yellow-700' }, waiting_user: { l: 'Attente user', s: 'bg-orange-100 text-orange-700' },
  escalated: { l: 'Escalade', s: 'bg-red-100 text-red-700' }, resolved: { l: 'Resolu', s: 'bg-green-100 text-green-700' }, closed: { l: 'Ferme', s: 'bg-gray-100 text-gray-500' },
};
const PRIO_S: Record<string, { l: string; s: string }> = {
  critical: { l: 'Critique', s: 'bg-red-100 text-red-700' }, high: { l: 'Haute', s: 'bg-orange-100 text-orange-700' },
  medium: { l: 'Moyenne', s: 'bg-blue-100 text-blue-700' }, low: { l: 'Basse', s: 'bg-gray-100 text-gray-500' },
};
const CATS = ['hardware', 'software', 'access', 'network', 'email', 'security', 'other'];

export default function ITTicketsPage() {
  const { t } = useLangStore();
  const [tickets, setTickets] = useState<ITTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', category: 'other' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => { setLoading(true); api.get<ITTicket[]>('/it/tickets').then(r => setTickets(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.title) return; setSubmitting(true);
    try { await api.post('/it/tickets', form); setShowCreate(false); setForm({ title: '', description: '', priority: 'medium', category: 'other' }); load(); } catch {} finally { setSubmitting(false); }
  };
  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; await api.delete(`/it/tickets/${id}`).catch(() => {}); setTickets(p => p.filter(t => t.id !== id)); };
  const handleAutoAssign = async (id: string) => { await api.post(`/it/tickets/${id}/auto-assign`).catch(() => {}); load(); };

  let filtered = tickets;
  if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter);
  if (search) filtered = filtered.filter(t => `${t.title} ${t.ticketNumber} ${t.reportedBy}`.toLowerCase().includes(search.toLowerCase()));
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Tickets IT</h1><p className="text-sm text-gray-500">{tickets.length} ticket{tickets.length > 1 ? 's' : ''}</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}><Plus size={14} /> Nouveau ticket</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {['all', 'open', 'in_progress', 'escalated', 'resolved'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-xs rounded-lg ${statusFilter === s ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500'}`}>
              {s === 'all' ? 'Tous' : STATUS_S[s]?.l ?? s}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      : filtered.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucun ticket.</div>
      : (
        <div className="space-y-2">
          {filtered.map(tk => {
            const st = STATUS_S[tk.status] ?? { l: tk.status, s: 'bg-gray-100 text-gray-600' };
            const pr = PRIO_S[tk.priority] ?? { l: tk.priority, s: 'bg-gray-100 text-gray-600' };
            const breach = tk.slaResolutionDeadline && new Date(tk.slaResolutionDeadline) < new Date() && tk.status !== 'resolved' && tk.status !== 'closed';
            return (
              <div key={tk.id} className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3 ${breach ? 'border-red-200' : 'border-gray-100'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${breach ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-600'}`}><Ticket size={16} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">{tk.ticketNumber}</span>
                    <span className="text-sm font-semibold text-gray-900">{tk.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.s}`}>{st.l}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pr.s}`}>{pr.l}</span>
                    {breach && <span className="flex items-center gap-1 text-xs text-red-500"><Flame size={10} /> SLA</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{tk.category} · {tk.reportedBy ?? '—'}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{new Date(tk.createdAt).toLocaleDateString('fr-FR')}</span>
                {!tk.assignedTo && tk.status === 'open' && (
                  <button onClick={e => { e.stopPropagation(); handleAutoAssign(tk.id); }} className="px-2 py-1 text-xs border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-50">Assigner</button>
                )}
                <button onClick={() => handleDelete(tk.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Nouveau ticket IT</h2><button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Sujet *</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm h-20 resize-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Priorite</label><select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"><option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option></select></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Categorie</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
              <button onClick={handleCreate} disabled={submitting || !form.title} className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>{submitting ? <Loader2 className="animate-spin" size={14} /> : 'Creer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
