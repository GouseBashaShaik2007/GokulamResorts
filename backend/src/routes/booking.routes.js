const { Router } = require('express');
const { body, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { getAvailability, createBooking, lookup } = require('../controllers/booking.controller');

const router = Router();

// Slows down guessing booking id + phone pairs on the public status page.
const lookupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

const dateRange = [
  query('checkIn').isISO8601().withMessage('checkIn must be a date (YYYY-MM-DD)'),
  query('checkOut').isISO8601().withMessage('checkOut must be a date (YYYY-MM-DD)'),
];

router.get(
  '/availability',
  [...dateRange, query('roomTypeId').optional().isInt({ min: 1 }), query('guests').optional().isInt({ min: 1, max: 20 })],
  validate,
  getAvailability
);

// Shared by online and counter bookings.
const guestFields = [
  body('roomUnitId').isInt({ min: 1 }).toInt().withMessage('Choose a room'),
  body('checkIn').isISO8601().withMessage('checkIn must be a date (YYYY-MM-DD)'),
  body('checkOut').isISO8601().withMessage('checkOut must be a date (YYYY-MM-DD)'),
  body('adults').isInt({ min: 1, max: 20 }).toInt().withMessage('At least one adult is required'),
  body('children').optional().isInt({ min: 0, max: 20 }).toInt(),
  body('name').trim().notEmpty().isLength({ max: 150 }).withMessage('Name is required'),
  body('phone')
    .trim()
    .matches(/^\+?[\d\s-]{10,20}$/)
    .withMessage('A valid phone number is required'),
  body('specialRequests').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 1000 }),
];

router.post(
  '/book-room',
  [...guestFields, body('email').isEmail().withMessage('A valid email is required').normalizeEmail()],
  validate,
  createBooking
);

router.get(
  '/bookings/lookup',
  lookupLimiter,
  [
    query('reference').trim().matches(/^GKL-[A-Z0-9]{5}$/i).withMessage('A valid booking reference is required'),
    query('phone').trim().notEmpty(),
  ],
  validate,
  lookup
);

module.exports = router;
module.exports.guestFields = guestFields;
