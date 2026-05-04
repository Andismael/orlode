import { useEffect, useState, useMemo } from 'react';
import { Loader2, DollarSign, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';

interface Payment {
  id: string; type: string; companyId: string; planId?: string; agentId?: string;
  agentName?: string; amountUSD: number; amountXOF?: number; method: string;
  paymentMethod?: string; status: string; userNote?: string | null;
  createdAt: { _seconds?: number } | string;
}

type FilterTab = 'all' | 'pending' | 'completed' | 'failed';

export default function PaymentsPage() {
  const { formatShort } = useCurrency();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('pending');
  const [flash, setFlash] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.get('/superadmin/payments');
      const raw = r.data as Record<string, unknown>;
      setPayments((raw?.payments ?? []) as Payment[]);
      setTotalRevenue((raw?.totalRevenue as number) ?? 0);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const confirmManual = async (paymentId: string) => {
    setActingOn(paymentId);
    try {
      await api.post('/subscription/confirm-manual', { paymentId });
      setFlash({ tone: 'ok', text: 'Paiement confirmé. Plan activé.' });
      await refresh();
    } catch {
      setFlash({ tone: 'err', text: 'Erreur lors de la confirmation' });
    } finally { setActingOn(null); }
  };

  const rejectManual = async (paymentId: string) => {
    if (!confirm('Rejeter ce paiement ? L\'entreprise ne sera pas activée.')) return;
    setActingOn(paymentId);
    try {
      await api.post('/superadmin/payments/reject', { paymentId });
      setFlash({ tone: 'ok', text: 'Paiement rejeté.' });
      await refresh();
    } catch {
      setFlash({ tone: 'err', text: 'Erreur lors du rejet' });
    } finally { setActingOn(null); }
  };

  const STATUS_COLOR: Record<string, string> = {
    completed:              'bg-green-100 text-green-700',
    pending:                'bg-yellow-100 text-yellow-700',
    awaiting_confirmation:  'bg-orange-100 text-orange-700',
    pending_review:         'bg-orange-100 text-orange-700',
    failed:                 'bg-red-100 text-red-700',
    canceled:               'bg-gray-100 text-gray-600',
  };

  const counts = useMemo(() => {
    const pending = payments.filter(p => p.status === 'awaiting_confirmation' || p.status === 'pending' || p.status === 'pending_review').length;
    const completed = payments.filter(p => p.status === 'completed').length;
    const failed = payments.filter(p => p.status === 'failed' || p.status === 'canceled').length;
    return { pending, completed, failed, all: payments.length };
  }, [payments]);

  const filtered = useMemo(() => {
    if (tab === 'all') return payments;
    if (tab === 'pending') return payments.filter(p => p.status === 'awaiting_confirmation' || p.status === 'pending' || p.status === 'pending_review');
    if (tab === 'completed') return payments.filter(p => p.status === 'completed');
    return payments.filter(p => p.status === 'failed' || p.status === 'canceled');
  }, [payments, tab]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;

  const subRevenue = payments.filter(p => p.type === 'subscription' && p.status === 'completed').reduce((s, p) => s + (p.amountUSD ?? 0), 0);
  const mkRevenue = payments.filter(p => p.type === 'marketplace' && p.status === 'completed').reduce((s, p) => s + (p.amountUSD ?? 0), 0);

  const isPendingManual = (p: Payment) =>
    (p.status === 'awaiting_confirmation' || p.status === 'pending') && (p.method === 'manual' || p.method === 'wave' || p.method === 'wave_manual');

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        {counts.pending > 0 && (
          <span className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
            <Clock size={12} /> {counts.pending} en attente
          </span>
        )}
      </div>

      {flash && (
        <div className={`p-3 rounded-xl text-sm ${flash.tone === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {flash.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-violet-500 to-blue-500 rounded-xl p-4 text-white">
          <DollarSign size={18} className="opacity-60 mb-1" />
          <p className="text-2xl font-bold">{formatShort(totalRevenue)}</p>
          <p className="text-xs opacity-70">Revenue total</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{formatShort(subRevenue)}</p>
          <p className="text-xs text-gray-500">Abonnements</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-violet-600">{formatShort(mkRevenue)}</p>
          <p className="text-xs text-gray-500">Marketplace</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {([
          { id: 'pending', label: 'En attente', count: counts.pending },
          { id: 'completed', label: 'Confirmés', count: counts.completed },
          { id: 'failed', label: 'Échoués', count: counts.failed },
          { id: 'all', label: 'Tous', count: counts.all },
        ] as Array<{ id: FilterTab; label: string; count: number }>).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 flex items-center gap-2 transition-all ${
              tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label} <span className="text-xs text-gray-400">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Détail</th>
              <th className="px-4 py-3 text-left">Montant</th>
              <th className="px-4 py-3 text-left">Méthode</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 80).map(p => (
              <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.type === 'subscription' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                    {p.type === 'subscription' ? 'PLAN' : 'AGENT'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <div>{p.planId ? `Plan ${p.planId}` : p.agentName ?? p.agentId ?? '—'}</div>
                  <div className="text-xs text-gray-400 font-mono">{p.companyId?.slice(0, 12)} · #{p.id.slice(0, 8)}</div>
                  {p.userNote && <div className="text-xs text-gray-500 mt-1 italic">"{p.userNote}"</div>}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {formatShort(p.amountUSD ?? 0)}
                  {p.amountXOF && <div className="text-xs text-gray-400">{p.amountXOF.toLocaleString()} FCFA</div>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  <div className="capitalize">{p.method ?? '—'}</div>
                  {p.paymentMethod && <div className="text-gray-400">{p.paymentMethod.replace('_', ' ')}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  {isPendingManual(p) ? (
                    <div className="flex gap-1">
                      <button onClick={() => confirmManual(p.id)} disabled={actingOn === p.id}
                        className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded flex items-center gap-1 disabled:opacity-50">
                        {actingOn === p.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Confirmer
                      </button>
                      <button onClick={() => rejectManual(p.id)} disabled={actingOn === p.id}
                        className="px-2.5 py-1 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded flex items-center gap-1 disabled:opacity-50">
                        <XCircle size={10} /> Rejeter
                      </button>
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Aucun paiement dans cette catégorie</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
