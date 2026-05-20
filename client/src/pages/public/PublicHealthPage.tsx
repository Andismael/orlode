/**
 * Public health/cabinet page — accessible sans auth.
 * URL : /cabinet/:slug
 *
 * IMPORTANT — confidentialité :
 *   Cette page n'expose JAMAIS de données patients.
 *   Elle affiche uniquement les infos publiques du cabinet + un bouton
 *   "Prendre RDV" qui ouvre une demande pré-formattée WhatsApp avec motif.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Stethoscope, MessageCircle, Loader2, AlertCircle, Sparkles,
  Calendar, X, Heart, Phone, MapPin, AlertTriangle,
} from 'lucide-react';
import { PublicTagline, PublicSocials, PublicContactBar } from '@/components/public/PublicBranding';
import { PublicLangSwitcher } from '@/components/public/PublicLangSwitcher';

const C = {
  teal:        '#14B8A6',
  tealDeep:    '#0F766E',
  tealSoft:    '#CCFBF1',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  red:         '#EF4444',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }
`;

interface Store {
  id: string; name: string; currency: string; country: string;
  paymentInstructions?: string;
  logoUrl?: string | null; coverImageUrl?: string | null; accentColor?: string | null;
  openingHours?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const REASONS = [
  '🩺 Consultation générale',
  '💉 Vaccination',
  '🩹 Suivi / contrôle',
  '🤧 Symptômes (rhume, fièvre…)',
  '🤰 Pré/post-natal',
  '👶 Pédiatrie',
  '🦷 Dentaire',
  '💊 Renouvellement ordonnance',
  'Autre',
];

export default function PublicHealthPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ store: Store; whatsappBusinessNumber: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true); setError(null);
    fetch(`/api/public/shop/${slug}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`);
        return r.json() as Promise<{ store: Store; whatsappBusinessNumber: string | null }>;
      })
      .then(d => setData({ store: d.store, whatsappBusinessNumber: d.whatsappBusinessNumber }))
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div style={{ background: '#082b27', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{STYLES}</style>

      <div className="grain" style={{
        background: data?.store.coverImageUrl
          ? `linear-gradient(135deg, rgba(15,118,110,0.85), rgba(13,94,87,0.85)), url(${data.store.coverImageUrl})`
          : `linear-gradient(135deg, ${C.teal}, ${C.tealDeep} 60%, #082b27)`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        padding: '48px 24px 56px', position: 'relative', overflow: 'hidden', color: C.cream,
      }}>
        <svg style={{ position: 'absolute', right: -60, top: -60, opacity: 0.16 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60"  stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            {data?.store.logoUrl && (
              <img src={data.store.logoUrl} alt={data.store.name} style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', background: 'rgba(255,250,240,0.92)', boxShadow: '0 12px 28px -8px rgba(0,0,0,0.4)' }} />
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <Stethoscope size={11} /> CABINET MÉDICAL
            </div>
          </div>
          <h1 className="display-font" style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, margin: 0, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            {loading ? 'Chargement…' : (data?.store.name ?? 'Cabinet')}
          </h1>
          {data && (data.store.tagline || data.store.shortDescription) && (
            <PublicTagline store={data.store as any} color={C.teal} dark />
          )}
          {data?.store.paymentInstructions && (
            <p style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
              {data.store.paymentInstructions}
            </p>
          )}
          {data && (
            <div style={{ marginTop: 14 }}>
              <PublicSocials store={data.store as any} color={C.teal} compact />
            </div>
          )}
          {data?.store && (data.store.openingHours || data.store.address) && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.store.openingHours && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.30)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  <span>🕐</span><span>{data.store.openingHours}</span>
                </div>
              )}
              {data.store.address && (() => {
                const mapsHref = data.store.googleMapsUrl
                  ?? (typeof data.store.latitude === 'number' && typeof data.store.longitude === 'number'
                    ? `https://www.google.com/maps/search/?api=1&query=${data.store.latitude},${data.store.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.store.address)}`);
                return (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.30)',
                    fontSize: 13, fontWeight: 600, color: 'inherit', textDecoration: 'none',
                  }}>
                    <span>📍</span>
                    <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.store.address}</span>
                    <span style={{ opacity: 0.65, fontSize: 11 }}>→ Maps</span>
                  </a>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 24px 64px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.cream }}>
            <Loader2 size={28} className="spin" color={C.teal} />
          </div>
        )}
        {error && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <AlertCircle size={32} color={C.red} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>Cabinet indisponible</div>
            <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 6 }}>{error}</div>
          </div>
        )}

        {data && !loading && !error && (
          <>
            {/* Info card */}
            <div style={{ background: C.cream, borderRadius: 18, padding: 28, marginBottom: 20, boxShadow: '0 16px 40px -16px rgba(10,42,32,0.18)' }}>
              <h2 className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, margin: '0 0 14px' }}>
                Bienvenue
              </h2>
              <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>
                Pour prendre rendez-vous, clique sur le bouton ci-dessous. Tu rempliras une courte
                demande (motif, date souhaitée, contact) et le cabinet te confirme rapidement par WhatsApp.
              </p>

              <div style={{ marginTop: 20, padding: 14, background: C.tealSoft, borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Heart size={16} color={C.tealDeep} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: C.tealDeep, lineHeight: 1.5 }}>
                  <strong>Confidentialité.</strong> Aucune donnée patient n'est exposée publiquement.
                  Ton dossier reste privé entre toi et le cabinet.
                </div>
              </div>

              {data.whatsappBusinessNumber ? (
                <button onClick={() => setBookingOpen(true)} style={{
                  marginTop: 24, width: '100%', padding: '16px 22px',
                  background: `linear-gradient(135deg, ${C.teal}, ${C.tealDeep})`,
                  color: '#fff', border: 'none', borderRadius: 14,
                  fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: `0 12px 28px -10px ${C.teal}80`,
                }}>
                  <Calendar size={18} /> Prendre rendez-vous
                </button>
              ) : (
                <div style={{
                  marginTop: 24, padding: '14px 20px', background: C.creamDeep, color: C.inkSoft,
                  borderRadius: 12, fontSize: 13, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <Phone size={14} /> WhatsApp non encore configuré — contacte le cabinet directement
                </div>
              )}
            </div>

            {/* Urgency notice */}
            <div style={{ background: '#FFF7E6', border: '1px solid #FCD34D40', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.55 }}>
                <strong>Urgence vitale ?</strong> Cette page n'est pas adaptée. Appelle le SAMU (185 en CI), pompiers ou rends-toi aux urgences les plus proches.
              </div>
            </div>

            <div style={{ marginTop: 30, padding: 18, borderRadius: 14, background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.10)', textAlign: 'center', color: 'rgba(255,250,240,0.82)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                <Sparkles size={11} /> Powered by Orlode AI
              </div>
              <div style={{ fontSize: 12 }}>Cabinet IA · RDV confidentiels · Confirmation WhatsApp</div>
            </div>
          </>
        )}
      </div>

      {bookingOpen && data?.whatsappBusinessNumber && (
        <BookingModal waNumber={data.whatsappBusinessNumber} storeName={data.store.name}
          onClose={() => setBookingOpen(false)} />
      )}
      {data && <PublicContactBar store={data.store as any} color={C.tealDeep} primaryCta={{ label: 'Prendre RDV', href: '#booking' }} />}
      <PublicLangSwitcher dark />
    </div>
  );
}

function BookingModal({ waNumber, storeName, onClose }: {
  waNumber: string; storeName: string; onClose: () => void;
}) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const [notes, setNotes] = useState('');

  const finalReason = reason === 'Autre' ? otherReason : reason;
  const canSubmit = name.trim().length >= 2 && phone.length >= 6 && date && time && finalReason.trim().length >= 2;

  const buildWa = () => {
    const msg = `Bonjour, je voudrais prendre rendez-vous au *${storeName}* :\n\n` +
      `👤 Nom : ${name}\n📞 ${phone}\n📅 ${date} à ${time}\n` +
      `💬 Motif : ${finalReason}\n` +
      (notes.trim() ? `📝 ${notes}\n` : '') +
      `\nMerci de confirmer la disponibilité 🙏`;
    return `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, padding: 16, background: 'rgba(8,43,39,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cream, borderRadius: 22, maxWidth: 520, width: '100%', boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDeep})`, color: '#fff', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Prendre rendez-vous</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><Label>Nom</Label><Input value={name} onChange={setName} placeholder="Mr Konan" /></div>
            <div><Label>Téléphone</Label><Input value={phone} onChange={setPhone} placeholder="+225 07..." /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Motif</Label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Autre' && (
              <input type="text" value={otherReason} onChange={e => setOtherReason(e.target.value)}
                placeholder="Précisez le motif"
                style={{ marginTop: 8, width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }} />
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><Label>Date souhaitée</Label><Input type="date" value={date} onChange={setDate} /></div>
            <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <Label>Notes (optionnel)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Allergie connue, suivi…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          {canSubmit ? (
            <a href={buildWa()} target="_blank" rel="noopener noreferrer" onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 18px', borderRadius: 12, background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 8px 20px -6px rgba(37,211,102,0.55)' }}>
              <MessageCircle size={16} /> Envoyer la demande
            </a>
          ) : (
            <button disabled style={{ width: '100%', padding: '14px 18px', borderRadius: 12, background: C.creamDeep, color: C.inkLight, border: 'none', fontWeight: 700, cursor: 'not-allowed' }}>
              Remplis tous les champs
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{children}</label>;
}
function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', color: C.ink }} />;
}
