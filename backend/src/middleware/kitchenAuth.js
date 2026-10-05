const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const { tokenFor } = require('../utils/session');

// Protects /api/kitchen/* routes (except the sign-in ones).
// The sign-in travels in the gk_kitchen cookie (see utils/session.js).
// Separate from adminAuth on purpose: a kitchen sign-in is a short PIN and
// must not carry the room, booking or menu privileges a manager's has.
function kitchenAuth(req, res, next) {
  const token = tokenFor(req, 'kitchen');
  if (!token) {
    return next(new ApiError(401, 'Please sign in'));
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
