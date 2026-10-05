'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import RoomCard from '../RoomCard';
import Chip from '../ui/Chip';
import { useBookingPanel, useStay } from '../booking/BookingContext';
import { formatRange } from '@/lib/dateRange';
import useAvailability from '@/lib/useAvailability';
import { viewGroupsOf } from '@/lib/rooms';
import { offersForRoom } from '@/lib/offers';

const SORTS = {
  priceAsc: { label: 'Price: low to high', fn: (a, b) => a.price_per_night - b.price_per_night },
  priceDesc: { label: 'Price: high to low', fn: (a, b) => b.price_per_night - a.price_per_night },
};
const GUEST_CHOICES = [1, 2, 3, 4, 5, 6];

// What each room type costs, and how many are free, for the dates the guest
// has already chosen (in the hero or the booking panel). null until dates are
// set, or if the check fails — cards then show the nightly "from" rate.
function useStayPrices() {
  const { stay, datesValid, guests } = useStay();
  const { types } = useAvailability({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests, enabled: datesValid });
  return useMemo(
    () => (types ? new Map(types.map((type) => [type.roomType.id, { quote: type.quote, free: type.units.length }])) : null),
    [types]
  );
}

// The filters live in the page's address — /rooms?view=Sea&guests=2&sort=priceDesc
// — so the back button, a reload or a link sent to someone brings back the
// same list. Anything not in the address is at its default.
function useFilters(viewOptions) {
  const params = useSearchParams();
  const pathname = usePathname();

  const view = viewOptions.includes(params.get('view')) ? params.get('view') : 'all';
  const guests = GUEST_CHOICES.includes(Number(params.get('guests'))) ? Number(params.get('guests')) : 0;
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'priceAsc';

  // `changes`: { view | guests | sort: value }; an empty value removes it.
  const set = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, String(value)) : next.delete(key)));
    const query = next.toString();
    // Replaces the address in place: a filter is not a new page to go "back" from.
    window.history.replaceState(null, '', `${pathname}${query ? `?${query}` : ''}`);
  };

  return { view, guests, sort, set, clear: () => set({ view: '', guests: '' }) };
}

/** `rooms`: the room types, prices as numbers. `offers`: live offers (lib/offers.js), shown on the cards they cover. */
export default function RoomsExplorer({ rooms, offers = [] }) {
  const viewOptions = useMemo(() => [...new Set(rooms.flatMap(viewGroupsOf))].sort(), [rooms]);
  const { view, guests, sort, set, clear } = useFilters(viewOptions);
  const stay = useStay();
  const { openBooking } = useBookingPanel();
  const prices = useStayPrices();

  const stayFor = (room) => {
    if (!prices) return undefined;
    if (prices.has(room.id)) return prices.get(room.id);
    return room.capacity < stay.guests ? { tooSmall: true } : { soldOut: true };
  };

  const shown = useMemo(
    () =>
      rooms
        .filter((r) => view === 'all' || viewGroupsOf(r).includes(view))
        .filter((r) => !guests || r.capacity >= guests)
        .sort(SORTS[sort].fn),
    [rooms, view, guests, sort]
  );

  // An odd list ends with one card across both columns. Only for the full
  // list: with a filter on, which card is last keeps changing, and the wide
  // card would jump from room to room.
  const filtered = view !== 'all' || guests > 0;
  const featureLast = !filtered && shown.length > 1 && shown.length % 2 === 1;

  return (
    <>
      {/* Sticks just under the navbar while the list scrolls. */}
      <div className="sticky top-[var(--nav-h)] z-30 -mx-4 mb-8 border-b border-sand-300 bg-sand-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex items-center gap-x-6 gap-y-3 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
          {viewOptions.length > 0 && (
            <div className="flex flex-none items-center gap-2" role="group" aria-label="View">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">View</span>
              <Chip size="sm" pressed={view === 'all'} onClick={() => set({ view: '' })}>Any</Chip>
              {viewOptions.map((v) => (
                <Chip key={v} size="sm" pressed={view === v} onClick={() => set({ view: v })}>{v}</Chip>
              ))}
            </div>
          )}

          <label className="flex flex-none items-center gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Guests</span>
            <select
              value={guests}
              onChange={(e) => set({ guests: Number(e.target.value) || '' })}
              className="rounded-full border border-sand-300 bg-transparent px-3 py-1.5 text-sm text-ink-800 focus:border-ocean-400 focus:outline-none"
            >
              <option value={0}>Any</option>
              {GUEST_CHOICES.map((n) => (
                <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-none items-center gap-2 text-sm sm:ml-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Sort</span>
            <select
              value={sort}
              onChange={(e) => set({ sort: e.target.value === 'priceAsc' ? '' : e.target.value })}
              className="rounded-full border border-sand-300 bg-transparent px-3 py-1.5 text-sm text-ink-800 focus:border-ocean-400 focus:outline-none"
            >
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm text-ink-400">
        <p aria-live="polite">
          {shown.length} room type{shown.length === 1 ? '' : 's'}
          {prices && (
            <>
              {' '}· prices for {formatRange(stay.stay.checkIn, stay.stay.checkOut)}, {stay.guests} guest{stay.guests === 1 ? '' : 's'}
            </>
          )}
        </p>
        <button type="button" onClick={() => openBooking({ step: 'stay' })} className="font-semibold text-ocean-600 underline underline-offset-2">
          {stay.datesValid ? 'Change dates' : 'Add your dates to see totals and what’s free'}
        </button>
      </div>

      {shown.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2">
          {shown.map((room, i) => {
            const wide = featureLast && i === shown.length - 1;
            return (
              <div key={room.id} className={wide ? 'md:col-span-2' : ''}>
                <RoomCard room={room} size={wide ? 'wide' : 'large'} heading="h2" stay={stayFor(room)} offer={offersForRoom(offers, room)[0]} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center text-ink-500">
          No rooms match those filters.{' '}
          <button type="button" onClick={clear} className="font-semibold text-ocean-500 underline">
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
