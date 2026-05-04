/**
 * WebsiteEditorPage — Edit generated website section by section
 * /website-editor — accessible from admin
 * Autosave + Publish/Draft toggle
 */
import { useState, useEffect, useCallback } from 'react';
import { Save, Eye, Globe, FileText, Plus, Trash2, GripVertical, Loader2, Check, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';

interface SectionData { [key: string]: unknown }

const SECTION_TYPES = [
  { id: 'hero', label: 'Hero / Banniere', icon: '🏠', fields: ['title', 'subtitle', 'cta'] },
  { id: 'about', label: 'A propos', icon: '📖', fields: ['title', 'description', 'values'] },
  { id: 'services', label: 'Services', icon: '⚡', fields: ['items'] },
  { id: 'products', label: 'Produits', icon: '🛍️', fields: ['items'] },
  { id: 'listings', label: 'Annonces', icon: '📋', fields: ['items'] },
  { id: 'team', label: 'Equipe', icon: '👥', fields: ['items'] },
  { id: 'testimonials', label: 'Temoignages', icon: '⭐', fields: ['items'] },
  { id: 'contact', label: 'Contact', icon: '📞', fields: ['title', 'email', 'phone', 'address'] },
  { id: 'footer', label: 'Footer', icon: '📄', fields: ['description', 'copyright'] },
];

export default function WebsiteEditorPage() {
  const { user } = useAuthStore();
  const companyId = user?.companyId ?? user?.uid ?? '';

  const [content, setContent] = useState<Record<string, SectionData>>({});
  const [meta, setMeta] = useState<{ color: string; template: string; companyName: string; status: string; slug: string }>({
    color: '#6c3ce0', template: 'vitrine', companyName: '', status: 'draft', slug: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  // Load
  useEffect(() => {
    api.get('/website/config').then(r => {
      const d = r.data as Record<string, unknown>;
      if (d) {
        setContent((d['content'] as Record<string, SectionData>) ?? {});
        setMeta({
          color: (d['color'] as string) ?? '#6c3ce0',
          template: (d['template'] as string) ?? 'vitrine',
          companyName: (d['companyName'] as string) ?? '',
          status: (d['status'] as string) ?? 'draft',
          slug: (d['slug'] as string) ?? '',
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Autosave every 30s
  useEffect(() => {
    const interval = setInterval(() => { if (Object.keys(content).length > 0) handleSave(true); }, 30000);
    return () => clearInterval(interval);
  }, [content, meta]);

  const handleSave = useCallback(async (silent = false) => {
    if (!silent) setSaving(true);
    try {
      await api.put('/website/config', { content, ...meta });
      if (!silent) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch {}
    if (!silent) setSaving(false);
  }, [content, meta]);

  const handlePublish = async () => {
    const newStatus = meta.status === 'published' ? 'draft' : 'published';
    setMeta(p => ({ ...p, status: newStatus }));
    setSaving(true);
    try { await api.put('/website/config', { content, ...meta, status: newStatus }); } catch {}
    setSaving(false);
  };

  const updateSection = (section: string, field: string, value: unknown) => {
    setContent(prev => ({ ...prev, [section]: { ...(prev[section] ?? {}), [field]: value } }));
  };

  const updateItemInSection = (section: string, index: number, field: string, value: string) => {
    setContent(prev => {
      const items = [...((prev[section] as unknown[]) ?? [])];
      items[index] = { ...(items[index] as Record<string, unknown>), [field]: value };
      return { ...prev, [section]: items };
    });
  };

  const addItemToSection = (section: string) => {
    setContent(prev => {
      const items = [...((prev[section] as unknown[]) ?? [])];
      if (section === 'services') items.push({ name: '', description: '', icon: '⭐' });
      else if (section === 'products') items.push({ name: '', price: '', description: '', category: '' });
      else if (section === 'listings') items.push({ title: '', location: '', price: '', tags: [] });
      else if (section === 'team') items.push({ name: '', role: '', avatar: '' });
      else if (section === 'testimonials') items.push({ name: '', text: '', company: '' });
      return { ...prev, [section]: items };
    });
  };

  const removeItemFromSection = (section: string, index: number) => {
    setContent(prev => {
      const items = [...((prev[section] as unknown[]) ?? [])];
      items.splice(index, 1);
      return { ...prev, [section]: items };
    });
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-violet-500" size={28} /></div>;

  const siteUrl = meta.slug
    ? `https://${meta.slug}.corpmind.site`
    : `https://orlode.com/site/${companyId}`;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Section list */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Editeur de site</h2>
          <p className="text-xs text-gray-500 mt-0.5">{meta.companyName || 'Mon site'}</p>
        </div>

        {/* Status + actions */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
          <div className="flex gap-2">
            <button onClick={() => handleSave()} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} className="text-green-500" /> : <Save size={12} />}
              {saved ? 'Sauve !' : 'Sauvegarder'}
            </button>
            <a href={siteUrl} target="_blank" className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50">
              <Eye size={12} />
            </a>
          </div>
          <button onClick={handlePublish}
            className={`w-full py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 ${
              meta.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-violet-600 text-white'
            }`}>
            <Globe size={12} />
            {meta.status === 'published' ? 'En ligne — Depublier' : 'Publier le site'}
          </button>
        </div>

        {/* Meta */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Couleur</label>
            <input type="color" value={meta.color} onChange={e => setMeta(p => ({ ...p, color: e.target.value }))}
              className="w-full h-8 rounded cursor-pointer" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">Sous-domaine</label>
            <div className="flex items-center gap-1">
              <input value={meta.slug} onChange={e => setMeta(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-800 rounded text-xs" placeholder="mon-entreprise" />
              <span className="text-[10px] text-gray-400">.corpmind.site</span>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto p-2">
          {SECTION_TYPES.map(s => {
            const hasContent = content[s.id] !== undefined;
            return (
              <button key={s.id} onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm mb-1 transition-colors ${
                  activeSection === s.id ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}>
                <span>{s.icon}</span>
                <span className="flex-1 font-medium text-xs">{s.label}</span>
                {hasContent && <div className="w-2 h-2 rounded-full bg-green-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Editor */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
        {!activeSection ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Selectionnez une section a editer</p>
            <p className="text-xs text-gray-400 mt-1">Cliquez sur une section dans la sidebar</p>
          </div>
        ) : (
          <SectionEditor
            sectionId={activeSection}
            sectionType={SECTION_TYPES.find(s => s.id === activeSection)!}
            data={content[activeSection] ?? (Array.isArray(content[activeSection]) ? [] : {})}
            color={meta.color}
            onChange={(field, value) => updateSection(activeSection, field, value)}
            onItemChange={(idx, field, val) => updateItemInSection(activeSection, idx, field, val)}
            onAddItem={() => addItemToSection(activeSection)}
            onRemoveItem={(idx) => removeItemFromSection(activeSection, idx)}
            fullContent={content}
          />
        )}
      </div>
    </div>
  );
}

// ── Section Editor Component ────────────────────────────────────────────────

function SectionEditor({ sectionId, sectionType, data, color, onChange, onItemChange, onAddItem, onRemoveItem, fullContent }: {
  sectionId: string;
  sectionType: { id: string; label: string; icon: string; fields: string[] };
  data: SectionData | unknown[];
  color: string;
  onChange: (field: string, value: unknown) => void;
  onItemChange: (index: number, field: string, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  fullContent: Record<string, SectionData>;
}) {
  const d = data as Record<string, unknown>;
  const items = Array.isArray(fullContent[sectionId]) ? fullContent[sectionId] as Record<string, unknown>[] : [];

  const inputStyle = "w-full px-3 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500";
  const labelStyle = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1";

  // Simple text fields (hero, about, contact, footer)
  if (['hero', 'about', 'contact', 'footer'].includes(sectionId)) {
    return (
      <div className="max-w-2xl space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="text-2xl">{sectionType.icon}</span> {sectionType.label}
        </h2>
        {sectionType.fields.map(field => (
          <div key={field}>
            <label className={labelStyle}>{field === 'cta' ? 'Bouton CTA' : field}</label>
            {field === 'description' || field === 'values' ? (
              <textarea value={String(d[field] ?? '')} onChange={e => onChange(field, e.target.value)}
                rows={field === 'description' ? 4 : 3} className={inputStyle} placeholder={`${field}...`} />
            ) : (
              <input value={String(d[field] ?? '')} onChange={e => onChange(field, e.target.value)}
                className={inputStyle} placeholder={`${field}...`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // List fields (services, products, listings, team, testimonials)
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="text-2xl">{sectionType.icon}</span> {sectionType.label} ({items.length})
        </h2>
        <button onClick={onAddItem}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg"
          style={{ background: color }}>
          <Plus size={12} /> Ajouter
        </button>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 relative">
          <button onClick={() => onRemoveItem(idx)}
            className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.keys(item).filter(k => k !== 'image').map(field => (
              <div key={field}>
                <label className={labelStyle}>{field}</label>
                <input value={String(item[field] ?? '')} onChange={e => onItemChange(idx, field, e.target.value)}
                  className={inputStyle} placeholder={field} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-gray-400 text-sm mb-3">Aucun element</p>
          <button onClick={onAddItem} className="text-xs text-violet-600 font-medium">+ Ajouter un element</button>
        </div>
      )}
    </div>
  );
}
