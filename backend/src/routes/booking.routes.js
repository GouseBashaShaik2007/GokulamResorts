const { Router } = require('express');
const { body, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { getAvailability, createBooking, lookup } = require('../controllers/booking.controller');

const router = Router();

// Slows down guessing booking id + phone pairs on the public status page.
const lookupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

// Holding a room takes it off sale for the hold period, so one address can't
// hold room after room and leave nothing for real guests.
const holdLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking attempts. Please wait a few minutes, or contact the resort.' },
});

// Each check prices every free room. Generous for a person changing dates,
// tight for a script.
const availabilityLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many availability checks. Please wait a minute and try again.' },
});

const dateRange = [
  query('checkIn').isISO8601().withMessage('checkIn must be a date (YYYY-MM-DD)'),
  query('checkOut').isISO8601().withMessage('checkOut must be a date (YYYY-MM-DD)'),
];

router.get(
  '/availability',
  availabilityLimiter,
  [...dateRange, query('roomTypeId').optional().isInt({ min: 1 }), query('guests').optional().isInt({ min: 1, max: 20 })],
  validate,
  getAvailability
);

// Shared by online and counter bookings: the stay and who it is for.
const stayFields = [
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

// A counter booking names the room; the front desk chooses it.
const guestFields = [body('roomUnitId').isInt({ min: 1 }).toInt().withMessage('Choose a room'), ...stayFields];

router.post(
  '/book-room',
  holdLimiter,
  [
    // A guest books a room type. (roomUnitId: what a page opened before room
    // numbers were hidden still sends; its type is used.)
    body('roomTypeId').optional().isInt({ min: 1 }).toInt(),
    body('roomUnitId').optional().isInt({ min: 1 }).toInt(),
    ...stayFields,
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  ],
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
