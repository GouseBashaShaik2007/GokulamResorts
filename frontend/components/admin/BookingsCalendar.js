'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';
import { STATUS_LABEL, addDays, errMsg, fmtDate, todayIST } from '../../lib/bookingUi';
import BookingDetail from '../bookings/BookingDetail';

const DAYS_SHOWN = 14;
const STEP_DAYS = 7;
const HOLDS_INVENTORY = ['pending_payment', 'paid', 'confirmed', 'checked_in'];

const STATUS_COLOR = {
  pending_payment: 'bg-navy-600/60 text-navy-100',
  paid: 'bg-amber-300 text-navy-50',
  confirmed: 'bg-ocean-500 text-white',
  checked_in: 'bg-emerald-600 text-white',
};

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
 * One room's row as cells: a free day, or a booking spanning the nights it
 * holds within the days on screen. A stay drawn as one bar shows its length
 * and where one guest leaves and the next arrives.
 */
function rowCells(unitBookings, days) {
  const on = (d) => unitBookings.find((b) => day(b.check_in) <= d && d < day(b.check_out));
  const cells = [];
  for (let i = 0; i < days.length; ) {
    const booking = on(days[i]);
    if (!booking) {
      cells.push({ key: days[i], span: 1 });
      i += 1;
    } else {
      let span = 1;
      while (i + span < days.length && on(days[i + span])?.id === booking.id) span += 1;
      cells.push({
        key: `${days[i]}-${booking.id}`,
        span,
        booking,
        from: days[i],
        startsEarlier: day(booking.check_in) < days[0], // began before the first column
        endsLater: day(booking.check_out) > addDays(days[days.length - 1], 1), // runs past the last column
      });
      i += span;
    }
  }
  return cells;
}

// Rooms × dates planner — how front-desk staff actually think about
// availability, as opposed to a flat booking list.
export default function BookingsCalendar() {
  const [units, setUnits] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0); // days from today to the first column
  const [openId, setOpenId] = useState(null);

  // Resort-calendar days as plain strings, so they compare directly with booking dates.
  const today = todayIST();
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, offset + i)), [today, offset]);
  const first = days[0];
  const last = days[days.length - 1];

  // Only the bookings that touch the days on screen, however many there are in total.
  const load = useCallback(() => {
    Promise.all([
      api.get('/admin/room-units', withAdminAuth()),
      api.get('/desk/bookings', withAdminAuth({ params: { status: HOLDS_INVENTORY.join(','), from: first, to: last, limit: 500 } })),
    ])
      .then(([unitsRes, bookingsRes]) => {
        setUnits(unitsRes.data.units.filter((u) => u.is_active));
        setBookings(bookingsRes.data.bookings.filter((b) => HOLDS_INVENTORY.includes(b.status)));
        setError('');
      })
      .catch((err) => setError(errMsg(err, 'Could not load the planner')))
      .finally(() => setLoading(false));
  }, [first, last]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;

  const sortedUnits = [...units].sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));
  const navButton = 'rounded-lg border border-navy-700 px-3 py-1.5 text-sm text-navy-100 hover:bg-navy-800 disabled:opacity-40';

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-navy-800 p-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOffset((o) => o - STEP_DAYS)} className={navButton}>← Earlier</button>
          <button type="button" onClick={() => setOffset(0)} disabled={offset === 0} className={navButton}>Today</button>
          <button type="button" onClick={() => setOffset((o) => o + STEP_DAYS)} className={navButton}>Later →</button>
          <span className="ml-2 text-sm text-navy-300">{fmtDate(first)} – {fmtDate(last)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-navy-400">
          {Object.entries(STATUS_COLOR).map(([status, cls]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${cls.split(' ')[0]}`} />
              {STATUS_LABEL[status] || status}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
          <caption className="sr-only">Room bookings by day. Each bar is one stay; select it to open the booking.</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-28 border-b border-r border-navy-800 bg-navy-900 px-3 py-2 text-left font-semibold text-navy-200">
                Room
              </th>
              {days.map((d) => {
                const label = dayLabel(d);
                return (
                  <th
                    key={d}
                    scope="col"
                    className={`border-b border-navy-800 px-1 py-2 text-center font-semibold ${d === today ? 'bg-ocean-50 text-ocean-700' : 'bg-navy-900 text-navy-300'}`}
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
              <tr key={unit.id} className="border-b border-navy-800/60">
                <th scope="row" className="sticky left-0 z-10 border-r border-navy-800 bg-navy-900 px-3 py-2 text-left font-medium text-navy-50">
                  {unit.unit_number}
                  <span className="block truncate text-[10px] font-normal text-navy-400">{unit.room_type}</span>
                </th>
                {rowCells(bookings.filter((b) => b.room_unit_id === unit.id), days).map((cell) => {
                  const b = cell.booking;
                  return (
                    <td key={cell.key} colSpan={cell.span} className="border-r border-navy-800/40 p-0.5 text-center align-middle">
                      {b ? (
                        <button
                          type="button"
                          onClick={() => setOpenId(b.id)}
                          title={`${b.guest_name} · ${STATUS_LABEL[b.status] || b.status} · ${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}`}
                          aria-label={`Room ${unit.unit_number}: ${b.guest_name}, ${fmtDate(b.check_in)} to ${fmtDate(b.check_out)}, ${STATUS_LABEL[b.status] || b.status}. Open booking.`}
                          className={`flex w-full items-center gap-1 px-2 py-1.5 text-left hover:opacity-85 ${STATUS_COLOR[b.status]} ${cell.startsEarlier ? 'rounded-r' : cell.endsLater ? 'rounded-l' : 'rounded'}`}
                        >
                          {cell.startsEarlier && <span aria-hidden="true">‹</span>}
                          <span className="min-w-0 flex-1 truncate">{cell.span > 1 ? b.guest_name : b.guest_name.split(' ')[0]}</span>
                          {cell.endsLater && <span aria-hidden="true">›</span>}
                        </button>
                      ) : (
                        <div className="rounded bg-navy-800/40 px-1 py-1.5 text-navy-600" aria-label="Free">·</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedUnits.length === 0 && (
              <tr>
                <td colSpan={DAYS_SHOWN + 1} className="p-6 text-center text-navy-400">
                  No active rooms yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && <BookingDetail bookingId={openId} mode="admin" onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
