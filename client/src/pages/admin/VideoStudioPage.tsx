import React, { useEffect, useState } from 'react';
import { Video, Sparkles, DollarSign, CheckCircle2, XCircle, Loader2, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

type Quality = 'budget' | 'standard' | 'premium';
type Platform = 'linkedin' | 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'whatsapp';

const QUALITY_OPTIONS: { id: Quality; label: string; model: string; price: string; color: string }[] = [
  { id: 'budget',   label: 'Budget',   model: 'Wan 2.2',   price: '0.21$/10s', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { id: 'standard', label: 'Standard', model: 'Kling 2.1', price: '0.70$/10s', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'premium',  label: 'Premium',  model: 'Veo 3',     price: '3.00$/10s', color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

const ALL_PLATFORMS: Platform[] = ['linkedin', 'instagram', 'tiktok', 'facebook', 'youtube', 'whatsapp'];

interface Draft {
  id: string; platform: Platform; status: string; videoUrl: string;
  caption: string; model: string; duration: number; cost: number;
  createdAt?: { seconds: number };
}

export default function VideoStudioPage() {
  const { t } = useLangStore();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    script: '', quality: 'standard' as Quality,
    platforms: ['linkedin', 'instagram'] as Platform[],
    duration: 15, language: 'fr', inputImageUrl: '',
  });

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const data = await api.get('/video/drafts').then(r => r.data.data as Draft[]);
      setDrafts(data);
    } catch { setDrafts([]); }
    finally { setLoadingDrafts(false); }
  };

  useEffect(() => { loadDrafts(); }, []);

  const getEstimate = async () => {
    if (!form.platforms.length) return;
    setEstimating(true);
    try {
      const res = await api.post('/video/estimate', { quality: form.quality, duration: form.duration, platforms: form.platforms });
      setEstimate(res.data.data.estimatedCost as number);
    } catch { setEstimate(null); }
    finally { setEstimating(false); }
  };

  useEffect(() => { if (form.platforms.length) getEstimate(); }, [form.quality, form.duration, form.platforms]);

  const generate = async () => {
    if (!form.script || !form.platforms.length) {
      setFeedback({ type: 'error', text: 'Script et plateformes requis' }); return;
    }
    setGenerating(true);
    try {
      const res = await api.post('/video/generate', {
        script: form.script, quality: form.quality,
        platforms: form.platforms, duration: form.duration,
        language: form.language, inputImageUrl: form.inputImageUrl || undefined,
      });
      const count = (res.data.data.videos as unknown[]).length;
      setFeedback({ type: 'success', text: `${count} vidéo(s) générée(s) — en attente d'approbation` });
      setForm(f => ({ ...f, script: '' }));
      loadDrafts();
    } catch (e: unknown) {
      setFeedback({ type: 'error', text: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur de génération' });
    } finally { setGenerating(false); }
  };

  const approve = async (id: string) => {
    await api.patch(`/video/drafts/${id}/approve`).catch(() => {});
    setFeedback({ type: 'success', text: 'Vidéo approuvée !' });
    loadDrafts();
  };

  const reject = async (id: string) => {
    await api.patch(`/video/drafts/${id}/reject`).catch(() => {});
    setFeedback({ type: 'success', text: 'Vidéo rejetée' });
    loadDrafts();
  };

  const togglePlatform = (p: Platform) => setForm(f => ({
    ...f,
    platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
  }));

  const pendingDrafts = (drafts ?? []).filter(d => d.status === 'pending_approval');

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-purple-100">
          <Video size={24} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Studio AI</h1>
          <p className="text-sm text-gray-500">Générez des vidéos multi-plateformes avec l'IA</p>
        </div>
        {pendingDrafts.length > 0 && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-medium">
            <Clock size={14} />
            {pendingDrafts.length} en attente
          </div>
        )}
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span className="flex-1">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Generator */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Sparkles size={16} className="text-purple-600" /> Générer des vidéos</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Script / Prompt *</label>
          <textarea
            rows={4} placeholder="Décrivez votre vidéo... Ex: Présentation de notre nouveau produit Orlode AI pour les PME, ton professionnel, avec sous-titres..."
            value={form.script} onChange={e => setForm(f => ({ ...f, script: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{`${t('priority')}`}</label>
          <div className="flex gap-3">
            {QUALITY_OPTIONS.map(q => (
              <button
                key={q.id}
                onClick={() => setForm(f => ({ ...f, quality: q.id }))}
                className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${form.quality === q.id ? `border-purple-500 bg-purple-50` : `border-gray-200 hover:border-gray-300`}`}
              >
                <div className="font-semibold text-sm text-gray-800">{q.label}</div>
                <div className="text-sm text-gray-500">{q.model}</div>
                <div className={`text-xs font-mono mt-1 px-1.5 py-0.5 rounded inline-block ${q.color}`}>{q.price}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{`${t('platform')}`}</label>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border transition-all ${form.platforms.includes(p) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durée (secondes)</label>
            <input
              type="number" min={5} max={120} step={5}
              value={form.duration} onChange={e => setForm(f => ({ ...f, duration: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{`${t('language')}`}</label>
            <select
              value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Image d'entrée</label>
            <input
              type="url" placeholder="https://... (optionnel)"
              value={form.inputImageUrl} onChange={e => setForm(f => ({ ...f, inputImageUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign size={16} className="text-gray-400" />
            {estimating
              ? <span className="text-gray-400">Calcul en cours...</span>
              : estimate !== null
                ? <span className="font-semibold text-gray-700">Estimation: <span className="text-purple-600">{estimate.toFixed(2)} USD</span></span>
                : <span className="text-gray-400">Sélectionnez des plateformes</span>}
          </div>
          <button
            onClick={generate} disabled={generating || !form.script}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? 'Génération...' : 'Générer'}
          </button>
        </div>
      </div>

      {/* Drafts */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Clock size={16} className="text-orange-500" /> Brouillons en attente</h2>
        {loadingDrafts ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-purple-600" size={24} /></div>
        ) : pendingDrafts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucune vidéo en attente d'approbation</p>
        ) : (
          <div className="space-y-3">
            {pendingDrafts.map(d => (
              <div key={d.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="capitalize text-xs font-semibold text-white bg-purple-600 px-2 py-0.5 rounded-full">{d.platform}</span>
                    <span className="text-sm text-gray-500">{d.model} · {d.duration}s · {d.cost.toFixed(2)}$</span>
                  </div>
                  {d.caption && <p className="text-sm text-gray-700 truncate">{d.caption}</p>}
                  {d.videoUrl && (
                    <a href={d.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block mt-1">
                      Voir la vidéo →
                    </a>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => approve(d.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                    <ThumbsUp size={12} /> Approuver
                  </button>
                  <button onClick={() => reject(d.id)} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100">
                    <ThumbsDown size={12} /> Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
