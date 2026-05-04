/**
 * NotificationBell — Unified notification dropdown for Header
 * Shows all notification types with real-time updates
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, Trash2, X,
  UserCheck, Calendar, LogIn, FileText, AlertCircle, Info, Gift,
} from 'lucide-react';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

const ICON_MAP: Record<string, typeof Bell> = {
  UserCheck, Calendar, LogIn, FileText, AlertCircle, Info, Gift, CheckCircle: Check,
  XCircle: X,
};

const SEVERITY_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-500',
  info: 'bg-blue-100 text-blue-600',
};

function timeAgo(dateStr: string): string {
  const date = typeof dateStr === 'object' && dateStr !== null && 'toDate' in (dateStr as Record<string, unknown>)
    ? ((dateStr as unknown as { toDate: () => Date }).toDate())
    : new Date(dateStr);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'A l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function NotificationBell({ companyId }: { companyId?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllRead, deleteNotification } = useNotifications(companyId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (n: AppNotification) => {
    if (!n.read) markAsRead(n.id);
    if (n.actionUrl) { navigate(n.actionUrl); setOpen(false); }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <CheckCheck size={12} /> Tout lire
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune notification</p>
              </div>
            ) : (
              notifications.slice(0, 20).map(n => {
                const IconComponent = ICON_MAP[n.icon ?? ''] ?? Info;
                const severityClass = SEVERITY_COLORS[n.severity ?? 'info'] ?? SEVERITY_COLORS['info'];
                return (
                  <div key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 ${
                      n.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50'
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${severityClass}`}>
                      <IconComponent size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${n.read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 shrink-0 self-start transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
