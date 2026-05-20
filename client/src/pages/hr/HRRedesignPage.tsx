import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/common/Toast';
import AgentDrawer from '@/components/ai/AgentDrawer';
import {
  Inbox,
  Search, Bell, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownRight,
  Users, UserPlus, UserCheck, UserX, UserMinus, Heart, Calendar, CalendarDays, CalendarClock, CalendarPlus,
  LayoutDashboard, MessageSquare, Bot, UsersRound, Briefcase,
  Store, Crown, Hammer, Plug, Settings, Shield, LogOut, X,
  Plus, Filter, MoreHorizontal, Sparkles, TrendingUp, TrendingDown,
  Mail, Phone, MapPin, Building2, Award, Star, Coffee, BookOpen,
  CheckCircle2, Clock, AlertTriangle, FileText, Send, Eye, Trash2,
  Plane, Sun, Snowflake, Stethoscope, Baby, GraduationCap,
  Smile, BarChart3, ListChecks, Gift, Zap, BadgeCheck, FileQuestion,
  Banknote, Wallet, CircleDollarSign, Receipt, FileSignature, Wand2,
  FilePlus2, FileCheck2, Download, Upload, Copy, Edit3, Edit,
  Target, Linkedin, Globe, Share2, ThumbsUp, ThumbsDown, Trophy,
  Video, MessageCircle, ChevronsRight, AtSign, Hash,
  DoorOpen, DoorClosed, Fingerprint, KeyRound, RadioTower,
  PhoneCall, Camera, Lock, Unlock, ShieldCheck, ShieldAlert,
  PieChart, LineChart, Activity, RefreshCw, Link2, Network, Layers, Tag,
  LayoutGrid, List as ListIcon,
  User, Loader2, Save, ExternalLink,
} from 'lucide-react';

// ============ PALETTE — RH = vert + bleu/cyan ============
const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  greenMid:    '#0F6B52',
  greenSoft:   '#E8F5EE',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  blue:        '#0EA5E9',
  blueDeep:    '#0284C7',
  blueSoft:    '#E0F2FE',
  blueMid:     '#7DD3FC',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  purple:      '#8B5CF6',
  purpleSoft:  '#EDE9FE',
  pink:        '#EC4899',
  pinkSoft:    '#FCE7F3',
  teal:        '#14B8A6',
  tealSoft:    '#CCFBF1',
  orange:      '#F97316',
  orangeSoft:  '#FFEDD5',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  onGreenSoft: '#A8C9B8',
};

const navItems = [
  { name: 'Administration',     icon: Shield },
  { name: 'Dashboard',          icon: LayoutDashboard },
  { name: 'AI Chat',            icon: MessageSquare },
  { name: 'Mes Agents',         icon: Bot, active: true },
  { name: 'Equipe',             icon: UsersRound },
  { name: 'Espace de travail', icon: Briefcase },
  { name: 'Calendrier',         icon: Calendar },
];

const moduleItems = [
  { name: 'Marketplace', icon: Store },
  { name: 'Abonnement',  icon: Crown },
  { name: 'Createur',    icon: Hammer },
  { name: 'Connectors',  icon: Plug },
  { name: 'Settings',    icon: Settings },
  { name: 'Super Admin', icon: Shield },
];

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font { font-family: 'JetBrains Mono', monospace; }

  .nav-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px; color: ${C.onGreenSoft}; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; position: relative; }
  .nav-item:hover { background: rgba(255, 250, 240, 0.06); color: ${C.cream}; }
  .nav-item.active { background: ${C.blue}; color: ${C.cream}; box-shadow: 0 8px 24px -8px rgba(14, 165, 233, 0.6); }
  .nav-item.active::after { content: ''; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: ${C.cream}; }

  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }

  .quick-action { background: rgba(255, 250, 240, 0.08); border: 1px solid rgba(255, 250, 240, 0.12); border-radius: 12px; padding: 10px 16px; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: ${C.cream}; cursor: pointer; transition: all 0.2s ease; font-family: inherit; }
  .quick-action:hover { background: ${C.blue}; border-color: ${C.blue}; transform: translateY(-1px); }

  .tab-btn { padding: 10px 18px; font-size: 14px; font-weight: 500; color: ${C.onGreenSoft}; cursor: pointer; border-radius: 10px; transition: all 0.2s ease; background: transparent; border: none; font-family: inherit; }
  .tab-btn:hover { color: ${C.cream}; }
  .tab-btn.active { background: ${C.blue}; color: ${C.cream}; box-shadow: 0 4px 14px -4px rgba(14, 165, 233, 0.5); }

  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }

  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.blue}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.blue}; opacity: 0.4; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }

  .row-card { background: ${C.cream}; border-radius: 16px; padding: 18px 20px; border: 1px solid rgba(10, 42, 32, 0.06); transition: all 0.2s ease; cursor: pointer; display: flex; align-items: center; gap: 16px; }
  .row-card:hover { transform: translateX(4px); border-color: ${C.blue}; box-shadow: 0 12px 24px -12px rgba(14, 165, 233, 0.25); }

  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.blueSoft}; color: ${C.blueDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.blue}; color: ${C.cream}; }
  .icon-btn.danger:hover { background: ${C.red}; color: ${C.cream}; }

  .btn-primary { background: ${C.blue}; color: ${C.cream}; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px rgba(14, 165, 233, 0.5); font-family: inherit; }
  .btn-primary:hover { background: ${C.blueDeep}; transform: translateY(-2px); box-shadow: 0 14px 28px -8px rgba(14, 165, 233, 0.6); }

  .btn-secondary { background: ${C.cream}; color: ${C.greenDeep}; border: 1px solid rgba(10, 42, 32, 0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }

  .avatar { border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 700; color: ${C.cream}; flex-shrink: 0; }

  .progress-bar { height: 6px; border-radius: 3px; background: rgba(10, 42, 32, 0.08); overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }

  @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; }
  .stagger > *:nth-child(2) { animation-delay: 0.1s; }
  .stagger > *:nth-child(3) { animation-delay: 0.15s; }
  .stagger > *:nth-child(4) { animation-delay: 0.2s; }
  .stagger > *:nth-child(5) { animation-delay: 0.25s; }
  .stagger > *:nth-child(6) { animation-delay: 0.3s; }
  .stagger > *:nth-child(7) { animation-delay: 0.35s; }
  .stagger > *:nth-child(8) { animation-delay: 0.4s; }

  .mobile-menu-btn { display: none; }
  .mobile-only { display: none; }

  @media (max-width: 1024px) {
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-charts { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 768px) {
    .sidebar-aside { position: fixed !important; left: 0; top: 0; transform: translateX(-100%); transition: transform 0.3s ease; z-index: 100; box-shadow: 0 0 40px rgba(0,0,0,0.5); }
    .sidebar-aside.open { transform: translateX(0); }
    .sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
    .mobile-menu-btn { display: flex !important; }
    .desktop-only { display: none !important; }
    .mobile-only { display: flex !important; }
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .hero-title { font-size: 32px !important; }
    .row-card { flex-wrap: wrap !important; gap: 12px !important; }
    .hide-on-mobile { display: none !important; }
  }
  @media (max-width: 480px) {
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .hero-title { font-size: 26px !important; }
  }

  .modal-overlay { position: fixed; inset: 0; background: rgba(10, 42, 32, 0.7); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-content { background: ${C.cream}; border-radius: 24px; width: 100%; max-width: 720px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.5); animation: modalSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  @keyframes modalSlide { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

  .form-input { width: 100%; background: ${C.cream}; border: 1.5px solid rgba(10,42,32,0.1); border-radius: 10px; padding: 11px 14px; font-size: 14px; color: ${C.ink}; font-family: inherit; outline: none; transition: all 0.2s ease; }
  .form-input:focus { border-color: ${C.blue}; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
  .form-label { display: block; font-size: 11px; font-weight: 700; color: ${C.ink}; letter-spacing: 0.05em; margin-bottom: 6px; text-transform: uppercase; }
  .form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }

  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; border: 1.5px solid transparent; }
  .chip-outline { background: transparent; border-color: rgba(10,42,32,0.15); color: ${C.ink}; }
  .chip-outline:hover { border-color: ${C.blue}; color: ${C.blue}; }
  .chip-selected { background: ${C.blue}; color: ${C.cream}; border-color: ${C.blue}; }

  .stepper { display: flex; gap: 4px; margin-bottom: 24px; }
  .step-dot { flex: 1; height: 4px; border-radius: 4px; background: rgba(10,42,32,0.1); transition: all 0.3s ease; }
  .step-dot.active { background: ${C.blue}; }
  .step-dot.done { background: ${C.greenDeep}; }
`;

// ============ CHROME (lite — sidebar/header gérés par le layout corpmind-ai) ============
function Chrome({ children }) {
  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>
        {children}
      </main>
    </div>
  );
}

// ============ COMING-SOON HELPER ============
// Transparent placeholder for buttons whose backend isn't wired yet.
// We prefer "honest 'bientôt' toast" over "silently broken click" — passes the
// no-fake-UI rule. Each call mentions the feature so we know what to wire next.
function comingSoon(featureName?: string) {
  toast.info(
    'Bientôt disponible',
    featureName
      ? `La fonctionnalité "${featureName}" arrive dans la prochaine release.`
      : 'Cette fonctionnalité arrive dans la prochaine release.',
  );
}

// CSV download — reusable for "Exporter" buttons.
function downloadCSV(filename: string, rows: Array<Record<string, any>>) {
  if (!rows || rows.length === 0) {
    toast.info('Rien à exporter', 'Aucune donnée disponible pour l\'export.');
    return;
  }
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success('Export téléchargé', `${rows.length} ligne${rows.length > 1 ? 's' : ''}`);
}

// ============ DATA HOOKS — branchés sur l'API corpmind ============
function safeGet(url: string) {
  return api.get(url).then((r: any) => r?.data ?? null).catch(() => null);
}

const REFRESH_INTERVAL_MS = 10000; // Auto-refresh toutes les 10 secondes (quasi-live)

function useHRData() {
  const [data, setData] = useState<any>({
    me: null, leaveRemaining: null,
    leavesPending: [], leavesAll: [], leaveHistory: [],
    employees: [], stats: null,
    candidates: [], jobs: [],
    policies: [], orgChart: null,
    performanceReviews: [], analytics: null,
    surveys: [], teamCalendar: [],
    moodInsights: null,
    loaded: false,
    lastSync: null,
  });

  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/hr/me'),
    safeGet('/hr/leave/pending'),
    safeGet('/hr/leave/all'),
    safeGet('/hr/leave/history'),
    safeGet('/hr/employees'),
    safeGet('/hr/stats'),
    safeGet('/hr/candidates'),
    safeGet('/hr/jobs'),
    safeGet('/hr/policies'),
    safeGet('/hr/org-chart'),
    safeGet('/hr/performance-reviews'),
    safeGet('/hr/analytics'),
    safeGet('/hr/surveys'),
    safeGet('/hr/team-calendar'),
    safeGet('/hr/coach/insights'),
  ]).then(([me, lp, la, lh, emp, st, cand, jobs, pol, org, prev, an, sv, tc, ins]) => {
    if (!mountedRef.current) return;
    setData({
      me: me?.user ?? me ?? null,
      leaveRemaining: me?.leaveRemaining ?? null,
      leavesPending: lp?.requests ?? lp ?? [],
      leavesAll: la?.requests ?? la ?? [],
      leaveHistory: lh?.requests ?? lh ?? [],
      employees: emp?.employees ?? emp ?? [],
      stats: st ?? null,
      candidates: cand?.candidates ?? cand ?? [],
      jobs: jobs?.jobs ?? jobs ?? [],
      policies: pol?.policies ?? pol ?? [],
      orgChart: org ?? null,
      performanceReviews: prev?.reviews ?? prev ?? [],
      analytics: an ?? null,
      surveys: sv?.surveys ?? sv ?? [],
      teamCalendar: tc?.events ?? tc ?? [],
      moodInsights: ins ?? null,
      loaded: true,
      lastSync: new Date(),
    });
  });

  useEffect(() => {
    const mountedRef = { current: true };
    fetchAll(mountedRef);
    const interval = setInterval(() => fetchAll(mountedRef), REFRESH_INTERVAL_MS);
    return () => { mountedRef.current = false; clearInterval(interval); };
  }, []);

  return data;
}

// ============ LIVE SYNC BADGE ============
function LiveSyncBadge({ lastSync, intervalMs = 10000 }: { lastSync: Date | null; intervalMs?: number }) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    if (!lastSync) return;
    const tick = () => setSecondsAgo(Math.floor((Date.now() - lastSync.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSync]);
  if (!lastSync) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: 28, zIndex: 50,
      background: 'rgba(10, 42, 32, 0.92)', backdropFilter: 'blur(8px)',
      border: `1px solid ${C.blue}40`,
      padding: '8px 14px', borderRadius: 100,
      display: 'flex', alignItems: 'center', gap: 8,
      color: C.cream, fontSize: 12, fontWeight: 600,
      fontFamily: "'Inter', sans-serif",
      boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
    }}>
      <span className="live-dot"></span>
      <span style={{ color: C.blueMid }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
        sync · {secondsAgo}s · refresh {intervalMs / 1000}s
      </span>
    </div>
  );
}

// ============ EMPTY STATE ============
function EmptyState({ icon: Icon = Inbox, title = 'Pas encore de données', desc = 'Les informations s\'afficheront ici dès que disponibles.', action = null }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: '48px 32px', border: '1px dashed rgba(10,42,32,0.15)', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: C.blueSoft, color: C.blueDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h4 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>{title}</h4>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {action}
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: 100, background: C.blue, animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}></span>
      ))}
    </div>
  );
}

// ============ HEADER + TABS ============
function PageHeader({ title, italic, subtitle, badge, actions, leftPills, gradient = 'blue' }) {
  const gradientStyle = gradient === 'green'
    ? `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.greenMid} 100%)`
    : `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDeep} 100%)`;
  const shadow = gradient === 'green' ? 'rgba(10, 79, 60, 0.4)' : 'rgba(14, 165, 233, 0.4)';
  const accentColor = gradient === 'green' ? C.blueMid : C.greenDeep;
  return (
    <div style={{ padding: '32px 32px 0' }}>
      <div className="grain" style={{ background: gradientStyle, borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden', color: C.cream, boxShadow: `0 30px 60px -20px ${shadow}` }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="40" stroke={accentColor} strokeWidth="2" fill="none" />
          <circle cx="140" cy="140" r="14" fill={accentColor} />
        </svg>
        <svg style={{ position: 'absolute', left: 24, bottom: 24, opacity: 0.15 }} width="80" height="40">
          {[...Array(5)].map((_, row) => [...Array(10)].map((_, col) => (
            <circle key={`${row}-${col}`} cx={col * 8 + 4} cy={row * 8 + 4} r="1.5" fill={C.cream} />
          )))}
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              {leftPills}
              {badge && (<div className="pill" style={{ background: accentColor, color: C.cream }}><span className="live-dot" style={{ background: C.cream }}></span>{badge}</div>)}
            </div>
            <h1 className="display-font hero-title" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.cream, letterSpacing: '-0.03em' }}>
              {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: accentColor }}>{italic}</em>}
            </h1>
            {subtitle && (<p style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.85)', maxWidth: 540 }}>{subtitle}</p>)}
          </div>
          {actions && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      </div>
    </div>
  );
}

function TabSwitcher({ active, setActive }) {
  // Hidden tabs (100% decorative — backend not wired): Présence, Accès, Reporting BI, Formation.
  // Will be re-enabled when their data/CTAs are wired. Until then they hurt trust ("user clicks → nothing").
  const tabGroups = [
    { label: 'GESTION', tabs: ['Accueil', 'Dashboard RH', 'Effectifs', 'Annuaire', 'Recrutement', 'Onboarding'] },
    { label: 'OPS', tabs: ['Congés', 'Paie', 'Frais', 'Documents'] },
    { label: 'TALENTS', tabs: ['Performance', 'Évaluations 360°', 'Talents'] },
    { label: 'AUTRES', tabs: ['Calendrier RH', 'Politique & FAQ'] },
  ];
  return (
    <div style={{ padding: '24px 32px 0' }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {tabGroups.map((group) => (
          <div key={group.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.onGreenSoft, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{group.label}</span>
            <div style={{ display: 'inline-flex', gap: 3, background: C.greenDark, padding: 3, borderRadius: 12, border: '1px solid rgba(255,250,240,0.06)', flexWrap: 'wrap' }}>
              {group.tabs.map(tab => (
                <button key={tab} className={`tab-btn ${active === tab ? 'active' : ''}`} onClick={() => setActive(tab)} style={{ padding: '8px 14px', fontSize: 13 }}>{tab}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ REUSABLE BITS ============
function StatCard({ label, value, suffix, sub, icon: Icon, color, bg, trendUp }) {
  return (
    <div style={{ background: C.cream, borderRadius: 20, padding: 22, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden', transition: 'all 0.3s ease', cursor: 'pointer' }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 20px 40px -20px rgba(10,42,32,0.15)'; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }}></div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 8px 16px -8px ${color}40` }}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span className="display-font" style={{ fontSize: 36, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
        {suffix && (<span className="display-font" style={{ fontSize: 18, color: C.inkSoft, fontWeight: 600 }}>{suffix}</span>)}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 11, color: trendUp ? C.greenDeep : C.inkSoft, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
        {trendUp && <ArrowUpRight size={11} />}{sub}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, color = C.blue, title, italic }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      {Icon && <Icon size={18} color={color} />}
      <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
        {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.blueMid, fontSize: 18 }}>— {italic}</em>}
      </h3>
    </div>
  );
}

function ViewToggle({ view, setView }: any) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: C.greenDark, padding: 3, borderRadius: 10, border: '1px solid rgba(255,250,240,0.06)' }}>
      {[
        { id: 'list', icon: ListIcon, label: 'Liste' },
        { id: 'grid', icon: LayoutGrid, label: 'Grille' },
      ].map(v => {
        const Ic = v.icon;
        return (
          <button key={v.id} onClick={() => setView(v.id)} className={`tab-btn ${view === v.id ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Ic size={12} /> {v.label}
          </button>
        );
      })}
    </div>
  );
}

function ModalShell({ title, subtitle, icon: Icon, color = C.blue, onClose, children, footer, size = 'md' }) {
  const maxW = size === 'lg' ? 880 : size === 'sm' ? 480 : 640;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: maxW }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(10,42,32,0.08)', display: 'flex', alignItems: 'center', gap: 14 }}>
          {Icon && (
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={22} strokeWidth={1.75} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>{title}</h3>
            {subtitle && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(10,42,32,0.06)', border: 'none', color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '24px 28px', overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '18px 28px', borderTop: '1px solid rgba(10,42,32,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'rgba(10,42,32,0.02)' }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ============ MODALS ============
function NewLeaveModal({ onClose }) {
  const [type, setType] = useState('Congés payés');
  const [step, setStep] = useState(1);
  const [startDate, setStartDate] = useState('2026-04-28');
  const [endDate, setEndDate] = useState('2026-05-02');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const types = [
    { name: 'Congés payés', icon: Plane, color: C.blue },
    { name: 'Maladie', icon: Stethoscope, color: C.red },
    { name: 'Maternité', icon: Baby, color: C.pink },
    { name: 'Formation', icon: GraduationCap, color: C.purple },
    { name: 'RTT', icon: Sun, color: C.yellow },
    { name: 'Sans solde', icon: Snowflake, color: C.teal },
  ];
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/hr/leave/request', { type, startDate, endDate, reason });
      toast.success('Demande envoyée');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'La demande n\'a pas pu être envoyée.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <ModalShell title="Nouvelle demande de congé" subtitle="Remplis le formulaire en 30 secondes" icon={Plane} color={C.blue} onClose={onClose}
      footer={<>
        {step > 1 && <button className="btn-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={14} /> Précédent</button>}
        <button className="btn-primary" disabled={submitting} onClick={() => step < 3 ? setStep(step + 1) : submit()}>{step < 3 ? 'Suivant' : (submitting ? 'Envoi…' : 'Envoyer la demande')} {step < 3 && <ArrowRight size={14} />}{step === 3 && !submitting && <Send size={14} />}</button>
      </>}>
      <div className="stepper">
        <div className={`step-dot ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`}></div>
        <div className={`step-dot ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`}></div>
        <div className={`step-dot ${step >= 3 ? 'active' : ''}`}></div>
      </div>
      {step === 1 && (
        <div>
          <label className="form-label">Type de congé</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {types.map(t => {
              const Ic = t.icon;
              return (
                <button key={t.name} onClick={() => setType(t.name)} style={{ background: type === t.name ? `${t.color}15` : C.cream, border: `1.5px solid ${type === t.name ? t.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}20`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={18} /></div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div><label className="form-label">Date de début</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><label className="form-label">Date de fin</label><input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>
          <div><label className="form-label">Demi-journée ?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Journée complète', 'Matin', 'Après-midi'].map(o => (
                <button key={o} type="button" className="chip chip-outline" style={{ flex: 1 }}>{o}</button>
              ))}
            </div>
          </div>
          <div><label className="form-label">Motif (optionnel)</label>
            <textarea className="form-input" rows={3} placeholder="Vacances en famille…" value={reason} onChange={e => setReason(e.target.value)}></textarea>
          </div>
          <div style={{ background: C.blueSoft, border: `1px solid ${C.blue}40`, borderRadius: 12, padding: 14, display: 'flex', gap: 10 }}>
            <Sparkles size={16} color={C.blueDeep} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.blueDeep, marginBottom: 2 }}>Solde après cette demande</div>
              <div style={{ fontSize: 13, color: C.ink }}>5 jours posés · <strong>17 jours restants</strong> sur 22</div>
            </div>
          </div>
        </div>
      )}
      {step === 3 && (
        <div>
          <div style={{ background: C.greenSoft, border: `1.5px solid ${C.greenDeep}40`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <CheckCircle2 size={20} color={C.greenDeep} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink }}>Récapitulatif</h4>
            </div>
            {[
              ['Type', type],
              ['Période', '28 avril → 2 mai 2026'],
              ['Durée', '5 jours ouvrés'],
              ['Approbateur', 'Marie Diallo (Manager)'],
              ['Statut', 'En attente de validation'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed rgba(10,42,32,0.1)' }}>
                <span style={{ fontSize: 12, color: C.inkSoft }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{v}</span>
              </div>
            ))}
          </div>
          <label className="form-label">Notifications</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Notifier mon équipe', 'Bloquer mon agenda', 'Activer la réponse auto email'].map(o => (
              <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: 8 }}>
                <input type="checkbox" defaultChecked style={{ accentColor: C.blue }} />
                <span style={{ fontSize: 13, color: C.ink }}>{o}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ── Employee 360° Detail Modal ─────────────────────────────────────────────
function EmployeeDetailModal({ employee, onClose }: { employee: any; onClose: () => void }) {
  const [tab, setTab] = useState<'identity' | 'contracts'>('identity');
  const [profile, setProfile] = useState<any>(employee ?? {});
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<any>({});

  useEffect(() => {
    if (!employee?.id) return;
    setLoading(true);
    Promise.all([
      api.get(`/hr/employees/${employee.id}`).then((r: any) => r?.data?.data ?? {}).catch(() => ({})),
      api.get(`/hr/employees/${employee.id}/contracts`).then((r: any) => r?.data?.data ?? []).catch(() => []),
    ])
      .then(([prof, ctrs]) => {
        const merged = { ...employee, ...prof };
        setProfile(merged);
        setDraft(merged);
        setContracts(ctrs);
      })
      .finally(() => setLoading(false));
  }, [employee?.id]);

  const initials = (profile.displayName || profile.name || profile.firstName || 'E')
    .split(' ').map((p: string) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const accent = profile.color || C.purple;

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        displayName: draft.displayName ?? draft.name,
        email: draft.email,
        phone: draft.phone,
        whatsappPhone: draft.whatsappPhone ?? draft.phone,
        address: draft.address,
        birthDate: draft.birthDate,
        jobTitle: draft.jobTitle ?? draft.role,
        department: draft.department ?? draft.dept,
        manager: draft.manager,
        startDate: draft.startDate,
        baseSalary: typeof draft.baseSalary === 'string' ? parseFloat(draft.baseSalary) : draft.baseSalary,
        currency: draft.currency,
        employmentType: draft.employmentType,
        emergencyContact: draft.emergencyContact,
      };
      await api.patch(`/hr/employees/${employee.id}`, payload);
      setProfile({ ...profile, ...payload });
      setEdit(false);
      toast.success('Profil mis à jour');
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message ?? 'Sauvegarde impossible.');
    } finally {
      setSaving(false);
    }
  };

  const sendContract = async () => {
    onClose();
    toast.info('Astuce', `Demande à l'orchestrateur : "Envoie un contrat freelance à ${profile.displayName ?? profile.name} (${profile.email})"`);
  };

  const labelStyle = { fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4, display: 'block' };
  const valueStyle = { fontSize: 13, color: C.ink, padding: '10px 12px', background: C.creamDeep, borderRadius: 8, minHeight: 38, display: 'flex', alignItems: 'center' };
  const inputStyle = { fontSize: 13, color: C.ink, padding: '10px 12px', background: '#fff', borderRadius: 8, border: `1px solid ${C.purple}40`, outline: 'none', width: '100%', fontFamily: 'inherit' as const };

  const Field = ({ label, name, value, type = 'text' }: { label: string; name: string; value: any; type?: string }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      {edit ? (
        <input
          type={type}
          value={draft[name] ?? value ?? ''}
          onChange={e => setDraft({ ...draft, [name]: e.target.value })}
          style={inputStyle}
        />
      ) : (
        <div style={valueStyle}>{value ?? '—'}</div>
      )}
    </div>
  );

  const statusColor: Record<string, string> = {
    pending_signature: C.yellow,
    signed: C.greenDeep,
    expired: C.red,
    draft: C.inkSoft,
    rejected: C.red,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 880, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Header with avatar */}
        <div style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 100%)`,
          padding: '28px 28px', display: 'flex', alignItems: 'center', gap: 18,
          color: '#fff',
        }}>
          <div className="avatar" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', width: 64, height: 64, fontSize: 22, fontWeight: 700 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
              {profile.displayName || profile.name || 'Employé'}
            </div>
            <div style={{ fontSize: 13, opacity: 0.92, marginTop: 2 }}>
              {profile.jobTitle || profile.role || '—'}{profile.department ? ` · ${profile.department}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.20)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(10,42,32,0.08)', padding: '0 28px', gap: 6 }}>
          {[
            { id: 'identity' as const, label: 'Identité', icon: User },
            { id: 'contracts' as const, label: `Contrats (${contracts.length})`, icon: FileText },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '14px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.id ? `2px solid ${accent}` : '2px solid transparent',
                color: tab === t.id ? accent : C.inkSoft,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit',
              }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px', overflow: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft }}>
              <Loader2 size={28} className="spin" />
              <div style={{ marginTop: 8, fontSize: 13 }}>Chargement…</div>
            </div>
          ) : tab === 'identity' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                {edit ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEdit(false); setDraft(profile); }} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>Annuler</button>
                    <button onClick={save} disabled={saving} className="btn-primary" style={{ background: accent, padding: '8px 14px', fontSize: 12 }}>
                      {saving ? <><Loader2 size={12} className="spin" /> Sauvegarde…</> : <><Save size={12} /> Enregistrer</>}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setDraft(profile); setEdit(true); }} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
                    <Edit size={12} /> Modifier
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
                <Field label="Nom complet"     name="displayName" value={profile.displayName || profile.name} />
                <Field label="Email"           name="email"       value={profile.email} type="email" />
                <Field label="Téléphone"       name="phone"       value={profile.phone} />
                <Field label="WhatsApp"        name="whatsappPhone" value={profile.whatsappPhone || profile.phone} />
                <Field label="Adresse"         name="address"     value={profile.address} />
                <Field label="Date de naissance" name="birthDate" value={profile.birthDate} type="date" />
              </div>

              <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Poste</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
                <Field label="Titre du poste"  name="jobTitle"    value={profile.jobTitle || profile.role} />
                <Field label="Département"     name="department"  value={profile.department || profile.dept} />
                <Field label="Manager"         name="manager"     value={profile.manager} />
                <Field label="Date d'embauche" name="startDate"   value={profile.startDate} type="date" />
                <Field label="Type de contrat" name="employmentType" value={profile.employmentType} />
                <Field label="Salaire (brut)"  name="baseSalary"  value={profile.baseSalary} type="number" />
              </div>

              <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgence</div>
              <Field label="Contact d'urgence" name="emergencyContact" value={profile.emergencyContact} />
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: C.inkSoft }}>
                  {contracts.length} contrat{contracts.length > 1 ? 's' : ''} attaché{contracts.length > 1 ? 's' : ''} à cet employé
                </div>
                <button onClick={sendContract} className="btn-primary" style={{ background: accent, padding: '8px 14px', fontSize: 12 }}>
                  <Plus size={12} /> Envoyer un contrat
                </button>
              </div>
              {contracts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft, background: C.creamDeep, borderRadius: 14 }}>
                  <FileText size={32} color={C.inkSoft} style={{ marginBottom: 10, opacity: 0.5 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Aucun contrat</div>
                  <div style={{ fontSize: 12 }}>Envoie un contrat depuis le chat IA ou clique « Envoyer un contrat »</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {contracts.map(c => (
                    <div key={c.id} style={{ background: C.cream, borderRadius: 12, padding: 16, border: '1px solid rgba(10,42,32,0.08)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                          {c.contractType?.toUpperCase() ?? 'Contrat'}
                          {c.signatoryName ? ` · ${c.signatoryName}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                          {c.signatoryEmail ?? '—'}
                          {c.createdAt ? ` · Créé le ${new Date(c.createdAt).toLocaleDateString('fr-FR')}` : ''}
                          {c.signedAt ? ` · Signé le ${new Date(c.signedAt).toLocaleDateString('fr-FR')}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="pill" style={{
                          background: `${statusColor[c.status] ?? C.inkSoft}15`,
                          color: statusColor[c.status] ?? C.inkSoft,
                          fontWeight: 700, fontSize: 10, padding: '4px 10px',
                        }}>
                          {c.status === 'pending_signature' ? 'En attente' :
                           c.status === 'signed' ? 'Signé' :
                           c.status === 'expired' ? 'Expiré' :
                           c.status === 'draft' ? 'Brouillon' : c.status}
                        </span>
                        {c.uniqueLink && (
                          <a href={`/sign/${c.uniqueLink}`} target="_blank" rel="noopener noreferrer"
                            className="icon-btn" style={{ width: 32, height: 32, background: `${accent}15`, color: accent, textDecoration: 'none' }}
                            title="Ouvrir le contrat">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NewEmployeeModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('Ingénierie');
  const [contractType, setContractType] = useState('CDI');
  const [hireDate, setHireDate] = useState('');
  const [salary, setSalary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Photo upload state
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const handlePhoto = (file: File) => {
    if (file.size > 4 * 1024 * 1024) { toast.error('Photo trop lourde', 'Max 4 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      setPhotoBase64(dataUrl.replace(/^data:image\/[^;]+;base64,/, ''));
      setPhotoMimeType(file.type || 'image/jpeg');
      setPhotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };
  const submit = async () => {
    if (submitting) return;
    if (!email.trim() || !firstName.trim()) { toast.error('Prénom et email requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/users/invite', {
        email,
        name: `${firstName} ${lastName}`.trim(),
        role: 'employee',
        position, department, contractType,
        phone, hireDate,
        salary: salary ? Number(salary) : null,
        ...(photoBase64 ? { photoBase64, photoMimeType } : {}),
      });
      toast.success('Invitation envoyée', `${email} recevra un email pour rejoindre l'équipe.`);
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible d\'envoyer l\'invitation.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Ajouter un employé" subtitle={`Étape ${step} sur 4`} icon={UserPlus} color={C.purple} onClose={onClose} size="lg"
      footer={<>
        {step > 1 && <button className="btn-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={14} /> Précédent</button>}
        <button className="btn-primary" disabled={submitting} style={{ background: C.purple, boxShadow: '0 8px 24px -8px rgba(139, 92, 246, 0.5)' }} onClick={() => step < 4 ? setStep(step + 1) : submit()}>
          {step < 4 ? 'Continuer' : (submitting ? 'Création…' : 'Créer l\'employé')} {step < 4 && <ArrowRight size={14} />}{step === 4 && !submitting && <CheckCircle2 size={14} />}
        </button>
      </>}>
      <div className="stepper">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`step-dot ${step >= i ? (step > i ? 'done' : 'active') : ''}`}></div>
        ))}
      </div>
      {step === 1 && (
        <div>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginTop: 0, marginBottom: 14 }}>Informations personnelles</h4>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
            <div onClick={() => photoInputRef.current?.click()}
              title="Cliquer pour uploader une photo"
              style={{
                width: 80, height: 80, borderRadius: 16,
                background: photoPreview ? '#000' : C.purpleSoft,
                color: C.purple,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: 'pointer',
                border: photoPreview ? 'none' : `2px dashed ${C.purple}`,
                overflow: 'hidden', position: 'relative',
              }}>
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.4)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity .2s ease',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                    <Camera size={20} />
                  </div>
                </>
              ) : (
                <Camera size={28} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div className="form-row">
                <div><label className="form-label">Prénom</label><input className="form-input" placeholder="Jean" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div><label className="form-label">Nom</label><input className="form-input" placeholder="Dupont" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
              </div>
              {!photoPreview && (
                <div style={{ fontSize: 10, color: C.inkMid, marginTop: 6 }}>
                  📷 <span onClick={() => photoInputRef.current?.click()} style={{ color: C.purple, cursor: 'pointer', textDecoration: 'underline' }}>Ajouter une photo</span> (optionnel · max 4 MB)
                </div>
              )}
            </div>
          </div>
          <div className="form-row">
            <div><label className="form-label">Email pro</label><input className="form-input" placeholder="jean@orlode.ai" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><label className="form-label">Téléphone</label><input className="form-input" placeholder="+33 6 12 34 56 78" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          </div>
          <div className="form-row" style={{ marginTop: 14 }}>
            <div><label className="form-label">Date de naissance</label><input type="date" className="form-input" /></div>
            <div><label className="form-label">Genre</label>
              <select className="form-input"><option>Femme</option><option>Homme</option><option>Autre</option><option>Préfère ne pas dire</option></select>
            </div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginTop: 0, marginBottom: 14 }}>Contrat & Poste</h4>
          <div className="form-row">
            <div><label className="form-label">Poste</label><input className="form-input" placeholder="Senior Engineer" value={position} onChange={e => setPosition(e.target.value)} /></div>
            <div><label className="form-label">Département</label>
              <select className="form-input" value={department} onChange={e => setDepartment(e.target.value)}><option>Ingénierie</option><option>Commercial</option><option>Design</option><option>Marketing</option><option>Support</option></select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 14 }}>
            <div><label className="form-label">Manager direct</label><input className="form-input" placeholder="Sélectionner…" /></div>
            <div><label className="form-label">Type de contrat</label>
              <select className="form-input" value={contractType} onChange={e => setContractType(e.target.value)}><option>CDI</option><option>CDD</option><option>Stage</option><option>Alternance</option><option>Freelance</option></select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 14 }}>
            <div><label className="form-label">Date d'embauche</label><input type="date" className="form-input" value={hireDate} onChange={e => setHireDate(e.target.value)} /></div>
            <div><label className="form-label">Période d'essai (mois)</label><input className="form-input" type="number" defaultValue="3" /></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="form-label">Salaire brut mensuel (FCFA)</label>
            <input className="form-input" type="number" placeholder="850 000" value={salary} onChange={e => setSalary(e.target.value)} />
          </div>
        </div>
      )}
      {step === 3 && (
        <div>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginTop: 0, marginBottom: 14 }}>Accès & Équipement</h4>
          <label className="form-label">Outils & accès à provisionner</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {['Email pro', 'Slack', 'Notion', 'GitHub', 'Figma', 'Linear', 'AWS', 'VPN', 'Badge'].map(t => (
              <label key={t} style={{ background: C.cream, border: '1.5px solid rgba(10,42,32,0.1)', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: C.purple }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{t}</span>
              </label>
            ))}
          </div>
          <label className="form-label" style={{ marginTop: 18 }}>Équipement matériel</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {['MacBook Pro 14"', 'Écran externe 27"', 'Chaise ergonomique', 'Casque audio', 'Téléphone pro', 'Souris + clavier'].map(t => (
              <label key={t} style={{ background: C.cream, border: '1.5px solid rgba(10,42,32,0.1)', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: C.purple }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{t}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {step === 4 && (
        <div>
          <div style={{ background: C.greenSoft, border: `1.5px solid ${C.greenDeep}40`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.greenDeep, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} /> Onboarding automatique
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
              L'IA va générer une checklist d'onboarding sur mesure, créer les accès, envoyer un kit de bienvenue, et planifier les réunions du premier jour.
            </p>
          </div>
          <label className="form-label">Activer pour ce nouvel employé :</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Générer contrat de travail', desc: 'CDI standard avec clauses adaptées au poste' },
              { label: 'Créer accès SaaS', desc: '9 outils sélectionnés à l\'étape précédente' },
              { label: 'Programmer kit de bienvenue', desc: 'Livraison à l\'adresse renseignée' },
              { label: 'Inviter aux réunions du premier jour', desc: '5 réunions par défaut' },
              { label: 'Annonce Slack #general', desc: 'Présentation automatique avec photo' },
            ].map((o, i) => (
              <label key={i} style={{ background: C.cream, border: '1.5px solid rgba(10,42,32,0.08)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: C.purple, width: 18, height: 18 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{o.label}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{o.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function ExpenseModal({ onClose }) {
  const cats: any[] = [];
  const [cat, setCat] = useState('Repas');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!amount || Number(amount) <= 0) { toast.error('Montant requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/finance/expenses', { category: cat, amount: Number(amount), description, source: 'hr' });
      toast.success('Note de frais soumise');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de soumettre.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouvelle note de frais" subtitle="L'IA extrait les infos du justificatif automatiquement" icon={Receipt} color={C.yellow} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" style={{ background: C.yellow, boxShadow: '0 8px 24px -8px rgba(245, 158, 11, 0.5)' }} disabled={submitting} onClick={submit}><Send size={14} /> {submitting ? 'Envoi…' : 'Soumettre'}</button></>}>
      <div style={{ background: `linear-gradient(135deg, ${C.yellowSoft} 0%, ${C.cream} 100%)`, border: `2px dashed ${C.yellow}`, borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 16, cursor: 'pointer' }}>
        <Upload size={32} color={C.yellow} style={{ margin: '0 auto 8px' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Glissez votre justificatif ici</div>
        <div style={{ fontSize: 12, color: C.inkSoft }}>JPG, PNG, PDF · Max 10 Mo · L'IA lira automatiquement le montant</div>
      </div>
      <label className="form-label">Catégorie</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 14 }}>
        {cats.map(c => {
          const Ic = c.icon;
          return (
            <button key={c.name} onClick={() => setCat(c.name)} style={{ background: cat === c.name ? `${c.color}20` : C.cream, border: `1.5px solid ${cat === c.name ? c.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Ic size={16} color={c.color} />
              <span style={{ fontSize: 10, fontWeight: 600, color: C.ink }}>{c.name}</span>
            </button>
          );
        })}
      </div>
      <div className="form-row">
        <div><label className="form-label">Montant TTC</label><input className="form-input" type="number" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div><label className="form-label">Devise</label>
          <select className="form-input"><option>FCFA</option><option>EUR</option><option>USD</option></select>
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Date</label><input type="date" className="form-input" /></div>
        <div><label className="form-label">Mode de paiement</label>
          <select className="form-input"><option>Carte bancaire perso</option><option>Espèces</option><option>Virement</option><option>Carte société</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={2} placeholder="Déjeuner avec le client Dupont SAS" value={description} onChange={e => setDescription(e.target.value)}></textarea>
      </div>
    </ModalShell>
  );
}

function EvaluationModal({ onClose }) {
  const [scores, setScores] = useState({ technical: 4, collab: 5, autonomy: 4, impact: 5 });
  const [submitting, setSubmitting] = useState(false);
  const criteria = [
    { key: 'technical', label: 'Compétences techniques', desc: 'Maîtrise des outils et savoir-faire' },
    { key: 'collab', label: 'Collaboration', desc: 'Travail en équipe, communication' },
    { key: 'autonomy', label: 'Autonomie', desc: 'Prise d\'initiative, ownership' },
    { key: 'impact', label: 'Impact business', desc: 'Résultats mesurables, valeur produite' },
  ];
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/hr/performance-reviews', {
        employee: 'Marie Diallo',
        period: 'T1 2026',
        scores,
        average: (scores.technical + scores.collab + scores.autonomy + scores.impact) / 4,
      });
      toast.success('Évaluation validée');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de valider.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Évaluation trimestrielle" subtitle="Marie Diallo · Senior Engineer · T1 2026" icon={Trophy} color={C.greenDeep} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Sauver brouillon</button><button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.5)' }} disabled={submitting} onClick={submit}><CheckCircle2 size={14} /> {submitting ? 'Envoi…' : 'Valider l\'évaluation'}</button></>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: C.greenSoft, borderRadius: 14, marginBottom: 18 }}>
        <div className="avatar" style={{ background: C.greenDeep, width: 44, height: 44, fontSize: 16 }}>MD</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Marie Diallo</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>Senior Engineer · Ingénierie · 2 ans 8 mois</div>
        </div>
        <div className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.greenDeep, lineHeight: 1 }}>{((scores.technical + scores.collab + scores.autonomy + scores.impact) / 4).toFixed(1)}</div>
      </div>
      {criteria.map(c => (
        <div key={c.key} style={{ marginBottom: 16, padding: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.06)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{c.label}</div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>{c.desc}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setScores({ ...scores, [c.key]: n })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Star size={20} fill={scores[c.key] >= n ? C.yellow : 'transparent'} color={scores[c.key] >= n ? C.yellow : C.inkSoft} strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Points forts</label>
        <textarea className="form-input" rows={2} placeholder="Très bonne maîtrise technique, leadership naturel…"></textarea>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Axes d'amélioration</label>
        <textarea className="form-input" rows={2} placeholder="Pourrait gagner en visibilité produit…"></textarea>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Objectifs T2 2026</label>
        <textarea className="form-input" rows={3} placeholder="OKR 1 : Livrer la refonte du checkout…"></textarea>
      </div>
    </ModalShell>
  );
}

function SignatureModal({ onClose }) {
  return (
    <ModalShell title="Signature électronique" subtitle="Contrat CDI · Jean Dupont" icon={FileSignature} color={C.purple} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" style={{ background: C.purple, boxShadow: '0 8px 24px -8px rgba(139, 92, 246, 0.5)' }} onClick={onClose}><FileCheck2 size={14} /> Envoyer pour signature</button></>}>
      <div style={{ background: C.purpleSoft, borderRadius: 14, padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <FileSignature size={32} color={C.purple} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>contrat-cdi-jean-dupont.pdf</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>14 pages · 287 Ko · Modèle CDI standard</div>
        </div>
        <button type="button" className="icon-btn" style={{ background: C.purple, color: C.cream }} title="Aperçu du document" onClick={() => toast.info('Aperçu', 'Aperçu PDF bientôt disponible.')}><Eye size={14} /></button>
      </div>
      <label className="form-label">Signataires (dans l'ordre)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { name: 'Jean Dupont', role: 'Employé', email: 'jean@orlode.ai', color: C.blue, status: 'En attente' },
          { name: 'Adelin Nguessan', role: 'CEO', email: 'adelin@orlode.ai', color: C.purple, status: 'Après employé' },
          { name: 'Marie Diallo', role: 'Manager (CC)', email: 'marie@orlode.ai', color: C.greenDeep, status: 'Témoin' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: C.cream, border: '1px solid rgba(10,42,32,0.08)', borderRadius: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: 100, background: s.color, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{i + 1}</div>
            <div className="avatar" style={{ background: s.color, width: 36, height: 36, fontSize: 13 }}>{s.name.split(' ').map(p => p[0]).join('')}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{s.name}</div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>{s.role} · {s.email}</div>
            </div>
            <span className="pill" style={{ background: `${s.color}15`, color: s.color }}>{s.status}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => toast.info('Bientôt', 'L\'ajout de signataires sera disponible dans la prochaine itération.')} style={{ width: '100%', marginTop: 10, background: 'transparent', border: `1.5px dashed ${C.inkSoft}`, color: C.inkSoft, padding: 10, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Plus size={14} /> Ajouter un signataire
      </button>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Message d'accompagnement</label>
        <textarea className="form-input" rows={3} defaultValue="Bonjour Jean, voici votre contrat de travail. Merci de le signer électroniquement avant le 30 avril. — Adelin"></textarea>
      </div>
    </ModalShell>
  );
}

function InterviewModal({ onClose, candidate }: { onClose: () => void; candidate?: any }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [duration, setDuration] = useState('45 min');
  const [interviewType, setInterviewType] = useState('Visio (Google Meet)');
  const [submitting, setSubmitting] = useState(false);
  // Resolve candidate display values from the prop, with safe fallbacks if the
  // modal was opened without one (e.g. from a generic CTA).
  const candName = candidate?.name ?? candidate?.displayName ?? 'Candidat';
  const candRole = candidate?.role ?? candidate?.jobTitle ?? candidate?.position ?? 'Poste à définir';
  const candStage = candidate?.stage ?? 'Étape suivante';
  const candId = candidate?.id ?? candidate?.candidateId ?? null;
  const initials = candName.split(/\s+/).map((s: string) => s.charAt(0)).slice(0, 2).join('').toUpperCase() || 'C';

  const submit = async () => {
    if (submitting) return;
    if (!date) { toast.error('Date requise'); return; }
    setSubmitting(true);
    try {
      await api.post('/hr/interviews', {
        date, time, duration,
        type: interviewType,
        candidateId: candId,
        candidate: candName,
        candidateRole: candRole,
      });
      toast.success('Entretien planifié', `${candName} · ${date} ${time}`);
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de planifier.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Planifier un entretien" subtitle={`Recrutement · ${candRole}`} icon={CalendarPlus} color={C.teal} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" style={{ background: C.teal, boxShadow: '0 8px 24px -8px rgba(20, 184, 166, 0.5)' }} disabled={submitting} onClick={submit}><Send size={14} /> {submitting ? 'Envoi…' : 'Envoyer invitation'}</button></>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: C.tealSoft, borderRadius: 14, marginBottom: 16 }}>
        <div className="avatar" style={{ background: C.teal, width: 44, height: 44, fontSize: 14 }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{candName}</div>
          <div style={{ fontSize: 12, color: C.inkSoft }}>Candidat · {candRole} · Étape : {candStage}</div>
        </div>
      </div>
      <div className="form-row">
        <div><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label className="form-label">Heure</label><input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} /></div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Durée</label>
          <select className="form-input" value={duration} onChange={e => setDuration(e.target.value)}><option>30 min</option><option>45 min</option><option>1h</option><option>1h30</option></select>
        </div>
        <div><label className="form-label">Type</label>
          <select className="form-input" value={interviewType} onChange={e => setInterviewType(e.target.value)}><option>Visio (Google Meet)</option><option>Sur site</option><option>Téléphone</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Intervieweurs</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Adelin N.', 'Marie D.', 'Pierre K.'].map(n => (
            <span key={n} className="chip" style={{ background: C.tealSoft, color: C.teal, fontWeight: 700 }}>{n} <X size={11} /></span>
          ))}
          <button type="button" className="chip chip-outline" onClick={() => toast.info('Bientôt', 'L\'ajout d\'intervieweurs sera disponible.')}><Plus size={11} /> Ajouter</button>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Trame d'entretien (IA)</label>
        <div style={{ background: C.cream, border: '1px solid rgba(10,42,32,0.08)', borderRadius: 12, padding: 12 }}>
          {['Présentation candidat (5 min)', 'Étude de cas design (20 min)', 'Échange culture & valeurs (10 min)', 'Q&A (10 min)'].map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: C.ink, padding: '6px 0', borderBottom: i < 3 ? '1px dashed rgba(10,42,32,0.1)' : 'none' }}>
              <span style={{ color: C.teal, fontWeight: 700, marginRight: 8 }}>{i + 1}.</span>{s}
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

function SanctionModal({ onClose }) {
  const [level, setLevel] = useState('Avertissement');
  const [employee, setEmployee] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!employee.trim() || !reason.trim()) { toast.error('Employé et motif requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/hr/tickets', { type: 'sanction', level, employee, reason, status: 'pending_review' });
      toast.success('Sanction soumise', 'Le DRH a été notifié.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de soumettre.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Sanction disciplinaire" subtitle="Cette action sera tracée et nécessite une validation" icon={ShieldAlert} color={C.red} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" style={{ background: C.red, boxShadow: '0 8px 24px -8px rgba(239, 68, 68, 0.5)' }} disabled={submitting} onClick={submit}><AlertTriangle size={14} /> {submitting ? 'Envoi…' : 'Soumettre à validation'}</button></>}>
      <div style={{ background: C.redSoft, border: `1px solid ${C.red}40`, borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertTriangle size={18} color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.5 }}>
          <strong>Procédure légale :</strong> toute sanction sera revue par le DRH et l'avocat avant notification. L'employé recevra une convocation préalable conformément au code du travail.
        </div>
      </div>
      <label className="form-label">Niveau de sanction</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { name: 'Avertissement', desc: 'Première alerte écrite', color: C.yellow },
          { name: 'Blâme', desc: 'Sanction sans incidence salariale', color: C.orange },
          { name: 'Mise à pied', desc: 'Suspension temporaire', color: C.red },
          { name: 'Licenciement', desc: 'Procédure complète requise', color: '#7F1D1D' },
        ].map(s => (
          <button key={s.name} onClick={() => setLevel(s.name)} style={{ background: level === s.name ? `${s.color}20` : C.cream, border: `1.5px solid ${level === s.name ? s.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 12, padding: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{s.name}</div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{s.desc}</div>
          </button>
        ))}
      </div>
      <div><label className="form-label">Employé concerné</label><input className="form-input" placeholder="Sélectionner…" value={employee} onChange={e => setEmployee(e.target.value)} /></div>
      <div style={{ marginTop: 14 }}><label className="form-label">Motif (faits constatés)</label>
        <textarea className="form-input" rows={3} placeholder="Décrire précisément les faits, dates, témoins…" value={reason} onChange={e => setReason(e.target.value)}></textarea>
      </div>
      <div style={{ marginTop: 14 }}><label className="form-label">Pièces justificatives</label>
        <div style={{ background: C.cream, border: `1.5px dashed rgba(10,42,32,0.2)`, borderRadius: 12, padding: 18, textAlign: 'center', cursor: 'pointer' }}>
          <Upload size={20} color={C.inkSoft} style={{ margin: '0 auto 6px' }} />
          <div style={{ fontSize: 12, color: C.inkSoft }}>Joindre emails, captures, témoignages…</div>
        </div>
      </div>
    </ModalShell>
  );
}

function OffboardingModal({ onClose }) {
  const [employeeId, setEmployeeId] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureType, setDepartureType] = useState('Démission');
  const [noticeDays, setNoticeDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!employeeId.trim() || !departureDate) { toast.error('Employé et date requis'); return; }
    setSubmitting(true);
    try {
      await api.post(`/hr/offboarding/${encodeURIComponent(employeeId)}/start`, {
        departureDate, type: departureType, noticeDays: Number(noticeDays), notes,
      });
      toast.success('Offboarding démarré');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de démarrer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Offboarding employé" subtitle="Checklist de départ sécurisée" icon={DoorOpen} color={C.orange} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" style={{ background: C.orange, boxShadow: '0 8px 24px -8px rgba(249, 115, 22, 0.5)' }} disabled={submitting} onClick={submit}><CheckCircle2 size={14} /> {submitting ? 'Démarrage…' : 'Démarrer offboarding'}</button></>}>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div><label className="form-label">Employé</label><input className="form-input" placeholder="ID ou email employé" value={employeeId} onChange={e => setEmployeeId(e.target.value)} /></div>
        <div><label className="form-label">Date de départ</label><input type="date" className="form-input" value={departureDate} onChange={e => setDepartureDate(e.target.value)} /></div>
      </div>
      <div className="form-row">
        <div><label className="form-label">Type de départ</label>
          <select className="form-input" value={departureType} onChange={e => setDepartureType(e.target.value)}><option>Démission</option><option>Fin de contrat</option><option>Licenciement</option><option>Rupture conventionnelle</option><option>Retraite</option></select>
        </div>
        <div><label className="form-label">Préavis (jours)</label><input className="form-input" type="number" value={noticeDays} onChange={e => setNoticeDays(e.target.value)} /></div>
      </div>
      <h4 style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 20, marginBottom: 10 }}>Checklist automatique</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {[
          { task: 'Révoquer accès SaaS', icon: Lock, color: C.red },
          { task: 'Récupérer matériel', icon: Briefcase, color: C.orange },
          { task: 'Désactiver email pro', icon: Mail, color: C.red },
          { task: 'Solde de tout compte', icon: Banknote, color: C.greenDeep },
          { task: 'Certificat de travail', icon: FileText, color: C.blue },
          { task: 'Attestation Pôle Emploi', icon: FileCheck2, color: C.blue },
          { task: 'Entretien de sortie', icon: MessageSquare, color: C.purple },
          { task: 'Transfert de dossiers', icon: Share2, color: C.teal },
          { task: 'Annonce équipe', icon: Send, color: C.pink },
          { task: 'Archiver données RGPD', icon: Shield, color: C.greenDeep },
        ].map(c => {
          const Ic = c.icon;
          return (
            <label key={c.task} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: C.cream, border: '1px solid rgba(10,42,32,0.08)', borderRadius: 10, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: c.color }} />
              <Ic size={14} color={c.color} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{c.task}</span>
            </label>
          );
        })}
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Notes confidentielles</label>
        <textarea className="form-input" rows={3} placeholder="Contexte du départ, points d'attention…" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
      </div>
    </ModalShell>
  );
}

function PayslipModal({ onClose }) {
  const lines = [
    { label: 'Salaire de base (151,67 h)', amount: 850000 },
    { label: 'Prime d\'ancienneté', amount: 25000 },
    { label: 'Indemnité transport', amount: 30000 },
    { label: 'Heures supplémentaires (8h)', amount: 45000 },
  ];
  const cotisations = [
    { label: 'CNPS Salarié (3,2%)', amount: -27200 },
    { label: 'IGR', amount: -85000 },
    { label: 'IS', amount: -12500 },
  ];
  const brut = lines.reduce((a, b) => a + b.amount, 0);
  const totalCot = cotisations.reduce((a, b) => a + b.amount, 0);
  const net = brut + totalCot;
  return (
    <ModalShell title="Bulletin de paie" subtitle="Marie Diallo · Avril 2026" icon={Banknote} color={C.yellow} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}><Download size={14} /> Télécharger PDF</button><button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.5)' }} onClick={onClose}><Send size={14} /> Envoyer par email</button></>}>
      <div style={{ background: C.greenSoft, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.greenDeep, letterSpacing: '0.08em' }}>NET À PAYER</div>
            <div className="display-font" style={{ fontSize: 36, fontWeight: 800, color: C.ink, lineHeight: 1, marginTop: 4 }}>{net.toLocaleString('fr-FR')}<span style={{ fontSize: 18, color: C.inkSoft, marginLeft: 6 }}>FCFA</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.inkSoft }}>Versement le</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>30 avril 2026</div>
          </div>
        </div>
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: '0 0 8px' }}>Rémunération</h4>
      <div style={{ background: C.cream, border: '1px solid rgba(10,42,32,0.08)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < lines.length - 1 ? '1px solid rgba(10,42,32,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: C.ink }}>{l.label}</span>
            <span className="mono-font" style={{ fontSize: 13, fontWeight: 600, color: C.greenDeep }}>+{l.amount.toLocaleString('fr-FR')}</span>
          </div>
        ))}
        <div style={{ padding: '10px 14px', background: C.greenSoft, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Salaire brut</span>
          <span className="mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{brut.toLocaleString('fr-FR')} FCFA</span>
        </div>
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: C.ink, margin: '0 0 8px' }}>Cotisations & Retenues</h4>
      <div style={{ background: C.cream, border: '1px solid rgba(10,42,32,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {cotisations.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < cotisations.length - 1 ? '1px solid rgba(10,42,32,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: C.ink }}>{l.label}</span>
            <span className="mono-font" style={{ fontSize: 13, fontWeight: 600, color: C.red }}>{l.amount.toLocaleString('fr-FR')}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function NewJobModal({ onClose }: any) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Ingénierie');
  const [contractType, setContractType] = useState('CDI');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!title.trim()) { toast.error('Titre du poste requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/hr/jobs', {
        title: title.trim(),
        department, contractType,
        location: location.trim() || undefined,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        description: description.trim() || undefined,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
      toast.success('Offre publiée', title.trim());
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de créer l\'offre.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouvelle offre d'emploi" subtitle="Publier un poste à pourvoir" icon={UserPlus} color={C.greenDeep} onClose={onClose} size="lg"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" disabled={submitting} style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.6)' }} onClick={submit}>
          {submitting ? 'Publication…' : (<><Plus size={14} /> Publier l'offre</>)}
        </button>
      </>}>
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Titre du poste *</label>
        <input className="form-input" placeholder="Ex: Développeur Senior React" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="form-row" style={{ marginBottom: 14 }}>
        <div>
          <label className="form-label">Département</label>
          <select className="form-input" value={department} onChange={e => setDepartment(e.target.value)}>
            <option>Ingénierie</option>
            <option>Commercial</option>
            <option>Design</option>
            <option>Marketing</option>
            <option>Support</option>
            <option>Opérations</option>
          </select>
        </div>
        <div>
          <label className="form-label">Type de contrat</label>
          <select className="form-input" value={contractType} onChange={e => setContractType(e.target.value)}>
            <option>CDI</option>
            <option>CDD</option>
            <option>Stage</option>
            <option>Alternance</option>
            <option>Freelance</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Lieu</label>
        <input className="form-input" placeholder="Ex: Abidjan, Remote, Cocody" value={location} onChange={e => setLocation(e.target.value)} />
      </div>
      <div className="form-row" style={{ marginBottom: 14 }}>
        <div>
          <label className="form-label">Salaire min (FCFA)</label>
          <input className="form-input" type="number" placeholder="700 000" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Salaire max (FCFA)</label>
          <input className="form-input" type="number" placeholder="1 200 000" value={salaryMax} onChange={e => setSalaryMax(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="form-label">Description du poste</label>
        <textarea className="form-input" rows={4} placeholder="Missions, profil recherché, conditions…" value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical', minHeight: 80 }} />
      </div>
    </ModalShell>
  );
}

// ============ PAGE 1: ACCUEIL ============
function AccueilPage({ onTab, openModal, data }: any) {
  const stats: any[] = [];
  const modules = [
    { name: 'Dashboard RH', desc: 'Vue d\'ensemble · KPIs temps réel', icon: BarChart3, color: C.blue, bg: C.blueSoft, page: 'Dashboard RH' },
    { name: 'Effectifs', desc: '24 employés actifs', icon: Users, color: C.purple, bg: C.purpleSoft, page: 'Effectifs' },
    { name: 'Annuaire', desc: 'Trouver un collègue rapidement', icon: BookOpen, color: C.teal, bg: C.tealSoft, page: 'Annuaire' },
    { name: 'Recrutement', desc: '12 candidats en pipeline', icon: Target, color: C.greenDeep, bg: C.greenSoft, page: 'Recrutement', badge: 12 },
    { name: 'Onboarding', desc: '2 nouveaux arrivants', icon: UserPlus, color: C.pink, bg: C.pinkSoft, page: 'Onboarding', badge: 2 },
    { name: 'Congés', desc: '4 demandes en attente', icon: Plane, color: C.teal, bg: C.tealSoft, page: 'Congés', badge: 4 },
    { name: 'Paie', desc: 'Avril 2026 · À valider', icon: Banknote, color: C.yellow, bg: C.yellowSoft, page: 'Paie', badge: '!' },
    { name: 'Évaluations 360°', desc: 'Cycle T1 ouvert', icon: Trophy, color: C.orange, bg: C.orangeSoft, page: 'Évaluations 360°' },
  ];
  const quickActions = [
    { title: 'Poser un congé', desc: 'Demande rapide en 30 secondes', icon: Plane, color: C.blue, action: 'leave' },
    { title: 'Ajouter un employé', desc: 'Workflow complet en 4 étapes', icon: UserPlus, color: C.purple, action: 'employee' },
    { title: 'Note de frais', desc: 'Upload + OCR auto', icon: Receipt, color: C.yellow, action: 'expense' },
    { title: 'Évaluer un employé', desc: 'Évaluation trimestrielle', icon: Trophy, color: C.greenDeep, action: 'evaluation' },
    { title: 'Faire signer un contrat', desc: 'Signature électronique', icon: FileSignature, color: C.purple, action: 'signature' },
    { title: 'Planifier entretien', desc: 'Calendrier + invités', icon: CalendarPlus, color: C.teal, action: 'interview' },
  ];
  const birthdays: any[] = [];
  const activity: any[] = [];
  return (
    <>
      <PageHeader title="Bonjour Adelin," italic="prenons soin des humains."
        subtitle="24 employés · 4 congés en cours · 2 onboardings · L'équipe va bien."
        badge="RESSOURCES HUMAINES" gradient="blue"
        actions={<>
          <Link to="/chat?context=hr" className="btn-secondary" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream, border: '1px solid rgba(255,250,240,0.25)', textDecoration: 'none' }}><Sparkles size={14} /> Demander à l'IA</Link>
          <button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.6)' }} onClick={() => openModal('leave')}><Plus size={16} /> Nouvelle demande</button>
        </>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>

      <div style={{ padding: '32px 32px 0' }}>
        <SectionTitle title="Modules" italic="accès rapide" />
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {modules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} onClick={() => onTab(mod.page)} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${mod.color}40`; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {mod.badge && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: mod.color, color: C.cream, minWidth: 22, height: 22, padding: '0 7px', borderRadius: 100, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', boxShadow: `0 4px 12px -4px ${mod.color}` }}>{mod.badge}</div>
                )}
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${mod.color} 0%, ${mod.color}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 12px 24px -8px ${mod.color}` }}>
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4, letterSpacing: '-0.01em' }}>{mod.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>{mod.desc}</div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: mod.color, fontWeight: 600 }}>
                  Ouvrir <ArrowRight size={13} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '32px 32px 0' }}>
        <SectionTitle icon={Zap} color={C.blue} title="Actions rapides" italic="modals fonctionnelles" />
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {quickActions.map((qa, idx) => {
            const Icon = qa.icon;
            return (
              <div key={idx} onClick={() => openModal(qa.action)} style={{ background: C.cream, borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.borderColor = qa.color; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `${qa.color}15`, color: qa.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{qa.title}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{qa.desc}</div>
                </div>
                <ChevronRight size={16} color={C.inkSoft} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="responsive-charts" style={{ padding: '32px 32px 32px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="grain" style={{ background: `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.greenMid} 100%)`, borderRadius: 24, padding: '28px 32px', color: C.cream, position: 'relative', overflow: 'hidden', boxShadow: '0 24px 48px -16px rgba(10,79,60,0.4)' }}>
          <svg style={{ position: 'absolute', right: -30, top: -30, opacity: 0.12 }} width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="90" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="110" cy="110" r="60" stroke={C.blueMid} strokeWidth="2" fill="none" />
            <circle cx="110" cy="110" r="30" fill={C.blue} fillOpacity="0.4" />
          </svg>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -4px ${C.blue}` }}>
                <Sparkles size={22} color={C.cream} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.blueMid, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>AGENT RH · ALWAYS ON</div>
                <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
                  Discuter avec <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.blueMid }}>Ressources Humaines</em>
                </h3>
              </div>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,250,240,0.85)', marginBottom: 20, lineHeight: 1.5, maxWidth: 480 }}>
              Pose une question ou demande une action — l'IA RH connaît ton équipe, les politiques, les soldes de congés, et peut générer documents et rapports.
            </p>
            <div style={{ background: 'rgba(255,250,240,0.08)', border: '1px solid rgba(255,250,240,0.12)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <input placeholder="Posez votre question…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.cream, fontFamily: 'inherit' }} />
              <button style={{ background: C.blue, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Send size={13} /> Envoyer</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Quel est mon solde ?', 'Qui est en congé ?', 'Anniversaires du mois', 'Génère un contrat CDI'].map(s => (
                <button key={s} style={{ background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.12)', color: C.cream, padding: '6px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease' }}
                  onMouseOver={e => { e.currentTarget.style.background = C.blue; e.currentTarget.style.borderColor = C.blue; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,250,240,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,250,240,0.12)'; }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: C.cream, borderRadius: 20, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Gift size={18} color={C.pink} />
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>Anniversaires</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {birthdays.map((b, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: idx === 0 ? `${b.color}10` : 'transparent', borderRadius: 10 }}>
                  <div className="avatar" style={{ background: `linear-gradient(135deg, ${b.color} 0%, ${b.color}cc 100%)`, width: 32, height: 32, fontSize: 13 }}>{b.name.charAt(0)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{b.date}</div>
                  </div>
                  <span style={{ fontSize: 16 }}>{b.emoji}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: C.cream, borderRadius: 20, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Activity size={18} color={C.blue} />
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>Activité récente</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activity.map((a, i) => {
                const Ic = a.icon;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${a.color}15`, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ic size={13} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.4 }}><strong>{a.who}</strong> {a.what}</div>
                      <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>{a.when}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============ PAGE 2: DASHBOARD RH ============
function DashboardRHPage({ data }: any) {
  const headcount: any[] = [];
  const departments: any[] = [];
  const kpis: any[] = [];
  const moodByDept: any[] = [];
  return (
    <>
      <PageHeader title="Dashboard" italic="RH"
        subtitle="Effectifs, mood, performance · Vue d'ensemble en temps réel"
        badge="ANALYTICS · 7 MOIS" gradient="blue"
        actions={<><Link to="/chat?context=hr" className="btn-secondary" style={{ textDecoration: 'none' }}><Sparkles size={14} /> Insight IA</Link>
          <button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.6)' }} onClick={() => downloadCSV('rapport-mensuel.csv', (data?.employees || []) as unknown as Record<string, unknown>[])}><FileText size={14} /> Rapport mensuel</button></>} />
      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {kpis.map((k, i) => <StatCard key={i} {...k} />)}
        </div>
      </div>
      <div className="responsive-charts" style={{ padding: '24px 32px 0', display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        <div style={{ background: C.cream, borderRadius: 20, padding: 28, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="live-dot"></span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.blue, letterSpacing: '0.08em' }}>EVOLUTION 7 MOIS</span>
            </div>
            <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>Croissance des effectifs</h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: '4px 0 0' }}>
              <span className="mono-font" style={{ color: C.greenDeep, fontWeight: 700 }}>+6 employés</span> · +33% sur la période
            </p>
          </div>
          <div style={{ position: 'relative', height: 240 }}>
            {headcount.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <LineChart size={32} color={C.inkSoft} strokeWidth={1.5} />
                <div style={{ fontSize: 13, color: C.inkSoft }}>Données d'effectifs en attente</div>
              </div>
            ) : (
              <svg viewBox="0 0 700 240" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                {[0, 1, 2, 3, 4].map(i => (<line key={i} x1="40" x2="680" y1={20 + i * 50} y2={20 + i * 50} stroke={C.greenDeep} strokeOpacity="0.08" strokeDasharray="4 4" />))}
                <defs><linearGradient id="hcGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity="0.4" /><stop offset="100%" stopColor={C.blue} stopOpacity="0" /></linearGradient></defs>
                <path d={`M ${40 + (0 / 6) * 640} ${220 - ((headcount[0].value - 12) / 12) * 200} ${headcount.map((p: any, i: number) => `L ${40 + (i / 6) * 640} ${220 - ((p.value - 12) / 12) * 200}`).join(' ')} L ${40 + 640} 220 L ${40} 220 Z`} fill="url(#hcGradient)" />
                <path d={`M ${40 + (0 / 6) * 640} ${220 - ((headcount[0].value - 12) / 12) * 200} ${headcount.map((p: any, i: number) => `L ${40 + (i / 6) * 640} ${220 - ((p.value - 12) / 12) * 200}`).join(' ')}`} fill="none" stroke={C.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {headcount.map((p: any, i: number) => (<text key={i} x={40 + (i / 6) * 640} y="238" fontSize="11" fill={C.inkSoft} textAnchor="middle" fontWeight="500">{p.month}</text>))}
              </svg>
            )}
          </div>
        </div>

        <div style={{ background: C.cream, borderRadius: 20, padding: 28, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0, marginBottom: 4, letterSpacing: '-0.02em' }}>Par département</h3>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 18px' }}>Répartition des 24 employés</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {departments.map((d, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }}></div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{d.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{d.count}</span>
                    <span style={{ fontSize: 10, color: C.inkSoft }}>{d.percent}%</span>
                  </div>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${d.percent}%`, background: d.color }}></div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="responsive-charts" style={{ padding: '20px 32px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: C.cream, borderRadius: 20, padding: 28, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0, marginBottom: 4 }}>Mood par équipe</h3>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 18px' }}>Pulse hebdomadaire · Note moyenne /5</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {moodByDept.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: C.creamDeep, borderRadius: 12 }}>
                <span style={{ fontSize: 22 }}>{m.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{m.name}</div>
                  <div className="progress-bar" style={{ marginTop: 4 }}><div className="progress-fill" style={{ width: `${(m.mood / 5) * 100}%`, background: m.color }}></div></div>
                </div>
                <span className="display-font" style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.mood}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.cream, borderRadius: 20, padding: 28, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0, marginBottom: 4 }}>Alertes RH</h3>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 18px' }}>Points d'attention détectés par l'IA</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { sev: 'high', title: '3 contrats CDD à renouveler', desc: 'Échéance dans 14 jours', color: C.red, icon: AlertTriangle },
              { sev: 'med', title: 'Mood Support en baisse', desc: 'Note 3.8 (-0.4 vs mois dernier)', color: C.yellow, icon: TrendingDown },
              { sev: 'low', title: 'Visite médicale à programmer', desc: '5 employés concernés', color: C.blue, icon: Stethoscope },
              { sev: 'info', title: 'Cycle d\'évaluation T1 ouvert', desc: '24 évaluations à compléter', color: C.greenDeep, icon: Trophy },
            ].map((a, i) => {
              const Ic = a.icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, background: `${a.color}10`, border: `1px solid ${a.color}30`, borderRadius: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: a.color, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ic size={15} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{a.desc}</div>
                  </div>
                  <ChevronRight size={14} color={C.inkSoft} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ PAGE 3: EFFECTIFS ============
const COLORS_CYCLE = [C.blue, C.pink, C.greenDeep, C.purple, C.teal, C.orange, C.yellow, C.red];
function mapEmployee(e: any, idx = 0) {
  const name = e?.name || `${e?.firstName ?? ''} ${e?.lastName ?? ''}`.trim() || e?.email || 'Employé';
  return {
    id: e?.id || e?._id || idx,
    name,
    role: e?.role || e?.title || e?.position || '—',
    dept: e?.department || e?.dept || '—',
    email: e?.email || '',
    phone: e?.phone || '',
    city: e?.city || e?.location || '',
    tenure: e?.tenure || (e?.hireDate ? `Depuis ${new Date(e.hireDate).toLocaleDateString('fr-FR')}` : ''),
    color: COLORS_CYCLE[idx % COLORS_CYCLE.length],
    status: e?.status || 'active',
    salary: e?.salary || 0,
    manager: e?.manager || e?.managerName || '',
  };
}

function StatusPill({ status }) {
  const config = {
    active: { label: 'Actif', color: C.greenDeep, bg: C.greenSoft },
    onboarding: { label: 'Onboarding', color: C.purple, bg: C.purpleSoft },
    leave: { label: 'En congé', color: C.blue, bg: C.blueSoft },
  }[status];
  return <span className="pill" style={{ background: config.bg, color: config.color, fontWeight: 700 }}>{config.label}</span>;
}

function EffectifsPage({ openModal, employees = [] }: any) {
  const [view, setView] = useState('grid');
  const [dept, setDept] = useState('Tous');
  // Original employees array indexed by mapped row → so the modal gets full data
  const rawById = new Map<string, any>();
  (employees || []).forEach((e: any) => { if (e?.id) rawById.set(e.id, e); });
  const mapped = (employees || []).map(mapEmployee);
  const deptSet = Array.from(new Set(mapped.map((e: any) => e.dept).filter(Boolean)));
  const depts = ['Tous', ...deptSet];
  const filtered = dept === 'Tous' ? mapped : mapped.filter((e: any) => e.dept === dept);
  return (
    <>
      <PageHeader title="Effectifs" italic="& gestion équipe"
        subtitle="Gérer les profils, contrats, salaires et historique"
        badge={`${mapped.length} EMPLOYÉ${mapped.length > 1 ? 'S' : ''}`} gradient="blue"
        actions={<><button className="btn-secondary" onClick={() => downloadCSV('effectifs.csv', mapped)}><Download size={14} /> Exporter</button>
          <button className="btn-primary" style={{ background: C.purple, boxShadow: '0 8px 24px -8px rgba(139, 92, 246, 0.5)' }} onClick={() => openModal('employee')}><UserPlus size={16} /> Ajouter un employé</button></>} />

      <div style={{ padding: '24px 32px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {depts.map(d => (
            <button key={d} onClick={() => setDept(d)} className={`chip ${dept === d ? 'chip-selected' : 'chip-outline'}`}>{d}</button>
          ))}
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', gap: 4, background: C.greenDark, padding: 3, borderRadius: 10, border: '1px solid rgba(255,250,240,0.06)' }}>
          {[{ id: 'grid', label: 'Grille' }, { id: 'list', label: 'Liste' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className={`tab-btn ${view === v.id ? 'active' : ''}`} style={{ padding: '6px 12px', fontSize: 12 }}>{v.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="Aucun employé enregistré" desc="Ajoute ton premier employé via le bouton « Ajouter un employé »." action={<button className="btn-primary" style={{ background: C.purple }} onClick={() => openModal('employee')}><UserPlus size={14} /> Ajouter un employé</button>} />
        ) : view === 'grid' ? (
          <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {filtered.map((e: any, i: number) => (
              <div key={i} onClick={() => openModal('employeeDetail', { ...rawById.get(e.id), ...e })}
                style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                onMouseOver={ev => { ev.currentTarget.style.transform = 'translateY(-4px)'; ev.currentTarget.style.boxShadow = `0 20px 40px -16px ${e.color}50`; ev.currentTarget.style.borderColor = e.color; }}
                onMouseOut={ev => { ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = 'none'; ev.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="avatar" style={{
                    background: e.photoUrl ? '#000' : `linear-gradient(135deg, ${e.color} 0%, ${e.color}cc 100%)`,
                    width: 52, height: 52, fontSize: 18, overflow: 'hidden',
                  }}>
                    {e.photoUrl ? (
                      <img src={e.photoUrl} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      e.name.split(' ').map((p: string) => p[0]).join('')
                    )}
                  </div>
                  <StatusPill status={e.status} />
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{e.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>{e.role}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 11, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}><Building2 size={11} /> {e.dept}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={11} /> {e.city}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={11} /> {e.tenure}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                  <a
                    href={e.email ? `mailto:${e.email}` : undefined}
                    onClick={ev => { ev.stopPropagation(); if (!e.email) { ev.preventDefault(); toast.info('Aucun email', 'Ajoutez un email à cette fiche.'); } }}
                    className="icon-btn"
                    style={{ flex: 1, height: 32, background: `${C.blue}10`, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title={e.email ? `Envoyer un email à ${e.email}` : 'Aucun email'}
                  >
                    <Mail size={13} />
                  </a>
                  <a
                    href={e.phone ? `tel:${e.phone.replace(/\s+/g, '')}` : undefined}
                    onClick={ev => { ev.stopPropagation(); if (!e.phone) { ev.preventDefault(); toast.info('Aucun téléphone', 'Ajoutez un téléphone à cette fiche.'); } }}
                    className="icon-btn"
                    style={{ flex: 1, height: 32, background: `${C.greenDeep}10`, color: C.greenDeep, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    title={e.phone ? `Appeler ${e.phone}` : 'Aucun téléphone'}
                  >
                    <Phone size={13} />
                  </a>
                  <button
                    onClick={ev => { ev.stopPropagation(); openModal('employeeDetail', { ...rawById.get(e.id), ...e }); }}
                    className="icon-btn"
                    style={{ flex: 1, height: 32, background: `${C.purple}10`, color: C.purple }}
                    title="Voir le dossier complet"
                  >
                    <Eye size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 1fr 0.6fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <div>Employé</div><div>Département</div><div>Manager</div><div>Salaire</div><div>Statut</div><div></div>
            </div>
            {filtered.map((e: any, i: number) => (
              <div key={i} onClick={() => openModal('employeeDetail', { ...rawById.get(e.id), ...e })}
                style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 1fr 0.6fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseOver={ev => { ev.currentTarget.style.background = C.creamDeep; }}
                onMouseOut={ev => { ev.currentTarget.style.background = 'transparent'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar" style={{
                    background: e.photoUrl ? '#000' : `linear-gradient(135deg, ${e.color} 0%, ${e.color}cc 100%)`,
                    width: 38, height: 38, fontSize: 14, overflow: 'hidden',
                  }}>
                    {e.photoUrl ? (
                      <img src={e.photoUrl} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      e.name.split(' ').map((p: string) => p[0]).join('')
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{e.role}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.ink }}>{e.dept}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{e.manager}</div>
                <div className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: C.greenDeep }}>{(e.salary || 0).toLocaleString('fr-FR')}</div>
                <div><StatusPill status={e.status} /></div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Voir le dossier" onClick={ev => { ev.stopPropagation(); openModal('employeeDetail', { ...rawById.get(e.id), ...e }); }}><Eye size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 4: ANNUAIRE ============
function AnnuairePage({ employees = [] }: any) {
  const [search, setSearch] = useState('');
  const mapped = (employees || []).map(mapEmployee);
  const filtered = mapped.filter((e: any) => e.name.toLowerCase().includes(search.toLowerCase()) || (e.role || '').toLowerCase().includes(search.toLowerCase()) || (e.dept || '').toLowerCase().includes(search.toLowerCase()));
  const grouped = filtered.reduce((acc: any, e: any) => { (acc[e.dept || '—'] = acc[e.dept || '—'] || []).push(e); return acc; }, {});
  return (
    <>
      <PageHeader title="Annuaire" italic="qui fait quoi ?"
        subtitle="Trouve un collègue par nom, poste, équipe ou compétence"
        badge="DIRECTORY" gradient="blue"
        actions={<><button className="btn-secondary" onClick={() => (document.querySelector('input[placeholder*="herche"]') as HTMLInputElement | null)?.focus()}><Filter size={14} /> Filtres avancés</button>
          <Link to="/chat" className="btn-primary" style={{ textDecoration: 'none' }}><Sparkles size={14} /> Recherche IA</Link></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div style={{ background: C.cream, borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(10,42,32,0.06)' }}>
          <Search size={18} color={C.inkSoft} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cherche par nom, poste, département, ville…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: C.ink, fontFamily: 'inherit' }} />
          <span style={{ fontSize: 12, color: C.inkSoft }}>{filtered.length} résultats</span>
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon={BookOpen} title={search ? 'Aucun résultat' : 'Aucun employé dans l\'annuaire'} desc={search ? 'Essaye un autre nom, poste ou département.' : 'Les employés ajoutés apparaîtront ici automatiquement.'} />
        ) : Object.entries(grouped).map(([dept, list]: [string, any]) => (
          <div key={dept} style={{ marginBottom: 28 }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.cream, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
              {dept} <span style={{ fontSize: 13, color: C.onGreenSoft, fontStyle: 'italic', fontWeight: 500 }}>· {list.length} {list.length > 1 ? 'personnes' : 'personne'}</span>
            </h3>
            <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {list.map((e: any, i: number) => (
                <div key={i} style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseOver={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.borderColor = e.color; }}
                  onMouseOut={ev => { ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                  <div className="avatar" style={{ background: `linear-gradient(135deg, ${e.color} 0%, ${e.color}cc 100%)`, width: 42, height: 42, fontSize: 14 }}>{e.name.split(' ').map((p: string) => p[0]).join('')}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.role}</div>
                  </div>
                  <a
                    href={e.email ? `mailto:${e.email}` : undefined}
                    onClick={ev => { if (!e.email) { ev.preventDefault(); toast.info('Aucun email'); } }}
                    className="icon-btn"
                    style={{ width: 30, height: 30, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                    title={e.email ? `Email à ${e.email}` : ''}
                  >
                    <Mail size={12} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ============ PAGE 5: RECRUTEMENT ============
function RecrutementPage({ openModal, candidates: candidatesProp = [], jobs: jobsProp = [] }: any) {
  const stages: any[] = [];
  const candidates: any[] = candidatesProp || [];
  return (
    <>
      <PageHeader title="Recrutement" italic="pipeline talents"
        subtitle={`${candidates.length} candidat${candidates.length > 1 ? 's' : ''} · ${(jobsProp || []).length} offre${(jobsProp || []).length > 1 ? 's' : ''} ouverte${(jobsProp || []).length > 1 ? 's' : ''} · IA matching activée`}
        badge="HIRING" gradient="blue"
        actions={<><Link to="/chat?context=recruitment" className="btn-secondary" style={{ textDecoration: 'none' }}><Sparkles size={14} /> Analyse IA</Link>
          <button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.5)' }} onClick={() => openModal('job')}><Plus size={16} /> Nouvelle offre</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {stages.map((s, i) => (
            <div key={i} style={{ background: C.cream, borderRadius: 14, padding: 16, border: `1px solid rgba(10,42,32,0.06)`, borderLeft: `4px solid ${s.color}` }}>
              <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.name}</div>
              <div className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink, lineHeight: 1, marginTop: 4 }}>{s.count}</div>
              <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 4 }}>{i < stages.length - 1 ? 'En cours' : 'Cette semaine'}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 0.8fr 1fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <div>Candidat</div><div>Stage</div><div>Source</div><div>Expérience</div><div>Score IA</div><div>Actions</div>
          </div>
          {candidates.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1fr 1fr 0.8fr 1fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ background: c.color, width: 38, height: 38, fontSize: 13 }}>{c.name.split(' ').map(p => p[0]).join('')}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{c.role}</div>
                </div>
              </div>
              <div><span className="pill" style={{ background: `${c.color}20`, color: c.color, fontWeight: 700 }}>{c.stage}</span></div>
              <div style={{ fontSize: 12, color: C.ink }}>{c.source}</div>
              <div style={{ fontSize: 12, color: C.ink }}>{c.exp}</div>
              <div className="mono-font" style={{ fontSize: 13, fontWeight: 800, color: c.score >= 85 ? C.greenDeep : c.score >= 75 ? C.yellow : C.inkSoft }}>{c.score}/100</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="Planifier un entretien" onClick={() => openModal('interview', c)}><CalendarPlus size={12} /></button>
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="Envoyer un message"
                  onClick={() => {
                    if (c.email) window.open(`mailto:${c.email}?subject=${encodeURIComponent(`Concernant ta candidature - ${c.role ?? ''}`)}`, '_blank');
                    else toast.info('Pas d\'email', 'Ce candidat n\'a pas d\'email enregistré.');
                  }}><MessageSquare size={12} /></button>
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="Voir le détail"
                  onClick={() => toast.info('Profil candidat', `${c.name} · ${c.role}\nScore : ${c.score}/100\nSource : ${c.source}\nExpérience : ${c.exp}`)}><MoreHorizontal size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 6: ONBOARDING ============
function OnboardingPage({ openModal }: any) {
  const newcomers: any[] = [];
  const checklist: any[] = [];
  return (
    <>
      <PageHeader title="Onboarding" italic="bienvenue à bord"
        subtitle="2 nouveaux arrivants · Checklist automatisée par l'IA"
        badge="2 EN COURS" gradient="blue"
        actions={<><Link to="/agents/training" className="btn-secondary" style={{ textDecoration: 'none' }}><FileText size={14} /> Modèles</Link>
          <button className="btn-primary" style={{ background: C.pink, boxShadow: '0 8px 24px -8px rgba(236, 72, 153, 0.5)' }} onClick={() => openModal('employee')}><Plus size={16} /> Démarrer onboarding</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {newcomers.map((n, i) => (
            <div key={i} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div className="avatar" style={{ background: `linear-gradient(135deg, ${n.color} 0%, ${n.color}cc 100%)`, width: 56, height: 56, fontSize: 20 }}>{n.name.split(' ').map(p => p[0]).join('')}</div>
                <div style={{ flex: 1 }}>
                  <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{n.name}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{n.role} · démarrage {n.startDate}</div>
                </div>
                <div className="display-font" style={{ fontSize: 28, fontWeight: 800, color: n.color }}>{n.progress}%</div>
              </div>
              <div className="progress-bar" style={{ height: 8, marginBottom: 8 }}>
                <div className="progress-fill" style={{ width: `${n.progress}%`, background: `linear-gradient(90deg, ${n.color} 0%, ${n.color}cc 100%)` }}></div>
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, display: 'flex', justifyContent: 'space-between' }}>
                <span><strong style={{ color: C.ink }}>{n.tasksDone}</strong> / {n.tasksTotal} tâches</span>
                <span>Estimation : {n.progress > 50 ? 'À jour' : '+8 jours'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={ListChecks} color={C.pink} title="Yao Brou" italic="checklist en cours" />
        <div style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 36, top: 20, bottom: 20, width: 2, background: 'rgba(10,42,32,0.1)' }}></div>
            {checklist.map((c, i) => {
              const Ic = c.icon;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', position: 'relative' }}>
                  <div style={{ width: 60, fontSize: 11, fontWeight: 700, color: C.inkSoft, fontFamily: 'JetBrains Mono', textAlign: 'center' }}>{c.day}</div>
                  <div style={{ width: 32, height: 32, borderRadius: 100, background: c.done ? c.color : C.cream, border: `2px solid ${c.color}`, color: c.done ? C.cream : c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                    {c.done ? <CheckCircle2 size={16} /> : <Ic size={14} />}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: c.done ? C.inkSoft : C.ink, textDecoration: c.done ? 'line-through' : 'none' }}>{c.task}</div>
                  {!c.done && <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title={c.task} onClick={() => toast.info(c.task, 'Détail de cette tâche bientôt disponible.')}><ChevronRight size={12} /></button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ PAGE 7: CONGÉS ============
// Approve/reject helpers — wired to PATCH /api/hr/leave/:id (the real endpoint).
// Without onClick handlers the green/red buttons in CongesList silently did nothing.
async function decideLeave(id: string, status: 'approved' | 'rejected') {
  try {
    await api.patch(`/hr/leave/${id}`, { status });
    toast.success(status === 'approved' ? 'Congé approuvé' : 'Congé refusé');
    // Force a refresh by reloading the page-level data — simplest, no shared store
    setTimeout(() => window.location.reload(), 300);
  } catch (e: any) {
    toast.error('Erreur', e?.response?.data?.message || 'Décision non enregistrée.');
  }
}

function CongesPage({ openModal, leavesPending = [], leavesAll = [], leaveRemaining = null }: any) {
  const requests: any[] = (leavesPending || []).concat(leavesAll || []);
  const balance: any[] = [];
  return (
    <>
      <PageHeader title="Congés" italic="& absences"
        subtitle="4 demandes en attente · 2 employés actuellement absents"
        badge="OPS" gradient="blue"
        actions={<><Link to="/hr/calendar" className="btn-secondary" style={{ textDecoration: 'none' }}><Calendar size={14} /> Calendrier</Link>
          <button className="btn-primary" onClick={() => openModal('leave')}><Plus size={16} /> Nouvelle demande</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {balance.map((b, i) => (
            <div key={i} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{b.type}</div>
                <div className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink }}>{b.total - b.taken}<span style={{ fontSize: 14, color: C.inkSoft }}>/{b.total}</span></div>
              </div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${(b.taken / b.total) * 100}%`, background: b.color }}></div>
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6 }}><strong style={{ color: b.color }}>{b.taken} jours pris</strong> · {b.total - b.taken} restants</div>
            </div>
          ))}
        </div>
      </div>

      <CongesList requests={requests} />
    </>
  );
}

function CongesList({ requests }: any) {
  const [view, setView] = useState('list');
  const statusConf = (s: string) => ({
    pending: { label: 'En attente', color: C.yellow, bg: C.yellowSoft },
    approved: { label: 'Approuvé', color: C.greenDeep, bg: C.greenSoft },
    rejected: { label: 'Refusé', color: C.red, bg: C.redSoft },
  }[s] || { label: 'En attente', color: C.yellow, bg: C.yellowSoft });
  return (
    <>
      <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle icon={ListChecks} title="Demandes" italic="à valider" />
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {requests.length === 0 ? (
          <EmptyState icon={Plane} title="Aucune demande de congé" desc="Les demandes apparaîtront ici en temps réel." />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {requests.map((r: any, i: number) => {
              const sc = statusConf(r.status);
              return (
                <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: `${C.blue}15`, color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plane size={18} />
                    </div>
                    <span className="pill" style={{ background: sc.bg, color: sc.color, fontWeight: 700 }}>{sc.label}</span>
                  </div>
                  <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{r.who || r.userName || r.employeeName || 'Employé'}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>{r.type || '—'} · {r.from || (r.startDate ? new Date(r.startDate).toLocaleDateString('fr-FR') : '')} → {r.to || (r.endDate ? new Date(r.endDate).toLocaleDateString('fr-FR') : '')}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                    <div>
                      <div className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{r.days || '—'}</div>
                      <div style={{ fontSize: 10, color: C.inkSoft }}>{r.days && r.days > 1 ? 'jours' : 'jour'}</div>
                    </div>
                    {r.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="icon-btn" style={{ background: C.greenSoft, color: C.greenDeep, width: 32, height: 32 }}
                          title="Approuver" onClick={() => decideLeave(r.id, 'approved')}>
                          <CheckCircle2 size={14} />
                        </button>
                        <button className="icon-btn danger" style={{ width: 32, height: 32 }}
                          title="Refuser" onClick={() => decideLeave(r.id, 'rejected')}>
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map((r: any, i: number) => {
              const sc = statusConf(r.status);
              return (
                <div key={i} className="row-card">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.blue}15`, color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plane size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{r.who || r.userName || r.employeeName || 'Employé'}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>{r.type || '—'} · {r.from || (r.startDate ? new Date(r.startDate).toLocaleDateString('fr-FR') : '')} → {r.to || (r.endDate ? new Date(r.endDate).toLocaleDateString('fr-FR') : '')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{r.days || '—'}</div>
                      <div style={{ fontSize: 10, color: C.inkSoft }}>{r.days && r.days > 1 ? 'jours' : 'jour'}</div>
                    </div>
                    <span className="pill" style={{ background: sc.bg, color: sc.color, fontWeight: 700 }}>{sc.label}</span>
                    {r.status === 'pending' && <>
                      <button className="icon-btn" style={{ background: C.greenSoft, color: C.greenDeep }}
                        title="Approuver" onClick={() => decideLeave(r.id, 'approved')}>
                        <CheckCircle2 size={14} />
                      </button>
                      <button className="icon-btn danger" style={{ background: C.redSoft, color: C.red }}
                        title="Refuser" onClick={() => decideLeave(r.id, 'rejected')}>
                        <X size={14} />
                      </button>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 8: PAIE ============
function PaiePage({ openModal }) {
  const months: any[] = [];
  const massSal: any[] = [];
  const payslips: any[] = [];
  return (
    <>
      <PageHeader title="Paie" italic="Avril 2026"
        subtitle="Module paie en préparation · branche-toi à la compta avec @orlode"
        badge="BÊTA" gradient="blue"
        actions={<><button className="btn-secondary" onClick={() => downloadCSV('paie-export.csv', payslips as unknown as Record<string, unknown>[])}><FileText size={14} /> Export comptable</button>
          <button className="btn-primary" style={{ background: C.yellow, boxShadow: '0 8px 24px -8px rgba(245, 158, 11, 0.5)' }} onClick={async () => {
            try {
              await api.post('/hr/payslips/generate-batch', { month: new Date().toISOString().slice(0, 7) });
              toast.success('Bulletins en cours', 'Génération lancée pour le mois en cours.');
            } catch (e: any) {
              toast.error('Erreur', e?.response?.data?.message || '');
            }
          }}><Wand2 size={16} /> Générer la paie</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div style={{ background: C.cream, borderRadius: 20, padding: 26, border: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ marginBottom: 18 }}>
              <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0 }}>Évolution masse salariale</h3>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '4px 0 0' }}>Sur 6 mois · en millions FCFA</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180 }}>
              {massSal.length === 0 ? (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                  <BarChart3 size={32} color={C.inkSoft} strokeWidth={1.5} />
                  <div style={{ fontSize: 13, color: C.inkSoft }}>Données de paie en attente</div>
                </div>
              ) : massSal.map((v: number, i: number) => {
                const max = Math.max(...(massSal as number[]));
                const h = max > 0 ? (v / max) * 160 : 0;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{(v / 1000000).toFixed(1)}M</span>
                    <div style={{ width: '100%', height: h, background: i === massSal.length - 1 ? `linear-gradient(180deg, ${C.yellow} 0%, ${C.yellow}cc 100%)` : `linear-gradient(180deg, ${C.blue} 0%, ${C.blueDeep} 100%)`, borderRadius: '8px 8px 0 0', boxShadow: i === massSal.length - 1 ? `0 8px 16px -4px ${C.yellow}` : 'none' }}></div>
                    <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>{months[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background: `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.greenMid} 100%)`, borderRadius: 20, padding: 26, color: C.cream, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blueMid, letterSpacing: '0.08em' }}>NET TOTAL · AVRIL</div>
            <div className="display-font" style={{ fontSize: 36, fontWeight: 800, color: C.cream, lineHeight: 1, marginTop: 6 }}>16.0M<span style={{ fontSize: 16, color: 'rgba(255,250,240,0.7)', marginLeft: 4 }}>FCFA</span></div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,250,240,0.85)' }}>+1.6% vs mars</div>
            <div style={{ marginTop: 18, padding: 12, background: 'rgba(255,250,240,0.08)', borderRadius: 12, border: '1px solid rgba(255,250,240,0.12)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,250,240,0.7)', marginBottom: 4 }}>Cotisations CNPS</div>
              <div className="mono-font" style={{ fontSize: 18, fontWeight: 700 }}>2.4M FCFA</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={Receipt} title="Bulletins de paie" italic="cliquer pour voir" />
        <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.6fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <div>Employé</div><div>Département</div><div>Brut</div><div>Net</div><div>Statut</div><div></div>
          </div>
          {payslips.map((p, i) => (
            <div key={i} onClick={() => openModal('payslip')} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.6fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseOver={e => { e.currentTarget.style.background = C.creamDeep; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ background: p.color, width: 36, height: 36, fontSize: 13 }}>{p.who.split(' ').map(x => x[0]).join('')}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{p.who}</div>
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{p.dept}</div>
              <div className="mono-font" style={{ fontSize: 12, fontWeight: 600, color: C.inkSoft }}>{p.brut.toLocaleString('fr-FR')}</div>
              <div className="mono-font" style={{ fontSize: 13, fontWeight: 800, color: C.greenDeep }}>{p.net.toLocaleString('fr-FR')}</div>
              <div>
                {p.status === 'validated'
                  ? <span className="pill" style={{ background: C.greenSoft, color: C.greenDeep, fontWeight: 700 }}><CheckCircle2 size={11} /> Validé</span>
                  : <span className="pill" style={{ background: C.yellowSoft, color: C.yellow, fontWeight: 700 }}><Clock size={11} /> À valider</span>
                }
              </div>
              <div><button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title="Télécharger le bulletin" onClick={ev => { ev.stopPropagation(); window.open(`/api/hr/payslips/${p.id}/pdf`, '_blank'); }}><Download size={12} /></button></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 9: FRAIS ============
function FraisPage({ openModal }) {
  const expenses: any[] = [];
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((a, b) => a + b.amount, 0);
  const totalPending = expenses.filter(e => e.status === 'pending').reduce((a, b) => a + b.amount, 0);
  return (
    <>
      <PageHeader title="Notes" italic="de frais"
        subtitle="Soumettre, valider, rembourser · OCR automatique sur les justificatifs"
        badge="DÉPENSES" gradient="blue"
        actions={<><button className="btn-secondary" onClick={() => downloadCSV('frais.csv', expenses)}><Download size={14} /> Export</button>
          <button className="btn-primary" style={{ background: C.yellow, boxShadow: '0 8px 24px -8px rgba(245, 158, 11, 0.5)' }} onClick={() => openModal('expense')}><Plus size={16} /> Nouvelle note</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <StatCard label="Approuvées" value={(totalApproved / 1000).toFixed(0)} suffix="K" sub="Avril 2026" icon={CheckCircle2} color={C.greenDeep} bg={C.greenSoft} />
          <StatCard label="En attente" value={(totalPending / 1000).toFixed(0)} suffix="K" sub="2 notes" icon={Clock} color={C.yellow} bg={C.yellowSoft} />
          <StatCard label="Refusées" value="320" suffix="K" sub="Hors politique" icon={X} color={C.red} bg={C.redSoft} />
        </div>
      </div>

      <FraisList expenses={expenses} />
    </>
  );
}

function FraisList({ expenses }: any) {
  const [view, setView] = useState('list');
  return (
    <>
      <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle icon={Receipt} title="Notes" italic="à valider en priorité" />
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {expenses.length === 0 ? (
          <EmptyState icon={Receipt} title="Aucune note de frais" desc="Les notes de frais apparaîtront ici dès leur soumission." />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {expenses.map((e: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `${e.color || C.yellow}15`, color: e.color || C.yellow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={18} />
                  </div>
                  <span className="pill" style={{ background: e.status === 'approved' ? C.greenSoft : e.status === 'rejected' ? C.redSoft : C.yellowSoft, color: e.status === 'approved' ? C.greenDeep : e.status === 'rejected' ? C.red : C.yellow, fontWeight: 700 }}>{e.status || 'En attente'}</span>
                </div>
                <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{e.desc || e.description || e.category || 'Note'}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 10 }}>{e.who || ''} {e.date ? `· ${e.date}` : ''}</div>
                <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>{(e.amount || 0).toLocaleString('fr-FR')}<span style={{ fontSize: 11, color: C.inkSoft, marginLeft: 4 }}>FCFA</span></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {expenses.map((e: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${e.color || C.yellow}15`, color: e.color || C.yellow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{e.desc || e.description || e.category || 'Note'}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{e.who || ''} {e.cat ? `· ${e.cat}` : ''} {e.date ? `· ${e.date}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{(e.amount || 0).toLocaleString('fr-FR')}<span style={{ fontSize: 12, color: C.inkSoft, marginLeft: 4 }}>FCFA</span></div>
                  <span className="pill" style={{ background: e.status === 'approved' ? C.greenSoft : e.status === 'rejected' ? C.redSoft : C.yellowSoft, color: e.status === 'approved' ? C.greenDeep : e.status === 'rejected' ? C.red : C.yellow, fontWeight: 700 }}>{e.status || 'En attente'}</span>
                  <button type="button" className="icon-btn" title="Voir la note" onClick={() => toast.info(e.desc || e.description || 'Note', `${(e.amount || 0).toLocaleString('fr-FR')} FCFA · ${e.status || 'en attente'}`)}><Eye size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 10: DOCUMENTS ============
function DocumentsPage({ openModal }) {
  const cats: any[] = [];
  const recent: any[] = [];
  return (
    <>
      <PageHeader title="Documents" italic="& signatures"
        subtitle="Centraliser, générer, signer électroniquement"
        badge="VAULT" gradient="blue"
        actions={<><button className="btn-secondary" onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.doc,.docx,.xlsx,.csv,.png,.jpg,.jpeg';
          input.onchange = async () => {
            const f = input.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.append('file', f);
            try {
              await api.post('/data/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
              toast.success('Document importé', f.name);
            } catch (e: any) {
              toast.error('Échec import', e?.response?.data?.message ?? 'Réessaie');
            }
          };
          input.click();
        }}><Upload size={14} /> Importer</button>
          <button className="btn-primary" style={{ background: C.purple, boxShadow: '0 8px 24px -8px rgba(139, 92, 246, 0.5)' }} onClick={() => openModal('signature')}><FileSignature size={16} /> Faire signer</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <SectionTitle icon={Layers} title="Catégories" />
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {cats.map((c, i) => {
            const Ic = c.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = c.color; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}15`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Ic size={16} />
                </div>
                <div className="display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{c.count}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 4 }}>{c.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={FileText} title="Documents récents" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="stagger">
          {recent.map((d, i) => {
            const Ic = d.icon;
            const statusConf = {
              'sent': { label: 'Envoyé', color: C.blue, bg: C.blueSoft },
              'signed': { label: 'Signé', color: C.greenDeep, bg: C.greenSoft },
              'pending-sign': { label: 'En attente signature', color: C.yellow, bg: C.yellowSoft },
            }[d.status];
            return (
              <div key={i} className="row-card">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${d.color}15`, color: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ic size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{d.size} · {d.who} · {d.when}</div>
                </div>
                <span className="pill" style={{ background: statusConf.bg, color: statusConf.color, fontWeight: 700 }}>{statusConf.label}</span>
                <button type="button" className="icon-btn" title="Aperçu" onClick={() => { if (d.url) window.open(d.url, '_blank'); else if (d.id) window.open(`/api/data/documents/${d.id}`, '_blank'); else toast.info(d.name, 'Aperçu indisponible'); }}><Eye size={14} /></button>
                <button type="button" className="icon-btn" title="Télécharger" onClick={() => { if (d.url) window.open(d.url, '_blank'); else if (d.id) window.open(`/api/data/documents/${d.id}/download`, '_blank'); else toast.info(d.name, 'Téléchargement indisponible'); }}><Download size={14} /></button>
                <button type="button" className="icon-btn" title="Plus" onClick={() => toast.info(d.name, `${d.size} · ${d.who} · ${d.when}`)}><MoreHorizontal size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 11: PERFORMANCE ============
function PerformancePage({ openModal, reviews: reviewsProp = [] }: any) {
  const tops: any[] = reviewsProp || [];
  const okrs: any[] = [];
  return (
    <>
      <PageHeader title="Performance" italic="& OKRs"
        subtitle="Top performers · OKRs trimestriels · Évaluations en cours"
        badge="T1 2026" gradient="blue"
        actions={<><Link to="/admin/analytics" className="btn-secondary" style={{ textDecoration: 'none' }}><BarChart3 size={14} /> Analytics</Link>
          <button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.5)' }} onClick={() => openModal('evaluation')}><Trophy size={16} /> Nouvelle évaluation</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <SectionTitle icon={Trophy} title="Top performers" italic="ce trimestre" />
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {tops.map((t, i) => (
            <div key={i} style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
              {i === 0 && (
                <div style={{ position: 'absolute', top: 12, right: 12, background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.orange} 100%)`, color: C.cream, padding: '4px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Crown size={11} /> #1
                </div>
              )}
              <div className="avatar" style={{ background: `linear-gradient(135deg, ${t.color} 0%, ${t.color}cc 100%)`, width: 56, height: 56, fontSize: 18, marginBottom: 12 }}>{t.who.split(' ').map(p => p[0]).join('')}</div>
              <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{t.who}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 12 }}>{t.dept}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="display-font" style={{ fontSize: 30, fontWeight: 800, color: t.color }}>{t.score}</span>
                <span style={{ fontSize: 12, color: C.inkSoft }}>/5</span>
                <span style={{ fontSize: 11, color: C.greenDeep, fontWeight: 700, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}><ArrowUpRight size={11} /> {t.growth}</span>
              </div>
              <div style={{ display: 'flex', gap: 1, marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <Star key={n} size={14} fill={t.score >= n ? t.color : 'transparent'} color={t.score >= n ? t.color : C.inkSoft} strokeWidth={1.5} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={Target} title="OKRs équipe" italic="trimestre en cours" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {okrs.map((o, i) => (
            <div key={i} style={{ background: C.cream, borderRadius: 14, padding: 18, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{o.title}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{o.owner} · échéance {o.deadline}</div>
                </div>
                <div className="display-font" style={{ fontSize: 28, fontWeight: 800, color: o.color }}>{o.progress}%</div>
              </div>
              <div className="progress-bar" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${o.progress}%`, background: `linear-gradient(90deg, ${o.color} 0%, ${o.color}cc 100%)` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 12: ÉVALUATIONS 360° ============
function Evaluations360Page({ openModal, reviews: reviewsProp = [] }: any) {
  const cycles: any[] = reviewsProp || [];
  const peers: any[] = [];
  return (
    <>
      <PageHeader title="Évaluations" italic="360°"
        subtitle="Cycle T1 2026 · Feedback peer-to-peer · Self-review · Manager review"
        badge="CYCLE OUVERT" gradient="blue"
        actions={<><button className="btn-secondary" onClick={() => openModal('evaluation')}><FileText size={14} /> Trame d'éval</button>
          <button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.5)' }} onClick={() => openModal('evaluation')}><Plus size={16} /> Nouvelle évaluation</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {cycles.map((c, i) => (
            <div key={i} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cycle</div>
                  <h3 className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '4px 0 0' }}>{c.name}</h3>
                </div>
                <span className="pill" style={{ background: c.status === 'in-progress' ? C.blueSoft : C.greenSoft, color: c.status === 'in-progress' ? C.blue : C.greenDeep, fontWeight: 700 }}>
                  {c.status === 'in-progress' ? 'En cours' : 'Clôturé'}
                </span>
              </div>
              <div className="progress-bar" style={{ height: 10 }}>
                <div className="progress-fill" style={{ width: `${(c.complete / c.total) * 100}%`, background: c.color }}></div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkSoft }}>
                <span><strong style={{ color: C.ink }}>{c.complete}</strong> / {c.total} évaluations</span>
                <span>Échéance : {c.deadline}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={Network} title="Feedback peers" italic="reçus & donnés" />
        <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 1fr 0.8fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <div>Employé</div><div>Score 360°</div><div>Reçus</div><div>Donnés</div><div>Statut</div><div></div>
          </div>
          {peers.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr 1fr 0.8fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ background: p.color, width: 36, height: 36, fontSize: 13 }}>{p.who.split(' ').map(x => x[0]).join('')}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{p.who}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{p.dept}</div>
                </div>
              </div>
              <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color: p.color }}>{p.score}<span style={{ fontSize: 11, color: C.inkSoft }}>/5</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="progress-bar" style={{ flex: 1, height: 6 }}>
                  <div className="progress-fill" style={{ width: `${(p.received / p.total) * 100}%`, background: C.blue }}></div>
                </div>
                <span className="mono-font" style={{ fontSize: 11, color: C.inkSoft }}>{p.received}/{p.total}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="progress-bar" style={{ flex: 1, height: 6 }}>
                  <div className="progress-fill" style={{ width: `${(p.given / p.total) * 100}%`, background: C.greenDeep }}></div>
                </div>
                <span className="mono-font" style={{ fontSize: 11, color: C.inkSoft }}>{p.given}/{p.total}</span>
              </div>
              <div>
                {p.received === p.total && p.given === p.total
                  ? <span className="pill" style={{ background: C.greenSoft, color: C.greenDeep, fontWeight: 700 }}>Complet</span>
                  : <span className="pill" style={{ background: C.yellowSoft, color: C.yellow, fontWeight: 700 }}>Partiel</span>}
              </div>
              <div><button type="button" className="icon-btn" style={{ width: 30, height: 30 }} title={`Détail de ${p.who}`} onClick={() => toast.info(p.who, `Score 360° · ${p.score}/5 · Reçus ${p.received}/${p.total} · Donnés ${p.given}/${p.total}`)}><ChevronRight size={12} /></button></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 13: TALENTS ============
function TalentsPage({ employees: empProp = [] }: any) {
  const matrix: any[] = [];
  const succession = [
    { role: 'CTO (Adelin)', candidates: ['Marie D. (3 ans)', 'Yao B. (5 ans)'], color: C.blue },
    { role: 'Head of Sales (Sophie)', candidates: ['Pierre K. (2 ans)'], color: C.orange },
    { role: 'Head of Design (Ibrahim)', candidates: ['Ahmed B. (1 an)'], color: C.pink },
  ];
  return (
    <>
      <PageHeader title="Talents" italic="& succession"
        subtitle="9-box · Plan de succession · Mobilité interne"
        badge="STRATÉGIQUE" gradient="blue"
        actions={<><Link to="/chat?context=talent" className="btn-secondary" style={{ textDecoration: 'none' }}><Sparkles size={14} /> Insight IA</Link>
          <button className="btn-primary" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Lien copié', 'Partage avec le comité par WhatsApp/email.'); }}><Share2 size={14} /> Partager au comité</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
          <div style={{ background: C.cream, borderRadius: 20, padding: 26, border: '1px solid rgba(10,42,32,0.06)' }}>
            <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>9-Box matrix</h3>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 18px' }}>Performance × Potentiel</p>
            <div style={{ position: 'relative', height: 360, background: C.creamDeep, borderRadius: 14, padding: 20 }}>
              <div style={{ position: 'absolute', inset: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' }}>
                {[...Array(9)].map((_, i) => (<div key={i} style={{ border: '1px dashed rgba(10,42,32,0.1)' }}></div>))}
              </div>
              <div style={{ position: 'absolute', inset: 20 }}>
                {matrix.map((m, i) => (
                  <div key={i} title={`${m.who} · ${m.label}`} style={{ position: 'absolute', left: `${m.x}%`, top: `${100 - m.y}%`, transform: 'translate(-50%, -50%)', cursor: 'pointer' }}>
                    <div className="avatar" style={{ background: `linear-gradient(135deg, ${m.color} 0%, ${m.color}cc 100%)`, width: 36, height: 36, fontSize: 11, boxShadow: `0 4px 12px -2px ${m.color}` }}>{m.who.split(' ').map(p => p[0]).join('')}</div>
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', left: 6, top: 20, fontSize: 9, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>POTENTIEL →</div>
              <div style={{ position: 'absolute', left: 20, bottom: 6, fontSize: 9, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>PERFORMANCE →</div>
            </div>
          </div>
          <div style={{ background: C.cream, borderRadius: 20, padding: 26, border: '1px solid rgba(10,42,32,0.06)' }}>
            <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>Plans de succession</h3>
            <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 18px' }}>Postes critiques</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {succession.map((s, i) => (
                <div key={i} style={{ padding: 14, background: `${s.color}08`, border: `1px solid ${s.color}30`, borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{s.role}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.candidates.map((c, j) => (
                      <span key={j} className="pill" style={{ background: `${s.color}20`, color: s.color, fontWeight: 700 }}>{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={Award} title="Mobilité interne" italic="opportunités ouvertes" />
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { role: 'Lead Engineer', dept: 'Ingénierie', from: 'Senior Engineer', applicants: 2, color: C.blue },
            { role: 'Sales Manager', dept: 'Commercial', from: 'Account Executive', applicants: 1, color: C.orange },
            { role: 'Brand Designer', dept: 'Design', from: 'Product Designer', applicants: 0, color: C.pink },
          ].map((m, i) => (
            <div key={i} style={{ background: C.cream, borderRadius: 14, padding: 18, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${m.color}15`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Award size={15} />
              </div>
              <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{m.role}</div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>{m.dept} · depuis {m.from}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.inkSoft }}>{m.applicants} candidatures internes</span>
                <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} title={`Détail de ${m.role}`} onClick={() => toast.info(m.role, `${m.dept} · depuis ${m.from} · ${m.applicants} candidature${m.applicants > 1 ? 's' : ''} interne${m.applicants > 1 ? 's' : ''}`)}><ChevronRight size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 14: FORMATION ============
function FormationPage() {
  const courses: any[] = [];
  return (
    <>
      <PageHeader title="Formation" italic="& certifications"
        subtitle="Catalogue · Parcours individuels · Budget formation"
        badge="LMS" gradient="blue"
        actions={<><Link to="/training" className="btn-secondary" style={{ textDecoration: 'none' }}><BookOpen size={14} /> Catalogue complet</Link>
          <Link to="/training/manage" className="btn-primary" style={{ textDecoration: 'none' }}><Plus size={16} /> Créer un parcours</Link></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <StatCard label="Heures formées" value="312" sub="Avril 2026" icon={Clock} color={C.blue} bg={C.blueSoft} trendUp />
          <StatCard label="Certifications" value="47" sub="+8 ce mois" icon={Award} color={C.greenDeep} bg={C.greenSoft} trendUp />
          <StatCard label="Budget utilisé" value="2.8M" suffix=" FCFA" sub="55% du budget annuel" icon={Banknote} color={C.yellow} bg={C.yellowSoft} />
          <StatCard label="Taux de complétion" value="84%" sub="+6% vs trim. dernier" icon={CheckCircle2} color={C.purple} bg={C.purpleSoft} trendUp />
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={GraduationCap} title="Cours actifs" italic="ce trimestre" />
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {courses.map((c, i) => {
            const Ic = c.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = c.color; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `${c.color}15`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ic size={18} />
                  </div>
                  <span className="pill" style={{ background: `${c.color}15`, color: c.color, fontWeight: 700 }}>{c.cat}</span>
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 12 }}>{c.duration} · {c.enrolled} inscrits</div>
                <div className="progress-bar" style={{ height: 6 }}>
                  <div className="progress-fill" style={{ width: `${(c.completed / c.enrolled) * 100}%`, background: c.color }}></div>
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 6, fontWeight: 600 }}>
                  <strong style={{ color: c.color }}>{c.completed}</strong>/{c.enrolled} terminés
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 15: PRÉSENCE ============
function PresencePage({ employees: empProp = [] }: any) {
  const today: any[] = [];
  const stats: any[] = [];
  return (
    <>
      <PageHeader title="Présence" italic="aujourd'hui"
        subtitle="Pointage temps réel · Télétravail · Heures travaillées"
        badge="LIVE" gradient="blue"
        actions={<><button type="button" className="btn-secondary" onClick={() => downloadCSV('pointage.csv', today)}><Download size={14} /> Export pointage</button>
          <button type="button" className="btn-primary" onClick={async () => {
            try {
              await api.post('/hr/clockin', { at: new Date().toISOString() });
              toast.success('Pointé', new Date().toLocaleTimeString('fr-FR'));
            } catch (e: any) {
              toast.error('Erreur', e?.response?.data?.message ?? 'Impossible de pointer.');
            }
          }}><Fingerprint size={16} /> Pointer</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={Clock} title="Présences" italic="aujourd'hui" />
        <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <div>Employé</div><div>Département</div><div>Statut</div><div>Arrivée</div><div>Départ</div>
          </div>
          {today.map((t, i) => {
            const statusConf = {
              office: { label: 'Bureau', color: C.blue, bg: C.blueSoft, icon: Building2 },
              remote: { label: 'Remote', color: C.greenDeep, bg: C.greenSoft, icon: Globe },
              leave: { label: 'Congé', color: C.yellow, bg: C.yellowSoft, icon: Plane },
            }[t.status];
            const Ic = statusConf.icon;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar" style={{ background: t.color, width: 36, height: 36, fontSize: 13 }}>{t.who.split(' ').map(x => x[0]).join('')}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{t.who}</div>
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{t.dept}</div>
                <div><span className="pill" style={{ background: statusConf.bg, color: statusConf.color, fontWeight: 700 }}><Ic size={11} /> {statusConf.label}</span></div>
                <div className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{t.in}</div>
                <div className="mono-font" style={{ fontSize: 13, color: C.inkSoft }}>{t.out}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 16: ACCÈS ============
function AccesPage() {
  const accesses: any[] = [];
  return (
    <>
      <PageHeader title="Contrôle" italic="d'accès"
        subtitle="Badges · Portes · Vidéosurveillance · Logs sécurité"
        badge="SÉCURITÉ" gradient="blue"
        actions={<><Link to="/admin/employee-codes" className="btn-secondary" style={{ textDecoration: 'none' }}><Camera size={14} /> Vidéo live</Link>
          <Link to="/admin/employee-codes" className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.5)', textDecoration: 'none' }}><KeyRound size={16} /> Nouveau badge</Link></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <StatCard label="Badges actifs" value="24" sub="0 perdus" icon={Fingerprint} color={C.blue} bg={C.blueSoft} />
          <StatCard label="Portes" value="12" sub="Toutes opérationnelles" icon={DoorClosed} color={C.greenDeep} bg={C.greenSoft} />
          <StatCard label="Caméras" value="18" sub="HD · 24/7" icon={Camera} color={C.purple} bg={C.purpleSoft} />
          <StatCard label="Tentatives refusées" value="3" sub="Cette semaine" icon={ShieldAlert} color={C.red} bg={C.redSoft} />
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={RadioTower} title="Logs d'accès" italic="dernières 24h" />
        <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <div>Personne</div><div>Badge</div><div>Porte</div><div>Heure</div><div>Statut</div>
          </div>
          {accesses.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ background: a.color, width: 36, height: 36, fontSize: 13 }}>{a.who.split(' ').map(x => x[0]).join('')}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{a.who}</div>
              </div>
              <div className="mono-font" style={{ fontSize: 12, color: C.inkSoft }}>{a.badge}</div>
              <div style={{ fontSize: 12, color: C.ink }}>{a.door}</div>
              <div className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{a.last}</div>
              <div>
                {a.status === 'in'
                  ? <span className="pill" style={{ background: C.greenSoft, color: C.greenDeep, fontWeight: 700 }}><Unlock size={11} /> Autorisé</span>
                  : <span className="pill" style={{ background: C.redSoft, color: C.red, fontWeight: 700 }}><Lock size={11} /> Refusé</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 17: CALENDRIER RH ============
function CalendrierRHPage({ events: eventsProp = [], openModal }: any) {
  const events: any[] = eventsProp || [];
  const [weekOffset, setWeekOffset] = useState(0);
  return (
    <>
      <PageHeader title="Calendrier" italic="RH"
        subtitle="Congés · Anniversaires · Échéances · Réunions"
        badge="AVRIL 2026" gradient="blue"
        actions={<><Link to="/admin/connectors" className="btn-secondary" style={{ textDecoration: 'none' }}><RefreshCw size={14} /> Sync Google</Link>
          <button className="btn-primary" onClick={() => openModal('leave')}><Plus size={16} /> Nouvel événement</button></>} />

      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>{weekOffset === 0 ? 'Cette semaine' : weekOffset > 0 ? `Semaine +${weekOffset}` : `Semaine ${weekOffset}`}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} title="Semaine précédente" onClick={() => setWeekOffset(w => w - 1)}><ChevronLeft size={14} /></button>
              <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} title="Semaine suivante" onClick={() => setWeekOffset(w => w + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: C.creamDeep, borderRadius: 12, borderLeft: `4px solid ${e.color}` }}>
                <div style={{ textAlign: 'center', minWidth: 50 }}>
                  <div className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{e.date}</div>
                  <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase' }}>{e.day}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{e.time}</div>
                </div>
                <span className="pill" style={{ background: `${e.color}15`, color: e.color, fontWeight: 700 }}>{e.cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ PAGE 18: POLITIQUE & FAQ ============
function PolitiqueFAQPage({ policies: policiesProp = [] }: any) {
  const policies: any[] = policiesProp || [];
  const faqs: any[] = [];
  return (
    <>
      <PageHeader title="Politique" italic="& FAQ"
        subtitle="Handbook complet · Politiques RH · Recherche IA dans les documents"
        badge="HANDBOOK" gradient="blue"
        actions={<><Link to="/chat?context=policies" className="btn-secondary" style={{ textDecoration: 'none' }}><Sparkles size={14} /> Demander à l'IA</Link>
          <button className="btn-primary" onClick={async () => {
            const title = window.prompt('Titre de la politique :');
            if (!title) return;
            const content = window.prompt('Contenu (court) :');
            if (!content) return;
            try {
              await api.post('/hr/policies', { title, content });
              toast.success('Politique ajoutée', title);
              setTimeout(() => window.location.reload(), 500);
            } catch (e: any) {
              toast.error('Erreur', e?.response?.data?.message ?? 'Impossible d\'ajouter.');
            }
          }}><Plus size={16} /> Nouvelle politique</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <SectionTitle icon={BookOpen} title="Politiques" italic="documents officiels" />
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {policies.map((p, i) => {
            const Ic = p.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 14, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = p.color; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${p.color}15`, color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Ic size={17} />
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>Mise à jour : {p.updated}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={FileQuestion} title="FAQ" italic="questions fréquentes" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faqs.map((f, i) => {
            const Ic = f.icon;
            return (
              <details key={i} style={{ background: C.cream, borderRadius: 14, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
                <summary style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', listStyle: 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: C.blueSoft, color: C.blueDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ic size={14} />
                  </div>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.ink }}>{f.q}</span>
                  <ChevronDown size={16} color={C.inkSoft} />
                </summary>
                <div style={{ padding: '0 16px 16px 60px', fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>{f.a}</div>
              </details>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 19: REPORTING BI ============
function ReportingBIPage() {
  const reports: any[] = [];
  const customViews: any[] = [];
  return (
    <>
      <PageHeader title="Reporting" italic="BI & exports"
        subtitle="Rapports clés · Dashboards custom · Export Excel/PDF"
        badge="ANALYTICS" gradient="blue"
        actions={<><Link to="/chat" className="btn-secondary" style={{ textDecoration: 'none' }}><Sparkles size={14} /> Insight IA</Link>
          <button type="button" className="btn-primary" onClick={() => downloadCSV('rapport-rh.csv', reports)}><Plus size={16} /> Nouveau rapport</button></>} />

      <div style={{ padding: '24px 32px 0' }}>
        <SectionTitle icon={LineChart} title="Rapports standards" italic="prêts à exporter" />
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {reports.map((r, i) => {
            const Ic = r.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 20, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 16px 32px -16px ${r.color}50`; e.currentTarget.style.borderColor = r.color; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: `linear-gradient(135deg, ${r.color} 0%, ${r.color}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px -4px ${r.color}` }}>
                    <Ic size={18} />
                  </div>
                  <span className="pill" style={{ background: `${r.color}15`, color: r.color, fontWeight: 700 }}>{r.period}</span>
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 14 }}>{r.desc}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="icon-btn" style={{ flex: 1, height: 30, fontSize: 12, gap: 4 }} title="Télécharger" onClick={() => downloadCSV(`${(r.name || 'rapport').toString().toLowerCase().replace(/\s+/g, '-')}.csv`, [r])}><Download size={12} /></button>
                  <button type="button" className="icon-btn" style={{ flex: 1, height: 30, fontSize: 12, gap: 4 }} title="Voir" onClick={() => toast.info(r.name, r.desc || '')}><Eye size={12} /></button>
                  <button type="button" className="icon-btn" style={{ flex: 1, height: 30, fontSize: 12, gap: 4 }} title="Partager" onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      toast.success('Lien copié');
                    } catch {
                      toast.error('Erreur', 'Impossible de copier le lien.');
                    }
                  }}><Share2 size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <SectionTitle icon={PieChart} title="Vues IA" italic="dashboards intelligents" />
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {customViews.map((c, i) => {
            const Ic = c.icon;
            return (
              <div key={i} style={{ background: `linear-gradient(135deg, ${c.color}15 0%, ${C.cream} 60%)`, border: `1px solid ${c.color}30`, borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: c.color, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Ic size={16} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{c.name}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ MAIN APP ============
export default function HRRedesignPage() {
  const [activeTab, setActiveTab] = useState('Accueil');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  // modalContext lets a button pass an entity (e.g. the candidate clicked) into
  // the opened modal — without it, modals like InterviewModal had to hardcode
  // a fake candidate.
  const [modalContext, setModalContext] = useState<any>(null);
  const openModal = (id: string, context: any = null) => {
    setModalContext(context);
    setActiveModal(id);
  };
  const closeModal = () => {
    setActiveModal(null);
    setModalContext(null);
  };
  const data = useHRData();

  return (
    <Chrome>
      <TabSwitcher active={activeTab} setActive={setActiveTab} />

      {activeTab === 'Accueil' && <AccueilPage onTab={setActiveTab} openModal={openModal} data={data} />}
      {activeTab === 'Dashboard RH' && <DashboardRHPage data={data} />}
      {activeTab === 'Effectifs' && <EffectifsPage openModal={openModal} employees={data.employees} />}
      {activeTab === 'Annuaire' && <AnnuairePage employees={data.employees} />}
      {activeTab === 'Recrutement' && <RecrutementPage openModal={openModal} candidates={data.candidates} jobs={data.jobs} />}
      {activeTab === 'Onboarding' && <OnboardingPage openModal={openModal} />}
      {activeTab === 'Congés' && <CongesPage openModal={openModal} leavesPending={data.leavesPending} leavesAll={data.leavesAll} leaveRemaining={data.leaveRemaining} />}
      {activeTab === 'Paie' && <PaiePage openModal={openModal} />}
      {activeTab === 'Frais' && <FraisPage openModal={openModal} />}
      {activeTab === 'Documents' && <DocumentsPage openModal={openModal} />}
      {activeTab === 'Performance' && <PerformancePage openModal={openModal} reviews={data.performanceReviews} />}
      {activeTab === 'Évaluations 360°' && <Evaluations360Page openModal={openModal} reviews={data.performanceReviews} />}
      {activeTab === 'Talents' && <TalentsPage employees={data.employees} />}
      {activeTab === 'Formation' && <FormationPage />}
      {activeTab === 'Présence' && <PresencePage employees={data.employees} />}
      {activeTab === 'Accès' && <AccesPage />}
      {activeTab === 'Calendrier RH' && <CalendrierRHPage events={data.teamCalendar} openModal={openModal} />}
      {activeTab === 'Politique & FAQ' && <PolitiqueFAQPage policies={data.policies} />}
      {activeTab === 'Reporting BI' && <ReportingBIPage />}

      {/* MODALS */}
      {activeModal === 'leave' && <NewLeaveModal onClose={closeModal} />}
      {activeModal === 'employee' && <NewEmployeeModal onClose={closeModal} />}
      {activeModal === 'employeeDetail' && <EmployeeDetailModal employee={modalContext} onClose={closeModal} />}
      {activeModal === 'expense' && <ExpenseModal onClose={closeModal} />}
      {activeModal === 'evaluation' && <EvaluationModal onClose={closeModal} />}
      {activeModal === 'signature' && <SignatureModal onClose={closeModal} />}
      {activeModal === 'interview' && <InterviewModal onClose={closeModal} candidate={modalContext} />}
      {activeModal === 'sanction' && <SanctionModal onClose={closeModal} />}
      {activeModal === 'offboarding' && <OffboardingModal onClose={closeModal} />}
      {activeModal === 'payslip' && <PayslipModal onClose={closeModal} />}
      {activeModal === 'job' && <NewJobModal onClose={closeModal} />}

      <LiveSyncBadge lastSync={data?.lastSync} intervalMs={REFRESH_INTERVAL_MS} />

      {/* Floating action button — quick modals */}
      <div style={{ position: 'fixed', bottom: 28, right: 100, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        <button onClick={() => openModal('sanction')} title="Sanction disciplinaire" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <ShieldAlert size={20} />
        </button>
        <button onClick={() => openModal('offboarding')} title="Offboarding" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.orange, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <DoorOpen size={20} />
        </button>
        <button onClick={() => openModal('leave')} title="Nouvelle action" style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDeep} 100%)`, border: 'none', color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px -8px ${C.blue}` }}>
          <Plus size={24} />
        </button>
      </div>

      <AgentDrawer
        agentId="hr"
        agentName="RH"
        color={C.blue}
        context={{
          tab: activeTab,
          employees: data.employees?.length ?? 0,
          leavesPending: data.leavesPending?.length ?? 0,
          candidates: data.candidates?.length ?? 0,
          jobs: data.jobs?.length ?? 0,
        }}
        starters={[
          'Quelles demandes de congés sont en attente ?',
          'Recommande-moi un plan d\'onboarding pour le prochain recrutement',
          'Génère un message d\'annonce pour un nouvel employé',
        ]}
      />
    </Chrome>
  );
}
