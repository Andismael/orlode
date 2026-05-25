/**
 * Orlode Influenceurs — premium editorial creator signup.
 * Mirrors the TalentsSignupPage architecture (5 numbered steps + sticky
 * live preview) but in purple-editorial — proof here is social handles
 * + audience numbers, not video, so there's no video upload step.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import {
  ArrowLeft, Check, X, Sparkles, Shield, Clock,
  MapPin, MessageCircle, Plus, Mail, Loader2, BadgeCheck, Flame,
  Instagram, Music, Youtube as YoutubeIcon, Eye, Heart, AtSign,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { useAuthStore } from '@/store/authStore';

const C = {
  brand: '#6366F1', brandDeep: '#4F46E5', brandDark: '#3730A3',
  brandDarker: '#1E1B4B',
  brandSoft: '#EEF2FF', brandLight: '#A5B4FC', brandMid: '#818CF8',
  gold: '#D4A574', goldDeep: '#B8895C', goldLight: '#E8C9A0',
  cream: '#FAF7F2', creamDeep: '#F0EBE3',
  ink: '#0A0814', ink2: '#1A1530', ink3: '#3D3550',
  inkSoft: '#5C5570', inkLight: '#94909E', inkSilent: '#C5C2D0',
  success: '#10B981', successSoft: '#D1FAE5',
  whatsapp: '#25D366', white: '#FFFFFF',
};

const CATEGORIES = ['Mode', 'Tech', 'Food', 'Lifestyle', 'Fitness', 'Beauté', 'Business', 'Voyage'];
const LANGUAGES = [
  'Français', 'Anglais', 'Espagnol', 'Portugais', 'Arabe',
  'Mandarin', 'Hindi', 'Allemand', 'Italien', 'Russe',
  'Swahili', 'Wolof', 'Dioula', 'Lingala', 'Bambara',
];
const RESPONSE_TIMES: { id: string; label: string; desc: string }[] = [
  { id: '< 2h',     label: 'Très rapide',  desc: 'Sous 2 heures' },
  { id: '< 6h',     label: 'Rapide',       desc: 'Sous 6 heures' },
  { id: '< 24h',    label: 'Standard',     desc: 'Sous 24h' },
  { id: '2 jours',  label: 'Posé',         desc: 'Sous 48h' },
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .isg { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
  .isg-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .isg-mono { font-family: 'JetBrains Mono', monospace; }
  .isg-input {
    width: 100%; background: ${C.white}; color: ${C.ink};
    border: 1.5px solid ${C.creamDeep};
    border-radius: 14px; padding: 14px 18px;
    font-size: 15px; font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .isg-input:focus { border-color: ${C.brand}; box-shadow: 0 0 0 4px ${C.brandSoft}; }
  .isg-input::placeholder { color: ${C.inkLight}; }
  .isg-btn-primary {
    background: linear-gradient(135deg, ${C.brand}, ${C.brandDeep});
    color: ${C.white}; border: none;
    padding: 16px 28px; border-radius: 100px;
    font-size: 15px; font-weight: 600; font-family: inherit;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 10px;
    transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 10px 30px -8px ${C.brand}80;
  }
  .isg-btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
  .isg-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .isg-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 13px; border-radius: 100px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  @keyframes isg-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  .isg-shimmer {
    background: linear-gradient(90deg, ${C.brandLight} 0%, ${C.goldLight} 50%, ${C.brandLight} 100%);
    background-size: 200% auto;
    background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: isg-shimmer 5s linear infinite;
  }
  @keyframes isg-fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .isg-fade { animation: isg-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) backwards; }
  .isg-d1{animation-delay:0.1s} .isg-d2{animation-delay:0.2s} .isg-d3{animation-delay:0.3s}
  @keyframes isg-fadeIn { from{opacity:0} to{opacity:1} }
  .isg-fade-in { animation: isg-fadeIn 0.4s ease; }
  @keyframes isg-slowRotate { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .isg-rot { animation: isg-slowRotate 60s linear infinite; }
  @media (max-width: 1024px) {
    .isg-hide-mobile { display: none !important; }
    .isg-grid-1 { grid-template-columns: 1fr !important; }
  }
`;

interface FormData {
  displayName: string;
  handle: string;
  city: string;
  bio: string;
  categories: string[];
  instagram: string;
  tiktok: string;
  youtube: string;
  whatsapp: string;
  languages: string[];
  responseTime: string;
}

const initialData: FormData = {
  displayName: '', handle: '', city: '', bio: '',
  categories: [],
  instagram: '', tiktok: '', youtube: '',
  whatsapp: '',
  languages: ['Français'],
  responseTime: '< 24h',
};

export default function InfluencersSignupPage() {
  useSEO({
    title: 'Inscription créateur — Orlode Influenceurs',
    description: "Rejoins la marketplace créateurs Orlode. Reçois les briefs des marques directement, sans agence.",
    path: '/influenceurs/inscription',
    noindex: true,
  });

  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [data, setData] = useState<FormData>(initialData);

  const [authMode, setAuthMode] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signInGoogle = async () => {
    setAuthBusy(true); setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const r = await signInWithPopup(auth, provider);
      if (r.user.displayName && !data.displayName) {
        setData(d => ({ ...d, displayName: r.user.displayName ?? '' }));
      }
    } catch (err) { setError((err as Error).message); }
    finally { setAuthBusy(false); }
  };

  const signInEmail = async () => {
    setAuthBusy(true); setError(null);
    try {
      try { await signInWithEmailAndPassword(auth, email, password); }
      catch { await createUserWithEmailAndPassword(auth, email, password); }
    } catch (err) { setError((err as Error).message); }
    finally { setAuthBusy(false); }
  };

  const ig = parseInt(data.instagram, 10) || 0;
  const tt = parseInt(data.tiktok, 10) || 0;
  const yt = parseInt(data.youtube, 10) || 0;
  const totalAudience = ig + tt + yt;
  const hasAtLeastOneNetwork = ig > 0 || tt > 0 || yt > 0;

  const progressFields = [
    data.displayName.trim().length >= 2,
    data.handle.trim().length >= 2,
    data.city.trim().length >= 2,
    data.bio.trim().length >= 20,
    data.categories.length > 0,
    hasAtLeastOneNetwork,
    data.whatsapp.replace(/\D/g, '').length >= 8,
    data.languages.length > 0,
  ];
  const progress = Math.round((progressFields.filter(Boolean).length / progressFields.length) * 100);

  const isValid = !!user
    && data.displayName.trim().length >= 2
    && data.handle.trim().length >= 2
    && data.city.trim().length >= 2
    && data.bio.trim().length >= 20
    && data.categories.length >= 1
    && data.categories.length <= 4
    && hasAtLeastOneNetwork
    && data.whatsapp.replace(/\D/g, '').length >= 8
    && data.languages.length >= 1;

  const submit = async () => {
    if (!user || !isValid || submitting) return;
    setSubmitting(true); setError(null);
    try {
      const handleNormalized = data.handle.trim().startsWith('@')
        ? data.handle.trim() : `@${data.handle.trim()}`;
      const phoneDigits = data.whatsapp.replace(/\D/g, '');
      const audienceObj: Record<string, number> = {};
      if (ig > 0) audienceObj.instagram = ig;
      if (tt > 0) audienceObj.tiktok = tt;
      if (yt > 0) audienceObj.youtube = yt;
      audienceObj.total = totalAudience;

      const profileRef = doc(collection(db, 'influencers_profiles'));
      await setDoc(profileRef, {
        userId: user.uid,
        displayName: data.displayName.trim(),
        handle: handleNormalized,
        verified: false,
        bio: data.bio.trim(),
        city: data.city.trim(),
        categories: data.categories,
        audience: audienceObj,
        languages: data.languages,
        responseTime: data.responseTime,
        status: 'pending',
        rating: 0,
        completedDeals: 0,
        engagement: 0,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      await setDoc(doc(profileRef, 'private', 'contact'), {
        whatsappNumber: phoneDigits,
        ownerEmail: user.email ?? null,
        savedAt: serverTimestamp(),
      });

      navigate('/influenceurs/mes-liens?welcome=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="isg">
      <style>{STYLES}</style>

      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10, 8, 20, 0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 32px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link to="/influenceurs" style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: C.cream, textDecoration: 'none',
            width: 38, height: 38, borderRadius: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeft size={16} />
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
              color: C.white, fontWeight: 800, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
              boxShadow: `0 6px 16px -4px ${C.brand}80`,
            }}>O</div>
            <div>
              <div className="isg-serif" style={{
                fontSize: 15, fontWeight: 700, color: C.cream, lineHeight: 1,
              }}>
                Orlode <em style={{ fontStyle: 'italic', color: C.goldLight }}>Influenceurs</em>
              </div>
              <div className="isg-mono" style={{
                fontSize: 9, fontWeight: 600, color: C.inkSilent,
                letterSpacing: '0.1em', marginTop: 2,
              }}>
                INSCRIPTION CRÉATEUR
              </div>
            </div>
          </div>

          <div className="isg-hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} color={C.goldLight} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.inkSilent }}>
              5 min · Vérif sous 48h
            </span>
          </div>
        </div>
      </header>

      <main style={{ minHeight: '100vh', background: C.cream }}>
        {/* Hero */}
        <section style={{
          background: C.brandDarker,
          color: C.cream,
          padding: '60px 32px 100px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 30% 30%, ${C.brand}50, transparent 60%),
                         radial-gradient(ellipse at 80% 70%, ${C.brandMid}30, transparent 50%)`,
          }} />
          <div className="isg-rot" style={{
            position: 'absolute', top: '-25%', right: '-12%',
            width: 600, height: 600, borderRadius: '50%',
            border: `1px dashed ${C.goldLight}25`, pointerEvents: 'none',
          }} />
          <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
            <div className="isg-pill isg-fade" style={{
              background: 'rgba(212, 165, 116, 0.12)',
              color: C.goldLight,
              border: `1px solid ${C.gold}40`,
              backdropFilter: 'blur(20px)',
              marginBottom: 20,
            }}>
              <Sparkles size={11} /> Inscription créateur · Bêta
            </div>
            <h1 className="isg-serif isg-fade isg-d1" style={{
              fontSize: 'clamp(36px, 6vw, 64px)',
              fontWeight: 800, color: C.cream,
              margin: '0 0 16px',
              letterSpacing: '-0.035em', lineHeight: 1,
            }}>
              Crée ton profil.<br />
              <em className="isg-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                Reçois des briefs.
              </em>
            </h1>
            <p className="isg-fade isg-d2" style={{
              fontSize: 17, color: C.inkSilent,
              maxWidth: 620, margin: '0 0 28px', lineHeight: 1.55,
            }}>
              Les marques te contactent directement par WhatsApp. <strong style={{ color: C.cream }}>Pas d'agence, pas de commission</strong>. Tu négocies. Tu signes. Tu encaisses.
            </p>

            <div className="isg-fade isg-d3" style={{
              maxWidth: 480, display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ flex: 1 }}>
                <div className="isg-mono" style={{
                  fontSize: 10, fontWeight: 700, color: C.inkLight,
                  letterSpacing: '0.08em', marginBottom: 6,
                }}>
                  PROGRESSION
                </div>
                <div style={{
                  height: 6, borderRadius: 100,
                  background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${progress}%`,
                    background: `linear-gradient(90deg, ${C.brandMid}, ${C.goldLight})`,
                    transition: 'width 0.5s ease', borderRadius: 100,
                  }} />
                </div>
              </div>
              <div className="isg-serif" style={{
                fontSize: 28, fontWeight: 700, color: C.cream,
                letterSpacing: '-0.03em', lineHeight: 1,
                minWidth: 60, textAlign: 'right',
              }}>
                <em style={{ fontStyle: 'italic', color: progress === 100 ? C.brandLight : C.goldLight }}>
                  {progress}%
                </em>
              </div>
            </div>
          </div>
        </section>

        {/* Form + Preview */}
        <section style={{ padding: '60px 32px 80px', marginTop: -40, position: 'relative', zIndex: 5 }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32,
            }} className="isg-grid-1">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {!user ? (
                  <StepCard>
                    <StepHeader number="0" title="Connecte-toi" subtitle="Google ou email/mot de passe — ton compte sert à gérer ton profil plus tard." />
                    <div style={{ marginLeft: 44 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                        <button onClick={() => setAuthMode('google')} type="button" style={modeChip(authMode === 'google')}>
                          Google
                        </button>
                        <button onClick={() => setAuthMode('email')} type="button" style={modeChip(authMode === 'email')}>
                          Email
                        </button>
                      </div>
                      {authMode === 'google' ? (
                        <button onClick={signInGoogle} disabled={authBusy} type="button" className="isg-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                          {authBusy ? <Loader2 size={16} className="animate-spin" /> : <>Continuer avec Google <Sparkles size={14} /></>}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <input type="email" className="isg-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" />
                          <input type="password" className="isg-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                          <button onClick={signInEmail} disabled={authBusy || !email || password.length < 6} type="button" className="isg-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            {authBusy ? <Loader2 size={16} className="animate-spin" /> : <><Mail size={14} /> Continuer</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </StepCard>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: C.successSoft, border: `1px solid ${C.success}40`,
                    borderRadius: 12, padding: '12px 16px',
                  }}>
                    <Check size={16} color="#065F46" />
                    <span style={{ fontSize: 13, color: '#065F46', fontWeight: 600 }}>
                      Connecté · {user.email}
                    </span>
                  </div>
                )}

                {user && (
                  <>
                    <StepCard>
                      <StepHeader number="1" title="Ton identité créateur" subtitle="Comment les marques vont te reconnaître" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginLeft: 44 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="isg-grid-1">
                          <Field label="Nom affiché *">
                            <input value={data.displayName} onChange={e => setData(d => ({ ...d, displayName: e.target.value }))} placeholder="Aïssatou Diallo" className="isg-input" />
                          </Field>
                          <Field label="Handle principal *">
                            <div style={{ position: 'relative' }}>
                              <AtSign size={15} style={{
                                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                                color: C.brand,
                              }} />
                              <input value={data.handle} onChange={e => setData(d => ({ ...d, handle: e.target.value }))} placeholder="aissatou.styles" className="isg-input" style={{ paddingLeft: 42 }} />
                            </div>
                          </Field>
                        </div>
                        <Field label="Ville · Pays *">
                          <div style={{ position: 'relative' }}>
                            <MapPin size={15} style={{
                              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                              color: C.brand,
                            }} />
                            <input value={data.city} onChange={e => setData(d => ({ ...d, city: e.target.value }))} placeholder="Paris · Abidjan · Lagos · São Paulo…" className="isg-input" style={{ paddingLeft: 42 }} />
                          </div>
                        </Field>
                        <Field label={`Bio (≥20 caractères, ${data.bio.length}/200) *`}>
                          <textarea
                            value={data.bio}
                            onChange={e => setData(d => ({ ...d, bio: e.target.value }))}
                            placeholder="Créateur·trice de contenu mode. Collabs : marques locales et internationales. Ton style en une phrase."
                            className="isg-input"
                            rows={3}
                            maxLength={200}
                            style={{ resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }}
                          />
                        </Field>
                      </div>
                    </StepCard>

                    <StepCard>
                      <StepHeader number="2" title="Tes catégories" subtitle="1 minimum, max 4 — ce sur quoi tu publies" />
                      <div style={{ marginLeft: 44 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {CATEGORIES.map(c => {
                            const active = data.categories.includes(c);
                            const disabled = !active && data.categories.length >= 4;
                            return (
                              <button
                                key={c}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  if (active) {
                                    setData(d => ({ ...d, categories: d.categories.filter(cat => cat !== c) }));
                                  } else if (!disabled) {
                                    setData(d => ({ ...d, categories: [...d.categories, c] }));
                                  }
                                }}
                                style={{
                                  background: active ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})` : C.cream,
                                  color: active ? C.white : (disabled ? C.inkLight : C.ink2),
                                  border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
                                  padding: '10px 18px', borderRadius: 100,
                                  fontSize: 13, fontWeight: 600,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  fontFamily: 'inherit',
                                  transition: 'all 0.15s',
                                  opacity: disabled ? 0.5 : 1,
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                }}
                              >
                                {active && <Check size={11} />}
                                {c}
                              </button>
                            );
                          })}
                        </div>
                        <p style={{ fontSize: 11, color: C.inkLight, marginTop: 10 }}>
                          {data.categories.length}/4 catégories sélectionnées
                        </p>
                      </div>
                    </StepCard>

                    <StepCard>
                      <StepHeader number="3" title="Ton audience" subtitle="Au moins UN réseau requis — les chiffres seront vérifiés sous 48h" />
                      <div style={{
                        marginLeft: 44,
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
                      }} className="isg-grid-1">
                        <AudienceField icon={Instagram} color="#E1306C" label="Instagram" value={data.instagram} onChange={v => setData(d => ({ ...d, instagram: v }))} />
                        <AudienceField icon={Music} color="#000000" label="TikTok" value={data.tiktok} onChange={v => setData(d => ({ ...d, tiktok: v }))} />
                        <AudienceField icon={YoutubeIcon} color="#FF0000" label="YouTube" value={data.youtube} onChange={v => setData(d => ({ ...d, youtube: v }))} />
                      </div>
                      {totalAudience > 0 && (
                        <div style={{
                          marginLeft: 44, marginTop: 18,
                          background: `linear-gradient(135deg, ${C.brand}08, ${C.gold}10)`,
                          border: `1px solid ${C.brand}20`,
                          borderRadius: 14, padding: '14px 18px',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
                            color: C.white,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <BadgeCheck size={16} />
                          </div>
                          <div>
                            <div className="isg-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1 }}>
                              <span className="isg-mono">{totalAudience.toLocaleString('fr-FR')}</span>
                              <span style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 14, color: C.inkSoft, marginLeft: 8 }}>
                                abonnés cumulés
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </StepCard>

                    <StepCard>
                      <StepHeader number="4" title="Contact & dispo" subtitle="Comment les marques te contactent + quand tu réponds" />
                      <div style={{ marginLeft: 44, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                          <Field label="WhatsApp *">
                            <div style={{
                              display: 'flex', alignItems: 'stretch',
                              background: data.whatsapp ? C.successSoft : C.cream,
                              borderRadius: 14,
                              border: `1.5px solid ${data.whatsapp ? C.whatsapp : C.creamDeep}`,
                              overflow: 'hidden',
                              transition: 'all 0.2s',
                            }}>
                              <div style={{
                                padding: '14px 14px',
                                background: data.whatsapp ? C.whatsapp : C.white,
                                color: data.whatsapp ? C.white : C.inkSoft,
                                borderRight: `1px solid ${C.creamDeep}`,
                                display: 'flex', alignItems: 'center',
                              }}>
                                <MessageCircle size={15} fill={data.whatsapp ? C.white : 'none'} />
                              </div>
                              <input
                                type="tel"
                                value={data.whatsapp}
                                onChange={e => setData(d => ({ ...d, whatsapp: e.target.value }))}
                                placeholder="+225 07 12 34 56 78"
                                style={{
                                  flex: 1, border: 'none', outline: 'none',
                                  background: 'transparent', padding: '14px 16px',
                                  fontSize: 15, color: C.ink, fontFamily: 'inherit',
                                  fontWeight: 600, minWidth: 0,
                                }}
                              />
                            </div>
                          </Field>
                          <p style={{ fontSize: 11, color: C.inkLight, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Shield size={11} /> Privé · Jamais affiché publiquement
                          </p>
                        </div>

                        <Field label={<>Langues parlées * <span style={{ color: C.inkLight, fontWeight: 500 }}>(max 4)</span></>}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {LANGUAGES.map(lang => {
                              const active = data.languages.includes(lang);
                              const disabled = !active && data.languages.length >= 4;
                              return (
                                <button
                                  key={lang}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => {
                                    if (active) {
                                      setData(d => ({ ...d, languages: d.languages.filter(l => l !== lang) }));
                                    } else if (!disabled) {
                                      setData(d => ({ ...d, languages: [...d.languages, lang] }));
                                    }
                                  }}
                                  style={{
                                    background: active ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})` : C.white,
                                    color: active ? C.white : (disabled ? C.inkLight : C.ink2),
                                    border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
                                    padding: '8px 14px', borderRadius: 100,
                                    fontSize: 13, fontWeight: 600,
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'all 0.15s',
                                    opacity: disabled ? 0.5 : 1,
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                  }}
                                >
                                  {active && <Check size={11} />}
                                  {lang}
                                </button>
                              );
                            })}
                          </div>
                        </Field>

                        <Field label="Temps de réponse moyen">
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                          }} className="isg-grid-1">
                            {RESPONSE_TIMES.map(r => {
                              const active = data.responseTime === r.id;
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => setData(d => ({ ...d, responseTime: r.id }))}
                                  style={{
                                    background: active ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})` : C.cream,
                                    color: active ? C.white : C.ink2,
                                    border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
                                    borderRadius: 14, padding: '14px 12px',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    boxShadow: active ? `0 8px 20px -8px ${C.brand}80` : 'none',
                                  }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{r.label}</div>
                                  <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.3 }}>{r.desc}</div>
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      </div>
                    </StepCard>

                    {error && (
                      <div style={{
                        background: '#FEE2E2', border: '1px solid #FCA5A5',
                        borderRadius: 12, padding: 14, fontSize: 13, color: '#991B1B',
                      }}>⚠️ {error}</div>
                    )}

                    <div style={{
                      background: C.brandDarker,
                      color: C.cream,
                      borderRadius: 24, padding: 32,
                      position: 'relative', overflow: 'hidden',
                      textAlign: 'center',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: `radial-gradient(ellipse at 50% 50%, ${C.brand}30, transparent 60%)`,
                      }} />
                      <div style={{ position: 'relative', zIndex: 2 }}>
                        <Flame size={24} color={C.goldLight} style={{ marginBottom: 10 }} />
                        <h3 className="isg-serif" style={{
                          fontSize: 26, fontWeight: 700, color: C.cream,
                          margin: '0 0 8px', letterSpacing: '-0.025em',
                        }}>
                          <em style={{ fontStyle: 'italic' }}>Prêt à recevoir des briefs ?</em>
                        </h3>
                        <p style={{ fontSize: 13, color: C.inkSilent, margin: '0 0 24px' }}>
                          {isValid
                            ? 'Tout est rempli · Tu peux créer ton profil'
                            : 'Remplis tous les champs obligatoires pour publier'}
                        </p>
                        <button
                          onClick={submit}
                          disabled={!isValid || submitting}
                          type="button"
                          className="isg-btn-primary"
                          style={{
                            padding: '18px 36px',
                            fontSize: 15,
                            background: isValid
                              ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`
                              : `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
                            boxShadow: isValid ? `0 14px 36px -8px ${C.gold}80` : 'none',
                          }}
                        >
                          {submitting
                            ? <><Loader2 size={16} className="animate-spin" /> Création du profil…</>
                            : <><Sparkles size={16} /> Créer mon profil créateur</>}
                        </button>
                        <p style={{
                          fontSize: 11, color: C.inkLight,
                          margin: '14px 0 0', fontStyle: 'italic',
                        }}>
                          Vérification sous 48h · Tu seras notifié par WhatsApp
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="isg-hide-mobile">
                <PreviewCard data={data} ig={ig} tt={tt} yt={yt} total={totalAudience} />
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function modeChip(active: boolean): React.CSSProperties {
  return {
    background: active ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})` : C.cream,
    color: active ? C.white : C.ink2,
    border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
    padding: '8px 16px', borderRadius: 100,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="isg-fade-in" style={{
      background: C.white,
      border: `1px solid ${C.creamDeep}`,
      borderRadius: 24, padding: 32,
    }}>
      {children}
    </div>
  );
}

function StepHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.brandSoft}, ${C.brand}15)`,
          border: `1px solid ${C.brand}30`,
          color: C.brandDeep,
          fontFamily: 'Fraunces, serif',
          fontSize: 14, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {number}
        </div>
        <h3 className="isg-serif" style={{
          fontSize: 22, fontWeight: 700, color: C.ink,
          margin: 0, letterSpacing: '-0.025em',
        }}>
          {title}
        </h3>
      </div>
      {subtitle && (
        <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 0 44px', lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700,
        color: C.ink2, marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function AudienceField({ icon: Icon, color, label, value, onChange }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const num = parseInt(value, 10) || 0;
  const active = num > 0;
  return (
    <div>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, fontWeight: 700, color: C.ink2, marginBottom: 6,
      }}>
        <Icon size={13} color={color} />
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: active ? C.white : C.cream,
        borderRadius: 12,
        border: `1.5px solid ${active ? color : C.creamDeep}`,
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="98000"
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', padding: '12px 14px',
            fontSize: 14, color: C.ink, fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, minWidth: 0,
          }}
        />
        <div style={{
          padding: '0 12px',
          display: 'flex', alignItems: 'center',
          fontSize: 11, fontWeight: 700,
          color: active ? color : C.inkLight,
          background: active ? `${color}10` : 'transparent',
        }}>
          abos
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ data, ig, tt, yt, total }: {
  data: FormData;
  ig: number; tt: number; yt: number; total: number;
}) {
  const first = data.displayName.split(' ')[0] || 'Ton';
  const initial = (data.displayName[0] || '?').toUpperCase();
  const accentGradient = `linear-gradient(155deg, ${C.brand} 0%, ${C.brandDeep} 70%, ${C.gold} 100%)`;
  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div style={{ position: 'sticky', top: 90 }}>
      <div className="isg-mono" style={{
        fontSize: 10, fontWeight: 700, color: C.inkLight,
        letterSpacing: '0.1em', marginBottom: 10,
        textAlign: 'center',
      }}>
        APERÇU TEMPS RÉEL
      </div>

      <div style={{
        width: '100%', maxWidth: 280, margin: '0 auto',
        background: accentGradient,
        borderRadius: 24,
        position: 'relative', overflow: 'hidden',
        aspectRatio: '9/16',
        boxShadow: `0 30px 60px -20px ${C.brand}80`,
      }}>
        <svg viewBox="0 0 200 320" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <radialGradient id="isg-prev" cx="50%" cy="35%">
              <stop offset="0%" stopColor="white" stopOpacity="0.35" />
              <stop offset="60%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="320" fill="url(#isg-prev)" />
          <circle cx="100" cy="100" r="50" fill={C.goldLight} opacity="0.30" />
          <ellipse cx="100" cy="115" rx="32" ry="36" fill={C.ink} opacity="0.5" />
          <path d="M 40 320 Q 40 200, 100 175 Q 160 200, 160 320 Z" fill={C.ink} opacity="0.4" />
        </svg>

        <div style={{
          position: 'absolute',
          top: '38%', left: '50%', transform: 'translate(-50%, -50%)',
          fontFamily: 'Fraunces, serif',
          fontSize: 140, fontWeight: 800,
          color: C.white, opacity: 0.12,
          fontStyle: 'italic',
        }}>
          {initial}
        </div>

        {/* Audience badges (top) */}
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12,
          display: 'flex', gap: 5, flexWrap: 'wrap',
        }}>
          {ig > 0 && <SocialBadge icon={Instagram} value={fmtK(ig)} />}
          {tt > 0 && <SocialBadge icon={Music} value={fmtK(tt)} />}
          {yt > 0 && <SocialBadge icon={YoutubeIcon} value={fmtK(yt)} />}
        </div>

        {/* Bottom info */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          padding: '60px 14px 14px',
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.9))',
          color: C.white,
        }}>
          <div className="isg-serif" style={{
            fontSize: 18, fontWeight: 700,
            letterSpacing: '-0.02em', lineHeight: 1.05,
            marginBottom: 2,
          }}>
            {first}
          </div>
          {data.handle && (
            <div className="isg-mono" style={{
              fontSize: 10, opacity: 0.85, fontWeight: 600, marginBottom: 6,
            }}>
              {data.handle.startsWith('@') ? data.handle : `@${data.handle}`}
            </div>
          )}
          {data.bio && (
            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
              fontStyle: 'italic',
            }}>
              « {data.bio} »
            </div>
          )}
          {total > 0 && (
            <div style={{
              display: 'flex', gap: 8,
              fontSize: 9, color: 'rgba(255,255,255,0.75)',
              paddingTop: 6, marginTop: 6,
              borderTop: '1px solid rgba(255,255,255,0.15)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Heart size={9} /> {fmtK(total)} abos
              </span>
              {data.city && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                  <MapPin size={9} /> {data.city.split(',')[0]}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <p style={{
          fontSize: 11, color: C.inkSoft, margin: 0, fontStyle: 'italic',
        }}>
          Voilà comment les marques<br />te verront dans le feed
        </p>
      </div>
    </div>
  );
}

function SocialBadge({ icon: Icon, value }: {
  icon: React.ComponentType<{ size?: number }>;
  value: string;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 100,
      background: 'rgba(255,255,255,0.18)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.25)',
      color: C.white, fontSize: 9, fontWeight: 700,
    }}>
      <Icon size={9} />
      <span className="isg-mono">{value}</span>
    </div>
  );
}
