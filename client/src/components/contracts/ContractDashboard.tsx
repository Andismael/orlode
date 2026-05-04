/**
 * ContractDashboard — Visual stats for contracts module
 * Uses Recharts (already installed in Orlode)
 */
import { useState, useEffect } from 'react';
import { FileText, CheckCircle, Clock, PenLine, XCircle, TrendingUp, Users, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/services/api';

interface Stats { total: number; draft: number; pending: number; signed: number; expired: number }
interface Contract { signatoryEmail: string; status: string; createdAt: string; signedAt?: string }

const COLORS = { draft: '#9ca3af', pending: '#f59e0b', signed: '#10b981', expired: '#ef4444' };

export function ContractDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        api.get('/contracts/stats').then(r => r.data as Stats),
        api.get('/contracts').then(r => (r.data ?? []) as Contract[]),
      ]);
      setStats(s);
      setContracts(c);
    } catch {}
    finally { setLoading(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;
  }

  const s = stats ?? { total: 0, draft: 0, pending: 0, signed: 0, expired: 0 };

  // Pie data
  const pieData = [
    { name: 'Brouillons', value: s.draft, color: COLORS.draft },
    { name: 'En signature', value: s.pending, color: COLORS.pending },
    { name: 'Signes', value: s.signed, color: COLORS.signed },
    { name: 'Expires', value: s.expired, color: COLORS.expired },
  ].filter(d => d.value > 0);

  // Monthly bar data (last 6 months)
  const now = new Date();
  const monthlyData: Array<{ month: string; signed: number; created: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'short' });
    const y = d.getFullYear(), m = d.getMonth();
    const signed = contracts.filter(c => {
      if (!c.signedAt) return false;
      const sd = new Date(c.signedAt);
      return sd.getFullYear() === y && sd.getMonth() === m;
    }).length;
    const created = contracts.filter(c => {
      const cd = new Date(c.createdAt);
      return cd.getFullYear() === y && cd.getMonth() === m;
    }).length;
    monthlyData.push({ month: label, signed, created });
  }

  // Signature rate
  const sigRate = s.total > 0 ? Math.round(((s.signed) / (s.signed + s.expired + s.pending)) * 100) || 0 : 0;

  // Unique signatories
  const uniqueSignatories = new Set(contracts.map(c => c.signatoryEmail.toLowerCase())).size;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: s.total, icon: <FileText size={18} />, color: 'text-gray-700', bg: 'bg-gray-50', iconBg: 'bg-gray-100' },
          { label: 'Taux signature', value: `${sigRate}%`, icon: <TrendingUp size={18} />, color: 'text-green-700', bg: 'bg-green-50', iconBg: 'bg-green-100' },
          { label: 'Ce mois', value: monthlyData[5]?.signed ?? 0, icon: <CheckCircle size={18} />, color: 'text-blue-700', bg: 'bg-blue-50', iconBg: 'bg-blue-100' },
          { label: 'Signataires', value: uniqueSignatories, icon: <Users size={18} />, color: 'text-violet-700', bg: 'bg-violet-50', iconBg: 'bg-violet-100' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-2xl p-4`}>
            <div className={`w-9 h-9 ${k.iconBg} rounded-xl flex items-center justify-center mb-3 ${k.color}`}>{k.icon}</div>
            <div className={`text-2xl font-extrabold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5 font-medium">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pie chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Repartition par statut</h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Aucune donnee</div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-gray-600 font-medium">{d.name}</span>
                    <span className="text-xs font-extrabold text-gray-800 ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Activite (6 derniers mois)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e5e7eb' }}
                formatter={(v: number, name: string) => [v, name === 'signed' ? 'Signes' : 'Crees']}
              />
              <Bar dataKey="created" fill="#e5e7eb" radius={[4, 4, 0, 0]} name="created" />
              <Bar dataKey="signed" fill="#10b981" radius={[4, 4, 0, 0]} name="signed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Brouillons', value: s.draft, icon: <PenLine size={14} />, color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'En signature', value: s.pending, icon: <Clock size={14} />, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Signes', value: s.signed, icon: <CheckCircle size={14} />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Expires', value: s.expired, icon: <XCircle size={14} />, color: 'text-red-500', bg: 'bg-red-50' },
        ].map(item => (
          <div key={item.label} className={`${item.bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
            <div className={item.color}>{item.icon}</div>
            <div>
              <div className={`text-lg font-extrabold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
