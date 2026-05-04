/**
 * useNotifications — Unified notification hook
 * Loads from API + listens for real-time Socket.io events
 */
import { useState, useEffect, useCallback } from 'react';
import { getSocket, connectSocket } from '@/services/socket';
import api from '@/services/api';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  icon?: string;
  severity?: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function useNotifications(companyId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load from API
  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications');
      const data = (r.data ?? []) as AppNotification[];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Listen for real-time notifications
  useEffect(() => {
    load();

    if (!companyId) return;
    const socket = connectSocket(companyId);

    const handleNotification = (notif: AppNotification) => {
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notif.id);
        if (exists) return prev;
        return [notif, ...prev].slice(0, 50);
      });
      setUnreadCount(prev => prev + 1);

      // High-impact pop-up for visitor-at-desk (don't miss it)
      if (notif.type === 'visitor_arrived') {
        try {
          import('@/components/common/Toast').then(({ toast }) => {
            toast.success(notif.title, notif.message);
          });
          // Optional: browser native notification if permission granted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(notif.title, { body: notif.message, tag: notif.id });
          }
        } catch { /* ignore */ }
      }
    };

    socket.on('notification', handleNotification);
    return () => { socket.off('notification', handleNotification); };
  }, [companyId, load]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => {
        const notif = prev.find(n => n.id === id);
        if (notif && !notif.read) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n.id !== id);
      });
    } catch {}
  }, []);

  return { notifications, unreadCount, loading, markAsRead, markAllRead, deleteNotification, reload: load };
}
