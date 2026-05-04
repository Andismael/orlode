import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  Search, Bell, ChevronDown, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, ArrowUp,
  LayoutDashboard, MessageSquare, MessageCircle, Bot, UsersRound, Briefcase, Calendar,
  Store, Crown, Hammer, Plug, Settings, Shield, LogOut, Plus, Minus, Sparkles, Send,
  X, Heart, ShoppingCart, BookmarkCheck, Bookmark, Star, Flame, Zap, Clock, Eye, Download,
  CheckCircle2, XCircle, AlertCircle, Info, Filter, Tag, FileText, File,
  Brain, BookOpen, Library, Lightbulb, Network, Database, Cpu, Globe,
  TrendingUp, BarChart3, Activity, PieChart, Layers, Boxes, Package,
  Upload, FolderOpen, Folder, FilePlus, Edit3, Save, Copy, Share2, ExternalLink,
  RefreshCw, Loader2, CheckCheck, Code2, Hash, AtSign, Mail, Link as LinkIcon,
  ArrowUpRight, ChevronUp, MoreHorizontal, Settings2, Sliders, GitBranch,
  Image, Video, Music, FileSpreadsheet, FileCode, FileImage, Paperclip,
  Pin, PinOff, Archive, Trash2, History, Quote, Compass, Award, Gem,
  Headphones, BookMarked, ScrollText, Telescope, Radar, Atom,
} from 'lucide-react';

// ============ PALETTE — KNOWLEDGE (Cerveau Cosmique) ============
const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',

  // PRIMARY — Indigo cosmique (cerveau, savoir)
  indigo:      '#4338CA',
  indigoDeep:  '#3730A3',
  indigoDark:  '#312E81',
  indigoSoft:  '#E0E7FF',
  indigoLight: '#A5B4FC',

  // ACCENT 1 — Cyan électrique (synapses, data flow)
  cyan:        '#06B6D4',
  cyanDeep:    '#0891B2',
  cyanDark:    '#155E75',
  cyanSoft:    '#CFFAFE',
  cyanLight:   '#67E8F9',

  // ACCENT 2 — Or (pépites de connaissance)
  gold:        '#D4A017',
  goldDeep:    '#B45309',
  goldSoft:    '#FEF3C7',

  // ACCENT 3 — Rose néon (interactif, AI moments)
  pink:        '#F472B6',
  pinkDeep:    '#DB2777',
  pinkSoft:    '#FCE7F3',

  // Semantic
  emerald:     '#10B981',
  emeraldSoft: '#D1FAE5',
  emeraldDeep: '#059669',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  redDeep:     '#DC2626',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  blue:        '#0EA5E9',
  blueSoft:    '#E0F2FE',
  blueDeep:    '#0284C7',
  violet:      '#7C3AED',
  violetSoft:  '#EDE9FE',
  violetDeep:  '#5B21B6',

  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

// ============ KNOWLEDGE SUB-PAGES ============
const KNOWLEDGE_PAGES = [
  // CONNAISSANCE
  { id: 'home',       label: 'Accueil',         icon: Brain,        group: 'CONNAISSANCE' },
  { id: 'chat',       label: 'Chat Q&A',        icon: MessageCircle, group: 'CONNAISSANCE' },
  { id: 'library',    label: 'Bibliothèque',    icon: Library,      group: 'CONNAISSANCE' },
  // INTELLIGENCE
  { id: 'graph',      label: 'Knowledge Graph', icon: Network,      group: 'INTELLIGENCE' },
  { id: 'insights',   label: 'Insights',        icon: Telescope,    group: 'INTELLIGENCE' },
  { id: 'generate',   label: 'Génération',      icon: Sparkles,     group: 'INTELLIGENCE' },
  // GESTION
  { id: 'sources',    label: 'Sources',         icon: Database,     group: 'GESTION' },
  { id: 'index',      label: 'Indexation',      icon: Layers,       group: 'GESTION' },
  { id: 'settings',   label: 'Paramètres',      icon: Settings2,    group: 'GESTION' },
];

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
    background: ${C.indigo}; color: ${C.cream};
    box-shadow: 0 8px 24px -8px ${C.indigo};
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
    background: ${C.indigo}; color: ${C.cream}; border-color: ${C.indigo};
    transform: translateY(-1px);
  }

  .btn-primary {
    background: linear-gradient(135deg, ${C.indigo} 0%, ${C.cyan} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.indigo};
    font-family: inherit;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.indigo};
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
    background: ${C.cream}; color: ${C.indigoDeep};
    border: 1.5px solid rgba(10,42,32,0.1);
    padding: 11px 18px; border-radius: 12px;
    font-weight: 600; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease; font-family: inherit;
  }
  .btn-secondary:hover {
    background: ${C.indigoDeep}; color: ${C.cream}; border-color: ${C.indigoDeep};
  }

  .icon-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: ${C.indigoSoft}; color: ${C.indigoDeep};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all 0.2s ease;
    flex-shrink: 0;
  }
  .icon-btn:hover { background: ${C.indigoDeep}; color: ${C.cream}; }
  .icon-btn.cyan { background: ${C.cyanSoft}; color: ${C.cyanDeep}; }
  .icon-btn.cyan:hover { background: ${C.cyan}; color: ${C.cream}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDeep}; }
  .icon-btn.gold:hover { background: ${C.gold}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.redSoft}; color: ${C.redDeep}; }
  .icon-btn.danger:hover { background: ${C.redDeep}; color: ${C.cream}; }

  .avatar {
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Fraunces', serif; font-weight: 700;
    color: ${C.cream}; flex-shrink: 0;
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
    border-color: ${C.indigo};
    background: ${C.cream};
    box-shadow: 0 0 0 4px ${C.indigo}15;
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

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; }
  .stagger > *:nth-child(2) { animation-delay: 0.08s; }
  .stagger > *:nth-child(3) { animation-delay: 0.11s; }
  .stagger > *:nth-child(4) { animation-delay: 0.14s; }
  .stagger > *:nth-child(5) { animation-delay: 0.17s; }
  .stagger > *:nth-child(6) { animation-delay: 0.20s; }
  .stagger > *:nth-child(7) { animation-delay: 0.23s; }
  .stagger > *:nth-child(8) { animation-delay: 0.26s; }

  /* === Knowledge specific animations === */

  /* Synapse fire — neuron firing in graph */
  @keyframes synapseFire {
    0%   { stroke-opacity: 0.15; stroke-dashoffset: 100; }
    50%  { stroke-opacity: 0.85; stroke-dashoffset: 50; }
    100% { stroke-opacity: 0.15; stroke-dashoffset: 0; }
  }
  .synapse-fire {
    stroke-dasharray: 4 6;
    animation: synapseFire 2.5s ease-in-out infinite;
  }

  /* Node pulse — node breathing */
  @keyframes nodePulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px currentColor); }
    50%      { transform: scale(1.08); filter: drop-shadow(0 0 14px currentColor); }
  }
  .node-pulse { animation: nodePulse 3s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }

  /* Shimmer text */
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }
  .shimmer-text {
    background: linear-gradient(90deg, ${C.indigo} 0%, ${C.cyan} 30%, ${C.gold} 60%, ${C.indigo} 100%);
    background-size: 1000px 100%;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 6s linear infinite;
  }

  /* Floating particles */
  @keyframes float {
    0%, 100% { transform: translateY(0) translateX(0); }
    25% { transform: translateY(-12px) translateX(8px); }
    50% { transform: translateY(-20px) translateX(0); }
    75% { transform: translateY(-12px) translateX(-8px); }
  }
  .float-1 { animation: float 6s ease-in-out infinite; }
  .float-2 { animation: float 7s ease-in-out infinite 1s; }
  .float-3 { animation: float 8s ease-in-out infinite 2s; }
  .float-4 { animation: float 9s ease-in-out infinite 0.5s; }

  /* Card lift */
  .card-lift {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .card-lift:hover { transform: translateY(-4px); }

  /* Brain wave */
  @keyframes brainWave {
    0%   { transform: scaleY(1); opacity: 0.6; }
    50%  { transform: scaleY(1.4); opacity: 1; }
    100% { transform: scaleY(1); opacity: 0.6; }
  }
  .brain-wave-bar { animation: brainWave 1.2s ease-in-out infinite; transform-origin: center bottom; }

  /* Spin */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spinner { animation: spin 1s linear infinite; }

  /* Slow rotate */
  @keyframes slowRotate {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .slow-rotate { animation: slowRotate 60s linear infinite; transform-origin: center; }

  /* Typing indicator */
  @keyframes typing {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30%           { opacity: 1; transform: translateY(-4px); }
  }
  .type-1 { animation: typing 1.4s ease-in-out infinite; }
  .type-2 { animation: typing 1.4s ease-in-out infinite 0.2s; }
  .type-3 { animation: typing 1.4s ease-in-out infinite 0.4s; }

  /* Sparkle float */
  @keyframes sparkleFloat {
    0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.6; }
    25% { transform: translate(8px, -12px) rotate(90deg); opacity: 1; }
    50% { transform: translate(0, -20px) rotate(180deg); opacity: 0.8; }
    75% { transform: translate(-8px, -12px) rotate(270deg); opacity: 1; }
  }
  .sparkle-1 { animation: sparkleFloat 4s ease-in-out infinite; }
  .sparkle-2 { animation: sparkleFloat 5s ease-in-out infinite 1s; }
  .sparkle-3 { animation: sparkleFloat 6s ease-in-out infinite 2s; }

  /* Fade in */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .fade-in { animation: fadeIn 0.2s ease-out; }
  .scale-in { animation: scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

  /* Knowledge tab */
  .k-tab {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 10px;
    color: ${C.onGreenSoft}; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.2s ease;
    background: transparent; border: 1px solid transparent;
    font-family: inherit; width: 100%; text-align: left;
  }
  .k-tab:hover {
    background: rgba(255,250,240,0.04);
    color: ${C.cream};
  }
  .k-tab.active {
    background: linear-gradient(90deg, ${C.indigo}30, transparent);
    color: ${C.cream};
    border-left: 2px solid ${C.cyan};
    padding-left: 12px;
  }
  .k-tab.active .k-tab-icon {
    background: linear-gradient(135deg, ${C.indigo}, ${C.cyan});
    color: ${C.cream};
  }
  .k-tab-icon {
    width: 28px; height: 28px; border-radius: 8px;
    background: rgba(255,250,240,0.06);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.2s ease;
  }

  .scroll-hide::-webkit-scrollbar { display: none; }
  .scroll-hide { scrollbar-width: none; }

  .mobile-menu-btn { display: none; }

  @media (max-width: 1280px) {
    .knowledge-sidebar { width: 220px !important; }
  }

  @media (max-width: 1024px) {
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-charts { grid-template-columns: 1fr !important; }
  }

  @media (max-width: 900px) {
    .knowledge-sidebar { display: none !important; }
  }

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
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .responsive-grid-3 { grid-template-columns: 1fr !important; }
    .hero-title { font-size: 32px !important; }
    .hide-on-mobile { display: none !important; }
  }

  @media (max-width: 480px) {
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .responsive-grid-3 { grid-template-columns: 1fr !important; }
    .hero-title { font-size: 26px !important; }
  }
`;

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

// ============ CHROME ============
function Chrome({ children, currentPage, setCurrentPage }: any) {
  const { documents, lastSync } = useKnowledgeData();
  const groups = ['CONNAISSANCE', 'INTELLIGENCE', 'GESTION'];
  const syncMin = lastSync ? Math.floor((Date.now() - lastSync.getTime()) / 60000) : null;

  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* KNOWLEDGE SIDEBAR (sub-navigation) — sidebar/header globaux gérés par le layout corpmind-ai */}
        <aside className="knowledge-sidebar" style={{
          width: 240, background: C.greenDark,
          borderRight: '1px solid rgba(255,250,240,0.06)',
          padding: '24px 14px',
          display: 'flex', flexDirection: 'column',
          flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
        }}>
          {/* Knowledge brand */}
          <div style={{ padding: '0 6px 16px', marginBottom: 12, borderBottom: '1px solid rgba(255,250,240,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: `linear-gradient(135deg, ${C.indigo} 0%, ${C.cyan} 50%, ${C.gold} 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.cream, position: 'relative',
                boxShadow: `0 10px 24px -8px ${C.indigo}`,
              }}>
                <Brain size={22} strokeWidth={2} />
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: C.gold, border: `2px solid ${C.greenDark}`,
                }}></div>
              </div>
              <div>
                <div className="display-font" style={{ fontWeight: 700, fontSize: 18, color: C.cream, letterSpacing: '-0.02em' }}>
                  Knowledge
                </div>
                <div style={{ fontSize: 10, color: C.cyanLight, letterSpacing: '0.08em', fontWeight: 600 }}>
                  ◆ CORE AGENT
                </div>
              </div>
            </div>
          </div>

          {/* Tabs by group */}
          <div style={{ overflowY: 'auto' }} className="scroll-hide">
            {groups.map(group => (
              <div key={group} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.onGreenSoft, padding: '0 8px 6px' }}>
                  {group}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {KNOWLEDGE_PAGES.filter(p => p.group === group).map(page => {
                    const Icon = page.icon;
                    const active = currentPage === page.id;
                    return (
                      <button key={page.id} className={`k-tab ${active ? 'active' : ''}`} onClick={() => setCurrentPage(page.id)}>
                        <div className="k-tab-icon">
                          <Icon size={14} />
                        </div>
                        <span>{page.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Brain status */}
          <div style={{
            marginTop: 'auto',
            background: `linear-gradient(135deg, ${C.indigoDeep}30, ${C.cyanDeep}30)`,
            border: `1px solid ${C.indigo}40`,
            borderRadius: 12, padding: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div className="live-dot"></div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: C.cream }}>
                BRAIN STATUS
              </span>
            </div>
            <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.cream, lineHeight: 1, marginBottom: 4 }}>
              Online · {documents.length} doc{documents.length > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 10, color: C.onGreenSoft }}>
              {syncMin === null ? 'Sync…' : syncMin < 1 ? 'Sync à l\'instant' : `Sync il y a ${syncMin} min`}
            </div>
            {/* Mini brain wave */}
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 14, marginTop: 8 }}>
              {[3, 7, 5, 10, 6, 9, 4, 8, 5, 11, 6, 9].map((h, i) => (
                <div key={i} className="brain-wave-bar" style={{
                  width: 2, height: h,
                  background: `linear-gradient(180deg, ${C.cyan}, ${C.indigo})`,
                  borderRadius: 1, animationDelay: `${i * 0.1}s`,
                }}></div>
              ))}
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>
          {children}
        </main>
      </div>
    </div>
  );
}
// ============ PAGE: ACCUEIL ============
function HomePage() {
  const { documents, queries, loading } = useKnowledgeData();
  const docCount = documents.length;
  const queryCount = queries.length;
  // Compute real trending tags from documents (tag occurrences)
  const trendingTags = (() => {
    const counts = new Map<string, number>();
    for (const d of documents) {
      const tags: string[] = Array.isArray(d?.tags) ? d.tags : (Array.isArray(d?.keywords) ? d.keywords : []);
      for (const t of tags) {
        const key = String(t).trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const palette = [C.indigo, C.cyan, C.emerald, C.gold, C.pink, C.violet];
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count], i) => ({ name, count, color: palette[i % palette.length] }));
  })();
  return (
    <div style={{ padding: 32 }}>
      {/* HERO */}
      <div className="grain" style={{
        background: `linear-gradient(135deg, ${C.indigoDark} 0%, ${C.indigo} 40%, ${C.cyanDeep} 80%, ${C.cyan} 100%)`,
        borderRadius: 28, padding: '40px 44px',
        position: 'relative', overflow: 'hidden',
        color: C.cream,
        marginBottom: 24,
        boxShadow: `0 30px 60px -20px ${C.indigo}80`,
      }}>
        {/* Slow rotating circle pattern */}
        <svg className="slow-rotate" style={{ position: 'absolute', right: -100, top: -100, opacity: 0.18 }} width="500" height="500" viewBox="0 0 500 500">
          <circle cx="250" cy="250" r="240" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="250" cy="250" r="180" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="250" cy="250" r="120" stroke={C.cyanLight} strokeWidth="1.5" fill="none" />
          <circle cx="250" cy="250" r="60" stroke={C.gold} strokeWidth="2" fill="none" />
          {/* Orbital dots */}
          <circle cx="490" cy="250" r="6" fill={C.gold} />
          <circle cx="250" cy="10" r="4" fill={C.cyanLight} />
          <circle cx="370" cy="370" r="5" fill={C.pink} />
        </svg>

        {/* Floating particles */}
        <div className="float-1" style={{ position: 'absolute', top: 60, right: 280, width: 8, height: 8, borderRadius: '50%', background: C.gold, boxShadow: `0 0 14px ${C.gold}` }}></div>
        <div className="float-2" style={{ position: 'absolute', top: 140, right: 480, width: 6, height: 6, borderRadius: '50%', background: C.cyanLight, boxShadow: `0 0 12px ${C.cyanLight}` }}></div>
        <div className="float-3" style={{ position: 'absolute', top: 220, right: 350, width: 5, height: 5, borderRadius: '50%', background: C.pink, boxShadow: `0 0 10px ${C.pink}` }}></div>
        <div className="float-4" style={{ position: 'absolute', top: 100, right: 180, width: 7, height: 7, borderRadius: '50%', background: C.cream, boxShadow: `0 0 14px ${C.cream}` }}></div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
          <div style={{ flex: 1, minWidth: 320, maxWidth: 580 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div className="pill" style={{ background: C.gold, color: C.cream }}>
                <Brain size={11} /> CORE AGENT · 11 SKILLS
              </div>
              <div className="pill" style={{ background: 'rgba(255,250,240,0.2)', color: C.cream }}>
                <div className="live-dot" style={{ background: C.cream }}></div> En ligne
              </div>
            </div>

            <h1 className="display-font hero-title" style={{
              fontSize: 52, fontWeight: 800, lineHeight: 1.0, margin: '0 0 14px',
              color: C.cream, letterSpacing: '-0.03em',
            }}>
              Le <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>cerveau</em><br/>
              de votre entreprise.
            </h1>

            <p style={{ fontSize: 15, color: 'rgba(255,250,240,0.92)', margin: '0 0 24px', maxWidth: 480, lineHeight: 1.55 }}>
              {loading ? (
                <span style={{ opacity: 0.7 }}>Chargement de votre cerveau…</span>
              ) : docCount === 0 ? (
                <><strong style={{ color: C.gold }}>Aucun document indexé.</strong> Uploadez des documents pour activer Q&A et insights.</>
              ) : (
                <><strong style={{ color: C.cyanLight }}>{docCount} document{docCount > 1 ? 's' : ''} indexé{docCount > 1 ? 's' : ''}</strong> · <strong style={{ color: C.gold }}>{queryCount} question{queryCount > 1 ? 's' : ''}</strong> · Toutes vos données, comprises et accessibles instantanément.</>
              )}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button style={{
                background: C.cream, color: C.indigoDeep,
                padding: '14px 24px', borderRadius: 12,
                border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)',
              }}>
                <MessageCircle size={15} /> Poser une question
              </button>
              <button style={{
                background: 'rgba(255,250,240,0.15)',
                backdropFilter: 'blur(20px)',
                border: '1.5px solid rgba(255,250,240,0.3)',
                color: C.cream,
                padding: '14px 24px', borderRadius: 12,
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <Network size={14} /> Voir le graph
              </button>
            </div>

            {/* Mini stats inline */}
            <div style={{ display: 'flex', gap: 22, marginTop: 24, flexWrap: 'wrap' }}>
              {[
                { label: String(docCount), sub: docCount > 1 ? 'docs indexés' : 'doc indexé', color: C.cyanLight },
                { label: String(queryCount), sub: queryCount > 1 ? 'questions' : 'question', color: C.gold },
                { label: docCount > 0 ? '—' : '—', sub: 'précision', color: C.pink },
                { label: '—', sub: 'tokens/jour', color: C.cream },
              ].map((s, i) => (
                <div key={i}>
                  <div className="display-font mono-font" style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,250,240,0.75)', fontWeight: 500, marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* MINI GRAPH PREVIEW */}
          <div style={{
            background: 'rgba(255,250,240,0.08)',
            backdropFilter: 'blur(30px)',
            border: '1.5px solid rgba(255,250,240,0.2)',
            borderRadius: 22, padding: 20,
            minWidth: 280, position: 'relative',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.cyanLight, letterSpacing: '0.08em', marginBottom: 4 }}>
              ◆ KNOWLEDGE GRAPH
            </div>
            <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.cream, marginBottom: 12 }}>
              Aperçu du réseau
            </div>

            <svg viewBox="0 0 280 200" style={{ width: '100%', height: 180 }}>
              <defs>
                <radialGradient id="miniNode1">
                  <stop offset="0%" stopColor={C.cyanLight} />
                  <stop offset="100%" stopColor={C.cyanDeep} />
                </radialGradient>
                <radialGradient id="miniNode2">
                  <stop offset="0%" stopColor={C.gold} />
                  <stop offset="100%" stopColor={C.goldDeep} />
                </radialGradient>
                <radialGradient id="miniNode3">
                  <stop offset="0%" stopColor={C.pink} />
                  <stop offset="100%" stopColor={C.pinkDeep} />
                </radialGradient>
              </defs>

              {/* Edges */}
              {[
                ['140,100', '60,40'], ['140,100', '220,40'], ['140,100', '60,160'],
                ['140,100', '220,160'], ['140,100', '40,100'], ['140,100', '240,100'],
                ['60,40', '220,40'], ['60,160', '220,160'],
              ].map(([from, to], i) => {
                const [x1, y1] = from.split(',');
                const [x2, y2] = to.split(',');
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    className="synapse-fire"
                    stroke={C.cyanLight} strokeWidth="1.2" strokeOpacity="0.4"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                );
              })}

              {/* Center node (concept) */}
              <circle cx="140" cy="100" r="18" fill={C.gold} className="node-pulse" style={{ color: C.gold }} />
              <text x="140" y="104" fontSize="9" fill={C.cream} textAnchor="middle" fontWeight="700">RH</text>

              {/* Outer nodes */}
              {[
                { x: 60, y: 40, fill: 'url(#miniNode1)', label: 'Manuel' },
                { x: 220, y: 40, fill: 'url(#miniNode3)', label: 'Process' },
                { x: 60, y: 160, fill: 'url(#miniNode1)', label: 'Onboard' },
                { x: 220, y: 160, fill: 'url(#miniNode2)', label: 'Conformité' },
                { x: 40, y: 100, fill: 'url(#miniNode2)', label: 'Stratégie' },
                { x: 240, y: 100, fill: 'url(#miniNode3)', label: 'Pitch' },
              ].map((n, i) => (
                <g key={i} className="node-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
                  <circle cx={n.x} cy={n.y} r="10" fill={n.fill} />
                  <text x={n.x} y={n.y + 22} fontSize="7" fill={C.cream} textAnchor="middle" fontWeight="600" opacity="0.85">{n.label}</text>
                </g>
              ))}
            </svg>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,250,240,0.7)', marginTop: 6 }}>
              <span><span className="mono-font" style={{ fontWeight: 700 }}>13</span> nœuds</span>
              <span><span className="mono-font" style={{ fontWeight: 700 }}>24</span> connexions</span>
              <span style={{ color: C.cyanLight, fontWeight: 700 }}>Voir détails →</span>
            </div>
          </div>
        </div>
      </div>

      {/* STATS DETAILED */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Documents indexés',     value: String(docCount),               sub: docCount === 0 ? 'Uploadez vos premiers docs' : 'Pinecone · Gemini embeddings', color: C.indigo,  bg: C.indigoSoft, icon: FileText, accent: '#4338CA' },
          { label: 'Questions posées',      value: String(queryCount),             sub: queryCount === 0 ? 'Aucune question encore' : 'Total conversations Q&A', color: C.cyan,    bg: C.cyanSoft,   icon: MessageCircle, accent: '#06B6D4' },
          { label: 'Précision moyenne',     value: '—',                            sub: 'À mesurer après usage',                color: C.gold,    bg: C.goldSoft,   icon: Award, accent: '#D4A017' },
          { label: 'Tokens consommés',      value: '—',                            sub: 'Aujourd\'hui',                          color: C.pink,    bg: C.pinkSoft,   icon: Cpu, accent: '#F472B6' },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="card-lift" style={{
              background: C.cream, borderRadius: 18, padding: 18,
              border: '1px solid rgba(10,42,32,0.06)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.accent }}></div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: stat.bg, color: stat.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <div className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep, fontSize: 10 }}>
                  <TrendingUp size={9} /> Live
                </div>
              </div>
              <div className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 4 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{stat.label}</div>
              <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>{stat.sub}</div>
            </div>
          );
        })}
      </div>

      {/* RECENT QUERIES + TRENDING */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 24 }} className="responsive-charts">
        {/* Recent queries */}
        <div style={{
          background: C.cream, borderRadius: 20, padding: 24,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
                Questions <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.indigo }}>récentes</em>
              </h3>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '2px 0 0' }}>
                Les 5 dernières interrogations à votre cerveau
              </p>
            </div>
            <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
              <History size={13} /> Historique
            </button>
          </div>

          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {queries.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: C.inkSoft }}>
                <MessageCircle size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p style={{ fontSize: 13, margin: '0 0 4px', fontWeight: 600, color: C.ink }}>Aucune question pour l'instant</p>
                <p style={{ fontSize: 11, margin: 0 }}>Posez votre première question dans Chat Q&A pour démarrer.</p>
              </div>
            )}
            {queries.map((q: any, idx: number) => (
              <div key={q.id} style={{
                background: C.creamDeep, borderRadius: 14,
                padding: 14, border: `1px solid rgba(67,56,202,0.08)`,
                display: 'flex', gap: 12, alignItems: 'flex-start',
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.borderColor = C.indigo; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.borderColor = 'rgba(67,56,202,0.08)'; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: `linear-gradient(135deg, ${C.indigo}, ${C.cyan})`,
                  color: C.cream,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <MessageCircle size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>
                      « {q.title || q.query || 'Sans titre'} »
                    </div>
                  </div>
                  {q.lastMessage && (
                    <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 6px', lineHeight: 1.5 }}>
                      {q.lastMessage}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: C.inkLight, fontWeight: 500, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> {q.updatedAt ? new Date(q.updatedAt).toLocaleString('fr-FR') : (q.time || '—')}
                    </span>
                    {q.messagesCount && (<>
                      <span>·</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <MessageCircle size={10} /> {q.messagesCount} messages
                      </span>
                    </>)}
                  </div>
                </div>
                <ChevronRight size={16} color={C.inkLight} style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Trending tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: C.cream, borderRadius: 20, padding: 24,
            border: '1px solid rgba(10,42,32,0.06)',
          }}>
            <div style={{ marginBottom: 14 }}>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
                Sujets <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>trending</em>
              </h3>
              <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
                Cette semaine
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trendingTags.length === 0 ? (
                <div style={{ fontSize: 12, color: C.inkLight, textAlign: 'center', padding: '20px 0' }}>
                  Aucun tag pour l'instant. Ajoute des tags à tes documents pour les voir ici.
                </div>
              ) : trendingTags.map((tag, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: C.creamDeep,
                  borderRadius: 10, transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${tag.color}`,
                }}
                onMouseOver={e => e.currentTarget.style.background = `${tag.color}10`}
                onMouseOut={e => e.currentTarget.style.background = C.creamDeep}
                >
                  <Hash size={14} color={tag.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>
                      {tag.name}
                    </div>
                  </div>
                  <span className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>
                    {tag.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Insight card */}
          <div style={{
            background: `linear-gradient(135deg, ${C.gold}15, ${C.indigo}10)`,
            borderRadius: 16, padding: 18,
            border: `1.5px dashed ${C.gold}50`,
            position: 'relative',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11,
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`,
                color: C.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 6px 16px -4px ${C.gold}`,
              }}>
                <Lightbulb size={18} />
              </div>
              <div>
                <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4, letterSpacing: '-0.01em' }}>
                  Insight IA <span style={{ fontSize: 9, color: C.goldDeep, letterSpacing: '0.08em', verticalAlign: 'middle', marginLeft: 4 }}>◆ NOUVEAU</span>
                </div>
                <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 10px', lineHeight: 1.5 }}>
                  Vos employés cherchent souvent des infos sur la <strong style={{ color: C.indigo }}>conformité</strong> mais aucun document récent n'existe sur la <strong>fiscalité 2026</strong>.
                </p>
                <button style={{
                  background: 'transparent', color: C.goldDeep,
                  border: `1.5px solid ${C.gold}`,
                  padding: '6px 12px', borderRadius: 8,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  Indexer ce thème <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{
        background: C.cream, borderRadius: 20, padding: 24,
        border: '1px solid rgba(10,42,32,0.06)',
      }}>
        <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Actions <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyan }}>rapides</em>
        </h3>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 16px' }}>
          Skills disponibles immédiatement
        </p>

        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { name: 'Rechercher', desc: 'Dans tous les documents',  icon: Search,    color: C.indigo,  bg: C.indigoSoft },
            { name: 'Résumer',    desc: 'Synthèse d\'un document',   icon: ScrollText, color: C.cyan,    bg: C.cyanSoft },
            { name: 'Extraire',   desc: 'Données structurées',       icon: Layers,    color: C.gold,    bg: C.goldSoft },
            { name: 'Indexer',    desc: 'Ajouter du contenu',        icon: Upload,    color: C.pink,    bg: C.pinkSoft },
            { name: 'Q&A',        desc: 'Poser une question',        icon: MessageCircle, color: C.violet, bg: C.violetSoft },
            { name: 'Générer',    desc: 'Créer un document',         icon: Sparkles,  color: C.emerald, bg: C.emeraldSoft },
            { name: 'Comparer',   desc: 'Mettre en parallèle',       icon: GitBranch, color: C.blue,    bg: C.blueSoft },
            { name: 'Tagger',     desc: 'Auto-classification',       icon: Tag,       color: C.yellow,  bg: C.yellowSoft },
          ].map((action, i) => {
            const Icon = action.icon;
            return (
              <button key={i} className="card-lift" style={{
                background: C.creamDeep, borderRadius: 14,
                padding: 16, border: '1px solid rgba(10,42,32,0.04)',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: action.bg, color: action.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{action.name}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.3 }}>{action.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// ============ PAGE: CHAT Q&A ============
function ChatQAPage() {
  const { documents } = useKnowledgeData();
  const docCount = documents.length;
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      content: docCount === 0
        ? 'Bonjour ! Je suis le cerveau de votre entreprise. Pour répondre à vos questions, vous devez d\'abord indexer des documents (onglet **Sources**).'
        : `Bonjour ! Je suis le cerveau de votre entreprise. Posez-moi n'importe quelle question sur vos ${docCount} document${docCount > 1 ? 's' : ''} indexé${docCount > 1 ? 's' : ''}.`,
      time: 'à l\'instant',
    },
  ]);
  const [input, setInput] = useState('');
  const [convId, setConvId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages(m => [...m, { role: 'user', content, time: now }]);
    setInput('');
    setSending(true);
    try {
      let id = convId;
      if (!id) {
        const created: any = await api.post('/chat/conversations', { agentId: 'knowledge', title: content.slice(0, 60) });
        id = created?.data?.id ?? created?.data?.conversationId ?? null;
        if (id) setConvId(id);
      }
      if (id) {
        const res: any = await api.post(`/chat/conversations/${id}/messages`, { content, agentId: 'knowledge' });
        const reply = res?.data?.reply || res?.data?.message || res?.data?.text;
        const replyText = typeof reply === 'string' ? reply : (reply?.content || reply?.text || 'Pas de réponse.');
        setMessages(m => [...m, { role: 'assistant', content: replyText, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', content: 'Erreur : conversation impossible à créer.', time: now }]);
      }
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: 'Erreur de connexion. Réessayez dans un instant.', time: now }]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    'Combien de clients actifs avons-nous ?',
    'Quel est le délai légal de préavis ?',
    'Résume le rapport financier d\'octobre',
    'Comparer la stratégie Q4 et la roadmap 2026',
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 73px)' }}>
      {/* Header */}
      <div style={{
        background: C.cream, borderRadius: 18, padding: '18px 22px',
        border: '1px solid rgba(10,42,32,0.06)',
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 13,
          background: `linear-gradient(135deg, ${C.indigo}, ${C.cyan})`,
          color: C.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 8px 20px -6px ${C.indigo}`,
          position: 'relative',
        }}>
          <Brain size={22} />
          <div className="live-dot" style={{ position: 'absolute', bottom: -2, right: -2, border: `2px solid ${C.cream}` }}></div>
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
            Knowledge <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.indigo }}>Q&A</em>
          </h3>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: '2px 0 0' }}>
            Connecté à <strong>12 documents</strong> · Modèle <strong>Gemini 2.5 Pro</strong> · Réponses sourcées
          </p>
        </div>
        <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}>
          <Plus size={13} /> Nouvelle session
        </button>
      </div>

      {/* Messages */}
      <div className="scroll-hide" style={{
        flex: 1, overflowY: 'auto',
        background: C.cream, borderRadius: 18, padding: 24,
        border: '1px solid rgba(10,42,32,0.06)',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{
              display: 'flex', gap: 12,
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: m.role === 'user'
                  ? `linear-gradient(135deg, ${C.indigoDeep}, ${C.indigo})`
                  : `linear-gradient(135deg, ${C.indigo}, ${C.cyan})`,
                color: C.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 13, fontWeight: 700,
                fontFamily: 'Fraunces, serif',
              }}>
                {m.role === 'user' ? 'A' : <Brain size={18} />}
              </div>
              <div style={{ maxWidth: '85%', flex: m.role === 'assistant' ? 1 : 'none' }}>
                <div style={{
                  background: m.role === 'user' ? `linear-gradient(135deg, ${C.indigo}, ${C.cyan})` : C.creamDeep,
                  color: m.role === 'user' ? C.cream : C.ink,
                  padding: '14px 18px',
                  borderRadius: m.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  fontSize: 14, lineHeight: 1.55,
                  boxShadow: m.role === 'user' ? `0 8px 20px -8px ${C.indigo}` : 'none',
                }}>
                  {m.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} style={{ color: m.role === 'user' ? C.gold : C.indigoDeep }}>{part}</strong> : part)}
                </div>

                {/* Structured response */}
                {m.structured && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {m.structured.map((s, i) => (
                      <div key={i} style={{
                        background: C.creamDeep, borderRadius: 12,
                        padding: 14, display: 'flex', gap: 12,
                        borderLeft: `3px solid ${C.indigo}`,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 10,
                          background: `linear-gradient(135deg, ${C.indigo}, ${C.cyan})`,
                          color: C.cream,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 13, fontWeight: 700,
                        }}>
                          {s.step}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                            {s.title}
                          </div>
                          <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>
                            {s.desc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sources */}
                {m.sources && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
                      📎 SOURCES CITÉES ({m.sources.length})
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {m.sources.map((s, i) => (
                        <div key={i} style={{
                          background: C.cream,
                          padding: '8px 12px', borderRadius: 10,
                          border: `1px solid ${C.indigo}30`,
                          display: 'flex', alignItems: 'center', gap: 8,
                          cursor: 'pointer', transition: 'all 0.2s ease',
                        }}
                        onMouseOver={e => e.currentTarget.style.borderColor = C.indigo}
                        onMouseOut={e => e.currentTarget.style.borderColor = `${C.indigo}30`}
                        >
                          <span style={{ fontSize: 18 }}>{s.emoji}</span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{s.name}</div>
                            <div className="mono-font" style={{ fontSize: 9, color: C.inkSoft }}>
                              {s.page} · Confiance {s.confidence}%
                            </div>
                          </div>
                          <ExternalLink size={11} color={C.inkLight} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons for assistant */}
                {m.role === 'assistant' && idx > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {[
                      { icon: Copy, label: 'Copier' },
                      { icon: Share2, label: 'Partager' },
                      { icon: BookmarkCheck, label: 'Sauvegarder' },
                      { icon: ArrowUpRight, label: 'Approfondir' },
                    ].map((a, i) => {
                      const Icon = a.icon;
                      return (
                        <button key={i} style={{
                          background: 'transparent',
                          border: '1px solid rgba(10,42,32,0.1)',
                          padding: '5px 10px', borderRadius: 8,
                          fontSize: 11, color: C.inkSoft,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          <Icon size={11} /> {a.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div style={{ fontSize: 10, color: C.inkLight, marginTop: 6, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                  {m.time}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Suggestions */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px dashed ${C.inkLight}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
            💡 SUGGESTIONS POUR ALLER PLUS LOIN
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => handleSend(s)} style={{
                background: C.creamDeep, color: C.indigoDeep,
                border: `1px solid ${C.indigo}30`,
                padding: '8px 14px', borderRadius: 100,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.2s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.background = C.indigo; e.currentTarget.style.color = C.cream; }}
              onMouseOut={e => { e.currentTarget.style.background = C.creamDeep; e.currentTarget.style.color = C.indigoDeep; }}
              >
                <Sparkles size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div style={{
        background: C.cream, borderRadius: 18, padding: 14,
        border: `1.5px solid ${C.indigo}30`,
        display: 'flex', alignItems: 'flex-end', gap: 10,
        boxShadow: `0 8px 24px -10px ${C.indigo}30`,
      }}>
        <button className="icon-btn cyan">
          <Paperclip size={16} />
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={docCount === 0 ? "Indexez des documents pour pouvoir poser des questions" : "Posez votre question…"}
          rows={1}
          disabled={sending}
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent',
            fontSize: 14, color: C.ink, fontFamily: 'inherit',
            resize: 'none', padding: '10px 0', lineHeight: 1.5,
            minHeight: 24, maxHeight: 120,
          }}
        />
        <button onClick={() => handleSend()} disabled={sending || !input.trim()} className="btn-primary" style={{ padding: '10px 14px', fontSize: 13, opacity: sending || !input.trim() ? 0.5 : 1, cursor: sending || !input.trim() ? 'not-allowed' : 'pointer' }}>
          {sending ? <Loader2 size={14} className="spinner" /> : <Send size={14} />} {sending ? 'Envoi…' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
}

// ============ PAGE: BIBLIOTHEQUE ============
function LibraryPage() {
  const { documents, loading } = useKnowledgeData();
  const [view, setView] = useState('grid');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Use real documents from API; fallback to empty (NOT mock) when no data
  const sourceList = documents.length > 0 ? documents : [];
  const filtered = sourceList.filter((d: any) => {
    if (filter === 'pinned' && !d.pinned) return false;
    if (filter === 'trending' && !d.trending) return false;
    if (filter !== 'all' && filter !== 'pinned' && filter !== 'trending' && d.type !== filter) return false;
    if (search && !(d.name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const typeIcons = {
    pdf: FileText, docx: FileText, pptx: Image, xlsx: FileSpreadsheet,
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Bibliothèque</em>
          </h2>
          <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
            <strong style={{ color: C.cream }}>{sourceList.length}</strong> document{sourceList.length > 1 ? 's' : ''} indexé{sourceList.length > 1 ? 's' : ''} ·{' '}
            <strong style={{ color: C.gold }}>{sourceList.reduce((s: number, d: any) => s + (d.queries ?? 0), 0)}</strong> requête{sourceList.reduce((s: number, d: any) => s + (d.queries ?? 0), 0) !== 1 ? 's' : ''} totale{sourceList.reduce((s: number, d: any) => s + (d.queries ?? 0), 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="quick-action">
            <RefreshCw size={13} /> Resync
          </button>
          <button className="btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>
            <Upload size={14} /> Ajouter un doc
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{
        background: C.cream, borderRadius: 14, padding: '10px 14px',
        border: '1px solid rgba(10,42,32,0.06)',
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 18,
      }}>
        {/* Search */}
        <div style={{
          flex: 1, minWidth: 200,
          background: C.creamDeep, borderRadius: 10,
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Search size={14} color={C.inkSoft} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrer par nom, tag, auteur…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 13, color: C.ink,
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'inline-flex', gap: 3, background: C.creamDeep, padding: 3, borderRadius: 10 }}>
          {[
            { id: 'all',      label: 'Tous',     icon: Layers },
            { id: 'pinned',   label: 'Épinglés', icon: Pin },
            { id: 'trending', label: 'Trending', icon: Flame },
            { id: 'pdf',      label: 'PDF',      icon: FileText },
            { id: 'docx',     label: 'Word',     icon: FileText },
            { id: 'pptx',     label: 'PPT',      icon: Image },
          ].map(f => {
            const Icon = f.icon;
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', borderRadius: 8,
                background: active ? `linear-gradient(135deg, ${C.indigo}, ${C.cyan})` : 'transparent',
                color: active ? C.cream : C.inkSoft,
                border: 'none', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Icon size={11} /> {f.label}
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div style={{ display: 'inline-flex', gap: 2, background: C.creamDeep, padding: 2, borderRadius: 8 }}>
          <button onClick={() => setView('grid')} style={{
            padding: 7, borderRadius: 6,
            background: view === 'grid' ? C.indigo : 'transparent',
            color: view === 'grid' ? C.cream : C.inkSoft,
            border: 'none', cursor: 'pointer', display: 'flex',
          }}><LayoutDashboard size={13} /></button>
          <button onClick={() => setView('list')} style={{
            padding: 7, borderRadius: 6,
            background: view === 'list' ? C.indigo : 'transparent',
            color: view === 'list' ? C.cream : C.inkSoft,
            border: 'none', cursor: 'pointer', display: 'flex',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Documents */}
      {filtered.length === 0 ? (
        <div style={{
          background: C.cream, borderRadius: 20, padding: 60,
          textAlign: 'center', border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: 12, color: C.inkLight }} />
          <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
            Aucun document trouvé
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft }}>
            Essayez d'ajuster vos filtres
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {filtered.map(doc => {
            const TypeIcon = typeIcons[doc.type] || FileText;
            return (
              <div key={doc.id} className="card-lift" style={{
                background: C.cream, borderRadius: 18, overflow: 'hidden',
                border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer',
                position: 'relative',
              }}>
                {/* Top bar */}
                <div style={{ height: 5, background: doc.color }}></div>

                <div style={{ padding: 18 }}>
                  {/* Header with emoji + actions */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: `linear-gradient(135deg, ${doc.color}, ${doc.color}cc)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26, flexShrink: 0,
                      boxShadow: `0 8px 16px -4px ${doc.color}`,
                    }}>{doc.emoji}</div>

                    <div style={{ display: 'flex', gap: 4, flexDirection: 'column', alignItems: 'flex-end' }}>
                      {doc.pinned && (
                        <Pin size={14} fill={C.gold} color={C.gold} />
                      )}
                      {doc.trending && (
                        <Flame size={14} color={C.pinkDeep} fill={C.pink} />
                      )}
                    </div>
                  </div>

                  {/* Name */}
                  <h4 className="display-font" style={{
                    fontSize: 15, fontWeight: 700, color: C.ink,
                    margin: '0 0 6px', letterSpacing: '-0.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    minHeight: 36,
                  }}>
                    {doc.name}
                  </h4>

                  {/* Tags */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                    {doc.tags.slice(0, 2).map((t, i) => (
                      <span key={i} style={{
                        fontSize: 10, fontWeight: 600,
                        background: C.creamDeep, color: C.indigoDeep,
                        padding: '2px 7px', borderRadius: 6,
                      }}>#{t}</span>
                    ))}
                  </div>

                  {/* Meta */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)',
                    fontSize: 11, color: C.inkSoft,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <TypeIcon size={11} />
                      <span className="mono-font" style={{ fontWeight: 700 }}>
                        {doc.type.toUpperCase()}
                      </span>
                      <span>·</span>
                      <span>{doc.pages}p</span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.indigoDeep, fontWeight: 700 }}>
                      <MessageCircle size={11} />
                      <span className="mono-font">{doc.queries}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 10, color: C.inkLight, marginTop: 6,
                  }}>
                    <span>{doc.source}</span>
                    <span>·</span>
                    <span>{doc.author}</span>
                    <span>·</span>
                    <span>{doc.updated}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(doc => {
            const TypeIcon = typeIcons[doc.type] || FileText;
            return (
              <div key={doc.id} style={{
                background: C.cream, borderRadius: 12,
                padding: 12, border: '1px solid rgba(10,42,32,0.06)',
                borderLeft: `3px solid ${doc.color}`,
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = `0 8px 20px -10px ${doc.color}40`; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: `linear-gradient(135deg, ${doc.color}, ${doc.color}cc)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>{doc.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{doc.name}</span>
                    {doc.pinned && <Pin size={11} color={C.gold} fill={C.gold} />}
                    {doc.trending && <Flame size={11} color={C.pinkDeep} fill={C.pink} />}
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: C.inkSoft, flexWrap: 'wrap' }}>
                    <span className="mono-font">{doc.type.toUpperCase()}</span>
                    <span>· {doc.pages}p</span>
                    <span>· {doc.size}</span>
                    <span>· {doc.source}</span>
                    <span>· {doc.updated}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <span style={{
                    background: C.indigoSoft, color: C.indigoDeep,
                    padding: '4px 10px', borderRadius: 8,
                    fontSize: 11, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <MessageCircle size={11} /> <span className="mono-font">{doc.queries}</span>
                  </span>
                </div>
                <ChevronRight size={16} color={C.inkLight} style={{ flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ============ PAGE: KNOWLEDGE GRAPH ============
function GraphPage() {
  const { documents } = useKnowledgeData();
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [selectedConcept, setSelectedConcept] = useState('all');

  // Build the concept→doc graph from real documents.
  // Each unique tag becomes a "concept" central node; documents are leaf nodes
  // connected to the tags they carry. Doc colors come from a palette by tag.
  const palette = [C.indigo, C.cyan, C.emerald, C.gold, C.pink, C.violet, '#0EA5E9', '#EF4444'];
  const tagCounts = new Map<string, number>();
  for (const d of documents) {
    const tags: string[] = Array.isArray((d as any)?.tags) ? (d as any).tags : [];
    for (const t of tags) tagCounts.set(String(t), (tagCounts.get(String(t)) ?? 0) + 1);
  }
  const topTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const tagColor = new Map<string, string>(topTags.map(([t], i) => [t, palette[i % palette.length]]));

  const concepts = [
    { id: 'all', label: 'Tout', color: C.indigo, count: documents.length },
    ...topTags.map(([name, count], i) => ({ id: `tag_${i}`, label: name, color: tagColor.get(name) ?? palette[i % palette.length], count })),
  ];

  // Layout: concepts spaced around the center, docs around their primary tag.
  const W = 800, H = 580;
  const conceptNodes = topTags.map(([name], i) => {
    const angle = (i / Math.max(1, topTags.length)) * 2 * Math.PI;
    const radius = topTags.length > 1 ? 200 : 0;
    return {
      id: `c_${i}`, label: name, type: 'concept' as const,
      x: W / 2 + Math.cos(angle) * radius,
      y: H / 2 + Math.sin(angle) * radius,
      color: tagColor.get(name) ?? palette[i % palette.length],
      size: 36 + Math.min(16, (tagCounts.get(name) ?? 0) * 2),
    };
  });

  const docNodes = documents.slice(0, 24).map((d: any, idx: number) => {
    const tags: string[] = Array.isArray(d?.tags) ? d.tags : [];
    const primaryTagIdx = topTags.findIndex(([t]) => tags.includes(t));
    const conceptIdx = primaryTagIdx >= 0 ? primaryTagIdx : (idx % Math.max(1, topTags.length));
    const conceptCx = conceptNodes[conceptIdx]?.x ?? W / 2;
    const conceptCy = conceptNodes[conceptIdx]?.y ?? H / 2;
    const docsForConcept = Math.max(1, documents.filter((dd: any) => Array.isArray(dd?.tags) && topTags[conceptIdx] && dd.tags.includes(topTags[conceptIdx][0])).length);
    const localIdx = idx % docsForConcept;
    const localAngle = (localIdx / docsForConcept) * 2 * Math.PI;
    const localR = 110;
    return {
      id: `n_${idx}`,
      label: (d?.title ?? d?.name ?? 'Document').slice(0, 22),
      type: 'doc' as const,
      x: conceptCx + Math.cos(localAngle) * localR,
      y: conceptCy + Math.sin(localAngle) * localR,
      color: conceptNodes[conceptIdx]?.color ?? C.indigo,
      size: 18 + Math.min(20, (d?.queries ?? d?.viewCount ?? 0) / 5),
      queries: d?.queries ?? d?.viewCount ?? 0,
    };
  });

  const nodes = [...docNodes, ...conceptNodes];

  // Edges: each doc → its concepts (max 1 primary).
  const edges: { from: string; to: string }[] = [];
  documents.slice(0, 24).forEach((d: any, idx: number) => {
    const tags: string[] = Array.isArray(d?.tags) ? d.tags : [];
    const primaryTagIdx = topTags.findIndex(([t]) => tags.includes(t));
    if (primaryTagIdx >= 0) edges.push({ from: `n_${idx}`, to: `c_${primaryTagIdx}` });
  });
  // Concepts ring (each concept connected to next)
  for (let i = 0; i < conceptNodes.length; i++) {
    edges.push({ from: `c_${i}`, to: `c_${(i + 1) % conceptNodes.length}` });
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="pill" style={{ background: `${C.cyan}15`, color: C.cyanLight, border: `1px solid ${C.cyan}40`, marginBottom: 8 }}>
            <Network size={11} /> KNOWLEDGE GRAPH · INTERACTIVE
          </div>
          <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Le <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>réseau neuronal</em><br/>de votre savoir.
          </h2>
          <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0', maxWidth: 540 }}>
            Visualisation des connexions sémantiques entre vos documents et concepts. Chaque pulsation = une consultation récente.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="quick-action">
            <Download size={13} /> Export PNG
          </button>
          <button className="quick-action">
            <Settings2 size={13} /> Paramètres
          </button>
        </div>
      </div>

      {/* Concept filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {concepts.map(c => {
          const active = selectedConcept === c.id;
          return (
            <button key={c.id} onClick={() => setSelectedConcept(c.id)} style={{
              background: active ? `linear-gradient(135deg, ${c.color}, ${c.color}cc)` : 'rgba(255,250,240,0.06)',
              color: active ? C.cream : C.cream,
              padding: '8px 14px', borderRadius: 100,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: active ? 'none' : '1px solid rgba(255,250,240,0.12)',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: active ? `0 6px 16px -4px ${c.color}` : 'none',
              transition: 'all 0.2s ease',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }}></div>
              {c.label}
              <span className="mono-font" style={{ fontSize: 10, opacity: 0.85 }}>({c.count})</span>
            </button>
          );
        })}
      </div>

      {/* Graph viewport */}
      <div style={{
        background: `linear-gradient(135deg, ${C.indigoDark}40, ${C.greenDark} 70%)`,
        borderRadius: 24, padding: 0,
        border: '1px solid rgba(255,250,240,0.06)',
        position: 'relative', overflow: 'hidden',
        height: 620,
      }}>
        {/* Background grid */}
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.06 }} width="100%" height="100%">
          <defs>
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.cream} strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridPattern)" />
        </svg>

        {/* Hover info card */}
        {hoveredNode && (
          <div className="fade-in" style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(10,42,32,0.85)',
            backdropFilter: 'blur(20px)',
            border: `1.5px solid ${hoveredNode.color}`,
            borderRadius: 14, padding: 14,
            color: C.cream, minWidth: 220, zIndex: 5,
            boxShadow: `0 12px 32px -8px ${hoveredNode.color}40`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: hoveredNode.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.cream, flexShrink: 0,
              }}>
                {hoveredNode.type === 'concept' ? <Atom size={14} /> : <FileText size={14} />}
              </div>
              <div className="display-font" style={{ fontSize: 14, fontWeight: 700 }}>
                {hoveredNode.label}
              </div>
            </div>
            <div className="pill" style={{
              background: hoveredNode.type === 'concept' ? C.gold : 'rgba(255,250,240,0.15)',
              color: hoveredNode.type === 'concept' ? C.cream : C.cream,
              fontSize: 9, marginBottom: 8,
            }}>
              {hoveredNode.type === 'concept' ? '◆ CONCEPT CENTRAL' : '◇ DOCUMENT'}
            </div>
            {hoveredNode.queries !== undefined && (
              <div style={{ fontSize: 11, color: 'rgba(255,250,240,0.75)' }}>
                <strong style={{ color: C.cyanLight }} className="mono-font">{hoveredNode.queries}</strong> consultations
              </div>
            )}
          </div>
        )}

        {/* The graph */}
        <svg viewBox="0 0 900 620" style={{ width: '100%', height: '100%' }}>
          <defs>
            <radialGradient id="nodeBlue" cx="30%" cy="30%">
              <stop offset="0%" stopColor={C.cyanLight} />
              <stop offset="100%" stopColor={C.indigo} />
            </radialGradient>
            <radialGradient id="nodeGold" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor={C.goldDeep} />
            </radialGradient>
            <radialGradient id="conceptGrad" cx="30%" cy="30%">
              <stop offset="0%" stopColor={C.cream} stopOpacity="0.95" />
              <stop offset="50%" stopColor={C.gold} />
              <stop offset="100%" stopColor={C.goldDeep} />
            </radialGradient>
            <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const from = nodes.find(n => n.id === e.from);
            const to = nodes.find(n => n.id === e.to);
            if (!from || !to) return null;
            const isConcept = to.type === 'concept' || from.type === 'concept';
            return (
              <line
                key={i}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={isConcept ? C.gold : C.cyanLight}
                strokeWidth={isConcept ? 1.5 : 1}
                className="synapse-fire"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n, i) => {
            const isConcept = n.type === 'concept';
            return (
              <g
                key={n.id}
                className="node-pulse"
                style={{ animationDelay: `${i * 0.15}s`, color: n.color }}
                onMouseEnter={() => setHoveredNode(n)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Outer halo */}
                <circle cx={n.x} cy={n.y} r={n.size + 6} fill={n.color} opacity="0.15" />

                {/* Main node */}
                <circle
                  cx={n.x} cy={n.y} r={n.size}
                  fill={isConcept ? 'url(#conceptGrad)' : n.color}
                  stroke={isConcept ? C.cream : 'none'}
                  strokeWidth={isConcept ? 2 : 0}
                  filter="url(#nodeGlow)"
                  style={{ cursor: 'pointer' }}
                />

                {/* Icon for concepts */}
                {isConcept && (
                  <text x={n.x} y={n.y + 4} fontSize="14" fill={C.indigoDeep} textAnchor="middle" fontWeight="800">
                    ◆
                  </text>
                )}

                {/* Label */}
                <text
                  x={n.x} y={n.y + n.size + 14}
                  fontSize={isConcept ? 13 : 10}
                  fontWeight={isConcept ? 700 : 600}
                  fill={C.cream} textAnchor="middle"
                  style={{ pointerEvents: 'none', fontFamily: "'Fraunces', serif" }}
                >
                  {n.label}
                </text>

                {/* Queries badge for hot nodes */}
                {n.queries > 50 && !isConcept && (
                  <g transform={`translate(${n.x + n.size - 6}, ${n.y - n.size + 6})`}>
                    <circle r="9" fill={C.gold} stroke={C.greenDark} strokeWidth="1.5"/>
                    <text fontSize="8" fill={C.cream} textAnchor="middle" dy="3" fontWeight="800" fontFamily="'JetBrains Mono', monospace">
                      🔥
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16,
          background: 'rgba(10,42,32,0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,250,240,0.1)',
          borderRadius: 12, padding: 12,
          color: C.cream, fontSize: 11,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8, color: C.onGreenSoft }}>
            LÉGENDE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'url(#conceptGrad)', boxShadow: `0 0 8px ${C.gold}`, border: `2px solid ${C.cream}` }}></div>
              <span>◆ Concept central</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.indigo }}></div>
              <span>◇ Document</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 2, background: C.cyanLight }}></div>
              <span>Lien sémantique (synapse)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12 }}>🔥</span>
              <span>Doc populaire (50+ requêtes)</span>
            </div>
          </div>
        </div>

        {/* Stats overlay */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(10,42,32,0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,250,240,0.1)',
          borderRadius: 12, padding: 14,
          color: C.cream, display: 'flex', gap: 18,
        }}>
          {[
            { label: 'Nœuds', value: '15', color: C.cyanLight },
            { label: 'Liens', value: '24', color: C.gold },
            { label: 'Densité', value: '0.31', color: C.pink },
          ].map((s, i) => (
            <div key={i}>
              <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 10, color: C.onGreenSoft, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights below graph */}
      <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 16 }}>
        {[
          { icon: Award, label: 'Doc le plus consulté', value: 'Conformité', sub: '156 requêtes', color: C.gold, bg: C.goldSoft },
          { icon: Network, label: 'Concept hub', value: 'Commercial', sub: '5 docs connectés', color: C.indigo, bg: C.indigoSoft },
          { icon: Lightbulb, label: 'Gap détecté', value: 'Fiscalité 2026', sub: 'Aucun doc indexé', color: C.pink, bg: C.pinkSoft },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="card-lift" style={{
              background: C.cream, borderRadius: 16, padding: 16,
              border: '1px solid rgba(10,42,32,0.06)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: card.bg, color: card.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginBottom: 2 }}>{card.label}</div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{card.value}</div>
                <div style={{ fontSize: 10, color: C.inkLight }}>{card.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ PAGE: INSIGHTS ============
function InsightsPage() {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.gold}20`, color: C.gold, border: `1px solid ${C.gold}40`, marginBottom: 8 }}>
          <Telescope size={11} /> INSIGHTS · IA-POWERED
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Ce que votre <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>cerveau</em> a découvert.
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          Patterns, gaps et opportunités détectés dans votre base de connaissance
        </p>
      </div>

      {/* Top insights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 24 }} className="responsive-charts">
        <div style={{
          background: `linear-gradient(135deg, ${C.indigoDark} 0%, ${C.indigo} 100%)`,
          borderRadius: 22, padding: 28,
          color: C.cream, position: 'relative', overflow: 'hidden',
        }}>
          <svg style={{ position: 'absolute', right: -60, top: -60, opacity: 0.15 }} width="280" height="280" viewBox="0 0 280 280">
            <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, position: 'relative' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: C.gold,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.cream,
            }}>
              <Award size={22} />
            </div>
            <div className="pill" style={{ background: 'rgba(255,250,240,0.2)', color: C.cream }}>
              ◆ INSIGHT N°1
            </div>
          </div>
          <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.cream, margin: '0 0 8px', letterSpacing: '-0.02em', position: 'relative' }}>
            Le <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>juridique</em> est le sujet le plus interrogé.
          </h3>
          <p style={{ fontSize: 14, color: 'rgba(255,250,240,0.85)', margin: '0 0 16px', lineHeight: 1.55, position: 'relative' }}>
            <strong style={{ color: C.gold }}>156 requêtes</strong> sur la conformité en 30 jours. Vos collaborateurs cherchent surtout du contenu sur les <strong>contrats commerciaux</strong> et le <strong>droit du travail</strong>.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, padding: '6px 12px', background: 'rgba(255,250,240,0.1)', borderRadius: 8 }}>
              💡 Suggestion : Indexer le <strong>Code du travail CI</strong> 2025
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: TrendingUp, color: C.emerald, bg: C.emeraldSoft, title: '+47% de questions', sub: 'vs. mois dernier' },
            { icon: Clock,      color: C.cyan,    bg: C.cyanSoft,    title: '1.4s temps moyen', sub: 'pour obtenir une réponse' },
            { icon: UsersRound,     color: C.pink,    bg: C.pinkSoft,    title: '12 utilisateurs actifs', sub: 'cette semaine' },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="card-lift" style={{
                background: C.cream, borderRadius: 16, padding: 16,
                border: '1px solid rgba(10,42,32,0.06)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: card.bg, color: card.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={22} />
                </div>
                <div>
                  <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{card.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Knowledge gaps */}
      <div style={{
        background: C.cream, borderRadius: 20, padding: 24,
        border: '1px solid rgba(10,42,32,0.06)',
        marginBottom: 16,
      }}>
        <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          🕳️ Gaps <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.pinkDeep }}>de connaissance</em>
        </h3>
        <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 16px' }}>
          Sujets souvent recherchés sans documents pertinents indexés
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { topic: 'Fiscalité 2026',           queries: 23, severity: 'high',   suggestion: 'Indexer le code fiscal CI mis à jour' },
            { topic: 'Politique télétravail',    queries: 18, severity: 'medium', suggestion: 'Créer un document de politique RH' },
            { topic: 'Roadmap produit Q1',       queries: 14, severity: 'medium', suggestion: 'Partager la roadmap interne' },
            { topic: 'Tarification grands comptes', queries: 9, severity: 'low',  suggestion: 'Documenter la grille tarifaire B2B' },
          ].map((gap, i) => {
            const sevColor = gap.severity === 'high' ? C.red : gap.severity === 'medium' ? C.yellow : C.cyan;
            const sevBg = gap.severity === 'high' ? C.redSoft : gap.severity === 'medium' ? C.yellowSoft : C.cyanSoft;
            return (
              <div key={i} style={{
                background: C.creamDeep, borderRadius: 12,
                padding: 14, display: 'flex', gap: 14, alignItems: 'center',
                borderLeft: `3px solid ${sevColor}`,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: sevBg, color: sevColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <AlertCircle size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                      « {gap.topic} »
                    </span>
                    <span className="pill" style={{ background: sevBg, color: sevColor, fontSize: 9 }}>
                      {gap.severity === 'high' ? 'CRITIQUE' : gap.severity === 'medium' ? 'MOYEN' : 'FAIBLE'}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: C.inkSoft, margin: 0, lineHeight: 1.4 }}>
                    💡 {gap.suggestion}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono-font display-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                    {gap.queries}
                  </div>
                  <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 500 }}>
                    requêtes sans réponse
                  </div>
                </div>
                <button className="btn-primary" style={{ padding: '8px 12px', fontSize: 11 }}>
                  <Plus size={11} /> Combler
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ PAGE: GENERATE ============
function GeneratePage() {
  const templates = [
    { name: 'Rapport mensuel',         desc: 'Synthèse mensuelle de tous vos KPIs', emoji: '📊', color: C.indigo, time: '2 min', uses: 47 },
    { name: 'Mémo juridique',          desc: 'Note juridique avec sources légales',  emoji: '⚖️', color: C.gold,   time: '3 min', uses: 23 },
    { name: 'Brief commercial',        desc: 'Pitch personnalisé pour un client',    emoji: '🎯', color: C.cyan,   time: '1 min', uses: 89 },
    { name: 'Compte-rendu réunion',    desc: 'Synthèse structurée d\'une réunion',   emoji: '📝', color: C.pink,   time: '90s',   uses: 156 },
    { name: 'Plan d\'action',          desc: 'Roadmap avec étapes et responsables',  emoji: '🗺️', color: C.emerald, time: '2 min', uses: 34 },
    { name: 'Rapport investisseurs',   desc: 'Update détaillé pour vos investors',   emoji: '📈', color: C.violet,  time: '4 min', uses: 12 },
    { name: 'Proposition commerciale', desc: 'Devis structuré conforme',             emoji: '💼', color: C.blue,    time: '3 min', uses: 67 },
    { name: 'Synthèse documentaire',   desc: 'Résumé de plusieurs docs en un',       emoji: '📚', color: C.indigoDeep, time: '2 min', uses: 91 },
  ];

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.pink}20`, color: C.pink, border: `1px solid ${C.pink}40`, marginBottom: 8 }}>
          <Sparkles size={11} /> GÉNÉRATION IA · GEMINI 2.5 PRO
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Créez en <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.pink }}>quelques clics</em>.
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          Templates intelligents alimentés par votre base documentaire · Sources citées automatiquement
        </p>
      </div>

      {/* Custom prompt card */}
      <div className="grain" style={{
        background: `linear-gradient(135deg, ${C.indigo} 0%, ${C.pink} 100%)`,
        borderRadius: 22, padding: 24,
        marginBottom: 24, color: C.cream,
        position: 'relative', overflow: 'hidden',
      }}>
        <svg style={{ position: 'absolute', right: -40, top: -40, opacity: 0.18 }} width="240" height="240" viewBox="0 0 240 240">
          <circle cx="120" cy="120" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="120" cy="120" r="60" stroke={C.cream} strokeWidth="1" fill="none" />
        </svg>
        <div style={{ position: 'relative', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,250,240,0.2)',
            backdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Sparkles size={28} fill={C.cream} />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Génération <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>libre</em>
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,250,240,0.85)', margin: 0 }}>
              Décrivez ce que vous voulez créer · L'IA puise dans vos 12 documents
            </p>
          </div>
          <button style={{
            background: C.cream, color: C.indigoDeep,
            padding: '14px 22px', borderRadius: 12,
            border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)',
            flexShrink: 0,
          }}>
            <Edit3 size={15} /> Commencer
          </button>
        </div>
      </div>

      {/* Templates grid */}
      <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.cream, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
        <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Templates</em> populaires
      </h3>

      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {templates.map((t, i) => (
          <div key={i} className="card-lift" style={{
            background: C.cream, borderRadius: 16, padding: 18,
            border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
                boxShadow: `0 8px 16px -4px ${t.color}`,
              }}>{t.emoji}</div>
              <span className="pill" style={{
                background: C.creamDeep, color: C.inkSoft, fontSize: 9,
              }}>
                ⏱ {t.time}
              </span>
            </div>

            <h4 className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              {t.name}
            </h4>
            <p style={{ fontSize: 11, color: C.inkSoft, margin: '0 0 12px', lineHeight: 1.4, minHeight: 30 }}>
              {t.desc}
            </p>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)',
            }}>
              <span style={{ fontSize: 10, color: C.inkLight, fontWeight: 600 }}>
                Utilisé <span className="mono-font" style={{ color: C.ink }}>{t.uses}×</span>
              </span>
              <button style={{
                background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                color: C.cream, border: 'none',
                padding: '5px 10px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Sparkles size={11} /> Générer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ============ PAGE: SOURCES ============
function SourcesPage() {
  const sources = [
    { id: 's1', name: 'Google Drive',  emoji: '📁', color: '#4285F4', status: 'connected', docs: 8,  lastSync: 'il y a 2 min',   syncing: false },
    { id: 's2', name: 'Notion',        emoji: '📓', color: '#000000', status: 'connected', docs: 3,  lastSync: 'il y a 12 min',  syncing: true },
    { id: 's3', name: 'Uploads',       emoji: '📤', color: C.indigo,  status: 'connected', docs: 1,  lastSync: 'il y a 4j',      syncing: false },
    { id: 's4', name: 'Confluence',    emoji: '🌐', color: '#172B4D', status: 'available', docs: 0,  lastSync: '—',              syncing: false },
    { id: 's5', name: 'Dropbox',       emoji: '📦', color: '#0061FF', status: 'available', docs: 0,  lastSync: '—',              syncing: false },
    { id: 's6', name: 'OneDrive',      emoji: '☁️', color: '#0078D4', status: 'available', docs: 0,  lastSync: '—',              syncing: false },
    { id: 's7', name: 'Slack',         emoji: '💬', color: '#4A154B', status: 'available', docs: 0,  lastSync: '—',              syncing: false },
    { id: 's8', name: 'GitHub Wiki',   emoji: '📚', color: '#181717', status: 'available', docs: 0,  lastSync: '—',              syncing: false },
  ];

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.cyan}15`, color: C.cyanLight, border: `1px solid ${C.cyan}40`, marginBottom: 8 }}>
          <Database size={11} /> SOURCES · 3 CONNECTÉES · 5 DISPONIBLES
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Sources de <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyan }}>connaissance</em>
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          Connectez vos outils pour synchroniser automatiquement vos documents
        </p>
      </div>

      {/* Connected sources */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: C.onGreenSoft, letterSpacing: '0.08em', marginBottom: 12 }}>
            ✓ CONNECTÉES
      </h3>

      <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {sources.filter(s => s.status === 'connected').map(src => (
          <div key={src.id} className="card-lift" style={{
            background: C.cream, borderRadius: 18, padding: 20,
            border: '1px solid rgba(10,42,32,0.06)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ height: 4, background: src.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, marginTop: 6 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `${src.color}15`,
                border: `1.5px solid ${src.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, flexShrink: 0,
              }}>{src.emoji}</div>

              {src.syncing ? (
                <span className="pill" style={{ background: C.cyanSoft, color: C.cyanDeep }}>
                  <Loader2 size={11} className="spinner" /> SYNC
                </span>
              ) : (
                <span className="pill" style={{ background: C.emeraldSoft, color: C.emeraldDeep }}>
                  <CheckCircle2 size={11} /> ACTIF
                </span>
              )}
            </div>

            <h4 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              {src.name}
            </h4>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              padding: '10px 14px', background: C.creamDeep, borderRadius: 10,
            }}>
              <div>
                <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: '-0.01em' }}>
                  {src.docs}
                </div>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>documents</div>
              </div>
              <div style={{ flex: 1 }}></div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: C.inkSoft }}>
                  Dernière sync
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>
                  {src.lastSync}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 12 }}>
                <RefreshCw size={12} /> Sync
              </button>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 12 }}>
                <Settings2 size={12} /> Config
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Available sources */}
      <h3 style={{ fontSize: 12, fontWeight: 700, color: C.onGreenSoft, letterSpacing: '0.08em', marginBottom: 12 }}>
        + DISPONIBLES À CONNECTER
      </h3>

      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {sources.filter(s => s.status === 'available').map(src => (
          <div key={src.id} className="card-lift" style={{
            background: C.cream, borderRadius: 14, padding: 16,
            border: '1.5px dashed rgba(10,42,32,0.15)',
            cursor: 'pointer', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: `${src.color}15`,
              border: `1.5px solid ${src.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, margin: '0 auto 10px',
            }}>{src.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{src.name}</div>
            <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 11 }}>
              <Plus size={11} /> Connecter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ PAGE: INDEXATION ============
function IndexPage() {
  const [dragging, setDragging] = useState(false);

  const queue = [
    { name: 'Audit cybersécurité 2025.pdf',          status: 'completed', progress: 100, time: 'Indexé en 47s', size: '4.2 MB' },
    { name: 'Étude marché Sénégal.docx',             status: 'processing', progress: 67,  time: 'Extraction texte…', size: '6.1 MB' },
    { name: 'Plan stratégique Q1 2026.pptx',         status: 'queued',    progress: 0,   time: 'En attente…',     size: '12 MB' },
    { name: 'Code de conduite éthique.pdf',          status: 'completed', progress: 100, time: 'Indexé en 23s', size: '890 KB' },
  ];

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.indigo}15`, color: C.indigoLight, border: `1px solid ${C.indigo}40`, marginBottom: 8 }}>
          <Layers size={11} /> INDEXATION · OCR + EMBEDDINGS
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Ajoutez de la <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.indigoLight }}>connaissance</em>
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          PDF, Word, Excel, PowerPoint, images (avec OCR), audio, vidéo
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); setDragging(false); }}
        style={{
          background: dragging ? `linear-gradient(135deg, ${C.indigo}10, ${C.cyan}10)` : C.cream,
          borderRadius: 22, padding: 48,
          border: `2.5px dashed ${dragging ? C.indigo : 'rgba(67,56,202,0.2)'}`,
          textAlign: 'center', marginBottom: 24,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: `linear-gradient(135deg, ${C.indigo}, ${C.cyan})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
          boxShadow: `0 16px 32px -8px ${C.indigo}`,
        }}>
          <Upload size={36} color={C.cream} />
        </div>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Glissez vos <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.indigo }}>fichiers</em> ici
        </h3>
        <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 18px' }}>
          ou cliquez pour sélectionner · Maximum 100 MB par fichier · Multi-fichiers OK
        </p>
        <button className="btn-primary" style={{ padding: '12px 24px' }}>
          <FilePlus size={16} /> Parcourir
        </button>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
          {[
            { icon: FileText, label: 'PDF', color: C.red },
            { icon: FileText, label: 'Word', color: C.blue },
            { icon: FileSpreadsheet, label: 'Excel', color: C.emerald },
            { icon: Image, label: 'PPT', color: C.gold },
            { icon: Image, label: 'Images', color: C.pink },
            { icon: Music, label: 'Audio', color: C.violet },
            { icon: Video, label: 'Vidéo', color: C.cyan },
          ].map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', background: C.creamDeep, borderRadius: 100,
                fontSize: 11, fontWeight: 600, color: t.color,
              }}>
                <Icon size={11} /> {t.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Queue */}
      <div style={{
        background: C.cream, borderRadius: 20, padding: 24,
        border: '1px solid rgba(10,42,32,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
            File d'<em style={{ fontStyle: 'italic', fontWeight: 500, color: C.indigo }}>indexation</em>
          </h3>
          <span className="pill" style={{ background: C.indigoSoft, color: C.indigoDeep }}>
            {queue.length} éléments
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {queue.map((q, i) => {
            const isComplete = q.status === 'completed';
            const isProcess = q.status === 'processing';
            const statusColor = isComplete ? C.emerald : isProcess ? C.cyan : C.inkLight;
            return (
              <div key={i} style={{
                background: C.creamDeep, borderRadius: 12, padding: 14,
                display: 'flex', alignItems: 'center', gap: 12,
                borderLeft: `3px solid ${statusColor}`,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${statusColor}20`, color: statusColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {isComplete ? <CheckCircle2 size={18} /> : isProcess ? <Loader2 size={18} className="spinner" /> : <Clock size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                      {q.name}
                    </span>
                    <span style={{ fontSize: 10, color: C.inkLight }}>· {q.size}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 5, background: 'rgba(10,42,32,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{
                      width: `${q.progress}%`, height: '100%',
                      background: isComplete ? C.emerald : `linear-gradient(90deg, ${C.indigo}, ${C.cyan})`,
                      transition: 'width 0.3s ease',
                    }}></div>
                  </div>
                  <div style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>
                    {q.time}
                  </div>
                </div>
                {isComplete ? (
                  <CheckCheck size={18} color={C.emerald} />
                ) : (
                  <button style={{
                    background: 'transparent', border: 'none',
                    color: C.inkLight, cursor: 'pointer', padding: 6,
                  }}>
                    <X size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ PAGE: SETTINGS ============
function SettingsPage() {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="pill" style={{ background: `${C.inkLight}30`, color: C.cream, marginBottom: 8 }}>
          <Settings2 size={11} /> PARAMÈTRES KNOWLEDGE
        </div>
        <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Paramètres <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyan }}>du cerveau</em>
        </h2>
        <p style={{ fontSize: 13, color: C.onGreenSoft, margin: '4px 0 0' }}>
          Configuration avancée de votre agent Knowledge
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }} className="responsive-charts">
        {/* Model settings */}
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.indigoSoft, color: C.indigoDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Cpu size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              Modèle IA
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6 }}>MODÈLE PRINCIPAL</div>
              <select className="input-field" style={{ background: C.creamDeep, padding: '10px 14px', fontSize: 13 }}>
                <option>Gemini 2.5 Pro · Recommandé</option>
                <option>Gemini 2.5 Flash · Rapide</option>
                <option>Claude Sonnet 4.7 · Premium</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6 }}>EMBEDDING MODEL</div>
              <select className="input-field" style={{ background: C.creamDeep, padding: '10px 14px', fontSize: 13 }}>
                <option>text-embedding-3-large</option>
                <option>text-embedding-3-small</option>
                <option>multilingual-e5-large</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6 }}>TEMPÉRATURE (0 — 1)</div>
              <input type="range" min="0" max="100" defaultValue="30" style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
                <span>Précis</span>
                <span style={{ color: C.indigo, fontWeight: 700 }}>0.30</span>
                <span>Créatif</span>
              </div>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.cyanSoft, color: C.cyanDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              Permissions
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Tout le monde peut consulter', enabled: true },
              { label: 'Permettre les questions Q&A', enabled: true },
              { label: 'Génération de documents par tous', enabled: false },
              { label: 'Supprimer documents (admin only)', enabled: true },
              { label: 'Voir le knowledge graph', enabled: true },
            ].map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: C.creamDeep, borderRadius: 10,
              }}>
                <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{p.label}</span>
                <div style={{
                  width: 38, height: 22, borderRadius: 100,
                  background: p.enabled ? C.indigo : C.inkLight,
                  position: 'relative', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}>
                  <div style={{
                    position: 'absolute', top: 2,
                    left: p.enabled ? 18 : 2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: C.cream, transition: 'all 0.2s ease',
                  }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retention */}
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: '1px solid rgba(10,42,32,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.goldSoft, color: C.goldDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Archive size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.01em' }}>
              Rétention & Sauvegarde
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6 }}>HISTORIQUE Q&A</div>
              <select className="input-field" style={{ background: C.creamDeep, padding: '10px 14px', fontSize: 13 }}>
                <option>30 jours</option>
                <option>90 jours · Recommandé</option>
                <option>1 an</option>
                <option>10 ans · Conformité légale</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6 }}>BACKUP AUTOMATIQUE</div>
              <select className="input-field" style={{ background: C.creamDeep, padding: '10px 14px', fontSize: 13 }}>
                <option>Quotidien · Recommandé</option>
                <option>Hebdomadaire</option>
                <option>Mensuel</option>
              </select>
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div style={{
          background: C.cream, borderRadius: 18, padding: 22,
          border: `1.5px solid ${C.red}30`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: C.redSoft, color: C.redDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertCircle size={20} />
            </div>
            <h3 className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.redDeep, margin: 0, letterSpacing: '-0.01em' }}>
              Zone dangereuse
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button style={{
              background: 'transparent', color: C.redDeep,
              border: `1.5px solid ${C.red}40`,
              padding: '10px 14px', borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <RefreshCw size={14} /> Réindexer tous les documents
            </button>
            <button style={{
              background: 'transparent', color: C.redDeep,
              border: `1.5px solid ${C.red}40`,
              padding: '10px 14px', borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Trash2 size={14} /> Effacer l'historique Q&A
            </button>
            <button style={{
              background: C.redDeep, color: C.cream,
              border: 'none',
              padding: '10px 14px', borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <XCircle size={14} /> Supprimer toute la knowledge base
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============
// ============ Knowledge real-data context ============
const KnowledgeDataCtx = createContext<any>({ documents: [], queries: [], loading: true });
export const useKnowledgeData = () => useContext(KnowledgeDataCtx);

export default function KnowledgeRedesignPage() {
  const [currentPage, setCurrentPage] = useState('home');
  const [documents, setDocuments] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      try {
        const [docsRes, qRes] = await Promise.all([
          api.get('/data/documents').catch(() => ({ data: [] })),
          api.get('/agent/conversations').catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;
        const docs = Array.isArray((docsRes as any)?.data) ? (docsRes as any).data : ((docsRes as any)?.data?.documents ?? []);
        const convos = Array.isArray((qRes as any)?.data) ? (qRes as any).data : ((qRes as any)?.data?.conversations ?? []);
        setDocuments(docs);
        setQueries(convos.filter((c: any) => c.agentId === 'knowledge' || c.agentId === 'qa').slice(0, 10));
        setLastSync(new Date());
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <KnowledgeDataCtx.Provider value={{ documents, queries, loading, lastSync, refresh: () => setLastSync(new Date()) }}>
      <Chrome currentPage={currentPage} setCurrentPage={setCurrentPage}>
        {currentPage === 'home'     && <HomePage />}
        {currentPage === 'chat'     && <ChatQAPage />}
        {currentPage === 'library'  && <LibraryPage />}
        {currentPage === 'graph'    && <GraphPage />}
        {currentPage === 'insights' && <InsightsPage />}
        {currentPage === 'generate' && <GeneratePage />}
        {currentPage === 'sources'  && <SourcesPage />}
        {currentPage === 'index'    && <IndexPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </Chrome>
    </KnowledgeDataCtx.Provider>
  );
}
