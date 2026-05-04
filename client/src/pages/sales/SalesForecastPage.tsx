/**
 * SalesForecastPage — Revenue projections, pipeline health, deals at risk, monthly chart
 */
import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Target, DollarSign, BarChart3, Activity, Zap } from 'lucide-react';
import api from '@/services/api';
import { useCurrency } from '@/hooks/useCurrency';

interface Stats { totalLeads: number; totalClients: number; quotesCount: number; conversionRate: number; pipelineValue: number; forecastedRevenue: number; avgDealSize: number; hotLeads: number }
interface Lead { id: string; name: string; company: string; stage: string; amount: number; estimatedValue: number; probability: number; score: number; aiScore?: number; aiGrade?: string; nextBestAction?: string; updatedAt?: string }

const GRADE_COLORS: Record<string, string> = { A: 'bg-green-500 text-white', B: 'bg-blue-500 text-white', C: 'bg-yellow-500 text-white', D: 'bg-orange-500 text-white', F: 'bg-red-500 text-white' };

export default function SalesForecastPage() {
  const { symbol } = useCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/sales/stats').then(r => setStats((r.data as { data?: Stats })?.data ?? null)),
      api.get('/sales/pipeline').then(r => setLeads(Array.isArray(r.data) ? r.data as Lead[] : ((r.data as { data?: Lead[] })?.data ?? []))),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const s = stats ?? { totalLeads: 0, totalClients: 0, quotesCount: 0, conversionRate: 0, pipelineValue: 0, forecastedRevenue: 0, avgDealSize: 0, hotLeads: 0 };
  const activeLeads = leads.filter(l => !['gagne', 'perdu'].includes(l.stage));
  const atRisk = activeLeads.filter(l => (l.score ?? 30) < 30 || (l.aiGrade === 'D') || (l.aiGrade === 'F'));
  const hot = activeLeads.filter(l => (l.score ?? 0) >= 70 || l.aiGrade === 'A');

  // Forecast by stage
  const stageForecasts = [
    { stage: 'Nouveau', prob: 10 },
    { stage: 'Contacte', prob: 20 },
    { stage: 'Interesse', prob: 40 },
    { stage: 'Devis envoye', prob: 60 },
    { stage: 'Negociation', prob: 80 },
  ];
  const stageMap: Record<string, typeof stageForecasts[0]> = {
    nouveau: stageForecasts[0], contacte: stageForecasts[1], interesse: stageForecasts[2],
    devis_envoye: stageForecasts[3], negociation: stageForecasts[4],
  };

  const forecastByStage = stageForecasts.map(sf => {
    const stageKey = sf.stage.toLowerCase().replace(/ /g, '_').replace('e_', 'e');
    const stageLeads = activeLeads.filter(l => (stageMap[l.stage]?.stage ?? '') === sf.stage);
    const value = stageLeads.reduce((sum, l) => sum + ((l.estimatedValue || l.amount || 0)), 0);
    const weighted = Math.round(value * sf.prob / 100);
    return { ...sf, count: stageLeads.length, value, weighted };
  });

  const totalWeighted = forecastByStage.reduce((s, f) => s + f.weighted, 0);
  const totalPipeline = activeLeads.reduce((s, l) => s + (l.estimatedValue || l.amount || 0), 0);

  // 3 scenarios
  const optimistic = Math.round(totalWeighted * 1.3);
  const realistic = totalWeighted;
  const conservative = Math.round(totalWeighted * 0.7);

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Previsions de ventes</h1><p className="text-sm text-gray-500">Pipeline health, deals a risque, projections revenue</p></div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        <>
          {/* 3 Scenarios */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white">
              <TrendingUp size={20} className="mb-2 opacity-80" />
              <p className="text-3xl font-black">{symbol}{(optimistic / 1000).toFixed(0)}k</p>
              <p className="text-sm opacity-80">Optimiste (+30%)</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white">
              <Target size={20} className="mb-2 opacity-80" />
              <p className="text-3xl font-black">{symbol}{(realistic / 1000).toFixed(0)}k</p>
              <p className="text-sm opacity-80">Realiste</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 text-white">
              <TrendingDown size={20} className="mb-2 opacity-80" />
              <p className="text-3xl font-black">{symbol}{(conservative / 1000).toFixed(0)}k</p>
              <p className="text-sm opacity-80">Conservateur (-30%)</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Pipeline total', value: `${symbol}${(totalPipeline / 1000).toFixed(0)}k`, icon: DollarSign, color: 'text-blue-600 bg-blue-50' },
              { label: 'Leads actifs', value: activeLeads.length, icon: Activity, color: 'text-purple-600 bg-purple-50' },
              { label: 'Leads chauds', value: hot.length, icon: Zap, color: 'text-red-600 bg-red-50' },
              { label: 'Deals a risque', value: atRisk.length, icon: AlertTriangle, color: atRisk.length > 0 ? 'text-orange-600 bg-orange-50' : 'text-green-600 bg-green-50' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${k.color}`}><k.icon size={14} /></div>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Forecast by stage (funnel) */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BarChart3 size={14} className="text-blue-500" /> Entonnoir de conversion</h2>
            <div className="space-y-3">
              {forecastByStage.map((f, i) => {
                const widthPct = totalPipeline > 0 ? Math.max(10, (f.value / totalPipeline) * 100) : 20;
                return (
                  <div key={f.stage} className="flex items-center gap-4">
                    <span className="text-xs text-gray-600 w-28 truncate">{f.stage}</span>
                    <div className="flex-1 relative">
                      <div className="h-8 bg-gray-100 rounded-lg overflow-hidden" style={{ width: `${widthPct}%` }}>
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg flex items-center px-3">
                          <span className="text-xs text-white font-bold">{symbol}{(f.value / 1000).toFixed(0)}k</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right w-24">
                      <p className="text-xs font-bold text-gray-700">{symbol}{(f.weighted / 1000).toFixed(0)}k</p>
                      <p className="text-xs text-gray-400">{f.prob}% · {f.count} deals</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Hot leads */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Zap size={14} className="text-red-500" /> Leads chauds ({hot.length})</h2>
              {hot.length === 0 ? <p className="text-xs text-gray-400">Aucun lead chaud.</p> : (
                <div className="space-y-2">
                  {hot.slice(0, 8).map(l => (
                    <div key={l.id} className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                      {l.aiGrade && <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${GRADE_COLORS[l.aiGrade] ?? 'bg-gray-100'}`}>{l.aiGrade}</span>}
                      <div className="flex-1 min-w-0"><p className="text-xs font-bold text-gray-900 truncate">{l.name}</p><p className="text-xs text-gray-400">{l.company}</p></div>
                      <span className="text-xs font-bold text-gray-700">{symbol}{(l.estimatedValue || l.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deals at risk */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-orange-500" /> Deals a risque ({atRisk.length})</h2>
              {atRisk.length === 0 ? <p className="text-xs text-green-600">Aucun deal a risque.</p> : (
                <div className="space-y-2">
                  {atRisk.slice(0, 8).map(l => (
                    <div key={l.id} className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg">
                      {l.aiGrade && <span className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${GRADE_COLORS[l.aiGrade] ?? 'bg-gray-100'}`}>{l.aiGrade}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{l.name}</p>
                        <p className="text-xs text-gray-400">{l.company} · {l.stage}</p>
                        {l.nextBestAction && <p className="text-xs text-orange-600 mt-0.5">→ {l.nextBestAction}</p>}
                      </div>
                      <span className="text-xs font-bold text-gray-700">{symbol}{(l.estimatedValue || l.amount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
