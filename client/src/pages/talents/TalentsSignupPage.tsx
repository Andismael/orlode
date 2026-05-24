/**
 * Orlode Talents — premium editorial candidate signup.
 * Faithfully replicates user-provided maquette 2026-05-24 (editorial green).
 *
 * Layout: dark hero with live progress bar + 5-step form (left) with sticky
 * live preview card (right, desktop only). Real Firebase auth, real Firestore
 * write to talents_profiles, shared <VideoUpload> for Step 4 (6 platforms +
 * direct upload). On submit → redirect to /talents/feed?welcome=1.
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
  MapPin, Briefcase, Code, Palette, Megaphone, Coffee, Hammer,
  GraduationCap, Video, MessageCircle, Plus, Mail, Loader2,
  Eye, Heart, Play, User, Flame,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { useAuthStore } from '@/store/authStore';
import VideoUpload, { type VideoUploadValue } from '@/components/common/VideoUpload';

const C = {
  brand: '#0F5C3F', brandDeep: '#0A4530', brandDarker: '#031A11',
  brandSoft: '#E8F5EE', brandLight: '#7FCAA6', brandMid: '#1B7A56',
  gold: '#D4A574', goldDeep: '#B8895C', goldLight: '#E8C9A0',
  cream: '#FAF7F2', creamDeep: '#F0EBE3',
  ink: '#0A1410', ink2: '#1A2A22', ink3: '#384C42',
  inkSoft: '#5C6B62', inkLight: '#94A39A', inkSilent: '#C5CDC8',
  success: '#10B981', successSoft: '#D1FAE5',
  whatsapp: '#25D366', white: '#FFFFFF',
};

interface Category {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  sector: string;
}

const CATEGORIES: Category[] = [
  { id: 'tech',        label: 'Tech',        icon: Code,          sector: 'tech' },
  { id: 'design',      label: 'Design',      icon: Palette,       sector: 'creatif' },
  { id: 'marketing',   label: 'Marketing',   icon: Megaphone,     sector: 'marketing' },
  { id: 'hospitality', label: 'Hospitalité', icon: Coffee,        sector: 'restauration' },
  { id: 'finance',     label: 'Finance',     icon: Briefcase,     sector: 'finance' },
  { id: 'creative',    label: 'Créatif',     icon: Video,         sector: 'creatif' },
  { id: 'manual',      label: 'Manuel',      icon: Hammer,        sector: 'artisanat' },
  { id: 'education',   label: 'Éducation',   icon: GraduationCap, sector: 'education' },
];

const LANGUAGES = [
  'Français', 'Anglais', 'Espagnol', 'Portugais', 'Arabe',
  'Wolof', 'Dioula', 'Lingala', 'Bambara', 'Swahili',
  'Baoulé', 'Ewondo', 'Yoruba',
];

const AVAILABILITY: { id: 'immediate' | '1month' | '3months' | 'open'; label: string; desc: string }[] = [
  { id: 'immediate', label: 'Immédiat',    desc: 'Je peux commencer demain' },
  { id: '1month',    label: 'Sous 1 mois', desc: 'Le temps de finaliser' },
  { id: '3months',   label: 'Sous 3 mois', desc: 'En préavis ou études' },
  { id: 'open',      label: 'Ouvert',      desc: 'À discuter' },
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .tsg { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; }
  .tsg-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .tsg-mono { font-family: 'JetBrains Mono', monospace; }
  .tsg-input {
    width: 100%; background: ${C.white}; color: ${C.ink};
    border: 1.5px solid ${C.creamDeep};
    border-radius: 14px; padding: 14px 18px;
    font-size: 15px; font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .tsg-input:focus { border-color: ${C.brand}; box-shadow: 0 0 0 4px ${C.brandSoft}; }
  .tsg-input::placeholder { color: ${C.inkLight}; }
  .tsg-btn-primary {
    background: linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep});
    color: ${C.white}; border: none;
    padding: 16px 28px; border-radius: 100px;
    font-size: 15px; font-weight: 600; font-family: inherit;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 10px;
    transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 10px 30px -8px ${C.brand}80;
  }
  .tsg-btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
  .tsg-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
  .tsg-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 13px; border-radius: 100px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  @keyframes tsg-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  .tsg-shimmer {
    background: linear-gradient(90deg, ${C.brandLight} 0%, ${C.goldLight} 50%, ${C.brandLight} 100%);
    background-size: 200% auto;
    background-clip: text; -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: tsg-shimmer 5s linear infinite;
  }
  @keyframes tsg-fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .tsg-fade { animation: tsg-fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) backwards; }
  .tsg-d1{animation-delay:0.1s} .tsg-d2{animation-delay:0.2s} .tsg-d3{animation-delay:0.3s}
  @keyframes tsg-fadeIn { from{opacity:0} to{opacity:1} }
  .tsg-fade-in { animation: tsg-fadeIn 0.4s ease; }
  @keyframes tsg-slowRotate { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .tsg-rot { animation: tsg-slowRotate 60s linear infinite; }
  @keyframes tsg-pulse {
    0%,100%{box-shadow: 0 0 0 0 ${C.brand}40}
    50%{box-shadow: 0 0 0 12px ${C.brand}00}
  }
  .tsg-pulse { animation: tsg-pulse 2.5s ease-in-out infinite; }
  @keyframes tsg-rec { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .tsg-rec { animation: tsg-rec 1.4s ease-in-out infinite; }
  @media (max-width: 1024px) {
    .tsg-hide-mobile { display: none !important; }
    .tsg-grid-1 { grid-template-columns: 1fr !important; }
  }
`;

interface FormData {
  firstName: string;
  lastName: string;
  age: string;
  location: string;
  category: string; // CATEGORIES.id
  role: string;
  pitch: string;
  skills: string[];
  whatsapp: string;
  languages: string[];
  availability: typeof AVAILABILITY[number]['id'] | '';
}

const initialData: FormData = {
  firstName: '', lastName: '', age: '', location: '',
  category: '', role: '', pitch: '',
  skills: [], whatsapp: '',
  languages: ['Français'],
  availability: '',
};

export default function TalentsSignupPage() {
  useSEO({
    title: 'Inscription candidat — Orlode Talents',
    description: "Rejoins la marketplace vidéo authentique. 1 minute de vidéo, et les recruteurs te trouvent.",
    path: '/talents/inscription',
    noindex: true,
  });

  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [data, setData] = useState<FormData>(initialData);
  const [video, setVideo] = useState<VideoUploadValue>({ url: '', durationSec: 0 });

  // Auth panel
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
      const dn = r.user.displayName ?? '';
      if (dn && !data.firstName) {
        const [first, ...rest] = dn.split(' ');
        setData(d => ({ ...d, firstName: first ?? '', lastName: rest.join(' ') }));
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

  const isVideoValid = /^https?:\/\/.+/i.test(video.url.trim());

  // Progress bar — only credits filled-out groups
  const progressFields = [
    !!data.firstName && !!data.lastName,
    !!data.age && !!data.location,
    !!data.category && !!data.role,
    data.pitch.length >= 10,
    data.skills.length >= 3,
    isVideoValid,
    !!data.whatsapp,
    data.languages.length > 0,
    !!data.availability,
  ];
  const progress = Math.round((progressFields.filter(Boolean).length / progressFields.length) * 100);

  const isValid = !!user
    && data.firstName.trim().length >= 2
    && data.lastName.trim().length >= 1
    && !!data.category
    && data.role.trim().length >= 2
    && data.pitch.trim().length >= 10
    && data.pitch.length <= 200
    && data.skills.length >= 3
    && data.location.trim().length >= 2
    && isVideoValid
    && data.whatsapp.replace(/\D/g, '').length >= 8
    && data.languages.length >= 1
    && !!data.availability;

  const submit = async () => {
    if (!user || !isValid || submitting) return;
    setSubmitting(true); setError(null);
    try {
      const cat = CATEGORIES.find(c => c.id === data.category);
      const [city, ...countryParts] = data.location.split(',').map(s => s.trim());
      const country = countryParts.join(', ') || null;

      const profileRef = doc(collection(db, 'talents_profiles'));
      const phoneDigits = data.whatsapp.replace(/\D/g, '');

      await setDoc(profileRef, {
        userId: user.uid,
        displayName: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        age: data.age ? Number(data.age) : null,
        city: city || data.location.trim(),
        country,
        sector: cat?.sector ?? 'autre',
        category: data.category,
        role: data.role.trim(),
        skills: data.skills,
        tagline: data.pitch.trim(),
        videoUrl: video.url.trim(),
        videoDuration: video.durationSec || 0,
        thumbnailUrl: '',
        availability: data.availability,
        language: data.languages[0] ?? 'Français',
        languages: data.languages,
        status: 'pending_analysis',
        viewsCount: 0,
        contactsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(profileRef, 'private', 'contact'), {
        whatsappNumber: phoneDigits,
        ownerEmail: user.email ?? null,
        savedAt: serverTimestamp(),
      });

      navigate('/talents/feed?welcome=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tsg">
      <style>{STYLES}</style>

      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10, 20, 16, 0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 32px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link to="/talents" style={{
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
              background: `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
              color: C.white, fontWeight: 800, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
              boxShadow: `0 6px 16px -4px ${C.brand}80`,
            }}>O</div>
            <div>
              <div className="tsg-serif" style={{
                fontSize: 15, fontWeight: 700, color: C.cream, lineHeight: 1,
              }}>
                Orlode <em style={{ fontStyle: 'italic', color: C.goldLight }}>Talents</em>
              </div>
              <div className="tsg-mono" style={{
                fontSize: 9, fontWeight: 600, color: C.inkSilent,
                letterSpacing: '0.1em', marginTop: 2,
              }}>
                INSCRIPTION CANDIDAT
              </div>
            </div>
          </div>

          <div className="tsg-hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <div className="tsg-rot" style={{
            position: 'absolute', top: '-25%', right: '-12%',
            width: 600, height: 600, borderRadius: '50%',
            border: `1px dashed ${C.goldLight}25`, pointerEvents: 'none',
          }} />
          <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 2 }}>
            <div className="tsg-pill tsg-fade" style={{
              background: 'rgba(212, 165, 116, 0.12)',
              color: C.goldLight,
              border: `1px solid ${C.gold}40`,
              backdropFilter: 'blur(20px)',
              marginBottom: 20,
            }}>
              <Sparkles size={11} /> Inscription candidat · Bêta
            </div>
            <h1 className="tsg-serif tsg-fade tsg-d1" style={{
              fontSize: 'clamp(36px, 6vw, 64px)',
              fontWeight: 800, color: C.cream,
              margin: '0 0 16px',
              letterSpacing: '-0.035em', lineHeight: 1,
            }}>
              Crée ton profil.<br />
              <em className="tsg-shimmer" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                En 5 minutes.
              </em>
            </h1>
            <p className="tsg-fade tsg-d2" style={{
              fontSize: 17, color: C.inkSilent,
              maxWidth: 620, margin: '0 0 28px', lineHeight: 1.55,
            }}>
              5 étapes simples. Pas de CV, pas de questions inutiles. <strong style={{ color: C.cream }}>Juste l'essentiel</strong> pour que les entreprises te trouvent.
            </p>

            <div className="tsg-fade tsg-d3" style={{
              maxWidth: 480, display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ flex: 1 }}>
                <div className="tsg-mono" style={{
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
              <div className="tsg-serif" style={{
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
            }} className="tsg-grid-1">
              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Auth (only shown when signed-out) */}
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
                        <button onClick={signInGoogle} disabled={authBusy} type="button" className="tsg-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                          {authBusy ? <Loader2 size={16} className="animate-spin" /> : <>Continuer avec Google <Sparkles size={14} /></>}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <input type="email" className="tsg-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" />
                          <input type="password" className="tsg-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                          <button onClick={signInEmail} disabled={authBusy || !email || password.length < 6} type="button" className="tsg-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
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
                    <Check size={16} color={C.brandDeep} />
                    <span style={{ fontSize: 13, color: C.brandDeep, fontWeight: 600 }}>
                      Connecté · {user.email}
                    </span>
                  </div>
                )}

                {user && (
                  <>
                    {/* Step 1 — Identity */}
                    <StepCard>
                      <StepHeader number="1" title="Qui es-tu ?" subtitle="Les infos de base pour que les entreprises te reconnaissent" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginLeft: 44 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="tsg-grid-1">
                          <Field label="Prénom *">
                            <input value={data.firstName} onChange={e => setData(d => ({ ...d, firstName: e.target.value }))} placeholder="Marc" className="tsg-input" />
                          </Field>
                          <Field label="Nom *">
                            <input value={data.lastName} onChange={e => setData(d => ({ ...d, lastName: e.target.value }))} placeholder="Kouassi" className="tsg-input" />
                          </Field>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }} className="tsg-grid-1">
                          <Field label="Âge *">
                            <input type="number" value={data.age} onChange={e => setData(d => ({ ...d, age: e.target.value }))} placeholder="24" className="tsg-input tsg-mono" style={{ fontWeight: 700 }} />
                          </Field>
                          <Field label="Ville · Pays *">
                            <div style={{ position: 'relative' }}>
                              <MapPin size={15} style={{
                                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                                color: C.brand,
                              }} />
                              <input value={data.location} onChange={e => setData(d => ({ ...d, location: e.target.value }))} placeholder="Abidjan, Côte d'Ivoire" className="tsg-input" style={{ paddingLeft: 42 }} />
                            </div>
                          </Field>
                        </div>
                      </div>
                    </StepCard>

                    {/* Step 2 — Role */}
                    <StepCard>
                      <StepHeader number="2" title="Ton métier" subtitle="Choisis ta catégorie et décris ce que tu fais en 1 phrase" />
                      <div style={{ marginLeft: 44, display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <Field label="Catégorie *">
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                          }} className="tsg-grid-1">
                            {CATEGORIES.map(cat => {
                              const active = data.category === cat.id;
                              const Icon = cat.icon;
                              return (
                                <button
                                  key={cat.id}
                                  onClick={() => setData(d => ({ ...d, category: cat.id }))}
                                  type="button"
                                  style={{
                                    background: active ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})` : C.cream,
                                    color: active ? C.white : C.ink2,
                                    border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
                                    borderRadius: 14, padding: '14px 8px',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                    transition: 'all 0.2s ease',
                                    boxShadow: active ? `0 8px 20px -8px ${C.brand}80` : 'none',
                                  }}
                                >
                                  <Icon size={18} strokeWidth={2} />
                                  <span style={{ fontSize: 11, fontWeight: 700 }}>{cat.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </Field>

                        <Field label="Intitulé de ton métier *">
                          <input value={data.role} onChange={e => setData(d => ({ ...d, role: e.target.value }))} placeholder="Ex: Développeur Fullstack React" className="tsg-input" />
                        </Field>

                        <Field label="Ton pitch en 1 phrase *">
                          <textarea
                            value={data.pitch}
                            onChange={e => setData(d => ({ ...d, pitch: e.target.value }))}
                            placeholder="Ex: J'ai développé 12 apps mobiles pour des startups ivoiriennes."
                            className="tsg-input"
                            rows={3}
                            maxLength={200}
                            style={{ resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: C.inkLight }}>
                              💡 Pas de blabla, va droit au but
                            </span>
                            <span className="tsg-mono" style={{ fontSize: 11, color: C.inkLight }}>
                              {data.pitch.length}/200
                            </span>
                          </div>
                        </Field>
                      </div>
                    </StepCard>

                    {/* Step 3 — Skills */}
                    <StepCard>
                      <StepHeader number="3" title="Tes compétences" subtitle="Ajoute 3 à 6 compétences clés (technos, outils, expertises)" />
                      <SkillsEditor skills={data.skills} setSkills={skills => setData(d => ({ ...d, skills }))} />
                    </StepCard>

                    {/* Step 4 — Video (uses shared VideoUpload) */}
                    <StepCard>
                      <StepHeader number="4" title="Ta vidéo de 1 minute" subtitle="Le cœur de ton profil — montre qui tu es, ce que tu sais faire" />
                      <div style={{ marginLeft: 44 }}>
                        <div style={{
                          background: `linear-gradient(135deg, ${C.brand}08, ${C.gold}10)`,
                          border: `1px solid ${C.brand}20`,
                          borderRadius: 16, padding: 16, marginBottom: 20,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: 10,
                              background: `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
                              color: C.white,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <Sparkles size={15} />
                            </div>
                            <div>
                              <div className="tsg-serif" style={{
                                fontSize: 14, fontWeight: 700, color: C.ink,
                                marginBottom: 6,
                              }}>
                                <em style={{ fontStyle: 'italic' }}>3 conseils</em> pour une bonne vidéo
                              </div>
                              <ul style={{
                                margin: 0, padding: 0, listStyle: 'none',
                                fontSize: 12, color: C.ink2, lineHeight: 1.7,
                              }}>
                                <li>📱 <strong>Format vertical</strong> (9:16) comme TikTok</li>
                                <li>🎯 <strong>Sois direct</strong> : qui tu es, ce que tu fais, ce que tu cherches</li>
                                <li>✨ <strong>Sois toi</strong> : pas besoin de prod, juste sois authentique</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        <VideoUpload
                          userUid={user.uid}
                          storagePrefix="talents"
                          value={video}
                          onChange={setVideo}
                        />
                      </div>
                    </StepCard>

                    {/* Step 5 — Contact */}
                    <StepCard>
                      <StepHeader number="5" title="Contact & dispo" subtitle="Comment les entreprises te contactent et quand tu es libre" />
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
                                  onClick={() => {
                                    if (active) {
                                      setData(d => ({ ...d, languages: d.languages.filter(l => l !== lang) }));
                                    } else if (!disabled) {
                                      setData(d => ({ ...d, languages: [...d.languages, lang] }));
                                    }
                                  }}
                                  type="button"
                                  disabled={disabled}
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

                        <Field label="Disponibilité *">
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                          }} className="tsg-grid-1">
                            {AVAILABILITY.map(a => {
                              const active = data.availability === a.id;
                              return (
                                <button
                                  key={a.id}
                                  onClick={() => setData(d => ({ ...d, availability: a.id }))}
                                  type="button"
                                  style={{
                                    background: active ? `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})` : C.cream,
                                    color: active ? C.white : C.ink2,
                                    border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
                                    borderRadius: 14, padding: '14px 12px',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    boxShadow: active ? `0 8px 20px -8px ${C.brand}80` : 'none',
                                  }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{a.label}</div>
                                  <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.3 }}>{a.desc}</div>
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

                    {/* Submit card */}
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
                        <h3 className="tsg-serif" style={{
                          fontSize: 26, fontWeight: 700, color: C.cream,
                          margin: '0 0 8px', letterSpacing: '-0.025em',
                        }}>
                          <em style={{ fontStyle: 'italic' }}>Prêt à briller ?</em>
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
                          className="tsg-btn-primary"
                          style={{
                            padding: '18px 36px',
                            fontSize: 15,
                            background: isValid
                              ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`
                              : `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
                            boxShadow: isValid ? `0 14px 36px -8px ${C.gold}80` : 'none',
                          }}
                        >
                          {submitting
                            ? <><Loader2 size={16} className="animate-spin" /> Création du profil…</>
                            : <><Sparkles size={16} /> Créer mon profil candidat</>}
                        </button>
                        <p style={{
                          fontSize: 11, color: C.inkLight,
                          margin: '14px 0 0', fontStyle: 'italic',
                        }}>
                          Vérification de ton profil sous 48h · Tu seras notifié par WhatsApp
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Live preview (sticky on desktop) */}
              <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="tsg-hide-mobile">
                <PreviewCard data={data} />
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
    <div className="tsg-fade-in" style={{
      background: C.white,
      border: `1px solid ${C.creamDeep}`,
      borderRadius: 24,
      padding: 32,
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
        <h3 className="tsg-serif" style={{
          fontSize: 22, fontWeight: 700, color: C.ink,
          margin: 0, letterSpacing: '-0.025em',
        }}>
          {title}
        </h3>
      </div>
      {subtitle && (
        <p style={{
          fontSize: 13, color: C.inkSoft,
          margin: '0 0 0 44px', lineHeight: 1.5,
        }}>
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

function SkillsEditor({ skills, setSkills }: { skills: string[]; setSkills: (s: string[]) => void }) {
  const [newSkill, setNewSkill] = useState('');
  const add = () => {
    const v = newSkill.trim();
    if (v && skills.length < 6 && !skills.includes(v)) {
      setSkills([...skills, v]);
      setNewSkill('');
    }
  };
  return (
    <div style={{ marginLeft: 44 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={newSkill}
          onChange={e => setNewSkill(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Ex: React, Figma, WhatsApp Business..."
          className="tsg-input"
          disabled={skills.length >= 6}
          style={{ flex: 1 }}
        />
        <button
          onClick={add}
          type="button"
          disabled={!newSkill.trim() || skills.length >= 6}
          className="tsg-btn-primary"
          style={{ padding: '14px 20px', fontSize: 13 }}
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {skills.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {skills.map(s => (
            <span key={s} style={{
              background: C.brandSoft,
              border: `1.5px solid ${C.brand}30`,
              color: C.brandDeep,
              padding: '8px 14px', borderRadius: 100,
              fontSize: 13, fontWeight: 600,
              fontFamily: 'Fraunces, serif',
              letterSpacing: '-0.01em',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {s}
              <button
                onClick={() => setSkills(skills.filter(sk => sk !== s))}
                type="button"
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: 0,
                  color: C.brandDeep, display: 'flex',
                }}
                aria-label={`Retirer ${s}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div style={{
          padding: 20, textAlign: 'center',
          background: C.cream,
          border: `1.5px dashed ${C.creamDeep}`,
          borderRadius: 12,
        }}>
          <Sparkles size={20} color={C.inkLight} style={{ marginBottom: 6 }} />
          <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>
            Aucune compétence ajoutée · Commence par taper la première
          </p>
        </div>
      )}

      <p style={{ fontSize: 11, color: C.inkLight, marginTop: 8 }}>
        {skills.length}/6 compétences · {Math.max(0, 6 - skills.length)} restante{6 - skills.length > 1 ? 's' : ''}
      </p>
    </div>
  );
}

function PreviewCard({ data }: { data: FormData }) {
  const cat = CATEGORIES.find(c => c.id === data.category);
  const Icon = cat?.icon ?? User;
  const accentGradient = `linear-gradient(155deg, ${C.brand} 0%, ${C.brandDeep} 70%, ${C.gold} 100%)`;

  return (
    <div style={{ position: 'sticky', top: 90 }}>
      <div className="tsg-mono" style={{
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
            <radialGradient id="tsg-prev" cx="50%" cy="35%">
              <stop offset="0%" stopColor="white" stopOpacity="0.35" />
              <stop offset="60%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="320" fill="url(#tsg-prev)" />
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
          {data.firstName.charAt(0).toUpperCase() || '?'}
        </div>

        <div style={{
          position: 'absolute', top: 12, left: 12,
          padding: '4px 9px', borderRadius: 100,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: C.white,
          fontSize: 9, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <span className="tsg-rec" style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#FF3B30', display: 'inline-block',
          }} />
          <span className="tsg-mono">1:00</span>
        </div>

        {cat && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            padding: '4px 9px', borderRadius: 100,
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: C.white, fontSize: 9, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Icon size={9} />
            {cat.label}
          </div>
        )}

        <div style={{
          position: 'absolute', top: '45%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <div className="tsg-pulse" style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          }}>
            <Play size={20} color={C.brandDeep} fill={C.brandDeep} strokeWidth={0} style={{ marginLeft: 2 }} />
          </div>
        </div>

        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          padding: '60px 14px 14px',
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.9))',
          color: C.white,
        }}>
          <div className="tsg-serif" style={{
            fontSize: 18, fontWeight: 700,
            letterSpacing: '-0.02em', lineHeight: 1.05,
            marginBottom: 2,
          }}>
            {data.firstName || 'Ton'}{data.age && <em style={{ fontStyle: 'italic', fontWeight: 500 }}>, {data.age} ans</em>}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginBottom: 8 }}>
            {data.role || 'Ton métier'}
          </div>
          <div style={{
            display: 'flex', gap: 8,
            fontSize: 9, color: 'rgba(255,255,255,0.75)',
            paddingTop: 6,
            borderTop: '1px solid rgba(255,255,255,0.15)',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Eye size={9} /> 0
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Heart size={9} /> 0
            </span>
            {data.location && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                <MapPin size={9} /> {data.location.split(',')[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <p style={{
          fontSize: 11, color: C.inkSoft, margin: 0, fontStyle: 'italic',
        }}>
          Voilà comment les entreprises<br />te verront dans le feed
        </p>
      </div>
    </div>
  );
}
