/**
 * MeetingAgentActions — Quick-action bar for the Meeting agent chat.
 * Real buttons (live recording, file upload, navigation) — not just chat prompts.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, Upload, List, Loader2, Zap } from 'lucide-react';
import api from '@/services/api';

export default function MeetingAgentActions() {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      chunksRef.current = [];
      setElapsed(0);

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        await uploadAudio(blob, `Réunion ${new Date().toLocaleString('fr-FR')}`);
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      setError('Micro inaccessible. Vérifie les permissions du navigateur.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  };

  const uploadAudio = async (blob: Blob, title: string) => {
    setUploading(true);
    try {
      // 1. Create meeting record
      const createRes = await api.post('/meetings', {
        title,
        date: new Date().toISOString(),
        duration: 0,
        participants: [],
      });
      const meetingId = (createRes.data as { id?: string })?.id;
      if (!meetingId) throw new Error('Création meeting échouée');

      // 2. Upload audio for transcription
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');
      await api.post(`/meetings/${meetingId}/transcribe`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // 3. Navigate to summary
      navigate(`/meetings/${meetingId}`);
    } catch (err) {
      setError('Échec de la transcription. Réessaye.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    await uploadAudio(f, f.name.replace(/\.[^.]+$/, ''));
  };

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="relative z-10 px-3 pt-3 pb-2 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Recording banner */}
      {recording && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-200 font-medium">Enregistrement en cours · {mmss(elapsed)}</span>
          <button onClick={stopRecording}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold">
            <Square size={10} fill="currentColor" /> Stop
          </button>
        </div>
      )}

      {uploading && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)' }}>
          <Loader2 size={13} className="animate-spin text-blue-300" />
          <span className="text-xs text-blue-200">Transcription en cours...</span>
        </div>
      )}

      {error && (
        <div className="mb-2 px-3 py-1.5 rounded-lg text-[11px] text-red-200"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)' }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 overflow-x-auto">
        {!recording ? (
          <button onClick={startRecording} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-semibold whitespace-nowrap transition-all hover:scale-105 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 4px 14px rgba(239,68,68,0.45)',
              border: '1px solid rgba(252,165,165,0.5)',
            }}>
            <Mic size={13} /> Enregistrer
          </button>
        ) : (
          <button onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-red-600 text-white text-xs font-semibold whitespace-nowrap border border-red-400">
            <Square size={12} fill="currentColor" /> Arrêter
          </button>
        )}

        <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current?.click()} disabled={recording || uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-semibold whitespace-nowrap transition-all hover:scale-105 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            boxShadow: '0 4px 14px rgba(59,130,246,0.45)',
            border: '1px solid rgba(147,197,253,0.5)',
          }}>
          <Upload size={13} /> Importer audio/vidéo
        </button>

        <button onClick={() => navigate('/meetings')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-semibold whitespace-nowrap transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
            boxShadow: '0 4px 14px rgba(168,85,247,0.45)',
            border: '1px solid rgba(196,181,253,0.5)',
          }}>
          <List size={13} /> Mes réunions
        </button>

        <button onClick={() => navigate('/meetings')}
          title="Détecter les actions du dernier transcript"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-white text-xs font-semibold whitespace-nowrap transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            boxShadow: '0 4px 14px rgba(34,197,94,0.45)',
            border: '1px solid rgba(134,239,172,0.5)',
          }}>
          <Zap size={13} /> Détecter actions
        </button>
      </div>
    </div>
  );
}
