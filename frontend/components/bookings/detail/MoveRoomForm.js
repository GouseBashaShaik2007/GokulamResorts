'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { errMsg, fmtDate } from '../../../lib/bookingUi';
import { btn } from './parts';

/**
 * Give a booking another room: its room is out of order, or the desk gives a
 * different one at check-in. Lists the rooms that are free for the whole stay
 * (the booked type first); a guest who is already in the room can only move
 * to one that is ready. `auth` as from deskAs(). `onSubmit(room, reason)`.
 */
export default function MoveRoomForm({ b, auth, busy, onSubmit }) {
  const [options, setOptions] = useState(null); // null until loaded
  const [error, setError] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [reason, setReason] = useState(b.roomBlock ? `Room ${b.unit_number} out of order: ${b.roomBlock.reason}`.slice(0, 300) : '');

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/desk/bookings/${b.id}/move-options`, auth())
      .then((res) => !cancelled && setOptions(res.data))
      .catch((err) => !cancelled && setError(errMsg(err, 'Could not load the free rooms')));
    return () => {
      cancelled = true;
    };
  }, [b.id, auth]);

  const frame = 'mt-3 space-y-3 rounded-xl border border-sand-400 bg-sand-200/50 p-4';
  if (error) return <p role="alert" className={`${frame} text-sm text-red-700`}>{error}</p>;
  if (!options) return <p className={`${frame} text-sm text-ink-500`}>Looking for free rooms…</p>;
  if (options.rooms.length === 0) {
    return (
      <p className={`${frame} text-sm text-ink-700`}>
        No other room is free from {fmtDate(b.check_in)} to {fmtDate(b.check_out)} for {b.adults + b.children} guest{b.adults + b.children === 1 ? '' : 's'}.
      </p>
    );
  }

  const room = options.rooms.find((r) => r.id === roomId);
  // Rooms of the booked type first, then each other type under its own heading.
  const types = [...new Set(options.rooms.map((r) => r.roomType))];

  return (
    <form
      className={frame}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(room, reason.trim() || null);
      }}
    >
      <p className="text-sm text-ink-800">
        Free for the whole stay, {fmtDate(b.check_in)} → {fmtDate(b.check_out)}. The price stays as booked.
        {options.inHouse && ' The guest is in the room now, so only a room that is ready can be given.'}
      </p>
      {types.map((type) => (
        <fieldset key={type}>
          <legend className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            {type}{type === options.current.roomType ? ' · the type booked' : ''}
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {options.rooms.filter((r) => r.roomType === type).map((r) => {
              const notReady = options.inHouse && r.roomStatus !== 'Ready';
              const selected = r.id === roomId;
              return (
                <button
                  type="button"
                  key={r.id}
                  disabled={notReady}
                  aria-pressed={selected}
                  onClick={() => setRoomId(r.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                    selected ? 'border-gold-400 bg-gold-500/10 ring-1 ring-gold-400' : 'border-sand-300 bg-sand-200 hover:border-ink-300'
                  }`}
                >
                  <span className="block font-serif text-lg font-bold text-ink-900">{r.unitNumber}</span>
                  <span className="block text-xs text-ink-500">
                    {[r.view, r.floor ? `Floor ${r.floor}` : '', r.roomStatus !== 'Ready' ? `Housekeeping: ${r.roomStatus.toLowerCase()}` : ''].filter(Boolean).join(' · ') || 'Ready'}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <input
        className="input-field py-2 text-sm"
        aria-label="Why the room is changed"
        placeholder="Why (optional, kept in the booking's history)"
        maxLength={300}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {room && !room.sameType && (
        <p className="text-xs text-ink-500">
          Room {room.unitNumber} is a {room.roomType}; the guest booked a {options.current.roomType}. Nothing is charged or refunded for the difference.
        </p>
      )}
      <button disabled={busy || !room} className={`${btn} bg-ocean-500 text-white`}>
        {room ? `Move to room ${room.unitNumber}` : 'Choose a room'}
      </button>
    </form>
  );
}
