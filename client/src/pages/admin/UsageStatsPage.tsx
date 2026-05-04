import React, { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface DayStats  { day: string; gemini: number; claude: number; requests: number; }
interface UsageKpis { tokensGemini: number; tokensClaude: number; storageGB: number; estimatedCost: number; costGemini: number; costClaude: number; }
interface UsageData { kpis: UsageKpis; daily: DayStats[]; prediction: number; }

export default function UsageStatsPage() {
  const { t } = useLangStore();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<UsageData>('/analytics/usage')
      .then(r => setData(r.data && typeof r.data === 'object' ? r.data as UsageData : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis;
  const daily = data?.daily ?? [];

  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(0)}k` : String(n);

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Usage & Coûts</h1>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i) => <div key={i} className="bg-white rounded-xl border border-gray-100 h-24 animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Tokens Gemini', value: kpis ? fmt(kpis.tokensGemini) : '—', sub: kpis ? `~€${kpis.costGemini.toFixed(2)}` : '' },
            { label: 'Tokens Claude', value: kpis ? fmt(kpis.tokensClaude) : '—', sub: kpis ? `~€${kpis.costClaude.toFixed(2)}` : '' },
            { label: 'Stockage',      value: kpis ? `${kpis.storageGB.toFixed(1)} GB` : '—', sub: 'utilisé' },
            { label: 'Coût estimé mois', value: kpis ? `€${kpis.estimatedCost.toFixed(0)}` : '—', sub: 'API + infra' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="text-2xl font-bold text-gray-900">{item.value}</p>
              <p className="text-xs text-gray-400">{item.sub}</p>
            </div>
          ))}
        </div>
      )}

      {daily.length > 0 ? (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Tokens consommés par jour</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} interval={Math.floor(daily.length / 7)} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => v.toLocaleString()} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="gemini" name="Gemini" fill="#0092FF" radius={[2,2,0,0]} />
                <Bar dataKey="claude" name="Claude" fill="#7C3AED" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Requêtes par jour</h2>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={daily} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} interval={Math.floor(daily.length / 7)} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="requests" stroke="#0019FF" strokeWidth={2} dot={false} name="Requêtes" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {data?.prediction != null && (
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-sm text-blue-800">
              <strong>Prédiction fin de mois :</strong> ~€{data.prediction.toFixed(0)} (basé sur l'usage actuel)
            </div>
          )}
        </>
      ) : !loading && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
          Aucune donnée d'usage disponible pour la période sélectionnée.
        </div>
      )}
    </div>
  );
}
