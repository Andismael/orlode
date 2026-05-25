/**
 * Orlode Influenceurs — creator self-management of social links.
 * Editorial purple redesign from user-provided maquette 2026-05-24.
 *
 * Authenticated page where a verified creator manages the 7 supported
 * social platforms (link + declared followers). Brands click each link
 * to verify the audience themselves — no auto-scraping, no algorithm.
 *
 * The transparency is the product: a creator can't fake their numbers
 * because brands see the live profile in one tap.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Check, CheckCircle2, X, Info,
  Sparkles, Shield, ExternalLink, Plus, Trash2, Edit3, Eye,
  Instagram, Youtube, Music, Facebook, Twitter, Linkedin, Link2,
  Loader2, Lock, Clock,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useSEO } from '@/hooks/useSEO';

const C = {
  brand: '#6366F1', brandDeep: '#4F46E5', brandDark: '#3730A3',
  brandDarker: '#1E1B4B',
  brandSoft: '#EEF2FF', brandLight: '#A5B4FC', brandMid: '#818CF8',
  gold: '#D4A574', goldDeep: '#B8895C', goldLight: '#E8C9A0',
  cream: '#FAF7F2', creamDeep: '#F0EBE3',
  ink: '#0A0814', ink2: '#1F1B2E', ink3: '#3F3856',
  inkSoft: '#6B6480', inkLight: '#9A93AD', inkSilent: '#C9C3D6',
  success: '#059669', successSoft: '#D1FAE5', successDark: '#065F46',
  danger: '#DC2626',
  white: '#FFFFFF',
  snapchatText: '#000000',
};

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

const formatK = (n: number) => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toString();
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .ilk { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
  .ilk-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .ilk-mono { font-family: 'JetBrains Mono', monospace; }
  .ilk-input {
    width: 100%; background: ${C.white}; color: ${C.ink};
    border: 1.5px solid ${C.creamDeep};
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 14px; font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .ilk-input:focus { border-color: ${C.brand}; box-shadow: 0 0 0 4px ${C.brandSoft}; }
  .ilk-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 13px; border-radius: 100px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  @keyframes ilk-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  .ilk-shimmer {
    background: linear-gradient(90deg, ${C.brandLight} 0%, ${C.goldLight} 50%, ${C.brandLight} 100%);
    background-size: 200% auto;
    background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: ilk-shimmer 5s linear infinite;
  }
  @keyframes ilk-fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .ilk-fade { animation: ilk-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) backwards; }
  .ilk-d1{animation-delay:0.1s} .ilk-d2{animation-delay:0.2s} .ilk-d3{animation-delay:0.3s}
  @keyframes ilk-fadeIn { from{opacity:0} to{opacity:1} }
  .ilk-fade-in { animation: ilk-fadeIn 0.4s ease; }
  @keyframes ilk-modalIn {
    from { opacity: 0; transform: scale(0.96) translateY(12px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .ilk-modal-in { animation: ilk-modalIn 0.3s cubic-bezier(0.16,1,0.3,1); }
  .ilk-btn-primary {
    background: linear-gradient(135deg, ${C.brand}, ${C.brandDeep});
    color: ${C.white}; border: none;
    padding: 12px 22px; border-radius: 100px;
    font-size: 14px; font-weight: 600; font-family: inherit;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 8px 24px -8px ${C.brand}80;
  }
  .ilk-btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
  .ilk-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .ilk-btn-cream {
    background: ${C.white}; color: ${C.ink};
    border: 1px solid ${C.creamDeep};
    padding: 12px 22px; border-radius: 100px;
    font-size: 14px; font-weight: 600; font-family: inherit;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    text-decoration: none;
  }
  .ilk-btn-cream:hover { background: ${C.creamDeep}; }
  .ilk-btn-ghost {
    background: transparent; color: ${C.inkSoft};
    border: none;
    padding: 8px 14px; border-radius: 100px;
    font-size: 13px; font-weight: 600; font-family: inherit;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: all 0.2s ease;
  }
  .ilk-btn-ghost:hover { background: ${C.creamDeep}; color: ${C.ink}; }
  @media (max-width: 768px) {
    .ilk-grid-1 { grid-template-columns: 1fr !important; }
  }
`;

function SnapIcon({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8 2 6 5 6 8c0 1 .2 2 .5 3-.5.3-1 .5-1.5.5-1 0-1.5-.5-2-.5-.5 0-1 .3-1 .8 0 1 2 1.5 3 2 .8.3 1 1 1 1.5 0 1.5-3 3.5-4 4 0 .5 1 1 2 1.2.3 0 .5.5.5 1 0 .3.3.5.8.5 1 0 1.7-.3 2.5-.3 1 0 1.5.3 3 1.7.5.5 1.5 1 2.2 1s1.7-.5 2.2-1c1.5-1.5 2-1.7 3-1.7.8 0 1.5.3 2.5.3.5 0 .8-.2.8-.5 0-.5.2-1 .5-1 1-.2 2-.7 2-1.2-1-.5-4-2.5-4-4 0-.5.2-1.2 1-1.5 1-.5 3-1 3-2 0-.5-.5-.8-1-.8s-1 .5-2 .5c-.5 0-1-.2-1.5-.5.3-1 .5-2 .5-3 0-3-2-6-6-6z" fill={color}/>
    </svg>
  );
}

export default function InfluencersLinksPage() {
  useSEO({
    title: 'Mes liens — Orlode Influenceurs',
    description: "Gère tes liens sociaux. Les marques vérifient elles-mêmes en cliquant — pas d'algorithme.",
    path: '/influenceurs/mes-liens',
    noindex: true,
  });

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [welcomeOpen, setWelcomeOpen] = useState(params.get('welcome') === '1');
  const dismissWelcome = () => {
    setWelcomeOpen(false);
    params.delete('welcome');
    setParams(params, { replace: true });
  };

  const [profileId, setProfileId] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [links, setLinks] = useState<LinksMap>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlatformDef | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        const docRef = snap.docs[0]!;
        setProfileId(docRef.id);
        const data = docRef.data() as { socialLinks?: LinksMap; displayName?: string };
        setLinks(data.socialLinks ?? {});
        setCreatorName(data.displayName ?? user.displayName ?? user.email ?? 'Créateur');
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

  const filled = Object.entries(links).filter(([, s]) => s.url && s.followers);
  const totalFollowers = filled.reduce((sum, [, s]) => sum + s.followers, 0);
  const progress = Math.round((filled.length / PLATFORMS.length) * 100);

  // Loading skeleton
  if (loading) {
    return (
      <div className="ilk" style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 className="animate-spin" size={24} color={C.brand} />
      </div>
    );
  }

  // No user
  if (!user) {
    return (
      <div className="ilk" style={{ minHeight: '100vh', background: C.cream, padding: 40 }}>
        <style>{STYLES}</style>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <Shield size={40} color={C.brand} style={{ marginBottom: 12 }} />
          <h1 className="ilk-serif" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            Connecte-toi
          </h1>
          <p style={{ color: C.inkSoft, marginBottom: 18, fontSize: 14 }}>
            Tu dois être inscrit·e comme créateur·trice pour gérer tes liens.
          </p>
          <Link to="/influenceurs/inscription" className="ilk-btn-primary" style={{ textDecoration: 'none' }}>
            Créer mon profil <Sparkles size={14} />
          </Link>
        </div>
      </div>
    );
  }

  // No profile yet
  if (!profileId) {
    return (
      <div className="ilk" style={{ minHeight: '100vh', background: C.cream, padding: 40 }}>
        <style>{STYLES}</style>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <Sparkles size={40} color={C.brand} style={{ marginBottom: 12 }} />
          <h1 className="ilk-serif" style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            Pas encore inscrit·e
          </h1>
          <p style={{ color: C.inkSoft, marginBottom: 18, fontSize: 14 }}>
            Crée d'abord ton profil créateur — tu pourras ensuite y ajouter tes liens.
          </p>
          <Link to="/influenceurs/inscription" className="ilk-btn-primary" style={{ textDecoration: 'none' }}>
            Créer mon profil <Sparkles size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const initials = creatorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="ilk">
      <style>{STYLES}</style>

      {/* Sticky header (cream like maquette, not dark) */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250, 247, 242, 0.85)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: `1px solid ${C.creamDeep}`,
        padding: '16px 32px',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => navigate('/influenceurs')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            color: C.ink3, fontSize: 14, fontWeight: 600,
            fontFamily: 'inherit', padding: 0,
          }}>
            <ArrowLeft size={16} /> Retour à mon profil
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
              color: C.white, fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
            }}>{initials || '?'}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>
              {creatorName}
            </span>
          </div>
        </div>
      </header>

      <main style={{ minHeight: '100vh', background: C.cream }}>
        {/* Welcome banner */}
        {welcomeOpen && (
          <section style={{ padding: '20px 32px 0' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <div style={{
                background: C.successSoft,
                border: `1.5px solid ${C.success}40`,
                borderRadius: 16,
                padding: '14px 18px',
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <CheckCircle2 size={20} color={C.successDark} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, fontSize: 13, color: C.successDark, lineHeight: 1.55 }}>
                  <strong>Profil créé ✓</strong> Maintenant ajoute tes liens publics ci-dessous pour que les marques puissent vérifier ta vraie audience en un clic.
                </div>
                <button onClick={dismissWelcome} aria-label="Fermer" style={{
                  background: 'transparent', border: 'none', color: C.successDark,
                  cursor: 'pointer', padding: 4,
                }}>
                  <X size={16} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Hero with stats */}
        <section style={{
          background: C.ink, color: C.cream,
          padding: '60px 32px 80px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 70% 30%, ${C.brand}40, transparent 60%)`,
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
            opacity: 0.07, pointerEvents: 'none', mixBlendMode: 'overlay',
          }} />

          <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 2 }}>
            <div className="ilk-pill ilk-fade" style={{
              background: 'rgba(212, 165, 116, 0.12)',
              color: C.goldLight,
              border: `1px solid ${C.gold}40`,
              backdropFilter: 'blur(20px)',
              marginBottom: 20,
            }}>
              <Link2 size={11} /> Mes réseaux sociaux
            </div>
            <h1 className="ilk-serif ilk-fade ilk-d1" style={{
              fontSize: 'clamp(36px, 5vw, 56px)',
              fontWeight: 800, color: C.cream,
              margin: '0 0 14px',
              letterSpacing: '-0.035em', lineHeight: 1,
            }}>
              Ajoute tes liens.<br />
              <em className="ilk-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                Laisse les marques juger.
              </em>
            </h1>
            <p className="ilk-fade ilk-d2" style={{
              fontSize: 16, color: C.inkSilent,
              maxWidth: 620, margin: '0 0 36px', lineHeight: 1.6,
            }}>
              Les marques cliquent sur tes liens pour <strong style={{ color: C.cream }}>vérifier elles-mêmes</strong> tes followers en direct. Pas d'intermédiaire, pas d'algorithme — juste la vérité de tes comptes.
            </p>

            <div className="ilk-fade ilk-d3 ilk-grid-1" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
              padding: 24,
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 18,
            }}>
              <div>
                <div className="ilk-mono" style={{ fontSize: 10, fontWeight: 700, color: C.inkLight, letterSpacing: '0.08em', marginBottom: 4 }}>
                  PROFIL COMPLÉTÉ
                </div>
                <div className="ilk-serif" style={{ fontSize: 32, fontWeight: 700, color: C.cream, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  <em style={{ fontStyle: 'italic', color: C.goldLight }}>{progress}%</em>
                </div>
                <div style={{
                  marginTop: 8, height: 4, borderRadius: 100,
                  background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${progress}%`,
                    background: `linear-gradient(90deg, ${C.brand}, ${C.goldLight})`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
              <div>
                <div className="ilk-mono" style={{ fontSize: 10, fontWeight: 700, color: C.inkLight, letterSpacing: '0.08em', marginBottom: 4 }}>
                  RÉSEAUX RENSEIGNÉS
                </div>
                <div className="ilk-serif" style={{ fontSize: 32, fontWeight: 700, color: C.cream, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  <em style={{ fontStyle: 'italic' }}>{filled.length}</em>
                  <span style={{ fontSize: 18, opacity: 0.5, marginLeft: 2 }}>/ {PLATFORMS.length}</span>
                </div>
                <div style={{ fontSize: 11, color: C.inkSilent, marginTop: 6 }}>
                  Plus tu en as, plus tu es visible
                </div>
              </div>
              <div>
                <div className="ilk-mono" style={{ fontSize: 10, fontWeight: 700, color: C.inkLight, letterSpacing: '0.08em', marginBottom: 4 }}>
                  AUDIENCE TOTALE DÉCLARÉE
                </div>
                <div className="ilk-serif" style={{ fontSize: 32, fontWeight: 700, color: C.cream, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  <em style={{ fontStyle: 'italic', color: C.goldLight }}>{formatK(totalFollowers)}</em>
                </div>
                <div style={{ fontSize: 11, color: C.inkSilent, marginTop: 6 }}>
                  Vérifiable par les marques
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works strip */}
        <section style={{
          background: C.white,
          borderBottom: `1px solid ${C.creamDeep}`,
          padding: '32px',
        }}>
          <div style={{
            maxWidth: 1080, margin: '0 auto',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24,
          }} className="ilk-grid-1">
            {[
              { num: '01', Icon: Link2, title: 'Tu ajoutes tes liens', desc: "Copie-colle l'URL publique de chacun de tes réseaux et déclare tes followers." },
              { num: '02', Icon: Eye, title: 'Les marques cliquent', desc: 'Quand une marque visite ton profil Orlode, elle clique sur tes liens et vérifie en direct sur la plateforme.' },
              { num: '03', Icon: Sparkles, title: 'Le deal se fait', desc: "Une fois la marque convaincue, elle te contacte. Tout est transparent, sans intermédiaire." },
            ].map((s) => (
              <div key={s.num}>
                <div className="ilk-mono" style={{
                  fontSize: 11, fontWeight: 700, color: C.inkLight,
                  letterSpacing: '0.1em', marginBottom: 12,
                }}>
                  {s.num} / 03
                </div>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: `linear-gradient(135deg, ${C.brand}15, ${C.brand}05)`,
                  border: `1px solid ${C.brand}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.brand, marginBottom: 12,
                }}>
                  <s.Icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className="ilk-serif" style={{
                  fontSize: 18, fontWeight: 700, color: C.ink,
                  margin: '0 0 6px', letterSpacing: '-0.02em',
                }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 13, color: C.inkSoft, margin: 0, lineHeight: 1.55 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Platforms grid */}
        <section style={{ padding: '60px 32px 80px' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div style={{ marginBottom: 28 }}>
              <h2 className="ilk-serif" style={{
                fontSize: 28, fontWeight: 700, color: C.ink,
                margin: '0 0 8px', letterSpacing: '-0.025em',
              }}>
                Tes <em className="ilk-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>réseaux</em>
              </h2>
              <p style={{ fontSize: 14, color: C.inkSoft, margin: 0 }}>
                Ajoute uniquement ceux où tu es vraiment actif · Mieux vaut <strong>3 actifs</strong> que <strong>7 inactifs</strong>
              </p>
            </div>

            {error && (
              <div style={{
                background: '#FEE2E2', border: '1px solid #FCA5A5',
                borderRadius: 12, padding: 12, fontSize: 13, color: '#991B1B',
                marginBottom: 16,
              }}>⚠️ {error}</div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 14,
            }}>
              {PLATFORMS.map((p, i) => (
                <div key={p.id} className="ilk-fade" style={{ animationDelay: `${i * 0.05}s` }}>
                  <PlatformCard
                    platform={p}
                    data={links[p.id] ?? { url: '', followers: 0, lastUpdatedAt: null }}
                    isSaving={savingId === p.id}
                    onEdit={() => setEditing(p)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Honest disclaimer */}
        <section style={{
          background: C.ink,
          color: C.cream,
          padding: '60px 32px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 20% 80%, ${C.brandDeep}40, transparent 60%)`,
          }} />
          <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <Shield size={32} color={C.goldLight} style={{ marginBottom: 16 }} />
            <h3 className="ilk-serif" style={{
              fontSize: 26, fontWeight: 700, color: C.cream,
              margin: '0 0 12px', letterSpacing: '-0.025em',
            }}>
              Pourquoi pas de vérification auto ?
            </h3>
            <p style={{ fontSize: 15, color: C.inkSilent, margin: '0 0 24px', lineHeight: 1.65 }}>
              Parce que <strong style={{ color: C.cream }}>la vraie confiance</strong> ne se mesure pas par un algorithme. Les marques préfèrent cliquer sur ton lien et voir tes vrais posts, tes vrais commentaires, ta vraie communauté.
            </p>
            <p style={{ fontSize: 14, color: C.inkLight, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
              « Un créateur honnête vaut mieux qu'un score automatique. »
            </p>
          </div>
        </section>
      </main>

      {editing && (
        <EditModal
          platform={editing}
          data={links[editing.id] ?? { url: '', followers: 0, lastUpdatedAt: null }}
          saving={savingId === editing.id}
          onClose={() => setEditing(null)}
          onSave={saveLink}
          onRemove={removeLink}
        />
      )}
    </div>
  );
}

function PlatformCard({ platform, data, onEdit }: {
  platform: PlatformDef;
  data: SocialLink;
  isSaving: boolean;
  onEdit: () => void;
}) {
  const Icon = platform.icon === 'snap-custom' ? null : platform.icon;
  const isFilled = !!data.url && data.followers > 0;
  const lastUpdated = data.lastUpdatedAt
    ? new Date(data.lastUpdatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null;

  return (
    <article style={{
      background: C.white,
      border: `1.5px solid ${isFilled ? C.success + '40' : C.creamDeep}`,
      borderRadius: 20,
      padding: 18,
      transition: 'all 0.25s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: platform.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 6px 14px -4px ${platform.color}40`,
          }}>
            {Icon ? (
              <Icon size={18} color={C.white} fill={platform.id === 'facebook' ? C.white : 'none'} strokeWidth={2} />
            ) : (
              <SnapIcon size={20} color={C.snapchatText} />
            )}
          </div>
          <div>
            <div className="ilk-serif" style={{
              fontSize: 17, fontWeight: 700, color: C.ink,
              letterSpacing: '-0.02em', lineHeight: 1,
            }}>
              {platform.name}
            </div>
            {isFilled ? (
              <div style={{ fontSize: 11, color: C.success, fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} /> Renseigné
              </div>
            ) : (
              <div style={{ fontSize: 11, color: C.inkLight, marginTop: 4 }}>
                Non renseigné
              </div>
            )}
          </div>
        </div>
      </div>

      {isFilled ? (
        <div className="ilk-fade-in">
          <div style={{
            background: C.cream,
            border: `1px solid ${C.creamDeep}`,
            borderRadius: 12,
            padding: 12,
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ilk-mono" style={{
                  fontSize: 9, fontWeight: 700, color: C.inkLight,
                  letterSpacing: '0.08em', marginBottom: 4,
                }}>
                  LIEN PUBLIC
                </div>
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12, color: C.brand, fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    wordBreak: 'break-all',
                  }}
                >
                  {data.url.replace(/https?:\/\//, '')} <ExternalLink size={11} />
                </a>
              </div>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: 10, marginTop: 10,
              borderTop: `1px dashed ${C.creamDeep}`,
            }}>
              <div>
                <div className="ilk-mono" style={{
                  fontSize: 9, fontWeight: 700, color: C.inkLight,
                  letterSpacing: '0.08em', marginBottom: 2,
                }}>
                  FOLLOWERS DÉCLARÉS
                </div>
                <div className="ilk-serif" style={{
                  fontSize: 22, fontWeight: 700, color: C.ink,
                  letterSpacing: '-0.02em', lineHeight: 1,
                }}>
                  <em style={{ fontStyle: 'italic' }}>{formatK(data.followers)}</em>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: C.inkLight, fontWeight: 500 }}>
                  Mis à jour
                </div>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>
                  {lastUpdated || "à l'instant"}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={onEdit}
              className="ilk-btn-cream"
              style={{ flex: 1, justifyContent: 'center', padding: '9px 14px', fontSize: 12 }}
            >
              <Edit3 size={12} /> Modifier
            </button>
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ilk-btn-cream"
              style={{
                padding: '9px 14px', fontSize: 12,
                color: C.brand,
              }}
            >
              <Eye size={12} /> Visiter
            </a>
          </div>
        </div>
      ) : (
        <button
          onClick={onEdit}
          type="button"
          style={{
            width: '100%',
            background: C.cream,
            color: C.ink2,
            border: `1.5px dashed ${C.inkLight}40`,
            padding: '12px 18px',
            borderRadius: 12,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Plus size={14} /> Ajouter mon lien {platform.name}
        </button>
      )}
    </article>
  );
}

function EditModal({ platform, data, saving, onClose, onSave, onRemove }: {
  platform: PlatformDef;
  data: SocialLink;
  saving: boolean;
  onClose: () => void;
  onSave: (id: string, payload: SocialLink) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
}) {
  const [link, setLink] = useState(data.url || '');
  const [followers, setFollowers] = useState(data.followers ? String(data.followers) : '');
  const Icon = platform.icon === 'snap-custom' ? null : platform.icon;
  const followersNum = parseInt(followers, 10) || 0;
  const isValid = link.length > 4 && followersNum > 0;
  const fullLink = link.startsWith('http') ? link : `https://${platform.domainHint}${link}`;

  const handleSave = () => {
    if (!isValid) return;
    onSave(platform.id, {
      url: fullLink,
      followers: followersNum,
      lastUpdatedAt: new Date().toISOString(),
    });
  };

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10, 8, 20, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="ilk-modal-in" style={{
        background: C.white,
        borderRadius: 24,
        width: '100%', maxWidth: 460,
        overflow: 'hidden',
        boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{
          background: platform.gradient,
          padding: '24px 24px',
          position: 'relative', overflow: 'hidden',
        }}>
          <button onClick={onClose} aria-label="Fermer" style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(20px)',
            border: 'none',
            color: platform.id === 'snapchat' ? C.snapchatText : C.white,
            width: 32, height: 32, borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={15} />
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 2,
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {Icon ? (
                <Icon size={22} color={platform.id === 'snapchat' ? C.snapchatText : C.white} strokeWidth={2} />
              ) : (
                <SnapIcon size={24} color={C.snapchatText} />
              )}
            </div>
            <div>
              <h2 className="ilk-serif" style={{
                fontSize: 22, fontWeight: 700,
                color: platform.id === 'snapchat' ? C.snapchatText : C.white,
                margin: '0 0 2px', letterSpacing: '-0.02em',
              }}>
                <em style={{ fontStyle: 'italic' }}>{platform.name}</em>
              </h2>
              <p style={{
                fontSize: 12,
                color: platform.id === 'snapchat' ? `${C.snapchatText}aa` : 'rgba(255,255,255,0.85)',
                margin: 0, fontWeight: 500,
              }}>
                Ajoute ton lien public + tes followers
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{
            background: C.brandSoft,
            border: `1px solid ${C.brand}25`,
            borderRadius: 12, padding: 12,
            marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <Info size={15} color={C.brand} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: C.brandDark, lineHeight: 1.5 }}>
              <strong>Honnêteté totale</strong> · Les marques cliquent sur ton lien pour vérifier elles-mêmes. Sois exact dans tes chiffres.
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 700,
              color: C.ink2, marginBottom: 6,
            }}>
              Lien public de ton profil *
            </label>
            <div style={{
              display: 'flex', alignItems: 'stretch',
              background: C.cream,
              borderRadius: 12,
              border: `1.5px solid ${link ? C.brand : C.creamDeep}`,
              overflow: 'hidden',
              transition: 'border 0.2s, box-shadow 0.2s',
              boxShadow: link ? `0 0 0 4px ${C.brandSoft}` : 'none',
            }}>
              <div style={{
                padding: '12px 12px',
                color: C.inkSoft, fontSize: 12,
                background: C.white,
                borderRight: `1px solid ${C.creamDeep}`,
                display: 'flex', alignItems: 'center',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {platform.domainHint}
              </div>
              <input
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="ton.handle"
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', padding: '12px 14px',
                  fontSize: 13, color: C.ink, fontFamily: 'inherit',
                  minWidth: 0,
                }}
              />
              {link && (
                <a
                  href={fullLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '12px 14px',
                    background: C.brand, color: C.white,
                    display: 'flex', alignItems: 'center', gap: 4,
                    textDecoration: 'none',
                    fontSize: 11, fontWeight: 700,
                  }}
                  title="Tester le lien"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            <p style={{ fontSize: 11, color: C.inkLight, marginTop: 6, lineHeight: 1.4 }}>
              Colle l'URL complète ou juste ton handle · Profil public obligatoire
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 700,
              color: C.ink2, marginBottom: 6,
            }}>
              Nombre de followers *
            </label>
            <input
              type="number"
              value={followers}
              onChange={e => setFollowers(e.target.value)}
              placeholder="Ex: 45000"
              className="ilk-input ilk-mono"
              style={{ fontWeight: 700, fontSize: 16 }}
            />
            <p style={{ fontSize: 11, color: C.inkLight, marginTop: 6, lineHeight: 1.4 }}>
              💡 Compte arrondi au millier · Tu pourras le mettre à jour à tout moment
            </p>
          </div>

          {link && followers && (
            <div className="ilk-fade-in" style={{
              background: C.cream,
              border: `1px dashed ${C.brand}40`,
              borderRadius: 12, padding: 14,
              marginBottom: 20,
            }}>
              <div className="ilk-mono" style={{
                fontSize: 9, fontWeight: 700, color: C.brand,
                letterSpacing: '0.08em', marginBottom: 8,
              }}>
                APERÇU SUR TON PROFIL ORLODE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: platform.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {Icon ? (
                    <Icon size={16} color={platform.id === 'snapchat' ? C.snapchatText : C.white} strokeWidth={2} />
                  ) : (
                    <SnapIcon size={18} color={C.snapchatText} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
                    {platform.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.brand, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Voir le profil <ExternalLink size={10} />
                  </div>
                </div>
                <div className="ilk-serif" style={{
                  fontSize: 22, fontWeight: 700, color: C.ink,
                  letterSpacing: '-0.02em',
                }}>
                  <em style={{ fontStyle: 'italic' }}>{formatK(followersNum)}</em>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '14px 24px',
          borderTop: `1px solid ${C.creamDeep}`,
          background: C.cream,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {data.url ? (
            <button
              onClick={() => onRemove(platform.id)}
              disabled={saving}
              className="ilk-btn-ghost"
              style={{ color: C.danger }}
            >
              <Trash2 size={12} /> Supprimer
            </button>
          ) : (
            <span style={{ fontSize: 11, color: C.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Lock size={11} /> Tu pourras modifier à tout moment
            </span>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} className="ilk-btn-cream">Annuler</button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="ilk-btn-primary"
            >
              {saving
                ? <><Loader2 size={13} className="animate-spin" /> Enregistrement…</>
                : <><Check size={13} /> Enregistrer</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
