/**
 * Public menu page — accessible sans auth.
 * URL : /menu/:slug ou /menu/:companyId/:storeId
 *
 * Variant orange (resto) du PublicShopPage. Différences clés :
 *   - Header "MENU" au lieu de "BOUTIQUE"
 *   - CTA "Réserver une table" en plus de "Commander"
 *   - Theme orange par défaut (override par accentColor du store)
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChefHat, MessageCircle, Image as ImageIcon, Loader2, AlertCircle,
  CheckCircle2, MapPin, Sparkles, ArrowRight, Search, Calendar,
  Plus, X, Trash2,
} from 'lucide-react';
import PhotoCarousel from '@/components/store/PhotoCarousel';
import { PublicTagline, PublicSocials, PublicContactBar } from '@/components/public/PublicBranding';
import { PublicLangSwitcher } from '@/components/public/PublicLangSwitcher';
import { isStoreOpenNowClient } from '@/lib/restaurant/openingHours';
import PerCompanyPWAHead from '@/components/common/PerCompanyPWAHead';

const C = {
  orange:      '#F97316',
  orangeDeep:  '#C2410C',
  orangeSoft:  '#FFEDD5',
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
  .stagger > *:nth-child(5){animation-delay:.20s}.stagger > *:nth-child(6){animation-delay:.24s}
  .stagger > *:nth-child(7){animation-delay:.28s}.stagger > *:nth-child(8){animation-delay:.32s}
  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }
  .card-hover { transition: transform .2s ease, box-shadow .2s ease; }
  .card-hover:hover { transform: translateY(-4px); box-shadow: 0 18px 40px -16px rgba(10,42,32,.3); }
`;

interface PublicProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  description?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  category?: string | null;
  tags?: string[];
  stockQty: number;
  featured?: boolean;
}
interface PublicStore {
  id: string;
  name: string;
  currency: string;
  country: string;
  paymentInstructions?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  accentColor?: string | null;
  openingHours?: string | null;
  establishmentType?: 'restaurant' | 'maquis' | 'bar' | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
interface ShopData {
  store: PublicStore;
  products: PublicProduct[];
  whatsappBusinessNumber: string | null;
}

const NO_DECIMAL_CURRENCIES = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']);
function formatPrice(n: number, currency: string): string {
  const decimals = NO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
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

export default function PublicMenuPage() {
  const { slug, companyId, storeId } = useParams<{ slug?: string; companyId?: string; storeId?: string }>();
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('orlode-menu-cart');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('orlode-menu-cart', JSON.stringify(cart)); } catch { /* */ }
  }, [cart]);

  useEffect(() => {
    const url = slug
      ? `/api/public/shop/${slug}`
      : (companyId && storeId ? `/api/public/shop/${companyId}/${storeId}` : null);
    if (!url) return;
    setLoading(true); setError(null);
    fetch(url)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || `HTTP ${r.status}`);
        return r.json() as Promise<ShopData & { success: boolean }>;
      })
      .then(d => setData(d))
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [slug, companyId, storeId]);

  const addToCart = (id: string) => setCart(c => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const removeFromCart = (id: string) => setCart(c => {
    const next = { ...c };
    if ((next[id] ?? 0) <= 1) delete next[id];
    else next[id] = next[id] - 1;
    return next;
  });
  const setQty = (id: string, qty: number) => setCart(c => {
    const next = { ...c };
    if (qty <= 0) delete next[id];
    else next[id] = Math.min(qty, 99);
    return next;
  });
  const clearCart = () => setCart({});

  const filtered = data?.products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q);
  }) ?? [];

  // Featured ("Plat du jour") shown first as its own pseudo-section.
  const featuredItems = filtered.filter(p => p.featured);
  const nonFeatured = filtered.filter(p => !p.featured);
  const byCategory: Record<string, PublicProduct[]> = {};
  if (featuredItems.length > 0) byCategory['⭐ Plat du jour'] = featuredItems;
  for (const p of nonFeatured) {
    const cat = p.category ?? 'Autres';
    (byCategory[cat] ||= []).push(p);
  }

  const cartItems = (data?.products ?? [])
    .filter(p => (cart[p.id] ?? 0) > 0)
    .map(p => ({ product: p, qty: cart[p.id]! }));
  const cartCount = cartItems.reduce((s, it) => s + it.qty, 0);
  const cartTotal = cartItems.reduce((s, it) => s + it.product.price * it.qty, 0);
  const currency = cartItems[0]?.product.currency ?? data?.store.currency ?? 'XOF';

  const buildWhatsAppOrder = (): string => {
    if (cartItems.length === 0 || !data?.whatsappBusinessNumber) return '#';
    const lines = cartItems.map(it =>
      `• ${it.qty}× ${it.product.name} — ${formatPrice(it.product.price * it.qty, it.product.currency)}`
    );
    const msg =
      `Bonjour, je voudrais commander :\n\n` +
      `${lines.join('\n')}\n\n` +
      `*Total : ${formatPrice(cartTotal, currency)}*\n\n` +
      `Merci de me confirmer la disponibilité et la livraison. 🙏`;
    return `https://wa.me/${data.whatsappBusinessNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  const accent = data?.store.accentColor || C.orange;
  const accentDark = data?.store.accentColor ? darken(data.store.accentColor) : C.orangeDeep;

  return (
    <div style={{ background: '#1a0a05', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{STYLES}</style>

      {data?.store && (
        <PerCompanyPWAHead
          companyId={data.store.id}
          companyName={data.store.name}
          logoUrl={data.store.logoUrl ?? undefined}
          primaryColor={data.store.accentColor ?? undefined}
        />
      )}

      {/* Hero */}
      <div className="grain" style={{
        background: data?.store.coverImageUrl
          ? `linear-gradient(135deg, rgba(194,65,12,0.85), rgba(154,52,18,0.85)), url(${data.store.coverImageUrl})`
          : `linear-gradient(135deg, ${accent}, ${accentDark} 60%, #1a0a05)`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        padding: '48px 24px 56px', position: 'relative', overflow: 'hidden', color: C.cream,
      }}>
        <svg style={{ position: 'absolute', right: -60, top: -60, opacity: 0.16 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60"  stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>
        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            {data?.store.logoUrl && (
              <img src={data.store.logoUrl} alt={data.store.name} style={{
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
              <ChefHat size={11} /> MENU
            </div>
            {(() => {
              const open = isStoreOpenNowClient(data?.store.openingHours);
              if (open == null) return null;
              return (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 100,
                  background: open ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)',
                  border: `1px solid ${open ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)'}`,
                  backdropFilter: 'blur(10px)',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: open ? '#22c55e' : '#ef4444',
                    boxShadow: open ? '0 0 8px rgba(34,197,94,0.8)' : 'none',
                  }} />
                  {open ? 'Ouvert' : 'Fermé'}
                </div>
              );
            })()}
          </div>
          <h1 className="display-font" style={{
            fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: 0,
            lineHeight: 1.05, letterSpacing: '-0.03em',
          }}>
            {loading ? 'Chargement…' : (data?.store.name ?? 'Restaurant')}
          </h1>
          {data && (data.store.tagline || data.store.shortDescription) && (
            <PublicTagline store={data.store as any} color={C.orange} dark />
          )}
          {data && (
            <p style={{ marginTop: 12, fontSize: 14, opacity: 0.9, maxWidth: 560 }}>
              {data.products.length} plat{data.products.length > 1 ? 's' : ''} au menu ·
              Commande directement sur WhatsApp · {data.store.paymentInstructions ? 'Paiement à la livraison ou Wave/OM' : 'Paiement sur place'}
            </p>
          )}
          {data && (
            <div style={{ marginTop: 14 }}>
              <PublicSocials store={data.store as any} color={C.orange} compact />
            </div>
          )}
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data?.store.openingHours && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 12,
                background: 'rgba(255,250,240,0.15)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,250,240,0.25)',
                fontSize: 13, fontWeight: 600,
              }}>
                <span>🕐</span>
                <span>{data.store.openingHours}</span>
              </div>
            )}
            {data?.store.address && (() => {
              const mapsHref = data.store.googleMapsUrl
                ?? (typeof data.store.latitude === 'number' && typeof data.store.longitude === 'number'
                  ? `https://www.google.com/maps/search/?api=1&query=${data.store.latitude},${data.store.longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.store.address)}`);
              return (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 12,
                  background: 'rgba(255,250,240,0.15)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,250,240,0.25)',
                  fontSize: 13, fontWeight: 600, color: 'inherit', textDecoration: 'none',
                }}>
                  <span>📍</span>
                  <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.store.address}</span>
                  <span style={{ opacity: 0.65, fontSize: 11 }}>→ Maps</span>
                </a>
              );
            })()}
          </div>

          {data && data.whatsappBusinessNumber && (
            <button onClick={() => setReservationOpen(true)}
              style={{
                marginTop: 20, padding: '12px 22px',
                background: 'rgba(255,250,240,0.18)', backdropFilter: 'blur(10px)',
                color: C.cream, border: '1px solid rgba(255,250,240,0.30)', borderRadius: 12,
                cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
              <Calendar size={14} /> Réserver une table
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {data && data.products.length > 0 && (
        <div style={{ maxWidth: 1080, margin: '-28px auto 0', padding: '0 24px', position: 'relative', zIndex: 2 }}>
          <div style={{
            background: C.cream, borderRadius: 16, padding: '12px 16px',
            boxShadow: '0 16px 40px -16px rgba(10,42,32,0.3)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Search size={18} color={C.inkSoft} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un plat, une catégorie…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 15, color: C.ink, fontFamily: 'inherit' }} />
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 24px 64px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.cream }}>
            <Loader2 size={28} className="spin" color={accent} />
            <div style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.8)' }}>Chargement du menu…</div>
          </div>
        )}
        {error && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 24, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
            <AlertCircle size={32} color={C.red} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Menu indisponible</div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>{error}</div>
          </div>
        )}
        {data && data.products.length === 0 && !loading && (
          <div style={{ background: C.cream, borderRadius: 16, padding: 32, textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
            <ChefHat size={36} color={accentDark} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Pas encore de plats</div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>Reviens bientôt — la cuisine prépare ton menu.</div>
          </div>
        )}

        {/* Chef's Pick — gradient cream featured hero card */}
        {data && featuredItems.length > 0 && !search && (() => {
          const chefPick = featuredItems[0];
          const chefImage = (chefPick.imageUrls && chefPick.imageUrls[0]) || chefPick.imageUrl;
          return (
            <section style={{
              marginBottom: 32, borderRadius: 18, overflow: 'hidden', position: 'relative',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fef7ed 100%)',
              boxShadow: `0 12px 32px -10px ${accent}50`,
              borderTop: `4px solid ${accent}`,
            }}>
              <div style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {chefImage ? (
                    <img src={chefImage} alt={chefPick.name} style={{
                      width: 110, height: 110, borderRadius: 14, objectFit: 'cover',
                    }} />
                  ) : (
                    <div style={{
                      width: 110, height: 110, borderRadius: 14,
                      background: `linear-gradient(135deg, ${accent}, ${accentDark})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 44,
                    }}>🍽</div>
                  )}
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    background: '#dc2626', color: '#fff',
                    padding: '3px 9px', borderRadius: 100,
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                    boxShadow: '0 4px 10px -2px rgba(220,38,38,0.5)',
                  }}>CHEF</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: accentDark, fontSize: 10, fontWeight: 800,
                    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
                  }}>★ COUP DE CŒUR DU CHEF</div>
                  <h3 className="display-font" style={{
                    fontSize: 22, fontWeight: 800, color: C.ink, margin: '0 0 6px',
                    letterSpacing: '-0.02em', lineHeight: 1.15,
                  }}>{chefPick.name}</h3>
                  {chefPick.description && (
                    <p style={{
                      fontSize: 13, color: C.inkSoft, margin: '0 0 10px', lineHeight: 1.5,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>{chefPick.description}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="display-font" style={{ fontSize: 18, fontWeight: 800, color: accentDark }}>
                      {formatPrice(chefPick.price, chefPick.currency)}
                    </span>
                    {(cart[chefPick.id] ?? 0) === 0 ? (
                      <button onClick={() => addToCart(chefPick.id)}
                        disabled={(chefPick.stockQty ?? 0) === 0 || !data.whatsappBusinessNumber}
                        style={{
                          padding: '7px 14px', borderRadius: 100,
                          background: accentDark, color: '#fff',
                          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          fontWeight: 800, fontSize: 12,
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          boxShadow: `0 6px 14px -4px ${accent}80`,
                          opacity: (chefPick.stockQty ?? 0) === 0 ? 0.5 : 1,
                        }}>
                        <Plus size={13} /> Goûter
                      </button>
                    ) : (
                      <span style={{
                        padding: '7px 14px', borderRadius: 100,
                        background: '#22c55e', color: '#fff', fontWeight: 800, fontSize: 12,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>{cart[chefPick.id]} × dans panier ✓</span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {data && filtered.length > 0 && Object.entries(byCategory).map(([category, prods]) => (
          <section key={category} style={{ marginBottom: 36 }}>
            {Object.keys(byCategory).length > 1 && (
              <h2 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
                {category}
              </h2>
            )}
            <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {prods.map(p => (
                <DishCard key={p.id} dish={p} accent={accent} accentDark={accentDark}
                  qty={cart[p.id] ?? 0}
                  onAdd={() => addToCart(p.id)}
                  onRemove={() => removeFromCart(p.id)}
                  whatsappAvailable={!!data.whatsappBusinessNumber} />
              ))}
            </div>
          </section>
        ))}

        {/* Trust band — 4 columns of reassurance */}
        {data && data.products.length > 0 && (
          <div style={{
            marginTop: 40, padding: '20px 16px', borderRadius: 16,
            background: 'rgba(0,0,0,0.22)',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14,
          }}>
            {[
              { icon: '🛵', label: 'Livraison rapide', sub: data.store.address ? data.store.address.split(',')[0].trim() : 'Local' },
              { icon: '💰', label: 'Paiement à la livraison', sub: 'Cash, Wave ou OM' },
              ...(data.store.openingHours ? [{ icon: '🕐', label: 'Horaires', sub: data.store.openingHours }] : [{ icon: '👨‍🍳', label: 'Cuisine maison', sub: 'Fait minute' }]),
              { icon: '💬', label: 'Support WhatsApp', sub: '7j/7' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: `${accent}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: 18,
                }}>{t.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: C.cream, fontSize: 11, fontWeight: 700 }}>{t.label}</div>
                  <div style={{ color: 'rgba(255,250,240,0.55)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {data && data.products.length > 0 && (
          <div style={{
            marginTop: 18, padding: 14, borderRadius: 12,
            background: 'rgba(255,250,240,0.04)', border: '1px solid rgba(255,250,240,0.08)',
            textAlign: 'center', color: 'rgba(255,250,240,0.6)',
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
              <Sparkles size={11} color={accent} /> Propulsé par <strong style={{ color: C.cream, marginLeft: 4 }}>Orlode AI</strong> · Commande WhatsApp · Réservation table
            </div>
          </div>
        )}

        {cartCount > 0 && <div style={{ height: 96 }} />}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && data?.whatsappBusinessNumber && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: 'rgba(26,10,5,0.95)', backdropFilter: 'blur(14px)',
          borderTop: '1px solid rgba(255,250,240,0.12)',
          padding: '12px 16px', boxShadow: '0 -8px 30px -6px rgba(0,0,0,0.35)',
        }}>
          <div style={{
            maxWidth: 1080, margin: '0 auto',
            display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center',
          }}>
            <button onClick={() => setCartOpen(true)} aria-label="Voir le panier"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 12,
                background: 'rgba(255,250,240,0.10)', color: C.cream,
                border: '1px solid rgba(255,250,240,0.16)', cursor: 'pointer',
                fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
              }}>
              <ChefHat size={16} />
              <span style={{ background: accent, color: '#1a0a05', width: 22, height: 22, borderRadius: 11, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>
              <span className="mono-font" style={{ fontSize: 13, opacity: 0.95 }}>{formatPrice(cartTotal, currency)}</span>
            </button>
            <div style={{ fontSize: 12, color: 'rgba(255,250,240,0.7)', textAlign: 'center' }}>
              {cartCount} plat{cartCount > 1 ? 's' : ''} · Commande via WhatsApp
            </div>
            <a href={buildWhatsAppOrder()} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 18px', borderRadius: 12,
                background: '#25D366', color: '#fff', textDecoration: 'none',
                fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
                boxShadow: '0 8px 20px -6px rgba(37,211,102,0.55)', whiteSpace: 'nowrap',
              }}>
              <MessageCircle size={16} /> Commander <ArrowRight size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer cartItems={cartItems} cartTotal={cartTotal} currency={currency}
          accent={accent} accentDark={accentDark}
          waLink={buildWhatsAppOrder()} hasWhatsApp={!!data?.whatsappBusinessNumber}
          onClose={() => setCartOpen(false)} onClear={clearCart}
          onSetQty={setQty} onAdd={addToCart} onRemove={removeFromCart} />
      )}

      {/* Reservation modal */}
      {reservationOpen && data?.whatsappBusinessNumber && (
        <ReservationModal accent={accent} accentDark={accentDark}
          waNumber={data.whatsappBusinessNumber}
          storeName={data.store.name}
          onClose={() => setReservationOpen(false)} />
      )}
      {data && <PublicContactBar store={data.store as any} color={accent} primaryCta={{ label: 'Réserver', href: '#reserve' }} />}
      <PublicLangSwitcher dark />
    </div>
  );
}

function DishCard({ dish, accent, accentDark, qty, onAdd, onRemove, whatsappAvailable }: {
  dish: PublicProduct; accent: string; accentDark: string;
  qty: number; onAdd: () => void; onRemove: () => void; whatsappAvailable: boolean;
}) {
  const formatted = formatPrice(dish.price, dish.currency);
  const inCart = qty > 0;
  const outOfStock = (dish.stockQty ?? 0) === 0;
  const lowStock = !outOfStock && (dish.stockQty ?? 0) <= 3;
  // "NOUVEAU" if createdAt < 7 days ago. createdAt isn't typed on PublicProduct yet → safe access.
  const createdAtRaw = (dish as PublicProduct & { createdAt?: { seconds?: number } | string | Date }).createdAt;
  let isNew = false;
  if (createdAtRaw) {
    let ms: number | null = null;
    if (typeof createdAtRaw === 'string') ms = Date.parse(createdAtRaw);
    else if (createdAtRaw instanceof Date) ms = createdAtRaw.getTime();
    else if (typeof (createdAtRaw as { seconds?: number }).seconds === 'number') ms = (createdAtRaw as { seconds: number }).seconds * 1000;
    if (ms && Date.now() - ms < 7 * 24 * 60 * 60 * 1000) isNew = true;
  }

  return (
    <article className="card-hover" style={{
      background: C.cream, borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      opacity: outOfStock ? 0.6 : 1,
      boxShadow: dish.featured
        ? `0 8px 28px -8px ${accent}80, 0 0 0 2px ${accent}40`
        : '0 6px 20px -8px rgba(10,42,32,0.18)',
    }}>
      <div style={{ position: 'relative' }}>
        <PhotoCarousel
          images={dish.imageUrls ?? []}
          fallback={dish.imageUrl}
          alt={dish.name}
          aspect="1"
          emptyBackground={`linear-gradient(135deg, ${accent}, ${accentDark})`}
          emptyEmoji="🍽"
          borderRadius="0"
        />
        {/* Top-right featured ribbon */}
        {dish.featured && (
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 2,
            background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff',
            padding: '4px 10px', borderRadius: 100,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.3)',
          }}>⭐ Plat du jour</div>
        )}
        {/* Top-left: category + status badges stacked */}
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {dish.category && (
            <span style={{
              background: 'rgba(255,250,240,0.92)', color: accentDark,
              padding: '3px 10px', borderRadius: 100,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              backdropFilter: 'blur(6px)',
            }}>{dish.category}</span>
          )}
          {isNew && !dish.featured && (
            <span style={{
              background: '#22c55e', color: '#fff',
              padding: '3px 8px', borderRadius: 100,
              fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
            }}>✨ NOUVEAU</span>
          )}
        </div>
        {/* Bottom-left: stock urgency / rupture */}
        {outOfStock && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 3,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            padding: '8px 16px', borderRadius: 10,
            fontSize: 12, fontWeight: 800, letterSpacing: '0.06em',
          }}>RUPTURE</div>
        )}
        {lowStock && (
          <div style={{
            position: 'absolute', bottom: 10, left: 10, zIndex: 2,
            background: '#dc2626', color: '#fff',
            padding: '3px 9px', borderRadius: 100,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.03em',
            boxShadow: '0 4px 10px -2px rgba(220,38,38,0.5)',
            animation: 'pulse 2s infinite',
          }}>🔥 Plus que {dish.stockQty} !</div>
        )}
      </div>
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="display-font" style={{
          fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 6px',
          lineHeight: 1.25, letterSpacing: '-0.01em',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{dish.name}</h3>
        {dish.description && (
          <p style={{
            fontSize: 12, color: C.inkSoft, margin: '0 0 10px', lineHeight: 1.45,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{dish.description}</p>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <div className="mono-font" style={{ fontSize: 17, fontWeight: 700, color: accentDark, marginBottom: 10 }}>
            {formatted}
          </div>
          {outOfStock ? (
            <button disabled style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: C.creamDeep, color: C.inkLight,
              border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
              cursor: 'not-allowed',
            }}>📅 Disponible demain</button>
          ) : !whatsappAvailable ? (
            <button disabled style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: C.creamDeep, color: C.inkLight,
              border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
              cursor: 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <CheckCircle2 size={14} /> Bientôt disponible
            </button>
          ) : !inCart ? (
            <button onClick={onAdd} style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: accentDark, color: '#fff',
              border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: `0 6px 14px -4px ${accent}80`,
            }}>
              <Plus size={14} /> Ajouter
            </button>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 6, alignItems: 'center',
              background: accentDark, borderRadius: 10, padding: 4,
              boxShadow: `0 6px 14px -4px ${accent}80`,
            }}>
              <button onClick={onRemove} aria-label="Retirer 1" style={{
                width: 36, height: 36, borderRadius: 7,
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 700, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>−</button>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, textAlign: 'center' }}>
                {qty} dans le panier
              </div>
              <button onClick={onAdd} aria-label="Ajouter 1" style={{
                width: 36, height: 36, borderRadius: 7,
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 700, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>+</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CartDrawer({ cartItems, cartTotal, currency, accent, accentDark, waLink, hasWhatsApp, onClose, onClear, onSetQty, onAdd, onRemove }: {
  cartItems: Array<{ product: PublicProduct; qty: number }>;
  cartTotal: number; currency: string;
  accent: string; accentDark: string;
  waLink: string; hasWhatsApp: boolean;
  onClose: () => void; onClear: () => void;
  onSetQty: (id: string, qty: number) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(6,21,16,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(440px, 100%)', height: '100%',
        background: C.cream, color: C.ink,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 40px -10px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          padding: '18px 20px', background: accentDark, color: C.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ChefHat size={20} />
            <h2 className="display-font" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Mon panier</h2>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,250,240,0.16)', color: C.cream,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {cartItems.map(({ product, qty }) => (
            <div key={product.id} style={{
              display: 'grid', gridTemplateColumns: '64px 1fr auto',
              gap: 12, alignItems: 'center', padding: '12px 4px',
              borderBottom: `1px solid ${C.creamDeep}`,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
                background: product.imageUrl ? '#000' : C.creamDeep,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : <ImageIcon size={20} color={C.inkLight} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                <div className="mono-font" style={{ fontSize: 13, color: accentDark, fontWeight: 700, marginTop: 2 }}>
                  {formatPrice(product.price * qty, product.currency)}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8,
                  background: C.creamDeep, borderRadius: 8, padding: 2,
                }}>
                  <button onClick={() => onRemove(product.id)} style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: C.ink, fontSize: 16, fontWeight: 700 }}>−</button>
                  <input type="number" min={1} max={99} value={qty}
                    onChange={e => onSetQty(product.id, parseInt(e.target.value, 10) || 0)}
                    style={{ width: 36, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: 'inherit' }} />
                  <button onClick={() => onAdd(product.id)} style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: C.ink, fontSize: 16, fontWeight: 700 }}>+</button>
                </div>
              </div>
              <button onClick={() => onSetQty(product.id, 0)} style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', color: C.red, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {cartItems.length > 0 && (
            <button onClick={onClear} style={{ marginTop: 12, padding: '8px 12px', background: 'transparent', color: C.inkSoft, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', textDecoration: 'underline' }}>
              Vider le panier
            </button>
          )}
        </div>

        <div style={{ padding: 16, borderTop: `1px solid ${C.creamDeep}`, background: C.cream }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>Total</span>
            <span className="mono-font" style={{ fontSize: 22, fontWeight: 800, color: accentDark }}>
              {formatPrice(cartTotal, currency)}
            </span>
          </div>
          {hasWhatsApp ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={onClose}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 18px', borderRadius: 12,
                background: '#25D366', color: '#fff', textDecoration: 'none',
                fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                boxShadow: '0 8px 20px -6px rgba(37,211,102,0.55)',
              }}>
              <MessageCircle size={18} /> Commander sur WhatsApp <ArrowRight size={16} />
            </a>
          ) : (
            <button disabled style={{ width: '100%', padding: '14px 18px', borderRadius: 12, background: C.creamDeep, color: C.inkLight, border: 'none', fontWeight: 700 }}>
              WhatsApp non configuré
            </button>
          )}
          <div style={{ marginTop: 10, fontSize: 11, color: C.inkSoft, textAlign: 'center' }}>
            Tu seras redirigé vers WhatsApp avec ta commande pré-remplie.
          </div>
        </div>
      </div>
    </div>
  );
}

function ReservationModal({ accent, accentDark, waNumber, storeName, onClose }: {
  accent: string; accentDark: string; waNumber: string; storeName: string; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('20:00');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');

  const canSubmit = name.trim().length >= 2 && date && time && partySize > 0;

  const buildWaLink = () => {
    const msg = `Bonjour, je voudrais réserver une table chez *${storeName}* :\n\n` +
      `👤 Nom : ${name}\n📅 Date : ${date}\n🕐 Heure : ${time}\n👥 ${partySize} personne${partySize > 1 ? 's' : ''}\n` +
      (notes ? `📝 ${notes}\n` : '') +
      `\nMerci de me confirmer la disponibilité 🙏`;
    return `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, padding: 16,
      background: 'rgba(6,21,16,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22, maxWidth: 480, width: '100%',
        boxShadow: '0 30px 80px -20px rgba(10,42,32,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Réserver une table</h3>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <Label>Votre nom</Label>
            <Input value={name} onChange={setName} placeholder="Mr Konan" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div><Label>Date</Label><Input type="date" value={date} onChange={setDate} /></div>
            <div><Label>Heure</Label><Input type="time" value={time} onChange={setTime} /></div>
            <div><Label>Couverts</Label><Input type="number" value={String(partySize)} onChange={v => setPartySize(parseInt(v) || 1)} /></div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <Label>Notes (optionnel)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Anniversaire, allergie…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.creamDeep}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
          </div>
          {canSubmit ? (
            <a href={buildWaLink()} target="_blank" rel="noopener noreferrer" onClick={onClose}
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
