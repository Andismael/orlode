/**
 * VoiceChat — Push-to-talk voice conversation
 * Record audio → POST /api/agent/voice → Play response audio
 * Works with: Gemini STT + Orchestrator + Google TTS
 */
import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2, Square } from 'lucide-react';
import api from '@/services/api';

interface VoiceChatProps {
  language?: string;
  systemPrompt?: string;
  theme?: 'light' | 'dark';
  className?: string;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export default function VoiceChat({
  language = 'fr',
  systemPrompt,
  theme = 'dark',
  className = '',
}: VoiceChatProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isDark = theme === 'dark';

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError('Impossible d\'accéder au microphone');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  const processAudio = async (blob: Blob) => {
    setProcessing(true);
    try {
      // Convert blob to base64 (chunked to avoid stack overflow)
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      // Build history from messages
      const history = messages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

      // Send to server
      const res = await api.post('/agent/voice', { audio: base64, language, history });
      const data = res.data ?? res.data;

      if (data?.transcription) {
        setMessages(prev => [...prev, { role: 'user', text: data.transcription, timestamp: Date.now() }]);
      }

      if (data?.text) {
        setMessages(prev => [...prev, { role: 'ai', text: data.text, timestamp: Date.now() }]);
      }

      // Play audio response (server TTS or browser fallback)
      if (data?.audio) {
        setPlaying(true);
        const audioBlob = new Blob(
          [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
          { type: data.contentType ?? 'audio/mpeg' }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlaying(false); URL.revokeObjectURL(audioUrl); };
        audio.onerror = () => { setPlaying(false); URL.revokeObjectURL(audioUrl); };
        await audio.play();
      } else if (data?.text && window.speechSynthesis) {
        // Fallback: browser TTS when server TTS unavailable
        setPlaying(true);
        const utterance = new SpeechSynthesisUtterance(data.text.replace(/[#*_`\[\]()>]/g, '').slice(0, 1000));
        utterance.lang = language || 'fr-FR';
        utterance.rate = 1;
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(v => v.lang.startsWith(language?.split('-')[0] || 'fr'));
        if (match) utterance.voice = match;
        utterance.onend = () => setPlaying(false);
        utterance.onerror = () => setPlaying(false);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setError('Erreur de traitement vocal');
      console.error('[VoiceChat] Error:', err);
    }
    setProcessing(false);
  };

  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
    }
  };

  const bg = isDark ? 'bg-gray-900' : 'bg-white';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const bubbleUser = 'bg-blue-600 text-white';
  const bubbleAI = isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800';

  return (
    <div className={`flex flex-col h-full ${bg} ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !recording && !processing && (
          <div className={`text-center py-12 ${textSub}`}>
            <Mic size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Appuyez sur le micro pour parler</p>
            <p className="text-xs mt-1 opacity-60">Voix → IA → Réponse vocale</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? bubbleUser : bubbleAI}`}>
              {m.role === 'user' && <span className="text-[10px] opacity-60 block mb-0.5">Vous</span>}
              {m.role === 'ai' && <span className="text-[10px] opacity-60 block mb-0.5">Orlode AI</span>}
              {m.text}
            </div>
          </div>
        ))}

        {processing && (
          <div className="flex justify-start">
            <div className={`rounded-2xl px-4 py-3 ${bubbleAI} flex items-center gap-2`}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Réflexion en cours...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
      )}

      {/* Controls */}
      <div className={`flex items-center justify-center gap-4 py-6 ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
        {playing ? (
          <button onClick={stopPlaying}
            className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors">
            <Volume2 size={24} className="text-white animate-pulse" />
          </button>
        ) : processing ? (
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center">
            <Loader2 size={24} className="text-white animate-spin" />
          </div>
        ) : recording ? (
          <button onClick={stopRecording}
            className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all animate-pulse">
            <Square size={24} className="text-white" />
          </button>
        ) : (
          <button onClick={startRecording}
            className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:scale-105 transition-all">
            <Mic size={24} className="text-white" />
          </button>
        )}
      </div>

      {/* Status text */}
      <div className={`text-center pb-3 text-xs ${textSub}`}>
        {recording ? '🔴 Enregistrement... Appuyez pour arrêter' :
         processing ? '🧠 Traitement en cours...' :
         playing ? '🔊 IA parle...' :
         '🎙️ Appuyez pour parler'}
      </div>
    </div>
  );
}
