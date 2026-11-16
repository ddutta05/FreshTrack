import { io, type Socket } from 'socket.io-client';
import type { Notification } from '@/types';

let socket: Socket | null = null;
let connectedToken: string | null = null;

const SOCKET_BASE_URL = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

export function connectSocket(token: string): Socket {
  if (socket && connectedToken === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_BASE_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
  });
  connectedToken = token;

  socket.on('connect_error', () => {
    // Ignore connection errors here; HTTP APIs still function while socket reconnects.
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners('notification:new');
    socket.disconnect();
    socket = null;
  }
  connectedToken = null;
}

export function onNewNotification(handler: (notification: Notification) => void) {
  if (!socket) return () => {};

  socket.off('notification:new', handler);
  socket.on('notification:new', handler);

  return () => {
    socket?.off('notification:new', handler);
  };
}
