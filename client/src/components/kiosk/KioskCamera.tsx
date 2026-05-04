/**
 * KioskCamera — Face recognition check-in via webcam.
 * Detects faces locally with face-api.js, extracts the 128-dim descriptor,
 * and sends it to the server which performs the actual matching against
 * enrolled employees (using the company's configured face tolerance).
 *
 * Why server-side match:
 *   - No need to ship descriptors to the kiosk (bandwidth + privacy)
 *   - Tolerance is enforced from companies/{cid}/checkinSettings
 *   - Match audit goes straight into the presence record
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CheckCircle, LogOut, Clock, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useFaceApi } from '@/hooks/useFaceApi';
import api from '@/services/api';

type ServerMatchResult = {
  action: 'checkin' | 'checkout' | 'already_done';
  employeeId: string;
  employeeName: string;
  hoursWorked?: number;
  confidence?: number;
};

type Result =
  | (ServerMatchResult & { type: 'success' })
  | { type: 'error'; message: string }
  | null;

export function KioskCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const { modelsLoaded, isLoading: modelsLoading, loadModels, detectSingleFace } = useFaceApi();

  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cooldown — don't spam the server with the same face every 2s
  const MIN_INTERVAL_MS = 3000;

  useEffect(() => {
    loadModels();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (modelsLoaded) startCamera();
  }, [modelsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
        intervalRef.current = setInterval(() => scanFrame(), 1500);
      }
    } catch {
      setError('Camera non disponible. Vérifiez les permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  };

  const drawBox = (
    box: { x: number; y: number; width: number; height: number },
    name: string,
    confidence: number,
    color = '#10b981',
  ) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = color;
    ctx.fillRect(box.x, box.y - 28, box.width, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.fillText(`${name} (${confidence}%)`, box.x + 6, box.y - 8);
  };

  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded || scanning || result) return;
    if (Date.now() - lastSentAtRef.current < MIN_INTERVAL_MS) return;

    setScanning(true);
    try {
      const detection = await detectSingleFace(videoRef.current);
      if (!detection) { setScanning(false); return; }

      // Convert Float32Array to plain number[] for JSON
      const descriptor = Array.from(detection.descriptor);
      lastSentAtRef.current = Date.now();

      // Server-side match — uses company's configured tolerance
      try {
        const r = await api.post<{ data: ServerMatchResult }>('/reception/checkin-by-face-match', { descriptor });
        const raw = r.data as unknown as Record<string, unknown>;
        const data = (raw?.data ?? raw) as ServerMatchResult;
        if (data?.employeeName) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          const conf = Math.round((data.confidence ?? 0.5) * 100);
          drawBox(detection.detection.box, data.employeeName, conf, '#10b981');
          setResult({ type: 'success', ...data });
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404) {
          // No match — show transient hint and keep scanning
          drawBox(detection.detection.box, 'Inconnu', 0, '#f59e0b');
          setTimeout(() => {
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }, 1200);
        } else {
          setResult({ type: 'error', message: 'Erreur serveur. Réessayez.' });
        }
      }
    } catch { /* face detection failed silently */ }
    finally { setScanning(false); }
  }, [modelsLoaded, scanning, result, detectSingleFace]);

  const handleReset = () => {
    setResult(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    lastSentAtRef.current = 0;
    intervalRef.current = setInterval(() => scanFrame(), 1500);
  };

  // ── Result overlay ────────────────────────────────────────────────────────
  if (result?.type === 'success') {
    return (
      <div className="flex flex-col items-center justify-center text-white">
        {result.action === 'checkin' && (
          <>
            <CheckCircle size={80} className="text-green-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">Bonjour {result.employeeName} !</h2>
            <p className="text-xl text-white/70 mb-2">Arrivée enregistrée par caméra</p>
            {result.confidence != null && (
              <p className="text-sm text-white/40 mb-6">Confiance : {Math.round(result.confidence * 100)}%</p>
            )}
          </>
        )}
        {result.action === 'checkout' && (
          <>
            <LogOut size={80} className="text-blue-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">Au revoir {result.employeeName} !</h2>
            <p className="text-xl text-white/70 mb-2">Départ enregistré</p>
            {result.hoursWorked != null && <p className="text-lg text-white/50 mb-6">{result.hoursWorked}h travaillées</p>}
          </>
        )}
        {result.action === 'already_done' && (
          <>
            <Clock size={80} className="text-amber-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">{result.employeeName}</h2>
            <p className="text-xl text-white/70 mb-8">Déjà pointé aujourd'hui</p>
          </>
        )}
        <button onClick={handleReset} className="px-10 py-4 bg-white text-gray-900 rounded-full font-bold text-lg active:scale-95 transition-transform">
          Suivant
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center text-white">
        <AlertTriangle size={48} className="text-amber-400 mb-4" />
        <p className="text-lg font-medium text-white/80 text-center max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-3 mb-6">
        <Camera size={28} className="text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Reconnaissance faciale</h1>
      </div>
      <p className="text-white/50 text-sm mb-6">Placez-vous devant la caméra</p>

      {modelsLoading && (
        <div className="flex items-center gap-3 mb-6">
          <Loader2 className="animate-spin text-blue-400" size={20} />
          <p className="text-white/60">Chargement des modèles…</p>
        </div>
      )}

      {/* Video + Canvas overlay */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10">
        <video ref={videoRef} autoPlay muted playsInline
          className="w-[480px] h-[360px] object-cover bg-gray-800 mirror"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />
        {scanning && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-blue-600/80 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs text-white font-medium">Analyse…</span>
          </div>
        )}
        {streaming && !scanning && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-green-600/80 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-white" />
            <span className="text-xs text-white font-medium">Caméra active</span>
          </div>
        )}
      </div>

      {result?.type === 'error' && (
        <div className="flex items-center gap-2 mt-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl">
          <XCircle size={18} className="text-red-400" />
          <p className="text-sm text-red-300">{result.message}</p>
          <button onClick={handleReset} className="text-sm text-white/70 underline ml-2">Réessayer</button>
        </div>
      )}
    </div>
  );
}
