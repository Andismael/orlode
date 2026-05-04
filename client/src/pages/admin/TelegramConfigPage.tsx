import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import {
  Send, MessageCircle, Users2, Hash, Sparkles, Zap,
  CheckCircle2, AlertTriangle, Wifi, Activity, Timer, TrendingUp,
  Edit3, Copy, Save, Eye, Lock, Power, Plug2, Bot, UserCircle,
  Languages, Mic2, PlayCircle, FileText,
  BarChart3, Star, Terminal, Key,
  ChevronRight, ArrowRight, ArrowLeft, ExternalLink,
  RotateCw, ToggleLeft, ToggleRight, AtSign, Settings,
  Inbox
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  tg: '#229ED9', tgLight: '#0088CC', tgDeep: '#1A6499', tgSoft: '#E1F4FB', tgPaper: '#EFF8FE', tgChat: '#E7EFFA',
  voice: '#A855F7', voiceSoft: '#F3E8FF',
  ai: '#F59E0B', aiSoft: '#FEF3C7',
  emerald: '#10B981', emeraldSoft: '#D1FAE5', emeraldDeep: '#059669',
  blue: '#0EA5E9', blueSoft: '#E0F2FE',
  red: '#EF4444', redSoft: '#FEE2E2',
  yellow: '#F59E0B', yellowSoft: '#FEF3C7',
  pink: '#EC4899', pinkSoft: '#FCE7F3',
  cyan: '#06B6D4', cyanSoft: '#CFFAFE',
  violet: '#7C3AED', violetSoft: '#EDE9FE',
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
  .grain::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E"); opacity: 0.06; pointer-events: none; mix-blend-mode: overlay; }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.tg}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.tg}; opacity: 0.4; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  @keyframes flyIn { 0% { transform: translate(-30px, 20px) rotate(-15deg); opacity: 0; } 50% { opacity: 1; } 100% { transform: translate(0, 0) rotate(0deg); opacity: 1; } }
  .plane-fly { animation: flyIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes voiceWave { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
  .voice-bar { transform-origin: center; animation: voiceWave 1s ease-in-out infinite; }
  .voice-bar:nth-child(2) { animation-delay: 0.15s; } .voice-bar:nth-child(3) { animation-delay: 0.3s; } .voice-bar:nth-child(4) { animation-delay: 0.45s; }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.creamDeep}; color: ${C.greenDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.tg}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.redSoft}; color: ${C.red}; }
  .btn-primary { background: linear-gradient(135deg, ${C.tg} 0%, ${C.tgLight} 100%); color: ${C.cream}; border: none; padding: 12px 22px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px ${C.tg}; font-family: inherit; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -8px ${C.tg}; }
  .btn-secondary { background: ${C.cream}; color: ${C.greenDeep}; border: 1.5px solid rgba(10,42,32,0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }
  .btn-danger { background: ${C.redSoft}; color: ${C.red}; border: 1.5px solid ${C.red}40; padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-danger:hover { background: ${C.red}; color: ${C.cream}; border-color: ${C.red}; }
  .input-field { width: 100%; background: ${C.creamDeep}; border: 1.5px solid rgba(10,42,32,0.08); border-radius: 10px; padding: 11px 14px; font-size: 13px; color: ${C.ink}; font-family: inherit; outline: none; transition: all 0.2s ease; }
  .input-field:focus { border-color: ${C.tg}; box-shadow: 0 0 0 3px ${C.tg}20; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; } .stagger > *:nth-child(2) { animation-delay: 0.1s; } .stagger > *:nth-child(3) { animation-delay: 0.15s; } .stagger > *:nth-child(4) { animation-delay: 0.2s; } .stagger > *:nth-child(5) { animation-delay: 0.25s; } .stagger > *:nth-child(6) { animation-delay: 0.3s; }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } .responsive-charts { grid-template-columns: 1fr !important; } .voices-grid { grid-template-columns: repeat(2, 1fr) !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .hero-title { font-size: 30px !important; } .hide-on-mobile { display: none !important; } .voices-grid { grid-template-columns: 1fr !important; } }
  @media (max-width: 480px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .hero-title { font-size: 24px !important; } }
`;

function safeGet(url: string) {
  return api.get(url).then((r: any) => r?.data ?? null).catch(() => null);
}

function useTelegramData() {
  const [data, setData] = useState<any>({ status: null, stats: null, loaded: false, lastSync: null });
  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/telegram/status'),
    safeGet('/telegram/stats'),
  ]).then(([st, sts]) => {
    if (!mountedRef.current) return;
    setData({ status: st ?? null, stats: sts ?? null, loaded: true, lastSync: new Date() });
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
    <div style={{ position: 'fixed', bottom: 28, left: 28, zIndex: 50, background: 'rgba(10, 42, 32, 0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${C.tg}40`, padding: '8px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 8, color: C.cream, fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)' }}>
      <span className="live-dot"></span>
      <span style={{ color: C.tg }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>sync · {secondsAgo}s · refresh 10s</span>
    </div>
  );
}

function Hero({ status }: any) {
  const connected = status?.connected || status?.botToken;
  const username = status?.username ? `@${status.username}` : '@TonBot_bot';
  return (
    <div style={{ padding: '32px 32px 0' }}>
      <div className="grain" style={{ background: `linear-gradient(135deg, ${C.tg} 0%, ${C.tgLight} 50%, ${C.tgDeep} 100%)`, borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden', color: C.cream, boxShadow: `0 30px 60px -20px ${C.tg}80` }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.15 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60" stroke={C.cream} strokeWidth="2" fill="none" />
          <circle cx="160" cy="160" r="20" fill={C.cream} fillOpacity="0.3" />
        </svg>
        <svg className="plane-fly" style={{ position: 'absolute', right: 80, bottom: -20, opacity: 0.12 }} width="220" height="220" viewBox="0 0 24 24" fill={C.cream}>
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1 }}>
            <div style={{ width: 80, height: 80, borderRadius: 22, background: 'rgba(255,250,240,0.15)', backdropFilter: 'blur(20px)', border: '1.5px solid rgba(255,250,240,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 12px 32px -8px rgba(0,0,0,0.3)' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill={C.cream}>
                <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div className="pill" style={{ background: 'rgba(255,250,240,0.2)', color: C.cream, backdropFilter: 'blur(10px)' }}>
                  <Plug2 size={11} /> CONNECTEUR · BOT API
                </div>
                {connected ? (
                  <div className="pill" style={{ background: C.cream, color: C.tgDeep, fontWeight: 700 }}>
                    <span className="live-dot" style={{ width: 6, height: 6, background: C.tgDeep }}></span>
                    EN LIGNE · LONG POLLING
                  </div>
                ) : (
                  <div className="pill" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream, fontWeight: 700 }}>
                    <AlertTriangle size={11} /> NON CONNECTÉ
                  </div>
                )}
              </div>
              <h1 className="display-font hero-title" style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.cream, letterSpacing: '-0.03em' }}>
                Telegram <em style={{ fontStyle: 'italic', fontWeight: 500 }}>Bot.</em>
              </h1>
              <p style={{ marginTop: 10, fontSize: 14, color: 'rgba(255,250,240,0.85)', maxWidth: 540 }}>
                Channels, groups, commands, polls — la liberté totale, gratuite, sans templates à valider.
              </p>
            </div>
          </div>
          {connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', minWidth: 180 }}>
              <div style={{ background: 'rgba(255,250,240,0.15)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,250,240,0.25)', borderRadius: 14, padding: '14px 18px', textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.8, marginBottom: 4 }}>USERNAME BOT</div>
                <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800 }}>{username}</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{status?.botName || 'Bot Telegram'} · 100% libre</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsKPIs({ stats }: any) {
  const cards = [
    { label: 'Messages reçus', value: (stats?.messagesReceived ?? 0).toString(), sub: '7 derniers jours', color: C.tg, bg: C.tgSoft, icon: MessageCircle },
    { label: 'Chats actifs', value: (stats?.activeChats ?? 0).toString(), sub: 'Privés + groupes', color: C.violet, bg: C.violetSoft, icon: Users2 },
    { label: 'Commands exécutées', value: (stats?.commandsExecuted ?? 0).toString(), sub: '/start, /help, /menu...', color: C.cyan, bg: C.cyanSoft, icon: Terminal },
    { label: 'Traités par IA', value: (stats?.aiHandled ?? 0).toString(), sub: stats?.messagesReceived > 0 ? `${Math.round((stats.aiHandled / stats.messagesReceived) * 100)}% taux résolution` : '—', color: C.ai, bg: C.aiSoft, icon: Sparkles },
  ];
  return (
    <div style={{ padding: '24px 32px 0' }}>
      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {cards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} style={{ background: C.cream, borderRadius: 20, padding: 22, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.color }}></div>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px -8px ${stat.color}40`, marginBottom: 14 }}>
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <div className="display-font" style={{ fontSize: 38, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>{stat.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BotConnectionCard({ status }: any) {
  const [showToken, setShowToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const connected = status?.connected || status?.botToken;
  const botToken = status?.botToken || '';
  const username = status?.username || '';
  const botName = status?.botName || '';

  const connect = async () => {
    if (!tokenInput) return;
    setConnecting(true);
    try { await api.post('/telegram/connect', { token: tokenInput }); } catch {}
    setTimeout(() => setConnecting(false), 1500);
  };

  const disconnect = async () => {
    try { await api.delete('/telegram/disconnect'); } catch {}
  };

  return (
    <div style={{ padding: '24px 32px 0' }}>
      <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)', borderLeft: `4px solid ${connected ? C.tg : C.yellow}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: C.tgSoft, color: C.tg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} />
            </div>
            <div>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
                Bot <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.tg }}>Telegram</em>
              </h3>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                {connected ? 'Connecté · BotFather verified' : 'Connecte ton bot via @BotFather'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="pill" style={{ background: connected ? C.emeraldSoft : C.yellowSoft, color: connected ? C.emeraldDeep : C.yellow }}>
              {connected ? <><CheckCircle2 size={11} /> Active</> : <><AlertTriangle size={11} /> Inactive</>}
            </div>
            {connected && status?.latency && (
              <div className="pill" style={{ background: C.blueSoft, color: C.blue }}><Wifi size={11} /> {status.latency}ms</div>
            )}
          </div>
        </div>

        {connected ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '14px', background: C.creamDeep, borderRadius: 12, marginBottom: 20 }}>
              {[
                { label: 'Uptime', value: status?.uptime || '100%', icon: Activity, color: C.emeraldDeep },
                { label: 'Latence p95', value: status?.latencyP95 || '—', icon: Timer, color: C.blue },
                { label: 'Quota', value: 'Illimité', icon: Star, color: C.violet },
                { label: 'Webhooks', value: status?.mode || 'Long Poll', icon: RotateCw, color: C.tg },
              ].map((m: any, i) => {
                const MIcon = m.icon;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MIcon size={16} color={m.color} />
                    <div>
                      <div className="mono-font" style={{ fontSize: 13, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 600 }}>{m.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ background: C.creamDeep, borderRadius: 12, padding: 14, border: '1px solid rgba(10,42,32,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <UserCircle size={13} color={C.inkSoft} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>NOM DU BOT</span>
                </div>
                <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{botName || '—'}</div>
              </div>
              <div style={{ background: C.creamDeep, borderRadius: 12, padding: 14, border: '1px solid rgba(10,42,32,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AtSign size={13} color={C.inkSoft} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>USERNAME</span>
                  </div>
                  {username && (
                    <a href={`https://t.me/${username}`} target="_blank" rel="noopener noreferrer" style={{ color: C.tg, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                      Ouvrir <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <div className="mono-font display-font" style={{ fontSize: 16, fontWeight: 800, color: C.tg, letterSpacing: '-0.01em' }}>{username ? `@${username}` : '—'}</div>
              </div>
            </div>

            {botToken && (
              <div style={{ background: C.creamDeep, borderRadius: 12, padding: 14, border: '1px solid rgba(10,42,32,0.05)', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Key size={13} color={C.inkSoft} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>BOT TOKEN</span>
                    <Lock size={11} color={C.red} />
                  </div>
                  <button onClick={() => setShowToken(s => !s)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 4 }}><Eye size={13} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="mono-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em', flex: 1 }}>
                    {showToken ? botToken : botToken.replace(/[A-Za-z0-9-]/g, '•')}
                  </span>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => navigator.clipboard?.writeText(botToken)}><Copy size={11} /></button>
                </div>
                <div style={{ fontSize: 10, color: C.red, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={10} /> Ne partagez jamais ce token. Toute personne y ayant accès peut contrôler votre bot.
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ background: `${C.tg}10`, border: `1.5px dashed ${C.tg}40`, borderRadius: 14, padding: 20, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Plug2 size={22} color={C.tg} />
              <h4 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0 }}>Connecter ton bot Telegram</h4>
            </div>
            <ol style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.8, paddingLeft: 24, marginBottom: 14 }}>
              <li>Sur Telegram, ouvre <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" style={{ color: C.tg, fontWeight: 600 }}>@BotFather</a></li>
              <li>Envoie <span className="mono-font" style={{ background: C.cream, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>/newbot</span> et choisis un nom</li>
              <li>Copie le token généré et colle-le ci-dessous</li>
            </ol>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input-field" placeholder="123456789:AAH-XXXXXXXXXXX..." value={tokenInput} onChange={(e: any) => setTokenInput(e.target.value)} style={{ flex: 1 }} />
              <button className="btn-primary" onClick={connect} disabled={connecting || !tokenInput} style={{ padding: '10px 18px', fontSize: 13 }}>
                {connecting ? 'Connexion…' : 'Connecter'} <Plug2 size={14} />
              </button>
            </div>
          </div>
        )}

        {connected && (
          <div style={{ background: `linear-gradient(135deg, ${C.violetSoft}, ${C.cream})`, border: `1.5px solid ${C.violet}30`, borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: C.violet, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCircle size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.violet, marginBottom: 2 }}>Personnalise ton Clone</div>
              <div style={{ fontSize: 12, color: C.inkSoft }}>
                Configure le nom, le ton, le message d'accueil <span className="mono-font" style={{ background: C.cream, padding: '1px 6px', borderRadius: 4 }}>/start</span>, et les règles de ton assistant.
              </div>
            </div>
            <button className="btn-primary" style={{ background: `linear-gradient(135deg, ${C.violet} 0%, #6D28D9 100%)`, boxShadow: `0 8px 24px -8px ${C.violet}`, padding: '10px 18px', fontSize: 13 }}>
              Configurer <ArrowRight size={14} />
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {connected && (
              <>
                <button className="btn-secondary"><RotateCw size={13} /> Tester connexion</button>
                <button className="btn-secondary"><Key size={13} /> Régénérer token</button>
                <button className="btn-danger" onClick={disconnect}><Power size={13} /> Déconnecter</button>
              </>
            )}
          </div>
          {connected && username && (
            <div style={{ fontSize: 12, color: C.inkSoft }}>
              Cherchez <span className="mono-font" style={{ background: C.tgSoft, color: C.tgDeep, padding: '2px 8px', borderRadius: 5, fontWeight: 700 }}>@{username}</span> dans Telegram
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BotConfigSection({ status }: any) {
  const [autoReply, setAutoReply] = useState(status?.settings?.autoReply ?? true);
  const [mode, setMode] = useState(status?.settings?.replyMode ?? 'auto');
  const [voice, setVoice] = useState(status?.settings?.voice ?? 'Fable');
  const [language, setLanguage] = useState(status?.settings?.language ?? 'fr');
  const [persona, setPersona] = useState(status?.settings?.persona ?? "Tu es l'assistant IA sur Telegram. Réponds toujours en français avec courtoisie. Adapte ton ton à la culture africaine francophone. Sois concis (Telegram favorise la rapidité).");
  const [welcome, setWelcome] = useState(status?.settings?.welcomeMessage ?? "👋 Bonjour ! Je suis l'assistant IA. Comment puis-je t'aider aujourd'hui ?");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const modes = [
    { id: 'text', icon: MessageCircle, label: 'Toujours en texte', desc: 'Réponses textuelles uniquement', color: C.blue },
    { id: 'voice', icon: Mic2, label: 'Toujours en vocal', desc: 'Notes vocales TTS', color: C.voice },
    { id: 'auto', icon: Sparkles, label: 'Automatique', desc: 'Adapté au format reçu', color: C.tg, recommended: true },
  ];
  const voices = [
    { id: 'Alloy', desc: 'Neutre, clair', gender: 'N', color: '#6B7280' },
    { id: 'Echo', desc: 'Masculin, doux', gender: 'M', color: '#3B82F6' },
    { id: 'Fable', desc: 'Expressif, chaleureux', gender: 'M', color: '#F59E0B' },
    { id: 'Onyx', desc: 'Grave, professionnel', gender: 'M', color: '#1F2937' },
    { id: 'Nova', desc: 'Féminin, vif', gender: 'F', color: '#EC4899' },
    { id: 'Shimmer', desc: 'Féminin, doux', gender: 'F', color: '#A855F7' },
  ];
  const languages = [
    { id: 'fr', label: 'Français', flag: '🇫🇷' },
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'ar', label: 'العربية', flag: '🇸🇦' },
    { id: 'es', label: 'Español', flag: '🇪🇸' },
    { id: 'ru', label: 'Русский', flag: '🇷🇺' },
    { id: 'pt', label: 'Português', flag: '🇵🇹' },
  ];

  const save = async () => {
    setSaving(true);
    try { await api.patch('/telegram/settings', { autoReply, replyMode: mode, voice, language, persona, welcomeMessage: welcome }); } catch {}
    setTimeout(() => setSaving(false), 800);
  };

  return (
    <div style={{ padding: '24px 32px 0' }}>
      <div style={{ background: C.cream, borderRadius: 20, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(10,42,32,0.06)', background: `linear-gradient(135deg, ${C.tgPaper}, ${C.cream})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: `linear-gradient(135deg, ${C.tg} 0%, ${C.tgDeep} 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px -4px ${C.tg}` }}>
              <Bot size={24} />
            </div>
            <div>
              <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
                Configuration <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.tg }}>du bot IA</em>
              </h3>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>Comment l'agent répond automatiquement aux messages</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Réponse auto</span>
            <button onClick={() => setAutoReply((a: boolean) => !a)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              {autoReply ? <ToggleRight size={36} color={C.tg} /> : <ToggleLeft size={36} color={C.inkSoft} />}
            </button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: C.tg, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>1</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Mode de réponse</span>
            </div>
            <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {modes.map(m => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <div key={m.id} onClick={() => setMode(m.id)} style={{ background: active ? `${m.color}15` : C.creamDeep, border: active ? `2px solid ${m.color}` : '2px solid transparent', borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}>
                    {m.recommended && (
                      <div className="pill" style={{ position: 'absolute', top: -8, right: 12, background: C.tg, color: C.cream, fontSize: 9, boxShadow: `0 4px 8px -2px ${C.tg}` }}>
                        <Star size={9} fill={C.cream} /> RECOMMANDÉ
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? m.color : `${m.color}20`, color: active ? C.cream : m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={16} />
                      </div>
                      <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{m.label}</span>
                      {active && <CheckCircle2 size={16} color={m.color} style={{ marginLeft: 'auto' }} />}
                    </div>
                    <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.5 }}>{m.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: C.voice, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>2</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Voix de l'agent</span>
                <div className="pill" style={{ background: C.voiceSoft, color: C.voice, fontSize: 10 }}>TTS · OpenAI</div>
              </div>
            </div>
            <div className="voices-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {voices.map(v => {
                const active = voice === v.id;
                const playing = playingVoice === v.id;
                return (
                  <div key={v.id} onClick={() => setVoice(v.id)} style={{ background: active ? C.voiceSoft : C.creamDeep, border: active ? `2px solid ${C.voice}` : '2px solid transparent', borderRadius: 12, padding: 12, cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 50, background: `linear-gradient(135deg, ${v.color}, ${v.color}cc)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 14, boxShadow: `0 4px 12px -4px ${v.color}` }}>{v.gender}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{v.id}</span>
                        {active && <CheckCircle2 size={12} color={C.voice} />}
                      </div>
                      <div style={{ fontSize: 10, color: C.inkSoft }}>{v.desc}</div>
                    </div>
                    <button onClick={(e: any) => { e.stopPropagation(); setPlayingVoice(playing ? null : v.id); }} style={{ width: 32, height: 32, borderRadius: 50, background: playing ? v.color : C.cream, color: playing ? C.cream : v.color, border: `1.5px solid ${v.color}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {playing ? (
                        <svg width="16" height="14" viewBox="0 0 16 14">
                          <rect className="voice-bar" x="1" y="2" width="2" height="10" fill={C.cream} />
                          <rect className="voice-bar" x="5" y="2" width="2" height="10" fill={C.cream} />
                          <rect className="voice-bar" x="9" y="2" width="2" height="10" fill={C.cream} />
                          <rect className="voice-bar" x="13" y="2" width="2" height="10" fill={C.cream} />
                        </svg>
                      ) : (<PlayCircle size={16} fill={C.cream} />)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: C.blue, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>3</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Langue du bot</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {languages.map(l => {
                const active = language === l.id;
                return (
                  <button key={l.id} onClick={() => setLanguage(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: active ? C.greenDeep : C.creamDeep, color: active ? C.cream : C.ink, border: active ? `2px solid ${C.greenDeep}` : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                    <span style={{ fontSize: 18 }}>{l.flag}</span>
                    {l.label}
                    {active && <CheckCircle2 size={14} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: C.ai, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>4</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Persona & message d'accueil</span>
            </div>
            <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>INSTRUCTIONS PERSONA</label>
                <textarea className="input-field" rows={5} value={persona} onChange={(e: any) => setPersona(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  MESSAGE D'ACCUEIL <span className="mono-font" style={{ background: C.tgSoft, color: C.tgDeep, padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>/start</span>
                </label>
                <textarea className="input-field" rows={5} value={welcome} onChange={(e: any) => setWelcome(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
            <button className="btn-secondary">Réinitialiser</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Save size={14} /> {saving ? 'Enregistrement…' : 'Sauvegarder les paramètres'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestMessageSection() {
  const [chatId, setChatId] = useState('');
  const [message, setMessage] = useState('Test depuis Orlode AI · /start 👋');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const send = async () => {
    if (!chatId || !message) return;
    setSending(true);
    try { await api.post('/telegram/send', { chatId, text: message }); setSent(true); } catch {}
    setSending(false);
    setTimeout(() => setSent(false), 3000);
  };
  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: C.tg, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} />
          </div>
          <div>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>Tester un message</h3>
            <div style={{ fontSize: 12, color: C.inkSoft }}>Envoie un message test à un chat ID Telegram</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }} className="responsive-charts">
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>Chat ID</label>
            <input className="input-field" placeholder="123456789" value={chatId} onChange={(e: any) => setChatId(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>Message</label>
            <input className="input-field" value={message} onChange={(e: any) => setMessage(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, gap: 10, alignItems: 'center' }}>
          {sent && (<span style={{ fontSize: 12, color: C.emeraldDeep, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Envoyé !</span>)}
          <button className="btn-primary" onClick={send} disabled={sending || !chatId}><Send size={14} /> {sending ? 'Envoi…' : 'Envoyer le test'}</button>
        </div>
      </div>
    </div>
  );
}

export default function TelegramConfigPage() {
  const data = useTelegramData();
  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>
        <Hero status={data.status} />
        <StatsKPIs stats={data.stats} />
        <BotConnectionCard status={data.status} />
        <BotConfigSection status={data.status} />
        <TestMessageSection />
        <LiveSyncBadge lastSync={data?.lastSync} />
      </main>
    </div>
  );
}
