/**
 * CloneWidget — Elegant editorial widget (cream + deep green + gold) with dual mode.
 * Design language: matches Orlode brand (Fraunces serif, JetBrains mono, gold accents).
 * - Chat mode  : refined bubbles + integrated input + dictation
 * - Voice mode : Gemini Live with halo mic + waveform + status timeline
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  X, Send, Loader2, MessageSquare, Phone, PhoneOff,
  Image as ImageIcon, Camera, Paperclip, Mic, MicOff, Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCloneWidgetStore } from '@/store/cloneWidgetStore';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useGeminiLive, type LiveToolDecl } from '@/hooks/useGeminiLive';
import axios from 'axios';
import api from '@/services/api';

const cloneApi = axios.create({ baseURL: '/api', timeout: 30000, headers: { 'Content-Type': 'application/json' } });

type Mode = 'chat' | 'voice';
interface Message { role: 'user' | 'clone'; content: string }
interface CloneInfo { name: string; greeting: string; company?: string; logoUrl?: string }
interface VoicePromptData { systemInstruction: string; greeting: string; cloneName: string; language: string }

const VOICE_TOOLS: LiveToolDecl[] = [
  {
    functionDeclarations: [
      { name: 'findAppointment', description: 'Rechercher un RDV existant.', parameters: { type: 'OBJECT', properties: { clientPhone: { type: 'STRING' }, clientEmail: { type: 'STRING' }, date: { type: 'STRING' } } } },
      { name: 'createAppointment', description: 'Créer un nouveau RDV (statut pending).', parameters: { type: 'OBJECT', properties: { clientName: { type: 'STRING' }, clientPhone: { type: 'STRING' }, clientEmail: { type: 'STRING' }, service: { type: 'STRING' }, date: { type: 'STRING' }, time: { type: 'STRING' }, notes: { type: 'STRING' } }, required: ['clientName', 'service', 'date', 'time'] } },
      { name: 'addClient', description: 'Enregistrer un prospect dans le CRM.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, phone: { type: 'STRING' }, email: { type: 'STRING' }, notes: { type: 'STRING' } }, required: ['name'] } },
      { name: 'createSupportTicket', description: 'Ticket support pour bug technique.', parameters: { type: 'OBJECT', properties: { subject: { type: 'STRING' }, description: { type: 'STRING' }, clientName: { type: 'STRING' }, clientContact: { type: 'STRING' }, priority: { type: 'STRING' } }, required: ['subject', 'description'] } },
      { name: 'listServices', description: 'Lister les services de l\'entreprise.', parameters: { type: 'OBJECT', properties: {} } },
      { name: 'listProducts', description: 'Lister les produits du catalogue.', parameters: { type: 'OBJECT', properties: { category: { type: 'STRING' }, search: { type: 'STRING' } } } },
      { name: 'createLead', description: 'Enregistrer un prospect commercial.', parameters: { type: 'OBJECT', properties: { name: { type: 'STRING' }, phone: { type: 'STRING' }, email: { type: 'STRING' }, company: { type: 'STRING' }, interest: { type: 'STRING' } }, required: ['name', 'interest'] } },
    ],
  },
];

// Brand palette — matches Orlode editorial
const C = {
  greenDeep: '#0A4F3C',
  greenDark: '#063D2E',
  greenInk: '#042A1F',
  cream: '#FFFAF0',
  creamDeep: '#F5EDD6',
  creamMid: '#FAF3DD',
  gold: '#D4A017',
  goldDeep: '#B8860B',
  goldDark: '#8B6914',
  goldSoft: '#FEF3C7',
  goldLight: '#FCD34D',
  // Brand accent for user bubbles & action elements
  pink: '#EC4899',
  violet: '#A855F7',
  indigo: '#6366F1',
  ink: '#0A2A20',
  inkSoft: '#5A6B62',
  inkLight: '#94A3A0',
  onGreenSoft: '#A8C9B8',
  red: '#EF4444',
  redDeep: '#DC2626',
  redSoft: '#FEE2E2',
};
const BRAND_GRADIENT = `linear-gradient(135deg, ${C.pink} 0%, ${C.violet} 50%, ${C.indigo} 100%)`;

export default function CloneWidget() {
  const { user, company } = useAuthStore();
  const companyId = user?.companyId ?? '';

  const open = useCloneWidgetStore(s => s.open);
  const setOpen = useCloneWidgetStore(s => s.setOpen);
  const [mode, setMode] = useState<Mode>(() => (typeof localStorage !== 'undefined' && localStorage.getItem('cloneWidget.mode') === 'voice' ? 'voice' : 'chat'));
  useEffect(() => { try { localStorage.setItem('cloneWidget.mode', mode); } catch { /* ignore */ } }, [mode]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [info, setInfo] = useState<CloneInfo>({ name: 'Clone', greeting: '' });
  const [loaded, setLoaded] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; type: 'image' | 'file' } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported, interimText, toggle: toggleMic } = useVoiceInput({
    lang: 'fr-FR',
    onTranscript: (text) => setInput(prev => (prev ? prev + ' ' : '') + text),
  });

  const live = useGeminiLive();
  const [voicePrompt, setVoicePrompt] = useState<VoicePromptData | null>(null);
  const [voicePromptLoading, setVoicePromptLoading] = useState(false);
  const voiceSessionId = useRef(`voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const lastLoggedRef = useRef(0);

  useEffect(() => {
    if (open && !loaded && companyId) {
      cloneApi.get(`/clone/${companyId}/info`).then(r => {
        const body = r.data as { success?: boolean; data?: CloneInfo };
        const d = body?.data;
        if (d) {
          setInfo(d);
          if (d.greeting) setMessages([{ role: 'clone', content: d.greeting }]);
        }
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }
  }, [open, loaded, companyId]);

  useEffect(() => {
    if (mode === 'voice' && open && !voicePrompt && companyId && !voicePromptLoading) {
      setVoicePromptLoading(true);
      api.get<VoicePromptData>(`/clone/${companyId}/voice-prompt`)
        .then(r => {
          const raw = r.data as unknown as Record<string, unknown>;
          setVoicePrompt((raw?.data ?? raw) as VoicePromptData);
        })
        .catch(() => null)
        .finally(() => setVoicePromptLoading(false));
    }
  }, [mode, open, companyId, voicePrompt, voicePromptLoading]);

  useEffect(() => {
    if ((mode !== 'voice' || !open) && live.isConnected) live.disconnect();
  }, [mode, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'voice') return;
    if (live.messages.length <= lastLoggedRef.current) return;
    const newMsgs = live.messages.slice(lastLoggedRef.current);
    lastLoggedRef.current = live.messages.length;
    for (const m of newMsgs) {
      if (m.role !== 'user') continue;
      api.post(`/clone/${companyId}/chat`, {
        message: m.text,
        sessionId: voiceSessionId.current,
        channel: 'voice',
        visitorName: 'Visiteur vocal',
      }).catch(() => null);
    }
  }, [live.messages, mode, companyId]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, live.messages, mode]);

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachment({ name: f.name, type });
    e.target.value = '';
  };

  const send = async () => {
    if ((!input.trim() && !attachment) || !companyId) return;
    const msg = input.trim();
    const att = attachment;
    setInput(''); setAttachment(null); setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: msg || (att ? `📎 ${att.name}` : '') }]);
    try {
      const fullMsg = att ? `[${att.type === 'image' ? 'Image' : 'Fichier'}: ${att.name}] ${msg}` : msg;
      const r = await cloneApi.post(`/clone/${companyId}/chat`, { message: fullMsg, sessionId: sessionId || undefined });
      const body = r.data as { success?: boolean; data?: { reply: string; sessionId: string } };
      const d = body?.data;
      if (d) { if (d.sessionId) setSessionId(d.sessionId); setMessages(prev => [...prev, { role: 'clone', content: d.reply }]); }
    } catch { setMessages(prev => [...prev, { role: 'clone', content: 'Une erreur est survenue. Réessayez.' }]); }
    setSending(false);
  };

  const startVoice = async () => {
    if (!voicePrompt) return;
    await live.connect({
      language: voicePrompt.language ?? 'fr',
      voiceName: 'Kore',
      systemInstruction: voicePrompt.systemInstruction,
      tools: VOICE_TOOLS,
      onToolCall: async (name, args) => {
        try {
          const r = await api.post(`/clone/${companyId}/voice-tool`, { toolName: name, params: args });
          const raw = r.data as unknown as Record<string, unknown>;
          return (raw?.data ?? raw) as Record<string, unknown>;
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  };

  if (!companyId) return null;

  const companyName = info.company || company?.name || 'Orlode';
  const companyInitials = companyName.slice(0, 2).toUpperCase();
  const cloneName = mode === 'voice' && voicePrompt?.cloneName ? voicePrompt.cloneName : info.name;
  const displayInput = mode === 'chat' && isListening && interimText ? input + ' ' + interimText : input;
  const hasContent = displayInput.trim().length > 0 || !!attachment;

  const visibleMessages = useMemo(() => {
    if (mode === 'voice') {
      return live.messages.map<Message>(m => ({ role: m.role === 'user' ? 'user' : 'clone', content: m.text }));
    }
    return messages;
  }, [mode, live.messages, messages]);

  const liveStatus =
    live.isConnecting ? 'Connexion…'
    : live.isSpeaking ? `${cloneName} parle`
    : live.isListening ? 'À l\'écoute'
    : live.isConnected ? 'Connecté'
    : 'Prêt';

  const headerStatus = mode === 'voice' ? liveStatus : (loaded ? 'En ligne' : 'Connexion…');

  return (
    <>
      {/* Editorial widget popup — opened via the Header CloneTrigger button */}
      {open && (
        <div
          style={{
            position: 'fixed',
            right: 20, top: 80,
            width: 380,
            height: 'min(620px, calc(100vh - 100px))',
            maxWidth: 'calc(100vw - 32px)',
            borderRadius: 22,
            background: C.cream,
            overflow: 'hidden',
            boxShadow: '0 30px 80px -20px rgba(10,42,32,0.4), 0 12px 32px -12px rgba(10,42,32,0.15), 0 0 0 1px rgba(10,42,32,0.06)',
            zIndex: 61,
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
            color: C.ink,
            animation: 'cloneSlideIn 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* HEADER — deep green + gold thread + brand avatar */}
          <div style={{
            position: 'relative',
            padding: '18px 18px 16px',
            background: `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.greenDark} 50%, ${C.greenInk} 100%)`,
            color: C.cream,
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {/* Subtle radial glow */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse 60% 100% at top right, ${C.gold}1A, transparent 70%)`,
              pointerEvents: 'none',
            }} />
            {/* Gold thread on top edge */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
              background: `linear-gradient(90deg, transparent, ${C.gold}, ${C.goldLight}, ${C.gold}, transparent)`,
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
              {/* Avatar with halo */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  position: 'absolute', inset: -3,
                  borderRadius: '50%',
                  background: BRAND_GRADIENT,
                  filter: 'blur(8px)', opacity: 0.6,
                }} />
                <div style={{
                  position: 'relative',
                  width: 44, height: 44, borderRadius: '50%',
                  background: BRAND_GRADIENT,
                  border: `1.5px solid ${C.gold}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Fraunces, serif',
                  fontSize: 15, fontWeight: 700, color: C.cream,
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                }}>
                  {info.logoUrl
                    ? <img src={info.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : companyInitials}
                </div>
                <span style={{
                  position: 'absolute', bottom: -1, right: -1,
                  width: 12, height: 12, borderRadius: '50%',
                  background: mode === 'voice'
                    ? (live.isConnected ? '#22c55e' : live.isConnecting ? C.gold : C.onGreenSoft)
                    : '#22c55e',
                  border: `2px solid ${C.greenInk}`,
                  boxShadow: '0 0 8px rgba(34,197,94,0.6)',
                }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: 18, fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}>
                  {cloneName}
                  <span style={{
                    fontSize: 13, fontWeight: 400, fontStyle: 'italic',
                    color: C.goldLight, marginLeft: 6,
                  }}>· clone</span>
                </div>
                <div style={{
                  fontSize: 11, marginTop: 3,
                  color: C.onGreenSoft,
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.02em',
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: 5, height: 5, borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 6px #22c55e',
                  }} />
                  <span>{headerStatus.toUpperCase()}</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{companyName}</span>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(255,250,240,0.08)',
                  border: '1px solid rgba(255,250,240,0.15)',
                  color: C.cream, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* MODE TOGGLE — refined segmented control */}
            <div style={{ marginTop: 14, position: 'relative' }}>
              <div style={{
                display: 'flex', gap: 0,
                background: 'rgba(255,250,240,0.08)',
                border: '1px solid rgba(255,250,240,0.12)',
                borderRadius: 10,
                padding: 3,
              }}>
                <ModeBtn active={mode === 'chat'} icon={<MessageSquare size={12} />} label="Conversation" onClick={() => setMode('chat')} />
                <ModeBtn active={mode === 'voice'} icon={<Phone size={12} />} label="Voix en direct" onClick={() => setMode('voice')} />
              </div>
            </div>
          </div>

          {/* MESSAGES — paper feel */}
          <div
            className="cw-thin"
            style={{
              flex: 1, minHeight: 0, overflowY: 'auto',
              padding: '18px 16px',
              background: C.cream,
              backgroundImage: `radial-gradient(circle at 1px 1px, ${C.creamDeep} 1px, transparent 0)`,
              backgroundSize: '24px 24px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            {visibleMessages.length === 0 && mode === 'voice' && !live.isConnected && !live.isConnecting && (
              <VoiceEmptyState cloneName={cloneName} />
            )}

            {visibleMessages.map((msg, i) => (
              <Bubble key={i} role={msg.role} content={msg.content} />
            ))}

            {mode === 'voice' && live.currentText && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '10px 14px',
                  fontSize: 13, lineHeight: 1.55,
                  borderRadius: '14px 14px 14px 4px',
                  background: C.cream,
                  color: C.inkSoft,
                  border: `1px dashed ${C.gold}80`,
                  fontStyle: 'italic',
                }}>
                  {live.currentText}
                </div>
              </div>
            )}

            {sending && mode === 'chat' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '14px 14px 14px 4px',
                  background: C.cream,
                  border: `1px solid ${C.creamDeep}`,
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  <Dot delay={0} />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </div>
              </div>
            )}

            {live.error && mode === 'voice' && (
              <div style={{
                padding: '9px 12px', borderRadius: 8,
                background: C.redSoft, border: `1px solid ${C.red}40`,
                color: C.redDeep, fontSize: 11.5,
              }}>
                {live.error}
              </div>
            )}

            <div ref={scrollRef} />
          </div>

          {/* INPUT */}
          <div style={{
            padding: '12px 14px 14px',
            background: C.creamMid,
            borderTop: `1px solid ${C.creamDeep}`,
            flexShrink: 0,
            position: 'relative',
          }}>
            {/* Gold separator */}
            <div style={{
              position: 'absolute', top: 0, left: 14, right: 14, height: 1,
              background: `linear-gradient(90deg, transparent, ${C.gold}40, transparent)`,
            }} />

            {mode === 'chat' ? (
              <ChatInputZone
                input={displayInput}
                setInput={setInput}
                send={send}
                sending={sending}
                hasContent={hasContent}
                attachment={attachment}
                setAttachment={setAttachment}
                handleAttachment={handleAttachment}
                photoRef={photoRef}
                cameraRef={cameraRef}
                fileRef={fileRef}
                isListening={isListening}
                isSupported={isSupported}
                toggleMic={toggleMic}
              />
            ) : (
              <VoiceControlZone
                isConnected={live.isConnected}
                isConnecting={live.isConnecting}
                isListening={live.isListening}
                isSpeaking={live.isSpeaking}
                voicePromptLoading={voicePromptLoading}
                hasPrompt={!!voicePrompt}
                onStart={startVoice}
                onStop={live.disconnect}
                cloneName={cloneName}
              />
            )}

            <div style={{
              textAlign: 'center', marginTop: 10,
              fontSize: 9.5, color: C.inkLight,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
            }}>
              <span>POWERED BY</span>
              <span style={{
                fontFamily: 'Fraunces, serif',
                fontSize: 11, fontWeight: 700, fontStyle: 'italic',
                color: C.greenDeep, marginLeft: 5,
                letterSpacing: '-0.02em',
              }}>Orlode</span>
              {mode === 'voice' && (
                <>
                  <span style={{ opacity: 0.4, margin: '0 6px' }}>·</span>
                  <span style={{ color: C.goldDark }}>GEMINI LIVE</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ModeBtn({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '7px 10px',
        borderRadius: 8,
        fontSize: 11.5, fontWeight: 600,
        cursor: 'pointer',
        border: 'none',
        background: active ? C.cream : 'transparent',
        color: active ? C.greenInk : C.onGreenSoft,
        transition: 'all 0.18s ease',
        fontFamily: 'inherit',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Bubble({ role, content }: { role: 'user' | 'clone'; content: string }) {
  if (role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '76%',
          padding: '10px 14px',
          fontSize: 13.5, lineHeight: 1.55,
          borderRadius: '16px 16px 4px 16px',
          background: BRAND_GRADIENT,
          color: C.cream,
          boxShadow: `0 6px 18px -4px ${C.violet}80`,
          whiteSpace: 'pre-wrap',
          fontWeight: 500,
        }}>
          {content}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        maxWidth: '78%',
        padding: '10px 14px',
        fontSize: 13.5, lineHeight: 1.6,
        borderRadius: '16px 16px 16px 4px',
        background: '#ffffff',
        color: C.ink,
        border: `1px solid ${C.creamDeep}`,
        boxShadow: '0 1px 2px rgba(10,42,32,0.04), 0 4px 12px -4px rgba(10,42,32,0.08)',
        whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: C.inkLight,
      animation: 'cloneDot 1.2s ease-in-out infinite',
      animationDelay: `${delay}ms`,
    }} />
  );
}

function VoiceEmptyState({ cloneName }: { cloneName: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 24px' }}>
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
        <div style={{
          position: 'absolute', inset: -8,
          borderRadius: '50%',
          background: BRAND_GRADIENT,
          filter: 'blur(20px)', opacity: 0.5,
        }} />
        <div style={{
          position: 'relative',
          width: '100%', height: '100%', borderRadius: '50%',
          background: BRAND_GRADIENT,
          border: `2px solid ${C.gold}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 12px 32px -8px ${C.pink}AA, 0 0 0 4px ${C.cream}`,
        }}>
          <Mic size={32} color={C.cream} />
        </div>
      </div>
      <div style={{
        fontFamily: 'Fraunces, serif',
        fontSize: 19, fontWeight: 600,
        color: C.greenInk,
        letterSpacing: '-0.02em',
        marginBottom: 4,
      }}>
        Conversation <em style={{ fontStyle: 'italic', color: C.goldDark }}>vocale</em>
      </div>
      <div style={{
        fontSize: 13, color: C.inkSoft, lineHeight: 1.5,
        maxWidth: 260, margin: '0 auto 12px',
      }}>
        Discutez en temps réel avec {cloneName}. Voix naturelle, latence sub-seconde.
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        background: C.goldSoft, color: C.goldDark,
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.08em',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        <Sparkles size={10} /> GEMINI LIVE
      </div>
    </div>
  );
}

interface ChatInputZoneProps {
  input: string;
  setInput: (v: string) => void;
  send: () => void;
  sending: boolean;
  hasContent: boolean;
  attachment: { name: string; type: 'image' | 'file' } | null;
  setAttachment: (v: { name: string; type: 'image' | 'file' } | null) => void;
  handleAttachment: (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => void;
  photoRef: React.RefObject<HTMLInputElement>;
  cameraRef: React.RefObject<HTMLInputElement>;
  fileRef: React.RefObject<HTMLInputElement>;
  isListening: boolean;
  isSupported: boolean;
  toggleMic: () => void;
}

function ChatInputZone(p: ChatInputZoneProps) {
  return (
    <>
      {p.attachment && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', marginBottom: 8,
          borderRadius: 10,
          background: C.goldSoft, border: `1px solid ${C.gold}50`,
        }}>
          {p.attachment.type === 'image'
            ? <ImageIcon size={12} color={C.goldDark} />
            : <Paperclip size={12} color={C.goldDark} />}
          <span style={{ flex: 1, fontSize: 11.5, color: C.goldDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace' }}>
            {p.attachment.name}
          </span>
          <button onClick={() => p.setAttachment(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.goldDark }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* TOP ROW: large input field + send button */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: C.cream,
        border: p.hasContent ? `1.5px solid ${C.violet}` : `1px solid ${C.creamDeep}`,
        borderRadius: 14,
        padding: '6px 6px 6px 14px',
        transition: 'all 0.18s',
        boxShadow: p.hasContent ? `0 0 0 3px ${C.violet}20` : 'none',
      }}>
        <input
          value={p.input}
          onChange={e => p.setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); p.send(); } }}
          placeholder={p.isListening ? '🎙 À l\'écoute…' : 'Écrivez votre message…'}
          disabled={p.sending}
          readOnly={p.isListening}
          style={{
            flex: 1, minWidth: 0,
            border: 'none', outline: 'none',
            background: 'transparent',
            fontSize: 14.5, fontFamily: 'inherit',
            color: C.ink,
            padding: '10px 0',
          }}
          autoComplete="off"
        />
        <button
          onClick={p.send}
          disabled={p.sending || !p.hasContent}
          aria-label="Envoyer"
          style={{
            width: 40, height: 40, borderRadius: 11,
            background: p.hasContent ? BRAND_GRADIENT : C.creamDeep,
            border: 'none',
            color: p.hasContent ? C.cream : C.inkLight,
            cursor: p.hasContent && !p.sending ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: p.hasContent ? `0 6px 14px -4px ${C.violet}80` : 'none',
            transition: 'all 0.18s',
          }}
        >
          {p.sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>

      {/* BOTTOM ROW: action icons (small, subtle) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        marginTop: 8,
        paddingLeft: 4,
      }}>
        <ActionPill onClick={() => p.photoRef.current?.click()} title="Joindre une image"
          icon={<ImageIcon size={13} />} label="Photo" />
        <ActionPill onClick={() => p.cameraRef.current?.click()} title="Prendre une photo"
          icon={<Camera size={13} />} label="Caméra" />
        <ActionPill onClick={() => p.fileRef.current?.click()} title="Joindre un fichier"
          icon={<Paperclip size={13} />} label="Fichier" />
        {p.isSupported && (
          <ActionPill
            onClick={p.toggleMic}
            title={p.isListening ? 'Arrêter dictée' : 'Dictée vocale'}
            icon={p.isListening ? <MicOff size={13} /> : <Mic size={13} />}
            label={p.isListening ? 'Stop' : 'Dictée'}
            active={p.isListening}
          />
        )}
      </div>

      <input ref={p.photoRef} type="file" accept="image/*" hidden onChange={(e) => p.handleAttachment(e, 'image')} />
      <input ref={p.cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => p.handleAttachment(e, 'image')} />
      <input ref={p.fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.ppt,.pptx" hidden onChange={(e) => p.handleAttachment(e, 'file')} />
    </>
  );
}

function ActionPill({ onClick, title, icon, label, active }: { onClick: () => void; title: string; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px',
        borderRadius: 999,
        background: active ? C.redSoft : 'transparent',
        border: active ? `1px solid ${C.red}40` : '1px solid transparent',
        color: active ? C.redDeep : C.inkSoft,
        fontSize: 11.5, fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
      onMouseOver={e => { if (!active) { e.currentTarget.style.background = C.creamDeep; e.currentTarget.style.color = C.greenDeep; } }}
      onMouseOut={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.inkSoft; } }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function VoiceControlZone(p: {
  isConnected: boolean; isConnecting: boolean; isListening: boolean; isSpeaking: boolean;
  voicePromptLoading: boolean; hasPrompt: boolean;
  onStart: () => void; onStop: () => void; cloneName: string;
}) {
  const isBusy = p.isConnecting || p.voicePromptLoading;
  const accent = p.isSpeaking ? C.indigo : p.isListening ? '#22c55e' : p.isConnected ? C.violet : C.pink;

  const status =
    p.isConnecting ? 'Connexion en cours…'
    : p.isSpeaking ? `${p.cloneName} parle`
    : p.isListening ? 'Parlez maintenant'
    : p.isConnected ? 'À l\'écoute'
    : p.voicePromptLoading ? 'Chargement…'
    : !p.hasPrompt ? 'Voix indisponible'
    : 'Appuyez pour démarrer';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {/* Waveform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
          <span
            key={i}
            style={{
              width: 2.5, borderRadius: 2,
              height: p.isListening || p.isSpeaking ? `${6 + (i * 2) + Math.random() * 12}px` : '5px',
              background: p.isConnected ? accent : C.creamDeep,
              animation: p.isListening || p.isSpeaking ? `cloneWave${(i % 4) + 1} ${0.5 + (i * 0.04)}s ease-in-out infinite` : 'none',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      {!p.isConnected ? (
        <button
          onClick={p.onStart}
          disabled={!p.hasPrompt || isBusy}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: p.hasPrompt && !isBusy ? BRAND_GRADIENT : C.creamDeep,
            border: p.hasPrompt && !isBusy ? `2px solid ${C.gold}` : `2px solid ${C.creamDeep}`,
            color: p.hasPrompt && !isBusy ? C.cream : C.inkLight,
            cursor: p.hasPrompt && !isBusy ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: p.hasPrompt && !isBusy ? `0 10px 28px -8px ${C.pink}AA` : 'none',
            transition: 'all 0.18s',
          }}
        >
          {isBusy ? <Loader2 size={22} className="animate-spin" /> : <Mic size={22} />}
        </button>
      ) : (
        <button
          onClick={p.onStop}
          aria-label="Raccrocher"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.red} 0%, ${C.redDeep} 100%)`,
            border: `2px solid ${C.gold}`,
            color: C.cream,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 10px 28px -8px ${C.red}AA`,
            animation: 'cloneRingPulse 1.4s ease-in-out infinite',
          }}
        >
          <PhoneOff size={22} />
        </button>
      )}

      <div style={{ textAlign: 'center', minHeight: 18 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: C.greenInk,
          letterSpacing: '-0.005em',
        }}>{status}</div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 9,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.15s',
};
