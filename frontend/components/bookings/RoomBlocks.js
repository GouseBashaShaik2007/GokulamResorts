'use client';

import { useState } from 'react';
import api from '../../lib/api';
import { addDays, errMsg, fmtDate, todayIST } from '../../lib/bookingUi';

// Rooms taken out of order: the pieces shared by the rooms board, the
// calendar and the manager's list of problems housekeeping reported.

/** "until Thu 8 Oct" (the day the room is back) or "until further notice". */
export const untilLabel = (endDate) => (endDate ? `until ${fmtDate(endDate)}` : 'until further notice');

/**
 * Take a room out of order. `rooms`: [{ id, unit_number, room_type }] to
 * choose from. `preset`: { roomUnitId, unitNumber, reason, roomIssueId } fixes
 * the room instead (a problem housekeeping reported). `auth` as from deskAs().
 * `onDone({ block, affected })` once saved — `affected` are the bookings in
 * that room that now need another one; `onCancel` closes the form.
 */
export function BlockRoomForm({ rooms = [], preset = null, auth, onDone, onCancel }) {
  const today = todayIST();
  const [form, setForm] = useState({ roomUnitId: preset?.roomUnitId || '', startDate: today, endDate: '', reason: preset?.reason || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post(
        '/desk/room-blocks',
        {
          roomUnitId: Number(form.roomUnitId),
          startDate: form.startDate,
          endDate: form.endDate || null,
          reason: form.reason.trim(),
          roomIssueId: preset?.roomIssueId || null,
        },
        auth()
      );
      onDone(res.data);
    } catch (err) {
      setError(errMsg(err, 'Could not take the room out of order'));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-red-500/30 bg-red-500/5 p-4" aria-label="Take a room out of order">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_10rem_1fr]">
        <div>
          <label className="label" htmlFor="block-room">Room</label>
          {preset ? (
            <p id="block-room" className="py-2 font-serif text-xl font-bold text-ink-900">{preset.unitNumber}</p>
          ) : (
            <select id="block-room" required className="input-field py-2 text-sm" value={form.roomUnitId} onChange={set('roomUnitId')}>
              <option value="">Select room…</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.unit_number} — {r.room_type}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="label" htmlFor="block-from">Out from</label>
          <input
            id="block-from"
            type="date"
            required
            min={today}
            className="input-field py-2 text-sm"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate && f.endDate <= e.target.value ? '' : f.endDate }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="block-until">Back on (optional)</label>
          <input id="block-until" type="date" min={addDays(form.startDate || today, 1)} className="input-field py-2 text-sm" value={form.endDate} onChange={set('endDate')} />
        </div>
        <div>
          <label className="label" htmlFor="block-reason">What is wrong</label>
          <input id="block-reason" required minLength={3} maxLength={300} className="input-field py-2 text-sm" placeholder="e.g. AC not cooling" value={form.reason} onChange={set('reason')} />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        The room cannot be booked or checked into on those nights. Leave “Back on” empty if you don’t know yet: it stays out until someone puts it back.
        Bookings already in the room are kept, and listed for you to move.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Take out of order'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-sand-400 px-4 py-2 text-sm text-ink-700">Cancel</button>
      </div>
    </form>
  );
}

/** The bookings a block leaves without a usable room, each a button that opens it (to move it). */
export function BookingsToMove({ bookings, onOpen }) {
  if (!bookings || bookings.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-sm font-medium text-red-800">
        {bookings.length === 1 ? 'One booking in this room needs another room:' : `${bookings.length} bookings in this room need another room:`}
      </p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {bookings.map((b) => (
          <li key={b.id}>
            <button type="button" onClick={() => onOpen(b.id)} className="rounded-lg border border-red-500/40 bg-sand-50 px-3 py-1.5 text-left text-sm text-ink-800 hover:border-red-500">
              {b.guest_name} <span className="text-ink-400">· {fmtDate(b.check_in)} → {fmtDate(b.check_out)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
