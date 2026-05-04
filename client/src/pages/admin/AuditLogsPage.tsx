import React, { useEffect, useState } from 'react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Download, Search, Filter } from 'lucide-react';

interface AuditLog {
  id: string; userId: string; userEmail?: string; userName?: string; action: string;
  resource: string; result?: 'success'|'failure'; status?: number; timestamp: string; details?: string;
}

export default function AuditLogsPage() {
  const { t } = useLangStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/security/audit?limit=100').then(r => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l => {
    const name = l.userEmail ?? l.userName ?? '';
    return !search || l.action.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <Download size={14} /> Exporter
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('search')} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-8">{`${t('loading')}`}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {[t('name'),'Action','Ressource','Résultat','Horodatage'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-sm text-gray-400 py-8">{`${t('no_data')}`}</td></tr>
              ) : filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.userEmail ?? log.userName ?? log.userId}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.resource}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const ok = log.result === 'success' || (log.status != null && log.status < 400);
                      return (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {log.status ?? (ok ? 'success' : 'failure')}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{log.timestamp ? new Date(log.timestamp).toLocaleString('fr-FR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
