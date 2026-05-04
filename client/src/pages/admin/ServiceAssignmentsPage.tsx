import { useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, Loader2, CheckCircle2, XCircle, Save } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface Employee { uid: string; displayName?: string; email?: string; role?: string; }
interface Mapping { service: string; userId: string; displayName: string; }

export default function ServiceAssignmentsPage() {
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === 'admin' || user?.role === 'manager' || user?.superAdmin;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newEntry, setNewEntry] = useState({ service: '', userId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get<Employee[]>('/team').catch(() => ({ data: [] })),
        api.get('/company').catch(() => ({ data: {} })),
      ]);
      const rawEmp = r1.data as unknown as Record<string, unknown>;
      // /api/team returns { success, data: { team, members: [...] } }
      const payload = (rawEmp?.data ?? rawEmp) as Record<string, unknown>;
      const list = (payload?.['members'] as Employee[]) ?? (Array.isArray(payload) ? (payload as unknown as Employee[]) : []);
      setEmployees(Array.isArray(list) ? list : []);
      const rawCo = r2.data as unknown as Record<string, unknown>;
      const company = (rawCo?.data ?? rawCo) as Record<string, unknown>;
      const settings = (company?.['settings'] ?? {}) as Record<string, unknown>;
      const map = (settings['serviceAssignments'] ?? {}) as Record<string, { userId: string; displayName: string }>;
      setMappings(Object.entries(map).map(([service, v]) => ({ service, userId: v.userId, displayName: v.displayName })));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addEntry = () => {
    if (!newEntry.service.trim() || !newEntry.userId) return;
    const emp = employees.find(e => e.uid === newEntry.userId);
    if (!emp) return;
    const displayName = emp.displayName ?? emp.email ?? emp.uid;
    // If service already mapped, update it; otherwise add
    setMappings(prev => {
      const filtered = prev.filter(m => m.service.toLowerCase() !== newEntry.service.toLowerCase());
      return [...filtered, { service: newEntry.service.trim(), userId: newEntry.userId, displayName }];
    });
    setNewEntry({ service: '', userId: '' });
  };

  const removeEntry = (service: string) => {
    setMappings(prev => prev.filter(m => m.service !== service));
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const asMap: Record<string, { userId: string; displayName: string }> = {};
      for (const m of mappings) asMap[m.service] = { userId: m.userId, displayName: m.displayName };
      await api.patch('/company', { settings: { serviceAssignments: asMap } });
      setFeedback({ type: 'success', text: 'Attributions enregistrées.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Erreur' });
    } finally { setSaving(false); }
  };

  if (!canManage) return <div className="p-8 text-center text-sm text-gray-600">Réservé aux admins/managers.</div>;
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-violet-100"><UserCog size={24} className="text-violet-600" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Attribution auto par service</h1>
          <p className="text-sm text-gray-500">
            Quand le Clone prend un RDV, il assigne automatiquement à l'employé configuré pour ce service.
          </p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
        </button>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Plus size={16} /> Nouvelle attribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input type="text" placeholder="Nom du service (ex: Coupe homme)"
            value={newEntry.service} onChange={e => setNewEntry(s => ({ ...s, service: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <select value={newEntry.userId} onChange={e => setNewEntry(s => ({ ...s, userId: e.target.value }))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Choisir un employé...</option>
            {employees.map(e => (
              <option key={e.uid} value={e.uid}>{e.displayName ?? e.email}</option>
            ))}
          </select>
          <button onClick={addEntry} disabled={!newEntry.service.trim() || !newEntry.userId}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50">
            <Plus size={14} /> Ajouter
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 Astuce: le matching est insensible à la casse et gère les variantes
          (ex: "coupe homme" match aussi "Coupe Homme Express").
        </p>
      </div>

      {mappings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          Aucune attribution configurée. Ajoute au moins un service pour activer l'auto-assignment.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Service</th>
                <th className="px-4 py-2.5 text-left font-semibold">Employé</th>
                <th className="px-4 py-2.5 text-right font-semibold w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map(m => (
                <tr key={m.service} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.service}</td>
                  <td className="px-4 py-3 text-gray-700">{m.displayName}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeEntry(m.service)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        ℹ️ L'employé attribué reçoit une notification et voit le RDV dans son calendrier personnel (`/calendar`).
        Si aucune attribution ne correspond, le RDV reste non-attribué — la réception pourra l'assigner manuellement.
      </p>
    </div>
  );
}
