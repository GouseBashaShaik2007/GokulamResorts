const { Router } = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const staffAuth = require('../middleware/staffAuth');
const {
  login,
  me,
  myTasks,
  startTask,
  pauseTask,
  completeTask,
  approveInspection,
  rejectInspection,
} = require('../controllers/staff.controller');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/login',
  loginLimiter,
  [body('phone').trim().notEmpty(), body('password').isString().notEmpty()],
  validate,
  login
);

// Everything below requires a valid staff JWT.
router.use(staffAuth);

router.get('/me', me);
router.get('/tasks', myTasks);

const taskId = [param('id').isInt({ min: 1 })];
router.post('/tasks/:id/start', taskId, validate, startTask);
router.post('/tasks/:id/pause', taskId, validate, pauseTask);
router.post('/tasks/:id/complete', taskId, validate, completeTask);
router.post('/tasks/:id/approve', taskId, validate, approveInspection);
router.post(
  '/tasks/:id/reject',
  [
    ...taskId,
    body('failedTasks').isArray({ min: 1, max: 2 }).withMessage('Pick at least one failed task'),
    body('failedTasks.*').isIn(['Bedding', 'Toiletry']),
    body('failureReason')
      .isString()
      .trim()
      .isLength({ min: 3, max: 1000 })
      .withMessage('A failure reason is required'),
  ],
  validate,
  rejectInspection
);

module.exports = router;
