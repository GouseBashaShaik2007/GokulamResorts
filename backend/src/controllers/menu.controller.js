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

// GET /api/menu/items
const getMenuItems = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const params = [];
  let where = 'WHERE mi.is_available = true';
  if (category) {
    params.push(category);
    where += ` AND mi.category_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT mi.id, mi.category_id, mi.name, mi.description, mi.price, mi.image, mi.is_veg, mi.spice_adjustable,
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
