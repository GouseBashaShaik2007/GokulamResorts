const { Router } = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { createCheckout, confirmCheckout, getCheckout, abandonCheckout } = require('../controllers/checkout.controller');

const router = Router();

// The kiosk is one tablet, and a whole hotel can share one Wi-Fi address, so
// this is generous: it only has to stop a script that has got hold of a key
// from flooding the payment gateway.
const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please order with our staff.' },
});

const tokenParam = [param('token').matches(/^[A-Za-z0-9_-]{16,40}$/)];

router.post(
  '/',
  checkoutLimiter,
  [
    body('orderType').isIn(['kiosk', 'room']).withMessage('orderType must be "kiosk" or "room"'),
    body('accessKey').isString().isLength({ min: 1, max: 40 }),
    body('roomNumber').optional({ nullable: true, checkFalsy: true }).isString().matches(/^[A-Za-z0-9-]{1,20}$/).withMessage('Unknown room'),
    body('customerName').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 150 }),
    body('customerPhone').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 20 }),
    body('items').isArray({ min: 1, max: 60 }).withMessage('items must be a non-empty array'),
    body('items.*.menuItemId').isInt({ min: 1 }),
    body('items.*.quantity').isInt({ min: 1, max: 20 }),
    body('items.*.spiceLevel').optional({ nullable: true }).isIn(['mild', 'medium', 'hot']),
    body('items.*.notes').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 300 }),
    body('notes').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 1000 }),
    body('expectedTotal').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  validate,
  createCheckout
);

router.post(
  '/:token/confirm',
  checkoutLimiter,
  [
    ...tokenParam,
    body('razorpay_order_id').isString().notEmpty().isLength({ max: 60 }),
    body('razorpay_payment_id').isString().notEmpty().isLength({ max: 60 }),
    body('razorpay_signature').isString().notEmpty().isLength({ max: 200 }),
  ],
  validate,
  confirmCheckout
);

router.get('/:token', checkoutLimiter, [...tokenParam, query('check').optional().isIn(['1'])], validate, getCheckout);
router.post('/:token/abandon', checkoutLimiter, tokenParam, validate, abandonCheckout);

module.exports = router;
