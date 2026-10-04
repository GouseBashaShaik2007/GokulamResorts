'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { errMsg, fmtDate } from '../../lib/bookingUi';
import { JOB_STATUS_STYLE } from '../../lib/cleaningStyles';
import Chip from '../ui/Chip';

const REFRESH_MS = 30000;

// Who is in the room (or due into it) today. A room with nobody is "free".
function occupancy(room, today) {
  if (room.booking_status === 'checked_in') {
    return { key: 'occupied', label: 'Occupied', detail: `${room.guest_name} · ${room.check_out <= today ? 'checks out today' : `until ${fmtDate(room.check_out)}`}` };
  }
  if (room.booking_status) {
    return {
      key: 'arriving',
      label: room.booking_status === 'paid' ? 'Arriving · awaiting approval' : 'Arriving',
      detail: `${room.guest_name}${room.check_in < today ? ` · due since ${fmtDate(room.check_in)}` : ' · today'}`,
    };
  }
  return { key: 'free', label: 'Free', detail: '' };
}

const FILTERS = [
  { key: 'all', label: 'All rooms', test: () => true },
  { key: 'ready', label: 'Free and ready', test: (r) => r.occ.key === 'free' && r.housekeeping === 'Ready' },
  { key: 'cleaning', label: 'Not ready', test: (r) => r.housekeeping !== 'Ready' },
  { key: 'arriving', label: 'Arriving', test: (r) => r.occ.key === 'arriving' },
  { key: 'occupied', label: 'Occupied', test: (r) => r.occ.key === 'occupied' },
];

/**
 * Every room at a glance: its housekeeping state and who is in it or due in
 * today — so the desk can answer "is 204 ready?" without opening a booking.
 * Read-only; `onOpen(bookingId)` opens the booking a room belongs to.
 */
export default function RoomBoard({ auth, onOpen, refreshKey }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/desk/rooms', auth());
      setData(res.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Could not load the rooms'));
    }
  }, [auth]);

  // Housekeeping changes don't reach the desk as live events, so also check
  // twice a minute while this tab is on screen.
  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load, refreshKey]);

  if (error && !data) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!data) return <div className="card h-64 animate-pulse" role="status" aria-label="Loading rooms" />;

  const rooms = data.rooms.map((room) => ({ ...room, occ: occupancy(room, data.today) }));
  const shown = rooms.filter(FILTERS.find((f) => f.key === filter).test);

  return (
    <div>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error} — showing the last update.</p>}
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter rooms">
        {FILTERS.map((f) => (
          <Chip key={f.key} size="sm" pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label} ({rooms.filter(f.test).length})
          </Chip>
        ))}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((room) => {
          const body = (
            <>
              <span className="flex items-start justify-between gap-2">
                <span className="font-serif text-2xl font-bold text-navy-50">{room.unit_number}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${JOB_STATUS_STYLE[room.housekeeping] || ''}`}>{room.housekeeping}</span>
              </span>
              <span className="mt-0.5 block text-xs text-navy-400">
                {room.room_type}{room.view_label ? ` · ${room.view_label}` : ''}{room.floor ? ` · Floor ${room.floor}` : ''}
              </span>
              <span className={`mt-3 block text-sm font-medium ${room.occ.key === 'free' ? 'text-green-700' : 'text-navy-50'}`}>{room.occ.label}</span>
              {room.occ.detail && <span className="block text-xs text-navy-300">{room.occ.detail}</span>}
            </>
          );
          const frame = 'block h-full w-full rounded-xl border border-navy-700 bg-navy-800 p-4 text-left';
          return (
            <li key={room.id}>
              {room.booking_id ? (
                <button type="button" onClick={() => onOpen(room.booking_id)} className={`${frame} transition hover:border-navy-500`} aria-label={`Room ${room.unit_number}: open booking ${room.reference}`}>
                  {body}
                </button>
              ) : (
                <div className={frame}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-sm text-navy-400">No rooms match that filter right now.</p>}
    </div>
  );
}
