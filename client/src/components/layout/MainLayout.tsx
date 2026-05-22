import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import CloneWidget from '@/components/clone/CloneWidget';
import MobileBottomNav from './MobileBottomNav';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import ByoeGateBanner from './ByoeGateBanner';
import { ToastContainer } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';

export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { company, setCompany } = useAuthStore();

  // All new users get the simple SaaS onboarding. BYOE is now opt-in via /admin/byoe.
  const showOnboarding = company !== null && company.onboardingCompleted === false;

  const handleOnboardingComplete = () => {
    if (company) setCompany({ ...company, onboardingCompleted: true });
  };

  const sidebarWidth = sidebarCollapsed ? 64 : 240;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Native PWA feel: respect iOS notch (top) and home-indicator (left/right) at the
          layout boundary. Bottom safe-area is owned by MobileBottomNav (so the gradient
          backdrop extends behind the home indicator). Touch-pan-y prevents the rubber-band
          horizontal scroll on iOS Safari that breaks fixed positioning. */}
      <style>{`
        :root { --safe-top: env(safe-area-inset-top, 0px); --safe-left: env(safe-area-inset-left, 0px); --safe-right: env(safe-area-inset-right, 0px); }
        html, body { overscroll-behavior-y: contain; }
        @supports (padding: max(0px)) {
          @media (max-width: 1024px) {
            .main-shell { padding-top: max(env(safe-area-inset-top), 0px); padding-left: max(env(safe-area-inset-left), 0px); padding-right: max(env(safe-area-inset-right), 0px); }
          }
        }
        /* iOS momentum scroll + disable rubber-band horizontal */
        main { -webkit-overflow-scrolling: touch; }
        /* Native touch feedback on tappable cards (iOS-style 100ms shrink). Opt-in via .tap-card */
        .tap-card { transition: transform 0.1s ease-out, box-shadow 0.15s ease; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .tap-card:active { transform: scale(0.97); }
        /* Hide horizontal scrollbar but keep scroll on mobile chip rows */
        .ios-chip-row { -ms-overflow-style: none; scrollbar-width: none; scroll-snap-type: x mandatory; }
        .ios-chip-row::-webkit-scrollbar { display: none; }
        .ios-chip-row > * { scroll-snap-align: start; }
        /* Native chrome polish — no callout, no tap highlight, no selection on UI controls.
           Keeps text selectable in <p>/<span>/<input> but kills it on buttons/nav/headers. */
        button, [role="button"], nav, header, footer, [class*="pill"] {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }
        /* Page fade-in on route change (lightweight — full transitions need a router-aware wrapper) */
        main > * { animation: m-page-in 0.22s ease-out; }
        @keyframes m-page-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {showOnboarding && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      {/* Sidebar — desktop (relative) */}
      <motion.div
        className="hidden lg:block relative h-full z-30"
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        style={{ width: sidebarWidth, flexShrink: 0 }}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={true}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onCloseMobile={() => {}}
        />
      </motion.div>

      {/* Sidebar — mobile (fixed drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" style={{ pointerEvents: 'auto' }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full" style={{ width: 280, animation: 'slideIn 0.2s ease-out' }}>
            <style>{`@keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
            <Sidebar
              collapsed={false}
              mobileOpen={true}
              onToggleCollapse={() => {}}
              onCloseMobile={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="main-shell flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <ByoeGateBanner />
        <main className="flex-1 overflow-auto bg-gray-50" style={{ touchAction: 'pan-y' }}>
          <div className="h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Clone Widget — floating button on every page */}
      <CloneWidget />
      {/* Global toast notifications */}
      <ToastContainer />
      {/* Mobile bottom nav (iOS-style tab bar) */}
      <MobileBottomNav />
    </div>
  );
}
