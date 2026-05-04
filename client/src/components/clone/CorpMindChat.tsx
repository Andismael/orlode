/**
 * OrlodeChat — Standalone single-file chatbot widget.
 * No external imports (no Tailwind, no lucide-react, no framer-motion).
 * Only React base hooks + inline styles + inline SVG + inline <style> keyframes.
 * Drop-in artifact-compatible. Demo mode with auto-reply.
 */
import React, { useState, useRef, useEffect } from 'react';

interface OrlodeChatProps {
  brandInitials?: string;
  brandName?: string;
  brandSlogan?: string;
  agentName?: string;
  agentRole?: string;
  /** Optional async handler; if omitted the component runs in demo mode. */
  onSend?: (msg: string) => Promise<string>;
}

type MsgType = 'sent' | 'received';
interface Msg { id: string; text: string; type: MsgType }

const patternSvg =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'><g fill='none' stroke='%2386efac' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round' opacity='0.45'><circle cx='22' cy='22' r='9'/><path d='M17 22h10M22 17v10'/><rect x='55' y='12' width='22' height='15' rx='2'/><path d='M59 17h14M59 22h10'/><path d='M105 14l6 10h-12z'/><circle cx='111' cy='26' r='2.5'/><circle cx='150' cy='20' r='7'/><path d='M145 20h10M150 15v10'/><path d='M15 58c4-4 8-4 12 0s8 4 12 0'/><circle cx='68' cy='60' r='8'/><path d='M64 60h8M68 56v8'/><rect x='95' y='52' width='18' height='18' rx='3'/><path d='M100 62l3 3 6-6'/><path d='M140 55l-6 6 6 6M150 55l6 6-6 6'/><circle cx='28' cy='98' r='9'/><path d='M23 93l10 10M33 93l-10 10'/><rect x='60' y='88' width='22' height='16' rx='2'/><path d='M64 93h14M64 97h12M64 101h8'/><path d='M105 105c0-10 7-14 12-14s12 4 12 14'/><circle cx='117' cy='91' r='3.5'/><rect x='145' y='92' width='16' height='12' rx='1.5'/><path d='M148 96h12M148 100h8'/><circle cx='18' cy='140' r='7'/><path d='M13 140h10'/><rect x='50' y='130' width='22' height='17' rx='2'/><path d='M53 135h16M53 140h12M53 144h8'/><path d='M100 147l6-12 5 6 6-4'/><circle cx='100' cy='147' r='2'/><circle cx='106' cy='135' r='2'/><circle cx='111' cy='141' r='2'/><circle cx='117' cy='137' r='2'/><path d='M140 135c3-3 7-3 10 0s7 3 10 0'/><path d='M140 143c3-3 7-3 10 0s7 3 10 0'/></g></svg>\")";

export default function OrlodeChat({
  brandInitials = 'CM',
  brandName = 'ORLODE',
  brandSlogan = 'THE MIND YOUR BUSINESS DESERVES',
  agentName = 'Orlode AI',
  agentRole = 'Agent Commercial · Actif',
  onSend,
}: OrlodeChatProps) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'm1', type: 'received', text: `Salut 👋 Comment je peux t'aider ?` },
    { id: 'm2', type: 'sent', text: `Je veux créer un contrat client` },
    { id: 'm3', type: 'received', text: `Parfait ! Envoie les détails ou un vocal.` },
    { id: 'm4', type: 'sent', text: `Kouassi SARL, 12 mois exclusif CI` },
    { id: 'm5', type: 'received', text: `Contrat généré via WEMAS ✓ Lien WhatsApp envoyé` },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  const hasText = inputValue.trim().length > 0;

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = async () => {
    if (!hasText || sending) return;
    const userText = inputValue.trim();
    const userMsg: Msg = { id: `u${Date.now()}`, type: 'sent', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSending(true);

    try {
      let reply: string;
      if (onSend) {
        reply = await onSend(userText);
      } else {
        // Demo mode — simulated reply
        await new Promise(r => setTimeout(r, 800));
        reply = `Bien reçu : "${userText}". Je traite ça.`;
      }
      setMessages(prev => [...prev, { id: `a${Date.now()}`, type: 'received', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: `e${Date.now()}`, type: 'received', text: 'Une erreur est survenue. Réessayez.' }]);
    }
    setSending(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    wrap: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
      width: 400,
      height: 680,
      position: 'relative' as const,
      borderRadius: 32,
      background: '#0f2e20',
      overflow: 'hidden',
      boxShadow:
        '0 20px 60px rgba(0,0,0,0.5), 0 0 0 8px #1a1a2e, 0 0 0 9px #2a2a4e',
      isolation: 'isolate' as const,
      display: 'flex',
      flexDirection: 'column' as const,
    },
    scene: {
      position: 'absolute' as const,
      inset: 0,
      background: 'linear-gradient(135deg, #2d5a3d 0%, #1f4530 30%, #15352a 60%, #0d2520 100%)',
      overflow: 'hidden',
    },
    pattern: {
      position: 'absolute' as const,
      inset: 0,
      backgroundImage: patternSvg,
      backgroundSize: '180px 180px',
      backgroundRepeat: 'repeat',
      animation: 'cmc-pattern-drift 80s linear infinite',
      opacity: 0.85,
    },
    aurora1: {
      position: 'absolute' as const,
      top: '-10%', left: '-15%',
      width: '80%', height: '55%',
      filter: 'blur(40px)',
      mixBlendMode: 'screen' as const,
      background: 'radial-gradient(ellipse, rgba(167,139,250,0.4) 0%, transparent 65%)',
      animation: 'cmc-aurora-pulse 10s ease-in-out infinite',
    },
    aurora2: {
      position: 'absolute' as const,
      bottom: '-10%', right: '-15%',
      width: '75%', height: '55%',
      filter: 'blur(40px)',
      mixBlendMode: 'screen' as const,
      background: 'radial-gradient(ellipse, rgba(96,165,250,0.35) 0%, transparent 65%)',
      animation: 'cmc-aurora-pulse 14s ease-in-out infinite reverse',
    },
    watermark: {
      position: 'absolute' as const,
      top: '45%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: 10,
      opacity: 0.22,
      pointerEvents: 'none' as const,
      zIndex: 3,
    },
    wmLogo: {
      width: 110, height: 110,
      borderRadius: '50%',
      border: '2.5px solid #fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 34,
      fontWeight: 600,
      letterSpacing: '1.5px',
    },
    wmText: {
      color: '#fff', fontSize: 24, fontWeight: 500, letterSpacing: '5px',
    },
    wmSub: {
      color: '#fff', fontSize: 8, letterSpacing: '2.5px', marginTop: -2, opacity: 0.85,
    },
    app: {
      position: 'relative' as const,
      height: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
      zIndex: 4,
    },
    topbar: {
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'rgba(13,37,32,0.75)',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      flexShrink: 0,
      zIndex: 5,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    },
    backBtn: {
      width: 32, height: 32,
      borderRadius: '50%',
      background: 'rgba(167,139,250,0.2)',
      border: '1px solid rgba(167,139,250,0.35)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
    },
    agentWrap: { position: 'relative' as const, flexShrink: 0, width: 40, height: 40 },
    agentGlow: {
      position: 'absolute' as const,
      inset: -8,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(236,72,153,0.7) 0%, rgba(167,139,250,0.4) 50%, transparent 70%)',
      animation: 'cmc-glow-pulse 3s ease-in-out infinite',
      zIndex: 0,
      pointerEvents: 'none' as const,
    },
    agentRing: {
      position: 'absolute' as const,
      inset: -5,
      borderRadius: '50%',
      border: '1.5px solid transparent',
      borderTopColor: 'rgba(255,255,255,0.9)',
      borderRightColor: 'rgba(236,72,153,0.7)',
      animation: 'cmc-ring-spin 4s linear infinite',
      zIndex: 1,
      pointerEvents: 'none' as const,
    },
    agentAvatar: {
      position: 'relative' as const,
      width: 40, height: 40,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #6366f1 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      boxShadow: '0 0 0 2.5px rgba(255,255,255,0.3), 0 0 25px rgba(236,72,153,0.8)',
      zIndex: 2,
    },
    agentDot: {
      position: 'absolute' as const,
      bottom: 0, right: 0,
      width: 11, height: 11,
      borderRadius: '50%',
      background: '#4ade80',
      border: '2px solid #0d2520',
      boxShadow: '0 0 10px #4ade80',
      zIndex: 4,
    },
    agentInfo: { flex: 1, minWidth: 0 },
    agentTitle: {
      color: '#fff', fontSize: 13.5, fontWeight: 500,
      marginBottom: 2,
      textShadow: '0 2px 8px rgba(0,0,0,0.5)',
    },
    agentStatus: {
      display: 'flex', alignItems: 'center', gap: 5,
      fontSize: 10, color: '#86efac',
    },
    topBtn: {
      width: 32, height: 32,
      borderRadius: 10,
      background: 'rgba(167,139,250,0.18)',
      border: '1px solid rgba(167,139,250,0.3)',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    msgs: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '16px 14px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 12,
      minHeight: 0,
      position: 'relative' as const,
    },
    msgRow: (type: MsgType): React.CSSProperties => ({
      display: 'flex',
      maxWidth: '80%',
      alignSelf: type === 'sent' ? 'flex-end' : 'flex-start',
      animation: 'cmc-msg-fade 0.4s ease',
      zIndex: 2,
    }),
    bubble: (type: MsgType): React.CSSProperties => ({
      padding: '10px 14px',
      fontSize: 12.5,
      lineHeight: 1.5,
      borderRadius: 18,
      wordWrap: 'break-word',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      color: '#fff',
      background: type === 'sent'
        ? 'linear-gradient(135deg, rgba(168,85,247,0.9) 0%, rgba(124,58,237,0.9) 100%)'
        : 'linear-gradient(135deg, rgba(59,130,246,0.85) 0%, rgba(37,99,235,0.85) 100%)',
      border: type === 'sent'
        ? '1px solid rgba(196,181,253,0.35)'
        : '1px solid rgba(147,197,253,0.35)',
      borderBottomRightRadius: type === 'sent' ? 6 : 18,
      borderBottomLeftRadius: type === 'received' ? 6 : 18,
      boxShadow: type === 'sent'
        ? '0 4px 16px rgba(147,51,234,0.45)'
        : '0 4px 16px rgba(37,99,235,0.4)',
    }),
    typing: {
      padding: '10px 14px',
      borderRadius: 18,
      borderBottomLeftRadius: 6,
      background: 'linear-gradient(135deg, rgba(59,130,246,0.85), rgba(37,99,235,0.85))',
      border: '1px solid rgba(147,197,253,0.35)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      display: 'inline-flex',
      gap: 4,
    },
    dot: (delay: number): React.CSSProperties => ({
      width: 6, height: 6, borderRadius: '50%',
      background: 'rgba(255,255,255,0.75)',
      animation: `cmc-typing-bounce 1.2s ease-in-out ${delay}ms infinite`,
    }),
    inputZone: {
      flexShrink: 0,
      background: 'rgba(13,37,32,0.9)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      padding: '10px 12px 14px',
      zIndex: 5,
      borderTop: '1px solid rgba(255,255,255,0.08)',
    },
    inputBox: (typing: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: typing ? 'rgba(30,60,45,0.65)' : 'rgba(60,40,110,0.55)',
      border: `1.5px solid ${typing ? 'rgba(134,239,172,0.7)' : 'rgba(167,139,250,0.4)'}`,
      boxShadow: typing ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
      borderRadius: 28,
      padding: '5px 5px 5px 16px',
      transition: 'all 0.3s',
      marginBottom: 10,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }),
    input: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: '#fff',
      fontSize: 13.5,
      fontFamily: 'inherit',
      padding: '10px 0',
      minWidth: 0,
    } as React.CSSProperties,
    sendBtn: (active: boolean): React.CSSProperties => ({
      width: active ? 54 : 38,
      height: active ? 54 : 38,
      borderRadius: '50%',
      background: active
        ? 'linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #16a34a 100%)'
        : 'rgba(167,139,250,0.25)',
      border: active ? '2.5px solid rgba(187,247,208,0.6)' : '1.5px solid rgba(196,181,253,0.4)',
      color: active ? '#fff' : 'rgba(196,181,253,0.8)',
      cursor: active ? 'pointer' : 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      boxShadow: active
        ? '0 0 0 4px rgba(74,222,128,0.3), 0 8px 24px rgba(34,197,94,0.8), inset 0 1px 0 rgba(255,255,255,0.4)'
        : 'none',
      animation: active ? 'cmc-send-pulse 2s ease-in-out infinite' : 'none',
    }),
    mediaRow: (hidden: boolean): React.CSSProperties => ({
      display: 'flex',
      gap: 8,
      justifyContent: 'space-between',
      padding: '0 2px',
      transition: 'all 0.3s',
      opacity: hidden ? 0.45 : 1,
      transform: hidden ? 'scale(0.96)' : 'scale(1)',
    }),
    mediaBtn: (color: string, borderColor: string): React.CSSProperties => ({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '10px 6px',
      borderRadius: 14,
      border: `1px solid ${borderColor}`,
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: 'rgba(30,30,60,0.6)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      color,
    }),
    mediaLabel: { fontSize: 10, fontWeight: 500, color: '#fff' },
  };

  return (
    <div style={S.wrap}>
      {/* Inline keyframes */}
      <style>{`
        @keyframes cmc-pattern-drift {
          from { background-position: 0 0; }
          to { background-position: 180px 180px; }
        }
        @keyframes cmc-aurora-pulse {
          0%,100% { opacity: 0.7; transform: scale(1); }
          50%     { opacity: 1;   transform: scale(1.15); }
        }
        @keyframes cmc-glow-pulse {
          0%,100% { opacity: 0.7; transform: scale(1); }
          50%     { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes cmc-ring-spin { to { transform: rotate(360deg); } }
        @keyframes cmc-msg-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cmc-send-pulse {
          0%,100% { box-shadow: 0 0 0 4px rgba(74,222,128,0.3), 0 8px 24px rgba(34,197,94,0.8), inset 0 1px 0 rgba(255,255,255,0.4); }
          50%     { box-shadow: 0 0 0 8px rgba(74,222,128,0.4), 0 10px 32px rgba(34,197,94,1),   inset 0 1px 0 rgba(255,255,255,0.4); }
        }
        @keyframes cmc-typing-bounce {
          0%,60%,100% { transform: translateY(0); opacity: 0.5; }
          30%         { transform: translateY(-4px); opacity: 1; }
        }
        .cmc-msgs::-webkit-scrollbar { width: 3px; }
        .cmc-msgs::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.3); border-radius: 2px; }
        .cmc-media-btn:hover { transform: translateY(-2px); background: rgba(40,40,80,0.75) !important; }
        .cmc-send-active:hover { transform: scale(1.08); }
        .cmc-send-active:active { transform: scale(0.92); }
        .cmc-input::placeholder { color: rgba(255,255,255,0.55); }
      `}</style>

      {/* Background scene */}
      <div style={S.scene}>
        <div style={S.pattern} />
        <div style={S.aurora1} />
        <div style={S.aurora2} />
        {/* Watermark */}
        <div style={S.watermark}>
          <div style={S.wmLogo}>{brandInitials}</div>
          <div style={S.wmText}>{brandName}</div>
          <div style={S.wmSub}>{brandSlogan}</div>
        </div>
      </div>

      {/* App container */}
      <div style={S.app}>
        {/* Top bar */}
        <div style={S.topbar}>
          <div style={S.backBtn} role="button" aria-label="Retour">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div style={S.agentWrap}>
            <div style={S.agentGlow} />
            <div style={S.agentRing} />
            <div style={S.agentAvatar}>{brandInitials}</div>
            <div style={S.agentDot} />
          </div>
          <div style={S.agentInfo}>
            <div style={S.agentTitle}>{agentName}</div>
            <div style={S.agentStatus}>{agentRole}</div>
          </div>
          <div style={S.topBtn} role="button" aria-label="Menu">
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </div>
        </div>

        {/* Messages */}
        <div ref={msgsRef} className="cmc-msgs" style={S.msgs}>
          {messages.map(m => (
            <div key={m.id} style={S.msgRow(m.type)}>
              <div style={S.bubble(m.type)}>{m.text}</div>
            </div>
          ))}
          {sending && (
            <div style={S.msgRow('received')}>
              <div style={S.typing}>
                <span style={S.dot(0)} />
                <span style={S.dot(150)} />
                <span style={S.dot(300)} />
              </div>
            </div>
          )}
        </div>

        {/* Input zone */}
        <div style={S.inputZone}>
          <div style={S.inputBox(hasText)}>
            <input
              className="cmc-input"
              style={S.input}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Écris ton message..."
              disabled={sending}
              autoComplete="off"
            />
            <button
              onClick={handleSend}
              disabled={!hasText || sending}
              className={hasText ? 'cmc-send-active' : ''}
              style={S.sendBtn(hasText)}
              aria-label="Envoyer"
            >
              <svg
                width={hasText ? 26 : 16}
                height={hasText ? 26 : 16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={hasText ? 3 : 2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: hasText ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' : 'none' }}
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>

          {/* Media row */}
          <div style={S.mediaRow(hasText)}>
            <button className="cmc-media-btn" style={S.mediaBtn('#f472b6', 'rgba(236,72,153,0.55)')} aria-label="Photo">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span style={S.mediaLabel}>Photo</span>
            </button>
            <button className="cmc-media-btn" style={S.mediaBtn('#fbbf24', 'rgba(245,158,11,0.55)')} aria-label="Caméra">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span style={S.mediaLabel}>Caméra</span>
            </button>
            <button className="cmc-media-btn" style={S.mediaBtn('#60a5fa', 'rgba(96,165,250,0.65)')} aria-label="Fichier">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
              <span style={S.mediaLabel}>Fichier</span>
            </button>
            <button className="cmc-media-btn" style={S.mediaBtn('#c4b5fd', 'rgba(167,139,250,0.65)')} aria-label="Vocal">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
              </svg>
              <span style={S.mediaLabel}>Vocal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
