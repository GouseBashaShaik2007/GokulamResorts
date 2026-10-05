const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('./errorHandler');
const { tokenFor } = require('../utils/session');

// Protects /api/staff/* routes (except the sign-in ones).
// The sign-in travels in the gk_staff cookie (see utils/session.js).
// Re-checks the staff row on every request so deactivating someone in the
// admin panel cuts off their access immediately, not when the token expires.
async function staffAuth(req, res, next) {
  const token = tokenFor(req, 'staff');
  if (!token) {
    return next(new ApiError(401, 'Please sign in'));
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
  if (payload.role !== 'staff') {
    return next(new ApiError(403, 'Staff access required'));
  }

  try {
    const { rows } = await query(`SELECT id, name, phone, role, is_active FROM staff WHERE id = $1`, [
      payload.sub,
    ]);
    if (rows.length === 0 || !rows[0].is_active) {
      return next(new ApiError(401, 'Staff account is inactive'));
    }
    req.staff = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = staffAuth;
