// Manager-only booking decisions, ID document access and price promotions.
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const bookings = require('../services/booking.service');
const { audit } = require('../services/audit');
const { isoDate } = require('../utils/dates');

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
  // `discounts` is the older name for the same list.
  res.json({ success: true, offers: rows, discounts: rows });
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

const RATE_DISCOUNT_FIELDS = {
  isActive: 'is_active',
  name: 'name',
  roomTypeId: 'room_type_id',
  discountType: 'discount_type',
  value: 'value',
  startDate: 'start_date',
  endDate: 'end_date',
  reason: 'reason',
};

// PUT /api/admin/rate-discounts/:id — { isActive } switches a promotion on or
// off; any other field edits it. Bookings already made keep the price they
// were quoted (their discount is stored on the booking).
const updateRateDiscount = asyncHandler(async (req, res) => {
  const { rows: existing } = await query(`SELECT * FROM rate_discounts WHERE id = $1`, [id(req)]);
  if (existing.length === 0) throw new ApiError(404, 'Promotion not found');
  const before = existing[0];

  const changed = Object.keys(RATE_DISCOUNT_FIELDS).filter((field) => req.body[field] !== undefined);
  if (changed.length === 0) throw new ApiError(400, 'No valid fields provided to update');

  // Check the result as a whole: one field may be changing against another that isn't.
  const after = {
    discountType: req.body.discountType ?? before.discount_type,
    value: Number(req.body.value ?? before.value),
    startDate: String(req.body.startDate ?? isoDate(before.start_date)).slice(0, 10),
    endDate: String(req.body.endDate ?? isoDate(before.end_date)).slice(0, 10),
  };
  if (after.endDate < after.startDate) throw new ApiError(400, 'End date must be on or after the start date');
  if (after.discountType === 'percent' && after.value > 100) throw new ApiError(400, 'A percentage discount cannot exceed 100');

  const values = changed.map((field) => req.body[field]);
  const setClauses = changed.map((field, i) => `${RATE_DISCOUNT_FIELDS[field]} = $${i + 1}`);
  values.push(id(req));
  let rows;
  try {
    ({ rows } = await query(
      `UPDATE rate_discounts SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING *`,
      values
    ));
  } catch (err) {
    if (err.code === '23503') throw new ApiError(400, 'Room type not found');
    throw err;
  }

  const onlySwitch = changed.length === 1 && changed[0] === 'isActive';
  await audit({ query }, {
    actor: manager(req),
    action: onlySwitch ? (req.body.isActive ? 'promotion_enabled' : 'promotion_disabled') : 'promotion_updated',
    details: onlySwitch ? { id: rows[0].id, name: rows[0].name } : { before, after: rows[0] },
  });
  res.json({ success: true, discount: rows[0] });
});

// DELETE /api/admin/rate-discounts/:id — remove a promotion for good.
const deleteRateDiscount = asyncHandler(async (req, res) => {
  const { rows } = await query(`DELETE FROM rate_discounts WHERE id = $1 RETURNING *`, [id(req)]);
  if (rows.length === 0) throw new ApiError(404, 'Promotion not found');
  await audit({ query }, { actor: manager(req), action: 'promotion_deleted', details: rows[0] });
  res.json({ success: true });
});

module.exports = {
  approve,
  reject,
  cancel,
  discount,
  documentUrl,
  listRateDiscounts,
  addRateDiscount,
  updateRateDiscount,
  deleteRateDiscount,
};
