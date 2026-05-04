/**
 * IT Licenses PRO — Expiration alerts, cost/seat, create, manage
 */
import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, X, Key, AlertTriangle, DollarSign } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useCurrency } from '@/hooks/useCurrency';

interface License {
  id: string; name: string; vendor: string; seats: number; usedSeats: number;
  costPerSeat: number; totalCost: number; expiresAt: string; key: string; createdAt: string;
}

export default function ITLicensesPage() {
  const { t } = useLangStore();
  const { symbol } = useCurrency();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', vendor: '', seats: 1, usedSeats: 0, costPerSeat: 0, totalCost: 0, expiresAt: '', key: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => { setLoading(true); api.get<License[]>('/it/licenses').then(r => setLicenses(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name) return; setSubmitting(true);
    const totalCost = form.totalCost || form.costPerSeat * form.seats;
    try { await api.post('/it/licenses', { ...form, totalCost }); setShowCreate(false); setForm({ name: '', vendor: '', seats: 1, usedSeats: 0, costPerSeat: 0, totalCost: 0, expiresAt: '', key: '' }); load(); } catch {} finally { setSubmitting(false); }
  };
  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; await api.delete(`/it/licenses/${id}`).catch(() => {}); setLicenses(p => p.filter(l => l.id !== id)); };

  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 86400000);
  const totalCost = licenses.reduce((s, l) => s + (l.totalCost ?? 0), 0);
  const totalSeats = licenses.reduce((s, l) => s + (l.seats ?? 0), 0);
  const usedSeats = licenses.reduce((s, l) => s + (l.usedSeats ?? 0), 0);
  const expiring = licenses.filter(l => l.expiresAt && new Date(l.expiresAt) < soon).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licences</h1>
          <p className="text-sm text-gray-500">
            {licenses.length} licence{licenses.length > 1 ? 's' : ''} · {symbol}{totalCost.toLocaleString()} total · {usedSeats}/{totalSeats} sieges
            {expiring > 0 && <span className="text-orange-500 ml-2">{expiring} expire{expiring > 1 ? 'nt' : ''} bientot</span>}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}><Plus size={14} /> Nouvelle licence</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      : licenses.length === 0 ? <div className="text-center py-12 text-sm text-gray-400">Aucune licence.</div>
      : (
        <div className="space-y-2">
          {licenses.map(lic => {
            const expired = lic.expiresAt && new Date(lic.expiresAt) < now;
            const expiringSoon = lic.expiresAt && !expired && new Date(lic.expiresAt) < soon;
            const seatPct = lic.seats > 0 ? Math.round((lic.usedSeats / lic.seats) * 100) : 0;
            return (
              <div key={lic.id} className={`bg-white rounded-xl border shadow-sm p-4 ${expired ? 'border-red-200' : expiringSoon ? 'border-orange-200' : 'border-gray-100'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${expired ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600'}`}><Key size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{lic.name}</span>
                      <span className="text-xs text-gray-400">{lic.vendor}</span>
                      {expired && <span className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle size={10} /> Expiree</span>}
                      {expiringSoon && <span className="flex items-center gap-1 text-xs text-orange-500"><AlertTriangle size={10} /> Expire bientot</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><DollarSign size={10} /> {symbol}{(lic.totalCost ?? 0).toLocaleString()}{lic.costPerSeat > 0 ? ` (${symbol}${lic.costPerSeat}/siege)` : ''}</span>
                      <span>Sieges: {lic.usedSeats}/{lic.seats} ({seatPct}%)</span>
                      {lic.expiresAt && <span>Expire: {new Date(lic.expiresAt).toLocaleDateString('fr-FR')}</span>}
                    </div>
                    {/* Seat usage bar */}
                    <div className="w-32 bg-gray-100 rounded-full h-1.5 mt-1.5">
                      <div className={`h-1.5 rounded-full ${seatPct >= 90 ? 'bg-red-500' : seatPct >= 70 ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, seatPct)}%` }} />
                    </div>
                  </div>
                  <button onClick={() => handleDelete(lic.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Nouvelle licence</h2><button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Editeur</label><input value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Sieges</label><input type="number" value={form.seats} onChange={e => setForm({...form, seats: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Utilises</label><input type="number" value={form.usedSeats} onChange={e => setForm({...form, usedSeats: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cout/siege</label><input type="number" value={form.costPerSeat} onChange={e => setForm({...form, costPerSeat: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Expiration</label><input type="date" value={form.expiresAt} onChange={e => setForm({...form, expiresAt: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Cle licence</label><input value={form.key} onChange={e => setForm({...form, key: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono" /></div>
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
