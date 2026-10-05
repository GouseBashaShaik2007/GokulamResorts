// What every way of ordering food shares: pricing a basket from the live menu,
// saving the order, and giving the money back when an order that was paid
// through the payment gateway (the kiosk) is cancelled.
const crypto = require('crypto');
const db = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const gateway = require('./gateway.service');
const { logAction } = require('../utils/auditLog');

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
 * Saves an order and its lines. `order`: { orderType, tableNumber?, roomNumber?, customerName?,
 * customerPhone?, notes?, total, payment? } where `payment` ({ method,
 * reference, gatewayPaymentId }) marks it paid from the start.
 * Returns the new row: { id, status, total_amount, created_at, public_token }.
 */
async function insertOrder(client, order, lines) {
  const { rows } = await client.query(
    `INSERT INTO food_orders
       (order_type, table_number, customer_name, customer_phone, notes, total_amount, status, public_token,
        paid_at, payment_method, payment_reference, gateway_payment_id, room_number)
     VALUES ($1,$2,$3,$4,$5,$6,'new',$7, CASE WHEN $8::varchar IS NULL THEN NULL ELSE now() END, $8::varchar, $9, $10, $11)
     RETURNING id, status, total_amount, created_at, public_token`,
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
 * A room order that was not paid online is paid in cash at the door, to
 * whoever brings the food. Nobody at a desk records it: marking the order
 * delivered ("served") records the cash, and taking "served" back — a slip of
 * the thumb, or a cancellation — takes that record back too.
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

module.exports = { priceLines, insertOrder, refundIfPaidOnline, syncCashOnDelivery, applyRefundOutcome, assertNotRefunded };
