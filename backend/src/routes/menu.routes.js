const { Router } = require('express');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const { getCategories, getMenuItems } = require('../controllers/menu.controller');

const router = Router();

router.get('/categories', getCategories);

router.get(
  '/items',
  [query('category').optional().isInt({ min: 1 })],
  validate,
  getMenuItems
);

module.exports = router;
