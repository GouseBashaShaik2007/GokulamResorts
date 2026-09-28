const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('./errorHandler');

// Protects /api/staff/* routes (except /staff/login).
// Expects: Authorization: Bearer <jwt>
// Re-checks the staff row on every request so deactivating someone in the
// admin panel cuts off their access immediately, not when the token expires.
async function staffAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header'));
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
