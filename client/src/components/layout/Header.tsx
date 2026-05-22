import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, ChevronDown, User, Settings, LogOut, Shield, Moon, Sun, Globe } from 'lucide-react';
import { NotificationBell } from '@/components/layout/NotificationBell';
import CloneTrigger from '@/components/layout/CloneTrigger';
import { signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useLangStore, LANGUAGES } from '@/store/langStore';
import { motion, AnimatePresence } from 'framer-motion';

const PAGE_TITLES: Record<string, string> = {
  '/':          'Dashboard',
  '/chat':      'AI Chat',
  '/meeting':   'Réunions',
  '/agents/knowledge': 'Knowledge',
  '/faces':     'Annuaire',
  '/analytics': 'Analytique',
  '/settings':  'Paramètres',
};

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

function LangSelector() {
  const { lang, setLang } = useLangStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LANGUAGES.find(l => l.code === lang);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white text-sm">
        <span>{current?.flag}</span>
        {current?.code.toUpperCase()}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden w-44">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${lang === l.code ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
              <span className="text-base">{l.flag}</span>
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DarkToggle() {
  const { dark, toggle } = useThemeStore();
  return (
    <button onClick={toggle} className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white" title={dark ? 'Mode clair' : 'Mode sombre'}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Orlode AI';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <header
      className="h-16 flex items-center px-4 gap-4 flex-shrink-0 z-10"
      style={{
        background: 'linear-gradient(135deg, #063D2E 0%, #0A4F3C 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 2px 16px rgba(10,79,60,0.35)',
      }}
    >
      <button
        onClick={onMenuClick}
        className="lg:hidden text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="hidden lg:flex items-center gap-2">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-lg"
          style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #10B981, #D97706)',
            color: '#063D2E',
            fontWeight: 800, fontSize: 15,
            fontFamily: "'Fraunces', serif",
            letterSpacing: '-0.02em',
          }}
        >O</div>
        <h1 className="text-lg font-semibold text-white" style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-0.02em' }}>{pageTitle}</h1>
      </div>
      <h1 className="text-lg font-semibold text-white lg:hidden sm:block">{pageTitle}</h1>

      {/* Search — desktop */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher documents, chats..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full rounded-lg pl-9 pr-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(255,255,255,0.6)' }}
          />
        </div>
      </div>
      {/* Search icon — mobile */}
      <button className="md:hidden ml-auto text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
        <Search size={18} />
      </button>

      <div className="flex items-center gap-2 md:ml-0">
        {/* Admin button */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-white/20"
            style={{ color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.15)' }}
            title="Administration"
          >
            <Shield size={14} />
            <span className="hidden sm:block">Admin</span>
          </button>
        )}

        {/* Language selector */}
        <LangSelector />

        {/* Dark mode toggle */}
        <DarkToggle />

        {/* Clone widget trigger */}
        <CloneTrigger />

        {/* Unified notifications (real-time) */}
        <NotificationBell companyId={user?.companyId} />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen((p) => !p)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm bg-white" style={{ color: '#0A4F3C' }}>
              {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-sm text-white hidden md:block max-w-[120px] truncate font-medium">
              {user?.displayName ?? user?.email}
            </span>
            <ChevronDown size={14} className="text-white/70" />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.displayName ?? 'Utilisateur'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <button
                      onClick={() => { navigate('/admin'); setUserMenuOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Shield size={14} className="text-blue-500" />
                      Administration
                    </button>
                  )}
                  <button
                    onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={14} className="text-gray-400" />
                    Profil
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={14} className="text-gray-400" />
                    Paramètres
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={14} />
                    Déconnexion
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
