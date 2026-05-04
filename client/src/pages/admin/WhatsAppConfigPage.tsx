import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { toast } from '@/components/common/Toast';
import {
  MessageCircle, Phone, Users2, Mic, Sparkles, TrendingUp, Activity,
  CheckCircle2, AlertTriangle, Wifi, Zap,
  PlayCircle, Mic2,
  Languages, FileText, Send, Copy, Save, RotateCw, ExternalLink,
  Settings, Cog, Shield, Bot, Brain, User,
  Bell, Clock, Timer, Calendar, Plus, Power, Plug2, Database,
  Eye, Hash, Key, BarChart3, Heart, Star, BookOpen, User, Database, ArrowRight,
  ToggleLeft, ToggleRight, ChevronDown, ChevronLeft,
  X, MoreHorizontal, Search, Inbox,
  ArrowLeft, LogOut, LayoutGrid, List as ListIcon, Smartphone,
} from 'lucide-react';

const C = {
  greenDeep: '#0A4F3C', greenDark: '#063D2E',
  cream: '#FFFAF0', creamDeep: '#F5EDD6',
  wa: '#25D366', waDeep: '#128C7E', waDark: '#075E54', waSoft: '#DCF8C6', waBubble: '#E5F8E1', waMint: '#7FE5A1',
  meta: '#0866FF', metaSoft: '#DCE7F8',
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
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: ${C.wa}; position: relative; flex-shrink: 0; }
  .live-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: ${C.wa}; opacity: 0.4; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.6); opacity: 0; } }
  @keyframes voiceWave { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
  .voice-bar { transform-origin: center; animation: voiceWave 1s ease-in-out infinite; }
  .voice-bar:nth-child(2) { animation-delay: 0.15s; }
  .voice-bar:nth-child(3) { animation-delay: 0.3s; }
  .voice-bar:nth-child(4) { animation-delay: 0.45s; }
  .icon-btn { width: 36px; height: 36px; border-radius: 10px; background: ${C.creamDeep}; color: ${C.greenDeep}; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.2s ease; }
  .icon-btn:hover { background: ${C.wa}; color: ${C.cream}; }
  .icon-btn.danger { background: ${C.redSoft}; color: ${C.red}; }
  .btn-primary { background: linear-gradient(135deg, ${C.wa} 0%, ${C.waDeep} 100%); color: ${C.cream}; border: none; padding: 12px 22px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 8px 24px -8px ${C.wa}; font-family: inherit; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 28px -8px ${C.wa}; }
  .btn-secondary { background: ${C.cream}; color: ${C.greenDeep}; border: 1.5px solid rgba(10,42,32,0.1); padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-secondary:hover { background: ${C.greenDeep}; color: ${C.cream}; border-color: ${C.greenDeep}; }
  .btn-danger { background: ${C.redSoft}; color: ${C.red}; border: 1.5px solid ${C.red}40; padding: 11px 18px; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; font-family: inherit; }
  .btn-danger:hover { background: ${C.red}; color: ${C.cream}; border-color: ${C.red}; }
  .input-field { width: 100%; background: ${C.creamDeep}; border: 1.5px solid rgba(10,42,32,0.08); border-radius: 10px; padding: 11px 14px; font-size: 13px; color: ${C.ink}; font-family: inherit; outline: none; transition: all 0.2s ease; }
  .input-field:focus { border-color: ${C.wa}; box-shadow: 0 0 0 3px ${C.wa}20; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .stagger > * { animation: slideIn 0.4s ease-out backwards; }
  .stagger > *:nth-child(1) { animation-delay: 0.05s; } .stagger > *:nth-child(2) { animation-delay: 0.1s; } .stagger > *:nth-child(3) { animation-delay: 0.15s; } .stagger > *:nth-child(4) { animation-delay: 0.2s; } .stagger > *:nth-child(5) { animation-delay: 0.25s; } .stagger > *:nth-child(6) { animation-delay: 0.3s; }
  @keyframes bubbleIn { from { opacity: 0; transform: scale(0.8) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .bubble-in { animation: bubbleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @media (max-width: 1024px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .responsive-grid-3 { grid-template-columns: 1fr !important; } .responsive-charts { grid-template-columns: 1fr !important; } .voices-grid { grid-template-columns: repeat(2, 1fr) !important; } }
  @media (max-width: 768px) { .responsive-grid-4 { grid-template-columns: repeat(2, 1fr) !important; } .hero-title { font-size: 30px !important; } .hide-on-mobile { display: none !important; } .voices-grid { grid-template-columns: 1fr !important; } }
  @media (max-width: 480px) { .responsive-grid-4 { grid-template-columns: 1fr !important; } .hero-title { font-size: 24px !important; } }
`;

function safeGet(url: string) {
  return api.get(url).then((r: any) => r?.data ?? null).catch(() => null);
}

function useWhatsAppData() {
  const [data, setData] = useState<any>({
    status: null, stats: null, messages: [],
    loaded: false, lastSync: null,
  });
  const fetchAll = (mountedRef: { current: boolean }) => Promise.all([
    safeGet('/whatsapp/status'),
    safeGet('/whatsapp/stats'),
    safeGet('/whatsapp/messages'),
  ]).then(([st, sts, msgs]) => {
    if (!mountedRef.current) return;
    setData({
      status: st ?? null,
      stats: sts ?? null,
      messages: msgs?.messages ?? msgs ?? [],
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

function LiveSyncBadge({ lastSync, intervalMs = 10000 }: any) {
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
    <div style={{ position: 'fixed', bottom: 28, left: 28, zIndex: 50, background: 'rgba(10, 42, 32, 0.92)', backdropFilter: 'blur(8px)', border: `1px solid ${C.wa}40`, padding: '8px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 8, color: C.cream, fontSize: 12, fontWeight: 600, fontFamily: "'Inter', sans-serif", boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)' }}>
      <span className="live-dot"></span>
      <span style={{ color: C.waMint }}>LIVE</span>
      <span style={{ color: 'rgba(255,250,240,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>sync · {secondsAgo}s · refresh {intervalMs / 1000}s</span>
    </div>
  );
}

// ============ HERO ============
function Hero({ status }: any) {
  const connected = status?.connected || status?.status === 'active';
  const phoneNumber = status?.phoneNumber || status?.displayPhoneNumber;
  return (
    <div style={{ padding: '32px 32px 0' }}>
      <div className="grain" style={{ background: `linear-gradient(135deg, ${C.wa} 0%, ${C.waDeep} 50%, ${C.waDark} 100%)`, borderRadius: 24, padding: '32px 36px', position: 'relative', overflow: 'hidden', color: C.cream, boxShadow: `0 30px 60px -20px ${C.wa}80` }}>
        <svg style={{ position: 'absolute', right: -50, top: -50, opacity: 0.15 }} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="140" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="100" stroke={C.cream} strokeWidth="1" fill="none" />
          <circle cx="160" cy="160" r="60" stroke={C.cream} strokeWidth="2" fill="none" />
          <circle cx="160" cy="160" r="20" fill={C.cream} fillOpacity="0.3" />
        </svg>
        <svg style={{ position: 'absolute', right: 80, bottom: -40, opacity: 0.12 }} width="200" height="200" viewBox="0 0 24 24" fill={C.cream}>
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24z"/>
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1 }}>
            <div style={{ width: 80, height: 80, borderRadius: 22, background: 'rgba(255,250,240,0.15)', backdropFilter: 'blur(20px)', border: '1.5px solid rgba(255,250,240,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 12px 32px -8px rgba(0,0,0,0.3)' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill={C.cream}>
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <div className="pill" style={{ background: 'rgba(255,250,240,0.2)', color: C.cream, backdropFilter: 'blur(10px)' }}>
                  <Plug2 size={11} /> CONNECTEUR · META CLOUD API
                </div>
                {connected ? (
                  <div className="pill" style={{ background: C.cream, color: C.waDeep, fontWeight: 700 }}>
                    <span className="live-dot" style={{ width: 6, height: 6, background: C.waDeep }}></span>
                    EN LIGNE · API SAINE
                  </div>
                ) : (
                  <div className="pill" style={{ background: 'rgba(255,250,240,0.15)', color: C.cream, fontWeight: 700 }}>
                    <AlertTriangle size={11} /> NON CONNECTÉ
                  </div>
                )}
              </div>
              <h1 className="display-font hero-title" style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.0, margin: 0, color: C.cream, letterSpacing: '-0.03em' }}>
                WhatsApp <em style={{ fontStyle: 'italic', fontWeight: 500 }}>Business.</em>
              </h1>
              <p style={{ marginTop: 10, fontSize: 14, color: 'rgba(255,250,240,0.85)', maxWidth: 540 }}>
                Le canal n°1 de communication africaine — connecté à votre IA pour répondre 24/7.
              </p>
            </div>
          </div>
          {connected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end', minWidth: 180 }}>
              <div style={{ background: 'rgba(255,250,240,0.15)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,250,240,0.25)', borderRadius: 14, padding: '14px 18px', textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.8, marginBottom: 4 }}>NUMÉRO PRO</div>
                <div className="mono-font display-font" style={{ fontSize: 18, fontWeight: 800 }}>{phoneNumber || '+225 XX XX XX XX'}</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{status?.country || '🇨🇮 Côte d\'Ivoire'} · TIER 1</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ STATS KPIs ============
function StatsKPIs({ stats, messages }: any) {
  const totalMessages = messages?.length || stats?.totalMessages || 0;
  const uniqueContacts = stats?.uniqueContacts || 0;
  const voiceMessages = stats?.voiceMessages || 0;
  const aiHandled = stats?.aiHandled || 0;
  const cards = [
    { label: 'Messages total', value: totalMessages.toString(), sub: '7 derniers jours', color: C.wa, bg: '#DCF8C6', icon: MessageCircle },
    { label: 'Contacts uniques', value: uniqueContacts.toString(), sub: 'Personnes en conversation', color: C.blue, bg: C.blueSoft, icon: Users2 },
    { label: 'Vocaux reçus', value: voiceMessages.toString(), sub: 'Transcrits par Whisper', color: C.voice, bg: C.voiceSoft, icon: Mic2 },
    { label: 'Traités par IA', value: aiHandled.toString(), sub: totalMessages > 0 ? `${Math.round(aiHandled / totalMessages * 100)}% taux résolution` : '—', color: C.ai, bg: C.aiSoft, icon: Sparkles },
  ];
  return (
    <div style={{ padding: '24px 32px 0' }}>
      <div className="responsive-grid-4 stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {cards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} style={{ background: C.cream, borderRadius: 20, padding: 22, border: '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stat.color }}></div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px -8px ${stat.color}40` }}>
                  <Icon size={20} strokeWidth={1.75} />
                </div>
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

// ============ META CONNECTION CARD ============
function MetaConnectionCard({ status }: any) {
  const [showPhoneId, setShowPhoneId] = useState(false);
  const [testing, setTesting] = useState(false);
  const phoneId = status?.phoneNumberId || status?.phoneId || '';
  const businessId = status?.businessAccountId || status?.businessId || '';
  const connected = status?.connected || false;

  const test = async () => {
    setTesting(true);
    try { await api.get('/whatsapp/status'); } catch {}
    setTimeout(() => setTesting(false), 1500);
  };

  return (
    <div style={{ padding: '24px 32px 0' }}>
      <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)', borderLeft: `4px solid ${connected ? C.wa : C.yellow}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: C.metaSoft, color: C.meta, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plug2 size={18} />
            </div>
            <div>
              <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
                Connexion <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.meta }}>Meta Cloud API</em>
              </h3>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{connected ? 'Connecté' : 'Connecte ton compte WhatsApp Business'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="pill" style={{ background: connected ? C.emeraldSoft : C.yellowSoft, color: connected ? C.emeraldDeep : C.yellow }}>
              {connected ? <><CheckCircle2 size={11} /> Active</> : <><AlertTriangle size={11} /> Inactive</>}
            </div>
            {connected && status?.coexistenceMode && (
              <div className="pill" style={{ background: '#DCF8E1', color: '#25D366' }} title="Le numéro reste actif sur votre WhatsApp Business app — le bot tourne en parallèle sur le même numéro.">
                <Smartphone size={11} /> Coexistence
              </div>
            )}
            {connected && status?.latency && (
              <div className="pill" style={{ background: C.blueSoft, color: C.blue }}><Wifi size={11} /> {status.latency}ms</div>
            )}
          </div>
        </div>

        {connected ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '14px', background: C.creamDeep, borderRadius: 12, marginBottom: 20 }}>
              {[
                { label: 'Uptime', value: status?.uptime || '—', icon: Activity, color: C.emeraldDeep },
                { label: 'Latence p95', value: status?.latencyP95 || '—', icon: Timer, color: C.blue },
                { label: 'Quota Tier', value: status?.tier || 'TIER 1', icon: TrendingUp, color: C.violet },
                { label: 'Webhooks', value: status?.webhooksOk ? 'OK' : '—', icon: CheckCircle2, color: C.wa },
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

            <div className="responsive-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: C.creamDeep, borderRadius: 12, padding: 14, border: '1px solid rgba(10,42,32,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={13} color={C.inkSoft} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>PHONE NUMBER ID</span>
                  </div>
                  <button onClick={() => setShowPhoneId(s => !s)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.inkSoft }}><Eye size={13} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="mono-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
                    {phoneId ? (showPhoneId ? phoneId : '•'.repeat(Math.min(phoneId.length, 16))) : '—'}
                  </span>
                  <button className="icon-btn" style={{ width: 26, height: 26, marginLeft: 'auto' }} onClick={() => navigator.clipboard?.writeText(phoneId)}><Copy size={11} /></button>
                </div>
              </div>

              <div style={{ background: C.creamDeep, borderRadius: 12, padding: 14, border: '1px solid rgba(10,42,32,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Hash size={13} color={C.inkSoft} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>BUSINESS ACCOUNT ID</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="mono-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{businessId || '—'}</span>
                  <button className="icon-btn" style={{ width: 26, height: 26, marginLeft: 'auto' }} onClick={() => navigator.clipboard?.writeText(businessId)}><Copy size={11} /></button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmbeddedSignupBlock />
        )}

        {/* MANUAL VERIFICATION (Solution Partner flow) */}
        <ManualVerifyPanel connected={connected} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={test} disabled={testing}>
              <RotateCw size={13} className={testing ? 'spin' : ''} /> {testing ? 'Test en cours…' : 'Tester connexion'}
            </button>
            {connected && (
              <button
                className="btn-danger"
                onClick={async () => {
                  if (!confirm('Déconnecter WhatsApp ? Le bot ne répondra plus jusqu\'à reconnexion.')) return;
                  try {
                    await api.delete('/whatsapp/disconnect');
                    toast.success('WhatsApp déconnecté');
                    setTimeout(() => window.location.reload(), 800);
                  } catch (e: any) {
                    toast.error('Échec', e?.response?.data?.message ?? 'Impossible de déconnecter');
                  }
                }}
              >
                <Power size={13} /> Déconnecter
              </button>
            )}
          </div>
          <a href="https://business.facebook.com/wa/manage" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.meta, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Gérer sur Meta <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ============ EMBEDDED SIGNUP BLOCK (Facebook FB.login flow) ============
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

let fbSdkLoading: Promise<void> | null = null;
function loadFacebookSdk(appId: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.FB) return Promise.resolve();
  if (fbSdkLoading) return fbSdkLoading;
  fbSdkLoading = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB.init({ appId, cookie: true, xfbml: false, version: 'v21.0' });
        resolve();
      } catch (e) { reject(e); }
    };
    const id = 'facebook-jssdk';
    if (document.getElementById(id)) return;
    const js = document.createElement('script');
    js.id = id;
    js.src = 'https://connect.facebook.net/en_US/sdk.js';
    js.async = true; js.defer = true; js.crossOrigin = 'anonymous';
    js.onerror = () => reject(new Error('Failed to load Facebook SDK'));
    document.body.appendChild(js);
  });
  return fbSdkLoading;
}

function EmbeddedSignupBlock() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Default ON: keeping the user's existing WhatsApp Business app working is
  // almost always what they want. They can turn it off for full Cloud API
  // migration if they prefer.
  const [coexistence, setCoexistence] = useState(true);

  const appId = (import.meta as any).env?.VITE_META_APP_ID as string | undefined;
  const classicConfigId = (import.meta as any).env?.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID as string | undefined;
  const coexistenceConfigId = (import.meta as any).env?.VITE_META_COEXISTENCE_CONFIG_ID as string | undefined;
  // Use the coexistence-specific config if set; otherwise fall back to the
  // classic config — Meta still respects featureType in the extras to enable
  // the right onboarding even when the configId is generic.
  const configId = coexistence ? (coexistenceConfigId ?? classicConfigId) : classicConfigId;

  const onConnect = async () => {
    setErr(null); setInfo(null);
    if (!appId) { setErr('VITE_META_APP_ID manquant côté client.'); return; }
    if (!configId) { setErr('VITE_META_EMBEDDED_SIGNUP_CONFIG_ID manquant.'); return; }
    setBusy(true);
    try {
      await loadFacebookSdk(appId);
      const FB = window.FB;
      if (!FB) throw new Error('Facebook SDK indisponible');

      // Listen to embedded signup session_info
      const sessionHandler = (event: MessageEvent) => {
        if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'WA_EMBEDDED_SIGNUP') {
            // eslint-disable-next-line no-console
            console.log('[ES session_info]', data);
          }
        } catch { /* not JSON */ }
      };
      window.addEventListener('message', sessionHandler);

      const resp: any = await new Promise(resolve => {
        FB.login(
          (r: any) => resolve(r),
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              // featureType signals coexistence onboarding to Meta. The exact
              // value evolves with Meta API versions; current docs use
              // 'whatsapp_business_app_onboarding' for coexistence.
              featureType: coexistence ? 'whatsapp_business_app_onboarding' : '',
              sessionInfoVersion: '3',
            },
          },
        );
      });
      window.removeEventListener('message', sessionHandler);

      const code = resp?.authResponse?.code;
      if (!code) {
        const reason = resp?.status ?? 'fenêtre fermée';
        throw new Error(`Connexion Facebook annulée (${reason}). Réessaie.`);
      }
      setInfo('Code reçu, échange en cours…');
      const r = await api.post('/whatsapp/embedded-signup', { code, mode: coexistence ? 'coexistence' : 'classic' });
      const msg = r?.data?.message ?? 'Connecté.';
      setInfo(msg);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Échec connexion Meta');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ background: `${C.yellow}15`, border: `1px dashed ${C.yellow}`, borderRadius: 14, padding: 20, marginBottom: 20, textAlign: 'center' }}>
      <Plug2 size={32} color={C.yellow} style={{ margin: '0 auto 10px' }} />
      <h4 className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>Pas encore connecté</h4>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: '0 0 14px' }}>Embedded Signup avec Meta · 5 minutes pour activer ton numéro WhatsApp Business.</p>

      {/* Coexistence toggle */}
      <div style={{ background: '#fff', border: '1px solid rgba(10,42,32,0.1)', borderRadius: 10, padding: 12, margin: '0 auto 14px', maxWidth: 480, textAlign: 'left' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={coexistence}
            onChange={e => setCoexistence(e.target.checked)}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: '#25D366', cursor: 'pointer', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
              Mode coexistence — garder mon WhatsApp Business app actif sur le téléphone
              {coexistence && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '2px 6px', background: '#DCF8E1', color: '#25D366', borderRadius: 4, letterSpacing: '0.04em' }}>RECOMMANDÉ</span>}
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.4 }}>
              {coexistence
                ? 'Votre équipe garde 100% de l\'app actuelle. Le bot Orlode tourne en parallèle sur le même numéro. Aucune migration.'
                : 'Mode classique : le numéro est migré vers le Cloud API. Votre WhatsApp Business app sur le téléphone sera désactivée.'}
            </div>
          </div>
        </label>
      </div>

      <button className="btn-primary" onClick={onConnect} disabled={busy}>
        <Plug2 size={14} /> {busy ? 'Ouverture Facebook…' : 'Connecter avec Meta'}
      </button>
      {err && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: C.redSoft, color: C.red, borderRadius: 10, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={13} /> {err}
        </div>
      )}
      {info && !err && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: C.emeraldSoft, color: C.emeraldDeep, borderRadius: 10, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={13} /> {info}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: C.inkSoft }}>
        Si la fenêtre Facebook ne s'ouvre pas : autorise les pop-ups pour ce site, puis réessaie.
      </div>
    </div>
  );
}

// ============ MANUAL VERIFICATION PANEL (Solution Partner flow) ============
function ManualVerifyPanel({ connected }: { connected: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [codeMethod, setCodeMethod] = useState<'SMS' | 'VOICE'>('SMS');
  const [language, setLanguage] = useState('fr');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const post = async (path: string, body: any) => {
    const cleaned: any = {};
    Object.entries(body).forEach(([k, v]) => { if (v !== '' && v != null) cleaned[k] = v; });
    return api.post(path, cleaned).then((r: any) => r?.data ?? null);
  };

  const requestCode = async () => {
    if (cooldown > 0) return;
    setBusy(true); setMsg(null);
    try {
      await post('/whatsapp/request-code', { phoneNumberId, accessToken, codeMethod, language });
      setMsg({ kind: 'ok', text: `Code envoyé via ${codeMethod}. Vérifie ton téléphone.` });
      setStep(2);
      setCooldown(60); // 60s avant de pouvoir redemander un code
    } catch (e: any) {
      const status = e?.response?.status;
      const text = e?.response?.data?.message || e?.message || 'Erreur lors de la demande de code.';
      setMsg({ kind: 'err', text });
      // Si Meta a bloqué (429), impose un cooldown long pour éviter les clics
      if (status === 429) setCooldown(300);
    } finally { setBusy(false); }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(otp)) { setMsg({ kind: 'err', text: 'Le code doit faire 6 chiffres.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await post('/whatsapp/verify-code', { phoneNumberId, accessToken, code: otp });
      setMsg({ kind: 'ok', text: 'Code vérifié. Définis maintenant un PIN à 6 chiffres pour activer.' });
      setStep(3);
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.message || e?.message || 'Code invalide ou expiré.' });
    } finally { setBusy(false); }
  };

  const registerPhone = async () => {
    if (!/^\d{6}$/.test(pin)) { setMsg({ kind: 'err', text: 'Le PIN doit faire 6 chiffres.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await post('/whatsapp/register-phone', {
        phoneNumberId, accessToken, pin,
        dataLocalizationRegion: region || undefined,
      });
      setMsg({ kind: 'ok', text: `Numéro activé${region ? ` (région ${region}, RGPD)` : ''}. Tu peux maintenant envoyer/recevoir des messages.` });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.message || e?.message || 'Échec d\'activation. Vérifie le PIN.' });
    } finally { setBusy(false); }
  };

  const reset = () => { setStep(1); setOtp(''); setPin(''); setMsg(null); };

  const stepDot = (n: 1 | 2 | 3, label: string) => {
    const active = step === n;
    const done = step > n;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: done ? C.emerald : active ? C.wa : C.creamDeep,
          color: done || active ? C.cream : C.inkSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800,
        }}>
          {done ? <CheckCircle2 size={14} /> : n}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: active ? C.ink : C.inkSoft }}>{label}</span>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 16, background: C.creamDeep, borderRadius: 14, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 16px',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: C.violetSoft, color: C.violet, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={15} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Vérification manuelle (avancé)</div>
            <div style={{ fontSize: 11, color: C.inkSoft }}>SMS/Voice OTP + PIN · pour Solution Partners ou si Embedded Signup ne s'applique pas</div>
          </div>
        </div>
        <ChevronDown size={16} color={C.inkSoft} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(10,42,32,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', flexWrap: 'wrap' }}>
            {stepDot(1, 'Envoyer code')}
            <div style={{ flex: 1, height: 1, background: 'rgba(10,42,32,0.1)', minWidth: 12 }} />
            {stepDot(2, 'Saisir OTP')}
            <div style={{ flex: 1, height: 1, background: 'rgba(10,42,32,0.1)', minWidth: 12 }} />
            {stepDot(3, 'Activer (PIN)')}
          </div>

          {!connected && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>PHONE NUMBER ID</label>
                <input className="input-field" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="123456789012345" />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>ACCESS TOKEN (temp)</label>
                <input className="input-field" value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="EAAG..." type="password" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>MÉTHODE</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {(['SMS', 'VOICE'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setCodeMethod(m)}
                      className={codeMethod === m ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '8px 14px', fontSize: 12 }}
                    >
                      {m === 'SMS' ? <MessageCircle size={12} /> : <Phone size={12} />} {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>LANGUE</label>
                <select className="input-field" value={language} onChange={e => setLanguage(e.target.value)} style={{ minWidth: 100 }}>
                  <option value="fr">FR</option>
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                  <option value="pt_BR">PT-BR</option>
                  <option value="ar">AR</option>
                  <option value="de">DE</option>
                </select>
              </div>
              <button
                className="btn-primary"
                onClick={requestCode}
                disabled={busy || cooldown > 0}
                style={{ padding: '11px 18px', fontSize: 13, opacity: cooldown > 0 ? 0.6 : 1 }}
                title={cooldown > 0 ? `Renvoie possible dans ${cooldown}s` : 'Envoyer le code'}
              >
                <Send size={13} />
                {busy ? 'Envoi…' : cooldown > 0 ? `Renvoyer dans ${cooldown}s` : 'Envoyer le code'}
              </button>
              {cooldown > 0 && (
                <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
                  <Timer size={11} style={{ verticalAlign: 'middle' }} /> Évite le blocage Meta (24-72h) — patiente.
                </span>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>CODE 6 CHIFFRES</label>
                <input
                  className="input-field mono-font"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  style={{ letterSpacing: '0.3em', fontSize: 18, fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <button className="btn-primary" onClick={verifyCode} disabled={busy || otp.length !== 6} style={{ padding: '11px 18px', fontSize: 13 }}>
                <CheckCircle2 size={13} /> {busy ? 'Vérification…' : 'Vérifier'}
              </button>
              <button className="btn-secondary" onClick={() => setStep(1)} disabled={busy}>
                <ArrowLeft size={12} /> Retour
              </button>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>PIN 6 CHIFFRES (2FA)</label>
                <input
                  className="input-field mono-font"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  inputMode="numeric"
                  type="password"
                  style={{ letterSpacing: '0.3em', fontSize: 18, fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em' }}>RÉGION (RGPD, opt.)</label>
                <select className="input-field" value={region} onChange={e => setRegion(e.target.value)} style={{ minWidth: 130 }}>
                  <option value="">— global —</option>
                  <option value="DE">DE · Allemagne</option>
                  <option value="FR">FR · France</option>
                  <option value="GB">GB · Royaume-Uni</option>
                  <option value="IE">IE · Irlande</option>
                  <option value="CH">CH · Suisse</option>
                  <option value="AE">AE · Émirats</option>
                  <option value="AU">AU · Australie</option>
                  <option value="BR">BR · Brésil</option>
                  <option value="CA">CA · Canada</option>
                  <option value="ID">ID · Indonésie</option>
                  <option value="IN">IN · Inde</option>
                  <option value="JP">JP · Japon</option>
                  <option value="SG">SG · Singapour</option>
                  <option value="ZA">ZA · Afrique du Sud</option>
                </select>
              </div>
              <button className="btn-primary" onClick={registerPhone} disabled={busy || pin.length !== 6} style={{ padding: '11px 18px', fontSize: 13 }}>
                <Zap size={13} /> {busy ? 'Activation…' : 'Activer le numéro'}
              </button>
              <button className="btn-secondary" onClick={reset} disabled={busy}>
                <RotateCw size={12} /> Recommencer
              </button>
            </div>
          )}

          {msg && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: msg.kind === 'ok' ? C.emeraldSoft : msg.kind === 'err' ? C.redSoft : C.blueSoft,
              color: msg.kind === 'ok' ? C.emeraldDeep : msg.kind === 'err' ? C.red : C.blue,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {msg.kind === 'ok' ? <CheckCircle2 size={14} /> : msg.kind === 'err' ? <AlertTriangle size={14} /> : <Activity size={14} />}
              {msg.text}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 11, color: C.inkSoft }}>
            <strong>Astuce :</strong> ce flow utilise <span className="mono-font">request_code</span> → <span className="mono-font">verify_code</span> → <span className="mono-font">register</span> de l'API Meta v22. Le PIN est ton 2FA pour ce numéro — note-le, il sera demandé en cas de re-registration.
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ADVANCED FEATURES (ROADMAP + HANDOFF) ============
// Handoff humain is the first one shipped — it has its own real config card.
// The other three remain marked "Bientôt".
function AdvancedFeatures({ status }: any) {
  const features = [
    // Templates Meta is shipped — see WhatsAppTemplatesPage. The roadmap card
    // below is kept as a redirect entry, not a "soon" placeholder.
    // (no-op placeholder removed — see live link in the AdvancedFeatures component)
    // Broadcast — shipped, see WhatsAppBroadcastsPage. Linked from the live
    // section above; no longer a roadmap entry.
    // Catalog — shipped, see WhatsAppCatalogPage. Linked above as live card.
  ];

  return (
    <div style={{ padding: '24px 32px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Sparkles size={18} color={C.wa} />
        <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
          Fonctionnalités <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.waMint, fontSize: 18 }}>avancées</em>
        </h3>
        <span style={{ fontSize: 12, color: C.onGreenSoft }}>Handoff humain — disponible · Le reste arrive</span>
      </div>

      {/* HANDOFF — real working config */}
      <HandoffConfigCard status={status} />

      {/* Templates Meta — live, real link */}
      <div style={{ marginTop: 18 }}>
        <a href="/admin/whatsapp/templates" style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: C.cream, borderRadius: 14,
          padding: 16, textDecoration: 'none',
          border: `1.5px solid ${C.meta ?? '#0866FF'}30`,
          borderLeft: `5px solid ${C.meta ?? '#0866FF'}`,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.meta ?? '#0866FF'}, ${C.meta ?? '#0866FF'}cc)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
              📋 Templates Meta · HSMs
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
              Liste tes templates approuvés + envoi en 1 click avec variables. Obligatoire pour contacter un client hors fenêtre 24h.
            </div>
          </div>
          <span className="pill" style={{ background: '#D1FAE5', color: '#059669', fontSize: 10, fontWeight: 700 }}>✅ DISPO</span>
        </a>
      </div>

      {/* Auto-broadcast — live link */}
      <div style={{ marginTop: 12 }}>
        <a href="/admin/whatsapp/auto-broadcasts" style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: C.cream, borderRadius: 14,
          padding: 16, textDecoration: 'none',
          border: `1.5px solid ${C.emerald ?? '#10B981'}30`,
          borderLeft: `5px solid ${C.emerald ?? '#10B981'}`,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.emerald ?? '#10B981'}, ${C.emeraldDeep ?? '#059669'})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ⚡
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
              ⚡ Auto-broadcast — Marketing automatique
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
              Règles "if X then send Y" — déclenchement automatique chaque minute. Ex: 20+ leads urgents → relance auto.
            </div>
          </div>
          <span className="pill" style={{ background: '#D1FAE5', color: '#059669', fontSize: 10, fontWeight: 700 }}>✅ DISPO</span>
        </a>
      </div>

      {/* Broadcast — live link */}
      <div style={{ marginTop: 12 }}>
        <a href="/admin/whatsapp/broadcasts" style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: C.cream, borderRadius: 14,
          padding: 16, textDecoration: 'none',
          border: `1.5px solid ${C.wa ?? '#25D366'}30`,
          borderLeft: `5px solid ${C.wa ?? '#25D366'}`,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.wa ?? '#25D366'}, ${C.waDeep ?? '#128C7E'})`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
              📢 Broadcast — Diffusion ciblée
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
              Envoie un template à une audience segmentée (statut, urgence, période). Opt-outs auto-exclus, pré-fill par lead, tracking d'envoi.
            </div>
          </div>
          <span className="pill" style={{ background: '#D1FAE5', color: '#059669', fontSize: 10, fontWeight: 700 }}>✅ DISPO</span>
        </a>
      </div>

      {/* Ads (Click-to-WhatsApp) — live link */}
      <div style={{ marginTop: 12 }}>
        <a href="/admin/whatsapp/ads" style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: C.cream, borderRadius: 14,
          padding: 16, textDecoration: 'none',
          border: `1.5px solid ${C.meta ?? '#0866FF'}30`,
          borderLeft: `5px solid ${C.meta ?? '#0866FF'}`,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.meta ?? '#0866FF'}, #1E3A8A)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            📢
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
              📊 Ads — Click-to-WhatsApp tracking
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
              Performance par campagne Meta : conversations · leads · ventes · revenu · ROAS automatique. Auto-capturé via webhook.
            </div>
          </div>
          <span className="pill" style={{ background: '#D1FAE5', color: '#059669', fontSize: 10, fontWeight: 700 }}>✅ DISPO</span>
        </a>
      </div>

      {/* Catalog — live link */}
      <div style={{ marginTop: 12 }}>
        <a href="/admin/whatsapp/catalog" style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: C.cream, borderRadius: 14,
          padding: 16, textDecoration: 'none',
          border: `1.5px solid ${C.violet ?? '#A855F7'}30`,
          borderLeft: `5px solid ${C.violet ?? '#A855F7'}`,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.violet ?? '#A855F7'}, #7E22CE)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🛒
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display-font" style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>
              🛒 Catalogue produits — WhatsApp Commerce
            </div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
              Liste tes produits Meta Commerce et envoie une fiche cliquable directement à un client en WhatsApp.
            </div>
          </div>
          <span className="pill" style={{ background: '#D1FAE5', color: '#059669', fontSize: 10, fontWeight: 700 }}>✅ DISPO</span>
        </a>
      </div>

      {/* No more "Bientôt" — all roadmap features shipped */}
    </div>
  );
}

// ============ HANDOFF CONFIG (real, working) ============
function HandoffConfigCard({ status }: any) {
  const initialHandoff = status?.settings?.humanHandoff ?? {};
  const [enabled, setEnabled] = useState<boolean>(!!initialHandoff.enabled);
  const [notifyChannelId, setNotifyChannelId] = useState<string>(initialHandoff.notifyChannelId ?? '');
  const [threshold, setThreshold] = useState<'sensitive' | 'normal' | 'strict'>(initialHandoff.threshold ?? 'normal');
  const [customerReply, setCustomerReply] = useState<string>(initialHandoff.customerReply ?? "Bien noté. Un humain de notre équipe va prendre le relais et te recontacter très vite. 🙏");
  const [notifyEmails, setNotifyEmails] = useState<string>((initialHandoff.notifyEmails ?? []).join(', '));
  const [notifyWhatsAppNumbers, setNotifyWhatsAppNumbers] = useState<string>((initialHandoff.notifyWhatsAppNumbers ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total7d: number; explicit: number; frustration: number }>({ total7d: 0, explicit: 0, frustration: 0 });
  const [leadCount, setLeadCount] = useState<number>(0);
  // Sync local state from server status, but only ONCE — when the API first
  // returns a real settings object. Without this, useState's initializer runs
  // when status is undefined, then never reruns even after the API responds.
  const hasHydrated = React.useRef(false);
  useEffect(() => {
    if (hasHydrated.current) return;
    const h = status?.settings?.humanHandoff;
    if (h === undefined && status?.settings === undefined) return;
    hasHydrated.current = true;
    if (!h) return;
    setEnabled(!!h.enabled);
    if (h.notifyChannelId) setNotifyChannelId(h.notifyChannelId);
    if (h.threshold) setThreshold(h.threshold);
    if (h.customerReply) setCustomerReply(h.customerReply);
    if (Array.isArray(h.notifyEmails)) setNotifyEmails(h.notifyEmails.join(', '));
    if (Array.isArray(h.notifyWhatsAppNumbers)) setNotifyWhatsAppNumbers(h.notifyWhatsAppNumbers.join(', '));
  }, [status?.settings]);

  useEffect(() => {
    // Axios interceptor already unwraps {success, data} → r.data is the payload directly.
    api.get('/team/channels').then((r: any) => {
      const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
      setChannels(list);
    }).catch(() => setChannels([]));
    api.get('/whatsapp/handoff/stats').then((r: any) => {
      const s = r?.data ?? r?.data?.data;
      if (s && typeof s === 'object') setStats(s as any);
    }).catch(() => {});
    api.get('/whatsapp/leads').then((r: any) => {
      const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.data) ? r.data.data : []);
      setLeadCount(list.length);
    }).catch(() => {});
  }, []);

  const createDefaultChannel = async () => {
    try {
      const r: any = await api.post('/team/channels', { name: 'handoff', description: 'Escalades clients WhatsApp' });
      const newId = r?.data?.id ?? r?.data?.data?.id;
      const refreshed: any = await api.get('/team/channels');
      const list = Array.isArray(refreshed?.data) ? refreshed.data : (Array.isArray(refreshed?.data?.data) ? refreshed.data.data : []);
      setChannels(list);
      if (newId) setNotifyChannelId(newId);
      toast.success('Canal #handoff créé', 'Sélectionné pour les escalades');
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Impossible de créer le canal');
    }
  };

  const save = async () => {
    if (enabled && !notifyChannelId) {
      toast.error('Canal requis', 'Choisis un canal Équipe où poster les escalades');
      return;
    }
    setSaving(true);
    try {
      const emailsList = notifyEmails.split(',').map(s => s.trim()).filter(Boolean);
      const phonesList = notifyWhatsAppNumbers.split(',').map(s => s.trim().replace(/[\s()-]/g, '')).filter(Boolean);
      await api.patch('/whatsapp/settings', {
        humanHandoff: {
          enabled, notifyChannelId, threshold, customerReply,
          notifyEmails: emailsList,
          notifyWhatsAppNumbers: phonesList,
        },
      });
      toast.success('Handoff enregistré', enabled ? 'Activé — canal + emails + WhatsApp internes notifiés' : 'Désactivé');
    } catch (e: any) {
      toast.error('Échec', e?.response?.data?.message ?? 'Réessaie');
    } finally {
      setSaving(false);
    }
  };

  const thresholds = [
    { id: 'sensitive', label: 'Sensible', desc: '1 signe de frustration suffit' },
    { id: 'normal',    label: 'Normal',    desc: '2+ messages frustrés ou demande explicite' },
    { id: 'strict',    label: 'Strict',    desc: 'Seulement sur demande explicite ("humain", "agent")' },
  ];

  return (
    <div style={{ background: C.cream, borderRadius: 18, padding: 24, border: enabled ? `2px solid ${C.ai}40` : '1px solid rgba(10,42,32,0.06)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.ai }}></div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 13, background: `linear-gradient(135deg, ${C.ai}, ${C.ai}cc)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px -4px ${C.ai}` }}>
          <User size={22} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Handoff humain</span>
            <span className="pill" style={{ background: enabled ? C.emeraldSoft : C.creamDeep, color: enabled ? C.emeraldDeep : C.inkSoft, fontSize: 10, fontWeight: 700 }}>
              {enabled ? '✅ ACTIF' : 'INACTIF'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
            Si le client demande un humain ou se montre frustré, on poste une alerte dans un canal Équipe + on lui répond qu'un humain prend le relais.
          </div>
        </div>
        <button onClick={() => setEnabled(e => !e)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
          {enabled ? <ToggleRight size={36} color={C.ai} /> : <ToggleLeft size={36} color={C.inkSoft} />}
        </button>
      </div>

      {/* Stats — 7 derniers jours; "Leads capturés" links to /admin/whatsapp/leads */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Escalades 7j',    value: stats.total7d,     color: C.ai,         link: null },
          { label: 'Demandes humain', value: stats.explicit,    color: C.blue,       link: null },
          { label: 'Frustrations',    value: stats.frustration, color: C.wa,         link: null },
          { label: 'Leads capturés',  value: leadCount,         color: C.emerald,    link: '/admin/whatsapp/leads' },
        ].map((s, i) => {
          const card = (
            <div key={i} style={{
              background: C.creamDeep, borderRadius: 10, padding: '10px 14px',
              cursor: s.link ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
            {...(s.link ? {
              onMouseOver: (e: any) => { e.currentTarget.style.background = '#FFFAF0'; e.currentTarget.style.boxShadow = `0 4px 12px -4px ${s.color}40`; },
              onMouseOut:  (e: any) => { e.currentTarget.style.background = C.creamDeep; e.currentTarget.style.boxShadow = 'none'; },
            } : {})}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div className="display-font mono-font" style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                {s.link && <span style={{ fontSize: 10, color: s.color, fontWeight: 700 }}>VOIR →</span>}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
            </div>
          );
          return s.link
            ? <a key={i} href={s.link} style={{ textDecoration: 'none' }}>{card}</a>
            : card;
        })}
      </div>

      <div style={{ display: 'grid', gap: 14, opacity: enabled ? 1 : 0.55, pointerEvents: enabled ? 'auto' : 'none' }}>
        {/* Channel picker */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
            Canal Équipe où poster les escalades
          </label>
          <select className="input-field" value={notifyChannelId} onChange={e => setNotifyChannelId(e.target.value)}>
            <option value="">— Choisir un canal —</option>
            {channels.map((c: any) => (
              <option key={c.id} value={c.id}>#{c.name ?? c.id}</option>
            ))}
          </select>
          {channels.length === 0 && (
            <div style={{ marginTop: 8, padding: 10, background: C.creamDeep, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: C.inkSoft }}>
                Aucun canal détecté.
              </span>
              <button onClick={createDefaultChannel} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                <Plus size={12} /> Créer #handoff
              </button>
            </div>
          )}
        </div>

        {/* Threshold */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
            Sensibilité de la détection
          </label>
          <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {thresholds.map(t => {
              const active = threshold === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setThreshold(t.id as any)}
                  style={{
                    background: active ? C.aiSoft : C.creamDeep,
                    border: active ? `2px solid ${C.ai}` : '2px solid transparent',
                    borderRadius: 10, padding: 10,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{t.label}</span>
                    {active && <CheckCircle2 size={12} color={C.ai} />}
                  </div>
                  <span style={{ fontSize: 10, color: C.inkSoft, lineHeight: 1.35 }}>{t.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer reply */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
            Message envoyé au client lors de l'escalade
          </label>
          <textarea
            className="input-field"
            rows={2}
            value={customerReply}
            onChange={(e: any) => setCustomerReply(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Notify by email */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
            📧 Emails à notifier (séparés par virgule, optionnel)
          </label>
          <input
            className="input-field"
            value={notifyEmails}
            onChange={(e: any) => setNotifyEmails(e.target.value)}
            placeholder="manager@entreprise.com, support@entreprise.com"
          />
          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
            Si vide, tous les admins de la société sont notifiés par email à chaque escalade.
          </div>
        </div>

        {/* Notify by WhatsApp internal */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
            💬 Numéros WhatsApp à notifier (séparés par virgule, optionnel)
          </label>
          <input
            className="input-field"
            value={notifyWhatsAppNumbers}
            onChange={(e: any) => setNotifyWhatsAppNumbers(e.target.value)}
            placeholder="+225 07 01 23 45 67, +33 6 12 34 56 78"
          />
          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
            Les responsables reçoivent un WhatsApp instantané avec le numéro client + le message déclencheur. Plus rapide que l'email pour ne pas perdre le lead.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={save} disabled={saving} className="btn-primary">
          <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer le handoff'}
        </button>
      </div>
    </div>
  );
}

// ============ BOT CONFIG ============
// Persona presets — the user picks the agent type (Pro / Personnel / Support / Ventes)
// and a tailored systemPrompt populates the textarea. They can still edit it.
const PERSONA_PRESETS = [
  {
    id: 'pro',
    label: 'Assistant pro',
    icon: '💼',
    desc: 'Ton professionnel, B2B',
    prompt: "Tu es l'assistant professionnel de cette entreprise. Réponds avec courtoisie et précision. Reformule les demandes si besoin, propose des rendez-vous, dirige vers le bon interlocuteur. Ton chaleureux mais formel, pas de familiarité.",
  },
  {
    id: 'personal',
    label: 'Assistant personnel',
    icon: '🌟',
    desc: 'Comme un assistant perso (style Siri/Jarvis)',
    prompt: "Tu es l'assistant personnel du propriétaire. Tu peux tutoyer. Sois proactif : rappelle les rendez-vous, signale les messages urgents, anticipe les besoins. Ton chaleureux et complice — tu connais bien la personne. Réponses courtes et utiles.",
  },
  {
    id: 'support',
    label: 'Support client',
    icon: '🎧',
    desc: 'Calme, empathique, résout les problèmes',
    prompt: "Tu es l'agent de support client. Sois empathique avec les clients frustrés, résous les problèmes rapidement. Toujours commencer par valider l'émotion (« Je comprends votre frustration »). Pose des questions pour diagnostiquer, propose des solutions concrètes. Ton patient et rassurant.",
  },
  {
    id: 'sales',
    label: 'Commercial',
    icon: '🎯',
    desc: 'Conversion, devis, suivi prospects',
    prompt: "Tu es le commercial de l'entreprise. Qualifie les prospects (besoin, budget, urgence), propose des rendez-vous, envoie des devis. Sois enthousiaste sans être insistant. Pose des questions ouvertes, crée un sentiment d'urgence quand c'est approprié. Ton confiant et orienté résultats.",
  },
];

function BotConfigSection({ status }: any) {
  const [autoReply, setAutoReply] = useState(status?.settings?.autoReply ?? true);
  const [mode, setMode] = useState(status?.settings?.replyMode ?? 'auto');
  // Server stores `ttsVoice`; keep the same name client-side to avoid mismatches.
  const [ttsVoice, setTtsVoice] = useState(status?.settings?.ttsVoice ?? status?.settings?.voice ?? 'Fable');
  const [language, setLanguage] = useState(status?.settings?.language ?? 'fr');
  // Server stores `systemPrompt`; persona is just the UI label.
  const [systemPrompt, setSystemPrompt] = useState(
    status?.settings?.systemPrompt ?? status?.settings?.persona ?? PERSONA_PRESETS[0].prompt,
  );
  const [personaId, setPersonaId] = useState<string>(status?.settings?.personaId ?? 'pro');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Hydrate from server once when settings arrive — same fix as HandoffConfigCard.
  // Without this, a race between mount and the API response leaves all fields
  // at their default values even after the server returns the saved config.
  const hasHydrated = React.useRef(false);
  useEffect(() => {
    if (hasHydrated.current) return;
    if (!status?.settings) return;
    hasHydrated.current = true;
    const s = status.settings;
    if (s.autoReply !== undefined) setAutoReply(!!s.autoReply);
    if (s.replyMode) setMode(s.replyMode);
    if (s.ttsVoice ?? s.voice) setTtsVoice(s.ttsVoice ?? s.voice);
    if (s.language) setLanguage(s.language);
    if (s.systemPrompt ?? s.persona) setSystemPrompt(s.systemPrompt ?? s.persona);
    if (s.personaId) setPersonaId(s.personaId);
  }, [status?.settings]);

  const modes = [
    { id: 'text', icon: MessageCircle, label: 'Toujours en texte', desc: 'Réponses textuelles uniquement', color: C.blue },
    { id: 'voice', icon: Mic2, label: 'Toujours en vocal', desc: 'Réponses vocales (TTS)', color: C.voice },
    { id: 'auto', icon: Sparkles, label: 'Automatique', desc: 'Vocal si vocal reçu, sinon texte', color: C.wa, recommended: true },
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
    { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { id: 'pt', label: 'Português', flag: '🇵🇹' },
  ];

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/whatsapp/settings', {
        autoReply,
        replyMode: mode,
        ttsVoice,
        language,
        systemPrompt,
        personaId,
      });
      toast.success('Paramètres enregistrés', 'L\'agent WhatsApp utilise la nouvelle config');
    } catch (e: any) {
      toast.error('Échec de l\'enregistrement', e?.response?.data?.message ?? 'Réessaie dans un instant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px 0' }}>
      <div style={{ background: C.cream, borderRadius: 20, border: '1px solid rgba(10,42,32,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(10,42,32,0.06)', background: `linear-gradient(135deg, ${C.waBubble}, ${C.cream})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 13, background: `linear-gradient(135deg, ${C.wa} 0%, ${C.waDeep} 100%)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 16px -4px ${C.wa}` }}>
              <Bot size={24} />
            </div>
            <div>
              <h3 className="display-font" style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: '-0.02em' }}>
                Configuration <em style={{ fontStyle: 'italic', fontWeight: 500, color: C.wa }}>du bot IA</em>
              </h3>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>Comment l'agent répond automatiquement aux messages</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Réponse auto</span>
            <button onClick={() => setAutoReply((a: boolean) => !a)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              {autoReply ? <ToggleRight size={36} color={C.wa} /> : <ToggleLeft size={36} color={C.inkSoft} />}
            </button>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {/* MODE */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: C.wa, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>1</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Mode de réponse</span>
            </div>
            <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {modes.map(m => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <div key={m.id} onClick={() => setMode(m.id)} style={{ background: active ? `${m.color}15` : C.creamDeep, border: active ? `2px solid ${m.color}` : '2px solid transparent', borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}>
                    {m.recommended && (
                      <div className="pill" style={{ position: 'absolute', top: -8, right: 12, background: C.wa, color: C.cream, fontSize: 9, boxShadow: `0 4px 8px -2px ${C.wa}` }}>
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

          {/* VOICE */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: C.voice, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>2</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Voix de l'agent</span>
                <div className="pill" style={{ background: C.voiceSoft, color: C.voice, fontSize: 10 }}>TTS · OpenAI</div>
              </div>
              <span style={{ fontSize: 11, color: C.inkSoft }}><Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />Cliquez ▶ pour écouter</span>
            </div>
            <div className="voices-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {voices.map(v => {
                const active = ttsVoice === v.id;
                const playing = playingVoice === v.id;
                return (
                  <div key={v.id} onClick={() => setTtsVoice(v.id)} style={{ background: active ? C.voiceSoft : C.creamDeep, border: active ? `2px solid ${C.voice}` : '2px solid transparent', borderRadius: 12, padding: 12, cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 50, background: `linear-gradient(135deg, ${v.color}, ${v.color}cc)`, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Fraunces, serif', fontWeight: 700, fontSize: 14, boxShadow: `0 4px 12px -4px ${v.color}` }}>{v.gender}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="display-font" style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{v.id}</span>
                        {active && <CheckCircle2 size={12} color={C.voice} />}
                      </div>
                      <div style={{ fontSize: 10, color: C.inkSoft }}>{v.desc}</div>
                    </div>
                    <button onClick={(e: any) => { e.stopPropagation(); setPlayingVoice(playing ? null : v.id); }} style={{ width: 32, height: 32, borderRadius: 50, background: playing ? v.color : C.cream, color: playing ? C.cream : v.color, border: `1.5px solid ${v.color}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s ease' }}>
                      {playing ? (
                        <svg width="16" height="14" viewBox="0 0 16 14">
                          <rect className="voice-bar" x="1" y="2" width="2" height="10" fill={C.cream} />
                          <rect className="voice-bar" x="5" y="2" width="2" height="10" fill={C.cream} />
                          <rect className="voice-bar" x="9" y="2" width="2" height="10" fill={C.cream} />
                          <rect className="voice-bar" x="13" y="2" width="2" height="10" fill={C.cream} />
                        </svg>
                      ) : (
                        <PlayCircle size={16} fill={C.cream} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LANGUAGE */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: C.blue, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>3</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Langue du bot</span>
              <div className="pill" style={{ background: C.blueSoft, color: C.blue, fontSize: 10 }}><Languages size={10} /> Multi-langue</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {languages.map(l => {
                const active = language === l.id;
                return (
                  <button key={l.id} onClick={() => setLanguage(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: active ? C.greenDeep : C.creamDeep, color: active ? C.cream : C.ink, border: active ? `2px solid ${C.greenDeep}` : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease' }}>
                    <span style={{ fontSize: 18 }}>{l.flag}</span>
                    {l.label}
                    {active && <CheckCircle2 size={14} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PERSONA TYPE */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: C.ai, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>4</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>Type d'agent</span>
              <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>(choisis un préréglage, puis ajuste si besoin)</span>
            </div>
            <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              {PERSONA_PRESETS.map(p => {
                const active = personaId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setPersonaId(p.id); setSystemPrompt(p.prompt); }}
                    style={{
                      background: active ? C.aiSoft ?? '#EDE9FE' : C.creamDeep,
                      border: active ? `2px solid ${C.ai ?? '#6D28D9'}` : '2px solid transparent',
                      borderRadius: 12, padding: 14,
                      cursor: 'pointer', transition: 'all 0.15s ease',
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 22 }}>{p.icon}</span>
                      {active && <CheckCircle2 size={14} color={C.ai ?? '#6D28D9'} />}
                    </div>
                    <span className="display-font" style={{ fontSize: 13, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em' }}>{p.label}</span>
                    <span style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.35 }}>{p.desc}</span>
                  </div>
                );
              })}
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>
              Instructions personnalisées
            </label>
            <textarea className="input-field" rows={4} value={systemPrompt} onChange={(e: any) => setSystemPrompt(e.target.value)} placeholder="Décris le ton, la personnalité, les règles que doit suivre l'agent…" style={{ resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: C.inkSoft }}><Sparkles size={11} style={{ display: 'inline', marginRight: 4 }} />Powered by Gemini · Pro</span>
              <span className="mono-font" style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>{systemPrompt.length} / 2000</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(10,42,32,0.06)' }}>
            <button
              className="btn-secondary"
              onClick={() => {
                const preset = PERSONA_PRESETS.find(p => p.id === personaId) ?? PERSONA_PRESETS[0];
                setSystemPrompt(preset.prompt);
                toast.info('Instructions réinitialisées', `Préréglage « ${preset.label} » restauré`);
              }}
            >
              Réinitialiser
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Save size={14} /> {saving ? 'Enregistrement…' : 'Sauvegarder les paramètres'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ TEST MESSAGE ============
function TestMessageSection() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Test depuis Orlode AI · Salut ! 👋');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!phone || !message) return;
    setSending(true);
    try { await api.post('/whatsapp/send', { to: phone, body: message }); setSent(true); } catch {}
    setSending(false);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ background: C.cream, borderRadius: 20, padding: 24, border: '1px solid rgba(10,42,32,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: C.wa, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={18} />
          </div>
          <div>
            <h3 className="display-font" style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>Tester un message</h3>
            <div style={{ fontSize: 12, color: C.inkSoft }}>Envoie un message test à un numéro pour vérifier la configuration</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }} className="responsive-charts">
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>Numéro destinataire</label>
            <input className="input-field" placeholder="+225 07 00 00 00 00" value={phone} onChange={(e: any) => setPhone(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: '0.05em', marginBottom: 6, display: 'block', textTransform: 'uppercase' }}>Message</label>
            <input className="input-field" value={message} onChange={(e: any) => setMessage(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, gap: 10, alignItems: 'center' }}>
          {sent && (<span style={{ fontSize: 12, color: C.emeraldDeep, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Envoyé !</span>)}
          <button className="btn-primary" onClick={send} disabled={sending || !phone}><Send size={14} /> {sending ? 'Envoi…' : 'Envoyer le test'}</button>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN ============
export default function WhatsAppConfigPage() {
  const data = useWhatsAppData();
  return (
    <div style={{ background: C.greenDeep, minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: C.greenDeep }}>
        <Hero status={data.status} />
        <StatsKPIs stats={data.stats} messages={data.messages} />
        <MetaConnectionCard status={data.status} />
        <AdvancedFeatures status={data.status} />
        <BotConfigSection status={data.status} />
        <TestMessageSection />
        <LiveSyncBadge lastSync={data?.lastSync} intervalMs={REFRESH_INTERVAL_MS} />
      </main>
    </div>
  );
}
