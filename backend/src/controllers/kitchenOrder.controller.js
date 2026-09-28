const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');

const ACTIVE_STATUSES = ['new', 'preparing', 'ready'];
const ALL_STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'];

// GET /api/kitchen/orders — active orders, oldest first (FIFO for the kitchen)
const listActiveOrders = asyncHandler(async (req, res) => {
  const { rows: orders } = await query(
    `SELECT id, order_type, table_number, customer_name, customer_phone, notes,
            total_amount, status, created_at, updated_at
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
    `SELECT order_id, item_name, quantity FROM food_order_items WHERE order_id = ANY($1)`,
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

  const { rows } = await query(
    `UPDATE food_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status`,
    [status, id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Order not found');
  }

  res.json({ success: true, order: rows[0] });
});

module.exports = { listActiveOrders, updateOrderStatus };
