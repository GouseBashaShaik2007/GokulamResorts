// Manager-only booking decisions, ID document access and price promotions.
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const bookings = require('../services/booking.service');
const { audit } = require('../services/audit');

const manager = (req) => ({ type: 'admin', id: req.admin.sub });
const id = (req) => Number(req.params.id);

// POST /api/admin/bookings/:id/approve
const approve = asyncHandler(async (req, res) => {
  res.json({ success: true, booking: await bookings.approve(id(req), manager(req)) });
});

// POST /api/admin/bookings/:id/reject — { reason }: full refund
const reject = asyncHandler(async (req, res) => {
  res.json({ success: true, booking: await bookings.reject(id(req), req.body.reason, manager(req)) });
});

// POST /api/admin/bookings/:id/cancel — { reason }: full refund (before check-in)
const cancel = asyncHandler(async (req, res) => {
  res.json({ success: true, booking: await bookings.cancel(id(req), req.body.reason, manager(req)) });
});

// POST /api/admin/bookings/:id/discount — { type: percent|fixed, value, reason }
const discount = asyncHandler(async (req, res) => {
  const { type, value, reason } = req.body;
  res.json({ success: true, booking: await bookings.applyDiscount(id(req), { type, value, reason }, manager(req)) });
});

// GET /api/admin/documents/:id/url — 60-second link to view one ID document (logged)
const documentUrl = asyncHandler(async (req, res) => {
  const apiBase = `${req.protocol}://${req.get('host')}/api`;
  res.json({ success: true, url: await bookings.documentViewUrl(id(req), manager(req), apiBase) });
});

// ----- Standing promotions -----

// GET /api/admin/rate-discounts
const listRateDiscounts = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT rd.*, r.name AS room_type FROM rate_discounts rd LEFT JOIN rooms r ON r.id = rd.room_type_id
     ORDER BY rd.is_active DESC, rd.start_date DESC`
  );
  res.json({ success: true, discounts: rows });
});

// POST /api/admin/rate-discounts
const addRateDiscount = asyncHandler(async (req, res) => {
  const { name, roomTypeId, discountType, value, startDate, endDate, reason } = req.body;
  if (endDate < startDate) throw new ApiError(400, 'End date must be on or after the start date');
  const { rows } = await query(
    `INSERT INTO rate_discounts (name, room_type_id, discount_type, value, start_date, end_date, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, roomTypeId || null, discountType, value, startDate, endDate, reason, req.admin.sub]
  );
  await audit({ query }, { actor: manager(req), action: 'promotion_created', details: rows[0] });
  res.status(201).json({ success: true, discount: rows[0] });
});

// PUT /api/admin/rate-discounts/:id — { isActive } (switch a promotion on/off)
const updateRateDiscount = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE rate_discounts SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [req.body.isActive, id(req)]
  );
  if (rows.length === 0) throw new ApiError(404, 'Promotion not found');
  await audit({ query }, {
    actor: manager(req),
    action: req.body.isActive ? 'promotion_enabled' : 'promotion_disabled',
    details: { id: rows[0].id, name: rows[0].name },
  });
  res.json({ success: true, discount: rows[0] });
});

module.exports = { approve, reject, cancel, discount, documentUrl, listRateDiscounts, addRateDiscount, updateRateDiscount };
