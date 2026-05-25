/**
 * Orlode Talents — candidate edit-profile at /talents/mon-profil.
 * Loads the signed-in user's talents_profiles doc (found by userId),
 * pre-fills the same fields as the signup form, lets them update.
 * Editorial green design — single page, no step wizard (you're already in).
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, doc, getDocs, query, updateDoc, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
  ArrowLeft, Save, Loader2, MapPin, Sparkles, Shield, Plus, X, Check,
  Code, Palette, Megaphone, Coffee, Briefcase, Video, Hammer, GraduationCap,
  MessageCircle, Eye, ExternalLink, Clock,
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { useAuthStore } from '@/store/authStore';
import ImageUpload from '@/components/common/ImageUpload';
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

const CATEGORIES = [
  { id: 'tech',        label: 'Tech',        icon: Code,          sector: 'tech' },
  { id: 'design',      label: 'Design',      icon: Palette,       sector: 'creatif' },
  { id: 'marketing',   label: 'Marketing',   icon: Megaphone,     sector: 'marketing' },
  { id: 'hospitality', label: 'Hospitalité', icon: Coffee,        sector: 'restauration' },
  { id: 'finance',     label: 'Finance',     icon: Briefcase,     sector: 'finance' },
  { id: 'creative',    label: 'Créatif',     icon: Video,         sector: 'creatif' },
  { id: 'manual',      label: 'Manuel',      icon: Hammer,        sector: 'artisanat' },
  { id: 'education',   label: 'Éducation',   icon: GraduationCap, sector: 'education' },
];

const LANGUAGES = ['Français', 'Anglais', 'Espagnol', 'Portugais', 'Arabe', 'Wolof', 'Dioula', 'Lingala', 'Bambara', 'Swahili', 'Baoulé', 'Ewondo', 'Yoruba'];

const AVAILABILITY: { id: 'immediate' | '1month' | '3months' | 'open'; label: string; desc: string }[] = [
  { id: 'immediate', label: 'Immédiat',    desc: 'Disponible de suite' },
  { id: '1month',    label: 'Sous 1 mois', desc: 'En transition' },
  { id: '3months',   label: 'Sous 3 mois', desc: 'En préavis' },
  { id: 'open',      label: 'Ouvert',      desc: 'À discuter' },
];

interface FormData {
  firstName: string;
  lastName: string;
  age: string;
  location: string;
  category: string;
  role: string;
  pitch: string;
  skills: string[];
  whatsapp: string;
  languages: string[];
  availability: typeof AVAILABILITY[number]['id'] | '';
  photoURL: string;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  .tmp { font-family: 'Inter', system-ui, sans-serif; color: ${C.ink}; }
  .tmp-serif { font-family: 'Fraunces', serif; letter-spacing: -0.025em; }
  .tmp-mono { font-family: 'JetBrains Mono', monospace; }
  .tmp-input {
    width: 100%; background: ${C.white}; color: ${C.ink};
    border: 1.5px solid ${C.creamDeep};
    border-radius: 14px; padding: 14px 18px;
    font-size: 15px; font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .tmp-input:focus { border-color: ${C.brand}; box-shadow: 0 0 0 4px ${C.brandSoft}; }
  .tmp-input::placeholder { color: ${C.inkLight}; }
  @media (max-width: 768px) {
    .tmp-grid-1 { grid-template-columns: 1fr !important; }
  }
`;

export default function TalentsMyProfilePage() {
  useSEO({ title: 'Mon profil — Orlode Talents', path: '/talents/mon-profil', noindex: true });
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [data, setData] = useState<FormData>({
    firstName: '', lastName: '', age: '', location: '',
    category: '', role: '', pitch: '',
    skills: [], whatsapp: '',
    languages: ['Français'],
    availability: '',
    photoURL: '',
  });
  const [video, setVideo] = useState<VideoUploadValue>({ url: '', durationSec: 0 });
  const [status, setStatus] = useState<string>('pending_analysis');
  const [newSkill, setNewSkill] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    void (async () => {
      try {
        const q = query(collection(db, 'talents_profiles'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        if (snap.empty) { setLoading(false); return; }
        const d = snap.docs[0]!;
        setProfileId(d.id);
        const raw = d.data() as Record<string, unknown>;
        setStatus((raw['status'] as string) ?? 'pending_analysis');

        const fullName = (raw['displayName'] as string) ?? '';
        const fn = (raw['firstName'] as string) ?? fullName.split(' ')[0] ?? '';
        const ln = (raw['lastName'] as string) ?? fullName.split(' ').slice(1).join(' ');
        const city = (raw['city'] as string) ?? '';
        const country = (raw['country'] as string) ?? '';
        const location = [city, country].filter(Boolean).join(', ');

        // Try to reverse-map sector → category (best effort).
        const sector = (raw['sector'] as string) ?? '';
        const storedCat = (raw['category'] as string) ?? '';
        const inferredCat = CATEGORIES.find(c => c.sector === sector)?.id ?? '';

        setData({
          firstName: fn,
          lastName: ln,
          age: raw['age'] != null ? String(raw['age']) : '',
          location,
          category: storedCat || inferredCat,
          role: (raw['role'] as string) ?? '',
          pitch: (raw['tagline'] as string) ?? '',
          skills: (raw['skills'] as string[]) ?? [],
          whatsapp: '', // private subcollection — not fetched in edit page; user can re-enter
          languages: (raw['languages'] as string[]) ?? [(raw['language'] as string) ?? 'Français'],
          availability: ((raw['availability'] as FormData['availability']) ?? 'open'),
          photoURL: (raw['photoURL'] as string) ?? '',
        });
        setVideo({
          url: (raw['videoUrl'] as string) ?? '',
          durationSec: (raw['videoDuration'] as number) ?? 0,
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user || !profileId || saving) return;
    setSaving(true); setError(null);
    try {
      const cat = CATEGORIES.find(c => c.id === data.category);
      const [city, ...countryParts] = data.location.split(',').map(s => s.trim());
      const country = countryParts.join(', ') || null;
      const update: Record<string, unknown> = {
        displayName: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        age: data.age ? Number(data.age) : null,
        city: city || data.location.trim(),
        country,
        category: data.category,
        role: data.role.trim(),
        skills: data.skills,
        tagline: data.pitch.trim(),
        languages: data.languages,
        language: data.languages[0] ?? 'Français',
        availability: data.availability,
        photoURL: data.photoURL || '',
        videoUrl: video.url.trim(),
        videoDuration: video.durationSec || 0,
        updatedAt: serverTimestamp(),
      };
      if (cat?.sector) update['sector'] = cat.sector;

      await updateDoc(doc(db, 'talents_profiles', profileId), update);
      setSavedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Auth-gates
  if (loading) {
    return (
      <div className="tmp" style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <Loader2 className="animate-spin" size={24} color={C.brand} />
      </div>
    );
  }
  if (!user) {
    return (
      <Gate
        title="Connecte-toi"
        msg="Connecte-toi pour gérer ton profil candidat."
        cta={<Link to="/login" className="tmp-input" style={{ display: 'inline-block', textAlign: 'center', background: C.brand, color: C.white, borderColor: C.brand, width: 'auto', padding: '12px 24px', borderRadius: 100, textDecoration: 'none', fontWeight: 700 }}>Connexion</Link>}
      />
    );
  }
  if (!profileId) {
    return (
      <Gate
        title="Pas encore inscrit·e"
        msg="Crée d'abord ton profil candidat — tu pourras ensuite l'éditer."
        cta={<Link to="/talents/inscription" className="tmp-input" style={{ display: 'inline-block', textAlign: 'center', background: C.brand, color: C.white, borderColor: C.brand, width: 'auto', padding: '12px 24px', borderRadius: 100, textDecoration: 'none', fontWeight: 700 }}>Créer mon profil</Link>}
      />
    );
  }

  const isValid =
    data.firstName.trim().length >= 2 &&
    data.lastName.trim().length >= 1 &&
    !!data.category &&
    data.role.trim().length >= 2 &&
    data.pitch.trim().length >= 10 &&
    data.skills.length >= 1 &&
    data.location.trim().length >= 2 &&
    data.languages.length >= 1;

  return (
    <div className="tmp" style={{ minHeight: '100vh', background: C.cream }}>
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
          maxWidth: 1080, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={() => navigate(`/talents/${profileId}`)} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: C.cream, width: 38, height: 38, borderRadius: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <ArrowLeft size={16} />
          </button>
          <div className="tmp-serif" style={{
            fontSize: 15, fontWeight: 700, color: C.cream,
          }}>
            Mon profil <em style={{ fontStyle: 'italic', color: C.goldLight }}>· édition</em>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={`/talents/${profileId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: C.cream, fontSize: 12, fontWeight: 600,
                padding: '8px 14px', borderRadius: 100,
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
              <Eye size={12} /> Voir le profil public <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </header>

      <main style={{ padding: '40px 32px 120px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status pill */}
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

          {/* Photo + identity */}
          <Card>
            <SectionTitle title="Photo & identité" />
            <div style={{
              background: C.cream, border: `1px solid ${C.creamDeep}`,
              borderRadius: 16, padding: 16, marginBottom: 14,
            }}>
              <ImageUpload
                userUid={user.uid}
                storagePrefix="talents"
                value={data.photoURL}
                onChange={url => setData(d => ({ ...d, photoURL: url }))}
                accentColor={C.brand}
                initial={data.firstName.charAt(0) || '?'}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="tmp-grid-1">
              <Field label="Prénom *">
                <input value={data.firstName} onChange={e => setData(d => ({ ...d, firstName: e.target.value }))} className="tmp-input" />
              </Field>
              <Field label="Nom *">
                <input value={data.lastName} onChange={e => setData(d => ({ ...d, lastName: e.target.value }))} className="tmp-input" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginTop: 12 }} className="tmp-grid-1">
              <Field label="Âge">
                <input type="number" value={data.age} onChange={e => setData(d => ({ ...d, age: e.target.value }))} className="tmp-input tmp-mono" style={{ fontWeight: 700 }} />
              </Field>
              <Field label="Ville · Pays *">
                <div style={{ position: 'relative' }}>
                  <MapPin size={15} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: C.brand }} />
                  <input value={data.location} onChange={e => setData(d => ({ ...d, location: e.target.value }))} className="tmp-input" style={{ paddingLeft: 42 }} />
                </div>
              </Field>
            </div>
          </Card>

          {/* Métier */}
          <Card>
            <SectionTitle title="Métier" />
            <Field label="Catégorie *">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }} className="tmp-grid-1">
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
                        borderRadius: 14, padding: '12px 8px',
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      }}>
                      <Icon size={16} />
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <div style={{ marginTop: 14 }}>
              <Field label="Intitulé du métier *">
                <input value={data.role} onChange={e => setData(d => ({ ...d, role: e.target.value }))} className="tmp-input" />
              </Field>
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label={`Pitch (≥10 caractères, ${data.pitch.length}/200) *`}>
                <textarea value={data.pitch} onChange={e => setData(d => ({ ...d, pitch: e.target.value }))} className="tmp-input" rows={3} maxLength={200} style={{ resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }} />
              </Field>
            </div>
          </Card>

          {/* Skills */}
          <Card>
            <SectionTitle title="Compétences" />
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = newSkill.trim();
                    if (v && data.skills.length < 6 && !data.skills.includes(v)) {
                      setData(d => ({ ...d, skills: [...d.skills, v] }));
                      setNewSkill('');
                    }
                  }
                }}
                placeholder="Ajoute une compétence (Entrée)"
                className="tmp-input"
                disabled={data.skills.length >= 6}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => {
                  const v = newSkill.trim();
                  if (v && data.skills.length < 6 && !data.skills.includes(v)) {
                    setData(d => ({ ...d, skills: [...d.skills, v] }));
                    setNewSkill('');
                  }
                }}
                type="button"
                disabled={!newSkill.trim() || data.skills.length >= 6}
                style={{
                  background: `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
                  color: C.white, border: 'none',
                  padding: '14px 20px', borderRadius: 100,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                <Plus size={14} /> Ajouter
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.skills.map(s => (
                <span key={s} style={{
                  background: C.brandSoft, border: `1.5px solid ${C.brand}30`,
                  color: C.brandDeep, padding: '8px 14px', borderRadius: 100,
                  fontSize: 13, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  {s}
                  <button onClick={() => setData(d => ({ ...d, skills: d.skills.filter(sk => sk !== s) }))} type="button" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: C.brandDeep, display: 'flex' }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </Card>

          {/* Video */}
          <Card>
            <SectionTitle title="Ta vidéo (1 min)" />
            <VideoUpload userUid={user.uid} storagePrefix="talents" value={video} onChange={setVideo} />
          </Card>

          {/* Contact + dispo */}
          <Card>
            <SectionTitle title="Contact & disponibilité" />
            <Field label="WhatsApp (laisse vide si tu ne veux pas modifier)">
              <div style={{
                display: 'flex', alignItems: 'stretch',
                background: data.whatsapp ? C.successSoft : C.cream,
                borderRadius: 14,
                border: `1.5px solid ${data.whatsapp ? C.whatsapp : C.creamDeep}`,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 14px', background: data.whatsapp ? C.whatsapp : C.white, color: data.whatsapp ? C.white : C.inkSoft, borderRight: `1px solid ${C.creamDeep}`, display: 'flex', alignItems: 'center' }}>
                  <MessageCircle size={15} fill={data.whatsapp ? C.white : 'none'} />
                </div>
                <input type="tel" value={data.whatsapp} onChange={e => setData(d => ({ ...d, whatsapp: e.target.value }))} placeholder="+225 07 12 34 56 78" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '14px 16px', fontSize: 15, color: C.ink, fontFamily: 'inherit', fontWeight: 600, minWidth: 0 }} />
              </div>
              <p style={{ fontSize: 11, color: C.inkLight, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={11} /> Privé · Jamais affiché publiquement
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
              <Field label="Disponibilité *">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }} className="tmp-grid-1">
                  {AVAILABILITY.map(a => {
                    const active = data.availability === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setData(d => ({ ...d, availability: a.id }))}
                        style={{
                          background: active ? `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})` : C.cream,
                          color: active ? C.white : C.ink2,
                          border: `1.5px solid ${active ? C.brand : C.creamDeep}`,
                          borderRadius: 14, padding: '14px 12px',
                          cursor: 'pointer', textAlign: 'left',
                        }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{a.label}</div>
                        <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.3 }}>{a.desc}</div>
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

          {/* Submit */}
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
                background: isValid ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})` : `linear-gradient(135deg, ${C.brandMid}, ${C.brandDeep})`,
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
    <h3 className="tmp-serif" style={{
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
function Gate({ title, msg, cta }: { title: string; msg: string; cta: React.ReactNode }) {
  return (
    <div className="tmp" style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <style>{STYLES}</style>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <Shield size={36} color={C.brand} style={{ marginBottom: 12 }} />
        <h1 className="tmp-serif" style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        <p style={{ color: C.inkSoft, marginBottom: 18, fontSize: 14 }}>{msg}</p>
        {cta}
      </div>
    </div>
  );
}
