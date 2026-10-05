// Front desk operations. Also usable by managers (deskAuth accepts both).
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../middleware/errorHandler');
const bookings = require('../services/booking.service');
const cleaning = require('../services/cleaning.service');
const { normalizePhone } = require('./booking.controller');
const { query } = require('../db/pool');
const { localToday, TIMEZONE } = require('../utils/dates');
const { logAction } = require('../utils/auditLog');
const { emitFoodUpdate, emitJobUpdate } = require('../realtime');

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

// GET /api/desk/rooms — every room with its housekeeping state and who (if
// anyone) is in it or due today, so the desk can answer "which rooms are free
// and clean right now?" without opening housekeeping.
const rooms = asyncHandler(async (req, res) => {
  const today = await localToday();
  const { rows } = await query(
    `SELECT ru.id, ru.unit_number, ru.floor, ru.view_label, ru.status AS housekeeping, r.name AS room_type,
            stay.id AS booking_id, stay.reference, stay.guest_name, stay.status AS booking_status,
            stay.check_in::text AS check_in, stay.check_out::text AS check_out
     FROM room_units ru
     JOIN rooms r ON r.id = ru.room_type_id
     LEFT JOIN LATERAL (
       SELECT b.id, b.reference, b.guest_name, b.status, b.check_in, b.check_out
       FROM bookings b
       WHERE b.room_unit_id = ru.id
         AND (b.status = 'checked_in' OR (b.status IN ('confirmed', 'paid') AND b.check_in <= $1 AND b.check_out > $1))
       ORDER BY (b.status = 'checked_in') DESC, b.check_in
       LIMIT 1
     ) stay ON true
     WHERE ru.is_active
     ORDER BY ru.unit_number`,
    [today]
  );
  res.json({ success: true, today, rooms: rows });
});

// POST /api/desk/rooms/:id/approve-cleaning — :id is the room. The front desk
// (or a manager) passes a cleaned room when no inspector is around to, so a
// waiting guest can be checked in. Only once cleaning has finished.
const approveCleaning = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT id FROM cleaning_jobs WHERE room_unit_id = $1 AND status <> 'Ready'`, [id(req)]);
  if (rows.length === 0) throw new ApiError(409, 'This room has no cleaning waiting for approval');
  const job = await cleaning.approveJob(rows[0].id, req.actor);
  await emitJobUpdate(job.id, 'inspection_approved');
  res.json({ success: true });
});

// ----- Food orders: payment is taken at the counter and recorded here -----

// GET /api/desk/food-orders — today's orders (resort calendar), plus any from
// the last three days still unpaid. Unpaid first, then newest first.
// A room order is paid online or in cash at the room's door, never at the desk,
// so it is listed only once it has been paid (it counts towards the day's takings).
const foodOrders = asyncHandler(async (req, res) => {
  const { rows: orders } = await query(
    `SELECT id, order_type, table_number, room_number, customer_name, total_amount, status, created_at,
            paid_at, payment_method, payment_reference
     FROM food_orders
     WHERE status <> 'cancelled'
       AND NOT (order_type = 'room' AND paid_at IS NULL)
       AND ((created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date
            OR (paid_at IS NULL AND created_at > now() - interval '3 days'))
     ORDER BY (paid_at IS NULL) DESC, created_at DESC`,
    [TIMEZONE]
  );
  if (orders.length === 0) return res.json({ success: true, orders: [] });

  const { rows: items } = await query(
    `SELECT id, order_id, item_name, quantity, line_total FROM food_order_items WHERE order_id = ANY($1) ORDER BY id`,
    [orders.map((o) => o.id)]
  );
  return res.json({
    success: true,
    orders: orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) })),
  });
});

// POST /api/desk/food-orders/:id/pay — { method: cash | upi | card, reference? }
const payFoodOrder = asyncHandler(async (req, res) => {
  const { method, reference } = req.body;
  const { rows } = await query(
    // updated_at is left alone: the kitchen reads it as "when this became ready".
    `UPDATE food_orders
     SET paid_at = now(), payment_method = $2, payment_reference = $3, paid_by_staff_id = $4, paid_by_admin_id = $5
     WHERE id = $1 AND paid_at IS NULL AND status <> 'cancelled'
     RETURNING id, total_amount, paid_at, payment_method`,
    [id(req), method, reference || null, req.actor.type === 'staff' ? req.actor.id : null, req.actor.type === 'admin' ? req.actor.id : null]
  );
  if (rows.length === 0) {
    const { rows: existing } = await query(`SELECT status, paid_at FROM food_orders WHERE id = $1`, [id(req)]);
    if (existing.length === 0) throw new ApiError(404, 'Order not found');
    if (existing[0].status === 'cancelled') throw new ApiError(409, 'This order was cancelled; there is nothing to pay');
    throw new ApiError(409, 'This order is already marked paid');
  }
  logAction({
    actorType: req.actor.type,
    actorId: req.actor.id,
    action: 'food_order_paid',
    details: { orderId: rows[0].id, method, amount: Number(rows[0].total_amount), reference: reference || null },
  });
  emitFoodUpdate('order_paid', { orderId: rows[0].id });
  res.json({ success: true, order: rows[0] });
});

// POST /api/desk/food-orders/:id/unpay — { reason }. A payment recorded by
// mistake; only a manager can take it back, and says why.
const unpayFoodOrder = asyncHandler(async (req, res) => {
  if (req.actor.type !== 'admin') throw new ApiError(403, 'Only a manager can undo a payment');
  const { rows } = await query(
    `UPDATE food_orders
     SET paid_at = NULL, payment_method = NULL, payment_reference = NULL, paid_by_staff_id = NULL, paid_by_admin_id = NULL
     WHERE id = $1 AND paid_at IS NOT NULL AND gateway_payment_id IS NULL RETURNING id`,
    [id(req)]
  );
  if (rows.length === 0) {
    const { rows: existing } = await query(`SELECT gateway_payment_id FROM food_orders WHERE id = $1 AND paid_at IS NOT NULL`, [id(req)]);
    // Money that came through the payment gateway only goes back as a refund.
    if (existing[0]?.gateway_payment_id) throw new ApiError(409, 'This order was paid online. To give the money back, cancel the order: it is refunded automatically.');
    throw new ApiError(409, 'This order is not marked paid');
  }
  logAction({ actorType: 'admin', actorId: req.actor.id, action: 'food_order_payment_undone', details: { orderId: rows[0].id, reason: req.body.reason } });
  emitFoodUpdate('order_unpaid', { orderId: rows[0].id });
  res.json({ success: true });
});

module.exports = {
  foodOrders,
  payFoodOrder,
  unpayFoodOrder,
  rooms,
  approveCleaning,
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
