/**
 * MeetingRoomPage — Live meeting room with Gemini Live integration
 * Real-time voice + camera via WebSocket to Gemini 2.0 Flash
 */
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Square, Maximize2, Loader2, Bot, PhoneCall } from 'lucide-react';
import api from '@/services/api';

const GeminiLiveChat = lazy(() => import('@/components/ai/GeminiLiveChat'));

export default function MeetingRoomPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'setup' | 'live'>('setup');

  const endMeeting = async () => {
    await api.post(`/meetings/${meetingId}/end`).catch(() => {});
    navigate(`/meetings/${meetingId}/summary`);
  };

  if (mode === 'setup') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-6">
            <PhoneCall size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Salle de réunion IA</h1>
          <p className="text-gray-400 text-sm mb-8">
            Gemini Live va transcrire, résumer et extraire les actions en temps réel.
            Activez votre micro et votre caméra pour commencer.
          </p>
          <button onClick={() => setMode('live')}
            className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl text-lg font-semibold hover:bg-blue-700 transition-colors mx-auto shadow-lg shadow-blue-600/30">
            <Mic size={20} /> Démarrer la réunion
          </button>
          <p className="text-xs text-gray-500 mt-4">Réunion #{meetingId?.slice(0, 8)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-white">En direct</span>
          <span className="text-xs text-gray-500">Réunion #{meetingId?.slice(0, 8)}</span>
        </div>
        <button onClick={endMeeting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700">
          <Square size={14} /> Terminer
        </button>
      </div>

      {/* Gemini Live Chat — full screen */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-gray-400" size={24} /></div>}>
          <GeminiLiveChat />
        </Suspense>
      </div>
    </div>
  );
}
