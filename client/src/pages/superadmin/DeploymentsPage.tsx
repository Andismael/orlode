import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Server, CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';

interface Deployment { id: string; name: string; version: string; status: 'running' | 'deploying' | 'error' | 'stopped'; region: string; lastDeploy: string; uptime: string; }

const STATUS_STYLE: Record<string, { color: string; icon: React.ReactNode }> = {
  running: { color: 'text-green-400', icon: <CheckCircle size={14} /> },
  deploying: { color: 'text-blue-400', icon: <RefreshCw size={14} className="animate-spin" /> },
  error: { color: 'text-red-400', icon: <AlertCircle size={14} /> },
  stopped: { color: 'text-white/30', icon: <Clock size={14} /> },
};

const MOCK: Deployment[] = [
  { id: '1', name: 'API Server (EU-West)', version: 'v2.4.1', status: 'running', region: 'eu-west-1', lastDeploy: '2024-01-15T10:30:00Z', uptime: '99.98%' },
  { id: '2', name: 'Agent Orchestrator', version: 'v2.4.1', status: 'running', region: 'eu-west-1', lastDeploy: '2024-01-15T10:30:00Z', uptime: '99.95%' },
  { id: '3', name: 'Face Recognition Service', version: 'v1.2.0', status: 'running', region: 'eu-west-1', lastDeploy: '2024-01-10T08:00:00Z', uptime: '99.90%' },
  { id: '4', name: 'Webhook Worker', version: 'v2.3.0', status: 'deploying', region: 'eu-west-1', lastDeploy: new Date().toISOString(), uptime: '—' },
  { id: '5', name: 'API Server (US-East)', version: 'v2.4.0', status: 'error', region: 'us-east-1', lastDeploy: '2024-01-14T22:00:00Z', uptime: '98.1%' },
];

export default function DeploymentsPage() {
  const { t } = useLangStore();
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
    error: deployments.filter(d => d.status === 'error').length,
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Déploiements</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-400">{healthCount.running} actifs</span>
          {healthCount.error > 0 && <span className="text-red-400">{healthCount.error} erreur(s)</span>}
        </div>
      </div>

      {/* Health summary */}
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${healthCount.error > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-green-500/30 bg-green-500/10'}`}>
        {healthCount.error > 0
          ? <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          : <CheckCircle size={20} className="text-green-400 flex-shrink-0" />}
        <p className="text-sm text-white">
          {healthCount.error > 0
            ? `${healthCount.error} service(s) en erreur — intervention requise`
            : 'Tous les services fonctionnent normalement'}
        </p>
      </div>

      {/* Deployments list */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {deployments.map(d => {
            const st = STATUS_STYLE[d.status];
            return (
              <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Server size={18} className="text-white/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-white text-sm">{d.name}</p>
                      <span className="text-xs text-white/30 font-mono">{d.version}</span>
                    </div>
                    <p className="text-xs text-white/40">{d.region} · Uptime: {d.uptime} · Dernier deploy: {new Date(d.lastDeploy).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`flex items-center gap-1 text-xs font-medium ${st.color}`}>
                      {st.icon} {d.status}
                    </span>
                    {(d.status === 'error' || d.status === 'stopped') && (
                      <button onClick={() => redeploy(d.id)}
                        className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors">
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
  );
}
