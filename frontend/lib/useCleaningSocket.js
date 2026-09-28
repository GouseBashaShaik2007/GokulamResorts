'use client';

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './api';

// Socket.IO lives on the API server root, not under /api.
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

/**
 * Subscribes to live updates. Calls `onUpdate(event)` whenever something this
 * user can see changes (and once on (re)connect to catch up); the caller
 * refetches. `eventName` is 'cleaning:update' (housekeeping) or
 * 'booking:update' (front desk / manager).
 * Returns whether the socket is currently connected (for a "Live" badge).
 */
export default function useCleaningSocket(tokenKey, onUpdate, eventName = 'cleaning:update') {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate;

  useEffect(() => {
    const token = window.localStorage.getItem(tokenKey);
    if (!token) return undefined;

    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      setConnected(true);
      handlerRef.current?.({ event: 'reconnected' }); // catch up on anything missed
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(eventName, (e) => handlerRef.current?.(e));

    return () => socket.close();
  }, [tokenKey, eventName]);

  return connected;
}

export function LiveBadge({ live }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${live ? 'text-green-300' : 'text-navy-400'}`}>
      <span className={`h-2 w-2 rounded-full ${live ? 'bg-green-400' : 'bg-navy-500'}`} />
      {live ? 'Live' : 'Offline'}
    </span>
  );
}
