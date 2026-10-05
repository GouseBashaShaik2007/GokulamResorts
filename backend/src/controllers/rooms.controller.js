const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const { BLOCKING } = require('../services/booking.service');
const { localToday, addDays } = require('../utils/dates');

// Room types with how many bookable physical rooms each has.
const ROOM_TYPE_SELECT = `
  SELECT r.id, r.name, r.slug, r.description, r.price_per_night, r.capacity,
         r.size_sqft, r.bed_type, r.amenities, r.images,
         r.breakfast_included, r.extra_bed_available, r.extra_bed_charge, r.smoking_allowed, r.wheelchair_accessible,
         (SELECT count(*)::int FROM room_units ru WHERE ru.room_type_id = r.id AND ru.is_active) AS units_count,
         COALESCE((SELECT array_agg(DISTINCT ru.view_label ORDER BY ru.view_label) FROM room_units ru
                   WHERE ru.room_type_id = r.id AND ru.is_active AND ru.view_label IS NOT NULL), '{}') AS views
  FROM rooms r`;

// GET /api/rooms
const getRooms = asyncHandler(async (req, res) => {
  const { rows } = await query(`${ROOM_TYPE_SELECT} WHERE r.is_active = true ORDER BY r.price_per_night ASC`);
  res.json({ success: true, rooms: rows });
});

// GET /api/rooms/:id
const getRoomById = asyncHandler(async (req, res) => {
  const { rows } = await query(`${ROOM_TYPE_SELECT} WHERE r.id = $1 AND r.is_active = true`, [req.params.id]);
  if (rows.length === 0) {
    throw new ApiError(404, 'Room not found');
  }
  res.json({ success: true, room: rows[0] });
});

// GET /api/rooms/:id/full-nights?from=YYYY-MM-DD&to=YYYY-MM-DD
// The nights in that range on which every room of this type is taken, so the
// calendar can grey them out before the guest picks them. A hint, not a
// promise: a stay also needs the SAME room free every night, which only the
// availability check decides. Defaults to the next 6 months; at most a year.
const getFullNights = asyncHandler(async (req, res) => {
  const today = await localToday();
  const from = req.query.from && req.query.from > today ? String(req.query.from).slice(0, 10) : today;
  const limit = addDays(from, 366);
  const wanted = req.query.to ? String(req.query.to).slice(0, 10) : addDays(from, 183);
  const to = wanted > limit ? limit : wanted;

  const { rows } = await query(
    `SELECT n.night::date::text AS night
     FROM generate_series($2::date, $3::date, interval '1 day') AS n(night)
     WHERE EXISTS (SELECT 1 FROM room_units ru WHERE ru.room_type_id = $1 AND ru.is_active)
       AND NOT EXISTS (
         SELECT 1 FROM room_units ru
         WHERE ru.room_type_id = $1 AND ru.is_active
           AND NOT EXISTS (
             SELECT 1 FROM bookings b
             WHERE b.room_unit_id = ru.id AND b.status = ANY($4)
               AND b.check_in <= n.night::date AND b.check_out > n.night::date
           )
       )
     ORDER BY n.night`,
    [req.params.id, from, to, BLOCKING]
  );
  res.set('Cache-Control', 'public, max-age=30').json({ success: true, from, to, nights: rows.map((r) => r.night) });
});

module.exports = { getRooms, getRoomById, getFullNights };
