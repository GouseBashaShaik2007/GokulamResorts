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

// Rooms × dates planner — how front-desk staff actually think about
// availability, as opposed to a flat booking list.
export default function BookingsCalendar() {
  const [units, setUnits] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0); // days from today to the first column
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    Promise.all([
      api.get('/admin/room-units', withAdminAuth()),
      api.get('/desk/bookings', withAdminAuth()),
    ])
      .then(([unitsRes, bookingsRes]) => {
        setUnits(unitsRes.data.units.filter((u) => u.is_active));
        setBookings(bookingsRes.data.bookings.filter((b) => HOLDS_INVENTORY.includes(b.status)));
        setError('');
      })
      .catch((err) => setError(errMsg(err, 'Could not load the planner')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Resort-calendar days as plain strings, so they compare directly with booking dates.
  const today = todayIST();
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, offset + i)), [today, offset]);

  const bookingOn = (unitId, day) =>
    bookings.find((b) => b.room_unit_id === unitId && String(b.check_in).slice(0, 10) <= day && day < String(b.check_out).slice(0, 10));

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
          <span className="ml-2 text-sm text-navy-300">{fmtDate(days[0])} – {fmtDate(days[days.length - 1])}</span>
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
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <caption className="sr-only">Room bookings by day. Select a booking to open it.</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-[7rem] border-b border-r border-navy-800 bg-navy-900 px-3 py-2 text-left font-semibold text-navy-200">
                Room
              </th>
              {days.map((day) => {
                const label = dayLabel(day);
                return (
                  <th
                    key={day}
                    scope="col"
                    className={`min-w-[4.5rem] border-b border-navy-800 px-1 py-2 text-center font-semibold ${day === today ? 'bg-ocean-50 text-ocean-700' : 'bg-navy-900 text-navy-300'}`}
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
                  <span className="block text-[10px] font-normal text-navy-400">{unit.room_type}</span>
                </th>
                {days.map((day) => {
                  const booking = bookingOn(unit.id, day);
                  return (
                    <td key={day} className="border-r border-navy-800/40 p-0.5 text-center align-middle">
                      {booking ? (
                        <button
                          type="button"
                          onClick={() => setOpenId(booking.id)}
                          title={`${booking.guest_name} · ${STATUS_LABEL[booking.status] || booking.status} · ${fmtDate(booking.check_in)} → ${fmtDate(booking.check_out)}`}
                          aria-label={`Room ${unit.unit_number}, ${dayLabel(day).date}: ${booking.guest_name}, ${STATUS_LABEL[booking.status] || booking.status}. Open booking.`}
                          className={`block w-full truncate rounded px-1 py-1.5 hover:opacity-85 ${STATUS_COLOR[booking.status]}`}
                        >
                          {booking.guest_name.split(' ')[0]}
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
