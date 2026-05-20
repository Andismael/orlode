/**
 * StoreHeroBranding — admin-side hero branding strip used by every pack
 * redesign page (Boutique, Restaurant, Hôtel, Résidence, Salon, Cabinet,
 * Immobilier).
 *
 * Renders:
 *   - Store logo (logoUrl) as a 56-72px rounded square, if uploaded
 *   - Store tagline (italic, accent color), if set
 *   - Short description, if set
 *
 * Pack pages already render the store name in a big <h1> — this component
 * mounts ABOVE OR ALONGSIDE that title without duplicating it.
 *
 * Also exports:
 *   - resolveAccent(store, fallback) : returns store.accentColor if it looks
 *     valid (#RRGGBB), else the pack's default. Use this to override gradients
 *     and CTA backgrounds so the merchant's chosen color shows up everywhere.
 */
import React from 'react';

export interface BrandingStore {
  name?: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  accentColor?: string | null;
  tagline?: string | null;
  shortDescription?: string | null;
}

/** Return store.accentColor if valid (#RRGGBB), else the pack default. */
export function resolveAccent(store: BrandingStore | null | undefined, fallback: string): string {
  const c = store?.accentColor;
  if (typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)) return c;
  return fallback;
}

/** Compact branding row: logo + (tagline / shortDescription).
 *  Drop this right under the existing pack <h1> store name. */
export function StoreHeroBranding({ store, accent, dark = false, compact = false }: {
  store: BrandingStore;
  accent: string;
  /** Hero is on dark gradient → use light text. */
  dark?: boolean;
  /** Smaller logo + tighter spacing for sticky bars. */
  compact?: boolean;
}) {
  if (!store.logoUrl && !store.tagline && !store.shortDescription) return null;
  const logoSize = compact ? 44 : 64;
  const descColor = dark ? 'rgba(255,250,240,0.85)' : '#475569';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: compact ? 6 : 10, flexWrap: 'wrap' }}>
      {store.logoUrl && (
        <img
          src={store.logoUrl}
          alt={`Logo ${store.name ?? ''}`}
          style={{
            width: logoSize, height: logoSize, borderRadius: 14,
            objectFit: 'cover', flexShrink: 0,
            background: dark ? 'rgba(255,250,240,0.92)' : '#fff',
            border: dark ? '2px solid rgba(255,250,240,0.25)' : '1.5px solid rgba(31,41,55,0.08)',
            boxShadow: dark ? '0 12px 28px -8px rgba(0,0,0,.4)' : '0 6px 16px -8px rgba(0,0,0,.15)',
          }}
        />
      )}
      {(store.tagline || store.shortDescription) && (
        <div style={{ flex: 1, minWidth: 200 }}>
          {store.tagline && (
            <div style={{
              fontFamily: 'Fraunces, serif', fontStyle: 'italic',
              fontSize: compact ? 14 : 16, fontWeight: 500,
              color: accent, letterSpacing: '-0.01em',
              marginBottom: store.shortDescription ? 4 : 0,
            }}>
              « {store.tagline} »
            </div>
          )}
          {store.shortDescription && (
            <p style={{
              fontSize: compact ? 12 : 13, color: descColor,
              margin: 0, lineHeight: 1.5, maxWidth: 560,
            }}>
              {store.shortDescription}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Small click-to-WhatsApp button — drop in any list row that has a customer
 *  phone number. Accessible label, 36×36 tap target, opens wa.me in a new tab. */
export function WhatsAppQuickButton({ phone, prefill, size = 'sm', className }: {
  phone: string | null | undefined;
  /** Optional message pre-fill (e.g. "Bonjour Adèle, votre commande #1234…"). */
  prefill?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const digits = String(phone ?? '').replace(/[^0-9]/g, '');
  if (digits.length < 7) return null;
  const url = prefill
    ? `https://wa.me/${digits}?text=${encodeURIComponent(prefill)}`
    : `https://wa.me/${digits}`;
  const dim = size === 'md' ? 36 : 30;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter sur WhatsApp"
      title="Contacter sur WhatsApp"
      className={className}
      onClick={e => e.stopPropagation()}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: dim, height: dim, borderRadius: 9,
        background: '#25D36615', color: '#128C7E',
        border: '1px solid #25D36630',
        textDecoration: 'none', flexShrink: 0,
        transition: 'all .15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#25D366'; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#25D36615'; e.currentTarget.style.color = '#128C7E'; }}
    >
      {/* WhatsApp glyph (simple monochrome — keeps bundle small) */}
      <svg width={size === 'md' ? 16 : 14} height={size === 'md' ? 16 : 14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    </a>
  );
}
