import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { Server, CheckCircle, AlertCircle, RefreshCw, Clock, Loader2 } from 'lucide-react';
import SuperAdminPage from './_SuperAdminPage';

interface Deployment { id: string; name: string; version: string; status: 'running' | 'deploying' | 'error' | 'stopped'; region: string; lastDeploy: string; uptime: string; }

const STATUS_STYLE: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  running:   { color: 'text-green-700',  bg: 'bg-green-50',  icon: <CheckCircle size={14} /> },
  deploying: { color: 'text-blue-700',   bg: 'bg-blue-50',   icon: <RefreshCw size={14} className="animate-spin" /> },
  error:     { color: 'text-red-700',    bg: 'bg-red-50',    icon: <AlertCircle size={14} /> },
  stopped:   { color: 'text-gray-500',   bg: 'bg-gray-100',  icon: <Clock size={14} /> },
};

const MOCK: Deployment[] = [
  { id: '1', name: 'API Server (EU-West)', version: 'v2.4.1', status: 'running', region: 'eu-west-1', lastDeploy: '2024-01-15T10:30:00Z', uptime: '99.98%' },
  { id: '2', name: 'Agent Orchestrator', version: 'v2.4.1', status: 'running', region: 'eu-west-1', lastDeploy: '2024-01-15T10:30:00Z', uptime: '99.95%' },
  { id: '3', name: 'Face Recognition Service', version: 'v1.2.0', status: 'running', region: 'eu-west-1', lastDeploy: '2024-01-10T08:00:00Z', uptime: '99.90%' },
  { id: '4', name: 'Webhook Worker', version: 'v2.3.0', status: 'deploying', region: 'eu-west-1', lastDeploy: new Date().toISOString(), uptime: '—' },
  { id: '5', name: 'API Server (US-East)', version: 'v2.4.0', status: 'error', region: 'us-east-1', lastDeploy: '2024-01-14T22:00:00Z', uptime: '98.1%' },
];

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/superadmin/deployments').then(r => setDeployments(r.data)).catch(() => setDeployments(MOCK)).finally(() => setLoading(false));
  }, []);

  const redeploy = async (id: string) => {
    await api.post(`/superadmin/deployments/${id}/redeploy`).catch(() => {});
    setDeployments(d => d.map(dep => dep.id === id ? { ...dep, status: 'deploying' as const } : dep));
  };

  const healthCount = {
    running: deployments.filter(d => d.status === 'running').length,
    error:   deployments.filter(d => d.status === 'error').length,
  };

  return (
    <SuperAdminPage
      title="Déploiements"
      subtitle="Statut des services Cloud Run + redéploiement à la volée"
      icon={<Server size={20} />}
      actions={
        <div className="flex items-center gap-2 text-xs md:text-sm">
          <span className="text-green-700 font-medium">{healthCount.running} actifs</span>
          {healthCount.error > 0 && <span className="text-red-700 font-medium">{healthCount.error} erreur(s)</span>}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Health summary */}
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${healthCount.error > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
          {healthCount.error > 0
            ? <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
            : <CheckCircle size={20} className="text-green-500 flex-shrink-0" />}
          <p className={`text-sm ${healthCount.error > 0 ? 'text-red-800' : 'text-green-800'}`}>
            {healthCount.error > 0
              ? `${healthCount.error} service(s) en erreur — intervention requise`
              : 'Tous les services fonctionnent normalement'}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-2">
            {deployments.map(d => {
              const st = STATUS_STYLE[d.status];
              return (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                    <Server size={18} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{d.name}</p>
                        <span className="text-xs text-gray-400 font-mono">{d.version}</span>
                      </div>
                      <p className="text-xs text-gray-500">{d.region} · Uptime: {d.uptime} · {new Date(d.lastDeploy).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${st.bg} ${st.color}`}>
                        {st.icon} {d.status}
                      </span>
                      {(d.status === 'error' || d.status === 'stopped') && (
                        <button onClick={() => redeploy(d.id)}
                          className="px-3 py-1 text-xs text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors">
                          Redéployer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SuperAdminPage>
  );
}
