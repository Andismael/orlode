import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Plus, Trash2, Check, Loader } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface ApiKey {
  id: string; name: string; keyPrefix: string; enabled: boolean;
  usageCount: number; createdAt: string; lastUsedAt?: string; scopes: string[];
}
interface Webhook { id: string; url: string; events: string[]; active: boolean; }

export default function PublicAPIDashboardPage() {
  const { t } = useLangStore();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      api.get<ApiKey[]>('/apikeys').then(r => setKeys(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
      api.get<Webhook[]>('/apikeys/webhooks').then(r => setWebhooks(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const revoke = async (id: string) => {
    await api.delete(`/apikeys/${id}`).catch(() => {});
    setKeys(p => p.filter(k => k.id !== id));
  };

  const generate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await api.post<{ id: string; key: string; keyPrefix: string; name: string }>('/apikeys', { name: newKeyName });
      const data = res.data as { id: string; key: string; keyPrefix: string; name: string };
      setCreatedKey(data.key);
      setNewKeyName('');
      setShowCreate(false);
      load();
    } catch { /* ignore */ }
  };

  const totalRequests = keys.reduce((s, k) => s + (k.usageCount ?? 0), 0);
  const activeWebhooks = webhooks.filter(w => w.active).length;

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">API Publique</h1>

      {createdKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm">
          <p className="font-semibold text-yellow-800 mb-1">Clé générée — copiez-la maintenant, elle ne sera plus affichée</p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-xs bg-white border border-yellow-200 rounded px-2 py-1 flex-1 truncate">{createdKey}</code>
            <button onClick={() => copy(createdKey, 'new')} className="p-1.5 hover:bg-yellow-100 rounded">
              {copied === 'new' ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-yellow-700" />}
            </button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="mt-2 text-xs text-yellow-600 hover:underline">J'ai copié la clé</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />
        )) : [
          { label: 'Total requêtes', value: totalRequests.toLocaleString() },
          { label: 'Clés actives', value: keys.filter(k => k.enabled).length.toString() },
          { label: 'Webhooks actifs', value: activeWebhooks.toString() },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Clés API</h2>
          <button onClick={() => setShowCreate(p => !p)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-white rounded-lg"
            style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
            <Plus size={13} /> Générer
          </button>
        </div>

        {showCreate && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex gap-2">
            <input
              type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              placeholder="Nom de la clé (ex: CRM Integration)"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
            <button onClick={generate} className="px-3 py-2 text-sm text-white rounded-lg" style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              Créer
            </button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100">{`${t('cancel')}`}</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader size={16} className="animate-spin text-gray-400" /></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {keys.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">Aucune clé API — cliquez sur Générer pour en créer une</p>
            ) : keys.map(key => (
              <div key={key.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{key.name}</p>
                  <p className="text-xs font-mono text-gray-500">{key.keyPrefix}</p>
                </div>
                <div className="text-xs text-gray-400 text-right">
                  <p>{key.usageCount.toLocaleString()} req.</p>
                  {key.lastUsedAt && <p>Dern. : {new Date(key.lastUsedAt).toLocaleDateString('fr-FR')}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${key.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {key.enabled ? 'Active' : 'Révoquée'}
                </span>
                <button onClick={() => copy(key.keyPrefix, key.id)} className="p-2 hover:bg-gray-100 rounded">
                  {copied === key.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} className="text-gray-400" />}
                </button>
                <button onClick={() => revoke(key.id)} className="p-2 hover:bg-red-50 rounded">
                  <Trash2 size={13} className="text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/admin/api-docs" className="block p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-300 transition-all">
          <p className="font-medium text-gray-900 text-sm">Documentation</p>
          <p className="text-xs text-gray-500 mt-0.5">Explorer les endpoints et les exemples</p>
        </Link>
        <Link to="/admin/webhooks" className="block p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-300 transition-all">
          <p className="font-medium text-gray-900 text-sm">Webhooks</p>
          <p className="text-xs text-gray-500 mt-0.5">{activeWebhooks} webhook{activeWebhooks !== 1 ? 's' : ''} actif{activeWebhooks !== 1 ? 's' : ''} configuré{activeWebhooks !== 1 ? 's' : ''}</p>
        </Link>
      </div>
    </div>
  );
}
