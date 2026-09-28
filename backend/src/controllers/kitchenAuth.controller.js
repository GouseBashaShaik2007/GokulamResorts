const jwt = require('jsonwebtoken');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/kitchen/login
// Kitchen devices share a single password (KITCHEN_PASSWORD) rather than
// per-user accounts — there's no admins-style table for kitchen staff.
const login = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!process.env.KITCHEN_PASSWORD || password !== process.env.KITCHEN_PASSWORD) {
    throw new ApiError(401, 'Incorrect kitchen password');
  }

  const token = jwt.sign({ role: 'kitchen' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  res.json({ success: true, token });
});

module.exports = { login };
