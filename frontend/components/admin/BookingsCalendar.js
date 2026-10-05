'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { deskAs } from '../../lib/api';
import { STATUS_LABEL, addDays, errMsg, fmtDate, fmtDateTime, todayIST } from '../../lib/bookingUi';
import BookingDetail from '../bookings/BookingDetail';
import { BlockRoomForm, BookingsToMove, untilLabel } from '../bookings/RoomBlocks';
import { useConfirm } from '../ui/Confirm';
import { useToast } from '../ui/Toast';

const DAYS_SHOWN = 14;
const STEP_DAYS = 7;
const HOLDS_INVENTORY = ['pending_payment', 'paid', 'confirmed', 'checked_in'];

const STATUS_COLOR = {
  pending_payment: 'bg-sand-400/60 text-ink-800',
  paid: 'bg-amber-300 text-ink-900',
  confirmed: 'bg-ocean-500 text-white',
  checked_in: 'bg-emerald-600 text-white',
};
const OUT_OF_ORDER_COLOR = 'bg-red-500/15 text-red-800';

// A calendar day (YYYY-MM-DD) as "Sat 4 Oct", without any timezone shift.
const dayLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  };
};

const day = (value) => String(value).slice(0, 10);

/**
 * One room's row as cells: a free day, a booking spanning the nights it holds
 * within the days on screen, or the nights the room is out of order. A stay
 * drawn as one bar shows its length and where one guest leaves and the next
 * arrives. A booking is drawn over a block it sits in: it is the thing to deal with.
 */
function rowCells(unitBookings, unitBlocks, days) {
  const booked = (d) => unitBookings.find((b) => day(b.check_in) <= d && d < day(b.check_out));
  const out = (d) => unitBlocks.find((k) => day(k.start_date) <= d && (!k.end_date || d < day(k.end_date)));
  const lastDay = days[days.length - 1];
  const cells = [];
  for (let i = 0; i < days.length; ) {
    const booking = booked(days[i]);
    const block = booking ? null : out(days[i]);
    let span = 1;
    if (booking) {
      while (i + span < days.length && booked(days[i + span])?.id === booking.id) span += 1;
      cells.push({
        key: `${days[i]}-${booking.id}`,
        span,
        booking,
        startsEarlier: day(booking.check_in) < days[0], // began before the first column
        endsLater: day(booking.check_out) > addDays(lastDay, 1), // runs past the last column
      });
    } else if (block) {
      while (i + span < days.length && !booked(days[i + span]) && out(days[i + span])?.id === block.id) span += 1;
      cells.push({ key: `${days[i]}-out-${block.id}`, span, block });
    } else {
      cells.push({ key: days[i], span: 1 });
    }
    i += span;
  }
  return cells;
}

/**
 * Rooms × dates planner — how front-desk staff actually think about
 * availability, as opposed to a flat booking list. Also where a room is
 * taken out of order and put back.
 * mode: 'admin' (the manager's Bookings page) or 'desk' (the front desk).
 * `refreshKey` changing reloads it; `onChanged` is called after a booking
 * opened from here, or a room, was changed.
 */
export default function BookingsCalendar({ mode = 'admin', refreshKey, onChanged }) {
  const auth = deskAs(mode);
  const ask = useConfirm();
  const toast = useToast();
  const [units, setUnits] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0); // days from today to the first column
  const [openId, setOpenId] = useState(null);
  const [blocking, setBlocking] = useState(false); // the "take a room out of order" form is open
  const [blockId, setBlockId] = useState(null); // the out-of-order bar that was selected

  // Resort-calendar days as plain strings, so they compare directly with booking dates.
  const today = todayIST();
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, offset + i)), [today, offset]);
  const first = days[0];
  const last = days[days.length - 1];

  // Only the bookings and blocks that touch the days on screen, however many there are in total.
  const load = useCallback(() => {
    Promise.all([
      api.get('/desk/rooms', auth()),
      api.get('/desk/bookings', auth({ params: { status: HOLDS_INVENTORY.join(','), from: first, to: last, limit: 500 } })),
      api.get('/desk/room-blocks', auth({ params: { from: first, to: last } })),
    ])
      .then(([unitsRes, bookingsRes, blocksRes]) => {
        setUnits(unitsRes.data.rooms);
        setBookings(bookingsRes.data.bookings.filter((b) => HOLDS_INVENTORY.includes(b.status)));
        setBlocks(blocksRes.data.blocks);
        setError('');
      })
      .catch((err) => setError(errMsg(err, 'Could not load the planner')))
      .finally(() => setLoading(false));
  }, [auth, first, last]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const putBack = async (block) => {
    const ok = await ask({
      title: `Put room ${block.unit_number} back in service?`,
      body: 'It can be booked and checked into again from today.',
      confirmLabel: 'Put back in service',
    });
    if (!ok) return;
    try {
      await api.post(`/desk/room-blocks/${block.id}/end`, {}, auth());
      toast(`Room ${block.unit_number} is back in service.`);
      setBlockId(null);
    } catch (err) {
      toast(errMsg(err, 'Could not put the room back'), { tone: 'error', duration: 6000 });
    }
    changed();
  };

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;

  const sortedUnits = [...units].sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));
  const navButton = 'rounded-lg border border-sand-300 px-3 py-1.5 text-sm text-ink-800 hover:bg-sand-200 disabled:opacity-40';
  const selected = blocks.find((k) => k.id === blockId);
  // Bookings sitting in a room on a night it is out of order: they need another room.
  const toMove = new Set(blocks.flatMap((k) => k.affected.map((b) => b.id)));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sand-200 p-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOffset((o) => o - STEP_DAYS)} className={navButton}>← Earlier</button>
          <button type="button" onClick={() => setOffset(0)} disabled={offset === 0} className={navButton}>Today</button>
          <button type="button" onClick={() => setOffset((o) => o + STEP_DAYS)} className={navButton}>Later →</button>
          <span className="ml-2 text-sm text-ink-500">{fmtDate(first)} – {fmtDate(last)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-400">
          {Object.entries(STATUS_COLOR).map(([status, cls]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${cls.split(' ')[0]}`} />
              {STATUS_LABEL[status] || status}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded ${OUT_OF_ORDER_COLOR.split(' ')[0]}`} />
            Out of order
          </span>
          <button type="button" onClick={() => setBlocking((v) => !v)} aria-expanded={blocking} className={navButton}>
            Take a room out of order
          </button>
        </div>
      </div>

      {blocking && (
        <div className="border-b border-sand-200 p-4">
          <BlockRoomForm
            rooms={sortedUnits}
            auth={auth}
            onCancel={() => setBlocking(false)}
            onDone={({ block, affected }) => {
              setBlocking(false);
              setBlockId(block.id);
              toast(
                `Room ${block.unit_number} is out of order ${untilLabel(block.end_date)}.${affected.length ? ` ${affected.length} booking${affected.length === 1 ? '' : 's'} to move.` : ''}`
              );
              changed();
            }}
          />
        </div>
      )}

      {selected && (
        <div className="border-b border-sand-200 bg-red-500/5 p-4" role="region" aria-label={`Room ${selected.unit_number}: out of order`}>
          <p className="font-semibold text-ink-900">
            Room {selected.unit_number} is out of order from {fmtDate(selected.start_date)} {untilLabel(selected.end_date)}
          </p>
          <p className="mt-0.5 text-sm text-ink-800">{selected.reason}</p>
          <p className="mt-0.5 text-xs text-ink-400">Set by {selected.created_by || 'staff'} · {fmtDateTime(selected.created_at)}</p>
          <BookingsToMove bookings={selected.affected} onOpen={setOpenId} />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => putBack(selected)} className="rounded-lg bg-ocean-500 px-4 py-2 text-sm font-semibold text-white">
              Put back in service
            </button>
            <button type="button" onClick={() => setBlockId(null)} className="rounded-lg border border-sand-400 px-4 py-2 text-sm text-ink-700">Close</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
          <caption className="sr-only">
            Room bookings by day. Each bar is one stay; select it to open the booking. A bar marked out of order is a room that cannot be used on those nights.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-28 border-b border-r border-sand-200 bg-sand-100 px-3 py-2 text-left font-semibold text-ink-700">
                Room
              </th>
              {days.map((d) => {
                const label = dayLabel(d);
                return (
                  <th
                    key={d}
                    scope="col"
                    className={`border-b border-sand-200 px-1 py-2 text-center font-semibold ${d === today ? 'bg-ocean-50 text-ocean-700' : 'bg-sand-100 text-ink-500'}`}
                  >
                    <span className="block text-[10px] font-normal uppercase tracking-wide">{label.weekday}</span>
                    {label.date}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedUnits.map((unit) => (
              <tr key={unit.id} className="border-b border-sand-200/60">
                <th scope="row" className="sticky left-0 z-10 border-r border-sand-200 bg-sand-100 px-3 py-2 text-left font-medium text-ink-900">
                  {unit.unit_number}
                  <span className="block truncate text-[10px] font-normal text-ink-400">{unit.room_type}</span>
                </th>
                {rowCells(bookings.filter((b) => b.room_unit_id === unit.id), blocks.filter((k) => k.room_unit_id === unit.id), days).map((cell) => {
                  const b = cell.booking;
                  const k = cell.block;
                  const move = b && toMove.has(b.id);
                  return (
                    <td key={cell.key} colSpan={cell.span} className="border-r border-sand-200/40 p-0.5 text-center align-middle">
                      {b && (
                        <button
                          type="button"
                          onClick={() => setOpenId(b.id)}
                          title={`${b.guest_name} · ${STATUS_LABEL[b.status] || b.status} · ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}${move ? ' · room out of order: move this booking' : ''}`}
                          aria-label={`Room ${unit.unit_number}: ${b.guest_name}, ${fmtDate(b.check_in)} to ${fmtDate(b.check_out)}, ${STATUS_LABEL[b.status] || b.status}.${move ? ' The room is out of order: this booking needs another room.' : ''} Open booking.`}
                          className={`flex w-full items-center gap-1 px-2 py-1.5 text-left hover:opacity-85 ${STATUS_COLOR[b.status]} ${move ? 'ring-2 ring-inset ring-red-600' : ''} ${cell.startsEarlier ? 'rounded-r' : cell.endsLater ? 'rounded-l' : 'rounded'}`}
                        >
                          {cell.startsEarlier && <span aria-hidden="true">‹</span>}
                          {move && <span aria-hidden="true" className="font-bold">!</span>}
                          <span className="min-w-0 flex-1 truncate">{cell.span > 1 ? b.guest_name : b.guest_name.split(' ')[0]}</span>
                          {cell.endsLater && <span aria-hidden="true">›</span>}
                        </button>
                      )}
                      {k && (
                        <button
                          type="button"
                          onClick={() => setBlockId(k.id)}
                          title={`Out of order ${untilLabel(k.end_date)}: ${k.reason}`}
                          aria-label={`Room ${unit.unit_number}: out of order ${untilLabel(k.end_date)}, ${k.reason}. Show details.`}
                          aria-pressed={blockId === k.id}
                          className={`block w-full truncate rounded border border-dashed border-red-500/50 px-2 py-1.5 text-left hover:opacity-85 ${OUT_OF_ORDER_COLOR}`}
                        >
                          {cell.span > 1 ? `Out of order · ${k.reason}` : 'Out'}
                        </button>
                      )}
                      {!b && !k && <div className="rounded bg-sand-200/40 px-1 py-1.5 text-sand-400" aria-label="Free">·</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedUnits.length === 0 && (
              <tr>
                <td colSpan={DAYS_SHOWN + 1} className="p-6 text-center text-ink-400">
                  No active rooms yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && <BookingDetail bookingId={openId} mode={mode} onClose={() => setOpenId(null)} onChanged={changed} />}
    </div>
  );
}
