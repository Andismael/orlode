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
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <ByoeGateBanner />
        <main className="flex-1 overflow-auto bg-gray-50">
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
