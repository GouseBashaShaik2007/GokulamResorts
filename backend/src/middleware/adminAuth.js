const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const { tokenFor } = require('../utils/session');

// Protects /api/admin/* routes (except /admin/login and /admin/logout).
// The sign-in travels in the gk_admin cookie (see utils/session.js).
function adminAuth(req, res, next) {
  const token = tokenFor(req, 'admin');
  if (!token) {
    return next(new ApiError(401, 'Please sign in'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return next(new ApiError(403, 'Admin privileges required'));
    }
    req.admin = payload;
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = adminAuth;
