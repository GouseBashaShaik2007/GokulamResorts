'use client';

import { useEffect, useState } from 'react';
import api from './api';
import { errMsg } from './bookingUi';

const IDLE = { types: null, loading: false, error: '' };

/**
 * Free rooms and prices for a stay, from /availability. Used by the booking
 * panel's room step, the booking box on a room page and the rooms list.
 *
 * Returns { types, loading, error }. `types` is null until the first answer
 * (and whenever `enabled` is false); after that it is the API's list — one
 * entry per room type that has a room free, with its `quote` and `units`.
 * Requests are debounced, so changing dates or guest counts quickly sends one.
 */
export default function useAvailability({ checkIn, checkOut, guests, roomTypeId, enabled = true }) {
  const [state, setState] = useState({ ...IDLE, loading: enabled });

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/availability', {
          params: { checkIn, checkOut, guests, ...(roomTypeId ? { roomTypeId } : {}) },
        });
        if (!cancelled) setState({ types: res.data.types, loading: false, error: '' });
      } catch (err) {
        if (!cancelled) setState({ types: null, loading: false, error: errMsg(err, 'Could not check availability') });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, checkIn, checkOut, guests, roomTypeId]);

  return state;
}
