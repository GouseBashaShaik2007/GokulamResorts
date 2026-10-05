const { query } = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/menu/categories
const getCategories = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, slug, sort_order
     FROM menu_categories
     WHERE is_active = true
     ORDER BY sort_order ASC, name ASC`
  );
  res.json({ success: true, categories: rows });
});

// GET /api/menu/items            — dishes that can be ordered now
// GET /api/menu/items?all=1      — also the ones marked sold out (is_available
//   false), so an ordering screen can show them greyed instead of dropping them.
//   Dishes in a hidden category are never sent.
const getMenuItems = asyncHandler(async (req, res) => {
  const { category, all } = req.query;

  const params = [];
  let where = all === '1' ? 'WHERE mc.is_active = true' : 'WHERE mi.is_available = true';
  if (category) {
    params.push(category);
    where += ` AND mi.category_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT mi.id, mi.category_id, mi.name, mi.description, mi.price, mi.image, mi.is_veg, mi.spice_adjustable, mi.is_available,
            mi.allergens, mi.is_jain, mi.spice_rating,
            mc.name AS category_name, mc.slug AS category_slug
     FROM menu_items mi
     JOIN menu_categories mc ON mc.id = mi.category_id
     ${where}
     ORDER BY mc.sort_order ASC, mi.name ASC`,
    params
  );
  res.json({ success: true, items: rows });
});

module.exports = { getCategories, getMenuItems };
