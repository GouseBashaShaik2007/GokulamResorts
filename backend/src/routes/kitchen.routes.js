const { Router } = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const kitchenAuth = require('../middleware/kitchenAuth');
const { login } = require('../controllers/kitchenAuth.controller');
const { listActiveOrders, updateOrderStatus } = require('../controllers/kitchenOrder.controller');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, [body('password').isString().notEmpty()], validate, login);

// Everything below requires a valid kitchen JWT.
router.use(kitchenAuth);

router.get('/orders', listActiveOrders);

router.patch(
  '/orders/:id/status',
  [param('id').isInt({ min: 1 }), body('status').isString().notEmpty()],
  validate,
  updateOrderStatus
);

module.exports = router;
