'use client';

import { useBooking } from '../booking/BookingContext';
import DateRangePicker from '../booking/DateRangePicker';
import { todayIST } from '@/lib/bookingUi';

export default function HeroBookingForm() {
  const { stay, setStay, openBooking, adults, children: kids } = useBooking();
  const setNum = (k) => (e) => setStay({ [k]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        openBooking();
      }}
      className="grid gap-3 rounded-2xl border border-navy-700 bg-navy-950 p-4 shadow-2xl shadow-black/20 sm:grid-cols-[1.6fr_1fr_1fr_auto] sm:items-center sm:p-5"
      aria-label="Check availability"
    >
      <div className="rounded-xl border border-navy-700 px-4 py-2.5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-navy-400">Check-in — Check-out</p>
        <DateRangePicker
          checkIn={stay.checkIn}
          checkOut={stay.checkOut}
          onChange={({ checkIn, checkOut }) => setStay({ checkIn, checkOut })}
          minDateISO={todayIST()}
        />
      </div>
      <label className="rounded-xl border border-navy-700 px-4 py-2.5 focus-within:border-ocean-400 focus-within:ring-1 focus-within:ring-ocean-400">
        <span className="block text-[0.65rem] font-semibold uppercase tracking-wider text-navy-400">Adults</span>
        <input type="number" min={1} max={10} value={stay.adults} onChange={setNum('adults')} onBlur={() => stay.adults === '' && setStay({ adults })} className="w-full bg-transparent text-sm text-navy-50 focus:outline-none" />
      </label>
      <label className="rounded-xl border border-navy-700 px-4 py-2.5 focus-within:border-ocean-400 focus-within:ring-1 focus-within:ring-ocean-400">
        <span className="block text-[0.65rem] font-semibold uppercase tracking-wider text-navy-400">Children</span>
        <input type="number" min={0} max={6} value={stay.children} onChange={setNum('children')} onBlur={() => stay.children === '' && setStay({ children: kids })} className="w-full bg-transparent text-sm text-navy-50 focus:outline-none" />
      </label>
      <div className="text-center">
        <button type="submit" className="btn-gold w-full whitespace-nowrap sm:w-auto">Check availability</button>
        <p className="mt-1.5 text-[0.7rem] font-medium text-gold-600">Best rate when you book direct</p>
      </div>
    </form>
  );
}
