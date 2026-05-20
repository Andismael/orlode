/**
 * PublicBranding — shared building blocks for every public-facing store page
 * (PublicShop, PublicMenu, PublicHotel, PublicResidence, PublicSalon,
 * PublicHealth, PublicRealEstate).
 *
 * Each public page passes a `store` object (from /api/public/...) and the
 * components below render the marketing pieces that used to be hidden:
 *   - <PublicTagline />        : slogan + short description below the hero name
 *   - <PublicSocials />        : Insta · Facebook · TikTok · YouTube · X · web · email
 *   - <PublicContactBar />     : sticky CTA bar — WhatsApp, Telegram, call, email
 *
 * All accept an optional `accent` color so each pack keeps its identity.
 */
import React from 'react';
import {
  Instagram, Facebook, Youtube, Twitter, Globe, Mail,
  MessageCircle, Send, Phone,
} from 'lucide-react';

export interface PublicStoreBranding {
  name?: string;
  tagline?: string | null;
  shortDescription?: string | null;
  ownerPhone?: string | null;
  contactEmail?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  /** Optional Telegram username or t.me link, derived per-business in the future. */
  telegramUrl?: string | null;
}

const WA_GREEN = '#25D366';
const TG_BLUE  = '#0088CC';

const TiktokIcon = ({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M19.6 6.3c-1.5-.5-2.6-1.7-3-3.2H13v13.4c0 1.4-1.2 2.6-2.6 2.6S7.8 17.9 7.8 16.5s1.2-2.6 2.6-2.6c.3 0 .5 0 .8.1V10c-.3 0-.6-.1-.8-.1-3 0-5.4 2.4-5.4 5.4S7.4 21 10.4 21s5.4-2.4 5.4-5.4V9.4c1.1.8 2.4 1.3 3.8 1.3V7.2c-.4 0-.7-.1-1-.2 0 0 1 .1 1-.7z"/>
  </svg>
);

/** Slogan + 2-3 lines description, rendered below the page name. */
export function PublicTagline({ store, color, dark = false }: { store: PublicStoreBranding; color?: string; dark?: boolean }) {
  if (!store.tagline && !store.shortDescription) return null;
  const accent = color ?? '#7C3AED';
  const textColor = dark ? 'rgba(255,255,255,.92)' : '#475569';
  return (
    <div style={{ marginTop: 10, marginBottom: 14 }}>
      {store.tagline && (
        <div style={{
          fontFamily: 'Fraunces, serif', fontStyle: 'italic',
          fontSize: 'clamp(15px, 2.2vw, 19px)', fontWeight: 500,
          color: accent, marginBottom: store.shortDescription ? 6 : 0,
          letterSpacing: '-0.01em',
        }}>
          « {store.tagline} »
        </div>
      )}
      {store.shortDescription && (
        <p style={{
          fontSize: 'clamp(13px, 1.7vw, 15px)', color: textColor,
          margin: 0, lineHeight: 1.55, maxWidth: 620,
        }}>
          {store.shortDescription}
        </p>
      )}
    </div>
  );
}

/** Inline row of socials + email + website. Tap targets 36×36 min. */
export function PublicSocials({ store, color, compact = false }: { store: PublicStoreBranding; color?: string; compact?: boolean }) {
  const items: Array<{ href: string; icon: React.ReactNode; label: string; color: string }> = [];
  if (store.instagramUrl) items.push({ href: store.instagramUrl, icon: <Instagram size={compact ? 14 : 16} />, label: 'Instagram', color: '#E4405F' });
  if (store.facebookUrl)  items.push({ href: store.facebookUrl,  icon: <Facebook  size={compact ? 14 : 16} />, label: 'Facebook',  color: '#1877F2' });
  if (store.tiktokUrl)    items.push({ href: store.tiktokUrl,    icon: <TiktokIcon size={compact ? 14 : 16} />, label: 'TikTok',    color: '#000000' });
  if (store.youtubeUrl)   items.push({ href: store.youtubeUrl,   icon: <Youtube   size={compact ? 14 : 16} />, label: 'YouTube',   color: '#FF0000' });
  if (store.twitterUrl)   items.push({ href: store.twitterUrl,   icon: <Twitter   size={compact ? 14 : 16} />, label: 'X',         color: '#000000' });
  if (store.websiteUrl)   items.push({ href: store.websiteUrl,   icon: <Globe     size={compact ? 14 : 16} />, label: 'Site web',  color: color ?? '#475569' });
  if (store.contactEmail) items.push({ href: `mailto:${store.contactEmail}`, icon: <Mail size={compact ? 14 : 16} />, label: 'Email', color: color ?? '#475569' });

  if (items.length === 0) return null;

  const size = compact ? 32 : 38;
  return (
    <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map(it => (
        <a key={it.label}
          href={it.href}
          target={it.href.startsWith('mailto:') ? undefined : '_blank'}
          rel="noopener noreferrer"
          aria-label={it.label}
          title={it.label}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: size, height: size, borderRadius: 10,
            background: '#fff', color: it.color,
            border: '1px solid rgba(31,41,55,.08)',
            textDecoration: 'none', transition: 'transform .15s ease, box-shadow .15s ease',
            minWidth: 44, minHeight: 44, // accessible tap target on mobile
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 14px -6px ${it.color}40`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
          {it.icon}
        </a>
      ))}
    </div>
  );
}

/** Sticky CTA bar at the bottom of public pages — WhatsApp / Telegram / call / email.
 *  Auto-hides items that aren't configured. Min 44px tap targets. */
export function PublicContactBar({ store, color, primaryCta }: {
  store: PublicStoreBranding;
  color?: string;
  /** Optional override for the primary CTA (e.g. "Réserver", "Commander"). */
  primaryCta?: { label: string; href: string };
}) {
  const phoneDigits = (store.ownerPhone ?? '').replace(/[^0-9]/g, '');
  const hasWA = phoneDigits.length >= 7;
  const hasTG = !!store.telegramUrl;
  const hasCall = phoneDigits.length >= 7;
  const hasEmail = !!store.contactEmail;
  const accent = color ?? '#0A2A20';

  if (!hasWA && !hasTG && !hasCall && !hasEmail && !primaryCta) return null;

  return (
    <>
      <div
        role="navigation"
        aria-label="Contacter le commerce"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
          background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(14px)',
          borderTop: '1px solid rgba(31,41,55,0.08)',
          padding: '10px max(14px, env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-right))',
          display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
        {hasWA && (
          <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noopener noreferrer"
            style={{
              flex: '1 1 auto', minWidth: 120, minHeight: 44,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: WA_GREEN, color: '#fff', textDecoration: 'none',
              padding: '11px 14px', borderRadius: 12, fontWeight: 700, fontSize: 14,
              boxShadow: `0 8px 20px -8px ${WA_GREEN}`,
            }}>
            <MessageCircle size={16} /> WhatsApp
          </a>
        )}
        {hasTG && (
          <a href={store.telegramUrl ?? '#'} target="_blank" rel="noopener noreferrer"
            style={{
              flex: '1 1 auto', minWidth: 110, minHeight: 44,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: TG_BLUE, color: '#fff', textDecoration: 'none',
              padding: '11px 14px', borderRadius: 12, fontWeight: 700, fontSize: 14,
            }}>
            <Send size={15} /> Telegram
          </a>
        )}
        {hasCall && (
          <a href={`tel:+${phoneDigits}`}
            style={{
              minWidth: 44, minHeight: 44,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: '#fff', color: accent, textDecoration: 'none',
              padding: '11px 14px', borderRadius: 12, fontWeight: 700, fontSize: 14,
              border: `1.5px solid ${accent}30`,
            }}>
            <Phone size={15} /> Appeler
          </a>
        )}
        {hasEmail && !hasCall && (
          <a href={`mailto:${store.contactEmail}`}
            style={{
              minWidth: 44, minHeight: 44,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: '#fff', color: accent, textDecoration: 'none',
              padding: '11px 14px', borderRadius: 12, fontWeight: 700, fontSize: 14,
              border: `1.5px solid ${accent}30`,
            }}>
            <Mail size={15} /> Email
          </a>
        )}
        {primaryCta && (
          <a href={primaryCta.href}
            style={{
              minWidth: 110, minHeight: 44,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: accent, color: '#fff', textDecoration: 'none',
              padding: '11px 16px', borderRadius: 12, fontWeight: 800, fontSize: 14,
            }}>
            {primaryCta.label}
          </a>
        )}
      </div>
      {/* Spacer so page content isn't covered by the fixed bar */}
      <div aria-hidden style={{ height: 84 }} />
    </>
  );
}

/** Convenience: tagline + socials grouped together (footer-style). */
export function PublicMarketingFooter({ store, color, dark = false }: { store: PublicStoreBranding; color?: string; dark?: boolean }) {
  return (
    <div style={{
      padding: '20px 16px', borderRadius: 16,
      background: dark ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.6)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <PublicTagline store={store} color={color} dark={dark} />
      <PublicSocials store={store} color={color} />
    </div>
  );
}

export default PublicContactBar;
