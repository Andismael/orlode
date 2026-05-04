/**
 * KnowledgeBasePage — FAQ/Knowledge base management
 * Create, edit, search articles for support agents
 */
import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Loader2, BookOpen, X, Save } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

interface Article {
  id: string; title: string; content: string; category: string;
  tags: string[]; createdAt: string;
}

const CATEGORIES = ['general', 'technique', 'facturation', 'compte', 'produit'];

export default function KnowledgeBasePage() {
  const { t } = useLangStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'general', tags: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/support/kb')
      .then(r => setArticles((r.data ?? []) as Article[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setSubmitting(true);
    try {
      const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
      if (editId) {
        await api.patch(`/support/kb/${editId}`, payload);
        setArticles(prev => prev.map(a => a.id === editId ? { ...a, ...payload, tags: payload.tags } : a));
      } else {
        const r = await api.post('/support/kb', payload);
        setArticles(prev => [...prev, r.data as Article]);
      }
      setShowEditor(false);
      setEditId(null);
      setForm({ title: '', content: '', category: 'general', tags: '' });
    } catch {}
    finally { setSubmitting(false); }
  };

  const handleEdit = (a: Article) => {
    setForm({ title: a.title, content: a.content, category: a.category, tags: (a.tags ?? []).join(', ') });
    setEditId(a.id);
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet article ?')) return;
    await api.delete(`/support/kb/${id}`).catch(() => {});
    setArticles(prev => prev.filter(a => a.id !== id));
  };

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || a.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6 max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('knowledge_base')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{articles.length} articles</p>
        </div>
        <button onClick={() => { setForm({ title: '', content: '', category: 'general', tags: '' }); setEditId(null); setShowEditor(true); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-xl hover:shadow-md"
          style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
          <Plus size={14} /> Nouvel article
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
             placeholder={t('search')} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">Toutes les categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={24} /></div>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">{`${t('no_data')}`}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(a => (
          <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{a.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{a.category}</span>
                  {(a.tags ?? []).map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => handleEdit(a)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">{a.content}</p>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{editId ? 'Modifier l\'article' : 'Nouvel article'}</h2>
              <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Titre *</label>
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Comment reinitialiser mon mot de passe ?" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Contenu *</label>
                <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={6}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Ecrivez l'article..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{`${t('category')}`}</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tags (virgules)</label>
                  <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="mot-de-passe, connexion" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{`${t('cancel')}`}</button>
              <button onClick={handleSave} disabled={submitting || !form.title || !form.content}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50 hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
                {submitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                {editId ? 'Mettre a jour' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
