import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useLangStore } from '@/store/langStore';

const ENDPOINTS = [
  { method: 'POST', path: '/api/agent/conversations/{id}/messages', desc: 'Envoyer un message à l\'agent', group: 'Conversations',
    params: [{ name: 'message', type: 'string', required: true, desc: 'Le message à envoyer' }],
    example: '{"message": "Quel est notre CA ce mois ?"}' },
  { method: 'GET', path: '/api/documents', desc: 'Liste des documents indexés', group: 'Documents', params: [], example: '' },
  { method: 'POST', path: '/api/documents/upload', desc: 'Uploader un document', group: 'Documents',
    params: [{ name: 'file', type: 'File', required: true, desc: 'PDF, Word, Excel, CSV' }], example: '' },
  { method: 'GET', path: '/api/agents/status', desc: 'Statut de tous les agents', group: 'Agents', params: [], example: '' },
  { method: 'GET', path: '/api/meetings', desc: 'Liste des réunions', group: 'Meetings', params: [], example: '' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700', POST: 'bg-blue-100 text-blue-700',
  PATCH: 'bg-yellow-100 text-yellow-700', DELETE: 'bg-red-100 text-red-700',
};

export default function APIDocsPage() {
  const { t } = useLangStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const groups = [...new Set(ENDPOINTS.map(e => e.group))];

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documentation API</h1>
        <p className="text-sm text-gray-500 mt-0.5">Authentification : <code className="text-xs bg-gray-100 px-1 rounded">Authorization: Bearer cm_live_xxx</code></p>
      </div>

      {groups.map(group => (
        <div key={group} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <span className="font-semibold text-gray-700 text-sm">{group}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {ENDPOINTS.filter(e => e.group === group).map(ep => {
              const key = `${ep.method}${ep.path}`;
              return (
                <div key={key}>
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left"
                    onClick={() => setExpanded(expanded === key ? null : key)}
                  >
                    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${METHOD_COLORS[ep.method] ?? 'bg-gray-100 text-gray-600'}`}>{ep.method}</span>
                    <code className="text-sm text-gray-800 flex-1">{ep.path}</code>
                    <span className="text-sm text-gray-500">{ep.desc}</span>
                    {expanded === key ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  </button>
                  {expanded === key && (
                    <div className="px-5 pb-4 space-y-3 border-t border-gray-50">
                      {ep.params.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-2">{`${t('settings')}`}</p>
                          <table className="w-full text-xs">
                            <thead><tr className="text-gray-400"><th className="text-left font-medium pb-1">{`${t('name')}`}</th><th className="text-left font-medium pb-1">{`${t('type')}`}</th><th className="text-left font-medium pb-1">*</th><th className="text-left font-medium pb-1">{`${t('description')}`}</th></tr></thead>
                            <tbody>
                              {ep.params.map(p => (
                                <tr key={p.name}><td className="font-mono py-0.5">{p.name}</td><td className="text-blue-600">{p.type}</td><td>{p.required ? '✓' : '—'}</td><td className="text-gray-500">{p.desc}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {ep.example && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">Exemple de requête</p>
                          <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto">{ep.example}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
