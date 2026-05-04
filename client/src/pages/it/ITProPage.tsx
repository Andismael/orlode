/**
 * ITProPage — CMDB, Monitoring, Tech Performance, License Optimization, Automation
 */
import { useEffect, useState } from 'react';
import { Loader2, Monitor, Package, Key, Users, Activity, AlertTriangle, Zap, Shield, Clock, DollarSign } from 'lucide-react';
import api from '@/services/api';

interface CMDB { totalAssets: number; byType: { type: string; count: number; totalValue: number }[]; byStatus: { status: string; count: number }[]; warrantyExpiring: number; avgAgeMonths: number }
interface MonitorData { services: { name: string; status: string; uptime: number; responseTimeMs: number }[]; totalUp: number; totalDown: number; avgUptime: number }
interface TechPerf { technicians: { name: string; ticketsClosed: number; ticketsOpen: number; avgResolutionMin: number }[]; topTech: string }
interface LicenseOpt { totalCost: number; totalSeats: number; usedSeats: number; unusedSeats: number; wasteCost: number; expiringCount: number; recommendations: string[] }

export default function ITProPage() {
  const [tab, setTab] = useState<'cmdb' | 'monitoring' | 'techs' | 'licenses' | 'automation'>('cmdb');
  const [cmdb, setCmdb] = useState<CMDB | null>(null);
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [techs, setTechs] = useState<TechPerf | null>(null);
  const [licOpt, setLicOpt] = useState<LicenseOpt | null>(null);
  const [loading, setLoading] = useState(true);
  const [automating, setAutomating] = useState<string | null>(null);
  const [autoResult, setAutoResult] = useState<string[] | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/it/cmdb').then(r => { const d = r.data; setCmdb((d as CMDB)?.totalAssets != null ? d as CMDB : (d as { data?: CMDB })?.data ?? null); }),
      api.get('/it/monitoring').then(r => { const d = r.data; setMonitor((d as MonitorData)?.services ? d as MonitorData : (d as { data?: MonitorData })?.data ?? null); }),
      api.get('/it/tech-performance').then(r => { const d = r.data; setTechs((d as TechPerf)?.technicians ? d as TechPerf : (d as { data?: TechPerf })?.data ?? null); }),
      api.get('/it/license-optimization').then(r => { const d = r.data; setLicOpt((d as LicenseOpt)?.totalCost != null ? d as LicenseOpt : (d as { data?: LicenseOpt })?.data ?? null); }),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const runAuto = async (type: string) => { setAutomating(type); const r = await api.post('/it/automation/run', { type }).catch(() => ({ data: { actions: [] } })); const d = r.data as { actions?: string[] } | { data?: { actions?: string[] } }; setAutoResult((d as { actions?: string[] })?.actions ?? (d as { data?: { actions?: string[] } })?.data?.actions ?? []); setAutomating(null); };

  const c = cmdb ?? { totalAssets: 0, byType: [], byStatus: [], warrantyExpiring: 0, avgAgeMonths: 0 };
  const m = monitor ?? { services: [], totalUp: 0, totalDown: 0, avgUptime: 99.9 };
  const t = techs ?? { technicians: [], topTech: '' };
  const l = licOpt ?? { totalCost: 0, totalSeats: 0, usedSeats: 0, unusedSeats: 0, wasteCost: 0, expiringCount: 0, recommendations: [] };

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div><h1 className="text-xl font-bold text-gray-900">IT PRO</h1><p className="text-sm text-gray-500">CMDB, monitoring, performance, licences, automation</p></div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {[{ id: 'cmdb', label: 'CMDB', icon: Package }, { id: 'monitoring', label: 'Monitoring', icon: Activity }, { id: 'techs', label: 'Techniciens', icon: Users }, { id: 'licenses', label: 'Licences', icon: Key }, { id: 'automation', label: 'Automation', icon: Zap }].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id as typeof tab)} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${tab === tb.id ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}><tb.icon size={13} /> {tb.label}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (<>

        {tab === 'cmdb' && (<div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{c.totalAssets}</p><p className="text-xs text-gray-500">Total assets</p></div>
            <div className={`rounded-xl p-4 ${c.warrantyExpiring > 0 ? 'bg-orange-50' : 'bg-green-50'}`}><p className={`text-2xl font-bold ${c.warrantyExpiring > 0 ? 'text-orange-700' : 'text-green-700'}`}>{c.warrantyExpiring}</p><p className="text-xs text-gray-500">Garanties expirent</p></div>
            <div className="bg-purple-50 rounded-xl p-4"><p className="text-2xl font-bold text-purple-700">{c.avgAgeMonths}m</p><p className="text-xs text-gray-500">Age moyen</p></div>
            <div className="bg-gray-50 rounded-xl p-4"><p className="text-2xl font-bold text-gray-700">{c.byType.length}</p><p className="text-xs text-gray-500">Types</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"><h3 className="font-semibold text-gray-800 mb-3">Par type</h3>{c.byType.map(t => <div key={t.type} className="flex items-center gap-3 mb-2"><span className="text-xs text-gray-600 w-20">{t.type}</span><div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${c.totalAssets > 0 ? (t.count / c.totalAssets) * 100 : 0}%` }} /></div><span className="text-xs font-bold w-8">{t.count}</span><span className="text-xs text-gray-400 w-16 text-right">{t.totalValue.toLocaleString()}€</span></div>)}</div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"><h3 className="font-semibold text-gray-800 mb-3">Par statut</h3><div className="grid grid-cols-2 gap-3">{c.byStatus.map(s => <div key={s.status} className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xl font-bold text-gray-900">{s.count}</p><p className="text-xs text-gray-500 capitalize">{s.status}</p></div>)}</div></div>
          </div>
        </div>)}

        {tab === 'monitoring' && (<div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl p-4"><p className="text-2xl font-bold text-green-700">{m.totalUp}</p><p className="text-xs text-gray-500">Services UP</p></div>
            <div className={`rounded-xl p-4 ${m.totalDown > 0 ? 'bg-red-50' : 'bg-green-50'}`}><p className={`text-2xl font-bold ${m.totalDown > 0 ? 'text-red-700' : 'text-green-700'}`}>{m.totalDown}</p><p className="text-xs text-gray-500">Services DOWN</p></div>
            <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{m.avgUptime}%</p><p className="text-xs text-gray-500">Uptime moyen</p></div>
          </div>
          <div className="space-y-2">{m.services.map(s => (
            <div key={s.name} className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4 ${s.status === 'down' || s.status === 'outage' ? 'border-red-300' : 'border-gray-100'}`}>
              <div className={`w-3 h-3 rounded-full ${s.status === 'operational' || s.status === 'up' ? 'bg-green-500' : s.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <div className="flex-1"><p className="text-sm font-bold text-gray-900">{s.name}</p><p className="text-xs text-gray-400">{s.status} · {s.uptime}% uptime · {s.responseTimeMs}ms</p></div>
            </div>
          ))}</div>
        </div>)}

        {tab === 'techs' && (<div className="space-y-4">
          <div className="bg-yellow-50 rounded-xl p-4 flex items-center gap-2"><Users size={16} className="text-yellow-600" /><span className="text-sm font-bold text-yellow-700">Top: {t.topTech || '—'}</span></div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full"><thead className="bg-gray-50 border-b"><tr>{['Technicien', 'Fermes', 'Ouverts', 'Resol. moy.'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-50">{t.technicians.map((tech, i) => (
                <tr key={tech.name} className="hover:bg-gray-50"><td className="px-4 py-3 flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span><span className="text-sm font-medium">{tech.name}</span></td><td className="px-4 py-3 text-sm font-bold text-green-600">{tech.ticketsClosed}</td><td className="px-4 py-3 text-sm text-gray-600">{tech.ticketsOpen}</td><td className="px-4 py-3 text-sm text-gray-600">{tech.avgResolutionMin}min</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>)}

        {tab === 'licenses' && (<div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{l.totalCost.toLocaleString()}€</p><p className="text-xs text-gray-500">Cout total</p></div>
            <div className="bg-green-50 rounded-xl p-4"><p className="text-2xl font-bold text-green-700">{l.usedSeats}/{l.totalSeats}</p><p className="text-xs text-gray-500">Sieges utilises</p></div>
            <div className={`rounded-xl p-4 ${l.wasteCost > 0 ? 'bg-red-50' : 'bg-green-50'}`}><p className={`text-2xl font-bold ${l.wasteCost > 0 ? 'text-red-700' : 'text-green-700'}`}>{l.wasteCost.toLocaleString()}€</p><p className="text-xs text-gray-500">Gaspillage</p></div>
          </div>
          {l.recommendations.length > 0 && (<div className="bg-orange-50 border border-orange-200 rounded-xl p-4"><h3 className="text-sm font-bold text-orange-800 mb-2">Recommandations</h3>{l.recommendations.map((r, i) => <p key={i} className="text-xs text-orange-700 mb-1">→ {r}</p>)}</div>)}
        </div>)}

        {tab === 'automation' && (<div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { type: 'sla_check', label: 'Alertes SLA', desc: 'Tickets en retard', icon: Clock, color: 'bg-red-600' },
              { type: 'security_incidents', label: '→ Securite', desc: 'Tickets secu → incidents', icon: Shield, color: 'bg-purple-600' },
              { type: 'license_alerts', label: 'Licences', desc: 'Expirations proches', icon: Key, color: 'bg-orange-600' },
              { type: 'asset_offboarding', label: '→ HR', desc: 'Assets offboarding', icon: Users, color: 'bg-blue-600' },
            ].map(a => (
              <div key={a.type} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className={`w-8 h-8 rounded-lg ${a.color} flex items-center justify-center text-white mb-2`}><a.icon size={16} /></div>
                <h3 className="text-xs font-bold text-gray-900">{a.label}</h3><p className="text-xs text-gray-400 mb-2">{a.desc}</p>
                <button onClick={() => runAuto(a.type)} disabled={automating === a.type} className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1">{automating === a.type ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />} Go</button>
              </div>
            ))}
          </div>
          {autoResult && <div className="bg-green-50 rounded-xl p-4">{autoResult.length === 0 ? <p className="text-xs text-gray-500">Aucune action.</p> : autoResult.map((a, i) => <p key={i} className="text-xs text-green-700 mb-1">✓ {a}</p>)}</div>}
        </div>)}

      </>)}
    </div>
  );
}
