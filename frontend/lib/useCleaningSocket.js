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
    <span className={`flex items-center gap-1.5 text-xs ${live ? 'text-green-700' : 'text-navy-400'}`}>
      <span className={`h-2 w-2 rounded-full ${live ? 'bg-green-400' : 'bg-navy-500'}`} />
      {live ? 'Live' : 'Offline'}
    </span>
  );
}

const STALE_AFTER_MS = 8000;

/**
 * A banner for when live updates have been down for more than a few seconds —
 * the small "Offline" badge is easy to miss, and it means the screen may be
 * showing old information. `onRefresh` reloads by hand until it reconnects.
 */
export function StaleNotice({ live, onRefresh }) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (live) {
      setStale(false);
      return undefined;
    }
    const id = setTimeout(() => setStale(true), STALE_AFTER_MS);
    return () => clearTimeout(id);
  }, [live]);

  if (!stale) return null;
  return (
    <p role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-400/40 bg-orange-400/10 px-4 py-2.5 text-sm text-orange-800">
      <span>Live updates are not reaching this screen, so it may be out of date. It will reconnect on its own.</span>
      <button type="button" onClick={onRefresh} className="rounded-lg border border-orange-400/60 px-3 py-1 font-medium">Refresh now</button>
    </p>
  );
}
