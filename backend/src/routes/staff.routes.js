const { Router } = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const validate = require('../middleware/validate');
const staffAuth = require('../middleware/staffAuth');
const { ApiError } = require('../middleware/errorHandler');
const { ALLOWED_TYPES } = require('../services/publicImage.service');
const issues = require('../controllers/roomIssue.controller');
const { SKIP_REASONS } = require('../services/cleaning.service');
const {
  login,
  listHousekeepers,
  pinLogin,
  logout,
  me,
  myTasks,
  openJobs,
  startTask,
  pauseTask,
  completeTask,
  skipTask,
  approveInspection,
  rejectInspection,
  rejectionPhotoUrl,
} = require('../controllers/staff.controller');
const { assignJob } = require('../controllers/housekeeping.controller');

const router = Router();

// Only wrong guesses count, so someone who signs in normally is never locked
// out; ten wrong passwords from one address in 15 minutes are.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

router.post(
  '/login',
  loginLimiter,
  [body('phone').trim().notEmpty(), body('password').isString().notEmpty()],
  validate,
  login
);

// Housekeeping on a shared phone: tap your name, then type your PIN.
router.get('/housekeepers', listHousekeepers);
router.post(
  '/pin-login',
  loginLimiter,
  [body('staffId').isInt({ min: 1 }).withMessage('Choose your name first').toInt(), body('pin').matches(/^\d{4,6}$/).withMessage('PIN must be 4-6 digits')],
  validate,
  pinLogin
);
router.post('/logout', logout);

// Everything below requires a staff sign-in.
router.use(staffAuth);

router.get('/me', me);

// One optional photo from a room — with "Report a problem", or when an
// inspector sends a room back. Held in memory only long enough to pass it to
// private storage.
const roomPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    ALLOWED_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'The photo must be a JPG, PNG or WEBP')),
});

// "Report a problem" from a room.
router.post(
  '/issues',
  roomPhoto.single('photo'),
  [
    body('roomUnitId').isInt({ min: 1 }).toInt(),
    body('kind').isIn(issues.KINDS).withMessage(`kind must be one of: ${issues.KINDS.join(', ')}`),
    body('description').isString().trim().isLength({ min: 3, max: 1000 }).withMessage('Say what the problem is'),
  ],
  validate,
  issues.report
);
router.get('/tasks', myTasks);

const taskId = [param('id').isInt({ min: 1 })];
router.post('/tasks/:id/start', taskId, validate, startTask);
router.post('/tasks/:id/pause', taskId, validate, pauseTask);
router.post('/tasks/:id/complete', taskId, validate, completeTask);

// A stayover closed at the door without the room being serviced: "Do not
// disturb", the guest said no, or something else — which needs a note.
router.post(
  '/tasks/:id/skip',
  [
    ...taskId,
    body('reason').isIn(SKIP_REASONS).withMessage(`reason must be one of: ${SKIP_REASONS.join(', ')}`),
    body('note')
      .optional({ values: 'falsy' })
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Keep the note under 500 characters'),
    body('note')
      .if(body('reason').equals('other'))
      .isString()
      .withMessage('Say why the room was not serviced')
      .bail()
      .trim()
      .isLength({ min: 3 })
      .withMessage('Say why the room was not serviced'),
  ],
  validate,
  skipTask
);

router.post('/tasks/:id/approve', taskId, validate, approveInspection);

// A form with a photo sends everything as text: the failed tasks then arrive
// as one name, the same field repeated, or a JSON list. Made into a list
// here, so the checks below read the same body a JSON request sends.
const failedTasksAsList = (req, res, next) => {
  let failed = req.body ? req.body.failedTasks : undefined;
  if (typeof failed === 'string') {
    try {
      failed = JSON.parse(failed);
    } catch {
      // a plain name, e.g. "Bedding"
    }
    if (typeof failed === 'string') failed = [failed];
    req.body.failedTasks = failed;
  }
  next();
};

// Sending a room back: JSON as before, or a form with an optional `photo` of
// what is wrong (JPG, PNG or WEBP, up to 5 MB).
router.post(
  '/tasks/:id/reject',
  roomPhoto.single('photo'),
  failedTasksAsList,
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

// The photo that came with the last "send back", for the housekeeper redoing the room.
router.get('/tasks/:id/rejection-photo-url', taskId, validate, rejectionPhotoUrl);

// Inspectors run the housekeeping floor: they see every open room and say who
// cleans and inspects it, the same as a manager does from the admin board.
const inspectorOnly = (req, res, next) =>
  req.staff.role === 'Inspector' ? next() : next(new ApiError(403, 'Only an inspector can assign rooms'));

router.get('/jobs', inspectorOnly, openJobs);

// Each id may be omitted (unchanged), null (unassign) or a staff id.
const optionalStaffId = (field) => body(field).optional({ values: 'null' }).isInt({ min: 1 }).toInt();
router.put(
  '/jobs/:id/assign',
  inspectorOnly,
  [...taskId, optionalStaffId('beddingStaffId'), optionalStaffId('toiletryStaffId'), optionalStaffId('inspectorId')],
  validate,
  assignJob
);

module.exports = router;
