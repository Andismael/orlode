/**
 * KioskWelcomePage — Single-screen reception kiosk
 * Editorial design with animated HumanAvatar (Aïcha) — connects Gemini Live
 * to drive speaking/listening states, keeps host notification system + nav.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  Calendar, UserPlus, Package, MessageSquare,
  KeyRound, Mic, MicOff, Volume2,
  CheckCircle2, Clock, XCircle, Maximize2, X,
} from 'lucide-react';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { buildEnterpriseLiveConfig } from '@/lib/enterpriseAgentConfig';

// ── Editorial palette ──────────────────────────────────────────────────────
const C = {
  cream: '#FFFAF0',
  greenDeep: '#0A4F3C',
  cyan: '#06B6D4', cyanDeep: '#0891B2', cyanMid: '#67E8F9',
  emerald: '#10B981', emeraldDeep: '#059669',
  blue: '#3B82F6',
  gold: '#D4A017',
  purple: '#8B5CF6',
  red: '#EF4444',
  amber: '#F59E0B',
};

const LANGS = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'ar', label: 'AR' },
] as const;

// ── HumanAvatar — animated SVG with mouth lipsync + listening pulse ────────
function HumanAvatar({ speaking, listening, connecting }: { speaking: boolean; listening: boolean; connecting: boolean }) {
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
      {(listening || connecting) && (
        <>
          <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: `2px solid ${C.cyan}40`, animation: 'kioskPulse 2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', border: `1px solid ${C.cyan}20`, animation: 'kioskPulse 2s ease-in-out infinite', animationDelay: '0.4s' }} />
        </>
      )}

      <svg width="180" height="180" viewBox="0 0 180 180" style={{ borderRadius: '50%', overflow: 'visible' }}>
        <defs>
          <radialGradient id="kioskSkinGrad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#E8B68F" />
            <stop offset="100%" stopColor="#B8855F" />
          </radialGradient>
          <radialGradient id="kioskHairGrad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#3D2817" />
            <stop offset="100%" stopColor="#1A0F08" />
          </radialGradient>
          <linearGradient id="kioskShirtGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={C.cyan} />
            <stop offset="100%" stopColor={C.cyanDeep} />
          </linearGradient>
        </defs>
        <path d="M 30 180 Q 30 130, 90 130 Q 150 130, 150 180 Z" fill="url(#kioskShirtGrad)" />
        <path d="M 70 130 L 90 145 L 110 130" fill="none" stroke={C.cream} strokeWidth="1.5" opacity="0.6" />
        <rect x="78" y="115" width="24" height="20" fill="url(#kioskSkinGrad)" rx="4" />
        <ellipse cx="90" cy="65" rx="58" ry="58" fill="url(#kioskHairGrad)" />
        <ellipse cx="90" cy="78" rx="40" ry="48" fill="url(#kioskSkinGrad)" />
        <path d="M 50 60 Q 60 30, 90 28 Q 120 30, 130 60 Q 130 50, 122 48 Q 110 38, 90 38 Q 70 38, 58 48 Q 50 50, 50 60 Z" fill="url(#kioskHairGrad)" />
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
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function KioskWelcomePage() {
  const { company } = useAuthStore();
  const navigate = useNavigate();
  const [lang, setLang] = useState<'fr' | 'en' | 'es' | 'ar'>('fr');
  const [tapCount, setTapCount] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [time, setTime] = useState(new Date());
  const connectedOnceRef = useRef(false);
  const [hostReply, setHostReply] = useState<{ status: string; hostName: string; replyAction: string | null } | null>(null);
  const activeNotifIdRef = useRef<string | null>(null);

  const {
    isConnected, isConnecting, isListening, isSpeaking,
    currentText, error, connect, disconnect,
  } = useGeminiLive();

  const companyName = (company as unknown as Record<string, unknown>)?.name as string ?? 'Orlode';

  // Clock tick (every 30s is enough)
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-connect Gemini Live on mount
  useEffect(() => {
    if (connectedOnceRef.current) return;
    connectedOnceRef.current = true;
    const timer = setTimeout(() => {
      const companyId = (company as unknown as Record<string, unknown>)?.id as string ?? '';
      connect(buildEnterpriseLiveConfig({
        mode: 'kiosk',
        companyName,
        companyId,
        userName: 'visiteur',
        language: lang,
      }, { voiceName: 'Kore' }));
    }, 500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for notifyHost events from the voice agent
  useEffect(() => {
    const onNotif = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (!detail?.id) return;
      activeNotifIdRef.current = detail.id;
      setHostReply(null);
    };
    window.addEventListener('kiosk:host-notification', onNotif);
    return () => window.removeEventListener('kiosk:host-notification', onNotif);
  }, []);

  // Poll for host reply
  useEffect(() => {
    const interval = setInterval(async () => {
      const id = activeNotifIdRef.current;
      if (!id) return;
      try {
        const r = await fetch(`/api/public/host-notifications/${id}/status`);
        if (!r.ok) return;
        const data = await r.json() as { status: string; replyAction: string | null; hostName: string };
        if (data.status && data.status !== 'pending' && data.replyAction) {
          setHostReply({ status: data.status, hostName: data.hostName, replyAction: data.replyAction });
          activeNotifIdRef.current = null;
          setTimeout(() => setHostReply(null), 30_000);
        }
      } catch { /* ignore */ }
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Admin escape: 5 taps on time → dashboard (kept as backup)
  const handleLogoTap = () => {
    const n = tapCount + 1;
    setTapCount(n);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (n >= 5) { setTapCount(0); navigate('/'); return; }
    tapTimer.current = setTimeout(() => setTapCount(0), 1500);
  };

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => null);
  };

  // Exit kiosk — close fullscreen + window, fallback to dashboard
  const exitKiosk = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
    if (window.opener) {
      window.close();
    } else {
      navigate('/');
    }
  };

  // ESC key → exit kiosk
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) exitKiosk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Click on avatar — manual toggle of the assistant (in case auto-connect fails)
  const toggleAssistant = () => {
    if (isConnected) {
      disconnect();
    } else if (!isConnecting) {
      const companyId = (company as unknown as Record<string, unknown>)?.id as string ?? '';
      connect(buildEnterpriseLiveConfig({
        mode: 'kiosk', companyName, companyId, userName: 'visiteur', language: lang,
      }, { voiceName: 'Kore' }));
    }
  };

  const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // i18n
  const greeting = lang === 'fr' ? 'Bienvenue' : lang === 'en' ? 'Welcome' : lang === 'es' ? 'Bienvenido' : 'مرحبا';
  const subtitle = lang === 'fr' ? `chez ${companyName}` : lang === 'en' ? `at ${companyName}` : lang === 'es' ? `en ${companyName}` : companyName;

  // Live transcript bubble
  const speakingPrompt = lang === 'fr'
    ? <>« Bonjour ! Je suis <strong style={{ color: C.cyanMid, fontStyle: 'normal' }}>Aïcha</strong>, votre assistante d'accueil. Comment puis-je vous aider aujourd'hui ? »</>
    : lang === 'en'
    ? <>« Hello! I'm <strong style={{ color: C.cyanMid, fontStyle: 'normal' }}>Aïcha</strong>, your welcome assistant. How may I help you today? »</>
    : <>« Bienvenidos. Soy <strong style={{ color: C.cyanMid, fontStyle: 'normal' }}>Aïcha</strong>. »</>;

  const idlePrompt = lang === 'fr' ? 'À l\'écoute… Parlez ou choisissez ci-dessous'
                   : lang === 'en' ? 'Listening… Speak or tap below'
                   : lang === 'es' ? 'Escuchando…'
                   : '...';

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#0A0F12', color: C.cream,
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      userSelect: 'none',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&display=swap');
        @keyframes kioskPulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.08); opacity: 0; } }
        .kiosk-display { font-family: 'Fraunces', serif; letter-spacing: -0.02em; }
        .kiosk-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; }
      `}</style>

      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${C.cyan}15, transparent 70%), radial-gradient(circle at top right, ${C.purple}10, transparent 50%)`,
      }} />

      <div style={{ position: 'relative', height: '100%', padding: 32, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar — time + status + lang */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0, marginBottom: 24 }}>
          <div onClick={handleLogoTap} style={{ cursor: 'default' }}>
            <div className="kiosk-display" style={{ fontSize: 56, fontWeight: 800, color: C.cream, lineHeight: 1, letterSpacing: '-0.03em' }}>{timeStr}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,250,240,0.5)', marginTop: 4, textTransform: 'capitalize' }}>{dateStr}</div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {/* Connection status */}
            <div className="kiosk-pill" style={{
              background: isConnected ? C.emerald : isConnecting ? C.amber : C.red,
              color: C.cream,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: C.cream,
                animation: isConnecting ? 'kioskPulse 1.2s ease-in-out infinite' : 'none',
              }} />
              {isConnected ? (isSpeaking ? (lang === 'fr' ? 'PARLE…' : 'SPEAKING…') : isListening ? (lang === 'fr' ? 'EN LIGNE' : 'ONLINE') : (lang === 'fr' ? 'PRÊT' : 'READY'))
                : isConnecting ? (lang === 'fr' ? 'CONNEXION…' : 'CONNECTING…')
                : (lang === 'fr' ? 'HORS LIGNE' : 'OFFLINE')}
            </div>

            {/* Language switcher */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,250,240,0.06)', border: '1px solid rgba(255,250,240,0.08)', borderRadius: 100, padding: 4 }}>
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setLang(l.code)} style={{
                  padding: '6px 12px', borderRadius: 100,
                  background: lang === l.code ? C.cream : 'transparent',
                  color: lang === l.code ? C.greenDeep : 'rgba(255,250,240,0.6)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: 'none', fontFamily: 'inherit',
                }}>{l.label}</button>
              ))}
            </div>

            {/* Fullscreen toggle */}
            <button onClick={requestFullscreen} title="Plein écran (F11)" style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,250,240,0.06)',
              border: '1px solid rgba(255,250,240,0.1)',
              color: 'rgba(255,250,240,0.7)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Maximize2 size={14} />
            </button>

            {/* Exit kiosk — visible close button */}
            <button onClick={exitKiosk} title="Fermer le kiosk (ESC)" style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(239,68,68,0.15)',
              border: `1px solid ${C.red}40`,
              color: '#FCA5A5',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
              onMouseOver={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = C.cream; }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#FCA5A5'; }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Center — avatar + welcome + bubble */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, position: 'relative' }}>

          {/* Host reply banner — overlays the welcome when present */}
          {hostReply && (() => {
            const action = hostReply.replyAction;
            const isAccept = action === 'accept';
            const isWait   = action === 'wait';
            const Icon = isAccept ? CheckCircle2 : isWait ? Clock : XCircle;
            const bg = isAccept ? C.emerald : isWait ? C.amber : C.red;
            const title = lang === 'fr'
              ? (isAccept ? `${hostReply.hostName} arrive !` : isWait ? `${hostReply.hostName} vous demande de patienter` : `${hostReply.hostName} n'est pas disponible`)
              : (isAccept ? `${hostReply.hostName} is on the way!` : isWait ? `${hostReply.hostName} asks you to wait` : `${hostReply.hostName} is not available`);
            const sub = lang === 'fr'
              ? (isAccept ? 'Veuillez patienter ici quelques instants.' : isWait ? 'Asseyez-vous, elle/il vous rejoint dès que possible.' : 'Un autre collaborateur va prendre le relais.')
              : (isAccept ? 'Please wait here a moment.' : isWait ? 'Please have a seat, they will join you shortly.' : 'A colleague will take over.');
            return (
              <div style={{
                background: bg, color: C.cream,
                borderRadius: 24, padding: '20px 28px',
                display: 'flex', alignItems: 'center', gap: 16,
                boxShadow: `0 24px 48px -12px ${bg}`,
                maxWidth: 520, marginBottom: 8,
              }}>
                <Icon size={48} />
                <div>
                  <div className="kiosk-display" style={{ fontSize: 22, fontWeight: 800 }}>{title}</div>
                  <div style={{ fontSize: 13, opacity: 0.92, marginTop: 4 }}>{sub}</div>
                </div>
              </div>
            );
          })()}

          {!hostReply && (
            <>
              <div
                onClick={toggleAssistant}
                style={{ cursor: 'pointer', position: 'relative' }}
                title={isConnected ? (lang === 'fr' ? 'Touchez pour arrêter l\'assistant' : 'Tap to stop assistant') : (lang === 'fr' ? 'Touchez pour démarrer l\'assistant' : 'Tap to start assistant')}
              >
                <HumanAvatar speaking={isSpeaking} listening={isListening} connecting={isConnecting} />
                {/* Floating action hint */}
                {!isConnected && !isConnecting && (
                  <div className="kiosk-pill" style={{
                    position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)',
                    background: C.cream, color: C.greenDeep,
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
                    padding: '6px 14px',
                    boxShadow: '0 8px 20px -4px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                  }}>
                    👆 {lang === 'fr' ? 'TOUCHEZ POUR PARLER' : 'TAP TO TALK'}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center' }}>
                <h1 className="kiosk-display" style={{ fontSize: 48, fontWeight: 800, color: C.cream, margin: 0, letterSpacing: '-0.03em' }}>
                  {greeting}
                </h1>
                <div style={{ fontSize: 18, color: 'rgba(255,250,240,0.6)', marginTop: 4 }}>{subtitle}</div>
              </div>

              {/* Transcript bubble — shows live AI text or placeholder */}
              <div style={{
                background: 'rgba(255,250,240,0.06)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,250,240,0.1)',
                borderRadius: 20, padding: '14px 22px',
                maxWidth: 520, textAlign: 'center',
                fontSize: 15, color: C.cream, lineHeight: 1.5,
                fontStyle: 'italic',
                minHeight: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {currentText ? (
                  <span style={{ fontStyle: 'normal' }}>{currentText}</span>
                ) : isSpeaking ? speakingPrompt : (
                  <>
                    <Mic size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} color={C.cyanMid} />
                    {idlePrompt}
                  </>
                )}
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.15)', border: `1px solid ${C.red}40`, borderRadius: 12, padding: '8px 14px', fontSize: 12, color: '#FCA5A5' }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom — quick actions + employee pill */}
        <div style={{ flexShrink: 0, marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, maxWidth: 720, margin: '0 auto 18px' }}>
            {[
              { label: lang === 'fr' ? 'RDV'       : 'Appointment', desc: lang === 'fr' ? "J'ai un rendez-vous"    : 'I have an appointment', icon: Calendar,        color: C.blue,    to: '/kiosk/checkin?type=appointment' },
              { label: lang === 'fr' ? 'Sans RDV'  : 'Walk-in',     desc: lang === 'fr' ? 'Je viens spontanément'   : 'Walk-in visit',         icon: UserPlus,        color: C.emerald, to: '/kiosk/checkin?type=walkin' },
              { label: lang === 'fr' ? 'Livraison' : 'Delivery',    desc: lang === 'fr' ? 'Déposer un colis'        : 'Drop a package',        icon: Package,         color: C.gold,    to: '/kiosk/checkin?type=delivery' },
              { label: lang === 'fr' ? 'Info'      : 'Info',        desc: lang === 'fr' ? 'Question / direction'    : 'Question / directions', icon: MessageSquare,   color: C.purple,  to: '/kiosk/checkin?type=info' },
            ].map(btn => {
              const Icon = btn.icon;
              return (
                <div key={btn.label} onClick={() => navigate(btn.to)} style={{
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
                  <div className="kiosk-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 2 }}>{btn.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{btn.desc}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => navigate('/kiosk/code')} style={{
              background: 'rgba(255,250,240,0.06)',
              border: '1px solid rgba(255,250,240,0.1)',
              borderRadius: 100, padding: '10px 20px',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', color: C.cream,
              fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
              onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,250,240,0.12)'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,250,240,0.06)'; }}
            >
              <KeyRound size={14} color={C.cyanMid} />
              {lang === 'fr' ? 'Employé — Pointer ma présence' : 'Employee — Check in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
