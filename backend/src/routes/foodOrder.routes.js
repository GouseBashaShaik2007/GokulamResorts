const { Router } = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { createOrder, getOrderById, getQueue } = require('../controllers/foodOrder.controller');

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

router.post(
  '/food-orders',
  orderLimiter,
  [
    body('orderType').isIn(['table', 'kiosk']).withMessage('orderType must be "table" or "kiosk"'),
    // Tables are numbered 1–100: the range Admin → QR Codes prints. Anything
    // else never came from a table card, so it must not reach the kitchen.
    body('tableNumber')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .matches(/^([1-9]\d?|100)$/)
      .withMessage('Unknown table number'),
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

// How many orders the kitchen is working through — shown in the cart instead of a guessed wait time.
router.get('/food-orders/queue', getQueue);

router.get('/food-orders/:id', [param('id').isInt({ min: 1 })], validate, getOrderById);

module.exports = router;
