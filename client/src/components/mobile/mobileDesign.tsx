/**
 * Shared mobile design system — Zaffran-inspired African aesthetic.
 * Cream + deep green + accents (gold, emerald, violet, coral, cyan).
 * Fraunces (display), JetBrains Mono (numbers), Inter (body).
 *
 * Inject <MobileGlobalStyles /> once at the root of a page, then use the
 * design tokens (M.color) and primitives (M.Hero, M.Pill, M.Section…) below.
 */
import React from 'react';

// ── DESIGN TOKENS ─────────────────────────────────────────────────────
export const M = {
  // bases
  cream: '#FFFAF0',
  creamDeep: '#F5F0E8',
  creamWarm: '#FAF6EE',
  greenDeep: '#0A4F3C',
  greenDark: '#063D2E',
  // accents
  emerald: '#10B981',
  emeraldDeep: '#059669',
  emeraldDark: '#065F46',
  emeraldSoft: '#D1FAE5',
  emeraldLight: '#6EE7B7',
  gold: '#D97706',
  goldDeep: '#B45309',
  goldSoft: '#FEF3C7',
  goldLight: '#FCD34D',
  violet: '#8B5CF6',
  violetDeep: '#7C3AED',
  violetSoft: '#EDE9FE',
  coral: '#FB7185',
  coralDeep: '#E11D48',
  coralSoft: '#FFE4E6',
  cyan: '#06B6D4',
  cyanDeep: '#0891B2',
  cyanDark: '#155E75',
  cyanSoft: '#CFFAFE',
  pink: '#EC4899',
  pinkSoft: '#FCE7F3',
  pinkDeep: '#BE185D',
  whatsapp: '#25D366',
  whatsappDeep: '#128C7E',
  whatsappBubble: '#DCF8C6',
  telegram: '#229ED9',
  telegramDeep: '#0088CC',
  // neutrals
  ink: '#1F2937',
  inkSoft: '#4B5563',
  inkLight: '#9CA3AF',
  // gradients
  heroAfrica: 'linear-gradient(160deg, #063D2E 0%, #0A4F3C 50%, #059669 100%)',
  heroSky:    'linear-gradient(160deg, #061A30 0%, #0B2A4A 50%, #0088CC 100%)',
  shimmer:    'linear-gradient(90deg, #FCD34D, #FFFAF0, #6EE7B7)',
} as const;

// ── GLOBAL STYLES (inject once per page) ──────────────────────────────
export const MOBILE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;500;600;700;800&display=swap');
.m-root, .m-root * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
.m-root { font-family: 'Inter', -apple-system, sans-serif; color: ${M.ink}; background: ${M.cream}; }
.m-display { font-family: 'Fraunces', serif; letter-spacing: -0.025em; font-optical-sizing: auto; }
.m-mono { font-family: 'JetBrains Mono', monospace; }
.m-grain::before { content:''; position:absolute; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity:0.07; pointer-events:none; mix-blend-mode:overlay; }
.m-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:100px; font-size:11px; font-weight:700; letter-spacing:0.04em; }
.m-live-dot { width:7px; height:7px; border-radius:50%; background:${M.emerald}; position:relative; flex-shrink:0; }
.m-live-dot::after { content:''; position:absolute; inset:-3px; border-radius:50%; background:${M.emerald}; opacity:0.4; animation:m-pulse 1.8s ease-in-out infinite; }
@keyframes m-pulse { 0%,100% { transform:scale(1); opacity:0.5; } 50% { transform:scale(1.6); opacity:0; } }
@keyframes m-slideIn { from { opacity:0; transform:translateY(15px); } to { opacity:1; transform:translateY(0); } }
.m-stagger > * { animation:m-slideIn 0.45s ease-out backwards; }
.m-stagger > *:nth-child(1) { animation-delay:0.04s; }
.m-stagger > *:nth-child(2) { animation-delay:0.10s; }
.m-stagger > *:nth-child(3) { animation-delay:0.16s; }
.m-stagger > *:nth-child(4) { animation-delay:0.22s; }
.m-stagger > *:nth-child(5) { animation-delay:0.28s; }
.m-stagger > *:nth-child(6) { animation-delay:0.34s; }
.m-stagger > *:nth-child(7) { animation-delay:0.40s; }
.m-stagger > *:nth-child(8) { animation-delay:0.46s; }
@keyframes m-slowRotate { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
.m-slow-rotate { animation:m-slowRotate 30s linear infinite; }
@keyframes m-shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
.m-shimmer { background-size:200% auto; background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:m-shimmer 4s linear infinite; }
@keyframes m-bubbleIn { from { opacity:0; transform:translateY(8px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
.m-bubble-in { animation:m-bubbleIn 0.4s ease-out backwards; }
@keyframes m-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }
.m-float { animation:m-float 3s ease-in-out infinite; }
.m-hide-scrollbar::-webkit-scrollbar { display:none; }
.m-hide-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
`;

export function MobileGlobalStyles() {
  return <style>{MOBILE_CSS}</style>;
}

// ── PRIMITIVES ────────────────────────────────────────────────────────

export function StarsBackdrop({ count = 50, light = false }: { count?: number; light?: boolean }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4, pointerEvents: 'none' }}>
      {[...Array(count)].map((_, i) => (
        <circle
          key={i}
          cx={Math.random() * 100 + '%'}
          cy={Math.random() * 100 + '%'}
          r={Math.random() * 1.5 + 0.3}
          fill={light ? M.ink : (i % 3 === 0 ? M.emeraldLight : i % 3 === 1 ? M.goldLight : M.cream)}
          opacity={Math.random() * 0.5 + 0.3}
        />
      ))}
    </svg>
  );
}

export function SlowRotateRing({ size = 280, color = M.cream, top = -120, right = -120 }: { size?: number; color?: string; top?: number; right?: number }) {
  return (
    <div className="m-slow-rotate" style={{
      position: 'absolute', top, right,
      width: size, height: size, borderRadius: '50%',
      border: `1px dashed ${color}28`,
      pointerEvents: 'none',
    }} />
  );
}

export function Pill({ children, bg, color, border }: { children: React.ReactNode; bg: string; color: string; border?: string }) {
  return (
    <div className="m-pill" style={{
      background: bg, color, border: border ?? `1px solid ${color}40`,
    }}>{children}</div>
  );
}

export function SectionHeader({ pill, pillBg, pillColor, title, sub, accent }: {
  pill: string; pillBg: string; pillColor: string;
  title: React.ReactNode; sub?: string; accent?: string;
}) {
  return (
    <>
      <Pill bg={pillBg} color={pillColor}>{pill}</Pill>
      <h2 className="m-display" style={{
        fontSize: 'clamp(26px, 6.5vw, 34px)',
        fontWeight: 800, margin: '12px 0 8px', lineHeight: 1.1, color: M.ink,
      }}>{title}</h2>
      {sub && (
        <p style={{ fontSize: 14, color: M.inkSoft, margin: '0 0 22px', lineHeight: 1.55 }}>
          {sub}
        </p>
      )}
      {accent /* unused but reserved for future variants */}
    </>
  );
}

export function StickyCTA({
  to,
  label,
  sub,
  gradient = `linear-gradient(135deg, ${M.emerald}, ${M.greenDeep})`,
  icon,
  onClick,
}: {
  to?: string;
  label: string;
  sub?: string;
  gradient?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: gradient,
      color: M.cream,
      padding: '14px 18px', borderRadius: 16,
      fontSize: 14, fontWeight: 800,
      boxShadow: '0 16px 32px -10px rgba(10,79,60,0.5), 0 0 0 1px rgba(255,250,240,0.5)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {label}
      </span>
      {sub && <span className="m-mono" style={{ fontSize: 13 }}>{sub}</span>}
    </div>
  );

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(180deg, transparent 0%, rgba(255,250,240,0.95) 30%, rgba(255,250,240,1) 100%)',
      padding: '12px 14px 16px',
      zIndex: 50,
      pointerEvents: 'none',
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto', pointerEvents: 'auto' }}>
        {to ? (
          <a href={to} style={{ textDecoration: 'none' }}>{inner}</a>
        ) : (
          <button onClick={onClick} style={{ width: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}>
            {inner}
          </button>
        )}
      </div>
    </div>
  );
}

export function Card({ children, color = M.ink, accent }: { children: React.ReactNode; color?: string; accent?: string }) {
  return (
    <div style={{
      background: M.cream,
      border: '1px solid rgba(31,41,55,0.06)',
      borderRadius: 16,
      padding: 14,
      borderLeft: accent ? `3px solid ${accent}` : undefined,
      color,
    }}>
      {children}
    </div>
  );
}
