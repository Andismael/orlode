/**
 * Public residence listing — Booking/Airbnb-style single-unit page.
 * Each /residence/{slug} = 1 store = 1 unit.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Home, Loader2, AlertCircle, Calendar, Users, BedDouble, Bath, Maximize, MapPin, Wifi,
  Sparkles, MessageCircle, X, ArrowRight,
} from 'lucide-react';
import PhotoCarousel from '@/components/store/PhotoCarousel';
import { PublicTagline, PublicSocials, PublicContactBar } from '@/components/public/PublicBranding';
import { PublicLangSwitcher } from '@/components/public/PublicLangSwitcher';
import PerCompanyPWAHead from '@/components/common/PerCompanyPWAHead';

const C = {
  rose: '#F43F5E', roseDeep: '#9F1239', cream: '#FFFAF0', creamDeep: '#F5EDD6',
  ink: '#0A2A20', inkSoft: '#5A6B62', inkLight: '#94A3A0',
};

interface Residence {
  id: string;
  companyId?: string;
  slug: string;
  name: string;
  currency: string;
  country: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  roomType: 'entire' | 'private_room' | 'shared_room';
  bedrooms?: number | null;
  bathrooms?: number | null;
  surfaceM2?: number | null;
  maxGuests?: number | null;
  childrenFreeUnder?: number;
  allowExtraGuests?: boolean;
  maxExtraGuests?: number | null;
  pricePerNight?: number | null;
  cleaningFee?: number | null;
  amenities?: string[];
  affiliateUrl?: string | null;
  instantBooking?: boolean;
  useContactForm?: boolean;
  longDescription?: string;
  paymentInstructions?: string;
  openingHours?: string | null;
  bookedRanges?: Array<{ from: string; to: string }>;
  houseRules?: string | null;
  cancellationPolicy?: 'flexible' | 'moderate' | 'strict' | null;
  weeklyDiscountPct?: number | null;
  monthlyDiscountPct?: number | null;
}

const NO_DECIMAL = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']);
function formatPrice(n: number, currency: string): string {
  const decimals = NO_DECIMAL.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(n);
  } catch { return `${n.toLocaleString('fr-FR')} ${currency}`; }
}

function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom < bTo && aTo > bFrom;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  entire: 'Logement entier', private_room: 'Chambre privée', shared_room: 'Chambre partagée',
};

export default function PublicResidencePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ residence: Residence; whatsappBusinessNumber: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true); setError(null);
    fetch(`/api/public/residence/${slug}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(err => setError(String(err.message ?? err)))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div style={{ minHeight: '100vh', background: '#1a0a0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={28} className="spin" color={C.rose} /></div>;
  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#1a0a0e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.cream, borderRadius: 16, padding: 28, maxWidth: 420, textAlign: 'center' }}>
        <AlertCircle size={32} color={C.roseDeep} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Résidence introuvable</div>
        <div style={{ fontSize: 13, color: C.inkSoft }}>{error}</div>
      </div>
    </div>
  );

  const r = data.residence;
  const accent = C.rose; const accentDark = C.roseDeep;

  return (
    <div style={{ background: '#1a0a0e', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <PerCompanyPWAHead
        companyId={r.companyId || r.id}
        companyName={r.name}
        logoUrl={r.logoUrl ?? undefined}
        primaryColor={accent}
      />
      {/* Hero */}
      <div style={{
        position: 'relative',
        background: r.coverImageUrl
          ? `linear-gradient(135deg, rgba(244,63,94,0.85), rgba(159,18,57,0.85)), url(${r.coverImageUrl})`
          : `linear-gradient(135deg, ${accent}, ${accentDark})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        color: '#fff', padding: '50px 24px 40px',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            {r.logoUrl && <img src={r.logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '2px solid rgba(255,250,240,0.4)' }} />}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <Home size={11} /> RÉSIDENCE
            </div>
            {r.instantBooking && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(16,185,129,0.25)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                ⚡ Réservation instantanée
              </div>
            )}
          </div>
          <h1 className="display-font" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: 0, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            {r.name}
          </h1>
          {(r.tagline || r.shortDescription) && (
            <PublicTagline store={r as any} color={C.rose} dark />
          )}
          <p style={{ marginTop: 12, fontSize: 14, opacity: 0.92, maxWidth: 560 }}>
            {ROOM_TYPE_LABELS[r.roomType] ?? 'Logement'}
            {r.maxGuests ? ` · ${r.maxGuests} voyageurs` : ''}
            {r.bedrooms ? ` · ${r.bedrooms} ch.` : ''}
            {r.bathrooms ? ` · ${r.bathrooms} sdb` : ''}
            {r.surfaceM2 ? ` · ${r.surfaceM2}m²` : ''}
          </p>
          <div style={{ marginTop: 14 }}>
            <PublicSocials store={r as any} color={C.rose} compact />
          </div>
          {(r.city || r.address) && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(() => {
                const mapsHref = r.googleMapsUrl
                  ?? (typeof r.latitude === 'number' && typeof r.longitude === 'number'
                    ? `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address ?? r.city ?? '')}`);
                return (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.30)',
                    fontSize: 13, fontWeight: 600, color: 'inherit', textDecoration: 'none',
                  }}>
                    <MapPin size={13} />
                    {r.city}{r.neighborhood ? ` · ${r.neighborhood}` : ''}
                  </a>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '-28px auto 0', padding: '0 24px 48px', position: 'relative', zIndex: 2 }}>
        {/* Carousel + booking column */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16 }}>
          <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', boxShadow: '0 16px 40px -16px rgba(0,0,0,0.3)' }}>
            <PhotoCarousel
              images={[]}
              fallback={r.coverImageUrl}
              alt={r.name}
              aspect="16/9"
              emptyBackground={`linear-gradient(135deg, ${accent}, ${accentDark})`}
              emptyEmoji="🏠"
              borderRadius="0"
            />
            <div style={{ padding: 24 }}>
              {r.longDescription && (
                <p style={{ fontSize: 14, lineHeight: 1.6, color: C.ink, margin: 0, whiteSpace: 'pre-wrap' }}>{r.longDescription}</p>
              )}
              {r.amenities && r.amenities.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <h3 className="display-font" style={{ fontSize: 16, fontWeight: 800, margin: '0 0 10px', color: C.ink }}>🛠 Ce que cet endroit offre</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {r.amenities.map((a, i) => (
                      <span key={i} style={{ padding: '6px 12px', borderRadius: 100, background: C.creamDeep, color: C.ink, fontSize: 12, fontWeight: 600 }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                <Stat icon={<Users size={16} />} label="Voyageurs" value={r.maxGuests ? String(r.maxGuests) : '—'} />
                <Stat icon={<BedDouble size={16} />} label="Chambres" value={r.bedrooms != null ? String(r.bedrooms) : '—'} />
                <Stat icon={<Bath size={16} />} label="SDB" value={r.bathrooms != null ? String(r.bathrooms) : '—'} />
                <Stat icon={<Maximize size={16} />} label="Surface" value={r.surfaceM2 ? `${r.surfaceM2}m²` : '—'} />
              </div>
              {r.openingHours && (
                <div style={{ marginTop: 18, fontSize: 12, color: C.inkSoft, padding: 12, background: C.creamDeep, borderRadius: 10 }}>
                  🕐 {r.openingHours}
                </div>
              )}
              {r.paymentInstructions && (
                <div style={{ marginTop: 12, fontSize: 12, color: C.inkSoft, padding: 12, background: C.creamDeep, borderRadius: 10 }}>
                  💰 {r.paymentInstructions}
                </div>
              )}
              {r.houseRules && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    📋 Règlement intérieur
                  </div>
                  <div style={{
                    fontSize: 13, color: C.ink, padding: 14, background: C.creamDeep, borderRadius: 10,
                    whiteSpace: 'pre-wrap', lineHeight: 1.6,
                  }}>
                    {r.houseRules}
                  </div>
                </div>
              )}
              {r.cancellationPolicy && (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 11px', borderRadius: 100,
                    background: r.cancellationPolicy === 'flexible' ? '#dcfce7'
                              : r.cancellationPolicy === 'moderate' ? '#fef3c7'
                              : '#fee2e2',
                    color: r.cancellationPolicy === 'flexible' ? '#166534'
                         : r.cancellationPolicy === 'moderate' ? '#92400e'
                         : '#991b1b',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    {r.cancellationPolicy === 'flexible' ? '🟢 Annulation flexible' : r.cancellationPolicy === 'moderate' ? '🟡 Annulation modérée' : '🔴 Non remboursable'}
                  </span>
                  <span style={{ fontSize: 11, color: C.inkSoft }}>
                    {r.cancellationPolicy === 'flexible' ? 'Gratuit jusqu\'à J-1' : r.cancellationPolicy === 'moderate' ? 'Gratuit jusqu\'à J-5' : 'Aucun remboursement'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Booking column */}
          <div style={{ position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
            <div style={{ background: C.cream, borderRadius: 18, padding: 24, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.3)' }}>
              {r.pricePerNight && (
                <div style={{ marginBottom: 14 }}>
                  <span className="mono-font" style={{ fontSize: 26, fontWeight: 800, color: accentDark }}>
                    {formatPrice(r.pricePerNight, r.currency)}
                  </span>
                  <span style={{ fontSize: 13, color: C.inkSoft }}> / nuit</span>
                </div>
              )}
              {r.cleaningFee ? (
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>
                  + {formatPrice(r.cleaningFee, r.currency)} frais ménage
                </div>
              ) : null}
              {data.whatsappBusinessNumber ? (
                <button onClick={() => setBookingOpen(true)} style={{
                  width: '100%', padding: '14px 18px', borderRadius: 12,
                  background: accentDark, color: '#fff', border: 'none',
                  fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: `0 8px 20px -6px ${accent}90`,
                }}>
                  <Calendar size={15} /> {r.useContactForm ? 'Demander info' : 'Réserver maintenant'}
                </button>
              ) : (
                <button disabled style={{ width: '100%', padding: '14px 18px', borderRadius: 12, background: C.creamDeep, color: C.inkLight, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'not-allowed' }}>
                  Bientôt disponible
                </button>
              )}
              {r.affiliateUrl && (
                <a href={r.affiliateUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'block', marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'transparent', color: accentDark, border: `1.5px solid ${accent}50`, textAlign: 'center', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                  Voir aussi sur Booking/Airbnb →
                </a>
              )}
              {(r.bookedRanges?.length ?? 0) > 0 && (
                <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: C.creamDeep, fontSize: 11, color: C.inkSoft }}>
                  📅 Indispos : {(r.bookedRanges ?? []).slice(0, 3).map(rg => `${rg.from}→${rg.to}`).join(' · ')}
                  {(r.bookedRanges?.length ?? 0) > 3 && ` (+${r.bookedRanges!.length - 3})`}
                </div>
              )}
            </div>
            <div style={{ marginTop: 18, padding: 16, borderRadius: 14, background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.10)', textAlign: 'center', color: 'rgba(255,250,240,0.82)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                <Sparkles size={11} /> Powered by Orlode
              </div>
              <div style={{ fontSize: 11 }}>Booking direct WhatsApp · Sans commission cachée</div>
            </div>
          </div>
        </div>
      </div>

      {bookingOpen && data.whatsappBusinessNumber && (
        <BookingModal residence={r} accent={accent} accentDark={accentDark}
          waNumber={data.whatsappBusinessNumber}
          onClose={() => setBookingOpen(false)} />
      )}
      <PublicContactBar store={r as any} color={accent} primaryCta={{ label: 'Réserver', href: '#booking' }} />
      <PublicLangSwitcher dark />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: C.creamDeep, borderRadius: 12, padding: 12, textAlign: 'center' }}>
      <div style={{ color: C.roseDeep, marginBottom: 4 }}>{icon}</div>
      <div className="display-font" style={{ fontSize: 16, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function BookingModal({ residence, accent, accentDark, waNumber, onClose }: {
  residence: Residence; accent: string; accentDark: string; waNumber: string; onClose: () => void;
}) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
  const [name, setName] = useState('');
  const [checkIn, setCheckIn] = useState(tomorrow.toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(dayAfter.toISOString().slice(0, 10));
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState('');

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  const subtotal = (residence.pricePerNight ?? 0) * nights;
  // Long-stay discount: monthly threshold beats weekly when both apply
  const discountPct = nights >= 28 && residence.monthlyDiscountPct
    ? residence.monthlyDiscountPct
    : nights >= 7 && residence.weeklyDiscountPct
      ? residence.weeklyDiscountPct
      : 0;
  const discountLabel = nights >= 28 ? `mensuel · ≥ 28 nuits` : nights >= 7 ? `hebdo · ≥ 7 nuits` : '';
  const discountAmount = Math.round(subtotal * (discountPct / 100));
  const total = subtotal - discountAmount + (residence.cleaningFee ?? 0);
  const conflict = (residence.bookedRanges ?? []).find(rg =>
    checkOut > checkIn && rangesOverlap(checkIn, checkOut, rg.from, rg.to),
  );
  const maxAllowed = (residence.maxGuests ?? 10) + (residence.allowExtraGuests ? (residence.maxExtraGuests ?? 0) : 0);
  const canSubmit = name.trim().length >= 2 && checkOut > checkIn && guests > 0 && guests <= maxAllowed && !conflict;

  const buildWaLink = () => {
    const msg = `Bonjour, je voudrais ${residence.useContactForm ? 'plus d\'info sur' : 'réserver'} *${residence.name}* :\n\n` +
      `👤 Nom : ${name}\n📅 Du : ${checkIn} au ${checkOut} (${nights} nuit${nights > 1 ? 's' : ''})\n` +
      `👥 ${guests} voyageur${guests > 1 ? 's' : ''}\n` +
      (residence.pricePerNight ? `💰 Total estimé : ${formatPrice(total, residence.currency)}\n` : '') +
      (notes ? `📝 ${notes}\n` : '') +
      `\nMerci de me confirmer la disponibilité 🙏`;
    return `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, padding: 16, background: 'rgba(10,10,40,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cream, borderRadius: 22, maxWidth: 480, width: '100%', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Réserver {residence.name}</h3>
            <p style={{ fontSize: 12, opacity: 0.9, margin: '4px 0 0' }}>{ROOM_TYPE_LABELS[residence.roomType]} · {residence.maxGuests ?? '?'} voyageurs max</p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Votre nom</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Mr Konan"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, marginTop: 5, fontFamily: 'inherit', outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Arrivée</label>
              <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, marginTop: 5, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Départ</label>
              <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
                min={checkIn}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, marginTop: 5, fontFamily: 'inherit', outline: 'none' }} />
            </div>
          </div>
          {/* Visual calendar preview: current + next month, blocked dates greyed */}
          <CalendarPreview
            blocked={residence.bookedRanges ?? []}
            checkIn={checkIn}
            checkOut={checkOut}
            accent={accent}
            accentDark={accentDark}
          />
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Voyageurs (max {maxAllowed})</label>
            <input type="number" value={String(guests)} onChange={e => setGuests(Math.min(parseInt(e.target.value) || 1, maxAllowed))} min={1} max={maxAllowed}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, marginTop: 5, fontFamily: 'inherit', outline: 'none' }} />
            {residence.childrenFreeUnder ? (
              <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 4 }}>👶 Enfants de moins de {residence.childrenFreeUnder} ans non comptés.</div>
            ) : null}
          </div>
          {residence.pricePerNight && (
            <div style={{ marginBottom: 12, padding: 12, background: C.creamDeep, borderRadius: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{nights} nuit{nights > 1 ? 's' : ''} × {formatPrice(residence.pricePerNight, residence.currency)}</span>
                <span className="mono-font">{formatPrice(subtotal, residence.currency)}</span>
              </div>
              {discountPct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#16a34a', fontWeight: 700 }}>
                  <span>🎉 Remise long séjour ({discountPct}% {discountLabel})</span>
                  <span className="mono-font">-{formatPrice(discountAmount, residence.currency)}</span>
                </div>
              )}
              {residence.cleaningFee ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: C.inkSoft }}>
                  <span>Frais ménage</span>
                  <span className="mono-font">{formatPrice(residence.cleaningFee, residence.currency)}</span>
                </div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, paddingTop: 6, borderTop: `1px solid ${C.inkLight}40` }}>
                <span>Total</span>
                <span className="mono-font">{formatPrice(total, residence.currency)}</span>
              </div>
              {residence.weeklyDiscountPct && discountPct === 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: C.inkSoft, fontStyle: 'italic' }}>
                  💡 -{residence.weeklyDiscountPct}% à partir de 7 nuits{residence.monthlyDiscountPct ? ` · -${residence.monthlyDiscountPct}% à partir de 28 nuits` : ''}
                </div>
              )}
            </div>
          )}
          {conflict && (
            <div style={{ marginBottom: 12, padding: 10, background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              ⛔ Indisponible du {conflict.from} au {conflict.to}. Choisis d'autres dates.
            </div>
          )}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' }}>Notes (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Heure d'arrivée tardive, demande spéciale…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, marginTop: 5, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          {canSubmit ? (
            <a href={buildWaLink()} target="_blank" rel="noopener noreferrer" onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 18px', borderRadius: 12, background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 14, boxShadow: '0 8px 20px -6px rgba(37,211,102,0.55)' }}>
              <MessageCircle size={16} /> Envoyer la demande WhatsApp <ArrowRight size={14} />
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

// ── CalendarPreview — 2-month inline calendar showing blocked dates ─────────
function CalendarPreview({ blocked, checkIn, checkOut, accent, accentDark }: {
  blocked: Array<{ from: string; to: string }>;
  checkIn: string;
  checkOut: string;
  accent: string;
  accentDark: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isBlocked = (iso: string) => blocked.some(rg => iso >= rg.from && iso < rg.to);
  const isInRange = (iso: string) => iso >= checkIn && iso < checkOut;

  const renderMonth = (year: number, monthIdx: number) => {
    const firstDay = new Date(year, monthIdx, 1);
    const lastDay = new Date(year, monthIdx + 1, 0);
    const startCol = (firstDay.getDay() + 6) % 7; // Monday-first
    const days: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < startCol; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, monthIdx, d);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({ iso, day: d });
    }
    const monthName = firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return (
      <div key={`${year}-${monthIdx}`}>
        <div className="display-font" style={{
          fontSize: 12, fontWeight: 800, color: C.ink, textAlign: 'center',
          marginBottom: 6, textTransform: 'capitalize',
        }}>{monthName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={i} style={{ fontSize: 9, fontWeight: 700, color: C.inkSoft, textAlign: 'center', padding: 2 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map((cell, idx) => {
            if (!cell) return <div key={idx} />;
            const dateObj = new Date(cell.iso);
            const past = dateObj < today;
            const blocked = isBlocked(cell.iso);
            const selected = isInRange(cell.iso);
            const isCheckIn = cell.iso === checkIn;
            const isCheckOut = cell.iso === checkOut;
            return (
              <div key={idx} style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, borderRadius: 6,
                position: 'relative',
                background: isCheckIn || isCheckOut ? accentDark : selected ? `${accent}40` : blocked ? '#f3d4d4' : past ? 'transparent' : '#fff',
                color: isCheckIn || isCheckOut ? '#fff' : blocked ? '#9b1c1c' : past ? C.inkLight : C.ink,
                textDecoration: blocked ? 'line-through' : past ? 'line-through' : 'none',
                opacity: past ? 0.4 : 1,
              }}>
                {cell.day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const m1 = today.getMonth();
  const m2 = (m1 + 1) % 12;
  const y2 = m1 === 11 ? today.getFullYear() + 1 : today.getFullYear();

  return (
    <div style={{
      marginBottom: 12, padding: 12, borderRadius: 10,
      background: '#fff', border: `1px solid ${C.creamDeep}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Disponibilités
        </span>
        <div style={{ display: 'flex', gap: 10, fontSize: 10, color: C.inkSoft }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f3d4d4' }} /> Réservé
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: accentDark }} /> Votre choix
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {renderMonth(today.getFullYear(), m1)}
        {renderMonth(y2, m2)}
      </div>
    </div>
  );
}
