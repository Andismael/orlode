/**
 * Premium video-card — used across Talents Landing / Feed / Profile.
 * Adapted from user-provided design 2026-05-24 (editorial green identity).
 *
 * Pure SVG card (no real photo until thumbnailUrl arrives): brand gradient,
 * abstract silhouette, REC pill + duration, central play button, name overlay.
 */
import React from 'react';
import { Play, Eye, Heart, MapPin } from 'lucide-react';

export interface CardTalent {
  id: string;
  displayName: string;
  firstName?: string;
  sector?: string;
  city?: string;
  country?: string;
  videoDuration?: number;
  viewsCount?: number;
  contactsCount?: number;
  thumbnailUrl?: string;
  /** Avatar photo uploaded during signup or via edit profile. Takes priority over thumbnailUrl + SVG silhouette. */
  photoURL?: string;
  status?: string;
  /** [accentMain, accentDeep, gold] — 3-color radial gradient base. */
  portraitGradient?: [string, string, string];
}

const C_INK = '#0A1410';
const C_WHITE = '#FFFFFF';
const C_GOLD = '#D4A574';
const C_GOLD_LIGHT = '#E8C9A0';
const C_SUCCESS = '#10B981';

const PALETTES: [string, string, string][] = [
  ['#0F5C3F', '#063322', C_GOLD],
  ['#1B7A56', '#0F5C3F', C_GOLD],
  ['#D4A574', '#B8895C', '#0F5C3F'],
  ['#5BB088', '#0F5C3F', C_GOLD],
  ['#F0C674', '#B8895C', '#0F5C3F'],
  ['#0F5C3F', '#1B7A56', C_GOLD],
];

function pickPalette(id: string): [string, string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length]!;
}

function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return '1:00';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatK(n?: number): string {
  if (!n) return '0';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export type CardSize = 'small' | 'medium' | 'large' | 'hero';

const SIZES: Record<CardSize, { w: number; h: number; fontSize: number; padding: number }> = {
  small:  { w: 200, h: 320, fontSize: 14, padding: 12 },
  medium: { w: 260, h: 420, fontSize: 18, padding: 14 },
  large:  { w: 320, h: 520, fontSize: 22, padding: 18 },
  hero:   { w: 380, h: 600, fontSize: 26, padding: 20 },
};

export default function TalentVideoCard({
  talent,
  size = 'medium',
  onClick,
}: {
  talent: CardTalent;
  size?: CardSize;
  onClick?: () => void;
}) {
  const s = SIZES[size];
  const first = talent.firstName ?? talent.displayName.split(' ')[0] ?? '?';
  const initial = first.charAt(0).toUpperCase();
  const grad = talent.portraitGradient ?? pickPalette(talent.id);
  const city = talent.city || talent.country || '';

  return (
    <div
      onClick={onClick}
      style={{
        width: s.w, height: s.h,
        borderRadius: 24,
        background: `linear-gradient(155deg, ${grad[0]} 0%, ${grad[1]} 70%, ${grad[2]} 100%)`,
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: `0 20px 60px -15px ${grad[1]}60`,
        flexShrink: 0,
      }}
    >
      {/* Grain overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
        opacity: 0.08, pointerEvents: 'none', mixBlendMode: 'overlay',
      }} />

      {/* Avatar photo > video thumbnail > abstract SVG silhouette */}
      {(talent.photoURL || talent.thumbnailUrl) ? (
        <img
          src={talent.photoURL || talent.thumbnailUrl}
          alt={talent.displayName}
          loading="lazy"
          decoding="async"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            mixBlendMode: 'luminosity', opacity: 0.85,
          }}
        />
      ) : (
        <svg viewBox="0 0 200 320" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <radialGradient id={`tg-${talent.id}-${size}`} cx="50%" cy="35%">
              <stop offset="0%" stopColor="white" stopOpacity="0.35" />
              <stop offset="60%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="320" fill={`url(#tg-${talent.id}-${size})`} />
          <circle cx="100" cy="100" r="50" fill={C_GOLD_LIGHT} opacity="0.30" />
          <circle cx="100" cy="100" r="45" fill={C_GOLD} opacity="0.20" />
          <ellipse cx="100" cy="115" rx="32" ry="36" fill={C_INK} opacity="0.5" />
          <path d="M 40 320 Q 40 200, 100 175 Q 160 200, 160 320 Z" fill={C_INK} opacity="0.4" />
          <rect x="0" y="100" width="200" height="2" fill="white" opacity="0.08" />
          <rect x="0" y="180" width="200" height="2" fill="white" opacity="0.06" />
        </svg>
      )}

      {/* Initial letter overlay (only when no thumbnail) */}
      {!(talent.photoURL || talent.thumbnailUrl) && (
        <div style={{
          position: 'absolute',
          top: '38%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'Fraunces, serif',
          fontSize: s.w * 0.5,
          fontWeight: 800,
          color: C_WHITE,
          opacity: 0.12,
          fontStyle: 'italic',
          letterSpacing: '-0.05em',
          pointerEvents: 'none',
        }}>{initial}</div>
      )}

      {/* Top bar: REC + sector */}
      <div style={{
        position: 'absolute',
        top: s.padding, left: s.padding, right: s.padding,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 100,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: C_WHITE,
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#FF3B30',
            animation: 'tvcRecording 1.4s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
            {formatDuration(talent.videoDuration)}
          </span>
        </div>

        {talent.sector && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 100,
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: C_WHITE,
            fontSize: 10, fontWeight: 600,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            {talent.sector}
          </div>
        )}
      </div>

      {/* Play button (not on small) */}
      {size !== 'small' && (
        <div style={{
          position: 'absolute',
          top: '45%', left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: size === 'hero' ? 72 : 56,
            height: size === 'hero' ? 72 : 56,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            animation: 'tvcPlayPulse 2.5s ease-in-out infinite',
          }}>
            <Play size={size === 'hero' ? 28 : 22} color={grad[1]} fill={grad[1]} strokeWidth={0} style={{ marginLeft: 3 }} />
          </div>
        </div>
      )}

      {/* Dispo pill */}
      {talent.status === 'active' && size !== 'small' && (
        <div style={{
          position: 'absolute',
          top: s.padding * 3.5,
          left: s.padding,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 100,
            background: 'rgba(16, 185, 129, 0.25)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            color: C_WHITE,
            fontSize: 9, fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C_SUCCESS }} />
            DISPO
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: s.padding,
        paddingTop: s.padding * 3,
        background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.9))',
        color: C_WHITE,
      }}>
        <div style={{
          fontFamily: 'Fraunces, serif',
          fontSize: s.fontSize,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          marginBottom: 3,
        }}>{first}</div>
        {talent.sector && (
          <div style={{
            fontSize: s.fontSize * 0.6,
            opacity: 0.85,
            fontWeight: 500,
            marginBottom: size === 'small' ? 0 : 8,
          }}>{talent.sector}</div>
        )}

        {size !== 'small' && (
          <div style={{
            display: 'flex', gap: 10,
            fontSize: 10, color: 'rgba(255,255,255,0.75)',
            paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.15)',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Eye size={10} /> {formatK(talent.viewsCount)}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Heart size={10} /> {formatK(talent.contactsCount)}
            </span>
            {city && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                <MapPin size={10} /> {city.split(',')[0]}
              </span>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes tvcRecording { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes tvcPlayPulse {
          0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 14px rgba(255,255,255,0); }
        }
      `}</style>
    </div>
  );
}
