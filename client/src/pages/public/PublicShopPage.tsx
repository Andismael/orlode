/**
 * Public storefront — accessible without auth.
 *
 * URL: /shop/:companyId/:storeId
 *
 * Renders the store's active products as cards. Each "Commander" button
 * deep-links to WhatsApp (wa.me) pre-filled with the product name, so the
 * customer is bounced straight back to the merchant's WhatsApp Business
 * line. The Orlode agent then handles ordering as usual.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShoppingBag, MessageCircle, Image as ImageIcon, Loader2, AlertCircle,
  CheckCircle2, MapPin, Sparkles, ArrowRight, Search, Star,
  Plus, X, Trash2, ChevronLeft, ChevronRight, Truck, Shield, Clock,
} from 'lucide-react';
import { PublicTagline, PublicSocials, PublicContactBar } from '@/components/public/PublicBranding';
import { PublicLangSwitcher } from '@/components/public/PublicLangSwitcher';

const C = {
  greenDeep:   '#0A3D2E',    // premium dark green (matches Wemas hero)
  greenMid:    '#134E3A',
  greenDark:   '#063D2E',
  cream:       '#FEF7E7',    // warmer cream
  creamSoft:   '#F5E4B4',
  creamDeep:   '#F5EDD6',
  gold:        '#F59E0B',
  goldSoft:    '#FCD34D',
  emerald:     '#10B981',
  emeraldDeep: '#059669',
  emeraldSoft: '#D1FAE5',
  cyan:        '#06B6D4',
  cyanDeep:    '#0891B2',
  cyanSoft:    '#CFFAFE',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  red:         '#DC2626',
  rareFrom:    '#8B5CF6',
  rareTo:      '#EC4899',
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
  .card-hover:hover .zoom-img { transform: scale(1.06); }
  .zoom-img { transition: transform .35s ease; }
  .scroll-x { overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
  .scroll-x::-webkit-scrollbar { display: none; }
  .snap-card { scroll-snap-align: start; }
  @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
  .pulse-icon { animation: pulse 2s ease-in-out infinite; }
  @keyframes shimmerStar { 0% { transform: rotate(0deg); } 50% { transform: rotate(15deg); } 100% { transform: rotate(0deg); } }
  .star-bounce { animation: shimmerStar 2.4s ease-in-out infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .blink-dot { animation: blink 1.5s infinite; }
  @keyframes pulseRing {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
    50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
  }
  .pulse-ring { animation: pulseRing 2s infinite; }
  .pcard { transition: transform .25s ease, box-shadow .25s ease; }
  .pcard:hover { transform: translateY(-4px); box-shadow: 0 18px 36px -12px rgba(0,0,0,0.4); }
`;

interface PublicProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  description?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  primaryImageUrl?: string | null;
  videoUrl?: string | null;
  category?: string | null;
  subcategory?: string | null;
  tags?: string[];
  colors?: string[];
  stockQty: number;
  featured?: boolean;
  variants?: Array<{ name: string; size?: string; color?: string }>;
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
  address?: string | null;
  googleMapsUrl?: string | null;
}

// Normalize a free-form category into a parent group + optional child label.
// Older products may have specific labels like "Polo" stored as their category;
// this maps them to a broader bucket ("Vêtements") so the storefront groups
// sensibly. Unknown labels stay as-is (parent = original, no child).
const CATEGORY_GROUPS: Record<string, string[]> = {
  'Vêtements': [
    'polo', 't-shirt', 'tshirt', 'chemise', 'pull', 'sweat', 'sweatshirt', 'hoodie',
    'pantalon', 'jean', 'short', 'jupe', 'robe', 'veste', 'manteau', 'blouson',
    'sous-vêtement', 'lingerie', 'pyjama', 'maillot', 'vêtement',
  ],
  'Vêtements traditionnels': [
    'traditionnel', 'boubou', 'bazin', 'caftan', 'kaftan', 'wax', 'pagne', 'bogolan',
  ],
  'Chaussures': ['chaussure', 'sneaker', 'basket', 'sandale', 'tongs', 'mocassin', 'escarpin', 'botte', 'bottine', 'derby', 'richelieu'],
  'Bijoux': ['bijou', 'collier', 'bracelet', 'bague', 'boucle d\'oreille', 'parure', 'pendentif'],
  'Sacs & Maroquinerie': ['sac', 'sac à main', 'cartable', 'porte-monnaie', 'portefeuille', 'ceinture', 'maroquinerie'],
  'Cosmétique': ['cosmetique', 'cosmétique', 'creme', 'crème', 'parfum', 'maquillage', 'rouge à lèvres', 'mascara', 'lotion', 'savon', 'shampoing', 'huile', 'beauté'],
  'Téléphones & Électronique': ['téléphone', 'telephone', 'phone', 'iphone', 'samsung', 'ordinateur', 'laptop', 'tablette', 'écouteur', 'casque', 'chargeur', 'cable', 'enceinte', 'tv'],
  'Décoration': ['décoration', 'decoration', 'meuble', 'tableau', 'lampe', 'tapis', 'vaisselle', 'rideau'],
  'Alimentaire': ['alimentaire', 'épice', 'epice', 'huile alimentaire', 'thé', 'café', 'sucre', 'farine', 'boisson'],
  'Accessoires': ['accessoire', 'lunette', 'chapeau', 'casquette', 'écharpe', 'gant', 'montre'],
};

function normalizeCategory(raw: string | null | undefined): { parent: string; child?: string } {
  if (!raw) return { parent: 'Tous les produits' };
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();
  for (const [parent, keywords] of Object.entries(CATEGORY_GROUPS)) {
    if (lower === parent.toLowerCase()) return { parent };
    if (keywords.some(k => lower.includes(k))) {
      // The raw label becomes the child unless it's already the parent
      return lower === parent.toLowerCase()
        ? { parent }
        : { parent, child: cleaned };
    }
  }
  // Unknown → use as-is, no child
  return { parent: cleaned };
}

// Cart keys use `${productId}::${variantName}` when a variant is picked,
// otherwise just `${productId}`. Helpers to compose / parse.
function cartKey(productId: string, variantName?: string): string {
  return variantName ? `${productId}::${variantName}` : productId;
}
function parseCartKey(key: string): { productId: string; variant?: string } {
  const idx = key.indexOf('::');
  if (idx < 0) return { productId: key };
  return { productId: key.slice(0, idx), variant: key.slice(idx + 2) };
}

// Get all images for a product (gallery), with primary first.
function productImages(p: PublicProduct): string[] {
  const list = Array.isArray(p.imageUrls) && p.imageUrls.length > 0
    ? [...p.imageUrls]
    : (p.imageUrl ? [p.imageUrl] : []);
  if (p.primaryImageUrl && list.includes(p.primaryImageUrl)) {
    return [p.primaryImageUrl, ...list.filter(u => u !== p.primaryImageUrl)];
  }
  return list;
}

interface ShopData {
  store: PublicStore;
  products: PublicProduct[];
  whatsappBusinessNumber: string | null;
}

// Currencies that don't use decimals
const NO_DECIMAL_CURRENCIES = new Set(['XOF', 'XAF', 'JPY', 'GNF', 'KES', 'NGN', 'RWF', 'BIF', 'UGX']);

function formatPrice(n: number, currency: string): string {
  const decimals = NO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency,
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(n);
  } catch {
    return `${n.toLocaleString('fr-FR')} ${currency}`;
  }
}

// Darken a hex color by ~20% for gradient usage. Returns valid hex.
function darken(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 40);
  const g = Math.max(0, ((n >> 8) & 0xff) - 40);
  const b = Math.max(0, (n & 0xff) - 40);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

export default function PublicShopPage() {
  // Two URL forms:
  //   /shop/:slug                    (clean, canonical — e.g. /shop/galaxy-store)
  //   /shop/:companyId/:storeId      (legacy/fallback — UUID-based)
  const { slug, companyId, storeId } = useParams<{ slug?: string; companyId?: string; storeId?: string }>();
  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // ── Cart state — productId → quantity. Persisted to localStorage so a
  //   refresh doesn't lose the basket.
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('orlode-cart');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [quickView, setQuickView] = useState<PublicProduct | null>(null);
  useEffect(() => {
    try { localStorage.setItem('orlode-cart', JSON.stringify(cart)); } catch { /* no-op */ }
  }, [cart]);

  const addToCart = (productId: string, variant?: string) => {
    const key = cartKey(productId, variant);
    setCart(c => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
  };
  const removeFromCart = (productId: string, variant?: string) => {
    const key = cartKey(productId, variant);
    setCart(c => {
      const next = { ...c };
      if ((next[key] ?? 0) <= 1) delete next[key];
      else next[key] = next[key] - 1;
      return next;
    });
  };
  const setQty = (key: string, qty: number) => setCart(c => {
    const next = { ...c };
    if (qty <= 0) delete next[key];
    else next[key] = Math.min(qty, 99);
    return next;
  });
  const clearCart = () => setCart({});

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

  const filtered = data?.products.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q) ||
      (p.tags ?? []).some(t => t.toLowerCase().includes(q))
    );
  }) ?? [];

  // Featured products surfaced at top (only when no search active)
  const featuredItems = !search ? filtered.filter(p => p.featured) : [];
  const nonFeatured = !search ? filtered.filter(p => !p.featured) : filtered;

  // Group remaining by NORMALIZED parent category (Polo + T-shirt + Chemise all
  // end up under "Vêtements") for visual structure. Specific labels stay
  // as chips on the cards via product.subcategory or normalized child.
  const byCategory = nonFeatured.reduce<Record<string, PublicProduct[]>>((acc, p) => {
    const cat = normalizeCategory(p.category).parent;
    (acc[cat] ||= []).push(p);
    return acc;
  }, {});

  // ── Cart computed values ──────────────────────────────────────────────────
  // Cart keys now look like `${productId}` or `${productId}::${variantName}`.
  const productById = new Map((data?.products ?? []).map(p => [p.id, p] as const));
  const cartItems = Object.entries(cart)
    .map(([key, qty]) => {
      const { productId, variant } = parseCartKey(key);
      const product = productById.get(productId);
      if (!product) return null;
      return { key, product, qty, variant };
    })
    .filter((x): x is { key: string; product: PublicProduct; qty: number; variant?: string } => x !== null);
  const cartCount = cartItems.reduce((s, it) => s + it.qty, 0);
  const cartTotal = cartItems.reduce((s, it) => s + it.product.price * it.qty, 0);
  const currency = cartItems[0]?.product.currency ?? data?.store.currency ?? 'XOF';

  const buildWhatsAppOrder = (): string => {
    if (cartItems.length === 0 || !data?.whatsappBusinessNumber) return '#';
    const lines = cartItems.map(it =>
      `• ${it.qty}× ${it.product.name}${it.variant ? ` (${it.variant})` : ''} — ${formatPrice(it.product.price * it.qty, it.product.currency)}`
    );
    const msg =
      `Bonjour, je voudrais commander :\n\n` +
      `${lines.join('\n')}\n\n` +
      `*Total : ${formatPrice(cartTotal, currency)}*\n\n` +
      `Merci de me confirmer la disponibilité et la livraison. 🙏`;
    return `https://wa.me/${data.whatsappBusinessNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  };

  // Total quantity of a product across all its variants (for the "X in cart" hint)
  const qtyForProduct = (productId: string): number =>
    Object.entries(cart).reduce((sum, [k, q]) => {
      return parseCartKey(k).productId === productId ? sum + q : sum;
    }, 0);

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: C.ink }}>
      <style>{STYLES}</style>

      {/* TOP NAV — premium dark-green ribbon */}
      <div style={{
        background: 'rgba(10, 61, 46, 0.98)', backdropFilter: 'blur(20px)',
        padding: '14px 20px', position: 'sticky', top: 0, zIndex: 40,
        borderBottom: '1px solid rgba(254, 247, 231, 0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {data?.store.logoUrl ? (
            <img src={data.store.logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 34, height: 34,
              background: `linear-gradient(135deg, ${C.cream}, ${C.creamSoft})`,
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.greenDeep, fontWeight: 800, fontSize: 16,
            }} className="display-font">
              {(data?.store.name ?? 'O').slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="display-font" style={{
            color: C.cream, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
          }}>
            {data?.store.name ?? 'Boutique'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data?.whatsappBusinessNumber && (
            <a href={`https://wa.me/${data.whatsappBusinessNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour, j\'ai une question.')}`}
              target="_blank" rel="noopener noreferrer"
              aria-label="WhatsApp"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(37, 211, 102, 0.18)', color: '#25D366',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none', border: 'none',
              }}>
              <MessageCircle size={16} />
            </a>
          )}
        </div>
      </div>

      {/* HERO BANNER — premium gold-accented headline */}
      <div className="grain" style={{
        background: data?.store.coverImageUrl
          ? `linear-gradient(135deg, rgba(10,61,46,0.92), rgba(19,78,58,0.92) 50%, rgba(10,61,46,0.94)), url(${data.store.coverImageUrl})`
          : `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.greenMid} 50%, ${C.greenDeep} 100%)`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        padding: '32px 24px 40px', position: 'relative', overflow: 'hidden',
        color: C.cream,
      }}>
        {/* Subtle glow circles */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, background: 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -80, left: '20%', width: 220, height: 220, background: 'radial-gradient(circle, rgba(254,247,231,0.08), transparent 70%), borderRadius: 50%' }} />

        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative' }}>
          {/* Promo badge — only when at least one product is featured */}
          {featuredItems.length > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
              padding: '5px 12px', borderRadius: 20, marginBottom: 14,
            }}>
              <span className="blink-dot" style={{ width: 6, height: 6, background: C.gold, borderRadius: '50%' }} />
              <span style={{ color: C.goldSoft, fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>
                {featuredItems.length} COUP{featuredItems.length > 1 ? 'S' : ''} DE CŒUR EN VEDETTE
              </span>
            </div>
          )}
          <h1 className="display-font" style={{
            fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, margin: 0,
            lineHeight: 1.08, letterSpacing: '-0.03em', color: C.cream,
          }}>
            {loading ? 'Chargement…' : (data?.store.name ?? 'Boutique')}
          </h1>
          {data && (data.store.tagline || data.store.shortDescription) && (
            <PublicTagline store={data.store as any} color={C.gold} dark />
          )}
          {data && data.products.length > 0 && (
            <p style={{ marginTop: 10, fontSize: 13, color: 'rgba(254,247,231,0.7)', maxWidth: 420, lineHeight: 1.5 }}>
              {data.products.length} produit{data.products.length > 1 ? 's' : ''} · Commande WhatsApp · {data.store.paymentInstructions ? 'Paiement à la livraison ou Wave/OM' : 'Paiement à la livraison'}
            </p>
          )}
          {data && (
            <div style={{ marginTop: 14 }}>
              <PublicSocials store={data.store as any} color={C.gold} compact />
            </div>
          )}
          {data && data.whatsappBusinessNumber && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <a href={`#products`}
                style={{
                  background: C.cream, color: C.greenDeep, border: 'none',
                  padding: '10px 18px', borderRadius: 24,
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}>
                Découvrir <ArrowRight size={14} />
              </a>
              <a href={`https://wa.me/${data.whatsappBusinessNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Bonjour, j\'aimerais un conseil personnalisé.')}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  background: 'transparent', color: C.cream,
                  border: '1px solid rgba(254,247,231,0.3)',
                  padding: '10px 18px', borderRadius: 24,
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}>
                <MessageCircle size={14} color="#25D366" /> Conseil perso
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Search bar (overlapping) */}
      {data && data.products.length > 0 && (
        <div style={{ maxWidth: 1080, margin: '-22px auto 0', padding: '0 20px', position: 'relative', zIndex: 2 }}>
          <div style={{
            background: C.cream, borderRadius: 16, padding: '12px 16px',
            boxShadow: '0 16px 40px -16px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Search size={18} color={C.inkSoft} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit, une catégorie…"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 15, color: C.ink, fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      )}

      {/* STORIES BAR — Instagram-style category circles */}
      {data && Object.keys(byCategory).length > 0 && (
        <div style={{
          background: 'rgba(10, 61, 46, 0.5)', padding: '18px 20px',
          display: 'flex', gap: 14, overflowX: 'auto', scrollbarWidth: 'none',
        }} className="scroll-x">
          {/* Featured shortcut */}
          {featuredItems.length > 0 && (
            <button onClick={() => { setSearch(''); document.getElementById('featured-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'center', flexShrink: 0, padding: 0 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.gold}, ${C.red})`,
                padding: 2,
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: C.greenDeep,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>
                  🔥
                </div>
              </div>
              <span style={{ color: C.cream, fontSize: 10, marginTop: 6, display: 'block', fontWeight: 600 }}>Hot deals</span>
            </button>
          )}
          {/* Real categories as circles */}
          {Object.keys(byCategory).slice(0, 12).map((cat, i) => {
            const first = byCategory[cat][0];
            const img = first ? productImages(first)[0] : null;
            const gradients = [
              [C.cream, C.creamSoft],
              [C.rareFrom, C.rareTo],
              [C.emeraldDeep, C.emerald],
              ['#d4dde8', '#b8c5d4'],
              [C.gold, C.goldSoft],
              ['#2d1810', '#4a2818'],
            ];
            const g = gradients[i % gradients.length];
            return (
              <button key={cat} onClick={() => { setSearch(cat); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'center', flexShrink: 0, padding: 0 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
                  padding: 2,
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: img ? '#000' : C.greenDeep, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: C.cream, fontWeight: 700,
                  }}>
                    {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : cat.slice(0, 4)}
                  </div>
                </div>
                <span style={{
                  color: 'rgba(254,247,231,0.85)', fontSize: 10, marginTop: 6, display: 'block', fontWeight: 600,
                  maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{cat}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '36px 24px 64px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.cream }}>
            <Loader2 size={28} className="spin" color={C.emerald} />
            <div style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.8)' }}>Chargement de la boutique…</div>
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: C.cream, borderRadius: 16, padding: 24,
            textAlign: 'center', maxWidth: 480, margin: '40px auto',
          }}>
            <AlertCircle size={32} color={C.red} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
              Boutique indisponible
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>{error}</div>
          </div>
        )}

        {data && data.products.length === 0 && !loading && (
          <div style={{
            background: C.cream, borderRadius: 16, padding: 32,
            textAlign: 'center', maxWidth: 480, margin: '40px auto',
          }}>
            <ShoppingBag size={36} color={C.emeraldDeep} style={{ marginBottom: 10 }} />
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
              Pas encore de produits
            </div>
            <div style={{ fontSize: 13, color: C.inkSoft }}>Reviens bientôt — la boutique se remplit.</div>
          </div>
        )}

        {data && filtered.length === 0 && data.products.length > 0 && !loading && (
          <div style={{
            background: C.cream, borderRadius: 16, padding: 24,
            textAlign: 'center', maxWidth: 420, margin: '40px auto',
          }}>
            <Search size={28} color={C.inkSoft} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, color: C.inkSoft }}>Aucun résultat pour "{search}".</div>
          </div>
        )}

        {/* Featured carousel — horizontal swipe of starred items */}
        {data && featuredItems.length > 0 && (
          <section id="featured-section" style={{ marginBottom: 36 }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Sélection du moment
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                <h2 className="display-font" style={{
                  fontSize: 28, fontWeight: 800, color: C.cream, margin: 0,
                  letterSpacing: '-0.02em',
                }}>
                  <Star size={22} color={C.goldSoft} fill={C.goldSoft} className="star-bounce" style={{ verticalAlign: '-3px', marginRight: 4 }} />
                  Coups de cœur
                </h2>
                <span style={{ fontSize: 12, color: 'rgba(254,247,231,0.6)' }}>
                  {featuredItems.length} sélection{featuredItems.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="scroll-x" style={{
              display: 'flex', gap: 16, paddingBottom: 6,
            }}>
              {featuredItems.map(p => (
                <div key={p.id} className="snap-card" style={{ flex: '0 0 260px', minWidth: 260 }}>
                  <ProductCard
                    product={p}
                    whatsappNumber={data.whatsappBusinessNumber}
                    qty={qtyForProduct(p.id)}
                    onAdd={(v) => addToCart(p.id, v)}
                    onRemove={(v) => removeFromCart(p.id, v)}
                    onQuickView={() => setQuickView(p)}
                    featured
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {data && nonFeatured.length > 0 && Object.entries(byCategory).map(([category, prods], idx) => (
          <section key={category} id={idx === 0 ? 'products' : undefined} style={{ marginBottom: 36 }}>
            {(Object.keys(byCategory).length > 1 || featuredItems.length > 0) && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Collection
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                  <h2 className="display-font" style={{
                    fontSize: 26, fontWeight: 700, color: C.cream, margin: 0,
                    letterSpacing: '-0.02em',
                  }}>
                    {category}
                  </h2>
                  <span style={{ fontSize: 12, color: 'rgba(254,247,231,0.6)' }}>
                    {prods.length} produit{prods.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
            <div className="stagger" style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16,
            }}>
              {prods.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  whatsappNumber={data.whatsappBusinessNumber}
                  qty={qtyForProduct(p.id)}
                  onAdd={(v) => addToCart(p.id, v)}
                  onRemove={(v) => removeFromCart(p.id, v)}
                  onQuickView={() => setQuickView(p)}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Trust band — premium 4-column reassurance */}
        {data && data.products.length > 0 && (
          <div style={{
            marginTop: 48,
            background: 'rgba(0,0,0,0.2)', padding: '20px 18px', borderRadius: 16,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14,
          }}>
            {[
              { icon: Truck, label: 'Livraison rapide', sub: data.store.address ? data.store.address.split(',')[0] : 'Local' },
              { icon: ShoppingBag, label: 'Payez à la livraison', sub: data.store.paymentInstructions ? 'Cash, Wave ou OM' : 'Cash ou mobile money' },
              ...(data.store.openingHours ? [{ icon: Clock, label: 'Horaires', sub: data.store.openingHours }] : [{ icon: Shield, label: 'Service vérifié', sub: 'Orlode AI' }]),
              { icon: MessageCircle, label: 'Support WhatsApp', sub: '7j/7' },
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'rgba(245,158,11,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <t.icon size={16} color={C.gold} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: C.cream, fontSize: 11, fontWeight: 700 }}>{t.label}</div>
                  <div style={{ color: 'rgba(254,247,231,0.5)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Powered by Orlode — small, classy */}
        {data && data.products.length > 0 && (
          <div style={{
            marginTop: 18, padding: '14px 18px', borderRadius: 12,
            background: 'rgba(255,250,240,0.04)', border: '1px solid rgba(255,250,240,0.08)',
            textAlign: 'center', color: 'rgba(254,247,231,0.6)', fontSize: 11,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={11} color={C.gold} /> Boutique propulsée par <strong style={{ color: C.cream }}>Orlode AI</strong>
            </span>
          </div>
        )}

        {/* Bottom spacer so sticky bar doesn't cover footer when cart open */}
        {cartCount > 0 && <div style={{ height: 96 }} />}
      </div>

      {/* ── Sticky bottom cart bar (premium gold gradient) ──────────── */}
      {cartCount > 0 && data?.whatsappBusinessNumber && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: 'rgba(10,61,46,0.98)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(254,247,231,0.10)',
          padding: '12px 16px', boxShadow: '0 -8px 30px -6px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            maxWidth: 1080, margin: '0 auto',
            display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center',
          }}>
            <button onClick={() => setCartOpen(true)} aria-label="Voir le panier" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 14px', borderRadius: 24,
              background: 'rgba(254,247,231,0.08)', color: C.cream,
              border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
            }}>
              <div style={{ position: 'relative' }}>
                <ShoppingBag size={18} color={C.cream} />
                <span style={{
                  position: 'absolute', top: -6, right: -8,
                  background: C.gold, color: '#fff',
                  width: 16, height: 16, borderRadius: 8,
                  fontSize: 9, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{cartCount}</span>
              </div>
              <span className="display-font" style={{ fontSize: 13, color: C.cream }}>
                {formatPrice(cartTotal, currency)}
              </span>
            </button>
            <div style={{ fontSize: 11, color: 'rgba(254,247,231,0.5)', textAlign: 'center' }}>
              <MessageCircle size={12} style={{ verticalAlign: '-2px', color: '#25D366' }} /> {cartCount} article{cartCount > 1 ? 's' : ''} · Commande WhatsApp
            </div>
            <a
              href={buildWhatsAppOrder()}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 24,
                background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`, color: C.cream,
                textDecoration: 'none',
                fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
                whiteSpace: 'nowrap',
              }}
            >
              Commander <ArrowRight size={13} />
            </a>
          </div>
        </div>
      )}

      {/* ── Floating WhatsApp button (always visible — direct contact) ─── */}
      {data?.whatsappBusinessNumber && (
        <a
          href={`https://wa.me/${data.whatsappBusinessNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${data.store.name}, j'ai une question.`)}`}
          target="_blank" rel="noopener noreferrer"
          aria-label="Contacter sur WhatsApp"
          style={{
            position: 'fixed',
            bottom: cartCount > 0 ? 88 : 24,
            right: 20, zIndex: 60,
            width: 56, height: 56, borderRadius: '50%',
            background: '#25D366', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 28px -6px rgba(37,211,102,0.55), 0 4px 12px rgba(0,0,0,0.18)',
            textDecoration: 'none',
            transition: 'bottom .2s ease',
          }}
          className="pulse-icon"
        >
          <MessageCircle size={26} fill="#fff" strokeWidth={0} />
        </a>
      )}

      {/* ── Footer with store details ──────────────────────────────────── */}
      {data && (data.store.address || data.store.googleMapsUrl || data.store.openingHours) && (
        <div style={{
          background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(6px)',
          borderTop: '1px solid rgba(255,250,240,0.10)',
          padding: '32px 24px 96px', color: 'rgba(255,250,240,0.85)',
        }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <div className="display-font" style={{
              fontSize: 18, fontWeight: 700, color: C.cream, marginBottom: 14, letterSpacing: '-0.01em',
            }}>
              Trouve-nous
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {data.store.address && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <MapPin size={16} color={data.store.accentColor ?? C.emerald} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Adresse</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{data.store.address}</div>
                    {data.store.googleMapsUrl && (
                      <a href={data.store.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, fontWeight: 700, color: data.store.accentColor ?? C.emerald, textDecoration: 'none' }}>
                        Itinéraire <ArrowRight size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )}
              {data.store.openingHours && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Clock size={16} color={data.store.accentColor ?? C.emerald} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horaires</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{data.store.openingHours}</div>
                  </div>
                </div>
              )}
              {data.whatsappBusinessNumber && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <MessageCircle size={16} color="#25D366" />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WhatsApp</div>
                    <div style={{ fontSize: 13, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>{data.whatsappBusinessNumber}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick view modal — full product page (gallery + description) ── */}
      {quickView && data && (
        <QuickViewModal
          product={quickView}
          accentColor={data.store.accentColor ?? C.emerald}
          accentDeep={data.store.accentColor ? darken(data.store.accentColor) : C.emeraldDeep}
          qty={qtyForProduct(quickView.id)}
          onAdd={(v) => addToCart(quickView.id, v)}
          onRemove={(v) => removeFromCart(quickView.id, v)}
          onClose={() => setQuickView(null)}
        />
      )}

      {/* ── Cart drawer modal ────────────────────────────────────────── */}
      {cartOpen && (
        <div
          onClick={() => setCartOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(6,21,16,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'flex-end',
            animation: 'slideIn .25s ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(440px, 100%)', height: '100%',
              background: C.cream, color: C.ink,
              display: 'flex', flexDirection: 'column',
              boxShadow: '-20px 0 40px -10px rgba(0,0,0,0.3)',
            }}
          >
            {/* Drawer header */}
            <div style={{
              padding: '18px 20px',
              background: data?.store.accentColor ?? C.emeraldDeep,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShoppingBag size={20} />
                <h2 className="display-font" style={{
                  margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
                }}>
                  Mon panier
                </h2>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label="Fermer" style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,250,240,0.16)', color: C.cream,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={18} />
              </button>
            </div>

            {/* Items list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 16px', color: C.inkSoft }}>
                  <ShoppingBag size={32} color={C.inkLight} style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 14 }}>Votre panier est vide.</div>
                </div>
              ) : (
                cartItems.map(({ key, product, qty, variant }) => (
                  <div key={key} style={{
                    display: 'grid', gridTemplateColumns: '64px 1fr auto',
                    gap: 12, alignItems: 'center',
                    padding: '12px 4px',
                    borderBottom: `1px solid ${C.creamDeep}`,
                  }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
                      background: product.imageUrl ? '#000' : C.creamDeep,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon size={20} color={C.inkLight} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="display-font" style={{
                        fontSize: 14, fontWeight: 700, color: C.ink,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {product.name}
                      </div>
                      {variant && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, marginTop: 2 }}>
                          Taille : <span style={{ color: C.greenDeep, background: C.creamDeep, padding: '1px 6px', borderRadius: 4 }}>{variant}</span>
                        </div>
                      )}
                      <div className="mono-font" style={{
                        fontSize: 13, color: C.emeraldDeep, fontWeight: 700, marginTop: 2,
                      }}>
                        {formatPrice(product.price * qty, product.currency)}
                      </div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        marginTop: 8,
                        background: C.creamDeep, borderRadius: 8, padding: 2,
                      }}>
                        <button
                          onClick={() => removeFromCart(product.id, variant)}
                          aria-label="Retirer 1"
                          style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: C.ink, fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                          }}
                        >−</button>
                        <input
                          type="number" min={1} max={99} value={qty}
                          onChange={e => setQty(key, parseInt(e.target.value, 10) || 0)}
                          style={{
                            width: 36, textAlign: 'center',
                            background: 'transparent', border: 'none', outline: 'none',
                            fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: 'inherit',
                          }}
                        />
                        <button
                          onClick={() => addToCart(product.id, variant)}
                          aria-label="Ajouter 1"
                          style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: C.ink, fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                          }}
                        >+</button>
                      </div>
                    </div>
                    <button
                      onClick={() => setQty(key, 0)}
                      aria-label="Supprimer"
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'transparent', color: C.red,
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
              {cartItems.length > 0 && (
                <button
                  onClick={clearCart}
                  style={{
                    marginTop: 12, padding: '8px 12px',
                    background: 'transparent', color: C.inkSoft,
                    border: 'none', cursor: 'pointer',
                    fontSize: 12, fontFamily: 'inherit', textDecoration: 'underline',
                  }}
                >
                  Vider le panier
                </button>
              )}
            </div>

            {/* Drawer footer with total + checkout */}
            {cartItems.length > 0 && (
              <div style={{
                padding: 16, borderTop: `1px solid ${C.creamDeep}`,
                background: C.cream,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 12,
                }}>
                  <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>
                    Total
                  </span>
                  <span className="mono-font" style={{
                    fontSize: 22, fontWeight: 800, color: C.emeraldDeep,
                  }}>
                    {formatPrice(cartTotal, currency)}
                  </span>
                </div>
                {data?.whatsappBusinessNumber ? (
                  <a
                    href={buildWhatsAppOrder()}
                    target="_blank" rel="noopener noreferrer"
                    onClick={() => setCartOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '14px 18px', borderRadius: 12,
                      background: '#25D366', color: '#fff', textDecoration: 'none',
                      fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                      boxShadow: '0 8px 20px -6px rgba(37,211,102,0.55)',
                    }}
                  >
                    <MessageCircle size={18} /> Commander sur WhatsApp
                    <ArrowRight size={16} />
                  </a>
                ) : (
                  <button disabled style={{
                    width: '100%', padding: '14px 18px', borderRadius: 12,
                    background: C.creamDeep, color: C.inkLight,
                    border: 'none', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                    cursor: 'not-allowed',
                  }}>
                    WhatsApp non configuré
                  </button>
                )}
                <div style={{
                  marginTop: 10, fontSize: 11, color: C.inkSoft, textAlign: 'center',
                }}>
                  Vous serez redirigé vers WhatsApp avec votre commande pré-remplie.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {data && <PublicContactBar store={data.store as any} color={C.greenDeep} primaryCta={{ label: 'Commander', href: '#products' }} />}
      <PublicLangSwitcher dark />
    </div>
  );
}

function ProductCard({ product, whatsappNumber, qty, onAdd, onRemove, onQuickView, featured }: {
  product: PublicProduct;
  whatsappNumber: string | null;
  qty: number;                                    // total across variants
  onAdd: (variant?: string) => void;
  onRemove: (variant?: string) => void;
  onQuickView?: () => void;
  featured?: boolean;
}) {
  const formatted = formatPrice(product.price, product.currency);
  const inCart = qty > 0;
  const images = productImages(product);
  const heroImage = images[0] ?? null;
  const altImage = images[1] ?? null; // shown on hover (desktop)
  const lowStock = (product.stockQty ?? 0) > 0 && (product.stockQty ?? 0) <= 3;
  const variantLabels = (product.variants ?? [])
    .map(v => (v.name ?? v.size ?? v.color ?? '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const hasVariants = variantLabels.length > 0;
  const [selectedVariant, setSelectedVariant] = useState<string | null>(
    hasVariants && variantLabels.length === 1 ? variantLabels[0] : null,
  );

  return (
    <article className="pcard" style={{
      background: C.cream, borderRadius: 16, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', cursor: onQuickView ? 'pointer' : 'default',
      boxShadow: '0 6px 20px -8px rgba(0,0,0,0.25)',
      border: featured ? `2px solid ${C.gold}` : '2px solid transparent',
    }}>
      {/* Image — 3:4 aspect for premium fashion feel */}
      <div onClick={onQuickView} style={{
        position: 'relative',
        aspectRatio: '3/4',
        background: heroImage
          ? '#000'
          : `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
        overflow: 'hidden',
      }}>
        {heroImage ? (
          <>
            <img className="zoom-img" src={heroImage} alt={product.name} loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {altImage && (
              <img src={altImage} alt="" loading="lazy"
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%', objectFit: 'cover',
                  opacity: 0, transition: 'opacity .3s ease', pointerEvents: 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')} />
            )}
          </>
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.cream,
          }}>
            <ImageIcon size={36} />
          </div>
        )}

        {/* Top-left stacked badges (category + featured) */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'flex', flexDirection: 'column', gap: 4, zIndex: 2,
        }}>
          {product.category && (() => {
            // Prefer the specific subcategory chip (Polo) over the parent (Vêtements)
            const norm = normalizeCategory(product.category);
            const label = product.subcategory ?? norm.child ?? norm.parent;
            return (
              <span style={{
                background: 'rgba(254, 247, 231, 0.95)', color: C.greenDeep,
                padding: '3px 10px', borderRadius: 14,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                backdropFilter: 'blur(6px)',
              }}>
                {label}
              </span>
            );
          })()}
          {featured && (
            <span style={{
              background: C.gold, color: '#fff',
              padding: '3px 8px', borderRadius: 12,
              fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              boxShadow: '0 4px 10px -2px rgba(245,158,11,0.5)',
            }}>
              <Star size={10} fill="#fff" strokeWidth={0} /> #1 VENTE
            </span>
          )}
        </div>

        {/* Image-count indicator (top-right) */}
        {images.length > 1 && (
          <div style={{
            position: 'absolute', top: 10, right: 10, zIndex: 2,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            padding: '3px 8px', borderRadius: 100,
            fontSize: 10, fontWeight: 700, backdropFilter: 'blur(4px)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <ImageIcon size={9} /> {images.length}
          </div>
        )}

        {/* Low-stock urgency tag (bottom-left, pulse animated) */}
        {lowStock && (
          <div className="pulse-ring" style={{
            position: 'absolute', bottom: 10, left: 10, zIndex: 2,
            background: C.red, color: '#fff',
            padding: '3px 9px', borderRadius: 100,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.03em',
          }}>
            🔥 Plus que {product.stockQty} !
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Star/views micro-context (only when relevant) */}
        {lowStock && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 11 }}>👀</span>
            <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>
              Stock limité — réservez vite
            </span>
          </div>
        )}
        {featured && !lowStock && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Star size={11} fill={C.gold} strokeWidth={0} color={C.gold} />
            <span style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>
              Recommandé par la boutique
            </span>
          </div>
        )}

        <h3 className="display-font" style={{
          fontSize: 14, fontWeight: 700, color: C.greenDeep, margin: '0 0 8px',
          lineHeight: 1.25, letterSpacing: '-0.01em',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {product.name}
        </h3>

        {hasVariants && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {variantLabels.map(label => {
              const sel = selectedVariant === label;
              return (
                <button key={label} type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedVariant(label); }}
                  style={{
                    fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                    color: sel ? C.cream : '#374151',
                    background: sel ? C.greenDeep : '#e5e7eb',
                    border: 'none', padding: '3px 8px', borderRadius: 5,
                    cursor: 'pointer', minWidth: 24,
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          <div className="display-font" style={{
            fontSize: 18, fontWeight: 800, color: C.emeraldDeep, marginBottom: 8,
            display: 'flex', alignItems: 'baseline', gap: 4,
          }}>
            {formatted}
          </div>

          {!whatsappNumber ? (
            <button disabled style={{
              width: '100%', padding: '8px', borderRadius: 8,
              background: '#e5e7eb', color: C.inkLight,
              border: 'none', fontWeight: 600, fontSize: 11, fontFamily: 'inherit',
              cursor: 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <CheckCircle2 size={12} /> Bientôt disponible
            </button>
          ) : hasVariants && !selectedVariant ? (
            <button disabled style={{
              width: '100%', padding: '8px', borderRadius: 8,
              background: '#fff', color: C.greenDeep,
              border: `1.5px dashed ${C.greenDeep}50`, fontWeight: 700, fontSize: 11, fontFamily: 'inherit',
              cursor: 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              👆 Choisis une taille
            </button>
          ) : !inCart ? (
            <button onClick={(e) => { e.stopPropagation(); onAdd(selectedVariant ?? undefined); }} style={{
              width: '100%', padding: '8px', borderRadius: 8,
              background: lowStock ? C.greenDeep : C.emeraldDeep, color: C.cream,
              border: 'none', fontWeight: 600, fontSize: 11, fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxShadow: lowStock ? `0 4px 10px -2px rgba(10,61,46,0.4)` : `0 4px 10px -2px rgba(5,150,105,0.4)`,
            }}>
              {lowStock ? <>⚡ Vite !</> : <><Plus size={12} /> Ajouter{selectedVariant ? ` · ${selectedVariant}` : ''}</>}
            </button>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 4, alignItems: 'center',
              background: C.emeraldDeep, borderRadius: 8, padding: 3,
              boxShadow: `0 4px 10px -2px rgba(5,150,105,0.4)`,
            }}>
              <button onClick={(e) => { e.stopPropagation(); onRemove(selectedVariant ?? undefined); }} aria-label="Retirer 1" style={{
                width: 30, height: 30, borderRadius: 6,
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>−</button>
              <div style={{
                color: '#fff', fontWeight: 700, fontSize: 12, textAlign: 'center',
                display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center',
              }}>
                <ShoppingBag size={11} /> {qty}{selectedVariant ? ` · ${selectedVariant}` : ''}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onAdd(selectedVariant ?? undefined); }} aria-label="Ajouter 1" style={{
                width: 30, height: 30, borderRadius: 6,
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>+</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Quick view modal — magazine-style product page ───────────────────────────
function QuickViewModal({ product, accentColor, accentDeep, qty, onAdd, onRemove, onClose }: {
  product: PublicProduct;
  accentColor: string;
  accentDeep: string;
  qty: number;
  onAdd: (variant?: string) => void;
  onRemove: (variant?: string) => void;
  onClose: () => void;
}) {
  const images = productImages(product);
  const [active, setActive] = useState(0);
  const inCart = qty > 0;
  const formatted = formatPrice(product.price, product.currency);
  const variantLabels = (product.variants ?? [])
    .map(v => (v.name ?? v.size ?? v.color ?? '').trim())
    .filter(Boolean);
  const hasVariants = variantLabels.length > 0;
  const [selectedVariant, setSelectedVariant] = useState<string | null>(
    hasVariants && variantLabels.length === 1 ? variantLabels[0] : null,
  );

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 110, padding: 12,
      background: 'rgba(6,21,16,0.78)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 22,
        maxWidth: 900, width: '100%',
        maxHeight: 'calc(100vh - 24px)',
        margin: 'auto',
        display: 'grid', gridTemplateColumns: images.length > 0 ? '1fr 1fr' : '1fr',
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6)',
        overflow: 'hidden', minHeight: 0,
      }}>
        {/* Left: Gallery */}
        {images.length > 0 && (
          <div style={{ background: '#000', position: 'relative', minHeight: 320 }}>
            <img src={images[active]} alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', maxHeight: 'calc(100vh - 24px)' }} />
            {images.length > 1 && (
              <>
                <button onClick={() => setActive(i => (i - 1 + images.length) % images.length)} aria-label="Précédente"
                  style={{
                    position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
                  }}>
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setActive(i => (i + 1) % images.length)} aria-label="Suivante"
                  style={{
                    position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
                  }}>
                  <ChevronRight size={18} />
                </button>
                <div style={{
                  position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', gap: 4,
                }}>
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setActive(i)} aria-label={`Image ${i + 1}`}
                      style={{
                        width: i === active ? 22 : 8, height: 6, borderRadius: 4,
                        background: i === active ? '#fff' : 'rgba(255,255,255,0.5)',
                        border: 'none', cursor: 'pointer', transition: 'all .2s ease',
                      }} />
                  ))}
                </div>
              </>
            )}
            {product.featured && (
              <div style={{
                position: 'absolute', top: 12, left: 12,
                background: '#FCD34D', color: '#78350F',
                padding: '5px 11px', borderRadius: 100,
                fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Star size={10} fill="#78350F" /> COUP DE CŒUR
              </div>
            )}
          </div>
        )}

        {/* Right: Details */}
        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            {product.category && (
              <span style={{
                display: 'inline-block', padding: '4px 10px', borderRadius: 100,
                background: `${accentColor}15`, color: accentDeep,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {product.category}
              </span>
            )}
            <button onClick={onClose} aria-label="Fermer"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: C.creamDeep, color: C.inkSoft, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <X size={16} />
            </button>
          </div>

          <h2 className="display-font" style={{
            fontSize: 26, fontWeight: 800, color: C.ink, margin: '0 0 8px',
            letterSpacing: '-0.02em', lineHeight: 1.15,
          }}>
            {product.name}
          </h2>

          <div className="mono-font" style={{
            fontSize: 24, fontWeight: 800, color: accentDeep, marginBottom: 16,
          }}>
            {formatted}
          </div>

          {product.description && (
            <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6, margin: '0 0 16px' }}>
              {product.description}
            </p>
          )}

          {product.videoUrl && /^https?:/.test(product.videoUrl) && (
            <a href={product.videoUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: '#000', color: '#fff', textDecoration: 'none',
                fontSize: 11, fontWeight: 700, marginBottom: 14, alignSelf: 'flex-start',
              }}>
              ▶ Voir la vidéo
            </a>
          )}

          {hasVariants && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Taille / variante {!selectedVariant && <span style={{ color: '#DC2626', textTransform: 'none', letterSpacing: 0 }}>· requis</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {variantLabels.map(label => {
                  const sel = selectedVariant === label;
                  return (
                    <button key={label} type="button" onClick={() => setSelectedVariant(label)}
                      style={{
                        fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
                        color: sel ? '#fff' : C.ink,
                        background: sel ? accentDeep : C.creamDeep,
                        border: `1.5px solid ${sel ? accentDeep : 'transparent'}`,
                        padding: '7px 14px', borderRadius: 10,
                        cursor: 'pointer', minWidth: 44,
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(product.stockQty ?? 0) > 0 && (product.stockQty ?? 0) <= 3 && (
            <div style={{
              padding: '8px 12px', borderRadius: 10,
              background: '#FEE2E2', color: '#991B1B',
              fontSize: 12, fontWeight: 700, marginBottom: 14,
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            }}>
              🔥 Plus que {product.stockQty} en stock
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 8 }}>
            {hasVariants && !selectedVariant ? (
              <button disabled style={{
                width: '100%', padding: '14px 18px', borderRadius: 12,
                background: C.creamDeep, color: C.inkSoft,
                border: `2px dashed ${accentDeep}40`, fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                cursor: 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                👆 Choisis une taille
              </button>
            ) : !inCart ? (
              <button onClick={() => onAdd(selectedVariant ?? undefined)} style={{
                width: '100%', padding: '14px 18px', borderRadius: 12,
                background: accentDeep, color: '#fff',
                border: 'none', fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 10px 24px -8px ${accentColor}80`,
              }}>
                <Plus size={18} /> Ajouter au panier{selectedVariant ? ` · ${selectedVariant}` : ''}
              </button>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 6, alignItems: 'center',
                background: accentDeep, borderRadius: 12, padding: 6,
                boxShadow: `0 10px 24px -8px ${accentColor}80`,
              }}>
                <button onClick={() => onRemove(selectedVariant ?? undefined)} aria-label="Retirer 1" style={{
                  width: 44, height: 44, borderRadius: 8,
                  background: 'rgba(255,255,255,0.18)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 22, fontWeight: 700, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>−</button>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, textAlign: 'center' }}>
                  {qty}{selectedVariant ? ` · ${selectedVariant}` : ''} dans le panier
                </div>
                <button onClick={() => onAdd(selectedVariant ?? undefined)} aria-label="Ajouter 1" style={{
                  width: 44, height: 44, borderRadius: 8,
                  background: 'rgba(255,255,255,0.18)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 22, fontWeight: 700, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
