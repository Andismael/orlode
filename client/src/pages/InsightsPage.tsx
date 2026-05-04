/**
 * InsightsPage — Cross-module intelligence dashboard
 * KPIs from all modules, AI insights, usage stats, trends
 */
import { useEffect, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  Lightbulb, RefreshCw, Loader2, Users, UserCheck, Clock, Calendar,
  AlertTriangle, HeadphonesIcon, FileText, TrendingUp, Megaphone,
  GraduationCap, DollarSign, Zap, CheckCircle, Monitor,
} from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useCurrency } from '@/hooks/useCurrency';

interface CrossModuleData {
  employees: number; visitorsToday: number; presenceToday: number; presenceRate: number;
  pendingLeaves: number; openITTickets: number; openSupportTickets: number;
  overdueInvoices: number; overdueAmount: number; marketingPosts: number; trainingCourses: number;
}
interface UsageData {
  kpis: { tokensGemini: number; tokensClaude: number; estimatedCost: number; costGemini: number; costClaude: number };
  daily: Array<{ date: string; gemini: number; claude: number; requests: number }>;
}
interface Insight { id: string; type: string; title: string; body: string; priority: string; read: boolean; createdAt: string }

export default function InsightsPage() {
  const { t } = useLangStore();
  const { formatMoney, formatShort } = useCurrency();
  const [cross, setCross] = useState<CrossModuleData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    await Promise.all([
      api.get('/analytics/cross-modules').then(r => setCross(r.data as CrossModuleData)).catch(() => {}),
      api.get('/analytics/usage').then(r => setUsage(r.data as UsageData)).catch(() => {}),
      api.get('/agent/insights').then(r => setInsights((r.data ?? []) as Insight[])).catch(() => {}),
    ]);
    setLoading(false);
  };

  const runAnalysis = async () => {
    setRunning(true);
    try {
      await api.post('/agent/insights/run');
      await load();
    } catch {} finally { setRunning(false); }
  };

  const markRead = async (id: string) => {
    await api.patch(`/agent/insights/${id}/read`).catch(() => {});
    setInsights(prev => prev.map(i => i.id === id ? { ...i, read: true } : i));
  };

  const c = cross ?? { employees: 0, visitorsToday: 0, presenceToday: 0, presenceRate: 0, pendingLeaves: 0, openITTickets: 0, openSupportTickets: 0, overdueInvoices: 0, overdueAmount: 0, marketingPosts: 0, trainingCourses: 0 };
  const u = usage ?? { kpis: { tokensGemini: 0, tokensClaude: 0, estimatedCost: 0, costGemini: 0, costClaude: 0 }, daily: [] };

  const unreadInsights = insights.filter(i => !i.read);

  // Usage chart
  const usageChart = u.daily.slice(-14).map(d => ({
    day: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    gemini: Math.round(d.gemini / 1000),
    claude: Math.round(d.claude / 1000),
  }));

  // Cost pie
  const costPie = [
    { name: 'Gemini', value: u.kpis.costGemini, color: '#3b82f6' },
    { name: 'Claude', value: u.kpis.costClaude, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('insights_page')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('cross_module')}</p>
        </div>
        <button onClick={runAnalysis} disabled={running}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50 hover:shadow-md"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
          {running ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          {running ? 'Analyse...' : 'Lancer l\'analyse AI'}
        </button>
      </div>

      {/* Cross-module KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Employes', value: c.employees, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Presence', value: `${c.presenceRate}%`, icon: Clock, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Visiteurs', value: c.visitorsToday, icon: UserCheck, color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Conges', value: c.pendingLeaves, icon: Calendar, color: c.pendingLeaves > 0 ? 'text-amber-700' : 'text-gray-600', bg: c.pendingLeaves > 0 ? 'bg-amber-50' : 'bg-gray-50' },
          { label: 'Tickets IT', value: c.openITTickets, icon: Monitor, color: c.openITTickets > 0 ? 'text-red-600' : 'text-gray-600', bg: c.openITTickets > 0 ? 'bg-red-50' : 'bg-gray-50' },
          { label: 'Support', value: c.openSupportTickets, icon: HeadphonesIcon, color: c.openSupportTickets > 0 ? 'text-orange-700' : 'text-gray-600', bg: c.openSupportTickets > 0 ? 'bg-orange-50' : 'bg-gray-50' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`${k.bg} rounded-xl px-3 py-3`}>
              <Icon size={15} className={`${k.color} mb-1`} />
              <div className={`text-lg font-extrabold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Alerts row */}
      {(c.overdueInvoices > 0 || c.pendingLeaves > 3 || c.openITTickets > 5) && (
        <div className="space-y-2">
          {c.overdueInvoices > 0 && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-800"><strong>{c.overdueInvoices}</strong> facture(s) en retard — {formatShort(c.overdueAmount)}</p>
            </div>
          )}
          {c.pendingLeaves > 3 && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Calendar size={16} className="text-amber-500 shrink-0" />
              <p className="text-sm text-amber-800"><strong>{c.pendingLeaves}</strong> demandes de conge en attente d'approbation</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Usage chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Zap size={15} /> Usage AI (14 jours, k tokens)</h3>
          {usageChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={usageChart}>
                <defs>
                  <linearGradient id="gGemini" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gClaude" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Area type="monotone" dataKey="gemini" stroke="#3b82f6" fill="url(#gGemini)" strokeWidth={2} name="Gemini" />
                <Area type="monotone" dataKey="claude" stroke="#8b5cf6" fill="url(#gClaude)" strokeWidth={2} name="Claude" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">Pas de donnees d'usage</p>}
        </div>

        {/* Cost breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><DollarSign size={15} /> Couts AI</h3>
          <div className="flex items-center gap-6">
            {costPie.length > 0 ? (
              <ResponsiveContainer width={120} height={120}>
                <PieChart><Pie data={costPie} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} strokeWidth={0}>
                  {costPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
            ) : <div className="w-28 h-28 bg-gray-50 rounded-full flex items-center justify-center text-gray-300"><DollarSign size={24} /></div>}
            <div className="space-y-3">
              <div><p className="text-xs text-gray-500">Gemini</p><p className="text-lg font-bold text-blue-700">${u.kpis.costGemini.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-500">Claude</p><p className="text-lg font-bold text-violet-700">${u.kpis.costClaude.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-500">Estimation mensuelle</p><p className="text-lg font-extrabold text-gray-900">${u.kpis.estimatedCost}</p></div>
            </div>
          </div>
        </div>
      </div>

      {/* Module status grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">{t('module_status')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Marketing', value: `${c.marketingPosts} posts`, icon: Megaphone, ok: true },
            { label: t('training_cat'), value: `${c.trainingCourses} cours`, icon: GraduationCap, ok: true },
            { label: 'Finance', value: c.overdueInvoices > 0 ? `${c.overdueInvoices} retard` : 'OK', icon: FileText, ok: c.overdueInvoices === 0 },
            { label: 'Support', value: c.openSupportTickets > 0 ? `${c.openSupportTickets} ouverts` : 'OK', icon: HeadphonesIcon, ok: c.openSupportTickets === 0 },
            { label: 'IT', value: c.openITTickets > 0 ? `${c.openITTickets} tickets` : 'OK', icon: Monitor, ok: c.openITTickets === 0 },
            { label: 'RH', value: c.pendingLeaves > 0 ? `${c.pendingLeaves} en attente` : 'OK', icon: Users, ok: c.pendingLeaves === 0 },
          ].map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className={`rounded-xl px-3 py-3 ${m.ok ? 'bg-green-50' : 'bg-amber-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={m.ok ? 'text-green-600' : 'text-amber-600'} />
                  <span className="text-xs font-bold text-gray-700">{m.label}</span>
                </div>
                <p className={`text-xs font-medium ${m.ok ? 'text-green-700' : 'text-amber-700'}`}>{m.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Lightbulb size={15} /> Insights AI</h3>
            {unreadInsights.length > 0 && <span className="text-xs font-bold text-violet-600">{unreadInsights.length} non lu(s)</span>}
          </div>
          <div className="divide-y divide-gray-50">
            {insights.slice(0, 10).map(i => (
              <div key={i.id} onClick={() => !i.read && markRead(i.id)}
                className={`px-5 py-3 cursor-pointer transition-colors ${i.read ? 'bg-white' : 'bg-violet-50/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {i.priority === 'critical' ? <AlertTriangle size={12} className="text-red-500" /> :
                   i.priority === 'attention' ? <Clock size={12} className="text-amber-500" /> :
                   <TrendingUp size={12} className="text-green-500" />}
                  <p className={`text-sm ${i.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{i.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    i.type === 'alert' ? 'bg-red-100 text-red-700' :
                    i.type === 'anomaly' ? 'bg-amber-100 text-amber-700' :
                    i.type === 'recommendation' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>{i.type}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{i.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
