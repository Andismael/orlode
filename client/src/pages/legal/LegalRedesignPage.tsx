import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import AgentDrawer from '@/components/ai/AgentDrawer';
import { toast } from '@/components/common/Toast';
import {
  Search, Bell, ChevronDown, ChevronRight, ArrowRight, ArrowUpRight,
  LayoutDashboard, MessageSquare, Bot, UsersRound, Briefcase,
  Plus, Filter, MoreHorizontal, Sparkles, X, Inbox,
  CheckCircle2, XCircle, AlertTriangle, AlertOctagon, Clock, Timer, TrendingUp, TrendingDown,
  FileText, FileSignature, FileCheck2, Folder, FolderOpen, Archive,
  Eye, Lock, Award, Stamp, Building2, Globe, Users2, BarChart3, Activity, Target,
  Edit3, Trash2, Save, Download, Upload, Printer, Share2, ExternalLink, PenTool,
  Layers, LayoutTemplate, ListChecks, Tag, Heart, Lightbulb, Star,
  Banknote, Receipt, Brain, Scale, BookOpen, Shield, ShieldCheck, ShieldAlert,
  LayoutGrid, List as ListIcon, Calendar
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  slate: '#334155', slateDeep: '#1E293B', slateDark: '#0F172A', slateSoft: '#F1F5F9', slateMid: '#64748B',
  wine: '#7F1D1D', wineDeep: '#450A0A', wineSoft: '#FEE2E2', wineMid: '#991B1B',
  gold: '#B45309', goldDeep: '#92400E', goldLight: '#D97706', goldSoft: '#FEF3C7', goldPale: '#FDE68A',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#DC2626', redSoft: '#FEE2E2',
  yellow: '#F59E0B', yellowSoft: '#FEF3C7',
  pink: '#EC4899', pinkSoft: '#FCE7F3',
  cyan: '#06B6D4', cyanSoft: '#CFFAFE',
  violet: '#7C3AED', violetSoft: '#EDE9FE',
  orange: '#F97316', orangeSoft: '#FFEDD5',
  ink: '#0A2A20', inkSoft: '#5A6B62', inkLight: '#94A3A0',
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
  .tab-btn.active { background: ${C.gold}; color: ${C.cream}; box-shadow: 0 4px 14px -4px ${C.gold}; }
  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.gold}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.gold}; opacity: 0.4; animation: pulse 1.8s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  .row-card { background: ${C.cream}; border-radius: 16px; padding: 18px 20px; border: 1px solid rgba(10,42,32,0.06); transition: all 0.2s ease; cursor: pointer; display: flex; align-items: center; gap: 16px; }
  .row-card:hover { transform: translateX(4px); border-color: ${C.gold}; box-shadow: 0 12px 24px -12px ${C.gold}40; }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.slateSoft}; color: ${C.slateDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.slateDeep}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.wineSoft}; color: ${C.wine}; }
  .icon-btn.gold { background: ${C.goldSoft}; color: ${C.goldDeep}; }
  .icon-btn.gold:hover { background: ${C.gold}; color: ${C.cream}; }
  .btn-primary { background: linear-gradient(135deg, ${C.slateDeep} 0%, ${C.slateDark} 100%); color: ${C.cream}; border: none; padding: 12px 22px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px ${C.slateDeep}; font-family: inherit; border-bottom: 2px solid ${C.gold}; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -8px ${C.slateDeep}; }
  .btn-gold { background: linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 100%); color: ${C.cream}; border: none; padding: 12px 22px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px ${C.gold}; font-family: inherit; }
  .btn-gold:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -8px ${C.gold}; }
  .btn-secondary { background: ${C.cream}; color: ${C.slateDeep}; border: 1.5px solid rgba(10,42,32,0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.slateDeep}; color: ${C.cream}; border-color: ${C.slateDeep}; }
  .progress-bar { height: 6px; border-radius: 3px; background: ${C.slateSoft}; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; } .stagger > *:nth-child(2) { animation-delay: 0.1s; } .stagger > *:nth-child(3) { animation-delay: 0.15s; } .stagger > *:nth-child(4) { animation-delay: 0.2s; } .stagger > *:nth-child(5) { animation-delay: 0.25s; } .stagger > *:nth-child(6) { animation-delay: 0.3s; }
  @keyframes sealStamp { 0% { transform: scale(2) rotate(-15deg); opacity: 0; } 60% { transform: scale(0.95) rotate(-5deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
  .seal-stamp { animation: sealStamp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } .responsive-charts { grid-template-columns: 1fr !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .hero-title { font-size: 32px !important; } .hide-on-mobile { display: none !important; } }
  @media (max-width: 480px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .hero-title { font-size: 26px !important; } }
  .modal-overlay { position: fixed; inset: 0; background: rgba(10, 42, 32, 0.7); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-content { background: ${C.cream}; border-radius: 24px; width: 100%; max-width: 720px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.5); animation: modalSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-bottom: 3px solid ${C.gold}; }
  @keyframes modalSlide { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .form-input { width: 100%; background: ${C.cream}; border: 1.5px solid rgba(10,42,32,0.1); border-radius: 10px; padding: 11px 14px; font-size: 14px; color: ${C.ink}; font-family: inherit; outline: none; transition: all 0.2s ease; }
  .form-input:focus { border-color: ${C.gold}; box-shadow: 0 0 0 3px ${C.gold}25; }
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

function useLegalData() {
  const [data, setData] = useState<any>({
    contracts: [], templates: [], deadlines: [], stats: null,
    archived: [], compliance: null, loaded: false, lastSync: null,
  });
  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/contracts'),
    safeGet('/contracts/templates'),
    safeGet('/legal/deadlines'),
    safeGet('/legal/stats'),
    safeGet('/contracts/archived'),
    safeGet('/legal/compliance'),
  ]).then(([c, t, d, s, a, comp]) => {
    if (!mountedRef.current) return;
    setData({
      contracts: c?.contracts ?? c ?? [],
      templates: t?.templates ?? t ?? [],
      deadlines: d?.deadlines ?? d ?? [],
      stats: s ?? null,
      archived: a?.contracts ?? a ?? [],
      compliance: comp ?? null,
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

function LiveSyncBadge({ lastSync }: any) {
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
    <div style={{ position: 'fixed', bottom: 28, left: 28, zIndex: 50, background: 'rgba(10, 42, 32, 0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${C.gold}40`, padding: '8px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 8, color: C.cream, fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)' }}>
      <span className="live-dot"></span>
      <span style={{ color: C.goldPale }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>sync · {secondsAgo}s · refresh 10s</span>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title = 'Pas encore de données', desc = '', action = null }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: '48px 32px', border: '1px dashed rgba(10,42,32,0.15)', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: C.goldSoft, color: C.goldDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
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
      <div className="grain" style={{ background: `linear-gradient(135deg, ${C.slateDeep} 0%, ${C.slate} 50%, ${C.slateDark} 100%)`, borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden', color: C.cream, boxShadow: `0 30px 60px -20px ${C.slateDeep}`, borderBottom: `3px solid ${C.gold}` }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.12 }} width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="120" stroke={C.gold} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="80" stroke={C.gold} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="40" stroke={C.gold} strokeWidth="2" fill="none" />
        </svg>
        <svg style={{ position: 'absolute', right: 80, bottom: -20, opacity: 0.15 }} width="160" height="180" viewBox="0 0 100 110" fill={C.gold}>
          <line x1="50" y1="10" x2="50" y2="100" stroke={C.gold} strokeWidth="3"/>
          <line x1="20" y1="30" x2="80" y2="30" stroke={C.gold} strokeWidth="3"/>
          <line x1="20" y1="30" x2="20" y2="55" stroke={C.gold} strokeWidth="2"/>
          <line x1="80" y1="30" x2="80" y2="55" stroke={C.gold} strokeWidth="2"/>
          <ellipse cx="20" cy="60" rx="14" ry="6" fill={C.gold}/>
          <ellipse cx="80" cy="60" rx="14" ry="6" fill={C.gold}/>
          <rect x="40" y="100" width="20" height="6" fill={C.gold}/>
          <circle cx="50" cy="10" r="4" fill={C.gold}/>
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              {leftPills}
              {badge && (<div className="pill" style={{ background: C.gold, color: C.cream }}><Scale size={11} />{badge}</div>)}
            </div>
            <h1 className="display-font hero-title" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.cream, letterSpacing: '-0.03em' }}>
              {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold }}>{italic}</em>}
            </h1>
            {subtitle && <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(255,250,240,0.85)', maxWidth: 600 }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      </div>
    </div>
  );
}

function TabSwitcher({ active, setActive }: any) {
  const tabGroups = [
    { label: 'PILOTAGE', tabs: ['Accueil', 'Dashboard', 'Échéances'] },
    { label: 'CONTRATS', tabs: ['Tous les contrats', 'Signatures', 'Modèles'] },
    { label: 'CONFORMITÉ', tabs: ['RGPD', 'OHADA', 'Audits IA'] },
    { label: 'DOCS', tabs: ['Archives'] },
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

function ModalShell({ title, subtitle, icon: Icon, color = C.gold, onClose, children, footer, size = 'md' }: any) {
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
function NewContractModal({ onClose }: any) {
  const [type, setType] = useState('Prestation services');
  const [reference, setReference] = useState('');
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!title.trim() || !counterparty.trim()) { toast.error('Titre et partie requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/legal/contracts', {
        type, reference, title, counterparty,
        amount: amount ? Number(amount) : null,
        startDate, endDate,
      });
      toast.success('Contrat créé', 'L\'IA génère les clauses adaptées à votre juridiction en arrière-plan.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de créer le contrat.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouveau contrat" subtitle="Rédaction assistée par IA · Modèles multi-juridictions" icon={Scale} color={C.gold} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" disabled={submitting} onClick={submit}><Save size={14} /> {submitting ? 'Création…' : 'Créer'}</button></>}>
      <div className="form-row">
        <div><label className="form-label">Type</label>
          <select className="form-input" value={type} onChange={e => setType(e.target.value)}><option>Prestation services</option><option>CDI</option><option>CDD</option><option>NDA</option><option>Bail commercial</option><option>Partenariat</option></select>
        </div>
        <div><label className="form-label">Référence</label><input className="form-input" placeholder="CTR-2026-XXX" value={reference} onChange={e => setReference(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 14 }}><label className="form-label">Titre</label><input className="form-input" placeholder="Ex: Prestation IT pour Beta SARL" value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Client / Partie</label><input className="form-input" placeholder="Nom de la partie" value={counterparty} onChange={e => setCounterparty(e.target.value)} /></div>
        <div><label className="form-label">Montant (FCFA)</label><input className="form-input" type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Date de début</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div><label className="form-label">Date de fin</label><input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 14, padding: 12, background: C.goldSoft, borderRadius: 10, fontSize: 12, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Brain size={14} color={C.gold} /> L'IA générera automatiquement les clauses standard adaptées à votre juridiction
      </div>
    </ModalShell>
  );
}

function AnalyzeContractModal({ onClose }: any) {
  const [contractText, setContractText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!contractText.trim()) { toast.error('Colle le texte du contrat à analyser'); return; }
    setSubmitting(true);
    try {
      await api.post('/legal/risk-check', { text: contractText });
      toast.success('Analyse lancée', 'Résultats disponibles dans les Audits IA.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible d\'analyser.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Analyse IA d'un contrat" subtitle="Claude 4.7 + jurisprudence multi-juridictions" icon={Brain} color={C.pink} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" disabled={submitting} onClick={submit}><Brain size={14} /> {submitting ? 'Analyse…' : 'Analyser'}</button></>}>
      <div style={{ background: `linear-gradient(135deg, ${C.pinkSoft}, ${C.cream})`, border: `2px dashed ${C.pink}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>Colle le texte du contrat ci-dessous (l'upload de fichier arrive bientôt) :</div>
        <textarea className="form-input" rows={8} placeholder="Article 1 — Objet du contrat…" value={contractText} onChange={e => setContractText(e.target.value)} style={{ background: '#fff' }}></textarea>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Type d'analyse</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {['Conformité juridique', 'Clauses à risque', 'Comparaison standard', 'Synthèse exécutive'].map(opt => (
            <label key={opt} style={{ background: C.cream, border: '1.5px solid rgba(10,42,32,0.1)', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: C.pink }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

// ============ ACCUEIL ============
function AccueilPage({ onTab, openModal, data }: any) {
  const stats = [
    { label: 'Contrats actifs', value: ((data?.contracts || []).filter((c: any) => c.status === 'active').length || 0).toString(), sub: 'En cours d\'exécution', color: C.slateDeep, bg: C.slateSoft, icon: FileSignature },
    { label: 'En attente signature', value: ((data?.contracts || []).filter((c: any) => c.status === 'pending').length || 0).toString(), sub: 'À signer', color: C.gold, bg: C.goldSoft, icon: PenTool },
    { label: 'Score conformité', value: data?.compliance?.ohadaScore ? `${data.compliance.ohadaScore}%` : '—', sub: 'Multi-juridictions', color: C.emeraldDeep, bg: C.emeraldSoft, icon: ShieldCheck },
    { label: 'Échéances proches', value: ((data?.deadlines || []).length || 0).toString(), sub: 'Dans 30 jours', color: C.wine, bg: C.wineSoft, icon: AlertOctagon },
  ];
  const modules = [
    { name: 'Dashboard', desc: 'KPIs · échéances · conformité', icon: LayoutDashboard, color: C.slateDeep, page: 'Dashboard' },
    { name: 'Tous les contrats', desc: `${(data?.contracts || []).length} contrats`, icon: FileText, color: C.gold, page: 'Tous les contrats' },
    { name: 'Signatures', desc: 'WEMAS intégré', icon: PenTool, color: C.wine, page: 'Signatures' },
    { name: 'Modèles', desc: `${(data?.templates || []).length} templates`, icon: LayoutTemplate, color: C.violet, page: 'Modèles' },
    { name: 'RGPD', desc: 'Conformité données', icon: Shield, color: C.blue, page: 'RGPD' },
    { name: 'OHADA', desc: 'Acte uniforme · multi-pays', icon: Scale, color: C.emerald, page: 'OHADA', star: true },
    { name: 'Audits IA', desc: 'Analyse Claude 4.7', icon: Brain, color: C.pink, page: 'Audits IA' },
    { name: 'Archives', desc: `${(data?.archived || []).length} archivés`, icon: Archive, color: C.slate, page: 'Archives' },
  ];
  return (
    <>
      <PageHeader title="Juridique," italic="le sceau de la rigueur."
        subtitle="Contrats · Conformité multi-juridictions (OHADA, RGPD…) · Signatures · Analyse IA"
        badge="STRATÉGIE"
        actions={<>
          <button className="btn-secondary" onClick={() => openModal('analyze')}><Brain size={14} /> Analyser un contrat</button>
          <button className="btn-gold" onClick={() => openModal('newContract')}><Scale size={16} /> Rédiger un contrat</button>
        </>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>

      <div style={{ padding: '32px 32px 0' }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px' }}>
          Modules <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.gold, fontSize: 18 }}>— 8 outils</em>
        </h3>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {modules.map((mod: any, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} onClick={() => onTab(mod.page)} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease', position: 'relative' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${mod.color}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {mod.star && (
                  <div style={{ position: 'absolute', top: 14, right: 14, background: `linear-gradient(135deg, ${C.gold}, ${C.goldDeep})`, color: C.cream, padding: '3px 8px', borderRadius: 100, fontSize: 9, fontWeight: 700, boxShadow: `0 4px 12px -4px ${C.gold}` }}>
                    <Star size={9} fill={C.cream} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} /> RECOMMANDÉ
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

// ============ TOUS LES CONTRATS ============
function ContratsPage({ openModal, contracts = [] }: any) {
  const [filter, setFilter] = useState('Tous');
  const [view, setView] = useState('list');
  const filtered = filter === 'Tous' ? contracts : contracts.filter((c: any) => c.status === filter.toLowerCase());

  const statusStyles: any = {
    active: { bg: C.emeraldSoft, color: C.emeraldDeep, label: 'Actif', icon: CheckCircle2 },
    pending: { bg: C.goldSoft, color: C.goldDeep, label: 'En attente', icon: Clock },
    expiring: { bg: C.wineSoft, color: C.wine, label: 'Expire bientôt', icon: AlertTriangle },
    expired: { bg: C.slateSoft, color: C.slateMid, label: 'Expiré', icon: XCircle },
  };

  return (
    <>
      <PageHeader title="Tous les contrats," italic="portefeuille."
        subtitle="Filtres avancés · Recherche · Export CSV/PDF"
        leftPills={<div className="pill" style={{ background: C.gold, color: C.cream }}><FileText size={11} /> {contracts.length} CONTRATS</div>}
        actions={<button className="btn-gold" onClick={() => openModal('newContract')}><Plus size={16} /> Nouveau contrat</button>} />

      <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'inline-flex', gap: 4, background: C.cream, padding: 4, borderRadius: 12, border: '1px solid rgba(10,42,32,0.06)' }}>
          {['Tous', 'Active', 'Pending', 'Expiring', 'Archived'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 8, background: filter === f ? C.slateDeep : 'transparent', color: filter === f ? C.cream : C.inkSoft, border: 'none', fontFamily: 'inherit' }}>{f === 'Tous' ? 'Tous' : f === 'Active' ? 'Actifs' : f === 'Pending' ? 'En attente' : f === 'Expiring' ? 'Expirent' : 'Archivés'}</button>
          ))}
        </div>
        <ViewToggle view={view} setView={setView} />
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title={contracts.length === 0 ? 'Aucun contrat' : 'Aucun contrat dans cette catégorie'} desc="Créez votre premier contrat — l'IA générera les clauses standard adaptées à votre juridiction." action={<button className="btn-gold" onClick={() => openModal('newContract')}><Plus size={14} /> Nouveau contrat</button>} />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {filtered.map((c: any, i: number) => {
              const status = statusStyles[c.status] || statusStyles.active;
              const StatusIcon = status.icon;
              return (
                <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', borderTop: `3px solid ${C.gold}`, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.slateDeep, background: C.slateSoft, padding: '3px 8px', borderRadius: 6 }}>{c.ref || `CTR-${i+1}`}</div>
                    <div className="pill" style={{ background: status.bg, color: status.color, fontWeight: 700 }}><StatusIcon size={11} /> {status.label}</div>
                  </div>
                  <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{c.name || c.title}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>{c.client || c.party || '—'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                    <span className="mono-font" style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>{c.amount || '—'}</span>
                    <span style={{ fontSize: 11, color: C.inkSoft }}>{c.expires || c.endDate || '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((c: any, i: number) => {
              const status = statusStyles[c.status] || statusStyles.active;
              const StatusIcon = status.icon;
              return (
                <div key={i} className="row-card">
                  <div className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.slateDeep, background: C.slateSoft, padding: '4px 10px', borderRadius: 6, flexShrink: 0 }}>{c.ref || `CTR-${i+1}`}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{c.name || c.title}</div>
                    <div style={{ fontSize: 11, color: C.inkSoft }}>{c.client || c.party || '—'} · {c.type || 'Contrat'}</div>
                  </div>
                  <div className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{c.amount || '—'}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{c.expires || c.endDate || '—'}</div>
                  <div className="pill" style={{ background: status.bg, color: status.color, fontWeight: 700 }}><StatusIcon size={11} /> {status.label}</div>
                  <button className="icon-btn"><Eye size={13} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ============ MODÈLES ============
function ModelesPage({ openModal, templates = [] }: any) {
  return (
    <>
      <PageHeader title="Modèles" italic="contractuels"
        subtitle="Templates pré-rédigés · Multi-juridictions · Adaptables"
        actions={<button className="btn-gold"><Plus size={16} /> Nouveau modèle</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {templates.length === 0 ? (
          <EmptyState icon={LayoutTemplate} title="Aucun modèle" desc="Importez vos modèles ou utilisez la bibliothèque légale standard." />
        ) : (
          <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {templates.map((t: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', borderTop: `3px solid ${C.gold}`, cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: C.goldSoft, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <FileText size={18} />
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{t.name || t.title}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{t.description || t.type || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ SIMPLE PAGES ============
function DashboardPage({ data }: any) {
  return (
    <>
      <PageHeader title="Dashboard," italic="vue d'ensemble" subtitle="KPIs · Distribution contrats · Conformité · Tendances 12 mois"
        leftPills={<div className="pill" style={{ background: C.gold, color: C.cream }}><BarChart3 size={11} /> {(data?.contracts || []).length} ACTIFS</div>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={BarChart3} title="Dashboard détaillé en construction" desc="Les graphiques de distribution, ROI et conformité multi-juridictions apparaîtront ici." />
      </div>
    </>
  );
}

function EcheancesPage({ deadlines = [] }: any) {
  return (
    <>
      <PageHeader title="Échéances" italic="à venir" subtitle="Renouvellements · Résiliations · Alertes RGPD" />
      <div style={{ padding: '24px 32px 32px' }}>
        {deadlines.length === 0 ? (
          <EmptyState icon={Calendar} title="Aucune échéance proche" desc="Les contrats arrivant à échéance dans 30 jours apparaîtront ici." />
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deadlines.map((d: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 40, height: 40, borderRadius: 11, background: C.wineSoft, color: C.wine, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{d.title || d.name}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>{d.date || d.dueDate}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SignaturesPage() {
  return (
    <>
      <PageHeader title="Signatures" italic="électroniques" subtitle="WEMAS · Workflow · Tracking"
        actions={<button className="btn-gold"><PenTool size={16} /> Faire signer</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={PenTool} title="Workflow de signatures" desc="Les contrats en attente de signature apparaîtront ici avec le statut WEMAS en temps réel." />
      </div>
    </>
  );
}

function CompliancePage({ jurisdiction }: any) {
  const labels: any = { rgpd: { name: 'RGPD', color: C.blue, icon: Shield, desc: 'Protection des données personnelles' }, ohada: { name: 'OHADA', color: C.emerald, icon: Scale, desc: 'Acte uniforme · 17 pays africains' } };
  const j = labels[jurisdiction] || labels.rgpd;
  const Ic = j.icon;
  return (
    <>
      <PageHeader title={j.name} italic="conformité" subtitle={j.desc}
        actions={<button className="btn-gold"><ShieldCheck size={16} /> Audit complet</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={Ic} title={`Audit ${j.name} non encore effectué`} desc={`Lance un audit IA pour vérifier la conformité ${j.name} de tes contrats actuels.`} />
      </div>
    </>
  );
}

function AuditsIAPage({ openModal }: any) {
  return (
    <>
      <PageHeader title="Audits" italic="IA" subtitle="Analyse Claude 4.7 · Détection clauses à risque · Comparaison standards juridiques"
        actions={<button className="btn-gold" onClick={() => openModal('analyze')}><Brain size={16} /> Nouvelle analyse</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={Brain} title="Aucun audit IA effectué" desc="Lancez votre premier audit pour faire analyser un contrat par l'IA — détection de clauses à risque, comparaison aux standards, synthèse exécutive." action={<button className="btn-gold" onClick={() => openModal('analyze')}><Brain size={14} /> Analyser un contrat</button>} />
      </div>
    </>
  );
}

function ArchivesPage({ archived = [] }: any) {
  return (
    <>
      <PageHeader title="Archives," italic="historique" subtitle={`${archived.length} contrats archivés · Rétention 3 ans · Recherche full-text`} />
      <div style={{ padding: '24px 32px 32px' }}>
        {archived.length === 0 ? (
          <EmptyState icon={Archive} title="Archives vides" desc="Les contrats clôturés ou résiliés seront archivés automatiquement ici." />
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archived.map((a: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 40, height: 40, borderRadius: 11, background: C.slateSoft, color: C.slate, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Archive size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{a.name || a.title}</div>
                  <div style={{ fontSize: 11, color: C.inkSoft }}>Archivé : {a.archivedAt || '—'}</div>
                </div>
                <button className="icon-btn"><Eye size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ MAIN ============
export default function LegalRedesignPage() {
  const [activeTab, setActiveTab] = useState('Accueil');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const openModal = (id: string) => setActiveModal(id);
  const closeModal = () => setActiveModal(null);
  const data = useLegalData();

  return (
    <Chrome>
      <TabSwitcher active={activeTab} setActive={setActiveTab} />
      {activeTab === 'Accueil' && <AccueilPage onTab={setActiveTab} openModal={openModal} data={data} />}
      {activeTab === 'Dashboard' && <DashboardPage data={data} />}
      {activeTab === 'Échéances' && <EcheancesPage deadlines={data.deadlines} />}
      {activeTab === 'Tous les contrats' && <ContratsPage openModal={openModal} contracts={data.contracts} />}
      {activeTab === 'Signatures' && <SignaturesPage />}
      {activeTab === 'Modèles' && <ModelesPage openModal={openModal} templates={data.templates} />}
      {activeTab === 'RGPD' && <CompliancePage jurisdiction="rgpd" />}
      {activeTab === 'OHADA' && <CompliancePage jurisdiction="ohada" />}
      {activeTab === 'Audits IA' && <AuditsIAPage openModal={openModal} />}
      {activeTab === 'Archives' && <ArchivesPage archived={data.archived} />}

      {activeModal === 'newContract' && <NewContractModal onClose={closeModal} />}
      {activeModal === 'analyze' && <AnalyzeContractModal onClose={closeModal} />}

      <LiveSyncBadge lastSync={data?.lastSync} />

      <div style={{ position: 'fixed', bottom: 28, right: 100, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        <button onClick={() => openModal('analyze')} title="Analyser IA" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.pink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <Brain size={20} />
        </button>
        <button onClick={() => openModal('newContract')} title="Nouveau contrat" style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDeep} 100%)`, border: 'none', color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px -8px ${C.gold}` }}>
          <Scale size={24} />
        </button>
      </div>

      <AgentDrawer
        agentId="legal"
        agentName="Juridique"
        color={C.gold}
        context={{
          tab: activeTab,
          contracts: data.contracts?.length ?? 0,
          deadlines: data.deadlines?.length ?? 0,
          templates: data.templates?.length ?? 0,
        }}
        starters={[
          'Quelles échéances arrivent dans les 30 prochains jours ?',
          'Analyse les risques juridiques de mon dernier contrat',
          'Génère une clause de confidentialité standard',
        ]}
      />
    </Chrome>
  );
}
