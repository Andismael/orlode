import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { ArrowLeft, Activity, Clock, MessageSquare, Loader2, Bot } from 'lucide-react';

interface AgentInfo {
  name: string; displayName: string; icon: string; category: string;
  status: string; callsToday: number; tokensToday: number;
  avgLatencyMs: number; enabled: boolean; skills: number;
}

interface AgentStats {
  totalRuns: number; successRate: number; totalTokens: number; avgDurationMs: number;
}

export default function AgentDetailPage() {
  const { name: agentName } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/agents/status'),
      api.get(`/agents/${agentName}/stats`).catch(() => ({ data: null })),
    ]).then(([statusRes, statsRes]) => {
      const allAgents = (Array.isArray(statusRes.data) ? statusRes.data : []) as AgentInfo[];
      const found = allAgents.find(a => a.name === agentName);
      setAgent(found ?? null);
      setStats(statsRes.data as AgentStats);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [agentName]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={24} /></div>;
  if (!agent) return (
    <div className="p-6">
      <button onClick={() => navigate('/agents')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={14} /> Retour
      </button>
      <p className="text-red-500">Agent "{agentName}" introuvable.</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate('/agents')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Retour
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{agent.icon ?? '🤖'}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{agent.displayName}</h1>
            <p className="text-sm text-gray-500">{agent.category} · {agent.skills} skills · gemini-flash</p>
          </div>
          <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {agent.status === 'active' ? 'ACTIF' : 'INACTIF'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<MessageSquare size={16} className="text-blue-600" />} label="Calls aujourd'hui" value={agent.callsToday} />
        <StatCard icon={<Activity size={16} className="text-green-600" />} label="Tokens aujourd'hui" value={`${Math.round(agent.tokensToday / 1000)}k`} />
        <StatCard icon={<Clock size={16} className="text-orange-600" />} label="Latence moy." value={`${agent.avgLatencyMs}ms`} />
        <StatCard icon={<Bot size={16} className="text-violet-600" />} label="Taux succes" value={stats ? `${stats.successRate}%` : '100%'} />
      </div>

      {/* Historical stats */}
      {stats && (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Statistiques historiques</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRuns}</p>
              <p className="text-xs text-gray-500">Executions totales</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.successRate}%</p>
              <p className="text-xs text-gray-500">Taux de succes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{Math.round(stats.totalTokens / 1000)}k</p>
              <p className="text-xs text-gray-500">Tokens totaux</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.avgDurationMs}ms</p>
              <p className="text-xs text-gray-500">Duree moyenne</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
