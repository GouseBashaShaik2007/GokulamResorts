const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');

// Protects /api/admin/* routes (except /admin/login).
// Expects: Authorization: Bearer <jwt>
function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header'));
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
