/**
 * KioskQrScanner — QR badge scanner for employee check-in
 * Uses camera to scan QR codes, sends to server for check-in/out
 */
import { useEffect, useRef, useState } from 'react';
import { QrCode, CheckCircle, LogOut, Clock, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import api from '@/services/api';

type Result = { action: string; employeeName: string; hoursWorked?: number } | null;

export function KioskQrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState('');

  useEffect(() => {
    startCamera();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
        intervalRef.current = setInterval(() => scanFrame(), 500);
      }
    } catch {
      setError('Camera non disponible. Verifiez les permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  };

  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current || scanning || result) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.videoWidth === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      // Use BarcodeDetector API (Chrome 83+, Edge 83+)
      if ('BarcodeDetector' in window) {
        const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          const qrValue = barcodes[0].rawValue;
          if (qrValue && qrValue !== lastScanned) {
            setLastScanned(qrValue);
            await handleQrScanned(qrValue);
          }
        }
      }
    } catch {
      // BarcodeDetector not available — fallback message
    }
  };

  const handleQrScanned = async (qrToken: string) => {
    setScanning(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      const r = await api.post('/reception/checkin-by-qr', { qrToken });
      setResult(r.data);
    } catch {
      setResult({ action: 'error', employeeName: '' });
    }
    finally { setScanning(false); }
  };

  const handleReset = () => {
    setResult(null);
    setLastScanned('');
    intervalRef.current = setInterval(() => scanFrame(), 500);
  };

  // Result screen
  if (result && result.action !== 'error') {
    return (
      <div className="flex flex-col items-center justify-center text-white">
        {result.action === 'checkin' && (
          <>
            <CheckCircle size={80} className="text-green-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">Bonjour {result.employeeName} !</h2>
            <p className="text-xl text-white/70 mb-8">Arrivee enregistree par badge</p>
          </>
        )}
        {result.action === 'checkout' && (
          <>
            <LogOut size={80} className="text-blue-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">Au revoir {result.employeeName} !</h2>
            <p className="text-xl text-white/70 mb-2">Depart enregistre</p>
            {result.hoursWorked != null && <p className="text-lg text-white/50 mb-8">{result.hoursWorked}h travaillees</p>}
          </>
        )}
        {result.action === 'already_done' && (
          <>
            <Clock size={80} className="text-amber-400 mb-6" />
            <h2 className="text-3xl font-bold mb-3">{result.employeeName}</h2>
            <p className="text-xl text-white/70 mb-8">Deja pointe aujourd'hui</p>
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
        <QrCode size={28} className="text-green-400" />
        <h1 className="text-2xl font-bold text-white">Scannez votre badge QR</h1>
      </div>
      <p className="text-white/50 text-sm mb-6">Presentez votre QR code devant la camera</p>

      {/* Camera view */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10">
        <video ref={videoRef} autoPlay muted playsInline className="w-[400px] h-[400px] object-cover bg-gray-800" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan guide overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56 border-2 border-green-400/50 rounded-2xl relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-green-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-green-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-green-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-green-400 rounded-br-lg" />
          </div>
        </div>

        {/* Status */}
        {streaming && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-green-600/80 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs text-white font-medium">Scan actif</span>
          </div>
        )}
        {scanning && (
          <div className="absolute inset-0 bg-green-400/10 flex items-center justify-center">
            <Loader2 className="animate-spin text-green-400" size={32} />
          </div>
        )}
      </div>

      {result?.action === 'error' && (
        <div className="flex items-center gap-2 mt-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl">
          <XCircle size={18} className="text-red-400" />
          <p className="text-sm text-red-300">QR invalide ou revoque</p>
          <button onClick={handleReset} className="text-sm text-white/70 underline ml-2">Reessayer</button>
        </div>
      )}

      {!('BarcodeDetector' in window) && (
        <div className="mt-4 px-4 py-3 bg-amber-500/20 border border-amber-500/30 rounded-xl max-w-md">
          <p className="text-xs text-amber-300 text-center">
            Votre navigateur ne supporte pas le scan QR natif. Utilisez Chrome ou Edge pour cette fonctionnalite.
          </p>
        </div>
      )}
    </div>
  );
}
