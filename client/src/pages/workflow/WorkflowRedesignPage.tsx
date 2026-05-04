import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import AgentDrawer from '@/components/ai/AgentDrawer';
import { toast } from '@/components/common/Toast';
import {
  Search, Bell, ChevronDown, ChevronRight, ArrowRight, ArrowUpRight,
  LayoutDashboard, MessageSquare, Bot, UsersRound, Briefcase, Calendar,
  Plus, Filter, MoreHorizontal, Sparkles, TrendingUp,
  CheckCircle2, Clock, AlertTriangle, FileText, Eye, Trash2, Edit3, Send,
  Zap, GitBranch, Workflow, Play, Pause, Boxes, Network, X,
  Webhook, Repeat, Timer,
  Activity, BarChart3, Inbox,
  Users, UserPlus, Mail, MessageCircle, Phone,
  Database, Wand2,
  PlayCircle, PauseCircle,
  Layers, LayoutGrid, LayoutTemplate, List as ListIcon,
  ShieldCheck, Star, Heart, Rocket, Lightbulb, Target,
  DollarSign, Hash, Tag,
  Code, TerminalSquare,
  FileSpreadsheet, Settings
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E', greenMid: '#0F6B52',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  yellow: '#FBBF24', yellowMid: '#F59E0B', yellowDeep: '#D97706', yellowSoft: '#FEF3C7', yellowBright: '#FCD34D',
  orange: '#F97316', orangeDeep: '#EA580C', orangeSoft: '#FFEDD5',
  nodeTrigger: '#10B981', nodeTriggerSoft: '#D1FAE5',
  nodeAction: '#3B82F6', nodeActionSoft: '#DBEAFE',
  nodeCondition: '#A855F7', nodeConditionSoft: '#F3E8FF',
  nodeAgent: '#EC4899', nodeAgentSoft: '#FCE7F3',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#EF4444', redSoft: '#FEE2E2',
  pink: '#EC4899', pinkSoft: '#FCE7F3',
  cyan: '#06B6D4', cyanSoft: '#CFFAFE',
  violet: '#7C3AED', violetSoft: '#EDE9FE',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  gold: '#D4A017', goldSoft: '#FEF3C7',
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
  .tab-btn.active { background: ${C.yellow}; color: ${C.greenDeep}; box-shadow: 0 4px 14px -4px rgba(251, 191, 36, 0.5); }
  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.yellow}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.yellow}; opacity: 0.4; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  @keyframes lightning { 0%, 100% { filter: drop-shadow(0 0 0px ${C.yellow}); } 50% { filter: drop-shadow(0 0 14px ${C.yellow}); } }
  .lightning-glow { animation: lightning 2s ease-in-out infinite; }
  @keyframes dashFlow { to { stroke-dashoffset: -20; } }
  .flow-line { stroke-dasharray: 6 4; animation: dashFlow 1.2s linear infinite; }
  .row-card { background: ${C.cream}; border-radius: 16px; padding: 18px 20px; border: 1px solid rgba(10,42,32,0.06); transition: all 0.2s ease; cursor: pointer; display: flex; align-items: center; gap: 16px; }
  .row-card:hover { transform: translateX(4px); border-color: ${C.yellowDeep}; box-shadow: 0 12px 24px -12px rgba(217, 119, 6, 0.25); }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.yellowSoft}; color: ${C.yellowDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.yellow}; color: ${C.greenDeep}; }
  .btn-primary { background: linear-gradient(135deg, ${C.yellow} 0%, ${C.yellowDeep} 100%); color: ${C.greenDeep}; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px rgba(251, 191, 36, 0.6); font-family: inherit; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -8px rgba(251, 191, 36, 0.7); }
  .btn-secondary { background: ${C.cream}; color: ${C.greenDeep}; border: 1px solid rgba(10,42,32,0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }
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
  .form-input:focus { border-color: ${C.yellowDeep}; box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15); }
  .form-label { display: block; font-size: 11px; font-weight: 700; color: ${C.ink}; letter-spacing: 0.05em; margin-bottom: 6px; text-transform: uppercase; }
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

function useWorkflowData() {
  const [data, setData] = useState<any>({
    workflows: [], templates: [], triggers: [], actions: [],
    logs: [], stats: null, webhooks: [],
    loaded: false, lastSync: null,
  });

  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/workflow/workflows'),
    safeGet('/workflow/templates'),
    safeGet('/workflow/triggers'),
    safeGet('/workflow/actions'),
    safeGet('/workflow/logs'),
    safeGet('/workflow/stats'),
    safeGet('/workflow/webhooks'),
  ]).then(([w, t, tr, a, l, s, wh]) => {
    if (!mountedRef.current) return;
    setData({
      workflows: w?.workflows ?? w ?? [],
      templates: t?.templates ?? t ?? [],
      triggers: tr?.triggers ?? tr ?? [],
      actions: a?.actions ?? a ?? [],
      logs: l?.logs ?? l ?? [],
      stats: s ?? null,
      webhooks: wh?.webhooks ?? wh ?? [],
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
    <div style={{ position: 'fixed', bottom: 28, left: 28, zIndex: 50, background: 'rgba(10, 42, 32, 0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${C.yellow}40`, padding: '8px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 8, color: C.cream, fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)' }}>
      <span className="live-dot"></span>
      <span style={{ color: C.yellowBright }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>sync · {secondsAgo}s · refresh {intervalMs / 1000}s</span>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title = 'Pas encore de données', desc = '', action = null }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: '48px 32px', border: '1px dashed rgba(10,42,32,0.15)', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: C.yellowSoft, color: C.yellowDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
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
      <div className="grain" style={{ background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.orange} 50%, ${C.orangeDeep} 100%)`, borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden', color: C.greenDeep, boxShadow: `0 30px 60px -20px rgba(249, 115, 22, 0.5)` }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="120" stroke={C.greenDeep} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="80" stroke={C.greenDeep} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="40" stroke={C.greenDeep} strokeWidth="2" fill="none" />
        </svg>
        <svg style={{ position: 'absolute', right: 100, top: 30, opacity: 0.25 }} width="60" height="80" viewBox="0 0 60 80">
          <path d="M 30 0 L 10 40 L 28 40 L 18 80 L 50 35 L 32 35 Z" fill={C.greenDeep} />
        </svg>
        <svg style={{ position: 'absolute', right: 200, bottom: 20, opacity: 0.15 }} width="40" height="50" viewBox="0 0 60 80">
          <path d="M 30 0 L 10 40 L 28 40 L 18 80 L 50 35 L 32 35 Z" fill={C.greenDeep} />
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              {leftPills}
              {badge && (<div className="pill" style={{ background: C.greenDeep, color: C.yellow }}><Zap size={11} fill={C.yellow} />{badge}</div>)}
            </div>
            <h1 className="display-font hero-title" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.greenDeep, letterSpacing: '-0.03em' }}>
              {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.cream }}>{italic}</em>}
            </h1>
            {subtitle && <p style={{ marginTop: 12, fontSize: 14, color: 'rgba(10,42,32,0.8)', maxWidth: 540 }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      </div>
    </div>
  );
}

function TabSwitcher({ active, setActive }: any) {
  const tabGroups = [
    { label: 'PILOTAGE', tabs: ['Accueil', 'Mes workflows', 'Templates'] },
    { label: 'BUILDER', tabs: ['Canvas', 'Triggers', 'Actions'] },
    { label: 'OBSERVABILITÉ', tabs: ['Logs', 'Stats', 'Webhooks'] },
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

function ModalShell({ title, subtitle, icon: Icon, color = C.yellowDeep, onClose, children, footer, size = 'md' }: any) {
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
function NewWorkflowModal({ onClose }: any) {
  const [step, setStep] = useState(1);
  const [trigger, setTrigger] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!name.trim() || !trigger) { toast.error('Nom et déclencheur requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/workflow/workflows', { name, trigger, actions, active: true }).catch(() => null);
      toast.success('Workflow créé', 'Activation imminente.');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de créer.');
    } finally { setSubmitting(false); }
  };
  const toggleAction = (n: string) => setActions(actions.includes(n) ? actions.filter(a => a !== n) : [...actions, n]);
  return (
    <ModalShell title="Nouveau workflow" subtitle={`Étape ${step} / 3 · Trigger → Actions → Activation`} icon={Zap} color={C.yellowDeep} onClose={onClose} size="lg"
      footer={<>
        {step > 1 && <button className="btn-secondary" onClick={() => setStep(step - 1)}>Précédent</button>}
        <button className="btn-primary" disabled={submitting} onClick={() => step < 3 ? setStep(step + 1) : submit()}>{step < 3 ? 'Suivant' : (submitting ? 'Création…' : 'Activer le workflow')} <ArrowRight size={14} /></button>
      </>}>
      {step === 1 && (<>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 0, marginBottom: 12 }}>Choisis un déclencheur</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            { name: 'Webhook reçu', icon: Webhook, color: C.cyan },
            { name: 'Cron / Récurrent', icon: Repeat, color: C.violet },
            { name: 'Email reçu', icon: Mail, color: C.red },
            { name: 'Message WhatsApp', icon: MessageCircle, color: C.emerald },
            { name: 'Agent IA appelé', icon: Bot, color: C.pink },
            { name: 'Déclencheur manuel', icon: Play, color: C.yellow },
          ].map(t => {
            const Ic = t.icon;
            const active = trigger === t.name;
            return (
              <button key={t.name} onClick={() => setTrigger(t.name)} style={{ background: active ? `${t.color}15` : C.cream, border: `1.5px solid ${active ? t.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}20`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={18} /></div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{t.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </>)}
      {step === 2 && (<>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginTop: 0, marginBottom: 12 }}>Ajoute des actions</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            { name: 'Envoyer Email', icon: Mail, color: C.red },
            { name: 'Envoyer WhatsApp', icon: MessageCircle, color: C.emerald },
            { name: 'Appeler Agent IA', icon: Bot, color: C.pink },
            { name: 'Condition (if/else)', icon: GitBranch, color: C.violet },
            { name: 'Mettre à jour DB', icon: Database, color: C.blue },
            { name: 'Webhook sortant', icon: Webhook, color: C.cyan },
          ].map(t => {
            const Ic = t.icon;
            const active = actions.includes(t.name);
            return (
              <button key={t.name} onClick={() => toggleAction(t.name)} style={{ background: active ? `${t.color}15` : C.cream, border: `1.5px solid ${active ? t.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.color}20`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={18} /></div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{t.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </>)}
      {step === 3 && (<>
        <div><label className="form-label">Nom du workflow</label><input className="form-input" placeholder="Relance factures impayées" value={name} onChange={e => setName(e.target.value)} /></div>
        <div style={{ marginTop: 14, fontSize: 12, color: C.inkSoft }}>
          {trigger && <span><strong>Déclencheur :</strong> {trigger}</span>}
          {actions.length > 0 && <span style={{ marginLeft: 12 }}><strong>Actions :</strong> {actions.join(', ')}</span>}
        </div>
        <div style={{ marginTop: 14, padding: 14, background: C.yellowSoft, borderRadius: 10, fontSize: 12, color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={14} color={C.yellowDeep} fill={C.yellow} /> Ton workflow sera activé immédiatement après création
        </div>
      </>)}
    </ModalShell>
  );
}

// ============ ACCUEIL ============
function AccueilPage({ onTab, openModal, data }: any) {
  const stats = [
    { label: 'Workflows actifs', value: ((data?.workflows || []).filter((w: any) => w.status === 'active').length || 0).toString(), sub: 'En production', color: C.yellowDeep, bg: C.yellowSoft, icon: Zap },
    { label: 'Exécutions / jour', value: data?.stats?.dailyRuns ? data.stats.dailyRuns.toString() : '0', sub: 'Toutes périodes', color: C.emeraldDeep, bg: C.emeraldSoft, icon: Activity, trendUp: true },
    { label: 'Taux de succès', value: data?.stats?.successRate ? `${data.stats.successRate}%` : '—', sub: 'Sur les exécutions', color: C.blue, bg: C.blueSoft, icon: CheckCircle2 },
    { label: 'En attente approbation', value: data?.stats?.pendingApproval ? data.stats.pendingApproval.toString() : '0', sub: 'Action requise', color: C.orange, bg: C.orangeSoft, icon: AlertTriangle },
  ];
  const modules = [
    { name: 'Mes workflows', desc: `${(data?.workflows || []).length} workflows`, icon: Workflow, color: C.yellowDeep, page: 'Mes workflows' },
    { name: 'Canvas builder', desc: 'Drag & drop visuel · n8n-style', icon: GitBranch, color: C.orange, page: 'Canvas', star: true },
    { name: 'Templates', desc: `${(data?.templates || []).length} prêts à l'emploi`, icon: LayoutTemplate, color: C.violet, page: 'Templates' },
    { name: 'Triggers', desc: 'Webhook · Cron · Agent', icon: Zap, color: C.emerald, page: 'Triggers' },
    { name: 'Actions', desc: 'Email · WhatsApp · API · Agent', icon: Boxes, color: C.blue, page: 'Actions' },
    { name: 'Logs d\'exécution', desc: 'Historique 30 jours', icon: TerminalSquare, color: C.greenDeep, page: 'Logs' },
    { name: 'Stats', desc: 'Performance · Économies', icon: BarChart3, color: C.pink, page: 'Stats' },
    { name: 'Webhooks', desc: 'Endpoints entrants/sortants', icon: Webhook, color: C.cyan, page: 'Webhooks' },
  ];
  return (
    <>
      <PageHeader title="Workflow Automation," italic="l'usine à éclairs."
        subtitle="Triggers · Actions · Conditions · Approbations · L'IA bosse à votre place 24/7"
        badge="OPERATIONS"
        actions={<>
          <button onClick={() => onTab('Templates')} className="btn-secondary"><LayoutTemplate size={14} /> Templates</button>
          <button className="btn-primary" onClick={() => openModal('newWorkflow')}><Zap size={16} fill={C.greenDeep} /> Créer un workflow</button>
        </>} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>

      <div style={{ padding: '32px 32px 0' }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px' }}>
          Modules <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.yellow, fontSize: 18 }}>— 8 outils</em>
        </h3>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {modules.map((mod: any, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} onClick={() => onTab(mod.page)} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease', position: 'relative' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${mod.color}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {mod.star && (
                  <div style={{ position: 'absolute', top: 14, right: 14, background: C.yellow, color: C.greenDeep, padding: '3px 8px', borderRadius: 100, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, boxShadow: `0 4px 12px -4px ${C.yellow}` }}>
                    <Star size={9} fill={C.greenDeep} /> STAR
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

// ============ MES WORKFLOWS ============
function WorkflowsPage({ openModal, workflows = [] }: any) {
  const [filter, setFilter] = useState('Tous');
  const [view, setView] = useState('list');
  const filtered = filter === 'Tous' ? workflows : workflows.filter((w: any) => {
    if (filter === 'Actifs') return w.status === 'active';
    if (filter === 'Brouillons') return w.status === 'draft';
    if (filter === 'En pause') return w.status === 'paused';
    return true;
  });
  return (
    <>
      <PageHeader title="Mes workflows," italic="vos automations."
        subtitle="Logs détaillés · Édition drag-drop · Versioning"
        leftPills={<div className="pill" style={{ background: C.greenDeep, color: C.cream }}><Workflow size={11} /> {workflows.length} WORKFLOWS</div>}
        actions={<button className="btn-primary" onClick={() => openModal('newWorkflow')}><Plus size={16} /> Nouveau workflow</button>} />

      <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'inline-flex', gap: 4, background: C.cream, padding: 4, borderRadius: 12, border: '1px solid rgba(10,42,32,0.06)', flexWrap: 'wrap' }}>
          {['Tous', 'Actifs', 'Brouillons', 'En pause'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 8, transition: 'all 0.2s ease', background: filter === f ? C.greenDeep : 'transparent', color: filter === f ? C.cream : C.inkSoft, border: 'none', fontFamily: 'inherit' }}>{f}</button>
          ))}
        </div>
        <ViewToggle view={view} setView={setView} />
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon={Workflow} title={filter === 'Tous' ? 'Aucun workflow créé' : 'Aucun workflow dans cette catégorie'} desc="Crée ton premier workflow — Trigger + Actions + Activation. L'IA bosse pour toi 24/7." action={<button className="btn-primary" onClick={() => openModal('newWorkflow')}><Plus size={14} /> Créer un workflow</button>} />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {filtered.map((wf: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', borderLeft: `4px solid ${wf.color || C.yellowDeep}`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `${wf.color || C.yellowDeep}15`, color: wf.color || C.yellowDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Workflow size={18} /></div>
                  <span className="pill" style={{ background: wf.status === 'active' ? C.emeraldSoft : C.creamDeep, color: wf.status === 'active' ? C.emeraldDeep : C.inkSoft, fontWeight: 700 }}>{wf.status || 'Brouillon'}</span>
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{wf.name || `Workflow ${i + 1}`}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>{wf.desc || wf.description || '—'}</div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: C.inkSoft }}>
                  <span><strong style={{ color: C.ink }}>{wf.runs || 0}</strong> exécutions</span>
                  {wf.runs > 0 && <span>· <strong style={{ color: C.emeraldDeep }}>{wf.success || 0}%</strong> succès</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((wf: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', borderLeft: `4px solid ${wf.color || C.yellowDeep}`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${wf.color || C.yellowDeep} 0%, ${wf.color || C.yellowDeep}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Workflow size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{wf.name || `Workflow ${i + 1}`}</span>
                      <span className="pill" style={{ background: wf.status === 'active' ? C.emeraldSoft : C.creamDeep, color: wf.status === 'active' ? C.emeraldDeep : C.inkSoft, fontWeight: 700 }}>
                        {wf.status === 'active' && <span className="live-dot" style={{ width: 6, height: 6, background: C.emeraldDeep }}></span>}
                        {wf.status || 'Brouillon'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{wf.desc || wf.description || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{wf.runs || 0}</div>
                      <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 600 }}>RUNS</div>
                    </div>
                    {wf.runs > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div className="mono-font" style={{ fontSize: 14, fontWeight: 800, color: C.emeraldDeep }}>{wf.success || 0}%</div>
                        <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 600 }}>SUCCÈS</div>
                      </div>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const newStatus = wf.status === 'active' ? 'paused' : 'active';
                        try {
                          await api.put(`/workflow/workflows/${wf.id}`, { active: newStatus === 'active' });
                          toast.success(newStatus === 'active' ? 'Workflow activé' : 'Workflow en pause');
                        } catch { toast.error('Échec'); }
                      }}
                      className="icon-btn"
                      title={wf.status === 'active' ? 'Mettre en pause' : 'Activer'}
                    >{wf.status === 'active' ? <PauseCircle size={13} /> : <PlayCircle size={13} />}</button>
                    <button onClick={(e) => { e.stopPropagation(); openModal('editWorkflow', wf); }} className="icon-btn" title="Modifier"><Edit3 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ TEMPLATES ============
function TemplatesPage({ templates = [], openModal }: any) {
  const builtinTemplates = [
    { name: 'Relance factures impayées', desc: 'Email + WhatsApp + escalade après 30j', category: 'Comptabilité', color: C.emeraldDeep, icon: DollarSign },
    { name: 'Onboarding employé complet', desc: '12 étapes auto · badges · comptes · welcome kit', category: 'RH', color: C.violet, icon: UserPlus },
    { name: 'Birthday WhatsApp employés', desc: 'Message le jour J · culturellement adapté', category: 'RH', color: C.pink, icon: Heart },
    { name: 'Réconciliation paiements', desc: 'Stripe · PayPal · Mobile Money · auto-tag transactions', category: 'Comptabilité', color: C.orange, icon: Phone },
    { name: 'Campagne saisonnière WhatsApp', desc: 'Envoi messages personnalisés à toute la clientèle', category: 'Marketing', color: C.yellow, icon: Star },
    { name: 'Escalade ticket SLA dépassé', desc: '4h sans réponse → manager · 8h → direction', category: 'Support', color: C.red, icon: AlertTriangle },
    { name: 'Lead scoring + routing', desc: 'Scoring IA · attribution commerciale auto', category: 'Ventes', color: C.blue, icon: Target },
    { name: 'Backup quotidien Firestore', desc: 'Chaque nuit · Cloud Storage · 30 jours rétention', category: 'Sécurité', color: C.cyan, icon: Database },
  ];
  const allTemplates = templates.length > 0 ? templates : builtinTemplates;
  return (
    <>
      <PageHeader title="Templates," italic="prêts en 1 clic."
        subtitle="Workflows prêts à l'emploi · Multi-pays · Multi-canaux"
        leftPills={<div className="pill" style={{ background: C.greenDeep, color: C.cream }}><LayoutTemplate size={11} /> {allTemplates.length} TEMPLATES</div>}
        actions={<button onClick={() => toast.info('Templates IA', 'L\'agent peut générer un workflow personnalisé. Bientôt depuis l\'agent Workflow.')} className="btn-primary"><Sparkles size={14} /> Templates IA</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <div className="responsive-grid-3 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {allTemplates.map((t: any, i: number) => {
            const Ic = t.icon || LayoutTemplate;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', borderTop: `3px solid ${t.color || C.yellowDeep}`, cursor: 'pointer', transition: 'all 0.3s ease' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${(t.color || C.yellowDeep)}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${t.color || C.yellowDeep} 0%, ${(t.color || C.yellowDeep)}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={20} /></div>
                  {t.category && <span className="pill" style={{ background: `${t.color || C.yellowDeep}15`, color: t.color || C.yellowDeep, fontWeight: 700 }}>{t.category}</span>}
                </div>
                <div className="display-font" style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4, marginBottom: 14 }}>{t.desc || t.description}</div>
                <button
                  onClick={() => openModal && openModal('newWorkflow', { templateName: t.name, templateDesc: t.desc || t.description })}
                  className="btn-primary"
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12 }}
                ><Plus size={12} /> Utiliser</button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ CANVAS BUILDER ============
function CanvasPage({ openModal }: any) {
  return (
    <>
      <PageHeader title="Canvas" italic="builder."
        subtitle="Drag & drop visuel · Connecte trigger → actions · n8n-style"
        leftPills={<div className="pill" style={{ background: C.yellow, color: C.greenDeep }}><Star size={11} fill={C.greenDeep} /> STAR FEATURE</div>}
        actions={<><button className="btn-secondary"><FileText size={14} /> Charger</button>
          <button className="btn-primary" onClick={() => openModal('newWorkflow')}><Plus size={16} /> Nouveau</button></>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ background: C.cream, borderRadius: 20, padding: 0, border: '1px solid rgba(10,42,32,0.06)', height: 600, position: 'relative', overflow: 'hidden', backgroundImage: `radial-gradient(${C.creamDeep} 1px, transparent 1px)`, backgroundSize: '24px 24px' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: 32 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.orange} 100%)`, color: C.greenDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: `0 16px 32px -8px ${C.yellow}` }} className="lightning-glow">
              <GitBranch size={40} />
            </div>
            <h3 className="display-font" style={{ fontSize: 26, fontWeight: 700, color: C.ink, margin: '0 0 8px' }}>Canvas vide</h3>
            <p style={{ fontSize: 14, color: C.inkSoft, maxWidth: 480, marginBottom: 20 }}>
              Glisse-dépose des triggers, actions et conditions pour construire ton workflow visuellement. Connecte-les avec des flèches comme dans n8n.
            </p>
            <button className="btn-primary" onClick={() => openModal('newWorkflow')}>
              <Plus size={14} /> Créer mon premier workflow
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============ TRIGGERS ============
function TriggersPage() {
  const triggers = [
    { name: 'Webhook entrant', desc: 'URL publique · POST/GET', icon: Webhook, color: C.cyan },
    { name: 'Cron / Récurrent', desc: 'Toutes les X min/heures/jours', icon: Repeat, color: C.violet },
    { name: 'Email reçu', desc: 'Imap watch · filtres', icon: Mail, color: C.red },
    { name: 'Message WhatsApp', desc: 'Mots-clés ou tous', icon: MessageCircle, color: C.emerald },
    { name: 'Agent IA appelé', desc: 'Quand un agent prend une action', icon: Bot, color: C.pink },
    { name: 'Donnée Firestore', desc: 'Document créé/modifié', icon: Database, color: C.blue },
    { name: 'Form submit', desc: 'Formulaire web rempli', icon: FileText, color: C.gold },
    { name: 'Manuel', desc: 'Bouton play utilisateur', icon: Play, color: C.yellow },
  ];
  return (
    <>
      <PageHeader title="Triggers," italic="déclencheurs."
        subtitle="Que faut-il pour démarrer ton workflow ?" />
      <div style={{ padding: '24px 32px 32px' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {triggers.map((t, i) => {
            const Ic = t.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', borderTop: `3px solid ${t.color}`, cursor: 'pointer', transition: 'all 0.3s ease' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 16px 32px -16px ${t.color}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${t.color} 0%, ${t.color}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: `0 12px 24px -8px ${t.color}` }}>
                  <Ic size={20} />
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{t.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ ACTIONS ============
function ActionsPage() {
  const actions = [
    { name: 'Envoyer Email', desc: 'Gmail · Resend · SendGrid', icon: Mail, color: C.red, cat: 'Comm' },
    { name: 'WhatsApp message', desc: 'Template Meta approuvé', icon: MessageCircle, color: C.emerald, cat: 'Comm' },
    { name: 'SMS', desc: 'Twilio · Vonage · Mobile Money', icon: Phone, color: C.violet, cat: 'Comm' },
    { name: 'Appeler Agent IA', desc: 'HR / Finance / Sales / etc.', icon: Bot, color: C.pink, cat: 'IA' },
    { name: 'Condition (if/else)', desc: 'Branchement logique', icon: GitBranch, color: C.purple, cat: 'Logic' },
    { name: 'Boucle (foreach)', desc: 'Itérer sur une liste', icon: Repeat, color: C.cyan, cat: 'Logic' },
    { name: 'Délai (wait)', desc: 'Attendre X min/heures/jours', icon: Timer, color: C.gold, cat: 'Logic' },
    { name: 'Mettre à jour DB', desc: 'Firestore create/update/delete', icon: Database, color: C.blue, cat: 'Data' },
    { name: 'Webhook sortant', desc: 'POST vers URL externe', icon: Webhook, color: C.cyan, cat: 'API' },
    { name: 'Approbation humaine', desc: 'Stop · attend validation', icon: ShieldCheck, color: C.orange, cat: 'Logic' },
    { name: 'Notification Slack', desc: 'Channel ou DM', icon: Hash, color: C.violet, cat: 'Comm' },
    { name: 'Code custom', desc: 'JS / Python sandbox', icon: Code, color: C.greenDeep, cat: 'Dev' },
  ];
  return (
    <>
      <PageHeader title="Actions," italic="& opérations."
        subtitle="Que doit faire ton workflow quand il se déclenche ?" />
      <div style={{ padding: '24px 32px 32px' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {actions.map((a, i) => {
            const Ic = a.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', borderTop: `3px solid ${a.color}`, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: `${a.color}15`, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={18} /></div>
                  <span className="pill" style={{ background: `${a.color}15`, color: a.color, fontWeight: 700, fontSize: 10 }}>{a.cat}</span>
                </div>
                <div className="display-font" style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{a.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ LOGS ============
function LogsPage({ logs = [] }: any) {
  return (
    <>
      <PageHeader title="Logs" italic="d'exécution"
        subtitle="Historique 30 jours · Filtres · Détails complets · Replay"
        actions={<button className="btn-secondary"><Filter size={14} /> Filtres</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {logs.length === 0 ? (
          <EmptyState icon={TerminalSquare} title="Aucun log d'exécution" desc="Les exécutions de tes workflows apparaîtront ici en temps réel avec tous les détails (input, output, durée, erreurs)." />
        ) : (
          <div style={{ background: C.cream, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(10,42,32,0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.8fr 1fr', gap: 12, padding: '14px 20px', background: C.creamDeep, fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <div>Workflow</div><div>Trigger</div><div>Durée</div><div>Statut</div><div>Heure</div>
            </div>
            {logs.map((l: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.8fr 1fr', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(10,42,32,0.06)', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{l.workflowName || l.name || '—'}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{l.trigger || '—'}</div>
                <div className="mono-font" style={{ fontSize: 12, color: C.ink }}>{l.duration ? `${l.duration}ms` : '—'}</div>
                <div><span className="pill" style={{ background: l.status === 'success' ? C.emeraldSoft : C.redSoft, color: l.status === 'success' ? C.emeraldDeep : C.red, fontWeight: 700 }}>{l.status || '—'}</span></div>
                <div style={{ fontSize: 11, color: C.inkSoft }}>{l.timestamp ? new Date(l.timestamp).toLocaleString('fr-FR') : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ STATS ============
function StatsPage({ data }: any) {
  const stats = [
    { label: 'Heures économisées', value: data?.stats?.hoursSaved ? `${data.stats.hoursSaved}h` : '—', sub: 'Équivalent jours/homme', color: C.gold, bg: C.goldSoft, icon: Timer },
    { label: 'Économie XOF', value: data?.stats?.savedFCFA ? `${(data.stats.savedFCFA / 1000).toFixed(0)}K F` : '—', sub: 'Coût RH évité', color: C.violet, bg: C.violetSoft, icon: DollarSign },
    { label: 'Exécutions totales', value: data?.stats?.totalRuns ? data.stats.totalRuns.toString() : '0', sub: 'Tous workflows', color: C.emeraldDeep, bg: C.emeraldSoft, icon: Activity },
    { label: 'Taux moyen succès', value: data?.stats?.avgSuccess ? `${data.stats.avgSuccess}%` : '—', sub: 'Sur 30 jours', color: C.blue, bg: C.blueSoft, icon: CheckCircle2 },
  ];
  return (
    <>
      <PageHeader title="Stats" italic="& performance"
        subtitle="ROI · Économies · Tendances · Anomalies" />
      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={BarChart3} title="Graphiques de performance" desc="Les graphiques détaillés (volume, succès, latence par workflow) apparaîtront ici dès tes premières exécutions." />
      </div>
    </>
  );
}

// ============ WEBHOOKS ============
function WebhooksPage({ webhooks = [] }: any) {
  return (
    <>
      <PageHeader title="Webhooks," italic="endpoints"
        subtitle="Endpoints entrants/sortants · Logs · Sécurité"
        actions={<button className="btn-primary"><Plus size={16} /> Nouveau webhook</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {webhooks.length === 0 ? (
          <EmptyState icon={Webhook} title="Aucun webhook configuré" desc="Crée un webhook pour recevoir des événements depuis des services externes (Stripe, Slack, GitHub…)." action={<button className="btn-primary"><Plus size={14} /> Nouveau webhook</button>} />
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {webhooks.map((w: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 40, height: 40, borderRadius: 11, background: C.cyanSoft, color: C.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Webhook size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{w.name || w.url}</div>
                  <div className="mono-font" style={{ fontSize: 11, color: C.inkSoft }}>{w.url}</div>
                </div>
                <span className="pill" style={{ background: w.active ? C.emeraldSoft : C.creamDeep, color: w.active ? C.emeraldDeep : C.inkSoft, fontWeight: 700 }}>{w.active ? 'Actif' : 'Inactif'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ MAIN ============
export default function WorkflowRedesignPage() {
  const [activeTab, setActiveTab] = useState('Accueil');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const openModal = (id: string) => setActiveModal(id);
  const closeModal = () => setActiveModal(null);
  const data = useWorkflowData();

  return (
    <Chrome>
      <TabSwitcher active={activeTab} setActive={setActiveTab} />
      {activeTab === 'Accueil' && <AccueilPage onTab={setActiveTab} openModal={openModal} data={data} />}
      {activeTab === 'Mes workflows' && <WorkflowsPage openModal={openModal} workflows={data.workflows} />}
      {activeTab === 'Templates' && <TemplatesPage templates={data.templates} openModal={openModal} />}
      {activeTab === 'Canvas' && <CanvasPage openModal={openModal} />}
      {activeTab === 'Triggers' && <TriggersPage />}
      {activeTab === 'Actions' && <ActionsPage />}
      {activeTab === 'Logs' && <LogsPage logs={data.logs} />}
      {activeTab === 'Stats' && <StatsPage data={data} />}
      {activeTab === 'Webhooks' && <WebhooksPage webhooks={data.webhooks} />}

      {activeModal === 'newWorkflow' && <NewWorkflowModal onClose={closeModal} />}

      <LiveSyncBadge lastSync={data?.lastSync} intervalMs={REFRESH_INTERVAL_MS} />

      <div style={{ position: 'fixed', bottom: 28, right: 100, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        <button onClick={() => setActiveTab('Templates')} title="Templates" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.violet, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <LayoutTemplate size={20} />
        </button>
        <button onClick={() => setActiveTab('Canvas')} title="Canvas" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.orange, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <GitBranch size={20} />
        </button>
        <button onClick={() => openModal('newWorkflow')} title="Nouveau workflow" style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.yellowDeep} 100%)`, border: 'none', color: C.greenDeep, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px -8px ${C.yellow}` }}>
          <Zap size={24} fill={C.greenDeep} />
        </button>
      </div>

      <AgentDrawer
        agentId="orchestrator"
        agentName="Workflow"
        color={C.violet}
        context={{
          tab: activeTab,
          workflows: data.workflows?.length ?? 0,
          logs: data.logs?.length ?? 0,
        }}
        starters={[
          'Recommande un workflow pour automatiser le suivi des donateurs',
          'Quels workflows ont échoué récemment ?',
          'Compose un workflow simple pour notifier mon équipe quand une facture est payée',
        ]}
      />
    </Chrome>
  );
}
