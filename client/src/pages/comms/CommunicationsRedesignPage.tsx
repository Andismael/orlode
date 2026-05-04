import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import AgentDrawer from '@/components/ai/AgentDrawer';
import { toast } from '@/components/common/Toast';
import {
  Search, Bell, ChevronDown, ChevronRight, ArrowRight, ArrowUpRight,
  Inbox, MessageSquare, MessageCircle, Mail, Send, Smartphone, Hash, Bot,
  Plus, Filter, MoreHorizontal, Sparkles, Wand2, X,
  CheckCircle2, Clock, AlertCircle, AlertTriangle, FileText, Eye, Trash2,
  Reply, Forward, Megaphone, Star, Bookmark, Archive, Pin,
  Download, Upload, Copy, Paperclip, BookTemplate, Layers,
  Activity, RefreshCw, TrendingUp, Users, Globe, Languages, Clock, Star,
  Settings, Lock, Shield,
  PenLine, Rocket, Zap, BookOpen,
  Phone, AtSign, LayoutGrid, List as ListIcon
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E', greenMid: '#0F6B52', greenSoft: '#E8F5EE',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  pink: '#EC4899', pinkDeep: '#DB2777', pinkSoft: '#FCE7F3', pinkMid: '#F9A8D4',
  whatsapp: '#25D366', whatsappSoft: '#DCF8E1',
  telegram: '#0088CC', telegramSoft: '#D5EAF7',
  sms: '#7C3AED', smsSoft: '#EDE9FE',
  email: '#EA4335', emailSoft: '#FEE5E2',
  slack: '#4A154B', slackSoft: '#EAD7EB',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#EF4444', redSoft: '#FEE2E2',
  yellow: '#F59E0B', yellowSoft: '#FEF3C7',
  purple: '#8B5CF6', purpleSoft: '#EDE9FE',
  cyan: '#06B6D4', cyanSoft: '#CFFAFE',
  teal: '#14B8A6', tealSoft: '#CCFBF1',
  gold: '#D4A017', goldSoft: '#FEF3C7',
  ink: '#0A2A20', inkSoft: '#5A6B62',
  onGreenSoft: '#A8C9B8',
};

const CHANNELS: any = {
  whatsapp: { name: 'WhatsApp', color: C.whatsapp, soft: C.whatsappSoft, icon: MessageCircle, label: 'WA' },
  telegram: { name: 'Telegram', color: C.telegram, soft: C.telegramSoft, icon: Send, label: 'TG' },
  sms: { name: 'SMS', color: C.sms, soft: C.smsSoft, icon: Smartphone, label: 'SMS' },
  email: { name: 'Email', color: C.email, soft: C.emailSoft, icon: Mail, label: 'Email' },
  slack: { name: 'Slack', color: C.slack, soft: C.slackSoft, icon: Hash, label: 'Slack' },
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
  .tab-btn.active { background: ${C.pink}; color: ${C.cream}; box-shadow: 0 4px 14px -4px rgba(236, 72, 153, 0.5); }
  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.pink}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.pink}; opacity: 0.4; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  .row-card { background: ${C.cream}; border-radius: 16px; padding: 18px 20px; border: 1px solid rgba(10,42,32,0.06); transition: all 0.2s ease; cursor: pointer; display: flex; align-items: center; gap: 16px; }
  .row-card:hover { transform: translateX(4px); border-color: ${C.pink}; box-shadow: 0 12px 24px -12px rgba(236, 72, 153, 0.25); }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.pinkSoft}; color: ${C.pinkDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.pink}; color: ${C.cream}; }
  .btn-primary { background: ${C.pink}; color: ${C.cream}; border: none; padding: 12px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px rgba(236, 72, 153, 0.5); font-family: inherit; }
  .btn-primary:hover { background: ${C.pinkDeep}; transform: translateY(-2px); }
  .btn-secondary { background: ${C.cream}; color: ${C.greenDeep}; border: 1px solid rgba(10,42,32,0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }
  .avatar { border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-weight: 700; color: ${C.cream}; flex-shrink: 0; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; } .stagger > *:nth-child(2) { animation-delay: 0.1s; } .stagger > *:nth-child(3) { animation-delay: 0.15s; } .stagger > *:nth-child(4) { animation-delay: 0.2s; } .stagger > *:nth-child(5) { animation-delay: 0.25s; } .stagger > *:nth-child(6) { animation-delay: 0.3s; }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-charts { grid-template-columns: 1fr !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } .inbox-grid { grid-template-columns: 1fr !important; height: auto !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .hero-title { font-size: 32px !important; } .hide-on-mobile { display: none !important; } }
  @media (max-width: 480px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .hero-title { font-size: 26px !important; } }
  .modal-overlay { position: fixed; inset: 0; background: rgba(10, 42, 32, 0.7); backdrop-filter: blur(8px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-content { background: ${C.cream}; border-radius: 24px; width: 100%; max-width: 720px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 40px 80px -20px rgba(0,0,0,0.5); animation: modalSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  @keyframes modalSlide { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .form-input { width: 100%; background: ${C.cream}; border: 1.5px solid rgba(10,42,32,0.1); border-radius: 10px; padding: 11px 14px; font-size: 14px; color: ${C.ink}; font-family: inherit; outline: none; transition: all 0.2s ease; }
  .form-input:focus { border-color: ${C.pink}; box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.15); }
  .form-label { display: block; font-size: 11px; font-weight: 700; color: ${C.ink}; letter-spacing: 0.05em; margin-bottom: 6px; text-transform: uppercase; }
  .form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .bubble-in { background: ${C.cream}; border: 1px solid rgba(10,42,32,0.06); border-radius: 14px 14px 14px 4px; padding: 10px 14px; max-width: 70%; }
  .bubble-out { background: linear-gradient(135deg, ${C.pink}, ${C.pinkDeep}); color: ${C.cream}; border-radius: 14px 14px 4px 14px; padding: 10px 14px; max-width: 70%; }
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

function useCommsData() {
  const [data, setData] = useState<any>({
    inbox: [], sent: [], drafts: [], archived: [],
    waMessages: [], waStatus: null, waStats: null,
    chatConversations: [], emailStats: null, templates: [],
    loaded: false, lastSync: null,
  });

  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/emails/inbox'),
    safeGet('/emails/sent'),
    safeGet('/emails/drafts'),
    safeGet('/emails/archived'),
    safeGet('/whatsapp/messages'),
    safeGet('/whatsapp/status'),
    safeGet('/whatsapp/stats'),
    safeGet('/chat/conversations'),
    safeGet('/emails/stats/overview'),
    safeGet('/emails/templates/list'),
  ]).then(([inb, snt, drf, arc, wam, was, wast, conv, est, tpl]) => {
    if (!mountedRef.current) return;
    setData({
      inbox: inb?.emails ?? inb ?? [],
      sent: snt?.emails ?? snt ?? [],
      drafts: drf?.emails ?? drf ?? [],
      archived: arc?.emails ?? arc ?? [],
      waMessages: wam?.messages ?? wam ?? [],
      waStatus: was ?? null,
      waStats: wast ?? null,
      chatConversations: conv?.conversations ?? conv ?? [],
      emailStats: est ?? null,
      templates: tpl?.templates ?? tpl ?? [],
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
    <div style={{ position: 'fixed', bottom: 28, left: 28, zIndex: 50, background: 'rgba(10, 42, 32, 0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${C.pink}40`, padding: '8px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 8, color: C.cream, fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)' }}>
      <span className="live-dot"></span>
      <span style={{ color: C.pinkMid }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>sync · {secondsAgo}s · refresh {intervalMs / 1000}s</span>
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title = 'Pas encore de données', desc = '', action = null }: any) {
  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: '48px 32px', border: '1px dashed rgba(10,42,32,0.15)', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: C.pinkSoft, color: C.pinkDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
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
      <div className="grain" style={{ background: `linear-gradient(135deg, ${C.pink} 0%, ${C.pinkDeep} 100%)`, borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden', color: C.cream, boxShadow: `0 30px 60px -20px rgba(236, 72, 153, 0.4)` }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.18 }} width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r="120" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="80" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="140" cy="140" r="40" stroke={C.greenDeep} strokeWidth="2" fill="none" />
          <circle cx="140" cy="140" r="14" fill={C.greenDeep} />
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              {leftPills}
              {badge && (<div className="pill" style={{ background: C.greenDeep, color: C.cream }}><span className="live-dot" style={{ background: C.cream }}></span>{badge}</div>)}
            </div>
            <h1 className="display-font hero-title" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.cream, letterSpacing: '-0.03em' }}>
              {title} {italic && <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.greenDeep }}>{italic}</em>}
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
    { label: 'PILOTAGE', tabs: ['Accueil', 'Inbox unifié', 'Threads agents'] },
    { label: 'CANAUX', tabs: ['Email', 'WhatsApp', 'SMS', 'Telegram', 'Slack'] },
    { label: 'AUTOMATION', tabs: ['Campagnes', 'Templates', 'Auto-réponses'] },
    { label: 'IA & DATA', tabs: ['Rédaction IA', 'Contacts', 'Rapports'] },
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

function ModalShell({ title, subtitle, icon: Icon, color = C.pink, onClose, children, footer, size = 'md' }: any) {
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

function ChannelsActiveBanner({ waStatus }: any) {
  const channels = [
    { ...CHANNELS.whatsapp, status: waStatus?.connected ? 'connected' : 'warning' },
    { ...CHANNELS.telegram, status: 'connected' },
    { ...CHANNELS.sms, status: 'connected' },
    { ...CHANNELS.email, status: 'connected' },
    { ...CHANNELS.slack, status: 'warning' },
  ];
  return (
    <div style={{ padding: '20px 32px 0' }}>
      <div style={{ background: `linear-gradient(135deg, ${C.greenDark} 0%, ${C.greenDeep} 100%)`, borderRadius: 16, padding: '16px 20px', color: C.cream, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.pink}25`, border: `1px solid ${C.pink}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
          <Layers size={18} color={C.pinkMid} strokeWidth={1.75} />
          <span className="live-dot" style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8 }}></span>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.pinkMid, letterSpacing: '0.08em', marginBottom: 6 }}>CANAUX UNIFIÉS · 5 INTÉGRATIONS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {channels.map((ch: any) => {
              const Icon = ch.icon;
              return (
                <div key={ch.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${ch.color}25`, border: `1px solid ${ch.color}40`, padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, color: C.cream }}>
                  <Icon size={12} color={ch.color} />{ch.name}
                  {ch.status === 'connected' ? <CheckCircle2 size={10} color={C.emerald} /> : <AlertCircle size={10} color={C.yellow} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MODALS ============
function ComposeEmailModal({ onClose }: any) {
  const [generating, setGenerating] = useState(false);
  const [body, setBody] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/emails/generate', { prompt: subject || 'Email professionnel de relance' });
      setBody((res?.data as any)?.body || '');
    } catch (e: any) {
      toast.error('Erreur génération', e?.response?.data?.message || 'IA indisponible.');
    }
    setGenerating(false);
  };
  const submit = async () => {
    if (submitting) return;
    if (!to.trim()) { toast.error('Destinataire requis'); return; }
    if (!subject.trim()) { toast.error('Sujet requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/emails/compose', { to, cc, subject, body });
      toast.success('Email envoyé');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible d\'envoyer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouveau message" subtitle="Email · IA disponible" icon={PenLine} color={C.email} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Brouillon</button>
        <button className="btn-primary" style={{ background: C.email }} disabled={submitting} onClick={submit}><Send size={14} /> {submitting ? 'Envoi…' : 'Envoyer'}</button></>}>
      <div className="form-row">
        <div><label className="form-label">À</label><input className="form-input" placeholder="destinataire@email.com" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div><label className="form-label">CC</label><input className="form-input" placeholder="(optionnel)" value={cc} onChange={e => setCc(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Sujet</label><input className="form-input" placeholder="Objet du message" value={subject} onChange={e => setSubject(e.target.value)} />
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="form-label" style={{ marginBottom: 0 }}>Corps du message</label>
        <button onClick={generate} disabled={generating} style={{ background: C.purple, color: C.cream, border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: generating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
          <Wand2 size={12} /> {generating ? 'Génération…' : 'Rédiger avec IA'}
        </button>
      </div>
      <textarea className="form-input" rows={10} value={body} onChange={(e: any) => setBody(e.target.value)} placeholder="Bonjour…" style={{ marginTop: 6 }}></textarea>
      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}><Paperclip size={12} /> Joindre</button>
        <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}><BookTemplate size={12} /> Template</button>
        <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}><Languages size={12} /> Traduire</button>
      </div>
    </ModalShell>
  );
}

function NewWhatsAppModal({ onClose }: any) {
  const [phone, setPhone] = useState('');
  const [template, setTemplate] = useState('welcome_message');
  const [variables, setVariables] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!phone.trim()) { toast.error('Numéro requis'); return; }
    setSubmitting(true);
    try {
      const params = variables.split(',').map(s => s.trim()).filter(Boolean);
      await api.post('/messaging/whatsapp/send', { to: phone, template, params });
      toast.success('WhatsApp envoyé');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Échec envoi.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Envoyer WhatsApp" subtitle="Template Meta approuvé" icon={MessageCircle} color={C.whatsapp} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.whatsapp }} disabled={submitting} onClick={submit}><Send size={14} /> {submitting ? 'Envoi…' : 'Envoyer'}</button></>}>
      <div className="form-row">
        <div><label className="form-label">Numéro destinataire</label><input className="form-input" placeholder="+225 07 00 00 00 00" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        <div><label className="form-label">Template</label>
          <select className="form-input" value={template} onChange={e => setTemplate(e.target.value)}>
            <option>welcome_message</option>
            <option>order_confirmation</option>
            <option>appointment_reminder</option>
            <option>otp_code</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Variables séparées par virgules ({"{{1}}"}, {"{{2}}"}…)</label>
        <input className="form-input" placeholder="Adelin, demain 14h" value={variables} onChange={e => setVariables(e.target.value)} />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Aperçu</label>
        <div style={{ background: '#E5DDD5', borderRadius: 12, padding: 16 }}>
          <div className="bubble-out" style={{ background: '#DCF8C6', color: C.ink, marginLeft: 'auto', display: 'block', maxWidth: '85%' }}>
            <div style={{ fontSize: 13 }}>Bonjour {"{{1}}"}, votre RDV est confirmé pour {"{{2}}"}.</div>
            <div style={{ fontSize: 10, color: C.inkSoft, textAlign: 'right', marginTop: 4 }}>Aperçu · ✓✓</div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function NewTemplateModal({ onClose }: any) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('Email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (submitting) return;
    if (!name.trim() || !body.trim()) { toast.error('Nom et corps requis'); return; }
    setSubmitting(true);
    try {
      await api.post('/emails/templates', { name, channel, subject, body });
      toast.success('Template créé');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de créer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouveau template" icon={BookTemplate} color={C.gold} onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" style={{ background: C.gold }} disabled={submitting} onClick={submit}><CheckCircle2 size={14} /> {submitting ? 'Création…' : 'Créer'}</button></>}>
      <div className="form-row">
        <div><label className="form-label">Nom</label><input className="form-input" placeholder="Bienvenue client" value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label className="form-label">Canal</label>
          <select className="form-input" value={channel} onChange={e => setChannel(e.target.value)}><option>Email</option><option>WhatsApp</option><option>SMS</option><option>Tous</option></select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Sujet (variables : {"{{nom}}"}, {"{{société}}"})</label>
        <input className="form-input" placeholder="Bienvenue chez {{société}} !" value={subject} onChange={e => setSubject(e.target.value)} />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Corps</label>
        <textarea className="form-input" rows={6} placeholder="Bonjour {{nom}}, ravi de vous compter parmi nous…" value={body} onChange={e => setBody(e.target.value)}></textarea>
      </div>
    </ModalShell>
  );
}

function NewCampaignModal({ onClose }: any) {
  const [channels, setChannels] = useState<string[]>(['email']);
  const [name, setName] = useState('');
  const [audience, setAudience] = useState('Tous les contacts');
  const [scheduledAt, setScheduledAt] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toggleChannel = (id: string) => setChannels(channels.includes(id) ? channels.filter(c => c !== id) : [...channels, id]);
  const submit = async () => {
    if (submitting) return;
    if (!name.trim() || !message.trim()) { toast.error('Nom et message requis'); return; }
    if (channels.length === 0) { toast.error('Choisis au moins un canal'); return; }
    setSubmitting(true);
    try {
      await api.post('/messaging/campaigns', { name, channels, audience, scheduledAt: scheduledAt || null, message });
      toast.success(scheduledAt ? 'Campagne planifiée' : 'Campagne lancée');
      onClose();
    } catch (e: any) {
      toast.error('Erreur', e?.response?.data?.message || 'Impossible de lancer.');
    } finally { setSubmitting(false); }
  };
  return (
    <ModalShell title="Nouvelle campagne" subtitle="Multi-canal · Segmentation" icon={Rocket} color={C.purple} onClose={onClose} size="lg"
      footer={<><button className="btn-secondary" onClick={onClose}>Brouillon</button>
        <button className="btn-primary" style={{ background: C.purple }} disabled={submitting} onClick={submit}><Rocket size={14} /> {submitting ? 'Envoi…' : (scheduledAt ? 'Planifier' : 'Lancer')}</button></>}>
      <div><label className="form-label">Nom</label><input className="form-input" placeholder="Promo Black Friday 2026" value={name} onChange={e => setName(e.target.value)} /></div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Canaux</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {Object.entries(CHANNELS).map(([id, ch]: [string, any]) => {
            const Ic = ch.icon;
            const active = channels.includes(id);
            return (
              <button key={id} onClick={() => toggleChannel(id)} style={{ background: active ? `${ch.color}20` : C.cream, border: `1.5px solid ${active ? ch.color : 'rgba(10,42,32,0.1)'}`, borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Ic size={16} color={ch.color} />
                <span style={{ fontSize: 10, fontWeight: 700, color: C.ink }}>{ch.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 14 }}>
        <div><label className="form-label">Audience</label>
          <select className="form-input" value={audience} onChange={e => setAudience(e.target.value)}><option>Tous les contacts</option><option>Clients actifs</option><option>Prospects</option><option>Segment custom</option></select>
        </div>
        <div><label className="form-label">Date d'envoi (vide = immédiat)</label><input type="datetime-local" className="form-input" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-label">Message</label>
        <textarea className="form-input" rows={5} placeholder="-50% sur tous les agents IA pendant 48h…" value={message} onChange={e => setMessage(e.target.value)}></textarea>
      </div>
    </ModalShell>
  );
}

// ============ PAGE 1: ACCUEIL ============
function AccueilPage({ onTab, openModal, data }: any) {
  const inboxCount = (data?.inbox || []).length;
  const sentCount = (data?.sent || []).length;
  const draftsCount = (data?.drafts || []).length;
  const waCount = (data?.waMessages || []).length;
  const emailStats = data?.emailStats || {};
  const stats = [
    { label: 'Messages aujourd\'hui', value: emailStats?.todayCount ?? (inboxCount + sentCount + waCount).toString(), sub: 'Multi-canaux', color: C.pink, bg: C.pinkSoft, icon: MessageSquare },
    { label: 'Taux de réponse', value: emailStats?.responseRate ? `${emailStats.responseRate}%` : '—', sub: 'Sous 1h en moyenne', color: C.emeraldDeep, bg: C.emeraldSoft, icon: Reply },
    { label: 'Brouillons', value: draftsCount.toString(), sub: 'À finaliser', color: C.gold, bg: C.goldSoft, icon: PenLine },
    { label: 'Non lus', value: emailStats?.unread ?? '—', sub: 'À traiter', color: C.red, bg: C.redSoft, icon: AlertCircle },
  ];
  const modules = [
    { name: 'Inbox unifié', desc: 'Tous canaux dans un seul flux', icon: Inbox, color: C.pink, page: 'Inbox unifié', live: true },
    { name: 'Email', desc: `${inboxCount} dans la boîte`, icon: Mail, color: C.email, page: 'Email' },
    { name: 'WhatsApp', desc: `${waCount} messages`, icon: MessageCircle, color: C.whatsapp, page: 'WhatsApp' },
    { name: 'SMS', desc: 'Orange CI · MTN · Twilio', icon: Smartphone, color: C.sms, page: 'SMS' },
    { name: 'Telegram', desc: 'Bot officiel · Channels', icon: Send, color: C.telegram, page: 'Telegram' },
    { name: 'Slack', desc: 'Workspace équipe', icon: Hash, color: C.slack, page: 'Slack' },
    { name: 'Templates', desc: `${(data?.templates || []).length} modèles`, icon: BookTemplate, color: C.gold, page: 'Templates' },
    { name: 'Campagnes', desc: 'Envoi en masse', icon: Megaphone, color: C.cyan, page: 'Campagnes' },
  ];
  const quickActions = [
    { title: 'Rédiger un email', desc: 'IA · Pro · Multi-langue', icon: PenLine, color: C.email, action: 'compose' },
    { title: 'Envoyer WhatsApp', desc: 'Template approuvé', icon: MessageCircle, color: C.whatsapp, action: 'whatsapp' },
    { title: 'Lancer campagne', desc: 'Multi-canaux ciblé', icon: Rocket, color: C.purple, action: 'campaign' },
    { title: 'Nouveau template', desc: 'Créer un modèle réutilisable', icon: BookTemplate, color: C.gold, action: 'template' },
    { title: 'Résumer mes emails', desc: 'IA · Synthèse intelligente', icon: Sparkles, color: C.cyan },
    { title: 'Traduire un message', desc: 'FR ↔ EN ↔ AR', icon: Languages, color: C.teal },
  ];
  return (
    <>
      <PageHeader title="Communications," italic="multi-canal."
        subtitle="WhatsApp · Telegram · SMS · Email · Slack — un seul flux, une seule IA, une seule discipline."
        badge="HUB AGENTS · LIVE"
        actions={<>
          <button className="btn-secondary" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream, border: '1px solid rgba(255,250,240,0.25)' }}><Wand2 size={14} /> Rédiger avec IA</button>
          <button className="btn-primary" style={{ background: C.greenDeep, boxShadow: '0 8px 24px -8px rgba(10, 79, 60, 0.6)' }} onClick={() => openModal('compose')}><Send size={16} /> Nouveau message</button>
        </>} />

      <ChannelsActiveBanner waStatus={data?.waStatus} />

      <div style={{ padding: '24px 32px 0' }}>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>
      </div>

      <div style={{ padding: '32px 32px 0' }}>
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: '0 0 16px' }}>
          Canaux & Modules <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.pinkMid, fontSize: 18 }}>— accès rapide</em>
        </h3>
        <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {modules.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <div key={idx} onClick={() => onTab(mod.page)} style={{ background: C.cream, borderRadius: 18, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease', position: 'relative' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = mod.color; e.currentTarget.style.boxShadow = `0 20px 40px -16px ${mod.color}40`; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {(mod as any).live && (
                  <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="live-dot"></span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.pinkDeep, letterSpacing: '0.08em' }}>LIVE</span>
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
          <Zap size={18} color={C.pink} />
          <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: 0 }}>
            Actions rapides <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.pinkMid, fontSize: 18 }}>— modals fonctionnelles</em>
          </h3>
        </div>
        <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {quickActions.map((qa, idx) => {
            const Icon = qa.icon;
            return (
              <div key={idx} onClick={() => qa.action && openModal(qa.action)} style={{ background: C.cream, borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(10,42,32,0.06)', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.2s ease' }}
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

// ============ INBOX UNIFIÉ ============
function InboxPage({ data }: any) {
  const [filter, setFilter] = useState('Tous');
  const [view, setView] = useState('list');

  const allItems: any[] = [
    ...(data?.inbox || []).map((m: any) => ({ ...m, channel: 'email', name: m.from || m.fromEmail || 'Inconnu', preview: m.subject || m.preview || '', time: m.date || m.timestamp || '' })),
    ...(data?.waMessages || []).map((m: any) => ({ ...m, channel: 'whatsapp', name: m.from || m.contact || m.phone || 'WhatsApp', preview: m.body || m.text || '', time: m.timestamp || '' })),
  ];
  const filtered = filter === 'Tous' ? allItems : allItems.filter(m => m.channel === filter.toLowerCase());

  const filters = [
    { name: 'Tous', icon: Inbox, count: allItems.length },
    { name: 'Email', icon: Mail, color: C.email, count: (data?.inbox || []).length },
    { name: 'Whatsapp', icon: MessageCircle, color: C.whatsapp, count: (data?.waMessages || []).length },
  ];

  return (
    <>
      <PageHeader title="Inbox" italic="unifié"
        subtitle="Tous tes messages — Email, WhatsApp, SMS… dans une seule vue"
        leftPills={<div className="pill" style={{ background: C.greenDeep, color: C.cream }}><Layers size={11} /> {allItems.length} MESSAGES</div>}
      />

      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filters.map(f => {
            const Ic = f.icon;
            const active = filter === f.name;
            return (
              <button key={f.name} onClick={() => setFilter(f.name)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: active ? (f.color || C.pink) : C.greenDark, color: C.cream, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                <Ic size={13} color={active ? C.cream : (f.color || C.onGreenSoft)} />
                {f.name} <span style={{ opacity: 0.7, fontFamily: 'JetBrains Mono' }}>{f.count}</span>
              </button>
            );
          })}
        </div>
        <ViewToggle view={view} setView={setView} />
      </div>

      <div style={{ padding: '16px 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyState icon={Inbox} title="Inbox vide" desc="Connecte tes canaux Email & WhatsApp dans Settings · Connectors. Les messages apparaîtront ici en temps réel." />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map((m: any, i: number) => {
              const ch = CHANNELS[m.channel] || CHANNELS.email;
              const Ic = ch.icon;
              return (
                <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ch.color }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div className="avatar" style={{ background: ch.color, width: 38, height: 38, fontSize: 13 }}>{(m.name || 'X').slice(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: C.inkSoft }}>{m.time ? new Date(m.time).toLocaleString('fr-FR') : ''}</div>
                    </div>
                    <div className="pill" style={{ background: ch.soft, color: ch.color, fontWeight: 700 }}><Ic size={10} />{ch.label}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{m.preview}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((m: any, i: number) => {
              const ch = CHANNELS[m.channel] || CHANNELS.email;
              const Ic = ch.icon;
              return (
                <div key={i} className="row-card">
                  <div className="avatar" style={{ background: ch.color, width: 42, height: 42, fontSize: 14 }}>{(m.name || 'X').slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{m.name}</span>
                      <span className="pill" style={{ background: ch.soft, color: ch.color, fontWeight: 700, fontSize: 10 }}><Ic size={9} />{ch.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.preview}</div>
                  </div>
                  <span style={{ fontSize: 11, color: C.inkSoft, whiteSpace: 'nowrap' }}>{m.time ? new Date(m.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  <button className="icon-btn"><Reply size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ============ THREADS AGENTS (agents talking) ============
function ThreadsAgentsPage({ data }: any) {
  const conversations = data?.chatConversations || [];
  return (
    <>
      <PageHeader title="Threads" italic="agents"
        subtitle="Conversations entre agents IA et humains — c'est ici que tes agents communiquent"
        badge="AGENTS-TO-HUMAN" />
      <div style={{ padding: '24px 32px 32px' }}>
        {conversations.length === 0 ? (
          <EmptyState icon={Bot} title="Aucune conversation agent" desc="Les conversations entre agents IA et humains apparaîtront ici. Active un agent pour démarrer." />
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conversations.map((c: any, i: number) => (
              <div key={i} className="row-card">
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.purple}15`, color: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{c.title || c.agentName || c.id || 'Conversation'}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft }}>{c.lastMessage || `${c.messageCount || 0} messages`}</div>
                </div>
                <span style={{ fontSize: 11, color: C.inkSoft }}>{c.updatedAt ? new Date(c.updatedAt).toLocaleString('fr-FR') : ''}</span>
                <button className="icon-btn"><Eye size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ CHANNEL LIST PAGE (generic) ============
function ChannelPage({ channel, items = [], openModal, action }: any) {
  const [view, setView] = useState('list');
  const ch = CHANNELS[channel];
  const Ic = ch.icon;
  return (
    <>
      <PageHeader title={ch.name} italic={`${items.length} messages`}
        subtitle="Gérer la boîte · Templates · Statistiques"
        leftPills={<div className="pill" style={{ background: ch.color, color: C.cream }}><Ic size={11} />{ch.label.toUpperCase()}</div>}
        actions={action ? <button className="btn-primary" style={{ background: ch.color }} onClick={() => openModal(action)}><Plus size={16} /> Nouveau message</button> : null} />
      <div style={{ padding: '20px 32px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <ViewToggle view={view} setView={setView} />
      </div>
      <div style={{ padding: '16px 32px 32px' }}>
        {items.length === 0 ? (
          <EmptyState icon={Ic} title={`Aucun message ${ch.name}`} desc={channel === 'whatsapp' ? 'Connecte WhatsApp Business API dans Settings · Connectors.' : channel === 'email' ? 'Connecte ton email pro (Gmail/Resend).' : 'Pas encore de messages sur ce canal.'} action={action ? <button className="btn-primary" style={{ background: ch.color }} onClick={() => openModal(action)}><Plus size={14} /> Nouveau message</button> : null} />
        ) : view === 'grid' ? (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {items.map((m: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div className="avatar" style={{ background: ch.color, width: 38, height: 38, fontSize: 13 }}>{((m.from || m.subject || m.body || 'X') + '').slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{m.from || m.fromEmail || m.contact || 'Message'}</div>
                    <div style={{ fontSize: 10, color: C.inkSoft }}>{m.date || m.timestamp ? new Date(m.date || m.timestamp).toLocaleString('fr-FR') : ''}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.4 }}>{m.subject || m.body || m.text || m.preview || '—'}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((m: any, i: number) => (
              <div key={i} className="row-card">
                <div className="avatar" style={{ background: ch.color, width: 38, height: 38, fontSize: 13 }}>{((m.from || m.subject || m.body || 'X') + '').slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{m.from || m.fromEmail || m.contact || 'Message'}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject || m.body || m.text || m.preview || '—'}</div>
                </div>
                <span style={{ fontSize: 11, color: C.inkSoft }}>{m.date || m.timestamp ? new Date(m.date || m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ TEMPLATES ============
function TemplatesPage({ openModal, templates = [] }: any) {
  return (
    <>
      <PageHeader title="Templates" italic={`${templates.length} modèles`}
        subtitle="Modèles pré-approuvés · Variables dynamiques · Multi-canal"
        actions={<button className="btn-primary" style={{ background: C.gold }} onClick={() => openModal('template')}><Plus size={16} /> Nouveau template</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        {templates.length === 0 ? (
          <EmptyState icon={BookTemplate} title="Aucun template" desc="Crée ton premier modèle pour gagner du temps sur les messages récurrents." action={<button className="btn-primary" style={{ background: C.gold }} onClick={() => openModal('template')}><Plus size={14} /> Créer un template</button>} />
        ) : (
          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {templates.map((t: any, i: number) => (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 18, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: C.goldSoft, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <BookTemplate size={17} />
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{t.name || `Template ${i + 1}`}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>{t.subject || t.preview || '—'}</div>
                <span className="pill" style={{ background: C.pinkSoft, color: C.pinkDeep, fontWeight: 700 }}>{t.channel || 'Email'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============ CAMPAGNES ============
function CampagnesPage({ openModal }: any) {
  return (
    <>
      <PageHeader title="Campagnes" italic="multi-canal"
        subtitle="Envoi en masse · Segmentation · Statistiques en temps réel"
        actions={<button className="btn-primary" style={{ background: C.purple }} onClick={() => openModal('campaign')}><Rocket size={16} /> Nouvelle campagne</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={Megaphone} title="Aucune campagne lancée" desc="Lance ta première campagne marketing multi-canaux pour atteindre tes contacts ciblés." action={<button className="btn-primary" style={{ background: C.purple }} onClick={() => openModal('campaign')}><Rocket size={14} /> Lancer une campagne</button>} />
      </div>
    </>
  );
}

// ============ AUTO-RÉPONSES ============
function AutoRepliesPage() {
  return (
    <>
      <PageHeader title="Auto-réponses" italic="& workflows"
        subtitle="Réponses auto par IA · Conditions · Triggers"
        actions={<button className="btn-primary"><Plus size={16} /> Nouveau workflow</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={RefreshCw} title="Aucun workflow actif" desc="Configure des règles pour répondre automatiquement à tes messages selon le contexte." />
      </div>
    </>
  );
}

// ============ RÉDACTION IA ============
function RedactionIAPage({ openModal }: any) {
  return (
    <>
      <PageHeader title="Rédaction" italic="IA"
        subtitle="Genère emails, messages, posts en quelques secondes"
        actions={<button className="btn-primary" style={{ background: C.purple }} onClick={() => openModal('compose')}><PenLine size={16} /> Rédiger un email</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { name: 'Email professionnel', desc: 'Ton formel · Structure claire', icon: Mail, color: C.email, action: 'compose' },
            { name: 'Message WhatsApp', desc: 'Ton conversationnel court', icon: MessageCircle, color: C.whatsapp, action: 'whatsapp' },
            { name: 'Réponse à un client', desc: 'Avec contexte historique', icon: Reply, color: C.cyan },
            { name: 'Email de relance', desc: 'Diplomate et efficace', icon: Forward, color: C.gold },
            { name: 'Annonce interne', desc: 'Multi-canaux', icon: Megaphone, color: C.purple, action: 'campaign' },
            { name: 'Traduction', desc: 'FR ↔ EN ↔ AR ↔ ES', icon: Languages, color: C.teal },
          ].map((tpl, i) => {
            const Ic = tpl.icon;
            return (
              <div key={i} onClick={() => tpl.action && openModal(tpl.action)} style={{ background: C.cream, borderRadius: 16, padding: 20, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer', transition: 'all 0.3s ease' }}
                onMouseOver={(e: any) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = tpl.color; }}
                onMouseOut={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(10,42,32,0.06)'; }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${tpl.color} 0%, ${tpl.color}cc 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, boxShadow: `0 12px 24px -8px ${tpl.color}` }}>
                  <Ic size={20} />
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{tpl.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{tpl.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ CONTACTS ============
function ContactsPage() {
  return (
    <>
      <PageHeader title="Contacts" italic="& répertoire"
        subtitle="Synchronisation cross-canaux · Tags · Segments"
        actions={<button className="btn-primary"><Plus size={16} /> Nouveau contact</button>} />
      <div style={{ padding: '24px 32px 32px' }}>
        <EmptyState icon={Users} title="Aucun contact enregistré" desc="Importe tes contacts ou laisse l'IA les extraire automatiquement de tes communications." />
      </div>
    </>
  );
}

// ============ RAPPORTS ============
function RapportsPage() {
  const reports = [
    { name: 'Performance par canal', desc: 'Taux d\'ouverture · Taux de réponse', icon: TrendingUp, color: C.emerald },
    { name: 'Volume de messages', desc: 'Évolution sur 30 jours', icon: Activity, color: C.pink },
    { name: 'Temps de réponse moyen', desc: 'Par canal · Par agent', icon: Clock, color: C.gold },
    { name: 'Top contacts', desc: 'Plus d\'échanges', icon: Star, color: C.purple },
  ];
  return (
    <>
      <PageHeader title="Rapports" italic="& analytics"
        subtitle="Statistiques détaillées · Export PDF · CSV" />
      <div style={{ padding: '24px 32px 32px' }}>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {reports.map((r, i) => {
            const Ic = r.icon;
            return (
              <div key={i} style={{ background: C.cream, borderRadius: 16, padding: 22, border: '1px solid rgba(10,42,32,0.06)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${r.color}15`, color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={20} /></div>
                  <button className="icon-btn"><Download size={14} /></button>
                </div>
                <div className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: C.inkSoft }}>{r.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============ MAIN ============
export default function CommunicationsRedesignPage() {
  const [activeTab, setActiveTab] = useState('Accueil');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const openModal = (id: string) => setActiveModal(id);
  const closeModal = () => setActiveModal(null);
  const data = useCommsData();

  return (
    <Chrome>
      <TabSwitcher active={activeTab} setActive={setActiveTab} />
      {activeTab === 'Accueil' && <AccueilPage onTab={setActiveTab} openModal={openModal} data={data} />}
      {activeTab === 'Inbox unifié' && <InboxPage data={data} />}
      {activeTab === 'Threads agents' && <ThreadsAgentsPage data={data} />}
      {activeTab === 'Email' && <ChannelPage channel="email" items={data.inbox} openModal={openModal} action="compose" />}
      {activeTab === 'WhatsApp' && <ChannelPage channel="whatsapp" items={data.waMessages} openModal={openModal} action="whatsapp" />}
      {activeTab === 'SMS' && <ChannelPage channel="sms" items={[]} openModal={openModal} />}
      {activeTab === 'Telegram' && <ChannelPage channel="telegram" items={[]} openModal={openModal} />}
      {activeTab === 'Slack' && <ChannelPage channel="slack" items={[]} openModal={openModal} />}
      {activeTab === 'Campagnes' && <CampagnesPage openModal={openModal} />}
      {activeTab === 'Templates' && <TemplatesPage openModal={openModal} templates={data.templates} />}
      {activeTab === 'Auto-réponses' && <AutoRepliesPage />}
      {activeTab === 'Rédaction IA' && <RedactionIAPage openModal={openModal} />}
      {activeTab === 'Contacts' && <ContactsPage />}
      {activeTab === 'Rapports' && <RapportsPage />}

      {activeModal === 'compose' && <ComposeEmailModal onClose={closeModal} />}
      {activeModal === 'whatsapp' && <NewWhatsAppModal onClose={closeModal} />}
      {activeModal === 'template' && <NewTemplateModal onClose={closeModal} />}
      {activeModal === 'campaign' && <NewCampaignModal onClose={closeModal} />}

      <LiveSyncBadge lastSync={data?.lastSync} intervalMs={REFRESH_INTERVAL_MS} />

      <div style={{ position: 'fixed', bottom: 28, right: 100, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        <button onClick={() => openModal('whatsapp')} title="WhatsApp" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.whatsapp, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <MessageCircle size={20} />
        </button>
        <button onClick={() => openModal('campaign')} title="Campagne" style={{ width: 48, height: 48, borderRadius: 14, background: C.cream, border: '1px solid rgba(10,42,32,0.1)', color: C.purple, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px -8px rgba(0,0,0,0.2)' }}>
          <Megaphone size={20} />
        </button>
        <button onClick={() => openModal('compose')} title="Nouveau message" style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.pink} 0%, ${C.pinkDeep} 100%)`, border: 'none', color: C.cream, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px -8px ${C.pink}` }}>
          <PenLine size={24} />
        </button>
      </div>

      <AgentDrawer
        agentId="comms"
        agentName="Communications"
        color={C.pink}
        context={{
          tab: activeTab,
          inbox: data.inbox?.length ?? 0,
          waMessages: data.waMessages?.length ?? 0,
          templates: data.templates?.length ?? 0,
        }}
        starters={[
          'Rédige un email de remerciement pour un donateur',
          'Quels messages WhatsApp attendent une réponse ?',
          'Génère 3 variantes d\'un message d\'invitation événement',
        ]}
      />
    </Chrome>
  );
}
