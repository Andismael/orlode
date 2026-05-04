import { useEffect, useState } from 'react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Building2, Bot, DollarSign, Star, Download, Loader2 } from 'lucide-react';

interface Analytics {
  totalCompanies: number; totalUsers: number; totalAgents: number; totalReviews: number;
  totalRevenue: number; subRevenue: number; mkRevenue: number; totalInstalls: number;
  planCounts: Record<string, number>;
  companiesByMonth: Record<string, number>;
  revenueByMonth: Record<string, number>;
}

export default function PlatformAnalyticsPage() {
  const { formatShort } = useCurrency();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/superadmin/analytics').then(r => setData(r.data as Analytics)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;
  if (!data) return <p className="p-6 text-gray-500">Erreur de chargement</p>;

  const revenueChart = Object.entries(data.revenueByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month: month.slice(5), amount }));
  const companiesChart = Object.entries(data.companiesByMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month: month.slice(5), count }));

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp size={22} className="text-violet-500" /> Analytics Plateforme</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={<Building2 size={18} />} label="Entreprises" value={data.totalCompanies} color="text-blue-600" />
        <KPI icon={<Users size={18} />} label="Utilisateurs" value={data.totalUsers} color="text-green-600" />
        <KPI icon={<Bot size={18} />} label="Agents" value={data.totalAgents} color="text-violet-600" />
        <KPI icon={<Download size={18} />} label="Installs" value={data.totalInstalls} color="text-amber-600" />
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-violet-500 to-blue-500 rounded-xl p-5 text-white">
          <DollarSign size={18} className="opacity-60 mb-1" />
          <p className="text-3xl font-bold">{formatShort(data.totalRevenue)}</p>
          <p className="text-xs opacity-70">Revenue total</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-blue-600">{formatShort(data.subRevenue)}</p>
          <p className="text-xs text-gray-500">Abonnements</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-violet-600">{formatShort(data.mkRevenue)}</p>
          <p className="text-xs text-gray-500">Marketplace</p>
        </div>
      </div>

      {/* Plan distribution */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Distribution des plans</h2>
        <div className="flex gap-4">
          {Object.entries(data.planCounts).map(([plan, count]) => (
            <div key={plan} className="flex-1 text-center">
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500 capitalize">{plan}</p>
              <div className="h-2 bg-gray-100 rounded-full mt-2">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${data.totalCompanies > 0 ? (count / data.totalCompanies) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      {revenueChart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Revenue par mois</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number) => formatShort(v)} />
              <Bar dataKey="amount" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {companiesChart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Nouvelles entreprises par mois</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={companiesChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Reviews & installs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <Star size={18} className="text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{data.totalReviews}</p>
          <p className="text-xs text-gray-500">Avis marketplace</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <Download size={18} className="text-green-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{data.totalInstalls}</p>
          <p className="text-xs text-gray-500">Installations agents</p>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className={`${color} mb-2`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
