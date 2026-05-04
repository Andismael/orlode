import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Search, Image as ImageIcon, Film, Box, Sparkles,
  Upload, Trash2, X, Save, AlertCircle, Check, Edit3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import api from '@/services/api';

interface Agent {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  longDescription?: string;
  category?: string;
  industry?: string;
  features?: string[];
  color?: string;
  coverImage?: string;
  demoVideo?: string;
  model3d?: string;
  screenshots?: string[];
}

type MediaType = 'cover' | 'screenshot' | 'video' | 'model3d';

const ACCEPT_BY_TYPE: Record<MediaType, string> = {
  cover: 'image/png,image/jpeg,image/webp,image/gif',
  screenshot: 'image/png,image/jpeg,image/webp,image/gif',
  video: 'video/mp4,video/webm,video/quicktime',
  model3d: '.glb,.gltf,model/gltf-binary,model/gltf+json',
};

export default function MarketplaceStudioPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Agent | null>(null);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/marketplace/agents');
      const data = (r.data ?? []) as Agent[];
      setAgents(Array.isArray(data) ? data : []);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.industry?.toLowerCase().includes(q),
    );
  }, [agents, search]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-violet-500" size={22} /> Marketplace Studio
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Édite les agents Orlode : photos de couverture, screenshots, vidéos démo, modèles 3D, et description.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded-md font-medium">{agents.length} agents</span>
          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md font-medium">
            {agents.filter(a => a.coverImage).length} avec cover
          </span>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un agent..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(a => (
          <AgentTile key={a.id} agent={a} onEdit={() => setEditing(a)} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-gray-400 py-12 text-sm">Aucun agent ne correspond.</p>
        )}
      </div>

      {editing && (
        <AgentEditorModal
          agent={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setAgents(prev => prev.map(a => (a.id === updated.id ? { ...a, ...updated } : a)));
            setEditing({ ...editing, ...updated });
          }}
        />
      )}
    </div>
  );
}

function AgentTile({ agent, onEdit }: { agent: Agent; onEdit: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-gradient-to-br from-violet-100 via-pink-100 to-amber-100 flex items-center justify-center">
        {agent.coverImage
          ? <img src={agent.coverImage} alt={agent.name} className="w-full h-full object-cover" />
          : <span className="text-5xl">{agent.icon ?? '🤖'}</span>}
        <button
          onClick={onEdit}
          className="absolute top-2 right-2 px-2.5 py-1.5 bg-white/95 hover:bg-white rounded-lg shadow text-xs font-medium text-gray-700 flex items-center gap-1.5"
        >
          <Edit3 size={12} /> Éditer
        </button>
      </div>
      <div className="p-3 flex-1">
        <p className="font-semibold text-gray-900 text-sm truncate">{agent.name}</p>
        <p className="text-xs text-gray-500 line-clamp-2 mt-1">{agent.description ?? '—'}</p>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-0.5"><ImageIcon size={11} />{agent.screenshots?.length ?? 0}</span>
          <span className="flex items-center gap-0.5"><Film size={11} />{agent.demoVideo ? 1 : 0}</span>
          <span className="flex items-center gap-0.5"><Box size={11} />{agent.model3d ? 1 : 0}</span>
        </div>
      </div>
    </div>
  );
}

function AgentEditorModal({
  agent, onClose, onSaved,
}: {
  agent: Agent;
  onClose: () => void;
  onSaved: (agent: Agent) => void;
}) {
  const [tab, setTab] = useState<'media' | 'metadata'>('media');
  const [name, setName] = useState(agent.name ?? '');
  const [description, setDescription] = useState(agent.description ?? '');
  const [longDescription, setLongDescription] = useState(agent.longDescription ?? '');
  const [icon, setIcon] = useState(agent.icon ?? '');
  const [industry, setIndustry] = useState(agent.industry ?? '');
  const [savingMeta, setSavingMeta] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const saveMetadata = async () => {
    setSavingMeta(true);
    try {
      const r = await api.patch(`/marketplace/agents/${agent.id}`, {
        name, description, longDescription, icon, industry,
      });
      onSaved(r.data as Agent);
      showToast('ok', 'Modifications enregistrées.');
    } catch (e: any) {
      showToast('err', e?.message ?? 'Échec de la sauvegarde.');
    } finally {
      setSavingMeta(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <span className="text-2xl">{agent.icon ?? '🤖'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{agent.name}</p>
            <p className="text-xs text-gray-500 truncate">{agent.industry ?? agent.category}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        {/* tabs */}
        <div className="px-5 pt-3 flex gap-2 border-b border-gray-100">
          {(['media', 'metadata'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === t ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'media' ? 'Médias' : 'Métadonnées'}
            </button>
          ))}
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {tab === 'media' && (
            <>
              <CoverEditor agent={agent} onChange={onSaved} onToast={showToast} />
              <ScreenshotsEditor agent={agent} onChange={onSaved} onToast={showToast} />
              <SingleMediaEditor
                agent={agent} type="video" label="Vidéo de démo" icon={Film}
                onChange={onSaved} onToast={showToast}
              />
              <SingleMediaEditor
                agent={agent} type="model3d" label="Modèle 3D (.glb/.gltf)" icon={Box}
                onChange={onSaved} onToast={showToast}
              />
            </>
          )}

          {tab === 'metadata' && (
            <div className="space-y-4">
              <Field label="Nom">
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Icône (emoji)">
                <input value={icon} onChange={e => setIcon(e.target.value)} className={inputCls} maxLength={4} />
              </Field>
              <Field label="Industrie">
                <input value={industry} onChange={e => setIndustry(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Description courte">
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={inputCls} />
              </Field>
              <Field label="Description longue">
                <textarea value={longDescription} onChange={e => setLongDescription(e.target.value)} rows={6} className={inputCls} />
              </Field>
              <button
                onClick={saveMetadata}
                disabled={savingMeta}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2"
              >
                {savingMeta ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          )}
        </div>

        {toast && (
          <div className={`mx-5 mb-5 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
            toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {toast.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Cover editor: upload OR generate with AI ───────────────────────────────
function CoverEditor({
  agent, onChange, onToast,
}: {
  agent: Agent;
  onChange: (a: Agent) => void;
  onToast: (type: 'ok' | 'err', msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/marketplace/agents/${agent.id}/media?type=cover`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = (r.data as { url: string }).url;
      onChange({ ...agent, coverImage: url });
      onToast('ok', 'Cover mise à jour.');
    } catch (e: any) {
      onToast('err', e?.message ?? 'Échec upload.');
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await api.post(`/marketplace/agents/${agent.id}/generate-cover`, { prompt: aiPrompt.trim() || undefined });
      const url = (r.data as { url: string }).url;
      onChange({ ...agent, coverImage: url });
      onToast('ok', 'Cover générée par IA.');
    } catch (e: any) {
      onToast('err', e?.message ?? 'IA indisponible — utilisez l\'upload.');
    } finally {
      setGenerating(false);
    }
  };

  const remove = async () => {
    if (!confirm('Supprimer la cover actuelle ?')) return;
    setBusy(true);
    try {
      await api.delete(`/marketplace/agents/${agent.id}/media/cover`);
      onChange({ ...agent, coverImage: undefined });
      onToast('ok', 'Cover supprimée.');
    } catch (e: any) {
      onToast('err', e?.message ?? 'Échec suppression.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <ImageIcon size={14} /> Cover image
      </h3>
      <div className="aspect-video rounded-xl bg-gradient-to-br from-violet-100 to-pink-100 overflow-hidden border border-gray-100 mb-3">
        {agent.coverImage
          ? <img src={agent.coverImage} alt="cover" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Aucune cover</div>}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <label className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2">
          <Upload size={14} />
          {busy ? 'Upload…' : 'Téléverser'}
          <input
            type="file"
            accept={ACCEPT_BY_TYPE.cover}
            className="hidden"
            disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }}
          />
        </label>
        {agent.coverImage && (
          <button
            onClick={remove}
            disabled={busy}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg flex items-center gap-2"
          >
            <Trash2 size={14} /> Supprimer
          </button>
        )}
      </div>
      <div className="bg-violet-50/50 rounded-xl p-3 space-y-2 border border-violet-100">
        <p className="text-xs text-violet-700 font-medium flex items-center gap-1.5">
          <Sparkles size={12} /> Générer avec l'IA (Imagen)
        </p>
        <textarea
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder="Prompt optionnel (laisse vide pour l'auto)"
          rows={2}
          className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          onClick={generate}
          disabled={generating}
          className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2"
        >
          {generating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
          Générer la cover
        </button>
      </div>
    </section>
  );
}

// ── Screenshots: multiple, with add/remove ─────────────────────────────────
function ScreenshotsEditor({
  agent, onChange, onToast,
}: {
  agent: Agent;
  onChange: (a: Agent) => void;
  onToast: (type: 'ok' | 'err', msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const screenshots = agent.screenshots ?? [];

  const add = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/marketplace/agents/${agent.id}/media?type=screenshot`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = (r.data as { url: string }).url;
      onChange({ ...agent, screenshots: [...screenshots, url] });
      onToast('ok', 'Screenshot ajouté.');
    } catch (e: any) {
      onToast('err', e?.message ?? 'Échec upload.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (url: string) => {
    setBusy(true);
    try {
      await api.delete(`/marketplace/agents/${agent.id}/media/screenshot`, { params: { url } });
      onChange({ ...agent, screenshots: screenshots.filter(s => s !== url) });
      onToast('ok', 'Screenshot supprimé.');
    } catch (e: any) {
      onToast('err', e?.message ?? 'Échec suppression.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <ImageIcon size={14} /> Screenshots ({screenshots.length})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        {screenshots.map((url) => (
          <div key={url} className="relative aspect-video rounded-lg overflow-hidden border border-gray-100 group">
            <img src={url} alt="screenshot" className="w-full h-full object-cover" />
            <button
              onClick={() => void remove(url)}
              disabled={busy}
              className="absolute top-1 right-1 p-1 bg-rose-600/90 text-white rounded opacity-0 group-hover:opacity-100 transition"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <label className="inline-block px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium cursor-pointer">
        <span className="flex items-center gap-2"><Upload size={14} />{busy ? 'Upload…' : 'Ajouter un screenshot'}</span>
        <input
          type="file"
          accept={ACCEPT_BY_TYPE.screenshot}
          className="hidden"
          disabled={busy}
          onChange={e => { const f = e.target.files?.[0]; if (f) void add(f); e.target.value = ''; }}
        />
      </label>
    </section>
  );
}

// ── Single media (video / model3d) ─────────────────────────────────────────
function SingleMediaEditor({
  agent, type, label, icon: Icon, onChange, onToast,
}: {
  agent: Agent;
  type: 'video' | 'model3d';
  label: string;
  icon: LucideIcon;
  onChange: (a: Agent) => void;
  onToast: (type: 'ok' | 'err', msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const url = type === 'video' ? agent.demoVideo : agent.model3d;

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/marketplace/agents/${agent.id}/media?type=${type}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = (r.data as { url: string }).url;
      onChange(type === 'video' ? { ...agent, demoVideo: newUrl } : { ...agent, model3d: newUrl });
      onToast('ok', `${label} mis à jour.`);
    } catch (e: any) {
      onToast('err', e?.message ?? 'Échec upload.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Supprimer ${label.toLowerCase()} ?`)) return;
    setBusy(true);
    try {
      await api.delete(`/marketplace/agents/${agent.id}/media/${type}`);
      onChange(type === 'video' ? { ...agent, demoVideo: undefined } : { ...agent, model3d: undefined });
      onToast('ok', `${label} supprimé.`);
    } catch (e: any) {
      onToast('err', e?.message ?? 'Échec suppression.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <Icon size={14} /> {label}
      </h3>
      {url
        ? (
          <div className="space-y-2">
            {type === 'video'
              ? <video src={url} controls className="w-full max-h-72 rounded-lg bg-black" />
              : <a href={url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline text-sm break-all">{url}</a>}
          </div>
        )
        : <p className="text-sm text-gray-400 mb-2">Aucun fichier.</p>}
      <div className="flex gap-2 mt-2">
        <label className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2">
          <Upload size={14} />{busy ? 'Upload…' : url ? 'Remplacer' : 'Téléverser'}
          <input
            type="file"
            accept={ACCEPT_BY_TYPE[type as MediaType]}
            className="hidden"
            disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }}
          />
        </label>
        {url && (
          <button
            onClick={remove}
            disabled={busy}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg flex items-center gap-2"
          >
            <Trash2 size={14} /> Supprimer
          </button>
        )}
      </div>
    </section>
  );
}
