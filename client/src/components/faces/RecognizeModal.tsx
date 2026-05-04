import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, ScanFace, AlertCircle } from 'lucide-react';
import { useFaceApi, type LabeledEmployee, type FaceMatch } from '@/hooks/useFaceApi';

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  photoURL?: string;
  faceDescriptor?: number[];
  color: string;
}

interface RecognizeModalProps {
  employees: Employee[];
  onClose: () => void;
}

export default function RecognizeModal({ employees, onClose }: RecognizeModalProps) {
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [matches, setMatches] = useState<FaceMatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [canvasReady, setCanvasReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { modelsLoaded, isLoading: modelsLoading, error: modelError, loadModels, detectAllFaces, matchFaces } = useFaceApi();

  useEffect(() => { loadModels(); }, [loadModels]);

  const enrolledEmployees: LabeledEmployee[] = employees
    .filter((e) => e.faceDescriptor && e.faceDescriptor.length > 0)
    .map((e) => ({
      id: e.id,
      name: e.name,
      descriptor: new Float32Array(e.faceDescriptor!),
    }));

  const drawResults = useCallback((detections: FaceMatch[], imgEl: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    ctx.drawImage(imgEl, 0, 0);

    detections.forEach((match) => {
      const { x, y, width, height } = match.box;
      const color = match.employeeId ? '#00A550' : '#FF009D';

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Label background
      const label = match.employeeId
        ? `${match.name} (${match.confidence}%)`
        : 'Unknown';
      ctx.font = 'bold 16px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - 28, textWidth + 16, 28);

      // Label text
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + 8, y - 8);
    });

    setCanvasReady(true);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewURL(URL.createObjectURL(file));
    setMatches([]);
    setCanvasReady(false);
    setErrorMsg('');
  };

  const handleRecognize = async () => {
    if (!previewURL || !modelsLoaded) return;
    setIsProcessing(true);
    setErrorMsg('');
    setCanvasReady(false);

    try {
      const img = imgRef.current;
      if (!img) throw new Error('Image not ready');

      const detections = await detectAllFaces(img);

      if (detections.length === 0) {
        setErrorMsg('No faces detected in this image.');
        setIsProcessing(false);
        return;
      }

      const results = matchFaces(detections, enrolledEmployees);
      setMatches(results);
      drawResults(results, img);
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Recognition failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between relative overflow-hidden" style={{ background: '#0019FF' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }} />
          <div className="relative">
            <h2 className="text-base font-semibold text-white">Face Recognition</h2>
            <p className="text-xs text-white/70 mt-0.5">
              {enrolledEmployees.length} enrolled employee{enrolledEmployees.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors relative">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {enrolledEmployees.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              No employees have been enrolled yet. Enroll face photos first.
            </div>
          )}

          {/* Image area */}
          <div
            className="w-full rounded-xl overflow-hidden border-2 border-dashed border-gray-200 cursor-pointer relative min-h-[200px] flex items-center justify-center"
            onClick={() => !previewURL && fileInputRef.current?.click()}
          >
            {previewURL ? (
              <>
                <img
                  ref={imgRef}
                  src={previewURL}
                  alt="Upload"
                  className={`w-full object-contain ${canvasReady ? 'hidden' : 'block'}`}
                  crossOrigin="anonymous"
                />
                <canvas
                  ref={canvasRef}
                  className={`w-full object-contain ${canvasReady ? 'block' : 'hidden'}`}
                />
              </>
            ) : (
              <div className="text-center p-8">
                <ScanFace size={40} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click to upload a photo or screenshot</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Loading */}
          {(modelsLoading || isProcessing) && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#0019FF' }}>
              <Loader2 size={14} className="animate-spin" />
              {modelsLoading ? 'Loading models...' : 'Detecting faces...'}
            </div>
          )}

          {errorMsg && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
          )}
          {modelError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{modelError}</p>
          )}

          {/* Results */}
          {matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{matches.length} face{matches.length > 1 ? 's' : ''} detected</p>
              {matches.map((m, i) => {
                const emp = employees.find((e) => e.id === m.employeeId);
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: m.employeeId ? '#00A550' : '#FF009D', background: m.employeeId ? '#f0fdf4' : '#fff0f6' }}>
                    {emp?.photoURL ? (
                      <img src={emp.photoURL} alt={emp.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold" style={{ background: emp?.color ?? (m.employeeId ? '#00A550' : '#FF009D') }}>
                        {m.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                      {emp && <p className="text-xs text-gray-500">{emp.role} · {emp.department}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: m.employeeId ? '#00A550' : '#FF009D' }}>
                        {m.employeeId ? `${m.confidence}%` : '—'}
                      </p>
                      <p className="text-xs text-gray-400">{m.employeeId ? 'match' : 'unknown'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {previewURL && (
              <button
                onClick={() => { setPreviewURL(null); setMatches([]); setCanvasReady(false); setErrorMsg(''); }}
                className="flex-1 py-2.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={previewURL ? handleRecognize : () => fileInputRef.current?.click()}
              disabled={isProcessing || modelsLoading || enrolledEmployees.length === 0}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: '#0019FF' }}
            >
              {isProcessing ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : previewURL ? <><ScanFace size={14} /> Recognize</>  : <><Upload size={14} /> Upload Photo</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
