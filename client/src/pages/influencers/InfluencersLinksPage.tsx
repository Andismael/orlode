/**
 * Orlode Influenceurs — creator self-management of social links.
 *
 * Authenticated page where a verified creator manages the 7 supported
 * social platforms (link + declared followers). Brands click each link
 * to verify the audience themselves — no auto-scraping, no algorithm.
 *
 * The transparency is the product: a creator can't fake their numbers
 * because brands see the live profile in one tap.
 *
 * Pattern + UI inspired by user-provided design 2026-05-24, adapted to
 * Orlode TypeScript + Firestore + auth.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, CheckCircle2, X, Info,
  Sparkles, Shield, ExternalLink, Plus, Trash2, Edit3, Eye,
  Instagram, Youtube, Music, Facebook, Twitter, Linkedin, Link2,
  Loader2,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useSEO } from '@/hooks/useSEO';
import { M, MOBILE_CSS } from '@/components/mobile/mobileDesign';

// ── PLATFORMS CONFIG ────────────────────────────────────────────────────
type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

interface PlatformDef {
  id: string;
  name: string;
  icon: IconCmp | 'snap-custom';
  color: string;
  gradient: string;
  domainHint: string;
}

const PLATFORMS: PlatformDef[] = [
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: '#E1306C',
    gradient: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)', domainHint: 'instagram.com/' },
  { id: 'tiktok', name: 'TikTok', icon: Music, color: '#000',
    gradient: 'linear-gradient(135deg, #25F4EE, #FE2C55)', domainHint: 'tiktok.com/@' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000',
    gradient: 'linear-gradient(135deg, #FF0000, #CC0000)', domainHint: 'youtube.com/@' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: '#1877F2',
    gradient: 'linear-gradient(135deg, #1877F2, #0866FF)', domainHint: 'facebook.com/' },
  { id: 'snapchat', name: 'Snapchat', icon: 'snap-custom', color: '#000',
    gradient: 'linear-gradient(135deg, #FFFC00, #FFEC1F)', domainHint: 'snapchat.com/add/' },
  { id: 'twitter', name: 'X (Twitter)', icon: Twitter, color: '#000',
    gradient: 'linear-gradient(135deg, #000, #333)', domainHint: 'x.com/' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: '#0A66C2',
    gradient: 'linear-gradient(135deg, #0A66C2, #004182)', domainHint: 'linkedin.com/in/' },
];

interface SocialLink {
  url: string;
  followers: number;
  lastUpdatedAt: string | null;
}
type LinksMap = Record<string, SocialLink>;

const EMPTY: SocialLink = { url: '', followers: 0, lastUpdatedAt: null };

const formatK = (n: number) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toString();
};

function SnapIcon({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8 2 6 5 6 8c0 1 .2 2 .5 3-.5.3-1 .5-1.5.5-1 0-1.5-.5-2-.5-.5 0-1 .3-1 .8 0 1 2 1.5 3 2 .8.3 1 1 1 1.5 0 1.5-3 3.5-4 4 0 .5 1 1 2 1.2.3 0 .5.5.5 1 0 .3.3.5.8.5 1 0 1.7-.3 2.5-.3 1 0 1.5.3 3 1.7.5.5 1.5 1 2.2 1s1.7-.5 2.2-1c1.5-1.5 2-1.7 3-1.7.8 0 1.5.3 2.5.3.5 0 .8-.2.8-.5 0-.5.2-1 .5-1 1-.2 2-.7 2-1.2-1-.5-4-2.5-4-4 0-.5.2-1.2 1-1.5 1-.5 3-1 3-2 0-.5-.5-.8-1-.8s-1 .5-2 .5c-.5 0-1-.2-1.5-.5.3-1 .5-2 .5-3 0-3-2-6-6-6z" fill={color}/>
    </svg>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────
export default function InfluencersLinksPage() {
  useSEO({
    title: 'Mes liens — Orlode Influenceurs',
    description: 'Gère tes liens sociaux. Les marques vérifient elles-mêmes en cliquant — pas d\'algorithme.',
    path: '/influenceurs/mes-liens',
    noindex: true,
  });

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [links, setLinks] = useState<LinksMap>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlatformDef | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load creator's profile + existing socialLinks
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    void (async () => {
      try {
        const q = query(
          collection(db, 'influencers_profiles'),
          where('userId', '==', user.uid),
        );
        const snap = await getDocs(q);
        if (snap.empty) { setLoading(false); return; }
        const docRef = snap.docs[0];
        setProfileId(docRef.id);
        const data = docRef.data() as { socialLinks?: LinksMap };
        setLinks(data.socialLinks ?? {});
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const saveLink = async (platformId: string, payload: SocialLink) => {
    if (!profileId) return;
    setSavingId(platformId);
    setError(null);
    try {
      const next = { ...links, [platformId]: { ...payload, lastUpdatedAt: new Date().toISOString() } };
      await updateDoc(doc(db, 'influencers_profiles', profileId), {
        socialLinks: next,
        updatedAt: serverTimestamp(),
      });
      setLinks(next);
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  const removeLink = async (platformId: string) => {
    if (!profileId) return;
    setSavingId(platformId);
    try {
      const next = { ...links };
      delete next[platformId];
      await updateDoc(doc(db, 'influencers_profiles', profileId), {
        socialLinks: next,
        updatedAt: serverTimestamp(),
      });
      setLinks(next);
      setEditing(null);
    } finally {
      setSavingId(null);
    }
  };

  // Stats
  const filled = Object.entries(links).filter(([, s]) => s.url && s.followers);
  const totalFollowers = filled.reduce((sum, [, s]) => sum + s.followers, 0);
  const progress = Math.round((filled.length / PLATFORMS.length) * 100);

  // No user
  if (!user && !loading) {
    return (
      <div className="m-root" style={{ minHeight: '100vh', background: M.cream, padding: 40 }}>
        <style>{MOBILE_CSS}</style>
        <div className="m-wrap-lg" style={{ maxWidth: 480, textAlign: 'center' }}>
          <Shield size={40} color={M.violetDeep} style={{ marginBottom: 12 }} />
          <h1 className="m-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Connecte-toi
          </h1>
          <p style={{ color: M.inkSoft, marginBottom: 18, fontSize: 14 }}>
            Tu dois être inscrit·e comme créateur·trice pour gérer tes liens.
          </p>
          <Link to="/influenceurs/inscription" style={{
            background: M.violetDeep, color: M.cream, padding: '12px 22px',
            borderRadius: 100, fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Créer mon profil →
          </Link>
        </div>
      </div>
    );
  }

  // No profile yet
  if (!loading && !profileId) {
    return (
      <div className="m-root" style={{ minHeight: '100vh', background: M.cream, padding: 40 }}>
        <style>{MOBILE_CSS}</style>
        <div className="m-wrap-lg" style={{ maxWidth: 480, textAlign: 'center' }}>
          <Sparkles size={40} color={M.violetDeep} style={{ marginBottom: 12 }} />
          <h1 className="m-display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Pas encore inscrit·e
          </h1>
          <p style={{ color: M.inkSoft, marginBottom: 18, fontSize: 14 }}>
            Crée d'abord ton profil créateur — tu pourras ensuite y ajouter tes liens.
          </p>
          <Link to="/influenceurs/inscription" style={{
            background: M.violetDeep, color: M.cream, padding: '12px 22px',
            borderRadius: 100, fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            S'inscrire →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="m-root" style={{ minHeight: '100vh', background: M.cream }}>
      <style>{MOBILE_CSS}</style>

      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255, 250, 240, 0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid rgba(31,41,55,0.06)`,
        padding: '14px 18px',
      }}>
        <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/influenceurs')} style={{
            background: '#F1F3F6', border: 'none',
            width: 32, height: 32, borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: M.ink,
          }}>
            <ArrowLeft size={14} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="m-display" style={{ fontSize: 15, fontWeight: 700 }}>Mes liens sociaux</div>
            <div style={{ fontSize: 10, color: M.inkSoft }}>
              {filled.length}/{PLATFORMS.length} renseigné{filled.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </header>

      {/* Hero stats */}
      <section style={{
        background: `linear-gradient(160deg, #2E1065 0%, ${M.violetDeep} 50%, ${M.violet} 100%)`,
        color: M.cream, padding: '28px 18px 36px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="m-grain" />
        <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div className="m-pill" style={{
            background: 'rgba(252,211,77,0.18)', color: M.goldLight,
            border: `1px solid ${M.gold}40`, marginBottom: 14,
          }}>
            <Link2 size={11} /> TRANSPARENCE TOTALE
          </div>
          <h1 className="m-display" style={{
            fontSize: 'clamp(28px, 6.5vw, 38px)', fontWeight: 800,
            lineHeight: 1.1, margin: '0 0 12px',
          }}>
            Ajoute tes liens.<br />
            <em className="m-shimmer" style={{
              fontStyle: 'italic', fontWeight: 500,
              backgroundImage: M.shimmer,
            }}>Laisse les marques juger.</em>
          </h1>
          <p style={{
            fontSize: 14, color: 'rgba(255,250,240,0.82)',
            margin: '0 0 22px', lineHeight: 1.55,
          }}>
            Les marques cliquent sur tes liens pour <strong style={{ color: M.cream }}>vérifier elles-mêmes</strong> tes followers en direct. Pas d'algorithme — juste la vérité de tes comptes.
          </p>

          {/* Stats grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
            paddingTop: 18, borderTop: `1px dashed ${M.cream}20`,
          }}>
            <div>
              <div className="m-mono" style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,250,240,0.55)', letterSpacing: '0.08em', marginBottom: 4 }}>
                COMPLÉTÉ
              </div>
              <div className="m-display m-mono" style={{ fontSize: 22, fontWeight: 800, color: M.goldLight, lineHeight: 1 }}>
                {progress}%
              </div>
              <div style={{ marginTop: 6, height: 3, borderRadius: 100, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${M.violet}, ${M.goldLight})`, borderRadius: 100 }} />
              </div>
            </div>
            <div>
              <div className="m-mono" style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,250,240,0.55)', letterSpacing: '0.08em', marginBottom: 4 }}>
                RÉSEAUX
              </div>
              <div className="m-display m-mono" style={{ fontSize: 22, fontWeight: 800, color: M.cream, lineHeight: 1 }}>
                {filled.length}<span style={{ fontSize: 14, opacity: 0.5 }}>/{PLATFORMS.length}</span>
              </div>
            </div>
            <div>
              <div className="m-mono" style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,250,240,0.55)', letterSpacing: '0.08em', marginBottom: 4 }}>
                AUDIENCE
              </div>
              <div className="m-display m-mono" style={{ fontSize: 22, fontWeight: 800, color: M.goldLight, lineHeight: 1 }}>
                {formatK(totalFollowers)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms grid */}
      <main style={{ padding: '24px 18px 100px' }}>
        <div className="m-wrap-xl" style={{ maxWidth: 560, margin: '0 auto' }}>
          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FCA5A5',
              borderRadius: 12, padding: 12, marginBottom: 14,
              fontSize: 13, color: '#991B1B',
            }}>⚠️ {error}</div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: M.inkSoft }}>
              <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
            </div>
          ) : (
            <div className="m-grid-md-2 m-grid-lg-3" style={{
              display: 'grid', gridTemplateColumns: '1fr', gap: 12,
            }}>
              {PLATFORMS.map(p => (
                <PlatformCard
                  key={p.id}
                  platform={p}
                  data={links[p.id] ?? EMPTY}
                  onEdit={() => setEditing(p)}
                  busy={savingId === p.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {editing && (
        <EditModal
          platform={editing}
          data={links[editing.id] ?? EMPTY}
          onClose={() => setEditing(null)}
          onSave={saveLink}
          onRemove={removeLink}
          busy={savingId === editing.id}
        />
      )}
    </div>
  );
}

// ── Platform card ──────────────────────────────────────────────────────
function PlatformCard({ platform, data, onEdit, busy }: {
  platform: PlatformDef; data: SocialLink; onEdit: () => void; busy: boolean;
}) {
  const isFilled = data.url && data.followers > 0;
  const Icon = platform.icon === 'snap-custom' ? null : platform.icon;

  return (
    <article style={{
      background: M.cream,
      border: `1.5px solid ${isFilled ? M.emerald + '40' : 'rgba(31,41,55,0.06)'}`,
      borderRadius: 16, padding: 16,
      transition: 'all 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isFilled ? 12 : 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: platform.gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {Icon ? <Icon size={17} color={M.cream} strokeWidth={2} /> : <SnapIcon size={18} color="#000" />}
        </div>
        <div style={{ flex: 1 }}>
          <div className="m-display" style={{ fontSize: 14, fontWeight: 700, color: M.ink, lineHeight: 1 }}>
            {platform.name}
          </div>
          {isFilled ? (
            <span style={{ fontSize: 10, color: M.emeraldDark, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
              <CheckCircle2 size={10} /> Renseigné
            </span>
          ) : (
            <span style={{ fontSize: 10, color: M.inkLight, marginTop: 3 }}>Non renseigné</span>
          )}
        </div>
      </div>

      {isFilled ? (
        <>
          <div style={{
            background: M.creamDeep, borderRadius: 10,
            padding: 10, marginBottom: 8,
          }}>
            <a href={data.url} target="_blank" rel="noopener noreferrer" style={{
              color: M.violetDeep, fontSize: 11, fontWeight: 600,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3,
              wordBreak: 'break-all',
            }}>
              {data.url.replace(/https?:\/\//, '')} <ExternalLink size={10} />
            </a>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingTop: 8, borderTop: `1px dashed rgba(31,41,55,0.08)` }}>
              <div>
                <div className="m-mono" style={{ fontSize: 8, fontWeight: 700, color: M.inkLight, letterSpacing: '0.08em' }}>
                  FOLLOWERS DÉCLARÉS
                </div>
                <div className="m-display m-mono" style={{ fontSize: 18, fontWeight: 800, color: M.ink, lineHeight: 1 }}>
                  {formatK(data.followers)}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onEdit} disabled={busy} className="tap-card" style={{
              flex: 1, background: '#F1F3F6', color: M.ink,
              border: 'none', padding: '8px 12px', borderRadius: 10,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <Edit3 size={11} /> Modifier
            </button>
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="tap-card" style={{
              padding: '8px 12px', borderRadius: 10,
              background: '#F1F3F6', color: M.violetDeep,
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Eye size={11} /> Visiter
            </a>
          </div>
        </>
      ) : (
        <button onClick={onEdit} disabled={busy} className="tap-card" style={{
          width: '100%', background: M.creamDeep, color: M.ink,
          border: `1.5px dashed ${M.inkLight}40`,
          padding: '11px 16px', borderRadius: 10,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Plus size={13} /> Ajouter mon lien {platform.name}
        </button>
      )}
    </article>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────
function EditModal({ platform, data, onClose, onSave, onRemove, busy }: {
  platform: PlatformDef; data: SocialLink;
  onClose: () => void;
  onSave: (id: string, payload: SocialLink) => void;
  onRemove: (id: string) => void;
  busy: boolean;
}) {
  const [url, setUrl] = useState(data.url);
  const [followers, setFollowers] = useState(String(data.followers || ''));
  const isValid = url.length > 5 && parseInt(followers, 10) > 0;
  const Icon = platform.icon === 'snap-custom' ? null : platform.icon;

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, background: 'rgba(10,8,20,0.65)',
      backdropFilter: 'blur(6px)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: M.cream, borderRadius: 20,
        width: '100%', maxWidth: 460, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          background: platform.gradient,
          padding: '20px 22px', position: 'relative', overflow: 'hidden',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(20px)',
            border: 'none', color: platform.id === 'snapchat' ? '#000' : M.cream,
            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {Icon ? <Icon size={20} color={platform.id === 'snapchat' ? '#000' : M.cream} strokeWidth={2} /> : <SnapIcon size={22} color="#000" />}
            </div>
            <div>
              <h2 className="m-display" style={{
                fontSize: 18, fontWeight: 700,
                color: platform.id === 'snapchat' ? '#000' : M.cream,
                margin: 0, letterSpacing: '-0.02em',
              }}>{platform.name}</h2>
              <p style={{
                fontSize: 11, margin: 0,
                color: platform.id === 'snapchat' ? '#000a' : 'rgba(255,255,255,0.85)',
              }}>
                Lien + followers déclarés
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{
            background: M.violetSoft, border: `1px solid ${M.violet}30`,
            borderRadius: 10, padding: 10, marginBottom: 16,
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <Info size={14} color={M.violetDeep} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 11, color: M.violetDeep, lineHeight: 1.45 }}>
              <strong>Honnêteté totale</strong> · les marques cliquent et vérifient direct.
            </div>
          </div>

          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: M.ink, marginBottom: 6 }}>
            Lien public *
          </label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder={`https://${platform.domainHint}ton.handle`} style={{
            width: '100%', background: M.cream, border: `1.5px solid ${url ? M.violet : 'rgba(31,41,55,0.1)'}`,
            borderRadius: 10, padding: '10px 12px', fontSize: 13,
            outline: 'none', marginBottom: 14, fontFamily: 'inherit',
          }} />

          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: M.ink, marginBottom: 6 }}>
            Followers *
          </label>
          <input type="number" value={followers} onChange={e => setFollowers(e.target.value)} placeholder="Ex: 45000" style={{
            width: '100%', background: M.cream, border: '1.5px solid rgba(31,41,55,0.1)',
            borderRadius: 10, padding: '10px 12px', fontSize: 15, fontWeight: 700,
            outline: 'none', fontFamily: "'JetBrains Mono', monospace",
          }} />
        </div>

        <div style={{
          padding: '12px 22px', borderTop: '1px solid rgba(31,41,55,0.06)',
          background: M.creamDeep,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {data.url ? (
            <button onClick={() => onRemove(platform.id)} disabled={busy} style={{
              background: 'transparent', border: 'none', color: '#DC2626',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Trash2 size={12} /> Supprimer
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              background: M.cream, color: M.ink, border: '1px solid rgba(31,41,55,0.1)',
              padding: '10px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Annuler</button>
            <button onClick={() => onSave(platform.id, { url, followers: parseInt(followers, 10), lastUpdatedAt: null })}
              disabled={!isValid || busy} style={{
                background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
                color: M.cream, border: 'none',
                padding: '10px 18px', borderRadius: 100,
                fontSize: 12, fontWeight: 700,
                cursor: !isValid || busy ? 'not-allowed' : 'pointer',
                opacity: !isValid ? 0.4 : 1, fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
