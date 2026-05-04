/**
 * EmployeeBadge — Canvas-based printable employee ID badge
 * Professional badge with photo, name, job title, department, badge number
 */
import { useRef, useEffect, useState } from 'react';
import { Printer, Download, X } from 'lucide-react';

interface EmployeeBadgeProps {
  employee: {
    employeeName: string;
    jobTitle?: string;
    department?: string;
    email?: string;
    phone?: string;
    badgeNumber: string;
    photoURL?: string | null;
    issuedAt?: string;
    expiresAt?: string | null;
  };
  companyName?: string;
  onClose?: () => void;
}

export function EmployeeBadge({ employee, companyName = 'Orlode', onClose }: EmployeeBadgeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    drawBadge();
  }, [employee]);

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const drawBadge = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 400;
    const h = 600;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 0, 0, w, h, 16);
    ctx.fill();

    // Header gradient (dark blue to teal)
    const grad = ctx.createLinearGradient(0, 0, w, 120);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e40af');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, w, 140, 16, true);
    ctx.fill();

    // Accent line
    const accentGrad = ctx.createLinearGradient(0, 140, w, 140);
    accentGrad.addColorStop(0, '#3b82f6');
    accentGrad.addColorStop(0.5, '#06b6d4');
    accentGrad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 138, w, 4);

    // Company name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(companyName, w / 2, 50);

    // "BADGE EMPLOYE" label
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('BADGE EMPLOYE', w / 2, 75);

    // Department tag in header
    if (employee.department) {
      const deptText = employee.department.toUpperCase();
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      const deptWidth = ctx.measureText(deptText).width + 20;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, (w - deptWidth) / 2, 88, deptWidth, 24, 12);
      ctx.fill();
      ctx.fillStyle = '#93c5fd';
      ctx.fillText(deptText, w / 2, 104);
    }

    // Photo circle (with border)
    const photoY = 200;
    const photoRadius = 55;

    // Photo border ring
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, photoY, photoRadius + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Try to load and draw photo
    let photoLoaded = false;
    if (employee.photoURL) {
      try {
        const img = await loadImage(employee.photoURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, photoY, photoRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw image centered and covering the circle
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, w / 2 - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
        ctx.restore();
        photoLoaded = true;
      } catch {
        // Photo load failed, use initials
      }
    }

    if (!photoLoaded) {
      // Initials fallback
      const initGrad = ctx.createLinearGradient(w / 2 - photoRadius, photoY - photoRadius, w / 2 + photoRadius, photoY + photoRadius);
      initGrad.addColorStop(0, '#3b82f6');
      initGrad.addColorStop(1, '#1d4ed8');
      ctx.fillStyle = initGrad;
      ctx.beginPath();
      ctx.arc(w / 2, photoY, photoRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const initials = employee.employeeName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      ctx.fillText(initials, w / 2, photoY + 12);
    }

    // Employee name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(employee.employeeName, w / 2, 290);

    // Job title
    if (employee.jobTitle) {
      ctx.fillStyle = '#475569';
      ctx.font = '500 15px Inter, system-ui, sans-serif';
      ctx.fillText(employee.jobTitle, w / 2, 314);
    }

    // Divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 340);
    ctx.lineTo(w - 40, 340);
    ctx.stroke();

    // Info rows
    let infoY = 365;
    const drawInfoRow = (icon: string, label: string, value: string) => {
      ctx.textAlign = 'left';
      // Icon placeholder (circle)
      ctx.fillStyle = '#eff6ff';
      ctx.beginPath();
      ctx.arc(52, infoY - 4, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(icon, 52, infoY);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText(label, 74, infoY - 6);
      ctx.fillStyle = '#1e293b';
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.fillText(value, 74, infoY + 10);
      infoY += 42;
    };

    if (employee.department) {
      drawInfoRow('\u{1F3E2}', 'DEPARTEMENT', employee.department);
    }
    if (employee.email) {
      drawInfoRow('\u2709', 'EMAIL', employee.email);
    }
    if (employee.phone) {
      drawInfoRow('\u260E', 'TELEPHONE', employee.phone);
    }

    // Issued date
    if (employee.issuedAt) {
      const issued = new Date(employee.issuedAt).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText(`Emis le ${issued}`, 40, h - 85);

      if (employee.expiresAt) {
        const expires = new Date(employee.expiresAt).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        ctx.fillText(`Expire le ${expires}`, 40, h - 70);
      }
    }

    // Badge number (bottom bar)
    const barGrad = ctx.createLinearGradient(0, h - 55, w, h - 55);
    barGrad.addColorStop(0, '#0f172a');
    barGrad.addColorStop(1, '#1e40af');
    ctx.fillStyle = barGrad;
    roundRect(ctx, 0, h - 55, w, 55, 16, false, true);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#93c5fd';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText('N\u00b0 BADGE', w / 2, h - 35);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(employee.badgeNumber, w / 2, h - 14);

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, w - 2, h - 2, 16);
    ctx.stroke();

    setRendered(true);
  };

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
    topOnly = false, bottomOnly = false
  ) => {
    ctx.beginPath();
    if (topOnly) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    } else if (bottomOnly) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
    ctx.closePath();
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html><head><title>Badge - ${employee.employeeName}</title>
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
    link.download = `badge-${employee.employeeName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Badge employe</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <canvas ref={canvasRef} className="mx-auto block rounded-2xl border border-gray-100 dark:border-gray-700" />

        {rendered && (
          <div className="flex justify-center gap-3 mt-4">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #0f172a, #1e40af)' }}>
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
              <Download size={14} /> Telecharger
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
