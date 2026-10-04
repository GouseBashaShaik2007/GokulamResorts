// Public, read-only facts the guest site shows: how to reach the resort, and
// the offers running now. Both are edited in the admin panel.
const { query } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const { localToday } = require('../utils/dates');

// GET /api/site-info — empty strings mean "not set yet"; the site then shows
// nothing rather than a made-up number.
const getSiteInfo = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT phone, whatsapp, email, address, maps_url, check_in_time, check_out_time
     FROM resort_settings WHERE id = 1`
  );
  res.set('Cache-Control', 'public, max-age=60').json({ success: true, info: rows[0] || {} });
});

// GET /api/offers — promotions that are switched on and not yet over. These
// are the same rules the booking price uses, so what is advertised is what is
// charged. The internal reason for a promotion is not sent.
const getOffers = asyncHandler(async (req, res) => {
  const today = await localToday();
  const { rows } = await query(
    `SELECT rd.id, rd.name, rd.discount_type, rd.value, rd.start_date::text AS start_date, rd.end_date::text AS end_date,
            rd.room_type_id, r.name AS room_type, r.slug AS room_slug
     FROM rate_discounts rd
     LEFT JOIN rooms r ON r.id = rd.room_type_id
     WHERE rd.is_active AND rd.end_date >= $1 AND (r.id IS NULL OR r.is_active)
     ORDER BY rd.start_date, rd.id`,
    [today]
  );
  res.set('Cache-Control', 'public, max-age=60').json({ success: true, offers: rows });
});

module.exports = { getSiteInfo, getOffers };
