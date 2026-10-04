const { Router } = require('express');
const { param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { getRooms, getRoomById, getFullNights } = require('../controllers/rooms.controller');

const router = Router();

// The calendar asks once per room page; this only stops a script hammering it.
const calendarLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in a few minutes.' },
});

router.get('/', getRooms);
router.get(
  '/:id/full-nights',
  calendarLimiter,
  [param('id').isInt({ min: 1 }), query('from').optional().isISO8601({ strict: true }), query('to').optional().isISO8601({ strict: true })],
  validate,
  getFullNights
);
router.get('/:id', getRoomById);

module.exports = router;
