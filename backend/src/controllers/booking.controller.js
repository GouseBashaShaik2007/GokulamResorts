const asyncHandler = require('../utils/asyncHandler');
const bookings = require('../services/booking.service');
const { GUEST } = require('../services/audit');

// Keep a leading + and digits only: "+91 98765-43210" -> "+919876543210".
const normalizePhone = (p) => String(p).trim().replace(/(?!^\+)[^\d]/g, '');

// GET /api/availability?checkIn&checkOut&roomTypeId&guests
// Real room numbers that are free for the dates, grouped by type, with prices.
const getAvailability = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, roomTypeId, guests } = req.query;
  const types = await bookings.availability({
    checkIn,
    checkOut,
    roomTypeId: roomTypeId ? Number(roomTypeId) : null,
    guests: guests ? Number(guests) : 1,
  });
  res.json({ success: true, types });
});

// POST /api/book-room — online booking; holds the room while the guest pays.
const createBooking = asyncHandler(async (req, res) => {
  const b = await bookings.createBooking(
    { ...req.body, phone: normalizePhone(req.body.phone) },
    { source: 'online', actor: GUEST }
  );
  res.status(201).json({
    success: true,
    message: 'Room held. Complete payment to send your booking for confirmation.',
    bookingId: b.id,
    amount: Number(b.total_amount),
    currency: 'INR',
    holdExpiresAt: b.hold_expires_at,
    room: { unitNumber: b.unit_number, type: b.room_type },
  });
});

// GET /api/bookings/lookup?bookingId&phone — guest status page (no login).
const lookup = asyncHandler(async (req, res) => {
  const booking = await bookings.lookupForGuest(Number(req.query.bookingId), req.query.phone);
  res.json({ success: true, booking });
});

module.exports = { getAvailability, createBooking, lookup, normalizePhone };
