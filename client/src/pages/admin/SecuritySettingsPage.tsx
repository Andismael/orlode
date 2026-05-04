import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Lock } from 'lucide-react';
import { useLangStore } from '@/store/langStore';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`block w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

const MOCK_SESSIONS = [
  { id: '1', device: 'Chrome / Windows', ip: '92.168.1.1', lastActive: '2026-04-04T10:30:00Z', current: true },
  { id: '2', device: 'Safari / iPhone', ip: '92.168.1.45', lastActive: '2026-04-03T18:20:00Z', current: false },
];

export default function SecuritySettingsPage() {
  const { t } = useLangStore();
  const [settings, setSettings] = useState({
    minPasswordLength: 8, requireUppercase: true, requireNumbers: true, requireSymbols: false,
    mfaRequired: false,
    docAccess: 'authenticated',
  });
  const set = (k: string, v: unknown) => setSettings(p => ({ ...p, [k]: v }));

  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{`${t('security')}`}</h1>

      {/* Password policy */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={15} className="text-gray-600" />
          <h2 className="font-semibold text-gray-800">Politique de mots de passe</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Longueur minimale</label>
            <input type="number" min={6} max={32} value={settings.minPasswordLength} onChange={e => set('minPasswordLength', +e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {[
          { key: 'requireUppercase', label: 'Majuscule requise' },
          { key: 'requireNumbers', label: 'Chiffres requis' },
          { key: 'requireSymbols', label: 'Symboles requis' },
          { key: 'mfaRequired', label: 'MFA obligatoire pour tous' },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{item.label}</span>
            <Toggle checked={settings[item.key as keyof typeof settings] as boolean} onChange={() => set(item.key, !settings[item.key as keyof typeof settings])} />
          </div>
        ))}
      </div>

      {/* Active sessions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Shield size={15} className="text-gray-600" />
          <h2 className="font-semibold text-gray-800">Sessions actives</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {MOCK_SESSIONS.map(session => (
            <div key={session.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{session.device}</p>
                  {session.current && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Cette session</span>}
                </div>
                <p className="text-sm text-gray-500">{session.ip} · {new Date(session.lastActive).toLocaleString('fr-FR')}</p>
              </div>
              {!session.current && (
                <button className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                  Révoquer
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/admin/security/audit" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-300 transition-all">
          <FileText size={20} className="text-blue-600" />
          <div><p className="font-medium text-gray-900 text-sm">Audit Logs</p><p className="text-sm text-gray-500">Historique de toutes les actions</p></div>
        </Link>
        <Link to="/admin/security/rgpd" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-300 transition-all">
          <Shield size={20} className="text-green-600" />
          <div><p className="font-medium text-gray-900 text-sm">RGPD</p><p className="text-sm text-gray-500">Registre et demandes de données</p></div>
        </Link>
      </div>

      <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
        Enregistrer
      </button>
    </div>
  );
}
