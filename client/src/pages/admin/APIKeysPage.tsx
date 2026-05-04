import React, { useState } from 'react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface APIKeyEntry {
  id: string; label: string; envKey: string; placeholder: string;
  required: boolean; status: 'valid' | 'invalid' | 'unknown'; value: string; visible: boolean;
}

const INITIAL_KEYS: APIKeyEntry[] = [
  { id: 'gemini', label: 'Google Gemini', envKey: 'GOOGLE_AI_API_KEY', placeholder: 'AIza...', required: true, status: 'unknown', value: '', visible: false },
  { id: 'anthropic', label: 'Anthropic (Claude)', envKey: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-...', required: true, status: 'unknown', value: '', visible: false },
  { id: 'openai', label: 'OpenAI (optionnel)', envKey: 'OPENAI_API_KEY', placeholder: 'sk-...', required: false, status: 'unknown', value: '', visible: false },
  { id: 'pinecone', label: 'Pinecone', envKey: 'PINECONE_API_KEY', placeholder: 'pcsk_...', required: true, status: 'unknown', value: '', visible: false },
];

export default function APIKeysPage() {
  const { t } = useLangStore();
  const [keys, setKeys] = useState(INITIAL_KEYS);
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (id: string, value: string) => setKeys(p => p.map(k => k.id === id ? { ...k, value, status: 'unknown' } : k));
  const toggleVisible = (id: string) => setKeys(p => p.map(k => k.id === id ? { ...k, visible: !k.visible } : k));

  const test = async (id: string) => {
    const key = keys.find(k => k.id === id);
    if (!key || !key.value) return;
    setTesting(id);
    try {
      await api.post('/setup/test-key', { provider: id, apiKey: key.value });
      setKeys(p => p.map(k => k.id === id ? { ...k, status: 'valid' } : k));
    } catch {
      setKeys(p => p.map(k => k.id === id ? { ...k, status: 'invalid' } : k));
    } finally { setTesting(null); }
  };

  const testAll = () => keys.forEach(k => { if (k.value) test(k.id); });

  const statusIcon = (status: string) => {
    if (status === 'valid') return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'invalid') return <AlertCircle size={14} className="text-red-500" />;
    return null;
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clés API</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez vos clés API pour les modèles d'IA</p>
        </div>
        <button onClick={testAll}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
          Tester toutes les clés
        </button>
      </div>

      <div className="space-y-3">
        {keys.map(key => (
          <div key={key.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">{key.label}</span>
                {key.required && <span className="text-xs text-red-500">requis</span>}
                {statusIcon(key.status)}
              </div>
              <span className="text-xs text-gray-400 font-mono">{key.envKey}</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={key.visible ? 'text' : 'password'}
                  value={key.value}
                  onChange={e => update(key.id, e.target.value)}
                  className="w-full pr-8 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={key.placeholder}
                />
                <button onClick={() => toggleVisible(key.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {key.visible ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button onClick={() => test(key.id)} disabled={!key.value || testing === key.id}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
                {testing === key.id ? <Loader size={13} className="animate-spin" /> : null}
                Tester
              </button>
            </div>
            {key.status === 'valid' && <p className="text-xs text-green-600 mt-1">✓ Clé valide</p>}
            {key.status === 'invalid' && <p className="text-xs text-red-600 mt-1">✗ Clé invalide ou expirée</p>}
          </div>
        ))}
      </div>

      <button onClick={async () => {
        setSaving(true);
        try {
          const payload: Record<string, string> = {};
          keys.forEach(k => { if (k.value) payload[k.envKey] = k.value; });
          await api.post('/setup/save-keys', payload);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        } catch {}
        setSaving(false);
      }} disabled={saving}
        className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-all"
        style={{ background: saved ? '#16a34a' : '#0055FF' }}>
        {saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé !' : 'Enregistrer les clés'}
      </button>
    </div>
  );
}
