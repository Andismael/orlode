/**
 * AgentBuilderPage — Create or edit an AI agent
 * Form with name, description, system prompt, pricing, etc.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Loader2, Save, ArrowLeft, Sparkles, Eye, Send,
} from 'lucide-react';
import api from '@/services/api';

const ICONS = ['🤖', '🏠', '🏥', '💄', '👗', '🍽️', '🔧', '🏗️', '💇', '🪵', '📊', '🎯', '💡', '🛒', '🎓', '🌍', '⚡', '🔬', '🎨', '📱'];
const CATEGORIES = ['industry', 'productivity', 'analytics', 'communication', 'finance', 'operations'];
const PRICING_MODELS = [
  { value: 'free', label: 'Gratuit' },
  { value: 'monthly', label: 'Mensuel' },
  { value: 'one_time', label: 'Unique' },
];
const COLORS = [
  'from-blue-500 to-cyan-500', 'from-violet-500 to-purple-500', 'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500', 'from-green-500 to-emerald-500', 'from-red-500 to-pink-500',
  'from-gray-600 to-gray-800', 'from-blue-600 to-indigo-600', 'from-yellow-600 to-amber-600',
];

const AI_MODELS = [
  { value: 'gemini-flash', label: 'Google Gemini Flash', desc: 'Rapide et economique', icon: '⚡', provider: 'google', placeholder: 'AIza...' },
  { value: 'gemini-pro', label: 'Google Gemini Pro', desc: 'Plus puissant, multimodal', icon: '🧠', provider: 'google', placeholder: 'AIza...' },
  { value: 'gpt-4o', label: 'OpenAI GPT-4o', desc: 'Tres puissant, polyvalent', icon: '🟢', provider: 'openai', placeholder: 'sk-...' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini', desc: 'Rapide et economique', icon: '🟢', provider: 'openai', placeholder: 'sk-...' },
  { value: 'claude-sonnet', label: 'Claude Sonnet 4', desc: 'Excellent en analyse et code', icon: '🟠', provider: 'anthropic', placeholder: 'sk-ant-...' },
  { value: 'claude-haiku', label: 'Claude Haiku 4', desc: 'Ultra rapide, tres economique', icon: '🟠', provider: 'anthropic', placeholder: 'sk-ant-...' },
];

const API_KEY_LINKS: Record<string, string> = {
  google: 'aistudio.google.com/apikey',
  openai: 'platform.openai.com/api-keys',
  anthropic: 'console.anthropic.com/settings/keys',
};

interface AgentForm {
  name: string; description: string; longDescription: string;
  icon: string; category: string; industry: string;
  features: string[]; systemPrompt: string;
  pricingModel: string; priceUSD: number; color: string;
  aiModel: string; aiApiKey: string;
}

const DEFAULT_FORM: AgentForm = {
  name: '', description: '', longDescription: '',
  icon: '🤖', category: 'industry', industry: '',
  features: [''], systemPrompt: '',
  pricingModel: 'free', priceUSD: 0, color: 'from-blue-500 to-cyan-500',
  aiModel: 'gemini-flash', aiApiKey: '',
};

export default function AgentBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<AgentForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (isEdit) loadAgent();
  }, [id]);

  const loadAgent = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/marketplace/agents/${id}`);
      const a = res.data as Record<string, unknown>;
      setForm({
        name: (a['name'] as string) ?? '',
        description: (a['description'] as string) ?? '',
        longDescription: (a['longDescription'] as string) ?? '',
        icon: (a['icon'] as string) ?? '🤖',
        category: (a['category'] as string) ?? 'industry',
        industry: (a['industry'] as string) ?? '',
        features: (a['features'] as string[]) ?? [''],
        systemPrompt: (a['systemPrompt'] as string) ?? '',
        pricingModel: (a['pricingModel'] as string) ?? 'free',
        priceUSD: (a['priceUSD'] as number) ?? 0,
        color: (a['color'] as string) ?? 'from-blue-500 to-cyan-500',
        aiModel: (a['aiModel'] as string) ?? 'gemini-flash',
        aiApiKey: (a['aiApiKey'] as string) ?? '',
      });
    } catch { setError('Agent introuvable'); }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.description || !form.systemPrompt) {
      setError('Nom, description et system prompt requis');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/creator/agents/${id}`, form);
      } else {
        await api.post('/creator/agents', form);
      }
      navigate('/creator');
    } catch (err) {
      setError(String(err));
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    await handleSave();
    if (isEdit) {
      try { await api.post(`/creator/agents/${id}/submit`); } catch {}
    }
  };

  const updateFeature = (i: number, val: string) => {
    const f = [...form.features];
    f[i] = val;
    setForm({ ...form, features: f });
  };
  const addFeature = () => setForm({ ...form, features: [...form.features, ''] });
  const removeFeature = (i: number) => setForm({ ...form, features: form.features.filter((_, j) => j !== i) });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/creator')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Modifier l\'agent' : 'Creer un nouvel agent'}
          </h1>
          <p className="text-sm text-gray-500">Definissez le comportement de votre agent IA</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">{error}</div>}

      {/* Preview toggle */}
      <button onClick={() => setPreview(!preview)}
        className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700">
        <Eye size={14} /> {preview ? 'Fermer apercu' : 'Apercu'}
      </button>

      {preview && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-2 bg-gradient-to-r ${form.color}`} />
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{form.icon}</span>
              <div>
                <p className="text-lg font-bold text-gray-900">{form.name || 'Nom de l\'agent'}</p>
                <p className="text-sm text-gray-500">{form.industry || 'Industrie'}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-3">{form.description || 'Description...'}</p>
            {form.features.filter(Boolean).length > 0 && (
              <ul className="space-y-1">
                {form.features.filter(Boolean).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-500 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Icon picker */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Icone</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setForm({ ...form, icon: ic })}
                className={`text-2xl p-1.5 rounded-lg border ${form.icon === ic ? 'border-violet-500 bg-violet-50' : 'border-transparent hover:bg-gray-50'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nom *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Agent Restaurant" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description courte *</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Prise de commandes automatique et gestion du restaurant" />
        </div>

        {/* Long description */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description detaillee</label>
          <textarea value={form.longDescription} onChange={e => setForm({ ...form, longDescription: e.target.value })}
            rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Description complete de ce que fait l'agent..." />
        </div>

        {/* Industry + Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Industrie</label>
            <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Restauration" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Categorie</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Couleur</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })}
                className={`w-10 h-6 rounded-lg bg-gradient-to-r ${c} ${form.color === c ? 'ring-2 ring-violet-500 ring-offset-2' : ''}`} />
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fonctionnalites</label>
          {form.features.map((f, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={f} onChange={e => updateFeature(i, e.target.value)}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                placeholder="Ex: Prend les commandes automatiquement" />
              {form.features.length > 1 && (
                <button onClick={() => removeFeature(i)} className="text-red-400 hover:text-red-600 text-sm px-2">×</button>
              )}
            </div>
          ))}
          <button onClick={addFeature} className="text-xs text-violet-600 hover:text-violet-700">+ Ajouter</button>
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            System Prompt * <span className="font-normal text-gray-400">(Instructions pour l'IA)</span>
          </label>
          <textarea value={form.systemPrompt} onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
            rows={6} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Tu es un assistant specialise pour les restaurants. Tu aides a prendre les commandes, gerer les reservations..." />
          <p className="text-xs text-gray-400 mt-1">Ce prompt definit le comportement de votre agent. Soyez precis et detaille.</p>
        </div>

        {/* AI Model */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Moteur IA <span className="font-normal text-gray-400">(quel modele propulse votre agent)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AI_MODELS.map(m => (
              <button key={m.value} type="button" onClick={() => setForm({ ...form, aiModel: m.value })}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  form.aiModel === m.value ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}>
                <span className="text-xl">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.label}</p>
                  <p className="text-[10px] text-gray-500">{m.desc}</p>
                </div>
                {form.aiModel === m.value && <span className="text-violet-600 font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* API Key — required for ALL models (BYOK) */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            Cle API {(() => { const m = AI_MODELS.find(m => m.value === form.aiModel); return m?.provider === 'google' ? 'Google AI' : m?.provider === 'openai' ? 'OpenAI' : 'Anthropic'; })()} *
          </label>
          <input type="password" value={form.aiApiKey} onChange={e => setForm({ ...form, aiApiKey: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder={AI_MODELS.find(m => m.value === form.aiModel)?.placeholder ?? 'Votre cle API'} />
          <p className="text-xs text-gray-400 mt-1.5">
            🔒 Votre cle est chiffree et utilisee uniquement pour votre agent.
            Obtenez une cle sur <strong>{API_KEY_LINKS[AI_MODELS.find(m => m.value === form.aiModel)?.provider ?? 'google']}</strong>
          </p>
          <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              💡 <strong>BYOK (Bring Your Own Key)</strong> — Chaque creator utilise sa propre cle API. Vous controlez vos couts et vos limites directement avec le fournisseur IA.
            </p>
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Modele de prix</label>
            <select value={form.pricingModel} onChange={e => setForm({ ...form, pricingModel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
              {PRICING_MODELS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {form.pricingModel !== 'free' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Prix (USD)</label>
              <input type="number" min={0} step={1} value={form.priceUSD}
                onChange={e => setForm({ ...form, priceUSD: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/creator')}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">
          Annuler
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gray-800 rounded-xl hover:bg-gray-900 disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
          Sauvegarder
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
          Sauvegarder & Soumettre
        </button>
      </div>
    </div>
  );
}
