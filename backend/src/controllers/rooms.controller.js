const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');

// Room types with how many bookable physical rooms each has.
const ROOM_TYPE_SELECT = `
  SELECT r.id, r.name, r.slug, r.description, r.price_per_night, r.capacity,
         r.size_sqft, r.bed_type, r.amenities, r.images,
         (SELECT count(*)::int FROM room_units ru WHERE ru.room_type_id = r.id AND ru.is_active) AS units_count
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

module.exports = { getRooms, getRoomById };
