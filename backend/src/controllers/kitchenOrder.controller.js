const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const { emitFoodUpdate } = require('../realtime');
const { setStatus, afterStatusChange, assertNotRefunded } = require('../services/foodOrders.service');

const ACTIVE_STATUSES = ['new', 'preparing', 'ready'];
const ALL_STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'];

// GET /api/kitchen/orders — active orders, oldest first (FIFO for the kitchen).
// order_type, service_mode, table_number and room_number together say what an
// order is and where it goes (the screen words it: lib/foodOrders.js).
const listActiveOrders = asyncHandler(async (req, res) => {
  const { rows: orders } = await query(
    `SELECT id, order_type, service_mode, table_number, room_number, customer_name, customer_phone, notes,
            total_amount, status, created_at, updated_at, payment_method, (paid_at IS NOT NULL) AS paid
     FROM food_orders
     WHERE status = ANY($1)
     ORDER BY created_at ASC`,
    [ACTIVE_STATUSES]
  );

  if (orders.length === 0) {
    return res.json({ success: true, orders: [] });
  }

  const orderIds = orders.map((o) => o.id);
  const { rows: items } = await query(
    // is_veg comes from the dish as it is on the menu now (null if the dish was since removed).
    `SELECT foi.id, foi.order_id, foi.item_name, foi.quantity, foi.spice_level, foi.notes, mi.is_veg
     FROM food_order_items foi LEFT JOIN menu_items mi ON mi.id = foi.menu_item_id
     WHERE foi.order_id = ANY($1) ORDER BY foi.id`,
    [orderIds]
  );

  const itemsByOrder = {};
  for (const item of items) {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  }

  res.json({
    success: true,
    orders: orders.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] })),
  });
});

// PATCH /api/kitchen/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!ALL_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${ALL_STATUSES.join(', ')}`);
  }
  await assertNotRefunded(id, status);

  // A guest who left a phone number is told when the order becomes ready.
  const order = await setStatus(id, status);
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  // A cancelled order that was paid online is refunded the way it was paid
  // (`refund` tells the screen), and the guest is told. An older room order
  // that was to be paid in cash at the door: delivering it records the cash (`cash`).
  const { refund, cash } = await afterStatusChange(order, { type: 'kitchen', id: req.kitchen?.sub ?? null });

  emitFoodUpdate('order_status', { orderId: order.id, status: order.status });
  res.json({ success: true, order: { id: order.id, status: order.status }, refund, cash });
});

// GET /api/kitchen/requests — tables waiting for a person (or, from a page
// opened before tables paid online, for the bill), oldest first.
const listRequests = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, table_number, kind, created_at FROM table_requests WHERE status = 'open' ORDER BY created_at ASC`
  );
  res.json({ success: true, requests: rows });
});

// PATCH /api/kitchen/requests/:id/done — someone has gone to the table.
const completeRequest = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE table_requests SET status = 'done', done_at = now() WHERE id = $1 AND status = 'open' RETURNING id`,
    [req.params.id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Request not found');
  }
  emitFoodUpdate('table_request_done', { requestId: rows[0].id });
  res.json({ success: true });
});

module.exports = { listActiveOrders, updateOrderStatus, listRequests, completeRequest };
