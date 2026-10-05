const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const publicImage = require('../services/publicImage.service');
const { logAction } = require('../utils/auditLog');
const { TIMEZONE } = require('../utils/dates');
const orderAccess = require('../utils/orderAccess');
const foodOrders = require('../services/foodOrders.service');
const { emitFoodUpdate } = require('../realtime');
const { startSession, endSession } = require('../utils/session');

// POST /api/admin/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query('SELECT id, name, email, password_hash FROM admins WHERE email = $1', [
    email,
  ]);
  if (rows.length === 0) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const admin = rows[0];
  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = jwt.sign({ sub: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  // The sign-in goes into a cookie scripts cannot read, not into the answer.
  startSession(res, 'admin', token);

  res.json({ success: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

// POST /api/admin/logout
const logout = (req, res) => {
  endSession(res, 'admin');
  res.json({ success: true });
};

// POST /api/admin/add-room
const addRoom = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    pricePerNight,
    capacity,
    totalRooms,
    sizeSqft,
    bedType,
    amenities,
    images,
    breakfastIncluded,
    extraBedAvailable,
    extraBedCharge,
    smokingAllowed,
    wheelchairAccessible,
  } = req.body;
  // true, false, or null when the manager has not said.
  const stated = (value) => (typeof value === 'boolean' ? value : null);

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { rows } = await query(
    `INSERT INTO rooms
      (name, slug, description, price_per_night, capacity, total_rooms, size_sqft, bed_type, amenities, images,
       breakfast_included, extra_bed_available, extra_bed_charge, smoking_allowed, wheelchair_accessible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      name,
      slug,
      description || '',
      pricePerNight,
      capacity || 2,
      totalRooms || 1,
      sizeSqft || null,
      bedType || null,
      amenities || [],
      images || [],
      stated(breakfastIncluded),
      stated(extraBedAvailable),
      extraBedCharge ?? null,
      stated(smokingAllowed),
      stated(wheelchairAccessible),
    ]
  );

  res.status(201).json({ success: true, room: rows[0] });
});

// PUT /api/admin/rooms/:id — edit room details / pricing
const updateRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  const allowed = [
    'name',
    'description',
    'price_per_night',
    'capacity',
    'total_rooms',
    'size_sqft',
    'bed_type',
    'amenities',
    'images',
    'is_active',
    'breakfast_included',
    'extra_bed_available',
    'extra_bed_charge',
    'smoking_allowed',
    'wheelchair_accessible',
  ];
  // Accept both camelCase (from the admin UI) and snake_case keys.
  const map = {
    pricePerNight: 'price_per_night',
    totalRooms: 'total_rooms',
    sizeSqft: 'size_sqft',
    bedType: 'bed_type',
    isActive: 'is_active',
    breakfastIncluded: 'breakfast_included',
    extraBedAvailable: 'extra_bed_available',
    extraBedCharge: 'extra_bed_charge',
    smokingAllowed: 'smoking_allowed',
    wheelchairAccessible: 'wheelchair_accessible',
  };

  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    const column = map[key] || key;
    if (!allowed.includes(column)) continue;
    setClauses.push(`${column} = $${i}`);
    values.push(value);
    i += 1;
  }

  if (setClauses.length === 0) {
    throw new ApiError(400, 'No valid fields provided to update');
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE rooms SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
    values
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Room not found');
  }

  res.json({ success: true, room: rows[0] });
});

// DELETE /api/admin/rooms/:id
// Soft-deletes (is_active = false) so historical bookings keep a valid
// foreign key and past guest confirmations still resolve correctly.
const deleteRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `UPDATE rooms SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id`,
    [id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Room not found');
  }

  res.json({ success: true, message: 'Room removed from listings' });
});

// GET /api/admin/rooms — includes inactive rooms, for the admin table
const listAllRooms = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, (SELECT count(*)::int FROM room_units ru WHERE ru.room_type_id = r.id AND ru.is_active) AS units_count
     FROM rooms r ORDER BY r.created_at DESC`
  );
  res.json({ success: true, rooms: rows });
});

// GET /api/admin/menu/categories — includes inactive categories
const listAllCategories = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT * FROM menu_categories ORDER BY sort_order ASC, name ASC`);
  res.json({ success: true, categories: rows });
});

// POST /api/admin/menu/categories
const addCategory = asyncHandler(async (req, res) => {
  const { name, sortOrder } = req.body;

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { rows } = await query(
    `INSERT INTO menu_categories (name, slug, sort_order)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [name, slug, sortOrder || 0]
  );

  res.status(201).json({ success: true, category: rows[0] });
});

// PUT /api/admin/menu/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  const allowed = ['name', 'sort_order', 'is_active'];
  const map = { sortOrder: 'sort_order', isActive: 'is_active' };

  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    const column = map[key] || key;
    if (!allowed.includes(column)) continue;
    setClauses.push(`${column} = $${i}`);
    values.push(value);
    i += 1;
  }

  if (setClauses.length === 0) {
    throw new ApiError(400, 'No valid fields provided to update');
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE menu_categories SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
    values
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Category not found');
  }

  res.json({ success: true, category: rows[0] });
});

// DELETE /api/admin/menu/categories/:id
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `UPDATE menu_categories SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id`,
    [id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Category not found');
  }

  res.json({ success: true, message: 'Category removed from menu' });
});

// GET /api/admin/menu/items — includes unavailable items
const listAllMenuItems = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT mi.*, mc.name AS category_name
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     ORDER BY mi.created_at DESC`
  );
  res.json({ success: true, items: rows });
});

// POST /api/admin/menu/items
const addMenuItem = asyncHandler(async (req, res) => {
  const { categoryId, name, description, price, image, isVeg, spiceAdjustable, allergens, isJain, spiceRating } = req.body;

  const { rows } = await query(
    `INSERT INTO menu_items (category_id, name, description, price, image, is_veg, spice_adjustable, allergens, is_jain, spice_rating)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      categoryId,
      name,
      description || '',
      price,
      image || null,
      isVeg !== false,
      spiceAdjustable === true,
      allergens || [],
      isJain === true,
      spiceRating || 0,
    ]
  );

  res.status(201).json({ success: true, item: rows[0] });
});

// PUT /api/admin/menu/items/:id
const updateMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  const allowed = [
    'category_id',
    'name',
    'description',
    'price',
    'image',
    'is_veg',
    'is_available',
    'spice_adjustable',
    'allergens',
    'is_jain',
    'spice_rating',
  ];
  const map = {
    categoryId: 'category_id',
    isVeg: 'is_veg',
    spiceAdjustable: 'spice_adjustable',
    isAvailable: 'is_available',
    isJain: 'is_jain',
    spiceRating: 'spice_rating',
  };

  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    const column = map[key] || key;
    if (!allowed.includes(column)) continue;
    setClauses.push(`${column} = $${i}`);
    values.push(value);
    i += 1;
  }

  if (setClauses.length === 0) {
    throw new ApiError(400, 'No valid fields provided to update');
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE menu_items SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
    values
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Menu item not found');
  }

  res.json({ success: true, item: rows[0] });
});

// DELETE /api/admin/menu/items/:id
const deleteMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `UPDATE menu_items SET is_available = false, updated_at = now() WHERE id = $1 RETURNING id`,
    [id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Menu item not found');
  }

  res.json({ success: true, message: 'Item removed from menu' });
});

// GET /api/admin/food-orders — full order history for the admin panel
// Optional ?status=, and ?from= / ?to= (YYYY-MM-DD, the resort's calendar days, inclusive).
const listFoodOrders = asyncHandler(async (req, res) => {
  const { status, from, to } = req.query;

  const params = [];
  const clauses = [];
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (from) {
    params.push(from, TIMEZONE);
    clauses.push(`(created_at AT TIME ZONE $${params.length})::date >= $${params.length - 1}::date`);
  }
  if (to) {
    params.push(to, TIMEZONE);
    clauses.push(`(created_at AT TIME ZONE $${params.length})::date <= $${params.length - 1}::date`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { rows: orders } = await query(
    `SELECT id, order_type, table_number, room_number, customer_name, customer_phone, notes,
            total_amount, status, created_at, updated_at, paid_at, payment_method, payment_reference, refund_status
     FROM food_orders
     ${where}
     ORDER BY created_at DESC`,
    params
  );

  if (orders.length === 0) {
    return res.json({ success: true, orders: [] });
  }

  const orderIds = orders.map((o) => o.id);
  const { rows: items } = await query(
`SELECT foi.id, foi.order_id, foi.item_name, foi.unit_price, foi.quantity, foi.line_total, foi.spice_level, foi.notes, mi.is_veg
     FROM food_order_items foi LEFT JOIN menu_items mi ON mi.id = foi.menu_item_id
     WHERE foi.order_id = ANY($1)
     ORDER BY foi.id`,
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

const FOOD_ORDER_STATUSES = ['new', 'preparing', 'ready', 'served', 'cancelled'];

// PATCH /api/admin/food-orders/:id/status — lets a manager step in on the
// same board the kitchen uses (e.g. cover a stuck order), separate from the
// kitchen's own PATCH /api/kitchen/orders/:id/status.
const updateFoodOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!FOOD_ORDER_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${FOOD_ORDER_STATUSES.join(', ')}`);
  }
  // Cancelling takes food off a guest's table: the log should say why.
  if (status === 'cancelled' && !String(reason || '').trim()) {
    throw new ApiError(400, 'A reason is required to cancel an order');
  }
  await foodOrders.assertNotRefunded(id, status);

  const { rows } = await query(
    `UPDATE food_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status`,
    [status, id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Order not found');
  }

  logAction({
    actorType: 'admin',
    actorId: req.admin?.sub,
    action: 'food_order_status_change',
    details: { orderId: rows[0].id, status, ...(status === 'cancelled' ? { reason: String(reason).trim() } : {}) },
  });
  // An order paid on the kiosk is refunded the way it was paid; `refund` tells the screen.
  const actor = { type: 'admin', id: req.admin?.sub ?? null };
  const refund = status === 'cancelled' ? await foodOrders.refundIfPaidOnline(rows[0].id, actor) : null;
  // A room order paid in cash is paid at the door: delivering it records the cash.
  const cash = await foodOrders.syncCashOnDelivery(rows[0].id, status, actor);
  emitFoodUpdate('order_status', { orderId: rows[0].id, status });

  res.json({ success: true, order: rows[0], refund, cash });
});

const SETTINGS_COLUMNS =
  'site_url, phone, whatsapp, email, address, maps_url, check_in_time, check_out_time, table_count, updated_at';

// GET /api/admin/settings
const getSettings = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT ${SETTINGS_COLUMNS} FROM resort_settings WHERE id = 1`);
  res.json({ success: true, settings: rows[0] || { site_url: '', updated_at: null } });
});

// The production address baked into printed QR codes. Deliberately never
// defaulted to the request's own origin — an admin must type the real domain,
// or QR codes silently point at localhost/whatever dev machine generated them.
function normalizeSiteUrl(siteUrl) {
  const trimmed = String(siteUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ApiError(400, 'Site address must be a full URL, e.g. https://gokulamresorts.in');
  }
  // Printed codes are scanned on phones, which warn about (or refuse) plain http.
  if (parsed.protocol !== 'https:') {
    throw new ApiError(400, 'Site address must start with https://');
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    throw new ApiError(400, 'Site address cannot be a localhost/dev address — QR codes must point at the real production site');
  }
  return parsed.toString().replace(/\/+$/, '');
}

// Request field -> column, for the plain-text resort details.
const SETTINGS_TEXT_FIELDS = {
  phone: 'phone',
  whatsapp: 'whatsapp',
  email: 'email',
  address: 'address',
  mapsUrl: 'maps_url',
  checkInTime: 'check_in_time',
  checkOutTime: 'check_out_time',
};

// PUT /api/admin/settings
// Only the fields that are sent are changed, so the QR page (site address,
// number of tables) and the resort details form can save independently.
const updateSettings = asyncHandler(async (req, res) => {
  const setClauses = [];
  const values = [];
  const set = (column, value) => {
    values.push(value);
    setClauses.push(`${column} = $${values.length}`);
  };

  if (req.body.siteUrl !== undefined) set('site_url', normalizeSiteUrl(req.body.siteUrl));
  for (const [field, column] of Object.entries(SETTINGS_TEXT_FIELDS)) {
    if (req.body[field] !== undefined) set(column, String(req.body[field] || '').trim());
  }
  if (req.body.tableCount !== undefined) set('table_count', req.body.tableCount);

  if (setClauses.length === 0) {
    throw new ApiError(400, 'No valid fields provided to update');
  }

  set('updated_by', req.admin?.sub || null);
  const { rows } = await query(
    `UPDATE resort_settings SET ${setClauses.join(', ')}, updated_at = now() WHERE id = 1
     RETURNING ${SETTINGS_COLUMNS}`,
    values
  );

  logAction({ actorType: 'admin', actorId: req.admin?.sub, action: 'settings_updated', details: { fields: Object.keys(req.body) } });

  res.json({ success: true, settings: rows[0] });
});

// GET /api/admin/order-links — the key each printed QR code must carry
// (see utils/orderAccess.js). Managers only: these are what let a phone order.
const getOrderLinks = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT site_url, table_count FROM resort_settings WHERE id = 1');
  const tableCount = rows[0]?.table_count || 0;
  res.json({
    success: true,
    siteUrl: rows[0]?.site_url || '',
    tableCount,
    counterKey: orderAccess.counterKey(),
    kioskKey: orderAccess.kioskKey(), // given once to the restaurant's kiosk tablet
    tables: Array.from({ length: tableCount }, (_, i) => ({ table: i + 1, key: orderAccess.tableKey(i + 1) })),
    // One code per hotel room in use: food ordered from it is brought to that room.
    rooms: (await orderAccess.roomNumbers()).map((room) => ({ room, key: orderAccess.roomKey(room) })),
  });
});

// POST /api/admin/upload-image?type=food|room
const uploadImage = asyncHandler(async (req, res) => {
  const { type } = req.query;
  if (!['food', 'room'].includes(type)) {
    throw new ApiError(400, 'type must be "food" or "room"');
  }
  if (!req.file) {
    throw new ApiError(400, 'No image file provided');
  }

  const url = await publicImage.upload(type, req.file.buffer, req.file.mimetype);
  res.status(201).json({ success: true, url });
});

// GET /api/admin/stats/today
// Everything the dashboard shows, counted here in one query instead of the
// page downloading every booking, room and food order to count a handful.
// Money is what actually moved today on the resort's calendar: every captured
// payment (online or counter, including balances and extensions) and every
// completed refund.
const todayStats = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `WITH day AS (SELECT (now() AT TIME ZONE $1)::date AS today)
     SELECT
       (SELECT COALESCE(SUM(amount), 0) FROM payments, day
         WHERE status = 'captured' AND (COALESCE(captured_at, created_at) AT TIME ZONE $1)::date = day.today) AS payments,
       (SELECT COALESCE(SUM(amount), 0) FROM payments, day
         WHERE status = 'captured' AND (COALESCE(captured_at, created_at) AT TIME ZONE $1)::date = day.today - 1) AS payments_yesterday,
       (SELECT COALESCE(SUM(amount), 0) FROM refunds, day
         WHERE status = 'processed' AND (COALESCE(processed_at, updated_at) AT TIME ZONE $1)::date = day.today) AS refunds,
       -- Rooms that were occupied last night, for "yesterday" beside today's occupancy.
       (SELECT count(*)::int FROM bookings, day
         WHERE status IN ('checked_in', 'checked_out') AND check_in < day.today AND check_out >= day.today) AS in_house_yesterday,
       -- Arrivals over the coming week, a day at a time.
       (SELECT COALESCE(json_agg(json_build_object('date', d.day::date, 'arrivals',
                 (SELECT count(*)::int FROM bookings b WHERE b.status IN ('paid', 'confirmed') AND b.check_in = d.day::date)) ORDER BY d.day), '[]')
          FROM day, generate_series(day.today + 1, day.today + 7, interval '1 day') AS d(day)) AS coming_week,
       (SELECT count(*)::int FROM bookings, day WHERE status = 'confirmed' AND check_in <= day.today) AS arrivals,
       (SELECT count(*)::int FROM bookings, day WHERE status = 'checked_in' AND check_out <= day.today) AS departures,
       (SELECT count(*)::int FROM bookings WHERE status = 'checked_in') AS in_house,
       (SELECT count(*)::int FROM bookings WHERE status = 'paid') AS awaiting_approval,
       (SELECT min(hold_expires_at) FROM bookings WHERE status = 'paid') AS approval_deadline,
       (SELECT count(*)::int FROM refunds WHERE status = 'pending' AND method <> 'razorpay') AS pending_refunds,
       (SELECT count(*)::int FROM room_units WHERE is_active) AS rooms,
       (SELECT count(*)::int FROM room_units WHERE is_active AND status <> 'Ready') AS rooms_not_ready,
       (SELECT count(*)::int FROM food_orders WHERE status IN ('new', 'preparing', 'ready')) AS open_food_orders,
       (SELECT count(*)::int FROM food_orders WHERE status <> 'cancelled' AND paid_at IS NULL
          AND created_at > now() - interval '3 days') AS unpaid_food_orders,
       (SELECT count(*)::int FROM room_issues WHERE status = 'open') AS open_room_issues`,
    [TIMEZONE]
  );
  const r = rows[0];
  res.json({
    success: true,
    stats: {
      paymentsToday: Number(r.payments),
      paymentsYesterday: Number(r.payments_yesterday),
      refundsToday: Number(r.refunds),
      inHouseYesterday: r.in_house_yesterday,
      comingWeek: r.coming_week, // [{ date, arrivals }] for the next seven days
      arrivals: r.arrivals,
      departures: r.departures,
      inHouse: r.in_house,
      awaitingApproval: r.awaiting_approval,
      approvalDeadline: r.approval_deadline, // when the first unapproved booking auto-cancels, or null
      pendingRefunds: r.pending_refunds,
      rooms: r.rooms,
      roomsNotReady: r.rooms_not_ready,
      openFoodOrders: r.open_food_orders,
      unpaidFoodOrders: r.unpaid_food_orders, // not cancelled, not yet marked paid, last 3 days
      openRoomIssues: r.open_room_issues, // problems housekeeping reported, not yet resolved
    },
  });
});

module.exports = {
  login,
  logout,
  addRoom,
  updateRoom,
  deleteRoom,
  listAllRooms,
  listAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  listAllMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listFoodOrders,
  updateFoodOrderStatus,
  uploadImage,
  getSettings,
  updateSettings,
  getOrderLinks,
  todayStats,
};
