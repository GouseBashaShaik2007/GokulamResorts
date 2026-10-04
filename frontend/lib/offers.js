// Offers as guests see them. They come from GET /offers: the promotions that
// are switched on in Admin → Offers and not yet over — the same rules the
// booking price uses, so what is advertised is what is charged.
//
// An offer: { id, name, discount_type: 'percent' | 'fixed', value, start_date,
//   end_date (both YYYY-MM-DD, the last night included), room_type_id,
//   room_type, room_slug } — the room fields are null when it covers every room.

import { inr } from './bookingUi';

const day = (iso, withYear) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

/** "15% off" or "₹500 off" — per night. */
export const offerSaving = (offer) =>
  offer.discount_type === 'percent' ? `${Number(offer.value)}% off` : `${inr(offer.value)} off`;

/** "1 Oct – 30 Nov 2026": the nights the offer covers. */
export const offerDates = (offer) =>
  offer.start_date === offer.end_date
    ? day(offer.end_date, true)
    : `${day(offer.start_date, offer.start_date.slice(0, 4) !== offer.end_date.slice(0, 4))} – ${day(offer.end_date, true)}`;

// What an offer takes off one night at this room's rate.
const nightlySaving = (offer, room) =>
  offer.discount_type === 'percent' ? (Number(room.price_per_night) * Number(offer.value)) / 100 : Number(offer.value);

/** The offers that cover this room type, biggest saving first (the price uses the biggest). */
export const offersForRoom = (offers, room) =>
  (offers || [])
    .filter((offer) => !offer.room_type_id || offer.room_type_id === room.id)
    .sort((a, b) => nightlySaving(b, room) - nightlySaving(a, room));
