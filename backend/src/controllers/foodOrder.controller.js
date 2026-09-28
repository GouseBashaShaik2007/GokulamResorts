const { withTransaction, query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/food-orders
// Body: { orderType, tableNumber?, customerName?, customerPhone?, notes?, items: [{menuItemId, quantity}] }
const createOrder = asyncHandler(async (req, res) => {
  const { orderType, tableNumber, customerName, customerPhone, notes, items } = req.body;

  if (orderType === 'table' && !tableNumber) {
    throw new ApiError(400, 'tableNumber is required for table orders');
  }
  if (orderType === 'kiosk' && !customerName) {
    throw new ApiError(400, 'customerName is required for kiosk orders');
  }

  const order = await withTransaction(async (client) => {
    // Re-price every line from the live menu — never trust client-submitted prices.
    const menuItemIds = items.map((i) => i.menuItemId);
    const { rows: menuRows } = await client.query(
      `SELECT id, name, price, is_available FROM menu_items WHERE id = ANY($1) FOR UPDATE`,
      [menuItemIds]
    );

    const menuById = new Map(menuRows.map((m) => [m.id, m]));
    let totalAmount = 0;
    const lineItems = [];

    for (const line of items) {
      const menuItem = menuById.get(line.menuItemId);
      if (!menuItem || !menuItem.is_available) {
        throw new ApiError(400, `Item ${line.menuItemId} is not available`);
      }
      const unitPrice = Number(menuItem.price);
      const lineTotal = unitPrice * line.quantity;
      totalAmount += lineTotal;
      lineItems.push({
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPrice,
        quantity: line.quantity,
        lineTotal,
      });
    }

    const orderRes = await client.query(
      `INSERT INTO food_orders
        (order_type, table_number, customer_name, customer_phone, notes, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,'new')
       RETURNING id, status, total_amount, created_at`,
      [
        orderType,
        orderType === 'table' ? tableNumber : null,
        customerName || null,
        customerPhone || null,
        notes || null,
        totalAmount,
      ]
    );
    const createdOrder = orderRes.rows[0];

    for (const line of lineItems) {
      await client.query(
        `INSERT INTO food_order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [createdOrder.id, line.menuItemId, line.itemName, line.unitPrice, line.quantity, line.lineTotal]
      );
    }

    return { ...createdOrder, items: lineItems };
  });

  res.status(201).json({
    success: true,
    message: 'Order placed. The kitchen has received it.',
    orderId: order.id,
    status: order.status,
    totalAmount: order.total_amount,
    items: order.items,
  });
});

// GET /api/food-orders/:id — public status lookup for a guest's own order
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await query(
    `SELECT id, order_type, table_number, customer_name, total_amount, status, created_at, updated_at
     FROM food_orders WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Order not found');
  }

  const { rows: items } = await query(
    `SELECT item_name, unit_price, quantity, line_total FROM food_order_items WHERE order_id = $1`,
    [id]
  );

  res.json({ success: true, order: { ...rows[0], items } });
});

module.exports = { createOrder, getOrderById };
