const { Router } = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { checkAccess, createOrder, getOrderByToken, cancelOwnOrder, getQueue, createTableRequest } = require('../controllers/foodOrder.controller');

const router = Router();

// A whole restaurant can share one Wi-Fi address, so this is generous: it is
// there to stop a script flooding the kitchen, not to slow down diners.
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many orders in a short time. Please ask our staff for help.' },
});

// Stops someone trying keys until one fits.
const accessLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please ask our staff for help.' },
});

// Tables are numbered from 1; how many exist is set in Admin -> QR Codes and
// checked together with the key. The pattern only keeps junk out early.
const tableNumberField = (name) => body(name).isString().matches(/^[1-9]\d{0,2}$/).withMessage('Unknown table number');

router.get(
  '/order-access',
  accessLimiter,
  [query('type').isIn(['table', 'counter', 'kiosk', 'room']), query('table').optional().matches(/^[1-9]\d{0,2}$/), query('room').optional().matches(/^[A-Za-z0-9-]{1,20}$/), query('k').isString().isLength({ min: 1, max: 40 })],
  validate,
  checkAccess
);

router.post(
  '/food-orders',
  orderLimiter,
  [
    // 'kiosk' is still accepted as the counter's older name (see the controller).
    body('orderType').isIn(['table', 'counter', 'room', 'kiosk']).withMessage('orderType must be "table", "counter" or "room"'),
    body('roomNumber').optional({ nullable: true, checkFalsy: true }).isString().matches(/^[A-Za-z0-9-]{1,20}$/).withMessage('Unknown room'),
    body('accessKey').optional({ nullable: true }).isString().isLength({ max: 40 }),
    tableNumberField('tableNumber').optional({ nullable: true, checkFalsy: true }),
    body('customerName').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 150 }),
    body('customerPhone').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 20 }),
    body('notes').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 1000 }),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.menuItemId').isInt({ min: 1 }),
    body('items.*.quantity').isInt({ min: 1, max: 20 }),
    body('items.*.spiceLevel').optional({ nullable: true }).isIn(['mild', 'medium', 'hot']),
    body('items.*.notes').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 300 }),
  ],
  validate,
  createOrder
);

router.post(
  '/table-requests',
  orderLimiter,
  [tableNumberField('tableNumber'), body('kind').isIn(['staff', 'bill']), body('accessKey').isString().isLength({ min: 1, max: 40 })],
  validate,
  createTableRequest
);

// How many orders the kitchen is working through — shown in the cart instead of a guessed wait time.
router.get('/food-orders/queue', getQueue);

// By private token only (never by order number, which is guessable).
const tokenParam = [param('token').matches(/^[A-Za-z0-9_-]{16,40}$/)];
router.get('/food-orders/:token', tokenParam, validate, getOrderByToken);
router.post('/food-orders/:token/cancel', orderLimiter, tokenParam, validate, cancelOwnOrder);

module.exports = router;
