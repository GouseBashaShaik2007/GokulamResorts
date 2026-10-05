'use client';

import { formatRange } from '../../../lib/dateRange';
import useAvailability from '../../../lib/useAvailability';
import { inr } from '../../../lib/bookingUi';
import { realPhotos } from '../../../lib/rooms';
import { useBooking } from '../BookingContext';
import Photo from '../../ui/Photo';

// How many rooms of a type are left, said only when it helps the guest decide.
const leftLabel = (free) => (free === 1 ? 'Last room for these dates' : free <= 3 ? `${free} rooms left` : 'Available');

/**
 * Step 2: the room types with a room free for the dates, each with the price
 * of the stay. A guest books a type; the front desk gives the room itself at
 * check-in, so no room numbers are shown here.
 */
export default function RoomStep() {
  const { stay, guests, roomTypeFilter, clearRoomTypeFilter, pick, setPick, goTo } = useBooking();

  const { types, loading, error } = useAvailability({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests,
    roomTypeId: roomTypeFilter,
  });

  const handleSelect = (roomType, quote) => {
    setPick({ roomType, quote });
    goTo('guest');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Step 2 of 4</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-ink-900">Choose Your Room</h2>
          <p className="mt-1 text-sm text-ink-400">
            {formatRange(stay.checkIn, stay.checkOut)} · {guests} guest{guests > 1 ? 's' : ''}
          </p>
        </div>
        <button type="button" onClick={() => goTo('stay')} className="text-xs text-gold-600 hover:underline">
          Edit dates
        </button>
      </div>

      {roomTypeFilter && (
        <button type="button" onClick={clearRoomTypeFilter} className="text-xs text-gold-600 hover:underline">
          Show all room types
        </button>
      )}

      {loading && <p className="text-sm text-ink-400">Checking availability...</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {!loading && !error && types && types.length === 0 && (
        <p className="rounded-lg bg-sand-200 p-4 text-sm text-ink-500">No rooms are free for these dates. Try different dates.</p>
      )}

      {!loading && !error && types && types.length > 0 && (
        <>
          <ul className="space-y-3">
            {types.map(({ roomType, quote, free }) => {
              const selected = pick?.roomType?.id === roomType.id;
              const hasPhoto = realPhotos({ images: [roomType.image] }).length > 0;
              return (
                <li key={roomType.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(roomType, quote)}
                    aria-pressed={selected}
                    className={`block w-full overflow-hidden rounded-xl border text-left transition ${
                      selected ? 'border-gold-400 bg-gold-500/10 ring-1 ring-gold-400' : 'border-sand-300 bg-sand-200 hover:border-ink-300'
                    }`}
                  >
                    {hasPhoto && (
                      <span className="relative block h-28 w-full">
                        <Photo src={roomType.image} alt="" sizes="(min-width: 640px) 32rem, 100vw" />
                      </span>
                    )}
                    <span className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                      <span>
                        <span className="block font-medium text-ink-900">{roomType.name}</span>
                        <span className="block text-xs text-ink-500">
                          Sleeps {roomType.capacity} · {leftLabel(free)}
                        </span>
                      </span>
                      <span className="text-sm text-ink-500">
                        {quote.promo > 0 && <span className="mr-2 text-ink-300 line-through">{inr(quote.base)}</span>}
                        <span className="price">{inr(quote.total)}</span> for {quote.nights} night{quote.nights > 1 ? 's' : ''}
                        {quote.promo > 0 && (
                          <span className="ml-2 rounded bg-green-500/15 px-1.5 py-0.5 text-xs text-green-700">{quote.promoDetails[0].name}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-400">Your room number is given to you at check-in.</p>
        </>
      )}
    </div>
  );
}
