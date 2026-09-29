const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const publicImage = require('../services/publicImage.service');
const { logAction } = require('../utils/auditLog');

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

  res.json({ success: true, token, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

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
  } = req.body;

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { rows } = await query(
    `INSERT INTO rooms
      (name, slug, description, price_per_night, capacity, total_rooms, size_sqft, bed_type, amenities, images)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
  ];
  // Accept both camelCase (from the admin UI) and snake_case keys.
  const map = {
    pricePerNight: 'price_per_night',
    totalRooms: 'total_rooms',
    sizeSqft: 'size_sqft',
    bedType: 'bed_type',
    isActive: 'is_active',
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
  const { categoryId, name, description, price, image, isVeg, spiceAdjustable } = req.body;

  const { rows } = await query(
    `INSERT INTO menu_items (category_id, name, description, price, image, is_veg, spice_adjustable)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [categoryId, name, description || '', price, image || null, isVeg !== false, spiceAdjustable === true]
  );

  res.status(201).json({ success: true, item: rows[0] });
});

// PUT /api/admin/menu/items/:id
const updateMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  const allowed = ['category_id', 'name', 'description', 'price', 'image', 'is_veg', 'is_available', 'spice_adjustable'];
  const map = {
    categoryId: 'category_id',
    isVeg: 'is_veg',
    spiceAdjustable: 'spice_adjustable',
    isAvailable: 'is_available',
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
const listFoodOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'WHERE status = $1';
  }

  const { rows: orders } = await query(
    `SELECT id, order_type, table_number, customer_name, customer_phone, notes,
            total_amount, status, created_at, updated_at
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
    `SELECT order_id, item_name, unit_price, quantity, line_total
     FROM food_order_items
     WHERE order_id = ANY($1)`,
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
  const { status } = req.body;

  if (!FOOD_ORDER_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${FOOD_ORDER_STATUSES.join(', ')}`);
  }

  const { rows } = await query(
    `UPDATE food_orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status`,
    [status, id]
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Order not found');
  }

  logAction({ actorType: 'admin', actorId: req.admin?.sub, action: 'food_order_status_change', details: { orderId: rows[0].id, status } });

  res.json({ success: true, order: rows[0] });
});

// POST /api/admin/upload-image?type=food|room
// GET /api/admin/settings
const getSettings = asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT site_url, updated_at FROM resort_settings WHERE id = 1');
  res.json({ success: true, settings: rows[0] || { site_url: '', updated_at: null } });
});

// PUT /api/admin/settings
// Currently just the production site URL used to build table/kiosk QR codes.
// Deliberately never defaulted to the request's own origin — an admin must
// type the real domain, or QR codes silently point at localhost/whatever
// dev machine generated them.
const updateSettings = asyncHandler(async (req, res) => {
  const { siteUrl } = req.body;

  let normalized = String(siteUrl || '').trim().replace(/\/+$/, '');
  if (normalized) {
    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new ApiError(400, 'Site address must be a full URL, e.g. https://gokulamresorts.in');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ApiError(400, 'Site address must start with http:// or https://');
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
      throw new ApiError(400, 'Site address cannot be a localhost/dev address — QR codes must point at the real production site');
    }
    normalized = parsed.toString().replace(/\/+$/, '');
  }

  const { rows } = await query(
    `UPDATE resort_settings SET site_url = $1, updated_by = $2, updated_at = now() WHERE id = 1
     RETURNING site_url, updated_at`,
    [normalized, req.admin?.sub || null]
  );

  res.json({ success: true, settings: rows[0] });
});

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

module.exports = {
  login,
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
};
