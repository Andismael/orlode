/**
 * Orlode Influenceurs — creator signup at /influenceurs/inscription.
 *
 * Single-page form (mobile-first) that:
 *  1. Authenticates via Firebase (Google one-tap or email/password)
 *  2. Collects creator profile (name, handle, city, bio, categories,
 *     audience sizes per network, languages, contact WhatsApp)
 *  3. Writes to influencers_profiles/{auto-id} with status='pending'
 *  4. Writes private WhatsApp number to private/contact subcollection
 *  5. Redirects to /influenceurs/feed
 *
 * The profile starts in `pending` — a SuperAdmin reviews and flips to
 * 'active' after verifying the social accounts (Instagram/TikTok/YouTube
 * handles are entered manually here; real OAuth verification is Phase 2).
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { ArrowLeft, Sparkles, Loader2, Check, Mail } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { useAuthStore } from '@/store/authStore';
import { M, MOBILE_CSS } from '@/components/mobile/mobileDesign';

const CATEGORIES = ['Mode', 'Tech', 'Food', 'Lifestyle', 'Fitness', 'Beauté'] as const;
const LANGUAGES = ['Français', 'Anglais', 'Dioula', 'Wolof', 'Bambara', 'Lingala', 'Swahili'] as const;
const RESPONSE_TIMES = ['< 2h', '< 6h', '< 24h', '2 jours'] as const;

export default function InfluencersSignupPage() {
  useSEO({
    title: 'Inscription créateur — Orlode Influenceurs',
    description: 'Rejoins la marketplace créateurs Orlode. Reçois les briefs des marques directement, sans agence.',
    path: '/influenceurs/inscription',
    noindex: true,
  });

  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Form state
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [handle, setHandle] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [youtube, setYoutube] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [languages, setLanguages] = useState<Set<string>>(new Set(['Français']));
  const [responseTime, setResponseTime] = useState<string>('< 24h');

  // Auth state
  const [authMode, setAuthMode] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = <T,>(set: Set<T>, value: T, fn: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    fn(next);
  };

  const signInGoogle = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const r = await signInWithPopup(auth, provider);
      if (r.user.displayName && !displayName) setDisplayName(r.user.displayName);
    } catch (err) {
      setError((err as Error).message);
    } finally { setAuthBusy(false); }
  };

  const signInEmail = async () => {
    setAuthBusy(true);
    setError(null);
    try {
      try { await signInWithEmailAndPassword(auth, email, password); }
      catch { await createUserWithEmailAndPassword(auth, email, password); }
    } catch (err) {
      setError((err as Error).message);
    } finally { setAuthBusy(false); }
  };

  const canSubmit = !!user
    && displayName.trim().length >= 2
    && handle.trim().length >= 2
    && city.trim().length >= 2
    && bio.trim().length >= 20
    && selectedCats.size > 0
    && (parseInt(instagram, 10) || parseInt(tiktok, 10) || parseInt(youtube, 10))
    && whatsapp.replace(/\D/g, '').length >= 8
    && languages.size > 0;

  const submit = async () => {
    if (!user || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const uid = user.uid;
      const audienceObj: Record<string, number> = {};
      const ig = parseInt(instagram, 10);
      const tt = parseInt(tiktok, 10);
      const yt = parseInt(youtube, 10);
      if (ig > 0) audienceObj.instagram = ig;
      if (tt > 0) audienceObj.tiktok = tt;
      if (yt > 0) audienceObj.youtube = yt;
      audienceObj.total = (audienceObj.instagram ?? 0) + (audienceObj.tiktok ?? 0) + (audienceObj.youtube ?? 0);

      const handleNormalized = handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`;
      const phoneDigits = whatsapp.replace(/\D/g, '');

      // Influencer profile (auto-id so a creator can have multiple personas later)
      const profileRef = doc(collection(db, 'influencers_profiles'));
      await setDoc(profileRef, {
        userId: uid,
        displayName: displayName.trim(),
        handle: handleNormalized,
        verified: false,
        bio: bio.trim(),
        city: city.trim(),
        categories: Array.from(selectedCats),
        audience: audienceObj,
        languages: Array.from(languages),
        responseTime,
        status: 'pending', // SuperAdmin reviews + flips to 'active'
        rating: 0,
        completedDeals: 0,
        engagement: 0,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      // Private subcollection — WhatsApp number is locked to the owner only
      await setDoc(doc(profileRef, 'private', 'contact'), {
        whatsappNumber: phoneDigits,
        ownerEmail: user.email ?? null,
        savedAt: serverTimestamp(),
      });

      navigate('/influenceurs/feed?welcome=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="m-root" style={{ minHeight: '100vh', background: M.cream }}>
      <style>{MOBILE_CSS}</style>

      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, #2E1065, ${M.violetDeep})`,
        color: M.cream, padding: '14px 18px',
        position: 'sticky', top: 0, zIndex: 30,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/influenceurs" style={{
            color: M.cream, textDecoration: 'none',
            background: 'rgba(255,250,240,0.12)', border: `1px solid ${M.cream}25`,
            width: 32, height: 32, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ArrowLeft size={14} />
          </Link>
          <div>
            <div className="m-display" style={{ fontSize: 15, fontWeight: 700 }}>Inscription créateur</div>
            <div style={{ fontSize: 10, opacity: 0.75 }}>5 min · Vérification sous 48h</div>
          </div>
        </div>
      </header>

      <main style={{ padding: '18px 18px 120px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Auth section — collapsed once logged in */}
          {!user ? (
            <Section title="1. Connecte-toi" subtitle="Avec ton compte Google ou un email">
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button onClick={() => setAuthMode('google')} className="tap-card" style={chipStyle(authMode === 'google')}>
                  Google
                </button>
                <button onClick={() => setAuthMode('email')} className="tap-card" style={chipStyle(authMode === 'email')}>
                  Email
                </button>
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
              <span style={{ fontSize: 13, color: M.emeraldDark, fontWeight: 600 }}>
                Connecté · {user.email}
              </span>
            </div>
          )}

          {/* Profile form — visible once authed */}
          {user && (
            <>
              <Section title="2. Ton profil créateur">
                <Input label="Nom affiché *" value={displayName} onChange={setDisplayName} placeholder="Aïssatou Diallo" />
                <Input label="Handle principal *" value={handle} onChange={setHandle} placeholder="@aissatou.styles" />
                <Input label="Ville *" value={city} onChange={setCity} placeholder="Abidjan, Cocody" />
                <Textarea label="Bio (≥20 caractères) *" value={bio} onChange={setBio}
                  placeholder="Créatrice de contenu mode africaine. Collabs : Zaffran, NSIA, Orange CI." />
              </Section>

              <Section title="3. Catégories" subtitle="1 minimum, max 3">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CATEGORIES.map(c => {
                    const on = selectedCats.has(c);
                    return (
                      <button key={c} onClick={() => toggle(selectedCats, c, setSelectedCats)} className="tap-card" style={chipStyle(on)}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title="4. Audience" subtitle="Au moins UN réseau requis">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <Input label="Instagram" type="number" value={instagram} onChange={setInstagram} placeholder="98000" />
                  <Input label="TikTok" type="number" value={tiktok} onChange={setTiktok} placeholder="38000" />
                  <Input label="YouTube" type="number" value={youtube} onChange={setYoutube} placeholder="9000" />
                </div>
                <p style={{ fontSize: 10, color: M.inkLight, marginTop: 6 }}>
                  Mets le nombre d'abonnés actuels. Ces chiffres seront vérifiés par notre équipe sous 48h.
                </p>
              </Section>

              <Section title="5. Contact + langues">
                <Input label="WhatsApp *" type="tel" value={whatsapp} onChange={setWhatsapp} placeholder="+225 07 12 34 56 78" />
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Langues parlées *</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {LANGUAGES.map(l => {
                      const on = languages.has(l);
                      return (
                        <button key={l} onClick={() => toggle(languages, l, setLanguages)} className="tap-card" style={chipStyle(on)}>
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Temps de réponse moyen</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {RESPONSE_TIMES.map(r => (
                      <button key={r} onClick={() => setResponseTime(r)} className="tap-card" style={chipStyle(responseTime === r)}>
                        {r}
                      </button>
                    ))}
                  </div>
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
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Création du profil…</>
                ) : (
                  <><Sparkles size={16} /> Créer mon profil créateur</>
                )}
              </button>
              <p style={{ fontSize: 11, color: M.inkLight, textAlign: 'center', marginTop: -8 }}>
                En soumettant, tu acceptes que ton profil soit visible publiquement après vérification (48h).
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Inline UI helpers ──────────────────────────────────────────────────
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
    background: selected ? `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})` : '#F1F3F6',
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
    background: `linear-gradient(135deg, ${M.violet}, ${M.violetDeep})`,
    color: M.cream, border: 'none',
    padding: '14px 18px', borderRadius: 14,
    fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    cursor: busy ? 'wait' : 'pointer',
    boxShadow: `0 12px 26px -8px ${M.violet}`,
  };
}
