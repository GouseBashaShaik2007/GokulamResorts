'use client';

import { useEffect, useMemo, useState } from 'react';
import api, { withAdminAuth } from '../../lib/api';

const DAYS_SHOWN = 14;
const HOLDS_INVENTORY = ['pending_payment', 'paid', 'confirmed', 'checked_in'];

const STATUS_COLOR = {
  pending_payment: 'bg-navy-600/60 text-navy-100',
  paid: 'bg-amber-500/70 text-navy-950',
  confirmed: 'bg-ocean-500 text-white',
  checked_in: 'bg-emerald-600 text-white',
};

function isoDate(d) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// Rooms × dates planner — how front-desk staff actually think about
// availability, as opposed to a flat booking list.
export default function BookingsCalendar() {
  const [units, setUnits] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/admin/room-units', withAdminAuth()),
      api.get('/desk/bookings', withAdminAuth()),
    ])
      .then(([unitsRes, bookingsRes]) => {
        setUnits(unitsRes.data.units.filter((u) => u.is_active));
        setBookings(bookingsRes.data.bookings.filter((b) => HOLDS_INVENTORY.includes(b.status)));
      })
      .catch((err) => setError(err?.response?.data?.message || 'Could not load the planner'))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(new Date(), i)), []);

  const cellFor = (unitId, day) => {
    const dayIso = isoDate(day);
    return bookings.find((b) => b.room_unit_id === unitId && b.check_in <= dayIso && dayIso < b.check_out);
  };

  if (loading) return <div className="card h-64 animate-pulse" />;
  if (error) return <p className="text-sm text-red-300">{error}</p>;

  const sortedUnits = [...units].sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-navy-800 p-4 text-xs text-navy-400">
        <span className="font-semibold uppercase tracking-wide">Legend</span>
        {Object.entries(STATUS_COLOR).map(([status, cls]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded ${cls.split(' ')[0]}`} />
            {status.replace('_', ' ')}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[7rem] border-b border-r border-navy-800 bg-navy-900 px-3 py-2 text-left font-semibold text-navy-200">
                Room
              </th>
              {days.map((day) => (
                <th key={day.toISOString()} className="min-w-[4.5rem] border-b border-navy-800 bg-navy-900 px-1 py-2 text-center font-semibold text-navy-300">
                  {day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedUnits.map((unit) => (
              <tr key={unit.id} className="border-b border-navy-800/60">
                <td className="sticky left-0 z-10 border-r border-navy-800 bg-navy-900 px-3 py-2 font-medium text-navy-50">
                  {unit.unit_number}
                  <span className="block text-[10px] font-normal text-navy-400">{unit.room_type}</span>
                </td>
                {days.map((day) => {
                  const booking = cellFor(unit.id, day);
                  return (
                    <td key={day.toISOString()} className="border-r border-navy-800/40 p-0.5 text-center align-middle">
                      {booking ? (
                        <div
                          title={`${booking.guest_name} · ${booking.status.replace('_', ' ')} · ${booking.check_in} → ${booking.check_out}`}
                          className={`truncate rounded px-1 py-1.5 ${STATUS_COLOR[booking.status]}`}
                        >
                          {booking.guest_name.split(' ')[0]}
                        </div>
                      ) : (
                        <div className="rounded bg-navy-800/40 px-1 py-1.5 text-navy-600">·</div>
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
    </div>
  );
}
