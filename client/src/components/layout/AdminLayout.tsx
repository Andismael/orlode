import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, Shield, Bot, Zap, Key, Lock,
  CreditCard, BarChart2, Globe, Trash2, ChevronLeft, ChevronDown, ArrowLeft,
  Settings, UserCog, MessageCircle, Share2, Video, Menu, X, Server,
  Calendar, KeyRound, Plug, Cpu, Megaphone, BookOpen, Send, ShoppingBag,
  Inbox, FileText, Sparkles, Users2, FileSignature,
} from 'lucide-react';
import { ToastContainer } from '@/components/common/Toast';

interface NavItem { path: string; label: string; icon: any }
interface NavSection { label: string; items: NavItem[]; defaultOpen?: boolean }

const adminNav: NavSection[] = [
  { label: 'Entreprise', defaultOpen: true, items: [
    { path: '/admin',       label: 'Paramètres',       icon: Building2 },
    { path: '/admin/users', label: 'Utilisateurs',      icon: Users },
    { path: '/admin/domain', label: 'Domaine & emails', icon: Globe },
    // Roles & Permissions hidden until backend persistence is wired (was a UI-only stub)
    { path: '/admin/agent-permissions', label: 'Accès par agent', icon: UserCog },
    { path: '/admin/voice-permissions', label: 'Accès Voice Live', icon: UserCog },
    { path: '/admin/employee-codes',    label: 'Codes employés',   icon: KeyRound },
  ]},
  { label: 'Messagerie', defaultOpen: true, items: [
    { path: '/admin/inbox',                     label: 'Inbox (WA + Telegram)', icon: MessageCircle },
    { path: '/admin/whatsapp/leads',            label: 'Leads capturés',    icon: Users2 },
    { path: '/admin/whatsapp/broadcasts',       label: 'Broadcasts',        icon: Megaphone },
    { path: '/admin/whatsapp/auto-broadcasts',  label: 'Auto-broadcasts',   icon: Zap },
    { path: '/admin/whatsapp/templates',        label: 'Templates Meta',    icon: BookOpen },
    { path: '/admin/whatsapp/catalog',          label: 'Catalogue produits', icon: ShoppingBag },
    { path: '/admin/whatsapp/ads',              label: 'Ads (CTW)',         icon: BarChart2 },
    { path: '/admin/meta-ads',                  label: 'Meta Ads (config)', icon: BarChart2 },
    { path: '/admin/whatsapp',                  label: 'Config WhatsApp',   icon: Settings },
    { path: '/admin/telegram',                  label: 'Config Telegram',   icon: Settings },
  ]},
  { label: 'Growth Engine', defaultOpen: true, items: [
    { path: '/admin/social',          label: 'Comptes connectés', icon: Share2 },
    { path: '/admin/social/composer', label: 'Growth Engine',     icon: Send },
    { path: '/admin/social/posts',    label: 'Mes posts',         icon: FileText },
  ]},
  { label: 'IA & Agents', items: [
    { path: '/admin/orchestrator',  label: 'Orchestrateur',  icon: Zap },
    { path: '/admin/intelligence',  label: 'Intelligence',   icon: Sparkles },
    { path: '/admin/agents',        label: 'Config Agents',  icon: Bot },
    // Skills Manager hidden until backend (/agents/skills) is implemented (was UI-only)
    { path: '/admin/api-keys',      label: 'Clés API',       icon: Key },
    { path: '/admin/contracts',     label: 'Contrats & signatures', icon: FileSignature },
  ]},
  { label: 'Clone & Réservations', items: [
    { path: '/admin/clone',             label: 'Mon Clone',       icon: MessageCircle },
    { path: '/admin/clone/inbox',       label: 'Inbox Clone',     icon: Inbox },
    { path: '/admin/clone/analytics',   label: 'Analytics Clone', icon: BarChart2 },
    { path: '/admin/clone/assignments', label: 'Attributions',    icon: UserCog },
    { path: '/admin/appointments',      label: 'Rendez-vous',     icon: Calendar },
    { path: '/admin/reservations',      label: 'Réservations',    icon: Calendar },
    { path: '/admin/shop',              label: 'Boutique',        icon: ShoppingBag },
  ]},
  { label: 'Autres canaux', items: [
    { path: '/admin/video',    label: 'Video Studio AI', icon: Video },
  ]},
  { label: 'Intégrations', items: [
    { path: '/admin/connectors', label: 'Connecteurs', icon: Plug },
    { path: '/admin/mcp',        label: 'MCP Servers', icon: Cpu },
  ]},
  { label: 'Facturation', items: [
    { path: '/admin/billing', label: 'Facturation',   icon: CreditCard },
    { path: '/admin/usage',   label: 'Usage & Coûts', icon: BarChart2 },
    { path: '/admin/plans',   label: 'Plans',         icon: CreditCard },
  ]},
  { label: 'API publique', items: [
    { path: '/admin/public-api', label: 'Tableau de bord',  icon: Globe },
    { path: '/admin/api-docs',   label: 'Documentation',    icon: Globe },
    { path: '/admin/webhooks',   label: 'Webhooks',         icon: Globe },
  ]},
  { label: 'Sécurité', items: [
    { path: '/admin/security', label: 'Sécurité',   icon: Lock },
    { path: '/admin/audit',    label: 'Audit Logs', icon: Shield },
    { path: '/admin/rgpd',     label: 'RGPD',       icon: Shield },
  ]},
  { label: 'Infrastructure', items: [
    { path: '/admin/byoe',  label: 'Hébergement BYOE', icon: Server },
    { path: '/admin/azure', label: 'Azure AI',         icon: Server },
  ]},
  { label: 'Zone danger', items: [
    { path: '/admin/danger', label: 'Zone Danger', icon: Trash2 },
  ]},
];

const STORAGE_KEY = 'orlode.admin.nav.openSections.v2';

function loadOpenSections(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch { /* ignore */ }
  // Default: only sections with defaultOpen: true are expanded
  const defaults: Record<string, boolean> = {};
  for (const s of adminNav) defaults[s.label] = !!s.defaultOpen;
  return defaults;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(loadOpenSections);

  // Auto-collapse on small screens
  useEffect(() => {
    const check = () => { if (window.innerWidth < 768) setCollapsed(true); };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Persist open sections
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openSections)); } catch { /* ignore */ }
  }, [openSections]);

  // Auto-expand the section that contains the active route on mount/navigation
  useEffect(() => {
    const activeSection = adminNav.find(s => s.items.some(i => location.pathname === i.path || location.pathname.startsWith(i.path + '/')));
    if (activeSection && !openSections[activeSection.label]) {
      setOpenSections(prev => ({ ...prev, [activeSection.label]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Auto-close mobile drawer on route change. Belt-and-suspenders: NavLink
  // onClick already calls setMobileOpen(false), but a path change is the
  // source of truth — this catches any case where the drawer is open and
  // the route changes (e.g. programmatic navigate, deep links, edge cases).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    for (const s of adminNav) all[s.label] = true;
    setOpenSections(all);
  };
  const collapseAll = () => {
    const none: Record<string, boolean> = {};
    for (const s of adminNav) none[s.label] = false;
    setOpenSections(none);
  };

  // The mobile drawer ALWAYS renders expanded (collapsed=false) regardless of
  // the outer auto-collapse state — collapsed mode hides labels + section
  // headers, which makes the drawer unusable on touch.
  const SidebarNav = ({ onClose, collapsed: collapsedProp }: { onClose?: () => void; collapsed: boolean }) => (
    <>
      <div className="flex items-center h-14 px-3 border-b border-white/10 flex-shrink-0">
        {!collapsedProp && <span className="text-white font-semibold text-sm ml-1 flex items-center gap-2"><Settings size={16} /> Admin</span>}
        <div className="ml-auto flex items-center gap-1">
          {onClose && (
            <button onClick={onClose} className="text-white/60 hover:text-white p-1 md:hidden">
              <X size={16} />
            </button>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-white/60 hover:text-white hidden md:block" title={collapsed ? 'Étendre' : 'Réduire'}>
            <ChevronLeft size={16} className={collapsed ? 'rotate-180' : ''} />
          </button>
        </div>
      </div>

      <button
        onClick={() => { navigate('/'); onClose?.(); }}
        className="flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/5 text-xs transition-colors mx-2 mt-2 rounded-lg"
      >
        <ArrowLeft size={14} />
        {!collapsedProp && <span>Retour à l'app</span>}
      </button>

      {/* Expand / collapse all (only visible when not collapsed) */}
      {!collapsedProp && (
        <div className="flex gap-1 px-3 mt-1 mb-1 text-[10px]">
          <button onClick={expandAll} className="flex-1 text-white/40 hover:text-white py-1 rounded transition-colors">
            Tout ouvrir
          </button>
          <span className="text-white/20">·</span>
          <button onClick={collapseAll} className="flex-1 text-white/40 hover:text-white py-1 rounded transition-colors">
            Tout fermer
          </button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-1 no-scrollbar">
        {adminNav.map(section => {
          const isOpen = openSections[section.label] ?? false;
          const containsActive = section.items.some(i =>
            location.pathname === i.path || location.pathname.startsWith(i.path + '/'),
          );
          return (
            <div key={section.label}>
              {!collapsedProp ? (
                <button
                  onClick={() => toggleSection(section.label)}
                  className={`w-full flex items-center justify-between px-2 py-2.5 md:py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    containsActive ? 'text-white/90' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={12}
                    className="transition-transform"
                    style={{ transform: isOpen ? 'rotate(0)' : 'rotate(-90deg)' }}
                  />
                </button>
              ) : (
                <div className="border-t border-white/5 my-1" />
              )}
              {(isOpen || collapsedProp) && (
                <div className="space-y-0.5 mt-0.5">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end
                        onClick={() => onClose?.()}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-2.5 md:py-1.5 rounded-lg transition-colors ${
                            isActive ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`
                        }
                        title={collapsedProp ? item.label : undefined}
                      >
                        <Icon size={16} className="flex-shrink-0 md:!w-[15px] md:!h-[15px]" />
                        {!collapsedProp && (
                          <span className="whitespace-nowrap overflow-hidden text-sm md:text-xs">{item.label}</span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Overlay mobile ──────────────────────────────────────────── */}
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

      {/* ── Sidebar desktop ─────────────────────────────────────────── */}
      <div
        className="hidden md:flex flex-col flex-shrink-0 h-full transition-all duration-200"
        style={{ width: collapsed ? 56 : 220, background: '#1e293b' }}
      >
        <SidebarNav collapsed={collapsed} />
      </div>

      {/* ── Drawer mobile ──────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.22 }}
            className="fixed left-0 top-0 h-full w-72 z-30 flex flex-col md:hidden"
            style={{ background: '#1e293b' }}
          >
            <SidebarNav collapsed={false} onClose={() => setMobileOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contenu ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Barre mobile admin */}
        <div className="md:hidden flex items-center h-12 px-4 border-b border-gray-200 bg-white flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-600 hover:text-gray-900 p-1 -ml-1">
            <Menu size={20} />
          </button>
          <span className="ml-3 text-sm font-semibold text-gray-800">Administration</span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ fontSize: '15px' }}>
          <Outlet />
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
