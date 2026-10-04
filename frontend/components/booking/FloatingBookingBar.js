'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useBooking } from './BookingContext';
import useScrollDirection from '../../lib/useScrollDirection';
import { todayIST } from '../../lib/bookingUi';
import { formatRange } from '../../lib/dateRange';
import DateRangePicker from './DateRangePicker';

const HIDDEN_PREFIXES = [
  '/dine', '/order', '/admin', '/kitchen', '/staff', '/frontdesk',
  '/contact', '/booking/confirmation', '/booking/status',
];
const BAR_SPACE_PX = 96;

export default function FloatingBookingBar() {
  const pathname = usePathname();
  const { stay, setStay, datesValid, isOpen, openBooking, adults, children: kids, guests } = useBooking();

  // Roughly "past the hero" on any device, and a fair threshold on hero-less
  // pages too — the bar shouldn't compete with the Hero's own booking CTA.
  // Computed synchronously on first client render (not via effect) so the
  // hook's own initial `visible` state is correct from the start — an
  // effect-based update would let the bar flash visible for one frame first.
  const [revealAfter] = useState(() => (typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600));
  const scrolledIntoView = useScrollDirection({ revealAfter });

  const routeHidden = isOpen || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const visible = !routeHidden && scrolledIntoView;

  // Reserve space in <main> only while the bar is actually showing, so it
  // never sits on top of the footer or a page's own bottom content.
  useEffect(() => {
    document.documentElement.style.setProperty('--booking-bar-space', visible ? `${BAR_SPACE_PX}px` : '0px');
  }, [visible]);

  if (routeHidden) return null;

  const setField = (k) => (e) => setStay({ [k]: e.target.value });

  const handleCheck = () => openBooking();

  return (
    <motion.div
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
      animate={{ y: visible ? 0 : '150%', opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Mobile: single tap target — the full picker opens inside the slide-over */}
      <button
        type="button"
        onClick={handleCheck}
        className="glass flex w-full max-w-sm items-center justify-between gap-3 rounded-full px-5 py-3 text-left sm:hidden"
      >
        <span className="text-sm text-navy-100">
          {datesValid ? formatRange(stay.checkIn, stay.checkOut) : 'Select dates'} · {guests} guest{guests > 1 ? 's' : ''}
        </span>
        <span className="btn-gold px-4 py-1.5 text-xs">Check</span>
      </button>

      {/* Desktop / tablet: inline fields with the connected date-range picker */}
      <div className="glass hidden w-full max-w-3xl items-center gap-3 rounded-full px-5 py-3 sm:flex">
        <div className="flex flex-1 items-center gap-3">
          <DateRangePicker
            checkIn={stay.checkIn}
            checkOut={stay.checkOut}
            onChange={({ checkIn, checkOut }) => setStay({ checkIn, checkOut })}
            minDateISO={todayIST()}
            dropDirection="up"
          />
          <div className="hidden items-center gap-2 border-l border-navy-700 pl-3 md:flex">
            <label className="flex flex-col text-xs text-navy-400">
              Adults
              <input
                type="number" min={1} max={10} value={stay.adults} onChange={setField('adults')}
                onBlur={() => stay.adults === '' && setStay({ adults })}
                className="w-12 rounded bg-transparent text-sm text-navy-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-400"
              />
            </label>
            <label className="flex flex-col text-xs text-navy-400">
              Children
              <input
                type="number" min={0} max={6} value={stay.children} onChange={setField('children')}
                onBlur={() => stay.children === '' && setStay({ children: kids })}
                className="w-12 rounded bg-transparent text-sm text-navy-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocean-400"
              />
            </label>
          </div>
        </div>
        <button type="button" onClick={handleCheck} className="btn-gold whitespace-nowrap px-5 py-2 text-sm">
          Check Availability
        </button>
      </div>
    </motion.div>
  );
}
