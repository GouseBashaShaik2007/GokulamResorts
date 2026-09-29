'use client';

import { useBooking } from './BookingContext';

/**
 * Small client island so server components (RoomCard, the homepage, the room
 * info page) can open the booking slide-over without becoming client
 * components themselves.
 */
export default function OpenBookingButton({ roomTypeId, className, children }) {
  const { openBooking } = useBooking();
  return (
    <button type="button" onClick={() => openBooking(roomTypeId ? { roomTypeId } : undefined)} className={className}>
      {children}
    </button>
  );
}
