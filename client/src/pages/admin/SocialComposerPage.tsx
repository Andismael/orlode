/**
 * Social Composer — write once, publish to multiple platforms.
 *
 * Flow:
 *   1. Pick connected platforms (auto-disabled if not connected)
 *   2. Write text + optional media URL (image or video)
 *   3. Live preview per platform with character limits
 *   4. Publish now OR schedule for later
 *
 * Uses the existing socialPublishService via /api/social/posts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  ArrowLeft, Send, Sparkles, Calendar, Image as ImageIcon, X,
  Linkedin, Facebook, Instagram, Twitter, Youtube, RefreshCw, Upload, Loader2,
  Wand2, Shuffle, Hash, DollarSign, Gauge, ChevronDown, ChevronRight, Lightbulb, Zap, MessageCircle,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#475467', inkLight: '#94A3A0',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#EF4444', redSoft: '#FEE2E2',
  purple: '#6D28D9', purpleSoft: '#EDE9FE',
  ai: '#F59E0B', aiSoft: '#FEF3C7',
};

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube';

const PLATFORM_META: Record<Platform, { label: string; color: string; icon: any; charLimit: number; needsMedia?: 'image' | 'video' | 'either' }> = {
  facebook:  { label: 'Facebook',  color: '#0866FF', icon: Facebook,  charLimit: 5000 },
  instagram: { label: 'Instagram', color: '#E1306C', icon: Instagram, charLimit: 2200, needsMedia: 'either' },
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', icon: Linkedin,  charLimit: 3000 },
  twitter:   { label: 'X / Twitter', color: '#000000', icon: Twitter, charLimit: 280 },
  tiktok:    { label: 'TikTok',    color: '#FF0050', icon: ImageIcon, charLimit: 150, needsMedia: 'video' },
  youtube:   { label: 'YouTube',   color: '#FF0000', icon: Youtube,   charLimit: 100, needsMedia: 'video' },
};

type AiAction = 'adapt' | 'variants' | 'hashtags' | 'optimize' | 'score' | 'brief';

interface ScoreData {
  viralScore: number;
  engagementProbability: number;
  hookStrength: number;
  ctaClarity: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface VariantItem { angle: string; text: string }

interface BriefPostItem { text: string; hashtags: string[]; imagePrompt?: string; cta?: string }

export default function SocialComposerPage() {
  const [connections, setConnections] = useState<Array<{ platform: Platform; accountName?: string }>>([]);
  const [text, setText] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [pickedPlatforms, setPickedPlatforms] = useState<Set<Platform>>(new Set());
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storage, setStorage] = useState<{ totalBytes: number; totalFiles: number; softLimitBytes: number } | null>(null);

  // ── AI autopilot state ─────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState<AiAction | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [variants, setVariants] = useState<VariantItem[] | null>(null);
  const [adapted, setAdapted] = useState<Record<string, string> | null>(null);
  const [briefResults, setBriefResults] = useState<Record<string, BriefPostItem> | null>(null);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [scorePlatform, setScorePlatform] = useState<Platform | null>(null);

  const loadStorageUsage = async () => {
    try {
      const r: any = await api.get('/social/storage/usage');
      const d = r?.data ?? r?.data?.data;
      if (d) setStorage({ totalBytes: d.totalBytes ?? 0, totalFiles: d.totalFiles ?? 0, softLimitBytes: d.softLimitBytes ?? 5e9 });
    } catch { /* silent */ }
  };

  useEffect(() => { loadStorageUsage(); }, []);

  const fmtSize = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier trop gros', 'Maximum 50 MB');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r: any = await api.post('/social/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = r?.data ?? r?.data?.data;
      setMediaUrl(data.url);
      setMediaType(data.mediaType);
      toast.success('Fichier uploadé', `${(file.size / 1024 / 1024).toFixed(1)} MB`);
      loadStorageUsage(); // refresh badge
    } catch (e: any) {
      toast.error('Échec upload', e?.response?.data?.message ?? 'Réessaie');
    } finally { setUploading(false); }
  };

  useEffect(() => {
    api.get('/social/connections').then((r: any) => {
      const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
      setConnections(list);
      // Auto-pick all connected platforms by default
      setPickedPlatforms(new Set(list.map((c: any) => c.platform)));
    }).catch(() => setConnections([]));
  }, []);

  const isConnected = (p: Platform) => connections.some(c => c.platform === p);

  const togglePlatform = (p: Platform) => {
    if (!isConnected(p)) {
      toast.error(`${PLATFORM_META[p].label} non connecté`, "Va dans Comptes pour le brancher");
      return;
    }
    setPickedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  // ── AI handlers ───────────────────────────────────────────────────────────
  const targetPlatformsArray = (): Platform[] => {
    if (pickedPlatforms.size > 0) return Array.from(pickedPlatforms);
    return connections.map(c => c.platform);
  };

  const firstTarget = (): Platform | undefined => targetPlatformsArray()[0];

  const aiCall = async <T,>(action: AiAction, path: string, body: any): Promise<T | null> => {
    setAiLoading(action);
    try {
      const r: any = await api.post(`/social/ai/${path}`, body);
      const data = r?.data?.data ?? r?.data;
      return data as T;
    } catch (e: any) {
      toast.error('IA indisponible', e?.response?.data?.message ?? 'Réessaie dans un instant');
      return null;
    } finally {
      setAiLoading(null);
    }
  };

  const handleAdapt = async () => {
    if (!text.trim()) { toast.error('Écris d\'abord un texte'); return; }
    const targets = targetPlatformsArray();
    if (targets.length === 0) { toast.error('Choisis au moins une plateforme'); return; }
    const data = await aiCall<Record<string, string>>('adapt', 'adapt', { text, platforms: targets });
    if (data) {
      setAdapted(data);
      setVariants(null);
      setBriefResults(null);
      toast.success('Adapté', `${Object.keys(data).length} versions générées`);
    }
  };

  const handleVariants = async () => {
    if (!text.trim()) { toast.error('Écris d\'abord un texte'); return; }
    const data = await aiCall<VariantItem[]>('variants', 'variants', { text, platform: firstTarget() });
    if (data) {
      setVariants(data);
      setAdapted(null);
      setBriefResults(null);
      toast.success('3 variantes générées');
    }
  };

  const handleHashtags = async () => {
    if (!text.trim()) { toast.error('Écris d\'abord un texte'); return; }
    const data = await aiCall<string[]>('hashtags', 'hashtags', { text, platform: firstTarget() });
    if (data) {
      setHashtags(data.join(' '));
      toast.success('Hashtags ajoutés', `${data.length} suggérés`);
    }
  };

  const handleOptimizeSales = async () => {
    if (!text.trim()) { toast.error('Écris d\'abord un texte'); return; }
    const data = await aiCall<{ optimized: string; changes: string[] }>(
      'optimize', 'optimize-sales', { text, platform: firstTarget() }
    );
    if (data) {
      setText(data.optimized);
      toast.success('Optimisé pour conversion', data.changes.slice(0, 2).join(' · '));
    }
  };

  const handleScore = async () => {
    if (!text.trim()) { toast.error('Écris d\'abord un texte'); return; }
    const platform = firstTarget() ?? 'instagram';
    const data = await aiCall<ScoreData>('score', 'score', { text, platform });
    if (data) {
      setScoreData(data);
      setScorePlatform(platform);
    }
  };

  const handleBriefGenerate = async () => {
    if (!brief.trim()) { toast.error('Décris ton idée en une phrase'); return; }
    const targets = targetPlatformsArray();
    if (targets.length === 0) { toast.error('Choisis au moins une plateforme'); return; }
    const data = await aiCall<Record<string, BriefPostItem>>(
      'brief', 'brief-to-posts', { brief, platforms: targets }
    );
    if (data) {
      setBriefResults(data);
      setAdapted(null);
      setVariants(null);
      // Pre-fill main text with the first target's version so user has a starting point
      const first = targets[0];
      const firstResult = first ? data[first] : null;
      if (firstResult) {
        setText(firstResult.text);
        setHashtags(firstResult.hashtags.join(' '));
      }
      toast.success('Posts générés', `${Object.keys(data).length} plateformes`);
    }
  };

  const applyAdaptedToText = (platform: Platform) => {
    if (!adapted) return;
    const v = adapted[platform];
    if (v) {
      setText(v);
      setAdapted(null);
      toast.success(`Texte remplacé par la version ${PLATFORM_META[platform].label}`);
    }
  };

  const applyVariantToText = (idx: number) => {
    if (!variants?.[idx]) return;
    setText(variants[idx].text);
    setVariants(null);
    toast.success('Variante appliquée');
  };

  const handleAddWhatsAppFunnel = () => {
    let phone = (typeof window !== 'undefined' ? localStorage.getItem('orlode.whatsappFunnelPhone') : '') ?? '';
    if (!phone) {
      const input = window.prompt(
        'Numéro WhatsApp (avec indicatif, ex: +18583810773) — sera mémorisé',
        ''
      );
      if (!input) return;
      phone = input.replace(/[^\d+]/g, '');
      if (!phone) { toast.error('Numéro invalide'); return; }
      localStorage.setItem('orlode.whatsappFunnelPhone', phone);
    }
    const platform = firstTarget() ?? 'social';
    const campaign = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    // wa.me requires the number without the leading +
    const cleanPhone = phone.replace(/^\+/, '');
    const prefilled = encodeURIComponent(`Bonjour, j'ai vu votre post sur ${platform} et je suis intéressé.`);
    const utmParams = `utm_source=social&utm_medium=${encodeURIComponent(platform)}&utm_campaign=${campaign}`;
    const waUrl = `https://wa.me/${cleanPhone}?text=${prefilled}&${utmParams}`;
    const cta = `\n\n💬 Discutons sur WhatsApp 👉 ${waUrl}`;
    setText(t => (t.includes('wa.me/') ? t : t + cta));
    toast.success('Funnel WhatsApp ajouté', `Trackable via UTM · ${platform}`);
  };

  const clearWhatsAppFunnelPhone = () => {
    localStorage.removeItem('orlode.whatsappFunnelPhone');
    toast.success('Numéro WhatsApp effacé');
  };

  const applyBriefResult = (platform: Platform) => {
    if (!briefResults) return;
    const r = briefResults[platform];
    if (r) {
      setText(r.text);
      setHashtags(r.hashtags.join(' '));
      toast.success(`Version ${PLATFORM_META[platform].label} appliquée`);
    }
  };

  const submit = async () => {
    if (!text.trim()) { toast.error('Texte requis'); return; }
    if (pickedPlatforms.size === 0) { toast.error('Choisis au moins une plateforme'); return; }
    if (scheduleMode && !scheduledAt) { toast.error('Date de publication requise'); return; }

    // Validate Instagram needs media
    if (pickedPlatforms.has('instagram') && !mediaUrl) {
      toast.error('Instagram requiert une image ou vidéo');
      return;
    }

    setSubmitting(true);
    try {
      const tags = hashtags.split(/[\s,]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean);
      await api.post('/social/posts', {
        text: text.trim(),
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaUrl ? mediaType : undefined,
        hashtags: tags,
        platforms: Array.from(pickedPlatforms),
        scheduledAt: scheduleMode ? scheduledAt : undefined,
      });
      toast.success(scheduleMode ? 'Post programmé' : 'Post publié',
        scheduleMode ? `Sera publié le ${new Date(scheduledAt).toLocaleString('fr-FR')}` : `${pickedPlatforms.size} plateforme${pickedPlatforms.size > 1 ? 's' : ''}`);
      setText(''); setHashtags(''); setMediaUrl(''); setScheduledAt('');
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally { setSubmitting(false); }
  };

  const renderedText = useMemo(() => {
    const tags = hashtags.split(/[\s,]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean);
    return tags.length > 0 ? `${text}\n\n${tags.map(t => `#${t}`).join(' ')}` : text;
  }, [text, hashtags]);

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <Link to="/admin/social" style={{ color: C.cream, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> Réseaux sociaux
        </Link>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Growth <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.purpleSoft }}>Engine</em>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', margin: '2px 0 0' }}>
            Idée → post → optimisé → prêt à convertir. En quelques secondes.
          </p>
        </div>
        <Link to="/admin/social/posts" className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
          Voir mes posts
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="responsive-charts">
        {/* LEFT — Editor */}
        <div style={{ background: C.cream, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* AI Brief — collapsible idea-to-posts generator */}
          <div style={{
            background: `linear-gradient(135deg, ${C.purple}15, ${C.ai}15)`,
            border: `1.5px solid ${C.purple}30`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <button
              onClick={() => setBriefOpen(o => !o)}
              style={{
                width: '100%', padding: '10px 14px', background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit',
                color: C.ink, fontWeight: 700, fontSize: 13,
              }}
            >
              {briefOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Lightbulb size={14} color={C.purple} />
              Brief → posts (IA génère tout)
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Autopilote
              </span>
            </button>
            {briefOpen && (
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={brief}
                  onChange={e => setBrief(e.target.value)}
                  rows={2}
                  placeholder="Ex: lancement du nouveau pack starter à 20$/mois pour les PMEs africaines"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.cream, border: `1.5px solid ${C.purple}40`, fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.4 }}
                />
                <button
                  onClick={handleBriefGenerate}
                  disabled={aiLoading === 'brief' || !brief.trim()}
                  style={{
                    padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: C.purple, color: C.cream, fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: (aiLoading === 'brief' || !brief.trim()) ? 0.5 : 1,
                  }}
                >
                  {aiLoading === 'brief' ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
                  Générer un post pour chaque plateforme
                </button>
                <div style={{ fontSize: 11, color: C.inkSoft }}>
                  💡 Tape une idée en 1 ligne. L'IA crée le post complet par plateforme avec hashtags et idée d'image.
                </div>
              </div>
            )}
          </div>

          {/* Platform picker */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 8, display: 'block', textTransform: 'uppercase' }}>
              Plateformes — {pickedPlatforms.size} sélectionnée{pickedPlatforms.size > 1 ? 's' : ''}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(PLATFORM_META) as Platform[]).map(p => {
                const meta = PLATFORM_META[p];
                const Icon = meta.icon;
                const connected = isConnected(p);
                const picked = pickedPlatforms.has(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    style={{
                      background: picked ? meta.color : C.creamDeep,
                      color: picked ? C.cream : (connected ? C.ink : C.inkLight),
                      border: 'none', padding: '7px 12px', borderRadius: 100,
                      fontSize: 12, fontWeight: 700, cursor: connected ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      opacity: connected ? 1 : 0.5,
                    }}
                  >
                    <Icon size={12} /> {meta.label}
                    {!connected && <span style={{ fontSize: 9, opacity: 0.7 }}>· non branché</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Texte du post
            </label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={6}
              placeholder="Écris ton post une seule fois… On adapte par plateforme."
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 14, color: C.ink, fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
            />

            {/* AI button strip */}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {[
                { key: 'adapt' as AiAction,    label: '✨ Adapter',          icon: Wand2,       handler: handleAdapt,         color: C.purple },
                { key: 'variants' as AiAction, label: '🎲 3 variantes',      icon: Shuffle,     handler: handleVariants,      color: C.blue },
                { key: 'hashtags' as AiAction, label: '# Hashtags',          icon: Hash,        handler: handleHashtags,      color: C.emeraldDeep },
                { key: 'optimize' as AiAction, label: '💰 Optimiser ventes', icon: DollarSign,  handler: handleOptimizeSales, color: C.ai },
                { key: 'score' as AiAction,    label: '📊 Score impact',     icon: Gauge,       handler: handleScore,         color: C.red },
              ].map(btn => {
                const Icon = btn.icon;
                const isLoading = aiLoading === btn.key;
                const disabled = !text.trim() || aiLoading !== null;
                return (
                  <button
                    key={btn.key}
                    onClick={btn.handler}
                    disabled={disabled}
                    style={{
                      padding: '6px 11px', borderRadius: 100,
                      background: 'transparent', border: `1.5px solid ${btn.color}50`,
                      color: btn.color, fontSize: 11, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      opacity: disabled ? 0.4 : 1,
                    }}
                  >
                    {isLoading ? <Loader2 size={11} className="spin" /> : <Icon size={11} />}
                    {btn.label}
                  </button>
                );
              })}

              {/* WhatsApp funnel — visually distinct, conversion-tying */}
              <button
                onClick={handleAddWhatsAppFunnel}
                disabled={!text.trim()}
                title="Ajoute un lien wa.me cliquable + tracking UTM au post"
                style={{
                  padding: '6px 11px', borderRadius: 100,
                  background: '#25D366', border: '1.5px solid #128C7E',
                  color: 'white', fontSize: 11, fontWeight: 800, cursor: text.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  opacity: text.trim() ? 1 : 0.4,
                  boxShadow: '0 1px 4px rgba(37,211,102,0.25)',
                }}
              >
                <MessageCircle size={11} /> 📲 Funnel WhatsApp
              </button>

              <button
                onClick={clearWhatsAppFunnelPhone}
                title="Effacer le numéro WhatsApp mémorisé"
                style={{
                  padding: '4px 6px', borderRadius: 100,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: C.inkLight, fontSize: 9, fontFamily: 'inherit',
                }}
              >
                ⚙
              </button>
            </div>

            {/* Adapted versions panel */}
            {adapted && (
              <div style={{ marginTop: 10, background: `${C.purple}10`, borderRadius: 10, padding: 12, border: `1px solid ${C.purple}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Wand2 size={11} style={{ verticalAlign: 'middle' }} /> Versions adaptées
                  </span>
                  <button onClick={() => setAdapted(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 2 }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(adapted).map(([p, v]) => {
                    const meta = PLATFORM_META[p as Platform];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <button key={p} onClick={() => applyAdaptedToText(p as Platform)}
                        style={{
                          textAlign: 'left', background: C.cream, border: `1px solid ${meta.color}30`,
                          borderRadius: 8, padding: 10, cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon size={11} /> {meta.label} <span style={{ fontSize: 10, color: C.inkLight, fontWeight: 500 }}>· clique pour utiliser</span>
                        </span>
                        <span style={{ fontSize: 12, color: C.ink, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{v}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Variants panel */}
            {variants && (
              <div style={{ marginTop: 10, background: `${C.blue}10`, borderRadius: 10, padding: 12, border: `1px solid ${C.blue}30` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Shuffle size={11} style={{ verticalAlign: 'middle' }} /> 3 angles différents
                  </span>
                  <button onClick={() => setVariants(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 2 }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {variants.map((v, i) => (
                    <button key={i} onClick={() => applyVariantToText(i)}
                      style={{
                        textAlign: 'left', background: C.cream, border: `1px solid ${C.blue}30`,
                        borderRadius: 8, padding: 10, cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Angle: {v.angle} <span style={{ fontSize: 10, color: C.inkLight, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· clique pour utiliser</span>
                      </span>
                      <span style={{ fontSize: 12, color: C.ink, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{v.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Brief results panel */}
            {briefResults && (
              <div style={{ marginTop: 10, background: `${C.ai}10`, borderRadius: 10, padding: 12, border: `1px solid ${C.ai}40` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.ai, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Lightbulb size={11} style={{ verticalAlign: 'middle' }} /> Posts générés depuis le brief
                  </span>
                  <button onClick={() => setBriefResults(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 2 }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(briefResults).map(([p, r]) => {
                    const meta = PLATFORM_META[p as Platform];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <button key={p} onClick={() => applyBriefResult(p as Platform)}
                        style={{
                          textAlign: 'left', background: C.cream, border: `1px solid ${meta.color}30`,
                          borderRadius: 8, padding: 10, cursor: 'pointer', fontFamily: 'inherit',
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon size={11} /> {meta.label} <span style={{ fontSize: 10, color: C.inkLight, fontWeight: 500 }}>· clique pour utiliser</span>
                        </span>
                        <span style={{ fontSize: 12, color: C.ink, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{r.text}</span>
                        {r.hashtags.length > 0 && (
                          <span style={{ fontSize: 10, color: C.emeraldDeep }}>
                            #{r.hashtags.slice(0, 6).join(' #')}
                          </span>
                        )}
                        {r.imagePrompt && (
                          <span style={{ fontSize: 10, color: C.inkSoft, fontStyle: 'italic' }}>
                            🎨 Image: {r.imagePrompt}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Hashtags */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Hashtags (séparés par espace ou virgule)
            </label>
            <input
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="ex: blackfriday promo nouveaute"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
            />
          </div>

          {/* Media — upload OR URL */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Image / vidéo (optionnel)
              </label>
              {storage && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: C.inkSoft,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: C.creamDeep, padding: '3px 8px', borderRadius: 6,
                }}>
                  📦 {fmtSize(storage.totalBytes)} / {fmtSize(storage.softLimitBytes)} · {storage.totalFiles} fichier{storage.totalFiles > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Upload zone */}
            {!mediaUrl && (
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFileUpload(f);
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: 24,
                  background: C.creamDeep, borderRadius: 12,
                  border: `2px dashed ${C.purple}40`,
                  cursor: uploading ? 'wait' : 'pointer',
                  textAlign: 'center',
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 size={24} className="spin" color={C.purple} />
                    <span style={{ fontSize: 12, color: C.inkSoft }}>Upload en cours…</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} color={C.purple} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Glisse-dépose ou clique pour uploader</span>
                    <span style={{ fontSize: 11, color: C.inkLight }}>JPEG, PNG, MP4, MOV · max 50 MB</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = ''; // allow re-upload of same file
                  }}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
            )}

            {/* Uploaded preview */}
            {mediaUrl && (
              <div style={{
                background: C.creamDeep, borderRadius: 12, padding: 10,
                display: 'flex', gap: 10, alignItems: 'center',
                border: `1.5px solid ${C.emerald}40`,
              }}>
                {mediaType === 'image' ? (
                  <div style={{ width: 60, height: 60, borderRadius: 8, background: `url("${mediaUrl}") center/cover, ${C.cream}`, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 60, height: 60, borderRadius: 8, background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>🎬</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.emeraldDeep }}>✅ Média uploadé</div>
                  <div className="mono-font" style={{ fontSize: 11, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mediaUrl}
                  </div>
                </div>
                <button onClick={() => setMediaUrl('')} className="icon-btn" style={{ width: 30, height: 30, color: C.red }} title="Retirer">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* OR paste URL */}
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: C.inkSoft, cursor: 'pointer' }}>
                ou colle une URL publique (CDN externe)
              </summary>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <select value={mediaType} onChange={e => setMediaType(e.target.value as any)}
                  style={{ padding: '8px 10px', borderRadius: 8, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 12, fontFamily: 'inherit' }}>
                  <option value="image">Image</option>
                  <option value="video">Vidéo</option>
                </select>
                <input
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://…"
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 12, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>
            </details>

            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
              💡 Instagram, TikTok et YouTube nécessitent un média. Facebook et X postent en texte si vide.
            </div>
          </div>

          {/* Schedule */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: C.ink, fontWeight: 600 }}>
              <input type="checkbox" checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} />
              <Calendar size={13} /> Programmer pour plus tard
            </label>
            {scheduleMode && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, fontFamily: 'inherit' }}
              />
            )}
          </div>

          <button onClick={submit} disabled={submitting} className="btn-primary" style={{ padding: '12px 18px', fontSize: 14, justifyContent: 'center' }}>
            <Send size={14} />
            {submitting ? 'Envoi…' : scheduleMode ? 'Programmer le post' : `Publier maintenant (${pickedPlatforms.size})`}
          </button>
        </div>

        {/* RIGHT — Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Impact Score */}
          {scoreData && (
            <div style={{ background: C.cream, borderRadius: 14, padding: 14, border: `1.5px solid ${C.ai}40` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Gauge size={14} color={C.ai} /> Score impact
                  {scorePlatform && <span style={{ fontSize: 10, color: C.inkLight, fontWeight: 500 }}>· {PLATFORM_META[scorePlatform].label}</span>}
                </span>
                <button onClick={() => setScoreData(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 2 }}>
                  <X size={13} />
                </button>
              </div>

              {/* Score grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Viral',      value: scoreData.viralScore,            color: C.purple },
                  { label: 'Engagement', value: scoreData.engagementProbability, color: C.blue },
                  { label: 'Hook',       value: scoreData.hookStrength,          color: C.emeraldDeep },
                  { label: 'CTA',        value: scoreData.ctaClarity,            color: C.ai },
                ].map(s => (
                  <div key={s.label} style={{ background: C.creamDeep, borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      {s.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span className="display-font" style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                        {Math.round(s.value)}
                      </span>
                      <span style={{ fontSize: 10, color: C.inkLight, fontWeight: 600 }}>/100</span>
                    </div>
                    <div style={{ marginTop: 4, height: 4, background: C.cream, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, s.value))}%`, background: s.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>

              {scoreData.strengths.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.emeraldDeep, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    ✓ Forces
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.ink, lineHeight: 1.5 }}>
                    {scoreData.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {scoreData.weaknesses.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    ⚠ Faiblesses
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.ink, lineHeight: 1.5 }}>
                    {scoreData.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {scoreData.suggestions.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Zap size={10} /> À améliorer
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.ink, lineHeight: 1.5 }}>
                    {scoreData.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,250,240,0.8)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Aperçu — {pickedPlatforms.size} plateforme{pickedPlatforms.size > 1 ? 's' : ''}
          </div>
          {pickedPlatforms.size === 0 && (
            <div style={{ background: C.cream, borderRadius: 14, padding: 30, textAlign: 'center', color: C.inkLight, fontSize: 13 }}>
              Choisis au moins une plateforme à gauche pour voir l'aperçu.
            </div>
          )}
          {Array.from(pickedPlatforms).map(p => {
            const meta = PLATFORM_META[p];
            const Icon = meta.icon;
            const overflow = renderedText.length > meta.charLimit;
            const clipped = overflow ? renderedText.slice(0, meta.charLimit) + '…' : renderedText;
            return (
              <div key={p} style={{
                background: C.cream, borderRadius: 14,
                border: `1.5px solid ${meta.color}30`,
                borderLeft: `4px solid ${meta.color}`,
                padding: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.color, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} />
                  </div>
                  <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{meta.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: overflow ? C.red : C.inkSoft, fontWeight: 600 }}>
                    {renderedText.length} / {meta.charLimit}
                  </span>
                </div>
                {mediaUrl && (
                  <div style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', background: C.creamDeep, height: 180,
                    backgroundImage: mediaType === 'image' ? `url("${mediaUrl}")` : 'none',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {mediaType === 'video' && (
                      <span style={{ color: C.inkLight, fontSize: 12 }}>🎬 Vidéo : {mediaUrl.slice(0, 40)}…</span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {clipped || <em style={{ color: C.inkLight }}>(vide)</em>}
                </div>
                {overflow && (
                  <div style={{ marginTop: 6, fontSize: 11, color: C.red }}>
                    ⚠️ Texte tronqué pour {meta.label} (limite : {meta.charLimit})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
