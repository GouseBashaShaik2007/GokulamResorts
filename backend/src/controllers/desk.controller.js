// Front desk operations. Also usable by managers (deskAuth accepts both).
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const bookings = require('../services/booking.service');
const { normalizePhone } = require('./booking.controller');

const id = (req) => Number(req.params.id);

// GET /api/desk/overview — arrivals, in-house, departures, approvals, refunds to pay out
const overview = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await bookings.deskOverview()) });
});

// GET /api/desk/bookings?status=&q=&from=&to=
const list = asyncHandler(async (req, res) => {
  res.json({ success: true, bookings: await bookings.list(req.query) });
});

// GET /api/desk/bookings/:id
const detail = asyncHandler(async (req, res) => {
  res.json({ success: true, booking: await bookings.detail(id(req)) });
});

// GET /api/desk/availability?checkIn&checkOut&guests
const availability = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, guests, roomTypeId } = req.query;
  res.json({
    success: true,
    types: await bookings.availability({
      checkIn,
      checkOut,
      guests: guests ? Number(guests) : 1,
      roomTypeId: roomTypeId ? Number(roomTypeId) : null,
    }),
  });
});

// POST /api/desk/bookings — walk-in: confirmed immediately, paid in full now.
const createCounterBooking = asyncHandler(async (req, res) => {
  const { paymentMethod, paymentReference, ...guest } = req.body;
  const booking = await bookings.createBooking(
    { ...guest, phone: normalizePhone(guest.phone) },
    { source: 'counter', actor: req.actor, payment: { method: paymentMethod, reference: paymentReference } }
  );
  res.status(201).json({ success: true, booking });
});

// POST /api/desk/bookings/:id/payments — { amount, method, reference }
const recordPayment = asyncHandler(async (req, res) => {
  const booking = await bookings.recordPayment(id(req), req.body, req.actor);
  res.json({ success: true, booking });
});

// POST /api/desk/bookings/:id/documents — multipart: file + metadata
const addDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Attach a photo or PDF of the ID');
  const document = await bookings.addDocument(
    id(req),
    {
      guestName: req.body.guestName,
      isPrimary: req.body.isPrimary === 'true',
      idType: req.body.idType,
      idLast4: req.body.idLast4,
      nationality: req.body.nationality,
      maskedConfirmed: req.body.maskedConfirmed === 'true',
    },
    req.file,
    req.actor
  );
  res.status(201).json({ success: true, document });
});

// DELETE /api/desk/bookings/:id/documents/:docId — only before check-in
const removeDocument = asyncHandler(async (req, res) => {
  await bookings.removeDocument(id(req), Number(req.params.docId), req.actor);
  res.json({ success: true });
});

const checkIn = asyncHandler(async (req, res) => {
  const { booking, warnings } = await bookings.checkIn(id(req), req.actor);
  res.json({ success: true, booking, warnings });
});

// POST /api/desk/bookings/:id/extend — { checkOut }
const extend = asyncHandler(async (req, res) => {
  res.json({ success: true, booking: await bookings.extendStay(id(req), req.body.checkOut, req.actor) });
});

const checkOut = asyncHandler(async (req, res) => {
  const result = await bookings.checkOut(id(req), req.actor);
  res.json({ success: true, ...result });
});

const noShow = asyncHandler(async (req, res) => {
  res.json({ success: true, booking: await bookings.markNoShow(id(req), req.actor) });
});

// POST /api/desk/refunds/:id/complete — { method, reference }: counter refund paid out
const completeRefund = asyncHandler(async (req, res) => {
  await bookings.completeManualRefund(id(req), req.body, req.actor);
  res.json({ success: true });
});

module.exports = {
  overview,
  list,
  detail,
  availability,
  createCounterBooking,
  recordPayment,
  addDocument,
  removeDocument,
  checkIn,
  extend,
  checkOut,
  noShow,
  completeRefund,
};
