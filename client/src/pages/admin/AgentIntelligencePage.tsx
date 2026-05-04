/**
 * AgentIntelligencePage — Priority, Conflicts, Feedback, Health, Traces
 * The control center for the 22-agent system
 */
import { useEffect, useState } from 'react';
import { Loader2, Brain, Shield, Zap, AlertTriangle, CheckCircle, Clock, TrendingUp, RefreshCw, Activity } from 'lucide-react';
import api from '@/services/api';

interface Priority { name: string; priority: number; level: string }
interface Health { name: string; totalCalls: number; failures: number; avgLatencyMs: number; circuitOpen: boolean }
interface Conflict { action: string; agent: string; timestamp: number }
interface Feedback { agent: string; successRate: number; avgLatency: number; avgConfidence: number; totalCalls: number }
interface Trace { id: string; timestamp: string; message: string; intent: string; confidence: number; latency: number; agents: number; errors: number }
interface IntelData { health: Health[]; priorities: Priority[]; conflicts: Conflict[]; feedback: Feedback[]; traces: Trace[] }

const LEVEL_C: Record<string, string> = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-blue-100 text-blue-700', low: 'bg-gray-100 text-gray-600' };

const AGENT_LABELS: Record<string, string> = {
  callSalesAgent: 'Sales', callHRAgent: 'RH', callAccountingAgent: 'Compta', callITAgent: 'IT',
  callCybersecurityAgent: 'Securite', callReceptionAgent: 'Reception', callMarketingAgent: 'Marketing',
  callSupportAgent: 'Support', callLegalAgent: 'Legal', callTrainingAgent: 'Formation',
  callNewsAgent: 'Veille', callCoachAgent: 'Coach', callDataScientistAgent: 'Data Sci',
  callWildcardAgent: 'Wildcard', askQAAgent: 'Q&A', callKnowledgeAgent: 'Knowledge',
  draftCommunication: 'Comms', generateInsights: 'Insights', analyzeMeeting: 'Meeting', analyzeImage: 'Vision',
};

export default function AgentIntelligencePage() {
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'priority' | 'feedback' | 'conflicts' | 'traces'>('overview');

  const load = () => {
    setLoading(true);
    api.get('/agents/intelligence').then(r => {
      const d = r.data; setData((d as IntelData)?.health ? d as IntelData : (d as { data?: IntelData })?.data ?? null);
    }).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading || !data) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  const totalCalls = data.health.reduce((s, h) => s + h.totalCalls, 0);
  const totalErrors = data.health.reduce((s, h) => s + h.failures, 0);
  const circuitOpen = data.health.filter(h => h.circuitOpen).length;
  const avgConfidence = data.feedback.length > 0 ? Math.round(data.feedback.reduce((s, f) => s + f.avgConfidence, 0) / data.feedback.length) : 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"><Brain size={20} className="text-white" /></div>
          <div><h1 className="text-xl font-bold text-gray-900">Intelligence Agents</h1><p className="text-sm text-gray-500">Priorites, conflits, feedback, sante — 22 agents</p></div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} className="text-gray-500" /></button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{totalCalls}</p><p className="text-xs text-gray-500">Appels total</p></div>
        <div className={`rounded-xl p-4 ${totalErrors > 0 ? 'bg-red-50' : 'bg-green-50'}`}><p className={`text-2xl font-bold ${totalErrors > 0 ? 'text-red-700' : 'text-green-700'}`}>{totalErrors}</p><p className="text-xs text-gray-500">Erreurs</p></div>
        <div className={`rounded-xl p-4 ${circuitOpen > 0 ? 'bg-orange-50' : 'bg-green-50'}`}><p className={`text-2xl font-bold ${circuitOpen > 0 ? 'text-orange-700' : 'text-green-700'}`}>{circuitOpen}</p><p className="text-xs text-gray-500">Circuits ouverts</p></div>
        <div className="bg-purple-50 rounded-xl p-4"><p className="text-2xl font-bold text-purple-700">{avgConfidence}%</p><p className="text-xs text-gray-500">Confiance moy.</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {[{ id: 'overview', label: 'Vue globale', icon: Activity }, { id: 'priority', label: 'Priorites', icon: Zap }, { id: 'feedback', label: 'Feedback', icon: TrendingUp }, { id: 'conflicts', label: 'Conflits', icon: Shield }, { id: 'traces', label: 'Traces', icon: Clock }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${tab === t.id ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}><t.icon size={13} /> {t.label}</button>
        ))}
      </div>

      {/* OVERVIEW — Agent health table */}
      {tab === 'overview' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full"><thead className="bg-gray-50 border-b"><tr>{['Agent', 'Appels', 'Erreurs', 'Latence', 'Circuit', 'Priorite'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">{data.health.filter(h => h.totalCalls > 0).map(h => {
              const pri = data.priorities.find(p => p.name === h.name);
              return (
                <tr key={h.name} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{AGENT_LABELS[h.name] ?? h.name}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{h.totalCalls}</td>
                  <td className="px-4 py-2.5"><span className={`text-xs font-bold ${h.failures > 0 ? 'text-red-600' : 'text-green-600'}`}>{h.failures}</span></td>
                  <td className="px-4 py-2.5 text-sm text-gray-500">{h.avgLatencyMs}ms</td>
                  <td className="px-4 py-2.5"><span className={`w-2.5 h-2.5 rounded-full inline-block ${h.circuitOpen ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} /></td>
                  <td className="px-4 py-2.5">{pri && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_C[pri.level] ?? 'bg-gray-100'}`}>{pri.level} ({pri.priority})</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}

      {/* PRIORITIES */}
      {tab === 'priority' && (
        <div className="space-y-2">{data.priorities.map(p => (
          <div key={p.name} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">{p.priority}</div>
            <span className="text-sm font-medium text-gray-900 flex-1">{AGENT_LABELS[p.name] ?? p.name}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${LEVEL_C[p.level]}`}>{p.level}</span>
          </div>
        ))}</div>
      )}

      {/* FEEDBACK */}
      {tab === 'feedback' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full"><thead className="bg-gray-50 border-b"><tr>{['Agent', 'Appels', 'Succes', 'Latence moy.', 'Confiance moy.'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-50">{data.feedback.map(f => (
              <tr key={f.agent} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm font-medium">{AGENT_LABELS[f.agent] ?? f.agent}</td>
                <td className="px-4 py-2.5 text-sm">{f.totalCalls}</td>
                <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${f.successRate >= 90 ? 'bg-green-100 text-green-700' : f.successRate >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>{f.successRate}%</span></td>
                <td className="px-4 py-2.5 text-sm text-gray-500">{f.avgLatency}ms</td>
                <td className="px-4 py-2.5 text-sm text-purple-600 font-medium">{f.avgConfidence}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* CONFLICTS */}
      {tab === 'conflicts' && (
        data.conflicts.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border border-gray-100"><CheckCircle size={40} className="mx-auto text-green-400 mb-3" /><p className="text-sm text-gray-500">Aucun conflit detecte (5 dernieres minutes)</p></div> :
        <div className="space-y-2">{data.conflicts.map((c, i) => (
          <div key={i} className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-3">
            <AlertTriangle size={14} className="text-orange-600" />
            <div className="flex-1"><p className="text-sm text-orange-800">{c.action}</p><p className="text-xs text-orange-600">{AGENT_LABELS[c.agent] ?? c.agent} · {new Date(c.timestamp).toLocaleTimeString('fr-FR')}</p></div>
          </div>
        ))}</div>
      )}

      {/* TRACES */}
      {tab === 'traces' && (
        <div className="space-y-2">{data.traces.map(t => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${t.errors > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{t.message}</p>
              <p className="text-xs text-gray-400">{AGENT_LABELS[t.intent] ?? t.intent} · {(t.confidence * 100).toFixed(0)}% · {t.latency}ms · {t.agents} agent(s)</p>
            </div>
            <span className="text-xs text-gray-400">{new Date(t.timestamp).toLocaleTimeString('fr-FR')}</span>
          </div>
        ))}</div>
      )}
    </div>
  );
}
