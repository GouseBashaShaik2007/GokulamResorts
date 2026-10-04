const crypto = require('crypto');
const { withTransaction, query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const access = require('../utils/orderAccess');

const SCAN_FIRST = 'Please scan the QR code on your table, or at the restaurant counter, to order.';

// Ordering is for people at the resort: the request must carry the key from
// the QR code it came from (see utils/orderAccess.js).
async function assertOrderAccess(orderType, tableNumber, accessKey) {
  const ok = orderType === 'table' ? await access.isValidTableKey(tableNumber, accessKey) : access.isValidCounterKey(accessKey);
  if (!ok) throw new ApiError(403, SCAN_FIRST);
}

// GET /api/order-access?type=table&table=5&k=…  |  ?type=counter&k=…
// Lets the ordering page decide whether to show the menu or "scan the code".
const checkAccess = asyncHandler(async (req, res) => {
  const { type, table, k } = req.query;
  const valid = type === 'table' ? await access.isValidTableKey(table, k) : access.isValidCounterKey(k);
  res.json({ success: true, valid });
});

// POST /api/food-orders
// Body: { orderType, accessKey, tableNumber?, customerName?, customerPhone?, notes?, items: [{menuItemId, quantity}] }
const createOrder = asyncHandler(async (req, res) => {
  const { orderType, tableNumber, customerName, customerPhone, notes, items, accessKey } = req.body;

  if (orderType === 'table' && !tableNumber) {
    throw new ApiError(400, 'tableNumber is required for table orders');
  }
  if (orderType === 'kiosk' && !customerName) {
    throw new ApiError(400, 'customerName is required for kiosk orders');
  }
  await assertOrderAccess(orderType, tableNumber, accessKey);

  const order = await withTransaction(async (client) => {
    // Re-price every line from the live menu — never trust client-submitted prices.
    const menuItemIds = items.map((i) => i.menuItemId);
    const { rows: menuRows } = await client.query(
      `SELECT id, name, price, is_available, spice_adjustable FROM menu_items WHERE id = ANY($1) FOR UPDATE`,
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
        spiceLevel: menuItem.spice_adjustable ? line.spiceLevel || null : null,
        notes: line.notes || null,
      });
    }

    const orderRes = await client.query(
      `INSERT INTO food_orders
        (order_type, table_number, customer_name, customer_phone, notes, total_amount, status, public_token)
       VALUES ($1,$2,$3,$4,$5,$6,'new',$7)
       RETURNING id, status, total_amount, created_at, public_token`,
      [
        orderType,
        orderType === 'table' ? tableNumber : null,
        customerName || null,
        customerPhone || null,
        notes || null,
        totalAmount,
        crypto.randomBytes(15).toString('base64url'), // the guest's private link to this order
      ]
    );
    const createdOrder = orderRes.rows[0];

    for (const line of lineItems) {
      await client.query(
        `INSERT INTO food_order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total, spice_level, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [createdOrder.id, line.menuItemId, line.itemName, line.unitPrice, line.quantity, line.lineTotal, line.spiceLevel, line.notes]
      );
    }

    return { ...createdOrder, items: lineItems };
  });

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
    `SELECT id, order_type, table_number, total_amount, status, created_at, updated_at
     FROM food_orders WHERE public_token = $1`,
    [req.params.token]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Order not found');
  }

  const { rows: items } = await query(
    `SELECT item_name, quantity, line_total FROM food_order_items WHERE order_id = $1 ORDER BY id`,
    [rows[0].id]
  );

  res.json({ success: true, order: { ...rows[0], items } });
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
  }
  res.status(201).json({ success: true });
});

module.exports = { checkAccess, createOrder, getOrderByToken, getQueue, createTableRequest };
