/**
 * VisitorBadge — Canvas-based printable visitor badge
 * Generates a visual badge with visitor info, QR-like badge number, company logo
 */
import { useRef, useEffect, useState } from 'react';
import { Printer, Download, X } from 'lucide-react';

interface VisitorBadgeProps {
  visitor: {
    name: string;
    company?: string;
    host: string;
    purpose?: string;
    badgeNumber: string;
    checkInAt: string;
    type?: string;
  };
  companyName?: string;
  onClose?: () => void;
}

export function VisitorBadge({ visitor, companyName = 'Orlode', onClose }: VisitorBadgeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    drawBadge();
  }, [visitor]);

  const drawBadge = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 400;
    const h = 560;
    canvas.width = w * 2; // retina
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 0, 0, w, h, 16);
    ctx.fill();

    // Header gradient
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#0019FF');
    grad.addColorStop(1, '#0092FF');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, w, 100, 16, true);
    ctx.fill();

    // Company name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(companyName, w / 2, 45);

    // "VISITEUR" label
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('BADGE VISITEUR', w / 2, 72);

    // Type badge
    const typeLabel = visitor.type === 'vip' ? 'VIP' :
      visitor.type === 'delivery' ? 'LIVRAISON' :
      visitor.type === 'appointment' ? 'RENDEZ-VOUS' : 'VISITEUR';
    const typeColor = visitor.type === 'vip' ? '#f59e0b' :
      visitor.type === 'delivery' ? '#8b5cf6' : '#10b981';

    ctx.fillStyle = typeColor;
    roundRect(ctx, w / 2 - 50, 108, 100, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    ctx.fillText(typeLabel, w / 2, 126);

    // Avatar circle
    const avatarY = 170;
    ctx.fillStyle = '#f3f4f6';
    ctx.beginPath();
    ctx.arc(w / 2, avatarY, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.fillText(visitor.name?.[0]?.toUpperCase() ?? 'V', w / 2, avatarY + 10);

    // Visitor name
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px Inter, system-ui, sans-serif';
    ctx.fillText(visitor.name, w / 2, 240);

    // Visitor company
    if (visitor.company) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.fillText(visitor.company, w / 2, 262);
    }

    // Divider
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 285);
    ctx.lineTo(w - 40, 285);
    ctx.stroke();

    // Info rows
    const drawRow = (label: string, value: string, y: number) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText(label, 40, y);
      ctx.fillStyle = '#374151';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.fillText(value, 40, y + 18);
    };

    drawRow('HOTE', visitor.host || '—', 305);
    drawRow('MOTIF', visitor.purpose || '—', 355);
    drawRow('ARRIVEE', new Date(visitor.checkInAt).toLocaleString('fr-FR', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric'
    }), 405);

    // Badge number (big, bottom)
    ctx.fillStyle = '#f3f4f6';
    roundRect(ctx, 30, 460, w - 60, 60, 12);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(visitor.badgeNumber, w / 2, 498);

    // Border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, w - 2, h - 2, 16);
    ctx.stroke();

    setRendered(true);
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, topOnly = false) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    if (topOnly) {
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
    } else {
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    }
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html><head><title>Badge - ${visitor.name}</title>
        <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f9fafb}
        img{max-width:400px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1)}
        @media print{body{background:white}img{box-shadow:none}}</style></head>
        <body><img src="${dataUrl}" /><script>setTimeout(()=>window.print(),300)</script></body></html>
      `);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `badge-${visitor.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Badge visiteur</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>

        <canvas ref={canvasRef} className="mx-auto block rounded-2xl border border-gray-100" />

        {rendered && (
          <div className="flex justify-center gap-3 mt-4">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #0019FF, #0092FF)' }}>
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Download size={14} /> Telecharger
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
