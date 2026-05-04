import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, MessageSquare, FileText, Clock, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface OverviewData {
  documents:     { total: number; completed: number; processing: number; storageGB: string };
  conversations: { total: number; totalMessages: number };
  meetings:      { total: number; transcribed: number; totalMinutes: number };
}

interface ChartsData {
  chatActivity: { date: string; conversations: number; messages: number }[];
  docTypes:     { name: string; value: number; color: string }[];
  queryTopics:  { topic: string; count: number }[];
}

const KPI_COLORS = ['#0092FF', '#00A550', '#FFA200', '#FF009D'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} className="text-xs font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { t } = useLangStore();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    setIsLoading(true);
    Promise.all([
      api.get<{ success: boolean; data: OverviewData }>('/analytics/overview'),
      api.get<{ success: boolean; data: ChartsData }>(`/analytics/charts?days=${days}`),
    ]).then(([ovRes, chRes]) => {
      setOverview(ovRes.data.data);
      setCharts(chRes.data.data);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [period]);

  const kpis = [
    {
      label: 'Total requetes',
      value: isLoading ? '—' : String(overview?.conversations.totalMessages ?? 0),
      change: '',
      icon: <MessageSquare size={16} className="text-white" />,
    },
    {
      label: 'Temps de reponse',
      value: '1.8s',
      change: '',
      icon: <Clock size={16} className="text-white" />,
    },
    {
      label: 'Documents indexes',
      value: isLoading ? '—' : String(overview?.documents.completed ?? 0),
      change: `${overview?.documents.processing ?? 0} en cours`,
      icon: <FileText size={16} className="text-white" />,
    },
    {
      label: 'Reunions transcrites',
      value: isLoading ? '—' : String(overview?.meetings.transcribed ?? 0),
      change: `sur ${overview?.meetings.total ?? 0}`,
      icon: <TrendingUp size={16} className="text-white" />,
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t('analytics')}</h2>
          <p className="text-sm text-gray-500 mt-1">Statistiques d'utilisation</p>
        </div>
        <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-xl p-1">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200"
              style={period === p ? { background: '#0092FF', color: 'white' } : { color: '#6b7280' }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-100 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              className="rounded-xl p-4 relative overflow-hidden"
              style={{ background: KPI_COLORS[i] }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 relative" style={{ background: 'rgba(255,255,255,0.2)' }}>
                {kpi.icon}
              </div>
              <p className="text-xl font-bold text-white relative">{kpi.value}</p>
              <p className="text-xs mt-0.5 relative" style={{ color: 'rgba(255,255,255,0.8)' }}>{kpi.label}</p>
              {kpi.change && <p className="text-xs mt-1 font-medium text-white relative">{kpi.change}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Conversation trend */}
        <div className="xl:col-span-2 rounded-xl p-5 relative overflow-hidden" style={{ background: '#0019FF' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }} />
          <h3 className="text-sm font-semibold text-white mb-4 relative">Conversation Activity</h3>
          {isLoading || !charts ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-white/50" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={charts.chatActivity}>
                <defs>
                  <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00f3ff" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00f3ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF009D" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF009D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.7)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.7)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="conversations" stroke="#00f3ff" fill="url(#colorConv)" strokeWidth={2} name="Conversations" />
                <Area type="monotone" dataKey="messages"      stroke="#FF009D" fill="url(#colorMsg)"  strokeWidth={2} name="Messages" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Document types */}
        <div className="rounded-xl p-5 relative overflow-hidden" style={{ background: '#FF009D' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)' }} />
          <h3 className="text-sm font-semibold text-white mb-4 relative">Document Types</h3>
          {isLoading || !charts || charts.docTypes.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              {isLoading ? <Loader2 size={24} className="animate-spin text-white/50" /> : <p className="text-white/60 text-sm">No documents yet</p>}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={charts.docTypes} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {charts.docTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>{value}</span>}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Query topics */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Query Topics</h3>
        {isLoading || !charts ? (
          <div className="h-44 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : charts.queryTopics.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No conversations yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={charts.queryTopics} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="topic" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Queries">
                {charts.queryTopics.map((_, index) => (
                  <Cell key={`bar-${index}`} fill={KPI_COLORS[index % KPI_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
