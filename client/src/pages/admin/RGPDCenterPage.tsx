import React, { useEffect, useState } from 'react';
import { Shield, Download, Trash2, CheckCircle, Loader } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface DataCategory { category: string; items: string[]; legalBasis: string; sensitivity?: string; }
interface PrivacyReport {
  generatedAt: string;
  dataSubjects: number;
  gdprDeletedUsers: number;
  documentsStored: number;
  biometricProfiles: number;
  retentionPolicy: string;
  dataCategories: DataCategory[];
  userRights: string[];
}
interface AuditLog {
  id: string; action: string; userEmail?: string; timestamp: string; status?: number;
}

const RETENTION: Record<string, string> = {
  'Conversations': '2 ans',
  'Documents': '5 ans',
  'Audit logs': '3 ans',
  'Données utilisateurs': "Jusqu'à suppression",
};

export default function RGPDCenterPage() {
  const { t } = useLangStore();
  const [report, setReport] = useState<PrivacyReport | null>(null);
  const [requests, setRequests] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<PrivacyReport>('/gdpr/privacy-report')
        .then(r => { if (r.data && typeof r.data === 'object') setReport(r.data as PrivacyReport); })
        .catch(() => {}),
      api.get<AuditLog[]>('/gdpr/audit-logs?limit=20')
        .then(r => { if (Array.isArray(r.data)) setRequests(r.data.filter(l => l.action?.includes('gdpr'))); })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleExport = () => {
    window.open('/api/gdpr/export', '_blank');
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      <div className="flex items-center gap-2">
        <Shield size={20} className="text-green-600" />
        <h1 className="text-2xl font-bold text-gray-900">Centre RGPD</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader size={20} className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Registre des traitements</h2>
              <div className="space-y-2 text-sm text-gray-600">
                {(report?.dataCategories ?? [
                  { category: 'Données utilisateurs (Firebase Auth)', items: [], legalBasis: 'Contrat' },
                  { category: 'Conversations IA (Firestore)', items: [], legalBasis: 'Intérêt légitime' },
                  { category: 'Documents indexés (Vector Store)', items: [], legalBasis: 'Contrat' },
                  { category: "Logs d'audit (Firestore)", items: [], legalBasis: 'Intérêt légitime' },
                  { category: 'Analytics usage (Firestore)', items: [], legalBasis: 'Intérêt légitime' },
                ]).map(cat => (
                  <div key={cat.category} className="flex items-start gap-2">
                    <CheckCircle size={13} className={`flex-shrink-0 mt-0.5 ${cat.sensitivity === 'HIGH' ? 'text-orange-500' : 'text-green-500'}`} />
                    <span>{cat.category} <span className="text-xs text-gray-400">— {cat.legalBasis}</span></span>
                  </div>
                ))}
              </div>
              {report && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Utilisateurs', value: report.dataSubjects },
                    { label: t('documents'), value: report.documentsStored },
                    { label: 'Profils biom.', value: report.biometricProfiles },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-gray-900">{s.value}</p>
                      <p className="text-sm text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={handleExport} className="mt-4 flex items-center gap-2 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download size={12} /> Exporter mes données
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Politique de rétention</h2>
              <div className="space-y-2 text-sm">
                {Object.entries(RETENTION).map(([label, retention]) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-900">{retention}</span>
                  </div>
                ))}
              </div>
              {report?.userRights && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Droits applicables</p>
                  <div className="space-y-1">
                    {report.userRights.slice(0, 3).map(r => (
                      <div key={r} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <CheckCircle size={11} className="text-blue-500 flex-shrink-0" />
                        <span>{r.replace(/\(.*\)/, '').trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Demandes de données</h2>
            </div>
            {requests.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Aucune demande RGPD enregistrée</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {[t('name'),t('type'),t('status'),t('date')].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map(req => {
                    const isExport = req.action.includes('export');
                    const ok = !req.status || req.status < 400;
                    return (
                      <tr key={req.id}>
                        <td className="px-4 py-3 text-sm text-gray-800">{req.userEmail ?? '—'}</td>
                        <td className="px-4 py-3">
                          {isExport ? (
                            <span className="flex items-center gap-1 text-xs text-blue-600"><Download size={12} /> Export</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-600"><Trash2 size={12} /> Suppression</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {ok ? 'Complété' : t('pending')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {req.timestamp ? new Date(req.timestamp).toLocaleDateString('fr-FR') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
