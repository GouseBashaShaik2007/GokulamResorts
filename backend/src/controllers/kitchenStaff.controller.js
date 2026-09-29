const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/admin/kitchen-staff
const listKitchenStaff = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, is_active, created_at, updated_at FROM kitchen_staff ORDER BY name`
  );
  res.json({ success: true, staff: rows });
});

// POST /api/admin/kitchen-staff
// Body: { name, pin }
const addKitchenStaff = asyncHandler(async (req, res) => {
  const { name, pin } = req.body;
  const pinHash = await bcrypt.hash(pin, 10);
  const { rows } = await query(
    `INSERT INTO kitchen_staff (name, pin_hash) VALUES ($1, $2)
     RETURNING id, name, is_active, created_at`,
    [name, pinHash]
  );
  res.status(201).json({ success: true, staff: rows[0] });
});

// PUT /api/admin/kitchen-staff/:id
// Body: { name?, pin?, isActive? }
const updateKitchenStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, pin, isActive } = req.body;

  const sets = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(name);
  }
  if (pin !== undefined) {
    sets.push(`pin_hash = $${i++}`);
    values.push(await bcrypt.hash(pin, 10));
  }
  if (isActive !== undefined) {
    sets.push(`is_active = $${i++}`);
    values.push(isActive);
  }

  if (sets.length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE kitchen_staff SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i}
     RETURNING id, name, is_active, updated_at`,
    values
  );

  if (rows.length === 0) {
    throw new ApiError(404, 'Kitchen staff member not found');
  }

  res.json({ success: true, staff: rows[0] });
});

module.exports = { listKitchenStaff, addKitchenStaff, updateKitchenStaff };
