import React, { useState } from 'react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { AlertTriangle, Trash2 } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DangerAction { id: string; icon: React.ComponentType<any>; label: string; desc: string; color: string; action: () => void; }

function ConfirmModal({ action, onClose }: { action: DangerAction; onClose: () => void }) {
  const { t } = useLangStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const execute = async () => {
    setLoading(true);
    try { await action.action(); onClose(); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <h3 className="font-bold text-gray-900">{action.label}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">{action.desc}</p>
        <p className="text-sm text-gray-700 mb-2">Tapez <strong>CONFIRMER</strong> pour continuer :</p>
        <input value={input} onChange={e => setInput(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="CONFIRMER" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">{`${t('cancel')}`}</button>
          <button onClick={execute} disabled={input !== 'CONFIRMER' || loading}
            className="flex-1 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50 bg-red-600 hover:bg-red-700">
            {loading ? 'Exécution...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DangerZonePage() {
  const [modalAction, setModalAction] = useState<DangerAction | null>(null);

  // Only ship actions whose backend endpoint actually exists. The 3 missing ones
  // (reset-knowledge-base, delete-connectors, export-data) used to silently
  // .catch(() => {}) on click — better to remove them than let admins click and
  // think their data is gone when nothing happened. Will re-add when wired.
  const ACTIONS: DangerAction[] = [
    {
      id: 'delete-company', icon: Trash2, label: 'Supprimer le compte entreprise',
      desc: 'Supprime TOUT : compte, données, utilisateurs, documents. Définitif.',
      color: 'border-red-200 bg-red-50',
      action: () => api.delete('/company'),
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} className="text-red-500" />
        <h1 className="text-2xl font-bold text-gray-900">Zone Danger</h1>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        Ces actions sont irréversibles. Lisez attentivement avant de continuer.
      </div>
      <div className="space-y-3">
        {ACTIONS.map(action => {
          const Icon = action.icon;
          return (
            <div key={action.id} className={`rounded-xl border p-4 flex items-center justify-between ${action.color}`}>
              <div className="flex items-start gap-3">
                <Icon size={16} className="mt-0.5 text-gray-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{action.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{action.desc}</p>
                </div>
              </div>
              <button onClick={() => setModalAction(action)}
                className="flex-shrink-0 ml-4 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors">
                Exécuter
              </button>
            </div>
          );
        })}
      </div>
      {modalAction && <ConfirmModal action={modalAction} onClose={() => setModalAction(null)} />}
    </div>
  );
}
