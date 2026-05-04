/**
 * CompetitorTrackerPage — Add, list, analyze competitors
 */
import { useEffect, useState } from 'react';
import { Eye, Plus, X, Loader2, Sparkles, Trash2, Globe, ExternalLink } from 'lucide-react';
import api from '@/services/api';

interface Competitor { id: string; name: string; website: string; sector: string; notes: string; addedAt: string }

export default function CompetitorTrackerPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', website: '', sector: '', notes: '' });

  const load = () => { setLoading(true); api.get('/news/competitors').then(r => setCompetitors((r.data as { data?: Competitor[] })?.data ?? [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleAdd = async () => { if (!form.name) return; setSubmitting(true); await api.post('/news/competitors', form).catch(() => {}); setSubmitting(false); setShowAdd(false); setForm({ name: '', website: '', sector: '', notes: '' }); load(); };
  const handleDelete = async (id: string) => { if (!confirm('Supprimer ?')) return; await api.delete(`/news/competitors/${id}`).catch(() => {}); load(); };
  const handleAnalyze = async (id: string) => { setAnalyzing(id); setAnalysis(null); const r = await api.post(`/news/competitors/${id}/analyze`).catch(() => ({ data: { data: { analysis: 'Analyse indisponible.' } } })); setAnalysis(((r.data as { data?: { analysis?: string } })?.data?.analysis) ?? 'Analyse indisponible.'); setAnalyzing(null); };

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Suivi concurrents</h1><p className="text-sm text-gray-500">Surveiller, analyser, comparer</p></div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}><Plus size={14} /> Ajouter</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div> : (
        competitors.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100"><Eye size={40} className="mx-auto text-gray-300 mb-4" /><h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun concurrent</h3><p className="text-sm text-gray-400">Ajoutez vos concurrents pour les surveiller.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {competitors.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><Eye size={18} /></div>
                    <div><h3 className="text-sm font-bold text-gray-900">{c.name}</h3>{c.sector && <p className="text-xs text-gray-400">{c.sector}</p>}</div>
                  </div>
                  <div className="flex gap-1">
                    {c.website && <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Globe size={14} /></a>}
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
                {c.notes && <p className="text-xs text-gray-500 mb-3">{c.notes}</p>}
                <button onClick={() => handleAnalyze(c.id)} disabled={analyzing === c.id} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                  {analyzing === c.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {analyzing === c.id ? 'Analyse en cours...' : 'Analyser avec IA'}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Analysis modal */}
      {analysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAnalysis(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Analyse concurrentielle</h2><button onClick={() => setAnalysis(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{analysis}</div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-gray-900">Ajouter un concurrent</h2><button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Site web</label><input value={form.website} onChange={e => setForm({...form, website: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="https://..." /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Secteur</label><input value={form.sector} onChange={e => setForm({...form, sector: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" /></div>
              <div><label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none" rows={2} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Annuler</button>
              <button onClick={handleAdd} disabled={submitting || !form.name} className="px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}>{submitting ? <Loader2 className="animate-spin" size={14} /> : 'Ajouter'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
