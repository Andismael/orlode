/**
 * GeminiLiveChat — Real-time voice conversation UI with Gemini Live
 * Drop-in component for any page: kiosk, chat, commercial, support
 */
import { useState, useRef, useEffect } from 'react';
import { Mic, Phone, PhoneOff, Video, VideoOff, MessageSquare } from 'lucide-react';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { buildEnterpriseLiveConfig, type EnterpriseContext } from '@/lib/enterpriseAgentConfig';

interface GeminiLiveChatProps {
  systemInstruction?: string;
  /** If provided, builds the full enterprise agent config (prompt + tools). */
  enterpriseContext?: EnterpriseContext;
  language?: string;
  voiceName?: string;
  showCamera?: boolean;
  showTextInput?: boolean;
  autoConnect?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
}

export default function GeminiLiveChat({
  systemInstruction,
  enterpriseContext,
  language = 'fr',
  voiceName = 'Kore',
  showCamera = false,
  showTextInput = true,
  autoConnect = false,
  className = '',
  theme = 'light',
}: GeminiLiveChatProps) {
  const {
    isConnected, isConnecting, isListening, isSpeaking, messages, currentText, error,
    connect, disconnect, sendText, sendCameraFrame,
  } = useGeminiLive();

  const [textInput, setTextInput] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const cameraRef = useRef(false);
  const autoConnectedRef = useRef(false);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);

  // Auto-connect on mount if requested (e.g. kiosk mode)
  useEffect(() => {
    if (autoConnect && !autoConnectedRef.current && !isConnected && !isConnecting) {
      autoConnectedRef.current = true;
      handleConnect();
    }
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-gray-900' : 'bg-white';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const border = isDark ? 'border-gray-700' : 'border-gray-200';
  const bubbleUser = 'bg-blue-600 text-white';
  const bubbleAI = isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800';

  const handleConnect = async () => {
    // Prefer the enterprise config (strong prompt + tools) when available
    if (enterpriseContext) {
      await connect(buildEnterpriseLiveConfig(enterpriseContext, { voiceName }));
      return;
    }
    await connect({
      language,
      voiceName,
      systemInstruction: systemInstruction ?? `Tu es l'assistant IA de Orlode. Reponds en ${language === 'fr' ? 'francais' : language === 'en' ? 'anglais' : language === 'es' ? 'espagnol' : language === 'ar' ? 'arabe' : language}. Sois concis et professionnel.`,
    });
  };

  const handleSendText = () => {
    if (!textInput.trim()) return;
    sendText(textInput);
    setTextInput('');
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      setCameraOn(false);
      cameraRef.current = false;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef) {
        videoRef.srcObject = stream;
        setCameraOn(true);
        cameraRef.current = true;
        const interval = setInterval(() => {
          if (!videoRef || !cameraRef.current) { clearInterval(interval); return; }
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 480;
          canvas.getContext('2d')?.drawImage(videoRef, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          sendCameraFrame(base64);
        }, 2000);
      }
    } catch {}
  };

  return (
    <div className={`flex flex-col rounded-2xl ${bg} ${border} border overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${border}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className={`text-sm font-bold ${text}`}>Gemini Live</span>
          {isSpeaking && <span className="text-xs text-blue-500 animate-pulse">Parle...</span>}
          {isListening && !isSpeaking && <span className="text-xs text-green-500">Ecoute...</span>}
          {isConnecting && <span className="text-xs text-yellow-500">Connexion...</span>}
        </div>
        <div className="flex gap-1">
          {showCamera && (
            <button onClick={toggleCamera}
              className={`p-2 rounded-lg transition-colors ${cameraOn ? 'bg-blue-100 text-blue-600' : `hover:${isDark ? 'bg-gray-800' : 'bg-gray-100'} ${textSub}`}`}>
              {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
          )}
          {!isConnected ? (
            <button onClick={handleConnect} disabled={isConnecting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <Phone size={14} /> {isConnecting ? 'Connexion...' : 'Demarrer'}
            </button>
          ) : (
            <button onClick={disconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-red-500 hover:bg-red-600">
              <PhoneOff size={14} /> Arreter
            </button>
          )}
        </div>
      </div>

      {/* Camera preview */}
      {showCamera && cameraOn && (
        <div className="relative h-32 bg-black">
          <video ref={el => setVideoRef(el)} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">LIVE</div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
        {!isConnected && !isConnecting && messages.length === 0 && (
          <div className={`text-center py-8 ${textSub}`}>
            <Mic size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Cliquez "Demarrer" pour une conversation vocale en temps reel</p>
            <p className="text-xs mt-1 opacity-60">Gemini Live · conversation naturelle</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? bubbleUser : bubbleAI}`}>
              {m.text}
            </div>
          </div>
        ))}
        {currentText && (
          <div className="flex justify-start">
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${bubbleAI} animate-pulse`}>
              {currentText}
            </div>
          </div>
        )}
        {isConnected && isListening && !isSpeaking && messages.length === 0 && !currentText && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-green-500">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm">Parlez, je vous ecoute...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      )}

      {/* Text input (optional) */}
      {showTextInput && isConnected && (
        <div className={`flex gap-2 p-3 border-t ${border}`}>
          <input value={textInput} onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendText()}
            placeholder="Ou tapez votre message..."
            className={`flex-1 px-3 py-2 border ${border} rounded-xl text-sm ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
          <button onClick={handleSendText}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            <MessageSquare size={16} />
          </button>
        </div>
      )}

      {/* Voice indicator */}
      {isConnected && (
        <div className={`flex items-center justify-center gap-3 py-2 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`w-1 rounded-full transition-all ${
                isListening && !isSpeaking
                  ? 'bg-green-500 animate-pulse'
                  : isSpeaking
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-gray-300'
              }`} style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <span className={`text-xs ${textSub}`}>
            {isSpeaking ? 'AI parle...' : isListening ? 'Micro actif' : 'En pause'}
          </span>
        </div>
      )}
    </div>
  );
}
