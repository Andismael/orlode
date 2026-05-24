/**
 * Premium artistic portrait — used across Landing / Directory / Profile.
 * Adapted from user-provided design 2026-05-24.
 *
 * Pure SVG portrait (no real photo): brand gradient background, abstract
 * silhouette, initial letter overlay, optional handle / verified badges.
 */
import React from 'react';
import { BadgeCheck } from 'lucide-react';

export interface PortraitInfluencer {
  id: string;
  firstName?: string;
  displayName: string;
  handle?: string;
  verified?: boolean;
  status?: string;
  /** [accentMain, accentDeep, gold] — 3-color radial gradient base. */
  portraitGradient?: [string, string, string];
}

const C_INK = '#0A0814';
const C_WHITE = '#FFFFFF';
const C_GOLD = '#D4A574';
const C_GOLD_LIGHT = '#E8C9A0';
const C_VERIFIED = '#1D9BF0';
const C_SUCCESS = '#059669';

// Stable per-id color palette for influencers without explicit portraitGradient.
const PALETTES: [string, string, string][] = [
  ['#E11D48', '#9F1239', C_GOLD], // rose
  ['#6366F1', '#3730A3', C_GOLD], // indigo
  ['#10B981', '#065F46', C_GOLD], // emerald
  ['#F59E0B', '#92400E', C_GOLD], // amber
  ['#06B6D4', '#155E75', C_GOLD], // cyan
  ['#EC4899', '#831843', C_GOLD], // pink
];

function pickPalette(id: string): [string, string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTES[Math.abs(h) % PALETTES.length]!;
}

export default function InfluencerPortrait({
  inf,
  size = 240,
}: {
  inf: PortraitInfluencer;
  size?: number;
}) {
  const first = inf.firstName ?? inf.displayName.split(' ')[0] ?? '?';
  const initial = first.charAt(0).toUpperCase();
  const grad = inf.portraitGradient ?? pickPalette(inf.id);

  return (
    <div style={{
      width: size,
      height: size * 1.25,
      borderRadius: 16,
      background: `linear-gradient(155deg, ${grad[0]} 0%, ${grad[1]} 70%, ${grad[2]} 100%)`,
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      boxShadow: `0 20px 60px -15px ${grad[1]}60`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
        opacity: 0.08, pointerEvents: 'none', mixBlendMode: 'overlay',
      }} />

      <svg viewBox="0 0 200 250" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id={`glow-${inf.id}`} cx="50%" cy="40%">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="60%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="250" fill={`url(#glow-${inf.id})`} />
        <circle cx="100" cy="75" r="42" fill={C_GOLD_LIGHT} opacity="0.35" />
        <circle cx="100" cy="75" r="38" fill={C_GOLD} opacity="0.25" />
        <ellipse cx="100" cy="85" rx="28" ry="32" fill={C_INK} opacity="0.55" />
        <path d="M 50 250 Q 50 165, 100 145 Q 150 165, 150 250 Z" fill={C_INK} opacity="0.45" />
        <line x1="20" y1="220" x2="180" y2="220" stroke="white" strokeWidth="0.5" opacity="0.3" />
      </svg>

      {/* Giant italic initial */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontFamily: 'Fraunces, serif',
        fontSize: size * 0.45,
        fontWeight: 800,
        color: C_WHITE,
        opacity: 0.15,
        fontStyle: 'italic',
        letterSpacing: '-0.05em',
        pointerEvents: 'none',
      }}>{initial}</div>

      {/* Bottom name overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 16px 14px', color: C_WHITE,
      }}>
        <div style={{
          fontFamily: 'Fraunces, serif',
          fontSize: size * 0.085,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontStyle: 'italic',
          lineHeight: 1,
          marginBottom: 4,
        }}>{first}</div>
        {inf.handle && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: size * 0.045,
            opacity: 0.85,
            letterSpacing: '0.04em',
            fontWeight: 600,
          }}>{inf.handle}</div>
        )}
      </div>

      {/* Verified badge */}
      {inf.verified && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 100,
          padding: '4px 8px',
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 10, fontWeight: 700, color: C_WHITE,
          letterSpacing: '0.04em',
        }}>
          <BadgeCheck size={11} fill={C_WHITE} stroke={grad[1]} strokeWidth={2.5} />
          VÉRIFIÉ
        </div>
      )}

      {/* Live dot when available */}
      {inf.status === 'active' && (
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 100,
          padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontWeight: 700, color: C_WHITE,
          letterSpacing: '0.05em',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: C_SUCCESS,
          }} />
          DISPO
        </div>
      )}
    </div>
  );
}
