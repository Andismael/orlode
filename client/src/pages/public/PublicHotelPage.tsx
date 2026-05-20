/**
 * Public hotel page — accessible sans auth.
 * URL : /hotel/:slug
 *
 * Affiche les chambres avec leurs caractéristiques (type, capacité, prix/nuit,
 * équipements). Bouton "Demander un séjour" → WhatsApp pré-rempli avec dates.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BedDouble, MessageCircle, Image as ImageIcon, Loader2, AlertCircle,
  Sparkles, Search, Calendar, Users, Maximize, MapPin, X, ArrowRight,
} from 'lucide-react';
import { PublicTagline, PublicSocials, PublicContactBar } from '@/components/public/PublicBranding';
import { PublicLangSwitcher } from '@/components/public/PublicLangSwitcher';

const C = {
  blue:        '#0EA5E9',
  blueDeep:    '#0369A1',
  blueSoft:    '#E0F2FE',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  red:         '#EF4444',
  emerald:     '#10B981',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font    { font-family: 'JetBrains Mono', monospace; }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  .spin { animation: spin .9s linear infinite; }
  @keyframes slideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  .stagger > * { animation: slideIn .35s ease-out backwards; }
  .stagger > *:nth-child(1){animation-delay:.04s}.stagger > *:nth-child(2){animation-delay:.08s}
  .stagger > *:nth-child(3){animation-delay:.12s}.stagger > *:nth-child(4){animation-delay:.16s}
  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }
  .card-hover { transition: transform .2s ease, box-shadow .2s ease; }
  .card-hover:hover { transform: translateY(-4px); box-shadow: 0 18px 40px -16px rgba(10,42,32,.3); }
`;

interface Room {
  id: string;
  number: string;
  type: 'single' | 'double' | 'twin' | 'triple' | 'suite' | 'family';
  capacity: number;
  pricePerNight: number;
  currency: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  amenities?: string[];
  bookedRanges?: Array<{ from: string; to: string }>;
}

/** Two date ranges overlap iff a.from < b.to && a.to > b.from */
function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom < bTo && aTo > bFrom;
}
interface Store {
  id: string;
  name: string;
  currency: string;
  country: string;
  paymentInstructions?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  accentColor?: string | null;
  openingHours?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const NO_DECIMAL = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']);
function formatPrice(n: number, currency: string): string {
  const decimals = NO_DECIMAL.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency,
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(n);
  } catch { return `${n.toLocaleString('fr-FR')} ${currency}`; }
}
function darken(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 40);
  const g = Math.max(0, ((n >> 8) & 0xff) - 40);
  const b = Math.max(0, (n & 0xff) - 40);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

const ROOM_TYPE_LABELS: Record<Room['type'], string> = {
  single: 'Single', double: 'Double', twin: 'Twin',
  triple: 'Triple', suite: 'Suite', family: 'Familiale',
};

export default function PublicHotelPage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [whatsappBusinessNumber, setWhatsApp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true); setError(null);
    fetch(`/api/public/hotel/${slug}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`);
        return r.json() as Promise<{ store: Store; rooms: Room[]; whatsappBusinessNumber: string | null }>;
      })
      .then(d => {
        setStore(d.store);
        setRooms(d.rooms);
        setWhatsApp(d.whatsappBusinessNumber);
      })
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [slug]);

  const accent = store?.accentColor || C.blue;
  const accentDark = store?.accentColor ? darken(store.accentColor) : C.blueDeep;

  const filtered = rooms.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.number.toLowerCase().includes(q) || ROOM_TYPE_LABELS[r.type].toLowerCase().includes(q);
  });

  const availableRooms = filtered.filter(r => r.status === 'available');
  const otherRooms = filtered.filter(r => r.status !== 'available');

  return (
    <div style={{ background: '#0A1628', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{STYLES}</style>

      {/* Hero */}
      <div className="grain" style={{
        background: store?.coverImageUrl
          ? `linear-gradient(135deg, rgba(3,105,161,0.85), rgba(7,89,133,0.85)), url(${store.coverImageUrl})`
          : `linear-gradient(135deg, ${accent}, ${accentDark} 60%, #0A1628)`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        padding: '48px 24px 56px', position: 'relative', overflow: 'hidden', color: C.cream,
      }}>
        <svg style={{ position: 'absolute', right: -60, top: -60, opacity: 0.16 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60"  stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>
        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            {store?.logoUrl && (
              <img src={store.logoUrl} alt={store.name} style={{
                width: 72, height: 72, borderRadius: 18, objectFit: 'cover',
                background: 'rgba(255,250,240,0.92)',
                boxShadow: '0 12px 28px -8px rgba(0,0,0,0.4)',
              }} />
            )}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 100,
              background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <BedDouble size={11} /> RÉSERVATION HÔTEL
            </div>
          </div>
          <h1 className="display-font" style={{
            fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: 0,
            lineHeight: 1.05, letterSpacing: '-0.03em',
          }}>
            {loading ? 'Chargement…' : (store?.name ?? 'Hôtel')}
          </h1>
          {store && (store.tagline || store.shortDescription) && (
            <PublicTagline store={store as any} color={C.blue} dark />
          )}
          {store && (
            <p style={{ marginTop: 12, fontSize: 14, opacity: 0.9, maxWidth: 560 }}>
              {availableRooms.length} chambre{availableRooms.length > 1 ? 's' : ''} disponible{availableRooms.length > 1 ? 's' : ''} ·
              Réservation directe sur WhatsApp · {store.paymentInstructions ? 'Paiement à l\'arrivée' : 'Paiement sur place'}
            </p>
          )}
          {store && (
            <div style={{ marginTop: 14 }}>
              <PublicSocials store={store as any} color={C.blue} compact />
            </div>
          )}
          {store && (store.openingHours || store.address) && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {store.openingHours && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  <span>🕐</span><span>{store.openingHours}</span>
                </div>
              )}
              {store.address && (() => {
                const mapsHref = store.googleMapsUrl
                  ?? (typeof store.latitude === 'number' && typeof store.longitude === 'number'
                    ? `https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`);
                return (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    fontSize: 13, fontWeight: 600, color: 'inherit', textDecoration: 'none',
                  }}>
                    <MapPin size={13} />
                    <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.address}</span>
                    <span style={{ opacity: 0.65, fontSize: 11 }}>→ Maps</span>
                  </a>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      {rooms.length > 0 && (
        <div style={{ maxWidth: 1080, margin: '-28px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          <div style={{
            background: C.cream, borderRadius: 16, padding: '12px 16px',
            boxShadow: '0 16px 40px -16px rgba(10,42,32,0.3)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Search size={18} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par numéro ou type de chambre…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: C.ink, fontFamily: 'inherit' }} />
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 24px 64px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.cream }}>
            <Loader2 size={28} className="spin" color={accent} />
            <div style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.8)' }}>Chargement des chambres…</div>
          </div>
        )}
        {error && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 24, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
            <AlertCircle size={32} color={C.red} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Hôtel indisponible</div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>{error}</div>
          </div>
        )}
        {store && rooms.length === 0 && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
            <BedDouble size={36} color={accentDark} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Pas encore de chambres</div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>Reviens bientôt — l'hôtel finalise sa configuration.</div>
          </div>
        )}

        {availableRooms.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <h2 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
              Chambres disponibles
            </h2>
            <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {availableRooms.map(r => (
                <RoomCard key={r.id} room={r} accent={accent} accentDark={accentDark}
                  onBook={() => setBookingRoom(r)} whatsappAvailable={!!whatsappBusinessNumber} />
              ))}
            </div>
          </section>
        )}

        {otherRooms.length > 0 && (
          <section style={{ marginBottom: 36, opacity: 0.6 }}>
            <h2 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.cream, margin: '0 0 14px' }}>
              Non disponibles
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {otherRooms.map(r => (
                <RoomCard key={r.id} room={r} accent={accent} accentDark={accentDark}
                  onBook={() => setBookingRoom(r)} whatsappAvailable={false} />
              ))}
            </div>
          </section>
        )}

        {rooms.length > 0 && (
          <div style={{
            marginTop: 48, padding: 20, borderRadius: 16,
            background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.10)',
            textAlign: 'center', color: 'rgba(255,250,240,0.82)',
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              <Sparkles size={11} /> Powered by Orlode AI
            </div>
            <div style={{ fontSize: 12 }}>Hôtel IA · Réservation WhatsApp · Confirmation rapide</div>
          </div>
        )}
      </div>

      {bookingRoom && whatsappBusinessNumber && store && (
        <BookingModal room={bookingRoom} accent={accent} accentDark={accentDark}
          waNumber={whatsappBusinessNumber} storeName={store.name}
          onClose={() => setBookingRoom(null)} />
      )}
      {store && <PublicContactBar store={store as any} color={accent} primaryCta={{ label: 'Réserver', href: '#rooms' }} />}
      <PublicLangSwitcher dark />
    </div>
  );
}

function RoomCard({ room, accent, accentDark, onBook, whatsappAvailable }: {
  room: Room; accent: string; accentDark: string; onBook: () => void; whatsappAvailable: boolean;
}) {
  return (
    <article className="card-hover" style={{
      background: C.cream, borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 6px 20px -8px rgba(10,42,32,0.18)',
    }}>
      <div style={{
        position: 'relative', aspectRatio: '16 / 10',
        background: room.imageUrl ? '#000' : `linear-gradient(135deg, ${accent}, ${accentDark})`,
      }}>
        {room.imageUrl ? (
          <img src={room.imageUrl} alt={`Chambre ${room.number}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream }}>
            <BedDouble size={42} />
          </div>
        )}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: room.status === 'available' ? C.emerald : '#0A2A20',
          color: '#fff', padding: '4px 10px', borderRadius: 100,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {room.status === 'available' ? '✓ Disponible' :
           room.status === 'occupied' ? 'Occupée' :
           room.status === 'cleaning' ? 'Ménage' : 'Maintenance'}
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1.1, marginBottom: 4 }}>
          Chambre {room.number}
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
          {ROOM_TYPE_LABELS[room.type]} · {room.capacity} pers max
        </div>
        <div className="mono-font" style={{ fontSize: 17, fontWeight: 700, color: accentDark, marginBottom: 10 }}>
          {formatPrice(room.pricePerNight, room.currency)}<span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}> / nuit</span>
        </div>
        {room.amenities && room.amenities.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
            {room.amenities.slice(0, 5).map(a => (
              <span key={a} style={{ fontSize: 10, color: C.inkSoft, background: C.creamDeep, padding: '3px 7px', borderRadius: 6, fontWeight: 600 }}>{a}</span>
            ))}
          </div>
        )}
        {whatsappAvailable && room.status === 'available' ? (
          <button onClick={onBook} style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: accentDark, color: '#fff',
            border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: `0 6px 14px -4px ${accent}80`,
          }}>
            <MessageCircle size={14} /> Réserver
          </button>
        ) : (
          <button disabled style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: C.creamDeep, color: C.inkLight,
            border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            cursor: 'not-allowed',
          }}>
            Non disponible
          </button>
        )}
      </div>
    </article>
  );
}

function BookingModal({ room, accent, accentDark, waNumber, storeName, onClose }: {
  room: Room; accent: string; accentDark: string;
  waNumber: string; storeName: string; onClose: () => void;
}) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const [name, setName] = useState('');
  const [checkIn, setCheckIn] = useState(tomorrow.toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState('');

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  const total = room.pricePerNight * nights;

  // Anti-overbooking: check the picked range against the existing reservations
  // delivered by the public endpoint. If overlap, block the WhatsApp link and
  // show a clear "déjà réservée" warning.
  const conflictRange = (room.bookedRanges ?? []).find(r =>
    checkOut > checkIn && rangesOverlap(checkIn, checkOut, r.from, r.to),
  );
  const datesAvailable = !conflictRange;

  const canSubmit = name.trim().length >= 2 && checkIn && checkOut > checkIn && guests > 0 && guests <= room.capacity && datesAvailable;

  const buildWaLink = () => {
    const msg = `Bonjour, je voudrais réserver une chambre à *${storeName}* :\n\n` +
      `🛏 Chambre : ${room.number} (${ROOM_TYPE_LABELS[room.type]})\n` +
      `👤 Nom : ${name}\n📅 Du : ${checkIn} au ${checkOut} (${nights} nuit${nights > 1 ? 's' : ''})\n` +
      `👥 ${guests} personne${guests > 1 ? 's' : ''}\n` +
      `💰 Total estimé : ${formatPrice(total, room.currency)}\n` +
      (notes ? `📝 ${notes}\n` : '') +
      `\nMerci de me confirmer la disponibilité 🙏`;
    return `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, padding: 16,
      background: 'rgba(10,22,40,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22, maxWidth: 520, width: '100%',
        boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)',
        overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Réserver chambre {room.number}</h3>
            <p style={{ fontSize: 12, opacity: 0.9, margin: '4px 0 0' }}>{ROOM_TYPE_LABELS[room.type]} · {room.capacity} pers max · {formatPrice(room.pricePerNight, room.currency)}/nuit</p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <Label>Votre nom</Label>
            <Input value={name} onChange={setName} placeholder="Mr Konan" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><Label>Arrivée</Label><Input type="date" value={checkIn} onChange={setCheckIn} /></div>
            <div><Label>Départ</Label><Input type="date" value={checkOut} onChange={setCheckOut} /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Personnes (max {room.capacity})</Label>
            <Input type="number" value={String(guests)} onChange={v => setGuests(Math.min(parseInt(v) || 1, room.capacity))} />
          </div>
          <div style={{ marginBottom: 12, padding: 12, background: C.blueSoft, borderRadius: 10, fontSize: 13, color: accentDark, display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>{nights}</strong> nuit{nights > 1 ? 's' : ''}</span>
            <span className="mono-font" style={{ fontWeight: 800 }}>{formatPrice(total, room.currency)}</span>
          </div>
          {conflictRange && (
            <div style={{
              marginBottom: 12, padding: '10px 12px', borderRadius: 10,
              background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B',
              fontSize: 12, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span>⛔</span>
              <span>Cette chambre est déjà réservée du <strong>{conflictRange.from}</strong> au <strong>{conflictRange.to}</strong>. Choisis d'autres dates ou une autre chambre.</span>
            </div>
          )}
          {!conflictRange && (room.bookedRanges?.length ?? 0) > 0 && (
            <div style={{
              marginBottom: 12, padding: '8px 12px', borderRadius: 10,
              background: C.creamDeep, color: C.inkSoft, fontSize: 11,
            }}>
              📅 Indisponibilités : {(room.bookedRanges ?? []).slice(0, 3).map(r => `${r.from}→${r.to}`).join(' · ')}
              {(room.bookedRanges?.length ?? 0) > 3 && ` (+${(room.bookedRanges!.length) - 3})`}
            </div>
          )}
          <div style={{ marginBottom: 18 }}>
            <Label>Notes (optionnel)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Heure d'arrivée tardive, demande spéciale…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          {canSubmit ? (
            <a href={buildWaLink()} target="_blank" rel="noopener noreferrer" onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 18px', borderRadius: 12, background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 8px 20px -6px rgba(37,211,102,0.55)' }}>
              <MessageCircle size={16} /> Envoyer la demande sur WhatsApp <ArrowRight size={14} />
            </a>
          ) : (
            <button disabled style={{ width: '100%', padding: '14px 18px', borderRadius: 12, background: C.creamDeep, color: C.inkLight, border: 'none', fontWeight: 700, cursor: 'not-allowed' }}>
              Remplis les champs (max {room.capacity} pers)
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
