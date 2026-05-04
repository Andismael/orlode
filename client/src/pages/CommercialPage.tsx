import { useState, useRef, useEffect, useCallback } from 'react';
import { TrendingUp, Send, Loader2, Sparkles, FileText, Target, LayoutTemplate, Mic, MicOff, Volume2, VolumeX, MessageSquare, AudioLines } from 'lucide-react';
import api from '@/services/api';
import { useLangStore } from '@/store/langStore';
import { useVoiceInput, speakText, stopSpeaking } from '@/hooks/useVoiceInput';

interface Message { role: 'user' | 'ai'; text: string }

type Mode = 'chat' | 'voice';

const QUICK_ACTIONS = [
  { icon: <LayoutTemplate size={16} />, label: 'Générer une landing page', prompt: 'Génère une landing page percutante pour notre produit principal. Demande-moi les informations nécessaires.' },
  { icon: <FileText size={16} />, label: 'Créer un devis', prompt: 'Aide-moi à créer une proposition commerciale professionnelle. Quelles informations as-tu besoin ?' },
  { icon: <Target size={16} />, label: 'Analyser un prospect', prompt: 'Je veux analyser un prospect et savoir comment l\'approcher. Que dois-je te donner comme informations ?' },
  { icon: <Sparkles size={16} />, label: 'Script de vente', prompt: 'Rédige un script de vente efficace pour notre équipe commerciale. Par quoi commencer ?' },
];

/**
 * Play AI response via server-side Google TTS.
 * Falls back to browser SpeechSynthesis if the server call fails.
 */
async function playTTSResponse(text: string, language = 'fr-FR'): Promise<void> {
  try {
    const res = await api.post('/public/tts', { text, language }, { responseType: 'arraybuffer' });
    const blob = new Blob([res.data], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await audio.play();
    // Cleanup after playback
    audio.onended = () => URL.revokeObjectURL(url);
  } catch {
    // Fallback: browser TTS
    speakText(text, language);
  }
}

export default function CommercialPage() {
  const { t } = useLangStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Bonjour 👋 Je suis votre Agent Commercial. Je peux vous aider à générer des landing pages, rédiger des propositions commerciales, analyser vos prospects et optimiser votre tunnel de vente. Que souhaitez-vous faire ?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send message (shared by both modes) ──────────────────────────

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    if (mode === 'voice') setVoiceState('processing');

    try {
      const res = await api.post('/public/chat', { message: msg, language: 'fr' });
      const aiResponse = res.data.data.response;
      setMessages(m => [...m, { role: 'ai', text: aiResponse }]);

      // Voice mode: always speak. Chat mode: speak only if TTS toggle is on.
      if (mode === 'voice' || ttsEnabled) {
        setIsSpeaking(true);
        if (mode === 'voice') setVoiceState('speaking');
        try {
          await playTTSResponse(aiResponse, 'fr-FR');
        } finally {
          setIsSpeaking(false);
          if (mode === 'voice') setVoiceState('idle');
        }
      }
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Désolé, une erreur est survenue. Réessayez.' }]);
      if (mode === 'voice') setVoiceState('idle');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, mode, ttsEnabled]);

  // ── Voice input (STT via Web Speech API) ─────────────────────────

  const { isListening, isSupported: voiceSupported, interimText, toggle: toggleVoice } = useVoiceInput({
    lang: 'fr-FR',
    onTranscript: (transcript) => {
      send(transcript);
    },
  });

  useEffect(() => {
    if (isListening) setVoiceState('listening');
    else if (voiceState === 'listening') setVoiceState('idle');
  }, [isListening]);

  const handleMicClick = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    }
    toggleVoice();
  };

  const stopAudio = () => {
    stopSpeaking();
    setIsSpeaking(false);
    setVoiceState('idle');
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-gray-100 flex items-center gap-3"
        style={{ background: 'linear-gradient(90deg,rgba(43,74,255,0.04),rgba(0,146,255,0.04))' }}>
        <div className="p-2 rounded-xl bg-blue-100">
          <TrendingUp size={22} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agent Commercial</h1>
          <p className="text-sm text-gray-500">Landing pages · Propositions · Prospects · Scripts</p>
        </div>

        {/* Mode toggle + TTS toggle */}
        <div className="ml-auto flex items-center gap-2">
          {/* TTS toggle (visible in chat mode) */}
          {mode === 'chat' && (
            <button
              onClick={() => { setTtsEnabled(v => !v); if (ttsEnabled) stopAudio(); }}
              className={`p-2 rounded-lg transition-all ${ttsEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}
              title={ttsEnabled ? 'Désactiver la voix' : 'Activer la voix'}
            >
              {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          )}

          {/* Mode switch */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => { setMode('chat'); stopAudio(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === 'chat' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare size={14} />
              Chat
            </button>
            <button
              onClick={() => setMode('voice')}
              disabled={!voiceSupported}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === 'voice' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              } ${!voiceSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={!voiceSupported ? 'Voice non supporté par ce navigateur' : 'Mode vocal'}
            >
              <AudioLines size={14} />
              Voix
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            En ligne
          </div>
        </div>
      </div>

      {/* Quick actions (chat mode, first message only) */}
      {mode === 'chat' && messages.length <= 1 && (
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-50">
          <p className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wide">{`${t('quick_access')}`}</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} onClick={() => send(a.prompt)}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-all text-left">
                <span className="text-blue-500 flex-shrink-0">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── VOICE MODE ─────────────────────────────────────────── */}
      {mode === 'voice' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Animated voice orb */}
          <div className="relative mb-8">
            <div className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ${
              voiceState === 'listening'
                ? 'bg-red-500 shadow-[0_0_60px_rgba(239,68,68,0.4)]'
                : voiceState === 'processing'
                  ? 'bg-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.4)]'
                  : voiceState === 'speaking'
                    ? 'bg-blue-500 shadow-[0_0_60px_rgba(59,130,246,0.4)]'
                    : 'bg-gray-200'
            }`}
              style={voiceState !== 'idle' ? { background: voiceState === 'listening'
                ? 'linear-gradient(135deg,#ef4444,#f97316)'
                : voiceState === 'processing'
                  ? 'linear-gradient(135deg,#eab308,#f97316)'
                  : 'linear-gradient(135deg,#2B4AFF,#0092FF)'
              } : { background: 'linear-gradient(135deg,#e5e7eb,#d1d5db)' }}
            >
              {/* Pulse rings when active */}
              {voiceState !== 'idle' && (
                <>
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                    style={{ background: voiceState === 'listening' ? '#ef4444' : voiceState === 'processing' ? '#eab308' : '#3b82f6' }} />
                  <div className="absolute -inset-3 rounded-full animate-pulse opacity-10"
                    style={{ background: voiceState === 'listening' ? '#ef4444' : voiceState === 'processing' ? '#eab308' : '#3b82f6' }} />
                </>
              )}

              {voiceState === 'processing' ? (
                <Loader2 size={40} className="text-white animate-spin" />
              ) : voiceState === 'speaking' ? (
                <Volume2 size={40} className="text-white" />
              ) : (
                <Mic size={40} className={voiceState === 'listening' ? 'text-white' : 'text-gray-400'} />
              )}
            </div>
          </div>

          {/* State label */}
          <p className="text-lg font-medium text-gray-700 mb-2">
            {voiceState === 'idle' && 'Appuyez pour parler'}
            {voiceState === 'listening' && 'Je vous écoute...'}
            {voiceState === 'processing' && 'En réflexion...'}
            {voiceState === 'speaking' && 'Je réponds...'}
          </p>

          {/* Interim transcript */}
          {interimText && (
            <p className="text-sm text-gray-400 italic mb-4 max-w-md text-center">
              "{interimText}"
            </p>
          )}

          {/* Mic button */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleMicClick}
              disabled={loading && !isSpeaking}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
              } ${loading && !isSpeaking ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            {isSpeaking && (
              <button
                onClick={stopAudio}
                className="w-16 h-16 rounded-full flex items-center justify-center bg-white border-2 border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-500 transition-all shadow-lg"
              >
                <VolumeX size={24} />
              </button>
            )}
          </div>

          {/* Last AI response text (small, below) */}
          {messages.length > 1 && (
            <div className="mt-8 max-w-lg w-full">
              <div className="bg-white/80 backdrop-blur border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
                <p className="text-xs text-gray-400 font-medium mb-1">Dernière réponse</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {messages[messages.length - 1].role === 'ai'
                    ? messages[messages.length - 1].text
                    : messages.filter(m => m.role === 'ai').pop()?.text}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHAT MODE ──────────────────────────────────────────── */}
      {mode === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full flex-shrink-0 mr-3 mt-0.5 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#2B4AFF,#0092FF)' }}>
                    <TrendingUp size={14} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full flex-shrink-0 mr-3 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#2B4AFF,#0092FF)' }}>
                  <TrendingUp size={14} className="text-white" />
                </div>
                <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-blue-500" />
                  <span className="text-sm text-gray-500">En réflexion...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white">
            <div className="flex items-end gap-3 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 focus-within:border-blue-400 focus-within:bg-white transition-all">
              {/* Mic button in chat mode */}
              {voiceSupported && (
                <button
                  onClick={handleMicClick}
                  disabled={loading}
                  className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  } ${loading ? 'opacity-40' : ''}`}
                  title={isListening ? 'Arrêter' : 'Parler'}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}

              <textarea
                ref={inputRef}
                rows={1}
                placeholder={isListening ? interimText || 'Je vous écoute...' : 'Décrivez ce que vous voulez créer...'}
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none resize-none leading-relaxed"
                style={{ minHeight: '24px' }}
                disabled={isListening}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#2B4AFF,#0092FF)' }}>
                <Send size={15} className="text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {isListening ? 'Parlez maintenant... Cliquez sur le micro pour arrêter' : 'Entrée pour envoyer · Maj+Entrée pour nouvelle ligne · Micro pour dicter'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
