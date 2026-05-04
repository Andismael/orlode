/**
 * IT Assets PRO — Inventory, warranty alerts, assignment, valuation
 */
import { useEffect, useState } from 'react';
import { Plus, Search, Loader2, Trash2, X, Package, AlertTriangle, Shield } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useCurrency } from '@/hooks/useCurrency';

interface Asset {
  id: string; name: string; type: string; brand: string; model: string;
  serialNumber: string; status: string; assignedTo: string; location: string;
  value: number; purchaseDate: string; warrantyExpiry: string; createdAt: string;
}

const STATUS_S: Record<string, { l: string; s: string }> = {
  active: { l: 'Actif', s: 'bg-green-100 text-green-700' }, stock: { l: 'Stock', s: 'bg-blue-100 text-blue-700' },
  repair: { l: 'Reparation', s: 'bg-orange-100 text-orange-700' }, retired: { l: 'Retire', s: 'bg-gray-100 text-gray-500' },
};
const TYPES = ['laptop', 'desktop', 'phone', 'tablet', 'monitor', 'printer', 'server', 'network', 'other'];

export default function ITAssetsPage() {
  const { t } = useLangStore();
  const { symbol } = useCurrency();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'laptop', brand: '', model: '', serialNumber: '', status: 'stock', assignedTo: '', location: '', value: 0, warrantyExpiry: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => { setLoading(true); api.get<Asset[]>('/it/assets').then(r => setAssets(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name) return; setSubmitting(true);
    try { await api.post('/it/assets', form); setShowCreate(false); setForm({ name: '', type: 'laptop', brand: '', model: '', serialNumber: '', status: 'stock', assignedTo: '', location: '', value: 0, warrantyExpiry: '' }); load(); } catch {} finally { setSubmitting(false); }
  };
  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; await api.delete(`/it/assets/${id}`).catch(() => {}); setAssets(p => p.filter(a => a.id !== id)); };

  let filtered = assets;
  if (typeFilter) filtered = filtered.filter(a => a.type === typeFilter);
  if (search) filtered = filtered.filter(a => `${a.name} ${a.brand} ${a.serialNumber} ${a.assignedTo}`.toLowerCase().includes(search.toLowerCase()));
  const totalValue = filtered.reduce((s, a) => s + (a.value ?? 0), 0);
  const warrantyExpired = filtered.filter(a => a.warrantyExpiry && new Date(a.warrantyExpiry) < new Date()).length;

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assets IT</h1>
          <p className="text-sm text-gray-500">{assets.length} asset{assets.length > 1 ? 's' : ''} · Valeur: {symbol}{totalValue.toLocaleString()}
            {warrantyExpired > 0 && <span className="text-red-500 ml-2">{warrantyExpired} garantie{warrantyExpired > 1 ? 's' : ''} exp.</span>}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}><Plus size={14} /> Nouvel asset</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
          <option value="">Tous types</option>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      : filtered.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucun asset.</div>
      : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Asset</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Assigne a</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Garantie</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Valeur</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map(a => {
                const st = STATUS_S[a.status] ?? { l: a.status, s: 'bg-gray-100 text-gray-600' };
                const warExp = a.warrantyExpiry && new Date(a.warrantyExpiry) < new Date();
                return (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3"><p className="font-semibold text-gray-900">{a.name}</p><p className="text-xs text-gray-400">{a.brand} {a.model}{a.serialNumber ? ` · ${a.serialNumber}` : ''}</p></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.type}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.s}`}>{st.l}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.assignedTo || '—'}</td>
                    <td className="px-4 py-3">
                      {a.warrantyExpiry ? (
                        <span className={`flex items-center gap-1 text-xs ${warExp ? 'text-red-500' : 'text-green-600'}`}>
                          {warExp ? <AlertTriangle size={10} /> : <Shield size={10} />}
                          {new Date(a.warrantyExpiry).toLocaleDateString('fr-FR')}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{a.value > 0 ? `${symbol}${a.value.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => handleDelete(a.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Nouvel asset</h2><button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Type</label><select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Marque</label><input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Modele</label><input value={form.model} onChange={e => setForm({...form, model: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">N. serie</label><input value={form.serialNumber} onChange={e => setForm({...form, serialNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Statut</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"><option value="stock">Stock</option><option value="active">Actif</option><option value="repair">Reparation</option><option value="retired">Retire</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Assigne a</label><input value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Localisation</label><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Valeur ({symbol})</label><input type="number" value={form.value} onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Fin garantie</label><input type="date" value={form.warrantyExpiry} onChange={e => setForm({...form, warrantyExpiry: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
              <button onClick={handleCreate} disabled={submitting || !form.name} className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>{submitting ? <Loader2 className="animate-spin" size={14} /> : 'Creer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
