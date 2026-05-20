import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, Bot, Lightbulb, Mail, Video,
  UserCheck, Users, Wallet, TrendingUp, HeadphonesIcon, Monitor,
  ShieldCheck, Megaphone, GraduationCap, ScanFace, Settings, Shield,
  FileText, Briefcase, FolderOpen, LogOut, ChevronLeft, ChevronRight,
  ChevronDown, Clock, CalendarClock, Building2, KeyRound, Calendar,
  UserPlus, Receipt, BarChart2, BookOpen, PenTool, Package, Key,
  CircleDot, Database, BarChart3, Plug, Crown, Sparkles, ShoppingBag, Boxes,
  MessageSquarePlus, Brain,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import { signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import api from '@/services/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = React.ComponentType<any>;

interface NavItem {
  path: string;
  label: string;
  icon: IconComponent;
}

interface NavSection {
  key: string;
  label: string;
  icon: IconComponent;
  path: string;
  children: NavItem[];
}

// Top-level items (always visible)
const TOP_ITEMS: NavItem[] = [
  { path: '/',         label: 'Dashboard',   icon: LayoutDashboard },
  { path: '/agent',    label: 'Mes packs',   icon: Boxes },
  { path: '/chat',     label: 'AI Chat',     icon: MessageSquare },
  { path: '/agents',   label: 'Agents',      icon: Bot },
  { path: '/insights', label: 'Insights',    icon: Lightbulb },
  { path: '/meetings', label: 'Reunions',    icon: Video },
];

// Collapsible sections
const SECTIONS: NavSection[] = [
  {
    key: 'comms', label: 'Communications', icon: Mail, path: '/emails',
    children: [
      { path: '/emails',              label: 'Emails',      icon: Mail },
      { path: '/comms/announcements', label: 'Annonces',    icon: Mail },
      { path: '/comms/messaging',     label: 'Messagerie',  icon: Mail },
      { path: '/comms/campaigns',     label: 'Campagnes',   icon: Mail },
    ],
  },
  {
    key: 'news', label: 'Veille', icon: Lightbulb, path: '/news',
    children: [
      { path: '/news',              label: 'Dashboard',    icon: Lightbulb },
      { path: '/news/competitors',  label: 'Concurrents',  icon: Lightbulb },
    ],
  },
  {
    key: 'reception', label: 'Reception', icon: UserCheck, path: '/reception',
    children: [
      { path: '/reception/visitors',     label: 'Visiteurs',     icon: Users },
      { path: '/reception/presence-pro', label: 'Statuts',       icon: Clock },
      { path: '/reception/host',         label: 'Mes visiteurs', icon: CircleDot },
      { path: '/reception/pre-register', label: 'Pre-inscr.',    icon: KeyRound },
      { path: '/reception/deliveries',   label: 'Livraisons',    icon: KeyRound },
      { path: '/reception/evacuation',   label: 'Evacuation',    icon: CircleDot },
      { path: '/reception/analytics',    label: 'Analytics',     icon: FileText },
    ],
  },
  {
    key: 'hr', label: 'RH', icon: Users, path: '/hr',
    children: [
      { path: '/hr/leaves',      label: 'Conges',     icon: Calendar },
      { path: '/hr/employees',   label: 'Effectifs',  icon: Users },
      { path: '/hr/onboarding',  label: 'Onboarding', icon: UserPlus },
      { path: '/hr/pro',         label: 'RH PRO',     icon: Users },
    ],
  },
  {
    key: 'finance', label: 'Finance', icon: Wallet, path: '/finance',
    children: [
      { path: '/finance/invoices', label: 'Factures',    icon: FileText },
      { path: '/finance/budget',   label: 'Budget',      icon: BarChart2 },
      { path: '/finance/expenses', label: 'Depenses',    icon: Receipt },
      { path: '/finance/pro',     label: 'Finance PRO', icon: BarChart2 },
    ],
  },
  {
    key: 'sales', label: 'Ventes', icon: TrendingUp, path: '/sales',
    children: [
      { path: '/sales/quotes',   label: 'Devis',      icon: FileText },
      { path: '/sales/forecast', label: 'Previsions', icon: TrendingUp },
      { path: '/sales/pro',     label: 'Sales PRO',  icon: TrendingUp },
    ],
  },
  {
    key: 'support', label: 'Support', icon: HeadphonesIcon, path: '/support',
    children: [
      { path: '/support/kb',  label: 'FAQ / KB',    icon: BookOpen },
      { path: '/support/pro', label: 'Support PRO', icon: BookOpen },
    ],
  },
  {
    key: 'it', label: 'IT', icon: Monitor, path: '/it',
    children: [
      { path: '/it/tickets',  label: 'Tickets',  icon: CircleDot },
      { path: '/it/assets',   label: 'Assets',   icon: Package },
      { path: '/it/licenses', label: 'Licences', icon: Key },
      { path: '/it/pro',      label: 'IT PRO',   icon: Package },
    ],
  },
  {
    key: 'security', label: 'Securite', icon: ShieldCheck, path: '/security',
    children: [
      { path: '/security/incidents',       label: 'Incidents',  icon: ShieldCheck },
      { path: '/security/vulnerabilities', label: 'Vulns',      icon: ShieldCheck },
      { path: '/security/phishing',        label: 'Phishing',   icon: ShieldCheck },
      { path: '/security/compliance',      label: 'Conformite', icon: Shield },
      { path: '/security/policies',        label: 'Politiques', icon: Shield },
      { path: '/security/access',          label: 'Acces',      icon: Key },
      { path: '/security/audit',           label: 'Audit logs', icon: FileText },
    ],
  },
  {
    key: 'marketing', label: 'Marketing', icon: Megaphone, path: '/marketing',
    children: [
      { path: '/marketing/posts',    label: 'Posts',      icon: PenTool },
      { path: '/marketing/calendar', label: 'Calendrier', icon: Calendar },
      { path: '/marketing/videos',   label: 'Videos AI',    icon: Video },
      { path: '/marketing/pro',      label: 'Marketing PRO', icon: Video },
    ],
  },
  {
    key: 'training', label: 'Formation', icon: GraduationCap, path: '/training',
    children: [
      { path: '/training/manage', label: 'Gestion', icon: BookOpen },
    ],
  },
  {
    key: 'legal', label: 'Juridique', icon: FileText, path: '/legal',
    children: [
      { path: '/legal',     label: 'Dashboard', icon: FileText },
      { path: '/legal/pro', label: 'Legal PRO', icon: FileText },
      { path: '/contracts', label: 'Contrats',  icon: FileText },
    ],
  },
];

// Bottom items
const BOTTOM_ITEMS: NavItem[] = [
  { path: '/meetings/pro', label: 'Meeting PRO', icon: Video },
  { path: '/agents/knowledge', label: 'Knowledge', icon: Database },
  { path: '/settings',     label: 'Parametres',  icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export default function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, company } = useAuthStore();
  const { t } = useLangStore();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [installedAgents, setInstalledAgents] = useState<{ id: string; agentId: string; name: string; icon: string }[]>([]);

  // Fetch installed marketplace agents (plugin system)
  useEffect(() => {
    api.get('/marketplace/my-installed').then(r => {
      const raw = r.data;
      const list = Array.isArray(raw) ? raw : [];
      // Also fetch agent details for names/icons
      api.get('/marketplace/agents').then(r2 => {
        const allRaw = r2.data;
        const allAgents = Array.isArray(allRaw) ? allRaw : [];
        const agentMap = new Map(allAgents.map((a: Record<string, unknown>) => [a['id'] as string, a]));
        const enriched = list
          .filter((a: Record<string, unknown>) => {
            // Only show marketplace agents (with systemPrompt), not built-in
            const detail = agentMap.get((a['agentId'] ?? a['id']) as string) as Record<string, unknown> | undefined;
            return detail && (detail['systemPrompt'] as string)?.length > 0;
          })
          .map((a: Record<string, unknown>) => {
            const aid = (a['agentId'] ?? a['id']) as string;
            const detail = agentMap.get(aid) as Record<string, unknown> | undefined;
            return {
              id: aid,
              agentId: aid,
              name: (detail?.['name'] as string) ?? (a['cachedConfig'] as Record<string, unknown>)?.['name'] as string ?? aid,
              icon: (detail?.['icon'] as string) ?? '🤖',
            };
          });
        setInstalledAgents(enriched);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // ── PLUGIN SYSTEM: only show sections for active agents ──
  const selectedAgents = new Set(company?.selectedAgents ?? []);
  const has = (agentId: string) => selectedAgents.has(agentId);

  // ── Simplified sidebar — agents are accessed via /agents/:id dashboards ──

  const TOP_ITEMS_T: NavItem[] = [
    { path: '/',             label: t('dashboard'),       icon: LayoutDashboard },
    { path: '/admin/brain',  label: 'Cerveau IA',         icon: Brain },
    { path: '/chat',         label: t('ai_chat'),         icon: MessageSquare },
    { path: '/agents',       label: 'Mes Agents',         icon: Bot },
    { path: '/team',         label: 'Equipe',             icon: Users },
    { path: '/workspace',    label: 'Espace de travail',  icon: Boxes },
    { path: '/calendar',     label: 'Calendrier',         icon: Calendar },
  ];

  // No more collapsible agent sections — everything is inside agent dashboards
  const SECTIONS_T: (NavSection & { agentId: string })[] = [];

  const BOTTOM_ITEMS_T: NavItem[] = [
    { path: '/marketplace',        label: 'Marketplace',  icon: ShoppingBag },
    { path: '/admin/billing',      label: 'Abonnement',   icon: Crown },
    { path: '/creator',            label: 'Createur',     icon: Sparkles },
    { path: '/feedback',           label: 'Feedback',     icon: MessageSquarePlus },
    { path: '/settings',           label: t('settings'),  icon: Settings },
  ];

  // Connectors — admin only (OAuth tokens, MCP, etc. = company-wide config)
  if (user?.role === 'admin' || user?.role === 'manager') {
    BOTTOM_ITEMS_T.splice(3, 0, { path: '/admin/connectors', label: t('connectors'), icon: Plug });
  }

  if ((user as unknown as { superAdmin?: boolean })?.superAdmin) {
    BOTTOM_ITEMS_T.push({ path: '/superadmin/companies', label: 'Super Admin', icon: Shield });
  }

  const handleLogout = async () => { await signOut(auth); navigate('/login'); };

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Auto-open section if current path matches
  const currentSection = SECTIONS.find(s => location.pathname.startsWith(s.path));
  if (currentSection && !openSections.has(currentSection.key)) {
    openSections.add(currentSection.key);
  }

  const renderItem = (item: NavItem, indent = false) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onCloseMobile}
        className={`flex items-center gap-3 ${indent ? 'pl-9 pr-3' : 'px-3'} py-2 rounded-lg transition-all duration-150 ${active ? '' : 'hover:bg-white/10'}`}
        style={active ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' } : {}}
      >
        <Icon size={indent ? 15 : 18} className="flex-shrink-0 text-white" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className={`text-sm whitespace-nowrap overflow-hidden ${indent ? 'text-white/70' : 'font-medium text-white'}`}
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
      </NavLink>
    );
  };

  return (
    <div
      className={`h-full flex flex-col
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-200 ease-in-out`}
      style={{
        width: '100%',
        background: 'linear-gradient(180deg, #0F0F1A 0%, #1A1A2E 50%, #16213E 100%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="Orlode" className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <span className="font-bold text-white text-sm whitespace-nowrap">Orlode AI</span>
                {company?.name && <p className="text-xs whitespace-nowrap truncate max-w-[140px]" style={{ color: 'rgba(255,255,255,0.65)' }}>{company.name}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto no-scrollbar space-y-1">
        {/* Admin link */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <NavLink to="/admin" onClick={onCloseMobile}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${isActive('/admin') ? '' : 'hover:bg-white/10'}`}
            style={isActive('/admin') ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' } : {}}>
            <Shield size={18} className="flex-shrink-0 text-white" />
            {!collapsed && <span className="text-sm whitespace-nowrap font-semibold text-white">{t('administration')}</span>}
          </NavLink>
        )}

        {/* Top items */}
        {TOP_ITEMS_T.map(item => renderItem(item))}

        {/* Collapsible sections */}
        {!collapsed && <p className="px-3 mt-3 mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('modules')}</p>}

        {SECTIONS_T.map(section => {
          const Icon = section.icon;
          const sectionActive = isActive(section.path);
          const isOpen = openSections.has(section.key);

          return (
            <div key={section.key}>
              <button
                onClick={() => {
                  if (collapsed) { navigate(section.path); onCloseMobile(); }
                  else toggleSection(section.key);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${sectionActive ? '' : 'hover:bg-white/10'}`}
                style={sectionActive && !isOpen ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' } : {}}
              >
                <Icon size={18} className="flex-shrink-0 text-white" />
                {!collapsed && (
                  <>
                    <span className={`text-sm whitespace-nowrap flex-1 text-left ${sectionActive ? 'font-semibold text-white' : 'font-medium text-white'}`}>{section.label}</span>
                    <ChevronDown size={14} className={`text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {/* Children */}
              <AnimatePresence>
                {isOpen && !collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {/* Main page link */}
                    <NavLink to={section.path} onClick={onCloseMobile}
                      className={`flex items-center gap-3 pl-9 pr-3 py-1.5 rounded-lg transition-all ${location.pathname === section.path ? '' : 'hover:bg-white/10'}`}
                      style={location.pathname === section.path ? { background: 'rgba(99,102,241,0.3)' } : {}}>
                      <span className="text-xs text-white/60">{t('overview')}</span>
                    </NavLink>
                    {section.children.map(child => renderItem(child, true))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Bottom items */}
        {!collapsed && <p className="px-3 mt-3 mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('data_section')}</p>}
        {BOTTOM_ITEMS_T.map(item => renderItem(item))}
      </nav>

      {/* User section */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
        <div className={`flex items-center gap-3 px-2 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-white shadow-sm" style={{ background: 'rgba(255,255,255,0.25)' }}>
            {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }} className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user?.displayName ?? 'Utilisateur'}</p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={handleLogout} className="flex-shrink-0 transition-colors hover:text-red-300" style={{ color: 'rgba(255,255,255,0.6)' }} title={t('logout')}>
                <LogOut size={15} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <button onClick={onToggleCollapse}
          className="mt-1 w-full flex items-center justify-center py-1.5 rounded-lg transition-colors text-xs gap-1 hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.65)' }}>
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>{t('reduce')}</span></>}
        </button>
      </div>
    </div>
  );
}
