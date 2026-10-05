const { withTransaction, query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const access = require('../utils/orderAccess');
const { logAction } = require('../utils/auditLog');
const { emitFoodUpdate } = require('../realtime');
const { priceLines, insertOrder, refundIfPaidOnline } = require('../services/foodOrders.service');

const SCAN_FIRST = 'Please scan the QR code on your table, or at the restaurant counter, to order.';
const SCAN_ROOM_CODE = 'Please scan the QR code in your room to order.';

// Ordering is for people at the resort: the request must carry the key from
// the QR code it came from (see utils/orderAccess.js).
async function assertOrderAccess(orderType, { tableNumber, roomNumber }, accessKey) {
  if (orderType === 'room') {
    if (!(await access.isValidRoomKey(roomNumber, accessKey))) throw new ApiError(403, SCAN_ROOM_CODE);
    return;
  }
  const ok = orderType === 'table' ? await access.isValidTableKey(tableNumber, accessKey) : access.isValidCounterKey(accessKey);
  if (!ok) throw new ApiError(403, SCAN_FIRST);
}

// GET /api/order-access?type=table&table=5&k=…  |  ?type=room&room=101&k=…  |  ?type=counter&k=…  |  ?type=kiosk&k=…
// Lets the ordering page decide whether to show the menu or "scan the code",
// and the kiosk tablet check the key it was set up with.
const checkAccess = asyncHandler(async (req, res) => {
  const { type, table, room, k } = req.query;
  const valid =
    type === 'table'
      ? await access.isValidTableKey(table, k)
      : type === 'room'
        ? await access.isValidRoomKey(room, k)
        : type === 'kiosk'
          ? access.isValidKioskKey(k)
          : access.isValidCounterKey(k);
  res.json({ success: true, valid });
});

// POST /api/food-orders — an order from a QR code that is paid for afterwards:
// at a table, at the counter, or in cash at a hotel room's door.
// Body: { orderType: 'table' | 'counter' | 'room', accessKey, tableNumber?, roomNumber?, customerName?, customerPhone?, notes?, items: [{menuItemId, quantity}] }
// (Orders paid online first — the kiosk, a room's "pay now" — do not come through
// here: see checkout.controller.js.)
const createOrder = asyncHandler(async (req, res) => {
  const { tableNumber, roomNumber, customerName, customerPhone, notes, items, accessKey } = req.body;
  // 'kiosk' was the counter's older name; pages opened before the change still send it.
  const orderType = req.body.orderType === 'kiosk' ? 'counter' : req.body.orderType;

  if (orderType === 'table' && !tableNumber) {
    throw new ApiError(400, 'tableNumber is required for table orders');
  }
  if (orderType === 'room' && !roomNumber) {
    throw new ApiError(400, 'roomNumber is required for room orders');
  }
  if (orderType === 'counter' && !customerName) {
    throw new ApiError(400, 'Please enter a name so we can call out your order.');
  }
  await assertOrderAccess(orderType, { tableNumber, roomNumber }, accessKey);

  const order = await withTransaction(async (client) => {
    // Re-priced from the live menu — never trust prices the browser sent.
    const { lines, total } = await priceLines(client, items);
    const created = await insertOrder(
      client,
      {
        orderType,
        tableNumber: orderType === 'table' ? tableNumber : null,
        roomNumber: orderType === 'room' ? String(roomNumber) : null,
        customerName,
        customerPhone,
        notes,
        total,
      },
      lines
    );
    return { ...created, items: lines };
  });

  emitFoodUpdate('order_created', { orderId: order.id });

  res.status(201).json({
    success: true,
    message: 'Order placed. The kitchen has received it.',
    orderId: order.id,
    token: order.public_token,
    status: order.status,
    totalAmount: order.total_amount,
    items: order.items,
  });
});

// GET /api/food-orders/:token — a guest's own order, by the private token
// they were given when they placed it. Order numbers are sequential, so they
// are not accepted here; and the answer carries no names or notes.
const getOrderByToken = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, order_type, table_number, room_number, total_amount, status, created_at, updated_at, (paid_at IS NOT NULL) AS paid,
            (gateway_payment_id IS NOT NULL) AS paid_online, refund_status
     FROM food_orders WHERE public_token = $1`,
    [req.params.token]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Order not found');
  }

  const { rows: items } = await query(
    `SELECT id, item_name, quantity, line_total FROM food_order_items WHERE order_id = $1 ORDER BY id`,
    [rows[0].id]
  );

  res.json({ success: true, order: { ...rows[0], items } });
});

// POST /api/food-orders/:token/cancel — the guest changes their mind. Allowed
// only while the order is still "new"; once the kitchen has started cooking,
// it is the staff's call.
const cancelOwnOrder = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE food_orders SET status = 'cancelled', updated_at = now()
     WHERE public_token = $1 AND status = 'new' RETURNING id, status`,
    [req.params.token]
  );
  if (rows.length === 0) {
    const { rows: existing } = await query(`SELECT status FROM food_orders WHERE public_token = $1`, [req.params.token]);
    if (existing.length === 0) throw new ApiError(404, 'Order not found');
    throw new ApiError(409, 'The kitchen has already started this order. Please ask our staff to change it.');
  }
  logAction({ actorType: 'guest', action: 'food_order_cancelled_by_guest', details: { orderId: rows[0].id } });
  const refund = await refundIfPaidOnline(rows[0].id, { type: 'guest', id: null });
  emitFoodUpdate('order_status', { orderId: rows[0].id, status: 'cancelled' });
  res.json({ success: true, order: rows[0], refund });
});

// GET /api/food-orders/queue — count of orders waiting or being prepared.
const getQueue = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT count(*)::int AS active FROM food_orders WHERE status IN ('new', 'preparing')`);
  res.json({ success: true, active: rows[0].active });
});

// POST /api/table-requests — "call staff" or "request the bill" from a table.
// Body: { tableNumber, kind: 'staff' | 'bill', accessKey }
const createTableRequest = asyncHandler(async (req, res) => {
  const { tableNumber, kind, accessKey } = req.body;
  if (!(await access.isValidTableKey(tableNumber, accessKey))) throw new ApiError(403, SCAN_FIRST);

  // Tapping twice shouldn't put two cards on the kitchen screen.
  const { rows: open } = await query(
    `SELECT id FROM table_requests WHERE table_number = $1 AND kind = $2 AND status = 'open'`,
    [String(tableNumber), kind]
  );
  if (open.length === 0) {
    await query(`INSERT INTO table_requests (table_number, kind) VALUES ($1, $2)`, [String(tableNumber), kind]);
    emitFoodUpdate('table_request', { table: String(tableNumber), kind });
  }
  res.status(201).json({ success: true });
});

module.exports = { checkAccess, createOrder, getOrderByToken, cancelOwnOrder, getQueue, createTableRequest };
