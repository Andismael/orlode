/**
 * Orlode Talents — candidate signup at /talents/inscription.
 *
 * Mirror of InfluencersSignupPage but for the talents marketplace:
 *  1. Auth (Google or email/password)
 *  2. Profile: name, city, country, sector, skills, tagline (140 max)
 *  3. Video: paste a YouTube/Vimeo/Drive link (1 min recommended).
 *     Native recording lives in the standalone talents-app — this is
 *     the lightweight signup path embedded inside orlode.com so a
 *     candidate can sign up without leaving the main site.
 *  4. Contact: WhatsApp (private), availability, language
 *
 * On submit writes talents_profiles/{auto-id} with status='pending_analysis'
 * (SuperAdmin reviews via /superadmin/talents and flips to 'active').
 */
import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/services/firebase';
import { ArrowLeft, Sparkles, Loader2, Check, Mail, PlayCircle, Upload, Link2, Film, X } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { useAuthStore } from '@/store/authStore';
import { M, MOBILE_CSS } from '@/components/mobile/mobileDesign';

const SECTORS = [
  'tech', 'commerce', 'btp', 'sante', 'education', 'finance',
  'logistique', 'agroalimentaire', 'restauration', 'hotellerie',
  'beaute', 'mode', 'media', 'transport', 'industrie',
  'agriculture', 'juridique', 'rh', 'marketing', 'creatif', 'autre',
] as const;

const AVAILABILITY: { value: string; label: string }[] = [
  { value: 'immediate', label: 'Immédiat' },
  { value: '1month',    label: '< 1 mois' },
  { value: '3months',   label: '< 3 mois' },
  { value: 'open',      label: 'Ouvert aux offres' },
];

const LANGUAGES = [
  'Français', 'Anglais', 'Espagnol', 'Portugais', 'Arabe',
  'Mandarin', 'Hindi', 'Allemand', 'Italien', 'Russe',
  'Swahili', 'Wolof', 'Dioula', 'Lingala', 'Bambara',
] as const;

export default function TalentsSignupPage() {
  useSEO({
    title: 'Inscription candidat — Orlode Talents',
    description: 'Rejoins la marketplace vidéo authentique. Une vidéo d\'1 minute, et les recruteurs te trouvent.',
    path: '/talents/inscription',
    noindex: true,
  });

  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [sector, setSector] = useState<string>('');
  const [skills, setSkills] = useState<string>('');
  const [tagline, setTagline] = useState('');
  const [videoMode, setVideoMode] = useState<'link' | 'upload'>('link');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [language, setLanguage] = useState<string>('Français');
  const [availability, setAvailability] = useState<string>('open');

  const [authMode, setAuthMode] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInGoogle = async () => {
    setAuthBusy(true); setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const r = await signInWithPopup(auth, provider);
      if (r.user.displayName && !displayName) setDisplayName(r.user.displayName);
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

  const skillsArr = skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const isUrl = /^https?:\/\/.+/i.test(videoUrl.trim());

  const probeDuration = (file: File): Promise<number> => new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : 0);
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    v.src = url;
  });

  const handleFile = async (file: File) => {
    if (!user) return;
    setUploadError(null);

    if (!file.type.startsWith('video/')) {
      setUploadError('Le fichier doit être une vidéo (MP4, MOV, WebM…).');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadError(`Vidéo trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Limite : 100 Mo.`);
      return;
    }

    setUploadBusy(true);
    setUploadProgress(0);
    try {
      const duration = await probeDuration(file);
      setVideoDurationSec(duration);

      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().slice(0, 5);
      const path = `talents/${user.uid}/${Date.now()}.${ext}`;
      const ref = storageRef(storage, path);
      const task = uploadBytesResumable(ref, file, { contentType: file.type });

      task.on('state_changed',
        snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { setUploadError(err.message); setUploadBusy(false); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setVideoUrl(url);
          setUploadBusy(false);
          setUploadProgress(100);
        },
      );
    } catch (err) {
      setUploadError((err as Error).message);
      setUploadBusy(false);
    }
  };

  const clearVideo = () => {
    setVideoUrl('');
    setVideoDurationSec(0);
    setUploadProgress(0);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSubmit = !!user
    && displayName.trim().length >= 2
    && city.trim().length >= 2
    && !!sector
    && skillsArr.length >= 1
    && tagline.trim().length >= 10
    && tagline.length <= 140
    && isUrl
    && whatsapp.replace(/\D/g, '').length >= 8;

  const submit = async () => {
    if (!user || submitting) return;
    setSubmitting(true); setError(null);
    try {
      const uid = user.uid;
      const profileRef = doc(collection(db, 'talents_profiles'));
      const phoneDigits = whatsapp.replace(/\D/g, '');

      await setDoc(profileRef, {
        userId:       uid,
        displayName:  displayName.trim(),
        city:         city.trim(),
        country:      country.trim() || null,
        sector:       sector,
        skills:       skillsArr,
        tagline:      tagline.trim(),
        videoUrl:     videoUrl.trim(),
        videoDuration: videoDurationSec || 0,
        thumbnailUrl: '',
        availability,
        language,
        status:       'pending_analysis',
        viewsCount:   0,
        contactsCount: 0,
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
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
    <div className="m-root" style={{ minHeight: '100vh', background: M.cream }}>
      <style>{MOBILE_CSS}</style>

      <header style={{
        background: `linear-gradient(135deg, ${M.greenDark}, ${M.greenDeep})`,
        color: M.cream, padding: '14px 18px',
        position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(20px)',
      }}>
        <div className="m-wrap-lg" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/talents" style={{
            color: M.cream, textDecoration: 'none',
            background: 'rgba(255,250,240,0.12)', border: `1px solid ${M.cream}25`,
            width: 32, height: 32, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeft size={14} />
          </Link>
          <div>
            <div className="m-display" style={{ fontSize: 15, fontWeight: 700 }}>Inscription candidat</div>
            <div style={{ fontSize: 10, opacity: 0.75 }}>5 min · Vérification sous 48h</div>
          </div>
        </div>
      </header>

      <main style={{ padding: '18px 18px 120px' }}>
        <div className="m-wrap" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {!user ? (
            <Section title="1. Connecte-toi" subtitle="Google ou email/mot de passe — ton compte sert à gérer ton profil plus tard.">
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button onClick={() => setAuthMode('google')} className="tap-card" style={chipStyle(authMode === 'google')}>Google</button>
                <button onClick={() => setAuthMode('email')} className="tap-card" style={chipStyle(authMode === 'email')}>Email</button>
              </div>
              {authMode === 'google' ? (
                <button onClick={signInGoogle} disabled={authBusy} className="tap-card" style={primaryBtn(authBusy)}>
                  {authBusy ? <Loader2 size={16} className="animate-spin" /> : 'Continuer avec Google'}
                </button>
              ) : (
                <>
                  <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="ton@email.com" />
                  <Input label="Mot de passe (≥6 caractères)" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                  <button onClick={signInEmail} disabled={authBusy || !email || password.length < 6} className="tap-card" style={primaryBtn(authBusy)}>
                    {authBusy ? <Loader2 size={16} className="animate-spin" /> : <><Mail size={14} /> Continuer</>}
                  </button>
                </>
              )}
            </Section>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: M.emeraldSoft, border: `1px solid ${M.emerald}40`,
              borderRadius: 12, padding: '10px 14px',
            }}>
              <Check size={16} color={M.emeraldDark} />
              <span style={{ fontSize: 13, color: M.emeraldDark, fontWeight: 600 }}>Connecté · {user.email}</span>
            </div>
          )}

          {user && (
            <>
              <Section title="2. Ton profil">
                <Input label="Nom complet *" value={displayName} onChange={setDisplayName} placeholder="Aïssatou Diallo" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Input label="Ville *" value={city} onChange={setCity} placeholder="Paris, Lagos, São Paulo…" />
                  <Input label="Pays" value={country} onChange={setCountry} placeholder="FR, NG, BR, CI…" />
                </div>
              </Section>

              <Section title="3. Métier + compétences">
                <label style={labelStyle}>Secteur *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {SECTORS.map(s => (
                    <button key={s} onClick={() => setSector(s)} className="tap-card" style={chipStyle(sector === s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <Input label="Compétences clés (3 max, séparées par des virgules) *"
                  value={skills} onChange={setSkills}
                  placeholder="React, Node.js, Figma" />
                <Textarea label={`Tagline (140 max, ${tagline.length} actuellement) *`}
                  value={tagline} onChange={setTagline}
                  placeholder="Ce que tu fais en 1 phrase. Ex : Développeuse fullstack avec 5 ans d'XP, focus produit." />
              </Section>

              <Section title="4. Ta vidéo (1 min)" subtitle="Téléverse ton MP4 / MOV / WebM directement, ou colle un lien YouTube / Vimeo / Drive.">
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button
                    onClick={() => { setVideoMode('upload'); if (videoUrl && isUrl) clearVideo(); }}
                    className="tap-card"
                    style={chipStyle(videoMode === 'upload')}
                  >
                    <Upload size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    Téléverser
                  </button>
                  <button
                    onClick={() => { setVideoMode('link'); if (videoUrl && !isUrl) clearVideo(); }}
                    className="tap-card"
                    style={chipStyle(videoMode === 'link')}
                  >
                    <Link2 size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    Lien externe
                  </button>
                </div>

                {videoMode === 'upload' ? (
                  <>
                    {!videoUrl && !uploadBusy && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="tap-card"
                        style={{
                          background: '#F9FAFB',
                          border: `2px dashed ${M.emerald}50`,
                          borderRadius: 14,
                          padding: '24px 16px',
                          textAlign: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Film size={28} color={M.emerald} style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: M.ink, marginBottom: 4 }}>
                          Choisir une vidéo
                        </div>
                        <div style={{ fontSize: 11, color: M.inkSoft }}>
                          MP4, MOV, WebM · max 100 Mo · idéalement 1 min
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/*"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                          }}
                        />
                      </div>
                    )}

                    {uploadBusy && (
                      <div style={{
                        background: '#F9FAFB',
                        border: '1px solid rgba(31,41,55,0.1)',
                        borderRadius: 12,
                        padding: 14,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <Loader2 size={16} className="animate-spin" color={M.emerald} />
                          <div style={{ fontSize: 13, fontWeight: 600, color: M.ink }}>
                            Téléversement… {uploadProgress}%
                          </div>
                        </div>
                        <div style={{
                          height: 6, background: '#E5E7EB',
                          borderRadius: 100, overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${uploadProgress}%`,
                            background: `linear-gradient(90deg, ${M.emerald}, ${M.greenDeep})`,
                            transition: 'width 0.2s ease',
                          }} />
                        </div>
                      </div>
                    )}

                    {videoUrl && !uploadBusy && (
                      <div style={{
                        background: M.emeraldSoft,
                        border: `1px solid ${M.emerald}40`,
                        borderRadius: 12,
                        padding: 12,
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <Check size={16} color={M.emeraldDark} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: M.emeraldDark }}>
                            Vidéo prête
                          </div>
                          <div style={{ fontSize: 11, color: M.inkSoft }}>
                            {videoDurationSec > 0 ? `Durée : ${videoDurationSec}s` : 'Hébergée sur Firebase Storage'}
                          </div>
                        </div>
                        <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          color: M.emeraldDark, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                        }}>
                          <PlayCircle size={14} /> Voir
                        </a>
                        <button onClick={clearVideo} className="tap-card" style={{
                          background: 'transparent', border: 'none',
                          color: M.inkSoft, cursor: 'pointer', padding: 4,
                        }}>
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {uploadError && (
                      <p style={{ fontSize: 11, color: '#991B1B', marginTop: 8 }}>
                        ⚠️ {uploadError}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Input label="Lien vidéo *" value={videoUrl} onChange={setVideoUrl}
                      placeholder="https://youtu.be/… ou https://drive.google.com/…" />
                    {videoUrl && !isUrl && (
                      <p style={{ fontSize: 11, color: '#991B1B', marginTop: -6 }}>
                        Le lien doit commencer par http(s)://
                      </p>
                    )}
                    {videoUrl && isUrl && (
                      <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="tap-card" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: M.emeraldSoft, color: M.emeraldDark,
                        padding: '8px 12px', borderRadius: 100,
                        fontSize: 12, fontWeight: 700,
                        textDecoration: 'none', marginTop: -4,
                      }}>
                        <PlayCircle size={14} /> Tester le lien
                      </a>
                    )}
                  </>
                )}
              </Section>

              <Section title="5. Contact + dispo">
                <Input label="WhatsApp *" type="tel" value={whatsapp} onChange={setWhatsapp}
                  placeholder="+33 6 12 34 56 78 — privé, jamais affiché publiquement" />
                <label style={labelStyle}>Langue principale *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {LANGUAGES.map(l => (
                    <button key={l} onClick={() => setLanguage(l)} className="tap-card" style={chipStyle(language === l)}>{l}</button>
                  ))}
                </div>
                <label style={labelStyle}>Disponibilité</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {AVAILABILITY.map(a => (
                    <button key={a.value} onClick={() => setAvailability(a.value)} className="tap-card" style={chipStyle(availability === a.value)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </Section>

              {error && (
                <div style={{
                  background: '#FEE2E2', border: '1px solid #FCA5A5',
                  borderRadius: 12, padding: 12, fontSize: 13, color: '#991B1B',
                }}>⚠️ {error}</div>
              )}

              <button onClick={submit} disabled={!canSubmit || submitting} className="tap-card" style={{
                ...primaryBtn(submitting),
                opacity: !canSubmit ? 0.5 : 1,
                cursor: !canSubmit ? 'not-allowed' : 'pointer',
              }}>
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" /> Création du profil…</>
                  : <><Sparkles size={16} /> Créer mon profil candidat</>}
              </button>
              <p style={{ fontSize: 11, color: M.inkLight, textAlign: 'center', marginTop: -8 }}>
                Profil revu par notre équipe sous 48h. Visible publiquement une fois validé.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── UI helpers (mirror of InfluencersSignupPage to keep look identical) ──
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: M.cream, border: '1px solid rgba(31,41,55,0.06)',
      borderRadius: 16, padding: 16,
      boxShadow: '0 6px 16px -8px rgba(0,0,0,0.08)',
    }}>
      <div className="m-display" style={{ fontSize: 15, fontWeight: 700, marginBottom: subtitle ? 2 : 12 }}>{title}</div>
      {subtitle && <p style={{ fontSize: 11, color: M.inkSoft, margin: '0 0 12px' }}>{subtitle}</p>}
      {children}
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: M.inkSoft, marginBottom: 5, letterSpacing: '0.02em',
};

function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
        width: '100%', background: '#F9FAFB',
        border: '1px solid rgba(31,41,55,0.1)', borderRadius: 10,
        padding: '10px 12px', fontSize: 14, color: M.ink,
        fontFamily: 'inherit', outline: 'none',
      }} />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={labelStyle}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{
        width: '100%', background: '#F9FAFB',
        border: '1px solid rgba(31,41,55,0.1)', borderRadius: 10,
        padding: '10px 12px', fontSize: 14, color: M.ink,
        fontFamily: 'inherit', outline: 'none', resize: 'vertical',
      }} />
    </div>
  );
}

function chipStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? `linear-gradient(135deg, ${M.emerald}, ${M.greenDeep})` : '#F1F3F6',
    color: selected ? M.cream : M.ink,
    border: selected ? 'none' : '1px solid rgba(31,41,55,0.08)',
    padding: '7px 12px', borderRadius: 100,
    fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}

function primaryBtn(busy: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: `linear-gradient(135deg, ${M.emerald}, ${M.greenDeep})`,
    color: M.cream, border: 'none',
    padding: '14px 18px', borderRadius: 14,
    fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    cursor: busy ? 'wait' : 'pointer',
    boxShadow: `0 12px 26px -8px ${M.emerald}`,
  };
}
