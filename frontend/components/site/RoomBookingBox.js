'use client';

import { useEffect } from 'react';
import { inr, todayIST } from '@/lib/bookingUi';
import useAvailability from '@/lib/useAvailability';
import { useBooking } from '../booking/BookingContext';
import DateRangePicker from '../booking/DateRangePicker';
import { Price, useCurrency } from './Currency';
import ReviewBadge from './ReviewBadge';

/**
 * Booking box on a room page: dates → live total including GST → Reserve.
 * Shares dates/guests with the booking panel, so Reserve continues right
 * where the guest is (picking a room number of this type).
 */
export default function RoomBookingBox({ room }) {
  const { stay, setStay, datesValid, openBooking, adults, children: kids, guests, setPageRoomTypeId } = useBooking();
  const { currency } = useCurrency();
  const tooMany = guests > room.capacity;

  // Tell the booking panel which room page is open, so "Book" from the navbar
  // or the floating bar continues with this room type instead of all of them.
  useEffect(() => {
    setPageRoomTypeId(room.id);
    return () => setPageRoomTypeId(null);
  }, [room.id, setPageRoomTypeId]);

  const { types, loading, error } = useAvailability({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests,
    roomTypeId: room.id,
    enabled: datesValid && !tooMany,
  });
  // { quote, free } when this room type has a room free; { none: true } when it is full.
  const type = types?.[0];
  const result = types ? (type ? { quote: type.quote, free: type.units.length } : { none: true }) : null;

  const q = result?.quote;
  const setNum = (k) => (e) => setStay({ [k]: e.target.value });

  return (
    <div className="card space-y-5 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="text-xs text-navy-400">from </span>
          <Price inr={room.price_per_night} suffix="+ GST / night" className="text-2xl" />
        </p>
        <ReviewBadge />
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-navy-700 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">Dates</p>
          <DateRangePicker
            checkIn={stay.checkIn}
            checkOut={stay.checkOut}
            onChange={({ checkIn, checkOut }) => setStay({ checkIn, checkOut })}
            minDateISO={todayIST()}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="rounded-xl border border-navy-700 px-4 py-2 focus-within:border-ocean-400 focus-within:ring-1 focus-within:ring-ocean-400">
            <span className="block text-xs font-semibold uppercase tracking-wider text-navy-400">Adults</span>
            <input type="number" min={1} max={room.capacity} value={stay.adults} onChange={setNum('adults')} onBlur={() => stay.adults === '' && setStay({ adults })} className="w-full bg-transparent text-navy-50 focus:outline-none" />
          </label>
          <label className="rounded-xl border border-navy-700 px-4 py-2 focus-within:border-ocean-400 focus-within:ring-1 focus-within:ring-ocean-400">
            <span className="block text-xs font-semibold uppercase tracking-wider text-navy-400">Children</span>
            <input type="number" min={0} max={Math.max(0, room.capacity - 1)} value={stay.children} onChange={setNum('children')} onBlur={() => stay.children === '' && setStay({ children: kids })} className="w-full bg-transparent text-navy-50 focus:outline-none" />
          </label>
        </div>
        {tooMany && <p className="text-sm text-red-600">This room fits up to {room.capacity} guests.</p>}
      </div>

      {datesValid && !tooMany && (
        <div className="space-y-1.5 border-t border-navy-700 pt-4 text-sm" aria-live="polite">
          {loading && <p className="text-navy-400">Checking these dates…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!loading && result?.none && <p className="font-medium text-navy-100">Fully booked for these dates — try other dates.</p>}
          {!loading && q && (
            <>
              <div className="flex justify-between text-navy-300">
                <span>{inr(q.nightlyRate)} × {q.nights} night{q.nights > 1 ? 's' : ''}</span>
                <span>{inr(q.base)}</span>
              </div>
              {q.promo > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>{q.promoDetails[0]?.name || 'Offer'}</span>
                  <span>−{inr(q.promo)}</span>
                </div>
              )}
              {q.taxDetails.map((t) => (
                <div key={t.rate} className="flex justify-between text-navy-300">
                  <span>GST {t.rate}%</span>
                  <span>{inr(t.tax)}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t border-navy-700 pt-2">
                <span className="font-semibold text-navy-50">Total incl. taxes</span>
                <Price inr={q.total} className="text-xl" />
              </div>
              {currency !== 'INR' && (
                <p className="text-xs text-navy-400">Converted amounts are approximate. You are charged in Indian rupees.</p>
              )}
              {result.free <= 2 && <p className="text-xs text-orange-700">Only {result.free} room{result.free > 1 ? 's' : ''} of this type left for these dates</p>}
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => openBooking({ roomTypeId: room.id })}
        disabled={datesValid && (tooMany || result?.none)}
        className="btn-gold w-full disabled:opacity-50"
      >
        {datesValid ? 'Reserve — choose your room' : 'Check availability'}
      </button>
      <p className="text-center text-xs text-navy-400">
        <span className="font-semibold text-gold-600">Best rate when you book direct.</span> You pick your exact
        room number next. Full payment secures the room; if the resort can&apos;t confirm within 24 hours you&apos;re
        refunded automatically.
      </p>
    </div>
  );
}
