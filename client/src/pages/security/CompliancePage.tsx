/**
 * CompliancePage — RGPD/ISO27001/SOC2 compliance dashboard
 */
import { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface Framework {
  status: string;
  score: number;
  items: Array<{ label: string; done: boolean }>;
}
interface ComplianceData { gdpr: Framework; iso27001: Framework; soc2: Framework }

const STATUS_CFG: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
  compliant: { color: 'bg-green-100 text-green-700', label: 'Conforme', icon: CheckCircle },
  partial: { color: 'bg-amber-100 text-amber-700', label: 'Partiel', icon: AlertCircle },
  not_started: { color: 'bg-gray-100 text-gray-600', label: 'Non commence', icon: XCircle },
};

const FRAMEWORKS: Array<{ key: keyof ComplianceData; name: string; desc: string }> = [
  { key: 'gdpr', name: 'RGPD', desc: 'Reglement general sur la protection des donnees (UE)' },
  { key: 'iso27001', name: 'ISO 27001', desc: 'Systeme de management de la securite de l\'information' },
  { key: 'soc2', name: 'SOC 2', desc: 'Service Organization Control — confiance et securite' },
];

export default function CompliancePage() {
  const { t } = useLangStore();
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/security/compliance').then(r => setData(r.data as ComplianceData)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  const d = data ?? { gdpr: { status: 'not_started', score: 0, items: [] }, iso27001: { status: 'not_started', score: 0, items: [] }, soc2: { status: 'not_started', score: 0, items: [] } };

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('compliance')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">RGPD, ISO 27001, SOC 2</p>
      </div>

      <div className="space-y-5">
        {FRAMEWORKS.map(fw => {
          const f = d[fw.key];
          const cfg = STATUS_CFG[f.status] ?? STATUS_CFG['not_started'];
          const Icon = cfg.icon;
          return (
            <div key={fw.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Shield size={18} /></div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{fw.name}</h3>
                    <p className="text-xs text-gray-500">{fw.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 ${cfg.color}`}>
                    <Icon size={12} /> {cfg.label}
                  </span>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-gray-900">{f.score}%</div>
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div className={`h-full rounded-full transition-all ${f.score >= 80 ? 'bg-green-500' : f.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${f.score}%` }} />
              </div>
              {/* Checklist */}
              {(f.items ?? []).length > 0 && (
                <div className="space-y-2">
                  {f.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {item.done
                        ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                        : <XCircle size={14} className="text-gray-300 shrink-0" />
                      }
                      <span className={item.done ? 'text-gray-600' : 'text-gray-400'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {(f.items ?? []).length === 0 && (
                <p className="text-xs text-gray-400">Aucun element de checklist configure. L'agent AI peut evaluer votre conformite via le chat.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
