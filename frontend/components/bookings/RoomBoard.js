'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';
import { errMsg, fmtDate } from '../../lib/bookingUi';
import { JOB_STATUS_STYLE } from '../../lib/cleaningStyles';
import Chip from '../ui/Chip';
import { useConfirm } from '../ui/Confirm';
import { useToast } from '../ui/Toast';
import { BlockRoomForm, untilLabel } from './RoomBlocks';

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
  { key: 'ready', label: 'Free and ready', test: (r) => r.occ.key === 'free' && r.housekeeping === 'Ready' && !r.block_id },
  { key: 'cleaning', label: 'Not ready', test: (r) => r.housekeeping !== 'Ready' },
  { key: 'inspection', label: 'Cleaned, to approve', test: (r) => r.housekeeping === 'Inspection' },
  { key: 'arriving', label: 'Arriving', test: (r) => r.occ.key === 'arriving' },
  { key: 'occupied', label: 'Occupied', test: (r) => r.occ.key === 'occupied' },
  { key: 'out', label: 'Out of order', test: (r) => Boolean(r.block_id) },
];

/**
 * Every room at a glance: its housekeeping state and who is in it or due in
 * today — so the desk can answer "is 204 ready?" without opening a booking.
 * `onOpen(bookingId)` opens the booking a room belongs to. A room that has
 * been cleaned and is waiting for its inspector can be approved from here,
 * and a room can be taken out of order or put back (`onChanged` then tells
 * the rest of the desk).
 */
export default function RoomBoard({ auth, onOpen, onChanged, refreshKey }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState(null);
  const [blocking, setBlocking] = useState(false); // the "take a room out of order" form is open
  const ask = useConfirm();
  const toast = useToast();

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

  const approve = async (room) => {
    const ok = await ask({
      title: `Approve room ${room.unit_number}?`,
      body: 'Cleaning is finished and the room is waiting for its inspector. Approve it only once someone has looked at the room: it becomes ready for check-in straight away.',
      confirmLabel: 'Approve room',
    });
    if (!ok) return;
    setApprovingId(room.id);
    try {
      await api.post(`/desk/rooms/${room.id}/approve-cleaning`, {}, auth());
      toast(`Room ${room.unit_number} is ready.`);
      onChanged?.();
    } catch (err) {
      toast(errMsg(err, 'Could not approve the room'), { tone: 'error', duration: 6000 });
    } finally {
      setApprovingId(null);
      load();
    }
  };

  const putBack = async (room) => {
    const ok = await ask({
      title: `Put room ${room.unit_number} back in service?`,
      body: 'It can be booked and checked into again from today.',
      confirmLabel: 'Put back in service',
    });
    if (!ok) return;
    try {
      await api.post(`/desk/room-blocks/${room.block_id}/end`, {}, auth());
      toast(`Room ${room.unit_number} is back in service.`);
      onChanged?.();
    } catch (err) {
      toast(errMsg(err, 'Could not put the room back'), { tone: 'error', duration: 6000 });
    }
    load();
  };

  if (error && !data) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!data) return <div className="card h-64 animate-pulse" role="status" aria-label="Loading rooms" />;

  const rooms = data.rooms.map((room) => ({ ...room, occ: occupancy(room, data.today) }));
  const shown = rooms.filter(FILTERS.find((f) => f.key === filter).test);

  return (
    <div>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error} — showing the last update.</p>}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rooms">
          {FILTERS.map((f) => (
            <Chip key={f.key} size="sm" pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} ({rooms.filter(f.test).length})
            </Chip>
          ))}
        </div>
        <button type="button" onClick={() => setBlocking((v) => !v)} aria-expanded={blocking} className="rounded-lg border border-sand-400 px-3 py-1.5 text-sm text-ink-800 hover:bg-sand-200">
          Take a room out of order
        </button>
      </div>

      {blocking && (
        <div className="mb-5">
          <BlockRoomForm
            rooms={rooms.filter((r) => !r.block_id)}
            auth={auth}
            onCancel={() => setBlocking(false)}
            onDone={({ block, affected }) => {
              setBlocking(false);
              toast(
                `Room ${block.unit_number} is out of order ${untilLabel(block.end_date)}.${affected.length ? ` ${affected.length} booking${affected.length === 1 ? '' : 's'} to move: see the Calendar.` : ''}`,
                { duration: affected.length ? 8000 : 4000 }
              );
              onChanged?.();
              load();
            }}
          />
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((room) => {
          const body = (
            <>
              <span className="flex items-start justify-between gap-2">
                <span className="font-serif text-2xl font-bold text-ink-900">{room.unit_number}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${JOB_STATUS_STYLE[room.housekeeping] || ''}`}>{room.housekeeping}</span>
              </span>
              <span className="mt-0.5 block text-xs text-ink-400">
                {room.room_type}{room.view_label ? ` · ${room.view_label}` : ''}{room.floor ? ` · Floor ${room.floor}` : ''}
              </span>
              {/* A room nobody can be put in is not "free". */}
              {!(room.block_id && room.occ.key === 'free') && (
                <span className={`mt-3 block text-sm font-medium ${room.occ.key === 'free' ? 'text-green-700' : 'text-ink-900'}`}>{room.occ.label}</span>
              )}
              {room.occ.detail && <span className="block text-xs text-ink-500">{room.occ.detail}</span>}
              {room.block_id && (
                <>
                  <span className="mt-3 block text-sm font-medium text-red-700">Out of order {untilLabel(room.block_until)}</span>
                  <span className="block text-xs text-ink-500">
                    {room.block_reason}
                    {room.booking_id ? ' · open the booking to move it to another room' : ''}
                  </span>
                </>
              )}
            </>
          );
          const frame = 'block w-full flex-1 rounded-xl border border-sand-300 bg-sand-200 p-4 text-left';
          return (
            <li key={room.id} className="flex flex-col gap-2">
              {room.booking_id ? (
                <button type="button" onClick={() => onOpen(room.booking_id)} className={`${frame} transition hover:border-ink-300`} aria-label={`Room ${room.unit_number}: open booking ${room.reference}`}>
                  {body}
                </button>
              ) : (
                <div className={frame}>{body}</div>
              )}
              {room.housekeeping === 'Inspection' && (
                <button type="button" disabled={approvingId === room.id} onClick={() => approve(room)} className="rounded-xl bg-green-700 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {approvingId === room.id ? 'Approving…' : 'Approve: room ready'}
                </button>
              )}
              {room.block_id && (
                <button type="button" onClick={() => putBack(room)} className="rounded-xl border border-sand-400 py-2 text-sm font-semibold text-ink-800 hover:bg-sand-200">
                  Put back in service
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-sm text-ink-400">No rooms match that filter right now.</p>}
    </div>
  );
}
