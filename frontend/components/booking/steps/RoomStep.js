'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { errMsg } from '../../../lib/bookingUi';
import { useBooking } from '../BookingContext';
import RoomPicker from '../../bookings/RoomPicker';

export default function RoomStep() {
  const { stay, roomTypeFilter, clearRoomTypeFilter, pick, setPick, goTo } = useBooking();
  const [types, setTypes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const guests = Number(stay.adults) + Number(stay.children);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/availability', {
          params: {
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            guests,
            ...(roomTypeFilter ? { roomTypeId: roomTypeFilter } : {}),
          },
        });
        if (!cancelled) {
          setTypes(res.data.types);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setTypes(null);
          setError(errMsg(err, 'Could not check availability'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [stay.checkIn, stay.checkOut, guests, roomTypeFilter]);

  const handleSelect = (unit, roomType, quote) => {
    setPick({ unit, roomType, quote });
    goTo('guest');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Step 2 of 4</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-navy-50">Choose Your Room</h2>
          <p className="mt-1 text-sm text-navy-400">
            {stay.checkIn} → {stay.checkOut} · {guests} guest{guests > 1 ? 's' : ''}
          </p>
        </div>
        <button type="button" onClick={() => goTo('stay')} className="text-xs text-gold-400 hover:underline">
          Edit dates
        </button>
      </div>

      {roomTypeFilter && (
        <button type="button" onClick={clearRoomTypeFilter} className="text-xs text-gold-400 hover:underline">
          Show all room types
        </button>
      )}

      {loading && <p className="text-sm text-navy-400">Checking availability...</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && !error && (
        <RoomPicker
          types={types}
          selectedId={pick?.unit.id}
          onSelect={handleSelect}
          showType={!roomTypeFilter}
          renderTypeHeader={
            !roomTypeFilter
              ? (roomType) =>
                  roomType.image ? (
                    <img
                      src={roomType.image}
                      alt={roomType.name}
                      className="mb-2 h-28 w-full rounded-lg object-cover"
                    />
                  ) : null
              : undefined
          }
        />
      )}
    </div>
  );
}
