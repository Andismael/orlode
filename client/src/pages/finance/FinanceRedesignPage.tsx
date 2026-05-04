import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import AgentDrawer from '@/components/ai/AgentDrawer';
import { toast } from '@/components/common/Toast';
import { useAuthStore } from '@/store/authStore';
import {
  Search, Bell, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownRight,
  LayoutDashboard, MessageSquare, Bot, UsersRound, Briefcase,
  Calendar, Store, Crown, Hammer, Plug, Settings, Shield, LogOut, X,
  Plus, Filter, MoreHorizontal, Sparkles, TrendingUp, TrendingDown,
  CheckCircle2, Clock, AlertTriangle, FileText, Send, Eye, Trash2, Edit3,
  Banknote, Wallet, CircleDollarSign, Receipt, FileSignature, Wand2,
  Download, Upload, Copy, Inbox,
  Coffee, Plane, MapPin, Mail, Phone,
  PieChart, BarChart3, LineChart, Activity, RefreshCw, Link2, Network,
  Zap, Star, Heart, Award, Target,
  DollarSign, Euro,
  Repeat,
  Building2, CreditCard, ShieldCheck, ShieldAlert,
  Globe, Calculator, Percent, Scale,
  CalendarClock, CalendarDays, ListChecks, Gift, Users,
  Smartphone, LayoutGrid, List as ListIcon
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E', greenMid: '#0F6B52', greenSoft: '#E8F5EE',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  emerald: '#10B981', emeraldDeep: '#059669', emeraldSoft: '#D1FAE5', emeraldMid: '#6EE7B7',
  gold: '#D4A017', goldSoft: '#FEF3C7',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#EF4444', redSoft: '#FEE2E2',
  yellow: '#F59E0B', yellowSoft: '#FEF3C7',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  pink: '#EC4899', pinkSoft: '#FCE7F3',
  teal: '#14B8A6', tealSoft: '#CCFBF1',
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
  .tab-btn.active { background: ${C.emerald}; color: ${C.cream}; box-shadow: 0 4px 14px -4px rgba(16, 185, 129, 0.5); }
  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.emerald}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.emerald}; opacity: 0.4; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  .row-card { background: ${C.cream}; border-radius: 16px; padding: 18px 20px; border: 1px solid rgba(10,42,32,0.06); transition: all 0.2s ease; cursor: pointer; display: flex; align-items: center; gap: 16px; }
  .row-card:hover { transform: translateX(4px); border-color: ${C.emerald}; box-shadow: 0 12px 24px -12px rgba(16, 185, 129, 0.25); }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.emeraldSoft}; color: ${C.emeraldDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.emerald}; color: ${C.cream}; }
  .btn-primary { background: ${C.emerald}; color: ${C.cream}; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px rgba(16, 185, 129, 0.5); font-family: inherit; }
  .btn-primary:hover { background: ${C.emeraldDeep}; transform: translateY(-2px); }
  .btn-secondary { background: ${C.cream}; color: ${C.greenDeep}; border: 1px solid rgba(10,42,32,0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }
  .avatar { border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 700; color: ${C.cream}; flex-shrink: 0; }
  .progress-bar { height: 6px; border-radius: 3px; background: rgba(10,42,32,0.08); overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; } .stagger > *:nth-child(2) { animation-delay: 0.1s; } .stagger > *:nth-child(3) { animation-delay: 0.15s; } .stagger > *:nth-child(4) { animation-delay: 0.2s; } .stagger > *:nth-child(5) { animation-delay: 0.25s; } .stagger > *:nth-child(6) { animation-delay: 0.3s; }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-charts { grid-template-columns: 1fr !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .hero-title { font-size: 32px !important; } .hide-on-mobile { display: none !important; } }
  @media (max-width: 480px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .hero-title { font-size: 26px !important; } }
  .modal-overlay { position: fixed; inset: 0; background: rgba(10, 42, 32, 0.7); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-content { background: ${C.cream}; border-radius: 24px; width: 100%; max-width: 720px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.5); animation: modalSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  @keyframes modalSlide { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .form-input { width: 100%; background: ${C.cream}; border: 1.5px solid rgba(10,42,32,0.1); border-radius: 10px; padding: 11px 14px; font-size: 14px; color: ${C.ink}; font-family: inherit; outline: none; transition: all 0.2s ease; }
  .form-input:focus { border-color: ${C.emerald}; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }
  .form-label { display: block; font-size: 11px; font-weight: 700; color: ${C.ink}; letter-spacing: 0.05em; margin-bottom: 6px; text-transform: uppercase; }
  .form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
`;

// ============ SHELL (no Chrome — corpmind layout already provides it) ============
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

// ============ DATA ============
function safeGet(url: string) {
  return api.get(url).then((r: any) => r?.data ?? null).catch(() => null);
}

const REFRESH_INTERVAL_MS = 10000;

function useFinanceData() {
  const [data, setData] = useState<any>({
    invoices: [], expenses: [], payments: [],
    budget: null, dashboard: null, cashflow: null, cashflowForecast: null,
    profitLoss: null, vatReport: null, aging: [], recurring: [],
    expenseAnalytics: null, clientRisk: [], loaded: false,
    lastSync: null,
  });

  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/finance/invoices'),
    safeGet('/finance/expenses'),
    safeGet('/finance/payments'),
    safeGet('/finance/budget'),
    safeGet('/finance/dashboard'),
    safeGet('/finance/cashflow'),
    safeGet('/finance/cashflow/forecast'),
    safeGet('/finance/profit-loss'),
    safeGet('/finance/vat-report'),
    safeGet('/finance/aging'),
    safeGet('/finance/recurring'),
    safeGet('/finance/expense-analytics'),
    safeGet('/finance/client-risk'),
  ]).then(([inv, exp, pay, bud, dash, cf, cff, pl, vat, ag, rec, ea, cr]) => {
    if (!mountedRef.current) return;
    setData({
      invoices: inv?.invoices ?? inv ?? [],
      expenses: exp?.expenses ?? exp ?? [],
      payments: pay?.payments ?? pay ?? [],
      budget: bud ?? null,
      dashboard: dash ?? null,
      cashflow: cf ?? null,
      cashflowForecast: cff ?? null,
      profitLoss: pl ?? null,
      vatReport: vat ?? null,
      aging: ag?.aging ?? ag ?? [],
      recurring: rec?.recurring ?? rec ?? [],
      expenseAnalytics: ea ?? null,
      clientRisk: cr?.clients ?? cr ?? [],
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

const fmtFCFA = (n: number) => new Intl.NumberFormat('fr-FR').format(n || 0);

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
      border: `1px solid ${C.emerald}40`,
      padding: '8px 14px', borderRadius: 100,
      display: 'flex', alignItems: 'center', gap: 8,
      color: C.cream, fontSize: 12, fontWeight: 600,
      fontFamily: "'Inter', sans-serif",
      boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
    }}>
      <span className="live-dot"></span>
      <span style={{ color: C.emeraldMid }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
        sync · {secondsAgo}s · refresh {intervalMs / 1000}s
      </span>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title = 'Pas encore de données', desc = 'Les informations s\'afficheront ici dès que disponibles.', action = null }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: '48px 32px', border: '1px dashed rgba(10,42,32,0.15)', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: C.emeraldSoft, color: C.emeraldDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h4 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: '0 0 6px' }}>{title}</h4>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: '0 0 16px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>{desc}</p>
      {action}
    </div>
  );
}

// ============ HEADER + TABS ============
function PageHeader({ title, italic, subtitle, badge, actions, gradient = 'emerald' }: any) {
  const gradientStyle = gradient === 'green'
    ? `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.greenMid} 100%)`
    : `linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDeep} 100%)`;
  const shadow = gradient === 'green' ? 'rgba(10, 79, 60, 0.4)' : 'rgba(16, 185, 129, 0.4)';
  const accent = gradient === 'green' ? C.emeraldMid : C.greenDeep;
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
            {badge && (<div style={{ marginBottom: 14 }}><div className="pill" style={{ background: accent, color: C.cream }}><span className="live-dot" style={{ background: C.cream }}></span>{badge}</div></div>)}
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
    { label: 'PILOTAGE', tabs: ['Accueil', 'Dashboard Finance', 'Trésorerie'] },
    { label: 'OPÉRATIONS', tabs: ['Factures', 'Dépenses', 'Budget'] },
    { label: 'INTELLIGENCE', tabs: ['Conformité', 'Scenarios IA'] },
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

function StatCard({ label, value, suffix, sub, icon: Icon, color, bg, trendUp }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 20, padding: 22, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden', transition: 'all 0.3s ease' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }}></div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: `0 8px 16px -8px ${color}40` }}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span className="display-font" style={{ fontSize: 32, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
        {suffix && <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: trendUp ? C.emeraldDeep : C.inkSoft, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>{trendUp && <ArrowUpRight size={11} />}{sub}</div>
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

function ModalShell({ title, subtitle, icon: Icon, color = C.emerald, onClose, children, footer, size = 'md' }: any) {
  const maxW = size === 'lg' ? 880 : size === 'sm' ? 480 : 640;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: maxW }} onClick={(e: any) => e.stopPropagation()}>
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
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(10,42,32,0.06)', border: 'none', color: C.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '24px 28px', overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '18px 28px', borderTop: '1px solid rgba(10,42,32,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'rgba(10,42,32,0.02)' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ============ MODALS ============
function NewInvoiceModal({ onClose }: any) {
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [lines, setLines] = useState([{ desc: '', qty: 1, price: 0 }]);
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [vat, setVat] = useState('18');
  const [paymentMethod, setPaymentMethod] = useState('Virement');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const total = lines.reduce((a, l) => a + (l.qty * l.price), 0);
  const submit = async () => {
    if (submitting) return;
    if (!clientName.trim()) { toast.error('Nom client requis'); return; }
    if (lines.every(l => !l.desc.trim())) { toast.error('Au moins une ligne'); return; }
    setSubmitting(true);
    try {
      await api.post('/finance/invoices', {
        client: { name: clientName, email: clientEmail, country },
        currency, lines, total, vat: Number(vat), issueDate, dueDate, paymentMethod, notes,
      });
      toast.success('Facture émise');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible d\'émettre la facture.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouvelle facture" subtitle={`Étape ${step} / 3`} icon={Receipt} color={C.emerald} onClose={onClose} size="lg"
      footer={<>
        {step > 1 && <button className="btn-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={14} /> Précédent</button>}
        <button className="btn-primary" disabled={submitting} onClick={() => step < 3 ? setStep(step + 1) : submit()}>
          {step < 3 ? 'Continuer' : (submitting ? 'Envoi…' : 'Émettre la facture')} {step < 3 ? <ArrowRight size={14} /> : (!submitting && <Send size={14} />)}
        </button>
      </>}>
      {step === 1 && (<>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 0, marginBottom: 12 }}>Client</h4>
        <div className="form-row">
          <div><label className="form-label">Nom du client</label><input className="form-input" placeholder="Acme Corp" value={clientName} onChange={e => setClientName(e.target.value)} /></div>
          <div><label className="form-label">Email</label><input className="form-input" type="email" placeholder="contact@acme.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} /></div>
        </div>
        <div className="form-row" style={{ marginTop: 14 }}>
          <div><label className="form-label">Pays</label>
            <select className="form-input" value={country} onChange={e => setCountry(e.target.value)}>
              <option value="">Sélectionner…</option>
              <option>France</option>
              <option>Belgique</option>
              <option>Suisse</option>
              <option>Canada</option>
              <option>États-Unis</option>
              <option>Royaume-Uni</option>
              <option>Allemagne</option>
              <option>Espagne</option>
              <option>Italie</option>
              <option>Côte d'Ivoire</option>
              <option>Sénégal</option>
              <option>Cameroun</option>
              <option>Maroc</option>
              <option>Tunisie</option>
              <option>Autre</option>
            </select>
          </div>
          <div><label className="form-label">Devise</label>
            <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option>EUR</option>
              <option>USD</option>
              <option>GBP</option>
              <option>CHF</option>
              <option>CAD</option>
              <option>FCFA</option>
              <option>MAD</option>
              <option>TND</option>
            </select>
          </div>
        </div>
      </>)}
      {step === 2 && (<>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 0, marginBottom: 12 }}>Lignes de facture</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 0.6fr', gap: 8, alignItems: 'center' }}>
              <input className="form-input" placeholder="Description" value={l.desc} onChange={(e: any) => { const c = [...lines]; c[i].desc = e.target.value; setLines(c); }} />
              <input className="form-input" type="number" placeholder="Qté" value={l.qty} onChange={(e: any) => { const c = [...lines]; c[i].qty = +e.target.value; setLines(c); }} />
              <input className="form-input" type="number" placeholder="Prix unitaire" value={l.price} onChange={(e: any) => { const c = [...lines]; c[i].price = +e.target.value; setLines(c); }} />
              <button className="icon-btn" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setLines([...lines, { desc: '', qty: 1, price: 0 }])}><Plus size={14} /> Ajouter une ligne</button>
        <div style={{ marginTop: 16, padding: 14, background: C.emeraldSoft, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Total HT</span>
          <span className="display-font mono-font" style={{ fontSize: 24, fontWeight: 800, color: C.emeraldDeep }}>{fmtFCFA(total)} <span style={{ fontSize: 14 }}>{currency}</span></span>
        </div>
      </>)}
      {step === 3 && (<>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 0, marginBottom: 12 }}>Conditions & envoi</h4>
        <div className="form-row">
          <div><label className="form-label">Date d'émission</label><input type="date" className="form-input" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div>
          <div><label className="form-label">Date d'échéance</label><input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        </div>
        <div className="form-row" style={{ marginTop: 14 }}>
          <div><label className="form-label">TVA</label>
            <select className="form-input" value={vat} onChange={e => setVat(e.target.value)}>
              <option value="0">0% (Exonéré / Export)</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
              <option value="15">15%</option>
              <option value="18">18%</option>
              <option value="20">20%</option>
              <option value="21">21%</option>
              <option value="25">25%</option>
            </select>
          </div>
          <div><label className="form-label">Mode de paiement</label>
            <select className="form-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option>Virement</option><option>Mobile Money</option><option>Chèque</option><option>Carte bancaire</option></select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="form-label">Notes au client</label>
          <textarea className="form-input" rows={3} placeholder="Merci pour votre confiance…" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" defaultChecked style={{ accentColor: C.emerald }} /><span style={{ fontSize: 13 }}>Envoyer par email</span></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" defaultChecked style={{ accentColor: C.emerald }} /><span style={{ fontSize: 13 }}>Activer relances auto</span></label>
        </div>
      </>)}
    </ModalShell>
  );
}

function NewExpenseModal({ onClose }: any) {
  const [cat, setCat] = useState('Repas');
  const cats = [
    { name: 'Repas', icon: Coffee, color: C.yellow },
    { name: 'Transport', icon: Plane, color: C.blue },
    { name: 'Hôtel', icon: Building2, color: C.purple },
    { name: 'Logiciel', icon: Plug, color: C.pink },
    { name: 'Marketing', icon: Target, color: C.red },
    { name: 'Autre', icon: Receipt, color: C.greenDeep },
  ];
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('FCFA');
  const [date, setDate] = useState('');
  const [payMethod, setPayMethod] = useState('Carte bancaire perso');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!amount || Number(amount) <= 0) { toast.error('Montant requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/finance/expenses', { category: cat, amount: Number(amount), currency, date, paymentMethod: payMethod, description });
      toast.success('Dépense soumise');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de soumettre.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouvelle dépense" subtitle="OCR auto sur le justificatif" icon={Receipt} color={C.purple} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.purple }} disabled={submitting} onClick={submit}><Send size={14} /> {submitting ? 'Envoi…' : 'Soumettre'}</button></>}>
      <div style={{ background: `linear-gradient(135deg, ${C.purpleSoft} 0%, ${C.cream} 100%)`, border: `2px dashed ${C.purple}`, borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 16, cursor: 'pointer' }}>
        <Upload size={32} color={C.purple} style={{ margin: '0 auto 8px' }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Glissez votre justificatif ici</div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>JPG · PNG · PDF — l'IA extrait montant et TVA automatiquement</div>
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
          <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}><option>FCFA</option><option>EUR</option><option>USD</option></select>
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label className="form-label">Mode de paiement</label>
          <select className="form-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}><option>Carte bancaire perso</option><option>Espèces</option><option>Carte société</option><option>Virement</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Description</label>
        <textarea className="form-input" rows={2} placeholder="Déjeuner client Acme" value={description} onChange={e => setDescription(e.target.value)}></textarea>
      </div>
    </ModalShell>
  );
}

function NewBudgetModal({ onClose }: any) {
  const [department, setDepartment] = useState('Marketing');
  const [period, setPeriod] = useState('Mensuel');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('FCFA');
  const [warnPct, setWarnPct] = useState('75');
  const [critPct, setCritPct] = useState('95');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!amount || Number(amount) <= 0) { toast.error('Montant requis'); return; }
    setSubmitting(true);
    try {
      await api.put(`/finance/budget/${department.toLowerCase()}`, {
        department, period, amount: Number(amount), currency,
        thresholds: { warn: Number(warnPct), crit: Number(critPct) }, notes,
      });
      toast.success('Budget enregistré');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de créer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouveau budget département" icon={PieChart} color={C.pink} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.pink }} disabled={submitting} onClick={submit}><CheckCircle2 size={14} /> {submitting ? 'Création…' : 'Créer le budget'}</button></>}>
      <div className="form-row">
        <div><label className="form-label">Département</label>
          <select className="form-input" value={department} onChange={e => setDepartment(e.target.value)}><option>Marketing</option><option>Tech</option><option>Sales</option><option>Operations</option></select>
        </div>
        <div><label className="form-label">Période</label>
          <select className="form-input" value={period} onChange={e => setPeriod(e.target.value)}><option>Mensuel</option><option>Trimestriel</option><option>Annuel</option></select>
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Montant alloué</label><input className="form-input" type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div><label className="form-label">Devise</label>
          <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}><option>FCFA</option><option>EUR</option><option>USD</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Seuils d'alerte (%)</label>
        <div className="form-row">
          <div><input className="form-input" value={warnPct} onChange={e => setWarnPct(e.target.value)} placeholder="Alerte info" /></div>
          <div><input className="form-input" value={critPct} onChange={e => setCritPct(e.target.value)} placeholder="Alerte critique" /></div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Notes</label>
        <textarea className="form-input" rows={3} placeholder="Contexte du budget…" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
      </div>
    </ModalShell>
  );
}

function ScenarioModal({ onClose }: any) {
  const [scenario, setScenario] = useState('lose-client');
  const [params, setParams] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post('/finance/automation/run', { type: 'scenario', scenario, params });
      toast.success('Simulation lancée', 'Résultats disponibles sous peu.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de lancer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Simulation IA" subtitle="Anticipe l'impact sur ta trésorerie" icon={Sparkles} color={C.teal} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.teal }} disabled={submitting} onClick={submit}><Sparkles size={14} /> {submitting ? 'Lancement…' : 'Lancer la simulation'}</button></>}>
      <label className="form-label">Scénario à simuler</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {[
          { id: 'lose-client', name: 'Perdre un gros client', icon: TrendingDown, color: C.red },
          { id: 'hire-team', name: 'Recruter 3 personnes', icon: Users, color: C.purple },
          { id: 'price-up', name: 'Augmenter les prix de 10%', icon: TrendingUp, color: C.emerald },
          { id: 'new-market', name: 'Lancer un nouveau marché', icon: Globe, color: C.blue },
          { id: 'pay-debt', name: 'Rembourser la dette', icon: CreditCard, color: C.gold },
          { id: 'cut-costs', name: 'Réduire coûts de 20%', icon: Scale, color: C.teal },
        ].map(s => {
          const Ic = s.icon;
          return (
            <button key={s.id} onClick={() => setScenario(s.id)} style={{ background: scenario === s.id ? `${s.color}15` : C.cream, border: `1.5px solid ${scenario === s.id ? s.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}20`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={16} /></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{s.name}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>
        <label className="form-label">Paramètres</label>
        <textarea className="form-input" rows={3} placeholder="Ex: client X (2.4M FCFA/mois), à partir de juin 2026…" value={params} onChange={e => setParams(e.target.value)}></textarea>
      </div>
    </ModalShell>
  );
}

function VATReportModal({ onClose }: any) {
  return (
    <ModalShell title="Déclaration TVA" subtitle="Avril 2026 · Échéance 15 mai" icon={Calculator} color={C.gold} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}><Download size={14} /> Export PDF</button>
        <button className="btn-primary" style={{ background: C.gold }} onClick={onClose}><CheckCircle2 size={14} /> Valider la déclaration</button></>}>
      <div style={{ background: C.goldSoft, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.08em' }}>NET À PAYER</div>
            <div className="display-font" style={{ fontSize: 36, fontWeight: 800, color: C.ink, lineHeight: 1, marginTop: 4 }}>0<span style={{ fontSize: 16, color: C.inkSoft, marginLeft: 6 }}>FCFA</span></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.inkSoft }}>Échéance</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>15 mai 2026</div>
          </div>
        </div>
      </div>
      <div style={{ background: C.cream, border: '1px solid rgba(10,42,32,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {[
          { label: 'TVA collectée', amount: 0, color: C.emeraldDeep },
          { label: 'TVA déductible', amount: 0, color: C.red },
          { label: 'Crédit TVA reporté', amount: 0, color: C.inkSoft },
        ].map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: i > 0 ? '1px solid rgba(10,42,32,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: C.ink }}>{l.label}</span>
            <span className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: l.color }}>{fmtFCFA(l.amount)} FCFA</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: 12, background: C.emeraldSoft, borderRadius: 10, fontSize: 12, color: C.greenDeep, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={14} /> L'IA a vérifié toutes les factures du mois et n'a détecté aucune anomalie.
      </div>
    </ModalShell>
  );
}

// ============ PAGE 1: ACCUEIL ============
function AccueilPage({ onTab, openModal, data }: any) {
  const { user } = useAuthStore();
  const firstName = (user?.displayName ?? '').split(' ')[0] || '';
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const dash = data?.dashboard || {};
  const cashflow = data?.cashflow || {};
  const stats = [
    { label: 'Trésorerie', value: dash?.cashBalance ? `${(dash.cashBalance / 1000).toFixed(1)}K` : '—', suffix: dash?.cashBalance ? ' XOF' : '', sub: dash?.cashTrend ? dash.cashTrend : 'En attente données', icon: Wallet, color: C.emerald, bg: C.emeraldSoft, trendUp: dash?.cashTrendUp },
    { label: 'Revenus du mois', value: dash?.revenue ? `${(dash.revenue / 1000000).toFixed(1)}M` : '—', suffix: dash?.revenue ? ' FCFA' : '', sub: dash?.period || 'Période courante', icon: TrendingUp, color: C.greenDeep, bg: C.greenSoft, trendUp: true },
    { label: 'Factures impayées', value: dash?.overdue ? `${(dash.overdue / 1000000).toFixed(1)}M` : '—', suffix: dash?.overdue ? ' FCFA' : '', sub: dash?.overdueCount ? `${dash.overdueCount} factures` : 'Aucune', icon: AlertTriangle, color: C.red, bg: C.redSoft },
    { label: 'Cash runway', value: dash?.runwayMonths || '—', suffix: dash?.runwayMonths ? ' mois' : '', sub: 'Au rythme actuel', icon: Activity, color: C.gold, bg: C.goldSoft },
  ];
  const modules = [
    { name: 'Dashboard Finance', desc: 'P&L · Cash-flow · KPIs', icon: BarChart3, color: C.emerald, bg: C.emeraldSoft, page: 'Dashboard Finance' },
    { name: 'Trésorerie', desc: 'Comptes consolidés', icon: Wallet, color: C.greenDeep, bg: C.greenSoft, page: 'Trésorerie' },
    { name: 'Factures', desc: `${data?.invoices?.length || 0} factures`, icon: Receipt, color: C.blue, bg: C.blueSoft, page: 'Factures' },
    { name: 'Dépenses', desc: `${data?.expenses?.length || 0} dépenses`, icon: FileText, color: C.purple, bg: C.purpleSoft, page: 'Dépenses' },
    { name: 'Budget', desc: 'Suivi prévisionnel', icon: PieChart, color: C.pink, bg: C.pinkSoft, page: 'Budget' },
    { name: 'Conformité', desc: 'TVA · Multi-pays', icon: Scale, color: C.gold, bg: C.goldSoft, page: 'Conformité' },
    { name: 'Scenarios IA', desc: 'Simule l\'avenir financier', icon: Sparkles, color: C.teal, bg: C.tealSoft, page: 'Scenarios IA' },
  ];
  const quickActions = [
    { title: 'Créer une facture', desc: 'Génère une facture en 30s', icon: Receipt, color: C.emerald, action: 'invoice' },
    { title: 'Note de frais', desc: 'Soumettre + OCR auto', icon: FileText, color: C.purple, action: 'expense' },
    { title: 'Nouveau budget', desc: 'Allouer un budget département', icon: PieChart, color: C.pink, action: 'budget' },
    { title: 'Scénario IA', desc: 'Simule l\'impact d\'une décision', icon: Sparkles, color: C.teal, action: 'scenario' },
    { title: 'Déclaration TVA', desc: 'Préparer la TVA mensuelle', icon: Calculator, color: C.gold, action: 'vat' },
    { title: 'Lancer relances', desc: 'Recouvrement impayés', icon: Send, color: C.red, action: 'relances' },
  ];
  return (
    <>
      <PageHeader title={greeting} italic="vos finances en un coup d'œil."
        subtitle={data?.loaded ? 'Données financières en temps réel — posez-moi n\'importe quelle question.' : 'Chargement des données financières…'}
        badge="CFO IA · TEMPS RÉEL" gradient="emerald"
        actions={<>
          <button onClick={() => toast.info('Assistant CFO', 'Cliquez sur la bulle violet en bas à droite pour ouvrir l\'assistant.')} className="btn-secondary" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream, border: '1px solid rgba(255,250,240,0.25)' }}><Sparkles size={14} /> Demander à l'IA</button>
          <button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.6)' }} onClick={() => openModal('invoice')}><Plus size={16} /> Nouvelle facture</button>
        </>} />
      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>

      <div style={{ padding: '32px 32px 0' }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px' }}>
          Modules <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.emeraldMid, fontSize: 18 }}>— accès rapide</em>
        </h3>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {modules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} onClick={() => onTab(mod.page)} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${mod.color}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
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

      <div style={{ padding: '32px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Zap size={18} color={C.emerald} />
          <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: 0 }}>
            Actions rapides <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.emeraldMid, fontSize: 18 }}>— modals fonctionnelles</em>
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="responsive-charts">
          {quickActions.map((qa, idx) => {
            const Icon = qa.icon;
            return (
              <div key={idx} onClick={() => openModal(qa.action)} style={{ background: C.cream, borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.2s ease' }}
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

      <div style={{ padding: '32px 32px 32px' }}>
        <div className="grain" style={{ background: `linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDeep} 100%)`, borderRadius: 24, padding: '28px 32px', color: C.cream, position: 'relative', overflow: 'hidden', boxShadow: `0 24px 48px -16px ${C.emerald}40` }}>
          <svg style={{ position: 'absolute', right: -30, top: -30, opacity: 0.18 }} width="240" height="240" viewBox="0 0 240 240">
            <circle cx="120" cy="120" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
            <circle cx="120" cy="120" r="70" stroke={C.greenDeep} strokeWidth="2" fill="none" />
            <circle cx="120" cy="120" r="40" fill={C.greenDeep} fillOpacity="0.5" />
          </svg>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircleDollarSign size={22} color={C.cream} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.greenDeep, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>CFO VIRTUEL</div>
                <h3 className="display-font" style={{ fontSize: 24, fontWeight: 700, color: C.cream, margin: 0 }}>
                  Discuter avec <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.greenDeep }}>Comptabilité</em>
                </h3>
              </div>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,250,240,0.9)', marginBottom: 18, maxWidth: 560 }}>
              Pose-moi n'importe quelle question financière en langage naturel. Je connais tes comptes, tes clients, tes dépenses.
            </p>
            <div style={{ background: 'rgba(255,250,240,0.12)', border: '1px solid rgba(255,250,240,0.18)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input placeholder="Ex: Combien j'ai gagné avec les clients ivoiriens ce trimestre ?" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.cream, fontFamily: 'inherit' }} />
              <button style={{ background: C.greenDeep, color: C.cream, border: 'none', padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Send size={13} /> Envoyer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ============ PAGE 2: DASHBOARD FINANCE ============
function DashboardFinancePage({ data }: any) {
  const dash = data?.dashboard || {};
  const pl = data?.profitLoss || {};
  const kpis = [
    { label: 'CA cumulé', value: pl?.revenue ? `${(pl.revenue / 1000000).toFixed(1)}M` : '—', suffix: pl?.revenue ? ' FCFA' : '', sub: 'YTD', trendUp: true, color: C.emeraldDeep, bg: C.emeraldSoft, icon: TrendingUp },
    { label: 'Marge brute', value: pl?.grossMargin ? `${pl.grossMargin}%` : '—', sub: 'Période courante', trendUp: pl?.grossMargin > 0, color: C.greenDeep, bg: C.greenSoft, icon: Percent },
    { label: 'Burn rate', value: pl?.burnRate ? `${(pl.burnRate / 1000000).toFixed(1)}M` : '—', suffix: pl?.burnRate ? ' /mois' : '', sub: 'Stable', color: C.gold, bg: C.goldSoft, icon: Activity },
    { label: 'EBITDA', value: pl?.ebitda ? `${(pl.ebitda / 1000000).toFixed(1)}M` : '—', suffix: pl?.ebitda ? ' FCFA' : '', sub: 'Période courante', trendUp: pl?.ebitda > 0, color: C.purple, bg: C.purpleSoft, icon: Award },
  ];
  return (
    <>
      <PageHeader title="Dashboard" italic="Finance"
        subtitle="P&L · Cash-flow · Marges · Burn rate"
        badge="Q2 2026 · TEMPS RÉEL" gradient="emerald"
        actions={<><button onClick={() => toast.info('Export PDF', 'Génération du rapport en cours… Disponible bientôt.')} className="btn-secondary"><Download size={14} /> Export PDF</button>
          <button onClick={() => toast.info('Assistant CFO', 'Cliquez sur la bulle violet en bas à droite pour analyser vos données.')} className="btn-primary" style={{ background: C.greenDeep }}><Sparkles size={14} /> Insight IA</button></>} />
      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {kpis.map((k, i) => <StatCard key={i} {...k} />)}
        </div>
      </div>
      <div style={{ padding: '24px 32px 32px' }}>
        {!data?.loaded ? (
          <EmptyState icon={LineChart} title="Chargement des données…" desc="Le dashboard se met à jour en temps réel." />
        ) : (
          <div style={{ background: C.cream, borderRadius: 20, padding: 32, border: '1px solid rgba(10,42,32,0.06)' }}>
            <h3 className="display-font" style={{ fontSize: 20, fontWeight: 700, color: C.ink, margin: '0 0 16px' }}>Vue P&L détaillée</h3>
            {pl && Object.keys(pl).length > 0 ? (
              <pre style={{ background: C.creamDeep, padding: 16, borderRadius: 12, overflow: 'auto', fontSize: 12, color: C.ink }}>{JSON.stringify(pl, null, 2)}</pre>
            ) : (
              <EmptyState icon={BarChart3} title="P&L en attente" desc="Les données P&L apparaîtront ici dès la première facture émise." />
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 3: TRÉSORERIE ============
function TresoreriePage({ data }: any) {
  const cashflow = data?.cashflow || {};
  const accounts = cashflow?.accounts || [];
  return (
    <>
      <PageHeader title="Trésorerie" italic="multi-comptes"
        subtitle="Vue consolidée de tous les comptes bancaires & mobile money"
        badge="LIVE" gradient="emerald"
        actions={<><button onClick={() => toast.info('Synchronisation', 'Actualisation des données bancaires…')} className="btn-secondary"><RefreshCw size={14} /> Sync banques</button>
          <button onClick={() => toast.info('Connecteurs', 'Ajoutez vos comptes bancaires depuis l\'admin Connecteurs.')} className="btn-primary"><Plus size={16} /> Ajouter un compte</button></>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {accounts.length === 0 ? (
          <EmptyState icon={Wallet} title="Aucun compte bancaire connecté" desc="Connectez votre premier compte pour voir votre solde consolidé en temps réel." action={<button onClick={() => toast.info('Connecteurs', 'Ouvrez l\'admin Connecteurs pour connecter une banque.')} className="btn-primary"><Plus size={14} /> Connecter une banque</button>} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="responsive-charts">
            {accounts.map((a: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.emeraldSoft, color: C.emeraldDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{a.name || a.bank}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>{a.type} · {a.currency || '—'}</div>
                  </div>
                </div>
                <div className="display-font" style={{ fontSize: 28, fontWeight: 800, color: C.emeraldDeep }}>{fmtFCFA(a.balance || 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 4: FACTURES ============
function FacturesPage({ openModal, invoices = [], aging = [] }: any) {
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list');
  const filtered = filter === 'all' ? invoices : invoices.filter((i: any) => i.status === filter);
  const statusPill = (inv: any) => (
    <span className="pill" style={{
      background: inv.status === 'paid' ? C.emeraldSoft : inv.status === 'overdue' ? C.redSoft : C.yellowSoft,
      color: inv.status === 'paid' ? C.emeraldDeep : inv.status === 'overdue' ? C.red : C.yellow,
      fontWeight: 700,
    }}>{inv.status === 'paid' ? 'Payée' : inv.status === 'overdue' ? 'En retard' : 'En attente'}</span>
  );
  return (
    <>
      <PageHeader title="Factures" italic={`${invoices.length} émises`}
        subtitle="Émettre · Suivre · Relancer · Encaisser"
        badge="OPS" gradient="emerald"
        actions={<><button onClick={() => {
          if (!invoices.length) { toast.info('Aucune facture à exporter'); return; }
          const csv = ['Numéro,Client,Montant,Statut,Date'].concat(
            invoices.map((i: any) => `${i.number ?? i.id},${i.clientName ?? ''},${i.amount ?? 0},${i.status ?? ''},${i.issueDate ?? ''}`)
          ).join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `factures-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('Export CSV', `${invoices.length} factures exportées`);
        }} className="btn-secondary"><Download size={14} /> Export CSV</button>
          <button className="btn-primary" onClick={() => openModal('invoice')}><Plus size={16} /> Nouvelle facture</button></>} />
      <div style={{ padding: '24px 32px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Toutes', n: invoices.length },
            { id: 'paid', label: 'Payées', n: invoices.filter((i: any) => i.status === 'paid').length },
            { id: 'pending', label: 'En attente', n: invoices.filter((i: any) => i.status === 'pending').length },
            { id: 'overdue', label: 'En retard', n: invoices.filter((i: any) => i.status === 'overdue').length },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`tab-btn ${filter === f.id ? 'active' : ''}`} style={{ background: filter === f.id ? C.emerald : C.greenDark, padding: '8px 14px', fontSize: 13 }}>{f.label} <span style={{ opacity: 0.7 }}>· {f.n}</span></button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}><ViewToggle view={view} setView={setView} /></div>
      </div>
      <div style={{ padding: '20px 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon={Receipt} title={filter === 'all' ? 'Aucune facture émise' : 'Aucune facture dans cette catégorie'} desc="Crée ta première facture en 30 secondes." action={<button className="btn-primary" onClick={() => openModal('invoice')}><Plus size={14} /> Nouvelle facture</button>} />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map((inv: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 20, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 32px -16px rgba(16,185,129,0.4)'; e.currentTarget.style.borderColor = C.emerald; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: inv.status === 'paid' ? C.emerald : inv.status === 'overdue' ? C.red : C.yellow }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div className="mono-font" style={{ fontSize: 11, fontWeight: 700, color: C.emeraldDeep, background: C.emeraldSoft, padding: '4px 8px', borderRadius: 6 }}>{inv.number || `#${i + 1}`}</div>
                  {statusPill(inv)}
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{inv.client || inv.clientName || '—'}</div>
                <div className="display-font mono-font" style={{ fontSize: 26, fontWeight: 800, color: C.ink, lineHeight: 1, marginBottom: 12 }}>{fmtFCFA(inv.amount || inv.total || 0)}<span style={{ fontSize: 12, color: C.inkSoft, marginLeft: 4 }}>FCFA</span></div>
                <div style={{ fontSize: 11, color: C.inkSoft, display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 10, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Émission</span><span>{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('fr-FR') : '—'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Échéance</span><span>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—'}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button className="icon-btn" style={{ flex: 1, height: 32 }}><Eye size={13} /></button>
                  <button className="icon-btn" style={{ flex: 1, height: 32 }}><Send size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1fr 1fr 0.8fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <div>N°</div><div>Client</div><div>Émission</div><div>Échéance</div><div>Montant</div><div>Statut</div><div></div>
            </div>
            {filtered.map((inv: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 1fr 1fr 0.8fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
                <div className="mono-font" style={{ fontSize: 12, fontWeight: 700, color: C.emeraldDeep }}>{inv.number || `#${i + 1}`}</div>
                <div style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>{inv.client || inv.clientName || '—'}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('fr-FR') : '—'}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—'}</div>
                <div className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{fmtFCFA(inv.amount || inv.total || 0)}</div>
                <div>{statusPill(inv)}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon-btn" style={{ width: 28, height: 28 }}><Eye size={12} /></button>
                  <button className="icon-btn" style={{ width: 28, height: 28 }}><Send size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 5: DÉPENSES ============
function DepensesPage({ openModal, expenses = [] }: any) {
  const [view, setView] = useState('list');
  const statusPill = (e: any) => (
    <span className="pill" style={{ background: e.status === 'approved' ? C.emeraldSoft : e.status === 'rejected' ? C.redSoft : C.yellowSoft, color: e.status === 'approved' ? C.emeraldDeep : e.status === 'rejected' ? C.red : C.yellow, fontWeight: 700 }}>
      {e.status === 'approved' ? 'Approuvée' : e.status === 'rejected' ? 'Refusée' : 'En attente'}
    </span>
  );
  return (
    <>
      <PageHeader title="Dépenses" italic={`${expenses.length} en cours`}
        subtitle="Notes de frais · OCR · Validation rapide"
        badge="OPS" gradient="emerald"
        actions={<><button className="btn-secondary"><Download size={14} /> Export</button>
          <button className="btn-primary" style={{ background: C.purple }} onClick={() => openModal('expense')}><Plus size={16} /> Nouvelle dépense</button></>} />
      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {expenses.length === 0 ? (
          <EmptyState icon={FileText} title="Aucune dépense enregistrée" desc="Soumets ta première note de frais — l'IA extrait montant et TVA automatiquement." action={<button className="btn-primary" style={{ background: C.purple }} onClick={() => openModal('expense')}><Plus size={14} /> Ajouter une dépense</button>} />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {expenses.map((e: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `${C.purple}15`, color: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={18} />
                  </div>
                  {statusPill(e)}
                </div>
                <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{e.description || e.category || 'Dépense'}</div>
                <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 10 }}>{e.userName || ''} {e.date ? `· ${new Date(e.date).toLocaleDateString('fr-FR')}` : ''}</div>
                <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>{fmtFCFA(e.amount || 0)}<span style={{ fontSize: 11, color: C.inkSoft, marginLeft: 4 }}>{e.currency || 'FCFA'}</span></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="stagger">
            {expenses.map((e: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.purple}15`, color: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{e.description || e.category || 'Dépense'}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{e.userName || ''} {e.date ? `· ${new Date(e.date).toLocaleDateString('fr-FR')}` : ''}</div>
                </div>
                <div className="display-font mono-font" style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{fmtFCFA(e.amount || 0)}<span style={{ fontSize: 12, color: C.inkSoft, marginLeft: 4 }}>{e.currency || 'FCFA'}</span></div>
                {statusPill(e)}
                <button className="icon-btn"><Eye size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 6: BUDGET ============
function BudgetPage({ openModal, budget }: any) {
  const items = budget?.departments || budget || [];
  return (
    <>
      <PageHeader title="Budget" italic="par département"
        subtitle="Allocations · Suivi · Alertes de dépassement"
        badge="MENSUEL" gradient="emerald"
        actions={<><button className="btn-secondary"><PieChart size={14} /> Vue camembert</button>
          <button className="btn-primary" style={{ background: C.pink }} onClick={() => openModal('budget')}><Plus size={16} /> Nouveau budget</button></>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {(!items || items.length === 0) ? (
          <EmptyState icon={PieChart} title="Aucun budget configuré" desc="Crée ton premier budget département pour suivre les dépenses." action={<button className="btn-primary" style={{ background: C.pink }} onClick={() => openModal('budget')}><Plus size={14} /> Créer un budget</button>} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((b: any, i: number) => {
              const used = b.spent || 0;
              const total = b.allocated || 1;
              const pct = Math.min(100, (used / total) * 100);
              const color = pct > 95 ? C.red : pct > 75 ? C.yellow : C.emerald;
              return (
                <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{b.dept || b.name}</div>
                      <div style={{ fontSize: 12, color: C.inkSoft }}>{fmtFCFA(used)} / {fmtFCFA(total)} FCFA</div>
                    </div>
                    <div className="display-font" style={{ fontSize: 24, fontWeight: 800, color }}>{pct.toFixed(0)}%</div>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: color }}></div></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ============ PAGE 7: CONFORMITÉ ============
function ConformitePage({ openModal, vatReport }: any) {
  const obligations = [
    { name: 'TVA mensuelle (CI)', due: '15 mai 2026', status: 'pending', color: C.gold, icon: Calculator },
    { name: 'IS trimestriel', due: '30 juin 2026', status: 'upcoming', color: C.blue, icon: Scale },
    { name: 'CNPS Salariale', due: 'Mensuel', status: 'recurring', color: C.emerald, icon: ShieldCheck },
    { name: 'Bilan annuel', due: '31 mars 2027', status: 'far', color: C.inkSoft, icon: FileText },
  ];
  return (
    <>
      <PageHeader title="Conformité" italic="& obligations"
        subtitle="TVA · IS · CNPS · Multi-pays"
        badge="LÉGAL" gradient="emerald"
        actions={<><button className="btn-secondary"><Globe size={14} /> Pays</button>
          <button className="btn-primary" style={{ background: C.gold }} onClick={() => openModal('vat')}><Calculator size={16} /> Préparer la TVA</button></>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {obligations.map((o, i) => {
            const Ic = o.icon;
            return (
              <div key={i} className="row-card">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${o.color}15`, color: o.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ic size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{o.name}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>Échéance : {o.due}</div>
                </div>
                <span className="pill" style={{ background: `${o.color}15`, color: o.color, fontWeight: 700 }}>{o.status === 'pending' ? 'À faire' : o.status === 'upcoming' ? 'À venir' : o.status === 'recurring' ? 'Récurrent' : 'Programmé'}</span>
                <button className="icon-btn"><ChevronRight size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ PAGE 8: SCENARIOS IA ============
function ScenariosPage({ openModal }: any) {
  const examples = [
    { title: 'Perdre votre plus gros client', desc: 'Impact sur 6 mois · Recommandations IA', icon: TrendingDown, color: C.red },
    { title: 'Recruter 3 personnes en mai', desc: 'Effet sur le burn et le runway', icon: Users, color: C.purple },
    { title: 'Augmenter les prix de 10%', desc: 'Élasticité estimée · churn projeté', icon: TrendingUp, color: C.emerald },
    { title: 'Lancer un nouveau marché (Sénégal)', desc: 'CAPEX · ROI · Timeline 12 mois', icon: Globe, color: C.blue },
  ];
  return (
    <>
      <PageHeader title="Scénarios" italic="IA"
        subtitle="Simule l'impact financier de tes décisions stratégiques"
        badge="WHAT IF" gradient="emerald"
        actions={<button className="btn-primary" style={{ background: C.teal }} onClick={() => openModal('scenario')}><Sparkles size={16} /> Nouveau scénario</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }} className="responsive-charts">
          {examples.map((ex, i) => {
            const Ic = ex.icon;
            return (
              <div key={i} onClick={() => openModal('scenario')} style={{ background: C.cream, borderRadius: 18, padding: 24, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = ex.color; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${ex.color} 0%, ${ex.color}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, boxShadow: `0 12px 24px -8px ${ex.color}` }}>
                  <Ic size={20} />
                </div>
                <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{ex.title}</div>
                <div style={{ fontSize: 13, color: C.inkSoft }}>{ex.desc}</div>
                <div style={{ marginTop: 14, fontSize: 12, color: ex.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>Simuler <ArrowRight size={12} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ MAIN ============
export default function FinanceRedesignPage() {
  const [activeTab, setActiveTab] = useState('Accueil');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const openModal = (id: string) => setActiveModal(id);
  const closeModal = () => setActiveModal(null);
  const data = useFinanceData();

  return (
    <Chrome>
      <TabSwitcher active={activeTab} setActive={setActiveTab} />
      {activeTab === 'Accueil' && <AccueilPage onTab={setActiveTab} openModal={openModal} data={data} />}
      {activeTab === 'Dashboard Finance' && <DashboardFinancePage data={data} />}
      {activeTab === 'Trésorerie' && <TresoreriePage data={data} />}
      {activeTab === 'Factures' && <FacturesPage openModal={openModal} invoices={data.invoices} aging={data.aging} />}
      {activeTab === 'Dépenses' && <DepensesPage openModal={openModal} expenses={data.expenses} />}
      {activeTab === 'Budget' && <BudgetPage openModal={openModal} budget={data.budget} />}
      {activeTab === 'Conformité' && <ConformitePage openModal={openModal} vatReport={data.vatReport} />}
      {activeTab === 'Scenarios IA' && <ScenariosPage openModal={openModal} />}

      {activeModal === 'invoice' && <NewInvoiceModal onClose={closeModal} />}
      {activeModal === 'expense' && <NewExpenseModal onClose={closeModal} />}
      {activeModal === 'budget' && <NewBudgetModal onClose={closeModal} />}
      {activeModal === 'scenario' && <ScenarioModal onClose={closeModal} />}
      {activeModal === 'vat' && <VATReportModal onClose={closeModal} />}

      <LiveSyncBadge lastSync={data?.lastSync} intervalMs={REFRESH_INTERVAL_MS} />

      <div style={{ position: 'fixed', bottom: 28, right: 100, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        <button onClick={() => openModal('vat')} title="Déclaration TVA" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.gold, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <Calculator size={20} />
        </button>
        <button onClick={() => openModal('scenario')} title="Scénario IA" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.teal, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <Sparkles size={20} />
        </button>
        <button onClick={() => openModal('invoice')} title="Nouvelle facture" style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.emerald} 0%, ${C.emeraldDeep} 100%)`, border: 'none', color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px -8px ${C.emerald}` }}>
          <Plus size={24} />
        </button>
      </div>

      <AgentDrawer
        agentId="accounting"
        agentName="Comptabilité"
        color={C.emerald}
        context={{
          tab: activeTab,
          invoices: data.invoices?.length ?? 0,
          expenses: data.expenses?.length ?? 0,
          dashboard: data.dashboard ? Object.keys(data.dashboard) : [],
        }}
        starters={[
          'Quelles factures sont en retard de paiement ?',
          'Calcule mon cash-flow prévisionnel sur 30 jours',
          'Recommande des leviers pour réduire mes dépenses ce mois-ci',
        ]}
      />
    </Chrome>
  );
}
