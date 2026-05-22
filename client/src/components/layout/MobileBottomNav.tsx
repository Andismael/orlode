/**
 * Mobile bottom navigation — iOS-style fixed tab bar visible on screens < lg.
 * Uses the Zaffran African palette (cream + deep green + emerald active).
 * Hidden on /admin/* routes (admin has its own drawer chrome).
 */
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Sparkles, MessageCircle, Package, User } from 'lucide-react';
import { M, MOBILE_CSS } from '@/components/mobile/mobileDesign';
import { haptic } from '@/utils/haptic';

const TABS = [
  { to: '/dashboard',   label: 'Accueil',   icon: Home,           match: (p: string) => p === '/dashboard' },
  { to: '/comms',       label: 'Inbox',     icon: MessageCircle,  match: (p: string) => p.startsWith('/comms') || p.startsWith('/emails') },
  { to: '/studio',      label: 'Studio',    icon: Sparkles,       match: (p: string) => p.startsWith('/studio') },
  { to: '/marketplace', label: 'Packs',     icon: Package,        match: (p: string) => p.startsWith('/marketplace') },
  { to: '/settings',    label: 'Profil',    icon: User,           match: (p: string) => p.startsWith('/settings') },
];

export default function MobileBottomNav() {
  const location = useLocation();

  // Don't render on admin shell — it has its own drawer/topbar
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <>
      <style>{MOBILE_CSS}</style>
      <nav
        className="lg:hidden"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(255, 250, 240, 0.92)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderTop: '1px solid rgba(31,41,55,0.08)',
          paddingTop: 6,
          paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
          paddingLeft: 'max(env(safe-area-inset-left), 6px)',
          paddingRight: 'max(env(safe-area-inset-right), 6px)',
          zIndex: 40,
          boxShadow: '0 -8px 24px -8px rgba(0,0,0,0.08)',
        }}
        aria-label="Navigation principale"
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          maxWidth: 560, margin: '0 auto',
        }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.match(location.pathname);
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                onClick={() => { if (!isActive) haptic.light(); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '6px 4px 4px',
                  textDecoration: 'none',
                  color: isActive ? M.emeraldDeep : M.inkLight,
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  position: 'relative',
                }}
                aria-label={tab.label}
              >
                {/* Active pill background */}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4, left: '50%', transform: 'translateX(-50%)',
                      width: 44, height: 28, borderRadius: 100,
                      background: `linear-gradient(135deg, ${M.emerald}, ${M.greenDeep})`,
                      opacity: 0.13,
                      zIndex: 0,
                    }}
                  />
                )}
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ zIndex: 1, position: 'relative' }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? 700 : 600,
                    letterSpacing: '-0.01em',
                    zIndex: 1, position: 'relative',
                  }}
                >
                  {tab.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
      {/* Spacer so page content doesn't sit under the nav */}
      <div className="lg:hidden" aria-hidden style={{ height: 'calc(env(safe-area-inset-bottom) + 60px)' }} />
    </>
  );
}
