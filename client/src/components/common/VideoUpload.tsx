/**
 * VideoUpload — shared component used by Talents and Influenceurs signup.
 * Two tabs:
 *  - Lien vidéo (default, "recommandé") — auto-detects 6 platforms
 *    (YouTube / TikTok / Instagram / Drive / Vimeo / Loom)
 *  - Upload direct — pushes file to Firebase Storage with progress bar
 *
 * Real Firebase Storage upload (not a simulation) — wired to ref under
 * `${storagePrefix}/{userUid}/{timestamp}.{ext}`. Storage rules enforce
 * owner-only writes, 50 Mo cap, video/* MIME.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Video, Upload, Link2, Play, Check, CheckCircle2, X, AlertCircle,
  Sparkles, Zap, Info, Youtube, Cloud, FileVideo,
  Trash2, Music, Instagram, Clipboard, Loader2,
} from 'lucide-react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/services/firebase';

const C = {
  brand: '#0F5C3F', brandDeep: '#0A4530', brandDarker: '#031A11',
  brandSoft: '#E8F5EE', brandLight: '#7FCAA6', brandMid: '#1B7A56',
  gold: '#D4A574', goldDeep: '#B8895C',
  cream: '#FAF7F2', creamDeep: '#F0EBE3',
  ink: '#0A1410', ink2: '#1A2A22', ink3: '#384C42',
  inkSoft: '#5C6B62', inkLight: '#94A39A',
  success: '#10B981', successSoft: '#D1FAE5', successDark: '#065F46',
  warning: '#D97706', warningSoft: '#FEF3C7', warningDark: '#92400E',
  danger: '#DC2626', dangerSoft: '#FEE2E2',
  white: '#FFFFFF',
};

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_FORMATS = ['video/mp4', 'video/quicktime', 'video/webm'];

type IconType = React.ComponentType<{ size?: number; fill?: string; strokeWidth?: number }>;

interface Platform {
  id: string;
  name: string;
  color: string;
  gradient: string;
  icon: IconType;
  iconFilled: boolean;
  patterns: RegExp[];
  tipTitle: string;
  tips: string[];
  note: string;
}

const PLATFORMS: Platform[] = [
  {
    id: 'youtube', name: 'YouTube',
    color: '#FF0000', gradient: 'linear-gradient(135deg, #FF0000, #CC0000)',
    icon: Youtube, iconFilled: true,
    patterns: [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ],
    tipTitle: 'Comment publier sur YouTube en 60 sec',
    tips: [
      "Ouvre l'app YouTube sur ton téléphone",
      'Tape sur le + en bas → Mettre en ligne une vidéo',
      'Titre court · Visibilité "Non répertoriée"',
      'Copie le lien et colle-le ici',
    ],
    note: '💡 "Non répertoriée" = seules les personnes avec le lien peuvent voir',
  },
  {
    id: 'tiktok', name: 'TikTok',
    color: '#000000', gradient: 'linear-gradient(135deg, #25F4EE, #FE2C55)',
    icon: Music, iconFilled: false,
    patterns: [
      /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
      /vm\.tiktok\.com\/([a-zA-Z0-9]+)/,
      /tiktok\.com\/t\/([a-zA-Z0-9]+)/,
    ],
    tipTitle: 'Comment partager ta vidéo TikTok',
    tips: [
      'Sur ta vidéo TikTok, tape sur "Partager"',
      'Choisis "Copier le lien"',
      'Colle le lien ici',
      'Assure-toi que ton compte est public',
    ],
    note: '💡 Compte privé = personne ne peut voir ta vidéo',
  },
  {
    id: 'instagram', name: 'Instagram',
    color: '#E1306C', gradient: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)',
    icon: Instagram, iconFilled: false,
    patterns: [
      /instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
      /instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
      /instagram\.com\/tv\/([a-zA-Z0-9_-]+)/,
    ],
    tipTitle: 'Comment partager ton Reel Instagram',
    tips: [
      'Ouvre ton Reel ou ta vidéo Instagram',
      'Tape sur les 3 points (⋯) → "Lien"',
      'Le lien est copié automatiquement',
      'Colle-le ici',
    ],
    note: '💡 Compte privé = le recruteur ne pourra pas voir',
  },
  {
    id: 'drive', name: 'Google Drive',
    color: '#4285F4', gradient: 'linear-gradient(135deg, #4285F4, #34A853)',
    icon: Cloud, iconFilled: false,
    patterns: [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    ],
    tipTitle: 'Comment partager via Google Drive',
    tips: [
      'Upload ta vidéo sur Google Drive',
      'Clic droit sur le fichier → "Partager"',
      'Sélectionne "Toute personne disposant du lien"',
      'Copie le lien et colle-le ici',
    ],
    note: '💡 Sans le partage activé, personne ne peut voir',
  },
  {
    id: 'vimeo', name: 'Vimeo',
    color: '#1AB7EA', gradient: 'linear-gradient(135deg, #1AB7EA, #0094CC)',
    icon: Video, iconFilled: false,
    patterns: [
      /vimeo\.com\/(\d+)/,
      /vimeo\.com\/channels\/[\w]+\/(\d+)/,
    ],
    tipTitle: 'Comment partager via Vimeo',
    tips: [
      'Upload ta vidéo sur vimeo.com',
      'Sur la page de la vidéo, clique sur "Share"',
      'Copie le lien direct',
      'Colle-le ici',
    ],
    note: '💡 Idéal pour les profils créatifs · Qualité HD garantie',
  },
  {
    id: 'loom', name: 'Loom',
    color: '#625DF5', gradient: 'linear-gradient(135deg, #625DF5, #4B45D0)',
    icon: Video, iconFilled: false,
    patterns: [
      /loom\.com\/share\/([a-zA-Z0-9]+)/,
      /loom\.com\/embed\/([a-zA-Z0-9]+)/,
    ],
    tipTitle: 'Comment partager via Loom',
    tips: [
      "Enregistre ta vidéo avec l'app Loom (gratuite)",
      'Une fois finie, le lien est copié automatiquement',
      'Colle-le ici',
      'Parfait pour les démos tech / business',
    ],
    note: '💡 Loom = idéal pour montrer ton écran + ton visage',
  },
];

interface Detection {
  platform: Platform | null;
  videoId: string | null;
  isValid: boolean;
  isGeneric?: boolean;
}

function detectPlatform(url: string): Detection {
  if (!url || url.length < 8) return { platform: null, videoId: null, isValid: false };
  for (const p of PLATFORMS) {
    for (const pattern of p.patterns) {
      const match = url.match(pattern);
      if (match) return { platform: p, videoId: match[1] ?? null, isValid: true };
    }
  }
  if (url.match(/^https?:\/\/.+\..+/)) {
    return { platform: null, videoId: null, isValid: true, isGeneric: true };
  }
  return { platform: null, videoId: null, isValid: false };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const STYLES = `
  .vu-fade-in { animation: vu-fade 0.3s ease; }
  .vu-slide-in { animation: vu-slide 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
  .vu-slide-right { animation: vu-slideR 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  .vu-pop { animation: vu-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes vu-fade { from{opacity:0} to{opacity:1} }
  @keyframes vu-slide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes vu-slideR { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
  @keyframes vu-pop { 0%{transform:scale(0.7);opacity:0} 50%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
  @keyframes vu-progress { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
  .vu-progress-stripes {
    background: linear-gradient(90deg, ${C.brand} 0%, ${C.brandLight} 50%, ${C.brand} 100%);
    background-size: 200% 100%;
    animation: vu-progress 1.5s linear infinite;
  }
  .vu-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .vu-mono { font-family: 'JetBrains Mono', monospace; }
`;

export interface VideoUploadValue {
  /** Final published URL (Storage download URL or external link). Empty until ready. */
  url: string;
  /** Duration in seconds (probed for uploaded files; 0 for external links). */
  durationSec: number;
}

interface Props {
  userUid: string;
  /** Storage path prefix, e.g. "talents" → talents/{uid}/{ts}.{ext} */
  storagePrefix: 'talents' | 'influencers';
  value: VideoUploadValue;
  onChange: (v: VideoUploadValue) => void;
}

export default function VideoUpload({ userUid, storagePrefix, value, onChange }: Props) {
  const [tab, setTab] = useState<'link' | 'upload'>('link');
  const [link, setLink] = useState(value.url || '');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const detection = useMemo(() => detectPlatform(link), [link]);

  const switchTab = (newTab: 'link' | 'upload') => {
    setTab(newTab);
    // Reset whichever side we're leaving
    if (newTab === 'link') {
      setFile(null); setUploadProgress(0); setUploading(false); setUploadDone(false); setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onChange({ url: link.trim(), durationSec: 0 });
    } else {
      setLink('');
      onChange({ url: '', durationSec: 0 });
    }
  };

  const handleLinkChange = (newLink: string) => {
    setLink(newLink);
    const d = detectPlatform(newLink);
    onChange({ url: d.isValid ? newLink.trim() : '', durationSec: 0 });
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) handleLinkChange(text.trim());
      }
    } catch { /* ignore */ }
  };

  const probeDuration = (f: File): Promise<number> => new Promise(resolve => {
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : 0); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    v.src = url;
  });

  const handleFile = async (f: File | null | undefined) => {
    if (!f) return;
    setUploadError(null);
    setUploadDone(false);

    if (!ACCEPTED_FORMATS.includes(f.type)) {
      setUploadError('Format non supporté · Utilise MP4, MOV ou WebM');
      return;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`Fichier trop lourd · Max ${MAX_FILE_SIZE_MB} Mo (le tien : ${formatFileSize(f.size)})`);
      return;
    }

    setFile(f);
    setUploading(true);
    setUploadProgress(0);

    try {
      const durationSec = await probeDuration(f);
      const ext = (f.name.split('.').pop() || 'mp4').toLowerCase().slice(0, 5);
      const path = `${storagePrefix}/${userUid}/${Date.now()}.${ext}`;
      const ref = storageRef(storage, path);
      const task = uploadBytesResumable(ref, f, { contentType: f.type });

      task.on('state_changed',
        snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { setUploadError(err.message); setUploading(false); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setUploading(false);
          setUploadDone(true);
          setUploadProgress(100);
          onChange({ url, durationSec });
        },
      );
    } catch (err) {
      setUploadError((err as Error).message);
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setUploadProgress(0);
    setUploading(false);
    setUploadDone(false);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onChange({ url: '', durationSec: 0 });
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: C.ink }}>
      <style>{STYLES}</style>

      {/* Tabs */}
      <div style={{
        background: C.creamDeep, borderRadius: 16, padding: 6,
        display: 'flex', gap: 6, marginBottom: 20,
      }}>
        <TabButton
          active={tab === 'link'}
          label="Lien vidéo"
          sublabel="6 plateformes supportées"
          icon={Link2}
          recommended
          onClick={() => switchTab('link')}
        />
        <TabButton
          active={tab === 'upload'}
          label="Upload direct"
          sublabel={`Max ${MAX_FILE_SIZE_MB} Mo`}
          icon={Upload}
          recommended={false}
          onClick={() => switchTab('upload')}
        />
      </div>

      {tab === 'link' && (
        <div className="vu-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hero banner */}
          <div style={{
            background: `linear-gradient(135deg, ${C.brand}10, ${C.gold}12)`,
            border: `1px solid ${C.brand}25`,
            borderRadius: 16, padding: 14,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
              color: C.white,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 6px 14px -4px ${C.brand}80`,
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <div className="vu-serif" style={{
                fontSize: 15, fontWeight: 700, color: C.ink,
                marginBottom: 4,
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              }}>
                Colle ton lien <em style={{ fontStyle: 'italic' }}>et c'est tout</em>
                <span className="vu-mono" style={{
                  fontSize: 9, fontWeight: 700,
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
                  color: C.white,
                  padding: '3px 7px', borderRadius: 100,
                  letterSpacing: '0.08em',
                }}>
                  ⭐ RECOMMANDÉ
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.55 }}>
                Plus rapide · 0 upload à attendre · Gratuit · Détection automatique
              </div>
            </div>
          </div>

          {/* Smart input */}
          <div>
            <label style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              fontSize: 12, fontWeight: 700, color: C.ink2, marginBottom: 6,
            }}>
              <span>Lien de ta vidéo *</span>
              {!link && (
                <button type="button" onClick={handlePaste} style={{
                  background: 'transparent', border: 'none',
                  color: C.brand, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <Clipboard size={11} /> Coller
                </button>
              )}
            </label>

            <div style={{
              display: 'flex', alignItems: 'stretch',
              background: detection.platform ? `${detection.platform.color}08` : (detection.isValid ? C.brandSoft : C.cream),
              borderRadius: 14,
              border: `1.5px solid ${detection.platform ? detection.platform.color : (detection.isValid ? C.brand : C.creamDeep)}`,
              overflow: 'hidden',
              transition: 'all 0.25s ease',
            }}>
              <div style={{
                padding: '14px 14px',
                background: detection.platform ? detection.platform.gradient : C.white,
                color: detection.platform ? C.white : C.inkSoft,
                borderRight: `1px solid ${C.creamDeep}`,
                display: 'flex', alignItems: 'center',
                minWidth: 50, justifyContent: 'center',
              }}>
                {detection.platform ? (
                  <div className="vu-pop" key={detection.platform.id}>
                    {React.createElement(detection.platform.icon, {
                      size: 17,
                      fill: detection.platform.iconFilled ? C.white : 'none',
                      strokeWidth: 2,
                    })}
                  </div>
                ) : (
                  <Link2 size={16} />
                )}
              </div>

              <input
                value={link}
                onChange={e => handleLinkChange(e.target.value)}
                placeholder="Colle ton lien YouTube, TikTok, Drive…"
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', padding: '14px 16px',
                  fontSize: 14, color: C.ink, fontFamily: 'inherit',
                  minWidth: 0,
                }}
              />

              {link && (
                <div style={{ display: 'flex' }}>
                  <button onClick={() => handleLinkChange('')} type="button" style={{
                    padding: '14px 12px', background: 'transparent', border: 'none',
                    color: C.inkLight, cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                  }}>
                    <X size={14} />
                  </button>
                  {detection.isValid && (
                    <a href={link} target="_blank" rel="noopener noreferrer" style={{
                      padding: '14px 16px',
                      background: detection.platform ? detection.platform.gradient : `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
                      color: C.white,
                      display: 'flex', alignItems: 'center', gap: 5,
                      textDecoration: 'none', fontSize: 12, fontWeight: 700,
                    }}>
                      <Play size={12} fill={C.white} /> Tester
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Detection feedback */}
            {link && (
              <div style={{ marginTop: 8 }}>
                {detection.platform ? (
                  <div className="vu-slide-right" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: `${detection.platform.color}10`,
                    border: `1px solid ${detection.platform.color}30`,
                    padding: '6px 12px', borderRadius: 100,
                    fontSize: 12, fontWeight: 700, color: detection.platform.color,
                  }}>
                    <CheckCircle2 size={13} />
                    <span><strong>{detection.platform.name}</strong> détecté</span>
                  </div>
                ) : detection.isGeneric ? (
                  <div className="vu-slide-right" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: C.warningSoft,
                    border: `1px solid ${C.warning}30`,
                    padding: '6px 12px', borderRadius: 100,
                    fontSize: 12, fontWeight: 700, color: C.warningDark,
                  }}>
                    <AlertCircle size={13} />
                    <span>Plateforme non reconnue · Le lien sera utilisé tel quel</span>
                  </div>
                ) : (
                  <div className="vu-slide-right" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: C.dangerSoft,
                    border: `1px solid ${C.danger}30`,
                    padding: '6px 12px', borderRadius: 100,
                    fontSize: 12, fontWeight: 700, color: C.danger,
                  }}>
                    <X size={13} />
                    <span>Lien invalide · Vérifie le format</span>
                  </div>
                )}
              </div>
            )}

            {/* Compatible platforms chips */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
              <span className="vu-mono" style={{
                fontSize: 10, fontWeight: 700, color: C.inkLight,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 4,
              }}>
                Compatible :
              </span>
              {PLATFORMS.map(p => {
                const isDetected = detection.platform?.id === p.id;
                return (
                  <div key={p.id} style={{
                    padding: '5px 10px', borderRadius: 100,
                    border: `1px solid ${isDetected ? p.color : C.creamDeep}`,
                    background: isDetected ? `${p.color}10` : C.white,
                    color: isDetected ? p.color : C.inkSoft,
                    fontSize: 11, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.25s ease',
                    transform: isDetected ? 'scale(1.05)' : 'scale(1)',
                  }}>
                    {React.createElement(p.icon, {
                      size: 11,
                      fill: isDetected && p.iconFilled ? p.color : 'none',
                      strokeWidth: 2,
                    })}
                    {p.name}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tips for detected platform */}
          {detection.platform && (
            <details className="vu-slide-in" style={{
              background: C.cream,
              border: `1px solid ${detection.platform.color}20`,
              borderRadius: 12, padding: 14,
            }}>
              <summary style={{
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                color: C.ink2,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                listStyle: 'none',
              }}>
                <Info size={12} color={detection.platform.color} />
                {detection.platform.tipTitle}
              </summary>
              <div style={{ marginTop: 12, fontSize: 12, color: C.ink3, lineHeight: 1.7 }}>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {detection.platform.tips.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
                <p style={{ marginTop: 10, marginBottom: 0, fontSize: 11, color: C.inkSoft, fontStyle: 'italic' }}>
                  {detection.platform.note}
                </p>
              </div>
            </details>
          )}

          {/* Generic help if no link yet */}
          {!link && (
            <details style={{
              background: C.cream,
              border: `1px solid ${C.creamDeep}`,
              borderRadius: 12, padding: 14,
            }}>
              <summary style={{
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                color: C.ink2,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                listStyle: 'none',
              }}>
                <Info size={12} color={C.brand} />
                Quelle plateforme choisir ?
              </summary>
              <div style={{ marginTop: 12, fontSize: 12, color: C.ink3, lineHeight: 1.7 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { plat: 'YouTube', use: 'le plus universel · idéal pour tous' },
                    { plat: 'TikTok', use: 'tu as déjà ta vidéo dessus · format vertical natif' },
                    { plat: 'Instagram', use: 'tes Reels marchent bien · jeune génération' },
                    { plat: 'Google Drive', use: 'pas envie de publier · juste partager' },
                    { plat: 'Vimeo', use: 'profil créatif · qualité HD pro' },
                    { plat: 'Loom', use: 'tech / business · montre ton écran + visage' },
                  ].map(p => (
                    <div key={p.plat} style={{ display: 'flex', gap: 6 }}>
                      <strong style={{ minWidth: 90, color: C.ink }}>{p.plat}</strong>
                      <span style={{ color: C.inkSoft }}>· {p.use}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <div className="vu-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: C.warningSoft,
            border: `1px solid ${C.warning}30`,
            borderRadius: 14, padding: 12,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <Info size={15} color={C.warningDark} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: C.warningDark, lineHeight: 1.55 }}>
              <strong>Upload direct</strong> · Pratique si tu n'as pas de compte sur les plateformes vidéo. <strong>Max {MAX_FILE_SIZE_MB} Mo</strong> · Pense à compresser ta vidéo.
            </div>
          </div>

          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: dragOver ? C.brandSoft : C.cream,
                border: `2px dashed ${dragOver ? C.brand : C.inkLight}50`,
                borderRadius: 18, padding: '40px 24px',
                textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: 60, height: 60, borderRadius: 18,
                background: dragOver
                  ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`
                  : C.creamDeep,
                color: dragOver ? C.white : C.inkSoft,
                margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                <Upload size={26} strokeWidth={1.75} />
              </div>
              <div className="vu-serif" style={{
                fontSize: 18, fontWeight: 700, color: C.ink,
                marginBottom: 6,
              }}>
                {dragOver ? 'Dépose ta vidéo ici' : <>Glisse ta vidéo<br />ou <em style={{ fontStyle: 'italic' }}>clique pour choisir</em></>}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 14 }}>
                MP4 · MOV · WebM · Max {MAX_FILE_SIZE_MB} Mo
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: '1 min max', icon: '⏱️' },
                  { label: 'Format vertical 9:16', icon: '📱' },
                  { label: '720p suffisant', icon: '✨' },
                ].map(t => (
                  <div key={t.label} style={{
                    background: C.white,
                    border: `1px solid ${C.creamDeep}`,
                    padding: '5px 11px', borderRadius: 100,
                    fontSize: 10, color: C.ink3, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <span>{t.icon}</span>
                    {t.label}
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef} type="file"
                accept={ACCEPTED_FORMATS.join(',')}
                onChange={e => handleFile(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="vu-slide-in" style={{
              background: C.white,
              border: `1.5px solid ${uploadDone ? C.success : C.brand}`,
              borderRadius: 18, padding: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 12,
                  background: uploadDone
                    ? `linear-gradient(135deg, ${C.success}, ${C.successDark})`
                    : `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
                  color: C.white,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {uploadDone ? <CheckCircle2 size={24} /> : uploading ? <Loader2 size={22} className="animate-spin" /> : <FileVideo size={22} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="vu-serif" style={{
                    fontSize: 16, fontWeight: 700, color: C.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {file.name}
                  </div>
                  <div className="vu-mono" style={{ fontSize: 11, color: C.inkSoft, marginTop: 2, fontWeight: 600 }}>
                    {formatFileSize(file.size)}
                    {uploadDone && <span style={{ color: C.success, marginLeft: 8 }}>· ✓ Uploadé</span>}
                    {uploading && <span style={{ color: C.brand, marginLeft: 8 }}>· {uploadProgress}%</span>}
                  </div>
                </div>
                <button onClick={handleRemove} type="button" style={{
                  background: C.creamDeep, border: 'none',
                  width: 32, height: 32, borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.inkSoft,
                }} aria-label="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>

              {uploading && (
                <div style={{ height: 6, borderRadius: 100, background: C.creamDeep, overflow: 'hidden' }}>
                  <div className="vu-progress-stripes" style={{
                    height: '100%', width: `${uploadProgress}%`,
                    transition: 'width 0.2s ease', borderRadius: 100,
                  }} />
                </div>
              )}

              {uploadDone && (
                <div style={{
                  background: C.successSoft,
                  border: `1px solid ${C.success}30`,
                  borderRadius: 10, padding: 10,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: C.successDark, fontWeight: 600,
                }}>
                  <CheckCircle2 size={14} />
                  Ta vidéo est prête · Tu peux passer à l'étape suivante
                </div>
              )}
            </div>
          )}

          {uploadError && (
            <div className="vu-slide-in" style={{
              background: C.dangerSoft,
              border: `1px solid ${C.danger}30`,
              borderRadius: 12, padding: 12,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertCircle size={15} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: C.danger, fontWeight: 600, lineHeight: 1.5 }}>
                {uploadError}
              </div>
            </div>
          )}

          <details style={{
            background: C.cream,
            border: `1px solid ${C.creamDeep}`,
            borderRadius: 12, padding: 12,
          }}>
            <summary style={{
              cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.ink2,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              listStyle: 'none',
            }}>
              <Zap size={12} color={C.brand} />
              Ma vidéo dépasse {MAX_FILE_SIZE_MB} Mo · Comment compresser
            </summary>
            <div style={{ marginTop: 12, fontSize: 12, color: C.ink3, lineHeight: 1.7 }}>
              <strong>📱 Sur iPhone :</strong>
              <ul style={{ margin: '4px 0 10px', paddingLeft: 18 }}>
                <li>Réglages → Appareil photo → Format → <strong>Haute efficacité</strong></li>
                <li>Refilme en 720p au lieu de 4K</li>
              </ul>
              <strong>📱 Sur Android :</strong>
              <ul style={{ margin: '4px 0 10px', paddingLeft: 18 }}>
                <li>App Caméra → Paramètres → Qualité vidéo → <strong>HD 720p</strong></li>
                <li>Ou utilise <strong>Video Compressor</strong> (Play Store, gratuit)</li>
              </ul>
              <strong>💻 Outils en ligne gratuits :</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                <li><a href="https://www.veed.io/tools/video-compressor" target="_blank" rel="noopener noreferrer" style={{ color: C.brandDeep, fontWeight: 600 }}>VEED.io ↗</a></li>
                <li><a href="https://www.freeconvert.com/video-compressor" target="_blank" rel="noopener noreferrer" style={{ color: C.brandDeep, fontWeight: 600 }}>FreeConvert ↗</a></li>
              </ul>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active, label, sublabel, icon: Icon, recommended, onClick,
}: {
  active: boolean;
  label: string;
  sublabel: string;
  icon: IconType;
  recommended: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} type="button" style={{
      flex: 1,
      background: active ? C.white : 'transparent',
      color: active ? C.ink : C.inkSoft,
      border: 'none', padding: '14px 16px', borderRadius: 12,
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: 12,
      textAlign: 'left', position: 'relative',
      transition: 'all 0.2s ease',
      boxShadow: active ? '0 4px 14px -4px rgba(15, 92, 63, 0.15)' : 'none',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: active
          ? (recommended ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})` : C.brand)
          : C.creamDeep,
        color: active ? C.white : C.inkSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.2s',
      }}>
        <Icon size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700, marginBottom: 2,
        }}>
          {label}
          {recommended && (
            <span className="vu-mono" style={{
              fontSize: 8, fontWeight: 700,
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
              color: C.white,
              padding: '2px 6px', borderRadius: 100,
              letterSpacing: '0.08em',
            }}>
              ⭐ RECO
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: active ? C.inkSoft : C.inkLight, fontWeight: 500 }}>
          {sublabel}
        </div>
      </div>
    </button>
  );
}
