import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, BarChart2, HeadphonesIcon, ArrowLeft, Shield,
  Users, CreditCard, Bot, Activity, Globe, Settings, Cpu, Sparkles,
  Menu, X, Boxes, Briefcase, Megaphone,
} from 'lucide-react';

const superAdminNav = [
  { path: '/superadmin/companies', label: 'Entreprises', icon: Building2 },
  { path: '/superadmin/companies-members', label: 'Entreprises + Membres', icon: Users },
  { path: '/superadmin/users', label: 'Utilisateurs', icon: Users },
  { path: '/superadmin/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/superadmin/payments', label: 'Paiements', icon: CreditCard },
  { path: '/superadmin/packs', label: 'Packs', icon: Boxes },
  { path: '/superadmin/marketplace', label: 'Marketplace', icon: Bot },
  { path: '/superadmin/marketplace-studio', label: 'Studio Marketplace', icon: Sparkles },
  // Cross-product moderation — these manage the standalone Orlode Talents
  // and Influenceurs products that share the same Firebase backend.
  { path: '/superadmin/talents',     label: 'Talents (modération)',      icon: Briefcase },
  { path: '/superadmin/influencers', label: 'Influenceurs (modération)', icon: Megaphone },
  { path: '/superadmin/mcp-catalog', label: 'MCP Catalog', icon: Cpu },
  { path: '/superadmin/landing', label: 'Landing Page', icon: Globe },
  { path: '/superadmin/health', label: 'Systeme', icon: Activity },
  { path: '/superadmin/support', label: 'Support', icon: HeadphonesIcon },
  { path: '/superadmin/platform-settings', label: 'Paramètres', icon: Settings },
];

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const Nav = ({ onClose }: { onClose?: () => void }) => (
    <>
      <div className="flex items-center justify-between h-14 px-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-violet-400" />
          <span className="text-white font-bold text-sm">Super Admin</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white p-1 md:hidden">
            <X size={18} />
          </button>
        )}
      </div>
      <button
        onClick={() => { navigate('/'); onClose?.(); }}
        className="flex items-center gap-2 px-4 py-2 text-white/50 hover:text-white text-xs mt-2 hover:bg-white/5 mx-2 rounded-lg transition-colors"
      >
        <ArrowLeft size={13} /> Retour app
      </button>
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {superAdminNav.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="text-sm md:text-xs">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 text-[10px] text-white/30 flex-shrink-0">
        Orlode AI v2.0
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Overlay mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar desktop */}
      <div className="hidden md:flex w-56 flex-shrink-0 flex-col h-full" style={{ background: '#0f172a' }}>
        <Nav />
      </div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.22 }}
            className="fixed left-0 top-0 h-full w-72 z-30 flex flex-col md:hidden"
            style={{ background: '#0f172a' }}
          >
            <Nav onClose={() => setMobileOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenu */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Barre mobile super admin */}
        <div className="md:hidden flex items-center h-12 px-4 border-b border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-600 hover:text-gray-900 p-1 -ml-1"
            aria-label="Ouvrir le menu"
          >
            <Menu size={20} />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <Shield size={16} className="text-violet-500" />
            <span className="text-sm font-semibold text-gray-800">Super Admin</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
