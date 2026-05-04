/**
 * Socket.io client singleton — connects to Orlode server
 * Completely disabled in production (Cloud Run doesn't support WebSocket)
 */
import type { Socket } from 'socket.io-client';

let socket: Socket | null = null;
let initialized = false;

const IS_PROD = typeof window !== 'undefined' && (
  window.location.hostname.includes('web.app') ||
  window.location.hostname.includes('firebaseapp.com') ||
  (!window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1')
);

// Dummy socket for production — no-op, no connections
const DUMMY: Socket = {
  connected: false,
  connect: () => DUMMY,
  disconnect: () => DUMMY,
  emit: () => DUMMY,
  on: () => DUMMY,
  off: () => DUMMY,
  id: '',
} as unknown as Socket;

async function initSocket(): Promise<Socket> {
  if (IS_PROD) return DUMMY;
  if (socket) return socket;
  if (initialized) return DUMMY;
  initialized = true;

  try {
    const { io } = await import('socket.io-client');
    socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
    return socket;
  } catch {
    return DUMMY;
  }
}

export function getSocket(): Socket {
  if (IS_PROD) return DUMMY;
  // Return existing socket or dummy — async init happens on connect
  return socket ?? DUMMY;
}

export function connectSocket(companyId: string): Socket {
  if (IS_PROD) return DUMMY;
  // Fire async init, return dummy until ready
  initSocket().then(s => {
    if (s !== DUMMY && !s.connected) {
      s.connect();
      s.emit('join-company', companyId);
    }
  });
  return socket ?? DUMMY;
}

export function disconnectSocket(): void {
  if (IS_PROD) return;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
