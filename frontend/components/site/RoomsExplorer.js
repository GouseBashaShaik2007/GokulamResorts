'use client';

import { useMemo, useState } from 'react';
import RoomCard from '../RoomCard';
import { useBooking } from '../booking/BookingContext';
import { formatRange } from '@/lib/dateRange';
import useAvailability from '@/lib/useAvailability';
import { viewGroupsOf } from '@/lib/rooms';
import { offersForRoom } from '@/lib/offers';

const SORTS = {
  priceAsc: { label: 'Price: low to high', fn: (a, b) => a.price_per_night - b.price_per_night },
  priceDesc: { label: 'Price: high to low', fn: (a, b) => b.price_per_night - a.price_per_night },
};

// What each room type costs, and how many are free, for the dates the guest
// has already chosen (in the hero or the booking panel). null until dates are
// set, or if the check fails — cards then show the nightly "from" rate.
function useStayPrices() {
  const { stay, datesValid, guests } = useBooking();
  const { types } = useAvailability({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests, enabled: datesValid });
  return useMemo(
    () => (types ? new Map(types.map((type) => [type.roomType.id, { quote: type.quote, free: type.units.length }])) : null),
    [types]
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active ? 'border-ocean-500 bg-ocean-500 text-white' : 'border-navy-700 text-navy-200 hover:border-ocean-300'
      }`}
    >
      {children}
    </button>
  );
}

/** `offers`: live offers (lib/offers.js), shown on the cards they cover. */
export default function RoomsExplorer({ rooms, offers = [] }) {
  const [view, setView] = useState('all');
  const [guests, setGuests] = useState(0);
  const [sort, setSort] = useState('priceAsc');
  const booking = useBooking();
  const prices = useStayPrices();

  const stayFor = (room) => {
    if (!prices) return undefined;
    if (prices.has(room.id)) return prices.get(room.id);
    return room.capacity < booking.guests ? { tooSmall: true } : { soldOut: true };
  };

  const viewOptions = useMemo(() => [...new Set(rooms.flatMap(viewGroupsOf))].sort(), [rooms]);

  const shown = useMemo(
    () =>
      rooms
        .map((r) => ({ ...r, price_per_night: Number(r.price_per_night) }))
        .filter((r) => view === 'all' || viewGroupsOf(r).includes(view))
        .filter((r) => !guests || r.capacity >= guests)
        .sort(SORTS[sort].fn),
    [rooms, view, guests, sort]
  );

  const oddCount = shown.length % 2 === 1;

  return (
    <>
      {/* Sticks just under the navbar while the list scrolls. */}
      <div className="sticky top-[var(--nav-h)] z-30 -mx-4 mb-8 border-b border-navy-700 bg-navy-950/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {viewOptions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto" role="group" aria-label="View">
              <span className="text-xs font-semibold uppercase tracking-wider text-navy-400">View</span>
              <Chip active={view === 'all'} onClick={() => setView('all')}>Any</Chip>
              {viewOptions.map((v) => (
                <Chip key={v} active={view === v} onClick={() => setView(v)}>{v}</Chip>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-navy-400">Guests</span>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="rounded-full border border-navy-700 bg-transparent px-3 py-1.5 text-sm text-navy-100 focus:border-ocean-400 focus:outline-none"
            >
              <option value={0}>Any</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm sm:ml-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-navy-400">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-full border border-navy-700 bg-transparent px-3 py-1.5 text-sm text-navy-100 focus:border-ocean-400 focus:outline-none"
            >
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-navy-400">
        <p aria-live="polite">
          {shown.length} room type{shown.length === 1 ? '' : 's'}
          {prices && (
            <>
              {' '}· prices for {formatRange(booking.stay.checkIn, booking.stay.checkOut)}, {booking.guests} guest{booking.guests === 1 ? '' : 's'}
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            booking.openBooking();
            booking.goTo('stay');
          }}
          className="font-semibold text-ocean-600 underline underline-offset-2"
        >
          {booking.datesValid ? 'Change dates' : 'Add your dates to see totals and what’s free'}
        </button>
      </div>

      {shown.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2">
          {shown.map((room, i) => {
            const lastAlone = oddCount && i === shown.length - 1 && shown.length > 1;
            return (
              <div key={room.id} className={lastAlone ? 'md:col-span-2' : ''}>
                <RoomCard room={room} size={lastAlone ? 'wide' : 'large'} heading="h2" stay={stayFor(room)} offer={offersForRoom(offers, room)[0]} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center text-navy-300">
          No rooms match those filters.{' '}
          <button type="button" onClick={() => { setView('all'); setGuests(0); }} className="font-semibold text-ocean-500 underline">
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
