const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { createOrder, verifyPayment, webhook, documentFile } = require('../controllers/payment.controller');

const router = Router();

// Modest rate limit on payment endpoints to slow down brute-force signature guessing.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/create-order',
  paymentLimiter,
  [
    body('bookingId').isInt({ min: 1 }).withMessage('bookingId must be a positive integer'),
    body('phone').trim().notEmpty().withMessage('phone is required'),
  ],
  validate,
  createOrder
);

router.post(
  '/verify-payment',
  paymentLimiter,
  [
    body('bookingId').isInt({ min: 1 }).withMessage('bookingId must be a positive integer'),
    body('razorpay_order_id').isString().notEmpty(),
    body('razorpay_payment_id').isString().notEmpty(),
    body('razorpay_signature').isString().notEmpty(),
  ],
  validate,
  verifyPayment
);

// Signature-checked against the raw body (captured in server.js).
router.post('/razorpay/webhook', webhook);

router.get('/documents/file', documentFile);

module.exports = router;
