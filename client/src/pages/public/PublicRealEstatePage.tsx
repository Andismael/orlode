/**
 * Public real-estate page — accessible sans auth.
 * URL : /biens/:slug
 *
 * Variant violet (immobilier). Différences :
 *   - Filtre Vente / Location
 *   - Cards biens avec surface, chambres, type
 *   - Bouton "Demander une visite" par bien
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Home, MessageCircle, Image as ImageIcon, Loader2, AlertCircle,
  Sparkles, Search, Bed, Bath, Maximize, MapPin, X, Calendar,
} from 'lucide-react';
import { PublicTagline, PublicSocials, PublicContactBar } from '@/components/public/PublicBranding';
import { PublicLangSwitcher } from '@/components/public/PublicLangSwitcher';
import PerCompanyPWAHead from '@/components/common/PerCompanyPWAHead';

const C = {
  purple:      '#7C3AED',
  purpleDeep:  '#5B21B6',
  purpleSoft:  '#EDE9FE',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  red:         '#EF4444',
  emerald:     '#10B981',
  blue:        '#0EA5E9',
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

interface Property {
  id: string;
  name: string;
  price: number;
  currency: string;
  description?: string;
  imageUrl?: string | null;
  surfaceM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  listingType?: 'sale' | 'rent';
  address?: string;
}
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

const NO_DECIMAL = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']);
function formatPrice(n: number, currency: string): string {
  const decimals = NO_DECIMAL.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
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

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement', house: 'Maison', villa: 'Villa',
  studio: 'Studio', office: 'Bureau', land: 'Terrain', other: 'Autre',
};

export default function PublicRealEstatePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ store: Store; properties: Property[]; whatsappBusinessNumber: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'sale' | 'rent'>('all');
  const [bookingProp, setBookingProp] = useState<Property | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true); setError(null);
    fetch(`/api/public/shop/${slug}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`);
        return r.json() as Promise<{ store: Store; products: Property[]; whatsappBusinessNumber: string | null }>;
      })
      .then(d => setData({ store: d.store, properties: d.products, whatsappBusinessNumber: d.whatsappBusinessNumber }))
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [slug]);

  const accent = data?.store.accentColor || C.purple;
  const accentDark = data?.store.accentColor ? darken(data.store.accentColor) : C.purpleDeep;

  const filtered = (data?.properties ?? []).filter(p => {
    if (filter !== 'all' && p.listingType !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.address ?? '').toLowerCase().includes(q);
  });

  return (
    <div style={{ background: '#1a0f2e', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{STYLES}</style>

      {data?.store && (
        <PerCompanyPWAHead
          companyId={data.store.id}
          companyName={data.store.name}
          logoUrl={data.store.logoUrl ?? undefined}
          primaryColor={data.store.accentColor ?? undefined}
        />
      )}

      <div className="grain" style={{
        background: data?.store.coverImageUrl
          ? `linear-gradient(135deg, rgba(91,33,182,0.85), rgba(76,29,149,0.85)), url(${data.store.coverImageUrl})`
          : `linear-gradient(135deg, ${accent}, ${accentDark} 60%, #1a0f2e)`,
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
            {data?.store.logoUrl && (
              <img src={data.store.logoUrl} alt={data.store.name} style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', background: 'rgba(255,250,240,0.92)', boxShadow: '0 12px 28px -8px rgba(0,0,0,0.4)' }} />
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <Home size={11} /> AGENCE IMMOBILIÈRE
            </div>
          </div>
          <h1 className="display-font" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: 0, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            {loading ? 'Chargement…' : (data?.store.name ?? 'Agence')}
          </h1>
          {data && (data.store.tagline || data.store.shortDescription) && (
            <PublicTagline store={data.store as any} color={C.purple} dark />
          )}
          {data && (
            <p style={{ marginTop: 12, fontSize: 14, opacity: 0.9, maxWidth: 560 }}>
              {data.properties.length} bien{data.properties.length > 1 ? 's' : ''} dans le portefeuille ·
              Demande de visite directe sur WhatsApp
            </p>
          )}
          {data && (
            <div style={{ marginTop: 14 }}>
              <PublicSocials store={data.store as any} color={C.purple} compact />
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

      {data && data.properties.length > 0 && (
        <div style={{ maxWidth: 1080, margin: '-28px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          <div style={{ background: C.cream, borderRadius: 16, padding: '12px 16px', boxShadow: '0 16px 40px -16px rgba(10,42,32,0.3)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Search size={18} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, quartier…"
              style={{ flex: 1, minWidth: 200, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: C.ink, fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 4, background: C.creamDeep, padding: 3, borderRadius: 10 }}>
              {([['all', 'Tout'], ['sale', 'Vente'], ['rent', 'Location']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setFilter(id)}
                  style={{
                    padding: '6px 14px', borderRadius: 7,
                    background: filter === id ? accentDark : 'transparent',
                    color: filter === id ? '#fff' : C.inkSoft,
                    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                  }}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 24px 64px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.cream }}>
            <Loader2 size={28} className="spin" color={accent} />
            <div style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.8)' }}>Chargement du portefeuille…</div>
          </div>
        )}
        {error && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 24, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
            <AlertCircle size={32} color={C.red} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Agence indisponible</div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>{error}</div>
          </div>
        )}
        {data && data.properties.length === 0 && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
            <Home size={36} color={accentDark} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Pas encore de biens</div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>Reviens bientôt — l'agence ajoute son portefeuille.</div>
          </div>
        )}

        {data && filtered.length > 0 && (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(p => (
              <PropertyCard key={p.id} property={p} accent={accent} accentDark={accentDark}
                whatsappAvailable={!!data.whatsappBusinessNumber}
                onBook={() => setBookingProp(p)} />
            ))}
          </div>
        )}

        {data && data.properties.length > 0 && filtered.length === 0 && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 24, textAlign: 'center', maxWidth: 420, margin: '40px auto' }}>
            <Search size={28} color={C.inkSoft} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, color: C.inkSoft }}>Aucun résultat avec ces filtres.</div>
          </div>
        )}

        {data && data.properties.length > 0 && (
          <div style={{ marginTop: 48, padding: 20, borderRadius: 16, background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.10)', textAlign: 'center', color: 'rgba(255,250,240,0.82)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              <Sparkles size={11} /> Powered by Orlode AI
            </div>
            <div style={{ fontSize: 12 }}>Agence IA · Visite WhatsApp · Réponse rapide</div>
          </div>
        )}
      </div>

      {bookingProp && data?.whatsappBusinessNumber && (
        <BookingModal property={bookingProp} accent={accent} accentDark={accentDark}
          waNumber={data.whatsappBusinessNumber} storeName={data.store.name}
          onClose={() => setBookingProp(null)} />
      )}
      {data && <PublicContactBar store={data.store as any} color={accent} primaryCta={{ label: 'Demander visite', href: '#biens' }} />}
      <PublicLangSwitcher dark />
    </div>
  );
}

function PropertyCard({ property, accent, accentDark, onBook, whatsappAvailable }: {
  property: Property; accent: string; accentDark: string;
  onBook: () => void; whatsappAvailable: boolean;
}) {
  return (
    <article className="card-hover" style={{
      background: C.cream, borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 6px 20px -8px rgba(10,42,32,0.18)',
    }}>
      <div style={{
        position: 'relative', aspectRatio: '16 / 10',
        background: property.imageUrl ? '#000' : `linear-gradient(135deg, ${accent}, ${accentDark})`,
      }}>
        {property.imageUrl ? (
          <img src={property.imageUrl} alt={property.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream }}>
            <Home size={42} />
          </div>
        )}
        {property.listingType && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: property.listingType === 'sale' ? C.emerald : C.blue,
            color: '#fff', padding: '4px 10px', borderRadius: 100,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            {property.listingType === 'sale' ? '🔑 Vente' : '🗝 Location'}
          </div>
        )}
      </div>
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 4px', lineHeight: 1.25, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {property.name}
        </h3>
        {property.address && (
          <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} /> {property.address}
          </div>
        )}
        <div className="mono-font" style={{ fontSize: 17, fontWeight: 700, color: accentDark, marginBottom: 10 }}>
          {formatPrice(property.price, property.currency)}
          {property.listingType === 'rent' && <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}> / mois</span>}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.inkSoft, flexWrap: 'wrap', marginBottom: 12 }}>
          {property.surfaceM2 != null && property.surfaceM2 > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Maximize size={11} /> {property.surfaceM2} m²
            </span>
          )}
          {property.bedrooms != null && property.bedrooms > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Bed size={11} /> {property.bedrooms}
            </span>
          )}
          {property.bathrooms != null && property.bathrooms > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Bath size={11} /> {property.bathrooms}
            </span>
          )}
          {property.propertyType && TYPE_LABELS[property.propertyType] && (
            <span style={{ background: C.creamDeep, padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 600 }}>
              {TYPE_LABELS[property.propertyType]}
            </span>
          )}
        </div>
        <div style={{ marginTop: 'auto' }}>
          {whatsappAvailable ? (
            <button onClick={onBook} style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: accentDark, color: '#fff',
              border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: `0 6px 14px -4px ${accent}80`,
            }}>
              <Calendar size={14} /> Demander une visite
            </button>
          ) : (
            <button disabled style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: C.creamDeep, color: C.inkLight, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'not-allowed' }}>
              Bientôt disponible
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function BookingModal({ property, accent, accentDark, waNumber, storeName, onClose }: {
  property: Property; accent: string; accentDark: string;
  waNumber: string; storeName: string; onClose: () => void;
}) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState('15:00');
  const [notes, setNotes] = useState('');

  const canSubmit = name.trim().length >= 2 && phone.length >= 6 && date && time;

  const buildWa = () => {
    const msg = `Bonjour, je voudrais visiter un bien chez *${storeName}* :\n\n` +
      `🏠 Bien : ${property.name}${property.address ? ` (${property.address})` : ''}\n` +
      `💰 ${formatPrice(property.price, property.currency)}${property.listingType === 'rent' ? '/mois' : ''}\n` +
      `👤 Nom : ${name}\n📞 ${phone}\n📅 Visite souhaitée : ${date} à ${time}\n` +
      (notes.trim() ? `📝 ${notes}\n` : '') +
      `\nMerci de me confirmer la disponibilité 🙏`;
    return `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, padding: 16, background: 'rgba(26,15,46,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cream, borderRadius: 22, maxWidth: 520, width: '100%', boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Demander une visite</h3>
            <p style={{ fontSize: 12, opacity: 0.9, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {property.name}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><Label>Nom</Label><Input value={name} onChange={setName} placeholder="Mr Konan" /></div>
            <div><Label>Téléphone</Label><Input value={phone} onChange={setPhone} placeholder="+225 07..." /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><Label>Date visite</Label><Input type="date" value={date} onChange={setDate} /></div>
            <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <Label>Notes (optionnel)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Budget, contraintes, questions…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          {canSubmit ? (
            <a href={buildWa()} target="_blank" rel="noopener noreferrer" onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 18px', borderRadius: 12, background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 8px 20px -6px rgba(37,211,102,0.55)' }}>
              <MessageCircle size={16} /> Envoyer la demande sur WhatsApp
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
