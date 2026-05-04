/**
 * useContractNotifications — Real-time contract signature notifications
 * Listens for 'contract:signed' events via Socket.io
 */
import { useState, useEffect, useCallback } from 'react';
import { connectSocket, disconnectSocket } from '@/services/socket';

export interface ContractNotification {
  id: string;
  contractId: string;
  signatoryName: string;
  signatoryEmail: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export function useContractNotifications(companyId: string | undefined) {
  const [notifications, setNotifications] = useState<ContractNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!companyId) return;

    const socket = connectSocket(companyId);

    socket.on('contract:signed', (data: { contractId: string; signatoryName: string; signatoryEmail: string }) => {
      const notif: ContractNotification = {
        id: `${data.contractId}-${Date.now()}`,
        contractId: data.contractId,
        signatoryName: data.signatoryName,
        signatoryEmail: data.signatoryEmail,
        message: `${data.signatoryName} a signe un contrat`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
    });

    socket.on('contract:reminder-sent', (data: { contractId: string; signatoryName: string }) => {
      const notif: ContractNotification = {
        id: `reminder-${data.contractId}-${Date.now()}`,
        contractId: data.contractId,
        signatoryName: data.signatoryName,
        signatoryEmail: '',
        message: `Rappel envoye a ${data.signatoryName}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setNotifications(prev => [notif, ...prev].slice(0, 50));
    });

    return () => {
      socket.off('contract:signed');
      socket.off('contract:reminder-sent');
    };
  }, [companyId]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markAllRead, markRead, clearAll };
}
