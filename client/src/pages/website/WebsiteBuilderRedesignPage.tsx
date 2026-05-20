import React, { useState, useRef } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import {
  Search, Bell, ChevronDown, ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  LayoutDashboard, MessageSquare, MessageCircle, Bot, UsersRound, Briefcase, Calendar,
  Store, Crown, Hammer, Plug, Settings, Shield, LogOut, Plus, Minus, Sparkles, Brain, Send,
  Paperclip, Image, FileText, Hash, Pin, Star, Filter, MoreHorizontal, X, Copy,
  CheckCircle2, XCircle, AlertTriangle, Clock, Timer, Loader2, Zap, Flame,
  Code, Code2, Globe, Phone, Users2, User, BarChart3, TrendingUp, Activity, Target,
  Edit3, Trash2, Save, Download, Upload, Eye, EyeOff, Lock,
  PenTool, Pencil, Palette, Wand2, Layers, LayoutGrid, LayoutTemplate, Boxes,
  Rocket, Lightbulb, Smile, Heart, ShoppingBag, GraduationCap, Building, Building2,
  Stethoscope, Scale, Car, Scissors, HandHeart, Hotel, MapPin, Mail, AtSign,
  Smartphone, Tablet, Monitor, Maximize2, Minimize2, RotateCw, ExternalLink,
  CircleDot, Tag, Bookmark, Share2, Cpu, Database, Cloud, Camera, Video, Music,
  Type, AlignLeft, Bold, Italic, Link2, Highlighter, List, ListChecks
} from 'lucide-react';

// ============ PALETTE — bleu+violet créatif (Website Builder) ============
const C = {
  greenDeep:   '#0A4F3C',
  greenDark:   '#063D2E',
  cream:       '#FFFAF0',
  creamDeep:   '#F5EDD6',
  // PRIMARY — bleu créatif
  blue:        '#2563EB',  // blue-600
  blueDeep:    '#1D4ED8',  // blue-700
  blueDark:    '#1E3A8A',  // blue-900
  blueSoft:    '#DBEAFE',  // blue-100
  blueLight:   '#60A5FA',  // blue-400
  // ACCENT — violet IA
  violet:      '#7C3AED',  // violet-600
  violetDeep:  '#5B21B6',  // violet-800
  violetSoft:  '#EDE9FE',  // violet-100
  violetLight: '#A78BFA',  // violet-400
  // POP — cyan énergie
  cyan:        '#06B6D4',  // cyan-500
  cyanDeep:    '#0891B2',  // cyan-600
  cyanSoft:    '#CFFAFE',  // cyan-100
  // Semantic
  emerald:     '#10B981',
  emeraldSoft: '#D1FAE5',
  emeraldDeep: '#059669',
  red:         '#EF4444',
  redSoft:     '#FEE2E2',
  yellow:      '#F59E0B',
  yellowSoft:  '#FEF3C7',
  pink:        '#EC4899',
  pinkSoft:    '#FCE7F3',
  orange:      '#F97316',
  orangeSoft:  '#FFEDD5',
  ink:         '#0A2A20',
  inkSoft:     '#5A6B62',
  inkLight:    '#94A3A0',
  onGreenSoft: '#A8C9B8',
};

// Templates par secteur PME ivoirien
const SECTORS = [
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️', color: '#F97316', desc: 'Maquis, café, fast-food' },
  { id: 'realestate', name: 'Immobilier', icon: '🏠', color: '#10B981', desc: 'Agence, location' },
  { id: 'school', name: 'École', icon: '🎓', color: '#7C3AED', desc: 'Formation, cours' },
  { id: 'ecommerce', name: 'E-commerce', icon: '🛍️', color: '#EC4899', desc: 'Mobile Money intégré' },
  { id: 'medical', name: 'Médical', icon: '🏥', color: '#06B6D4', desc: 'Cabinet, clinique' },
  { id: 'legal', name: 'Cabinet avocat', icon: '⚖️', color: '#1E293B', desc: 'Conseil juridique' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#F59E0B', desc: 'VTC, taxi, livraison' },
  { id: 'beauty', name: 'Beauté', icon: '💇', color: '#DB2777', desc: 'Salon, spa' },
  { id: 'ngo', name: 'ONG', icon: '🤝', color: '#0EA5E9', desc: 'Association, fondation' },
  { id: 'agency', name: 'Agence digitale', icon: '💼', color: '#7C3AED', desc: 'Marketing, dev' },
  { id: 'hotel', name: 'Hôtel', icon: '🏨', color: '#B45309', desc: 'Hébergement, B&B' },
  { id: 'tourism', name: 'Tourisme', icon: '🌍', color: '#10B981', desc: 'Voyage, excursion' },
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
    background: ${C.blueDeep}; color: ${C.cream};
    box-shadow: 0 8px 24px -8px ${C.blueDeep};
  }
  .nav-item.active::after {
    content: ''; position: absolute;
    right: 12px; top: 50%; transform: translateY(-50%);
    width: 6px; height: 6px; border-radius: 50%; background: ${C.cream};
  }

  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 100px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  }

  .grain::before {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.06; pointer-events: none; mix-blend-mode: overlay;
  }

  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${C.cyan}; position: relative; flex-shrink: 0;
  }
  .live-dot::after {
    content: ''; position: absolute; inset: -4px;
    border-radius: 50%; background: ${C.cyan};
    opacity: 0.4; animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.6); opacity: 0; }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .spin { animation: spin 0.9s linear infinite; }

  /* Big mode card hover effect */
  .mode-card {
    background: ${C.cream};
    border-radius: 28px;
    padding: 36px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  .mode-card:hover {
    transform: translateY(-8px) scale(1.02);
  }

  .btn-primary {
    background: linear-gradient(135deg, ${C.blue} 0%, ${C.violet} 100%);
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

  .btn-secondary {
    background: ${C.cream}; color: ${C.blueDeep};
    border: 1.5px solid rgba(10,42,32,0.1);
    padding: 11px 18px; border-radius: 12px;
    font-weight: 600; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease; font-family: inherit;
  }
  .btn-secondary:hover {
    background: ${C.blueDeep}; color: ${C.cream}; border-color: ${C.blueDeep};
  }

  .btn-cyan {
    background: linear-gradient(135deg, ${C.cyan} 0%, ${C.cyanDeep} 100%);
    color: ${C.cream}; border: none;
    padding: 12px 22px; border-radius: 12px;
    font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 8px 24px -8px ${C.cyan};
    font-family: inherit;
  }
  .btn-cyan:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px -8px ${C.cyan};
  }

  .icon-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: ${C.creamDeep}; color: ${C.blueDeep};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; transition: all 0.2s ease;
  }
  .icon-btn:hover { background: ${C.blueDeep}; color: ${C.cream}; }

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

  .avatar {
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Fraunces', serif; font-weight: 700;
    color: ${C.cream}; flex-shrink: 0;
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

  /* Step circle pulse */
  @keyframes stepPulse {
    0%, 100% { box-shadow: 0 0 0 0 ${C.violet}50; }
    50% { box-shadow: 0 0 0 8px transparent; }
  }
  .step-active { animation: stepPulse 2s ease-in-out infinite; }

  /* Loading shimmer */
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .shimmer-bg {
    background: linear-gradient(90deg, ${C.creamDeep} 0%, ${C.cream} 50%, ${C.creamDeep} 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s linear infinite;
  }

  .progress-bar {
    height: 6px; border-radius: 3px;
    background: rgba(10,42,32,0.08); overflow: hidden;
  }
  .progress-fill {
    height: 100%; border-radius: 3px;
    transition: width 0.6s ease;
  }

  .mobile-menu-btn { display: none; }

  @media (max-width: 1024px) {
    .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .responsive-grid-3 { grid-template-columns: 1fr !important; }
    .responsive-charts { grid-template-columns: 1fr !important; }
    .modes-grid { grid-template-columns: 1fr !important; }
    .builder-layout { grid-template-columns: 1fr !important; }
    .builder-sidebar-l, .builder-sidebar-r { display: none !important; }
  }

  @media (max-width: 768px) {
    .sidebar-aside {
      position: fixed !important; left: 0; top: 0;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      z-index: 100;
    }
    .sidebar-aside.open { transform: translateX(0); }
    .sidebar-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5); z-index: 99;
    }
    .mobile-menu-btn { display: flex !important; }
    .desktop-only { display: none !important; }
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .hero-title { font-size: 32px !important; }
    .hide-on-mobile { display: none !important; }
  }

  @media (max-width: 480px) {
    .responsive-grid-4 { grid-template-columns: 1fr !important; }
    .hero-title { font-size: 26px !important; }
  }
`;

// ============ CHROME (lite — sidebar/header gérés par le layout corpmind-ai) ============
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

// ============ HERO HEADER ============
function PageHeader({ title, italic, subtitle, badge, actions, onBack }) {
  return (
    <div style={{ padding: '32px 32px 0' }}>
      <div className="grain" style={{
        background: `linear-gradient(135deg, ${C.blue} 0%, ${C.violet} 60%, ${C.violetDeep} 100%)`,
        borderRadius: 24, padding: '32px 36px',
        position: 'relative', overflow: 'hidden',
        color: C.cream,
        boxShadow: `0 30px 60px -20px ${C.violet}80`,
      }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60" stroke={C.cream} strokeWidth="2" fill="none" />
        </svg>

        {/* Globe icon decorative */}
        <svg style={{ position: 'absolute', right: 100, bottom: 30, opacity: 0.18 }} width="160" height="160" viewBox="0 0 100 100" fill="none" stroke={C.cream} strokeWidth="2">
          <circle cx="50" cy="50" r="40"/>
          <ellipse cx="50" cy="50" rx="40" ry="16"/>
          <ellipse cx="50" cy="50" rx="16" ry="40"/>
          <line x1="10" y1="50" x2="90" y2="50"/>
          <line x1="50" y1="10" x2="50" y2="90"/>
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
              }}>
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                {badge && (
                  <div className="pill" style={{ background: 'rgba(255,250,240,0.2)', color: C.cream, backdropFilter: 'blur(10px)' }}>
                    <Globe size={11} />
                    {badge}
                  </div>
                )}
              </div>
              <h1 className="display-font hero-title" style={{
                fontSize: 44, fontWeight: 800, lineHeight: 1.0, margin: 0,
                color: C.cream, letterSpacing: '-0.03em',
              }}>
                {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanSoft }}>{italic}</em>}
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

// ============ IMPORT HTML PANEL — paste site from Claude/Gemini/Bolt ============
function ImportHtmlPanel({ onBack, onImported }) {
  const { company } = useAuthStore();
  type Source = 'claude' | 'gemini' | 'bolt' | 'v0' | 'cursor' | 'autre';
  const [source, setSource] = useState<Source>('claude');
  const [rawHtml, setRawHtml] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SOURCES: { id: Source; label: string; emoji: string; color: string; tag: string }[] = [
    { id: 'claude', label: 'Claude',  emoji: '✶', color: '#D97757', tag: 'claude.ai/artifacts' },
    { id: 'gemini', label: 'Gemini',  emoji: '✦', color: '#4285F4', tag: 'gemini.google.com' },
    { id: 'bolt',   label: 'Bolt',    emoji: '⚡', color: '#1E1E1E', tag: 'bolt.new' },
    { id: 'v0',     label: 'v0',      emoji: '◆', color: '#000000', tag: 'v0.dev' },
    { id: 'cursor', label: 'Cursor',  emoji: '◈', color: '#7C3AED', tag: 'cursor.com' },
    { id: 'autre',  label: 'Autre',   emoji: '◯', color: '#5A6B62', tag: 'site fait main' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fichier trop lourd', 'Max 5 MB. Compresse ou colle directement le HTML.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result ?? '');
      setRawHtml(txt);
      toast.success('Fichier chargé', `${file.name} · ${Math.round(file.size / 1024)} KB`);
    };
    reader.onerror = () => toast.error('Lecture impossible', 'Le fichier ne peut pas être lu.');
    reader.readAsText(file);
  };

  const looksLikeHtml = (s: string) => /<\/?(html|body|head|div|section|main|header|footer|h1|nav|article|p)\b/i.test(s);

  const handleSubmit = async () => {
    const trimmed = rawHtml.trim();
    if (trimmed.length < 100) {
      toast.error('HTML trop court', 'Colle au moins 100 caractères de HTML.');
      return;
    }
    if (!looksLikeHtml(trimmed)) {
      toast.error('HTML invalide', "Le contenu ne ressemble pas à du HTML. Vérifie que tu colles bien le code source.");
      return;
    }
    setSubmitting(true);
    try {
      const r: any = await api.post('/website/import', {
        rawHtml: trimmed,
        importedFrom: source,
        companyName: company?.name,
        color: (company as any)?.primaryColor ?? '#0A4F3C',
        publish: publishNow,
      });
      const data = r?.data?.data ?? r?.data;
      toast.success(
        publishNow ? 'Site importé et publié' : 'Site importé',
        `${Math.round((data?.sizeBytes ?? trimmed.length) / 1024)} KB · widget chat injecté`,
      );
      onImported(data);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Import impossible. Réessaie ou contacte le support.";
      toast.error('Échec import', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Import HTML,"
        italic="hébergez votre site Claude/Gemini/Bolt."
        subtitle="Collez le HTML ou uploadez un fichier .html · Widget chat injecté automatiquement"
        badge="MODE IMPORT · CLAUDE · GEMINI · BOLT"
        onBack={onBack}
      />

      <div style={{ padding: '32px 32px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: C.cream, borderRadius: 24,
          padding: 32, border: '1px solid rgba(10,42,32,0.06)',
        }}>
          {/* Source picker */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              D'où vient votre HTML ?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {SOURCES.map(s => {
                const active = source === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSource(s.id)}
                    style={{
                      padding: '12px 14px', borderRadius: 12,
                      background: active ? s.color : C.creamDeep,
                      color: active ? C.cream : C.ink,
                      border: active ? `2px solid ${s.color}` : `2px solid transparent`,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s ease',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{s.emoji}</span> {s.label}
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.7, fontFamily: 'JetBrains Mono, monospace' }}>{s.tag}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paste textarea */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.ink, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Collez votre HTML
              </label>
              <span style={{ fontSize: 11, color: C.inkSoft, fontFamily: 'JetBrains Mono, monospace' }}>
                {rawHtml.length.toLocaleString()} caractères {rawHtml.length > 100 && '· ✓'}
              </span>
            </div>
            <textarea
              value={rawHtml}
              onChange={e => setRawHtml(e.target.value)}
              placeholder={`<!DOCTYPE html>\n<html lang="fr">\n  <head>...</head>\n  <body>\n    ...\n  </body>\n</html>`}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 320,
                padding: 14, borderRadius: 12,
                background: '#0A2A20', color: '#E0F2F1',
                border: `1.5px solid ${C.emerald}30`,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12, lineHeight: 1.5,
                resize: 'vertical', outline: 'none',
              }}
            />
          </div>

          {/* OR upload file */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', borderRadius: 12,
            background: C.creamDeep, marginBottom: 20,
            border: `1px dashed ${C.emerald}50`,
          }}>
            <Upload size={18} color={C.emeraldDeep} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Ou uploadez un fichier .html</div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>Max 5 MB · Le contenu remplit la zone ci-dessus</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 14px', borderRadius: 8,
                background: C.emerald, color: C.cream,
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <FileText size={13} /> Choisir un fichier
            </button>
          </div>

          {/* Publish toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', borderRadius: 12,
            background: publishNow ? C.emeraldSoft : C.creamDeep,
            border: `1.5px solid ${publishNow ? C.emerald : 'transparent'}`,
            cursor: 'pointer', marginBottom: 20,
            transition: 'all 0.2s ease',
          }}>
            <input
              type="checkbox"
              checked={publishNow}
              onChange={e => setPublishNow(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: C.emerald, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                Publier immédiatement
              </div>
              <div style={{ fontSize: 11, color: C.inkSoft }}>
                Sinon, sauvegardé en brouillon — tu pourras prévisualiser avant publication
              </div>
            </div>
            {publishNow && <Rocket size={18} color={C.emeraldDeep} />}
          </label>

          {/* Helper note */}
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: `${C.cyan}10`, border: `1px solid ${C.cyan}30`,
            fontSize: 12, color: C.ink, marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <Lightbulb size={16} color={C.cyanDeep} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong style={{ color: C.cyanDeep }}>Astuce :</strong> sur Claude, demande "donne-moi le HTML complet du site dans un seul fichier". Sur Gemini ou Bolt, copie le code généré. Orlode injecte automatiquement le widget chat avant <code style={{ background: C.creamDeep, padding: '1px 4px', borderRadius: 3 }}>&lt;/body&gt;</code>.
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              style={{
                padding: '12px 20px', borderRadius: 12,
                background: 'transparent', color: C.ink,
                border: `1.5px solid ${C.inkLight}`,
                cursor: 'pointer', fontWeight: 600, fontSize: 14,
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || rawHtml.trim().length < 100}
              style={{
                padding: '12px 24px', borderRadius: 12,
                background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
                color: C.cream, border: 'none',
                cursor: submitting ? 'wait' : 'pointer',
                fontWeight: 700, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: (submitting || rawHtml.trim().length < 100) ? 0.5 : 1,
                boxShadow: `0 8px 20px -6px ${C.emerald}`,
              }}
            >
              {submitting
                ? <><Loader2 size={16} className="spin" /> Import en cours…</>
                : <><Upload size={16} /> {publishNow ? 'Importer et publier' : 'Importer (brouillon)'} <ArrowRight size={16} /></>
              }
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============ ENTRY: 3 MODES CHOICE ============
function EntryChoice({ onSelectMode, onImportUrl }) {
  const [importUrl, setImportUrl] = useState('orlode.com');

  return (
    <>
      <PageHeader
        title="AI Business Website,"
        italic="votre site travaille pour vous."
        subtitle="Pas un Wix de plus. Un site qui répond sur WhatsApp, prend des RDV, vend, et envoie les emails — tout seul."
        badge="ORLODE · LE SITE QUI BOSSE"
      />

      {/* "Votre site travaille pour vous" — 4 promesses business */}
      <div style={{ padding: '32px 32px 0' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          background: `linear-gradient(135deg, rgba(255,250,240,0.04), rgba(255,250,240,0.08))`,
          border: '1px solid rgba(255,250,240,0.10)',
          backdropFilter: 'blur(12px)',
          borderRadius: 20, padding: '20px 24px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: 14,
          }}>
            <div className="live-dot" style={{ background: C.emerald }}></div>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              color: C.onGreenSoft, textTransform: 'uppercase',
            }}>
              Connecté à vos agents IA · 24/7
            </span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}>
            {[
              { icon: MessageCircle, agent: 'Comms',     color: C.emerald, label: 'Répond sur WhatsApp',   tag: 'sans toi' },
              { icon: Calendar,      agent: 'Reception', color: C.cyan,    label: 'Prend les RDV',          tag: 'agenda auto' },
              { icon: ShoppingBag,   agent: 'Sales',     color: C.violet,  label: 'Vend tes produits',      tag: 'Mobile Money' },
              { icon: Mail,          agent: 'Marketing', color: C.pink,    label: 'Envoie les emails',      tag: 'campagnes auto' },
            ].map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 12,
                  background: 'rgba(255,250,240,0.04)',
                  border: '1px solid rgba(255,250,240,0.08)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                    color: C.cream,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 6px 14px -4px ${p.color}`,
                  }}>
                    <Icon size={17} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: C.cream,
                      lineHeight: 1.2, marginBottom: 2,
                    }}>
                      {p.label}
                    </div>
                    <div style={{
                      fontSize: 10, color: p.color, fontWeight: 700,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <Sparkles size={9} fill={p.color} /> Agent {p.agent} · {p.tag}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3 MODES CARDS */}
      <div style={{ padding: '32px 32px 0' }}>
        <h3 className="display-font" style={{
          fontSize: 26, fontWeight: 700, color: C.cream,
          margin: '0 0 8px', letterSpacing: '-0.02em', textAlign: 'center',
        }}>
          Comment <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanSoft }}>démarrer ?</em>
        </h3>
        <p style={{ fontSize: 14, color: C.onGreenSoft, textAlign: 'center', margin: '0 0 32px' }}>
          Trois façons de mettre votre site en ligne — les agents s'y branchent automatiquement
        </p>

        <div className="modes-grid stagger" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24,
          maxWidth: 1280, margin: '0 auto',
        }}>
          {/* MODE 1 — IA Generator */}
          <div onClick={() => onSelectMode('ai')} className="mode-card" style={{
            borderColor: 'transparent',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = C.violet; e.currentTarget.style.boxShadow = `0 30px 60px -20px ${C.violet}50`; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg style={{ position: 'absolute', right: -30, top: -30, opacity: 0.06 }} width="200" height="200" fill={C.violet}>
              <path d="M100 20 L120 80 L180 100 L120 120 L100 180 L80 120 L20 100 L80 80 Z"/>
            </svg>

            {/* Badge recommended */}
            <div style={{
              position: 'absolute', top: 20, right: 20,
              background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
              color: C.cream,
              padding: '5px 12px', borderRadius: 100,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              boxShadow: `0 4px 12px -4px ${C.violet}`,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Sparkles size={10} fill={C.cream} /> RECOMMANDÉ · 2MIN
            </div>

            <div style={{
              width: 80, height: 80, borderRadius: 22,
              background: `linear-gradient(135deg, ${C.violet} 0%, ${C.pink} 100%)`,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              boxShadow: `0 16px 32px -8px ${C.violet}`,
              position: 'relative',
            }}>
              <Brain size={36} />
              <div style={{
                position: 'absolute', bottom: -4, right: -4,
                width: 28, height: 28, borderRadius: 50,
                background: C.cyan, color: C.cream,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `3px solid ${C.cream}`,
              }}>
                <Sparkles size={13} />
              </div>
            </div>

            <h4 className="display-font" style={{
              fontSize: 28, fontWeight: 800, color: C.ink,
              margin: '0 0 8px', letterSpacing: '-0.02em',
            }}>
              Génération <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>par IA</em>
            </h4>
            <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.5, margin: '0 0 20px' }}>
              Décrivez votre activité, l'IA pose quelques questions et construit votre site complet en <strong style={{ color: C.violet }}>30 secondes</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {[
                { icon: Globe, text: 'Lit votre site existant si fourni' },
                { icon: Wand2, text: 'Génère contenu sur mesure' },
                { icon: Palette, text: 'Détecte couleurs & branding' },
                { icon: Rocket, text: 'Site fonctionnel direct' },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: C.violetSoft, color: C.violet,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={12} />
                    </div>
                    <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{f.text}</span>
                  </div>
                );
              })}
            </div>

            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px 22px', fontSize: 15 }}>
              <Sparkles size={16} fill={C.cream} /> Lancer l'assistant IA
              <ArrowRight size={16} />
            </button>
          </div>

          {/* MODE 2 — Manual Builder */}
          <div onClick={() => onSelectMode('manual')} className="mode-card" style={{
            borderColor: 'transparent',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = C.cyan; e.currentTarget.style.boxShadow = `0 30px 60px -20px ${C.cyan}50`; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg style={{ position: 'absolute', right: -30, top: -30, opacity: 0.06 }} width="200" height="200" viewBox="0 0 200 200" fill={C.cyan}>
              <rect x="20" y="20" width="160" height="40" rx="6"/>
              <rect x="20" y="80" width="100" height="40" rx="6"/>
              <rect x="140" y="80" width="40" height="40" rx="6"/>
              <rect x="20" y="140" width="160" height="40" rx="6"/>
            </svg>

            {/* Badge */}
            <div style={{
              position: 'absolute', top: 20, right: 20,
              background: `${C.cyan}20`,
              color: C.cyanDeep,
              padding: '5px 12px', borderRadius: 100,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              border: `1px solid ${C.cyan}40`,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Pencil size={10} /> CONTRÔLE TOTAL
            </div>

            <div style={{
              width: 80, height: 80, borderRadius: 22,
              background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.cyanDeep} 100%)`,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              boxShadow: `0 16px 32px -8px ${C.cyan}`,
            }}>
              <LayoutGrid size={36} />
            </div>

            <h4 className="display-font" style={{
              fontSize: 28, fontWeight: 800, color: C.ink,
              margin: '0 0 8px', letterSpacing: '-0.02em',
            }}>
              Création <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>manuelle</em>
            </h4>
            <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.5, margin: '0 0 20px' }}>
              Builder drag-drop visuel. Partez d'un template ou d'une page blanche. Édition fine pixel-perfect avec <strong style={{ color: C.cyanDeep }}>chat IA en temps réel</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {[
                { icon: Boxes, text: 'Drag & drop sections' },
                { icon: Palette, text: 'Personnalisation pixel-perfect' },
                { icon: Sparkles, text: 'Chat IA pour modifier (bonus)' },
                { icon: Smartphone, text: 'Preview Mobile/Tablet/Desktop' },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: C.cyanSoft, color: C.cyanDeep,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={12} />
                    </div>
                    <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{f.text}</span>
                  </div>
                );
              })}
            </div>

            <button className="btn-cyan" style={{ width: '100%', justifyContent: 'center', padding: '14px 22px', fontSize: 15 }}>
              <LayoutGrid size={16} /> Ouvrir le builder
              <ArrowRight size={16} />
            </button>
          </div>

          {/* MODE 3 — Import HTML (Claude / Gemini / Bolt / v0) */}
          <div onClick={() => onSelectMode('import')} className="mode-card" style={{
            borderColor: 'transparent',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = C.emerald; e.currentTarget.style.boxShadow = `0 30px 60px -20px ${C.emerald}50`; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg style={{ position: 'absolute', right: -30, top: -30, opacity: 0.06 }} width="200" height="200" viewBox="0 0 200 200" fill={C.emerald}>
              <path d="M60 50 L100 30 L140 50 L140 130 L100 150 L60 130 Z" />
              <path d="M85 80 L115 80 L100 110 Z" fill={C.cream} />
            </svg>

            {/* Badge */}
            <div style={{
              position: 'absolute', top: 20, right: 20,
              background: `${C.emerald}20`,
              color: C.emeraldDeep,
              padding: '5px 12px', borderRadius: 100,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              border: `1px solid ${C.emerald}40`,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Upload size={10} /> CLAUDE · GEMINI · BOLT
            </div>

            <div style={{
              width: 80, height: 80, borderRadius: 22,
              background: `linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDeep} 100%)`,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
              boxShadow: `0 16px 32px -8px ${C.emerald}`,
            }}>
              <Code size={36} />
            </div>

            <h4 className="display-font" style={{
              fontSize: 28, fontWeight: 800, color: C.ink,
              margin: '0 0 8px', letterSpacing: '-0.02em',
            }}>
              Import <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.emeraldDeep }}>HTML</em>
            </h4>
            <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.5, margin: '0 0 20px' }}>
              Créez votre site sur <strong style={{ color: C.emeraldDeep }}>Claude, Gemini ou Bolt</strong>, collez le HTML ici. Orlode l'héberge et y injecte le widget chat.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {[
                { icon: Code2, text: 'Coller HTML ou .html' },
                { icon: MessageCircle, text: 'Widget chat auto-injecté' },
                { icon: Globe, text: 'Hébergement Orlode' },
                { icon: Rocket, text: 'En ligne en 10 secondes' },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: C.emeraldSoft, color: C.emeraldDeep,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={12} />
                    </div>
                    <span style={{ fontSize: 13, color: C.ink, fontWeight: 500 }}>{f.text}</span>
                  </div>
                );
              })}
            </div>

            <button style={{
              width: '100%', justifyContent: 'center', padding: '14px 22px', fontSize: 15,
              background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
              color: C.cream, border: 'none', borderRadius: 12,
              fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: `0 8px 20px -6px ${C.emerald}`,
            }}>
              <Upload size={16} /> Importer mon HTML
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Import URL section */}
        <div style={{ maxWidth: 700, margin: '40px auto 32px' }}>
          <div style={{
            background: C.cream, borderRadius: 18,
            padding: 20, border: `1.5px solid ${C.cyan}30`,
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
              color: C.cream,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Globe size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 250 }}>
              <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                Vous avez déjà un site ? <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanDeep }}>Importez-le</em>
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>
                L'IA lit votre site, comprend votre marque, et propose une nouvelle version
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 250 }}>
              <input
                type="url"
                value={importUrl}
                onChange={e => setImportUrl(e.target.value)}
                placeholder="orlode.com"
                className="input-field"
                style={{ flex: 1 }}
              />
              <button onClick={() => onImportUrl(importUrl)} className="btn-cyan" style={{ padding: '12px 18px', fontSize: 13 }}>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
// ============ AI WIZARD — 5 ÉTAPES ============
function AIWizard({ onBack, onComplete, prefilledUrl }) {
  const { company } = useAuthStore();
  const [step, setStep] = useState(1);
  const [scrapingDone, setScrapingDone] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  // AI provider choice — affects display copy. Real backend call is wired separately
  // (currently /api/website/generate not exposed; using Gemini under the hood).
  type AiProvider = 'claude' | 'gemini' | 'openai';
  const [aiProvider, setAiProvider] = useState<AiProvider>(
    (typeof window !== 'undefined'
      ? (localStorage.getItem('orlode.websiteBuilder.aiProvider') as AiProvider | null)
      : null) ?? 'claude'
  );
  const aiMeta: Record<AiProvider, { label: string; short: string; color: string; emoji: string; tag: string }> = {
    claude: { label: 'Claude Sonnet 4.7', short: 'Claude',  color: '#D97757', emoji: '✶', tag: 'qualité rédactionnelle premium' },
    gemini: { label: 'Gemini 2.5 Flash',  short: 'Gemini',  color: '#4285F4', emoji: '✦', tag: 'rapide et économique' },
    openai: { label: 'GPT-4o',            short: 'OpenAI',  color: '#10A37F', emoji: '◉', tag: 'créatif et structuré' },
  };
  const setAiProviderPersist = (p: AiProvider) => {
    setAiProvider(p);
    if (typeof window !== 'undefined') localStorage.setItem('orlode.websiteBuilder.aiProvider', p);
  };

  // Form data — pre-filled with company info (user can customize)
  const defaultUrl = (company?.website ?? '').replace(/^https?:\/\//, '') || 'monentreprise.com';
  const [siteData, setSiteData] = useState({
    url: prefilledUrl || defaultUrl,
    name: company?.name ?? 'Mon entreprise',
    tagline: '',
    services: '',
    primaryColor: '#0A4F3C',
    secondaryColor: '#D4A017',
    type: 'corporate',
    audience: 'b2b',
    tone: 'pro',
    cta: 'rdv',
    sections: ['hero', 'about', 'services', 'pricing', 'testimonials', 'contact'],
  });

  // Auto-trigger scraping animation when entering step 2
  React.useEffect(() => {
    if (step === 2 && !scrapingDone) {
      const timer = setTimeout(() => setScrapingDone(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [step, scrapingDone]);

  // Real AI generation via POST /api/website/generate.
  // We keep the same state machine (generating → generated) so the existing
  // animated checklist UI still plays. The actual API call happens in startGeneration().
  const startGeneration = async () => {
    setGenerated(false);
    setGenerating(true);
    try {
      const r: any = await api.post('/website/generate', {
        template: siteData?.type === 'ecommerce' ? 'ecommerce' : siteData?.type === 'listing' ? 'listing' : 'vitrine',
        style:    siteData?.tone === 'pro' ? 'corporate' : siteData?.tone === 'fun' ? 'bold' : 'modern',
        color:    siteData?.primaryColor ?? '#6c3ce0',
        language: 'fr',
        provider: aiProvider,
      });
      const data = r?.data?.data ?? r?.data;
      // data has { siteUrl, pagesGenerated, sections, message } — UI uses static mock so no need to wire it deeper here
      void data;
      setGenerated(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Génération impossible. Réessaie.';
      toast.error('Échec génération', msg);
      setGenerating(false);
      setGenerated(false);
      return;
    }
    setGenerating(false);
  };

  return (
    <>
      <PageHeader
        title="Assistant IA,"
        italic="construction guidée."
        subtitle={`Étape ${step} sur 5 · L'IA crée votre site en quelques minutes`}
        badge={`MODE IA · ${aiMeta[aiProvider].label.toUpperCase()}`}
        onBack={onBack}
      />

      {/* Stepper */}
      <div style={{ padding: '24px 32px 0' }}>
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'center',
          maxWidth: 900, margin: '0 auto', flexWrap: 'wrap',
        }}>
          {[
            { num: 1, label: 'Source', icon: Globe },
            { num: 2, label: 'Analyse', icon: Brain },
            { num: 3, label: 'Type', icon: LayoutGrid },
            { num: 4, label: 'Style', icon: Palette },
            { num: 5, label: 'Génération', icon: Sparkles },
          ].map((s, i) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            const Icon = s.icon;
            return (
              <React.Fragment key={s.num}>
                <div style={{
                  flex: 1, minWidth: 130, padding: '12px 14px',
                  background: isActive ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : (isDone ? C.emeraldSoft : C.cream),
                  color: isActive ? C.cream : (isDone ? C.emeraldDeep : C.inkSoft),
                  borderRadius: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, fontWeight: 700,
                  border: '1px solid rgba(10,42,32,0.06)',
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? `0 8px 20px -6px ${C.violet}` : 'none',
                }}>
                  <div className={isActive ? 'step-active' : ''} style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: isActive ? C.cream : (isDone ? C.emeraldDeep : C.creamDeep),
                    color: isActive ? C.violet : (isDone ? C.cream : C.inkSoft),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {isDone ? <CheckCircle2 size={14} /> : (isActive ? <Icon size={13} /> : s.num)}
                  </div>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div style={{ padding: '32px 32px 32px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          background: C.cream, borderRadius: 24,
          padding: 36, border: '1px solid rgba(10,42,32,0.06)',
          minHeight: 480,
        }}>
          {/* STEP 1 — SOURCE */}
          {step === 1 && (
            <div className="stagger">
              <h3 className="display-font" style={{
                fontSize: 26, fontWeight: 700, color: C.ink,
                margin: '0 0 8px', letterSpacing: '-0.02em',
              }}>
                D'où voulez-vous <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>partir ?</em>
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
                3 options pour démarrer votre site
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { id: 'blank', icon: Plus, color: C.cyan, title: 'Page blanche', desc: 'Décrivez tout à l\'IA depuis zéro' },
                  { id: 'url', icon: Globe, color: C.violet, title: 'Importer depuis URL existante', desc: 'L\'IA lit votre site actuel et le réinvente', recommended: true, defaultValue: siteData.url },
                  { id: 'template', icon: LayoutTemplate, color: C.pink, title: 'Choisir un template', desc: '12 templates par secteur PME ivoirien' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const isSelected = opt.id === 'url';
                  return (
                    <div key={opt.id} style={{
                      background: isSelected ? `${opt.color}10` : C.creamDeep,
                      border: isSelected ? `2px solid ${opt.color}` : '2px solid transparent',
                      borderRadius: 16, padding: 18,
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      position: 'relative',
                    }}>
                      {opt.recommended && (
                        <div style={{
                          position: 'absolute', top: -10, right: 16,
                          background: `linear-gradient(135deg, ${opt.color}, ${C.pink})`,
                          color: C.cream,
                          padding: '3px 10px', borderRadius: 100,
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                          boxShadow: `0 4px 8px -2px ${opt.color}`,
                        }}>RECOMMANDÉ</div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 13,
                          background: `linear-gradient(135deg, ${opt.color} 0%, ${opt.color}cc 100%)`,
                          color: C.cream,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: `0 8px 16px -4px ${opt.color}`,
                        }}>
                          <Icon size={22} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                            {opt.title}
                          </div>
                          <div style={{ fontSize: 12, color: C.inkSoft }}>{opt.desc}</div>
                        </div>
                        {isSelected && <CheckCircle2 size={20} color={opt.color} />}
                      </div>

                      {opt.id === 'url' && (
                        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                          <div style={{
                            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                            background: C.cream, padding: '10px 14px',
                            borderRadius: 10, border: '1.5px solid rgba(10,42,32,0.08)',
                          }}>
                            <Globe size={14} color={C.inkSoft} />
                            <input
                              value={siteData.url}
                              onChange={e => setSiteData({...siteData, url: e.target.value})}
                              style={{
                                flex: 1, border: 'none', outline: 'none',
                                background: 'transparent', fontSize: 14,
                                fontFamily: 'JetBrains Mono, monospace',
                                color: C.violet, fontWeight: 600,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
                <button onClick={() => setStep(2)} className="btn-primary">
                  Continuer · Analyser le site <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — ANALYSE (scraping animation) */}
          {step === 2 && (
            <div>
              <h3 className="display-font" style={{
                fontSize: 26, fontWeight: 700, color: C.ink,
                margin: '0 0 8px', letterSpacing: '-0.02em',
              }}>
                {scrapingDone
                  ? <>Voici ce que j'ai <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>compris</em></>
                  : <>L'IA <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>analyse</em> votre site…</>
                }
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
                <span className="mono-font" style={{ color: C.violet, fontWeight: 700 }}>{siteData.url}</span>
              </p>

              {/* Scraping animation */}
              {!scrapingDone && (
                <div style={{
                  background: '#0A0F12',
                  borderRadius: 16, padding: 24,
                  border: `1px solid ${C.violet}40`,
                }}>
                  <div className="mono-font" style={{ fontSize: 13, color: C.cream, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { text: '> Connexion à orlode.com…', color: '#7FE5A1' },
                      { text: '> Lecture du HTML (47.3 KB)…', color: '#7FE5A1' },
                      { text: '> Détection du logo…', color: C.violetLight },
                      { text: '> Extraction des couleurs…', color: C.violetLight },
                      { text: '> Analyse du contenu (Claude Sonnet 4.7)…', color: C.cyan },
                    ].map((line, i) => (
                      <div key={i} style={{
                        color: line.color,
                        opacity: 0,
                        animation: `slideIn 0.4s ease-out ${i * 0.4}s forwards`,
                      }}>
                        {line.text}
                      </div>
                    ))}

                    <div style={{ display: 'flex', gap: 4, marginTop: 12, alignItems: 'center' }}>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span style={{ marginLeft: 8, color: 'rgba(255,250,240,0.6)', fontSize: 12 }}>
                        Compréhension de la marque…
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Result */}
              {scrapingDone && (
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{
                    background: `linear-gradient(135deg, ${C.violetSoft}, ${C.cream})`,
                    border: `1.5px solid ${C.violet}30`,
                    borderRadius: 14, padding: 16,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <CheckCircle2 size={20} color={C.emeraldDeep} />
                    <span style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>
                      <strong>Analyse terminée en 2.4s.</strong> Voici ce que j'ai détecté de votre marque :
                    </span>
                  </div>

                  {/* Brand details grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    {[
                      { label: 'NOM', value: siteData.name, icon: Building },
                      { label: 'TAGLINE', value: siteData.tagline, icon: Target },
                      { label: 'SERVICES PRINCIPAUX', value: siteData.services, icon: Layers, full: true },
                      { label: 'COULEUR PRIMAIRE', value: siteData.primaryColor, icon: Palette, color: true },
                      { label: 'COULEUR ACCENT', value: siteData.secondaryColor, icon: Palette, color: true },
                    ].map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <div key={i} style={{
                          background: C.creamDeep, borderRadius: 12, padding: 14,
                          border: '1px solid rgba(10,42,32,0.05)',
                          gridColumn: item.full ? '1 / -1' : 'auto',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Icon size={12} color={C.inkSoft} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>
                              {item.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {item.color && (
                              <div style={{
                                width: 24, height: 24, borderRadius: 6,
                                background: item.value,
                                border: '2px solid rgba(255,255,255,0.5)',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                              }}></div>
                            )}
                            <span className={item.color ? 'mono-font' : 'display-font'} style={{
                              fontSize: item.color ? 13 : 15,
                              fontWeight: 700, color: C.ink,
                            }}>
                              {item.value}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
                      <Edit3 size={12} /> Modifier ces infos
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setStep(1)} className="btn-secondary">
                        <ArrowLeft size={13} /> Retour
                      </button>
                      <button onClick={() => setStep(3)} className="btn-primary">
                        C'est correct, continuer <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — TYPE DE SITE */}
          {step === 3 && (
            <div className="stagger">
              <h3 className="display-font" style={{
                fontSize: 26, fontWeight: 700, color: C.ink,
                margin: '0 0 8px', letterSpacing: '-0.02em',
              }}>
                Quel <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>type de site</em> ?
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
                Sélectionnez l'objectif principal de votre site
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { id: 'corporate', icon: Building2, color: C.blue, label: 'Site corporate', desc: 'Présenter l\'entreprise' },
                  { id: 'vitrine', icon: Globe, color: C.cyan, label: 'Site vitrine', desc: 'Vitrine produits/services' },
                  { id: 'landing', icon: Rocket, color: C.violet, label: 'Landing page', desc: 'Conversion 1 page' },
                  { id: 'ecommerce', icon: ShoppingBag, color: C.pink, label: 'E-commerce', desc: 'Mobile Money intégré' },
                  { id: 'school', icon: GraduationCap, color: C.orange, label: 'École/Formation', desc: 'Cours, programmes' },
                  { id: 'ngo', icon: HandHeart, color: C.emerald, label: 'ONG / Asso', desc: 'Mission, dons' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const isSelected = siteData.type === opt.id;
                  return (
                    <div key={opt.id} onClick={() => setSiteData({...siteData, type: opt.id})} style={{
                      background: isSelected ? `${opt.color}15` : C.creamDeep,
                      border: isSelected ? `2px solid ${opt.color}` : '2px solid transparent',
                      borderRadius: 14, padding: 16,
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      textAlign: 'center',
                    }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 14,
                        background: isSelected ? `linear-gradient(135deg, ${opt.color}, ${opt.color}cc)` : `${opt.color}20`,
                        color: isSelected ? C.cream : opt.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 10px',
                        boxShadow: isSelected ? `0 8px 16px -4px ${opt.color}` : 'none',
                        transition: 'all 0.2s ease',
                      }}>
                        <Icon size={24} />
                      </div>
                      <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>{opt.desc}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 28 }}>
                <button onClick={() => setStep(2)} className="btn-secondary">
                  <ArrowLeft size={13} /> Retour
                </button>
                <button onClick={() => setStep(4)} className="btn-primary">
                  Continuer <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — STYLE & SECTIONS */}
          {step === 4 && (
            <div className="stagger">
              <h3 className="display-font" style={{
                fontSize: 26, fontWeight: 700, color: C.ink,
                margin: '0 0 8px', letterSpacing: '-0.02em',
              }}>
                Personnalisons <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.violet }}>votre site</em>
              </h3>
              <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 24px' }}>
                Quelques questions pour adapter le ton et le contenu
              </p>

              {/* Public cible */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 8 }}>
                  PUBLIC CIBLE
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'b2b', label: 'B2B (Entreprises)', icon: Building },
                    { id: 'b2c', label: 'B2C (Particuliers)', icon: User },
                    { id: 'mix', label: 'Mix B2B + B2C', icon: Users2 },
                  ].map(p => {
                    const Icon = p.icon;
                    const active = siteData.audience === p.id;
                    return (
                      <button key={p.id} onClick={() => setSiteData({...siteData, audience: p.id})} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 10,
                        background: active ? C.violet : C.creamDeep,
                        color: active ? C.cream : C.ink,
                        border: active ? `2px solid ${C.violet}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}>
                        <Icon size={14} /> {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ton */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 8 }}>
                  TON DU SITE
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'pro', label: 'Professionnel', emoji: '👔' },
                    { id: 'friendly', label: 'Friendly', emoji: '😊' },
                    { id: 'premium', label: 'Premium', emoji: '✨' },
                    { id: 'fun', label: 'Fun & Bold', emoji: '🎉' },
                  ].map(t => {
                    const active = siteData.tone === t.id;
                    return (
                      <button key={t.id} onClick={() => setSiteData({...siteData, tone: t.id})} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 16px', borderRadius: 10,
                        background: active ? C.violet : C.creamDeep,
                        color: active ? C.cream : C.ink,
                        border: active ? `2px solid ${C.violet}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 600,
                      }}>
                        <span style={{ fontSize: 16 }}>{t.emoji}</span> {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CTA principal */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 8 }}>
                  ACTION PRINCIPALE (CTA)
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { id: 'rdv', label: 'Prendre RDV', icon: Calendar },
                    { id: 'devis', label: 'Demander devis', icon: FileText },
                    { id: 'achat', label: 'Acheter', icon: ShoppingBag },
                    { id: 'contact', label: 'Contact', icon: MessageCircle },
                  ].map(c => {
                    const Icon = c.icon;
                    const active = siteData.cta === c.id;
                    return (
                      <button key={c.id} onClick={() => setSiteData({...siteData, cta: c.id})} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 10,
                        background: active ? C.violet : C.creamDeep,
                        color: active ? C.cream : C.ink,
                        border: active ? `2px solid ${C.violet}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 600,
                      }}>
                        <Icon size={14} /> {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sections désirées */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 8 }}>
                  SECTIONS DU SITE (cochez les voulues)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { id: 'hero', label: 'Hero' },
                    { id: 'about', label: 'À propos' },
                    { id: 'services', label: 'Services' },
                    { id: 'pricing', label: 'Tarifs' },
                    { id: 'testimonials', label: 'Témoignages' },
                    { id: 'faq', label: 'FAQ' },
                    { id: 'contact', label: 'Contact' },
                    { id: 'blog', label: 'Blog' },
                  ].map(s => {
                    const active = siteData.sections.includes(s.id);
                    return (
                      <button key={s.id} onClick={() => {
                        setSiteData({
                          ...siteData,
                          sections: active ? siteData.sections.filter(x => x !== s.id) : [...siteData.sections, s.id],
                        });
                      }} style={{
                        padding: '10px 12px', borderRadius: 10,
                        background: active ? C.violetSoft : C.creamDeep,
                        color: active ? C.violet : C.inkSoft,
                        border: active ? `2px solid ${C.violet}` : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        {s.label}
                        {active && <CheckCircle2 size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 28 }}>
                <button onClick={() => setStep(3)} className="btn-secondary">
                  <ArrowLeft size={13} /> Retour
                </button>
                <button onClick={() => setStep(5)} className="btn-primary">
                  <Sparkles size={16} fill={C.cream} /> Générer mon site !
                </button>
              </div>
            </div>
          )}

          {/* STEP 5 — GENERATION */}
          {step === 5 && (
            <div>
              {/* PROVIDER PICKER — visible before clicking Generate */}
              {!generating && !generated && (
                <div style={{ textAlign: 'center', padding: '20px 20px 0' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 22,
                    background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
                    color: C.cream,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                    boxShadow: `0 16px 32px -8px ${C.violet}`,
                  }}>
                    <Sparkles size={36} fill={C.cream} />
                  </div>
                  <h3 className="display-font" style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                    Choisis le moteur IA
                  </h3>
                  <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 22px' }}>
                    Chaque IA a son style. Tu peux changer plus tard et regénérer.
                  </p>

                  <div style={{ maxWidth: 540, margin: '0 auto 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {(Object.keys(aiMeta) as AiProvider[]).map((p) => {
                      const m = aiMeta[p];
                      const selected = aiProvider === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setAiProviderPersist(p)}
                          style={{
                            background: selected ? m.color : C.cream,
                            color: selected ? C.cream : C.ink,
                            border: `2px solid ${selected ? m.color : 'rgba(10,42,32,0.1)'}`,
                            borderRadius: 14, padding: '14px 10px',
                            cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            boxShadow: selected ? `0 10px 24px -8px ${m.color}` : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: selected ? C.cream : m.color }}>
                            {m.emoji}
                          </span>
                          <span className="display-font" style={{ fontSize: 14, fontWeight: 700 }}>{m.short}</span>
                          <span style={{ fontSize: 10, opacity: 0.85, lineHeight: 1.2, textAlign: 'center' }}>{m.tag}</span>
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={startGeneration} className="btn-primary" style={{ padding: '14px 28px', fontSize: 14 }}>
                    <Sparkles size={16} fill={C.cream} /> Générer mon site avec {aiMeta[aiProvider].short}
                  </button>
                  <div style={{ marginTop: 10, fontSize: 11, color: C.inkLight }}>
                    Coût estimé : ~{aiProvider === 'gemini' ? '$0.002' : aiProvider === 'claude' ? '$0.04' : '$0.03'} · ~{aiProvider === 'gemini' ? '3' : '5'} sec
                  </div>
                </div>
              )}

              {generating && (
                <div>
                  {/* Header with live indicator */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 16, gap: 12, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: `linear-gradient(135deg, ${aiMeta[aiProvider].color}, ${C.pink})`,
                        color: C.cream,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 10px 24px -6px ${aiMeta[aiProvider].color}`,
                        flexShrink: 0,
                      }}>
                        <Sparkles size={22} fill={C.cream} />
                      </div>
                      <div>
                        <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>
                          {aiMeta[aiProvider].short} construit votre site…
                        </div>
                        <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span className="live-dot" style={{ width: 6, height: 6, background: C.emerald }}></span>
                          Live · construction en direct
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                      color: aiMeta[aiProvider].color, textTransform: 'uppercase',
                      padding: '6px 12px', borderRadius: 100,
                      background: `${aiMeta[aiProvider].color}15`,
                      border: `1px solid ${aiMeta[aiProvider].color}30`,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ fontSize: 14 }}>{aiMeta[aiProvider].emoji}</span>
                      {aiMeta[aiProvider].label}
                    </div>
                  </div>

                  {/* SPLIT-SCREEN: chat (left) ↔ preview (right) */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16,
                    alignItems: 'stretch',
                  }}>
                    {/* LEFT — Chat IA (terminal-style) */}
                    <div style={{
                      background: '#0A2A20',
                      borderRadius: 14,
                      padding: 14,
                      border: `1px solid ${aiMeta[aiProvider].color}40`,
                      minHeight: 420,
                      display: 'flex', flexDirection: 'column', gap: 10,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        paddingBottom: 8, borderBottom: '1px solid rgba(255,250,240,0.08)',
                      }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <div style={{ width: 9, height: 9, borderRadius: 50, background: '#FF5F57' }}></div>
                          <div style={{ width: 9, height: 9, borderRadius: 50, background: '#FFBD2E' }}></div>
                          <div style={{ width: 9, height: 9, borderRadius: 50, background: '#28CA42' }}></div>
                        </div>
                        <span className="mono-font" style={{ fontSize: 10, color: 'rgba(255,250,240,0.5)', marginLeft: 6 }}>
                          {aiMeta[aiProvider].short.toLowerCase()}.chat · {siteData.url}
                        </span>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                        {[
                          { agent: false, text: `Construis-moi un site pour ${siteData.name} (${siteData.type})`, delay: 0 },
                          { agent: true,  text: `OK, j'analyse ta marque… Couleur primaire ${siteData.primaryColor}, ton ${siteData.tone}, public ${siteData.audience}.`, delay: 0.5 },
                          { agent: true,  text: `🎨 Je crée le Hero avec ton CTA "${siteData.cta === 'rdv' ? 'Prendre RDV' : siteData.cta === 'devis' ? 'Demander devis' : siteData.cta === 'achat' ? 'Acheter' : 'Contact'}"…`, delay: 1.1 },
                          { agent: true,  text: `📦 ${siteData.sections.length} sections personnalisées : ${siteData.sections.slice(0, 3).join(', ')}…`, delay: 1.7 },
                          { agent: true,  text: `🔌 Je branche les agents Comms, Reception, Sales, Marketing au site.`, delay: 2.3 },
                          { agent: true,  text: `✨ SEO + widget chat IA injectés. Site prêt.`, delay: 2.9 },
                        ].map((m, i) => (
                          <div key={i} style={{
                            opacity: 0,
                            animation: `slideIn 0.35s ease-out ${m.delay}s forwards`,
                            display: 'flex', gap: 8, alignItems: 'flex-start',
                            flexDirection: m.agent ? 'row' : 'row-reverse',
                          }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: 7,
                              background: m.agent
                                ? `linear-gradient(135deg, ${aiMeta[aiProvider].color}, ${C.pink})`
                                : 'rgba(255,250,240,0.12)',
                              color: C.cream,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 800,
                              flexShrink: 0,
                            }}>
                              {m.agent ? aiMeta[aiProvider].emoji : 'V'}
                            </div>
                            <div style={{
                              padding: '7px 11px', borderRadius: 10,
                              background: m.agent ? 'rgba(255,250,240,0.08)' : `${aiMeta[aiProvider].color}30`,
                              color: m.agent ? '#E0F2F1' : C.cream,
                              fontSize: 11.5, lineHeight: 1.45,
                              maxWidth: '85%',
                              border: m.agent ? '1px solid rgba(255,250,240,0.06)' : `1px solid ${aiMeta[aiProvider].color}50`,
                            }}>
                              {m.text}
                            </div>
                          </div>
                        ))}

                        {/* Typing dots — visible at the end while waiting */}
                        <div style={{
                          opacity: 0, animation: `slideIn 0.35s ease-out 3.4s forwards`,
                          display: 'flex', gap: 8, alignItems: 'center', marginTop: 4,
                        }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: 7,
                            background: `linear-gradient(135deg, ${aiMeta[aiProvider].color}, ${C.pink})`,
                            color: C.cream, fontSize: 11, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{aiMeta[aiProvider].emoji}</div>
                          <div style={{
                            padding: '8px 12px', borderRadius: 10,
                            background: 'rgba(255,250,240,0.08)',
                            display: 'flex', gap: 4, alignItems: 'center',
                          }}>
                            <span className="typing-dot" style={{ background: aiMeta[aiProvider].color }}></span>
                            <span className="typing-dot" style={{ background: aiMeta[aiProvider].color }}></span>
                            <span className="typing-dot" style={{ background: aiMeta[aiProvider].color }}></span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT — Live preview that progressively builds */}
                    <div style={{
                      background: '#fff',
                      borderRadius: 14,
                      overflow: 'hidden',
                      boxShadow: '0 16px 40px -12px rgba(10,42,32,0.25)',
                      minHeight: 420,
                      display: 'flex', flexDirection: 'column',
                    }}>
                      {/* Browser bar — appears t=0 */}
                      <div style={{
                        background: '#F5F5F5', padding: '7px 12px',
                        display: 'flex', alignItems: 'center', gap: 8,
                        borderBottom: '1px solid #E5E5E5',
                        opacity: 0,
                        animation: `slideIn 0.35s ease-out 0s forwards`,
                      }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <div style={{ width: 9, height: 9, borderRadius: 50, background: '#FF5F57' }}></div>
                          <div style={{ width: 9, height: 9, borderRadius: 50, background: '#FFBD2E' }}></div>
                          <div style={{ width: 9, height: 9, borderRadius: 50, background: '#28CA42' }}></div>
                        </div>
                        <div className="mono-font" style={{
                          flex: 1, background: '#fff', padding: '3px 10px',
                          borderRadius: 5, fontSize: 10, color: C.inkSoft,
                          textAlign: 'center',
                        }}>{siteData.url}</div>
                      </div>

                      {/* Hero — appears t=1.1 */}
                      <div style={{
                        opacity: 0,
                        animation: `slideIn 0.4s ease-out 1.1s forwards`,
                        background: `linear-gradient(135deg, ${siteData.primaryColor}, ${siteData.primaryColor}dd)`,
                        padding: '24px 18px',
                        color: C.cream,
                        textAlign: 'center',
                      }}>
                        <div style={{
                          display: 'inline-block',
                          background: `${siteData.secondaryColor}30`,
                          padding: '3px 9px', borderRadius: 100,
                          fontSize: 8, fontWeight: 700, marginBottom: 8,
                          color: siteData.secondaryColor, letterSpacing: '0.05em',
                        }}>NOUVEAU</div>
                        <div className="display-font" style={{ fontSize: 18, fontWeight: 800, marginBottom: 5, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                          {siteData.name}
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 10 }}>
                          {(siteData.services || siteData.tagline || 'IA pour votre entreprise').slice(0, 60)}
                        </div>
                        <button style={{
                          background: siteData.secondaryColor,
                          color: siteData.primaryColor,
                          padding: '6px 12px', borderRadius: 6,
                          border: 'none', fontWeight: 700, fontSize: 10,
                        }}>
                          {siteData.cta === 'rdv' ? '📅 RDV' : siteData.cta === 'devis' ? '📄 Devis' : siteData.cta === 'achat' ? '🛍️ Acheter' : '💬 Contact'}
                        </button>
                      </div>

                      {/* Features grid — appears t=1.7 */}
                      <div style={{
                        padding: '14px 14px 10px',
                        opacity: 0,
                        animation: `slideIn 0.4s ease-out 1.7s forwards`,
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                          {[
                            { e: '⚡', l: 'Rapide' },
                            { e: '🛡️', l: 'Sécurisé' },
                            { e: '🤖', l: 'IA' },
                          ].map((f, i) => (
                            <div key={i} style={{
                              background: C.creamDeep, padding: '8px 4px',
                              borderRadius: 6, textAlign: 'center',
                            }}>
                              <div style={{ fontSize: 14 }}>{f.e}</div>
                              <div style={{ fontSize: 8, fontWeight: 700, color: C.ink, marginTop: 2 }}>{f.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Sections list — appears t=2.3 */}
                      <div style={{
                        padding: '0 14px 10px',
                        opacity: 0,
                        animation: `slideIn 0.4s ease-out 2.3s forwards`,
                      }}>
                        {siteData.sections.slice(0, 3).map((s, i) => (
                          <div key={i} style={{
                            background: C.creamDeep, borderRadius: 5,
                            padding: '6px 8px', marginBottom: 4,
                            fontSize: 9, color: C.inkSoft,
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}>
                            <CheckCircle2 size={9} color={C.emerald} />
                            <span style={{ fontWeight: 600, color: C.ink }}>{s}</span>
                          </div>
                        ))}
                      </div>

                      {/* Chat widget bubble — appears t=2.9 with pulse */}
                      <div style={{
                        flex: 1, position: 'relative',
                        background: C.creamDeep, minHeight: 50,
                        opacity: 0,
                        animation: `slideIn 0.4s ease-out 2.9s forwards`,
                      }}>
                        <div style={{
                          position: 'absolute', right: 10, bottom: 10,
                          background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
                          color: C.cream,
                          padding: '6px 10px', borderRadius: 100,
                          fontSize: 9, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4,
                          boxShadow: `0 8px 16px -4px ${C.violet}`,
                          animation: 'stepPulse 2s ease-in-out infinite 3s',
                        }}>
                          <MessageCircle size={9} /> Chat IA
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer progress with agent badges */}
                  <div style={{
                    marginTop: 16, padding: '12px 16px', borderRadius: 12,
                    background: C.creamDeep,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Loader2 size={14} className="spin" color={aiMeta[aiProvider].color} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>
                        Branchement des agents en cours…
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { name: 'Comms',     color: C.emerald, delay: 0 },
                        { name: 'Reception', color: C.cyan,    delay: 0.4 },
                        { name: 'Sales',     color: C.violet,  delay: 0.8 },
                        { name: 'Marketing', color: C.pink,    delay: 1.2 },
                      ].map((a, i) => (
                        <div key={i} style={{
                          padding: '4px 10px', borderRadius: 100,
                          background: `${a.color}15`, color: a.color,
                          fontSize: 10, fontWeight: 700,
                          border: `1px solid ${a.color}30`,
                          opacity: 0,
                          animation: `slideIn 0.3s ease-out ${a.delay}s forwards`,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <CheckCircle2 size={9} /> {a.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {generated && (
                <div className="stagger">
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: 22,
                      background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
                      color: C.cream,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px',
                      boxShadow: `0 16px 32px -8px ${C.emerald}`,
                    }}>
                      <CheckCircle2 size={40} />
                    </div>
                    <h3 className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                      Votre site est <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.emerald }}>prêt !</em>
                    </h3>
                    <p style={{ fontSize: 13, color: C.inkSoft, margin: 0 }}>
                      Généré en 4.2 secondes par {aiMeta[aiProvider].label}
                    </p>
                  </div>

                  {/* Mini site preview */}
                  <div style={{
                    background: '#fff',
                    borderRadius: 16,
                    border: '1px solid rgba(10,42,32,0.1)',
                    overflow: 'hidden',
                    marginBottom: 20,
                    boxShadow: '0 12px 32px -12px rgba(10,42,32,0.2)',
                  }}>
                    {/* Browser bar mock */}
                    <div style={{
                      background: '#F5F5F5', padding: '8px 14px',
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: '1px solid #E5E5E5',
                    }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <div style={{ width: 11, height: 11, borderRadius: 50, background: '#FF5F57' }}></div>
                        <div style={{ width: 11, height: 11, borderRadius: 50, background: '#FFBD2E' }}></div>
                        <div style={{ width: 11, height: 11, borderRadius: 50, background: '#28CA42' }}></div>
                      </div>
                      <div className="mono-font" style={{
                        flex: 1, background: '#fff', padding: '4px 12px',
                        borderRadius: 6, fontSize: 11, color: C.inkSoft,
                        textAlign: 'center', maxWidth: 300, margin: '0 auto',
                      }}>orlode.com</div>
                    </div>

                    {/* Hero generated mock */}
                    <div style={{
                      background: `linear-gradient(135deg, ${siteData.primaryColor}, ${siteData.primaryColor}dd)`,
                      padding: '40px 28px',
                      color: C.cream,
                      textAlign: 'center',
                    }}>
                      <div style={{
                        display: 'inline-block',
                        background: `${siteData.secondaryColor}30`,
                        padding: '4px 12px', borderRadius: 100,
                        fontSize: 10, fontWeight: 700, marginBottom: 12,
                        color: siteData.secondaryColor,
                      }}>NOUVEAU · 25 AGENTS IA</div>
                      <div className="display-font" style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, lineHeight: 1.1 }}>
                        {siteData.name}, <em style={{ fontStyle: 'italic', fontWeight: 500, color: siteData.secondaryColor }}>l'IA pour votre entreprise.</em>
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>
                        {siteData.services}
                      </div>
                      <button style={{
                        background: siteData.secondaryColor,
                        color: siteData.primaryColor,
                        padding: '10px 20px', borderRadius: 10,
                        border: 'none', fontWeight: 700, fontSize: 13,
                        cursor: 'pointer',
                      }}>
                        {siteData.cta === 'rdv' ? '📅 Prendre RDV' : siteData.cta === 'devis' ? '📄 Demander devis' : siteData.cta === 'achat' ? '🛍️ Découvrir' : '💬 Contact'}
                      </button>
                    </div>

                    {/* Sections preview */}
                    <div style={{ padding: 20 }}>
                      {siteData.sections.slice(0, 3).map((s, i) => (
                        <div key={i} style={{
                          background: C.creamDeep, borderRadius: 8,
                          padding: 12, marginBottom: 8,
                          fontSize: 11, color: C.inkSoft,
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <CheckCircle2 size={12} color={C.emerald} />
                          <span style={{ fontWeight: 600, color: C.ink }}>Section "{s}"</span>
                          <span>générée avec contenu sur mesure</span>
                        </div>
                      ))}
                      {siteData.sections.length > 3 && (
                        <div style={{ fontSize: 11, color: C.inkSoft, textAlign: 'center', marginTop: 8 }}>
                          + {siteData.sections.length - 3} autres sections
                        </div>
                      )}
                    </div>

                    {/* Chat widget mock floating */}
                    <div style={{
                      position: 'relative', height: 60,
                      background: C.creamDeep,
                      display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                      padding: '0 20px',
                    }}>
                      <div className="live-dot" style={{
                        position: 'absolute', right: 30, top: 14,
                        background: C.emerald,
                      }}></div>
                      <div style={{
                        background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
                        color: C.cream,
                        padding: '8px 14px', borderRadius: 100,
                        fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: `0 8px 16px -4px ${C.violet}`,
                      }}>
                        <MessageCircle size={14} /> Chat avec l'IA
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => onComplete && onComplete(siteData)} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                      <LayoutGrid size={16} /> Modifier dans le builder
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                      <Sparkles size={14} /> Modifier avec l'IA
                    </button>
                    <button onClick={async () => {
                      try {
                        await api.put('/website/config', {
                          status: 'published',
                          companyName: siteData.name,
                          color: siteData.primaryColor,
                          enabled: true,
                          name: siteData.name,
                          tagline: siteData.tagline,
                          services: siteData.services,
                          primaryColor: siteData.primaryColor,
                          secondaryColor: siteData.secondaryColor,
                          type: siteData.type,
                          audience: siteData.audience,
                          tone: siteData.tone,
                          cta: siteData.cta,
                          sections: siteData.sections,
                          sourceUrl: siteData.url,
                          generatedBy: 'ai-wizard',
                        });
                        toast.success('Site publié', 'Votre site est en ligne.');
                      } catch (e: any) {
                        toast.error('Erreur', e?.response?.data?.message || 'Publication impossible.');
                      }
                    }} className="btn-cyan" style={{ flex: 1, justifyContent: 'center' }}>
                      <Rocket size={16} /> Publier maintenant
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
// ============ MANUAL BUILDER — 3 PANNEAUX ============
function ManualBuilder({ onBack, generatedSite }) {
  const { company } = useAuthStore();
  const [device, setDevice] = useState('desktop');
  const [rightTab, setRightTab] = useState('manual'); // 'manual' or 'ai'
  const [aiInput, setAiInput] = useState('');

  // ── Server-side state ────────────────────────────────────────────────────
  // We store the *current* site config as state, fetched once on mount and
  // refreshed after every AI modification. Without this, AI updates persist
  // server-side but the UI keeps showing the wizard's stale generatedSite.
  const [serverConfig, setServerConfig] = useState<any>(null);
  const [refreshTick, setRefreshTick] = useState(0); // bump to force re-fetch
  const refresh = () => setRefreshTick(t => t + 1);

  React.useEffect(() => {
    api.get('/website/config').then((r: any) => {
      const data = r?.data?.data ?? r?.data;
      if (data) setServerConfig(data);
    }).catch(() => { /* config doesn't exist yet — that's OK */ });
  }, [refreshTick]);

  // Merge order: server config wins (it's the source of truth), wizard data
  // is fallback for the brand-new flow before first save, defaults are last.
  const isFromAI = !!generatedSite || !!serverConfig?.aiContent;
  const siteName     = serverConfig?.companyName ?? serverConfig?.name ?? generatedSite?.name ?? 'Orlode AI';
  const siteTagline  = serverConfig?.tagline ?? generatedSite?.tagline ?? 'Multi-agent enterprise platform';
  const siteServices = serverConfig?.services ?? generatedSite?.services ?? '25 agents IA · 34 connecteurs MCP · WhatsApp natif';
  const sitePrimary  = serverConfig?.primaryColor ?? serverConfig?.color ?? generatedSite?.primaryColor ?? '#0A4F3C';
  const siteAccent   = serverConfig?.secondaryColor ?? generatedSite?.secondaryColor ?? '#D4A017';
  const siteCTA      = serverConfig?.cta ?? generatedSite?.cta ?? 'rdv';
  const siteUrl      = serverConfig?.sourceUrl ?? generatedSite?.url ?? 'orlode.com';
  const siteAudience = serverConfig?.audience ?? generatedSite?.audience ?? 'b2b';
  const siteTone     = serverConfig?.tone ?? generatedSite?.tone ?? 'pro';

  // Map section ids → display objects (filtered by what user picked in wizard)
  const allSections = {
    hero: { id: 'hero', name: 'Hero', icon: Rocket, color: C.violet },
    about: { id: 'about', name: 'À propos', icon: Building2, color: C.blue },
    services: { id: 'services', name: 'Services', icon: Layers, color: C.cyan },
    features: { id: 'features', name: 'Features', icon: Zap, color: C.cyan },
    pricing: { id: 'pricing', name: 'Tarifs', icon: Tag, color: C.emerald },
    testimonials: { id: 'testimonials', name: 'Témoignages', icon: Heart, color: C.pink },
    faq: { id: 'faq', name: 'FAQ', icon: MessageCircle, color: C.orange },
    cta: { id: 'cta', name: 'Call to Action', icon: Target, color: C.orange },
    contact: { id: 'contact', name: 'Contact', icon: Mail, color: C.cyan },
    blog: { id: 'blog', name: 'Blog', icon: FileText, color: C.pink },
    footer: { id: 'footer', name: 'Footer', icon: Boxes, color: C.inkSoft },
  };

  // Build sections list from generated site OR fallback default
  const sections = generatedSite
    ? [...generatedSite.sections.map(s => allSections[s]).filter(Boolean), allSections.footer]
    : [allSections.hero, allSections.features, allSections.testimonials, allSections.pricing, allSections.cta, allSections.footer];

  const [selectedSection, setSelectedSection] = useState(sections[0]?.id || 'hero');

  const ctaLabel = {
    rdv: '📅 Prendre RDV',
    devis: '📄 Demander devis',
    achat: '🛍️ Découvrir',
    contact: '💬 Contact',
  }[siteCTA] || '📅 Prendre RDV';

  const [aiMessages, setAiMessages] = useState([
    isFromAI
      ? { role: 'agent', text: `✨ Site généré ! J'ai créé ${sections.length - 1} sections personnalisées pour ${siteName}. Que voulez-vous ajuster ?`, time: 'À l\'instant' }
      : { role: 'agent', text: 'Salut ! Je suis l\'IA du builder. Que voulez-vous modifier ?', time: '09:42' },
  ]);

  // Available section blocks (left panel library)
  const sectionLibrary = [
    { name: 'Hero', icon: Rocket, color: C.violet },
    { name: 'Features', icon: Zap, color: C.cyan },
    { name: 'Stats', icon: BarChart3, color: C.blue },
    { name: 'Témoignages', icon: Heart, color: C.pink },
    { name: 'FAQ', icon: MessageCircle, color: C.orange },
    { name: 'Tarifs', icon: Tag, color: C.emerald },
    { name: 'CTA', icon: Target, color: C.violet },
    { name: 'Galerie', icon: Image, color: C.pink },
    { name: 'Équipe', icon: Users2, color: C.blue },
    { name: 'Contact', icon: Mail, color: C.cyan },
    { name: 'Footer', icon: Boxes, color: C.inkSoft },
  ];

  const aiSuggestions = [
    { label: 'Réécrire', icon: PenTool, color: C.violet },
    { label: 'Traduire en EN', icon: Globe, color: C.blue },
    { label: 'Optimiser SEO', icon: TrendingUp, color: C.emerald },
    { label: 'Plus court', icon: Minus, color: C.orange },
    { label: 'Plus pro', icon: Briefcase, color: C.inkSoft },
    { label: 'Plus friendly', icon: Smile, color: C.pink },
  ];

  // Snapshot of the full editable site state — this is what handleSave/handlePublish persist.
  // We assemble it from the merged values above so any AI-driven change shows up here too.
  const buildPersistPayload = (status: 'draft' | 'published') => ({
    status,
    enabled: true,
    companyName: siteName,
    name: siteName,
    tagline: siteTagline,
    services: siteServices,
    color: sitePrimary,
    primaryColor: sitePrimary,
    secondaryColor: siteAccent,
    template: serverConfig?.template ?? generatedSite?.type ?? 'vitrine',
    type: serverConfig?.type ?? generatedSite?.type ?? 'vitrine',
    audience: siteAudience,
    tone: siteTone,
    cta: siteCTA,
    sections: serverConfig?.sections ?? generatedSite?.sections ?? sections.map(s => s.id),
    sourceUrl: siteUrl,
    generatedBy: serverConfig?.generatedBy ?? (generatedSite ? 'ai-wizard' : 'manual'),
  });

  const callAiUpdate = async (instruction: string) => {
    // Optimistic: show user message + spinner placeholder right away
    setAiMessages(prev => [
      ...prev,
      { role: 'user', text: instruction, time: 'maintenant' },
      { role: 'agent', text: '⏳ Modification en cours…', time: 'maintenant' },
    ]);
    try {
      const r: any = await api.post('/website/update', { instruction });
      const data = r?.data?.data ?? r?.data;
      const ok = !!data?.success;
      const msg = data?.message ?? 'Modification appliquée.';
      const updatedSections = (data?.updatedSections ?? []).join(', ');
      setAiMessages(prev => {
        // Replace the spinner placeholder (last entry) with the real reply
        const next = [...prev];
        next[next.length - 1] = {
          role: 'agent',
          text: ok
            ? `✨ ${msg}${updatedSections ? ` Sections: ${updatedSections}.` : ''}`
            : `⚠️ ${msg}`,
          time: 'maintenant',
        };
        return next;
      });
      // Refresh the displayed site state from server so the user actually sees the change
      if (ok) refresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Le serveur n\'a pas pu appliquer la modification.';
      setAiMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'agent', text: `❌ ${msg}`, time: 'maintenant' };
        return next;
      });
    }
  };

  const handleAiSend = () => {
    if (!aiInput.trim()) return;
    const instruction = aiInput.trim();
    setAiInput('');
    callAiUpdate(instruction);
  };

  const handleAiSuggestion = (s: string) => {
    callAiUpdate(`Sur la section ${selectedSection ?? 'principale'}, ${s.toLowerCase()}.`);
  };

  const handleSave = async () => {
    try {
      await api.put('/website/config', buildPersistPayload('draft'));
      toast.success('Site sauvegardé', 'Brouillon enregistré — toutes les sections persistées.');
      refresh();
    } catch (e: any) {
      toast.error('Échec sauvegarde', e?.response?.data?.message ?? 'Réessaie.');
    }
  };

  const handlePublish = async () => {
    try {
      await api.put('/website/config', buildPersistPayload('published'));
      const previewUrl = `/api/website/preview/${company?.id ?? ''}`;
      toast.success('Site publié 🚀', `Aperçu : ${previewUrl}`);
      refresh();
    } catch (e: any) {
      toast.error('Échec publication', e?.response?.data?.message ?? 'Réessaie.');
    }
  };

  const handlePreview = async () => {
    const cid = company?.id;
    if (!cid) {
      toast.error('Aperçu indisponible', 'Connexion à l\'entreprise non détectée.');
      return;
    }
    // Always save the current editable state as draft first so the preview reflects
    // exactly what's in the UI. If already published we save as published.
    const targetStatus = serverConfig?.status === 'published' ? 'published' : 'draft';
    try {
      await api.put('/website/config', buildPersistPayload(targetStatus));
      refresh();
    } catch {
      // Non-fatal: preview the previous saved version
    }
    // For drafts the server requires the caller's Bearer token. Easiest way:
    // fetch the HTML via api (which auto-adds the token), then open as a blob URL.
    try {
      const r = await api.get(`/website/preview/${cid}`, { responseType: 'text', headers: { Accept: 'text/html' } });
      const html = (r?.data ?? '') as string;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Free the blob URL after a few seconds so memory doesn't leak
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error('Aperçu impossible', e?.response?.data?.message ?? 'Réessaie après avoir sauvegardé.');
    }
  };

  const deviceWidth = device === 'mobile' ? 380 : (device === 'tablet' ? 760 : '100%');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.greenDeep }}>
      {/* Top toolbar */}
      <div style={{
        background: C.greenDark,
        borderBottom: '1px solid rgba(255,250,240,0.06)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(255,250,240,0.08)',
          border: '1px solid rgba(255,250,240,0.12)',
          color: C.cream, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ArrowLeft size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
            color: C.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <LayoutGrid size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.cream, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
              Builder · <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanSoft }}>{siteUrl}</em>
              {isFromAI && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
                  color: C.cream, padding: '2px 8px', borderRadius: 100,
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                }}>
                  <Sparkles size={9} fill={C.cream} /> GÉNÉRÉ PAR IA
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.onGreenSoft, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="live-dot" style={{ width: 6, height: 6 }}></span>
              Sauvegardé · il y a 12s
            </div>
          </div>
        </div>

        {/* Device toggle */}
        <div className="hide-on-mobile" style={{
          display: 'inline-flex', gap: 3,
          background: 'rgba(255,250,240,0.06)',
          padding: 4, borderRadius: 10,
          border: '1px solid rgba(255,250,240,0.08)',
          margin: '0 auto',
        }}>
          {[
            { id: 'mobile', icon: Smartphone, label: 'Mobile' },
            { id: 'tablet', icon: Tablet, label: 'Tablet' },
            { id: 'desktop', icon: Monitor, label: 'Desktop' },
          ].map(d => {
            const Icon = d.icon;
            const active = device === d.id;
            return (
              <button key={d.id} onClick={() => setDevice(d.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 7,
                background: active ? C.cyan : 'transparent',
                color: active ? C.cream : C.onGreenSoft,
                border: 'none', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
                <Icon size={13} />
                <span className="hide-on-mobile">{d.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
          <button onClick={handleSave} className="btn-secondary" style={{ background: 'rgba(255,250,240,0.08)', color: C.cream, border: '1px solid rgba(255,250,240,0.12)' }}>
            <Save size={13} /> <span className="hide-on-mobile">Sauvegarder</span>
          </button>
          <button onClick={handlePreview} className="btn-secondary" style={{ background: 'rgba(255,250,240,0.08)', color: C.cream, border: '1px solid rgba(255,250,240,0.12)' }}>
            <Eye size={13} /> <span className="hide-on-mobile">Aperçu</span>
          </button>
          <button onClick={handlePublish} className="btn-cyan" style={{ padding: '10px 16px', fontSize: 13 }}>
            <Rocket size={14} /> Publier
          </button>
        </div>
      </div>

      {/* 3-PANEL LAYOUT */}
      <div className="builder-layout" style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '240px 1fr 340px',
        gap: 0,
        minHeight: 0,
        overflow: 'hidden',
      }}>

        {/* LEFT PANEL — Sections Library */}
        <aside className="builder-sidebar-l" style={{
          background: C.cream,
          borderRight: '1px solid rgba(10,42,32,0.06)',
          padding: '20px 14px',
          overflowY: 'auto',
          height: '100%',
        }}>
          {/* Pages */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10, padding: '0 4px' }}>
              📄 PAGES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { name: 'Accueil', active: true },
                { name: 'À propos' },
                { name: 'Services' },
                { name: 'Contact' },
              ].map(p => (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 8,
                  background: p.active ? C.violetSoft : 'transparent',
                  color: p.active ? C.violet : C.ink,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  fontSize: 13, fontWeight: p.active ? 700 : 500,
                }}>
                  <FileText size={13} />
                  {p.name}
                </div>
              ))}
              <button style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 8,
                background: 'transparent', color: C.violet,
                border: `1px dashed ${C.violet}40`,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', marginTop: 4,
              }}>
                <Plus size={12} /> Ajouter page
              </button>
            </div>
          </div>

          {/* Sections library */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10, padding: '0 4px' }}>
              🧩 SECTIONS · DRAG & DROP
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sectionLibrary.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} draggable style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10,
                    background: C.creamDeep,
                    border: '1.5px dashed rgba(10,42,32,0.1)',
                    cursor: 'grab', transition: 'all 0.15s ease',
                    fontSize: 13, fontWeight: 600, color: C.ink,
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = `${s.color}15`;
                    e.currentTarget.style.borderColor = s.color;
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = C.creamDeep;
                    e.currentTarget.style.borderColor = 'rgba(10,42,32,0.1)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: `${s.color}20`, color: s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={14} />
                    </div>
                    {s.name}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* CENTER PANEL — Canvas WYSIWYG */}
        <main style={{
          background: C.creamDeep,
          padding: 24,
          overflowY: 'auto',
          height: '100%',
          position: 'relative',
        }}>
          {/* Device frame indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, marginBottom: 12, fontSize: 11, color: C.inkSoft, fontWeight: 600,
          }}>
            {device === 'mobile' ? <Smartphone size={12} /> : (device === 'tablet' ? <Tablet size={12} /> : <Monitor size={12} />)}
            {device === 'mobile' ? '380 × auto' : (device === 'tablet' ? '760 × auto' : '100% × auto')}
          </div>

          {/* Canvas */}
          <div style={{
            background: '#fff',
            maxWidth: deviceWidth,
            margin: '0 auto',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 20px 60px -20px rgba(10,42,32,0.2)',
            transition: 'max-width 0.3s ease',
          }}>
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isSelected = selectedSection === sec.id;
              return (
                <div key={sec.id} onClick={() => setSelectedSection(sec.id)} style={{
                  position: 'relative',
                  cursor: 'pointer',
                  borderTop: isSelected ? `3px solid ${sec.color}` : '3px solid transparent',
                  borderBottom: isSelected ? `3px solid ${sec.color}` : '3px solid transparent',
                  transition: 'all 0.2s ease',
                }}>
                  {/* Section content mock */}
                  {sec.id === 'hero' && (
                    <div style={{
                      background: `linear-gradient(135deg, ${sitePrimary}, ${sitePrimary}dd)`,
                      padding: '60px 40px', color: C.cream, textAlign: 'center',
                    }}>
                      <div style={{
                        display: 'inline-block', background: `${siteAccent}30`,
                        padding: '4px 14px', borderRadius: 100,
                        fontSize: 11, fontWeight: 700, color: siteAccent, marginBottom: 16,
                      }}>NOUVEAU · 25 AGENTS IA</div>
                      <div className="display-font" style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                        {siteName}, <em style={{ fontStyle: 'italic', fontWeight: 500, color: siteAccent }}>{siteTagline}</em>
                      </div>
                      <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 20, maxWidth: 460, margin: '0 auto 20px' }}>
                        {siteServices}
                      </div>
                      <button style={{
                        background: siteAccent,
                        color: sitePrimary,
                        padding: '12px 24px', borderRadius: 10,
                        border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      }}>{ctaLabel}</button>
                    </div>
                  )}

                  {sec.id === 'features' && (
                    <div style={{ padding: '50px 30px', background: '#fff' }}>
                      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 24, color: C.ink }}>
                        Pourquoi <em style={{ fontStyle: 'italic', color: C.cyan }}>{siteName}</em> ?
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        {[
                          { icon: '🤖', title: '25 Agents IA', desc: 'Spécialisés métier' },
                          { icon: '⚖️', title: 'Conforme', desc: 'Multi-juridictions' },
                          { icon: '💬', title: 'WhatsApp', desc: 'Canal n°1 client' },
                        ].map((f, i) => (
                          <div key={i} style={{ textAlign: 'center', padding: '16px 8px' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>{f.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 4 }}>{f.title}</div>
                            <div style={{ fontSize: 12, color: C.inkSoft }}>{f.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sec.id === 'about' && (
                    <div style={{ padding: '50px 30px', background: '#fff' }}>
                      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 16, color: C.ink }}>
                        À <em style={{ fontStyle: 'italic', color: C.blue }}>propos</em>
                      </h3>
                      <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.7, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
                        {siteName} est une solution pensée pour les entreprises modernes. Notre mission : démocratiser l'accès à l'IA d'entreprise, avec une approche pragmatique adaptée à votre réalité.
                      </p>
                    </div>
                  )}

                  {sec.id === 'services' && (
                    <div style={{ padding: '50px 30px', background: C.creamDeep }}>
                      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 24, color: C.ink }}>
                        Nos <em style={{ fontStyle: 'italic', color: C.cyan }}>services</em>
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, maxWidth: 600, margin: '0 auto' }}>
                        {[
                          { icon: '⚙️', title: 'Automatisation', desc: 'Workflows IA sur mesure' },
                          { icon: '📊', title: 'Analytics', desc: 'Insights data-driven' },
                          { icon: '💬', title: 'Communication', desc: 'WhatsApp · Telegram' },
                          { icon: '⚖️', title: 'Conformité', desc: 'Multi-juridictions · RGPD' },
                        ].map((f, i) => (
                          <div key={i} style={{ background: '#fff', padding: 18, borderRadius: 10, border: '1px solid rgba(10,42,32,0.06)' }}>
                            <div style={{ fontSize: 26, marginBottom: 8 }}>{f.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 4 }}>{f.title}</div>
                            <div style={{ fontSize: 12, color: C.inkSoft }}>{f.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sec.id === 'faq' && (
                    <div style={{ padding: '50px 30px', background: '#fff' }}>
                      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 24, color: C.ink }}>
                        Questions <em style={{ fontStyle: 'italic', color: C.orange }}>fréquentes</em>
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600, margin: '0 auto' }}>
                        {[
                          'Comment commencer avec ' + siteName + ' ?',
                          'Quels sont vos tarifs ?',
                          'Mes données sont-elles sécurisées ?',
                          'Puis-je résilier à tout moment ?',
                        ].map((q, i) => (
                          <div key={i} style={{
                            background: C.creamDeep, padding: 14, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: 13, fontWeight: 600, color: C.ink,
                          }}>
                            <span>{q}</span>
                            <ChevronDown size={14} color={C.inkSoft} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sec.id === 'contact' && (
                    <div style={{ padding: '50px 30px', background: '#FFFAF0' }}>
                      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 16, color: C.ink }}>
                        <em style={{ fontStyle: 'italic', color: C.cyan }}>Contactez</em>-nous
                      </h3>
                      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input placeholder="Votre nom" style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(10,42,32,0.1)', fontSize: 13, fontFamily: 'inherit' }} disabled />
                        <input placeholder="Votre email" style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(10,42,32,0.1)', fontSize: 13, fontFamily: 'inherit' }} disabled />
                        <textarea placeholder="Votre message" rows={3} style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(10,42,32,0.1)', fontSize: 13, resize: 'none', fontFamily: 'inherit' }} disabled />
                        <button style={{
                          background: sitePrimary, color: C.cream,
                          padding: '12px 20px', borderRadius: 8,
                          border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}>Envoyer le message</button>
                      </div>
                    </div>
                  )}

                  {sec.id === 'blog' && (
                    <div style={{ padding: '50px 30px', background: '#fff' }}>
                      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 24, color: C.ink }}>
                        <em style={{ fontStyle: 'italic', color: C.pink }}>Blog</em> · Insights
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {[
                          { title: 'IA d\'entreprise : 5 cas d\'usage', date: '12 avr 2026' },
                          { title: 'Compliance moderne · multi-juridictions', date: '05 avr 2026' },
                          { title: 'WhatsApp Business pour entreprises', date: '28 mar 2026' },
                        ].map((p, i) => (
                          <div key={i} style={{ background: C.creamDeep, padding: 14, borderRadius: 10 }}>
                            <div style={{ height: 70, background: `linear-gradient(135deg, ${C.pink}, ${C.violet})`, borderRadius: 6, marginBottom: 10 }}></div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{p.title}</div>
                            <div style={{ fontSize: 11, color: C.inkSoft }}>{p.date}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sec.id === 'testimonials' && (
                    <div style={{ padding: '50px 30px', background: '#FFFAF0' }}>
                      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 24, color: C.ink }}>
                        Ils nous <em style={{ fontStyle: 'italic', color: C.pink }}>recommandent</em>
                      </h3>
                      <div style={{
                        background: '#fff', padding: 24, borderRadius: 12,
                        maxWidth: 500, margin: '0 auto',
                        boxShadow: '0 8px 24px -12px rgba(10,42,32,0.1)',
                      }}>
                        <div style={{ fontSize: 24, color: C.pink, marginBottom: 8 }}>"</div>
                        <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, margin: '0 0 14px' }}>
                          Orlode a transformé notre service client. Les WhatsApp répondus en automatique nous ont fait gagner 15h/semaine.
                        </p>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Patrick K.</div>
                        <div style={{ fontSize: 11, color: C.inkSoft }}>CEO · Beta SARL</div>
                      </div>
                    </div>
                  )}

                  {sec.id === 'pricing' && (
                    <div style={{ padding: '50px 30px', background: '#fff' }}>
                      <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 24, color: C.ink }}>
                        Tarifs <em style={{ fontStyle: 'italic', color: C.emerald }}>simples</em>
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 700, margin: '0 auto' }}>
                        {[
                          { name: 'Starter', price: '$22', features: '5 agents · 1K msg' },
                          { name: 'Business', price: '$49', features: '13 agents · 10K msg', popular: true },
                          { name: 'Enterprise', price: '$99', features: '18 agents · Illimité' },
                        ].map((p, i) => (
                          <div key={i} style={{
                            background: p.popular ? C.greenDeep : '#fff',
                            color: p.popular ? C.cream : C.ink,
                            padding: 16, borderRadius: 12,
                            border: '1px solid rgba(10,42,32,0.1)',
                            textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, marginBottom: 4 }}>{p.name}</div>
                            <div className="display-font" style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{p.price}</div>
                            <div style={{ fontSize: 11, opacity: 0.7 }}>{p.features}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sec.id === 'cta' && (
                    <div style={{
                      background: `linear-gradient(135deg, ${sitePrimary}, ${siteAccent})`,
                      padding: '50px 30px', color: C.cream, textAlign: 'center',
                    }}>
                      <h3 className="display-font" style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' }}>
                        Prêt à <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cream }}>commencer</em> ?
                      </h3>
                      <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 20 }}>
                        Essai gratuit 14 jours · Sans carte bancaire
                      </p>
                      <button style={{
                        background: C.cream, color: sitePrimary,
                        padding: '12px 28px', borderRadius: 10,
                        border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      }}>🚀 {ctaLabel.replace(/^\S+\s/, 'Démarrer · ')}</button>
                    </div>
                  )}

                  {sec.id === 'footer' && (
                    <div style={{
                      background: sitePrimary,
                      padding: '30px', color: C.onGreenSoft, textAlign: 'center',
                      fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 700, color: C.cream, marginBottom: 4 }}>{siteName}</div>
                      <div>contact@{siteUrl} · +XX XX XX XX XX</div>
                      <div style={{ marginTop: 8, opacity: 0.6 }}>© 2026 {siteName} · Powered by Orlode AI</div>
                    </div>
                  )}

                  {/* Selection overlay */}
                  {isSelected && (
                    <>
                      <div style={{
                        position: 'absolute', top: 8, left: 8,
                        display: 'flex', gap: 4,
                        zIndex: 5,
                      }}>
                        <div style={{
                          background: sec.color, color: C.cream,
                          padding: '4px 10px', borderRadius: 6,
                          fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: 4,
                          boxShadow: `0 4px 12px -2px ${sec.color}`,
                        }}>
                          <Icon size={11} /> {sec.name}
                        </div>
                      </div>
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        display: 'flex', gap: 4,
                        zIndex: 5,
                      }}>
                        <button style={{
                          background: C.cream, color: C.ink,
                          padding: '4px 8px', borderRadius: 6,
                          fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 3,
                          border: '1px solid rgba(10,42,32,0.1)',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px -2px rgba(10,42,32,0.2)',
                        }}>
                          <Edit3 size={10} /> Éditer
                        </button>
                        <button style={{
                          background: C.violet, color: C.cream,
                          padding: '4px 8px', borderRadius: 6,
                          fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 3,
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: `0 4px 12px -2px ${C.violet}`,
                        }}>
                          <Sparkles size={10} fill={C.cream} /> Régen IA
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add section CTA */}
          <div style={{
            maxWidth: deviceWidth,
            margin: '12px auto 0',
            padding: 14,
            background: 'transparent',
            border: `2px dashed ${C.violet}40`,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: C.violet, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>
            <Plus size={14} /> Glissez une section depuis la bibliothèque
          </div>
        </main>

        {/* RIGHT PANEL — Properties + AI Chat */}
        <aside className="builder-sidebar-r" style={{
          background: C.cream,
          borderLeft: '1px solid rgba(10,42,32,0.06)',
          display: 'flex', flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex', gap: 4,
            padding: 12,
            borderBottom: '1px solid rgba(10,42,32,0.06)',
            background: C.creamDeep,
          }}>
            <button onClick={() => setRightTab('manual')} style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              background: rightTab === 'manual' ? C.cream : 'transparent',
              color: rightTab === 'manual' ? C.ink : C.inkSoft,
              border: 'none', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: rightTab === 'manual' ? '0 2px 6px -2px rgba(10,42,32,0.15)' : 'none',
            }}>
              <Palette size={13} /> Manuel
            </button>
            <button onClick={() => setRightTab('ai')} style={{
              flex: 1, padding: '10px 12px', borderRadius: 8,
              background: rightTab === 'ai' ? `linear-gradient(135deg, ${C.violet}, ${C.pink})` : 'transparent',
              color: rightTab === 'ai' ? C.cream : C.inkSoft,
              border: 'none', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: rightTab === 'ai' ? `0 4px 12px -2px ${C.violet}` : 'none',
            }}>
              <Sparkles size={13} /> Chat IA
            </button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {/* MANUAL TAB */}
            {rightTab === 'manual' && (
              <div className="stagger">
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6 }}>
                    SECTION SÉLECTIONNÉE
                  </div>
                  <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>
                    {sections.find(s => s.id === selectedSection)?.name || 'Hero'}
                  </div>
                </div>

                {/* Text */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Type size={11} /> TITRE
                  </div>
                  <input className="input-field" defaultValue={`${siteName}, ${siteTagline}`} key={`title-${selectedSection}`} style={{ fontSize: 13 }} />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlignLeft size={11} /> SOUS-TITRE
                  </div>
                  <textarea className="input-field" defaultValue={siteServices} key={`subtitle-${selectedSection}`} style={{ minHeight: 60, resize: 'vertical', fontSize: 13 }} />
                </div>

                {/* Colors */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Palette size={11} /> COULEURS
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { color: sitePrimary, label: 'Background' },
                      { color: siteAccent, label: 'Accent' },
                      { color: '#FFFAF0', label: 'Texte' },
                    ].map((c, i) => (
                      <div key={i} style={{ flex: 1 }}>
                        <div style={{
                          width: '100%', height: 36, borderRadius: 8,
                          background: c.color,
                          border: '2px solid rgba(255,255,255,0.5)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                        }}></div>
                        <div style={{ fontSize: 9, color: C.inkSoft, marginTop: 4, textAlign: 'center', fontWeight: 600 }}>
                          {c.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Spacing */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Boxes size={11} /> ESPACEMENT
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.inkSoft, marginBottom: 4 }}>Padding Y</div>
                      <input className="input-field" defaultValue="60px" style={{ fontSize: 12, padding: '8px 12px' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.inkSoft, marginBottom: 4 }}>Padding X</div>
                      <input className="input-field" defaultValue="40px" style={{ fontSize: 12, padding: '8px 12px' }} />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                  <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
                    <Copy size={12} /> Dupliquer la section
                  </button>
                  <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 12, color: C.red, borderColor: `${C.red}40` }}
                    onMouseOver={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = C.cream; }}
                    onMouseOut={e => { e.currentTarget.style.background = C.cream; e.currentTarget.style.color = C.red; }}
                  >
                    <Trash2 size={12} /> Supprimer
                  </button>
                </div>
              </div>
            )}

            {/* AI CHAT TAB */}
            {rightTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
                {/* AI suggestions */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 8 }}>
                    ✨ ACTIONS RAPIDES
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {aiSuggestions.map((s, i) => {
                      const Icon = s.icon;
                      return (
                        <button key={i} onClick={() => handleAiSuggestion(s.label)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '6px 10px', borderRadius: 100,
                          background: `${s.color}15`, color: s.color,
                          border: `1px solid ${s.color}30`,
                          fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          <Icon size={11} /> {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0', minHeight: 0 }}>
                  {aiMessages.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 8, alignItems: 'flex-end',
                      flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 8,
                        background: m.role === 'user'
                          ? `linear-gradient(135deg, ${C.greenDeep}, ${C.greenDark})`
                          : `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
                        color: C.cream,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {m.role === 'user' ? 'A' : <Sparkles size={12} fill={C.cream} />}
                      </div>
                      <div style={{
                        background: m.role === 'user'
                          ? `linear-gradient(135deg, ${C.violet}, ${C.violetDeep})`
                          : C.creamDeep,
                        color: m.role === 'user' ? C.cream : C.ink,
                        padding: '8px 12px', borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                        fontSize: 12, lineHeight: 1.5,
                        maxWidth: '85%',
                      }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div style={{
                  marginTop: 12, paddingTop: 12,
                  borderTop: '1px solid rgba(10,42,32,0.06)',
                  display: 'flex', gap: 6,
                }}>
                  <input
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAiSend()}
                    placeholder="Demandez une modification…"
                    className="input-field"
                    style={{ flex: 1, fontSize: 12, padding: '10px 12px' }}
                  />
                  <button onClick={handleAiSend} disabled={!aiInput.trim()} style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `linear-gradient(135deg, ${C.violet}, ${C.pink})`,
                    color: C.cream, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 12px -2px ${C.violet}`,
                    opacity: aiInput.trim() ? 1 : 0.4,
                  }}>
                    <ArrowUp size={16} strokeWidth={2.5} />
                  </button>
                </div>

                <div style={{ fontSize: 9, color: C.inkLight, textAlign: 'center', marginTop: 8 }}>
                  Powered by Claude Sonnet 4.7 · Modifications en temps réel
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ============ MAIN APP — orchestrator ============
export default function WebsiteBuilderRedesignPage() {
  const [view, setView] = useState('entry'); // 'entry' | 'ai-wizard' | 'manual-builder' | 'import-html'
  const [prefilledUrl, setPrefilledUrl] = useState('');
  const [generatedSite, setGeneratedSite] = useState(null);

  if (view === 'manual-builder') {
    return (
      <Chrome>
        <ManualBuilder
          onBack={() => setView('entry')}
          generatedSite={generatedSite}
        />
      </Chrome>
    );
  }

  if (view === 'ai-wizard') {
    return (
      <Chrome>
        <AIWizard
          onBack={() => setView('entry')}
          onComplete={(data) => {
            setGeneratedSite(data);
            setView('manual-builder');
          }}
          prefilledUrl={prefilledUrl}
        />
      </Chrome>
    );
  }

  if (view === 'import-html') {
    return (
      <Chrome>
        <ImportHtmlPanel
          onBack={() => setView('entry')}
          onImported={(data) => {
            setGeneratedSite(data ?? null);
            setView('manual-builder');
          }}
        />
      </Chrome>
    );
  }

  return (
    <Chrome>
      <EntryChoice
        onSelectMode={(mode) => {
          setGeneratedSite(null); // reset if switching mode
          if (mode === 'ai') setView('ai-wizard');
          else if (mode === 'import') setView('import-html');
          else setView('manual-builder');
        }}
        onImportUrl={(url) => {
          setPrefilledUrl(url);
          setView('ai-wizard');
        }}
      />
    </Chrome>
  );
}
