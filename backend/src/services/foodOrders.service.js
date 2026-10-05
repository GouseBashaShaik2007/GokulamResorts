// What every way of ordering food shares: pricing a basket from the live menu,
// saving the order, moving it from one stage to the next, telling the guest by
// SMS (when they left a phone number), and giving the money back when an order
// that was paid through the payment gateway is cancelled.
const crypto = require('crypto');
const db = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const gateway = require('./gateway.service');
const notify = require('./notify.service');
const { logAction } = require('../utils/auditLog');

// What a message to the guest is written from (see notify.service.js).
const MESSAGE_COLUMNS = 'id, status, customer_phone, total_amount, public_token, table_number, room_number, paid_at';

/**
 * Prices a basket from the menu as it is now — never from what the browser sent.
 * `items`: [{ menuItemId, quantity, spiceLevel?, notes? }].
 * Returns { lines, total }. If any dish is gone or sold out, throws 400 with
 * `code: 'sold_out'` and the dishes concerned, so the screen can say which.
 */
async function priceLines(client, items) {
  const ids = [...new Set(items.map((i) => Number(i.menuItemId)))];
  const { rows } = await client.query(
    `SELECT id, name, price, is_available, spice_adjustable FROM menu_items WHERE id = ANY($1) FOR UPDATE`,
    [ids]
  );
  const menu = new Map(rows.map((m) => [m.id, m]));

  const gone = [];
  const lines = [];
  let total = 0;
  for (const line of items) {
    const dish = menu.get(Number(line.menuItemId));
    if (!dish || !dish.is_available) {
      if (!gone.some((g) => g.id === Number(line.menuItemId))) gone.push({ id: Number(line.menuItemId), name: dish?.name || null });
      continue;
    }
    const unitPrice = Number(dish.price);
    const lineTotal = unitPrice * line.quantity;
    total += lineTotal;
    lines.push({
      menuItemId: dish.id,
      itemName: dish.name,
      unitPrice,
      quantity: line.quantity,
      lineTotal,
      spiceLevel: dish.spice_adjustable ? line.spiceLevel || null : null,
      notes: line.notes || null,
    });
  }

  if (gone.length > 0) {
    const names = gone.map((g) => g.name).filter(Boolean);
    throw new ApiError(
      400,
      names.length === gone.length
        ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} not available any more. Please remove ${names.length === 1 ? 'it' : 'them'} from your order.`
        : 'A dish in your order is not available any more. Please check your order.',
      { code: 'sold_out', items: gone }
    );
  }
  return { lines, total };
}

/**
 * Saves an order and its lines. `order`: { orderType, tableNumber?, roomNumber?, serviceMode?,
 * customerName?, customerPhone?, notes?, total, payment? } where `payment` ({ method,
 * reference, gatewayPaymentId }) marks it paid from the start, and `serviceMode`
 * is what a kiosk customer asked for ('dine_in' | 'pickup' | 'room').
 * Returns the new row: { id, status, total_amount, created_at, public_token,
 * customer_phone, table_number, room_number, paid_at } — enough to write the
 * guest a message from.
 */
async function insertOrder(client, order, lines) {
  const { rows } = await client.query(
    `INSERT INTO food_orders
       (order_type, table_number, customer_name, customer_phone, notes, total_amount, status, public_token,
        paid_at, payment_method, payment_reference, gateway_payment_id, room_number, service_mode)
     VALUES ($1,$2,$3,$4,$5,$6,'new',$7, CASE WHEN $8::varchar IS NULL THEN NULL ELSE now() END, $8::varchar, $9, $10, $11, $12)
     RETURNING ${MESSAGE_COLUMNS}, created_at`,
    [
      order.orderType,
      order.tableNumber || null,
      order.customerName || null,
      order.customerPhone || null,
      order.notes || null,
      order.total,
      crypto.randomBytes(15).toString('base64url'), // the guest's private link to this order
      order.payment?.method || null,
      order.payment?.reference || null,
      order.payment?.gatewayPaymentId || null,
      order.roomNumber || null,
      order.serviceMode || null,
    ]
  );
  const created = rows[0];
  for (const line of lines) {
    await client.query(
      `INSERT INTO food_order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total, spice_level, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [created.id, line.menuItemId, line.itemName, line.unitPrice, line.quantity, line.lineTotal, line.spiceLevel, line.notes]
    );
  }
  return created;
}

/**
 * Queues an SMS to the guest about their order, inside the transaction that
 * made the change (`client`). Nothing happens when they left no phone number.
 * `template`: 'order_placed' | 'order_ready' | 'order_cancelled' (notify.service.js).
 *
 * A message that cannot be queued must never undo the change it is about — an
 * order that has been paid for, above all — so a failure here is logged and
 * the change goes ahead. Call notify.flush() once the change is committed.
 */
async function tellGuest(client, order, template, extra = {}) {
  if (!order?.customer_phone) return;
  await client.query('SAVEPOINT guest_message');
  try {
    await notify.enqueueOrder(client, order, template, extra);
    await client.query('RELEASE SAVEPOINT guest_message');
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT guest_message');
    console.error(`[food] the "${template}" message for order ${order.id} could not be queued:`, err.message);
  }
}

/**
 * Moves an order to another stage; the kitchen's screen and the manager's both
 * come through here. Returns the order as it now is, plus `previous` (the
 * stage it was at), or null if there is no such order.
 *
 * The guest is told the first time their order becomes ready: not when a
 * ticket is moved back from "served", and not a second time when one is put
 * back to "preparing" and moved on again. (Cancelling is told in
 * afterStatusChange, once it is known whether money is going back.)
 */
async function setStatus(orderId, status) {
  return db.withTransaction(async (client) => {
    const { rows: before } = await client.query(`SELECT status FROM food_orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (!before[0]) return null;
    const { rows } = await client.query(
      `UPDATE food_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING ${MESSAGE_COLUMNS}`,
      [status, orderId]
    );
    const order = { ...rows[0], previous: before[0].status };

    if (status === 'ready' && ['new', 'preparing'].includes(order.previous) && order.customer_phone) {
      const { rows: told } = await client.query(
        `SELECT 1 FROM notifications WHERE food_order_id = $1 AND template = 'order_ready' LIMIT 1`,
        [order.id]
      );
      if (told.length === 0) await tellGuest(client, order, 'order_ready');
    }
    return order;
  });
}

/**
 * What follows from an order having just been moved to another stage.
 * `order`: from setStatus (or any row with MESSAGE_COLUMNS and `previous`).
 * Returns { refund, cash } for the screen:
 *   refund  set when a cancelled order had been paid online (see refundIfPaidOnline)
 *   cash    set when delivering an unpaid room order recorded its cash (see syncCashOnDelivery)
 * A guest who left a phone number is told about a cancellation, and about the
 * money when it is on its way back. Never throws for the message's sake.
 */
async function afterStatusChange(order, actor = { type: 'system', id: null }) {
  const refund = order.status === 'cancelled' ? await refundIfPaidOnline(order.id, actor) : null;
  const cash = await syncCashOnDelivery(order.id, order.status, actor);

  if (order.status === 'cancelled' && order.previous !== 'cancelled') {
    try {
      // Only promise money that really is on its way: a refund that could not
      // be started is given back by hand, and the staff tell the guest how.
      const goingBack = !refund ? {} : refund.status === 'failed' ? { refundFailed: true } : { refund: refund.amount };
      await notify.enqueueOrder(db, order, 'order_cancelled', goingBack);
    } catch (err) {
      console.error(`[food] the "order_cancelled" message for order ${order.id} could not be queued:`, err.message);
    }
  }
  notify.flush();
  return { refund, cash };
}

/**
 * An order has just been cancelled. If it was paid through the gateway, the
 * money goes back the way it came. Never throws: the order is cancelled either
 * way, and a refund that could not be started is recorded as 'failed' for a
 * manager to do by hand.
 *
 * Returns null when there was nothing to refund, otherwise
 * { status: 'processed' | 'pending' | 'failed', amount }.
 */
async function refundIfPaidOnline(orderId, actor = { type: 'system', id: null }) {
  // Claim the refund first, so two people cancelling at once cannot refund twice.
  const { rows } = await db.query(
    `UPDATE food_orders SET refund_status = 'pending'
     WHERE id = $1 AND status = 'cancelled' AND gateway_payment_id IS NOT NULL AND refund_status IS NULL
     RETURNING id, total_amount, gateway_payment_id`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return null;

  const amount = Number(order.total_amount);
  try {
    const refund = await gateway.refundPayment(order.gateway_payment_id, amount, { foodOrderId: String(order.id) });
    await db.query(
      `UPDATE food_orders SET refund_reference = $2, refund_status = $3::varchar, refunded_at = CASE WHEN $3::varchar = 'processed' THEN now() END WHERE id = $1`,
      [order.id, refund.id, refund.status]
    );
    logAction({ actorType: actor.type, actorId: actor.id, action: 'food_order_refunded', details: { orderId: order.id, amount, refundId: refund.id, status: refund.status } });
    return { status: refund.status, amount };
  } catch (err) {
    console.error(`[food] refund for order ${order.id} could not be started:`, err?.error?.description || err.message);
    await db.query(`UPDATE food_orders SET refund_status = 'failed' WHERE id = $1`, [order.id]);
    logAction({ actorType: actor.type, actorId: actor.id, action: 'food_order_refund_failed', details: { orderId: order.id, amount, error: err?.error?.description || err.message } });
    return { status: 'failed', amount };
  }
}

// How a cash payment taken at a room's door is marked, so it can be told apart
// from one a manager recorded by hand.
const ON_DELIVERY = 'Collected on delivery';

/**
 * Room orders are now paid online when they are placed. One from before that,
 * placed as "cash at the door", is still settled the way it was promised: the
 * cash goes to whoever brings the food, and nobody at a desk records it —
 * marking the order delivered ("served") records the cash, and taking "served"
 * back (a slip of the thumb, or a cancellation) takes that record back too.
 *
 * Call after an order's status has changed. Returns { collected: amount }
 * when cash was just recorded, otherwise null.
 */
async function syncCashOnDelivery(orderId, status, actor = { type: 'system', id: null }) {
  if (status === 'served') {
    const { rows } = await db.query(
      // updated_at is left alone: the kitchen reads it as "when this became ready".
      `UPDATE food_orders SET paid_at = now(), payment_method = 'cash', payment_reference = $2
       WHERE id = $1 AND order_type = 'room' AND paid_at IS NULL RETURNING id, total_amount`,
      [orderId, ON_DELIVERY]
    );
    if (!rows[0]) return null;
    const amount = Number(rows[0].total_amount);
    logAction({ actorType: actor.type, actorId: actor.id, action: 'food_order_paid', details: { orderId: rows[0].id, method: 'cash', amount, onDelivery: true } });
    return { collected: amount };
  }
  const { rows } = await db.query(
    `UPDATE food_orders SET paid_at = NULL, payment_method = NULL, payment_reference = NULL
     WHERE id = $1 AND order_type = 'room' AND paid_at IS NOT NULL AND payment_reference = $2 AND gateway_payment_id IS NULL
     RETURNING id`,
    [orderId, ON_DELIVERY]
  );
  if (rows[0]) {
    logAction({ actorType: actor.type, actorId: actor.id, action: 'food_order_payment_undone', details: { orderId: rows[0].id, reason: `Order moved from delivered to ${status}` } });
  }
  return null;
}

/** The gateway reports how a refund ended (webhook). Unknown refunds are ignored. */
async function applyRefundOutcome(refundId, outcome) {
  await db.query(
    `UPDATE food_orders SET refund_status = $2::varchar, refunded_at = CASE WHEN $2::varchar = 'processed' THEN now() ELSE refunded_at END
     WHERE refund_reference = $1 AND refund_status IS DISTINCT FROM $2::varchar`,
    [refundId, outcome]
  );
}

/**
 * A refunded order cannot be brought back: the money has gone. Throws 409 if
 * `orderId` is such an order and something other than "cancelled" is asked for.
 */
async function assertNotRefunded(orderId, nextStatus) {
  if (nextStatus === 'cancelled') return;
  const { rows } = await db.query(`SELECT status, refund_status FROM food_orders WHERE id = $1`, [orderId]);
  if (rows[0]?.status === 'cancelled' && ['pending', 'processed'].includes(rows[0].refund_status)) {
    throw new ApiError(409, 'This order was cancelled and its payment refunded. Please take a new order instead.');
  }
}

module.exports = {
  MESSAGE_COLUMNS,
  priceLines,
  insertOrder,
  tellGuest,
  setStatus,
  afterStatusChange,
  refundIfPaidOnline,
  syncCashOnDelivery,
  applyRefundOutcome,
  assertNotRefunded,
};
