import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import AgentDrawer from '@/components/ai/AgentDrawer';
import { toast } from '@/components/common/Toast';
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownRight,
  Bell,
  LayoutDashboard, MessageSquare, Bot, UsersRound, Briefcase,
  Calendar, Store, Crown, Hammer, Plug, Settings, Shield, LogOut, X,
  Plus, Filter, MoreHorizontal, Sparkles, TrendingUp, TrendingDown,
  CheckCircle2, Clock, AlertTriangle, FileText, Send, Eye, Trash2, Edit3,
  Banknote, Wallet, CircleDollarSign, Receipt, FileSignature, Wand2,
  Download, Upload, Copy, Inbox,
  Coffee, Plane, MapPin, Mail, Phone,
  PieChart, BarChart3, LineChart, Activity, RefreshCw, Link2, Network,
  Zap, Star, Heart, Award, Target,
  DoorOpen, DoorClosed, Fingerprint, KeyRound, RadioTower,
  PhoneCall, Camera, Lock, Unlock, ShieldCheck, ShieldAlert,
  Calculator, Percent, Scale, Globe,
  Smartphone,
  Users, UserPlus, UserCheck, UserX,
  CalendarClock, CalendarDays, ListChecks, Gift,
  Building2, CreditCard, Contact, QrCode, ScanLine,
  Printer, Tag, Palette, MoveRight,
  Volume2, Wifi,
  Maximize2, Power,
  Mic, MicOff,
  Smile, Languages,
  Package, Truck, PackageCheck,
  Hourglass, History,
  LayoutGrid, List as ListIcon
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E', greenMid: '#0F6B52', greenSoft: '#E8F5EE',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  cyan: '#06B6D4', cyanDeep: '#0891B2', cyanSoft: '#CFFAFE', cyanMid: '#67E8F9',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#EF4444', redSoft: '#FEE2E2',
  yellow: '#F59E0B', yellowSoft: '#FEF3C7', amber: '#F59E0B',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  pink: '#EC4899', pinkSoft: '#FCE7F3',
  teal: '#14B8A6', tealSoft: '#CCFBF1',
  orange: '#FF6B1A', orangeSoft: '#FFE4D2',
  gold: '#D4A017', goldSoft: '#FEF3C7',
  ink: '#0A2A20', inkSoft: '#5A6B62',
  onGreenSoft: '#A8C9B8',
};

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800;9..144,900&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  .display-font { font-family: 'Fraunces', serif; font-optical-sizing: auto; letter-spacing: -0.02em; }
  .mono-font { font-family: 'JetBrains Mono', monospace; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
  .tab-btn { padding: 10px 18px; font-size: 14px; font-weight: 500; color: ${C.onGreenSoft}; cursor: pointer; border-radius: 10px; transition: all 0.2s ease; background: transparent; border: none; font-family: inherit; }
  .tab-btn:hover { color: ${C.cream}; }
  .tab-btn.active { background: ${C.cyan}; color: ${C.cream}; box-shadow: 0 4px 14px -4px rgba(6, 182, 212, 0.5); }
  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.cyan}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.cyan}; opacity: 0.4; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  .row-card { background: ${C.cream}; border-radius: 16px; padding: 18px 20px; border: 1px solid rgba(10,42,32,0.06); transition: all 0.2s ease; cursor: pointer; display: flex; align-items: center; gap: 16px; }
  .row-card:hover { transform: translateX(4px); border-color: ${C.cyan}; box-shadow: 0 12px 24px -12px rgba(6, 182, 212, 0.25); }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.cyanSoft}; color: ${C.cyanDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.cyan}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.redSoft}; color: ${C.red}; }
  .btn-primary { background: ${C.cyan}; color: ${C.cream}; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px rgba(6, 182, 212, 0.5); font-family: inherit; }
  .btn-primary:hover { background: ${C.cyanDeep}; transform: translateY(-2px); }
  .btn-secondary { background: ${C.cream}; color: ${C.greenDeep}; border: 1px solid rgba(10,42,32,0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }
  .avatar { border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 700; color: ${C.cream}; flex-shrink: 0; }
  .progress-bar { height: 6px; border-radius: 3px; background: rgba(10,42,32,0.08); overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
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
  .form-input:focus { border-color: ${C.cyan}; box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15); }
  .form-label { display: block; font-size: 11px; font-weight: 700; color: ${C.ink}; letter-spacing: 0.05em; margin-bottom: 6px; text-transform: uppercase; }
  .form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
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

const REFRESH_INTERVAL_MS = 5000; // Réception = 5s pour vrai effet "live hub"

function useReceptionData() {
  const [data, setData] = useState<any>({
    visitors: [], appointments: [], presence: [], presenceHistory: [],
    employeeCodes: [], leaves: [], directory: [], stats: null,
    badges: [], checkinSettings: null, monthlyStats: null,
    pendingHost: [], loaded: false, lastSync: null,
  });

  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/reception/visitors'),
    safeGet('/reception/appointments'),
    safeGet('/reception/presence'),
    safeGet('/reception/presence/history'),
    safeGet('/reception/employee-codes'),
    safeGet('/reception/leaves'),
    safeGet('/reception/directory'),
    safeGet('/reception/stats'),
    safeGet('/reception/badges'),
    safeGet('/reception/checkin-settings'),
    safeGet('/reception/stats/monthly'),
    safeGet('/reception/visitors/pending-host'),
  ]).then(([v, app, pr, prh, ec, lv, dir, st, bd, cs, ms, ph]) => {
    if (!mountedRef.current) return;
    setData({
      visitors: v?.visitors ?? v ?? [],
      appointments: app?.appointments ?? app ?? [],
      presence: pr?.presence ?? pr?.employees ?? pr ?? [],
      presenceHistory: prh?.history ?? prh ?? [],
      employeeCodes: ec?.codes ?? ec ?? [],
      leaves: lv?.leaves ?? lv ?? [],
      directory: dir?.directory ?? dir?.employees ?? dir ?? [],
      stats: st ?? null,
      badges: bd?.badges ?? bd ?? [],
      checkinSettings: cs ?? null,
      monthlyStats: ms ?? null,
      pendingHost: ph?.visitors ?? ph ?? [],
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

function LiveSyncBadge({ lastSync, intervalMs = 5000 }: { lastSync: Date | null; intervalMs?: number }) {
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
      border: `1px solid ${C.cyan}40`,
      padding: '8px 14px', borderRadius: 100,
      display: 'flex', alignItems: 'center', gap: 8,
      color: C.cream, fontSize: 12, fontWeight: 600,
      fontFamily: "'Inter', sans-serif",
      boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
    }}>
      <span className="live-dot"></span>
      <span style={{ color: C.cyanMid }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
        sync · {secondsAgo}s · refresh {intervalMs / 1000}s
      </span>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title = 'Pas encore de données', desc = 'Les informations s\'afficheront ici dès que disponibles.', action = null }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: '48px 32px', border: '1px dashed rgba(10,42,32,0.15)', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: C.cyanSoft, color: C.cyanDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h4 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>{title}</h4>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {action}
    </div>
  );
}

function PageHeader({ title, italic, subtitle, badge, actions, leftPills, gradient = 'cyan' }: any) {
  const gradientStyle = gradient === 'green'
    ? `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.greenMid} 100%)`
    : `linear-gradient(135deg, ${C.cyan} 0%, ${C.cyanDeep} 100%)`;
  const shadow = gradient === 'green' ? 'rgba(10, 79, 60, 0.4)' : 'rgba(6, 182, 212, 0.4)';
  const accent = gradient === 'green' ? C.cyanMid : C.greenDeep;
  return (
    <div style={{ padding: '32px 32px 0' }}>
      <div className="grain" style={{ background: gradientStyle, borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden', color: C.cream, boxShadow: `0 30px 60px -20px ${shadow}` }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="40" stroke={accent} strokeWidth="2" fill="none" />
          <circle cx="140" cy="140" r="14" fill={accent} />
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              {leftPills}
              {badge && (<div className="pill" style={{ background: accent, color: C.cream }}><span className="live-dot" style={{ background: C.cream }}></span>{badge}</div>)}
            </div>
            <h1 className="display-font hero-title" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.cream, letterSpacing: '-0.03em' }}>
              {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: accent }}>{italic}</em>}
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
    { label: 'PILOTAGE', tabs: ['Accueil', 'Live Hub', 'RDV & Visites', 'Présence'] },
    { label: 'OPÉRATIONS', tabs: ['Visiteurs', 'Livraisons', 'Annuaire', 'Badges'] },
    { label: 'CONFIG', tabs: ['Mode Kiosk', 'Codes', 'Paramètres', 'Rapports'] },
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

function StatCard({ label, value, suffix, sub, icon: Icon, color, bg }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 20, padding: 22, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }}></div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 8px 16px -8px ${color}40` }}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span className="display-font" style={{ fontSize: 36, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
        {suffix && <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>{sub}</div>
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

function ModalShell({ title, subtitle, icon: Icon, color = C.cyan, onClose, children, footer, size = 'md' }: any) {
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

// ============ MODALS ============
function NewVisitorModal({ onClose }: any) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [host, setHost] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!firstName.trim() && !lastName.trim()) { toast.error('Nom requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/reception/visitors', {
        firstName, lastName, name: `${firstName} ${lastName}`.trim(),
        phone, company, host, expectedTime: time, reason,
      });
      toast.success('Visiteur enregistré', 'QR code envoyé à l\'hôte.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible d\'enregistrer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouveau visiteur" subtitle="Pré-enregistrement avec QR code" icon={UserPlus} color={C.cyan} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" disabled={submitting} onClick={submit}><Send size={14} /> {submitting ? 'Envoi…' : 'Envoyer le QR'}</button></>}>
      <div className="form-row">
        <div><label className="form-label">Prénom</label><input className="form-input" placeholder="Jean" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
        <div><label className="form-label">Nom</label><input className="form-input" placeholder="Kouassi" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Téléphone</label><input className="form-input" placeholder="+225 07 00 00 00 00" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        <div><label className="form-label">Société</label><input className="form-input" placeholder="Acme SAS" value={company} onChange={e => setCompany(e.target.value)} /></div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Hôte (employé visité)</label><input className="form-input" placeholder="Adelin Nguessan" value={host} onChange={e => setHost(e.target.value)} /></div>
        <div><label className="form-label">Heure prévue</label><input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Motif de la visite</label>
        <textarea className="form-input" rows={2} placeholder="Réunion commerciale…" value={reason} onChange={e => setReason(e.target.value)}></textarea>
      </div>
      <div style={{ marginTop: 14, padding: 14, background: C.cyanSoft, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Sparkles size={16} color={C.cyanDeep} />
        <div style={{ fontSize: 12, color: C.ink }}>
          <strong>Auto :</strong> QR code envoyé par WhatsApp · Hôte notifié · Calendrier mis à jour
        </div>
      </div>
    </ModalShell>
  );
}

function NewBadgeModal({ onClose }: any) {
  const [type, setType] = useState('employee');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [color, setColor] = useState('Cyan');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!name.trim()) { toast.error('Nom requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/reception/badges', { type, name, role, color });
      toast.success('Badge créé', 'Envoi à l\'imprimante.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de créer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Créer un badge" subtitle="Employé permanent ou visiteur ponctuel" icon={Contact} color={C.purple} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.purple }} disabled={submitting} onClick={submit}><Printer size={14} /> {submitting ? 'Création…' : 'Créer & imprimer'}</button></>}>
      <label className="form-label">Type de badge</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { id: 'employee', label: 'Employé', desc: 'Permanent · QR + RFID', icon: Users, color: C.emerald },
          { id: 'visitor', label: 'Visiteur', desc: 'Temporaire · QR jetable', icon: UserPlus, color: C.cyan },
        ].map(t => {
          const Ic = t.icon;
          return (
            <button key={t.id} onClick={() => setType(t.id)} style={{ background: type === t.id ? `${t.color}15` : C.cream, border: `1.5px solid ${type === t.id ? t.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}20`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={16} /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{t.label}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{t.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="form-row">
        <div><label className="form-label">Nom complet</label><input className="form-input" placeholder="Marie Diallo" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="form-label">Rôle / Société</label><input className="form-input" placeholder="Designer" value={role} onChange={e => setRole(e.target.value)} /></div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Photo</label>
          <button style={{ width: '100%', background: C.cream, border: `1.5px dashed ${C.purple}`, borderRadius: 10, padding: 12, color: C.purple, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Camera size={14} /> Prendre une photo
          </button>
        </div>
        <div><label className="form-label">Couleur badge</label>
          <select className="form-input" value={color} onChange={e => setColor(e.target.value)}><option>Cyan</option><option>Émeraude</option><option>Or</option><option>Rouge</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14, padding: 14, background: C.purpleSoft, borderRadius: 12, fontSize: 12, color: C.ink, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Printer size={14} color={C.purple} /> Imprimante : Brother QL-820NWB · Connectée · 18 badges restants
      </div>
    </ModalShell>
  );
}

function NewAppointmentModal({ onClose }: any) {
  const [visitor, setVisitor] = useState('');
  const [host, setHost] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('30 min');
  const [room, setRoom] = useState('Salle A');
  const [subject, setSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!visitor.trim() || !date) { toast.error('Visiteur et date requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/reception/appointments', { visitor, host, date, time, duration, room, subject });
      toast.success('Rendez-vous programmé');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de programmer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouveau rendez-vous" icon={CalendarClock} color={C.gold} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.gold }} disabled={submitting} onClick={submit}><Send size={14} /> {submitting ? 'Envoi…' : 'Programmer'}</button></>}>
      <div className="form-row">
        <div><label className="form-label">Visiteur</label><input className="form-input" placeholder="Nom du visiteur" value={visitor} onChange={e => setVisitor(e.target.value)} /></div>
        <div><label className="form-label">Hôte</label><input className="form-input" placeholder="Employé responsable" value={host} onChange={e => setHost(e.target.value)} /></div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label className="form-label">Heure</label><input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} /></div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Durée</label>
          <select className="form-input" value={duration} onChange={e => setDuration(e.target.value)}><option>15 min</option><option>30 min</option><option>1h</option><option>1h30</option><option>2h</option></select>
        </div>
        <div><label className="form-label">Salle</label>
          <select className="form-input" value={room} onChange={e => setRoom(e.target.value)}><option>Salle A</option><option>Salle B</option><option>Espace ouvert</option><option>À distance</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Objet du rendez-vous</label>
        <textarea className="form-input" rows={2} placeholder="Présentation projet…" value={subject} onChange={e => setSubject(e.target.value)}></textarea>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" defaultChecked style={{ accentColor: C.gold }} /><span style={{ fontSize: 13 }}>Envoyer QR au visiteur</span></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" defaultChecked style={{ accentColor: C.gold }} /><span style={{ fontSize: 13 }}>Notifier l'hôte</span></label>
      </div>
    </ModalShell>
  );
}

function NewCodeModal({ onClose }: any) {
  const [userId, setUserId] = useState('');
  const [codeType, setCodeType] = useState('Code 6 chiffres');
  const [validity, setValidity] = useState('Permanent');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!userId.trim()) { toast.error('Employé requis'); return; }
    setSubmitting(true);
    try {
      await api.post(`/reception/employee-codes/${encodeURIComponent(userId)}/generate`, { type: codeType, validity });
      toast.success('Code généré', 'Envoi par email + SMS en cours.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de générer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Générer un code de pointage" icon={QrCode} color={C.pink} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.pink }} disabled={submitting} onClick={submit}><CheckCircle2 size={14} /> {submitting ? 'Génération…' : 'Générer'}</button></>}>
      <div><label className="form-label">Employé (ID ou email)</label><input className="form-input" placeholder="adelin@orlode.ai" value={userId} onChange={e => setUserId(e.target.value)} /></div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Type de code</label>
          <select className="form-input" value={codeType} onChange={e => setCodeType(e.target.value)}><option>Code 6 chiffres</option><option>QR badge</option><option>Reconnaissance faciale</option></select>
        </div>
        <div><label className="form-label">Validité</label>
          <select className="form-input" value={validity} onChange={e => setValidity(e.target.value)}><option>Permanent</option><option>1 jour</option><option>1 semaine</option><option>1 mois</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14, padding: 14, background: C.pinkSoft, borderRadius: 12, fontSize: 12, color: C.ink }}>
        <strong>Auto :</strong> code envoyé par email + SMS · Notification d'activation
      </div>
    </ModalShell>
  );
}

// ============ HOST RESPONSE PANEL ============
// Shows visitors waiting for THIS user as host, with accept/wait/decline actions.
// Polls every 5s. Auto-hides when no pending visitors.
function HostResponsePanel() {
  interface PendingVisitor { id: string; name?: string; company?: string; purpose?: string; badgeNumber?: string; createdAt?: any; }
  const [pending, setPending] = useState<PendingVisitor[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = async () => {
    try {
      const r = await api.get<{ data: PendingVisitor[] }>('/reception/visitors/pending-host');
      const raw = r.data as unknown as Record<string, unknown>;
      const list = (raw?.data ?? raw) as PendingVisitor[];
      setPending(Array.isArray(list) ? list : []);
    } catch { /* ignore — endpoint may 404 if no auth user */ }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  const respond = async (visitorId: string, action: 'allow_entry' | 'wait' | 'decline') => {
    setBusy(b => ({ ...b, [visitorId]: true }));
    try {
      await api.post(`/reception/visitors/${visitorId}/host-respond`, { action });
      toast.success(
        action === 'allow_entry' ? 'Visiteur autorisé à entrer' :
        action === 'wait' ? 'Demande d\'attendre envoyée' :
        'Visiteur refusé'
      );
      setPending(p => p.filter(v => v.id !== visitorId));
    } catch {
      toast.error('Erreur lors de la réponse');
    } finally {
      setBusy(b => ({ ...b, [visitorId]: false }));
    }
  };

  if (pending.length === 0) return null;

  return (
    <div style={{ padding: '0 32px' }}>
      <div style={{
        background: `linear-gradient(135deg, ${C.amber}15, ${C.amber}08)`,
        border: `2px solid ${C.amber}`,
        borderRadius: 18, padding: 20,
        boxShadow: `0 12px 32px -12px ${C.amber}80`,
        animation: 'kioskPulseBox 2.4s ease-in-out infinite',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${C.amber}, ${C.gold})`,
            color: C.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 8px 20px -4px ${C.amber}`,
          }}>
            <Bell size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="display-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: '-0.01em' }}>
              {pending.length} visiteur{pending.length > 1 ? 's' : ''} <em style={{ fontStyle: 'italic', color: C.amber }}>vous attend{pending.length > 1 ? 'ent' : ''}</em>
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft }}>
              Réponse rapide pour libérer l'accueil — accepter / faire patienter / refuser
            </div>
          </div>
          <span className="pill" style={{ background: C.amber, color: C.cream, fontWeight: 800, letterSpacing: '0.05em' }}>
            <span className="live-dot" style={{ background: C.cream }}></span>EN ATTENTE
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {pending.map(v => {
            const since = v.createdAt ? Math.round((Date.now() - new Date(v.createdAt).getTime()) / 60000) : null;
            const isBusy = !!busy[v.id];
            return (
              <div key={v.id} style={{
                background: C.cream, borderRadius: 14, padding: 14,
                border: '1px solid rgba(10,42,32,0.08)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${C.cyan}, ${C.cyanDeep})`,
                    color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontFamily: 'Fraunces, serif',
                  }}>
                    {(v.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{v.name || 'Visiteur'}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>
                      {v.company ? `${v.company} · ` : ''}{since !== null ? `arrivé il y a ${since} min` : 'arrivée récente'}
                    </div>
                  </div>
                  {v.badgeNumber && (
                    <span className="mono-font" style={{ fontSize: 10, color: C.gold, fontWeight: 700, padding: '3px 8px', background: C.goldSoft, borderRadius: 6 }}>
                      #{v.badgeNumber}
                    </span>
                  )}
                </div>

                {v.purpose && (
                  <div style={{ fontSize: 11, color: C.inkSoft, fontStyle: 'italic', padding: '6px 10px', background: C.creamDeep, borderRadius: 8 }}>
                    « {v.purpose} »
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  <button onClick={() => respond(v.id, 'allow_entry')} disabled={isBusy} style={{
                    background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDeep})`,
                    color: C.cream, border: 'none', borderRadius: 10,
                    padding: '8px', fontSize: 11, fontWeight: 700, cursor: isBusy ? 'wait' : 'pointer',
                    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    opacity: isBusy ? 0.6 : 1,
                  }}>
                    <CheckCircle2 size={12} /> Accepter
                  </button>
                  <button onClick={() => respond(v.id, 'wait')} disabled={isBusy} style={{
                    background: `linear-gradient(135deg, ${C.amber}, ${C.gold})`,
                    color: C.cream, border: 'none', borderRadius: 10,
                    padding: '8px', fontSize: 11, fontWeight: 700, cursor: isBusy ? 'wait' : 'pointer',
                    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    opacity: isBusy ? 0.6 : 1,
                  }}>
                    <Clock size={12} /> Patienter
                  </button>
                  <button onClick={() => respond(v.id, 'decline')} disabled={isBusy} style={{
                    background: 'transparent',
                    color: C.red, border: `1.5px solid ${C.red}`, borderRadius: 10,
                    padding: '8px', fontSize: 11, fontWeight: 700, cursor: isBusy ? 'wait' : 'pointer',
                    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    opacity: isBusy ? 0.6 : 1,
                  }}>
                    <X size={12} /> Refuser
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes kioskPulseBox { 0%, 100% { box-shadow: 0 12px 32px -12px ${C.amber}80; } 50% { box-shadow: 0 12px 32px -12px ${C.amber}; } }`}</style>
    </div>
  );
}

// ============ PAGE 1: ACCUEIL ============
function AccueilPage({ onTab, openModal, data }: any) {
  const presents = (data?.presence || []).filter((p: any) => p.status === 'present' || p.checkedIn).length;
  const totalEmp = (data?.directory || []).length || 0;
  const visitorsToday = (data?.visitors || []).filter((v: any) => {
    const d = new Date(v.createdAt || v.timestamp || Date.now());
    return d.toDateString() === new Date().toDateString();
  }).length;
  const apptsToday = (data?.appointments || []).filter((a: any) => {
    const d = new Date(a.date || a.scheduledAt || Date.now());
    return d.toDateString() === new Date().toDateString();
  }).length;
  const stats = [
    { label: 'Présents', value: String(presents), sub: `sur ${totalEmp || '—'} employés`, color: C.emeraldDeep, bg: C.emeraldSoft, icon: UserCheck },
    { label: 'Visiteurs aujourd\'hui', value: String(visitorsToday), sub: data?.pendingHost?.length ? `${data.pendingHost.length} en attente` : 'Aucun en attente', color: C.cyan, bg: C.cyanSoft, icon: Users },
    { label: 'Absents', value: String(Math.max(0, totalEmp - presents)), sub: `${(data?.leaves || []).length} congés`, color: C.red, bg: C.redSoft, icon: UserX },
    { label: 'RDV du jour', value: String(apptsToday), sub: 'Programmés', color: C.gold, bg: C.goldSoft, icon: CalendarClock },
  ];
  const modules = [
    { name: 'Live Hub', desc: 'Flux temps réel', icon: Activity, color: C.cyan, bg: C.cyanSoft, page: 'Live Hub', live: true },
    { name: 'Visiteurs', desc: `${(data?.visitors || []).length} visiteurs`, icon: UserPlus, color: C.cyanDeep, bg: C.cyanSoft, page: 'Visiteurs' },
    { name: 'Présence', desc: 'Pointage', icon: Fingerprint, color: C.emerald, bg: C.emeraldSoft, page: 'Présence' },
    { name: 'Badges', desc: `${(data?.badges || []).length} badges`, icon: Contact, color: C.purple, bg: C.purpleSoft, page: 'Badges' },
    { name: 'Annuaire', desc: `${(data?.directory || []).length} collaborateurs`, icon: UsersRound, color: C.blue, bg: C.blueSoft, page: 'Annuaire' },
    { name: 'Codes & QR', desc: 'Pointage', icon: QrCode, color: C.pink, bg: C.pinkSoft, page: 'Codes' },
    { name: 'Mode Kiosk', desc: 'Plein écran', icon: Maximize2, color: C.greenDeep, bg: C.greenSoft, page: 'Mode Kiosk' },
    { name: 'Rapports', desc: 'PDF · CSV', icon: FileText, color: C.gold, bg: C.goldSoft, page: 'Rapports' },
  ];
  const quickActions = [
    { title: 'Enregistrer un visiteur', desc: 'Pré-enregistrement + QR WhatsApp', icon: UserPlus, color: C.cyan, action: 'visitor' },
    { title: 'Créer un badge', desc: 'Employé ou visiteur', icon: Contact, color: C.purple, action: 'badge' },
    { title: 'Nouveau RDV', desc: 'Programmer un rendez-vous', icon: CalendarClock, color: C.gold, action: 'appointment' },
    { title: 'Générer un code', desc: 'Code 6 chiffres / QR', icon: QrCode, color: C.pink, action: 'code' },
    { title: 'Mode Kiosk', desc: 'Plein écran tablette', icon: Maximize2, color: C.greenDeep, onClick: launchKiosk },
    { title: 'Voir les présences', desc: `${presents}/${totalEmp} actuellement présents`, icon: UserCheck, color: C.blue },
  ];
  return (
    <>
      <PageHeader title="Bienvenue à" italic="la Réception."
        subtitle="Le hub central qui accueille, identifie et alimente tous les autres agents en temps réel."
        badge="HUB CENTRAL · LIVE" gradient="cyan"
        actions={<>
          <button className="btn-secondary" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream, border: '1px solid rgba(255,250,240,0.25)' }} onClick={() => openModal('badge')}><Contact size={14} /> Créer un badge</button>
          <button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.6)' }} onClick={() => openModal('visitor')}><UserPlus size={16} /> Nouveau visiteur</button>
        </>} />

      {/* Visiteurs en attente de réponse — l'employé host peut accepter / faire patienter / refuser */}
      <div style={{ paddingTop: 24 }}>
        <HostResponsePanel />
      </div>

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>
      <div style={{ padding: '32px 32px 0' }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px' }}>
          Modules <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanMid, fontSize: 18 }}>— accès rapide</em>
        </h3>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {modules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} onClick={() => onTab(mod.page)} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease', position: 'relative' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${mod.color}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {mod.live && (
                  <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="live-dot"></span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.cyanDeep, letterSpacing: '0.08em' }}>LIVE</span>
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
      <div style={{ padding: '32px 32px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Zap size={18} color={C.cyan} />
          <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: 0 }}>
            Actions rapides <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanMid, fontSize: 18 }}>— modals fonctionnelles</em>
          </h3>
        </div>
        <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {quickActions.map((qa, idx) => {
            const Icon = qa.icon;
            return (
              <div key={idx} onClick={() => { if (qa.onClick) qa.onClick(); else if (qa.action) openModal(qa.action); }} style={{ background: C.cream, borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.borderColor = qa.color; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `${qa.color}15`, color: qa.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{qa.title}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{qa.desc}</div>
                </div>
                <ChevronRight size={16} color={C.inkSoft} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 2: LIVE HUB ============
function LiveHubPage({ data }: any) {
  const events = data?.presenceHistory || [];
  return (
    <>
      <PageHeader title="Live Hub" italic="le pouls de l'entreprise"
        subtitle="Chaque mouvement tracé et envoyé aux agents concernés"
        leftPills={<div className="pill" style={{ background: C.cyan, color: C.cream }}><span className="live-dot" style={{ background: C.cream }}></span>EN DIRECT</div>}
        gradient="cyan"
        actions={<><button className="btn-secondary"><Download size={14} /> Export</button>
          <button className="btn-primary" style={{ background: C.greenDeep }}><Maximize2 size={16} /> Mode mur d'écran</button></>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {events.length === 0 ? (
          <EmptyState icon={Activity} title="Aucun événement aujourd'hui" desc="Les arrivées, départs et passages de visiteurs apparaîtront ici en temps réel." />
        ) : (
          <div style={{ background: C.cream, borderRadius: 20, padding: 28, border: '1px solid rgba(10,42,32,0.06)' }}>
            <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 16px' }}>Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.slice(0, 50).map((ev: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: C.creamDeep, borderRadius: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: ev.type === 'checkout' ? `${C.gold}25` : `${C.emerald}25`, color: ev.type === 'checkout' ? C.gold : C.emerald, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ev.type === 'checkout' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{ev.userName || ev.name || 'Employé'}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{ev.method || ev.type} · {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString('fr-FR') : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 3: RDV & VISITES ============
function RDVVisitesPage({ openModal, data }: any) {
  const appointments = data?.appointments || [];
  const [view, setView] = useState('list');
  return (
    <>
      <PageHeader title="RDV" italic="& visites"
        subtitle="Programmer · Suivre · Notifier les hôtes"
        badge="PILOTAGE" gradient="cyan"
        actions={<><button className="btn-secondary"><Calendar size={14} /> Calendrier</button>
          <button className="btn-primary" style={{ background: C.gold }} onClick={() => openModal('appointment')}><Plus size={16} /> Nouveau RDV</button></>} />
      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {appointments.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Aucun rendez-vous programmé" desc="Programme ton premier RDV avec un visiteur." action={<button className="btn-primary" style={{ background: C.gold }} onClick={() => openModal('appointment')}><Plus size={14} /> Nouveau RDV</button>} />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {appointments.map((a: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.gold}15`, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarClock size={20} />
                  </div>
                  <span className="pill" style={{ background: a.status === 'completed' ? C.emeraldSoft : C.cyanSoft, color: a.status === 'completed' ? C.emeraldDeep : C.cyanDeep, fontWeight: 700 }}>{a.status || 'Programmé'}</span>
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{a.visitorName || a.title || 'Rendez-vous'}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>Hôte : {a.hostName || '—'}</div>
                {a.scheduledAt && (
                  <div className="mono-font" style={{ fontSize: 11, color: C.gold, fontWeight: 600, padding: '6px 10px', background: C.goldSoft, borderRadius: 8, display: 'inline-block' }}>
                    {new Date(a.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="stagger">
            {appointments.map((a: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.gold}15`, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarClock size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{a.visitorName || a.title || 'Rendez-vous'}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{a.hostName || ''} {a.scheduledAt ? `· ${new Date(a.scheduledAt).toLocaleString('fr-FR')}` : ''}</div>
                </div>
                <span className="pill" style={{ background: a.status === 'completed' ? C.emeraldSoft : C.cyanSoft, color: a.status === 'completed' ? C.emeraldDeep : C.cyanDeep, fontWeight: 700 }}>{a.status || 'Programmé'}</span>
                <button className="icon-btn"><Eye size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 4: PRÉSENCE ============
function PresencePage({ data }: any) {
  const presence = data?.presence || [];
  const [view, setView] = useState('list');
  const isPresent = (p: any) => p.checkedIn || p.status === 'present';
  return (
    <>
      <PageHeader title="Présence" italic="aujourd'hui"
        subtitle="Pointage temps réel · Code 6 chiffres · QR · Reconnaissance faciale"
        badge="LIVE" gradient="cyan"
        actions={<button className="btn-primary"><Fingerprint size={16} /> Pointer</button>} />
      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {presence.length === 0 ? (
          <EmptyState icon={Fingerprint} title="Aucune présence enregistrée" desc="Les pointages apparaîtront ici en temps réel." />
        ) : view === 'grid' ? (
          <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {presence.map((p: any, i: number) => {
              const name = p.userName || p.name || 'Employé';
              const present = isPresent(p);
              return (
                <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: `1px solid ${present ? C.emerald + '40' : 'rgba(10,42,32,0.06)'}`, position: 'relative', overflow: 'hidden' }}>
                  {present && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.emerald }}></div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div className="avatar" style={{ background: present ? C.emerald : C.inkSoft, width: 44, height: 44, fontSize: 14 }}>{name.split(' ').map((x: string) => x[0]).join('').slice(0, 2)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{name}</div>
                      <span className="pill" style={{ background: present ? C.emeraldSoft : C.creamDeep, color: present ? C.emeraldDeep : C.inkSoft, fontWeight: 700, marginTop: 4 }}>{present ? 'Présent' : 'Absent'}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.inkSoft, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Méthode</span><span style={{ color: C.ink }}>{p.method || '—'}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Arrivée</span><span className="mono-font" style={{ color: C.ink }}>{p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Départ</span><span className="mono-font">{p.checkOutTime ? new Date(p.checkOutTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <div>Employé</div><div>Statut</div><div>Méthode</div><div>Arrivée</div><div>Départ</div>
            </div>
            {presence.map((p: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar" style={{ background: C.cyan, width: 36, height: 36, fontSize: 13 }}>{(p.userName || p.name || 'E').split(' ').map((x: string) => x[0]).join('').slice(0, 2)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{p.userName || p.name || '—'}</div>
                </div>
                <div><span className="pill" style={{ background: isPresent(p) ? C.emeraldSoft : C.creamDeep, color: isPresent(p) ? C.emeraldDeep : C.inkSoft, fontWeight: 700 }}>{isPresent(p) ? 'Présent' : 'Absent'}</span></div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{p.method || '—'}</div>
                <div className="mono-font" style={{ fontSize: 12, color: C.ink }}>{p.checkInTime ? new Date(p.checkInTime).toLocaleTimeString('fr-FR') : '—'}</div>
                <div className="mono-font" style={{ fontSize: 12, color: C.inkSoft }}>{p.checkOutTime ? new Date(p.checkOutTime).toLocaleTimeString('fr-FR') : '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 5: VISITEURS ============
function VisiteursPage({ openModal, data }: any) {
  const visitors = data?.visitors || [];
  const [view, setView] = useState('list');
  const statusPill = (v: any) => (
    <span className="pill" style={{ background: v.status === 'checked-out' ? C.creamDeep : v.status === 'checked-in' ? C.emeraldSoft : C.yellowSoft, color: v.status === 'checked-out' ? C.inkSoft : v.status === 'checked-in' ? C.emeraldDeep : C.yellow, fontWeight: 700 }}>{v.status || 'Attente'}</span>
  );
  return (
    <>
      <PageHeader title="Visiteurs" italic={`${visitors.length} enregistrés`}
        subtitle="Pré-enregistrement · QR WhatsApp · Notification hôte"
        badge="OPS" gradient="cyan"
        actions={<button className="btn-primary" onClick={() => openModal('visitor')}><Plus size={16} /> Nouveau visiteur</button>} />
      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {visitors.length === 0 ? (
          <EmptyState icon={UserPlus} title="Aucun visiteur enregistré" desc="Pré-enregistre ton premier visiteur en 30 secondes." action={<button className="btn-primary" onClick={() => openModal('visitor')}><Plus size={14} /> Nouveau visiteur</button>} />
        ) : view === 'grid' ? (
          <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {visitors.map((v: any, i: number) => {
              const name = v.name || `${v.firstName || ''} ${v.lastName || ''}`.trim() || '—';
              return (
                <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = C.cyan; e.currentTarget.style.boxShadow = `0 16px 32px -16px ${C.cyan}40`; }}
                  onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div className="avatar" style={{ background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.cyanDeep} 100%)`, width: 48, height: 48, fontSize: 16 }}>{name.slice(0, 2).toUpperCase()}</div>
                    {statusPill(v)}
                  </div>
                  <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{name}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>{v.company || '—'}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: C.inkSoft }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={11} /> Hôte : {v.hostName || v.hostId || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={11} /> {v.scheduledAt || v.createdAt ? new Date(v.scheduledAt || v.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                    <button className="icon-btn" style={{ flex: 1, height: 32 }}><QrCode size={13} /></button>
                    <button className="icon-btn" style={{ flex: 1, height: 32 }}><Eye size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <div>Visiteur</div><div>Hôte</div><div>Heure</div><div>Statut</div><div></div>
            </div>
            {visitors.map((v: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar" style={{ background: C.cyan, width: 36, height: 36, fontSize: 13 }}>{(v.name || v.firstName || 'V').slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{v.name || `${v.firstName || ''} ${v.lastName || ''}`.trim() || '—'}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{v.company || ''}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.ink }}>{v.hostName || v.hostId || '—'}</div>
                <div className="mono-font" style={{ fontSize: 12, color: C.inkSoft }}>{v.scheduledAt || v.createdAt ? new Date(v.scheduledAt || v.createdAt).toLocaleTimeString('fr-FR') : '—'}</div>
                <div>{statusPill(v)}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon-btn" style={{ width: 28, height: 28 }}><QrCode size={12} /></button>
                  <button className="icon-btn" style={{ width: 28, height: 28 }}><Eye size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 6: LIVRAISONS ============
function LivraisonsPage() {
  return (
    <>
      <PageHeader title="Livraisons" italic="& colis"
        subtitle="Réception colis · Notification destinataire · Photo preuve"
        badge="OPS" gradient="cyan"
        actions={<button className="btn-primary"><Plus size={16} /> Réceptionner un colis</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={Package} title="Aucune livraison enregistrée" desc="Les colis et livraisons apparaîtront ici dès leur réception." />
      </div>
    </>
  );
}

// ============ PAGE 7: ANNUAIRE ============
function AnnuairePage({ data }: any) {
  const directory = data?.directory || [];
  const [search, setSearch] = useState('');
  const filtered = directory.filter((d: any) => {
    const name = d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim();
    return name.toLowerCase().includes(search.toLowerCase()) || (d.role || '').toLowerCase().includes(search.toLowerCase());
  });
  return (
    <>
      <PageHeader title="Annuaire" italic="entreprise"
        subtitle={`${directory.length} collaborateurs · Recherche live`}
        badge="DIRECTORY" gradient="cyan"
        actions={<button className="btn-primary"><Sparkles size={14} /> Recherche IA</button>} />
      <div style={{ padding: '24px 32px 0' }}>
        <div style={{ background: C.cream, borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(10,42,32,0.06)' }}>
          <Search size={18} color={C.inkSoft} />
          <input value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Cherche par nom, poste, département…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: C.ink, fontFamily: 'inherit' }} />
        </div>
      </div>
      <div style={{ padding: '24px 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon={UsersRound} title={search ? 'Aucun résultat' : 'Annuaire vide'} desc={search ? 'Essaye un autre nom ou poste.' : 'Les employés apparaîtront ici automatiquement.'} />
        ) : (
          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {filtered.map((d: any, i: number) => {
              const name = d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim();
              return (
                <div key={i} style={{ background: C.cream, borderRadius: 14, padding: 14, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div className="avatar" style={{ background: C.cyan, width: 42, height: 42, fontSize: 14 }}>{name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || '—'}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{d.role || d.title || '—'}</div>
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

// ============ PAGE 8: BADGES ============
function BadgesPage({ openModal, data }: any) {
  const badges = data?.badges || [];
  return (
    <>
      <PageHeader title="Badges" italic={`${badges.length} émis`}
        subtitle="Création · Photo · Impression Brother QL"
        badge="OPS" gradient="cyan"
        actions={<button className="btn-primary" style={{ background: C.purple }} onClick={() => openModal('badge')}><Plus size={16} /> Nouveau badge</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {badges.length === 0 ? (
          <EmptyState icon={Contact} title="Aucun badge créé" desc="Crée le premier badge employé ou visiteur." action={<button className="btn-primary" style={{ background: C.purple }} onClick={() => openModal('badge')}><Plus size={14} /> Créer un badge</button>} />
        ) : (
          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {badges.map((b: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 16, border: '1px solid rgba(10,42,32,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div className="avatar" style={{ background: b.type === 'visitor' ? C.cyan : C.emerald, width: 44, height: 44, fontSize: 14 }}>{(b.name || 'B').slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{b.name || '—'}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{b.role || b.company || ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="pill" style={{ background: b.type === 'visitor' ? C.cyanSoft : C.emeraldSoft, color: b.type === 'visitor' ? C.cyanDeep : C.emeraldDeep, fontWeight: 700 }}>{b.type === 'visitor' ? 'Visiteur' : 'Employé'}</span>
                  <button className="icon-btn" style={{ width: 28, height: 28 }}><Printer size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 9: MODE KIOSK ============
function launchKiosk() {
  // Open the kiosk welcome page in a new tab; the kiosk pages have their own layout.
  const win = window.open('/kiosk', '_blank', 'noopener,noreferrer');
  if (!win) window.location.href = '/kiosk';
}

// Animated SVG human avatar — listens, speaks (mouth lipsync), pulses while listening
function HumanAvatar({ speaking, listening }: { speaking: boolean; listening: boolean }) {
  const [mouthFrame, setMouthFrame] = useState(0);

  useEffect(() => {
    if (!speaking) return;
    const interval = setInterval(() => setMouthFrame(f => (f + 1) % 4), 120);
    return () => clearInterval(interval);
  }, [speaking]);

  const mouthShapes = [
    { ry: 1.5, w: 8 },
    { ry: 4,   w: 7 },
    { ry: 2.5, w: 9 },
    { ry: 5,   w: 8 },
  ];
  const mouth = mouthShapes[mouthFrame];

  return (
    <div style={{
      width: 240, height: 240,
      borderRadius: '50%',
      background: `radial-gradient(circle at 30% 30%, ${C.cyan}40, ${C.greenDeep})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      boxShadow: speaking
        ? `0 0 80px -10px ${C.cyan}, inset 0 0 60px ${C.cyanDeep}40`
        : `0 24px 48px -16px ${C.cyan}80, inset 0 0 40px ${C.cyanDeep}30`,
      transition: 'box-shadow 0.3s ease',
    }}>
      {listening && (
        <>
          <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: `2px solid ${C.cyan}40`, animation: 'kioskPulse 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', border: `1px solid ${C.cyan}20`, animation: 'kioskPulse 2s ease-in-out infinite', animationDelay: '0.4s' }} />
        </>
      )}

      <svg width="180" height="180" viewBox="0 0 180 180" style={{ borderRadius: '50%', overflow: 'visible' }}>
        <defs>
          <radialGradient id="skinGrad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#E8B68F" />
            <stop offset="100%" stopColor="#B8855F" />
          </radialGradient>
          <radialGradient id="hairGrad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#3D2817" />
            <stop offset="100%" stopColor="#1A0F08" />
          </radialGradient>
          <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={C.cyan} />
            <stop offset="100%" stopColor={C.cyanDeep} />
          </linearGradient>
        </defs>
        <path d="M 30 180 Q 30 130, 90 130 Q 150 130, 150 180 Z" fill="url(#shirtGrad)" />
        <path d="M 70 130 L 90 145 L 110 130" fill="none" stroke={C.cream} strokeWidth="1.5" opacity="0.6" />
        <rect x="78" y="115" width="24" height="20" fill="url(#skinGrad)" rx="4" />
        <ellipse cx="90" cy="65" rx="58" ry="58" fill="url(#hairGrad)" />
        <ellipse cx="90" cy="78" rx="40" ry="48" fill="url(#skinGrad)" />
        <path d="M 50 60 Q 60 30, 90 28 Q 120 30, 130 60 Q 130 50, 122 48 Q 110 38, 90 38 Q 70 38, 58 48 Q 50 50, 50 60 Z" fill="url(#hairGrad)" />
        <path d="M 68 70 Q 75 67, 82 70" stroke="#2A1810" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 98 70 Q 105 67, 112 70" stroke="#2A1810" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="75"  cy="80" rx="6" ry={listening ? 4.5 : 4} fill={C.cream} />
        <ellipse cx="105" cy="80" rx="6" ry={listening ? 4.5 : 4} fill={C.cream} />
        <circle cx="75"  cy="80" r="3.5" fill="#3D2817" />
        <circle cx="105" cy="80" r="3.5" fill="#3D2817" />
        <circle cx="75"  cy="80" r="1.8" fill="#0A0A0A" />
        <circle cx="105" cy="80" r="1.8" fill="#0A0A0A" />
        <circle cx="76.5"  cy="79" r="0.8" fill={C.cream} />
        <circle cx="106.5" cy="79" r="0.8" fill={C.cream} />
        <path d="M 88 88 Q 87 95, 89 100 Q 91 102, 93 100 Q 92 95, 91 88" fill="none" stroke="#9A6B47" strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="68"  cy="95" rx="5" ry="3" fill="#E89B7F" opacity="0.4" />
        <ellipse cx="112" cy="95" rx="5" ry="3" fill="#E89B7F" opacity="0.4" />
        {speaking ? (
          <ellipse cx="90" cy="108" rx={mouth.w / 2} ry={mouth.ry} fill="#7A2A2A" />
        ) : (
          <path d="M 82 106 Q 90 112, 98 106" stroke="#7A2A2A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
        <circle cx="50"  cy="92" r="2" fill={C.gold} />
        <circle cx="130" cy="92" r="2" fill={C.gold} />
      </svg>

      <div style={{
        position: 'absolute', bottom: -8, right: -8,
        width: 56, height: 56, borderRadius: '50%',
        background: speaking
          ? `linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDeep} 100%)`
          : `linear-gradient(135deg, ${C.cyan} 0%, ${C.cyanDeep} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 20px -4px rgba(0,0,0,0.4)',
        border: `4px solid ${C.greenDeep}`,
        transition: 'all 0.3s ease',
      }}>
        {speaking ? <Volume2 size={22} color={C.cream} /> : (listening ? <Mic size={22} color={C.cream} /> : <MicOff size={22} color={C.cream} />)}
      </div>

      <style>{`@keyframes kioskPulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.08); opacity: 0; } }`}</style>
    </div>
  );
}

function ModeKioskPage() {
  const [speaking, setSpeaking] = useState(false);
  const [listening] = useState(true);
  const [activeLang, setActiveLang] = useState<'FR' | 'EN' | 'ES' | 'AR'>('FR');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setSpeaking(s => !s), 2400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateLong = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <PageHeader title="Mode Kiosk" italic="à l'accueil."
        subtitle="L'écran tablette qui accueille les visiteurs · Assistant vocal humain · 4 actions rapides"
        leftPills={
          <div className="pill" style={{ background: C.greenDeep, color: C.cream }}>
            <Maximize2 size={11} /> PLEIN ÉCRAN · TABLETTE
          </div>
        }
        gradient="cyan"
        actions={
          <>
            <button className="btn-secondary"><Settings size={14} /> Configurer</button>
            <button className="btn-primary" onClick={launchKiosk} style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.6)' }}>
              <Maximize2 size={16} /> Lancer en plein écran
            </button>
          </>
        }
      />

      {/* Kiosk preview — dark glass tablet */}
      <div style={{ padding: '24px 32px 0' }}>
        <div style={{
          background: '#0A0F12',
          borderRadius: 24, padding: 40,
          position: 'relative', overflow: 'hidden',
          minHeight: 640,
          border: `1px solid ${C.cyan}40`,
          boxShadow: `0 40px 80px -20px rgba(0,0,0,0.6), inset 0 0 100px ${C.cyan}10`,
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at center, ${C.cyan}15, transparent 70%), radial-gradient(circle at top right, ${C.purple}10, transparent 50%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 50, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="display-font" style={{ fontSize: 56, fontWeight: 800, color: C.cream, lineHeight: 1, letterSpacing: '-0.03em' }}>{time}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,250,240,0.5)', marginTop: 4, textTransform: 'capitalize' }}>{dateLong}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div className="pill" style={{ background: C.emerald, color: C.cream, padding: '6px 12px', fontSize: 12 }}>
                <span className="live-dot" style={{ background: C.cream }}></span>
                EN LIGNE
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.08)', borderRadius: 100, padding: 4 }}>
                {(['FR', 'EN', 'ES', 'AR'] as const).map(lang => (
                  <div key={lang} onClick={() => setActiveLang(lang)} style={{
                    padding: '6px 12px', borderRadius: 100,
                    background: activeLang === lang ? C.cream : 'transparent',
                    color: activeLang === lang ? C.greenDeep : 'rgba(255,250,240,0.6)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>{lang}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Avatar + welcome */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
            <HumanAvatar speaking={speaking} listening={listening} />

            <h2 className="display-font" style={{ fontSize: 42, fontWeight: 800, color: C.cream, margin: '32px 0 8px', letterSpacing: '-0.03em' }}>
              Bienvenue
            </h2>
            <div style={{ fontSize: 18, color: 'rgba(255,250,240,0.6)', marginBottom: 20 }}>
              chez OuiHope NGO
            </div>

            <div style={{
              background: 'rgba(255,250,240,0.06)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,250,240,0.1)',
              borderRadius: 20, padding: '14px 22px',
              maxWidth: 480, textAlign: 'center',
              fontSize: 15, color: C.cream, lineHeight: 1.5,
              fontStyle: 'italic',
            }}>
              {speaking ? (
                <>« Bonjour ! Je suis <strong style={{ color: C.cyanMid, fontStyle: 'normal' }}>Aïcha</strong>, votre assistante d'accueil. Comment puis-je vous aider aujourd'hui ? »</>
              ) : (
                <>
                  <Mic size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} color={C.cyanMid} />
                  À l'écoute… Parlez ou choisissez ci-dessous
                </>
              )}
            </div>
          </div>

          {/* 4 quick actions */}
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, maxWidth: 720, margin: '0 auto 24px' }}>
            {[
              { label: 'RDV',       desc: "J'ai un rendez-vous",     icon: CalendarClock, color: C.blue },
              { label: 'Sans RDV',  desc: 'Je viens spontanément',    icon: UserPlus,      color: C.emerald },
              { label: 'Livraison', desc: 'Déposer un colis',         icon: Package,       color: C.gold },
              { label: 'Info',      desc: 'Question / direction',     icon: MessageSquare, color: C.purple },
            ].map((btn, idx) => {
              const Icon = btn.icon;
              return (
                <div key={idx}
                  onClick={launchKiosk}
                  style={{
                    background: `linear-gradient(180deg, ${btn.color} 0%, ${btn.color}dd 100%)`,
                    borderRadius: 18, padding: '22px 16px',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    textAlign: 'center', color: C.cream,
                    boxShadow: `0 12px 28px -8px ${btn.color}80`,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; e.currentTarget.style.boxShadow = `0 18px 36px -8px ${btn.color}`; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = `0 12px 28px -8px ${btn.color}80`; }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <Icon size={22} color={C.cream} strokeWidth={1.75} />
                  </div>
                  <div className="display-font" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 2 }}>{btn.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{btn.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Employee badge-in pill */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div onClick={launchKiosk} style={{
              background: 'rgba(255,250,240,0.06)',
              border: '1px solid rgba(255,250,240,0.1)',
              borderRadius: 100, padding: '10px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', color: C.cream,
              fontSize: 13, fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,250,240,0.12)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,250,240,0.06)'; }}
            >
              <KeyRound size={14} color={C.cyanMid} />
              Employé — Pointer ma présence
            </div>
          </div>
        </div>
      </div>

      {/* Customization grid */}
      <div style={{ padding: '24px 32px 32px' }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          Personnalisation <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cyanMid, fontSize: 18 }}>du Kiosk</em>
        </h3>

        <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { title: "Personnalité de l'assistant", desc: 'Aïcha (FR) · Sarah (EN) · Voix Google TTS Premium', icon: Smile,     color: C.cyan,    cta: 'Choisir' },
            { title: 'Langues activées',             desc: 'FR · EN · ES · AR · auto-détection vocale',       icon: Languages, color: C.purple,  cta: 'Configurer' },
            { title: 'Branding',                      desc: "Logo OuiHope NGO · Couleurs · Message d'accueil", icon: Palette,   color: C.gold,    cta: 'Modifier' },
            { title: 'Détection automatique',         desc: 'Caméra reconnaît employés · Mode économie',       icon: Camera,    color: C.emerald, cta: 'Activer' },
            { title: 'Audio',                         desc: 'Volume · Effets · Sons de notification',          icon: Volume2,   color: C.blue,    cta: 'Régler' },
            { title: 'Mode hors ligne',               desc: "Sync local · file d'attente · reprise auto",      icon: Wifi,      color: C.inkSoft, cta: 'Tester' },
          ].map((c, idx) => {
            const Icon = c.icon;
            return (
              <div key={idx} style={{
                background: C.cream, borderRadius: 16,
                padding: 20, border: '1px solid rgba(10,42,32,0.06)',
                transition: 'all 0.2s ease', cursor: 'pointer',
              }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = c.color; e.currentTarget.style.boxShadow = `0 16px 32px -16px ${c.color}40`; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${c.color}15`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em', marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4, marginBottom: 12 }}>{c.desc}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: c.color, fontWeight: 700 }}>
                  {c.cta} <ArrowRight size={12} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 10: CODES ============
function CodesPage({ openModal, data }: any) {
  const codes = data?.employeeCodes || [];
  return (
    <>
      <PageHeader title="Codes" italic="& QR"
        subtitle="Codes de pointage 6 chiffres · QR badges · Reconnaissance faciale"
        badge="CONFIG" gradient="cyan"
        actions={<button className="btn-primary" style={{ background: C.pink }} onClick={() => openModal('code')}><Plus size={16} /> Générer un code</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {codes.length === 0 ? (
          <EmptyState icon={QrCode} title="Aucun code généré" desc="Génère le premier code de pointage employé." action={<button className="btn-primary" style={{ background: C.pink }} onClick={() => openModal('code')}><Plus size={14} /> Générer un code</button>} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {codes.map((c: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.pink}15`, color: C.pink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{c.userName || c.name || 'Employé'}</div>
                  <div className="mono-font" style={{ fontSize: 12, color: C.inkSoft, letterSpacing: '0.1em' }}>{c.code || '••• •••'}</div>
                </div>
                <span className="pill" style={{ background: c.active ? C.emeraldSoft : C.redSoft, color: c.active ? C.emeraldDeep : C.red, fontWeight: 700 }}>{c.active ? 'Actif' : 'Révoqué'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 11: PARAMÈTRES ============
interface CheckinSettings {
  methods?: { code?: boolean; camera?: boolean; qr?: boolean; nfc?: boolean };
  schedule?: { morningStart: string; morningEnd: string; eveningStart: string; eveningEnd: string };
  faceTolerance?: number;
  minHoursBetween?: number;
  autoCheckoutHour?: string;
  notifyHostByWhatsApp?: boolean;
  notifyHostByEmail?: boolean;
  notifyHostByInApp?: boolean;
}

function ParametresPage() {
  const [settings, setSettings] = useState<CheckinSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.get<{ data: CheckinSettings }>('/reception/checkin-settings')
      .then(r => {
        const raw = r.data as unknown as Record<string, unknown>;
        const cfg = (raw?.data ?? raw) as CheckinSettings;
        setSettings(cfg ?? {});
      })
      .catch(() => toast.error('Impossible de charger les paramètres'))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof CheckinSettings>(key: K, value: CheckinSettings[K]) => {
    setSettings(s => ({ ...s, [key]: value }));
    setDirty(true);
  };
  const updateMethod = (key: 'code' | 'camera' | 'qr' | 'nfc', value: boolean) => {
    setSettings(s => ({ ...s, methods: { ...s.methods, [key]: value } }));
    setDirty(true);
  };
  const updateSchedule = (key: keyof Required<CheckinSettings>['schedule'], value: string) => {
    setSettings(s => ({
      ...s,
      schedule: {
        morningStart: '07:00', morningEnd: '10:00', eveningStart: '16:00', eveningEnd: '20:00',
        ...s.schedule,
        [key]: value,
      },
    }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/reception/checkin-settings', settings);
      setDirty(false);
      toast.success('Paramètres enregistrés');
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const methods = settings.methods ?? { code: true, camera: false, qr: false, nfc: false };
  const schedule = settings.schedule ?? { morningStart: '07:00', morningEnd: '10:00', eveningStart: '16:00', eveningEnd: '20:00' };

  return (
    <>
      <PageHeader title="Paramètres" italic="Réception"
        subtitle="Méthodes de pointage · Plages horaires · Notifications hôte"
        badge="CONFIG" gradient="cyan"
        actions={
          <button className="btn-primary"
            onClick={save}
            disabled={!dirty || saving}
            style={{ background: dirty ? C.greenDeep : 'rgba(255,250,240,0.2)', color: C.cream, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />}
            {saving ? 'Sauvegarde…' : dirty ? 'Enregistrer' : 'Tout est sauvegardé'}
          </button>
        }
      />
      <div style={{ padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && <div style={{ background: C.cream, borderRadius: 14, padding: 40, textAlign: 'center', color: C.inkSoft }}>Chargement…</div>}

        {!loading && (
          <>
            {/* ── Méthodes de pointage ──────────────────────────── */}
            <div style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>Méthodes de pointage</h3>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px' }}>Activez les méthodes que vos employés peuvent utiliser pour pointer.</p>
              {([
                { name: 'Code 6 chiffres', desc: 'Pointage rapide via numpad', icon: KeyRound, color: C.cyan,    key: 'code'   as const },
                { name: 'QR badge',       desc: 'Scan QR personnel',           icon: QrCode,   color: C.pink,    key: 'qr'     as const },
                { name: 'Reconnaissance faciale', desc: 'Caméra + matching IA', icon: Camera,   color: C.purple,  key: 'camera' as const },
                { name: 'NFC / RFID',     desc: 'Carte sans contact',          icon: Wifi,     color: C.gold,    key: 'nfc'    as const },
              ]).map(m => {
                const Ic = m.icon;
                const enabled = !!methods[m.key];
                return (
                  <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: `${m.color}15`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={18} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>{m.desc}</div>
                    </div>
                    <button onClick={() => updateMethod(m.key, !enabled)} style={{
                      width: 48, height: 26, borderRadius: 100, border: 'none', cursor: 'pointer',
                      background: enabled ? C.emerald : 'rgba(10,42,32,0.15)',
                      position: 'relative', transition: 'all 0.2s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, left: enabled ? 25 : 3,
                        width: 20, height: 20, borderRadius: '50%', background: C.cream,
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ── Plages horaires ──────────────────────────── */}
            <div style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>Plages de pointage</h3>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px' }}>Définissez les fenêtres horaires durant lesquelles les pointages sont acceptés.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {([
                  { label: 'Arrivée — début', key: 'morningStart' as const },
                  { label: 'Arrivée — fin',   key: 'morningEnd'   as const },
                  { label: 'Sortie — début',  key: 'eveningStart' as const },
                  { label: 'Sortie — fin',    key: 'eveningEnd'   as const },
                ]).map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>{f.label}</label>
                    <input type="time" value={schedule[f.key]} onChange={e => updateSchedule(f.key, e.target.value)} style={{
                      background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
                      borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 600, color: C.ink,
                      fontFamily: 'JetBrains Mono, monospace',
                    }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>Auto-checkout</label>
                  <input type="time" value={settings.autoCheckoutHour ?? '22:00'} onChange={e => update('autoCheckoutHour', e.target.value)} style={{
                    width: '100%',
                    background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
                    borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 600, color: C.ink,
                    fontFamily: 'JetBrains Mono, monospace', marginTop: 4,
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>Heures min entre pointages</label>
                  <input type="number" min={0} step={0.5} value={settings.minHoursBetween ?? 4} onChange={e => update('minHoursBetween', Number(e.target.value))} style={{
                    width: '100%',
                    background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
                    borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 600, color: C.ink,
                    fontFamily: 'JetBrains Mono, monospace', marginTop: 4,
                  }} />
                </div>
              </div>
            </div>

            {/* ── Reconnaissance faciale ──────────────────────────── */}
            <div style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>Tolérance reconnaissance faciale</h3>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px' }}>Distance Euclidienne maximale pour valider une reconnaissance. Plus bas = plus strict (recommandé 0.4-0.6).</p>
              <input type="range" min={0.3} max={0.8} step={0.05} value={settings.faceTolerance ?? 0.55} onChange={e => update('faceTolerance', Number(e.target.value))} style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
                <span>Strict (0.30)</span>
                <span className="mono-font" style={{ color: C.purple, fontWeight: 800 }}>{(settings.faceTolerance ?? 0.55).toFixed(2)}</span>
                <span>Permissif (0.80)</span>
              </div>
            </div>

            {/* ── Notifications hôte ──────────────────────────── */}
            <div style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>Notifications hôte (visiteurs)</h3>
              <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px' }}>Quand un visiteur arrive et demande un employé, par quels canaux le notifier ?</p>
              {([
                { label: 'In-app', desc: 'Notification dans Orlode + son', key: 'notifyHostByInApp' as const,    color: C.cyan },
                { label: 'Email',  desc: 'Email avec liens accept/patienter/refuser', key: 'notifyHostByEmail'  as const, color: C.gold },
                { label: 'WhatsApp', desc: 'Message WhatsApp (nécessite WhatsApp Business connecté)', key: 'notifyHostByWhatsApp' as const, color: C.emerald },
              ]).map(c => {
                const enabled = settings[c.key] !== false;
                return (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}15`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={16} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: C.inkSoft }}>{c.desc}</div>
                    </div>
                    <button onClick={() => update(c.key, !enabled)} style={{
                      width: 48, height: 26, borderRadius: 100, border: 'none', cursor: 'pointer',
                      background: enabled ? C.emerald : 'rgba(10,42,32,0.15)',
                      position: 'relative', transition: 'all 0.2s',
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, left: enabled ? 25 : 3,
                        width: 20, height: 20, borderRadius: '50%', background: C.cream,
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <style>{`.spin { animation: paramSpin 1s linear infinite; } @keyframes paramSpin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ============ PAGE 12: RAPPORTS ============
function RapportsPage({ data }: any) {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400_000);
  const [from, setFrom] = useState<string>(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(today.toISOString().slice(0, 10));
  const [busy, setBusy] = useState<string | null>(null);

  // Convert array of objects to CSV string with BOM for Excel
  const toCsv = (rows: Record<string, any>[]): string => {
    if (rows.length === 0) return '';
    const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    const escape = (v: any): string => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => escape(r[h])).join(';')),
    ];
    return '﻿' + lines.join('\n');
  };

  const downloadFile = (content: string, filename: string, mime = 'text/csv;charset=utf-8') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const inDateRange = (d: any): boolean => {
    if (!d) return false;
    const date = typeof d === 'string' ? new Date(d) : (d.toDate ? d.toDate() : new Date(d));
    return date >= new Date(from) && date <= new Date(`${to}T23:59:59`);
  };

  const exportPresence = async () => {
    setBusy('presence');
    try {
      const presence = (data?.presence || []) as any[];
      const filtered = presence.filter(p => inDateRange(p.date || p.checkInAt));
      const rows = filtered.map(p => ({
        Date: p.date || (p.checkInAt && new Date(p.checkInAt).toISOString().slice(0, 10)),
        Employé: p.employeeName || p.userName || '',
        Email: p.employeeEmail || '',
        Département: p.department || '',
        Arrivée: p.checkInAt ? new Date(p.checkInAt).toLocaleTimeString('fr-FR') : '',
        Départ: p.checkOutAt ? new Date(p.checkOutAt).toLocaleTimeString('fr-FR') : '',
        Heures: p.hoursWorked || '',
        Méthode: p.method || '',
        Statut: p.status || '',
      }));
      downloadFile(toCsv(rows), `presences_${from}_${to}.csv`);
      toast.success(`${rows.length} ligne(s) exportée(s)`);
    } catch { toast.error('Erreur lors de l\'export'); }
    finally { setBusy(null); }
  };

  const exportVisitors = async () => {
    setBusy('visitors');
    try {
      const visitors = (data?.visitors || []) as any[];
      const filtered = visitors.filter(v => inDateRange(v.createdAt || v.timestamp));
      const rows = filtered.map(v => ({
        Date: v.createdAt ? new Date(v.createdAt).toISOString().slice(0, 10) : '',
        Heure: v.createdAt ? new Date(v.createdAt).toLocaleTimeString('fr-FR') : '',
        Visiteur: v.name || '',
        Société: v.company || '',
        Téléphone: v.phone || '',
        Email: v.email || '',
        Hôte: v.host || '',
        Motif: v.purpose || '',
        Type: v.type || '',
        Badge: v.badgeNumber || '',
        Statut: v.status || '',
        Réponse_hôte: v.hostResponse || '',
      }));
      downloadFile(toCsv(rows), `visiteurs_${from}_${to}.csv`);
      toast.success(`${rows.length} ligne(s) exportée(s)`);
    } catch { toast.error('Erreur lors de l\'export'); }
    finally { setBusy(null); }
  };

  const exportAppointments = async () => {
    setBusy('appointments');
    try {
      const appts = (data?.appointments || []) as any[];
      const filtered = appts.filter(a => inDateRange(a.scheduledAt || a.createdAt));
      const rows = filtered.map(a => ({
        Date: a.scheduledAt ? new Date(a.scheduledAt).toISOString().slice(0, 10) : '',
        Heure: a.scheduledAt ? new Date(a.scheduledAt).toLocaleTimeString('fr-FR') : '',
        Visiteur: a.visitorName || a.title || '',
        Hôte: a.hostName || '',
        Statut: a.status || '',
        Notes: a.notes || '',
      }));
      downloadFile(toCsv(rows), `rdv_${from}_${to}.csv`);
      toast.success(`${rows.length} ligne(s) exportée(s)`);
    } catch { toast.error('Erreur lors de l\'export'); }
    finally { setBusy(null); }
  };

  const exportDeliveries = async () => {
    setBusy('deliveries');
    try {
      const list = (data?.deliveries || []) as any[];
      const filtered = list.filter(d => inDateRange(d.receivedAt || d.createdAt));
      const rows = filtered.map(d => ({
        Date: d.receivedAt ? new Date(d.receivedAt).toISOString().slice(0, 10) : '',
        Coursier: d.courierName || d.courier || '',
        Coursier_société: d.courierCompany || '',
        Destinataire: d.recipientName || d.recipient || '',
        Description: d.description || d.summary || '',
        Statut: d.status || '',
      }));
      downloadFile(toCsv(rows), `livraisons_${from}_${to}.csv`);
      toast.success(`${rows.length} ligne(s) exportée(s)`);
    } catch { toast.error('Erreur lors de l\'export'); }
    finally { setBusy(null); }
  };

  const reports = [
    { name: 'Présences', desc: 'Pointages · Heures travaillées · Méthode', icon: Clock,         color: C.emerald, key: 'presence',     run: exportPresence,   count: (data?.presence || []).length },
    { name: 'Visiteurs', desc: 'Liste exhaustive avec hôtes + réponses',   icon: Users,         color: C.cyan,    key: 'visitors',     run: exportVisitors,    count: (data?.visitors || []).length },
    { name: 'Rendez-vous', desc: 'Programmés · Honorés · No-shows',         icon: CalendarClock, color: C.gold,    key: 'appointments', run: exportAppointments, count: (data?.appointments || []).length },
    { name: 'Livraisons', desc: 'Colis reçus · Coursiers · Destinataires', icon: Package,       color: C.purple,  key: 'deliveries',   run: exportDeliveries,  count: (data?.deliveries || []).length },
  ];

  return (
    <>
      <PageHeader title="Rapports" italic="& exports"
        subtitle="CSV Excel-ready · Filtrés par période · UTF-8 BOM inclus"
        badge="ANALYTICS" gradient="cyan" />

      {/* Period filter */}
      <div style={{ padding: '24px 32px 0' }}>
        <div style={{ background: C.cream, borderRadius: 14, padding: 16, border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>PÉRIODE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: C.inkSoft }}>Du</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{
              background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
              borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: C.ink,
              fontFamily: 'JetBrains Mono, monospace',
            }} />
            <label style={{ fontSize: 12, color: C.inkSoft, marginLeft: 8 }}>au</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{
              background: C.creamDeep, border: '1.5px solid rgba(10,42,32,0.08)',
              borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: C.ink,
              fontFamily: 'JetBrains Mono, monospace',
            }} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => { const t = new Date(); setFrom(t.toISOString().slice(0, 10)); setTo(t.toISOString().slice(0, 10)); }} className="btn-secondary" style={{ fontSize: 11 }}>Aujourd'hui</button>
            <button onClick={() => { const t = new Date(); const w = new Date(t.getTime() - 7 * 86400_000); setFrom(w.toISOString().slice(0, 10)); setTo(t.toISOString().slice(0, 10)); }} className="btn-secondary" style={{ fontSize: 11 }}>7 jours</button>
            <button onClick={() => { const t = new Date(); const m = new Date(t.getTime() - 30 * 86400_000); setFrom(m.toISOString().slice(0, 10)); setTo(t.toISOString().slice(0, 10)); }} className="btn-secondary" style={{ fontSize: 11 }}>30 jours</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 32px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {reports.map(r => {
            const Ic = r.icon;
            const isBusy = busy === r.key;
            return (
              <div key={r.key} style={{ background: C.cream, borderRadius: 16, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${r.color}15`, color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={20} /></div>
                  <span className="pill mono-font" style={{ background: C.creamDeep, color: C.inkSoft, fontWeight: 700 }}>{r.count} entrée{r.count > 1 ? 's' : ''}</span>
                </div>
                <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 14, minHeight: 32 }}>{r.desc}</div>
                <button onClick={r.run} disabled={isBusy || r.count === 0} style={{
                  width: '100%',
                  background: r.count === 0 ? 'rgba(10,42,32,0.08)' : `linear-gradient(135deg, ${r.color}, ${r.color}cc)`,
                  color: r.count === 0 ? C.inkSoft : C.cream,
                  border: 'none', borderRadius: 10, padding: '10px',
                  fontSize: 12, fontWeight: 700, cursor: isBusy ? 'wait' : (r.count === 0 ? 'not-allowed' : 'pointer'),
                  fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: isBusy ? 0.6 : 1,
                }}>
                  {isBusy ? <RefreshCw size={12} className="spin" /> : <Download size={12} />}
                  {isBusy ? 'Export…' : `Exporter CSV (${r.count})`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ MAIN ============
export default function ReceptionRedesignPage() {
  const [activeTab, setActiveTab] = useState('Accueil');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const openModal = (id: string) => setActiveModal(id);
  const closeModal = () => setActiveModal(null);
  const data = useReceptionData();

  // Magic-link handler — when host clicks Accept/Wait/Decline in the email,
  // the URL has ?action=allow_entry&visitorId=XXX → call host-respond once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const visitorId = params.get('visitorId');
    if (action && visitorId && ['allow_entry', 'wait', 'decline'].includes(action)) {
      api.post(`/reception/visitors/${visitorId}/host-respond`, { action })
        .then(() => {
          toast.success(
            action === 'allow_entry' ? 'Visiteur autorisé à entrer' :
            action === 'wait' ? 'Demande d\'attendre envoyée' :
            'Visiteur refusé'
          );
        })
        .catch(() => toast.error('Lien invalide ou visiteur introuvable'));
      // Clean URL
      params.delete('action'); params.delete('visitorId');
      const next = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', next);
    }
  }, []);

  return (
    <Chrome>
      <TabSwitcher active={activeTab} setActive={setActiveTab} />
      {activeTab === 'Accueil' && <AccueilPage onTab={setActiveTab} openModal={openModal} data={data} />}
      {activeTab === 'Live Hub' && <LiveHubPage data={data} />}
      {activeTab === 'RDV & Visites' && <RDVVisitesPage openModal={openModal} data={data} />}
      {activeTab === 'Présence' && <PresencePage data={data} />}
      {activeTab === 'Visiteurs' && <VisiteursPage openModal={openModal} data={data} />}
      {activeTab === 'Livraisons' && <LivraisonsPage />}
      {activeTab === 'Annuaire' && <AnnuairePage data={data} />}
      {activeTab === 'Badges' && <BadgesPage openModal={openModal} data={data} />}
      {activeTab === 'Mode Kiosk' && <ModeKioskPage />}
      {activeTab === 'Codes' && <CodesPage openModal={openModal} data={data} />}
      {activeTab === 'Paramètres' && <ParametresPage data={data} />}
      {activeTab === 'Rapports' && <RapportsPage data={data} />}

      {activeModal === 'visitor' && <NewVisitorModal onClose={closeModal} />}
      {activeModal === 'badge' && <NewBadgeModal onClose={closeModal} />}
      {activeModal === 'appointment' && <NewAppointmentModal onClose={closeModal} />}
      {activeModal === 'code' && <NewCodeModal onClose={closeModal} />}

      <LiveSyncBadge lastSync={data?.lastSync} intervalMs={REFRESH_INTERVAL_MS} />

      <div style={{ position: 'fixed', bottom: 28, right: 100, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        <button onClick={() => openModal('badge')} title="Créer un badge" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.purple, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <Contact size={20} />
        </button>
        <button onClick={() => openModal('appointment')} title="Nouveau RDV" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.gold, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <CalendarClock size={20} />
        </button>
        <button onClick={() => openModal('visitor')} title="Nouveau visiteur" style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.cyan} 0%, ${C.cyanDeep} 100%)`, border: 'none', color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px -8px ${C.cyan}` }}>
          <UserPlus size={24} />
        </button>
      </div>

      <AgentDrawer
        agentId="reception"
        agentName="Réception"
        color={C.cyan}
        context={{
          tab: activeTab,
          visitors: data.visitors?.length ?? 0,
          appointments: data.appointments?.length ?? 0,
          presence: data.presence?.length ?? 0,
        }}
        starters={[
          'Qui est en ce moment dans le bâtiment ?',
          'Liste les RDV de cet après-midi',
          'Génère un message de bienvenue pour un visiteur VIP',
        ]}
      />
    </Chrome>
  );
}
