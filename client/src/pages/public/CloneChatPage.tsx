/**
 * CloneChatPage — The Company's Digital Twin — Public conversation interface
 * URL: /clone/:companyId
 * No auth required — this is the company speaking to the world
 */
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Loader2, MessageSquare, X, Sparkles, Mic, MicOff, Volume2 } from 'lucide-react';
import axios from 'axios';
import { CloneAvatarLight, type AvatarState } from '@/components/clone/CloneAvatar';
import PerCompanyPWAHead from '@/components/common/PerCompanyPWAHead';

// Use raw axios for public pages — no auth interceptor
const publicApi = axios.create({ baseURL: '/api', timeout: 30000, headers: { 'Content-Type': 'application/json' } });

interface CloneInfo { name: string; company: string; sector: string; greeting: string; tone: string; logoUrl: string; primaryColor: string; accentColor: string; products: string[]; website: string; suggestedQuestions: string[] }
interface Message { role: 'user' | 'clone'; content: string; timestamp: Date }

export default function CloneChatPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [info, setInfo] = useState<CloneInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [loading, setLoading] = useState(true);
  const [ctaButtons, setCtaButtons] = useState<{ label: string; action: string; icon: string }[]>([]);
  const [escalated, setEscalated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const [micState, setMicState] = useState<'ready' | 'listening' | 'processing' | 'responding' | 'error' | 'denied'>('ready');
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECORDING_SECONDS = 30;
  const [audioLevel, setAudioLevel] = useState(0); // 0-1 for waveform
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  // Micro beep feedback (Web Audio API)
  const playBeep = (freq: number, duration: number) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.start(); osc.stop(ctx.currentTime + duration / 1000);
      setTimeout(() => ctx.close(), duration + 100);
    } catch {}
  };

  useEffect(() => {
    if (!companyId) return;
    publicApi.get(`/clone/${companyId}/info`).then(r => {
      const body = r.data as { success?: boolean; data?: CloneInfo };
      const data = body?.data;
      if (data) {
        setInfo(data);
        setMessages([{ role: 'clone', content: data.greeting, timestamp: new Date() }]);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = text ?? input;
    if (!msg.trim() || !companyId) return;
    setInput('');
    setSending(true);

    // State: listening (user just spoke)
    setAvatarState('listening');
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date() }]);

    // State: thinking (processing)
    setTimeout(() => setAvatarState('thinking'), 300);

    try {
      const r = await publicApi.post(`/clone/${companyId}/chat`, { message: msg, sessionId: sessionId || undefined });
      const body = r.data as { success?: boolean; data?: { reply: string; sessionId: string; ctaButtons?: { label: string; action: string; icon: string }[]; escalateToHuman?: boolean; escalateReason?: string } };
      const data = body?.data;

      // State: speaking (delivering response)
      setAvatarState('speaking');

      if (data) {
        if (data.sessionId) setSessionId(data.sessionId);
        setMessages(prev => [...prev, { role: 'clone', content: data.reply, timestamp: new Date() }]);
        if (data.ctaButtons) setCtaButtons(data.ctaButtons);
        if (data.escalateToHuman) setEscalated(true);
      }

      // State: back to idle — duration scales with reply length
      const speakDuration = Math.min(5000, Math.max(1500, (data?.reply?.length ?? 100) * 15));
      setTimeout(() => setAvatarState('idle'), speakDuration);
    } catch {
      setMessages(prev => [...prev, { role: 'clone', content: `${info?.name ?? 'L\'assistant'} rencontre un probleme. Reessayez dans un instant.`, timestamp: new Date() }]);
      setAvatarState('error');
      setTimeout(() => setAvatarState('idle'), 4000);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  // Voice recording with smart states + timer + fallback
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
      audioChunksRef.current = [];
      setRecordingTime(0);

      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        setRecording(false);
        setMicState('processing');
        setAvatarState('thinking');

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          if (!base64 || !companyId) { setMicState('ready'); setAvatarState('idle'); return; }

          setSending(true);
          setMessages(prev => [...prev, { role: 'user', content: '🎤 Message vocal...', timestamp: new Date() }]);

          try {
            const r = await publicApi.post(`/clone/${companyId}/voice`, { audio: base64, sessionId: sessionId || undefined, language: 'fr' });
            const body = r.data as { success?: boolean; data?: { reply: string; transcription: string; sessionId: string; audio?: string; ctaButtons?: { label: string; action: string; icon: string }[]; fallbackToText?: boolean; voiceLatencyMs?: number } };
            const data = body?.data;

            if (data) {
              if (data.sessionId) setSessionId(data.sessionId);
              setMessages(prev => [...prev.slice(0, -1), { role: 'user', content: `🎤 ${data.transcription || 'Message vocal'}`, timestamp: new Date() }, { role: 'clone', content: data.reply, timestamp: new Date() }]);
              if (data.ctaButtons) setCtaButtons(data.ctaButtons);

              // FALLBACK: if no audio response, show text fallback message
              if (data.fallbackToText) {
                setMicState('error');
                setTimeout(() => setMicState('ready'), 3000);
              } else {
                setMicState('responding');
              }

              setAvatarState('speaking');

              // Play audio response with fade in/out
              if (data.audio) {
                try {
                  const audioBlob = new Blob([Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))], { type: 'audio/mp3' });
                  const audioUrl = URL.createObjectURL(audioBlob);
                  const actx = new AudioContext();
                  const resp = await fetch(audioUrl);
                  const arrBuf = await resp.arrayBuffer();
                  const audioBuf = await actx.decodeAudioData(arrBuf);
                  const source = actx.createBufferSource();
                  const gainNode = actx.createGain();
                  source.buffer = audioBuf;
                  source.connect(gainNode); gainNode.connect(actx.destination);
                  // Fade in 300ms
                  gainNode.gain.setValueAtTime(0, actx.currentTime);
                  gainNode.gain.linearRampToValueAtTime(1, actx.currentTime + 0.3);
                  // Fade out last 500ms
                  const duration = audioBuf.duration;
                  if (duration > 0.8) gainNode.gain.setValueAtTime(1, actx.currentTime + duration - 0.5);
                  gainNode.gain.linearRampToValueAtTime(0, actx.currentTime + duration);
                  source.onended = () => { setAvatarState('idle'); setMicState('ready'); actx.close(); };
                  source.start();
                } catch { setAvatarState('idle'); setMicState('ready'); }
              } else {
                const dur = Math.min(5000, Math.max(1500, (data.reply?.length ?? 100) * 15));
                setTimeout(() => { setAvatarState('idle'); setMicState('ready'); }, dur);
              }
            }
          } catch {
            setMessages(prev => [...prev.slice(0, -1), { role: 'clone', content: 'La voix est temporairement indisponible. Ecrivez votre message ci-dessous.', timestamp: new Date() }]);
            setAvatarState('error'); setMicState('error');
            setTimeout(() => { setAvatarState('idle'); setMicState('ready'); }, 4000);
          }
          setSending(false);
        };
        reader.readAsDataURL(blob);
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setMicState('listening');
      setAvatarState('listening');
      playBeep(880, 120); // Start beep

      // Waveform analyzer
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;
          setAudioLevel(Math.min(1, avg / 128));
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch {}

      // Timer + auto-stop at MAX_RECORDING_SECONDS
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_SECONDS - 1) { stopRecording(); return 0; }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      // Mic denied or not available → fallback to text
      setMicState('denied');
      setMessages(prev => [...prev, { role: 'clone', content: 'Le micro n\'est pas disponible. Vous pouvez ecrire votre message ci-dessous.', timestamp: new Date() }]);
      setTimeout(() => setMicState('ready'), 5000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      playBeep(660, 100); // Stop beep (lower pitch)
      mediaRecorderRef.current.stop();
      // Cleanup waveform
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      analyserRef.current = null;
      setAudioLevel(0);
    }
  };

  // Typing detection — show shimmer while user types
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (avatarState === 'idle' && e.target.value.length > 0) {
      setAvatarState('typing');
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (avatarState === 'typing') setAvatarState('idle');
    }, 1500);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;
  if (!info) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Clone non configure.</div>;

  const primary = info.primaryColor || '#0019FF';
  const accent = info.accentColor || '#0092FF';

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#0d2520' }}>
      <PerCompanyPWAHead
        companyId={companyId!}
        companyName={info.company || info.name}
        logoUrl={info.logoUrl}
        primaryColor={primary}
      />
      {/* Cosmic background with company watermark */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, #2d5a3d 0%, #1f4530 30%, #15352a 60%, #0d2520 100%)' }} />
      <div className="absolute inset-0 scene-pattern-drift opacity-80 pointer-events-none" />
      <div className="scene-aurora scene-aurora-1" />
      <div className="scene-aurora scene-aurora-2" />
      <div className="scene-aurora scene-aurora-3" />
      {/* Watermark — company logo + name */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 opacity-[0.15] select-none pointer-events-none z-0">
        <div className="w-40 h-40 rounded-full border-[3px] border-white flex items-center justify-center overflow-hidden">
          {info.logoUrl ? (
            <img src={info.logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-4xl font-semibold tracking-wider">
              {info.company?.slice(0, 2).toUpperCase() ?? 'CM'}
            </span>
          )}
        </div>
        <div className="text-white text-3xl font-medium" style={{ letterSpacing: '8px' }}>{info.company?.toUpperCase()}</div>
      </div>

      {/* Header */}
      <div className="relative z-10 backdrop-blur-md px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgba(13,37,32,0.75)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <CloneAvatarLight primaryColor={primary} accentColor={accent} state={avatarState} size="sm" />
        <div>
          <h1 className="text-sm font-bold text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{info.company}</h1>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: '0 0 8px #4ade80' }} />
            <p className="text-xs" style={{ color: '#86efac' }}>{info.name} · En ligne</p>
          </div>
        </div>
        {info.website && (
          <a href={info.website.startsWith('http') ? info.website : `https://${info.website}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-white/50 hover:text-white/80">{info.website}</a>
        )}
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.role === 'clone' && (
              <CloneAvatarLight primaryColor="#ec4899" accentColor="#a855f7" state={i >= messages.length - 2 ? avatarState : 'idle'} size="sm" className="flex-shrink-0 mt-1" />
            )}
            <div className="max-w-[80%] rounded-2xl px-4 py-3 text-white backdrop-blur-md"
              style={msg.role === 'user' ? {
                background: 'linear-gradient(135deg, rgba(168,85,247,0.9) 0%, rgba(124,58,237,0.9) 100%)',
                border: '1px solid rgba(196,181,253,0.35)',
                borderBottomRightRadius: '6px',
                boxShadow: '0 4px 16px rgba(147,51,234,0.45)',
              } : {
                background: 'linear-gradient(135deg, rgba(59,130,246,0.85) 0%, rgba(37,99,235,0.85) 100%)',
                border: '1px solid rgba(147,197,253,0.4)',
                borderBottomLeftRadius: '6px',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <p className="text-[10px] mt-1 text-white/60">
                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 backdrop-blur-md"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.85), rgba(37,99,235,0.85))', border: '1px solid rgba(147,197,253,0.4)' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Suggested questions (show only at start) */}
      {messages.length <= 1 && info.suggestedQuestions && (
        <div className="relative z-10 px-4 pb-2 max-w-2xl mx-auto w-full">
          <div className="flex flex-wrap gap-2">
            {info.suggestedQuestions.map((q, i) => (
              <button key={i} onClick={() => send(q)}
                className="text-xs px-3 py-2 rounded-xl backdrop-blur-md text-white/90 transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(196,181,253,0.3)' }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA Buttons */}
      {ctaButtons.length > 0 && !escalated && (
        <div className="relative z-10 px-4 pb-2 max-w-2xl mx-auto w-full">
          <div className="flex flex-wrap gap-2">
            {ctaButtons.map((cta, i) => (
              <button key={i} onClick={() => send(cta.label)}
                className="text-xs px-4 py-2.5 rounded-xl font-medium text-white transition-all hover:shadow-lg active:scale-95"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.9), rgba(124,58,237,0.9))', border: '1px solid rgba(196,181,253,0.5)', boxShadow: '0 4px 16px rgba(147,51,234,0.45)' }}>
                {cta.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Escalation banner */}
      {escalated && (
        <div className="relative z-10 px-4 pb-2 max-w-2xl mx-auto w-full">
          <div className="rounded-xl p-3 flex items-center gap-3 backdrop-blur-md"
            style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.45)' }}>
            <span className="text-lg">🤝</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-200">Transfert vers un conseiller</p>
              <p className="text-xs text-orange-300/80">Un membre de l'equipe va vous recontacter tres rapidement.</p>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 px-4 py-3 backdrop-blur-md"
        style={{ background: 'rgba(13,37,32,0.9)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-2 rounded-full px-3 backdrop-blur-md"
          style={{
            background: 'rgba(60,40,110,0.55)',
            border: `1.5px solid ${input.trim() ? 'rgba(134,239,172,0.7)' : 'rgba(167,139,250,0.4)'}`,
            transition: 'border 0.2s',
          }}>
          <input
            value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
            placeholder={`Ecrivez a ${info.name}...`}
            className="clone-input flex-1 bg-transparent text-white placeholder-white/50 py-3 focus:outline-none"
            style={{ fontSize: '16px' }}
            disabled={sending}
          />
          {/* Organic VU meter */}
          {recording && (
            <div className="flex items-end gap-0.5 px-1 h-6">
              {[0.3, 0.55, 0.85, 1, 0.8, 0.5, 0.35].map((base, i) => {
                const phase = Math.sin(Date.now() / (200 + i * 40)) * 0.15;
                const h = Math.max(3, (audioLevel * base + phase) * 22);
                return <div key={i} className="w-1 rounded-full bg-gradient-to-t from-red-500 to-red-300" style={{ height: `${h}px`, transition: 'height 150ms cubic-bezier(0.4, 0, 0.2, 1)' }} />;
              })}
            </div>
          )}

          {/* Smart mic button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={(sending && !recording) || micState === 'denied'}
            className={`relative w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
              micState === 'listening' ? 'bg-red-500 text-white' :
              micState === 'processing' ? 'bg-yellow-500 text-white' :
              micState === 'responding' ? 'bg-blue-500 text-white' :
              micState === 'error' ? 'bg-red-400 text-white' :
              micState === 'denied' ? 'bg-white/10 text-white/30 cursor-not-allowed' :
              'text-white/70 hover:bg-white/10'
            }`}
            style={micState === 'ready' ? { background: 'rgba(167,139,250,0.25)', border: '1px solid rgba(196,181,253,0.4)' } : {}}>
            {micState === 'listening' ? <MicOff size={16} /> :
             micState === 'processing' ? <Loader2 size={16} className="animate-spin" /> :
             micState === 'responding' ? <Volume2 size={16} /> :
             micState === 'denied' ? <MicOff size={16} /> :
             <Mic size={16} />}
            {recording && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">{MAX_RECORDING_SECONDS - recordingTime}</span>}
          </button>
          {/* Send button — dynamic */}
          <button onClick={() => send()} disabled={sending || !input.trim()}
            className={`send-btn-dyn flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
              input.trim() ? 'active w-10 h-10 text-white border-2' : 'w-9 h-9 text-white/60 border'
            }`}
            style={!input.trim() ? {
              background: 'rgba(167,139,250,0.25)',
              borderColor: 'rgba(196,181,253,0.4)',
            } : { borderColor: 'rgba(187,247,208,0.6)' }}>
            {sending ? <Loader2 size={16} className="animate-spin" /> :
              <Send size={input.trim() ? 16 : 14} strokeWidth={input.trim() ? 3 : 2.5} />}
          </button>
        </div>
      </div>

      {/* Powered by */}
      <div className="relative z-10 text-center py-2 text-xs text-white/40"
        style={{ background: 'rgba(13,37,32,0.9)' }}>
        Powered by Orlode AI
      </div>
    </div>
  );
}
