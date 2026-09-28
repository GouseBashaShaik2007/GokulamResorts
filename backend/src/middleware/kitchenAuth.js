const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');

// Protects /api/kitchen/* routes (except /kitchen/login).
// Expects: Authorization: Bearer <jwt>
// Separate from adminAuth on purpose: kitchen devices share a single password
// and should not carry the room/booking/menu edit privileges an admin token has.
function kitchenAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'kitchen') {
      return next(new ApiError(403, 'Kitchen access required'));
    }
    req.kitchen = payload;
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = kitchenAuth;
