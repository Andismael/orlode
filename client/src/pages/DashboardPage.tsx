import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useLangStore } from '@/store/langStore';
import {
  Search, Bell, ChevronDown, ChevronRight, ChevronLeft, ArrowRight, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, MessageSquare, MessageCircle, Bot, UsersRound, Briefcase, Calendar,
  Store, Crown, Hammer, Plug, Settings, Shield, LogOut, Plus, Sparkles, Send,
  X, Heart, Star, Flame, Zap, Clock, Eye, Download, Upload,
  CheckCircle2, XCircle, AlertCircle, Info, Filter, Tag, FileText, File,
  Hash, AtSign, Mail, Link as LinkIcon, MoreHorizontal, MoreVertical,
  Smile, Paperclip, Mic, Phone, Video, Volume2, Headphones, Image,
  Pin, BookmarkCheck, Reply, Forward, Edit3, Copy, Share2, Trash2,
  Bell as BellIcon, BellOff, Lock, Unlock, Globe, Settings2,
  TrendingUp, TrendingDown, Activity, BarChart3, PieChart, Layers, Users,
  ThumbsUp, Award, Gift, PartyPopper, Coffee, Sun, Moon, Cloud, CloudRain,
  CheckCheck, Check, Inbox, Archive, Folder, FolderOpen, FilePlus,
  Megaphone, Radio, MapPin, Cake, Briefcase as BriefcaseIcon,
  RefreshCw, Loader2, Save, ExternalLink, GitBranch, Cpu,
  Hand, Lightbulb, Target, Compass, FileSpreadsheet, FileImage,
  Music, FileCode, ScrollText, Calendar as CalendarIcon,
  DollarSign, Wallet, CreditCard, Receipt, BadgeCheck, Trophy,
  Headset, LifeBuoy, BookOpen, Mountain, Rocket, Wind,
  ArrowUp, ArrowDown, Minus, BarChart, LineChart,
} from 'lucide-react';

// ============ PALETTE — DASHBOARD (Forêt + Or + Terracotta) ============
const C = {
  // Backgrounds
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  greenInk:    '#042A1F',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',

  // PRIMARY — Or champagne (KPIs, highlights)
  gold:        '#D4A017',
  goldDeep:    '#B8860B',
  goldDark:    '#8B6914',
  goldSoft:    '#FEF3C7',
  goldLight:   '#FCD34D',

  // ACCENT 1 — Terracotta (alerts douces, chaleur africaine)
  terracotta:  '#E07856',
  terraDeep:   '#C25C3D',
  terraDark:   '#8B3F26',
  terraSoft:   '#FFEDE5',
  terraLight:  '#F4A584',

  // ACCENT 2 — Sauge clair (positifs, croissance)
  sage:        '#86C5A0',
  sageDeep:    '#5BA47C',
  sageDark:    '#2D6A4F',
  sageSoft:    '#D4F1DF',

  // ACCENT 3 — Bleu nuit étoilé (AI, premium)
  midnight:    '#1E1B4B',
  midnightDeep:'#0F0C2D',
  indigo:      '#4338CA',
  indigoSoft:  '#E0E7FF',
  violet:      '#7C3AED',

  // Semantic
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  redDeep:     '#DC2626',
  yellow:      '#F59E0B',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  blueDeep:    '#0284C7',
  cyan:        '#06B6D4',
  cyanSoft:    '#CFFAFE',
  purple:      '#9333EA',
  purpleSoft:  '#F3E8FF',
  pink:        '#EC4899',
  pinkSoft:    '#FCE7F3',

  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; }

  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font { font-family: 'JetBrains Mono', monospace; }

  .nav-item {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border-radius: 10px;
    color: ${C.onGreenSoft}; font-size: 14px; font-weight: 500;
    cursor: pointer; transition: all 0.2s ease; position: relative;
  }
  .nav-item:hover { background: rgba(255,250,240,0.06); color: ${C.cream}; }
  .nav-item.active {
    background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep});
    color: ${C.greenDark};
    box-shadow: 0 8px 24px -8px ${C.gold};
    font-weight: 700;
  }
  .nav-item.active::after {
    content: ''; position: absolute;
    right: 12px; top: 50%; transform: translateY(-50%);
    width: 6px; height: 6px; border-radius: 50%; background: ${C.greenDark};
  }

  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 100px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  }

  .quick-action {
    background: rgba(255,250,240,0.08);
    border: 1px solid rgba(255,250,240,0.12);
    border-radius: 12px; padding: 10px 16px;
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 500; color: ${C.cream};
    cursor: pointer; transition: all 0.2s ease; font-family: inherit;
  }
  .quick-action:hover {
    background: ${C.gold}; color: ${C.greenDark}; border-color: ${C.gold};
    transform: translateY(-1px);
  }

  .btn-primary {
    background: linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 100%);
    color: ${C.greenInk}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.gold};
    font-family: inherit;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.gold};
  }

  .btn-terra {
    background: linear-gradient(135deg, ${C.terracotta} 0%, ${C.terraDeep} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.terracotta};
    font-family: inherit;
  }
  .btn-terra:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.terracotta};
  }

  .btn-sage {
    background: linear-gradient(135deg, ${C.sage} 0%, ${C.sageDeep} 100%);
    color: ${C.greenInk}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.sage};
    font-family: inherit;
  }

  .btn-secondary {
    background: ${C.cream}; color: ${C.greenDark};
    border: 1.5px solid rgba(10,42,32,0.1);
    padding: 11px 18px; border-radius: 12px;
    font-weight: 600; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease; font-family: inherit;
  }
  .btn-secondary:hover {
    background: ${C.greenDark}; color: ${C.cream}; border-color: ${C.greenDark};
  }

  .btn-ghost-light {
    background: rgba(255,250,240,0.08);
    color: ${C.cream};
    border: 1px solid rgba(255,250,240,0.15);
    padding: 9px 14px; border-radius: 10px;
    font-weight: 600; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 7px;
    transition: all 0.2s ease; font-family: inherit;
  }
  .btn-ghost-light:hover {
    background: ${C.cream}; color: ${C.greenDark};
  }

  .icon-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: ${C.goldSoft}; color: ${C.goldDark};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all 0.2s ease;
    flex-shrink: 0;
  }
  .icon-btn:hover { background: ${C.goldDeep}; color: ${C.cream}; }
  .icon-btn.terra { background: ${C.terraSoft}; color: ${C.terraDeep}; }
  .icon-btn.terra:hover { background: ${C.terracotta}; color: ${C.cream}; }
  .icon-btn.sage { background: ${C.sageSoft}; color: ${C.sageDark}; }
  .icon-btn.sage:hover { background: ${C.sageDeep}; color: ${C.cream}; }
  .icon-btn.indigo { background: ${C.indigoSoft}; color: ${C.indigo}; }
  .icon-btn.indigo:hover { background: ${C.indigo}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.redSoft}; color: ${C.redDeep}; }
  .icon-btn.ghost { background: transparent; color: ${C.inkSoft}; }
  .icon-btn.ghost:hover { background: ${C.creamDeep}; color: ${C.greenDark}; }

  .input-field {
    width: 100%; background: ${C.creamDeep};
    border: 1.5px solid rgba(10,42,32,0.08);
    border-radius: 12px; padding: 12px 16px;
    font-size: 14px; color: ${C.ink};
    font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .input-field:focus {
    border-color: ${C.gold};
    background: ${C.cream};
    box-shadow: 0 0 0 4px ${C.gold}25;
  }

  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }

  /* Live dot for header */
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${C.sage}; position: relative; flex-shrink: 0;
  }
  .live-dot::after {
    content: ''; position: absolute; inset: -4px;
    border-radius: 50%; background: ${C.sage};
    opacity: 0.4; animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.6); opacity: 0; }
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .stagger > * { animation: slideIn 0.5s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; }
  .stagger > *:nth-child(2) { animation-delay: 0.10s; }
  .stagger > *:nth-child(3) { animation-delay: 0.15s; }
  .stagger > *:nth-child(4) { animation-delay: 0.20s; }
  .stagger > *:nth-child(5) { animation-delay: 0.25s; }
  .stagger > *:nth-child(6) { animation-delay: 0.30s; }
  .stagger > *:nth-child(7) { animation-delay: 0.35s; }
  .stagger > *:nth-child(8) { animation-delay: 0.40s; }
  .stagger > *:nth-child(9) { animation-delay: 0.45s; }
  .stagger > *:nth-child(10) { animation-delay: 0.50s; }

  /* Card lift */
  .card-lift {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card-lift:hover { transform: translateY(-4px); }

  /* Fade in */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .fade-in { animation: fadeIn 0.4s ease-out; }
  .scale-in { animation: scaleIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); }

  /* Sparkle floating */
  @keyframes sparkleFloat {
    0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
    50% { transform: translateY(-10px) rotate(180deg); opacity: 1; }
  }
  .sparkle-float { animation: sparkleFloat 4s ease-in-out infinite; }

  /* AI pulse */
  @keyframes aiPulse {
    0%, 100% { box-shadow: 0 0 0 0 ${C.gold}80, 0 0 0 0 ${C.gold}40; }
    50%      { box-shadow: 0 0 0 10px ${C.gold}00, 0 0 0 20px ${C.gold}00; }
  }
  .ai-pulse { animation: aiPulse 2.5s ease-in-out infinite; }

  /* Spin slow */
  @keyframes slowRotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .slow-rotate { animation: slowRotate 30s linear infinite; }

  /* Bounce subtle */
  @keyframes bounceSoft {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  .bounce-soft { animation: bounceSoft 2s ease-in-out infinite; }

  /* Shimmer for golden text */
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .shimmer-text {
    background: linear-gradient(90deg, ${C.gold}, ${C.goldLight}, ${C.gold}, ${C.goldLight}, ${C.gold});
    background-size: 200% auto;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }

  /* Wiggle */
  @keyframes wiggle {
    0%, 7%, 100% { transform: rotate(0deg); }
    3.5% { transform: rotate(-12deg); }
    5.25% { transform: rotate(10deg); }
  }
  .wiggle { animation: wiggle 3s ease-in-out infinite; display: inline-block; transform-origin: center bottom; }

  /* Progress fill */
  @keyframes fillUp {
    from { width: 0; }
    to { width: var(--target-width); }
  }
  .progress-fill { animation: fillUp 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }

  /* Float for FAB */
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  .float { animation: float 3s ease-in-out infinite; }

  /* Glow gold */
  @keyframes glowGold {
    0%, 100% { box-shadow: 0 0 20px ${C.gold}40, 0 0 40px ${C.gold}20; }
    50%      { box-shadow: 0 0 30px ${C.gold}60, 0 0 60px ${C.gold}30; }
  }
  .glow-gold { animation: glowGold 3s ease-in-out infinite; }

  .scroll-hide::-webkit-scrollbar { display: none; }
  .scroll-hide { scrollbar-width: none; }

  .scroll-thin::-webkit-scrollbar { width: 6px; }
  .scroll-thin::-webkit-scrollbar-thumb { background: rgba(10,42,32,0.15); border-radius: 100px; }
  .scroll-thin::-webkit-scrollbar-track { background: transparent; }

  .mobile-menu-btn { display: none; }

  /* === RESPONSIVE LAYERS === */

  /* Laptop */
  @media (max-width: 1280px) {
    .hide-on-tablet { display: none !important; }
    .responsive-charts { grid-template-columns: 1fr 1fr !important; }
    .responsive-charts > :nth-child(3) { grid-column: 1 / -1 !important; }
  }

  /* Tablet landscape */
  @media (max-width: 1024px) {
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-grid-2 { grid-template-columns: 1fr !important; }
    .responsive-charts { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
    .dashboard-content { padding: 18px !important; gap: 14px !important; }
    .hero-pad { padding: 28px 28px !important; }
    .hero-title { font-size: 38px !important; }
    .hero-orbit { display: none !important; }
  }

  /* Tablet portrait / large phone */
  @media (max-width: 768px) {
    .sidebar-aside {
      position: fixed !important; left: 0; top: 0;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      z-index: 100;
    }
    .sidebar-aside.open { transform: translateX(0); }
    .sidebar-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
    .mobile-menu-btn { display: flex !important; }
    .desktop-only { display: none !important; }
    .responsive-grid-4 { grid-template-columns: 1fr 1fr !important; }
    .responsive-grid-3 { grid-template-columns: 1fr !important; }
    .responsive-charts { grid-template-columns: 1fr !important; gap: 12px !important; }
    .responsive-charts > :nth-child(3) { grid-column: auto !important; }
    .dashboard-content { padding: 14px !important; gap: 12px !important; padding-bottom: 96px !important; }
    .hero-pad { padding: 22px 20px !important; border-radius: 18px !important; }
    .hero-title { font-size: 30px !important; line-height: 1.15 !important; }
    .hero-sub { font-size: 14px !important; }
    .hero-actions button { font-size: 12px !important; padding: 8px 12px !important; }
    .hide-on-mobile { display: none !important; }
    .hero-status { display: none !important; }
  }

  /* Small phone */
  @media (max-width: 480px) {
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .dashboard-content { padding: 10px !important; gap: 10px !important; padding-bottom: 96px !important; }
    .hero-pad { padding: 18px 16px !important; }
    .hero-title { font-size: 26px !important; }
    .hero-sub { font-size: 13px !important; }
    .hero-pills { flex-wrap: wrap !important; gap: 6px !important; }
    .hero-pills .pill { font-size: 10px !important; }
    .ai-fab { bottom: 16px !important; right: 16px !important; }
    .ai-fab button { width: 56px !important; height: 56px !important; }
    .ai-fab .fab-bubble { display: none !important; }
  }
`;

function formatNum(n) {
  if (typeof n === 'string') return n;
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function getColorVar(name) {
  const map = {
    gold:    { main: C.gold,       deep: C.goldDeep,    soft: C.goldSoft,   ink: C.goldDark },
    terra:   { main: C.terracotta, deep: C.terraDeep,   soft: C.terraSoft,  ink: C.terraDark },
    sage:    { main: C.sage,       deep: C.sageDeep,    soft: C.sageSoft,   ink: C.sageDark },
    indigo:  { main: C.indigo,     deep: C.midnight,    soft: C.indigoSoft, ink: C.midnight },
    cyan:    { main: C.cyan,       deep: C.blueDeep,    soft: C.cyanSoft,   ink: C.blueDeep },
    blue:    { main: C.blue,       deep: C.blueDeep,    soft: C.blueSoft,   ink: C.blueDeep },
    purple:  { main: C.violet,     deep: C.violet,      soft: C.purpleSoft, ink: C.violet },
    red:     { main: C.red,        deep: C.redDeep,     soft: C.redSoft,    ink: C.redDeep },
  };
  return map[name] || map.gold;
}

// ============ SPARKLINE COMPONENT ============
function Sparkline({ data, color = C.gold, height = 40, width = 120 }) {
  const safe = Array.isArray(data) && data.length > 0 ? data : [0];
  const series = safe.length === 1 ? [safe[0], safe[0]] : safe;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const denom = series.length - 1 || 1;
  const points = series.map((v, i) => {
    const x = (i / denom) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Area path
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {series.map((v, i) => {
        if (i !== series.length - 1) return null;
        const x = (i / denom) * width;
        const y = height - ((v - min) / range) * height;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="6" fill={color} opacity="0.3" />
            <circle cx={x} cy={y} r="3" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

// ============ CHROME ============
// Chrome lite — sidebar/header globaux gérés par le layout corpmind-ai
function Chrome({ children }: any) {
  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>
        {children}
      </main>
    </div>
  );
}

// ============ HERO SECTION ============
function HeroSection() {
  const [time, setTime] = useState(new Date());
  const data = useDashboardData();
  const { user, company } = useAuthStore();
  const navigate = useNavigate();
  const { t, lang } = useLangStore();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const greeting = hours < 12 ? t('good_morning') : hours < 18 ? t('good_afternoon') : t('good_evening');
  const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ar: 'ar-SA', de: 'de-DE', pt: 'pt-BR' };
  const dateFormatted = time.toLocaleDateString(localeMap[lang] ?? 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const firstName = (user?.displayName ?? '').split(' ')[0] || t('dash_default_name');
  const insightsCount = data.insights?.length ?? 0;
  const urgentCount = data.tasks?.filter((t: any) => t.priority === 'urgent' || t.priority === 'high').length ?? 0;
  const liveAgents = data.topAgents?.length ?? 0;
  const liveConversations = data.conversationsCount ?? 0;

  return (
    <div className="hero-pad" style={{
      position: 'relative',
      background: `linear-gradient(135deg, ${C.greenInk} 0%, ${C.greenDark} 50%, ${C.midnight} 100%)`,
      borderRadius: 24, padding: '32px 36px',
      overflow: 'hidden',
      border: `1px solid ${C.gold}30`,
      boxShadow: `0 20px 50px -20px rgba(0,0,0,0.5)`,
    }}>
      {/* Animated background circles */}
      <div className="grain"></div>

      {/* Slow rotating gold ring */}
      <div className="slow-rotate hero-orbit" style={{
        position: 'absolute', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        border: `1px dashed ${C.gold}30`,
        pointerEvents: 'none',
      }}></div>
      <div className="slow-rotate hero-orbit" style={{
        position: 'absolute', top: -50, right: -50,
        width: 300, height: 300, borderRadius: '50%',
        border: `1px dashed ${C.gold}20`,
        pointerEvents: 'none',
        animationDirection: 'reverse',
        animationDuration: '40s',
      }}></div>

      {/* Floating sparkles */}
      <div className="sparkle-float hero-orbit" style={{ position: 'absolute', top: 40, right: 100, opacity: 0.6 }}>
        <Sparkles size={20} color={C.gold} />
      </div>
      <div className="sparkle-float hero-orbit" style={{ position: 'absolute', top: 120, right: 250, opacity: 0.5, animationDelay: '1s' }}>
        <Sparkles size={14} color={C.terracotta} />
      </div>
      <div className="sparkle-float hero-orbit" style={{ position: 'absolute', top: 80, right: 400, opacity: 0.7, animationDelay: '2s' }}>
        <Sparkles size={16} color={C.sage} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Date pill */}
          <div className="hero-pills" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className="pill" style={{
              background: 'rgba(212,160,23,0.15)',
              color: C.goldLight,
              border: `1px solid ${C.gold}40`,
              fontWeight: 700, fontSize: 11,
              letterSpacing: '0.05em',
            }}>
              <Calendar size={11} /> {dateFormatted}
            </span>
            {company?.name && (
              <span className="pill" style={{
                background: 'rgba(134,197,160,0.15)',
                color: C.sage,
                border: `1px solid ${C.sage}40`,
                fontWeight: 600, fontSize: 11,
              }}>
                <Briefcase size={11} /> {company.name}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="display-font hero-title" style={{
            fontSize: 44, fontWeight: 800, color: C.cream, margin: 0,
            letterSpacing: '-0.03em', lineHeight: 1.1,
          }}>
            {greeting},{' '}
            <em className="shimmer-text" style={{
              fontStyle: 'italic', fontWeight: 500,
            }}>
              {firstName}
            </em>
          </h1>

          {/* Subtitle */}
          <p className="hero-sub" style={{ fontSize: 15, color: C.onGreenSoft, margin: '10px 0 18px', lineHeight: 1.5 }}>
            {data.loading ? (
              <>{t('dash_loading')}</>
            ) : insightsCount + urgentCount === 0 ? (
              <>{t('dash_all_clear')} <span style={{ color: C.sage }}>{t('dash_no_urgent')}</span></>
            ) : (
              <>
                {t('dash_you_have')}{' '}
                <strong style={{ color: C.gold }}>{insightsCount} {insightsCount !== 1 ? t('dash_suggestions') : t('dash_suggestion')}</strong>
                {' & '}
                <strong style={{ color: C.terracotta }}>{urgentCount} {urgentCount !== 1 ? t('dash_actions_priority') : t('dash_action_priority')}</strong>{' '}
                {t('dash_today')}
              </>
            )}
          </p>

          {/* Quick actions */}
          <div className="hero-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => navigate('/chat')}>
              <Sparkles size={15} /> {t('dash_open_chat')}
            </button>
            <button className="btn-ghost-light" onClick={() => navigate('/marketplace')}>
              <Bot size={14} /> {t('dash_all_agents')}
            </button>
            <button className="btn-ghost-light" onClick={() => navigate('/workspace')}>
              <Briefcase size={14} /> {t('dash_workspace')}
            </button>
          </div>
        </div>

        {/* Right: AI Status Widget */}
        <div className="hide-on-mobile hero-status" style={{
          background: 'rgba(255,250,240,0.06)',
          border: `1px solid ${C.gold}30`,
          borderRadius: 18, padding: 20,
          minWidth: 260,
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div className="ai-pulse" style={{
              width: 12, height: 12, borderRadius: '50%',
              background: C.gold,
            }}></div>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.gold, letterSpacing: '0.1em' }}>
              {(company?.name ?? 'CORPMIND').toUpperCase()} · {t('dash_live')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: C.onGreenSoft }}>{t('dash_active_agents')}</span>
              <span className="mono-font" style={{ color: C.cream, fontWeight: 700 }}>
                <span style={{ color: C.sage }}>{liveAgents}</span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: C.onGreenSoft }}>{t('dash_conversations')}</span>
              <span className="mono-font" style={{ color: C.cream, fontWeight: 700 }}>
                <span style={{ color: C.gold }}>{liveConversations}</span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: C.onGreenSoft }}>{t('dash_team')}</span>
              <span className="mono-font" style={{ color: C.cream, fontWeight: 700 }}>
                {data.membersCount} {data.membersCount > 1 ? t('dash_members') : t('dash_member')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: C.onGreenSoft }}>{t('dash_today_meetings')}</span>
              <span className="mono-font" style={{ color: data.agenda.length > 0 ? C.gold : C.sage, fontWeight: 700 }}>
                {data.agenda.length}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid rgba(255,250,240,0.1)` }}>
            <div style={{ fontSize: 10, color: C.onGreenSoft, marginBottom: 6, fontWeight: 600 }}>
              {t('dash_plan')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: C.cream, fontWeight: 700, textTransform: 'capitalize' }}>
                {company?.plan ?? 'Free'}
              </span>
              <span style={{ color: C.sage, fontSize: 10, fontWeight: 700 }}>
                {data.loading ? '…' : `● ${t('dash_active')}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ KPI CARDS ============
function KPICards() {
  const data = useDashboardData();
  const { t } = useLangStore();
  const liveLabel = t('dash_live');
  const memberStr = `${data.membersCount} ${data.membersCount > 1 ? t('dash_members') : t('dash_member')}`;
  const liveKpis = data.isPrivileged ? [
    { id: 'employees', label: t('dash_kpi_team_active'), value: data.membersCount, sub: memberStr, change: data.loading ? '…' : liveLabel, trend: 'up', icon: UsersRound, color: 'sage', sparkline: [data.membersCount] },
    { id: 'tasks', label: t('dash_kpi_leaves_pending'), value: data.leavesPending, sub: data.leavesPending > 0 ? t('dash_kpi_action_required') : t('dash_kpi_all_handled'), change: data.loading ? '…' : liveLabel, trend: data.leavesPending > 0 ? 'up' : 'down', icon: Target, color: 'gold', sparkline: [data.leavesPending] },
    { id: 'ai', label: t('dash_kpi_ai_conversations'), value: data.conversationsCount, sub: t('dash_kpi_total_all_agents'), change: data.loading ? '…' : liveLabel, trend: 'up', icon: Sparkles, color: 'indigo', sparkline: [data.conversationsCount] },
    { id: 'revenue', label: t('dash_kpi_invoices_issued'), value: data.invoicesCount, valueSuffix: data.revenueThisMonth ? `· ${(data.revenueThisMonth/1000).toFixed(0)}k FCFA` : undefined, sub: data.revenueThisMonth ? t('dash_kpi_this_month') : t('dash_kpi_to_invoice'), change: data.loading ? '…' : liveLabel, trend: 'up', icon: TrendingUp, color: 'terra', sparkline: [data.invoicesCount] },
  ] : [
    { id: 'my-conversations', label: t('dash_kpi_my_conversations'), value: data.conversationsCount, sub: t('dash_kpi_with_agents'), change: data.loading ? '…' : liveLabel, trend: 'up', icon: Sparkles, color: 'indigo', sparkline: [data.conversationsCount] },
    { id: 'my-leave', label: t('dash_kpi_my_leaves'), value: data.leavesPending, sub: data.leavesPending > 0 ? t('dash_kpi_pending') : t('dash_kpi_none_pending'), change: data.loading ? '…' : liveLabel, trend: 'up', icon: Calendar, color: 'gold', sparkline: [data.leavesPending] },
    { id: 'my-agenda', label: t('dash_kpi_today_meetings'), value: data.agenda.length, sub: data.agenda.length > 0 ? t('dash_kpi_dont_miss') : t('dash_kpi_free_day'), change: data.loading ? '…' : liveLabel, trend: 'up', icon: Clock, color: 'terra', sparkline: [data.agenda.length] },
    { id: 'team', label: t('dash_team'), value: data.membersCount, sub: memberStr, change: data.loading ? '…' : liveLabel, trend: 'up', icon: UsersRound, color: 'sage', sparkline: [data.membersCount] },
  ];
  return (
    <div className="responsive-grid-4 stagger" style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
    }}>
      {liveKpis.map((kpi, idx) => {
        const colors = getColorVar(kpi.color);
        const Icon = kpi.icon;
        const TrendIcon = kpi.trend === 'up' ? ArrowUpRight : kpi.trend === 'down' ? ArrowDownRight : Minus;

        return (
          <div key={kpi.id} className="card-lift" style={{
            background: C.cream, borderRadius: 18, padding: 18,
            border: `1px solid rgba(10,42,32,0.06)`,
            cursor: 'pointer', position: 'relative', overflow: 'hidden',
          }}>
            {/* Top accent bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: 4, background: `linear-gradient(90deg, ${colors.main}, ${colors.deep})`,
            }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: colors.soft, color: colors.deep,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={22} />
              </div>
              <span className="pill" style={{
                background: kpi.trend === 'up' ? C.sageSoft : C.redSoft,
                color: kpi.trend === 'up' ? C.sageDark : C.redDeep,
                fontWeight: 700, fontSize: 10,
              }}>
                <TrendIcon size={10} /> {kpi.change}
              </span>
            </div>

            <div className="display-font mono-font" style={{
              fontSize: 36, fontWeight: 800, color: C.ink,
              lineHeight: 1, letterSpacing: '-0.02em',
              display: 'flex', alignItems: 'baseline', gap: 4,
            }}>
              {kpi.value}
              {kpi.valueSuffix && (
                <span style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft }}>
                  {kpi.valueSuffix}
                </span>
              )}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>
              {kpi.sub}
            </div>

            {/* Sparkline */}
            <div style={{ marginTop: 12, marginLeft: -4, marginRight: -4 }}>
              <Sparkline data={kpi.sparkline} color={colors.main} height={36} width={220} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ AI SUGGESTIONS SECTION ============
function AISuggestions() {
  const data = useDashboardData();
  const navigate = useNavigate();
  const { t } = useLangStore();
  const realInsights = data.insights.map((ins: any) => ({
    id: ins.id, type: ins.type,
    icon: ins.color === 'terra' ? AlertCircle : ins.color === 'gold' ? Lightbulb : TrendingUp,
    title: ins.title, desc: ins.desc, action: t('dash_ai_view_details'), color: ins.color, eta: t('dash_just_now'),
  }));
  const insightsList = realInsights;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.midnight}, ${C.midnightDeep})`,
      borderRadius: 22, padding: 28,
      border: `1px solid ${C.gold}40`,
      position: 'relative', overflow: 'hidden',
      boxShadow: `0 20px 50px -20px rgba(30,27,75,0.4)`,
    }}>
      {/* Decorative starfield */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3, pointerEvents: 'none' }}>
        {[...Array(30)].map((_, i) => (
          <circle key={i}
            cx={Math.random() * 100 + '%'}
            cy={Math.random() * 100 + '%'}
            r={Math.random() * 1.5 + 0.5}
            fill={C.gold}
            opacity={Math.random() * 0.6 + 0.2}
          />
        ))}
      </svg>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="pill" style={{
              background: `${C.gold}20`,
              color: C.gold,
              border: `1px solid ${C.gold}40`,
              marginBottom: 8, fontWeight: 700,
            }}>
              <Sparkles size={11} className="bounce-soft" /> ORLODE COPILOT · {insightsList.length} INSIGHT{insightsList.length > 1 ? 'S' : ''}
            </div>
            <h2 className="display-font" style={{
              fontSize: 26, fontWeight: 800, color: C.cream,
              margin: 0, letterSpacing: '-0.02em',
            }}>
              {insightsList.length > 0
                ? <>{t('dash_ai_detected')} <em className="shimmer-text" style={{ fontStyle: 'italic', fontWeight: 500 }}>{insightsList.length} {insightsList.length > 1 ? t('dash_ai_opportunities') : t('dash_ai_opportunity')}</em> {t('dash_ai_for_you')}</>
                : <>{t('dash_ai_no_insight')}<em className="shimmer-text" style={{ fontStyle: 'italic', fontWeight: 500 }}>{t('dash_ai_insight')}</em> {t('dash_ai_for_now')}</>}
            </h2>
            <p style={{ fontSize: 12, color: C.onGreenSoft, margin: '4px 0 0' }}>
              {data.loading ? t('dash_ai_loading') : t('dash_ai_realtime')}
            </p>
          </div>
          <button className="btn-ghost-light" onClick={() => navigate('/insights')}>
            <RefreshCw size={13} /> {t('dash_ai_refresh')}
          </button>
        </div>

        {insightsList.length === 0 && !data.loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: C.onGreenSoft, fontSize: 13 }}>
            {t('dash_ai_empty')}
          </div>
        )}
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {insightsList.map((s: any, idx: number) => {
            const colors = getColorVar(s.color);
            const Icon = s.icon;
            return (
              <div key={s.id} className="card-lift" style={{
                background: C.cream, borderRadius: 16, padding: 18,
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                border: `1px solid ${colors.main}30`,
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 3, background: `linear-gradient(90deg, ${colors.main}, ${colors.deep})`,
                }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11,
                    background: colors.soft, color: colors.deep,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={20} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className="pill" style={{
                      background: colors.soft,
                      color: colors.ink,
                      fontWeight: 700, fontSize: 9,
                    }}>
                      <Clock size={9} /> {s.eta}
                    </span>
                    {s.type === 'urgent' && (
                      <span className="pill" style={{
                        background: C.redSoft, color: C.redDeep,
                        fontSize: 9, fontWeight: 700,
                      }}>{t('dash_ai_urgent')}</span>
                    )}
                  </div>
                </div>

                <h3 className="display-font" style={{
                  fontSize: 15, fontWeight: 700, color: C.ink,
                  margin: '0 0 6px', letterSpacing: '-0.01em', lineHeight: 1.3,
                }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px', lineHeight: 1.5 }}>
                  {s.desc}
                </p>

                <button onClick={() => navigate('/insights')} style={{
                  width: '100%',
                  background: `linear-gradient(135deg, ${colors.main}, ${colors.deep})`,
                  color: s.color === 'gold' || s.color === 'sage' ? C.greenInk : C.cream,
                  border: 'none',
                  padding: '10px 14px', borderRadius: 10,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: `0 6px 16px -6px ${colors.main}`,
                }}>
                  {s.action} <ArrowRight size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// ============ AGENT ACTIVITY FEED ============
function ActivityFeed() {
  const data = useDashboardData();
  const navigate = useNavigate();
  const { t } = useLangStore();
  return (
    <div style={{
      background: C.cream, borderRadius: 20, padding: 22,
      border: '1px solid rgba(10,42,32,0.06)',
      height: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className="live-dot"></div>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.sageDark, letterSpacing: '0.1em' }}>
              {t('dash_live_label')}
            </span>
          </div>
          <h3 className="display-font" style={{
            fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em',
          }}>
            {t('dash_agents_working')} <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>{t('dash_agents_working_em')}</em>
          </h3>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/agents')} style={{ padding: '7px 12px', fontSize: 11 }}>
          {t('dash_view_all')} <ArrowRight size={12} />
        </button>
      </div>

      {data.agentActivity.length === 0 && !data.loading && (
        <div style={{ padding: '30px 0', textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>
          {t('dash_no_activity')}
        </div>
      )}
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column' }}>
        {data.agentActivity.map((a, idx) => {
          const colors = getColorVar(a.color);
          const isLast = idx === data.agentActivity.length - 1;
          return (
            <div key={a.id} style={{
              display: 'flex', gap: 12,
              paddingBottom: 14,
              position: 'relative',
            }}>
              {/* Timeline */}
              {!isLast && (
                <div style={{
                  position: 'absolute',
                  left: 19, top: 38, bottom: 0,
                  width: 2,
                  background: `linear-gradient(180deg, ${colors.main}40, transparent)`,
                }}></div>
              )}

              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: `linear-gradient(135deg, ${colors.main}, ${colors.deep})`,
                color: C.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 18, zIndex: 1,
                border: `2px solid ${C.cream}`,
                boxShadow: `0 4px 12px -4px ${colors.main}`,
              }}>
                {a.avatar}
              </div>

              <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span className="display-font" style={{
                    fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em',
                  }}>
                    {a.agent}
                  </span>
                  {a.badge && (
                    <span className="pill" style={{
                      background: colors.soft, color: colors.ink,
                      fontSize: 9, fontWeight: 800,
                    }}>{a.badge}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
                  {a.text}
                </div>
                <div style={{ fontSize: 10, color: C.inkLight, marginTop: 3, fontWeight: 500 }}>
                  {a.time}
                </div>
              </div>

              <button className="icon-btn ghost" style={{ width: 30, height: 30, flexShrink: 0 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ AGENDA TODAY ============
function AgendaToday() {
  const data = useDashboardData();
  const navigate = useNavigate();
  const { t } = useLangStore();
  return (
    <div style={{
      background: C.cream, borderRadius: 20, padding: 22,
      border: '1px solid rgba(10,42,32,0.06)',
      height: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="pill" style={{
            background: C.goldSoft, color: C.goldDark,
            fontWeight: 700, fontSize: 10, marginBottom: 4,
          }}>
            <CalendarIcon size={10} /> {t('dash_agenda_today_pill')} · {data.agenda.length} {data.agenda.length > 1 ? t('dash_agenda_events') : t('dash_agenda_event')}
          </div>
          <h3 className="display-font" style={{
            fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em',
          }}>
            {t('dash_your_agenda_word')} <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>{t('dash_your_agenda_em')}</em>
          </h3>
        </div>
        <button className="icon-btn" onClick={() => navigate('/calendar')} title={t('dash_view_full_agenda')}><Plus size={14} /></button>
      </div>

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.agenda.length === 0 && !data.loading && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: C.inkSoft, fontSize: 13 }}>
            {t('dash_no_meetings_today')}
          </div>
        )}
        {data.agenda.map((e) => {
          const colors = getColorVar(e.color);
          return (
            <div key={e.id} onClick={() => navigate('/calendar')} style={{
              display: 'flex', gap: 12, padding: '10px 12px',
              background: e.priority ? `${colors.main}08` : C.creamDeep,
              borderRadius: 12, cursor: 'pointer',
              border: e.priority ? `1px solid ${colors.main}30` : '1px solid transparent',
              transition: 'all 0.2s ease',
              alignItems: 'center',
            }}
            onMouseOver={ev => ev.currentTarget.style.transform = 'translateX(4px)'}
            onMouseOut={ev => ev.currentTarget.style.transform = 'translateX(0)'}
            >
              <div style={{
                width: 4, alignSelf: 'stretch',
                background: `linear-gradient(180deg, ${colors.main}, ${colors.deep})`,
                borderRadius: 100,
              }}></div>
              <div style={{ minWidth: 56 }}>
                <div className="mono-font" style={{ fontSize: 13, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em' }}>
                  {e.time}
                </div>
                <div style={{ fontSize: 9, color: C.inkLight, fontWeight: 500 }}>
                  {e.duration}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {e.title}
                  {e.priority && <Flame size={11} className="wiggle" style={{ color: C.terracotta }} />}
                </div>
                <div style={{ fontSize: 10, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <UsersRound size={10} /> {e.attendees} {t('dash_participants')}
                </div>
              </div>
              {e.type === 'ai' ? (
                <span className="pill" style={{
                  background: colors.soft, color: colors.ink,
                  fontSize: 9, fontWeight: 700,
                }}>
                  <Bot size={9} /> {t('dash_ai_badge')}
                </span>
              ) : (
                <button className="icon-btn ghost" style={{ width: 28, height: 28 }}>
                  <Video size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ TASKS ============
function Tasks() {
  const data = useDashboardData();
  const navigate = useNavigate();
  const { t } = useLangStore();
  const tasks = data.tasks ?? [];
  const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
    urgent:  { color: C.red,        bg: C.redSoft,    label: t('dash_priority_urgent') },
    high:    { color: C.terraDeep,  bg: C.terraSoft,  label: t('dash_priority_high') },
    medium:  { color: C.goldDark,   bg: C.goldSoft,   label: t('dash_priority_medium') },
    low:     { color: C.sageDark,   bg: C.sageSoft,   label: t('dash_priority_low') },
  };

  return (
    <div style={{
      background: C.cream, borderRadius: 20, padding: 22,
      border: '1px solid rgba(10,42,32,0.06)',
      height: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="pill" style={{
            background: C.terraSoft, color: C.terraDeep,
            fontWeight: 700, fontSize: 10, marginBottom: 4,
          }}>
            <Target size={10} /> {tasks.filter((tk: any) => !tk.done).length} {t('dash_open_tasks')}
          </div>
          <h3 className="display-font" style={{
            fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em',
          }}>
            {t('dash_priorities_word')} <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.terracotta }}>{t('dash_priorities_em')}</em>
          </h3>
        </div>
        <button className="icon-btn terra" onClick={() => navigate('/hr')} title={t('dash_view_hr_short')}><Plus size={14} /></button>
      </div>

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tasks.length === 0 && (
          <div style={{
            padding: 18, textAlign: 'center', color: C.inkSoft,
            fontSize: 12, border: '1px dashed rgba(10,42,32,0.12)',
            borderRadius: 10,
          }}>
            {t('dash_no_tasks')}
          </div>
        )}
        {tasks.map((tk: any) => {
          const p = priorityConfig[tk.priority] ?? priorityConfig.medium;
          return (
            <div key={tk.id} onClick={() => navigate('/hr')} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 10, background: tk.done ? 'transparent' : C.creamDeep,
              borderRadius: 10, cursor: 'pointer',
              border: tk.done ? '1px dashed rgba(10,42,32,0.1)' : '1px solid transparent',
              opacity: tk.done ? 0.55 : 1,
              transition: 'all 0.2s ease',
            }}
            onMouseOver={ev => !tk.done && (ev.currentTarget.style.transform = 'translateX(3px)')}
            onMouseOut={ev => !tk.done && (ev.currentTarget.style.transform = 'translateX(0)')}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                border: `2px solid ${tk.done ? C.sage : C.inkLight}`,
                background: tk.done ? C.sage : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {tk.done && <Check size={12} color={C.cream} strokeWidth={3} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.ink,
                  textDecoration: tk.done ? 'line-through' : 'none',
                  marginBottom: 2,
                }}>
                  {tk.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.inkSoft }}>
                  <span className="pill" style={{ background: p.bg, color: p.color, fontSize: 9, fontWeight: 700 }}>
                    {p.label}
                  </span>
                  <span>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={9} /> {tk.due}
                  </span>
                  <span>·</span>
                  <span>{tk.project}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => navigate('/hr')} style={{
        width: '100%', marginTop: 12,
        padding: '8px', background: 'transparent',
        border: `1px dashed rgba(10,42,32,0.15)`,
        borderRadius: 10, color: C.inkSoft,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'all 0.2s ease',
      }}
      onMouseOver={e => { e.currentTarget.style.background = C.creamDeep; e.currentTarget.style.borderColor = C.terracotta; }}
      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.15)'; }}
      >
        <Plus size={13} /> {t('dash_view_hr')}
      </button>
    </div>
  );
}
// ============ ACTIVITY CHART (7 days) ============
function ActivityChart() {
  const ctx = useDashboardData();
  const { t } = useLangStore();
  const [period, setPeriod] = useState<'7j' | '30j' | '90j'>('7j');
  const days7 = ctx.activityByDay ?? [];
  const sliceLen = period === '7j' ? 7 : period === '30j' ? Math.min(days7.length, 7) : Math.min(days7.length, 7);
  const visible = days7.slice(-sliceLen);
  const total = visible.reduce((s, d) => s + d.value, 0);
  const max = Math.max(...visible.map(d => d.value), 1);
  const isEmpty = total === 0;
  const periodLabel = period === '7j' ? t('dash_chart_7d') : period === '30j' ? t('dash_chart_30d') : t('dash_chart_90d');

  return (
    <div style={{
      background: C.cream, borderRadius: 20, padding: 22,
      border: '1px solid rgba(10,42,32,0.06)',
      height: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="pill" style={{
            background: C.indigoSoft, color: C.indigo,
            fontWeight: 700, fontSize: 10, marginBottom: 4,
          }}>
            <BarChart3 size={10} /> {periodLabel}
          </div>
          <h3 className="display-font" style={{
            fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em',
          }}>
            {t('dash_chart_activity_word')} <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.indigo }}>{t('dash_chart_activity_em')}</em>
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
            <strong style={{ color: C.ink }} className="mono-font">{total}</strong> {total !== 1 ? t('dash_chart_conversations') : t('dash_chart_conversation')} {t('dash_chart_period')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['7j', '30j', '90j'] as const).map((p) => {
            const active = period === p;
            return (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '6px 10px',
                background: active ? C.midnight : 'transparent',
                color: active ? C.cream : C.inkSoft,
                border: active ? 'none' : '1px solid rgba(10,42,32,0.1)',
                borderRadius: 8, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{p}</button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: C.indigo }}></div>
          <span style={{ color: C.inkSoft, fontWeight: 600 }}>{t('dash_chart_legend_ai')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: C.gold }}></div>
          <span style={{ color: C.inkSoft, fontWeight: 600 }}>{t('dash_chart_legend_human')}</span>
        </div>
      </div>

      {/* Chart */}
      {isEmpty ? (
        <div style={{
          height: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.inkSoft, fontSize: 13, textAlign: 'center',
          border: '1px dashed rgba(10,42,32,0.12)', borderRadius: 12,
        }}>
          {t('dash_chart_empty')}
        </div>
      ) : (
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        height: 200, padding: '0 4px', position: 'relative',
      }}>
        {/* Y-axis grid */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              borderTop: i === 3 ? 'none' : '1px dashed rgba(10,42,32,0.06)',
              flex: 1, position: 'relative',
            }}>
              <span className="mono-font" style={{
                position: 'absolute', right: 0, top: -8,
                fontSize: 9, color: C.inkLight, fontWeight: 600,
              }}>
                {Math.round((max * (3 - i)) / 3)}
              </span>
            </div>
          ))}
        </div>

        {visible.map((d, i) => {
          const aiHeight = (d.ai / max) * 100;
          const humanHeight = (d.human / max) * 100;
          return (
            <div key={i} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, position: 'relative',
              cursor: 'pointer',
            }}>
              <div style={{
                width: '100%', display: 'flex', flexDirection: 'column',
                justifyContent: 'flex-end', height: 160, gap: 2,
              }}>
                {/* Human bar */}
                <div style={{
                  width: '100%', height: `${humanHeight}%`,
                  background: `linear-gradient(180deg, ${C.gold}, ${C.goldDeep})`,
                  borderRadius: '4px 4px 0 0',
                  boxShadow: d.today ? `0 -4px 12px -4px ${C.gold}` : 'none',
                  transition: 'all 0.3s ease',
                }}></div>
                {/* AI bar */}
                <div style={{
                  width: '100%', height: `${aiHeight}%`,
                  background: `linear-gradient(180deg, ${C.indigo}, ${C.midnight})`,
                  borderRadius: '0',
                  boxShadow: d.today ? `0 4px 12px -4px ${C.indigo}` : 'none',
                  transition: 'all 0.3s ease',
                }}></div>
              </div>

              <div style={{
                fontSize: 11, fontWeight: d.today ? 800 : 600,
                color: d.today ? C.indigo : C.inkSoft,
              }}>
                {d.day}
              </div>
              {d.today && (
                <div className="pill" style={{
                  position: 'absolute', top: -22,
                  background: C.indigo, color: C.cream,
                  fontSize: 9, fontWeight: 700, padding: '2px 6px',
                }}>
                  {d.value}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ============ TOP AGENTS ============
function TopAgents() {
  const data = useDashboardData();
  const { t } = useLangStore();
  const topAgents = data.topAgents ?? [];
  return (
    <div style={{
      background: C.cream, borderRadius: 20, padding: 22,
      border: '1px solid rgba(10,42,32,0.06)',
      height: '100%',
    }}>
      <div style={{ marginBottom: 16 }}>
        <div className="pill" style={{
          background: C.goldSoft, color: C.goldDark,
          fontWeight: 700, fontSize: 10, marginBottom: 4,
        }}>
          <Trophy size={10} /> {t('dash_top_pill')}
        </div>
        <h3 className="display-font" style={{
          fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em',
        }}>
          {t('dash_top_word')} <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>{t('dash_top_em')}</em>
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {topAgents.length === 0 && (
          <div style={{
            padding: 18, textAlign: 'center', color: C.inkSoft,
            fontSize: 12, border: '1px dashed rgba(10,42,32,0.12)',
            borderRadius: 10,
          }}>
            {t('dash_top_empty')}
          </div>
        )}
        {topAgents.map((a: any, i: number) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono-font" style={{
              fontSize: 12, fontWeight: 800, color: C.inkLight, width: 20,
            }}>#{i + 1}</span>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${a.color}, ${a.color}cc)`,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
              boxShadow: `0 4px 10px -4px ${a.color}`,
            }}>{a.avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.name}
                </span>
                <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: a.color }}>
                  {a.usage}%
                </span>
              </div>
              <div style={{ height: 5, background: 'rgba(10,42,32,0.06)', borderRadius: 100, overflow: 'hidden' }}>
                <div className="progress-fill" style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${a.color}, ${a.color}cc)`,
                  '--target-width': `${a.usage}%`,
                  borderRadius: 100,
                }}></div>
              </div>
              <div style={{ fontSize: 9, color: C.inkLight, marginTop: 2, fontWeight: 500 }}>
                <span className="mono-font">{a.calls}</span> {t('dash_top_conversations')}
              </div>
            </div>
            {i === 0 && (
              <Award size={18} fill={C.gold} color={C.goldDeep} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ FAVORITE AGENTS ============
function FavoriteAgents() {
  const data = useDashboardData();
  const favs = data.favoriteAgents ?? [];
  const navigate = useNavigate();
  const { t } = useLangStore();
  return (
    <div style={{
      background: C.cream, borderRadius: 20, padding: 22,
      border: '1px solid rgba(10,42,32,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="pill" style={{
            background: C.sageSoft, color: C.sageDark,
            fontWeight: 700, fontSize: 10, marginBottom: 4,
          }}>
            <Star size={10} /> {t('dash_favs_pill')}
          </div>
          <h3 className="display-font" style={{
            fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em',
          }}>
            {t('dash_favs_word')} <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.sageDeep }}>{t('dash_favs_em')}</em>
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
            {t('dash_favs_sub')}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/marketplace')} style={{ padding: '8px 14px', fontSize: 12 }}>
          <Bot size={13} /> {t('dash_all_agents')}
        </button>
      </div>

      <div className="responsive-grid-3 stagger" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
      }}>
        {favs.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            padding: 18, textAlign: 'center', color: C.inkSoft,
            fontSize: 12, border: '1px dashed rgba(10,42,32,0.12)',
            borderRadius: 14,
          }}>
            {t('dash_favs_empty')}
          </div>
        )}
        {favs.map((a: any) => (
          <div key={a.id} onClick={() => navigate(`/chat?agent=${a.id}`)} className="card-lift" style={{
            background: C.creamDeep, borderRadius: 14, padding: 14,
            cursor: 'pointer', position: 'relative', overflow: 'hidden',
            border: '1px solid transparent',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = `${a.color}40`; e.currentTarget.style.background = C.cream; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = C.creamDeep; }}
          >
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: a.online ? C.sage : C.inkLight,
              }}></div>
            </div>

            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${a.color}, ${a.color}cc)`,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, marginBottom: 10,
              boxShadow: `0 6px 14px -4px ${a.color}`,
            }}>{a.emoji}</div>

            <h4 className="display-font" style={{
              fontSize: 14, fontWeight: 700, color: C.ink,
              margin: '0 0 2px', letterSpacing: '-0.01em',
            }}>
              {a.name}
            </h4>
            <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 8px', lineHeight: 1.3 }}>
              {a.desc}
            </p>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 10, color: C.inkLight, fontWeight: 500,
            }}>
              <span className="mono-font" style={{ color: a.color, fontWeight: 700 }}>
                {a.conversations} {t('dash_favs_chats')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: a.color, fontWeight: 700 }}>
                {t('dash_favs_launch')} <ArrowRight size={11} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ NOTIFICATIONS ============
function NotificationsCard() {
  const data = useDashboardData();
  const notifs = data.notifications ?? [];
  const navigate = useNavigate();
  const { t } = useLangStore();
  return (
    <div style={{
      background: C.cream, borderRadius: 20, padding: 22,
      border: '1px solid rgba(10,42,32,0.06)',
      height: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="pill" style={{
            background: C.terraSoft, color: C.terraDeep,
            fontWeight: 700, fontSize: 10, marginBottom: 4,
          }}>
            <Bell size={10} /> {notifs.filter((n: any) => n.unread).length} {t('dash_notifs_unread')}
          </div>
          <h3 className="display-font" style={{
            fontSize: 19, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em',
          }}>
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.terracotta }}>{t('dash_notifs_em')}</em>
          </h3>
        </div>
        <button className="icon-btn ghost" onClick={() => navigate('/settings/notifications')} title={t('dash_notifs_settings')}><MoreVertical size={14} /></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifs.length === 0 && (
          <div style={{
            padding: 18, textAlign: 'center', color: C.inkSoft,
            fontSize: 12, border: '1px dashed rgba(10,42,32,0.12)',
            borderRadius: 10,
          }}>
            {t('dash_notifs_empty')}
          </div>
        )}
        {notifs.map((n: any) => {
          const colors = getColorVar(n.color ?? 'sage');
          const Icon = n.icon ?? Bell;
          return (
            <div key={n.id} style={{
              display: 'flex', gap: 10, padding: 10,
              background: n.unread ? `${colors.main}08` : 'transparent',
              borderRadius: 10, cursor: 'pointer',
              border: n.unread ? `1px solid ${colors.main}20` : '1px solid transparent',
              transition: 'all 0.2s ease',
              alignItems: 'flex-start',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateX(3px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateX(0)'}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: colors.soft, color: colors.deep,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 1 }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.4 }}>
                  {n.desc}
                </div>
                <div className="mono-font" style={{ fontSize: 9, color: C.inkLight, fontWeight: 600, marginTop: 2 }}>
                  {n.time}
                </div>
              </div>
              {n.unread && (
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: colors.main, marginTop: 12, flexShrink: 0,
                  boxShadow: `0 0 0 2px ${colors.soft}`,
                }}></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ AI FAB (Floating Action Button) ============
function CtaButtons() {
  const navigate = useNavigate();
  const { t } = useLangStore();
  return (
    <>
      <button className="btn-primary" onClick={() => navigate('/marketplace')}>
        <Store size={14} /> {t('dash_cta_explore')}
      </button>
      <button className="btn-ghost-light" onClick={() => navigate('/marketplace?sort=trending')}>
        <Sparkles size={14} /> {t('dash_cta_trending')}
      </button>
    </>
  );
}

function AIFab() {
  const navigate = useNavigate();
  const data = useDashboardData();
  const { t } = useLangStore();
  const insightsCount = data.insights?.length ?? 0;
  const hint = insightsCount > 0
    ? `${insightsCount} ${insightsCount > 1 ? t('dash_fab_insights_ready') : t('dash_fab_insight_ready')}`
    : t('dash_fab_default_hint');
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 50,
    }} className="float ai-fab">
      <div style={{ position: 'relative' }}>
        {/* Outer rings */}
        <div className="ai-pulse" style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
        }}></div>
        <button onClick={() => navigate('/chat')} className="glow-gold" style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.gold}, ${C.terracotta})`,
          border: `3px solid ${C.cream}`,
          color: C.greenInk,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          fontFamily: 'inherit',
          position: 'relative',
        }} title={t('dash_open_chat')}>
          <Sparkles size={26} strokeWidth={2.5} />
        </button>

        {/* Suggestion bubble */}
        <div onClick={() => navigate('/chat')} className="fab-bubble" style={{
          position: 'absolute',
          bottom: 'calc(100% + 12px)', right: 0,
          background: C.cream,
          border: `1px solid ${C.gold}40`,
          borderRadius: 14, padding: '10px 14px',
          minWidth: 220,
          boxShadow: '0 12px 30px -10px rgba(0,0,0,0.3)',
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Sparkles size={11} color={C.gold} />
            <span style={{ fontSize: 9, fontWeight: 800, color: C.goldDark, letterSpacing: '0.08em' }}>
              {t('dash_fab_suggestion')}
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.ink, fontWeight: 600, lineHeight: 1.4 }}>
            {hint}
          </div>
          <div style={{
            position: 'absolute',
            bottom: -6, right: 24,
            width: 12, height: 12,
            background: C.cream,
            borderRight: `1px solid ${C.gold}40`,
            borderBottom: `1px solid ${C.gold}40`,
            transform: 'rotate(45deg)',
          }}></div>
        </div>
      </div>
    </div>
  );
}

// ============ DASHBOARD MAIN ============
function DashboardContent() {
  const data = useDashboardData();
  const { t } = useLangStore();
  return (
    <div className="dashboard-content" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 110 }}>
      <div className="fade-in"><HeroSection /></div>
      <div className="fade-in" style={{ animationDelay: '0.1s' }}><KPICards /></div>
      {data.isPrivileged && (
        <div className="fade-in" style={{ animationDelay: '0.2s' }}><AISuggestions /></div>
      )}

      {/* 3-col: Activity feed + Agenda + Tasks */}
      <div className="responsive-charts" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
      }}>
        {data.isPrivileged && <ActivityFeed />}
        <AgendaToday />
        <Tasks />
      </div>

      {/* 2-col: Chart + Top agents — admin only */}
      {data.isPrivileged && (
        <div className="responsive-grid-2" style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14,
        }}>
          <ActivityChart />
          <TopAgents />
        </div>
      )}

      {/* Favorite agents (full width) */}
      <FavoriteAgents />

      {/* Notifications */}
      <div className="responsive-grid-2" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
      }}>
        <NotificationsCard />
        {/* CTA card */}
        <div style={{
          background: `linear-gradient(135deg, ${C.midnight}, ${C.midnightDeep})`,
          borderRadius: 20, padding: 28,
          border: `1px solid ${C.gold}40`,
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          minHeight: 220,
        }}>
          <div className="grain"></div>
          <div className="slow-rotate" style={{
            position: 'absolute', top: -60, right: -60,
            width: 200, height: 200, borderRadius: '50%',
            border: `1px dashed ${C.gold}30`,
            pointerEvents: 'none',
          }}></div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="pill" style={{
              background: `${C.gold}20`, color: C.gold,
              border: `1px solid ${C.gold}40`,
              fontWeight: 700, fontSize: 10, marginBottom: 12,
            }}>
              <Mountain size={10} /> {t('dash_cta_pill')}
            </div>
            <h3 className="display-font" style={{
              fontSize: 22, fontWeight: 800, color: C.cream,
              margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              {t('dash_cta_title_word')}<br />
              <em className="shimmer-text" style={{ fontStyle: 'italic', fontWeight: 500 }}>
                {t('dash_cta_title_em')}
              </em>
            </h3>
            <p style={{ fontSize: 12, color: C.onGreenSoft, margin: 0, lineHeight: 1.5 }}>
              {t('dash_cta_desc')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, position: 'relative', zIndex: 1 }}>
            <CtaButtons />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============
// ============ DATA CONTEXT — vraie data backend ============
interface DashboardData {
  loading: boolean;
  role: 'admin' | 'manager' | 'employee';
  isPrivileged: boolean;
  // Counts
  membersCount: number;
  leavesPending: number;
  conversationsCount: number;
  invoicesCount: number;
  revenueThisMonth: number;
  // Lists
  agenda: Array<{ id: string; time: string; duration: string; title: string; attendees: number; type: string; color: string; priority?: boolean }>;
  tasks: Array<{ id: string; title: string; priority: string; due: string; project: string; done: boolean }>;
  agentActivity: Array<{ id: string; agent: string; avatar: string; text: string; time: string; color: string; badge?: string }>;
  topAgents: Array<{ id: string; name: string; avatar: string; usage: number; calls: number; color: string }>;
  notifications: Array<{ id: string; title: string; desc: string; time: string; color: string; unread?: boolean }>;
  favoriteAgents: Array<{ id: string; name: string; emoji: string; desc: string; color: string; online: boolean; conversations: number }>;
  insights: Array<{ id: string; type: string; title: string; desc: string; color: string }>;
  activityByDay: Array<{ day: string; value: number; ai: number; human: number; today?: boolean }>;
}
const DashboardCtx = createContext<DashboardData>({
  loading: true, role: 'employee', isPrivileged: false,
  membersCount: 0, leavesPending: 0, conversationsCount: 0, invoicesCount: 0, revenueThisMonth: 0,
  agenda: [], tasks: [], agentActivity: [], topAgents: [], notifications: [], favoriteAgents: [], insights: [], activityByDay: [],
});
export const useDashboardData = () => useContext(DashboardCtx);

const AGENT_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  callHRAgent:           { label: 'Agent RH',           emoji: '👥', color: '#86C5A0' },
  callAccountingAgent:   { label: 'Agent Comptable',    emoji: '💰', color: '#D4A017' },
  callSalesAgent:        { label: 'Agent Commercial',   emoji: '💼', color: '#D4A017' },
  callMarketingAgent:    { label: 'Agent Marketing',    emoji: '📣', color: '#E07856' },
  callReceptionAgent:    { label: 'Agent Réception',    emoji: '📞', color: '#06B6D4' },
  callLegalAgent:        { label: 'Agent Juridique',    emoji: '⚖️', color: '#5B21B6' },
  callKnowledgeAgent:    { label: 'Agent Knowledge',    emoji: '📚', color: '#4338CA' },
  callSupportAgent:      { label: 'Agent Support',      emoji: '🆘', color: '#EF4444' },
  callITAgent:           { label: 'Agent IT',           emoji: '🖥️', color: '#0EA5E9' },
  callCybersecurityAgent:{ label: 'Agent Cyber',        emoji: '🛡️', color: '#7C3AED' },
  draftCommunication:    { label: 'Agent Comms',        emoji: '✉️', color: '#EC4899' },
};

function formatRelTime(d: Date | null | undefined, t: (k: string, p?: any) => string): string {
  if (!d) return '—';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return t('dash_just_now');
  if (diff < 3600) return t('dash_minutes_ago', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('dash_hours_ago', { n: Math.floor(diff / 3600) });
  return t('dash_days_ago', { n: Math.floor(diff / 86400) });
}

function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { t, lang } = useLangStore();
  const role = user?.role ?? 'employee';
  const isPrivileged = role === 'admin' || role === 'manager';

  const [data, setData] = useState<DashboardData>({
    loading: true, role: role as any, isPrivileged,
    membersCount: 0, leavesPending: 0, conversationsCount: 0, invoicesCount: 0, revenueThisMonth: 0,
    agenda: [], tasks: [], agentActivity: [], topAgents: [], notifications: [], favoriteAgents: [], insights: [], activityByDay: [],
  });

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      const safe = (p: Promise<any>): Promise<any> => p.catch(() => null);

      // Privileged users see global company data; employees see their own scoped data
      const [
        membersRes, leavesRes, convsRes, invoicesRes, financeRes,
        appointmentsRes, agentsHealthRes, agentsTracesRes, insightsRes, notifsRes,
        meSummaryRes,
      ] = await Promise.all([
        safe(api.get('/team/members')),
        isPrivileged ? safe(api.get('/hr/leave/pending')) : safe(api.get('/me/leave')),
        isPrivileged ? safe(api.get('/chat/conversations')) : safe(api.get('/me/conversations')),
        isPrivileged ? safe(api.get('/finance/invoices')) : Promise.resolve(null),
        isPrivileged ? safe(api.get('/finance/dashboard')) : Promise.resolve(null),
        isPrivileged ? safe(api.get('/reception/appointments')) : safe(api.get('/me/agenda')),
        safe(api.get('/agents/health')),
        isPrivileged ? safe(api.get('/agents/traces')) : Promise.resolve(null),
        isPrivileged ? safe(api.get('/agent/insights')) : Promise.resolve(null),
        safe(api.get('/notifications')),
        isPrivileged ? Promise.resolve(null) : safe(api.get('/me/summary')),
      ]);
      if (!mounted) return;

      const members = Array.isArray(membersRes?.data) ? membersRes.data : (membersRes?.data?.members ?? []);
      const leaves = Array.isArray(leavesRes?.data?.requests) ? leavesRes.data.requests : (Array.isArray(leavesRes?.data) ? leavesRes.data : []);
      const convos = Array.isArray(convsRes?.data) ? convsRes.data : (Array.isArray(convsRes?.data?.conversations) ? convsRes.data.conversations : []);
      const invoices = Array.isArray(invoicesRes?.data?.invoices) ? invoicesRes.data.invoices : (Array.isArray(invoicesRes?.data) ? invoicesRes.data : []);
      const finance = financeRes?.data ?? null;
      const appointments = Array.isArray(appointmentsRes?.data?.appointments) ? appointmentsRes.data.appointments : (Array.isArray(appointmentsRes?.data) ? appointmentsRes.data : []);
      const health: any[] = Array.isArray(agentsHealthRes?.data) ? agentsHealthRes.data : [];
      const traces: any[] = Array.isArray(agentsTracesRes?.data) ? agentsTracesRes.data : [];
      const insights: any[] = Array.isArray(insightsRes?.data?.insights) ? insightsRes.data.insights : (Array.isArray(insightsRes?.data) ? insightsRes.data : []);
      const notifs: any[] = Array.isArray(notifsRes?.data) ? notifsRes.data : (notifsRes?.data?.notifications ?? []);
      const meSummary = meSummaryRes?.data?.summary ?? null;

      // Agenda — today's appointments
      const today = new Date().toDateString();
      const todayAppts = appointments
        .filter((a: any) => {
          const d = a.date ? new Date(a.date) : null;
          return d && d.toDateString() === today;
        })
        .slice(0, 6)
        .map((a: any, i: number) => ({
          id: a.id ?? `a${i}`,
          time: a.time ?? '—',
          duration: a.duration ?? '30 min',
          title: a.subject ?? a.title ?? `RDV ${a.visitor ?? ''}`.trim(),
          attendees: 1 + (a.host ? 1 : 0),
          type: 'meeting',
          color: ['gold', 'sage', 'terra', 'indigo', 'cyan'][i % 5],
        }));

      // Top agents
      const topAgentsData = [...health]
        .sort((a, b) => b.totalCalls - a.totalCalls)
        .slice(0, 5)
        .map((h, i) => {
          const meta = AGENT_LABELS[h.name];
          return {
            id: `t${i}`,
            name: meta?.label ?? h.name,
            avatar: meta?.emoji ?? '🤖',
            usage: Math.min(100, Math.round((h.totalCalls / Math.max(...health.map(x => x.totalCalls), 1)) * 100)),
            calls: h.totalCalls,
            color: meta?.color ?? '#7C3AED',
          };
        });

      // Agent activity — from recent traces
      const activity = traces.slice(0, 6).map((tr: any, i: number) => {
        const primary = (tr.agentsUsed && tr.agentsUsed[0]) || tr.intent?.agent || 'orchestrator';
        const meta = AGENT_LABELS[primary] ?? { label: 'Orchestrator', emoji: '🎼', color: '#7C3AED' };
        return {
          id: tr.id ?? `act${i}`,
          agent: meta.label,
          avatar: meta.emoji,
          text: tr.message ? `“${tr.message.slice(0, 40)}${tr.message.length > 40 ? '…' : ''}”` : '—',
          time: formatRelTime(tr.timestamp ? new Date(tr.timestamp) : null, t),
          color: ['gold', 'sage', 'terra', 'cyan', 'indigo'][i % 5],
        };
      });

      // Favorite agents — derive from conversations
      const convsByAgent: Record<string, number> = {};
      convos.forEach((c: any) => {
        const a = c.agentId ?? 'unknown';
        convsByAgent[a] = (convsByAgent[a] ?? 0) + 1;
      });
      const FAV_AGENTS_META: Record<string, { name: string; emoji: string; desc: string; color: string }> = {
        sales:      { name: 'Commercial', emoji: '💼', desc: 'Leads & ventes',         color: '#D4A017' },
        marketing:  { name: 'Marketing',  emoji: '📣', desc: 'Campagnes & contenu',    color: '#E07856' },
        hr:         { name: 'RH',         emoji: '👥', desc: 'Employés & paie',        color: '#86C5A0' },
        accounting: { name: 'CFO',        emoji: '💰', desc: 'Finance & reporting',    color: '#7C3AED' },
        reception:  { name: 'Réception',  emoji: '📞', desc: 'Appels & accueil',       color: '#06B6D4' },
        knowledge:  { name: 'Knowledge',  emoji: '📚', desc: 'Documents & Q&A',        color: '#4338CA' },
        legal:      { name: 'Juridique',  emoji: '⚖️', desc: 'Contrats & OHADA',       color: '#5B21B6' },
        support:    { name: 'Support',    emoji: '🆘', desc: 'Tickets & helpdesk',     color: '#EF4444' },
      };
      const favAgents = Object.entries(FAV_AGENTS_META).map(([id, meta]) => ({
        id,
        name: meta.name,
        emoji: meta.emoji,
        desc: meta.desc,
        color: meta.color,
        online: true,
        conversations: convsByAgent[id] ?? 0,
      })).sort((a, b) => b.conversations - a.conversations).slice(0, 6);

      // Insights mapping
      const insightsData = insights.slice(0, 3).map((ins: any, i: number) => ({
        id: ins.id ?? `ins${i}`,
        type: ins.type ?? 'info',
        title: ins.title ?? 'Insight',
        desc: ins.description ?? ins.summary ?? '',
        color: ins.severity === 'high' ? 'terra' : ins.severity === 'medium' ? 'gold' : 'sage',
      }));

      // Notifications
      const notifsData = notifs.slice(0, 4).map((n: any, i: number) => ({
        id: n.id ?? `n${i}`,
        title: n.title ?? n.subject ?? t('dash_notifs_em'),
        desc: n.body ?? n.message ?? '',
        time: formatRelTime(n.createdAt ? new Date(n.createdAt) : null, t),
        color: ['indigo', 'terra', 'sage', 'gold'][i % 4],
        unread: !n.read,
      }));

      // Tasks — leaves shown as RH tasks (admin sees pending company-wide; employee sees their own)
      const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ar: 'ar-SA', de: 'de-DE', pt: 'pt-BR' };
      const dateLocale = localeMap[lang] ?? 'en-US';
      const tasks = leaves.slice(0, 5).map((l: any, i: number) => ({
        id: l.id ?? `lt${i}`,
        title: isPrivileged
          ? `${t('dash_leave_request')} · ${l.userName ?? l.user ?? t('dash_employee')}`
          : `${t('dash_my_leave')} · ${l.type ?? 'standard'} (${l.status ?? 'pending'})`,
        priority: l.status === 'pending' ? 'high' : 'medium',
        due: l.startDate ? new Date(l.startDate).toLocaleDateString(dateLocale) : t('dash_to_handle'),
        project: t('dash_hr_project'),
        done: l.status === 'approved',
      }));

      const revenue = (finance?.revenueThisMonth as number) ?? (finance?.invoicesPaidThisMonth as number) ?? 0;

      // Activity by day (last 7 days) — derived from traces + conversations
      const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const now = new Date();
      const buckets: Array<{ day: string; ai: number; human: number; date: number; today?: boolean }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        buckets.push({ day: dayLabels[d.getDay()], ai: 0, human: 0, date: d.getTime(), today: i === 0 });
      }
      const isSameDay = (ts: number, ref: number) => {
        const a = new Date(ts);
        const b = new Date(ref);
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
      };
      traces.forEach((t: any) => {
        const ts = t.timestamp ? new Date(t.timestamp).getTime() : null;
        if (!ts) return;
        const bucket = buckets.find(b => isSameDay(ts, b.date));
        if (bucket) bucket.ai += 1;
      });
      convos.forEach((c: any) => {
        const ts = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() : null);
        if (!ts) return;
        const bucket = buckets.find(b => isSameDay(ts, b.date));
        if (bucket) bucket.human += 1;
      });
      const activityByDay = buckets.map(b => ({
        day: b.day, ai: b.ai, human: b.human, value: b.ai + b.human, today: b.today,
      }));

      setData({
        loading: false,
        role: role as any,
        isPrivileged,
        membersCount: members.length,
        leavesPending: meSummary ? meSummary.leavePending : leaves.length,
        conversationsCount: meSummary ? meSummary.conversations : convos.length,
        invoicesCount: invoices.length,
        revenueThisMonth: revenue,
        agenda: todayAppts,
        tasks,
        agentActivity: activity,
        topAgents: topAgentsData,
        notifications: notifsData,
        favoriteAgents: favAgents,
        insights: insightsData,
        activityByDay,
      });
    };
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, [role, isPrivileged, lang]);

  return <DashboardCtx.Provider value={data}>{children}</DashboardCtx.Provider>;
}

export default function DashboardPage() {
  return (
    <Chrome>
      <DashboardDataProvider>
        <DashboardContent />
        <AIFab />
      </DashboardDataProvider>
    </Chrome>
  );
}
