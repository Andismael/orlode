/**
 * SignaturePad — Canvas-based electronic signature component.
 * Migrated from WEMAS. Supports mouse + touch, responsive, retina-aware.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void;
  height?: number;
}

export function SignaturePad({ onSignatureChange, height = 180 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (imageData && hasSignature) {
      ctx.putImageData(imageData, 0, 0);
    }
  }, [hasSignature, height]);

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * dpr, y: (clientY - rect.top) * dpr };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    lastPos.current = { x, y };
    const dpr = window.devicePixelRatio || 1;
    ctx.beginPath();
    ctx.moveTo(x / dpr, y / dpr);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    const dpr = window.devicePixelRatio || 1;
    ctx.lineTo(x / dpr, y / dpr);
    ctx.stroke();
    lastPos.current = { x, y };
    if (!hasSignature) setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setStrokeCount(prev => {
      const next = prev + 1;
      if (next >= 1) {
        const isBlank = isCanvasBlank(canvas);
        onSignatureChange(isBlank ? null : canvas.toDataURL('image/png'));
      }
      return next;
    });
  };

  const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let nonTransparent = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 10) nonTransparent++;
    }
    return nonTransparent < 50;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setStrokeCount(0);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative w-full rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair block"
          style={{ touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
            <p className="text-gray-400 text-base font-medium">Signez ici</p>
            <p className="text-gray-300 text-xs">Utilisez votre doigt ou la souris</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={clearSignature}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          <Eraser size={16} />
          Effacer
        </button>
        {hasSignature && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Signature capturee
          </span>
        )}
      </div>
    </div>
  );
}
