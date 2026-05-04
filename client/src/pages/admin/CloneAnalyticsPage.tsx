import { useEffect, useState } from 'react';
import { TrendingUp, Calendar, Coffee, ShoppingCart, Users, FileText, MessageCircle, Send, Globe, Mail, Mic, Loader2 } from 'lucide-react';
import api from '@/services/api';

interface Summary {
  rangeDays: number;
  since: string;
  totals: { appointments: number; reservations: number; leads: number; quoteRequests: number; orders: number };
  byChannel: Record<keyof Summary['totals'], Record<string, number>>;
  cloneCaptured: { appointments: number; reservations: number; leads: number; quoteRequests: number; orders: number };
  revenue: { paidRevenue: number; paidCount: number; currency: string };
}

const CHANNEL_META: Record<string, { label: string; icon: typeof MessageCircle }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  telegram: { label: 'Telegram', icon: Send },
  voice:    { label: 'Voice',    icon: Mic },
  web:      { label: 'Web',      icon: Globe },
  email:    { label: 'Email',    icon: Mail },
  unknown:  { label: 'Autre',    icon: Globe },
};

export default function CloneAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (d: number) => {
    setLoading(true);
    try {
      const r = await api.get<Summary>(`/clone-analytics/summary?days=${d}`);
      const raw = r.data as unknown as Record<string, unknown>;
      setData(((raw?.data ?? raw) as Summary));
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(days); }, [days]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
  if (!data) return <div className="p-8 text-center text-sm text-gray-500">Impossible de charger les statistiques.</div>;

  const total = data.totals.appointments + data.totals.reservations + data.totals.leads + data.totals.quoteRequests + data.totals.orders;
  const cloneTotal = data.cloneCaptured.appointments + data.cloneCaptured.reservations + data.cloneCaptured.leads + data.cloneCaptured.quoteRequests + data.cloneCaptured.orders;
  const clonePct = total > 0 ? Math.round((cloneTotal / total) * 100) : 0;

  const StatCard = ({ title, value, icon: Icon, captured, color }: { title: string; value: number; icon: typeof TrendingUp; captured: number; color: string }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 uppercase font-semibold">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
      <p className="text-xs text-violet-600 mt-2">
        🧠 {captured} captés par le Clone ({value > 0 ? Math.round((captured / value) * 100) : 0}%)
      </p>
    </div>
  );

  const ChannelRow = ({ title, data: chData }: { title: string; data: Record<string, number> }) => {
    const total = Object.values(chData).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-800 mb-3">{title} — par canal</p>
        <div className="space-y-2">
          {Object.entries(chData).map(([ch, n]) => {
            const meta = CHANNEL_META[ch] ?? CHANNEL_META.unknown;
            const pct = total > 0 ? (n / total) * 100 : 0;
            const Icon = meta.icon;
            return (
              <div key={ch} className="flex items-center gap-3">
                <Icon size={14} className="text-gray-400 shrink-0" />
                <div className="text-xs text-gray-600 w-20 shrink-0">{meta.label}</div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-gray-600 w-10 text-right tabular-nums">{n}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-violet-100"><TrendingUp size={24} className="text-violet-600" /></div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Analytics Clone</h1>
          <p className="text-sm text-gray-500">Ce que ton Clone a capté ces derniers {days} jours</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value={7}>7 jours</option>
          <option value={30}>30 jours</option>
          <option value={90}>90 jours</option>
          <option value={365}>1 an</option>
        </select>
      </div>

      <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl">🧠</div>
          <div>
            <p className="text-sm opacity-80">Captures totales du Clone</p>
            <p className="text-3xl font-bold">{cloneTotal}</p>
            <p className="text-xs opacity-75 mt-1">
              {clonePct}% de toute l'activité ({total} au total sur {days}j)
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm opacity-80">Revenu généré</p>
            <p className="text-2xl font-bold">{data.revenue.paidRevenue.toLocaleString()} {data.revenue.currency}</p>
            <p className="text-xs opacity-75">{data.revenue.paidCount} commandes payées</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard title="Rendez-vous" value={data.totals.appointments} icon={Calendar} captured={data.cloneCaptured.appointments} color="bg-blue-500" />
        <StatCard title="Réservations" value={data.totals.reservations} icon={Coffee} captured={data.cloneCaptured.reservations} color="bg-indigo-500" />
        <StatCard title="Leads" value={data.totals.leads} icon={Users} captured={data.cloneCaptured.leads} color="bg-emerald-500" />
        <StatCard title="Devis" value={data.totals.quoteRequests} icon={FileText} captured={data.cloneCaptured.quoteRequests} color="bg-amber-500" />
        <StatCard title="Commandes" value={data.totals.orders} icon={ShoppingCart} captured={data.cloneCaptured.orders} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelRow title="Rendez-vous" data={data.byChannel.appointments} />
        <ChannelRow title="Réservations" data={data.byChannel.reservations} />
        <ChannelRow title="Leads" data={data.byChannel.leads} />
        <ChannelRow title="Devis" data={data.byChannel.quoteRequests} />
        <ChannelRow title="Commandes" data={data.byChannel.orders} />
      </div>
    </div>
  );
}
