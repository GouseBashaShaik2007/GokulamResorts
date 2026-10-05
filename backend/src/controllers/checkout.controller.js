// Food orders that are paid online BEFORE they exist:
//
//   - the restaurant's kiosk (a tablet on a stand; every order is paid on its
//     screen, after the customer has said what to do with it: bring it to
//     their table, keep it for pickup, or bring it to their hotel room)
//   - an order from a table's QR code
//   - an order from a hotel room's QR code
//
// (Only the counter's QR code still takes an order that is paid afterwards,
// at the counter: foodOrder.controller.js.)
//
// Nothing reaches the kitchen until the payment has arrived, so the steps are:
//
//   1. POST /checkouts                the basket is priced and a payment is opened
//   2. the customer pays (payment gateway)
//   3. POST /checkouts/:token/confirm the payment is checked, and only now a
//                                     food order exists — already paid
//
// A payment can also arrive behind the screen's back (the customer approves it
// on their phone after the screen has moved on, or the connection drops). The
// gateway's webhook and a clean-up job (sweepStaleCheckouts) cover that: the
// money is never kept without an order.
//
// (The table is called kiosk_checkouts after its first use.)
const crypto = require('crypto');
const db = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const access = require('../utils/orderAccess');
const gateway = require('../services/gateway.service');
const foodOrders = require('../services/foodOrders.service');
const notify = require('../services/notify.service');
const { logAction } = require('../utils/auditLog');
const { emitFoodUpdate } = require('../realtime');

const NOT_A_KIOSK = 'This screen has not been set up as the ordering kiosk. Please ask our staff.';
const SCAN_ROOM_CODE = 'Please scan the QR code in your room to order.';
const SCAN_TABLE_CODE = 'Please scan the QR code on your table to order.';
// What a kiosk customer can ask for: the order brought to their table, kept
// at the counter until their number is called, or brought to their hotel room.
const SERVICE_MODES = ['dine_in', 'pickup', 'room'];
// The payment window closes itself after this long (the screen passes it to
// the payment gateway).
const PAY_SECONDS = 5 * 60;
// After this long a basket nobody paid for is closed for good.
const STALE_MINUTES = 20;

const paise = (inr) => Math.round(Number(inr) * 100);

// With the placed order's private link, once there is one.
const findByToken = async (token) =>
  (
    await db.query(
      `SELECT c.*, o.public_token AS order_token
       FROM kiosk_checkouts c LEFT JOIN food_orders o ON o.id = c.food_order_id
       WHERE c.token = $1`,
      [token]
    )
  ).rows[0];

const publicState = (c) => ({
  status: c.status,
  total: Number(c.total_amount),
  // The order number the customer waits for; only once the payment is in.
  orderNumber: c.status === 'paid' ? c.food_order_id : null,
  // At a table or in a room the guest follows the order on their own phone,
  // by its private link. (The kiosk's customer has only the number.)
  ...(c.order_type === 'kiosk' ? {} : { orderToken: c.status === 'paid' ? c.order_token || null : null }),
});

/**
 * A payment for a checkout has arrived (from the screen with a checked
 * signature, the gateway's webhook, or a look-up at the gateway). Safe to call
 * more than once for the same payment.
 *
 * Returns { outcome } where outcome is
 *   'paid'     the order has just been created
 *   'already'  it had been created before
 *   'refunded' the screen had closed this basket; the money is on its way back
 *   'unknown'  no such checkout
 */
async function settle({ gatewayOrderId, paymentId, via }) {
  const result = await db.withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM kiosk_checkouts WHERE razorpay_order_id = $1 FOR UPDATE`, [gatewayOrderId]);
    const c = rows[0];
    if (!c) return { outcome: 'unknown' };
    if (c.status === 'paid') return { outcome: 'already', checkout: c };
    if (c.status === 'refunded') return { outcome: 'refunded', checkout: c };

    if (c.status === 'abandoned') {
      // The customer was told it did not go through and may have ordered again.
      const closed = await client.query(
        `UPDATE kiosk_checkouts SET status = 'refunded', razorpay_payment_id = $2, paid_at = now() WHERE id = $1 RETURNING *`,
        [c.id, paymentId]
      );
      return { outcome: 'refunded', checkout: closed.rows[0], refundNow: true };
    }

    const order = await foodOrders.insertOrder(
      client,
      {
        orderType: c.order_type,
        tableNumber: c.table_number,
        roomNumber: c.room_number,
        serviceMode: c.service_mode,
        customerName: c.customer_name,
        customerPhone: c.customer_phone,
        notes: c.notes,
        total: c.total_amount,
        payment: { method: 'online', reference: paymentId, gatewayPaymentId: paymentId },
      },
      c.items
    );
    // Their order number and the link to follow it, if the guest left a phone number.
    await foodOrders.tellGuest(client, order, 'order_placed');
    const paid = await client.query(
      `UPDATE kiosk_checkouts SET status = 'paid', razorpay_payment_id = $2, food_order_id = $3, paid_at = now() WHERE id = $1 RETURNING *`,
      [c.id, paymentId, order.id]
    );
    return { outcome: 'paid', checkout: paid.rows[0], created: true };
  });

  if (result.created) {
    const c = result.checkout;
    logAction({ actorType: 'guest', action: 'food_order_paid_online', details: { orderId: c.food_order_id, orderType: c.order_type, amount: Number(c.total_amount), paymentId, via } });
    emitFoodUpdate('order_created', { orderId: c.food_order_id });
    notify.flush();
  }
  if (result.refundNow) {
    const c = result.checkout;
    try {
      const refund = await gateway.refundPayment(paymentId, Number(c.total_amount), { checkout: String(c.id) });
      await db.query(`UPDATE kiosk_checkouts SET refund_reference = $2 WHERE id = $1`, [c.id, refund.id]);
      logAction({ actorType: 'system', action: 'late_payment_refunded', details: { checkoutId: c.id, orderType: c.order_type, amount: Number(c.total_amount), paymentId, refundId: refund.id, via } });
    } catch (err) {
      console.error(`[checkout] late payment ${paymentId} could not be refunded:`, err?.error?.description || err.message);
      logAction({ actorType: 'system', action: 'late_payment_refund_failed', details: { checkoutId: c.id, orderType: c.order_type, amount: Number(c.total_amount), paymentId, via, error: err?.error?.description || err.message } });
    }
  }
  return { outcome: result.outcome };
}

/** Asks the gateway whether a still-open checkout has been paid, and settles it if so. */
async function reconcile(checkout) {
  if (checkout.status !== 'created') return;
  let payment = null;
  try {
    payment = await gateway.paidPaymentFor(checkout.razorpay_order_id);
  } catch (err) {
    console.error('[checkout] could not ask the gateway about a checkout:', err?.error?.description || err.message);
  }
  if (payment) await settle({ gatewayOrderId: checkout.razorpay_order_id, paymentId: payment.id, via: 'lookup' });
}

// The room as the hotel writes its number ("V1" for "v1"), or null if no room in use has it.
async function roomInUse(unit) {
  const { rows } = await db.query(`SELECT unit_number FROM room_units WHERE upper(unit_number) = upper($1) AND is_active`, [String(unit || '')]);
  return rows[0]?.unit_number || null;
}

/**
 * Checks that this checkout may be opened, and works out where the order goes.
 * Returns { tableNumber, roomNumber, serviceMode } as they are stored (null
 * where one does not apply). Throws 403 without the right key, and 400 when a
 * kiosk customer's choice is missing or names a table or room we do not have.
 */
async function whereTo({ orderType, accessKey, serviceMode, tableNumber, roomNumber }) {
  if (orderType === 'room') {
    if (!roomNumber || !(await access.isValidRoomKey(roomNumber, accessKey))) throw new ApiError(403, SCAN_ROOM_CODE);
    return { tableNumber: null, roomNumber: (await roomInUse(roomNumber)) || String(roomNumber), serviceMode: null };
  }
  if (orderType === 'table') {
    if (!tableNumber || !(await access.isValidTableKey(tableNumber, accessKey))) throw new ApiError(403, SCAN_TABLE_CODE);
    return { tableNumber: String(Number(tableNumber)), roomNumber: null, serviceMode: null };
  }

  // The kiosk: its own key, then what the customer chose on its screen.
  if (!access.isValidKioskKey(accessKey)) throw new ApiError(403, NOT_A_KIOSK);
  if (!SERVICE_MODES.includes(serviceMode)) throw new ApiError(400, 'Please choose dine-in, pickup or room drop.');
  if (serviceMode === 'dine_in') {
    const table = Number(tableNumber);
    if (!Number.isInteger(table) || table < 1 || table > (await access.tableCount())) {
      throw new ApiError(400, 'Please choose your table number.');
    }
    return { tableNumber: String(table), roomNumber: null, serviceMode };
  }
  if (serviceMode === 'room') {
    const room = roomNumber ? await roomInUse(roomNumber) : null;
    if (!room) throw new ApiError(400, 'We could not find that room. Please check your room number.');
    return { tableNumber: null, roomNumber: room, serviceMode };
  }
  return { tableNumber: null, roomNumber: null, serviceMode };
}

// POST /api/checkouts
// Body: { orderType: 'kiosk' | 'table' | 'room', accessKey,
//         serviceMode    the kiosk only, and required there: 'dine_in' | 'pickup' | 'room'
//         tableNumber    a table's order, and the kiosk's dine-in
//         roomNumber     a room's order, and the kiosk's room drop
//         customerName?, customerPhone?   a table's or a room's (the kiosk takes neither)
//         items: [{ menuItemId, quantity, spiceLevel?, notes? }], notes?, expectedTotal? }
const createCheckout = asyncHandler(async (req, res) => {
  const { orderType, customerName, customerPhone, items, notes, expectedTotal } = req.body;
  const place = await whereTo(req.body);
  const askStaff = orderType === 'room' ? 'Please call the restaurant.' : orderType === 'table' ? 'Please ask our staff.' : 'Please order with our staff.';

  const { lines, total } = await db.withTransaction((client) => foodOrders.priceLines(client, items));

  // The customer agreed to the total on the screen. If a price changed in the
  // meantime, they see the new one before anything is charged.
  if (expectedTotal !== undefined && expectedTotal !== null && paise(expectedTotal) !== paise(total)) {
    throw new ApiError(409, 'Some prices have just changed. Please check your order and pay again.', { code: 'price_changed', total });
  }
  if (paise(total) < 100) throw new ApiError(400, `This order cannot be paid for online. ${askStaff}`);

  const token = crypto.randomBytes(15).toString('base64url');
  let order;
  try {
    order = await gateway.createOrder({
      amount: total,
      receipt: `food_${token}`,
      // Shown beside the payment in the gateway's own dashboard.
      notes: {
        source: orderType,
        ...(place.serviceMode ? { mode: place.serviceMode } : {}),
        ...(place.tableNumber ? { table: place.tableNumber } : {}),
        ...(place.roomNumber ? { room: place.roomNumber } : {}),
      },
    });
  } catch (err) {
    console.error('[checkout] the payment gateway refused a new order:', err?.error?.description || err.message);
    throw new ApiError(502, `Online payment is not available right now. ${askStaff}`);
  }

  // The kiosk takes no names and no phone number: its customers wait for a number.
  const named = orderType !== 'kiosk';
  await db.query(
    `INSERT INTO kiosk_checkouts
       (token, order_type, service_mode, table_number, room_number, customer_name, customer_phone, items, notes, total_amount, razorpay_order_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
    [
      token,
      orderType,
      place.serviceMode,
      place.tableNumber,
      place.roomNumber,
      named ? customerName || null : null,
      named ? customerPhone || null : null,
      JSON.stringify(lines),
      notes || null,
      total,
      order.id,
    ]
  );

  res.status(201).json({
    success: true,
    token,
    total,
    amount: order.amount, // in paise, as the gateway wants it
    currency: 'INR',
    gatewayOrderId: order.id,
    keyId: gateway.publicKeyId(),
    mock: gateway.isMock(),
    paySeconds: PAY_SECONDS,
  });
});

// POST /api/checkouts/:token/confirm
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// What the screen reports can be made up, so the gateway's signature is
// recomputed here; only a payment that checks out creates the order.
const confirmCheckout = asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  const checkout = await findByToken(req.params.token);
  if (!checkout) throw new ApiError(404, 'Checkout not found');
  if (checkout.razorpay_order_id !== orderId) throw new ApiError(400, 'This payment does not belong to this order');
  if (!gateway.verifyCheckoutSignature(orderId, paymentId, signature)) {
    throw new ApiError(400, 'The payment could not be verified. If money left your account, it will be returned automatically.');
  }

  const { outcome } = await settle({ gatewayOrderId: orderId, paymentId, via: 'screen' });
  if (outcome === 'refunded') {
    throw new ApiError(409, 'This payment arrived after the order had been closed, so it is being refunded. Please order again.', { code: 'refunded' });
  }
  res.json({ success: true, ...publicState(await findByToken(req.params.token)) });
});

// GET /api/checkouts/:token — where a checkout stands. With ?check=1 the
// gateway is asked too (the screen does that when its own confirmation failed).
const getCheckout = asyncHandler(async (req, res) => {
  let checkout = await findByToken(req.params.token);
  if (!checkout) throw new ApiError(404, 'Checkout not found');
  if (req.query.check === '1' && checkout.status === 'created') {
    await reconcile(checkout);
    checkout = await findByToken(req.params.token);
  }
  res.json({ success: true, ...publicState(checkout) });
});

// POST /api/checkouts/:token/abandon — the customer backed out of the payment,
// or the screen timed out. If the payment did go through in that moment, the
// order is placed after all and the answer says so.
const abandonCheckout = asyncHandler(async (req, res) => {
  const checkout = await findByToken(req.params.token);
  if (!checkout) throw new ApiError(404, 'Checkout not found');
  if (checkout.status === 'created') {
    await reconcile(checkout);
    await db.query(`UPDATE kiosk_checkouts SET status = 'abandoned' WHERE id = $1 AND status = 'created'`, [checkout.id]);
  }
  res.json({ success: true, ...publicState(await findByToken(req.params.token)) });
});

/**
 * Clean-up job. Baskets nobody paid for are closed; one that was paid after
 * the screen had moved on is refunded (see settle). Each checkout is looked at
 * once. Returns { closed, refunded } for the job log.
 */
async function sweepStaleCheckouts() {
  const { rows } = await db.query(
    `SELECT * FROM kiosk_checkouts
     WHERE status IN ('created', 'abandoned') AND checked_at IS NULL
       AND created_at < now() - make_interval(mins => $1::int)
     ORDER BY id LIMIT 25`,
    [STALE_MINUTES]
  );
  let closed = 0;
  let refunded = 0;
  for (const c of rows) {
    let payment = null;
    try {
      payment = await gateway.paidPaymentFor(c.razorpay_order_id);
    } catch (err) {
      console.error('[checkout] could not ask the gateway about a stale checkout:', err?.error?.description || err.message);
      continue; // try again on the next run
    }
    if (c.status === 'created') {
      const done = await db.query(`UPDATE kiosk_checkouts SET status = 'abandoned' WHERE id = $1 AND status = 'created'`, [c.id]);
      closed += done.rowCount;
    }
    if (payment) {
      const { outcome } = await settle({ gatewayOrderId: c.razorpay_order_id, paymentId: payment.id, via: 'sweep' });
      if (outcome === 'refunded') refunded += 1;
    }
    await db.query(`UPDATE kiosk_checkouts SET checked_at = now() WHERE id = $1`, [c.id]);
  }
  return { closed, refunded };
}

module.exports = { createCheckout, confirmCheckout, getCheckout, abandonCheckout, settle, sweepStaleCheckouts, PAY_SECONDS };
