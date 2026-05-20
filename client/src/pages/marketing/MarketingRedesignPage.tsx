import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import AgentDrawer from '@/components/ai/AgentDrawer';
import { toast } from '@/components/common/Toast';
import {
  Search, Bell, ChevronDown, ChevronRight, ArrowRight, ArrowUpRight,
  LayoutDashboard, MessageSquare, MessageCircle,
  Plus, Filter, MoreHorizontal, Sparkles, TrendingUp,
  CheckCircle2, Clock, AlertCircle, FileText, Send, Eye, Trash2, Edit3,
  Wand2, Download, Upload, Copy, Mail, Heart, Share2, X,
  PieChart, BarChart3, Activity, RefreshCw, Zap, Star, Award, Target,
  Image, Video, FileImage,
  Palette, PenTool, Inbox,
  CalendarDays, CalendarRange, Globe,
  Hash, Megaphone, Trophy, Stars, Rocket,
  Layers, Layout, MapPin, Users, Lightbulb, Calendar,
  Instagram, Facebook, Linkedin, Twitter, Youtube,
  Music, Crown, BookOpen, LayoutGrid, List as ListIcon,
  Loader2
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E', greenMid: '#0F6B52',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  violet: '#7C3AED', violetDeep: '#5B21B6', violetSoft: '#EDE9FE', violetMid: '#A78BFA', violetLight: '#C4B5FD',
  gold: '#D4A017', goldBright: '#F2C42E', goldSoft: '#FEF3C7', goldDeep: '#A87800',
  instagram: '#E4405F', facebook: '#1877F2', linkedin: '#0A66C2', twitter: '#1DA1F2',
  youtube: '#FF0000', tiktok: '#000000', whatsapp: '#25D366',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#EF4444', redSoft: '#FEE2E2',
  yellow: '#F59E0B', yellowSoft: '#FEF3C7',
  pink: '#EC4899', pinkSoft: '#FCE7F3',
  cyan: '#06B6D4', cyanSoft: '#CFFAFE',
  teal: '#14B8A6', tealSoft: '#CCFBF1',
  orange: '#FF6B1A', orangeSoft: '#FFE4D2',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  ink: '#0A2A20', inkSoft: '#5A6B62',
  onGreenSoft: '#A8C9B8',
};

const REFRESH_INTERVAL_MS = 10000;

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font { font-family: 'JetBrains Mono', monospace; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .tab-btn { padding: 10px 18px; font-size: 14px; font-weight: 500; color: ${C.onGreenSoft}; cursor: pointer; border-radius: 10px; transition: all 0.2s ease; background: transparent; border: none; font-family: inherit; }
  .tab-btn:hover { color: ${C.cream}; }
  .tab-btn.active { background: ${C.violet}; color: ${C.cream}; box-shadow: 0 4px 14px -4px rgba(124, 58, 237, 0.5); }
  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.violet}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.violet}; opacity: 0.4; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  @keyframes royalSparkle { 0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); } 50% { opacity: 1; transform: scale(1.2) rotate(180deg); } }
  .sparkle-1 { animation: royalSparkle 2.5s ease-in-out infinite; }
  .sparkle-2 { animation: royalSparkle 2.5s ease-in-out infinite 0.5s; }
  .sparkle-3 { animation: royalSparkle 2.5s ease-in-out infinite 1s; }
  .sparkle-4 { animation: royalSparkle 2.5s ease-in-out infinite 1.5s; }
  @keyframes crownGlow { 0%, 100% { filter: drop-shadow(0 0 8px ${C.gold}); } 50% { filter: drop-shadow(0 0 16px ${C.goldBright}); } }
  .crown-glow { animation: crownGlow 3s ease-in-out infinite; }
  .row-card { background: ${C.cream}; border-radius: 16px; padding: 18px 20px; border: 1px solid rgba(10,42,32,0.06); transition: all 0.2s ease; cursor: pointer; display: flex; align-items: center; gap: 16px; }
  .row-card:hover { transform: translateX(4px); border-color: ${C.violet}; box-shadow: 0 12px 24px -12px rgba(124, 58, 237, 0.25); }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.violetSoft}; color: ${C.violetDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.violet}; color: ${C.cream}; }
  .btn-primary { background: ${C.violet}; color: ${C.cream}; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px rgba(124, 58, 237, 0.5); font-family: inherit; }
  .btn-primary:hover { background: ${C.violetDeep}; transform: translateY(-2px); }
  .btn-secondary { background: ${C.cream}; color: ${C.greenDeep}; border: 1px solid rgba(10,42,32,0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }
  .btn-gold { background: linear-gradient(135deg, ${C.goldBright} 0%, ${C.gold} 100%); color: ${C.greenDeep}; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px ${C.gold}; font-family: inherit; }
  .btn-gold:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -8px ${C.gold}; }
  .avatar { border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 700; color: ${C.cream}; flex-shrink: 0; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; } .stagger > *:nth-child(2) { animation-delay: 0.1s; } .stagger > *:nth-child(3) { animation-delay: 0.15s; } .stagger > *:nth-child(4) { animation-delay: 0.2s; } .stagger > *:nth-child(5) { animation-delay: 0.25s; } .stagger > *:nth-child(6) { animation-delay: 0.3s; }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-charts { grid-template-columns: 1fr !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .hero-title { font-size: 32px !important; } .hide-on-mobile { display: none !important; } }
  @media (max-width: 480px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .hero-title { font-size: 26px !important; } }
  .modal-overlay { position: fixed; inset: 0; background: rgba(10, 42, 32, 0.7); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-content { background: ${C.cream}; border-radius: 24px; width: 100%; max-width: 720px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.5); animation: modalSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  @keyframes modalSlide { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .form-input { width: 100%; background: ${C.cream}; border: 1.5px solid rgba(10,42,32,0.1); border-radius: 10px; padding: 11px 14px; font-size: 14px; color: ${C.ink}; font-family: inherit; outline: none; transition: all 0.2s ease; }
  .form-input:focus { border-color: ${C.violet}; box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15); }
  .form-label { display: block; font-size: 11px; font-weight: 700; color: ${C.ink}; letter-spacing: 0.05em; margin-bottom: 6px; text-transform: uppercase; }
  .form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
`;

function Chrome({ children }: any) {
  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>{children}</main>
    </div>
  );
}

function safeGet(url: string) {
  return api.get(url).then((r: any) => r?.data ?? null).catch(() => null);
}

function useMarketingData() {
  const [data, setData] = useState<any>({
    posts: [], campaigns: [], calendar: [], content: [], stats: null,
    brand: null, attribution: null, roi: null, contentStrategy: null,
    loaded: false, lastSync: null,
  });

  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/marketing/posts'),
    safeGet('/marketing/campaigns'),
    safeGet('/marketing/calendar'),
    safeGet('/marketing/content'),
    safeGet('/marketing/stats'),
    safeGet('/marketing/brand'),
    safeGet('/marketing/attribution'),
    safeGet('/marketing/roi'),
    safeGet('/marketing/content-strategy'),
  ]).then(([p, c, cal, ctn, s, b, a, r, cs]) => {
    if (!mountedRef.current) return;
    setData({
      posts: p?.posts ?? p ?? [],
      campaigns: c?.campaigns ?? c ?? [],
      calendar: cal?.events ?? cal ?? [],
      content: ctn?.content ?? ctn ?? [],
      stats: s ?? null,
      brand: b ?? null,
      attribution: a ?? null,
      roi: r ?? null,
      contentStrategy: cs ?? null,
      loaded: true, lastSync: new Date(),
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
    <div style={{ position: 'fixed', bottom: 28, left: 28, zIndex: 50, background: 'rgba(10, 42, 32, 0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${C.violet}40`, padding: '8px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 8, color: C.cream, fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)' }}>
      <span className="live-dot"></span>
      <span style={{ color: C.violetMid }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>sync · {secondsAgo}s · refresh {intervalMs / 1000}s</span>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title = 'Pas encore de données', desc = '', action = null }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: '48px 32px', border: '1px dashed rgba(10,42,32,0.15)', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: C.violetSoft, color: C.violetDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h4 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>{title}</h4>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {action}
    </div>
  );
}

function PageHeader({ title, italic, subtitle, badge, actions, leftPills }: any) {
  return (
    <div style={{ padding: '32px 32px 0' }}>
      <div className="grain" style={{ background: `linear-gradient(135deg, ${C.violet} 0%, ${C.violetDeep} 100%)`, borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden', color: C.cream, boxShadow: `0 30px 60px -20px rgba(124, 58, 237, 0.4)` }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="40" stroke={C.gold} strokeWidth="2" fill="none" />
          <circle cx="140" cy="140" r="14" fill={C.gold} />
        </svg>
        <svg style={{ position: 'absolute', right: 80, top: 30, opacity: 0.6 }} width="20" height="20" viewBox="0 0 20 20" className="sparkle-1">
          <path d="M10 2 L11 8 L17 9 L11 10 L10 16 L9 10 L3 9 L9 8 Z" fill={C.gold} />
        </svg>
        <svg style={{ position: 'absolute', right: 140, top: 60, opacity: 0.5 }} width="14" height="14" viewBox="0 0 20 20" className="sparkle-2">
          <path d="M10 2 L11 8 L17 9 L11 10 L10 16 L9 10 L3 9 L9 8 Z" fill={C.gold} />
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              {leftPills}
              {badge && (<div className="pill" style={{ background: C.gold, color: C.greenDeep }}><Crown size={11} />{badge}</div>)}
            </div>
            <h1 className="display-font hero-title" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.cream, letterSpacing: '-0.03em' }}>
              {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>{italic}</em>}
            </h1>
            {subtitle && <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.85)', maxWidth: 540 }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      </div>
    </div>
  );
}

function TabSwitcher({ active, setActive }: any) {
  const tabGroups = [
    { label: 'PILOTAGE', tabs: ['Accueil', 'Hub Marketing', 'Calendrier', 'Analytics'] },
    { label: 'CRÉATION', tabs: ['Posts sociaux', 'Flyers IA', 'Vidéos IA', 'Visuels IA', 'Brand Kit'] },
    { label: 'GROWTH', tabs: ['Campagnes', 'Ads Manager', 'SEO', 'Influenceurs'] },
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

function ViewToggle({ view, setView }: any) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: C.greenDark, padding: 3, borderRadius: 10, border: '1px solid rgba(255,250,240,0.06)' }}>
      {[{ id: 'list', icon: ListIcon, label: 'Liste' }, { id: 'grid', icon: LayoutGrid, label: 'Grille' }].map(v => {
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

function StatCard({ label, value, suffix, sub, icon: Icon, color, bg, trendUp }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 20, padding: 22, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }}></div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 8px 16px -8px ${color}40` }}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
        {suffix && <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{suffix}</span>}
        {trendUp && <TrendingUp size={14} color={C.emeraldDeep} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

function ModalShell({ title, subtitle, icon: Icon, color = C.violet, onClose, children, footer, size = 'md' }: any) {
  const maxW = size === 'lg' ? 880 : size === 'sm' ? 480 : 640;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: maxW }} onClick={(e: any) => e.stopPropagation()}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(10,42,32,0.08)', display: 'flex', alignItems: 'center', gap: 14 }}>
          {Icon && <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={22} strokeWidth={1.75} /></div>}
          <div style={{ flex: 1 }}>
            <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0 }}>{title}</h3>
            {subtitle && <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(10,42,32,0.06)', border: 'none', color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '24px 28px', overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '18px 28px', borderTop: '1px solid rgba(10,42,32,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'rgba(10,42,32,0.02)' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ============ ROYAL AVATAR ============
function RoyalAvatar({ speaking, size = 220 }: any) {
  const [mouthFrame, setMouthFrame] = useState(0);
  useEffect(() => {
    if (!speaking) return;
    const interval = setInterval(() => setMouthFrame(f => (f + 1) % 4), 130);
    return () => clearInterval(interval);
  }, [speaking]);
  const mouthShapes = [{ ry: 1.5, w: 8 }, { ry: 4, w: 7 }, { ry: 2.5, w: 9 }, { ry: 5, w: 8 }];
  const mouth = mouthShapes[mouthFrame];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle at 30% 30%, ${C.violetMid}, ${C.violetDeep})`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: `0 24px 48px -16px ${C.violet}80, 0 0 60px -10px ${C.gold}40` }}>
      <svg width={size * 0.85} height={size * 0.92} viewBox="0 0 200 220" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="kingSkinM" cx="40%" cy="35%"><stop offset="0%" stopColor="#A06038" /><stop offset="100%" stopColor="#6B3D20" /></radialGradient>
          <linearGradient id="kingRobeM" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor={C.violetMid} /><stop offset="100%" stopColor={C.violetDeep} /></linearGradient>
          <linearGradient id="goldGradM" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor={C.goldBright} /><stop offset="100%" stopColor={C.gold} /></linearGradient>
        </defs>
        <path d="M 30 220 Q 30 150, 100 150 Q 170 150, 170 220 Z" fill="url(#kingRobeM)" />
        <path d="M 50 165 Q 100 175, 150 165" stroke="url(#goldGradM)" strokeWidth="3" fill="none" />
        <circle cx="100" cy="180" r="8" fill="url(#goldGradM)" stroke={C.violetDeep} strokeWidth="1.5" />
        <rect x="86" y="130" width="28" height="22" fill="url(#kingSkinM)" rx="4" />
        <ellipse cx="100" cy="92" rx="44" ry="50" fill="url(#kingSkinM)" />
        <g className="crown-glow">
          <rect x="55" y="50" width="90" height="14" fill="url(#goldGradM)" rx="2" />
          <path d="M 55 50 L 60 28 L 70 50 Z" fill={C.goldBright} stroke={C.goldDeep} strokeWidth="0.5" />
          <path d="M 70 50 L 80 22 L 90 50 Z" fill={C.goldBright} stroke={C.goldDeep} strokeWidth="0.5" />
          <path d="M 85 50 L 100 16 L 115 50 Z" fill={C.goldBright} stroke={C.goldDeep} strokeWidth="0.5" />
          <path d="M 110 50 L 120 22 L 130 50 Z" fill={C.goldBright} stroke={C.goldDeep} strokeWidth="0.5" />
          <path d="M 130 50 L 140 28 L 145 50 Z" fill={C.goldBright} stroke={C.goldDeep} strokeWidth="0.5" />
          <circle cx="100" cy="22" r="4" fill={C.violet} stroke={C.goldDeep} strokeWidth="0.5" />
          <circle cx="80" cy="32" r="3" fill="#DC143C" />
          <circle cx="120" cy="32" r="3" fill="#10B981" />
        </g>
        <path d="M 76 84 Q 84 80, 92 84" stroke="#1A0F08" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 108 84 Q 116 80, 124 84" stroke="#1A0F08" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="84" cy="94" rx="6" ry="4" fill={C.cream} />
        <ellipse cx="116" cy="94" rx="6" ry="4" fill={C.cream} />
        <circle cx="84" cy="94" r="3.5" fill="#3D2817" />
        <circle cx="116" cy="94" r="3.5" fill="#3D2817" />
        <circle cx="84" cy="94" r="1.8" fill="#0A0A0A" />
        <circle cx="116" cy="94" r="1.8" fill="#0A0A0A" />
        <path d="M 88 122 Q 95 118, 100 122 Q 105 118, 112 122" stroke="#1A0F08" strokeWidth="2" fill="none" strokeLinecap="round" />
        {speaking ? (
          <ellipse cx="100" cy="128" rx={mouth.w / 2} ry={mouth.ry} fill="#5C1F1F" />
        ) : (
          <path d="M 90 128 Q 100 134, 110 128" stroke="#5C1F1F" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
        <ellipse cx="56" cy="95" rx="4" ry="8" fill="url(#kingSkinM)" />
        <ellipse cx="144" cy="95" rx="4" ry="8" fill="url(#kingSkinM)" />
        <circle cx="56" cy="105" r="2.5" fill="url(#goldGradM)" />
        <circle cx="144" cy="105" r="2.5" fill="url(#goldGradM)" />
      </svg>
      <div style={{ position: 'absolute', bottom: -8, right: -8, width: 50, height: 50, borderRadius: '50%', background: `linear-gradient(135deg, ${C.goldBright} 0%, ${C.gold} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -4px rgba(0,0,0,0.4)', border: `4px solid ${C.violetDeep}` }}>
        <Crown size={20} color={C.violetDeep} />
      </div>
    </div>
  );
}

// ============ MODALS ============
function NewPostModal({ onClose, openModal }: any) {
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['instagram']);
  const [hashtags, setHashtags] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const togglePlatform = (id: string) => setPlatforms(platforms.includes(id) ? platforms.filter(c => c !== id) : [...platforms, id]);
  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/marketing/posts/generate', { topic: content || 'Post promo', platforms });
      setContent((res?.data as any)?.content || '');
    } catch (e: any) {
      toast.error('Erreur génération', e?.response?.data?.message || 'IA indisponible.');
    }
    setGenerating(false);
  };
  const submit = async () => {
    if (submitting) return;
    if (!content.trim()) { toast.error('Contenu requis'); return; }
    if (platforms.length === 0) { toast.error('Choisis au moins une plateforme'); return; }
    setSubmitting(true);
    try {
      await api.post('/marketing/posts', { content, platforms, hashtags, scheduledAt: scheduleAt || null });
      toast.success(scheduleAt ? 'Post planifié' : 'Post publié');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de publier.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouveau post" subtitle="Multi-plateformes · IA disponible" icon={Image} color={C.violet} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Brouillon</button>
        <button className="btn-primary" disabled={submitting} onClick={submit}><Send size={14} /> {submitting ? 'Envoi…' : (scheduleAt ? 'Planifier' : 'Publier')}</button></>}>
      <label className="form-label">Plateformes</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'instagram', name: 'Instagram', icon: Instagram, color: C.instagram },
          { id: 'facebook', name: 'Facebook', icon: Facebook, color: C.facebook },
          { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: C.linkedin },
          { id: 'twitter', name: 'Twitter', icon: Twitter, color: C.twitter },
          { id: 'youtube', name: 'YouTube', icon: Youtube, color: C.youtube },
          { id: 'tiktok', name: 'TikTok', icon: Music, color: C.tiktok },
        ].map(p => {
          const Ic = p.icon;
          const active = platforms.includes(p.id);
          return (
            <button key={p.id} onClick={() => togglePlatform(p.id)} style={{ background: active ? `${p.color}20` : C.cream, border: `1.5px solid ${active ? p.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Ic size={16} color={p.color} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.ink }}>{p.name}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="form-label" style={{ marginBottom: 0 }}>Contenu</label>
        <button onClick={generate} disabled={generating} style={{ background: C.violet, color: C.cream, border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: generating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
          <Wand2 size={12} /> {generating ? 'Génération…' : 'Rédiger avec IA'}
        </button>
      </div>
      <textarea className="form-input" rows={6} value={content} onChange={(e: any) => setContent(e.target.value)} placeholder="Lancement de notre nouveau produit…" style={{ marginTop: 6 }}></textarea>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Hashtags</label>
        <input className="form-input" placeholder="#orlode #ai #orlode_ai" value={hashtags} onChange={e => setHashtags(e.target.value)} />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Date de publication (vide = immédiat)</label>
        <input type="datetime-local" className="form-input" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => { onClose(); openModal('image'); }} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}><Image size={12} /> Image</button>
        <button onClick={() => { onClose(); openModal('video'); }} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}><Video size={12} /> Vidéo</button>
        <button onClick={() => { onClose(); openModal('image'); }} className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}><Sparkles size={12} /> Visuel IA</button>
      </div>
    </ModalShell>
  );
}

function NewCampaignModal({ onClose }: any) {
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('Notoriété');
  const [budget, setBudget] = useState('');
  const [duration, setDuration] = useState('14');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [audience, setAudience] = useState('Tous les contacts');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!name.trim()) { toast.error('Nom requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/marketing/campaigns', {
        name, objective,
        budget: budget ? Number(budget) : null,
        duration, startDate, endDate, audience, description,
      });
      toast.success('Campagne lancée');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de lancer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouvelle campagne" subtitle="Multi-canal · Budget · Cible" icon={Rocket} color={C.orange} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Brouillon</button>
        <button className="btn-primary" style={{ background: C.orange }} disabled={submitting} onClick={submit}><Rocket size={14} /> {submitting ? 'Envoi…' : 'Lancer'}</button></>}>
      <div className="form-row">
        <div><label className="form-label">Nom</label><input className="form-input" placeholder="Ex : Promo Black Friday 2026" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="form-label">Objectif</label>
          <select className="form-input" value={objective} onChange={e => setObjective(e.target.value)}><option>Notoriété</option><option>Trafic</option><option>Conversions</option><option>Engagement</option><option>Leads</option></select>
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Budget</label><input className="form-input" type="number" placeholder="500 000" value={budget} onChange={e => setBudget(e.target.value)} /></div>
        <div><label className="form-label">Durée (jours)</label><input className="form-input" placeholder="14" value={duration} onChange={e => setDuration(e.target.value)} /></div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Date début</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><label className="form-label">Date fin</label><input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Audience cible</label>
        <select className="form-input" value={audience} onChange={e => setAudience(e.target.value)}><option>Tous les contacts</option><option>Clients actifs</option><option>Prospects froids</option><option>Audience Instagram 25-44</option><option>Audience custom</option></select>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={3} placeholder="Décrivez votre campagne, le ton, les objectifs…" value={description} onChange={e => setDescription(e.target.value)}></textarea>
      </div>
    </ModalShell>
  );
}

function FlyerIAModal({ onClose }: any) {
  const occasions = [
    { id: 'event', name: 'Événement', icon: Stars, color: C.gold },
    { id: 'anniversary', name: 'Anniversaire', icon: Trophy, color: C.pink },
    { id: 'wedding', name: 'Mariage', icon: Heart, color: C.violet },
    { id: 'launch', name: 'Lancement', icon: Rocket, color: C.orange },
    { id: 'promo', name: 'Promo', icon: Megaphone, color: C.red },
    { id: 'season', name: 'Saison', icon: Calendar, color: C.cyan },
  ];
  const [occasion, setOccasion] = useState('promo');
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('Carré (Instagram)');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!title.trim()) { toast.error('Titre requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/marketing/content', { type: 'flyer', occasion, title, format, description });
      toast.success('Flyer en cours de génération', '4 variantes prêtes dans ~30s.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Génération indisponible.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Flyer IA royal" subtitle="Génération automatique multi-format" icon={FileImage} color={C.gold} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-gold" disabled={submitting} onClick={submit}><Wand2 size={14} /> {submitting ? 'Génération…' : 'Générer le flyer'}</button></>}>
      <label className="form-label">Type d'occasion</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {occasions.map(o => {
          const Ic = o.icon;
          const active = occasion === o.id;
          return (
            <button key={o.id} onClick={() => setOccasion(o.id)} style={{ background: active ? `${o.color}20` : C.cream, border: `1.5px solid ${active ? o.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${o.color}20`, color: o.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={16} /></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{o.name}</span>
            </button>
          );
        })}
      </div>
      <div className="form-row">
        <div><label className="form-label">Titre principal</label><input className="form-input" placeholder="-50% TABASKI" value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div><label className="form-label">Format</label>
          <select className="form-input" value={format} onChange={e => setFormat(e.target.value)}><option>Carré (Instagram)</option><option>Vertical (Story)</option><option>Horizontal (Facebook)</option><option>A4 (Print)</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Description / contexte (l'IA s'inspirera)</label>
        <textarea className="form-input" rows={3} placeholder="Décrivez l'événement, les dates, le ton souhaité, l'audience cible…" value={description} onChange={e => setDescription(e.target.value)}></textarea>
      </div>
      <div style={{ marginTop: 14, padding: 12, background: C.goldSoft, borderRadius: 10, fontSize: 12, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Crown size={14} color={C.gold} /> Le Roi générera 4 variantes en 30s · Téléchargeables PNG/PDF
      </div>
    </ModalShell>
  );
}

function VideoIAModal({ onClose }: any) {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [platform, setPlatform] = useState<'instagram_reel' | 'tiktok' | 'youtube_short' | 'instagram_post' | 'youtube'>('instagram_reel');
  const [quality, setQuality] = useState<'fast' | 'balanced' | 'premium'>('balanced');
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);

  // Recompute estimate on quality/duration/platform change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r: any = await api.post('/video/estimate', { quality, duration, platforms: [platform] });
        if (!cancelled) setEstimate(r?.data?.data?.estimatedCost ?? null);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [quality, duration, platform]);

  const submit = async () => {
    if (submitting) return;
    if (!prompt.trim()) { toast.error('Prompt vidéo requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/video/generate', {
        script: prompt.trim(),
        quality,
        platforms: [platform],
        duration,
        language: 'fr',
      });
      toast.success('Vidéo en cours de génération', `${quality === 'premium' ? 'Veo 3' : quality === 'balanced' ? 'Kling' : 'Wan'} · 1-3 min · Notification quand prête.`);
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Génération vidéo indisponible.');
    } finally { setSubmitting(false); }
  };

  const QUALITY_TIERS = [
    { id: 'fast' as const, label: 'Rapide', sub: 'Wan · $0.20 / 10s', icon: '⚡' },
    { id: 'balanced' as const, label: 'Équilibré', sub: 'Kling · $0.50 / 10s', icon: '⚖️' },
    { id: 'premium' as const, label: 'Premium', sub: 'Veo 3 · $3 / 10s', icon: '💎' },
  ];

  return (
    <ModalShell title="Génération vidéo IA" subtitle="Wan · Kling · Veo 3" icon={Video} color={C.red} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.red }} disabled={submitting} onClick={submit}><Wand2 size={14} /> {submitting ? 'Lancement…' : 'Générer la vidéo'}</button></>}>
      <div><label className="form-label">Prompt vidéo *</label>
        <textarea className="form-input" rows={3} placeholder="Une vue cinématographique d'un plat de poisson braisé qui fume, lumière dorée du soir, ambiance restaurant chic Abidjan…" value={prompt} onChange={e => setPrompt(e.target.value)} autoFocus></textarea>
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="form-label">Modèle IA</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {QUALITY_TIERS.map(t => {
            const sel = quality === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setQuality(t.id)}
                style={{
                  padding: '10px 8px', borderRadius: 10,
                  border: sel ? `1.5px solid ${C.red}` : '1.5px solid rgba(10,42,32,0.1)',
                  background: sel ? `${C.red}10` : '#fff',
                  color: sel ? C.red : C.ink,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <div style={{ fontSize: 14 }}>{t.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{t.label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{t.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Durée</label>
          <select className="form-input" value={duration} onChange={e => setDuration(parseInt(e.target.value))}>
            <option value={5}>5 secondes</option>
            <option value={10}>10 secondes</option>
            <option value={15}>15 secondes</option>
          </select>
        </div>
        <div><label className="form-label">Plateforme cible</label>
          <select className="form-input" value={platform} onChange={e => setPlatform(e.target.value as typeof platform)}>
            <option value="instagram_reel">Instagram Reel (9:16)</option>
            <option value="tiktok">TikTok (9:16)</option>
            <option value="youtube_short">YouTube Short (9:16)</option>
            <option value="instagram_post">Instagram Post (1:1)</option>
            <option value="youtube">YouTube (16:9)</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 12, background: C.redSoft, borderRadius: 10, fontSize: 12, color: C.ink, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>💎 1-3 min de processing · Notification quand prête</span>
        {estimate !== null && (
          <span style={{ fontWeight: 800, color: C.red, fontFamily: 'JetBrains Mono, monospace' }}>~${estimate.toFixed(2)}</span>
        )}
      </div>
    </ModalShell>
  );
}

function ImageGeneratorModal({ onClose, onUse }: any) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photo');
  const [format, setFormat] = useState('1:1');
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const generate = async () => {
    if (submitting) return;
    if (!prompt.trim()) { toast.error('Prompt requis'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/marketing/images/generate', { prompt, style, format });
      const url = (res?.data as any)?.url;
      if (!url) {
        toast.error('Erreur', 'Pas d\'image retournée.');
      } else {
        setImageUrl(url);
        toast.success('Image générée');
      }
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Génération indisponible.');
    } finally {
      setSubmitting(false);
    }
  };

  const useImage = () => {
    if (imageUrl && onUse) onUse(imageUrl);
    onClose();
  };

  return (
    <ModalShell title="Génération d'image IA" subtitle="Prompt · Style · Format" icon={Sparkles} color={C.cyan} onClose={onClose}
      footer={imageUrl ? (
        <>
          <button className="btn-secondary" onClick={() => setImageUrl(null)} disabled={submitting}><RefreshCw size={14} /> Régénérer</button>
          <button className="btn-primary" style={{ background: C.cyan }} onClick={useImage}>✅ Utiliser cette image</button>
        </>
      ) : (
        <>
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" style={{ background: C.cyan }} disabled={submitting} onClick={generate}>
            {submitting ? <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
            {submitting ? 'Génération…' : 'Générer'}
          </button>
        </>
      )}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div>
        <label className="form-label">Prompt</label>
        <textarea className="form-input" rows={3} value={prompt} onChange={(e: any) => setPrompt(e.target.value)} placeholder="Décris l'image : ex. 'photo studio d'une bouteille de jus de bissap avec glaçons sur fond crème'" />
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div>
          <label className="form-label">Style</label>
          <select className="form-input" value={style} onChange={e => setStyle(e.target.value)}>
            <option value="photo">Photo</option>
            <option value="illustration">Illustration</option>
            <option value="3d">3D</option>
            <option value="pop-art">Pop-art</option>
          </select>
        </div>
        <div>
          <label className="form-label">Format</label>
          <select className="form-input" value={format} onChange={e => setFormat(e.target.value)}>
            <option value="1:1">1:1 carré</option>
            <option value="9:16">9:16 vertical</option>
            <option value="16:9">16:9 horizontal</option>
          </select>
        </div>
      </div>
      {submitting && !imageUrl && (
        <div style={{ marginTop: 20, padding: 32, background: C.cyanSoft, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 size={28} color={C.cyan} style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Génération en cours…</div>
        </div>
      )}
      {imageUrl && (
        <div style={{ marginTop: 18 }}>
          <img src={imageUrl} alt="Image générée" style={{ width: '100%', borderRadius: 14, display: 'block', border: '1px solid rgba(10,42,32,0.08)' }} />
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <a href={imageUrl} download target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ textDecoration: 'none', fontSize: 12 }}>
              <Download size={12} /> 📥 Télécharger
            </a>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ============ PAGE: ACCUEIL avec Roi ============
function AccueilPage({ onTab, openModal, data }: any) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setSpeaking((s: boolean) => !s), 2800);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'Campagnes actives', value: (data?.campaigns || []).filter((c: any) => c.status === 'active').length.toString() || '0', sub: 'En cours', color: C.violet, bg: C.violetSoft, icon: Megaphone },
    { label: 'Posts planifiés', value: (data?.posts || []).filter((p: any) => p.status === 'scheduled').length.toString() || '0', sub: 'Cette semaine', color: C.pink, bg: C.pinkSoft, icon: CalendarDays },
    { label: 'Portée totale', value: data?.stats?.totalReach ? `${(data.stats.totalReach / 1000).toFixed(1)}K` : '—', sub: 'Multi-plateformes', color: C.gold, bg: C.goldSoft, icon: Eye, trendUp: true },
    { label: 'Engagement', value: data?.stats?.engagement ? `${data.stats.engagement}%` : '—', sub: 'Taux moyen', color: C.emeraldDeep, bg: C.emeraldSoft, icon: Heart, trendUp: true },
  ];

  const modules = [
    { name: 'Hub Marketing', desc: 'Vue d\'ensemble · KPIs', icon: LayoutDashboard, color: C.violet, page: 'Hub Marketing' },
    { name: 'Posts sociaux', desc: `${(data?.posts || []).length} posts`, icon: Image, color: C.pink, page: 'Posts sociaux' },
    { name: 'Flyers IA', desc: 'Génération royale', icon: FileImage, color: C.gold, page: 'Flyers IA', royal: true },
    { name: 'Vidéos IA', desc: 'Veo · Sora-style', icon: Video, color: C.red, page: 'Vidéos IA' },
    { name: 'Visuels IA', desc: 'Images générées', icon: Sparkles, color: C.cyan, page: 'Visuels IA' },
    { name: 'Calendrier', desc: 'Planning éditorial', icon: CalendarRange, color: C.blue, page: 'Calendrier' },
    { name: 'Campagnes', desc: `${(data?.campaigns || []).length} actives`, icon: Rocket, color: C.orange, page: 'Campagnes' },
    { name: 'Ads Manager', desc: 'Meta · Google Ads', icon: Target, color: C.emerald, page: 'Ads Manager' },
    { name: 'SEO', desc: 'Mots-clés · Articles', icon: Search, color: C.teal, page: 'SEO' },
    { name: 'Influenceurs', desc: 'CRM influenceurs · ROI', icon: Stars, color: C.purple, page: 'Influenceurs' },
    { name: 'Brand Kit', desc: 'Logos · Couleurs · Voice', icon: Palette, color: C.violetMid, page: 'Brand Kit' },
    { name: 'Analytics', desc: 'ROI · Insights', icon: BarChart3, color: C.greenDeep, page: 'Analytics' },
  ];

  return (
    <>
      <PageHeader title="Marketing," italic="votre royaume."
        subtitle="Posts multi-plateforme · Flyers IA · Calendrier éditorial · Campagnes · Influenceurs · Le Roi vous accompagne."
        badge="ROYAUME PROSPÈRE"
        actions={<>
          <button className="btn-secondary" onClick={() => openModal('post')} style={{ background: 'rgba(255,250,240,0.15)', color: C.cream, border: '1px solid rgba(255,250,240,0.25)' }}><Wand2 size={14} /> Créer avec IA</button>
          <button className="btn-gold" onClick={() => openModal('campaign')}><Crown size={16} /> Lancer une campagne</button>
        </>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="grain" style={{ background: `linear-gradient(135deg, ${C.violetDeep} 0%, ${C.violet} 50%, ${C.violetDeep} 100%)`, borderRadius: 24, padding: 32, color: C.cream, position: 'relative', overflow: 'hidden', boxShadow: `0 30px 60px -20px rgba(91, 33, 182, 0.5)` }}>
          <svg style={{ position: 'absolute', left: '15%', top: '50%', transform: 'translateY(-50%)', opacity: 0.15, pointerEvents: 'none' }} width="320" height="320" viewBox="0 0 320 320">
            {[...Array(12)].map((_, i) => {
              const angle = (i * 30) * Math.PI / 180;
              const x1 = 160 + Math.cos(angle) * 40;
              const y1 = 160 + Math.sin(angle) * 40;
              const x2 = 160 + Math.cos(angle) * 150;
              const y2 = 160 + Math.sin(angle) * 150;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.gold} strokeWidth="1" />;
            })}
          </svg>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0 }}><RoyalAvatar speaking={speaking} /></div>
            <div style={{ flex: 1, minWidth: 320 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Crown size={14} color={C.gold} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.12em' }}>AGENT MARKETING ROYAL · NIVEAU MAJESTÉ</span>
              </div>
              <h2 className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.cream, margin: '0 0 16px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Sa Majesté <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>Olamide</em>,<br/>votre Roi du Marketing.
              </h2>
              <div style={{ background: 'rgba(255,250,240,0.08)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,250,240,0.15)', borderLeft: `3px solid ${C.gold}`, borderRadius: 16, padding: '16px 20px', marginBottom: 18 }}>
                <div style={{ fontSize: 14, color: C.cream, lineHeight: 1.6, fontStyle: 'italic' }}>
                  {speaking ? (
                    <>« J'observe vos métriques en temps réel, j'optimise vos campagnes, je crée vos contenus visuels.
                    Demandez-moi <strong style={{ color: C.gold, fontStyle: 'normal' }}>"Crée un flyer Black Friday"</strong> ou <strong style={{ color: C.gold, fontStyle: 'normal' }}>"Lance une campagne WhatsApp"</strong>. »</>
                  ) : (
                    <>« Votre royaume marketing est sous mon regard, Excellence. Posts, flyers, vidéos, campagnes — donnez l'ordre, je l'exécute. »</>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn-gold" onClick={() => openModal('post')}><Wand2 size={14} /> Donner un ordre au Roi</button>
                <button className="btn-secondary" style={{ background: 'rgba(255,250,240,0.1)', color: C.cream, border: '1px solid rgba(255,250,240,0.2)' }} onClick={() => onTab('Hub Marketing')}><Crown size={14} /> Voir le royaume</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>

      <div style={{ padding: '32px 32px 32px' }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px' }}>
          Le royaume <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 18 }}>— 12 modules</em>
        </h3>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {modules.map((mod: any, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} onClick={() => onTab(mod.page)} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease', position: 'relative' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${mod.color}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {mod.royal && (
                  <div style={{ position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px -4px ${C.gold}` }}>
                    <Crown size={12} color={C.violetDeep} />
                  </div>
                )}
                {mod.badge && (
                  <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '3px 7px', borderRadius: 6, background: `${mod.color}22`, color: mod.color, border: `1px solid ${mod.color}55` }}>
                    {mod.badge}
                  </div>
                )}
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${mod.color} 0%, ${mod.color}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 12px 24px -8px ${mod.color}` }}>
                  <Icon size={22} />
                </div>
                <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{mod.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{mod.desc}</div>
                <div style={{ marginTop: 12, fontSize: 12, color: mod.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>Ouvrir <ArrowRight size={13} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ HUB MARKETING ============
function HubPage({ data }: any) {
  const stats = [
    { label: 'ROI campagnes', value: data?.roi?.value ? `${data.roi.value}x` : '—', sub: 'Multi-canal', color: C.gold, bg: C.goldSoft, icon: Trophy },
    { label: 'Posts ce mois', value: (data?.posts || []).length.toString(), sub: 'Tous canaux', color: C.violet, bg: C.violetSoft, icon: Image },
    { label: 'Followers gagnés', value: data?.stats?.followersGain ? `+${data.stats.followersGain}` : '—', sub: 'Multi-plateformes', color: C.emeraldDeep, bg: C.emeraldSoft, icon: TrendingUp },
    { label: 'Coût par lead', value: data?.stats?.cpl ? `${data.stats.cpl} F` : '—', sub: 'XOF moyen', color: C.cyan, bg: C.cyanSoft, icon: Target },
  ];
  const platforms = [
    { name: 'Instagram', icon: Instagram, color: C.instagram },
    { name: 'Facebook', icon: Facebook, color: C.facebook },
    { name: 'LinkedIn', icon: Linkedin, color: C.linkedin },
    { name: 'WhatsApp', icon: MessageCircle, color: C.whatsapp },
    { name: 'YouTube', icon: Youtube, color: C.youtube },
    { name: 'TikTok', icon: Music, color: C.tiktok },
  ];
  return (
    <>
      <PageHeader title="Hub" italic="Marketing"
        subtitle="Vue d'ensemble · Performance multi-plateformes"
        leftPills={<div className="pill" style={{ background: C.greenDeep, color: C.cream }}><Crown size={11} /> ROYAUME</div>} />
      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>
      <div style={{ padding: '32px 32px 32px' }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px' }}>Plateformes connectées</h3>
        <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {platforms.map((p, i) => {
            const Ic = p.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', borderTop: `3px solid ${p.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${p.color} 0%, ${p.color}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ic size={18} />
                  </div>
                  <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{p.name}</div>
                </div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>Connecte ce canal pour voir tes statistiques</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ POSTS SOCIAUX ============
function PostsPage({ openModal, posts = [] }: any) {
  const [view, setView] = useState('grid');
  return (
    <>
      <PageHeader title="Posts" italic={`${posts.length} créés`}
        subtitle="Création multi-plateformes · IA · Programmation"
        actions={<button className="btn-primary" onClick={() => openModal('post')}><Plus size={16} /> Nouveau post</button>} />
      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {posts.length === 0 ? (
          <EmptyState icon={Image} title="Aucun post créé" desc="Crée ton premier post — l'IA peut générer le contenu et les visuels." action={<button className="btn-primary" onClick={() => openModal('post')}><Plus size={14} /> Nouveau post</button>} />
        ) : view === 'grid' ? (
          <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {posts.map((p: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: C.violetSoft, color: C.violet, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={18} /></div>
                  <span className="pill" style={{ background: p.status === 'published' ? C.emeraldSoft : p.status === 'scheduled' ? C.violetSoft : C.creamDeep, color: p.status === 'published' ? C.emeraldDeep : p.status === 'scheduled' ? C.violetDeep : C.inkSoft, fontWeight: 700 }}>{p.status || 'Brouillon'}</span>
                </div>
                <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.title || p.content || 'Post'}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.preview || p.content || ''}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(p.platforms || []).slice(0, 4).map((pl: string) => (<span key={pl} className="pill" style={{ background: C.creamDeep, color: C.inkSoft, fontSize: 10 }}>{pl}</span>))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.map((p: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 40, height: 40, borderRadius: 11, background: C.violetSoft, color: C.violet, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{p.title || p.content || 'Post'}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.preview || p.content || ''}</div>
                </div>
                <span className="pill" style={{ background: p.status === 'published' ? C.emeraldSoft : C.violetSoft, color: p.status === 'published' ? C.emeraldDeep : C.violetDeep, fontWeight: 700 }}>{p.status || 'Brouillon'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ FLYERS IA ============
function FlyersIAPage({ openModal }: any) {
  const occasions = [
    { name: 'Festif', desc: 'Tons festifs · or et grenat', icon: Stars, color: C.gold },
    { name: 'Mariage', desc: 'Élégance · pastel · or', icon: Heart, color: C.violet },
    { name: 'Lancement produit', desc: 'Dynamique · accent vif', icon: Rocket, color: C.orange },
    { name: 'Promo', desc: 'Énergique · accroche claire', icon: Megaphone, color: C.red },
    { name: 'Anniversaire', desc: 'Joyeux · pastels', icon: Trophy, color: C.pink },
    { name: 'Événement', desc: 'Sobre · informatif', icon: Calendar, color: C.cyan },
  ];
  return (
    <>
      <PageHeader title="Flyers" italic="IA royale"
        subtitle="Générer des flyers pour tout type d'occasion en quelques secondes"
        badge="LE ROI CRÉE"
        actions={<button className="btn-gold" onClick={() => openModal('flyer')}><Crown size={16} /> Nouveau flyer</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.cream, margin: '0 0 16px' }}>Choisir une occasion</h3>
        <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {occasions.map((o, i) => {
            const Ic = o.icon;
            return (
              <div key={i} onClick={() => openModal('flyer')} style={{ background: C.cream, borderRadius: 16, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = o.color; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${o.color}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${C.goldBright}, ${C.gold})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={12} color={C.violetDeep} />
                </div>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${o.color} 0%, ${o.color}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 12px 24px -8px ${o.color}` }}>
                  <Ic size={26} />
                </div>
                <div className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{o.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{o.desc}</div>
                <div style={{ marginTop: 14, fontSize: 12, color: o.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>Générer <Wand2 size={12} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ VIDÉOS IA ============
function VideosIAPage({ openModal }: any) {
  return (
    <>
      <PageHeader title="Vidéos" italic="IA"
        subtitle="Génération vidéo · Veo · Sora-style · 5-15 secondes"
        actions={<button className="btn-primary" style={{ background: C.red }} onClick={() => openModal('video')}><Video size={16} /> Nouvelle vidéo</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={Video} title="Aucune vidéo générée" desc="Lance ta première génération vidéo — décris simplement ce que tu veux voir." action={<button className="btn-primary" style={{ background: C.red }} onClick={() => openModal('video')}><Video size={14} /> Générer une vidéo</button>} />
      </div>
    </>
  );
}

// ============ VISUELS IA ============
function VisuelsIAPage({ openModal }: any) {
  return (
    <>
      <PageHeader title="Visuels" italic="IA"
        subtitle="Images générées · Style cohérent avec votre brand"
        actions={<button className="btn-primary" style={{ background: C.cyan }} onClick={() => openModal('image')}><Sparkles size={16} /> Générer une image</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={Sparkles} title="Bibliothèque visuelle vide" desc="Génère tes premiers visuels avec l'IA — Midjourney, DALL-E, Stable Diffusion intégrés." action={<button className="btn-primary" style={{ background: C.cyan }} onClick={() => openModal('image')}><Sparkles size={14} /> Générer une image</button>} />
      </div>
    </>
  );
}

// ============ CALENDRIER ============
function CalendrierPage({ data, openModal }: any) {
  const events = data?.calendar || [];
  return (
    <>
      <PageHeader title="Calendrier" italic="éditorial"
        subtitle="Drag & drop · Vue mois/semaine/liste"
        actions={<button className="btn-primary" onClick={() => openModal('post')}><Plus size={16} /> Nouveau contenu</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {events.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Calendrier éditorial vide" desc="Planifie tes contenus à venir pour avoir une vue claire sur tes prochaines publications." action={<button className="btn-primary" onClick={() => openModal('post')}><Plus size={14} /> Planifier du contenu</button>} />
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((e: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 40, height: 40, borderRadius: 11, background: C.violetSoft, color: C.violet, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{e.date ? new Date(e.date).toLocaleString('fr-FR') : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ CAMPAGNES ============
function CampagnesPage({ openModal, campaigns = [] }: any) {
  const [view, setView] = useState('list');
  return (
    <>
      <PageHeader title="Campagnes" italic={`${campaigns.length} actives`}
        subtitle="Multi-canal · Budget · ROI temps réel"
        actions={<button className="btn-primary" style={{ background: C.orange }} onClick={() => openModal('campaign')}><Rocket size={16} /> Nouvelle campagne</button>} />
      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {campaigns.length === 0 ? (
          <EmptyState icon={Rocket} title="Aucune campagne lancée" desc="Lance ta première campagne marketing." action={<button className="btn-primary" style={{ background: C.orange }} onClick={() => openModal('campaign')}><Rocket size={14} /> Lancer une campagne</button>} />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {campaigns.map((c: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: C.orangeSoft, color: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Rocket size={18} /></div>
                  <span className="pill" style={{ background: c.status === 'active' ? C.emeraldSoft : C.creamDeep, color: c.status === 'active' ? C.emeraldDeep : C.inkSoft, fontWeight: 700 }}>{c.status || 'Brouillon'}</span>
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{c.name || `Campagne ${i + 1}`}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 10 }}>{c.objective || '—'}</div>
                <div className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>Budget : {(c.budget || 0).toLocaleString('fr-FR')}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {campaigns.map((c: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 40, height: 40, borderRadius: 11, background: C.orangeSoft, color: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Rocket size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{c.name || `Campagne ${i + 1}`}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{c.objective || '—'}</div>
                </div>
                <div className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{(c.budget || 0).toLocaleString('fr-FR')} F</div>
                <span className="pill" style={{ background: c.status === 'active' ? C.emeraldSoft : C.creamDeep, color: c.status === 'active' ? C.emeraldDeep : C.inkSoft, fontWeight: 700 }}>{c.status || 'Brouillon'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ SIMPLE PAGES ============
function AdsManagerPage() {
  return (<><PageHeader title="Ads Manager" italic="Meta · Google" subtitle="Gestion publicitaire centralisée" /><div style={{ padding: '24px 32px 32px' }}><EmptyState icon={Target} title="Connecte ton Ads Manager" desc="Lie ton compte Meta Business ou Google Ads pour piloter tes campagnes payantes ici." action={<Link to="/admin/connectors" className="btn-primary" style={{ textDecoration: 'none' }}><Plus size={14} /> Connecter Meta Ads</Link>} /></div></>);
}
function SEOPage() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    if (!topic.trim()) { toast.info('Sujet requis', 'Indique le produit ou thème à analyser.'); return; }
    setLoading(true); setResult(null);
    try {
      const r: any = await api.post('/marketing/seo/analyze', { topic });
      setResult(r?.data ?? r);
      toast.success('Audit SEO terminé', `${(r?.data ?? r)?.keywords?.length || 0} mots-clés identifiés.`);
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Audit indisponible.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <PageHeader title="SEO" italic="& contenus" subtitle="Mots-clés · Articles · Score Google" />
      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)', marginBottom: 16 }}>
          <label className="form-label">Sujet, produit ou thème à analyser</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input className="form-input" placeholder="Ex. restaurant africain Abidjan, location de salle, formation Excel…" value={topic} onChange={e => setTopic(e.target.value)} style={{ flex: 1 }} />
            <button className="btn-primary" onClick={run} disabled={loading}>
              <Wand2 size={14} /> {loading ? 'Analyse…' : "Lancer l'audit"}
            </button>
          </div>
        </div>

        {!result ? (
          <EmptyState icon={Search} title="Audit SEO à lancer" desc="Saisis un sujet ci-dessus et clique sur Lancer l'audit pour obtenir mots-clés cibles, suggestions de titres et meta-description." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: '0.1em', marginBottom: 10 }}>MOTS-CLÉS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(result.keywords || []).map((k: string, i: number) => (
                  <span key={i} className="pill" style={{ background: `${C.teal}18`, color: C.teal, border: `1px solid ${C.teal}44` }}>{k}</span>
                ))}
              </div>
            </div>
            <div style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.violet, letterSpacing: '0.1em', marginBottom: 10 }}>TITRES SUGGÉRÉS</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.ink, lineHeight: 1.7 }}>
                {(result.titleSuggestions || []).map((t: string, i: number) => <li key={i}>{t}</li>)}
              </ul>
            </div>
            {result.metaDescription && (
              <div style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.1em', marginBottom: 10 }}>META DESCRIPTION</div>
                <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6 }}>{result.metaDescription}</div>
              </div>
            )}
            {(result.tips || []).length > 0 && (
              <div style={{ background: C.cream, borderRadius: 18, padding: 20, border: '1px solid rgba(10,42,32,0.06)', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.emerald, letterSpacing: '0.1em', marginBottom: 10 }}>RECOMMANDATIONS</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.ink, lineHeight: 1.7 }}>
                  {result.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
const INFLUENCER_STATUSES = [
  { id: 'prospect',  label: 'Prospect',     color: C.inkSoft },
  { id: 'contacted', label: 'DM envoyé',    color: C.blue },
  { id: 'replied',   label: 'A répondu',    color: C.yellow },
  { id: 'active',    label: 'Actif',        color: C.emerald },
  { id: 'lost',      label: 'Perdu',        color: C.red },
] as const;

const PLATFORM_META: Record<string, { label: string; color: string; icon: any }> = {
  instagram: { label: 'Instagram', color: C.instagram, icon: Instagram },
  facebook:  { label: 'Facebook',  color: C.facebook,  icon: Facebook },
  tiktok:    { label: 'TikTok',    color: C.tiktok,    icon: Music },
  youtube:   { label: 'YouTube',   color: C.youtube,   icon: Youtube },
  linkedin:  { label: 'LinkedIn',  color: C.linkedin,  icon: Linkedin },
  twitter:   { label: 'X / Twitter', color: C.twitter, icon: Twitter },
};

function statusMeta(id: string) {
  return INFLUENCER_STATUSES.find(s => s.id === id) || INFLUENCER_STATUSES[0];
}
function platformMeta(p: string) {
  return PLATFORM_META[(p || 'instagram').toLowerCase()] || PLATFORM_META.instagram;
}

function NewInfluencerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [followers, setFollowers] = useState('');
  const [engagement, setEngagement] = useState('');
  const [niche, setNiche] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (submitting) return;
    if (!name.trim()) { toast.error('Nom requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/marketing/influencers', {
        name, handle, platform,
        followers: Number(followers) || 0,
        engagement: Number(engagement) || 0,
        niche, email, phone, notes,
      });
      toast.success('Influenceur ajouté');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Création impossible.');
    } finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Nouvel influenceur" subtitle="Crée une fiche manuelle" icon={Stars} color={C.purple} onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.purple }} onClick={save} disabled={submitting}>
          {submitting ? <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
          {submitting ? 'Ajout…' : 'Ajouter'}
        </button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label className="form-label">Nom *</label><input className="form-input" placeholder="Ex. Awa Kone" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="form-label">Handle</label><input className="form-input" placeholder="@awakone" value={handle} onChange={e => setHandle(e.target.value)} /></div>
        <div>
          <label className="form-label">Plateforme</label>
          <select className="form-input" value={platform} onChange={e => setPlatform(e.target.value)}>
            {Object.entries(PLATFORM_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
          </select>
        </div>
        <div><label className="form-label">Niche</label><input className="form-input" placeholder="Mode, food, lifestyle…" value={niche} onChange={e => setNiche(e.target.value)} /></div>
        <div><label className="form-label">Followers</label><input className="form-input" type="number" placeholder="10000" value={followers} onChange={e => setFollowers(e.target.value)} /></div>
        <div><label className="form-label">Taux d'engagement (%)</label><input className="form-input" type="number" step="0.1" placeholder="3.5" value={engagement} onChange={e => setEngagement(e.target.value)} /></div>
        <div><label className="form-label">Email</label><input className="form-input" type="email" placeholder="contact@…" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="form-label">Téléphone / WhatsApp</label><input className="form-input" placeholder="+225 …" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} placeholder="Notes privées, points de contact, codes promo négociés…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
    </ModalShell>
  );
}

function ImportInfluencersModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [csv, setCsv] = useState('name,handle,platform,followers,engagement,niche,email,phone\n');
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);

  const parseCsv = (text: string): any[] => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim());
      const row: any = {};
      header.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      return row;
    }).filter(r => r.name);
  };

  useEffect(() => { setPreview(parseCsv(csv).slice(0, 5)); }, [csv]);

  const submit = async () => {
    if (submitting) return;
    const rows = parseCsv(csv);
    if (rows.length === 0) { toast.error('CSV vide', 'Ajoute au moins une ligne avec un nom.'); return; }
    setSubmitting(true);
    try {
      const r: any = await api.post('/marketing/influencers/import', { rows });
      toast.success('Import terminé', `${r?.data?.imported ?? rows.length} influenceurs ajoutés.`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Import indisponible.');
    } finally { setSubmitting(false); }
  };

  return (
    <ModalShell title="Importer depuis CSV" subtitle="Une ligne d'en-tête + une ligne par influenceur" icon={Upload} color={C.purple} onClose={onClose}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.purple }} onClick={submit} disabled={submitting || preview.length === 0}>
          {submitting ? <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
          {submitting ? 'Import…' : `Importer ${preview.length > 0 ? `(${parseCsv(csv).length})` : ''}`}
        </button>
      </>}>
      <div style={{ marginBottom: 10, fontSize: 12, color: C.inkSoft }}>
        Colonnes attendues : <code style={{ background: C.creamDeep, padding: '2px 6px', borderRadius: 4 }}>name,handle,platform,followers,engagement,niche,email,phone</code>
      </div>
      <textarea className="form-input mono-font" rows={10} value={csv} onChange={e => setCsv(e.target.value)} style={{ fontSize: 12 }} />
      {preview.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12, color: C.inkSoft }}>
          Aperçu : <strong>{parseCsv(csv).length}</strong> ligne(s) — première : <em>{preview[0]?.name}</em> ({preview[0]?.platform || 'instagram'}, {preview[0]?.followers || 0} followers)
        </div>
      )}
    </ModalShell>
  );
}

function InfluenceursPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await api.get('/marketing/influencers');
      setItems(Array.isArray(r?.data) ? r.data : []);
    } catch {
      setItems([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const counts = INFLUENCER_STATUSES.reduce((acc: any, s) => {
    acc[s.id] = items.filter(i => i.status === s.id).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/marketing/influencers/${id}`, { status });
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      toast.success('Mis à jour');
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Mise à jour impossible.');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Supprimer cet influenceur ?')) return;
    try {
      await api.delete(`/marketing/influencers/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Suppression impossible.');
    }
  };

  return (
    <>
      <PageHeader title="Influenceurs" italic="& Partenariats"
        subtitle={`CRM influenceurs · ${items.length} fiche${items.length > 1 ? 's' : ''} · ${counts.active || 0} actif${(counts.active || 0) > 1 ? 's' : ''}`}
        actions={<>
          <button className="btn-secondary" onClick={() => setShowImport(true)} style={{ background: 'rgba(255,250,240,0.15)', color: C.cream, border: '1px solid rgba(255,250,240,0.25)' }}><Upload size={14} /> Importer CSV</button>
          <button className="btn-gold" onClick={() => setShowNew(true)}><Plus size={16} /> Nouvel influenceur</button>
        </>}
      />
      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('all')} className="pill" style={{ background: filter === 'all' ? C.purple : C.creamDeep, color: filter === 'all' ? C.cream : C.ink, cursor: 'pointer', border: 'none' }}>
            Tous · {items.length}
          </button>
          {INFLUENCER_STATUSES.map(s => (
            <button key={s.id} onClick={() => setFilter(s.id)} className="pill" style={{ background: filter === s.id ? s.color : `${s.color}22`, color: filter === s.id ? C.cream : s.color, cursor: 'pointer', border: 'none' }}>
              {s.label} · {counts[s.id] || 0}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: C.inkSoft }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Stars}
            title={items.length === 0 ? 'Aucun influenceur pour l\'instant' : 'Aucun dans ce filtre'}
            desc={items.length === 0 ? 'Ajoute manuellement une fiche ou importe ta base depuis un fichier CSV.' : 'Change le filtre pour voir d\'autres statuts.'}
            action={items.length === 0 ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> Ajouter</button>
                <button className="btn-secondary" onClick={() => setShowImport(true)}><Upload size={14} /> Importer CSV</button>
              </div>
            ) : null}
          />
        ) : (
          <div style={{ background: C.cream, borderRadius: 18, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1.3fr 0.8fr', padding: '14px 18px', borderBottom: '1px solid rgba(10,42,32,0.06)', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.08em' }}>
              <div>INFLUENCEUR</div>
              <div>PLATEFORME</div>
              <div>FOLLOWERS</div>
              <div>ENGAG.</div>
              <div>STATUT</div>
              <div style={{ textAlign: 'right' }}>ACTIONS</div>
            </div>
            {filtered.map((inf: any) => {
              const sm = statusMeta(inf.status);
              const pm = platformMeta(inf.platform);
              const Pi = pm.icon;
              return (
                <div key={inf.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1.3fr 0.8fr', padding: '14px 18px', borderBottom: '1px solid rgba(10,42,32,0.04)', alignItems: 'center', fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: C.ink }}>{inf.name}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{inf.handle ? `@${inf.handle.replace(/^@/, '')}` : (inf.niche || '—')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: pm.color }}>
                    <Pi size={14} /> <span style={{ fontSize: 12 }}>{pm.label}</span>
                  </div>
                  <div className="mono-font" style={{ color: C.ink, fontWeight: 600 }}>{Number(inf.followers || 0).toLocaleString()}</div>
                  <div className="mono-font" style={{ color: C.ink }}>{inf.engagement ? `${inf.engagement}%` : '—'}</div>
                  <div>
                    <select value={inf.status || 'prospect'} onChange={(e) => updateStatus(inf.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${sm.color}55`, background: `${sm.color}18`, color: sm.color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {INFLUENCER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    {inf.phone && (
                      <a href={`https://wa.me/${inf.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ color: C.whatsapp, padding: 6, borderRadius: 8, background: `${C.whatsapp}18`, display: 'inline-flex' }}>
                        <Send size={14} />
                      </a>
                    )}
                    <button onClick={() => remove(inf.id)} title="Supprimer" style={{ color: C.red, padding: 6, borderRadius: 8, background: `${C.red}18`, border: 'none', cursor: 'pointer', display: 'inline-flex' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && <NewInfluencerModal onClose={() => setShowNew(false)} onSaved={load} />}
      {showImport && <ImportInfluencersModal onClose={() => setShowImport(false)} onSaved={load} />}
    </>
  );
}
function BrandKitPage({ data }: any) {
  return (<><PageHeader title="Brand Kit" italic="& identité" subtitle="Logos · Couleurs · Fonts · Voice" /><div style={{ padding: '24px 32px 32px' }}>{!data?.brand ? (<EmptyState icon={Palette} title="Brand Kit non configuré" desc="Configure ton identité visuelle pour que l'IA respecte ta charte graphique." action={<Link to="/settings/profile" className="btn-primary" style={{ textDecoration: 'none' }}><Plus size={14} /> Configurer le Brand Kit</Link>} />) : (<div style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}><pre style={{ fontSize: 12, color: C.ink, overflow: 'auto', background: C.creamDeep, padding: 16, borderRadius: 10 }}>{JSON.stringify(data.brand, null, 2)}</pre></div>)}</div></>);
}
function AnalyticsPage({ data }: any) {
  return (<><PageHeader title="Analytics" italic="& ROI" subtitle="Performance · Insights · Attribution" /><div style={{ padding: '24px 32px 32px' }}><EmptyState icon={BarChart3} title="Analytics en attente" desc="Les statistiques apparaîtront ici dès tes premières publications." action={<Link to="/insights" className="btn-primary" style={{ textDecoration: 'none' }}><BarChart3 size={14} /> Voir les insights</Link>} /></div></>);
}

// ============ MAIN ============
export default function MarketingRedesignPage() {
  const [activeTab, setActiveTab] = useState('Accueil');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const openModal = (id: string) => setActiveModal(id);
  const closeModal = () => setActiveModal(null);
  const data = useMarketingData();

  return (
    <Chrome>
      <TabSwitcher active={activeTab} setActive={setActiveTab} />
      {activeTab === 'Accueil' && <AccueilPage onTab={setActiveTab} openModal={openModal} data={data} />}
      {activeTab === 'Hub Marketing' && <HubPage data={data} />}
      {activeTab === 'Calendrier' && <CalendrierPage data={data} openModal={openModal} />}
      {activeTab === 'Analytics' && <AnalyticsPage data={data} />}
      {activeTab === 'Posts sociaux' && <PostsPage openModal={openModal} posts={data.posts} />}
      {activeTab === 'Flyers IA' && <FlyersIAPage openModal={openModal} />}
      {activeTab === 'Vidéos IA' && <VideosIAPage openModal={openModal} />}
      {activeTab === 'Visuels IA' && <VisuelsIAPage openModal={openModal} />}
      {activeTab === 'Brand Kit' && <BrandKitPage data={data} />}
      {activeTab === 'Campagnes' && <CampagnesPage openModal={openModal} campaigns={data.campaigns} />}
      {activeTab === 'Ads Manager' && <AdsManagerPage />}
      {activeTab === 'SEO' && <SEOPage />}
      {activeTab === 'Influenceurs' && <InfluenceursPage />}

      {activeModal === 'post' && <NewPostModal onClose={closeModal} openModal={openModal} />}
      {activeModal === 'campaign' && <NewCampaignModal onClose={closeModal} />}
      {activeModal === 'flyer' && <FlyerIAModal onClose={closeModal} />}
      {activeModal === 'video' && <VideoIAModal onClose={closeModal} />}
      {activeModal === 'image' && <ImageGeneratorModal onClose={closeModal} />}

      <LiveSyncBadge lastSync={data?.lastSync} intervalMs={REFRESH_INTERVAL_MS} />

      <div style={{ position: 'fixed', bottom: 28, right: 100, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        <button onClick={() => openModal('flyer')} title="Flyer IA" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.gold, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <Crown size={20} />
        </button>
        <button onClick={() => openModal('campaign')} title="Campagne" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.orange, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <Rocket size={20} />
        </button>
        <button onClick={() => openModal('post')} title="Nouveau post" style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.violet} 0%, ${C.violetDeep} 100%)`, border: 'none', color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px -8px ${C.violet}` }}>
          <Plus size={24} />
        </button>
      </div>

      <AgentDrawer
        agentId="marketing"
        agentName="Marketing"
        color={C.violet}
        context={{
          tab: activeTab,
          posts: data.posts?.length ?? 0,
          campaigns: data.campaigns?.length ?? 0,
        }}
        starters={[
          'Génère un post LinkedIn pour annoncer une campagne don',
          'Analyse la performance de mes derniers posts',
          'Quelle campagne devrais-je prioriser ce mois-ci ?',
        ]}
      />
    </Chrome>
  );
}
