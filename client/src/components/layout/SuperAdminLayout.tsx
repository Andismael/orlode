import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Building2, BarChart2, HeadphonesIcon, ArrowLeft, Shield,
  Users, CreditCard, Bot, Activity, Globe, Settings, Cpu, Sparkles,
} from 'lucide-react';

const superAdminNav = [
  { path: '/superadmin/companies', label: 'Entreprises', icon: Building2 },
  { path: '/superadmin/companies-members', label: 'Entreprises + Membres', icon: Users },
  { path: '/superadmin/users', label: 'Utilisateurs', icon: Users },
  { path: '/superadmin/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/superadmin/payments', label: 'Paiements', icon: CreditCard },
  { path: '/superadmin/marketplace', label: 'Marketplace', icon: Bot },
  { path: '/superadmin/marketplace-studio', label: 'Studio Marketplace', icon: Sparkles },
  { path: '/superadmin/mcp-catalog', label: 'MCP Catalog', icon: Cpu },
  { path: '/superadmin/landing', label: 'Landing Page', icon: Globe },
  { path: '/superadmin/health', label: 'Systeme', icon: Activity },
  { path: '/superadmin/support', label: 'Support', icon: HeadphonesIcon },
  { path: '/superadmin/platform-settings', label: 'Paramètres', icon: Settings },
];

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="w-56 flex-shrink-0 flex flex-col h-full" style={{ background: '#0f172a' }}>
        <div className="flex items-center gap-2 h-14 px-4 border-b border-white/10">
          <Shield size={18} className="text-violet-400" />
          <span className="text-white font-bold text-sm">Super Admin</span>
        </div>
        <button onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 text-white/50 hover:text-white text-xs mt-2 hover:bg-white/5 mx-2 rounded-lg transition-colors">
          <ArrowLeft size={13} /> Retour app
        </button>
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {superAdminNav.map(item => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }>
                <Icon size={16} />
                <span className="text-xs">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 text-[10px] text-white/30">
          Orlode AI v2.0
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
