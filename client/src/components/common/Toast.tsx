/**
 * Toast — Global notification system.
 * Usage:
 *   import { toast } from '@/components/common/Toast';
 *   toast.success('Saved');
 *   toast.error('Oops');
 *   toast.info('Heads-up');
 *
 * Mount <ToastContainer /> once (in MainLayout/AdminLayout) to render them.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number; // ms
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() { listeners.forEach(fn => fn([...toasts])); }

function push(type: ToastType, title: string, description?: string, duration = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  toasts.push({ id, type, title, description, duration });
  notify();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

export const toast = {
  success: (title: string, description?: string, duration?: number) => push('success', title, description, duration),
  error:   (title: string, description?: string, duration?: number) => push('error',   title, description, duration ?? 6000),
  info:    (title: string, description?: string, duration?: number) => push('info',    title, description, duration),
  warning: (title: string, description?: string, duration?: number) => push('warning', title, description, duration),
  dismiss,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: React.ReactNode; text: string }> = {
  success: { bg: 'bg-green-50 dark:bg-green-900/30',   border: 'border-green-200 dark:border-green-800',   icon: <CheckCircle2 size={18} className="text-green-600" />,  text: 'text-green-800 dark:text-green-100' },
  error:   { bg: 'bg-red-50 dark:bg-red-900/30',       border: 'border-red-200 dark:border-red-800',       icon: <AlertCircle size={18} className="text-red-600" />,     text: 'text-red-800 dark:text-red-100' },
  info:    { bg: 'bg-blue-50 dark:bg-blue-900/30',     border: 'border-blue-200 dark:border-blue-800',     icon: <Info size={18} className="text-blue-600" />,           text: 'text-blue-800 dark:text-blue-100' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/30',   border: 'border-amber-200 dark:border-amber-800',   icon: <AlertTriangle size={18} className="text-amber-600" />, text: 'text-amber-800 dark:text-amber-100' },
};

export function ToastContainer() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    const l: Listener = (next) => setList(next);
    listeners.add(l);
    setList([...toasts]);
    return () => { listeners.delete(l); };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {list.map(t => {
        const c = COLORS[t.type];
        return (
          <div key={t.id}
            className={`pointer-events-auto ${c.bg} border ${c.border} rounded-xl shadow-lg p-3.5 flex items-start gap-3 animate-slide-in`}
            style={{ animation: 'toastSlideIn 0.25s ease-out' }}>
            <div className="flex-shrink-0 mt-0.5">{c.icon}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${c.text}`}>{t.title}</p>
              {t.description && <p className={`text-xs mt-0.5 ${c.text} opacity-80`}>{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className={`${c.text} opacity-60 hover:opacity-100 flex-shrink-0`}>
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
