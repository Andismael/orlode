/**
 * MarketplaceAnalyticsPage — Admin marketplace analytics
 * Revenue, installs, ratings, top agents
 */
import { useEffect, useState } from 'react';
import {
  Loader2, TrendingUp, Download, DollarSign, Star, MessageCircle,
} from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';

interface Analytics {
  totalAgents: number;
  totalInstalls: number;
  totalRevenue: number;
  totalReviews: number;
  topAgents: { id: string; name: string; installs: number; rating: number }[];
  revenueByMonth: Record<string, number>;
}

export default function MarketplaceAnalyticsPage() {
  const { formatShort } = useCurrency();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/marketplace/analytics')
      .then(r => setData(r.data as Analytics))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  if (!data) return <p className="p-6 text-gray-500">Erreur de chargement</p>;

  const months = Object.entries(data.revenueByMonth).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <TrendingUp size={22} className="text-violet-500" /> Marketplace Analytics
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI icon={<Download size={18} />} label="Total installs" value={data.totalInstalls} color="text-blue-500" />
        <KPI icon={<DollarSign size={18} />} label="Revenus" value={formatShort(data.totalRevenue)} color="text-green-500" />
        <KPI icon={<Star size={18} />} label="Avis" value={data.totalReviews} color="text-amber-500" />
        <KPI icon={<MessageCircle size={18} />} label="Agents" value={data.totalAgents} color="text-violet-500" />
      </div>

      {/* Revenue chart (simple bars) */}
      {months.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Revenus par mois</h2>
          <div className="flex items-end gap-2 h-40">
            {months.map(([month, amount]) => {
              const max = Math.max(...months.map(([, v]) => v));
              const height = max > 0 ? (amount / max) * 100 : 0;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">{formatShort(amount)}</span>
                  <div className="w-full bg-violet-500 rounded-t-lg" style={{ height: `${height}%`, minHeight: 4 }} />
                  <span className="text-[10px] text-gray-400">{month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top agents */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Top agents</h2>
        <div className="space-y-2">
          {data.topAgents.map((agent, i) => (
            <div key={agent.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="text-lg font-bold text-gray-300 w-6 text-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{agent.name}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{agent.installs} installs</span>
                {agent.rating > 0 && <span>⭐ {agent.rating}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`${color} mb-2`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
