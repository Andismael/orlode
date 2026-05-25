/**
 * Orlode Influenceurs — creator edit-profile at /influenceurs/mon-profil.
 * Mirrors TalentsMyProfilePage in purple-editorial. Loads influencers_profiles
 * by userId, lets the creator update name/handle/bio/categories/audience/
 * languages/photo. Social-links management stays on /influenceurs/mes-liens.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, doc, getDocs, query, updateDoc, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  ArrowLeft, Save, Loader2, MapPin, Sparkles, Shield, Check, X,
  MessageCircle, Eye, ExternalLink, Clock, AtSign,
  Instagram, Music, Youtube as YoutubeIcon, BadgeCheck, Link2,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { useAuthStore } from '@/store/authStore';
import ImageUpload from '@/components/common/ImageUpload';

const C = {
  brand: '#6366F1', brandDeep: '#4F46E5', brandDarker: '#1E1B4B',
  brandSoft: '#EEF2FF', brandLight: '#A5B4FC', brandMid: '#818CF8',
  gold: '#D4A574', goldDeep: '#B8895C', goldLight: '#E8C9A0',
  cream: '#FAF7F2', creamDeep: '#F0EBE3',
  ink: '#0A0814', ink2: '#1F1B2E',
  inkSoft: '#6B6480', inkLight: '#9A93AD',
  success: '#10B981', successSoft: '#D1FAE5',
  whatsapp: '#25D366', white: '#FFFFFF',
};

const CATEGORIES = ['Mode', 'Tech', 'Food', 'Lifestyle', 'Fitness', 'Beauté', 'Business', 'Voyage'];
const LANGUAGES = ['Français', 'Anglais', 'Espagnol', 'Portugais', 'Arabe', 'Mandarin', 'Hindi', 'Allemand', 'Italien', 'Russe', 'Swahili', 'Wolof', 'Dioula', 'Lingala', 'Bambara'];
const RESPONSE_TIMES: { id: string; label: string; desc: string }[] = [
  { id: '< 2h',     label: 'Très rapide',  desc: 'Sous 2 heures' },
  { id: '< 6h',     label: 'Rapide',       desc: 'Sous 6 heures' },
  { id: '< 24h',    label: 'Standard',     desc: 'Sous 24h' },
  { id: '2 jours',  label: 'Posé',         desc: 'Sous 48h' },
];

interface FormData {
  displayName: string; handle: string; city: string; bio: string;
  categories: string[];
  instagram: string; tiktok: string; youtube: string;
  whatsapp: string; languages: string[]; responseTime: string;
  photoURL: string;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .imp { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; }
  .imp-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .imp-mono { font-family: 'JetBrains Mono', monospace; }
  .imp-input {
    width: 100%; background: ${C.white}; color: ${C.ink};
    border: 1.5px solid ${C.creamDeep};
    border-radius: 14px; padding: 14px 18px;
    font-size: 15px; font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .imp-input:focus { border-color: ${C.brand}; box-shadow: 0 0 0 4px ${C.brandSoft}; }
  @media (max-width: 768px) {
    .imp-grid-1 { grid-template-columns: 1fr !important; }
  }
`;

export default function InfluencersMyProfilePage() {
  useSEO({ title: 'Mon profil — Orlode Influenceurs', path: '/influenceurs/mon-profil', noindex: true });
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [data, setData] = useState<FormData>({
    displayName: '', handle: '', city: '', bio: '',
    categories: [],
    instagram: '', tiktok: '', youtube: '',
    whatsapp: '', languages: ['Français'], responseTime: '< 24h',
    photoURL: '',
  });
  const [status, setStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    void (async () => {
      try {
        const q = query(collection(db, 'influencers_profiles'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        if (snap.empty) { setLoading(false); return; }
        const d = snap.docs[0]!;
        setProfileId(d.id);
        const raw = d.data() as Record<string, unknown>;
        setStatus((raw['status'] as string) ?? 'pending');
        const aud = (raw['audience'] as Record<string, number>) ?? {};
        setData({
          displayName: (raw['displayName'] as string) ?? '',
          handle: (raw['handle'] as string) ?? '',
          city: (raw['city'] as string) ?? '',
          bio: (raw['bio'] as string) ?? '',
          categories: (raw['categories'] as string[]) ?? [],
          instagram: aud['instagram'] ? String(aud['instagram']) : '',
          tiktok: aud['tiktok'] ? String(aud['tiktok']) : '',
          youtube: aud['youtube'] ? String(aud['youtube']) : '',
          whatsapp: '',
          languages: (raw['languages'] as string[]) ?? ['Français'],
          responseTime: (raw['responseTime'] as string) ?? '< 24h',
          photoURL: (raw['photoURL'] as string) ?? '',
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const ig = parseInt(data.instagram, 10) || 0;
  const tt = parseInt(data.tiktok, 10) || 0;
  const yt = parseInt(data.youtube, 10) || 0;
  const totalAudience = ig + tt + yt;
  const hasAtLeastOneNetwork = ig > 0 || tt > 0 || yt > 0;
  const isValid =
    data.displayName.trim().length >= 2 &&
    data.handle.trim().length >= 2 &&
    data.city.trim().length >= 2 &&
    data.bio.trim().length >= 20 &&
    data.categories.length >= 1 &&
    hasAtLeastOneNetwork &&
    data.languages.length >= 1;

  const save = async () => {
    if (!user || !profileId || saving) return;
    setSaving(true); setError(null);
    try {
      const audienceObj: Record<string, number> = {};
      if (ig > 0) audienceObj.instagram = ig;
      if (tt > 0) audienceObj.tiktok = tt;
      if (yt > 0) audienceObj.youtube = yt;
      audienceObj.total = totalAudience;
      const handleNormalized = data.handle.trim().startsWith('@') ? data.handle.trim() : `@${data.handle.trim()}`;
      await updateDoc(doc(db, 'influencers_profiles', profileId), {
        displayName: data.displayName.trim(),
        handle: handleNormalized,
        photoURL: data.photoURL || '',
        bio: data.bio.trim(),
        city: data.city.trim(),
        categories: data.categories,
        audience: audienceObj,
        languages: data.languages,
        responseTime: data.responseTime,
        updatedAt: serverTimestamp(),
      });
      setSavedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="imp" style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 className="animate-spin" size={24} color={C.brand} />
      </div>
    );
  }
  if (!user) {
    return <Gate title="Connecte-toi" msg="Connecte-toi pour gérer ton profil créateur." cta={<Link to="/login" style={ctaStyle}>Connexion</Link>} />;
  }
  if (!profileId) {
    return <Gate title="Pas encore inscrit·e" msg="Crée d'abord ton profil créateur." cta={<Link to="/influenceurs/inscription" style={ctaStyle}>Créer mon profil</Link>} />;
  }

  return (
    <div className="imp" style={{ minHeight: '100vh', background: C.cream }}>
      <style>{STYLES}</style>

      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10, 8, 20, 0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 32px',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => navigate(`/influenceurs/${profileId}`)} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: C.cream, width: 38, height: 38, borderRadius: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <ArrowLeft size={16} />
          </button>
          <div className="imp-serif" style={{ fontSize: 15, fontWeight: 700, color: C.cream }}>
            Mon profil <em style={{ fontStyle: 'italic', color: C.goldLight }}>· édition</em>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/influenceurs/mes-liens" style={{
              background: 'rgba(255,255,255,0.08)',
              color: C.cream, fontSize: 12, fontWeight: 600,
              padding: '8px 14px', borderRadius: 100,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Link2 size={12} /> Mes liens
            </Link>
            <a href={`/influenceurs/${profileId}`} target="_blank" rel="noopener noreferrer" style={{
              background: 'rgba(255,255,255,0.08)',
              color: C.cream, fontSize: 12, fontWeight: 600,
              padding: '8px 14px', borderRadius: 100,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <Eye size={12} /> Profil public <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </header>

      <main style={{ padding: '40px 32px 120px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            display: 'inline-flex', alignSelf: 'flex-start',
            alignItems: 'center', gap: 8,
            background: status === 'active' ? C.successSoft : '#FEF3C7',
            border: `1px solid ${status === 'active' ? C.success : '#D97706'}40`,
            borderRadius: 100, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
            color: status === 'active' ? '#065F46' : '#92400E',
            textTransform: 'uppercase',
          }}>
            {status === 'active' ? <Check size={12} /> : <Clock size={12} />}
            {status === 'active' ? 'Profil publié' : 'En attente de validation'}
          </div>

          <Card>
            <SectionTitle title="Photo & identité" />
            <div style={{
              background: C.cream, border: `1px solid ${C.creamDeep}`,
              borderRadius: 16, padding: 16, marginBottom: 14,
            }}>
              <ImageUpload
                userUid={user.uid}
                storagePrefix="influencers"
                value={data.photoURL}
                onChange={url => setData(d => ({ ...d, photoURL: url }))}
                accentColor={C.brand}
                initial={data.displayName.charAt(0) || '?'}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="imp-grid-1">
              <Field label="Nom affiché *">
                <input value={data.displayName} onChange={e => setData(d => ({ ...d, displayName: e.target.value }))} className="imp-input" />
              </Field>
              <Field label="Handle *">
                <div style={{ position: 'relative' }}>
                  <AtSign size={15} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: C.brand }} />
                  <input value={data.handle} onChange={e => setData(d => ({ ...d, handle: e.target.value }))} className="imp-input" style={{ paddingLeft: 42 }} />
                </div>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label="Ville · Pays *">
                <div style={{ position: 'relative' }}>
                  <MapPin size={15} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: C.brand }} />
                  <input value={data.city} onChange={e => setData(d => ({ ...d, city: e.target.value }))} className="imp-input" style={{ paddingLeft: 42 }} />
                </div>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}>
              <Field label={`Bio (≥20 caractères, ${data.bio.length}/200) *`}>
                <textarea value={data.bio} onChange={e => setData(d => ({ ...d, bio: e.target.value }))} className="imp-input" rows={3} maxLength={200} style={{ resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }} />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Catégories (1-4)" />
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
                      if (active) setData(d => ({ ...d, categories: d.categories.filter(cat => cat !== c) }));
                      else if (!disabled) setData(d => ({ ...d, categories: [...d.categories, c] }));
                    }}
                    style={{
                      background: active ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})` : C.cream,
                      color: active ? C.white : (disabled ? C.inkLight : C.ink2),
                      border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
                      padding: '10px 18px', borderRadius: 100,
                      fontSize: 13, fontWeight: 600,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                    {active && <Check size={11} />}
                    {c}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle title="Audience par plateforme" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="imp-grid-1">
              <NumberField icon={Instagram} color="#E1306C" label="Instagram" value={data.instagram} onChange={v => setData(d => ({ ...d, instagram: v }))} />
              <NumberField icon={Music} color="#000000" label="TikTok" value={data.tiktok} onChange={v => setData(d => ({ ...d, tiktok: v }))} />
              <NumberField icon={YoutubeIcon} color="#FF0000" label="YouTube" value={data.youtube} onChange={v => setData(d => ({ ...d, youtube: v }))} />
            </div>
            {totalAudience > 0 && (
              <div style={{
                marginTop: 14,
                background: `linear-gradient(135deg, ${C.brand}08, ${C.gold}10)`,
                border: `1px solid ${C.brand}20`,
                borderRadius: 14, padding: '12px 18px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <BadgeCheck size={16} color={C.brand} />
                <span style={{ fontSize: 14, color: C.ink2 }}>
                  <strong className="imp-mono">{totalAudience.toLocaleString('fr-FR')}</strong> abonnés cumulés
                </span>
              </div>
            )}
            <div style={{
              marginTop: 14, padding: 12,
              background: C.brandSoft, borderRadius: 12,
              fontSize: 12, color: C.brandDeep, lineHeight: 1.5,
            }}>
              💡 Pour gérer les <strong>liens publics</strong> de chaque plateforme (Instagram, TikTok, etc.), passe par <Link to="/influenceurs/mes-liens" style={{ color: C.brand, fontWeight: 700, textDecoration: 'underline' }}>Mes liens</Link>.
            </div>
          </Card>

          <Card>
            <SectionTitle title="Contact & dispo" />
            <Field label="WhatsApp (laisse vide pour ne pas modifier)">
              <div style={{
                display: 'flex', alignItems: 'stretch',
                background: data.whatsapp ? C.successSoft : C.cream,
                borderRadius: 14,
                border: `1.5px solid ${data.whatsapp ? C.whatsapp : C.creamDeep}`,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '14px', background: data.whatsapp ? C.whatsapp : C.white, color: data.whatsapp ? C.white : C.inkSoft, borderRight: `1px solid ${C.creamDeep}`, display: 'flex', alignItems: 'center' }}>
                  <MessageCircle size={15} fill={data.whatsapp ? C.white : 'none'} />
                </div>
                <input type="tel" value={data.whatsapp} onChange={e => setData(d => ({ ...d, whatsapp: e.target.value }))} placeholder="+225 07 12 34 56 78" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '14px 16px', fontSize: 15, color: C.ink, fontFamily: 'inherit', fontWeight: 600, minWidth: 0 }} />
              </div>
              <p style={{ fontSize: 11, color: C.inkLight, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={11} /> Privé · Pour modifier ton numéro, contacte le support.
              </p>
            </Field>

            <div style={{ marginTop: 14 }}>
              <Field label="Langues * (max 4)">
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
                          if (active) setData(d => ({ ...d, languages: d.languages.filter(l => l !== lang) }));
                          else if (!disabled) setData(d => ({ ...d, languages: [...d.languages, lang] }));
                        }}
                        style={{
                          background: active ? `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})` : C.white,
                          color: active ? C.white : (disabled ? C.inkLight : C.ink2),
                          border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
                          padding: '8px 14px', borderRadius: 100,
                          fontSize: 13, fontWeight: 600,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.5 : 1,
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                        {active && <Check size={11} />}
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <div style={{ marginTop: 14 }}>
              <Field label="Temps de réponse">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }} className="imp-grid-1">
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
                          cursor: 'pointer', textAlign: 'left',
                        }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{r.label}</div>
                        <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.3 }}>{r.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Card>

          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 12, padding: 14, fontSize: 13, color: '#991B1B' }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 20, gap: 14, flexWrap: 'wrap',
            background: C.white, borderRadius: 18,
            border: `1px solid ${C.creamDeep}`,
            position: 'sticky', bottom: 16,
            boxShadow: '0 16px 40px -16px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontSize: 12, color: C.inkSoft }}>
              {savedAt
                ? <span style={{ color: C.success, fontWeight: 600 }}><Check size={12} style={{ verticalAlign: -2 }} /> Modifications enregistrées</span>
                : 'Tes modifications sont sauvegardées dans Firestore.'}
            </div>
            <button
              onClick={save}
              disabled={!isValid || saving}
              type="button"
              style={{
                background: isValid ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})` : `linear-gradient(135deg, ${C.brand}, ${C.brandDeep})`,
                color: C.white, border: 'none',
                padding: '14px 28px', borderRadius: 100,
                fontSize: 15, fontWeight: 700,
                cursor: !isValid || saving ? 'not-allowed' : 'pointer',
                opacity: !isValid || saving ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: isValid ? `0 10px 28px -8px ${C.gold}80` : 'none',
              }}>
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> Enregistrement…</>
                : <><Save size={15} /> Enregistrer les changements</>}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

const ctaStyle: React.CSSProperties = {
  display: 'inline-block', textAlign: 'center',
  background: C.brand, color: C.white,
  padding: '12px 24px', borderRadius: 100,
  textDecoration: 'none', fontWeight: 700, fontSize: 14,
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.creamDeep}`,
      borderRadius: 20, padding: 28,
    }}>{children}</div>
  );
}
function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="imp-serif" style={{
      fontSize: 18, fontWeight: 700, color: C.ink,
      margin: '0 0 16px',
      display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      <Sparkles size={14} color={C.brand} /> {title}
    </h3>
  );
}
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.ink2, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
function NumberField({ icon: Icon, color, label, value, onChange }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string; label: string;
  value: string; onChange: (v: string) => void;
}) {
  const active = (parseInt(value, 10) || 0) > 0;
  return (
    <div>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, fontWeight: 700, color: C.ink2, marginBottom: 6,
      }}>
        <Icon size={13} color={color} /> {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: active ? C.white : C.cream,
        borderRadius: 12,
        border: `1.5px solid ${active ? color : C.creamDeep}`,
        overflow: 'hidden',
      }}>
        <input
          type="number" value={value}
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
          padding: '0 12px', display: 'flex', alignItems: 'center',
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
function Gate({ title, msg, cta }: { title: string; msg: string; cta: React.ReactNode }) {
  return (
    <div className="imp" style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <style>{STYLES}</style>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <Shield size={36} color={C.brand} style={{ marginBottom: 12 }} />
        <h1 className="imp-serif" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        <p style={{ color: C.inkSoft, marginBottom: 18, fontSize: 14 }}>{msg}</p>
        {cta}
      </div>
    </div>
  );
}
