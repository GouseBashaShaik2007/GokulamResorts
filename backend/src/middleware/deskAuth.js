const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('./errorHandler');
const { bearerToken, readCookies, COOKIES } = require('../utils/session');

// Protects /api/desk/* — front desk operations that a manager can also do.
// Accepts a manager's sign-in or an active FrontDesk staff member's and sets
// req.actor = { type: 'admin' | 'staff', id, name }.
//
// One browser can hold both sign-ins (the manager's and the front desk's), so
// the screen says which it is acting as in the X-Desk-As header: "admin" on
// the manager's Bookings page, "staff" on the front desk screen. That decides
// whose name goes on a check-in or a payment. Without the header, the
// manager's sign-in is used if there is one.
function deskToken(req) {
  const bearer = bearerToken(req);
  if (bearer) return bearer;
  const cookies = readCookies(req.headers.cookie);
  const as = String(req.headers['x-desk-as'] || '').toLowerCase();
  if (as === 'admin' || as === 'staff') return cookies[COOKIES[as]] || null;
  return cookies[COOKIES.admin] || cookies[COOKIES.staff] || null;
}

async function deskAuth(req, res, next) {
  const token = deskToken(req);
  if (!token) {
    return next(new ApiError(401, 'Please sign in'));
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
