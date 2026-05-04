/**
 * SecurityIncidentsPage PRO — Full incident workflow with timeline, creation, status updates
 */
import React, { useEffect, useState } from 'react';
import { Plus, X, Loader2, AlertTriangle, Clock, User, ChevronDown, MessageSquare } from 'lucide-react';
import api from '@/services/api';

interface Incident { id: string; type: string; priority: string; status: string; description: string; assignee: string | null; source: string; affectedSystems: string[]; slaDeadline: string; createdAt: string; detectedAt: string }
interface TimelineEntry { id: string; action: string; status: string; user: string; details: string; timestamp: string }

const PRI_C: Record<string, string> = { P1_critical: 'bg-red-600 text-white', P2_high: 'bg-orange-500 text-white', P3_medium: 'bg-yellow-100 text-yellow-800', P4_low: 'bg-gray-100 text-gray-600' };
const STA_C: Record<string, string> = { detected: 'bg-red-100 text-red-700', investigating: 'bg-yellow-100 text-yellow-700', contained: 'bg-blue-100 text-blue-700', eradicated: 'bg-indigo-100 text-indigo-700', recovered: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-600', false_positive: 'bg-gray-100 text-gray-500', open: 'bg-red-100 text-red-700' };
const STATUSES = ['detected', 'investigating', 'contained', 'eradicated', 'recovered', 'closed', 'false_positive'];
const TYPES = ['intrusion', 'malware', 'phishing', 'data_breach', 'unauthorized_access', 'ddos', 'ransomware', 'insider_threat', 'misconfiguration', 'other'];

export default function SecurityIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ type: 'other', priority: 'P3_medium', description: '', affectedSystems: '' });
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/security/incidents').then(r => setIncidents((r.data as { data?: Incident[] })?.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const loadTimeline = async (id: string) => {
    setSelected(id);
    const r = await api.get(`/security/incidents/${id}/timeline`).catch(() => ({ data: { data: [] } }));
    setTimeline((r.data as { data?: TimelineEntry[] })?.data ?? []);
  };

  const handleCreate = async () => {
    if (!form.description) return;
    setSubmitting(true);
    await api.post('/security/incidents', { ...form, affectedSystems: form.affectedSystems.split(',').map(s => s.trim()).filter(Boolean) }).catch(() => {});
    setShowCreate(false); setForm({ type: 'other', priority: 'P3_medium', description: '', affectedSystems: '' });
    setSubmitting(false); load();
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/security/incidents/${id}`, { status, notes: note }).catch(() => {});
    setNote('');
    setIncidents(p => p.map(i => i.id === id ? { ...i, status } : i));
    if (selected === id) loadTimeline(id);
  };

  const filtered = incidents.filter(i => filter === 'all' || i.status === filter || (filter === 'open' && !['closed', 'recovered', 'false_positive'].includes(i.status)));

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Incidents de securite</h1><p className="text-sm text-gray-500">Workflow complet : detection → investigation → resolution</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}><Plus size={14} /> Declarer</button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {['all', 'open', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${filter === s ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s === 'all' ? 'Tous' : s === 'open' ? 'Ouverts' : s}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Incident list */}
          <div className="lg:col-span-3 space-y-2">
            {filtered.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucun incident.</div> : filtered.map(inc => (
              <div key={inc.id} onClick={() => loadTimeline(inc.id)}
                className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition-all hover:shadow-md ${selected === inc.id ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${PRI_C[inc.priority] ?? 'bg-gray-100 text-gray-600'}`}>{inc.priority.replace('_', ' ')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STA_C[inc.status] ?? 'bg-gray-100 text-gray-600'}`}>{inc.status}</span>
                  <span className="text-xs text-gray-400 ml-auto">{inc.type}</span>
                </div>
                <p className="text-sm text-gray-800 line-clamp-2">{inc.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={10} /> {inc.createdAt ? new Date(inc.createdAt).toLocaleDateString('fr-FR') : '—'}</span>
                  {inc.assignee && <span className="flex items-center gap-1"><User size={10} /> {inc.assignee}</span>}
                  {inc.source && <span>{inc.source}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sticky top-4">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><MessageSquare size={14} className="text-red-500" /> Timeline</h3>

                {/* Status update */}
                <div className="mb-4 p-3 bg-gray-50 rounded-xl space-y-2">
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notes (optionnel)..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" rows={2} />
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => updateStatus(selected, s)} className={`text-xs px-2 py-1 rounded-lg border ${STA_C[s] ?? 'bg-gray-100'} border-transparent hover:border-gray-300`}>{s}</button>
                    ))}
                  </div>
                </div>

                {/* Timeline entries */}
                <div className="space-y-0 relative">
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
                  {timeline.map((entry, i) => (
                    <div key={entry.id ?? i} className="relative pl-8 pb-4">
                      <div className={`absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${entry.status === 'detected' ? 'bg-red-500' : entry.status === 'closed' || entry.status === 'recovered' ? 'bg-green-500' : 'bg-blue-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{entry.action}</p>
                        {entry.details && <p className="text-xs text-gray-500 mt-0.5">{entry.details}</p>}
                        <p className="text-xs text-gray-400 mt-1">{entry.timestamp ? new Date(entry.timestamp).toLocaleString('fr-FR') : '—'} · {entry.user}</p>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && <p className="text-xs text-gray-400 pl-8">Aucune entree dans la timeline.</p>}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">Selectionnez un incident pour voir sa timeline</div>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Declarer un incident</h2><button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Priorite</label><select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"><option value="P1_critical">P1 Critical</option><option value="P2_high">P2 High</option><option value="P3_medium">P3 Medium</option><option value="P4_low">P4 Low</option></select></div>
              </div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Description *</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" rows={3} placeholder="Decrivez l'incident..." /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Systemes affectes</label><input value={form.affectedSystems} onChange={e => setForm({...form, affectedSystems: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Serveur web, BDD, VPN... (separes par ,)" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
              <button onClick={handleCreate} disabled={submitting || !form.description} className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>{submitting ? <Loader2 className="animate-spin" size={14} /> : 'Declarer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
