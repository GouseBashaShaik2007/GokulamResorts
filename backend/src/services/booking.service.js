/**
 * Booking state machine + money. The booking row is the source of truth;
 * payments, refunds, documents, cleaning jobs and messages hang off it.
 *
 *   online:  pending_payment --(Razorpay)--> paid --(manager)--> confirmed
 *   counter: confirmed (paid in full at the desk)
 *   stay:    confirmed --(ID + full payment)--> checked_in --> checked_out -> cleaning job
 *   exits:   cancelled / rejected (full refund of what was paid), no_show (no refund)
 *
 * Every change runs in a transaction that locks the booking row. Side effects
 * that leave the database (socket events, message delivery) run only after
 * commit. Razorpay refund calls happen inside the transaction on purpose: if
 * the gateway refuses, the whole change rolls back and nothing is half-done.
 */
const { query, withTransaction } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const { localToday, addDays } = require('../utils/dates');
const { quoteNights, totals, round2 } = require('./pricing.service');
const gateway = require('./gateway.service');
const notify = require('./notify.service');
const storage = require('./storage.service');
const { audit, SYSTEM } = require('./audit');

const BLOCKING = ['pending_payment', 'paid', 'confirmed', 'checked_in'];
const PAYMENT_WINDOW_MIN = Number(process.env.BOOKING_HOLD_MINUTES || 15);
const APPROVAL_HOURS = Number(process.env.BOOKING_APPROVAL_HOURS || 24);
const MAX_NIGHTS = 30;
const RETENTION_DAYS = Math.min(180, Math.max(1, Number(process.env.DOC_RETENTION_DAYS || 90)));

// Lazily required to avoid require cycles (realtime -> services -> realtime).
const realtime = () => require('../realtime');
const cleaning = () => require('./cleaning.service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Transaction whose `after(fn)` callbacks run once it has committed. */
async function tx(fn) {
  const effects = [];
  const result = await withTransaction((client) => fn(client, (effect) => effects.push(effect)));
  for (const effect of effects) {
    try {
      await effect();
    } catch (err) {
      console.error('[booking] post-commit effect failed:', err.message);
    }
  }
  return result;
}

const BOOKING_SELECT = `
  SELECT b.*, ru.unit_number, ru.floor, ru.view_label, ru.status AS room_status,
         r.name AS room_type, r.capacity,
         round(b.total_amount - b.amount_paid, 2) AS balance_due
  FROM bookings b
  JOIN room_units ru ON ru.id = b.room_unit_id
  JOIN rooms r ON r.id = b.room_type_id`;

async function lock(client, id) {
  const { rows } = await client.query(`${BOOKING_SELECT} WHERE b.id = $1 FOR UPDATE OF b`, [id]);
  if (rows.length === 0) throw new ApiError(404, 'Booking not found');
  return rows[0];
}

async function reload(client, id) {
  const { rows } = await client.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
  return rows[0];
}

function requireStatus(b, allowed, action) {
  if (!allowed.includes(b.status)) {
    throw new ApiError(409, `Can't ${action}: booking #${b.id} is ${b.status.replace('_', ' ')}`);
  }
}

const actorColumns = (actor) =>
  actor.type === 'staff' ? { staff: actor.id, admin: null } : { staff: null, admin: actor.type === 'admin' ? actor.id : null };

/**
 * Run a write that may hit the no-overlap constraint. On a clash, roll back to
 * a savepoint (the transaction stays usable) and throw a 409 naming the
 * conflicting stay.
 */
async function guardOverlap(client, write, { roomUnitId, checkIn, checkOut, excludeId }) {
  await client.query('SAVEPOINT overlap_guard');
  try {
    const result = await write();
    await client.query('RELEASE SAVEPOINT overlap_guard');
    return result;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT overlap_guard');
    if (err.code === '23P01') throw await overlapError(client, roomUnitId, checkIn, checkOut, excludeId);
    throw err;
  }
}

// Postgres exclusion violation -> friendly 409 naming the clashing dates.
async function overlapError(client, roomUnitId, checkIn, checkOut, excludeId) {
  const { rows } = await client.query(
    `SELECT b.check_in, b.check_out, ru.unit_number FROM bookings b JOIN room_units ru ON ru.id = b.room_unit_id
     WHERE b.room_unit_id = $1 AND b.id <> $4 AND b.status = ANY($5)
       AND daterange(b.check_in, b.check_out) && daterange($2::date, $3::date)
     ORDER BY b.check_in LIMIT 1`,
    [roomUnitId, checkIn, checkOut, excludeId || 0, BLOCKING]
  );
  const c = rows[0];
  return new ApiError(
    409,
    c ? `Room ${c.unit_number} is already booked ${c.check_in} to ${c.check_out}` : 'Room is not available for those dates'
  );
}

function validateDates(today, checkIn, checkOut) {
  if (checkIn < today) throw new ApiError(400, 'Check-in date cannot be in the past');
  if (checkOut <= checkIn) throw new ApiError(400, 'Check-out must be after check-in');
  const nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
  if (nights > MAX_NIGHTS) throw new ApiError(400, `Stays are limited to ${MAX_NIGHTS} nights online; contact the front desk`);
}

// Payment windows that ran out stop blocking the room immediately, even
// before the sweeper gets to them. No money was taken, so nothing to refund.
async function releaseExpiredPaymentHolds(client, roomUnitId = null) {
  const { rows } = await client.query(
    `UPDATE bookings
     SET status = 'cancelled', closed_at = now(), close_reason = 'Payment not completed in time',
         hold_expires_at = NULL, updated_at = now()
     WHERE status = 'pending_payment' AND hold_expires_at < now() AND ($1::int IS NULL OR room_unit_id = $1)
     RETURNING id`,
    [roomUnitId]
  );
  for (const r of rows) {
    await audit(client, { bookingId: r.id, actor: SYSTEM, action: 'payment_window_expired' });
  }
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Availability & quotes
// ---------------------------------------------------------------------------

/**
 * Rooms free for [checkIn, checkOut), grouped by room type with a price quote.
 * roomTypeId narrows to one type; guests filters by capacity.
 */
async function availability({ roomTypeId = null, checkIn, checkOut, guests = 1, allowPast = false }) {
  const today = await localToday();
  if (!allowPast) validateDates(today, checkIn, checkOut);
  else if (checkOut <= checkIn) throw new ApiError(400, 'Check-out must be after check-in');

  const { rows: units } = await query(
    `SELECT ru.id, ru.unit_number, ru.floor, ru.view_label, ru.status AS room_status,
            r.id AS room_type_id, r.name AS room_type, r.capacity, r.images, r.price_per_night
     FROM room_units ru JOIN rooms r ON r.id = ru.room_type_id
     WHERE ru.is_active AND r.is_active AND r.capacity >= $3
       AND ($4::int IS NULL OR r.id = $4)
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.room_unit_id = ru.id AND b.status = ANY($5)
           AND NOT (b.status = 'pending_payment' AND b.hold_expires_at < now())
           AND daterange(b.check_in, b.check_out) && daterange($1::date, $2::date)
       )
     ORDER BY r.price_per_night, ru.unit_number`,
    [checkIn, checkOut, guests, roomTypeId, BLOCKING]
  );

  const byType = new Map();
  for (const u of units) {
    if (!byType.has(u.room_type_id)) {
      const quote = await quoteNights({ query }, u.room_type_id, checkIn, checkOut);
      byType.set(u.room_type_id, {
        roomType: { id: u.room_type_id, name: u.room_type, capacity: u.capacity, image: u.images?.[0] || null },
        quote: { ...quote, total: round2(quote.base - quote.promo) },
        units: [],
      });
    }
    byType.get(u.room_type_id).units.push({
      id: u.id,
      unitNumber: u.unit_number,
      floor: u.floor,
      view: u.view_label,
      roomStatus: u.room_status,
    });
  }
  return [...byType.values()];
}

// ---------------------------------------------------------------------------
// Creating bookings
// ---------------------------------------------------------------------------

/**
 * source 'online': status pending_payment, room held for the payment window.
 * source 'counter': status confirmed, paid in full now (payment = {method, reference}).
 */
async function createBooking(input, { source, actor, payment = null }) {
  const { roomUnitId, checkIn, checkOut, adults, children = 0, name, phone, email, specialRequests } = input;

  return tx(async (client, after) => {
    const { rows: units } = await client.query(
      `SELECT ru.id, ru.unit_number, ru.is_active, ru.room_type_id, r.capacity, r.is_active AS type_active
       FROM room_units ru JOIN rooms r ON r.id = ru.room_type_id WHERE ru.id = $1 FOR UPDATE OF ru`,
      [roomUnitId]
    );
    const unit = units[0];
    if (!unit || !unit.is_active || !unit.type_active) throw new ApiError(404, 'Room not found');
    if (adults + children > unit.capacity) {
      throw new ApiError(400, `Room ${unit.unit_number} fits up to ${unit.capacity} guests`);
    }

    const today = await localToday(client);
    validateDates(today, checkIn, checkOut);
    await releaseExpiredPaymentHolds(client, unit.id);

    const quote = await quoteNights(client, unit.room_type_id, checkIn, checkOut);
    const { total } = totals({ base: quote.base, promo: quote.promo });
    const creator = actorColumns(actor);
    const online = source === 'online';

    const { rows } = await guardOverlap(
      client,
      () =>
        client.query(
          `INSERT INTO bookings
             (room_unit_id, room_type_id, source, guest_name, guest_phone, guest_email, adults, children,
              check_in, check_out, original_check_out, special_requests, status,
              nightly_rate, base_amount, promo_discount, promo_details, total_amount,
              hold_expires_at, confirmed_at, created_by_staff_id, created_by_admin_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13,$14,$15,$16,$17,
                   now() + make_interval(mins => $18::int),         -- NULL for counter bookings
                   CASE WHEN $18::int IS NULL THEN now() END, $19, $20)
           RETURNING id`,
          [
            unit.id, unit.room_type_id, source, name, phone, email || null, adults, children,
            checkIn, checkOut, specialRequests || null, online ? 'pending_payment' : 'confirmed',
            quote.nightlyRate, quote.base, quote.promo, JSON.stringify(quote.promoDetails), total,
            online ? PAYMENT_WINDOW_MIN : null, creator.staff, creator.admin,
          ]
        ),
      { roomUnitId: unit.id, checkIn, checkOut }
    );
    const booking = rows[0];

    await audit(client, {
      bookingId: booking.id,
      actor,
      action: 'booking_created',
      details: { source, roomUnit: unit.unit_number, checkIn, checkOut, total, promo: quote.promo },
    });

    if (!online) {
      if (total > 0) await insertCounterPayment(client, booking.id, total, payment, actor);
      await client.query(`UPDATE bookings SET paid_at = now() WHERE id = $1`, [booking.id]);
      const full = await reload(client, booking.id);
      await notify.enqueue(client, full, 'booking_confirmed');
      after(notify.flush);
    }
    after(() => realtime().emitBookingUpdate(booking.id, 'booking_created'));
    return reload(client, booking.id);
  });
}

async function insertCounterPayment(client, bookingId, amount, payment, actor) {
  if (!payment?.method || !payment?.reference) throw new ApiError(400, 'Payment method and reference are required');
  const by = actorColumns(actor);
  const { rows } = await client.query(
    `INSERT INTO payments (booking_id, method, amount, status, reference, recorded_by_staff_id, recorded_by_admin_id, captured_at)
     VALUES ($1, $2, $3, 'captured', $4, $5, $6, now()) RETURNING id`,
    [bookingId, payment.method, amount, payment.reference, by.staff, by.admin]
  );
  await client.query(`UPDATE bookings SET amount_paid = amount_paid + $1, updated_at = now() WHERE id = $2`, [
    amount,
    bookingId,
  ]);
  await audit(client, {
    bookingId,
    actor,
    action: 'payment_recorded',
    details: { paymentId: rows[0].id, method: payment.method, reference: payment.reference, amount },
  });
}

/** Front desk takes money for a balance due (e.g. after an extension). */
async function recordPayment(bookingId, { amount, method, reference }, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['confirmed', 'checked_in'], 'record a payment');
    const due = Number(b.balance_due);
    if (due <= 0) throw new ApiError(409, 'Nothing is due on this booking');
    if (amount > due) throw new ApiError(400, `Only ₹${due} is due`);
    await insertCounterPayment(client, b.id, round2(amount), { method, reference }, actor);
    after(() => realtime().emitBookingUpdate(b.id, 'payment_recorded'));
    return reload(client, b.id);
  });
}

// ---------------------------------------------------------------------------
// Online payment (Razorpay)
// ---------------------------------------------------------------------------

const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-10);

async function createOnlineOrder(bookingId, phone) {
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [bookingId]);
  const b = rows[0];
  if (!b || phoneKey(b.guest_phone) !== phoneKey(phone)) throw new ApiError(404, 'Booking not found');
  if (b.status !== 'pending_payment') throw new ApiError(409, `Booking is already ${b.status.replace('_', ' ')}`);
  if (new Date(b.hold_expires_at) < new Date()) {
    await tx((client) => releaseExpiredPaymentHolds(client, b.room_unit_id));
    throw new ApiError(410, 'The payment window for this booking has expired. Please book again.');
  }

  const order = await gateway.createOrder({
    amount: b.total_amount,
    receipt: `booking_${b.id}`,
    notes: { bookingId: String(b.id) },
  });
  await query(
    `INSERT INTO payments (booking_id, method, amount, status, razorpay_order_id) VALUES ($1, 'razorpay', $2, 'created', $3)`,
    [b.id, b.total_amount, order.id]
  );
  return { orderId: order.id, amount: order.amount, currency: 'INR', keyId: gateway.publicKeyId(), mock: gateway.isMock() };
}

/**
 * A Razorpay payment was captured (checkout callback with a verified
 * signature, or the payment.captured webhook). Idempotent per order.
 * If the booking already expired meanwhile, the money goes straight back.
 */
async function markOnlinePaid({ orderId, paymentId, signature = null, via }) {
  return tx(async (client, after) => {
    const { rows } = await client.query(`SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`, [orderId]);
    const p = rows[0];
    if (!p) throw new ApiError(404, 'Unknown payment order');
    const b = await lock(client, p.booking_id);
    if (p.status === 'captured') return b;

    await client.query(
      `UPDATE payments SET status = 'captured', razorpay_payment_id = $1, razorpay_signature = $2,
              captured_at = now(), updated_at = now() WHERE id = $3`,
      [paymentId, signature, p.id]
    );
    await client.query(`UPDATE bookings SET amount_paid = amount_paid + $1, updated_at = now() WHERE id = $2`, [
      p.amount,
      b.id,
    ]);
    await audit(client, {
      bookingId: b.id,
      actor: { type: 'guest' },
      action: 'payment_captured',
      details: { paymentId: p.id, razorpayPaymentId: paymentId, amount: Number(p.amount), via },
    });

    if (b.status === 'pending_payment') {
      await client.query(
        `UPDATE bookings SET status = 'paid', paid_at = now(),
                hold_expires_at = now() + make_interval(hours => $1::int), updated_at = now() WHERE id = $2`,
        [APPROVAL_HOURS, b.id]
      );
      await notify.enqueue(client, await reload(client, b.id), 'booking_received');
      after(() => realtime().emitBookingUpdate(b.id, 'booking_paid'));
    } else {
      // Paid after the hold lapsed (or booking was closed) — give it back.
      const refund = await refundAmount(client, b.id, Number(p.amount), 'Payment received after the booking had expired', SYSTEM);
      await notify.enqueue(client, await reload(client, b.id), 'booking_expired', refund);
      after(() => realtime().emitBookingUpdate(b.id, 'late_payment_refunded'));
    }
    after(notify.flush);
    return reload(client, b.id);
  });
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/**
 * Refund `amount` of what the booking holds. Razorpay payments are refunded
 * first (automatically, through the gateway); anything left is owed back on a
 * counter payment and recorded as a pending refund for the desk to pay out.
 * Returns { refund, offline } — totals in ₹.
 */
async function refundAmount(client, bookingId, amount, reason, actor) {
  amount = round2(amount);
  if (amount <= 0) return { refund: 0, offline: 0 };

  const { rows: payments } = await client.query(
    `SELECT p.*, p.amount - COALESCE((SELECT sum(r.amount) FROM refunds r
                                      WHERE r.payment_id = p.id AND r.status <> 'failed'), 0) AS refundable
     FROM payments p WHERE p.booking_id = $1 AND p.status = 'captured'
     ORDER BY (p.method = 'razorpay') DESC, p.id DESC`,
    [bookingId]
  );

  let remaining = amount;
  let offline = 0;
  const adminId = actor.type === 'admin' ? actor.id : null;
  for (const p of payments) {
    const take = round2(Math.min(Number(p.refundable), remaining));
    if (take <= 0) continue;

    if (p.method === 'razorpay') {
      const r = await gateway.refundPayment(p.razorpay_payment_id, take, { bookingId: String(bookingId) });
      await client.query(
        `INSERT INTO refunds (booking_id, payment_id, amount, reason, method, status, razorpay_refund_id,
                              initiated_by_admin_id, processed_at)
         VALUES ($1, $2, $3, $4, 'razorpay', $5, $6, $7, CASE WHEN $8::boolean THEN now() END)`,
        [bookingId, p.id, take, reason, r.status, r.id, adminId, r.status === 'processed']
      );
    } else {
      await client.query(
        `INSERT INTO refunds (booking_id, payment_id, amount, reason, method, status, initiated_by_admin_id)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
        [bookingId, p.id, take, reason, p.method, adminId]
      );
      offline = round2(offline + take);
    }
    remaining = round2(remaining - take);
    if (remaining <= 0) break;
  }
  if (remaining > 0) throw new ApiError(500, `Could not allocate refund of ₹${remaining}`);

  await client.query(`UPDATE bookings SET amount_paid = amount_paid - $1, updated_at = now() WHERE id = $2`, [
    amount,
    bookingId,
  ]);
  await audit(client, { bookingId, actor, action: 'refund_initiated', details: { amount, offline, reason } });
  return { refund: amount, offline };
}

/** Desk hands a pending counter refund back to the guest. */
async function completeManualRefund(refundId, { method, reference }, actor) {
  return tx(async (client, after) => {
    const { rows } = await client.query(`SELECT * FROM refunds WHERE id = $1 FOR UPDATE`, [refundId]);
    const r = rows[0];
    if (!r) throw new ApiError(404, 'Refund not found');
    if (r.method === 'razorpay' || r.status !== 'pending') throw new ApiError(409, 'This refund is not waiting for a counter payout');
    const by = actorColumns(actor);
    await client.query(
      `UPDATE refunds SET status = 'processed', method = $1, reference = $2, completed_by_staff_id = $3,
              completed_by_admin_id = $4, processed_at = now(), updated_at = now() WHERE id = $5`,
      [method, reference, by.staff, by.admin, r.id]
    );
    await audit(client, { bookingId: r.booking_id, actor, action: 'refund_paid_out', details: { refundId: r.id, method, reference, amount: Number(r.amount) } });
    after(() => realtime().emitBookingUpdate(r.booking_id, 'refund_paid_out'));
    return r.booking_id;
  });
}

/** Razorpay refund webhooks. Failed refunds put the money back on the booking. */
async function applyRefundWebhook(razorpayRefundId, outcome) {
  return tx(async (client, after) => {
    const { rows } = await client.query(`SELECT * FROM refunds WHERE razorpay_refund_id = $1 FOR UPDATE`, [razorpayRefundId]);
    const r = rows[0];
    if (!r || r.status === outcome) return;
    if (outcome === 'processed') {
      await client.query(`UPDATE refunds SET status = 'processed', processed_at = now(), updated_at = now() WHERE id = $1`, [r.id]);
    } else {
      await client.query(`UPDATE refunds SET status = 'failed', updated_at = now() WHERE id = $1`, [r.id]);
      await client.query(`UPDATE bookings SET amount_paid = amount_paid + $1, updated_at = now() WHERE id = $2`, [r.amount, r.booking_id]);
    }
    await audit(client, { bookingId: r.booking_id, actor: SYSTEM, action: `refund_${outcome}`, details: { refundId: r.id, amount: Number(r.amount) } });
    after(() => realtime().emitBookingUpdate(r.booking_id, `refund_${outcome}`));
  });
}

// ---------------------------------------------------------------------------
// Manager decisions
// ---------------------------------------------------------------------------

async function approve(bookingId, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['paid'], 'approve');
    await client.query(
      `UPDATE bookings SET status = 'confirmed', confirmed_at = now(), hold_expires_at = NULL, updated_at = now() WHERE id = $1`,
      [b.id]
    );
    await audit(client, { bookingId: b.id, actor, action: 'booking_approved' });
    await notify.enqueue(client, await reload(client, b.id), 'booking_confirmed');
    after(notify.flush);
    after(() => realtime().emitBookingUpdate(b.id, 'booking_approved'));
    return reload(client, b.id);
  });
}

// Close a booking and give back everything paid.
async function closeWithRefund(client, b, { status, reason, actor, template, action }) {
  await client.query(
    `UPDATE bookings SET status = $1, closed_at = now(), close_reason = $2, hold_expires_at = NULL, updated_at = now()
     WHERE id = $3`,
    [status, reason, b.id]
  );
  const refund = await refundAmount(client, b.id, Number(b.amount_paid), `Booking ${status}: ${reason}`, actor);
  await audit(client, { bookingId: b.id, actor, action, details: { reason, refund: refund.refund } });
  await notify.enqueue(client, await reload(client, b.id), template, refund);
  return refund;
}

async function reject(bookingId, reason, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['paid'], 'reject');
    await closeWithRefund(client, b, { status: 'rejected', reason, actor, template: 'booking_rejected', action: 'booking_rejected' });
    after(notify.flush);
    after(() => realtime().emitBookingUpdate(b.id, 'booking_rejected'));
    return reload(client, b.id);
  });
}

async function cancel(bookingId, reason, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['pending_payment', 'paid', 'confirmed'], 'cancel');
    await closeWithRefund(client, b, { status: 'cancelled', reason, actor, template: 'booking_cancelled', action: 'booking_cancelled' });
    after(notify.flush);
    after(() => realtime().emitBookingUpdate(b.id, 'booking_cancelled'));
    return reload(client, b.id);
  });
}

/**
 * Manager discount on one booking: percent or fixed ₹, with a reason.
 * Replaces any previous manual discount (value 0 removes it). If the guest
 * has already paid more than the new total, the difference is refunded.
 */
async function applyDiscount(bookingId, { type, value, reason }, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['paid', 'confirmed', 'checked_in'], 'discount');
    const clearing = !value;
    const t = totals({
      base: Number(b.base_amount),
      promo: Number(b.promo_discount),
      manualType: clearing ? null : type,
      manualValue: clearing ? null : value,
    });

    await client.query(
      `UPDATE bookings SET manual_discount_type = $1, manual_discount_value = $2, manual_discount_amount = $3,
              manual_discount_reason = $4, manual_discount_by = $5, total_amount = $6, updated_at = now()
       WHERE id = $7`,
      [clearing ? null : type, clearing ? null : value, t.manual, reason, actor.id, t.total, b.id]
    );

    const overpaid = round2(Number(b.amount_paid) - t.total);
    const refund = overpaid > 0 ? await refundAmount(client, b.id, overpaid, `Discount: ${reason}`, actor) : { refund: 0 };
    await audit(client, {
      bookingId: b.id,
      actor,
      action: clearing ? 'discount_removed' : 'discount_applied',
      details: { type, value, reason, oldTotal: Number(b.total_amount), newTotal: t.total, refund: refund.refund },
    });
    if (refund.refund > 0) {
      await notify.enqueue(client, await reload(client, b.id), 'refund_issued', { ...refund, reason: 'discount applied' });
      after(notify.flush);
    }
    after(() => realtime().emitBookingUpdate(b.id, 'discount_applied'));
    return reload(client, b.id);
  });
}

// ---------------------------------------------------------------------------
// Stay operations (front desk or manager)
// ---------------------------------------------------------------------------

/** Extra nights are priced with today's rates/promotions and become a balance due. */
async function extendStay(bookingId, newCheckOut, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['confirmed', 'checked_in'], 'extend');
    if (newCheckOut <= b.check_out) throw new ApiError(400, `New check-out must be after ${b.check_out}`);

    const extra = await quoteNights(client, b.room_type_id, b.check_out, newCheckOut);
    const base = round2(Number(b.base_amount) + extra.base);
    const promo = round2(Number(b.promo_discount) + extra.promo);
    const t = totals({ base, promo, manualType: b.manual_discount_type, manualValue: b.manual_discount_value });

    await guardOverlap(
      client,
      () =>
        client.query(
          `UPDATE bookings SET check_out = $1, base_amount = $2, promo_discount = $3,
                  promo_details = promo_details || $4::jsonb, manual_discount_amount = $5, total_amount = $6, updated_at = now()
           WHERE id = $7`,
          [newCheckOut, base, promo, JSON.stringify(extra.promoDetails), t.manual, t.total, b.id]
        ),
      { roomUnitId: b.room_unit_id, checkIn: b.check_out, checkOut: newCheckOut, excludeId: b.id }
    );

    const updated = await reload(client, b.id);
    await audit(client, {
      bookingId: b.id,
      actor,
      action: 'stay_extended',
      details: { from: b.check_out, to: newCheckOut, nights: extra.nights, added: round2(t.total - Number(b.total_amount)) },
    });
    await notify.enqueue(client, updated, 'stay_extended', { balance: Number(updated.balance_due) });
    after(notify.flush);
    after(() => realtime().emitBookingUpdate(b.id, 'stay_extended'));
    return updated;
  });
}

async function checkIn(bookingId, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['confirmed'], 'check in');
    const today = await localToday(client);
    if (today < b.check_in) throw new ApiError(409, `Check-in opens on ${b.check_in}`);
    if (today >= b.check_out) throw new ApiError(409, `This stay ended on ${b.check_out}`);
    if (Number(b.balance_due) > 0) throw new ApiError(409, `Collect the balance of ₹${b.balance_due} before check-in`);

    const { rows: docs } = await client.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE is_primary)::int AS primary_count
       FROM guest_documents WHERE booking_id = $1 AND purged_at IS NULL`,
      [b.id]
    );
    if (docs[0].primary_count === 0) throw new ApiError(409, "Upload and verify the primary guest's ID first");
    if (b.room_status !== 'Ready') {
      throw new ApiError(409, `Room ${b.unit_number} is not ready yet (housekeeping: ${b.room_status})`);
    }

    await client.query(`UPDATE bookings SET status = 'checked_in', checked_in_at = now(), updated_at = now() WHERE id = $1`, [b.id]);
    await audit(client, { bookingId: b.id, actor, action: 'checked_in', details: { idsRecorded: docs[0].total, adults: b.adults } });
    after(() => realtime().emitBookingUpdate(b.id, 'checked_in'));
    const updated = await reload(client, b.id);
    return {
      booking: updated,
      warnings: docs[0].total < b.adults ? [`ID recorded for ${docs[0].total} of ${b.adults} adults`] : [],
    };
  });
}

/** Check-out (early allowed). Frees the remaining nights and starts cleaning. */
async function checkOut(bookingId, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['checked_in'], 'check out');
    if (Number(b.balance_due) > 0) throw new ApiError(409, `Collect the balance of ₹${b.balance_due} before check-out`);

    const today = await localToday(client);
    const early = today < b.check_out;
    // Early departure releases the unused nights (no automatic refund — a
    // manager can apply a discount if the hotel chooses to give money back).
    const newCheckOut = early ? [today, addDays(b.check_in, 1)].sort().pop() : b.check_out;

    await client.query(
      `UPDATE bookings SET status = 'checked_out', checked_out_at = now(), check_out = $1, updated_at = now() WHERE id = $2`,
      [newCheckOut, b.id]
    );
    await audit(client, { bookingId: b.id, actor, action: 'checked_out', details: { early, originalCheckOut: b.check_out, checkOut: newCheckOut } });

    const { job } = await cleaning().createCheckoutJob(client, { id: b.id, room_unit_id: b.room_unit_id }, 'checkout');
    await notify.enqueue(client, await reload(client, b.id), 'checked_out');
    after(notify.flush);
    after(() => realtime().emitBookingUpdate(b.id, 'checked_out'));
    if (job) after(() => realtime().emitJobUpdate(job.id, 'job_created'));
    return { booking: await reload(client, b.id), cleaningJobId: job?.id || null };
  });
}

async function markNoShow(bookingId, actor) {
  return tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['confirmed'], 'mark as no-show');
    const today = await localToday(client);
    if (today < b.check_in) throw new ApiError(409, `The guest isn't due until ${b.check_in}`);
    await client.query(
      `UPDATE bookings SET status = 'no_show', closed_at = now(), close_reason = 'Guest did not arrive', updated_at = now() WHERE id = $1`,
      [b.id]
    );
    await audit(client, { bookingId: b.id, actor, action: 'no_show', details: { kept: Number(b.amount_paid) } });
    after(() => realtime().emitBookingUpdate(b.id, 'no_show'));
    return reload(client, b.id);
  });
}

// ---------------------------------------------------------------------------
// ID documents
// ---------------------------------------------------------------------------

async function addDocument(bookingId, meta, file, actor) {
  const { rows } = await query(`SELECT id, status FROM bookings WHERE id = $1`, [bookingId]);
  if (!rows[0]) throw new ApiError(404, 'Booking not found');
  requireStatus(rows[0], ['confirmed', 'checked_in'], 'add ID documents');
  if (meta.idType === 'Aadhaar' && !meta.maskedConfirmed) {
    throw new ApiError(400, 'Aadhaar copies must be masked — only the last 4 digits may be visible');
  }

  const key = storage.newKey(bookingId, file.mimetype);
  await storage.put(key, file.buffer, file.mimetype);
  try {
    return await tx(async (client, after) => {
      const by = actorColumns(actor);
      const { rows: inserted } = await client.query(
        `INSERT INTO guest_documents (booking_id, guest_name, is_primary, id_type, id_last4, nationality, storage_key,
                                      content_type, size_bytes, masked_confirmed, verified_by_staff_id, verified_by_admin_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, guest_name, is_primary, id_type, id_last4, nationality, verified_at`,
        [
          bookingId, meta.guestName, meta.isPrimary, meta.idType, meta.idLast4, meta.nationality || 'Indian', key,
          file.mimetype, file.size, !!meta.maskedConfirmed, by.staff, by.admin,
        ]
      );
      await audit(client, {
        bookingId,
        actor,
        action: 'id_verified',
        details: { documentId: inserted[0].id, guest: meta.guestName, idType: meta.idType, primary: meta.isPrimary },
      });
      after(() => realtime().emitBookingUpdate(bookingId, 'id_verified'));
      return inserted[0];
    });
  } catch (err) {
    await storage.remove(key).catch(() => {});
    if (err.code === '23505') throw new ApiError(409, 'This booking already has a primary guest ID');
    throw err;
  }
}

// Fix a mistake before check-in. After check-in, records stay until purged.
async function removeDocument(bookingId, documentId, actor) {
  const key = await tx(async (client, after) => {
    const b = await lock(client, bookingId);
    requireStatus(b, ['confirmed'], 'remove ID documents');
    const { rows } = await client.query(
      `DELETE FROM guest_documents WHERE id = $1 AND booking_id = $2 RETURNING storage_key, guest_name`,
      [documentId, bookingId]
    );
    if (!rows[0]) throw new ApiError(404, 'Document not found');
    await audit(client, { bookingId, actor, action: 'id_removed', details: { documentId, guest: rows[0].guest_name } });
    after(() => realtime().emitBookingUpdate(bookingId, 'id_removed'));
    return rows[0].storage_key;
  });
  if (key) await storage.remove(key).catch((e) => console.error('[storage] remove failed:', e.message));
}

async function documentViewUrl(documentId, actor, apiBaseUrl) {
  const { rows } = await query(`SELECT * FROM guest_documents WHERE id = $1`, [documentId]);
  const d = rows[0];
  if (!d) throw new ApiError(404, 'Document not found');
  if (!d.storage_key) throw new ApiError(410, `This document was deleted on ${d.purged_at.toISOString().slice(0, 10)} (retention policy)`);
  await tx((client) => audit(client, { bookingId: d.booking_id, actor, action: 'id_viewed', details: { documentId } }));
  return storage.viewUrl(d.storage_key, d.content_type, apiBaseUrl);
}

/** Delete ID files RETENTION_DAYS after the stay closed. Metadata is kept. */
async function purgeExpiredDocuments() {
  const { rows } = await query(
    `SELECT d.id, d.booking_id, d.storage_key FROM guest_documents d JOIN bookings b ON b.id = d.booking_id
     WHERE d.storage_key IS NOT NULL
       AND COALESCE(b.checked_out_at, b.closed_at) < now() - make_interval(days => $1::int)`,
    [RETENTION_DAYS]
  );
  for (const d of rows) {
    try {
      await storage.remove(d.storage_key);
      await query(`UPDATE guest_documents SET storage_key = NULL, purged_at = now() WHERE id = $1`, [d.id]);
      await query(
        `INSERT INTO audit_log (booking_id, actor_type, action, details) VALUES ($1, 'system', 'id_purged', $2)`,
        [d.booking_id, { documentId: d.id, retentionDays: RETENTION_DAYS }]
      );
    } catch (err) {
      console.error(`[documents] purge of #${d.id} failed:`, err.message);
    }
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Sweeper (every few minutes)
// ---------------------------------------------------------------------------

async function expireHolds() {
  const expiredPayments = await tx((client) => releaseExpiredPaymentHolds(client));
  for (const id of expiredPayments) realtime().emitBookingUpdate(id, 'payment_window_expired');

  const { rows } = await query(`SELECT id FROM bookings WHERE status = 'paid' AND hold_expires_at < now()`);
  let expiredApprovals = 0;
  for (const { id } of rows) {
    try {
      await tx(async (client, after) => {
        const b = await lock(client, id);
        if (b.status !== 'paid' || new Date(b.hold_expires_at) >= new Date()) return;
        await closeWithRefund(client, b, {
          status: 'cancelled',
          reason: `Not confirmed within ${APPROVAL_HOURS} hours`,
          actor: SYSTEM,
          template: 'booking_expired',
          action: 'approval_window_expired',
        });
        after(notify.flush);
        after(() => realtime().emitBookingUpdate(b.id, 'approval_window_expired'));
        expiredApprovals += 1;
      });
    } catch (err) {
      console.error(`[bookings] could not expire #${id}:`, err.message); // retried next run
    }
  }
  return { expiredPayments: expiredPayments.length, expiredApprovals };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Guest status page: booking id + phone. Only guest-safe fields. */
async function lookupForGuest(bookingId, phone) {
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [bookingId]);
  const b = rows[0];
  if (!b || phoneKey(b.guest_phone) !== phoneKey(phone)) throw new ApiError(404, 'No booking matches that ID and phone number');
  const { rows: refunds } = await query(
    `SELECT amount, method, status, created_at FROM refunds WHERE booking_id = $1 ORDER BY id`,
    [b.id]
  );
  return {
    id: b.id,
    status: b.status,
    guestName: b.guest_name,
    room: { unitNumber: b.unit_number, type: b.room_type, view: b.view_label, floor: b.floor },
    checkIn: b.check_in,
    checkOut: b.check_out,
    adults: b.adults,
    children: b.children,
    total: Number(b.total_amount),
    paid: Number(b.amount_paid),
    balanceDue: Number(b.balance_due),
    holdExpiresAt: b.hold_expires_at,
    closeReason: ['cancelled', 'rejected'].includes(b.status) ? b.close_reason : null,
    refunds: refunds.map((r) => ({ amount: Number(r.amount), method: r.method, status: r.status, date: r.created_at })),
  };
}

/** Full record for staff. Document files are never included — only metadata. */
async function detail(bookingId) {
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [bookingId]);
  const b = rows[0];
  if (!b) throw new ApiError(404, 'Booking not found');
  const [payments, refunds, documents, events, messages, jobs] = await Promise.all([
    query(
      `SELECT p.id, p.method, p.amount, p.status, p.reference, p.razorpay_payment_id, p.captured_at, p.created_at,
              COALESCE(s.name, a.name) AS recorded_by
       FROM payments p LEFT JOIN staff s ON s.id = p.recorded_by_staff_id LEFT JOIN admins a ON a.id = p.recorded_by_admin_id
       WHERE p.booking_id = $1 AND p.status <> 'created' ORDER BY p.id`,
      [b.id]
    ),
    query(`SELECT id, amount, reason, method, status, reference, processed_at, created_at FROM refunds WHERE booking_id = $1 ORDER BY id`, [b.id]),
    query(
      `SELECT d.id, d.guest_name, d.is_primary, d.id_type, d.id_last4, d.nationality, d.content_type, d.verified_at,
              d.purged_at, COALESCE(s.name, a.name) AS verified_by
       FROM guest_documents d LEFT JOIN staff s ON s.id = d.verified_by_staff_id LEFT JOIN admins a ON a.id = d.verified_by_admin_id
       WHERE d.booking_id = $1 ORDER BY d.is_primary DESC, d.id`,
      [b.id]
    ),
    query(
      `SELECT l.id, l.actor_type, l.action, l.details, l.created_at,
              CASE l.actor_type WHEN 'staff' THEN s.name WHEN 'admin' THEN a.name WHEN 'system' THEN 'System' ELSE 'Guest' END AS actor_name
       FROM audit_log l LEFT JOIN staff s ON l.actor_type = 'staff' AND s.id = l.actor_id
                        LEFT JOIN admins a ON l.actor_type = 'admin' AND a.id = l.actor_id
       WHERE l.booking_id = $1 ORDER BY l.id`,
      [b.id]
    ),
    query(`SELECT channel, template, status, created_at FROM notifications WHERE booking_id = $1 ORDER BY id`, [b.id]),
    query(`SELECT id, status, created_at, ready_at FROM cleaning_jobs WHERE booking_id = $1`, [b.id]),
  ]);
  return {
    ...b,
    payments: payments.rows,
    refunds: refunds.rows,
    documents: documents.rows,
    events: events.rows,
    notifications: messages.rows,
    cleaningJob: jobs.rows[0] || null,
  };
}

/** Staff search/list. status: comma list; q: booking id, name or phone. */
async function list({ status, q, from, to, limit = 100 }) {
  const params = [];
  const where = [];
  if (status) {
    params.push(status.split(','));
    where.push(`b.status = ANY($${params.length})`);
  }
  if (q) {
    const digits = q.replace(/\D/g, '');
    params.push(`%${q.trim()}%`);
    const nameParam = params.length;
    const clauses = [`b.guest_name ILIKE $${nameParam}`];
    if (digits) {
      params.push(`%${digits}%`);
      clauses.push(`regexp_replace(b.guest_phone, '\\D', '', 'g') LIKE $${params.length}`);
      if (/^\d+$/.test(q.trim().replace(/^#/, ''))) {
        params.push(Number(q.trim().replace(/^#/, '')));
        clauses.push(`b.id = $${params.length}`);
      }
    }
    where.push(`(${clauses.join(' OR ')})`);
  }
  if (from) {
    params.push(from);
    where.push(`b.check_out > $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`b.check_in <= $${params.length}`);
  }
  params.push(Math.min(Number(limit) || 100, 500));
  const { rows } = await query(
    `${BOOKING_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY b.created_at DESC LIMIT $${params.length}`,
    params
  );
  return rows;
}

/** Front desk's day at a glance. */
async function deskOverview() {
  const today = await localToday();
  const { rows } = await query(
    `${BOOKING_SELECT}
     WHERE (b.status = 'confirmed' AND b.check_in <= $1)
        OR b.status = 'checked_in'
        OR b.status = 'paid'
     ORDER BY b.check_in, ru.unit_number`,
    [today]
  );
  const { rows: pendingRefunds } = await query(
    `SELECT r.*, b.guest_name, ru.unit_number FROM refunds r
     JOIN bookings b ON b.id = r.booking_id JOIN room_units ru ON ru.id = b.room_unit_id
     WHERE r.status = 'pending' AND r.method <> 'razorpay' ORDER BY r.id`
  );
  return {
    today,
    arrivals: rows.filter((b) => b.status === 'confirmed'),
    inHouse: rows.filter((b) => b.status === 'checked_in'),
    departures: rows.filter((b) => b.status === 'checked_in' && b.check_out <= today),
    awaitingApproval: rows.filter((b) => b.status === 'paid'),
    pendingRefunds,
  };
}

module.exports = {
  BLOCKING,
  RETENTION_DAYS,
  availability,
  createBooking,
  recordPayment,
  createOnlineOrder,
  markOnlinePaid,
  completeManualRefund,
  applyRefundWebhook,
  approve,
  reject,
  cancel,
  applyDiscount,
  extendStay,
  checkIn,
  checkOut,
  markNoShow,
  addDocument,
  removeDocument,
  documentViewUrl,
  purgeExpiredDocuments,
  expireHolds,
  lookupForGuest,
  detail,
  list,
  deskOverview,
};
