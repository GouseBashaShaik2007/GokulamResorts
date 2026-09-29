const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/auditLog');

// POST /api/kitchen/login
// Body: { pin }
//
// Each cook has their own PIN (see kitchen_staff) instead of one shared
// device password, so order actions can be attributed to a person. A PIN
// alone doesn't say who typed it, so we scan active kitchen staff and
// bcrypt-compare against each hash — fine at kitchen-team scale (a small,
// fixed roster), and avoids storing PINs in any directly-lookupable form.
const login = asyncHandler(async (req, res) => {
  const { pin } = req.body;

  if (!/^\d{4,6}$/.test(String(pin || ''))) {
    throw new ApiError(400, 'PIN must be 4-6 digits');
  }

  const { rows } = await query(
    `SELECT id, name, pin_hash FROM kitchen_staff WHERE is_active = true ORDER BY id`
  );

  let matched = null;
  for (const staff of rows) {
    // eslint-disable-next-line no-await-in-loop -- small fixed roster, sequential is fine
    if (await bcrypt.compare(pin, staff.pin_hash)) {
      matched = staff;
      break;
    }
  }

  if (!matched) {
    throw new ApiError(401, 'PIN not recognized');
  }

  const token = jwt.sign(
    { sub: matched.id, name: matched.name, role: 'kitchen' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.KITCHEN_JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '12h' }
  );

  logAction({ actorType: 'kitchen', actorId: matched.id, action: 'kitchen_sign_in', details: { name: matched.name } });

  res.json({ success: true, token, staff: { id: matched.id, name: matched.name } });
});

module.exports = { login };
