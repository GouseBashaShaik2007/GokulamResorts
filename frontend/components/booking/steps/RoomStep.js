'use client';

import { formatRange } from '../../../lib/dateRange';
import useAvailability from '../../../lib/useAvailability';
import { useBooking } from '../BookingContext';
import RoomPicker from '../../bookings/RoomPicker';
import Photo from '../../ui/Photo';
import { realPhotos } from '../../../lib/rooms';

export default function RoomStep() {
  const { stay, guests, roomTypeFilter, clearRoomTypeFilter, pick, setPick, goTo } = useBooking();

  const { types, loading, error } = useAvailability({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests,
    roomTypeId: roomTypeFilter,
  });

  const handleSelect = (unit, roomType, quote) => {
    setPick({ unit, roomType, quote });
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

      {!loading && !error && (
        <RoomPicker
          types={types}
          selectedId={pick?.unit.id}
          onSelect={handleSelect}
          showType={!roomTypeFilter}
          renderTypeHeader={
            !roomTypeFilter
              ? (roomType) =>
                  realPhotos({ images: [roomType.image] }).length > 0 ? (
                    <div className="relative mb-2 h-28 w-full overflow-hidden rounded-lg">
                      <Photo src={roomType.image} alt="" sizes="(min-width: 640px) 32rem, 100vw" />
                    </div>
                  ) : null
              : undefined
          }
        />
      )}
    </div>
  );
}
