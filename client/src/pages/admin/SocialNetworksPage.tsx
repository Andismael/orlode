import React, { useEffect, useState } from 'react';
import { Share2, Plug, Unplug, CheckCircle2, XCircle, Loader2, Send, Hash, Zap, Calendar, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';

type Platform = 'linkedin' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'twitter';

interface SocialConn { platform: Platform; accountName?: string; connectedAt?: { seconds: number } }
interface ConnectForm { platform: Platform; accessToken: string; accountId: string; pageId: string; orgId: string; accountName: string }

const PLATFORMS: { id: Platform; label: string; color: string; hint: string }[] = [
  { id: 'linkedin',  label: 'LinkedIn',  color: 'bg-blue-700',  hint: 'Token OAuth LinkedIn + Organization ID' },
  { id: 'instagram', label: 'Instagram', color: 'bg-pink-600',  hint: 'Token Meta Graph + Instagram Account ID' },
  { id: 'facebook',  label: 'Facebook',  color: 'bg-blue-600',  hint: 'Token Meta Graph + Page ID' },
  { id: 'tiktok',    label: 'TikTok',    color: 'bg-gray-900',  hint: 'Token TikTok Content Posting API' },
  { id: 'youtube',   label: 'YouTube',   color: 'bg-red-600',   hint: 'Token OAuth Google + Channel ID' },
  { id: 'twitter',   label: 'Twitter/X', color: 'bg-gray-800',  hint: 'Bearer Token Twitter API v2' },
];

const EMPTY_FORM: ConnectForm = { platform: 'linkedin', accessToken: '', accountId: '', pageId: '', orgId: '', accountName: '' };

export default function SocialNetworksPage() {
  const { t } = useLangStore();
  const [connections, setConnections] = useState<SocialConn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<Platform | null>(null);
  const [form, setForm] = useState<ConnectForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [postForm, setPostForm] = useState({ text: '', videoUrl: '', imageUrl: '', hashtags: '', platforms: [] as Platform[] });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/social/connections').then(r => (r.data ?? []) as SocialConn[]);
      setConnections(data);
    } catch { setConnections([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Read URL params on mount to surface OAuth callback feedback (?connected=meta or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) setFeedback({ type: 'success', text: `${connected} connecté avec succès` });
    if (error) setFeedback({ type: 'error', text: `OAuth échoué : ${decodeURIComponent(error)}` });
    if (connected || error) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const isConnected = (p: Platform) => (connections ?? []).some(c => c.platform === p);
  const connInfo = (p: Platform) => (connections ?? []).find(c => c.platform === p);

  const connect = async () => {
    if (!form.accessToken) { setFeedback({ type: 'error', text: 'Access Token requis' }); return; }
    setSaving(true);
    try {
      await api.post('/social/connect', {
        platform: form.platform,
        accessToken: form.accessToken,
        accountId: form.accountId || undefined,
        pageId: form.pageId || undefined,
        orgId: form.orgId || undefined,
        accountName: form.accountName || undefined,
      });
      setFeedback({ type: 'success', text: `${form.platform} connecté !` });
      setShowForm(null);
      setForm(EMPTY_FORM);
      load();
    } catch (e: unknown) {
      setFeedback({ type: 'error', text: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur' });
    } finally { setSaving(false); }
  };

  const disconnect = async (platform: Platform) => {
    if (!confirm(`Déconnecter ${platform} ?`)) return;
    await api.delete(`/social/disconnect/${platform}`).catch(() => {});
    setFeedback({ type: 'success', text: `${platform} déconnecté` });
    load();
  };

  const publish = async () => {
    if (!postForm.text || postForm.platforms.length === 0) {
      setFeedback({ type: 'error', text: 'Texte et au moins une plateforme requis' }); return;
    }
    setPublishing(true);
    try {
      const res = await api.post('/social/publish', {
        platforms: postForm.platforms,
        text: postForm.text,
        videoUrl: postForm.videoUrl || undefined,
        imageUrl: postForm.imageUrl || undefined,
        hashtags: postForm.hashtags ? postForm.hashtags.split(',').map(h => h.trim()) : [],
      });
      const results = res.data.data as { platform: string; success: boolean; error?: string }[];
      const ok = results.filter(r => r.success).map(r => r.platform).join(', ');
      const ko = results.filter(r => !r.success).map(r => `${r.platform}: ${r.error}`).join('; ');
      if (ok) setFeedback({ type: 'success', text: `Publié sur: ${ok}${ko ? ` | Échec: ${ko}` : ''}` });
      else setFeedback({ type: 'error', text: `Échec: ${ko}` });
      setPostForm({ text: '', videoUrl: '', imageUrl: '', hashtags: '', platforms: [] });
    } catch { setFeedback({ type: 'error', text: 'Erreur de publication' }); }
    finally { setPublishing(false); }
  };

  const togglePlatform = (p: Platform) => {
    setPostForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  // 1-click OAuth for any platform — fetches the redirect URL and opens it
  const connectOAuth = async (platform: 'meta' | 'google' | 'tiktok' | 'linkedin') => {
    try {
      const r: any = await api.get(`/social/${platform}/connect-url`);
      const url = r?.data?.url ?? r?.data?.data?.url;
      if (url) window.location.href = url;
      else setFeedback({ type: 'error', text: `Impossible de générer l'URL OAuth ${platform}` });
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? `Erreur OAuth ${platform}` });
    }
  };
  const connectMetaOAuth = () => connectOAuth('meta');
  const connectGoogleOAuth = () => connectOAuth('google');
  const connectTiktokOAuth = () => connectOAuth('tiktok');
  const connectLinkedInOAuth = () => connectOAuth('linkedin');

  // Full revocation — GDPR-friendly + valorisé par Meta App Review
  const disconnectAll = async () => {
    if (!confirm('Cela va déconnecter TOUTES tes plateformes sociales, supprimer les posts programmés et les médias uploadés. Continuer ?')) return;
    try {
      const r: any = await api.post('/social/disconnect-all');
      const s = r?.data ?? r?.data?.data;
      setFeedback({
        type: 'success',
        text: `Tout déconnecté · ${s?.platforms ?? 0} plateformes · ${s?.scheduledPosts ?? 0} posts programmés · ${s?.mediaFiles ?? 0} médias`,
      });
      load();
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Erreur' });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2 rounded-xl bg-blue-100">
          <Share2 size={24} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Réseaux Sociaux</h1>
          <p className="text-sm text-gray-500">Connectez vos comptes et publiez en un clic</p>
        </div>
        <Link to="/admin/social/composer" className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <Send size={14} /> Composer
        </Link>
        <Link to="/admin/social/posts" className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-50">
          <FileText size={14} /> Mes posts
        </Link>
      </div>

      {/* 1-click Meta OAuth banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-50 to-pink-50 border border-blue-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-pink-500 text-white flex items-center justify-center flex-shrink-0">
          <Zap size={18} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-gray-900 text-sm">Connexion Meta en 1 click</div>
          <div className="text-xs text-gray-600 mt-0.5">
            Connecte ta Page Facebook + ton compte Instagram Business via OAuth — pas de paste de token.
          </div>
        </div>
        <button onClick={connectMetaOAuth} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <Plug size={14} /> Connecter Facebook + Instagram
        </button>
      </div>

      {/* Tout déconnecter — bouton discret dans le coin */}
      {(connections?.length ?? 0) > 0 && (
        <div className="text-right">
          <button
            onClick={disconnectAll}
            className="text-xs text-gray-500 hover:text-red-600 underline"
            title="Révoquer l'accès à toutes les plateformes + supprimer médias et posts programmés"
          >
            Tout déconnecter et supprimer mes données
          </button>
        </div>
      )}

      {/* 1-click YouTube OAuth banner */}
      <div className="rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center flex-shrink-0">
          <Zap size={18} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-gray-900 text-sm">Connexion YouTube en 1 click</div>
          <div className="text-xs text-gray-600 mt-0.5">
            OAuth Google — accès upload vidéos. Refresh token auto pour publier en continu.
          </div>
        </div>
        <button onClick={connectGoogleOAuth} className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <Plug size={14} /> Connecter YouTube
        </button>
      </div>

      {/* 1-click LinkedIn OAuth banner */}
      <div className="rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 p-4 flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-[#0A66C2] text-white flex items-center justify-center flex-shrink-0 font-bold">
          in
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-gray-900 text-sm">Connexion LinkedIn en 1 click</div>
          <div className="text-xs text-gray-600 mt-0.5">
            OAuth perso (token 60j). Posts personnels sans review LinkedIn — Pages d'entreprise nécessitent Marketing Developer Platform approval.
          </div>
        </div>
        <button onClick={connectLinkedInOAuth} className="inline-flex items-center gap-1.5 bg-[#0A66C2] hover:bg-[#084e96] text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <Plug size={14} /> Connecter LinkedIn
        </button>
      </div>

      {/* 1-click TikTok OAuth banner */}
      <div className="rounded-xl bg-gradient-to-r from-gray-50 to-pink-50 border border-gray-300 p-4 flex items-center gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-black to-pink-600 text-white flex items-center justify-center flex-shrink-0 font-bold">
          ♪
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-gray-900 text-sm">Connexion TikTok en 1 click</div>
          <div className="text-xs text-gray-600 mt-0.5">
            Content Posting API — upload vidéos jusqu'à 4 GB. Refresh token 365j.
          </div>
        </div>
        <button onClick={connectTiktokOAuth} className="inline-flex items-center gap-1.5 bg-black hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <Plug size={14} /> Connecter TikTok
        </button>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span className="flex-1">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Platform grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {PLATFORMS.map(p => {
          const connected = isConnected(p.id);
          const info = connInfo(p.id);
          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold text-white px-2 py-1 rounded-md ${p.color}`}>{p.label}</span>
                {connected
                  ? <CheckCircle2 size={16} className="text-green-500" />
                  : <XCircle size={16} className="text-gray-300" />}
              </div>
              {connected && info?.accountName && (
                <p className="text-xs text-gray-500 truncate">{info.accountName}</p>
              )}
              <p className="text-xs text-gray-400">{p.hint}</p>
              <div className="flex gap-2">
                {connected ? (
                  <button onClick={() => disconnect(p.id)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                    <Unplug size={12} /> Déconnecter
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowForm(p.id); setForm({ ...EMPTY_FORM, platform: p.id }); }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Plug size={12} /> Connecter
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Plug size={16} className="text-blue-600" />
            Connecter {PLATFORMS.find(p => p.id === showForm)?.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'accessToken', label: 'Access Token *', type: 'password', placeholder: 'Token OAuth...' },
              { key: 'accountName', label: 'Nom du compte', type: 'text', placeholder: '@moncompte' },
              { key: 'accountId', label: 'Account / User ID', type: 'text', placeholder: '1234567890' },
              { key: 'pageId', label: 'Page ID (Facebook)', type: 'text', placeholder: 'Pour Facebook uniquement' },
              { key: 'orgId', label: 'Organization ID (LinkedIn)', type: 'text', placeholder: 'Pour LinkedIn uniquement' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type={f.type} placeholder={f.placeholder}
                  value={form[f.key as keyof ConnectForm]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={connect} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
              {saving ? 'Connexion...' : 'Connecter'}
            </button>
            <button onClick={() => setShowForm(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">{`${t('cancel')}`}</button>
          </div>
        </div>
      )}

      {/* Publish panel */}
      {(connections ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Send size={16} className="text-blue-600" /> Publier du contenu</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{`${t('platform')}`}</label>
            <div className="flex flex-wrap gap-2">
              {connections.map(c => {
                const p = PLATFORMS.find(x => x.id === c.platform);
                const selected = postForm.platforms.includes(c.platform);
                return (
                  <button
                    key={c.platform}
                    onClick={() => togglePlatform(c.platform)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selected ? `${p?.color ?? 'bg-blue-600'} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {p?.label ?? c.platform}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Texte *</label>
            <textarea
              rows={3} placeholder="Rédigez votre post..."
              value={postForm.text} onChange={e => setPostForm(f => ({ ...f, text: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL Vidéo (optionnel)</label>
              <input
                type="url" placeholder="https://..."
                value={postForm.videoUrl} onChange={e => setPostForm(f => ({ ...f, videoUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL Image (optionnel)</label>
              <input
                type="url" placeholder="https://..."
                value={postForm.imageUrl} onChange={e => setPostForm(f => ({ ...f, imageUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Hash size={12} /> Hashtags (séparés par virgule)</label>
            <input
              type="text" placeholder="ia, innovation, corpmind"
              value={postForm.hashtags} onChange={e => setPostForm(f => ({ ...f, hashtags: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={publish} disabled={publishing} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {publishing ? 'Publication...' : 'Publier maintenant'}
          </button>
        </div>
      )}
    </div>
  );
}
