/**
 * Public salon page — accessible sans auth.
 * URL : /salon/:slug
 *
 * Variant rose (coiffure / beauté) du PublicShopPage. Différences :
 *   - Header "RDV" au lieu de "BOUTIQUE"
 *   - Cards services affichent durée + prix
 *   - Bouton "Prendre RDV" par service (pas de panier — réservation immédiate)
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Scissors, MessageCircle, Image as ImageIcon, Loader2, AlertCircle,
  Sparkles, Search, Clock, X, Calendar,
} from 'lucide-react';
import { PublicTagline, PublicSocials, PublicContactBar } from '@/components/public/PublicBranding';
import { PublicLangSwitcher } from '@/components/public/PublicLangSwitcher';
import PerCompanyPWAHead from '@/components/common/PerCompanyPWAHead';

const C = {
  pink:        '#EC4899',
  pinkDeep:    '#DB2777',
  pinkSoft:    '#FCE7F3',
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

interface Service {
  id: string;
  name: string;
  price: number;
  currency: string;
  description?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  category?: string | null;
  durationMinutes?: number;
  featured?: boolean;
}
interface Practitioner {
  id: string;
  name: string;
  role?: string;
  photoUrl?: string;
  workingHours?: string;
}
interface Store {
  id: string;
  companyId?: string;
  name: string; currency: string; country: string;
  paymentInstructions?: string;
  logoUrl?: string | null; coverImageUrl?: string | null; accentColor?: string | null;
  salonType?: 'coiffure' | 'esthetique' | 'spa' | 'barber' | null;
  openingHours?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  practitioners?: Practitioner[];
}

const NO_DECIMAL = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']);
function formatPrice(n: number, currency: string): string {
  const decimals = NO_DECIMAL.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  } catch { return `${n.toLocaleString('fr-FR')} ${currency}`; }
}
function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
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

export default function PublicSalonPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{ store: Store; services: Service[]; whatsappBusinessNumber: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [previewService, setPreviewService] = useState<Service | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true); setError(null);
    fetch(`/api/public/shop/${slug}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`);
        return r.json() as Promise<{ store: Store; products: Service[]; whatsappBusinessNumber: string | null }>;
      })
      .then(d => setData({ store: d.store, services: d.products, whatsappBusinessNumber: d.whatsappBusinessNumber }))
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [slug]);

  const accent = data?.store.accentColor || C.pink;
  const accentDark = data?.store.accentColor ? darken(data.store.accentColor) : C.pinkDeep;

  const filtered = data?.services.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.category ?? '').toLowerCase().includes(q);
  }) ?? [];
  // Featured services pinned at the top under their own header
  const featuredItems = filtered.filter(s => s.featured);
  const nonFeatured = filtered.filter(s => !s.featured);
  const byCategory: Record<string, Service[]> = {};
  if (featuredItems.length > 0) byCategory['⭐ Services phares'] = featuredItems;
  for (const s of nonFeatured) {
    const cat = s.category ?? 'Tous nos services';
    (byCategory[cat] ||= []).push(s);
  }

  return (
    <div style={{ background: '#1a0824', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{STYLES}</style>

      {data?.store && (
        <PerCompanyPWAHead
          companyId={data.store.companyId || data.store.id}
          companyName={data.store.name}
          logoUrl={data.store.logoUrl ?? undefined}
          primaryColor={data.store.accentColor ?? undefined}
        />
      )}

      <div className="grain" style={{
        background: data?.store.coverImageUrl
          ? `linear-gradient(135deg, rgba(219,39,119,0.85), rgba(157,23,77,0.85)), url(${data.store.coverImageUrl})`
          : `linear-gradient(135deg, ${accent}, ${accentDark} 60%, #1a0824)`,
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
              <Scissors size={11} /> SALON · RDV
            </div>
          </div>
          <h1 className="display-font" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: 0, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            {loading ? 'Chargement…' : (data?.store.name ?? 'Salon')}
          </h1>
          {data && (data.store.tagline || data.store.shortDescription) && (
            <PublicTagline store={data.store as any} color={C.pink} dark />
          )}
          {data && (
            <p style={{ marginTop: 12, fontSize: 14, opacity: 0.9, maxWidth: 560 }}>
              {data.services.length} service{data.services.length > 1 ? 's' : ''} disponible{data.services.length > 1 ? 's' : ''} ·
              Prends RDV directement sur WhatsApp · Confirmation rapide
            </p>
          )}
          {data && (
            <div style={{ marginTop: 14 }}>
              <PublicSocials store={data.store as any} color={C.pink} compact />
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

      {data && data.services.length > 0 && (
        <div style={{ maxWidth: 1080, margin: '-28px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          <div style={{ background: C.cream, borderRadius: 16, padding: '12px 16px', boxShadow: '0 16px 40px -16px rgba(10,42,32,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={18} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un service…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: C.ink, fontFamily: 'inherit' }} />
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 24px 64px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.cream }}>
            <Loader2 size={28} className="spin" color={accent} />
            <div style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.8)' }}>Chargement des services…</div>
          </div>
        )}
        {error && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 24, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
            <AlertCircle size={32} color={C.red} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Salon indisponible</div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>{error}</div>
          </div>
        )}
        {data && data.services.length === 0 && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
            <Scissors size={36} color={accentDark} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Pas encore de services</div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>Reviens bientôt — le salon prépare son catalogue.</div>
          </div>
        )}

        {data && filtered.length > 0 && Object.entries(byCategory).map(([category, services]) => (
          <section key={category} style={{ marginBottom: 36 }}>
            {Object.keys(byCategory).length > 1 && (
              <h2 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
                {category}
              </h2>
            )}
            <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {services.map(s => {
                const previewable = data.store.salonType === 'esthetique'
                  || data.store.salonType === 'coiffure'
                  || data.store.salonType === 'barber';
                return (
                  <ServiceCard key={s.id} service={s} accent={accent} accentDark={accentDark}
                    whatsappAvailable={!!data.whatsappBusinessNumber}
                    onBook={() => setBookingService(s)}
                    onPreview={previewable ? () => setPreviewService(s) : undefined} />
                );
              })}
            </div>
          </section>
        ))}

        {data && data.services.length > 0 && (
          <div style={{ marginTop: 48, padding: 20, borderRadius: 16, background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.10)', textAlign: 'center', color: 'rgba(255,250,240,0.82)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              <Sparkles size={11} /> Powered by Orlode AI
            </div>
            <div style={{ fontSize: 12 }}>Salon IA · RDV WhatsApp · Confirmation instantanée</div>
          </div>
        )}
      </div>

      {bookingService && data?.whatsappBusinessNumber && (
        <BookingModal service={bookingService} accent={accent} accentDark={accentDark}
          waNumber={data.whatsappBusinessNumber} storeName={data.store.name}
          practitioners={data.store.practitioners ?? []}
          onClose={() => setBookingService(null)} />
      )}
      {previewService && data?.store && data.store.companyId && (
        <FacePreviewModal
          service={previewService}
          companyId={data.store.companyId}
          storeId={data.store.id}
          accent={accent} accentDark={accentDark}
          onClose={() => setPreviewService(null)} />
      )}
      {data && <PublicContactBar store={data.store as any} color={accent} primaryCta={{ label: 'Prendre RDV', href: '#services' }} />}
      <PublicLangSwitcher dark />
    </div>
  );
}

function FacePreviewModal({ service, companyId, storeId, accent, accentDark, onClose }: {
  service: Service; companyId: string; storeId: string;
  accent: string; accentDark: string; onClose: () => void;
}) {
  const [selfie, setSelfie] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('Image trop lourde (max 4 Mo).'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      if (!m) { setError('Image invalide.'); return; }
      setSelfie({ base64: m[2] ?? '', mime: m[1] ?? 'image/jpeg', preview: dataUrl });
      setResultUrl(null); setError(null);
    };
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!selfie) return;
    setGenerating(true); setError(null);
    try {
      const r = await fetch('/api/public/face-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId, storeId, productId: service.id,
          imageBase64: selfie.base64, imageMimeType: selfie.mime,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message ?? `Erreur ${r.status}`);
      setResultUrl(data?.url ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Génération impossible. Réessaie plus tard.');
    } finally { setGenerating(false); }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, padding: 16,
      background: 'rgba(10,10,40,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22, maxWidth: 480, width: '100%',
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)',
        overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', padding: '20px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 4 }}>
            ✨ Aperçu IA
          </div>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{service.name}</h3>
        </div>
        <div style={{ padding: 24 }}>
          {!resultUrl && (
            <>
              <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
                Envoie un selfie clair et bien éclairé, l'IA te génère un aperçu de ton visage avec ce service appliqué.
                <br /><span style={{ fontSize: 11, opacity: 0.7 }}>⚠ Aperçu indicatif — peut différer en réel.</span>
              </div>
              {!selfie ? (
                <label style={{
                  display: 'block', padding: '32px 16px', borderRadius: 12,
                  border: `2px dashed ${accent}50`, textAlign: 'center', cursor: 'pointer',
                  background: '#fff',
                }}>
                  <input type="file" accept="image/*" capture="user" onChange={handleFile} style={{ display: 'none' }} />
                  <div style={{ fontSize: 38 }}>📸</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: accentDark, marginTop: 8 }}>Choisir une photo</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>Selfie portrait, max 4 Mo</div>
                </label>
              ) : (
                <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, aspectRatio: '1' }}>
                  <img src={selfie.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              {error && (
                <div style={{ padding: 10, background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: 12, marginTop: 10 }}>
                  {error}
                </div>
              )}
              {selfie && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setSelfie(null)} className="btn-ghost"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'transparent', color: C.inkSoft, border: `1.5px solid ${C.creamDeep}`, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Changer
                  </button>
                  <button onClick={generate} disabled={generating}
                    style={{ flex: 2, padding: '10px 14px', borderRadius: 10, background: accentDark, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: generating ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {generating ? <><Loader2 size={14} className="spin" /> Génération… (~15s)</> : <>✨ Générer l'aperçu</>}
                  </button>
                </div>
              )}
            </>
          )}
          {resultUrl && (
            <>
              <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, aspectRatio: '1', background: '#000' }}>
                <img src={resultUrl} alt="Aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 14, fontStyle: 'italic' }}>
                ⚠ Aperçu IA indicatif. Le résultat réel peut varier selon la praticienne et tes caractéristiques.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setResultUrl(null); setSelfie(null); }} className="btn-ghost"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'transparent', color: C.inkSoft, border: `1.5px solid ${C.creamDeep}`, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Recommencer
                </button>
                <button onClick={onClose}
                  style={{ flex: 2, padding: '10px 14px', borderRadius: 10, background: accentDark, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service, accent, accentDark, onBook, onPreview, whatsappAvailable }: {
  service: Service; accent: string; accentDark: string;
  onBook: () => void; onPreview?: () => void; whatsappAvailable: boolean;
}) {
  return (
    <article className="card-hover" style={{
      background: C.cream, borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: service.featured
        ? `0 8px 28px -8px ${accent}90, 0 0 0 2px ${accent}50`
        : '0 6px 20px -8px rgba(10,42,32,0.18)',
    }}>
      <div style={{
        position: 'relative', aspectRatio: '16 / 10',
        background: service.imageUrl ? '#000' : `linear-gradient(135deg, ${accent}, ${accentDark})`,
      }}>
        {service.imageUrl ? (
          <img src={service.imageUrl} alt={service.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.cream }}>
            <Scissors size={36} />
          </div>
        )}
        {service.featured && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff',
            padding: '4px 10px', borderRadius: 100,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.3)',
          }}>⭐ Phare</div>
        )}
        {service.durationMinutes && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(255,250,240,0.92)', color: accentDark,
            padding: '4px 10px', borderRadius: 100,
            fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Clock size={10} /> {formatDuration(service.durationMinutes)}
          </div>
        )}
      </div>
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 6px', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
          {service.name}
        </h3>
        {service.description && (
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 10px', lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {service.description}
          </p>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <div className="mono-font" style={{ fontSize: 17, fontWeight: 700, color: accentDark, marginBottom: 10 }}>
            {formatPrice(service.price, service.currency)}
          </div>
          {whatsappAvailable ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={onBook} style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: accentDark, color: '#fff',
                border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: `0 6px 14px -4px ${accent}80`,
              }}>
                <Calendar size={14} /> Prendre RDV
              </button>
              {onPreview && (
                <button onClick={onPreview} style={{
                  width: '100%', padding: '8px 12px', borderRadius: 10,
                  background: 'transparent', color: accentDark,
                  border: `1.5px solid ${accent}50`,
                  fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  ✨ Aperçu IA sur mon visage
                </button>
              )}
            </div>
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

function BookingModal({ service, accent, accentDark, waNumber, storeName, practitioners, onClose }: {
  service: Service; accent: string; accentDark: string;
  waNumber: string; storeName: string;
  practitioners: Practitioner[];
  onClose: () => void;
}) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const [name, setName] = useState('');
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [practitioner, setPractitioner] = useState('');
  const [notes, setNotes] = useState('');
  const hasStaff = practitioners.length > 0;

  const canSubmit = name.trim().length >= 2 && date && time;

  const buildWa = () => {
    const msg = `Bonjour, je voudrais prendre RDV chez *${storeName}* :\n\n` +
      `✂️ Service : ${service.name}${service.durationMinutes ? ` (${formatDuration(service.durationMinutes)})` : ''}\n` +
      `💰 Prix : ${formatPrice(service.price, service.currency)}\n` +
      `👤 Nom : ${name}\n📅 ${date} à ${time}\n` +
      (practitioner.trim() ? `👩 Avec : ${practitioner}\n` : '') +
      (notes.trim() ? `📝 ${notes}\n` : '') +
      `\nMerci de confirmer 🙏`;
    return `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, padding: 16, background: 'rgba(26,8,36,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cream, borderRadius: 22, maxWidth: 480, width: '100%', boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)', overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Prendre RDV</h3>
            <p style={{ fontSize: 12, opacity: 0.9, margin: '4px 0 0' }}>
              {service.name}{service.durationMinutes ? ` · ${formatDuration(service.durationMinutes)}` : ''} · {formatPrice(service.price, service.currency)}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <Label>Votre nom</Label>
            <Input value={name} onChange={setName} placeholder="Mme Diallo" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><Label>Date</Label><Input type="date" value={date} onChange={setDate} /></div>
            <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>{hasStaff ? 'Choisir un praticien (optionnel)' : 'Praticien préféré (optionnel)'}</Label>
            {hasStaff ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button type="button" onClick={() => setPractitioner('')}
                  style={{
                    padding: '8px 12px', borderRadius: 100,
                    background: practitioner === '' ? accentDark : 'transparent',
                    color: practitioner === '' ? '#fff' : C.inkSoft,
                    border: `1.5px solid ${practitioner === '' ? accentDark : C.creamDeep}`,
                    fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  Peu importe
                </button>
                {practitioners.map(p => {
                  const sel = practitioner === p.name;
                  return (
                    <button key={p.id} type="button" onClick={() => setPractitioner(p.name)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px 6px 6px', borderRadius: 100,
                        background: sel ? accentDark : '#fff',
                        color: sel ? '#fff' : C.ink,
                        border: `1.5px solid ${sel ? accentDark : C.creamDeep}`,
                        fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: sel ? 'rgba(255,255,255,0.25)' : C.creamDeep, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                          {p.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span>{p.name}</span>
                      {p.role && <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 500 }}>· {p.role}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Input value={practitioner} onChange={setPractitioner} placeholder="Marie, Aïcha…" />
            )}
          </div>
          <div style={{ marginBottom: 18 }}>
            <Label>Notes (optionnel)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Cheveux longs, coloration spécifique…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          {canSubmit ? (
            <a href={buildWa()} target="_blank" rel="noopener noreferrer" onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 18px', borderRadius: 12, background: '#25D366', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 8px 20px -6px rgba(37,211,102,0.55)' }}>
              <MessageCircle size={16} /> Confirmer sur WhatsApp
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
