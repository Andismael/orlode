/**
 * IT Dashboard PRO — KPIs, alerts, monitoring overview
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Ticket, Package, Key, AlertTriangle, CheckCircle, Clock, DollarSign, Flame, Shield, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useCurrency } from '@/hooks/useCurrency';

interface Stats {
  totalTickets: number; openTickets: number; escalated: number; slaBreaches: number;
  avgResolutionMin: number; totalAssets: number; assetValue: number; warrantyAlerts: number;
  totalLicenses: number; licenseCost: number; expiringLicenses: number;
  totalServices: number; servicesDown: number;
  byCategory: { category: string; count: number }[];
}

const fmtMin = (m: number) => m < 60 ? `${m}min` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}j`;

export default function ITDashboardPage() {
  const { t } = useLangStore();
  const { symbol } = useCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>('/it/stats').then(r => setStats(r.data ?? null)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const kpis = stats ? [
    { label: 'Tickets ouverts', value: stats.openTickets, icon: Ticket, color: stats.openTickets > 0 ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50' },
    { label: 'Escalades', value: stats.escalated, icon: AlertTriangle, color: stats.escalated > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50' },
    { label: 'SLA breach', value: stats.slaBreaches, icon: Flame, color: stats.slaBreaches > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
    { label: 'Resolution moy.', value: stats.avgResolutionMin > 0 ? fmtMin(stats.avgResolutionMin) : '—', icon: Clock, color: 'text-blue-600 bg-blue-50' },
    { label: 'Assets', value: stats.totalAssets, icon: Package, color: 'text-purple-600 bg-purple-50', sub: stats.warrantyAlerts > 0 ? `${stats.warrantyAlerts} garantie exp.` : undefined },
    { label: 'Valeur parc', value: `${symbol}${(stats.assetValue / 1000).toFixed(0)}k`, icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Licences', value: stats.totalLicenses, icon: Key, color: 'text-indigo-600 bg-indigo-50', sub: stats.expiringLicenses > 0 ? `${stats.expiringLicenses} expirent` : undefined },
    { label: 'Services', value: stats.totalServices, icon: Monitor, color: stats.servicesDown > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50', sub: stats.servicesDown > 0 ? `${stats.servicesDown} down` : 'Tous OK' },
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IT</h1>
          <p className="text-sm text-gray-500">Infrastructure, support et assets</p>
        </div>
        <div className="flex gap-2">
          <Link to="/it/tickets" className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Tickets</Link>
          <Link to="/it/assets" className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Assets</Link>
          <Link to="/it/licenses" className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Licences</Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${k.color}`}><k.icon size={14} /></div>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
                {k.sub && <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* Alerts */}
          {stats && (stats.slaBreaches > 0 || stats.warrantyAlerts > 0 || stats.expiringLicenses > 0 || stats.servicesDown > 0) && (
            <div className="space-y-2">
              {stats.slaBreaches > 0 && (
                <Link to="/it/tickets" className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <Flame size={14} /> {stats.slaBreaches} ticket{stats.slaBreaches > 1 ? 's' : ''} en depassement SLA
                </Link>
              )}
              {stats.warrantyAlerts > 0 && (
                <Link to="/it/assets" className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
                  <Shield size={14} /> {stats.warrantyAlerts} asset{stats.warrantyAlerts > 1 ? 's' : ''} — garantie expiree
                </Link>
              )}
              {stats.expiringLicenses > 0 && (
                <Link to="/it/licenses" className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
                  <Key size={14} /> {stats.expiringLicenses} licence{stats.expiringLicenses > 1 ? 's' : ''} expire{stats.expiringLicenses > 1 ? 'nt' : ''} dans 30 jours
                </Link>
              )}
              {stats.servicesDown > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <Monitor size={14} /> {stats.servicesDown} service{stats.servicesDown > 1 ? 's' : ''} down
                </div>
              )}
            </div>
          )}

          {/* Categories breakdown */}
          {stats && stats.byCategory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Tickets par categorie</h2>
              <div className="space-y-2">
                {stats.byCategory.map(c => (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-24">{c.category}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, (c.count / (stats.totalTickets || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-8 text-right">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats && stats.totalTickets === 0 && stats.totalAssets === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Monitor size={40} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Departement IT</h3>
              <p className="text-sm text-gray-400">Creez votre premier ticket ou ajoutez des assets pour demarrer.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
