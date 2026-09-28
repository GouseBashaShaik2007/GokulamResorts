const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { createOrder, getOrderById } = require('../controllers/foodOrder.controller');

const router = Router();

router.post(
  '/food-orders',
  [
    body('orderType').isIn(['table', 'kiosk']).withMessage('orderType must be "table" or "kiosk"'),
    body('tableNumber').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 20 }),
    body('customerName').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 150 }),
    body('customerPhone').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 20 }),
    body('notes').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 1000 }),
    body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
    body('items.*.menuItemId').isInt({ min: 1 }),
    body('items.*.quantity').isInt({ min: 1, max: 20 }),
  ],
  validate,
  createOrder
);

router.get('/food-orders/:id', [param('id').isInt({ min: 1 })], validate, getOrderById);

module.exports = router;
