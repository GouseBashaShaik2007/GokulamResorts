const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { ApiError } = require('../middleware/errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/auditLog');
const { startSession, endSession } = require('../utils/session');
const { tileNames } = require('../utils/tiles');

// Compared against when the cook is unknown, so a wrong id and a wrong PIN
// take the same time to answer.
const NO_ONE = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 10);

// GET /api/kitchen/cooks — the name tiles on the kitchen sign-in screen.
// Public (the screen is shown before anyone has signed in): first names only.
const listCooks = asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT id, name FROM kitchen_staff WHERE is_active = true ORDER BY name, id`);
  res.json({ success: true, cooks: tileNames(rows) });
});

// POST /api/kitchen/login
// Body: { staffId, pin }
//
// The cook taps their name, then types their PIN, so a PIN is only ever
// checked against one person. (It used to be tried against every cook, which
// meant one guess had as many chances as there were cooks, and no two cooks
// could have the same PIN.)
const login = asyncHandler(async (req, res) => {
  const { staffId, pin } = req.body;

  const { rows } = await query(`SELECT id, name, pin_hash FROM kitchen_staff WHERE id = $1 AND is_active = true`, [staffId]);
  const cook = rows[0];
  const matches = await bcrypt.compare(String(pin), cook ? cook.pin_hash : NO_ONE);
  if (!cook || !matches) {
    throw new ApiError(401, 'Wrong PIN');
  }

  const token = jwt.sign(
    { sub: cook.id, name: cook.name, role: 'kitchen' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.KITCHEN_JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '12h' }
  );
  startSession(res, 'kitchen', token);

  logAction({ actorType: 'kitchen', actorId: cook.id, action: 'kitchen_sign_in', details: { name: cook.name } });

  res.json({ success: true, staff: { id: cook.id, name: cook.name } });
});

// POST /api/kitchen/logout
const logout = (req, res) => {
  endSession(res, 'kitchen');
  res.json({ success: true });
};

module.exports = { listCooks, login, logout };
