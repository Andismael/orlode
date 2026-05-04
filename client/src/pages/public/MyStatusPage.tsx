import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Calendar, ShoppingCart, FileText, Loader2, CheckCircle2, XCircle, Clock, Ban, Download } from 'lucide-react';

const publicApi = axios.create({ baseURL: '/api', timeout: 20000 });

interface CompanyInfo { name: string; phone?: string; email?: string; logoUrl?: string; }
interface Appointment { id: string; clientName: string; service?: string; date: string; time: string; status: string; assignedToName?: string | null; }
interface Reservation { id: string; clientName: string; resourceType: string; resourceName?: string; date: string; startTime: string; endTime?: string; guests?: number; status: string; }
interface OrderItem { name: string; quantity: number; unitPrice: number; }
interface Order { id: string; subtotal: number; currency: string; items: OrderItem[]; status: string; paymentUrl?: string; clientEmail?: string; }

interface Data {
  company: CompanyInfo;
  me: { type: 'email' | 'phone'; id: string };
  appointments: Appointment[];
  reservations: Reservation[];
  orders: Order[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  pending_payment: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  paid: 'bg-green-100 text-green-700',
  fulfilled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
  rescheduled: 'bg-blue-100 text-blue-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  pending_payment: 'Attente paiement',
  confirmed: 'Confirmé',
  paid: 'Payée',
  fulfilled: 'Livrée',
  cancelled: 'Annulé',
  rejected: 'Refusé',
  rescheduled: 'Reprogrammé',
};

export default function MyStatusPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!token) { setError('Lien invalide.'); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await publicApi.get(`/my-status?token=${encodeURIComponent(token)}`);
      const raw = r.data as unknown as Record<string, unknown>;
      setData(((raw?.data ?? raw) as Data));
      setError(null);
    } catch (err) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Lien invalide ou expiré.')
        : 'Lien invalide ou expiré.';
      setError(msg);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const cancel = async (kind: 'appointment' | 'reservation' | 'order', id: string) => {
    if (!token) return;
    if (!confirm('Confirmer l\'annulation ?')) return;
    setBusy(id);
    try {
      const path = kind === 'appointment' ? 'cancel-appointment' : kind === 'reservation' ? 'cancel-reservation' : 'cancel-order';
      const body = kind === 'appointment' ? { appointmentId: id } : kind === 'reservation' ? { reservationId: id } : { orderId: id };
      await publicApi.post(`/my-status/${path}?token=${encodeURIComponent(token)}`, body);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    } finally { setBusy(null); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <XCircle size={48} className="mx-auto text-red-400 mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">Lien invalide</h1>
        <p className="text-sm text-gray-600">{error ?? 'Ce lien n\'est plus valide. Demandez-en un nouveau à l\'entreprise.'}</p>
      </div>
    </div>
  );

  const hasItems = data.appointments.length + data.reservations.length + data.orders.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          {data.company.logoUrl && <img src={data.company.logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
          <div>
            <h1 className="text-lg font-bold text-gray-900">{data.company.name}</h1>
            <p className="text-xs text-gray-500">Espace client</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {!hasItems && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-500">Aucun rendez-vous, réservation ou commande pour le moment.</p>
          </div>
        )}

        {data.appointments.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><Calendar size={16} /> Mes rendez-vous</h2>
            <div className="space-y-2">
              {data.appointments.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{a.service ?? 'Rendez-vous'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status] ?? 'bg-gray-100'}`}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <Clock size={11} /> {a.date} à {a.time}
                      {a.assignedToName && <span>· avec {a.assignedToName}</span>}
                    </p>
                  </div>
                  {!['cancelled', 'rejected', 'fulfilled'].includes(a.status) && (
                    <button onClick={() => cancel('appointment', a.id)} disabled={busy === a.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 disabled:opacity-50">
                      {busy === a.id ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Annuler
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.reservations.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><Calendar size={16} /> Mes réservations</h2>
            <div className="space-y-2">
              {data.reservations.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{r.resourceName ?? r.resourceType}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100'}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <Clock size={11} /> {r.date} à {r.startTime}
                      {r.endTime && ` → ${r.endTime}`}
                      {r.guests && ` · ${r.guests} personnes`}
                    </p>
                  </div>
                  {!['cancelled', 'rejected', 'fulfilled'].includes(r.status) && (
                    <button onClick={() => cancel('reservation', r.id)} disabled={busy === r.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 disabled:opacity-50">
                      {busy === r.id ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Annuler
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {data.orders.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><ShoppingCart size={16} /> Mes commandes</h2>
            <div className="space-y-2">
              {data.orders.map(o => (
                <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{o.subtotal.toLocaleString()} {o.currency}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? 'bg-gray-100'}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        {o.items.map((it, i) => (
                          <div key={i}>{it.quantity} × {it.name}</div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {(o.status === 'paid' || o.status === 'fulfilled') && o.clientEmail && (
                        <a href={`/api/orders/${o.id}/invoice.pdf?companyId=${encodeURIComponent(data.me.type === 'phone' ? '' : data.me.id && '')}&email=${encodeURIComponent(o.clientEmail)}`}
                          target="_blank" rel="noopener"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs hover:bg-violet-100 whitespace-nowrap">
                          <Download size={12} /> Facture
                        </a>
                      )}
                      {o.status === 'pending_payment' && o.paymentUrl && (
                        <a href={o.paymentUrl} target="_blank" rel="noopener"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 whitespace-nowrap">
                          <CheckCircle2 size={12} /> Payer
                        </a>
                      )}
                      {o.status === 'pending_payment' && (
                        <button onClick={() => cancel('order', o.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 whitespace-nowrap">
                          <Ban size={12} /> Annuler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          Besoin d'aide ? Contactez {data.company.name}{data.company.phone ? ` au ${data.company.phone}` : ''}
          {data.company.email ? ` ou par email: ${data.company.email}` : ''}.
        </p>
      </div>
    </div>
  );
}
