const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('./errorHandler');

// Protects /api/desk/* — front desk operations that a manager can also do.
// Accepts an admin (manager) token or an active FrontDesk staff token and sets
// req.actor = { type: 'admin' | 'staff', id, name }.
async function deskAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header'));
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }

  try {
    if (payload.role === 'admin') {
      req.actor = { type: 'admin', id: payload.sub };
      return next();
    }
    if (payload.role === 'staff') {
      const { rows } = await query(`SELECT id, name, role, is_active FROM staff WHERE id = $1`, [payload.sub]);
      const staff = rows[0];
      if (!staff || !staff.is_active) return next(new ApiError(401, 'Staff account is inactive'));
      if (staff.role !== 'FrontDesk') return next(new ApiError(403, 'Front desk access required'));
      req.actor = { type: 'staff', id: staff.id, name: staff.name };
      return next();
    }
    next(new ApiError(403, 'Front desk access required'));
  } catch (err) {
    next(err);
  }
}

module.exports = deskAuth;
