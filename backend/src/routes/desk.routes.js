const { Router } = require('express');
const { body, param, query } = require('express-validator');
const multer = require('multer');
const validate = require('../middleware/validate');
const deskAuth = require('../middleware/deskAuth');
const { ApiError } = require('../middleware/errorHandler');
const { ALLOWED_TYPES } = require('../services/storage.service');
const { guestFields } = require('./booking.routes');
const desk = require('../controllers/desk.controller');

const router = Router();

// ID uploads are held in memory only long enough to stream them to storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    ALLOWED_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'ID must be a JPG, PNG, WEBP or PDF')),
});

const METHODS = ['cash', 'upi', 'card'];
const bookingId = [param('id').isInt({ min: 1 })];
const methodField = (name) => body(name).isIn(METHODS).withMessage('Payment method must be cash, upi or card');
const referenceField = (name) =>
  body(name)
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('A payment reference (receipt no. / UTR / card slip) is required');

router.use(deskAuth);

router.get('/overview', desk.overview);
router.get('/rooms', desk.rooms);
router.get('/bookings', desk.list);
router.get('/bookings/:id', bookingId, validate, desk.detail);
router.get(
  '/availability',
  [query('checkIn').isISO8601(), query('checkOut').isISO8601(), query('guests').optional().isInt({ min: 1, max: 20 })],
  validate,
  desk.availability
);

router.post(
  '/bookings',
  [
    ...guestFields,
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
    methodField('paymentMethod'),
    referenceField('paymentReference'),
  ],
  validate,
  desk.createCounterBooking
);

router.post(
  '/bookings/:id/payments',
  [...bookingId, body('amount').isFloat({ gt: 0 }).toFloat(), methodField('method'), referenceField('reference')],
  validate,
  desk.recordPayment
);

router.post(
  '/bookings/:id/documents',
  upload.single('file'),
  [
    ...bookingId,
    body('guestName').trim().notEmpty().isLength({ max: 150 }),
    body('idType').isIn(['Aadhaar', 'Passport', 'DrivingLicense']),
    body('idLast4')
      .trim()
      .matches(/^[A-Za-z0-9]{4}$/)
      .withMessage('Enter only the last 4 characters of the ID number'),
    body('isPrimary').isIn(['true', 'false']),
    body('nationality').optional().trim().isLength({ max: 60 }),
    body('maskedConfirmed').optional().isIn(['true', 'false']),
  ],
  validate,
  desk.addDocument
);

router.delete(
  '/bookings/:id/documents/:docId',
  [...bookingId, param('docId').isInt({ min: 1 })],
  validate,
  desk.removeDocument
);

router.post('/bookings/:id/check-in', bookingId, validate, desk.checkIn);
router.post('/bookings/:id/extend', [...bookingId, body('checkOut').isISO8601()], validate, desk.extend);
router.post('/bookings/:id/check-out', bookingId, validate, desk.checkOut);
router.post('/bookings/:id/no-show', bookingId, validate, desk.noShow);

router.post(
  '/refunds/:id/complete',
  [param('id').isInt({ min: 1 }), methodField('method'), referenceField('reference')],
  validate,
  desk.completeRefund
);

module.exports = router;
