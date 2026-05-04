/**
 * SupportProPage — Agent Performance, SLA Dashboard, NPS, Automation
 */
import { useEffect, useState } from 'react';
import { Loader2, Users, Clock, AlertTriangle, Star, TrendingUp, Zap, Shield, BarChart3, HeartPulse } from 'lucide-react';
import api from '@/services/api';

interface Agent { userId: string; name: string; ticketsClosed: number; ticketsOpen: number; avgResponseMin: number; avgResolutionMin: number; avgCSAT: number; slaBreach: number }
interface AgentData { agents: Agent[]; topPerformer: string; avgTeamCSAT: number }
interface SLAData { totalBreaches: number; atRiskTickets: number; breachRate: number; breachesByPriority: { priority: string; count: number }[]; atRisk: { ticketNumber: string; subject: string; priority: string; minutesLeft: number }[] }
interface NPSData { npsScore: number; promoters: number; passives: number; detractors: number; totalResponses: number }

export default function SupportProPage() {
  const [tab, setTab] = useState<'agents' | 'sla' | 'nps' | 'automation'>('agents');
  const [agents, setAgents] = useState<AgentData | null>(null);
  const [sla, setSla] = useState<SLAData | null>(null);
  const [nps, setNps] = useState<NPSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [automating, setAutomating] = useState<string | null>(null);
  const [autoResult, setAutoResult] = useState<string[] | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/support/agent-performance').then(r => setAgents((r.data as AgentData | { data?: AgentData })?.agents ? r.data as AgentData : (r.data as { data?: AgentData })?.data ?? null)),
      api.get('/support/sla-dashboard').then(r => setSla((r.data as SLAData | { data?: SLAData })?.totalBreaches != null ? r.data as SLAData : (r.data as { data?: SLAData })?.data ?? null)),
      api.get('/support/nps').then(r => setNps((r.data as NPSData | { data?: NPSData })?.npsScore != null ? r.data as NPSData : (r.data as { data?: NPSData })?.data ?? null)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const runAuto = async (type: string) => { setAutomating(type); const r = await api.post('/support/automation/run', { type }).catch(() => ({ data: { actions: [] } })); const d = r.data as { actions?: string[] } | { data?: { actions?: string[] } }; setAutoResult((d as { actions?: string[] })?.actions ?? (d as { data?: { actions?: string[] } })?.data?.actions ?? []); setAutomating(null); };

  const a = agents ?? { agents: [], topPerformer: '', avgTeamCSAT: 0 };
  const s = sla ?? { totalBreaches: 0, atRiskTickets: 0, breachRate: 0, breachesByPriority: [], atRisk: [] };
  const n = nps ?? { npsScore: 0, promoters: 0, passives: 0, detractors: 0, totalResponses: 0 };

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div><h1 className="text-xl font-bold text-gray-900">Support PRO</h1><p className="text-sm text-gray-500">Performance agents, SLA, NPS, automation cross-agent</p></div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ id: 'agents', label: 'Agents', icon: Users }, { id: 'sla', label: 'SLA', icon: Clock }, { id: 'nps', label: 'NPS', icon: HeartPulse }, { id: 'automation', label: 'Automation', icon: Zap }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${tab === t.id ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}><t.icon size={13} /> {t.label}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        <>
          {tab === 'agents' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-cyan-50 rounded-xl p-4"><p className="text-2xl font-bold text-cyan-700">{a.agents.length}</p><p className="text-xs text-gray-500">Agents</p></div>
                <div className="bg-yellow-50 rounded-xl p-4"><p className="text-sm font-bold text-yellow-700">{a.topPerformer || '—'}</p><p className="text-xs text-gray-500">Top performer</p></div>
                <div className="bg-green-50 rounded-xl p-4"><p className="text-2xl font-bold text-green-700">{a.avgTeamCSAT}/5</p><p className="text-xs text-gray-500">CSAT equipe</p></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full"><thead className="bg-gray-50 border-b"><tr>{['Agent', 'Fermes', 'Ouverts', 'Rep. moy.', 'Resol. moy.', 'CSAT', 'SLA breach'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">{a.agents.map((ag, i) => (
                    <tr key={ag.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span><span className="text-sm font-medium text-gray-900">{ag.name}</span></td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">{ag.ticketsClosed}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ag.ticketsOpen}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ag.avgResponseMin}min</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ag.avgResolutionMin}min</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ag.avgCSAT >= 4 ? 'bg-green-100 text-green-700' : ag.avgCSAT >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>{ag.avgCSAT}/5</span></td>
                      <td className="px-4 py-3"><span className={`text-xs font-bold ${ag.slaBreach > 0 ? 'text-red-600' : 'text-green-600'}`}>{ag.slaBreach}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'sla' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-xl p-4 ${s.totalBreaches > 0 ? 'bg-red-50' : 'bg-green-50'}`}><p className={`text-2xl font-bold ${s.totalBreaches > 0 ? 'text-red-700' : 'text-green-700'}`}>{s.totalBreaches}</p><p className="text-xs text-gray-500">Breaches</p></div>
                <div className={`rounded-xl p-4 ${s.atRiskTickets > 0 ? 'bg-orange-50' : 'bg-green-50'}`}><p className={`text-2xl font-bold ${s.atRiskTickets > 0 ? 'text-orange-700' : 'text-green-700'}`}>{s.atRiskTickets}</p><p className="text-xs text-gray-500">A risque (&lt;1h)</p></div>
                <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{s.breachRate}%</p><p className="text-xs text-gray-500">Taux de breach</p></div>
              </div>
              {s.atRisk.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2"><AlertTriangle size={14} /> Tickets a risque</h3>
                  {s.atRisk.map(t => <p key={t.ticketNumber} className="text-xs text-orange-700 mb-1">{t.ticketNumber} — {t.subject} ({t.priority}) — {t.minutesLeft}min restantes</p>)}
                </div>
              )}
              {s.breachesByPriority.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">Breaches par priorite</h3>
                  {s.breachesByPriority.map(b => <div key={b.priority} className="flex items-center gap-3 mb-2"><span className="text-xs text-gray-600 w-16">{b.priority}</span><div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{ width: `${s.totalBreaches > 0 ? (b.count / s.totalBreaches) * 100 : 0}%` }} /></div><span className="text-xs font-bold w-6">{b.count}</span></div>)}
                </div>
              )}
            </div>
          )}

          {tab === 'nps' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-8 text-white text-center">
                <p className="text-sm opacity-80 mb-2">NET PROMOTER SCORE</p>
                <p className="text-6xl font-black">{n.npsScore}</p>
                <p className="text-sm opacity-80 mt-2">{n.totalResponses} reponses</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-green-700">{n.promoters}</p><p className="text-xs text-gray-500">Promoteurs (9-10)</p></div>
                <div className="bg-yellow-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-yellow-700">{n.passives}</p><p className="text-xs text-gray-500">Passifs (7-8)</p></div>
                <div className="bg-red-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-red-600">{n.detractors}</p><p className="text-xs text-gray-500">Detracteurs (0-6)</p></div>
              </div>
            </div>
          )}

          {tab === 'automation' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { type: 'sla_alerts', label: 'Alertes SLA', desc: 'Notifier les breaches', icon: Clock, color: 'bg-red-600' },
                  { type: 'route_security', label: '→ Securite', desc: 'Tickets securite → incidents', icon: Shield, color: 'bg-purple-600' },
                  { type: 'route_it', label: '→ IT', desc: 'Bugs/technique → tickets IT', icon: BarChart3, color: 'bg-blue-600' },
                  { type: 'route_billing', label: '→ Compta', desc: 'Facturation → notification', icon: TrendingUp, color: 'bg-green-600' },
                ].map(a => (
                  <div key={a.type} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className={`w-8 h-8 rounded-lg ${a.color} flex items-center justify-center text-white mb-2`}><a.icon size={16} /></div>
                    <h3 className="text-xs font-bold text-gray-900">{a.label}</h3>
                    <p className="text-xs text-gray-400 mb-2">{a.desc}</p>
                    <button onClick={() => runAuto(a.type)} disabled={automating === a.type} className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1">
                      {automating === a.type ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />} Executer
                    </button>
                  </div>
                ))}
              </div>
              {autoResult && <div className="bg-green-50 rounded-xl p-4">{autoResult.length === 0 ? <p className="text-xs text-gray-500">Aucune action.</p> : autoResult.map((a, i) => <p key={i} className="text-xs text-green-700 mb-1">✓ {a}</p>)}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
