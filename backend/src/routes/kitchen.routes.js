const { Router } = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const kitchenAuth = require('../middleware/kitchenAuth');
const { listCooks, login, logout } = require('../controllers/kitchenAuth.controller');
const { listActiveOrders, updateOrderStatus, listRequests, completeRequest } = require('../controllers/kitchenOrder.controller');

const router = Router();

// A 4-6 digit PIN has far less entropy than a password, so this device is
// throttled harder than the admin/staff logins (10 attempts / 15 min / IP).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true, // only wrong PINs count
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many wrong PINs. Please wait 15 minutes and try again.' },
});

// The sign-in screen: tap your name, then type your PIN.
router.get('/cooks', listCooks);
router.post(
  '/login',
  loginLimiter,
  [body('staffId').isInt({ min: 1 }).withMessage('Choose your name first').toInt(), body('pin').matches(/^\d{4,6}$/).withMessage('PIN must be 4-6 digits')],
  validate,
  login
);
router.post('/logout', logout);

// Everything below requires a kitchen sign-in.
router.use(kitchenAuth);

router.get('/orders', listActiveOrders);

router.patch(
  '/orders/:id/status',
  [param('id').isInt({ min: 1 }), body('status').isString().notEmpty()],
  validate,
  updateOrderStatus
);

// "Call staff" / "Request bill" sent from a table's ordering page.
router.get('/requests', listRequests);
router.patch('/requests/:id/done', [param('id').isInt({ min: 1 })], validate, completeRequest);

module.exports = router;
