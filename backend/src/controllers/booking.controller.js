const asyncHandler = require('../utils/asyncHandler');
const bookings = require('../services/booking.service');
const { GUEST } = require('../services/audit');

// Keep a leading + and digits only: "+91 98765-43210" -> "+919876543210".
const normalizePhone = (p) => String(p).trim().replace(/(?!^\+)[^\d]/g, '');

// GET /api/availability?checkIn&checkOut&roomTypeId&guests
// The room types that have a room free for the dates, with prices and how many
// are left. Guests book a type, not a room number, so no numbers are sent.
// For a stay starting today, only rooms housekeeping has passed are counted.
const getAvailability = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, roomTypeId, guests } = req.query;
  const types = await bookings.availability({
    checkIn,
    checkOut,
    roomTypeId: roomTypeId ? Number(roomTypeId) : null,
    guests: guests ? Number(guests) : 1,
    liveOnly: true,
  });
  res.json({
    success: true,
    types: types.map(({ roomType, quote, units }) => ({ roomType, quote, free: units.length })),
  });
});

// POST /api/book-room — online booking of a room type; a room of that type is
// held while the guest pays. Which room it is stays with the resort: the
// front desk gives the room at check-in.
const createBooking = asyncHandler(async (req, res) => {
  const b = await bookings.createOnlineBooking(
    { ...req.body, phone: normalizePhone(req.body.phone) },
    { source: 'online', actor: GUEST }
  );
  res.status(201).json({
    success: true,
    message: 'Room held. Complete payment to confirm your booking.',
    bookingId: b.id,
    reference: b.reference,
    amount: Number(b.total_amount),
    currency: 'INR',
    holdExpiresAt: b.hold_expires_at,
    room: { type: b.room_type },
  });
});

// GET /api/bookings/lookup?reference&phone — guest status page (no login).
const lookup = asyncHandler(async (req, res) => {
  const booking = await bookings.lookupForGuest(req.query.reference, req.query.phone);
  res.json({ success: true, booking });
});

module.exports = { getAvailability, createBooking, lookup, normalizePhone };
