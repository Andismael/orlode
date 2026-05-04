import React, { useState, useRef, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  Search, Bell, ChevronDown, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, ArrowUp,
  LayoutDashboard, MessageSquare, MessageCircle, Bot, UsersRound, Briefcase, Calendar,
  Store, Crown, Hammer, Plug, Settings, Shield, LogOut, Plus, Minus, Sparkles, Brain, Send,
  Paperclip, Image, FileText, Hash, Pin, Star, Filter, MoreHorizontal, X, Copy,
  CheckCircle2, XCircle, AlertTriangle, Clock, Timer, Loader2, Zap, Flame,
  Code, Code2, Globe, Phone, Users2, User, BarChart3, TrendingUp, TrendingDown, Activity, Target,
  Edit3, Edit2, Trash2, Save, Download, Upload, Eye, EyeOff, Lock,
  PenTool, Pencil, Palette, Wand2, Layers, LayoutGrid, LayoutTemplate, Boxes,
  Rocket, Lightbulb, Smile, Heart, ShoppingBag, GraduationCap, Building, Building2,
  Stethoscope, Scale, Car, Scissors, HandHeart, Hotel, MapPin, Mail, AtSign,
  Tag, Bookmark, Share2, Cpu, Database, Cloud, Camera, Video, Music,
  Type, AlignLeft, Bold, Italic, Link2,
  Award, Banknote, Wallet, Coins, DollarSign, CreditCard,
  GitBranch, GitCommit, History, RefreshCw, RotateCcw,
  Beaker, Microscope, Play, PlayCircle, Pause,
  CheckCheck, BadgeCheck, Trophy, Medal, Gem,
  PackageCheck, PackageX, PackageOpen, Package,
  Headphones, Sliders, SlidersHorizontal, KeyRound, Bug, Wrench, Cog
} from 'lucide-react';

// ============ PALETTE — CRÉATEUR (violet créatif + magenta + or revenus) ============
const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  greenInk:    '#042A1F',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  // PRIMARY — violet créatif
  violet:      '#7C3AED',  // violet-600
  violetDeep:  '#5B21B6',  // violet-800
  violetDark:  '#4C1D95',  // violet-900
  violetSoft:  '#EDE9FE',  // violet-100
  violetLight: '#A78BFA',  // violet-400
  // ACCENT — magenta énergie
  pink:        '#EC4899',  // pink-500
  pinkDeep:    '#DB2777',  // pink-600
  pinkSoft:    '#FCE7F3',  // pink-100
  // OR — revenus, premium, succès
  gold:        '#D4A017',  // custom amber
  goldDeep:    '#B45309',  // amber-700
  goldLight:   '#F59E0B',  // amber-500
  goldSoft:    '#FEF3C7',  // amber-100
  // Semantic
  emerald:     '#10B981',
  emeraldSoft: '#D1FAE5',
  emeraldDeep: '#059669',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  blueDeep:    '#0284C7',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  redDeep:     '#DC2626',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  cyan:        '#06B6D4',
  cyanSoft:    '#CFFAFE',
  cyanDeep:    '#0891B2',
  orange:      '#F97316',
  orangeSoft:  '#FFEDD5',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

// Available emoji icons for agents
const AGENT_EMOJIS = ['🤖', '🏠', '💄', '👗', '🍽️', '🔧', '🏗️', '👷', '☕', '📊', '🎯', '💡', '🛒', '🎓', '🌍', '⚡', '🔬', '🎨', '🧮', '📦', '💼', '🚗', '✂️', '🎵', '🎬', '📱', '💎', '⚖️', '🏥', '🏨'];

// Fallback empty creator state (used when API is loading or creator has no agents yet)
const MY_AGENTS_FALLBACK: any[] = [];

// ============ CREATOR DATA CONTEXT ============
interface CreatorData {
  loading: boolean;
  agents: any[];
  earnings: { totalRevenue: number; creatorEarnings: number; commission: number; agents: any[] } | null;
  withdrawals: any[];
  fiscal: any;
  refresh: () => void;
}
const CreatorCtx = createContext<CreatorData>({
  loading: true, agents: [], earnings: null, withdrawals: [], fiscal: null, refresh: () => {},
});
const useCreator = () => useContext(CreatorCtx);

// Map server agent → UI shape
function mapServerAgent(a: any): any {
  const rel = (() => {
    const ts = a.createdAt?._seconds ?? a.createdAt?.seconds;
    if (!ts) return 'Récemment';
    const diff = Math.floor((Date.now() / 1000 - ts) / 86400);
    if (diff < 1) return "Aujourd'hui";
    if (diff < 2) return 'Hier';
    if (diff < 7) return `Il y a ${diff} jours`;
    if (diff < 30) return `Il y a ${Math.floor(diff / 7)} sem.`;
    return `Il y a ${Math.floor(diff / 30)} mois`;
  })();
  return {
    id: a.id ?? a.slug ?? '',
    name: a.name ?? 'Agent',
    emoji: a.icon ?? '🤖',
    desc: a.description ?? a.longDescription?.slice(0, 200) ?? '',
    status: a.status === 'approved' ? 'approved'
          : a.status === 'pending_review' ? 'pending'
          : a.status === 'rejected' ? 'rejected' : 'draft',
    installs: a.installs ?? 0,
    revenue: a.revenue ?? 0,
    price: (a.priceUSD ?? 0) * 600, // convert USD → FCFA
    pricingModel: a.pricingModel ?? 'monthly',
    rating: a.avgRating ?? a.rating ?? 0,
    reviews: a.reviewCount ?? a.reviews ?? 0,
    version: a.version ?? '1.0.0',
    industry: a.industry ?? '',
    category: a.category ?? '',
    color: a.color?.startsWith('from-') ? '#7C3AED' : (a.color ?? '#7C3AED'),
    createdAt: rel,
  };
}

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
    background: ${C.violet}; color: ${C.cream};
    box-shadow: 0 8px 24px -8px ${C.violet};
  }
  .nav-item.active::after {
    content: ''; position: absolute;
    right: 12px; top: 50%; transform: translateY(-50%);
    width: 6px; height: 6px; border-radius: 50%; background: ${C.gold};
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
    background: ${C.violet}; color: ${C.cream}; border-color: ${C.violet};
    transform: translateY(-1px);
  }

  .tab-btn {
    padding: 10px 18px; font-size: 14px; font-weight: 500;
    color: ${C.onGreenSoft}; cursor: pointer; border-radius: 10px;
    transition: all 0.2s ease; background: transparent; border: none;
    font-family: inherit;
  }
  .tab-btn:hover { color: ${C.cream}; }
  .tab-btn.active {
    background: ${C.violet}; color: ${C.cream};
    box-shadow: 0 4px 14px -4px ${C.violet};
  }

  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }

  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${C.emerald}; position: relative; flex-shrink: 0;
  }
  .live-dot::after {
    content: ''; position: absolute; inset: -4px;
    border-radius: 50%; background: ${C.emerald};
    opacity: 0.4; animation: pulse 1.8s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.6); opacity: 0; }
  }

  .row-card {
    background: ${C.cream}; border-radius: 16px;
    padding: 18px 20px; border: 1px solid rgba(10,42,32,0.06);
    transition: all 0.2s ease; cursor: pointer;
    display: flex; align-items: center; gap: 16px;
  }
  .row-card:hover {
    transform: translateX(4px); border-color: ${C.violet};
    box-shadow: 0 12px 24px -12px ${C.violet}40;
  }

  .icon-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: ${C.violetSoft}; color: ${C.violetDeep};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all 0.2s ease;
  }
  .icon-btn:hover { background: ${C.violetDeep}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.redSoft}; color: ${C.redDeep}; }
  .icon-btn.danger:hover { background: ${C.redDeep}; color: ${C.cream}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDeep}; }
  .icon-btn.gold:hover { background: ${C.gold}; color: ${C.cream}; }

  .btn-primary {
    background: linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.violet};
    font-family: inherit;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.violet};
  }

  .btn-gold {
    background: linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.gold};
    font-family: inherit;
  }
  .btn-gold:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.gold};
  }

  .btn-secondary {
    background: ${C.cream}; color: ${C.violetDeep};
    border: 1.5px solid rgba(10,42,32,0.1);
    padding: 11px 18px; border-radius: 12px;
    font-weight: 600; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease; font-family: inherit;
  }
  .btn-secondary:hover {
    background: ${C.violetDeep}; color: ${C.cream}; border-color: ${C.violetDeep};
  }

  .avatar {
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Fraunces', serif; font-weight: 700;
    color: ${C.cream}; flex-shrink: 0;
  }

  .progress-bar {
    height: 6px; border-radius: 3px;
    background: ${C.violetSoft}; overflow: hidden;
  }
  .progress-fill {
    height: 100%; border-radius: 3px;
    transition: width 0.4s ease;
  }

  .input-field {
    width: 100%; background: ${C.creamDeep};
    border: 1.5px solid rgba(10,42,32,0.08);
    border-radius: 12px; padding: 12px 16px;
    font-size: 14px; color: ${C.ink};
    font-family: inherit; outline: none;
    transition: all 0.2s ease;
  }
  .input-field:focus {
    border-color: ${C.violet};
    background: ${C.cream};
    box-shadow: 0 0 0 4px ${C.violet}15;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; }
  .stagger > *:nth-child(2) { animation-delay: 0.1s; }
  .stagger > *:nth-child(3) { animation-delay: 0.15s; }
  .stagger > *:nth-child(4) { animation-delay: 0.2s; }
  .stagger > *:nth-child(5) { animation-delay: 0.25s; }
  .stagger > *:nth-child(6) { animation-delay: 0.3s; }
  .stagger > *:nth-child(7) { animation-delay: 0.35s; }
  .stagger > *:nth-child(8) { animation-delay: 0.4s; }

  /* Step pulse animation for active wizard step */
  @keyframes stepPulse {
    0%, 100% { box-shadow: 0 0 0 0 ${C.violet}50; }
    50% { box-shadow: 0 0 0 8px transparent; }
  }
  .step-active { animation: stepPulse 2s ease-in-out infinite; }

  /* Sparkle floating animation */
  @keyframes sparkleFloat {
    0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.6; }
    25% { transform: translate(8px, -12px) rotate(90deg); opacity: 1; }
    50% { transform: translate(0, -20px) rotate(180deg); opacity: 0.8; }
    75% { transform: translate(-8px, -12px) rotate(270deg); opacity: 1; }
  }
  .sparkle-1 { animation: sparkleFloat 4s ease-in-out infinite; }
  .sparkle-2 { animation: sparkleFloat 5s ease-in-out infinite 1s; }
  .sparkle-3 { animation: sparkleFloat 6s ease-in-out infinite 2s; }

  /* Typing dots */
  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-6px); opacity: 1; }
  }
  .typing-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${C.violet};
    animation: typingBounce 1.4s ease-in-out infinite;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.15s; }
  .typing-dot:nth-child(3) { animation-delay: 0.3s; }

  /* Spinner */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spinner { animation: spin 1s linear infinite; }

  /* Coin bounce */
  @keyframes coinBounce {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(180deg); }
  }
  .coin-bounce { animation: coinBounce 2s ease-in-out infinite; }

  /* Trophy shine */
  @keyframes trophyShine {
    0%, 100% { filter: drop-shadow(0 0 8px ${C.gold}40); }
    50% { filter: drop-shadow(0 0 16px ${C.gold}80); }
  }
  .trophy-shine { animation: trophyShine 2s ease-in-out infinite; }

  /* ============ Creator section padding (responsive) ============ */
  .creator-section { padding: 24px 32px; }
  .creator-section-top { padding: 32px 32px 0; }
  .creator-section-mid { padding: 24px 32px 0; }
  .creator-section-bottom { padding: 24px 32px 32px; }

  /* ============ CREATOR SIDEBAR NAV ============ */
  .creator-shell {
    display: grid;
    grid-template-columns: 280px 1fr;
    min-height: 100vh;
    background: ${C.greenDeep};
  }
  .creator-sidebar {
    background: linear-gradient(180deg, ${C.greenInk} 0%, ${C.greenDark} 100%);
    border-right: 1px solid rgba(255,250,240,0.06);
    padding: 22px 18px;
    overflow-y: auto;
    height: 100vh;
    position: sticky; top: 0;
  }
  .creator-sidebar h2 {
    font-family: 'Fraunces', serif;
    font-size: 22px; font-weight: 800; color: ${C.cream};
    margin: 0 0 4px; letter-spacing: -0.02em;
  }
  .creator-sidebar .group-label {
    font-size: 9px; font-weight: 700; color: ${C.onGreenSoft};
    letter-spacing: 0.14em; padding: 0 8px; margin-bottom: 6px;
    margin-top: 18px;
  }
  .creator-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; margin: 2px 0;
    border-radius: 10px;
    color: ${C.onGreenSoft}; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.18s ease;
    background: transparent; border: none; width: 100%; text-align: left;
    font-family: inherit;
  }
  .creator-nav-item:hover { background: rgba(255,250,240,0.05); color: ${C.cream}; }
  .creator-nav-item.active {
    background: ${C.violet}; color: ${C.cream};
    box-shadow: 0 6px 16px -6px ${C.violet};
  }
  .creator-nav-item.active::before {
    content: ''; width: 5px; height: 5px; border-radius: 50%;
    background: ${C.gold}; flex-shrink: 0;
  }
  .creator-content {
    overflow-x: hidden;
    background: ${C.greenDeep};
  }
  .creator-mobile-bar {
    display: none;
    padding: 12px 16px;
    background: ${C.greenInk};
    border-bottom: 1px solid rgba(255,250,240,0.06);
    align-items: center; gap: 12px;
    position: sticky; top: 0; z-index: 90;
  }
  .creator-hamburger {
    width: 40px; height: 40px; border-radius: 10px;
    background: rgba(255,250,240,0.08); border: 1px solid rgba(255,250,240,0.1);
    color: ${C.cream}; display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0;
  }
  .creator-mobile-title {
    font-family: 'Fraunces', serif;
    font-size: 18px; font-weight: 700; color: ${C.cream};
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .creator-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  @media (max-width: 1280px) {
    .creator-shell { grid-template-columns: 240px 1fr; }
    .creator-section, .creator-section-bottom { padding-left: 26px; padding-right: 26px; }
    .creator-section-top, .creator-section-mid { padding-left: 26px; padding-right: 26px; }
  }

  @media (max-width: 1024px) {
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-grid-3 { grid-template-columns: 1fr !important; }
    .responsive-charts { grid-template-columns: 1fr !important; }
    .wizard-grid { grid-template-columns: 1fr !important; }
    .creator-shell { grid-template-columns: 220px 1fr; }
    .creator-section { padding: 20px !important; }
    .creator-section-top { padding: 22px 20px 0 !important; }
    .creator-section-mid { padding: 20px 20px 0 !important; }
    .creator-section-bottom { padding: 20px 20px 24px !important; }
  }

  @media (max-width: 768px) {
    .creator-shell { grid-template-columns: 1fr !important; }
    .creator-sidebar {
      position: fixed !important; left: 0; top: 0;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      z-index: 100;
      width: 280px; max-width: 85vw;
      height: 100vh;
    }
    .creator-sidebar.open { transform: translateX(0); }
    .creator-mobile-bar { display: flex !important; }
    .desktop-only { display: none !important; }
    .responsive-grid-4 { grid-template-columns: 1fr 1fr !important; }
    .hero-title { font-size: 32px !important; }
    .hide-on-mobile { display: none !important; }
    .creator-section, .creator-section-bottom { padding: 14px !important; }
    .creator-section-top { padding: 16px 14px 0 !important; }
    .creator-section-mid { padding: 14px 14px 0 !important; }
  }

  @media (max-width: 480px) {
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .hero-title { font-size: 26px !important; }
    .creator-section, .creator-section-bottom { padding: 10px !important; }
    .creator-section-top { padding: 12px 10px 0 !important; }
    .creator-section-mid { padding: 10px 10px 0 !important; }
  }
`;

// ============ NAV ITEMS (with icons) ============
const NAV_GROUPS: Array<{ label: string; items: Array<{ key: string; label: string; icon: any }> }> = [
  {
    label: 'PILOTAGE',
    items: [
      { key: 'Accueil',        label: 'Accueil',         icon: LayoutDashboard },
      { key: 'Mes agents',     label: 'Mes agents',      icon: Bot },
      { key: 'Analytics',      label: 'Analytics',       icon: BarChart3 },
      { key: 'Revenus',        label: 'Revenus',         icon: Banknote },
    ],
  },
  {
    label: 'CRÉATION',
    items: [
      { key: 'Créer un agent', label: 'Créer un agent',  icon: Sparkles },
      { key: 'Brouillons',     label: 'Brouillons',      icon: FileText },
      { key: 'Templates',      label: 'Templates',       icon: LayoutTemplate },
    ],
  },
  {
    label: 'PROMPT ENG',
    items: [
      { key: 'System Prompt',  label: 'System Prompt',   icon: Code2 },
      { key: 'Test Sandbox',   label: 'Test Sandbox',    icon: Beaker },
      { key: 'Versioning',     label: 'Versioning',      icon: GitBranch },
      { key: 'Connecteurs',    label: 'Connecteurs',     icon: Plug },
    ],
  },
  {
    label: 'PUBLICATION',
    items: [
      { key: 'Soumettre',          label: 'Soumettre',        icon: Upload },
      { key: 'Mes publications',   label: 'Mes publications', icon: PackageCheck },
      { key: 'Reviews',            label: 'Reviews',          icon: Star },
    ],
  },
];

// ============ SIDEBAR ============
function Sidebar({ active, setActive, open, onClose }: any) {
  return (
    <aside className={`creator-sidebar ${open ? 'open' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2>
          Portail <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Créateur</em>
        </h2>
        <button onClick={onClose} className="creator-hamburger" style={{ display: 'none', width: 32, height: 32 }} aria-label="Fermer le menu" data-mobile-close>
          <X size={16} />
        </button>
      </div>
      <p style={{ fontSize: 11, color: C.onGreenSoft, margin: '0 0 6px', fontWeight: 500 }}>
        Build · Publish · Earn
      </p>

      <nav style={{ marginTop: 8 }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="group-label">{group.label}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  className={`creator-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => { setActive(item.key); onClose && onClose(); }}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{
        marginTop: 24, padding: 14,
        background: 'rgba(124,58,237,0.12)',
        border: `1px solid ${C.violet}40`,
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Lightbulb size={14} color={C.gold} />
          <span style={{ fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: '0.08em' }}>ASTUCE</span>
        </div>
        <p style={{ fontSize: 11, color: C.cream, margin: 0, lineHeight: 1.4 }}>
          Une démo vidéo augmente les installs de 4× en moyenne.
        </p>
      </div>
    </aside>
  );
}

// ============ CHROME — sidebar layout + mobile drawer ============
function Chrome({ children, active, setActive }: any) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="creator-shell" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <Sidebar active={active} setActive={setActive} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {drawerOpen && (
        <div className="creator-overlay" onClick={() => setDrawerOpen(false)}></div>
      )}
      <main className="creator-content" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="creator-mobile-bar">
          <button className="creator-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Ouvrir le menu">
            <List size={18} />
          </button>
          <span className="creator-mobile-title">{active}</span>
        </div>
        {children}
      </main>
    </div>
  );
}

// ============ HERO HEADER ============
function PageHeader({ title, italic, subtitle, badge, actions, leftPills, onBack }) {
  return (
    <div className="creator-section-top">
      <div className="grain" style={{
        background: `linear-gradient(135deg, ${C.violetDeep} 0%, ${C.violet} 50%, ${C.pink} 100%)`,
        borderRadius: 24, padding: '32px 36px',
        position: 'relative', overflow: 'hidden',
        color: C.cream,
        boxShadow: `0 30px 60px -20px ${C.violet}80`,
      }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.15 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60" stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>

        {/* Sparkles floating */}
        <svg className="sparkle-1" style={{ position: 'absolute', top: 60, right: 280, opacity: 0.6 }} width="20" height="20" fill={C.cream}>
          <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z"/>
        </svg>
        <svg className="sparkle-2" style={{ position: 'absolute', top: 120, right: 50, opacity: 0.5 }} width="16" height="16" fill={C.cream}>
          <path d="M8 0 L10 6 L16 8 L10 10 L8 16 L6 10 L0 8 L6 6 Z"/>
        </svg>
        <svg className="sparkle-3" style={{ position: 'absolute', top: 30, right: 480, opacity: 0.5 }} width="14" height="14" fill={C.cream}>
          <path d="M7 0 L9 5 L14 7 L9 9 L7 14 L5 9 L0 7 L5 5 Z"/>
        </svg>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {onBack && (
              <button onClick={onBack} style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(255,250,240,0.15)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,250,240,0.25)',
                color: C.cream, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                {leftPills}
                {badge && (
                  <div className="pill" style={{ background: C.gold, color: C.cream }}>
                    <Hammer size={11} />
                    {badge}
                  </div>
                )}
              </div>
              <h1 className="display-font hero-title" style={{
                fontSize: 48, fontWeight: 800, lineHeight: 1.0, margin: 0,
                color: C.cream, letterSpacing: '-0.03em',
              }}>
                {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>{italic}</em>}
              </h1>
              {subtitle && (
                <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.85)', maxWidth: 600 }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      </div>
    </div>
  );
}

// ============ PAGE: ACCUEIL ============
function AccueilPage({ onTab }) {
  const { agents, earnings, loading } = useCreator();
  const published = agents.filter(a => a.status === 'approved').length;
  const drafts = agents.filter(a => a.status === 'draft').length;
  const totalInstalls = agents.reduce((s, a) => s + (a.installs ?? 0), 0);
  const installsThisMonth = totalInstalls; // server doesn't break down by month yet
  const totalRevenue = earnings?.creatorEarnings ?? 0;
  const totalReviews = agents.reduce((s, a) => s + (a.reviews ?? 0), 0);
  const avgRating = totalReviews > 0
    ? (agents.reduce((s, a) => s + (a.rating ?? 0) * (a.reviews ?? 0), 0) / totalReviews).toFixed(1)
    : '—';

  const stats = [
    { label: 'Agents publiés', value: String(published), sub: `${drafts} en brouillon`, color: C.violetDeep, bg: C.violetSoft, icon: Bot },
    { label: 'Installations totales', value: String(totalInstalls), sub: installsThisMonth > 0 ? `+${installsThisMonth} récents` : '—', color: C.blue, bg: C.blueSoft, icon: Download, trendUp: totalInstalls > 0 },
    { label: 'Revenus totaux', value: `${totalRevenue.toLocaleString('fr-FR')} F`, sub: 'FCFA · cumul', color: C.gold, bg: C.goldSoft, icon: Coins },
    { label: 'Note moyenne', value: String(avgRating), sub: `Sur ${totalReviews} reviews`, color: C.pink, bg: C.pinkSoft, icon: Star },
  ];

  const modules = [
    { name: 'Mes agents', desc: `${agents.length} agent${agents.length > 1 ? 's' : ''} · Performance`, icon: Bot, color: C.violet, page: 'Mes agents', badge: agents.length },
    { name: 'Créer un agent', desc: 'Wizard 6 étapes · IA assistée', icon: Sparkles, color: C.pink, page: 'Créer un agent', star: true },
    { name: 'Test Sandbox', desc: 'Tester en chat live', icon: Beaker, color: C.cyan, page: 'Test Sandbox' },
    { name: 'Analytics', desc: 'Installs · Funnel · Rétention', icon: BarChart3, color: C.blue, page: 'Analytics' },
    { name: 'Revenus', desc: 'FCFA · Mobile Money · Stripe', icon: Banknote, color: C.gold, page: 'Revenus' },
    { name: 'Templates', desc: 'Templates créateur', icon: LayoutTemplate, color: C.violet, page: 'Templates' },
    { name: 'System Prompt', desc: 'Éditeur avancé · Variables', icon: Code2, color: C.violetDeep, page: 'System Prompt' },
    { name: 'Versioning', desc: 'Historique · Rollback', icon: GitBranch, color: C.emerald, page: 'Versioning' },
  ];

  // Activity derived from agents (creation events only — reviews/installs need a dedicated audit log)
  const recentActivities = agents
    .slice(0, 4)
    .map((a, i) => {
      const isApproved = a.status === 'approved';
      const isRejected = a.status === 'rejected';
      const isPending = a.status === 'pending';
      return {
        type: 'agent',
        text: isApproved ? `${a.name} approuvé et publié`
            : isRejected ? `${a.name} a été rejeté — révisez et resoumettez`
            : isPending  ? `${a.name} en cours de review`
            :              `${a.name} créé en brouillon`,
        time: a.createdAt,
        icon: isApproved ? BadgeCheck : isRejected ? XCircle : isPending ? Clock : Edit3,
        color: isApproved ? C.emeraldDeep : isRejected ? C.redDeep : isPending ? C.gold : C.violet,
      };
    });
  // Always show at least one onboarding tip
  if (recentActivities.length < 4) {
    recentActivities.push({
      type: 'agent',
      text: 'Astuce : une démo vidéo augmente les installs de 4×',
      time: 'Conseil',
      icon: Lightbulb,
      color: C.gold,
    });
  }

  return (
    <>
      <PageHeader
        title="Portail"
        italic="Créateur."
        subtitle="Créez, publiez et monétisez vos agents IA · Marketplace mondial · Multi-devises"
        badge={`CRÉATEUR · ${published} AGENT${published !== 1 ? 'S' : ''} PUBLIÉ${published > 1 ? 'S' : ''}`}
        actions={
          <>
            <button onClick={() => onTab('Test Sandbox')} className="btn-secondary"><Beaker size={14} /> Tester un agent</button>
            <button onClick={() => onTab('Créer un agent')} className="btn-primary">
              <Sparkles size={16} fill={C.cream} /> Créer un agent
            </button>
          </>
        }
      />

      {/* Stats */}
      <div className="creator-section-mid">
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} style={{
                background: C.cream, borderRadius: 20,
                padding: 22, border: '1px solid rgba(10,42,32,0.06)',
                position: 'relative', overflow: 'hidden',
                transition: 'all 0.3s ease', cursor: 'pointer',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 20px 40px -20px rgba(10,42,32,0.15)`; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.color }}></div>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: stat.bg, color: stat.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                  boxShadow: `0 8px 16px -8px ${stat.color}40`,
                }}>
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span className="display-font" style={{
                    fontSize: 36, fontWeight: 800, color: C.ink,
                    letterSpacing: '-0.02em', lineHeight: 1,
                  }}>{stat.value}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
                  {stat.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hero CTA — boost agent visibility */}
      <div className="creator-section-mid">
        <div className="grain" style={{
          background: `linear-gradient(135deg, ${C.violetDeep}, ${C.pink})`,
          borderRadius: 20, padding: 28,
          color: C.cream, position: 'relative', overflow: 'hidden',
        }}>
          <Trophy className="trophy-shine" size={120} style={{
            position: 'absolute', right: 30, top: 20,
            opacity: 0.15, color: C.gold,
          }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 12px 24px -8px ${C.gold}`,
              flexShrink: 0,
            }}>
              <Gem size={32} color={C.cream} />
            </div>

            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.12em', marginBottom: 6 }}>
                ASTUCE CRÉATEUR · BOOST INSTALLS
              </div>
              <h3 className="display-font" style={{
                fontSize: 26, fontWeight: 700, color: C.cream,
                margin: '0 0 6px', letterSpacing: '-0.02em',
              }}>
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Top 5</em> = +400% installations
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.85)', margin: 0, lineHeight: 1.5 }}>
                Les agents avec démo vidéo, screenshots et 5+ reviews convertissent <strong style={{ color: C.gold }}>4× mieux</strong>.
                Ajoutez ces éléments à votre Agent Livraison pour le booster.
              </p>
            </div>

            <button style={{
              background: C.cream, color: C.violetDeep,
              padding: '12px 22px', borderRadius: 12,
              border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)',
              flexShrink: 0,
            }}>
              <Rocket size={14} /> Booster mon agent
            </button>
          </div>
        </div>
      </div>

      {/* Modules grid */}
      <div className="creator-section-top">
        <h3 className="display-font" style={{
          fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px',
          letterSpacing: '-0.02em',
        }}>
          Outils créateur <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 18 }}>— 8 modules</em>
        </h3>

        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {modules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} onClick={() => onTab && onTab(mod.page)} style={{
                background: C.cream, borderRadius: 18,
                padding: 22, border: '1px solid rgba(10,42,32,0.06)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = mod.color;
                e.currentTarget.style.boxShadow = `0 20px 40px -16px ${mod.color}40`;
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                {mod.badge && (
                  <div style={{
                    position: 'absolute', top: 16, right: 16,
                    background: mod.color, color: C.cream,
                    minWidth: 22, height: 22, padding: '0 7px',
                    borderRadius: 100, fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>{mod.badge}</div>
                )}

                {mod.star && (
                  <div style={{
                    position: 'absolute', top: 14, right: 14,
                    background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
                    color: C.cream,
                    padding: '3px 8px', borderRadius: 100,
                    fontSize: 9, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 3,
                    boxShadow: `0 4px 12px -4px ${C.gold}`,
                    letterSpacing: '0.05em',
                  }}>
                    ⭐ POPULAIRE
                  </div>
                )}

                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: `linear-gradient(135deg, ${mod.color} 0%, ${mod.color}cc 100%)`,
                  color: C.cream,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                  boxShadow: `0 12px 24px -8px ${mod.color}`,
                }}>
                  <Icon size={22} strokeWidth={1.75} />
                </div>

                <div className="display-font" style={{
                  fontSize: 18, fontWeight: 700, color: C.ink,
                  marginBottom: 4, letterSpacing: '-0.01em',
                }}>{mod.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>
                  {mod.desc}
                </div>

                <div style={{
                  marginTop: 12,
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, color: mod.color, fontWeight: 600,
                }}>
                  Ouvrir <ArrowRight size={13} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activities */}
      <div style={{ padding: '32px 32px 32px' }}>
        <h3 className="display-font" style={{
          fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px',
          letterSpacing: '-0.02em',
        }}>
          Activité récente <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 18 }}>— créateur</em>
        </h3>

        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recentActivities.map((act, idx) => {
            const Icon = act.icon;
            return (
              <div key={idx} className="row-card" style={{ borderLeft: `4px solid ${act.color}` }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: `${act.color}15`,
                  color: act.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                    {act.text}
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
                    <Clock size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    {act.time}
                  </div>
                </div>

                <button className="icon-btn"><Eye size={13} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE: MES AGENTS ============
function MesAgentsPage({ onTab }) {
  const { agents, loading, refresh } = useCreator();
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'draft' | 'rejected'>('all');
  const statusStyles: any = {
    approved: { bg: C.emeraldSoft, color: C.emeraldDeep, label: 'Approuvé', icon: BadgeCheck },
    pending: { bg: C.goldSoft, color: C.goldDeep, label: 'En review', icon: Clock },
    draft: { bg: C.violetSoft, color: C.violet, label: 'Brouillon', icon: Edit3 },
    rejected: { bg: C.redSoft, color: C.redDeep, label: 'Rejeté', icon: XCircle },
  };

  const counts = {
    approved: agents.filter(a => a.status === 'approved').length,
    pending: agents.filter(a => a.status === 'pending').length,
    draft: agents.filter(a => a.status === 'draft').length,
    rejected: agents.filter(a => a.status === 'rejected').length,
  };

  const filtered = filter === 'all' ? agents : agents.filter(a => a.status === filter);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Supprimer "${name}" ?`)) return;
    try {
      await api.delete(`/creator/agents/${id}`);
      toast.success('Agent supprimé');
      refresh();
    } catch (e: any) {
      toast.error('Échec de la suppression', e?.response?.data?.message ?? '');
    }
  };

  const filterOptions = [
    { id: 'all',      label: 'Tous',       count: agents.length },
    { id: 'approved', label: 'Publiés',    count: counts.approved },
    { id: 'pending',  label: 'En review',  count: counts.pending },
    { id: 'draft',    label: 'Brouillons', count: counts.draft },
    { id: 'rejected', label: 'Rejetés',    count: counts.rejected },
  ] as const;

  return (
    <>
      <PageHeader
        title="Mes agents,"
        italic="portfolio créateur."
        subtitle="Liste de vos agents IA · Statut · Performance · Versioning · Quick actions"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <Bot size={11} /> {counts.approved} PUBLIÉ · {counts.pending} EN REVIEW · {counts.draft} BROUILLON
          </div>
        }
        actions={
          <button onClick={() => onTab('Créer un agent')} className="btn-primary">
            <Plus size={16} /> Nouveau agent
          </button>
        }
      />

      {/* Filters */}
      <div className="creator-section-mid">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', gap: 4,
            background: C.cream, padding: 4, borderRadius: 12,
            border: '1px solid rgba(10,42,32,0.06)',
            flexWrap: 'wrap',
          }}>
            {filterOptions.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as any)} style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', borderRadius: 8,
                background: filter === f.id ? C.violet : 'transparent',
                color: filter === f.id ? C.cream : C.inkSoft,
                border: 'none', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                {f.label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: filter === f.id ? 'rgba(255,255,255,0.2)' : C.creamDeep,
                  color: filter === f.id ? C.cream : C.inkSoft,
                  padding: '1px 6px', borderRadius: 100,
                }}>{f.count}</span>
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={refresh} className="icon-btn" title="Actualiser"><RefreshCw size={13} /></button>
          </div>
        </div>
      </div>

      {/* Agents list */}
      <div className="creator-section-bottom">
        {loading && agents.length === 0 && (
          <div style={{
            background: C.cream, borderRadius: 18, padding: 40,
            textAlign: 'center', color: C.inkSoft, fontSize: 13,
            border: '1px solid rgba(10,42,32,0.06)',
          }}>
            <Loader2 size={28} className="spin" style={{ marginBottom: 10, opacity: 0.5 }} />
            <div>Chargement de vos agents…</div>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{
            background: C.cream, borderRadius: 18, padding: 60,
            textAlign: 'center', color: C.inkSoft,
            border: '1px dashed rgba(10,42,32,0.12)',
          }}>
            <Bot size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
              {filter === 'all' ? 'Aucun agent encore' : 'Aucun agent dans cette catégorie'}
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 18px' }}>
              {filter === 'all'
                ? 'Créez votre premier agent IA et commencez à monétiser sur le marketplace.'
                : 'Essayez un autre filtre ou créez un nouvel agent.'}
            </p>
            {filter === 'all' && (
              <button onClick={() => onTab('Créer un agent')} className="btn-primary">
                <Plus size={14} /> Créer mon premier agent
              </button>
            )}
          </div>
        )}
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((agent: any, idx: number) => {
            const status = statusStyles[agent.status] ?? statusStyles.draft;
            const StatusIcon = status.icon;
            return (
              <div key={agent.id ?? idx} style={{
                background: C.cream, borderRadius: 18,
                padding: 22, border: '1px solid rgba(10,42,32,0.06)',
                borderLeft: `4px solid ${agent.color}`,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = `0 12px 24px -12px ${agent.color}40`; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {/* Big emoji avatar */}
                  <div style={{
                    width: 64, height: 64, borderRadius: 16,
                    background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`,
                    color: C.cream,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32,
                    flexShrink: 0,
                    boxShadow: `0 12px 24px -8px ${agent.color}`,
                  }}>
                    {agent.emoji}
                  </div>

                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>
                        {agent.name}
                      </span>
                      <div className="pill" style={{ background: status.bg, color: status.color }}>
                        <StatusIcon size={11} /> {status.label}
                      </div>
                      <span className="mono-font pill" style={{ background: C.violetSoft, color: C.violetDeep, fontSize: 10 }}>
                        v{agent.version}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 10px', lineHeight: 1.4 }}>
                      {agent.desc}
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
                      <span><Tag size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> {agent.industry}</span>
                      <span><Layers size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> {agent.category}</span>
                      <span><Calendar size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> {agent.createdAt}</span>
                    </div>
                  </div>

                  {/* Stats inline */}
                  <div style={{ display: 'flex', gap: 16 }}>
                    {[
                      { label: 'INSTALLS', value: agent.installs, icon: Download, color: C.blue },
                      { label: 'REVENUS', value: `${agent.revenue} F`, icon: Coins, color: C.gold },
                      { label: 'NOTE', value: agent.rating || '—', icon: Star, color: C.pink },
                    ].map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <div key={i} style={{ textAlign: 'center', minWidth: 60 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: `${s.color}15`, color: s.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 4px',
                          }}>
                            <Icon size={13} />
                          </div>
                          <div className="mono-font display-font" style={{ fontSize: 16, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                            {s.value}
                          </div>
                          <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, letterSpacing: '0.05em' }}>{s.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onTab('Créer un agent')} className="icon-btn" title="Modifier"><Edit3 size={13} /></button>
                    <button onClick={() => onTab('Test Sandbox')} className="icon-btn" title="Tester"><Beaker size={13} /></button>
                    <button onClick={() => onTab('Analytics')} className="icon-btn gold" title="Stats"><BarChart3 size={13} /></button>
                    <button onClick={() => handleDelete(agent.id, agent.name)} className="icon-btn danger" title="Supprimer"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Pricing badge */}
                <div style={{
                  marginTop: 14, paddingTop: 14,
                  borderTop: '1px solid rgba(10,42,32,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Banknote size={14} color={C.gold} />
                    <span className="mono-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                      {agent.price.toLocaleString('fr-FR')} FCFA
                    </span>
                    <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
                      / mois · Abonnement
                    </span>
                    {agent.status === 'approved' && (
                      <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep, marginLeft: 8 }}>
                        <BadgeCheck size={10} /> Live sur Marketplace
                      </span>
                    )}
                  </div>
                  <button onClick={() => onTab('Test Sandbox')} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}>
                    <PlayCircle size={12} /> Tester live
                  </button>
                </div>
              </div>
            );
          })}

          {/* Empty state placeholder for new agent */}
          <div onClick={() => onTab('Créer un agent')} style={{
            border: `2px dashed ${C.violet}40`,
            borderRadius: 18, padding: 28,
            textAlign: 'center', cursor: 'pointer',
            background: 'rgba(124, 58, 237, 0.04)',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => { e.currentTarget.style.background = `${C.violet}10`; e.currentTarget.style.borderColor = C.violet; }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(124, 58, 237, 0.04)'; e.currentTarget.style.borderColor = `${C.violet}40`; }}
          >
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: `0 12px 24px -8px ${C.violet}`,
            }}>
              <Plus size={28} strokeWidth={2.5} />
            </div>
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
              Créer un nouvel agent
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>
              Wizard 6 étapes · Test sandbox inclus · Publication marketplace
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============ PAGE: ANALYTICS ============
function AnalyticsPage() {
  const { agents, loading } = useCreator();
  const totalInstalls = agents.reduce((s, a) => s + (a.installs ?? 0), 0);
  const totalReviews = agents.reduce((s, a) => s + (a.reviews ?? 0), 0);
  const totalRated = agents.reduce((s, a) => s + (a.rating ?? 0) * (a.reviews ?? 0), 0);
  const avgRating = totalReviews > 0 ? (totalRated / totalReviews).toFixed(1) : '—';
  const publishedAgents = agents.filter(a => a.status === 'approved');
  const hasData = totalInstalls > 0 || totalReviews > 0;

  return (
    <>
      <PageHeader
        title="Analytics,"
        italic="performance créateur."
        subtitle="Installations · Notes · Performance · Tendances"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <BarChart3 size={11} /> {publishedAgents.length} AGENT{publishedAgents.length > 1 ? 'S' : ''} PUBLIÉ{publishedAgents.length > 1 ? 'S' : ''}
          </div>
        }
      />

      {/* KPIs */}
      <div className="creator-section-mid">
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Installations totales', value: String(totalInstalls), sub: 'Tous agents', color: C.violet, bg: C.violetSoft, icon: Download },
            { label: 'Reviews', value: String(totalReviews), sub: 'Tous agents', color: C.pink, bg: C.pinkSoft, icon: MessageCircle },
            { label: 'Note moyenne', value: String(avgRating), sub: totalReviews > 0 ? 'Pondérée' : 'Aucune review', color: C.gold, bg: C.goldSoft, icon: Star },
            { label: 'Agents actifs', value: String(publishedAgents.length), sub: 'Sur le marketplace', color: C.emeraldDeep, bg: C.emeraldSoft, icon: BadgeCheck },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} style={{
                background: C.cream, borderRadius: 18,
                padding: 20, border: '1px solid rgba(10,42,32,0.06)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.color }}></div>
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: stat.bg, color: stat.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="display-font" style={{
                  fontSize: 30, fontWeight: 800, color: C.ink,
                  letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4,
                }}>{stat.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{stat.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-agent breakdown */}
      <div className="creator-section-mid">
        <div style={{
          background: C.cream, borderRadius: 20, padding: 24,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Performance <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>par agent</em>
          </h3>

          {agents.length === 0 ? (
            <div style={{
              padding: 40, textAlign: 'center', color: C.inkSoft,
              fontSize: 13, border: '1px dashed rgba(10,42,32,0.12)',
              borderRadius: 12,
            }}>
              <Bot size={36} style={{ opacity: 0.3, marginBottom: 10, color: C.inkLight }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Aucun agent encore</div>
              <div>Créez et publiez votre premier agent pour voir vos analytics.</div>
            </div>
          ) : !hasData ? (
            <div style={{
              padding: 40, textAlign: 'center', color: C.inkSoft,
              fontSize: 13, border: '1px dashed rgba(10,42,32,0.12)',
              borderRadius: 12,
            }}>
              <BarChart3 size={36} style={{ opacity: 0.3, marginBottom: 10, color: C.inkLight }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Pas encore de data</div>
              <div>Vos analytics apparaîtront ici dès la première installation ou review.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agents.map((a: any) => (
                <div key={a.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr repeat(3, 80px)',
                  gap: 14, alignItems: 'center',
                  padding: '12px 14px', borderRadius: 10, background: C.creamDeep,
                }}>
                  <div style={{ fontSize: 24 }}>{a.emoji}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>{a.industry || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="mono-font" style={{ fontSize: 16, fontWeight: 800, color: C.violet, lineHeight: 1 }}>{a.installs ?? 0}</div>
                    <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>INSTALLS</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="mono-font" style={{ fontSize: 16, fontWeight: 800, color: C.gold, lineHeight: 1 }}>{a.rating ? a.rating.toFixed(1) : '—'}</div>
                    <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>NOTE</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="mono-font" style={{ fontSize: 16, fontWeight: 800, color: C.pink, lineHeight: 1 }}>{a.reviews ?? 0}</div>
                    <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>REVIEWS</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="creator-section-bottom">
        <div style={{
          background: 'rgba(124,58,237,0.06)',
          border: `1px solid ${C.violet}30`,
          borderRadius: 14, padding: 16,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          fontSize: 12, color: C.inkSoft,
        }}>
          <Lightbulb size={16} color={C.violet} />
          <span>
            <strong style={{ color: C.ink }}>Analytics avancées</strong> — funnel, rétention, géographie, cohortes : à venir prochainement.
          </span>
        </div>
      </div>
    </>
  );
}

// ============ PAGE: REVENUS ============
// ============ HELPERS ============
const fmtFCFA = (n: number) => n.toLocaleString('fr-FR').replace(/,/g, ' ');

// ============ MODAL — RETRAIT 3 ÉTAPES ============
function WithdrawalModal({ onClose, available, onConfirmed }: any) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('orange_money');
  const [phone, setPhone] = useState('+225 07 ');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  const num = Number(amount) || 0;
  const mobileMoney = ['orange_money', 'wave', 'mtn', 'moov'];
  const p2p = ['zelle', 'venmo', 'cashapp'];
  const isP2P = p2p.includes(method);
  const isPayPal = method === 'paypal';
  const fees = isPayPal
    ? Math.max(Math.round(num * 0.039) + 200, 0)
    : isP2P
      ? Math.max(Math.round(num * 0.015), 0)
      : (num >= 50000 ? Math.min(Math.round(num * 0.01), 5000) : 0);
  const netAmount = num - fees;
  const minOk = num >= 5000;
  const balanceOk = num <= available;

  React.useEffect(() => {
    if (step === 3 && resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [step, resendTimer]);

  const methods = [
    { id: 'orange_money', name: 'Orange Money', emoji: '🟠', delay: 'Instantané', region: 'Afrique', color: C.orange ?? '#F97316' },
    { id: 'wave', name: 'Wave', emoji: '🌊', delay: 'Instantané', region: 'Afrique', color: C.cyan ?? '#06B6D4' },
    { id: 'mtn', name: 'MTN Money', emoji: '🟡', delay: 'Instantané', region: 'Afrique', color: C.gold },
    { id: 'moov', name: 'Moov Money', emoji: '🔵', delay: 'Instantané', region: 'Afrique', color: '#1D4ED8' },
    { id: 'paypal', name: 'PayPal', emoji: '💙', delay: '24h', region: 'Mondial', color: '#003087' },
    { id: 'zelle', name: 'Zelle', emoji: '💜', delay: 'Instantané', region: 'USA', color: '#6D1ED4' },
    { id: 'venmo', name: 'Venmo', emoji: '🩵', delay: 'Instantané', region: 'USA', color: '#3D95CE' },
    { id: 'cashapp', name: 'Cash App', emoji: '💚', delay: 'Instantané', region: 'USA', color: '#00D632' },
  ];

  const submit = async () => {
    if (submitting) return;
    if (!otp.every(d => d.length === 1)) return;
    setSubmitting(true);
    try {
      await api.post('/creator/withdrawals/confirm', {
        amount: num, method, recipientPhone: phone, otp: otp.join(''),
      });
      toast.success('Retrait confirmé', `${num.toLocaleString('fr-FR')} FCFA en route`);
      setStep(4);
      if (onConfirmed) onConfirmed();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Code OTP invalide ou expiré';
      toast.error('Échec de la confirmation', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const initiate = async () => {
    if (submitting) return;
    if (!minOk || !balanceOk) return;
    setSubmitting(true);
    try {
      await api.post('/creator/withdrawals/initiate', { amount: num, method, recipientPhone: phone });
      toast.success('Code OTP envoyé', 'Vérifiez votre téléphone ou email');
      setStep(3);
      setResendTimer(60);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Impossible d\'initier le retrait';
      toast.error('Échec', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const updateOtp = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = clean; setOtp(next);
    if (clean && i < 5) {
      const el = document.getElementById(`otp-${i + 1}`); if (el) (el as HTMLInputElement).focus();
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(10,42,32,0.6)', backdropFilter: 'blur(8px)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.cream, borderRadius: 24, width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflow: 'auto', padding: 28, position: 'relative',
        boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 10,
          background: C.creamDeep, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><X size={18} color={C.ink} /></button>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: step >= n ? C.gold : 'rgba(10,42,32,0.1)',
              transition: 'all 0.3s ease',
            }}/>
          ))}
        </div>

        {step === 1 && (<>
          <h3 className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 6px' }}>
            Retirer <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>mes gains</em>
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 20px' }}>
            Solde disponible : <strong className="mono-font" style={{ color: C.gold }}>{fmtFCFA(available)} FCFA</strong>
          </p>

          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>MONTANT (FCFA)</label>
          <input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} style={{
            width: '100%', background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.1)',
            borderRadius: 12, padding: '14px 16px', fontSize: 22, fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700, color: C.ink, marginTop: 6, outline: 'none',
          }} />

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {[0.25, 0.5, 0.75, 1].map(p => (
              <button key={p} onClick={() => setAmount(String(Math.floor(available * p)))} style={{
                flex: 1, padding: '8px 4px', background: C.creamDeep, border: '1px solid rgba(10,42,32,0.08)',
                borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.ink, cursor: 'pointer', fontFamily: 'inherit',
              }}>{p === 1 ? '100%' : `${p * 100}%`}</button>
            ))}
          </div>

          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 18, display: 'block' }}>MÉTHODE DE RETRAIT</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
            {methods.map(m => (
              <button key={m.id} onClick={() => setMethod(m.id)} style={{
                padding: 12, borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                background: method === m.id ? `${m.color}15` : C.creamDeep,
                border: method === m.id ? `2px solid ${m.color}` : '2px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 22 }}>{m.emoji}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: m.color, background: `${m.color}15`, padding: '2px 6px', borderRadius: 100 }}>{m.region}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{m.name}</div>
                <div style={{ fontSize: 10, color: C.inkSoft, marginTop: 2 }}>{m.delay}</div>
              </button>
            ))}
          </div>

          {mobileMoney.includes(method) && (
            <>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 18, display: 'block' }}>NUMÉRO MOBILE MONEY</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+225 07 XX XX XX XX" style={{
                width: '100%', background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.1)',
                borderRadius: 12, padding: '12px 16px', fontSize: 14, fontFamily: 'JetBrains Mono, monospace',
                color: C.ink, marginTop: 6, outline: 'none',
              }} />
            </>
          )}
          {isPayPal && (
            <>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 18, display: 'block' }}>EMAIL PAYPAL</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="vous@email.com" type="email" style={{
                width: '100%', background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.1)',
                borderRadius: 12, padding: '12px 16px', fontSize: 14, color: C.ink, marginTop: 6, outline: 'none', fontFamily: 'inherit',
              }} />
            </>
          )}
          {(method === 'zelle') && (
            <>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 18, display: 'block' }}>EMAIL OU TÉLÉPHONE ZELLE</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (XXX) XXX-XXXX ou email" style={{
                width: '100%', background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.1)',
                borderRadius: 12, padding: '12px 16px', fontSize: 14, color: C.ink, marginTop: 6, outline: 'none', fontFamily: 'inherit',
              }} />
            </>
          )}
          {method === 'venmo' && (
            <>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 18, display: 'block' }}>USERNAME VENMO</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="@votre-username" style={{
                width: '100%', background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.1)',
                borderRadius: 12, padding: '12px 16px', fontSize: 14, fontFamily: 'JetBrains Mono, monospace',
                color: C.ink, marginTop: 6, outline: 'none',
              }} />
            </>
          )}
          {method === 'cashapp' && (
            <>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginTop: 18, display: 'block' }}>$CASHTAG</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="$votreCashtag" style={{
                width: '100%', background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.1)',
                borderRadius: 12, padding: '12px 16px', fontSize: 14, fontFamily: 'JetBrains Mono, monospace',
                color: C.ink, marginTop: 6, outline: 'none',
              }} />
            </>
          )}

          {/* Récap */}
          <div style={{ marginTop: 18, padding: 14, background: C.goldSoft, borderRadius: 12, border: `1px solid ${C.gold}40` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: C.inkSoft }}>Frais</span>
              <span className="mono-font" style={{ fontWeight: 700, color: fees === 0 ? C.emeraldDeep : C.ink }}>
                {fees === 0 ? 'Gratuit' : `${fmtFCFA(fees)} FCFA`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 6, borderTop: `1px dashed ${C.gold}60` }}>
              <span style={{ color: C.ink, fontWeight: 700 }}>Vous recevrez</span>
              <span className="mono-font" style={{ fontWeight: 800, color: C.goldDeep, fontSize: 16 }}>
                {fmtFCFA(Math.max(netAmount, 0))} FCFA
              </span>
            </div>
          </div>

          {!minOk && num > 0 && (
            <div style={{ marginTop: 10, padding: 10, background: C.redSoft, borderRadius: 10, fontSize: 12, color: C.red }}>
              ⚠ Minimum de retrait : 5 000 FCFA
            </div>
          )}
          {!balanceOk && (
            <div style={{ marginTop: 10, padding: 10, background: C.redSoft, borderRadius: 10, fontSize: 12, color: C.red }}>
              ⚠ Solde insuffisant
            </div>
          )}

          <button disabled={!minOk || !balanceOk} onClick={() => setStep(2)} style={{
            width: '100%', marginTop: 18, padding: 14, borderRadius: 12,
            background: (!minOk || !balanceOk) ? 'rgba(10,42,32,0.15)' : `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
            color: C.cream, border: 'none', fontWeight: 700, fontSize: 14, cursor: (!minOk || !balanceOk) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>Continuer <ArrowRight size={16} /></button>
        </>)}

        {step === 2 && (<>
          <h3 className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 6px' }}>
            Confirmation <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>du retrait</em>
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 20px' }}>Vérifiez les informations avant de valider</p>

          <div style={{ background: C.creamDeep, borderRadius: 14, padding: 18 }}>
            {[
              ['Montant brut', `${fmtFCFA(num)} FCFA`],
              ['Frais', fees === 0 ? 'Gratuit' : `${fmtFCFA(fees)} FCFA`],
              ['Méthode', methods.find(m => m.id === method)?.name],
              ['Numéro / Compte', phone || '—'],
              ['Délai estimé', methods.find(m => m.id === method)?.delay],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px dashed rgba(10,42,32,0.1)' : 'none', fontSize: 13 }}>
                <span style={{ color: C.inkSoft }}>{k}</span>
                <span className="mono-font" style={{ color: C.ink, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: 6, borderTop: `2px solid ${C.gold}40`, fontSize: 16 }}>
              <span style={{ color: C.ink, fontWeight: 700 }}>Net à recevoir</span>
              <span className="mono-font" style={{ color: C.goldDeep, fontWeight: 800, fontSize: 20 }}>{fmtFCFA(netAmount)} FCFA</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={() => setStep(1)} style={{
              flex: 1, padding: 14, borderRadius: 12, background: C.creamDeep, color: C.ink,
              border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}><ArrowLeft size={14} style={{ marginRight: 6 }} />Modifier</button>
            <button disabled={submitting} onClick={initiate} style={{
              flex: 2, padding: 14, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
              color: C.cream, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>{submitting ? 'Envoi…' : 'Confirmer le retrait'}</button>
          </div>
        </>)}

        {step === 3 && (<>
          <h3 className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 6px' }}>
            Code <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>de sécurité</em>
          </h3>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 20px' }}>
            Code envoyé par SMS au <strong style={{ color: C.ink }}>{phone}</strong>
          </p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            {otp.map((d, i) => (
              <input key={i} id={`otp-${i}`} value={d} onChange={e => updateOtp(i, e.target.value)} maxLength={1} style={{
                width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace', color: C.ink,
                background: C.creamDeep, border: `1.5px solid ${d ? C.gold : 'rgba(10,42,32,0.1)'}`,
                borderRadius: 12, outline: 'none',
              }} />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: C.inkSoft }}>
            {resendTimer > 0
              ? <>Renvoyer le code dans <span className="mono-font" style={{ color: C.gold, fontWeight: 700 }}>{resendTimer}s</span></>
              : <button onClick={() => setResendTimer(60)} style={{ background: 'transparent', border: 'none', color: C.violet, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Renvoyer le code</button>}
          </div>

          <button disabled={submitting || !otp.every(d => d.length === 1)} onClick={submit} style={{
            width: '100%', marginTop: 20, padding: 14, borderRadius: 12,
            background: otp.every(d => d.length === 1) ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})` : 'rgba(10,42,32,0.15)',
            color: C.cream, border: 'none', fontWeight: 700, fontSize: 14,
            cursor: otp.every(d => d.length === 1) ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
          }}>{submitting ? 'Vérification…' : 'Valider le retrait'}</button>
        </>)}

        {step === 4 && (<>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
              background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 16px 32px -8px ${C.emerald}`,
            }}>
              <CheckCircle2 size={44} color={C.cream} />
            </div>
            <h3 className="display-font" style={{ fontSize: 26, fontWeight: 800, color: C.ink, margin: '0 0 6px' }}>
              Retrait <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.emeraldDeep }}>initié</em>
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              <strong className="mono-font" style={{ color: C.gold }}>{fmtFCFA(netAmount)} FCFA</strong> arriveront sur {methods.find(m => m.id === method)?.name} dans {methods.find(m => m.id === method)?.delay.toLowerCase()}.
            </p>
            <div style={{ background: C.creamDeep, padding: 12, borderRadius: 10, fontSize: 11, color: C.inkSoft, fontFamily: 'JetBrains Mono, monospace', marginBottom: 20 }}>
              REF · WD-{Date.now().toString(36).toUpperCase()}
            </div>
            <button onClick={onClose} style={{
              padding: '12px 28px', borderRadius: 12,
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
              color: C.cream, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>Fermer</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ============ REVENUS — VUE D'ENSEMBLE (sub-page 1) ============
function RevenusOverview({ openWithdrawal, monthlyRevenue, available }: any) {
  const { earnings, agents } = useCreator();
  const maxRev = Math.max(...monthlyRevenue, 50000);
  // Build top agents from agents earnings sorted by revenue desc
  const breakdown: any[] = earnings?.agents ?? [];
  const topAgents = breakdown
    .map((b: any) => {
      const ag = agents.find((a: any) => a.id === b.agentId) ?? {};
      return {
        emoji: ag.emoji ?? '🤖',
        name: ag.name ?? b.name ?? 'Agent',
        revenue: (b.revenue ?? 0) * 600, // USD → FCFA
      };
    })
    .filter(a => a.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((a, _i, arr) => ({ ...a, pct: arr[0] ? Math.round((a.revenue / arr[0].revenue) * 100) : 0 }));

  return (
    <>
      {/* Hero earnings card */}
      <div className="creator-section-mid">
        <div className="grain" style={{
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
          borderRadius: 20, padding: 28, color: C.cream, position: 'relative', overflow: 'hidden',
        }}>
          <Coins className="coin-bounce" size={140} style={{ position: 'absolute', right: 30, top: 20, opacity: 0.18, color: C.cream }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(255,250,240,0.15)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,250,240,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Wallet size={36} color={C.cream} />
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, letterSpacing: '0.12em', marginBottom: 6 }}>SOLDE DISPONIBLE</div>
              <h3 className="display-font" style={{ fontSize: 44, fontWeight: 800, color: C.cream, margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1 }}>
                <span className="mono-font">{fmtFCFA(available)}</span> <em style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 28 }}>FCFA</em>
              </h3>
              <p style={{ fontSize: 13, opacity: 0.9, margin: 0 }}>
                Auto-versement le <strong>1er mai 2026</strong> · Orange Money primaire
              </p>
            </div>
            <button onClick={openWithdrawal} style={{
              background: C.cream, color: C.goldDeep, padding: '14px 24px', borderRadius: 14,
              border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
              boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
            }}><Wallet size={14} /> Retirer maintenant</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="creator-section-mid">
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Revenus bruts', value: `${fmtFCFA(85000)} F`, sub: 'Tous abonnements', color: C.gold, bg: C.goldSoft, icon: Coins },
            { label: 'Commission Orlode', value: `${fmtFCFA(21250)} F`, sub: '25% prélevés', color: C.violet, bg: C.violetSoft, icon: Hammer },
            { label: 'Net créateur', value: `${fmtFCFA(63750)} F`, sub: 'Vous touchez', color: C.emeraldDeep, bg: C.emeraldSoft, icon: BadgeCheck },
            { label: 'MRR (récurrent)', value: `${fmtFCFA(45000)} F`, sub: 'Monthly Recurring', color: C.pink, bg: C.pinkSoft, icon: TrendingUp },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.color }}></div>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="display-font mono-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>{stat.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{stat.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart + Methods */}
      <div className="responsive-charts" style={{ padding: '24px 32px 0', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
            Revenus mensuels <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>FCFA</em>
          </h3>
          <div style={{ position: 'relative', height: 220, padding: '10px 0' }}>
            <svg width="100%" height="100%" viewBox="0 0 600 220" preserveAspectRatio="none">
              <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.gold} stopOpacity="0.3" />
                <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
              </linearGradient></defs>
              <path d={(() => {
                const pts = monthlyRevenue.map((v: number, i: number) => `${i === 0 ? 'M' : 'L'} ${i * 50 + 25} ${200 - (v / maxRev) * 170}`);
                return pts.join(' ') + ` L ${11 * 50 + 25} 200 L 25 200 Z`;
              })()} fill="url(#revGrad)" />
              <path d={monthlyRevenue.map((v: number, i: number) => `${i === 0 ? 'M' : 'L'} ${i * 50 + 25} ${200 - (v / maxRev) * 170}`).join(' ')} fill="none" stroke={C.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {monthlyRevenue.map((v: number, i: number) => v > 0 ? (
                <circle key={i} cx={i * 50 + 25} cy={200 - (v / maxRev) * 170} r="4" fill={C.gold} stroke={C.cream} strokeWidth="2" />
              ) : null)}
              {monthlyRevenue.map((_: any, i: number) => (
                <text key={i} x={i * 50 + 25} y="215" fontSize="9" fill={C.inkSoft} textAnchor="middle" fontFamily="JetBrains Mono">
                  {['M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D', 'J', 'F'][i]}
                </text>
              ))}
            </svg>
          </div>
        </div>

        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Méthodes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>de versement</em>
          </h3>
          {[
            { icon: '🟠', name: 'Orange Money', desc: '+225 07 XX XX XX', primary: true, color: '#F97316', section: '🌍 Mobile Money · Afrique' },
            { icon: '🌊', name: 'Wave', desc: 'Non configuré', primary: false, color: C.cyan ?? '#06B6D4' },
            { icon: '🟡', name: 'MTN Money', desc: 'Non configuré', primary: false, color: C.gold },
            { icon: '🔵', name: 'Moov Money', desc: 'Non configuré', primary: false, color: '#1D4ED8' },
            { icon: '💙', name: 'PayPal', desc: 'Mondial', primary: false, color: '#003087', section: '💙 PayPal · Mondial' },
            { icon: '💜', name: 'Zelle', desc: 'Email ou téléphone', primary: false, color: '#6D1ED4', section: '🇺🇸 P2P · USA' },
            { icon: '🩵', name: 'Venmo', desc: 'Username', primary: false, color: '#3D95CE' },
            { icon: '💚', name: 'Cash App', desc: '$cashtag', primary: false, color: '#00D632' },
          ].map((m: any, i) => (
            <React.Fragment key={i}>
              {m.section && (
                <div style={{ fontSize: 9, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.1em', marginTop: i === 0 ? 0 : 12, marginBottom: 6 }}>{m.section}</div>
              )}
              <div style={{ padding: 12, borderRadius: 12, background: m.primary ? `${m.color}10` : C.creamDeep, border: m.primary ? `2px solid ${m.color}40` : '2px solid transparent', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22 }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                    {m.name}
                    {m.primary && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, background: m.color, color: C.cream, padding: '2px 6px', borderRadius: 100 }}>PRIMAIRE</span>}
                  </div>
                  <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>{m.desc}</div>
                </div>
                {m.primary ? <CheckCircle2 size={14} color={m.color} /> : <Plus size={14} color={C.inkSoft} />}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Top agents qui rapportent */}
      <div className="creator-section-mid">
        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Top 5 <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>agents qui rapportent</em>
          </h3>
          {topAgents.length === 0 ? (
            <div style={{
              padding: 28, textAlign: 'center', color: C.inkSoft,
              fontSize: 13, border: '1px dashed rgba(10,42,32,0.12)',
              borderRadius: 12,
            }}>
              Aucun revenu encore. Les meilleurs agents apparaîtront ici dès la première installation.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topAgents.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 10, background: C.creamDeep, transition: 'transform 0.2s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(4px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}>
                  <div style={{ fontSize: 26 }}>{a.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{a.name}</div>
                    <div style={{ height: 4, background: 'rgba(10,42,32,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${a.pct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldDeep})`, borderRadius: 2 }}/>
                    </div>
                  </div>
                  <div className="mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.goldDeep, minWidth: 100, textAlign: 'right' }}>{fmtFCFA(a.revenue)} F</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendrier de versement */}
      <div className="creator-section-bottom">
        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Calendrier <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>des versements</em>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { date: '1 mai 2026', amount: fmtFCFA(45000), status: 'next', label: 'PROCHAIN' },
              { date: '1 avril 2026', amount: fmtFCFA(28000), status: 'paid', label: 'Versé' },
              { date: '1 mars 2026', amount: fmtFCFA(12000), status: 'paid', label: 'Versé' },
              { date: '1 février 2026', amount: '0', status: 'skipped', label: 'Sous seuil' },
            ].map((p, i) => (
              <div key={i} style={{
                padding: 14, borderRadius: 12,
                background: p.status === 'next' ? `linear-gradient(135deg, ${C.gold}15, ${C.goldDeep}08)` : C.creamDeep,
                border: p.status === 'next' ? `2px solid ${C.gold}` : '1px solid rgba(10,42,32,0.06)',
                position: 'relative',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: p.status === 'next' ? C.goldDeep : C.inkSoft, marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{p.date}</div>
                <div className="mono-font" style={{ fontSize: 16, fontWeight: 800, color: p.status === 'next' ? C.goldDeep : C.ink }}>{p.amount} F</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ REVENUS — RETRAITS (sub-page 2) ============
function RevenusRetraits({ openWithdrawal, available }: any) {
  const { withdrawals: rawWithdrawals } = useCreator();

  const methodEmoji = (m: string): string => {
    const k = (m ?? '').toLowerCase();
    if (k.includes('orange')) return '🟠 Orange Money';
    if (k.includes('wave')) return '🌊 Wave';
    if (k.includes('mtn')) return '🟡 MTN';
    if (k.includes('moov')) return '🔵 Moov Money';
    if (k.includes('paypal')) return '💙 PayPal';
    if (k.includes('zelle')) return '💜 Zelle';
    if (k.includes('venmo')) return '🩵 Venmo';
    if (k.includes('cashapp')) return '💚 Cash App';
    return m || '—';
  };

  const fmtRelDate = (ts: any): string => {
    const seconds = ts?._seconds ?? ts?.seconds;
    if (!seconds) return 'Récemment';
    const d = new Date(seconds * 1000);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Map server withdrawals → UI shape
  const withdrawals = rawWithdrawals.map((w: any) => ({
    id: w.id,
    date: fmtRelDate(w.createdAt),
    amount: w.amount ?? 0,
    fees: 0,
    net: w.amount ?? 0,
    method: methodEmoji(w.method),
    status: w.status === 'confirmed' ? 'completed' : w.status === 'pending_otp' ? 'pending' : (w.status ?? 'pending'),
    completedAt: w.confirmedAt ? fmtRelDate(w.confirmedAt) : null,
  }));

  // Stats derived from real withdrawals
  const completed = withdrawals.filter((w: any) => w.status === 'completed');
  const totalWithdrawn = completed.reduce((s: number, w: any) => s + w.amount, 0);
  const avgWithdrawal = completed.length > 0 ? Math.round(totalWithdrawn / completed.length) : 0;
  const methodCounts: Record<string, number> = {};
  completed.forEach((w: any) => {
    const k = w.method?.split(' ')[0] ?? '—';
    methodCounts[k] = (methodCounts[k] ?? 0) + 1;
  });
  const favoriteMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const favoriteMethodFull = completed.find((w: any) => w.method.startsWith(favoriteMethod))?.method?.split(' ').slice(1).join(' ') ?? '—';

  const statusBadge: any = {
    completed: { bg: C.emeraldSoft, fg: C.emeraldDeep, label: '✅ Effectué' },
    pending: { bg: '#FED7AA', fg: '#C2410C', label: '⏳ En cours' },
    failed: { bg: C.redSoft, fg: C.red, label: '❌ Échec' },
    cancelled: { bg: 'rgba(10,42,32,0.08)', fg: C.inkSoft, label: '🚫 Annulé' },
  };

  return (
    <>
      {/* CTA hero */}
      <div className="creator-section-mid">
        <div style={{
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
          borderRadius: 20, padding: 32, color: C.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
          boxShadow: `0 20px 40px -16px ${C.gold}80`,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, letterSpacing: '0.12em', marginBottom: 6 }}>DISPONIBLE POUR RETRAIT</div>
            <h3 className="display-font" style={{ fontSize: 36, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.03em' }}>
              <span className="mono-font">{fmtFCFA(available)}</span> <em style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 22 }}>FCFA</em>
            </h3>
            <p style={{ fontSize: 13, opacity: 0.9, margin: '6px 0 0' }}>Frais gratuits sous 50 000 FCFA · Mobile Money instantané</p>
          </div>
          <button onClick={openWithdrawal} style={{
            background: C.cream, color: C.goldDeep, padding: '16px 28px', borderRadius: 14,
            border: 'none', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            boxShadow: '0 12px 32px -8px rgba(0,0,0,0.4)',
          }}>💰 Retirer mes gains</button>
        </div>
      </div>

      {/* Stats retraits */}
      <div className="creator-section-mid">
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Total retiré', value: `${fmtFCFA(totalWithdrawn)} F`, sub: 'Tous temps', color: C.gold, bg: C.goldSoft, icon: Wallet },
            { label: 'Retrait moyen', value: avgWithdrawal > 0 ? `${fmtFCFA(avgWithdrawal)} F` : '—', sub: 'Par opération', color: C.violet, bg: C.violetSoft, icon: BarChart3 },
            { label: 'Total opérations', value: String(completed.length), sub: 'Réussites', color: C.emeraldDeep, bg: C.emeraldSoft, icon: Timer },
            { label: 'Méthode favorite', value: favoriteMethod, sub: favoriteMethodFull || '—', color: '#F97316', bg: '#FED7AA', icon: CheckCircle2 },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color }}/>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="display-font mono-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{s.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historique */}
      <div className="creator-section-bottom">
        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
              Historique <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>des retraits</em>
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '6px 12px', borderRadius: 8, background: C.creamDeep, border: '1px solid rgba(10,42,32,0.08)', fontSize: 12, fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Filter size={11} style={{ marginRight: 4 }} /> Filtrer
              </button>
              <button style={{ padding: '6px 12px', borderRadius: 8, background: C.creamDeep, border: '1px solid rgba(10,42,32,0.08)', fontSize: 12, fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Download size={11} style={{ marginRight: 4 }} /> Export CSV
              </button>
            </div>
          </div>

          {withdrawals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.inkSoft }}>
              <Wallet size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 600 }}>Aucun retrait pour l'instant</p>
              <p style={{ fontSize: 12 }}>Vos prochains retraits apparaîtront ici.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {withdrawals.map(w => {
                const sb = statusBadge[w.status];
                return (
                  <div key={w.id} style={{ padding: 14, borderRadius: 12, background: C.creamDeep, border: '1px solid rgba(10,42,32,0.04)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span className="pill" style={{ background: sb.bg, color: sb.fg }}>{sb.label}</span>
                        <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: 'JetBrains Mono, monospace' }}>{w.id}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{w.method}</div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>Initié le {w.date}{w.completedAt && ` · Complété le ${w.completedAt}`}</div>
                    </div>
                    <div style={{ minWidth: 140, textAlign: 'right' }}>
                      <div className="mono-font" style={{ fontSize: 16, fontWeight: 800, color: C.goldDeep }}>{fmtFCFA(w.net)} F</div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>brut {fmtFCFA(w.amount)} · frais {fmtFCFA(w.fees)}</div>
                    </div>
                    <button style={{ background: C.cream, border: '1px solid rgba(10,42,32,0.1)', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
                      <Download size={14} color={C.ink} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============ REVENUS — FISCALITÉ (sub-page 3) ============
function RevenusFiscalite() {
  const [fiscalType, setFiscalType] = useState('individual');
  const [nif, setNif] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState("Côte d'Ivoire");
  const [submitting, setSubmitting] = useState(false);

  const saveFiscal = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/creator/kyc/fiscal-info', { type: fiscalType, nif, address, fiscalCountry: country });
      toast.success('Informations fiscales enregistrées');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Échec de l\'enregistrement';
      toast.error('Erreur', msg);
    } finally { setSubmitting(false); }
  };

  return (
    <>
      {/* KYC niveaux */}
      <div className="creator-section-mid">
        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Vérification <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>de votre identité</em>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { level: 1, name: 'Standard', limit: '100 000 FCFA / mois', status: 'verified', docs: ['Email', 'Téléphone'] },
              { level: 2, name: 'Pro', limit: '1 000 000 FCFA / mois', status: 'pending', docs: ['CNI', 'RIB', 'Justificatif'] },
              { level: 3, name: 'Entreprise', limit: 'Illimité', status: 'locked', docs: ['RCCM', 'NIF', 'Statuts'] },
            ].map(l => {
              const isVerified = l.status === 'verified';
              const isPending = l.status === 'pending';
              const isLocked = l.status === 'locked';
              return (
                <div key={l.level} style={{
                  padding: 18, borderRadius: 14,
                  background: isVerified ? `linear-gradient(135deg, ${C.emeraldSoft}, ${C.cream})` : C.creamDeep,
                  border: isVerified ? `2px solid ${C.emerald}` : (isPending ? `2px solid ${C.gold}` : '2px solid rgba(10,42,32,0.06)'),
                  opacity: isLocked ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isVerified ? C.emerald : (isPending ? C.gold : 'rgba(10,42,32,0.15)'), color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {isVerified ? <CheckCircle2 size={14} /> : (isPending ? <Clock size={14} /> : <Lock size={14} />)}
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: C.inkSoft }}>NIVEAU {l.level}</div>
                      <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{l.name}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 8 }}>Limite : <strong className="mono-font" style={{ color: C.ink }}>{l.limit}</strong></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {l.docs.map(d => (
                      <div key={d} style={{ fontSize: 11, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isVerified ? <CheckCircle2 size={10} color={C.emerald} /> : <Clock size={10} color={C.inkSoft} />} {d}
                      </div>
                    ))}
                  </div>
                  {isPending && (
                    <button style={{ width: '100%', marginTop: 12, padding: '8px 12px', borderRadius: 8, background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Compléter le niveau {l.level}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="creator-section-mid">
        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Documents <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>à fournir</em>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { id: 'cni', icon: '📷', name: 'CNI / Passeport', desc: 'Recto-verso', status: 'pending' },
              { id: 'address', icon: '🏠', name: 'Justificatif de domicile', desc: '< 3 mois', status: 'pending' },
              { id: 'rib', icon: '🏦', name: 'RIB / Compte Mobile Money', desc: 'Confirmé', status: 'verified' },
              { id: 'rccm', icon: '📜', name: 'RCCM (entreprise)', desc: 'Registre Commerce', status: 'optional' },
              { id: 'nif', icon: '🏢', name: 'NIF', desc: 'Numéro Identification Fiscale', status: 'optional' },
              { id: 'statuts', icon: '📋', name: 'Statuts', desc: 'SARL / SA', status: 'optional' },
            ].map(d => (
              <div key={d.id} style={{ padding: 14, borderRadius: 12, background: C.creamDeep, border: '1.5px dashed rgba(10,42,32,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 32 }}>{d.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{d.desc}</div>
                </div>
                {d.status === 'verified' ? (
                  <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep }}><CheckCircle2 size={11} /> Validé</span>
                ) : d.status === 'pending' ? (
                  <button style={{ padding: '6px 10px', borderRadius: 8, background: C.violet, color: C.cream, border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Upload size={10} style={{ marginRight: 4 }} /> Upload
                  </button>
                ) : (
                  <span style={{ fontSize: 10, color: C.inkLight }}>Optionnel</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Annual + Invoices */}
      <div className="creator-section-mid responsive-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
        <div style={{ background: `linear-gradient(135deg, ${C.gold}10, ${C.cream})`, borderRadius: 20, padding: 24, border: `2px solid ${C.gold}40` }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Récap fiscal <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>annuel</em>
          </h3>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 4 }}>ANNÉE 2026 EN COURS</div>
            <div className="display-font mono-font" style={{ fontSize: 32, fontWeight: 800, color: C.goldDeep, lineHeight: 1 }}>{fmtFCFA(63750)} <span style={{ fontSize: 18 }}>FCFA</span></div>
            <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>Net créateur · brut {fmtFCFA(85000)} · commission {fmtFCFA(21250)}</div>
          </div>
          <div style={{ background: C.cream, borderRadius: 12, padding: 12, fontSize: 12, color: C.ink, marginBottom: 12 }}>
            📥 Votre récap <strong>2025</strong> est prêt
          </div>
          <button style={{ width: '100%', padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Download size={14} style={{ marginRight: 6 }} /> Télécharger PDF récap 2025
          </button>
        </div>

        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Factures <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>mensuelles</em>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { ref: 'NF-2026-04-001', period: 'Avril 2026', net: 45000 },
              { ref: 'NF-2026-03-001', period: 'Mars 2026', net: 28000 },
              { ref: 'NF-2026-02-001', period: 'Février 2026', net: 12000 },
            ].map(f => (
              <div key={f.ref} style={{ padding: '10px 14px', borderRadius: 10, background: C.creamDeep, display: 'flex', alignItems: 'center', gap: 12 }}>
                <FileText size={18} color={C.gold} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: C.ink }}>{f.ref}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{f.period} · net {fmtFCFA(f.net)} F</div>
                </div>
                <button style={{ background: C.cream, border: '1px solid rgba(10,42,32,0.1)', padding: 8, borderRadius: 8, cursor: 'pointer' }}>
                  <Download size={12} color={C.ink} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fiscal info form */}
      <div className="creator-section-mid">
        <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Information <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>fiscale</em>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>TYPE DE CRÉATEUR</label>
              <select value={fiscalType} onChange={e => setFiscalType(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit' }}>
                <option value="individual">Particulier</option>
                <option value="auto_entrepreneur">Auto-entrepreneur</option>
                <option value="company">Entreprise (SARL / SA)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>NIF (si entreprise)</label>
              <input value={nif} onChange={e => setNif(e.target.value)} placeholder="CI 1234567 X" style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>ADRESSE FISCALE</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Cocody, Abidjan, Côte d'Ivoire" style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>PAYS DE RÉSIDENCE FISCALE</label>
              <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)', fontSize: 13, color: C.ink, fontFamily: 'inherit' }}>
                <option>Côte d'Ivoire</option>
                <option>Sénégal</option>
                <option>Cameroun</option>
                <option>France</option>
                <option>Autre</option>
              </select>
            </div>
          </div>
          <button onClick={saveFiscal} disabled={submitting} style={{ padding: '10px 18px', borderRadius: 10, background: `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`, color: C.cream, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Save size={13} style={{ marginRight: 6 }} /> {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Aide */}
      <div className="creator-section-bottom">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }} className="responsive-charts">
          {[
            { icon: '🇨🇮', title: 'Fiscalité créateur en Côte d\'Ivoire', desc: 'Comprendre vos obligations' },
            { icon: '📚', title: 'Seuils OHADA & déclarations', desc: 'Régime fiscal applicable' },
            { icon: '💼', title: 'Trouver un expert-comptable', desc: 'Partenaires Orlode certifiés' },
            { icon: '🆘', title: 'Contacter le support fiscal', desc: 'Réponse sous 48h' },
          ].map((c, i) => (
            <div key={i} style={{ padding: 16, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ fontSize: 28 }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{c.desc}</div>
              </div>
              <ChevronRight size={16} color={C.inkSoft} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ MAIN — REVENUS PAGE WITH 3 SUB-TABS ============
function RevenusPage() {
  const [tab, setTab] = useState<'overview' | 'retraits' | 'fiscalite'>('overview');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { earnings, withdrawals, refresh } = useCreator();

  // Use real data only — no fake fallback
  const earningsData = earnings ?? { totalRevenue: 0, creatorEarnings: 0, agents: [] };
  const totalEarned = (earningsData.creatorEarnings ?? 0) * 600; // USD → FCFA
  const totalWithdrawnConfirmed = withdrawals
    .filter((w: any) => w.status === 'confirmed')
    .reduce((s: number, w: any) => s + (w.amount ?? 0), 0);
  const available = Math.max(0, totalEarned - totalWithdrawnConfirmed);
  const grossYear = totalEarned;
  // Monthly revenue: server doesn't return per-month yet, so build a flat 12-month array of zeros
  // (will be replaced when server adds /creator/earnings/monthly)
  const monthlyRevenue: number[] = new Array(12).fill(0);
  if (totalEarned > 0) monthlyRevenue[11] = totalEarned;

  const tabs = [
    { id: 'overview' as const, label: 'Vue d\'ensemble', icon: BarChart3 },
    { id: 'retraits' as const, label: 'Retraits', icon: Wallet },
    { id: 'fiscalite' as const, label: 'Fiscalité', icon: FileText },
  ];

  return (
    <>
      <PageHeader
        title="Revenus,"
        italic="monétisation FCFA."
        subtitle="Revenus créateur · Commission Orlode 25% · Mobile Money + Stripe · OHADA compliant"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <Banknote size={11} /> {fmtFCFA(grossYear)} FCFA · 12 DERNIERS MOIS
          </div>
        }
        actions={
          <button className="btn-gold" onClick={() => setWithdrawOpen(true)}><Wallet size={14} /> Retirer mes gains</button>
        }
      />

      {/* Tab switcher */}
      <div style={{ padding: '20px 32px 0' }}>
        <div style={{ display: 'inline-flex', gap: 4, background: C.creamDeep, padding: 4, borderRadius: 14, border: '1px solid rgba(10,42,32,0.06)' }}>
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '10px 18px', borderRadius: 10,
                background: isActive ? `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})` : 'transparent',
                color: isActive ? C.cream : C.ink,
                border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: isActive ? `0 8px 20px -8px ${C.gold}` : 'none',
                transition: 'all 0.2s ease',
              }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'overview' && <RevenusOverview openWithdrawal={() => setWithdrawOpen(true)} monthlyRevenue={monthlyRevenue} available={available} />}
      {tab === 'retraits' && <RevenusRetraits openWithdrawal={() => setWithdrawOpen(true)} available={available} />}
      {tab === 'fiscalite' && <RevenusFiscalite />}

      {withdrawOpen && <WithdrawalModal onClose={() => setWithdrawOpen(false)} available={available} onConfirmed={refresh} />}
    </>
  );
}

// ============ LEGACY RevenusPage body — REMPLACÉ par les sous-pages ci-dessus ============
function _RevenusLegacy() {
  const monthlyRevenue = [0, 0, 0, 0, 0, 0, 0, 0, 0, 12000, 28000, 45000];
  const maxRev = Math.max(...monthlyRevenue, 50000);

  return (
    <>
      <PageHeader
        title="Revenus,"
        italic="monétisation FCFA."
        subtitle="Revenus créateur · Commission Orlode 25% · Mobile Money + Stripe · Versements mensuels"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <Banknote size={11} /> 0 FCFA · 12 DERNIERS MOIS
          </div>
        }
        actions={
          <button className="btn-gold"><Download size={14} /> Relevé mensuel</button>
        }
      />

      {/* Hero earnings card */}
      <div className="creator-section-mid">
        <div className="grain" style={{
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
          borderRadius: 20, padding: 28,
          color: C.cream, position: 'relative', overflow: 'hidden',
        }}>
          <Coins className="coin-bounce" size={140} style={{
            position: 'absolute', right: 30, top: 20,
            opacity: 0.18, color: C.cream,
          }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: 'rgba(255,250,240,0.15)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,250,240,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Wallet size={36} color={C.cream} />
            </div>

            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, letterSpacing: '0.12em', marginBottom: 6 }}>
                SOLDE DISPONIBLE
              </div>
              <h3 className="display-font" style={{
                fontSize: 44, fontWeight: 800, color: C.cream,
                margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                <span className="mono-font">0</span> <em style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 28 }}>FCFA</em>
              </h3>
              <p style={{ fontSize: 13, opacity: 0.9, margin: 0 }}>
                Prochain versement : <strong>30 avril 2026</strong> · Mobile Money / Wave
              </p>
            </div>

            <button style={{
              background: C.cream, color: C.goldDeep,
              padding: '12px 22px', borderRadius: 12,
              border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
              flexShrink: 0,
            }}>
              <CreditCard size={14} /> Retrait anticipé
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="creator-section-mid">
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Revenus bruts', value: '0 F', sub: 'Tous abonnements', color: C.gold, bg: C.goldSoft, icon: Coins },
            { label: 'Commission Orlode', value: '0 F', sub: '25% prélevés', color: C.violet, bg: C.violetSoft, icon: Hammer },
            { label: 'Net créateur', value: '0 F', sub: 'Vous touchez', color: C.emeraldDeep, bg: C.emeraldSoft, icon: BadgeCheck },
            { label: 'MRR (récurrent)', value: '0 F', sub: 'Monthly Recurring', color: C.pink, bg: C.pinkSoft, icon: TrendingUp },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} style={{
                background: C.cream, borderRadius: 18,
                padding: 20, border: '1px solid rgba(10,42,32,0.06)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.color }}></div>
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: stat.bg, color: stat.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="display-font" style={{
                  fontSize: 28, fontWeight: 800, color: C.ink,
                  letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4,
                }}>{stat.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{stat.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue chart + Payment method */}
      <div className="responsive-charts" style={{ padding: '24px 32px 0', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{
          background: C.cream, borderRadius: 20, padding: 24,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
            Revenus mensuels <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>FCFA</em>
          </h3>

          <div style={{ position: 'relative', height: 220, padding: '10px 0' }}>
            <svg width="100%" height="100%" viewBox="0 0 600 220" preserveAspectRatio="none">
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.gold} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Area path */}
              <path
                d={(() => {
                  const points = monthlyRevenue.map((v, i) => {
                    const x = i * 50 + 25;
                    const y = 200 - (v / maxRev) * 170;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  });
                  return points.join(' ') + ` L ${11 * 50 + 25} 200 L 25 200 Z`;
                })()}
                fill="url(#revGrad)"
              />
              {/* Line path */}
              <path
                d={monthlyRevenue.map((v, i) => {
                  const x = i * 50 + 25;
                  const y = 200 - (v / maxRev) * 170;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                fill="none"
                stroke={C.gold}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots */}
              {monthlyRevenue.map((v, i) => {
                const x = i * 50 + 25;
                const y = 200 - (v / maxRev) * 170;
                return v > 0 ? (
                  <circle key={i} cx={x} cy={y} r="4" fill={C.gold} stroke={C.cream} strokeWidth="2" />
                ) : null;
              })}
              {/* Months labels */}
              {monthlyRevenue.map((_, i) => (
                <text key={i} x={i * 50 + 25} y="215" fontSize="9" fill={C.inkSoft} textAnchor="middle" fontFamily="JetBrains Mono">
                  {['M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D', 'J', 'F'][i]}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Payment methods */}
        <div style={{
          background: C.cream, borderRadius: 20, padding: 24,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Méthodes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>de versement</em>
          </h3>

          {[
            { icon: '🟠', name: 'Orange Money', desc: '+225 07 XX XX XX', primary: true, color: C.orange },
            { icon: '🟡', name: 'MTN Money', desc: 'Non configuré', primary: false, color: C.gold },
            { icon: '🌊', name: 'Wave', desc: 'Non configuré', primary: false, color: C.cyan },
            { icon: '💳', name: 'Stripe', desc: 'International', primary: false, color: C.violet },
          ].map((m, i) => (
            <div key={i} style={{
              padding: 14, borderRadius: 12,
              background: m.primary ? `${m.color}10` : C.creamDeep,
              border: m.primary ? `2px solid ${m.color}40` : '2px solid transparent',
              marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ fontSize: 28 }}>{m.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                  {m.name}
                  {m.primary && (
                    <span style={{
                      marginLeft: 6, fontSize: 9, fontWeight: 700,
                      background: m.color, color: C.cream,
                      padding: '2px 6px', borderRadius: 100,
                    }}>PRIMAIRE</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>{m.desc}</div>
              </div>
              {m.primary ? <CheckCircle2 size={16} color={m.color} /> : <Plus size={16} color={C.inkSoft} />}
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div className="creator-section-bottom">
        <div style={{
          background: C.cream, borderRadius: 20, padding: 24,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Transactions <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>récentes</em>
          </h3>

          <div style={{ textAlign: 'center', padding: '40px 20px', color: C.inkSoft }}>
            <Wallet size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 600 }}>Aucune transaction pour l'instant</p>
            <p style={{ fontSize: 12 }}>Les revenus de votre Agent Livraison apparaîtront ici dès la première installation payante.</p>
          </div>
        </div>
      </div>
    </>
  );
}
// ============ PAGE: CRÉER UN AGENT (WIZARD 6 ÉTAPES) ============
function CreerAgentPage({ onBack }) {
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);

  const [agentData, setAgentData] = useState({
    // Step 1 — Identité
    emoji: '🤖',
    name: 'Agent Restaurant',
    shortDesc: 'Prise de commandes automatique et gestion du restaurant',
    longDesc: '',
    industry: 'Restauration',
    category: 'Operations',
    color: '#F97316',

    // Step 2 — Personnalité
    tone: 'pro',
    style: 'concise',
    language: 'fr',
    systemPrompt: '',

    // Step 3 — Capacités
    readModules: ['comptabilite', 'commercial'],
    writeActions: ['send_email', 'create_devis'],
    maxCostPerRequest: 50,

    // Step 4 — Connecteurs
    connectors: ['whatsapp', 'gmail'],

    // Step 5 — Test (state in component)

    // Step 6 — Pricing
    pricingModel: 'monthly',
    price: 5000,
    currency: 'XOF',
  });

  const steps = [
    { num: 1, label: 'Identité', icon: User },
    { num: 2, label: 'Personnalité', icon: Smile },
    { num: 3, label: 'Capacités', icon: Cog },
    { num: 4, label: 'Connecteurs', icon: Plug },
    { num: 5, label: 'Test sandbox', icon: Beaker },
    { num: 6, label: 'Publication', icon: Rocket },
  ];

  // Helper: AI generation simulation for system prompt
  const handleGeneratePrompt = () => {
    setGenerating(true);
    setTimeout(() => {
      setAgentData({
        ...agentData,
        systemPrompt: `Tu es ${agentData.name}, un agent IA spécialisé en ${agentData.industry.toLowerCase()}.

OBJECTIF :
${agentData.shortDesc}

CONTEXTE :
- Tu réponds en français de manière ${agentData.tone === 'pro' ? 'professionnelle' : agentData.tone === 'friendly' ? 'amicale' : 'premium'}
- Tu connais les spécificités du marché ivoirien (FCFA, OHADA, Mobile Money)
- Tu peux consulter les modules : ${agentData.readModules.join(', ')}
- Tu peux exécuter : ${agentData.writeActions.join(', ')}

CAPACITÉS PRINCIPALES :
1. Comprendre les demandes en français + nouchi de base
2. Proposer des solutions adaptées au contexte CI
3. Escalader vers humain si nécessaire (mots-clés : urgent, parler humain)

RÈGLES :
- Toujours saluer poliment
- Confirmer avant toute action coûteuse
- Citer les sources de tes infos
- Ne jamais inventer de données

Variables disponibles : {client.name}, {date}, {agent.name}`,
      });
      setGenerating(false);
    }, 2200);
  };

  return (
    <>
      <PageHeader
        title="Créer"
        italic="un nouvel agent."
        subtitle={`Étape ${step} sur 6 · Wizard guidé · IA assistée · Test sandbox inclus`}
        badge="WIZARD CRÉATION"
        onBack={onBack}
      />

      {/* Stepper */}
      <div className="creator-section-mid">
        <div style={{
          display: 'flex', gap: 6, justifyContent: 'center',
          maxWidth: 1100, margin: '0 auto', flexWrap: 'wrap',
        }}>
          {steps.map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            const Icon = s.icon;
            return (
              <button
                key={s.num}
                onClick={() => isDone && setStep(s.num)}
                disabled={!isDone && !isActive}
                style={{
                  flex: 1, minWidth: 130, padding: '12px 12px',
                  background: isActive ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : (isDone ? C.emeraldSoft : C.cream),
                  color: isActive ? C.cream : (isDone ? C.emeraldDeep : C.inkSoft),
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, fontWeight: 700,
                  border: '1px solid rgba(10,42,32,0.06)',
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? `0 8px 20px -6px ${C.violet}` : 'none',
                  cursor: (isDone || isActive) ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                <div className={isActive ? 'step-active' : ''} style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: isActive ? C.cream : (isDone ? C.emeraldDeep : C.creamDeep),
                  color: isActive ? C.violet : (isDone ? C.cream : C.inkSoft),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  flexShrink: 0,
                }}>
                  {isDone ? <CheckCircle2 size={14} /> : (isActive ? <Icon size={13} /> : s.num)}
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div style={{ padding: '32px 32px 32px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{
          background: C.cream, borderRadius: 24,
          padding: 36, border: '1px solid rgba(10,42,32,0.06)',
          minHeight: 480,
        }}>

          {/* STEP 1 — IDENTITÉ */}
          {step === 1 && (
            <div className="stagger">
              <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                Définissons <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>l'identité</em>
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
                Comment votre agent va-t-il se présenter ?
              </p>

              {/* Emoji picker */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
                  ICÔNE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: 6 }}>
                  {AGENT_EMOJIS.map((e, i) => (
                    <button key={i} onClick={() => setAgentData({...agentData, emoji: e})} style={{
                      aspectRatio: '1', borderRadius: 10,
                      background: agentData.emoji === e ? `${C.violet}15` : C.creamDeep,
                      border: agentData.emoji === e ? `2px solid ${C.violet}` : '2px solid transparent',
                      fontSize: 24, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease', fontFamily: 'inherit',
                    }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Name */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
                    NOM DE L'AGENT *
                  </div>
                  <input
                    className="input-field"
                    value={agentData.name}
                    onChange={e => setAgentData({...agentData, name: e.target.value})}
                    placeholder="Ex: Agent Restaurant"
                  />
                </div>
                {/* Color picker */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
                    COULEUR SIGNATURE
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['#F97316', '#7C3AED', '#10B981', '#0EA5E9', '#EC4899', '#F59E0B', '#06B6D4', '#EF4444'].map(c => (
                      <button key={c} onClick={() => setAgentData({...agentData, color: c})} style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: c, border: agentData.color === c ? `3px solid ${C.ink}` : '2px solid rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                      }}>
                        {agentData.color === c && <CheckCheck size={14} color={C.cream} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Short desc */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
                  DESCRIPTION COURTE * <span style={{ fontWeight: 500, color: C.inkLight }}>· Affichée dans le marketplace</span>
                </div>
                <input
                  className="input-field"
                  value={agentData.shortDesc}
                  onChange={e => setAgentData({...agentData, shortDesc: e.target.value})}
                  placeholder="Une phrase qui résume l'agent (max 120 caractères)"
                  maxLength={120}
                />
                <div style={{ fontSize: 10, color: C.inkLight, marginTop: 4, textAlign: 'right' }}>
                  {agentData.shortDesc.length} / 120
                </div>
              </div>

              {/* Long desc */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
                  DESCRIPTION DÉTAILLÉE
                </div>
                <textarea
                  className="input-field"
                  value={agentData.longDesc}
                  onChange={e => setAgentData({...agentData, longDesc: e.target.value})}
                  placeholder="Description complète de ce que fait l'agent, ses cas d'usage, ses bénéfices..."
                  rows={4}
                  style={{ resize: 'vertical', minHeight: 100 }}
                />
              </div>

              {/* Industry & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
                    INDUSTRIE
                  </div>
                  <input
                    className="input-field"
                    value={agentData.industry}
                    onChange={e => setAgentData({...agentData, industry: e.target.value})}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
                    CATÉGORIE
                  </div>
                  <select className="input-field" value={agentData.category} onChange={e => setAgentData({...agentData, category: e.target.value})}>
                    <option>Operations</option>
                    <option>Sales</option>
                    <option>Marketing</option>
                    <option>Finance</option>
                    <option>HR</option>
                    <option>Customer Service</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
                <button onClick={() => setStep(2)} className="btn-primary">
                  Continuer · Personnalité <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — PERSONNALITÉ */}
          {step === 2 && (
            <div className="stagger">
              <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>Personnalité</em> & ton
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
                Comment votre agent doit-il s'exprimer ?
              </p>

              {/* Tone */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 8 }}>TON</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'pro', label: 'Professionnel', emoji: '👔' },
                    { id: 'friendly', label: 'Friendly', emoji: '😊' },
                    { id: 'premium', label: 'Premium', emoji: '✨' },
                    { id: 'fun', label: 'Fun', emoji: '🎉' },
                  ].map(t => {
                    const active = agentData.tone === t.id;
                    return (
                      <button key={t.id} onClick={() => setAgentData({...agentData, tone: t.id})} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '12px 18px', borderRadius: 12,
                        background: active ? `${C.violet}15` : C.creamDeep,
                        color: active ? C.violetDeep : C.ink,
                        border: active ? `2px solid ${C.violet}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}>
                        <span style={{ fontSize: 18 }}>{t.emoji}</span> {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Style */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 8 }}>STYLE DE RÉPONSE</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'concise', label: 'Concis', icon: Minus },
                    { id: 'detailed', label: 'Détaillé', icon: AlignLeft },
                    { id: 'bulleted', label: 'À puces', icon: List },
                  ].map(s => {
                    const Icon = s.icon;
                    const active = agentData.style === s.id;
                    return (
                      <button key={s.id} onClick={() => setAgentData({...agentData, style: s.id})} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 10,
                        background: active ? C.violet : C.creamDeep,
                        color: active ? C.cream : C.ink,
                        border: active ? `2px solid ${C.violet}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 600,
                      }}>
                        <Icon size={14} /> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 8 }}>LANGUE PRINCIPALE</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'fr', flag: '🇫🇷', label: 'Français' },
                    { id: 'en', flag: '🇬🇧', label: 'Anglais' },
                    { id: 'ar', flag: '🇸🇦', label: 'Arabe' },
                    { id: 'es', flag: '🇪🇸', label: 'Espagnol' },
                    { id: 'pt', flag: '🇵🇹', label: 'Portugais' },
                  ].map(l => {
                    const active = agentData.language === l.id;
                    return (
                      <button key={l.id} onClick={() => setAgentData({...agentData, language: l.id})} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 100,
                        background: active ? `${C.violet}15` : C.creamDeep,
                        color: active ? C.violetDeep : C.ink,
                        border: active ? `2px solid ${C.violet}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, fontWeight: 600,
                      }}>
                        <span style={{ fontSize: 16 }}>{l.flag}</span> {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System prompt with AI assist */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>SYSTEM PROMPT</div>
                  <button onClick={handleGeneratePrompt} disabled={generating} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 100,
                    background: generating ? C.creamDeep : `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
                    color: generating ? C.inkSoft : C.cream,
                    border: 'none', cursor: generating ? 'wait' : 'pointer',
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
                    boxShadow: generating ? 'none' : `0 4px 12px -2px ${C.violet}`,
                  }}>
                    {generating ? (
                      <>
                        <Loader2 size={11} className="spinner" /> Génération…
                      </>
                    ) : (
                      <>
                        <Wand2 size={11} fill={C.cream} /> Générer avec Claude 4.7
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  className="input-field"
                  value={agentData.systemPrompt}
                  onChange={e => setAgentData({...agentData, systemPrompt: e.target.value})}
                  placeholder='Tu es {agent.name}, un agent IA spécialisé en...&#10;&#10;OBJECTIF :&#10;...&#10;&#10;Cliquez "Générer avec Claude 4.7" pour un prompt optimisé.'
                  rows={10}
                  style={{
                    resize: 'vertical', minHeight: 240,
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12, lineHeight: 1.6,
                  }}
                />
                <div style={{ fontSize: 10, color: C.inkLight, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lightbulb size={11} color={C.gold} />
                  Variables disponibles : <span className="mono-font" style={{ color: C.violet, fontWeight: 700 }}>{'{client.name}'}</span>, <span className="mono-font" style={{ color: C.violet, fontWeight: 700 }}>{'{date}'}</span>, <span className="mono-font" style={{ color: C.violet, fontWeight: 700 }}>{'{agent.name}'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 28 }}>
                <button onClick={() => setStep(1)} className="btn-secondary">
                  <ArrowLeft size={13} /> Retour
                </button>
                <button onClick={() => setStep(3)} className="btn-primary">
                  Continuer · Capacités <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — CAPACITÉS */}
          {step === 3 && (
            <div className="stagger">
              <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>Capacités</em> & permissions
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
                Quels modules votre agent peut consulter, et quelles actions il peut exécuter
              </p>

              {/* Read access */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Eye size={14} color={C.blue} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Modules consultables (lecture)</div>
                </div>
                <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 10px' }}>
                  L'agent pourra lire les données de ces modules dans <strong>l'Orlode de l'utilisateur final</strong>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { id: 'commercial', label: 'Commercial', icon: Briefcase, color: C.orange },
                    { id: 'rh', label: 'RH', icon: Users2, color: C.blue },
                    { id: 'comptabilite', label: 'Comptabilité', icon: Coins, color: C.emerald },
                    { id: 'reception', label: 'Réception', icon: Headphones, color: C.cyan },
                    { id: 'communications', label: 'Communications', icon: MessageCircle, color: C.pink },
                    { id: 'marketing', label: 'Marketing', icon: Crown, color: C.violet },
                    { id: 'juridique', label: 'Juridique', icon: Scale, color: C.violetDeep },
                    { id: 'workflow', label: 'Workflow', icon: Zap, color: C.gold },
                  ].map(m => {
                    const Icon = m.icon;
                    const active = agentData.readModules.includes(m.id);
                    return (
                      <button key={m.id} onClick={() => {
                        setAgentData({
                          ...agentData,
                          readModules: active ? agentData.readModules.filter(x => x !== m.id) : [...agentData.readModules, m.id],
                        });
                      }} style={{
                        padding: '12px 10px', borderRadius: 10,
                        background: active ? `${m.color}15` : C.creamDeep,
                        color: active ? m.color : C.inkSoft,
                        border: active ? `2px solid ${m.color}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      }}>
                        <Icon size={18} />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Write actions */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Edit2 size={14} color={C.gold} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Actions exécutables (écriture)</div>
                </div>
                <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 10px' }}>
                  L'agent pourra effectuer ces actions <strong>au nom de l'utilisateur final</strong> via ses connecteurs configurés
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[
                    { id: 'send_email', label: 'Envoyer un email', icon: Mail, color: C.blue, risk: 'low' },
                    { id: 'send_whatsapp', label: 'Envoyer un WhatsApp', icon: MessageCircle, color: C.emerald, risk: 'low' },
                    { id: 'create_devis', label: 'Créer un devis', icon: FileText, color: C.violet, risk: 'medium' },
                    { id: 'create_facture', label: 'Émettre une facture', icon: FileText, color: C.gold, risk: 'medium' },
                    { id: 'schedule_rdv', label: 'Programmer un RDV', icon: Calendar, color: C.cyan, risk: 'low' },
                    { id: 'process_payment', label: 'Initier un paiement', icon: CreditCard, color: C.red, risk: 'high' },
                  ].map(a => {
                    const Icon = a.icon;
                    const active = agentData.writeActions.includes(a.id);
                    const riskColor = a.risk === 'high' ? C.red : (a.risk === 'medium' ? C.gold : C.emerald);
                    return (
                      <button key={a.id} onClick={() => {
                        setAgentData({
                          ...agentData,
                          writeActions: active ? agentData.writeActions.filter(x => x !== a.id) : [...agentData.writeActions, a.id],
                        });
                      }} style={{
                        padding: '12px 14px', borderRadius: 10,
                        background: active ? `${a.color}15` : C.creamDeep,
                        color: active ? a.color : C.ink,
                        border: active ? `2px solid ${a.color}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 10,
                        textAlign: 'left',
                      }}>
                        <Icon size={16} />
                        <span style={{ flex: 1 }}>{a.label}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px',
                          borderRadius: 100, background: `${riskColor}20`, color: riskColor,
                          letterSpacing: '0.05em',
                        }}>{a.risk.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cost limit */}
              <div style={{
                background: C.creamDeep, borderRadius: 14, padding: 16,
                border: `1.5px solid ${C.gold}40`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Coins size={14} color={C.gold} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Limite de coût par requête</div>
                </div>
                <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 12px' }}>
                  Empêche l'agent de dépasser ce coût en tokens IA par requête (sécurité)
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range"
                    min="10" max="200"
                    value={agentData.maxCostPerRequest}
                    onChange={e => setAgentData({...agentData, maxCostPerRequest: parseInt(e.target.value)})}
                    style={{ flex: 1, accentColor: C.gold }}
                  />
                  <div style={{
                    background: C.gold, color: C.cream,
                    padding: '8px 14px', borderRadius: 10,
                    minWidth: 100, textAlign: 'center',
                  }}>
                    <span className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800 }}>
                      {agentData.maxCostPerRequest}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 4 }}>FCFA</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 28 }}>
                <button onClick={() => setStep(2)} className="btn-secondary">
                  <ArrowLeft size={13} /> Retour
                </button>
                <button onClick={() => setStep(4)} className="btn-primary">
                  Continuer · Connecteurs <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — CONNECTEURS */}
          {step === 4 && (
            <div className="stagger">
              <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>Connecteurs</em> requis
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px' }}>
                Déclarez les connecteurs Orlode dont votre agent a besoin pour fonctionner.
              </p>

              {/* Pedagogic banner */}
              <div style={{
                background: `linear-gradient(135deg, ${C.blueSoft}, ${C.cream})`,
                border: `1.5px solid ${C.blue}40`,
                borderRadius: 12, padding: 14, marginBottom: 20,
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: C.blue, color: C.cream,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Lightbulb size={16} />
                </div>
                <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.6 }}>
                  <strong style={{ color: C.blueDeep }}>Comment ça marche :</strong> L'utilisateur final utilisera <strong>ses propres connecteurs Orlode déjà configurés</strong> (WhatsApp, Gmail, Orange Money, etc.). Vous n'avez pas besoin de fournir de credentials. Si l'utilisateur n'a pas encore connecté un connecteur requis, il sera invité à le faire avant l'installation.
                </div>
              </div>

              {/* Connectors grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { id: 'whatsapp', name: 'WhatsApp Business', desc: 'Meta Cloud API', emoji: '💚', color: C.emerald, africa: true },
                  { id: 'telegram', name: 'Telegram Bot', desc: 'Bot API', emoji: '💙', color: C.blue, africa: false },
                  { id: 'gmail', name: 'Gmail', desc: 'Send & Read', emoji: '📧', color: C.red, africa: false },
                  { id: 'gcalendar', name: 'Google Calendar', desc: 'RDV & Events', emoji: '📅', color: C.violet, africa: false },
                  { id: 'gdrive', name: 'Google Drive', desc: 'Stockage docs', emoji: '📁', color: C.gold, africa: false },
                  { id: 'orange_money', name: 'Orange Money', desc: 'Mobile Money CI', emoji: '🟠', color: C.orange, africa: true },
                  { id: 'mtn_money', name: 'MTN Money', desc: 'Mobile Money CI', emoji: '🟡', color: C.gold, africa: true },
                  { id: 'wave', name: 'Wave', desc: 'Mobile Money', emoji: '🌊', color: C.cyan, africa: true },
                  { id: 'cinetpay', name: 'CinetPay', desc: 'Gateway Africa', emoji: '💳', color: C.pink, africa: true },
                ].map(c => {
                  const active = agentData.connectors.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => {
                      setAgentData({
                        ...agentData,
                        connectors: active ? agentData.connectors.filter(x => x !== c.id) : [...agentData.connectors, c.id],
                      });
                    }} style={{
                      padding: '14px 16px', borderRadius: 12,
                      background: active ? `${c.color}10` : C.creamDeep,
                      color: C.ink,
                      border: active ? `2px solid ${c.color}` : '2px solid transparent',
                      cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}>
                      {c.popular && (
                        <div style={{
                          position: 'absolute', top: 8, right: 8,
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                          background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
                          color: C.cream, padding: '2px 6px', borderRadius: 100,
                        }}>★ POPULAIRE</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ fontSize: 24 }}>{c.emoji}</div>
                        {active && <CheckCircle2 size={16} color={c.color} style={{ marginLeft: 'auto' }} />}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>{c.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Selected summary */}
              {agentData.connectors.length > 0 && (
                <div style={{
                  background: `${C.violet}10`, borderRadius: 12, padding: 14,
                  border: `1.5px solid ${C.violet}30`,
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <BadgeCheck size={16} color={C.violet} />
                  <span style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>
                    <strong style={{ color: C.violet }}>{agentData.connectors.length} connecteurs</strong> requis. Les utilisateurs qui les ont déjà configurés dans Orlode pourront installer votre agent en 1 clic.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 28 }}>
                <button onClick={() => setStep(3)} className="btn-secondary">
                  <ArrowLeft size={13} /> Retour
                </button>
                <button onClick={() => setStep(5)} className="btn-primary">
                  <Beaker size={14} /> Tester en sandbox
                </button>
              </div>
            </div>
          )}

          {/* STEP 5 — Test sandbox */}
          {step === 5 && <SandboxStep agentData={agentData} onNext={() => setStep(6)} onBack={() => setStep(4)} />}

          {/* STEP 6 — Pricing & publication */}
          {step === 6 && <PublishStep agentData={agentData} setAgentData={setAgentData} onBack={() => setStep(5)} onPublish={onBack} />}

        </div>
      </div>
    </>
  );
}
// ============ STEP 5 — TEST SANDBOX (live chat) ============
function SandboxStep({ agentData, onNext, onBack }) {
  const [messages, setMessages] = useState([
    { role: 'system', text: `Sandbox démarré · ${agentData.name} v0.1 (test mode)`, time: 'À l\'instant' },
    { role: 'agent', text: `Bonjour ! Je suis ${agentData.name}. ${agentData.shortDesc}. Comment puis-je vous aider aujourd'hui ?`, time: 'À l\'instant' },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [stats, setStats] = useState({ requests: 0, tokens: 0, cost: 0, latency: 0 });

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages([...messages, { role: 'user', text: userMsg, time: 'maintenant' }]);
    setInput('');
    setThinking(true);

    setTimeout(() => {
      const responses = [
        `Bien sûr ! Pour répondre à votre demande "${userMsg.slice(0, 30)}...", voici ce que je peux faire :\n\n1. Consulter le module ${agentData.readModules[0] || 'commercial'}\n2. Vérifier les données disponibles\n3. Vous proposer une solution adaptée\n\nVoulez-vous que je commence ?`,
        `Excellente question ! Je peux exécuter cette action via mes ${agentData.connectors.length} connecteurs configurés. Confirmez-vous que je dois procéder ?`,
        `J'ai bien compris votre demande. Selon le contexte ${agentData.industry}, je vous recommande l'approche suivante : utiliser ${agentData.writeActions[0] || 'send_email'} pour cette tâche.`,
      ];
      const response = responses[Math.floor(Math.random() * responses.length)];
      setMessages(prev => [...prev, { role: 'agent', text: response, time: 'maintenant' }]);
      setStats(prev => ({
        requests: prev.requests + 1,
        tokens: prev.tokens + Math.floor(Math.random() * 500) + 200,
        cost: prev.cost + Math.floor(Math.random() * 30) + 10,
        latency: Math.floor(Math.random() * 400) + 600,
      }));
      setThinking(false);
    }, 1800);
  };

  return (
    <div className="stagger">
      <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyan }}>Test sandbox</em> · Chat live
      </h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 20px' }}>
        Testez votre agent avant publication · Métriques en temps réel · Raisonnement IA visible
      </p>

      {/* Stats bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        marginBottom: 16,
      }}>
        {[
          { label: 'REQUÊTES', value: stats.requests, color: C.violet, icon: MessageCircle },
          { label: 'TOKENS', value: stats.tokens, color: C.blue, icon: Cpu },
          { label: 'COÛT', value: `${stats.cost} F`, color: C.gold, icon: Coins },
          { label: 'LATENCE', value: stats.latency ? `${stats.latency}ms` : '—', color: C.emerald, icon: Timer },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} style={{
              background: `${s.color}10`, padding: '10px 12px', borderRadius: 10,
              borderLeft: `3px solid ${s.color}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon size={14} color={s.color} />
              <div>
                <div className="mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, letterSpacing: '0.08em', marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chat container */}
      <div style={{
        background: C.creamDeep, borderRadius: 16,
        border: `1.5px solid rgba(10,42,32,0.08)`,
        overflow: 'hidden', height: 420, display: 'flex', flexDirection: 'column',
      }}>
        {/* Chat header */}
        <div style={{
          background: C.cream, padding: '12px 16px',
          borderBottom: '1px solid rgba(10,42,32,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${agentData.color}, ${agentData.color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            {agentData.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
              {agentData.name} <span className="pill" style={{ background: C.cyanSoft, color: C.cyanDeep, marginLeft: 4 }}>SANDBOX</span>
            </div>
            <div style={{ fontSize: 11, color: C.emeraldDeep, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="live-dot" style={{ width: 6, height: 6 }}></span>
              En ligne · Mode test isolé
            </div>
          </div>
          <button onClick={() => {
            setMessages([{ role: 'system', text: 'Sandbox réinitialisé', time: 'maintenant' }, { role: 'agent', text: `Bonjour ! Je suis ${agentData.name}. Comment puis-je vous aider ?`, time: 'maintenant' }]);
            setStats({ requests: 0, tokens: 0, cost: 0, latency: 0 });
          }} className="icon-btn" title="Réinitialiser">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => {
            if (m.role === 'system') {
              return (
                <div key={i} style={{
                  textAlign: 'center', fontSize: 10,
                  color: C.inkLight, fontWeight: 600,
                  padding: '4px 12px',
                }}>
                  <span style={{ background: C.cream, padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(10,42,32,0.06)' }}>
                    {m.text}
                  </span>
                </div>
              );
            }
            const isUser = m.role === 'user';
            return (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-end',
                flexDirection: isUser ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: isUser
                    ? `linear-gradient(135deg, ${C.greenDeep}, ${C.greenDark})`
                    : `linear-gradient(135deg, ${agentData.color}, ${agentData.color}cc)`,
                  color: C.cream,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                  fontFamily: 'Fraunces, serif', fontWeight: 700,
                }}>
                  {isUser ? 'A' : agentData.emoji}
                </div>
                <div style={{
                  background: isUser
                    ? `linear-gradient(135deg, ${agentData.color}, ${agentData.color}dd)`
                    : C.cream,
                  color: isUser ? C.cream : C.ink,
                  padding: '10px 14px',
                  borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  fontSize: 13, lineHeight: 1.5,
                  maxWidth: '78%',
                  whiteSpace: 'pre-wrap',
                  boxShadow: isUser ? `0 6px 14px -6px ${agentData.color}60` : '0 4px 10px -4px rgba(10,42,32,0.1)',
                  border: isUser ? 'none' : '1px solid rgba(10,42,32,0.06)',
                }}>
                  {m.text}
                </div>
              </div>
            );
          })}

          {thinking && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: `linear-gradient(135deg, ${agentData.color}, ${agentData.color}cc)`,
                color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>
                {agentData.emoji}
              </div>
              <div style={{
                background: C.cream,
                padding: '12px 16px',
                borderRadius: '14px 14px 14px 3px',
                border: '1px solid rgba(10,42,32,0.06)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(10,42,32,0.06)', background: C.cream, display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={`Écrivez à ${agentData.name}…`}
            className="input-field"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button onClick={handleSend} disabled={!input.trim() || thinking} style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
            color: C.cream, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() && !thinking ? 'pointer' : 'not-allowed',
            opacity: input.trim() && !thinking ? 1 : 0.5,
            boxShadow: `0 6px 16px -4px ${C.violet}`,
            flexShrink: 0,
          }}>
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Quick test prompts */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
          🧪 PROMPTS DE TEST RAPIDES
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            'Bonjour, peux-tu te présenter ?',
            'Quelles actions peux-tu faire ?',
            'Crée un devis pour Beta SARL',
            'Combien tu coûtes ?',
          ].map((p, i) => (
            <button key={i} onClick={() => { setInput(p); }} style={{
              padding: '6px 12px', borderRadius: 100,
              background: C.creamDeep, color: C.inkSoft,
              border: '1px solid rgba(10,42,32,0.06)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={onBack} className="btn-secondary">
          <ArrowLeft size={13} /> Retour
        </button>
        <button onClick={onNext} className="btn-primary">
          Continuer · Pricing & Publication <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ============ STEP 6 — PUBLISH (PRICING & SUBMIT) ============
function PublishStep({ agentData, setAgentData, onBack, onPublish }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const commission = 0.25; // 25% Orlode commission
  const grossPrice = agentData.price;
  const orlodeCut = Math.round(grossPrice * commission);
  const creatorNet = grossPrice - orlodeCut;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const created: any = await api.post('/creator/agents', {
        name: agentData.name,
        emoji: agentData.emoji,
        shortDesc: agentData.shortDesc,
        longDesc: agentData.longDesc,
        industry: agentData.industry,
        category: agentData.category,
        color: agentData.color,
        tone: agentData.tone,
        style: agentData.style,
        language: agentData.language,
        systemPrompt: agentData.systemPrompt,
        readModules: agentData.readModules,
        writeActions: agentData.writeActions,
        maxCostPerRequest: agentData.maxCostPerRequest,
        connectors: agentData.connectors,
        pricingModel: agentData.pricingModel,
        price: agentData.price,
        currency: agentData.currency,
      });
      const agentId = created?.data?.id || created?.data?.agentId;
      if (agentId) {
        await api.post(`/creator/agents/${agentId}/submit`, {}).catch(() => null);
      }
      toast.success('Agent soumis', 'Votre agent est en cours de validation.');
      setSubmitted(true);
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de soumettre.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stagger">
      <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Pricing</em> & publication
      </h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
        Définissez votre modèle économique et soumettez à validation
      </p>

      {!submitted && (
        <>
          {/* Pricing model */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 10 }}>
              MODÈLE ÉCONOMIQUE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {[
                { id: 'free', label: 'Gratuit', desc: 'Boost installs · Aucun revenu', icon: '🆓', color: C.emerald },
                { id: 'monthly', label: 'Abonnement mensuel', desc: 'Récurrent · MRR', icon: '🔄', color: C.gold, recommended: true },
                { id: 'one_time', label: 'Achat unique', desc: 'Paiement one-shot', icon: '💰', color: C.violet },
                { id: 'usage', label: 'Pay-per-use', desc: 'Par 1000 requêtes', icon: '📊', color: C.cyan },
              ].map(m => {
                const active = agentData.pricingModel === m.id;
                return (
                  <button key={m.id} onClick={() => setAgentData({...agentData, pricingModel: m.id})} style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: active ? `${m.color}15` : C.creamDeep,
                    color: C.ink,
                    border: active ? `2px solid ${m.color}` : '2px solid transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}>
                    {m.recommended && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                        background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
                        color: C.cream, padding: '2px 8px', borderRadius: 100,
                      }}>RECOMMANDÉ</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 24 }}>{m.icon}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: C.inkSoft }}>{m.desc}</div>
                      </div>
                      {active && <CheckCircle2 size={16} color={m.color} style={{ marginLeft: 'auto' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price input */}
          {agentData.pricingModel !== 'free' && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 10 }}>
                PRIX <span style={{ fontWeight: 500, color: C.inkLight }}>· {agentData.pricingModel === 'monthly' ? 'par mois' : agentData.pricingModel === 'usage' ? 'par 1000 requêtes' : 'unique'}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="number"
                  value={agentData.price}
                  onChange={e => setAgentData({...agentData, price: parseInt(e.target.value) || 0})}
                  className="input-field"
                  style={{ flex: 1, fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <select
                  value={agentData.currency}
                  onChange={e => setAgentData({...agentData, currency: e.target.value})}
                  className="input-field"
                  style={{ width: 120 }}
                >
                  <option value="XOF">FCFA</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              {/* Revenue breakdown */}
              <div style={{
                marginTop: 14, background: `${C.gold}10`, borderRadius: 12,
                padding: 16, border: `1.5px solid ${C.gold}30`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.goldDeep, letterSpacing: '0.08em', marginBottom: 10 }}>
                  💰 RÉPARTITION DES REVENUS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={{ textAlign: 'center', padding: 12, background: C.cream, borderRadius: 10 }}>
                    <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                      {grossPrice.toLocaleString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginTop: 4 }}>PRIX BRUT</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: C.violetSoft, borderRadius: 10 }}>
                    <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, color: C.violetDeep, lineHeight: 1 }}>
                      −{orlodeCut.toLocaleString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 10, color: C.violet, fontWeight: 700, marginTop: 4 }}>ORLODE 25%</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, borderRadius: 10, color: C.cream }}>
                    <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                      {creatorNet.toLocaleString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, opacity: 0.9 }}>VOUS TOUCHEZ</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recap card */}
          <div style={{
            background: C.creamDeep, borderRadius: 16, padding: 20,
            border: '1px solid rgba(10,42,32,0.06)', marginBottom: 24,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 12 }}>
              📋 RÉCAPITULATIF DE VOTRE AGENT
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `linear-gradient(135deg, ${agentData.color}, ${agentData.color}cc)`,
                color: C.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, flexShrink: 0,
                boxShadow: `0 8px 16px -4px ${agentData.color}`,
              }}>
                {agentData.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                  {agentData.name}
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>{agentData.shortDesc}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                  <span className="pill" style={{ background: C.violetSoft, color: C.violetDeep }}>{agentData.industry}</span>
                  <span className="pill" style={{ background: C.cyanSoft, color: C.cyanDeep }}>{agentData.readModules.length} modules · lecture</span>
                  <span className="pill" style={{ background: C.goldSoft, color: C.goldDeep }}>{agentData.writeActions.length} actions · écriture</span>
                  <span className="pill" style={{ background: C.pinkSoft, color: C.pinkDeep }}>{agentData.connectors.length} connecteurs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div style={{
            background: `linear-gradient(135deg, ${C.violetDeep}, ${C.pink})`,
            borderRadius: 16, padding: 20,
            color: C.cream, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Rocket size={32} color={C.cream} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="display-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  Soumettre à <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>validation</em>
                </div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  Délai moyen : <strong>2-7 jours</strong> · Vous serez notifié par email
                </div>
              </div>
              <button onClick={handleSubmit} disabled={submitting} style={{
                background: C.cream, color: C.violetDeep,
                padding: '12px 24px', borderRadius: 12,
                border: 'none', fontWeight: 700, fontSize: 14, cursor: submitting ? 'wait' : 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
                opacity: submitting ? 0.7 : 1,
                flexShrink: 0,
              }}>
                {submitting ? (
                  <><Loader2 size={14} className="spinner" /> Soumission…</>
                ) : (
                  <><Rocket size={14} /> Soumettre maintenant</>
                )}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button onClick={onBack} className="btn-secondary">
              <ArrowLeft size={13} /> Retour
            </button>
            <button className="btn-secondary">
              <Save size={13} /> Sauvegarder en brouillon
            </button>
          </div>
        </>
      )}

      {/* Success state */}
      {submitted && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div className="trophy-shine" style={{
            width: 100, height: 100, borderRadius: 28,
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
            color: C.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: `0 20px 40px -10px ${C.gold}`,
          }}>
            <Trophy size={48} />
          </div>
          <h3 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Soumis avec <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>succès !</em>
          </h3>
          <p style={{ fontSize: 14, color: C.inkSoft, margin: '0 0 24px' }}>
            Votre agent <strong style={{ color: C.ink }}>{agentData.name}</strong> est en review chez Orlode.
          </p>

          <div style={{
            background: C.creamDeep, borderRadius: 16, padding: 20,
            maxWidth: 500, margin: '0 auto 24px',
            border: `1.5px solid ${C.gold}30`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.08em', marginBottom: 12 }}>
              ⏱️ PROCHAINES ÉTAPES
            </div>
            {[
              { time: 'Jour 1-2', text: 'Review automatique (sécurité, performance)' },
              { time: 'Jour 2-5', text: 'Review humaine Orlode (qualité, contenu)' },
              { time: 'Jour 5-7', text: 'Notification résultat par email + WhatsApp' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.gold, minWidth: 80 }}>
                  {s.time}
                </span>
                <span style={{ fontSize: 13, color: C.ink }}>{s.text}</span>
              </div>
            ))}
          </div>

          <button onClick={onPublish} className="btn-primary">
            <Bot size={14} /> Voir mes agents
          </button>
        </div>
      )}
    </div>
  );
}

// ============ PAGE: BROUILLONS ============
function BrouillonsPage() {
  return (
    <>
      <PageHeader
        title="Brouillons,"
        italic="travail en cours."
        subtitle="Vos agents non finalisés · Sauvegarde auto · Reprise rapide"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <Edit3 size={11} /> 0 BROUILLONS
          </div>
        }
      />
      <div style={{ padding: '40px 32px', textAlign: 'center' }}>
        <div style={{
          background: C.cream, borderRadius: 24,
          padding: 60, border: `2px dashed ${C.violet}40`,
          maxWidth: 500, margin: '0 auto',
        }}>
          <Edit3 size={64} style={{ opacity: 0.3, marginBottom: 16, color: C.violet }} />
          <div className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
            Aucun brouillon
          </div>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
            Vos agents en cours de création apparaîtront ici. Vous pouvez sauvegarder à tout moment pour reprendre plus tard.
          </p>
        </div>
      </div>
    </>
  );
}

// ============ PAGE: TEMPLATES ============
function TemplatesPage() {
  const templates = [
    { name: 'Agent Restaurant', emoji: '🍽️', desc: 'Prise commandes + menu + gestion', industry: 'Restauration', color: C.orange, popular: true, africa: true },
    { name: 'Agent Immobilier', emoji: '🏠', desc: 'Annonces, visites, négociation', industry: 'Real Estate', color: C.emerald, popular: true, africa: true },
    { name: 'Agent Beauté', emoji: '💄', desc: 'Salon · RDV · catalogue produits', industry: 'Beauté', color: C.pink, popular: false, africa: false },
    { name: 'Agent Mode', emoji: '👗', desc: 'Boutique vêtements · stocks', industry: 'Fashion', color: C.violet, popular: false, africa: true },
    { name: 'Agent Construction', emoji: '🏗️', desc: 'Devis BTP · suivi chantier', industry: 'Construction', color: C.gold, popular: false, africa: true },
    { name: 'Agent Café', emoji: '☕', desc: 'Bar/Café · commandes · loyalty', industry: 'F&B', color: C.violetDeep, popular: false, africa: false },
    { name: 'Agent E-commerce', emoji: '🛒', desc: 'Boutique en ligne · paiement', industry: 'E-commerce', color: C.cyan, popular: true, africa: true },
    { name: 'Agent Formation', emoji: '🎓', desc: 'Cours · inscriptions · suivi', industry: 'Éducation', color: C.blue, popular: false, africa: false },
    { name: 'Agent Tourisme', emoji: '🌍', desc: 'Voyages · réservations · guide', industry: 'Tourisme', color: C.emeraldDeep, popular: false, africa: true },
  ];

  return (
    <>
      <PageHeader
        title="Templates,"
        italic="démarrer rapidement."
        subtitle="Templates prêts à personnaliser · Démarrage en 30 secondes"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <LayoutTemplate size={11} /> {templates.length} TEMPLATES
          </div>
        }
      />

      <div className="creator-section-bottom">
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {templates.map((t, idx) => (
            <div key={idx} style={{
              background: C.cream, borderRadius: 18,
              padding: 22, border: '1px solid rgba(10,42,32,0.06)',
              borderTop: `3px solid ${t.color}`,
              cursor: 'pointer', transition: 'all 0.3s ease',
              position: 'relative',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${t.color}40`; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >

              <div style={{
                width: 60, height: 60, borderRadius: 16,
                background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                color: C.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30,
                marginBottom: 14,
                boxShadow: `0 12px 24px -8px ${t.color}`,
              }}>
                {t.emoji}
              </div>

              <h4 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                {t.name}
              </h4>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 12px', lineHeight: 1.5 }}>{t.desc}</p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="pill" style={{ background: C.violetSoft, color: C.violetDeep, fontSize: 10 }}>
                  {t.industry}
                </span>
                {t.popular && (
                  <span className="pill" style={{ background: C.goldSoft, color: C.goldDeep, fontSize: 10 }}>
                    <Flame size={10} /> Populaire
                  </span>
                )}
              </div>

              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '10px', fontSize: 13 }}>
                <Sparkles size={13} fill={C.cream} /> Utiliser ce template
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============ PAGE: SYSTEM PROMPT (advanced editor) ============
function SystemPromptPage() {
  const { agents, loading, refresh } = useCreator();
  const [selectedId, setSelectedId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  // Default-select first agent
  useEffect(() => {
    if (!selectedId && agents.length > 0) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  // Load full agent details (with systemPrompt) when selection changes
  useEffect(() => {
    if (!selectedId) return;
    api.get(`/creator/agents/${selectedId}`)
      .then((r: any) => setPrompt(r?.data?.systemPrompt ?? r?.data?.data?.systemPrompt ?? ''))
      .catch(() => setPrompt(''));
  }, [selectedId]);

  const selected = agents.find((a: any) => a.id === selectedId);

  const handleSave = async () => {
    if (!selectedId || saving) return;
    setSaving(true);
    try {
      await api.put(`/creator/agents/${selectedId}`, { systemPrompt: prompt });
      toast.success('Prompt sauvegardé');
      refresh();
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  if (!loading && agents.length === 0) {
    return (
      <>
        <PageHeader
          title="System"
          italic="prompt editor."
          subtitle="Éditeur avancé · Variables dynamiques · Test en direct"
          leftPills={
            <div className="pill" style={{ background: C.gold, color: C.cream }}>
              <Code2 size={11} /> AUCUN AGENT
            </div>
          }
        />
        <div className="creator-section-bottom">
          <div style={{
            background: C.cream, borderRadius: 18, padding: 60,
            textAlign: 'center', color: C.inkSoft,
            border: '1px dashed rgba(10,42,32,0.12)',
          }}>
            <Code2 size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
              Aucun agent à éditer
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
              Créez d'abord un agent pour éditer son system prompt.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="System"
        italic="prompt editor."
        subtitle="Éditeur avancé · Variables dynamiques · Test en direct"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <Code2 size={11} /> {selected?.name ?? 'AGENT'} · v{selected?.version ?? '1.0.0'} · ~{Math.round(prompt.length / 4)} TOKENS
          </div>
        }
        actions={
          <>
            <button onClick={handleSave} disabled={saving || !selectedId} className="btn-primary">
              <Save size={14} /> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </>
        }
      />

      {/* Agent selector */}
      <div className="creator-section-mid">
        <div style={{
          background: C.cream, borderRadius: 14, padding: 14,
          border: '1px solid rgba(10,42,32,0.06)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>AGENT</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{
              flex: 1, minWidth: 200,
              padding: '8px 12px', fontSize: 13,
              background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
              borderRadius: 10, color: C.ink, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            {agents.map((a: any) => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name} (v{a.version})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="creator-section-mid">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }} className="responsive-charts">
          {/* Editor */}
          <div style={{
            background: '#0F172A', borderRadius: 16, overflow: 'hidden',
            border: `1.5px solid ${C.violet}40`,
          }}>
            <div style={{
              background: '#1E293B', padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid rgba(255,250,240,0.08)',
            }}>
              <Code2 size={14} color={C.violetLight} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.cream, fontFamily: 'JetBrains Mono, monospace' }}>
                system_prompt.txt
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <span className="mono-font" style={{ fontSize: 10, color: C.violetLight, fontWeight: 600 }}>
                  {prompt.length} chars · ~{Math.round(prompt.length / 4)} tokens
                </span>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              style={{
                width: '100%', minHeight: 480,
                background: '#0F172A', color: '#E2E8F0',
                border: 'none', outline: 'none', resize: 'vertical',
                padding: 20, fontSize: 13, lineHeight: 1.7,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>

          {/* Side panel — variables & metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Variables */}
            <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
                🔧 VARIABLES DISPONIBLES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { key: '{client.name}', desc: 'Nom du client' },
                  { key: '{client.phone}', desc: 'Téléphone' },
                  { key: '{date}', desc: 'Date actuelle' },
                  { key: '{agent.name}', desc: 'Nom agent' },
                  { key: '{user.id}', desc: 'ID utilisateur' },
                ].map((v, i) => (
                  <button key={i} onClick={() => setPrompt(prompt + ' ' + v.key)} style={{
                    background: C.creamDeep, border: 'none', cursor: 'pointer',
                    padding: '8px 10px', borderRadius: 8, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = C.violetSoft}
                  onMouseOut={e => e.currentTarget.style.background = C.creamDeep}
                  >
                    <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.violetDeep }}>{v.key}</span>
                    <span style={{ fontSize: 10, color: C.inkSoft }}>{v.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
                📊 MÉTRIQUES PROMPT
              </div>
              {[
                { label: 'Caractères', value: prompt.length, color: C.violet },
                { label: 'Tokens estimés', value: Math.round(prompt.length / 4), color: C.blue },
                { label: 'Lignes', value: prompt.split('\n').length, color: C.gold },
              ].map((m, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', fontSize: 12,
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(10,42,32,0.06)' : 'none',
                }}>
                  <span style={{ color: C.inkSoft, fontWeight: 600 }}>{m.label}</span>
                  <span className="mono-font" style={{ fontWeight: 800, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Tip card */}
            <div style={{
              background: `linear-gradient(135deg, ${C.violetSoft}, ${C.cream})`,
              border: `1.5px solid ${C.violet}30`,
              borderRadius: 14, padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Lightbulb size={14} color={C.violet} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.violetDeep }}>Astuce Claude 4.7</span>
              </div>
              <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, lineHeight: 1.5 }}>
                Plus votre prompt est <strong>structuré et précis</strong>, plus l'agent sera fiable. Cible : 800-1500 tokens optimal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
// ============ PAGE: VERSIONING ============
function VersioningPage() {
  const { agents, loading } = useCreator();
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (!selectedId && agents.length > 0) setSelectedId(agents[0].id);
  }, [agents, selectedId]);

  const selected = agents.find((a: any) => a.id === selectedId);
  // Server doesn't expose version history yet — show only the current version
  const versions = selected ? [
    { version: selected.version, date: selected.createdAt, status: selected.status === 'approved' ? 'live' : selected.status, author: 'Vous', changes: 'Version actuelle', users: selected.installs, current: true },
  ] : [];

  if (!loading && agents.length === 0) {
    return (
      <>
        <PageHeader
          title="Versioning,"
          italic="historique."
          subtitle="Versions · Changelog · Rollback · Beta testing"
          leftPills={
            <div className="pill" style={{ background: C.gold, color: C.cream }}>
              <GitBranch size={11} /> AUCUN AGENT
            </div>
          }
        />
        <div className="creator-section-bottom">
          <div style={{
            background: C.cream, borderRadius: 18, padding: 60,
            textAlign: 'center', color: C.inkSoft,
            border: '1px dashed rgba(10,42,32,0.12)',
          }}>
            <GitBranch size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
              Aucun historique
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
              Créez un agent pour suivre ses versions et déploiements.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Versioning,"
        italic="historique."
        subtitle="Versions · Changelog · Rollback · Beta testing"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <GitBranch size={11} /> {selected?.name ?? 'AGENT'} · v{selected?.version ?? '1.0.0'} {selected?.status === 'approved' ? 'LIVE' : ''}
          </div>
        }
      />

      {/* Agent selector */}
      <div className="creator-section-mid">
        <div style={{
          background: C.cream, borderRadius: 14, padding: 14,
          border: '1px solid rgba(10,42,32,0.06)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>AGENT</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{
              flex: 1, minWidth: 200,
              padding: '8px 12px', fontSize: 13,
              background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
              borderRadius: 10, color: C.ink, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            {agents.map((a: any) => (
              <option key={a.id} value={a.id}>{a.emoji} {a.name} (v{a.version})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="creator-section-mid">
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          {/* Versions timeline */}
          <div style={{
            background: C.cream, borderRadius: 20, padding: 24,
            border: '1px solid rgba(10,42,32,0.06)',
          }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Historique <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>des versions</em>
            </h3>

            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Timeline line */}
              <div style={{
                position: 'absolute', left: 8, top: 8, bottom: 8,
                width: 2, background: `linear-gradient(180deg, ${C.violet}, ${C.creamDeep})`,
              }}></div>

              {versions.map((v, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: 18, paddingLeft: 8 }}>
                  {/* Dot */}
                  <div style={{
                    position: 'absolute', left: -22, top: 6,
                    width: 16, height: 16, borderRadius: '50%',
                    background: v.current ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : C.creamDeep,
                    border: v.current ? 'none' : `2px solid ${C.inkLight}`,
                    boxShadow: v.current ? `0 0 0 4px ${C.violet}30` : 'none',
                  }}></div>

                  <div style={{
                    background: v.current ? `${C.violet}08` : C.creamDeep,
                    borderRadius: 12, padding: 14,
                    border: v.current ? `1.5px solid ${C.violet}40` : '1px solid rgba(10,42,32,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span className="mono-font display-font" style={{
                        fontSize: 18, fontWeight: 800, color: v.current ? C.violetDeep : C.ink,
                        letterSpacing: '-0.01em',
                      }}>v{v.version}</span>
                      {v.current && <span className="pill" style={{ background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`, color: C.cream }}>
                        <span className="live-dot" style={{ width: 6, height: 6, background: C.cream }}></span> LIVE
                      </span>}
                      {!v.current && <span className="pill" style={{ background: C.creamDeep, color: C.inkSoft }}>
                        <History size={10} /> Archivé
                      </span>}
                      <span style={{ fontSize: 10, color: C.inkSoft, marginLeft: 'auto' }}>
                        <Calendar size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                        {v.date}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 6 }}>
                      {v.changes}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
                      <span><User size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> {v.author}</span>
                      <span><Users2 size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> {v.users} utilisateurs</span>
                      {!v.current && (
                        <button style={{
                          marginLeft: 'auto', background: 'transparent',
                          border: `1px solid ${C.violet}40`, color: C.violetDeep,
                          padding: '4px 10px', borderRadius: 100,
                          fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                          <RotateCcw size={10} /> Rollback
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Beta testing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              background: `linear-gradient(135deg, ${C.violetDeep}, ${C.pink})`,
              borderRadius: 16, padding: 20,
              color: C.cream,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Beaker size={20} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>BETA TESTING</span>
              </div>
              <h4 className="display-font" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                Testez avant de publier
              </h4>
              <p style={{ fontSize: 12, opacity: 0.9, margin: '0 0 14px' }}>
                Invitez jusqu'à 10 beta testeurs pour valider votre prochaine version.
              </p>
              <button style={{
                background: C.cream, color: C.violetDeep,
                padding: '9px 16px', borderRadius: 10,
                border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Plus size={12} /> Inviter des testeurs
              </button>
            </div>

            <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
                📈 ÉVOLUTION
              </div>
              {[
                { label: 'Versions totales', value: '3', color: C.violet },
                { label: 'Beta testeurs', value: '0', color: C.gold },
                { label: 'Rollbacks', value: '0', color: C.red },
                { label: 'Score stabilité', value: '95%', color: C.emerald },
              ].map((m, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', fontSize: 12,
                  borderBottom: i < 3 ? '1px solid rgba(10,42,32,0.06)' : 'none',
                }}>
                  <span style={{ color: C.inkSoft, fontWeight: 600 }}>{m.label}</span>
                  <span className="mono-font" style={{ fontWeight: 800, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="creator-section-bottom">
        <div style={{
          background: C.cream, borderRadius: 20, padding: 24,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
            Comparaison <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>v0.9.5 vs v1.0.0</em>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { side: 'v0.9.5', changes: ['Prompt initial 850 tokens', 'Sans Mobile Money', '5 actions disponibles', 'WhatsApp seulement'], color: C.inkSoft, bg: C.creamDeep },
              { side: 'v1.0.0', changes: ['Prompt optimisé 1247 tokens (+47%)', 'Orange Money + MTN intégrés', '8 actions disponibles', 'WhatsApp + SMS + Email'], color: C.emeraldDeep, bg: C.emeraldSoft },
            ].map((v, i) => (
              <div key={i} style={{
                background: v.bg, borderRadius: 12, padding: 14,
                border: `1.5px solid ${v.color}40`,
              }}>
                <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: v.color, marginBottom: 10 }}>
                  {v.side}
                </div>
                {v.changes.map((c, j) => (
                  <div key={j} style={{ fontSize: 12, color: C.ink, padding: '6px 0', borderBottom: j < v.changes.length - 1 ? '1px solid rgba(10,42,32,0.05)' : 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {i === 1 ? <CheckCircle2 size={12} color={C.emeraldDeep} /> : <Minus size={12} color={C.inkLight} />}
                    {c}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ============ PAGE: CONNECTEURS (status overview) ============
function ConnecteursPage() {
  const connectors = [
    { name: 'WhatsApp Business', emoji: '💚', status: 'connected', usage: 1247, africa: true, color: C.emerald },
    { name: 'Telegram Bot', emoji: '💙', status: 'available', usage: 0, africa: false, color: C.blue },
    { name: 'Gmail', emoji: '📧', status: 'connected', usage: 89, africa: false, color: C.red },
    { name: 'Google Calendar', emoji: '📅', status: 'connected', usage: 156, africa: false, color: C.violet },
    { name: 'Google Drive', emoji: '📁', status: 'available', usage: 0, africa: false, color: C.gold },
    { name: 'Orange Money', emoji: '🟠', status: 'connected', usage: 23, africa: true, color: C.orange },
    { name: 'MTN Money', emoji: '🟡', status: 'available', usage: 0, africa: true, color: C.gold },
    { name: 'Wave', emoji: '🌊', status: 'available', usage: 0, africa: true, color: C.cyan },
    { name: 'CinetPay', emoji: '💳', status: 'available', usage: 0, africa: true, color: C.pink },
  ];

  const statusInfo = {
    connected: { label: 'Connecté', color: C.emeraldDeep, bg: C.emeraldSoft, icon: CheckCircle2 },
    available: { label: 'Disponible', color: C.violet, bg: C.violetSoft, icon: Plus },
    error: { label: 'Erreur', color: C.redDeep, bg: C.redSoft, icon: XCircle },
  };

  return (
    <>
      <PageHeader
        title="Connecteurs,"
        italic="intégrations."
        subtitle="9 connecteurs · 4 connectés · Mobile Money Africa-first · API Meta · Bot Telegram"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <Plug size={11} /> 4 / 9 CONNECTÉS · 5 DISPONIBLES
          </div>
        }
        actions={
          <button className="btn-primary"><Plus size={14} /> Ajouter intégration</button>
        }
      />

      {/* Stats */}
      <div className="creator-section-mid">
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Connecteurs actifs', value: '4', color: C.emerald, bg: C.emeraldSoft, icon: CheckCircle2 },
            { label: 'Requêtes ce mois', value: '1 515', color: C.violet, bg: C.violetSoft, icon: Activity },
            { label: 'Africa-first', value: '5', color: C.gold, bg: C.goldSoft, icon: Globe },
            { label: 'Disponibilité', value: '99.8%', color: C.cyan, bg: C.cyanSoft, icon: Zap },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{
                background: C.cream, borderRadius: 18, padding: 20,
                border: '1px solid rgba(10,42,32,0.06)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: s.bg, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div className="display-font" style={{
                  fontSize: 28, fontWeight: 800, color: C.ink,
                  letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4,
                }}>{s.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connectors list */}
      <div className="creator-section-bottom">
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          Tous les <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 18 }}>connecteurs</em>
        </h3>

        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {connectors.map((c, idx) => {
            const status = statusInfo[c.status];
            const StatusIcon = status.icon;
            return (
              <div key={idx} className="row-card" style={{ borderLeft: `4px solid ${c.color}` }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, flexShrink: 0,
                  boxShadow: `0 8px 16px -4px ${c.color}`,
                }}>
                  {c.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>
                      {c.name}
                    </span>
                    <div className="pill" style={{ background: status.bg, color: status.color }}>
                      <StatusIcon size={10} /> {status.label}
                    </div>
                    {c.popular && (
                      <span className="pill" style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream }}>
                        <Star size={9} fill={C.cream} /> POPULAIRE
                      </span>
                    )}
                  </div>
                  {c.status === 'connected' && (
                    <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
                      <Activity size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                      <span className="mono-font">{c.usage.toLocaleString('fr-FR')}</span> requêtes ce mois
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {c.status === 'connected' ? (
                    <>
                      <button className="icon-btn" title="Configurer"><Settings size={13} /></button>
                      <button className="icon-btn gold" title="Logs"><FileText size={13} /></button>
                    </>
                  ) : (
                    <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}>
                      <Plus size={12} /> Connecter
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE: SOUMETTRE ============
function SoumettrePage({ onTab }) {
  const { agents } = useCreator();
  const draftAgents = agents.filter((a: any) => a.status === 'draft' || a.status === 'rejected');
  const pending = agents.filter((a: any) => a.status === 'pending').length;
  const approved = agents.filter((a: any) => a.status === 'approved').length;
  const [submittingId, setSubmittingId] = useState<string>('');

  const handleSubmit = async (id: string) => {
    if (submittingId) return;
    setSubmittingId(id);
    try {
      const r = await api.post(`/creator/agents/${id}/submit`);
      const data = (r as any)?.data?.data ?? (r as any)?.data;
      if (data?.status === 'approved') {
        toast.success('Agent approuvé', `Score ${data.score ?? '—'}/100`);
      } else if (data?.status === 'rejected') {
        toast.error('Agent rejeté', data?.feedback ?? 'Voir les critères de qualité');
      } else {
        toast.success('Agent soumis', 'Review en cours');
      }
    } catch (e: any) {
      toast.error('Échec de la soumission', e?.response?.data?.message ?? '');
    } finally {
      setSubmittingId('');
    }
  };

  return (
    <>
      <PageHeader
        title="Soumettre,"
        italic="à validation."
        subtitle="Process de validation · Critères qualité · Délai 2-7 jours"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <PackageCheck size={11} /> {pending} EN REVIEW · {approved} APPROUVÉ{approved > 1 ? 'S' : ''}
          </div>
        }
      />

      <div className="creator-section-bottom">
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          {/* Drafts to submit */}
          <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Mes <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>brouillons</em>
            </h3>

            {draftAgents.length === 0 ? (
              <div style={{
                padding: 28, textAlign: 'center', color: C.inkSoft,
                fontSize: 13, border: '1px dashed rgba(10,42,32,0.12)',
                borderRadius: 12,
              }}>
                Aucun brouillon à soumettre. Créez un agent pour commencer.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftAgents.map((agent: any) => (
                  <div key={agent.id} style={{
                    padding: 14, background: C.creamDeep, borderRadius: 12,
                    borderLeft: `3px solid ${agent.color}`,
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  }}>
                    <div style={{ fontSize: 28 }}>{agent.emoji}</div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{agent.name}</div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>
                        {agent.status === 'rejected' ? 'Rejeté · à corriger' : 'Brouillon'} · v{agent.version}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSubmit(agent.id)}
                      disabled={!!submittingId}
                      className="btn-primary"
                      style={{ padding: '8px 14px', fontSize: 12 }}
                    >
                      {submittingId === agent.id ? <Loader2 size={12} className="spin" /> : <Rocket size={12} />}
                      {submittingId === agent.id ? 'Soumission…' : 'Soumettre'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Quality criteria reference */}
            <div style={{
              marginTop: 18, paddingTop: 18,
              borderTop: '1px solid rgba(10,42,32,0.06)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
                ✓ CRITÈRES DE VALIDATION (vérifiés par l'IA)
              </div>
              {[
                { title: 'Identité claire', desc: 'Nom + description + icône + couleur cohérents' },
                { title: 'System prompt structuré', desc: 'Min 200 tokens, rôle clair' },
                { title: 'Capacités définies', desc: 'Au moins 1 outil/action déclaré' },
                { title: 'Pricing cohérent', desc: 'Prix raisonnable vs valeur apportée' },
                { title: 'Sécurité', desc: 'Pas de prompts dangereux' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <CheckCircle2 size={13} color={C.emerald} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Process timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              background: `linear-gradient(135deg, ${C.violetDeep}, ${C.pink})`,
              borderRadius: 16, padding: 20, color: C.cream,
            }}>
              <div className="display-font" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, marginBottom: 6 }}>
                Validation IA
              </div>
              <div style={{ fontSize: 13, opacity: 0.95, marginBottom: 12 }}>
                Score qualité ≥ 70 → approuvé automatiquement.<br />
                Score &lt; 40 → rejeté avec feedback.
              </div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                ✓ Le score est calculé en direct sur la qualité de votre agent.
              </div>
            </div>

            <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
                ⏱️ PROCESS VALIDATION
              </div>
              {[
                { time: 'Jour 1-2', label: 'Review automatique', desc: 'Sécurité + performance', icon: Shield, color: C.cyan },
                { time: 'Jour 2-5', label: 'Review humaine', desc: 'Équipe Orlode · qualité', icon: User, color: C.violet },
                { time: 'Jour 5-7', label: 'Notification', desc: 'Email + WhatsApp', icon: Mail, color: C.gold },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: `${s.color}15`, color: s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={14} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="mono-font" style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: '0.05em' }}>{s.time}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={() => onTab('Créer un agent')} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }}>
            <Rocket size={16} /> Soumettre un nouvel agent à validation
          </button>
        </div>
      </div>
    </>
  );
}

// ============ PAGE: MES PUBLICATIONS ============
function MesPublicationsPage() {
  const { agents, loading } = useCreator();
  const published = agents.filter(a => a.status === 'approved');
  const totalInstalls = published.reduce((s, a) => s + (a.installs ?? 0), 0);
  return (
    <>
      <PageHeader
        title="Mes"
        italic="publications."
        subtitle="Agents en ligne dans le marketplace · Performance · Visibilité · Promotion"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <Store size={11} /> {published.length} PUBLIÉ{published.length > 1 ? 'S' : ''} · {totalInstalls} INSTALL{totalInstalls !== 1 ? 'S' : ''}
          </div>
        }
      />

      <div className="creator-section-bottom">
        {loading && published.length === 0 && (
          <div style={{
            background: C.cream, borderRadius: 18, padding: 40,
            textAlign: 'center', color: C.inkSoft, fontSize: 13,
            border: '1px solid rgba(10,42,32,0.06)',
          }}>
            <Loader2 size={28} className="spin" style={{ marginBottom: 10, opacity: 0.5 }} />
            <div>Chargement…</div>
          </div>
        )}

        {!loading && published.length === 0 && (
          <div style={{
            background: C.cream, borderRadius: 18, padding: 60,
            textAlign: 'center', color: C.inkSoft,
            border: '1px dashed rgba(10,42,32,0.12)',
          }}>
            <Store size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>
              Aucune publication
            </h3>
            <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
              Vos agents apparaîtront ici une fois approuvés et publiés sur le marketplace.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {published.map((agent: any) => (
            <div key={agent.id} style={{
              background: C.cream, borderRadius: 20, padding: 24,
              border: '1px solid rgba(10,42,32,0.06)',
              borderLeft: `4px solid ${agent.color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 18,
                  background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`,
                  color: C.cream,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, flexShrink: 0,
                  boxShadow: `0 12px 24px -8px ${agent.color}`,
                }}>
                  {agent.emoji}
                </div>

                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>{agent.name}</span>
                    <span className="pill" style={{ background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`, color: C.cream }}>
                      <span className="live-dot" style={{ width: 6, height: 6, background: C.cream }}></span> LIVE MARKETPLACE
                    </span>
                    <span className="mono-font pill" style={{ background: C.violetSoft, color: C.violetDeep, fontSize: 10 }}>v{agent.version}</span>
                  </div>
                  <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 14px', lineHeight: 1.5 }}>
                    {agent.desc}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Vues', value: String(agent.views ?? 0), icon: Eye, color: C.violet },
                      { label: 'Installs', value: String(agent.installs), icon: Download, color: C.blue },
                      { label: 'Note', value: agent.rating ? agent.rating.toFixed(1) : '—', icon: Star, color: C.gold },
                      { label: 'Reviews', value: String(agent.reviews), icon: MessageCircle, color: C.pink },
                    ].map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <div key={i} style={{ background: C.creamDeep, padding: 10, borderRadius: 10, textAlign: 'center' }}>
                          <Icon size={14} color={s.color} style={{ margin: '0 auto 4px', display: 'block' }} />
                          <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{s.value}</div>
                          <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, marginTop: 2 }}>{s.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <a
                      href={`/marketplace?agent=${agent.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ padding: '8px 14px', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Eye size={12} /> Voir page publique
                    </a>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/marketplace?agent=${agent.id}`;
                        navigator.clipboard.writeText(url).then(() => toast.success('Lien copié'));
                      }}
                      className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}
                    >
                      <Share2 size={12} /> Partager
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {published.length > 0 && (
          <div style={{
            marginTop: 14,
            border: `2px dashed ${C.violet}40`,
            borderRadius: 18, padding: 24,
            textAlign: 'center',
            background: 'rgba(124, 58, 237, 0.04)',
          }}>
            <Boxes size={36} style={{ opacity: 0.4, marginBottom: 8, color: C.violet }} />
            <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
              Publiez plus d'agents
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>
              Plus vous publiez, plus vous gagnez.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE: REVIEWS ============
function ReviewsPage() {
  return (
    <>
      <PageHeader
        title="Reviews,"
        italic="feedback users."
        subtitle="Notes · Commentaires · Réponses · Suggestions d'amélioration"
        leftPills={
          <div className="pill" style={{ background: C.gold, color: C.cream }}>
            <Star size={11} /> 0 REVIEWS · NOTE 0.0
          </div>
        }
      />

      <div className="creator-section-bottom">
        {/* Hero score */}
        <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
          <div className="grain" style={{
            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
            borderRadius: 20, padding: 28,
            color: C.cream, position: 'relative', overflow: 'hidden',
            textAlign: 'center',
          }}>
            <Star size={120} style={{
              position: 'absolute', right: -20, top: -20,
              opacity: 0.2,
            }} fill={C.cream} />
            <div style={{ position: 'relative' }}>
              <div className="display-font" style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, marginBottom: 8, letterSpacing: '-0.04em' }}>
                <span className="mono-font">0.0</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={20} fill="rgba(255,250,240,0.3)" stroke="rgba(255,250,240,0.5)" />
                ))}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 600 }}>
                Aucune review pour l'instant
              </div>
            </div>
          </div>

          <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
              Distribution <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 16 }}>des notes</em>
            </h3>
            {[5, 4, 3, 2, 1].map(stars => (
              <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, minWidth: 30 }}>
                  {stars} ⭐
                </span>
                <div className="progress-bar" style={{ flex: 1, height: 12 }}>
                  <div className="progress-fill" style={{ width: '0%', background: C.gold }}></div>
                </div>
                <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, minWidth: 30, textAlign: 'right' }}>
                  0
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        <div style={{
          marginTop: 16,
          background: C.cream, borderRadius: 20,
          padding: 60, border: '1px solid rgba(10,42,32,0.06)',
          textAlign: 'center',
        }}>
          <MessageCircle size={64} style={{ opacity: 0.3, marginBottom: 16, color: C.gold }} />
          <div className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
            Pas encore de reviews
          </div>
          <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Les reviews apparaîtront ici dès que vos premiers utilisateurs auront installé et utilisé votre agent. Répondez aux feedbacks pour construire votre réputation créateur.
          </p>
          <div style={{
            display: 'inline-block',
            background: `${C.gold}15`, padding: '10px 18px',
            borderRadius: 12, border: `1.5px solid ${C.gold}40`,
            fontSize: 12, color: C.goldDeep, fontWeight: 600,
          }}>
            <Lightbulb size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Astuce : Les agents avec démo vidéo reçoivent 4× plus d'installs
          </div>
        </div>
      </div>
    </>
  );
}

// ============ DATA PROVIDER ============
function CreatorDataProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<CreatorData['earnings']>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [fiscal, setFiscal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const safe = (p: Promise<any>) => p.catch(() => null);
    const [agentsRes, earningsRes, withdrawalsRes, fiscalRes] = await Promise.all([
      safe(api.get('/creator/agents')),
      safe(api.get('/creator/earnings')),
      safe(api.get('/creator/withdrawals')),
      safe(api.get('/creator/kyc/fiscal-info')),
    ]);
    const rawAgents = Array.isArray(agentsRes?.data?.data) ? agentsRes.data.data : (Array.isArray(agentsRes?.data) ? agentsRes.data : []);
    setAgents(rawAgents.map(mapServerAgent));
    setEarnings(earningsRes?.data?.data ?? null);
    const wd = Array.isArray(withdrawalsRes?.data?.data) ? withdrawalsRes.data.data : [];
    setWithdrawals(wd);
    setFiscal(fiscalRes?.data?.data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const value = useMemo<CreatorData>(() => ({
    loading, agents, earnings, withdrawals, fiscal, refresh: fetchAll,
  }), [loading, agents, earnings, withdrawals, fiscal, fetchAll]);

  return <CreatorCtx.Provider value={value}>{children}</CreatorCtx.Provider>;
}

// ============ MAIN APP — orchestrator ============
export default function CreatorPortalRedesignPage() {
  return (
    <CreatorDataProvider>
      <CreatorPortalInner />
    </CreatorDataProvider>
  );
}

function CreatorPortalInner() {
  const [activeTab, setActiveTab] = useState('Accueil');

  const renderPage = () => {
    switch(activeTab) {
      case 'Accueil':         return <AccueilPage onTab={setActiveTab} />;
      case 'Mes agents':      return <MesAgentsPage onTab={setActiveTab} />;
      case 'Analytics':       return <AnalyticsPage />;
      case 'Revenus':         return <RevenusPage />;
      case 'Créer un agent':  return <CreerAgentPage onBack={() => setActiveTab('Mes agents')} />;
      case 'Brouillons':      return <BrouillonsPage />;
      case 'Templates':       return <TemplatesPage />;
      case 'System Prompt':   return <SystemPromptPage />;
      case 'Test Sandbox':    return <CreerAgentPage onBack={() => setActiveTab('Accueil')} />;
      case 'Versioning':      return <VersioningPage />;
      case 'Connecteurs':     return <ConnecteursPage />;
      case 'Soumettre':       return <SoumettrePage onTab={setActiveTab} />;
      case 'Mes publications':return <MesPublicationsPage />;
      case 'Reviews':         return <ReviewsPage />;
      default:                return <AccueilPage onTab={setActiveTab} />;
    }
  };

  return (
    <Chrome active={activeTab} setActive={setActiveTab}>
      {renderPage()}
    </Chrome>
  );
}

// ============ Lucide List icon (used in Personnalité step) ============
function List({ size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}
