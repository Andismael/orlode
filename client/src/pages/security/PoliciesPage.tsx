/**
 * PoliciesPage — Security policies management, AI generation, versioning
 */
import { useEffect, useState } from 'react';
import { Shield, Plus, X, Loader2, Sparkles, FileText, CheckCircle } from 'lucide-react';
import api from '@/services/api';

interface Policy { id: string; title: string; category: string; status: string; version: string; content?: string; updatedAt?: string; createdAt?: string }

const CATEGORIES = [
  { id: 'password', label: 'Mot de passe' },
  { id: 'access', label: 'Controle d\'acces' },
  { id: 'data', label: 'Protection des donnees' },
  { id: 'incident', label: 'Reponse incident' },
  { id: 'acceptable_use', label: 'Usage acceptable' },
  { id: 'byod', label: 'BYOD' },
  { id: 'remote_work', label: 'Teletravail' },
  { id: 'general', label: 'General' },
];

const STATUS_C: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-700', published: 'bg-green-100 text-green-700', archived: 'bg-gray-100 text-gray-600' };

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'general', content: '' });
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/security/policies').then(r => setPolicies((r.data as { data?: Policy[] })?.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.title) return; setSubmitting(true);
    await api.post('/security/policies', form).catch(() => {});
    setSubmitting(false); setShowCreate(false); setForm({ title: '', category: 'general', content: '' }); load();
  };

  const handleGenerate = async () => {
    if (!form.title && !form.category) return; setGenerating(true);
    const r = await api.post('/security/policies/generate', { title: form.title || `Politique ${form.category}`, category: form.category }).catch(() => ({ data: { data: {} } }));
    const result = (r.data as { data?: { generatedContent?: string; policies?: Policy[] } })?.data;
    if (result?.generatedContent) setForm({ ...form, content: result.generatedContent });
    setGenerating(false); load();
  };

  const viewPolicy = async (id: string) => {
    const r = await api.get(`/security/policies/${id}`).catch(() => ({ data: { data: null } }));
    setSelectedPolicy((r.data as { data?: Policy })?.data ?? null);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Politiques de securite</h1><p className="text-sm text-gray-500">Creez, gerez et generez avec IA</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}><Plus size={14} /> Nouvelle politique</button>
      </div>

      {/* Policy grid */}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        policies.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <Shield size={40} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune politique</h3>
            <p className="text-sm text-gray-400">Generez votre premiere politique de securite avec l'IA.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {policies.map(p => (
              <div key={p.id} onClick={() => viewPolicy(p.id)} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600"><FileText size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{p.title}</h3>
                    <p className="text-xs text-gray-400">{CATEGORIES.find(c => c.id === p.category)?.label ?? p.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_C[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                  <span className="text-xs text-gray-400">v{p.version}</span>
                  <span className="text-xs text-gray-400 ml-auto">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('fr-FR') : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* View policy modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedPolicy(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h2 className="text-lg font-bold text-gray-900">{selectedPolicy.title}</h2><p className="text-xs text-gray-400">{selectedPolicy.category} · v{selectedPolicy.version} · {selectedPolicy.status}</p></div>
              <button onClick={() => setSelectedPolicy(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{selectedPolicy.content || 'Aucun contenu.'}</div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Nouvelle politique</h2><button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Ex: Politique de mot de passe" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Categorie</label><select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
              <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-xl w-full justify-center disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #7C3AED, #9333EA)' }}>
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {generating ? 'Generation IA...' : 'Generer avec IA'}
              </button>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Contenu</label><textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" rows={10} placeholder="Contenu de la politique..." /></div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
              <button onClick={handleCreate} disabled={submitting || !form.title} className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)' }}>{submitting ? <Loader2 className="animate-spin" size={14} /> : 'Creer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
