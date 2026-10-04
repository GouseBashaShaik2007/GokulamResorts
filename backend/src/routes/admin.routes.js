const { Router } = require('express');
const { body, param, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const validate = require('../middleware/validate');
const adminAuth = require('../middleware/adminAuth');
const { ApiError } = require('../middleware/errorHandler');
const {
  login,
  addRoom,
  updateRoom,
  deleteRoom,
  listAllRooms,
  listAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  listAllMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listFoodOrders,
  updateFoodOrderStatus,
  uploadImage,
  getSettings,
  updateSettings,
  getOrderLinks,
  todayStats,
} = require('../controllers/admin.controller');
const hk = require('../controllers/housekeeping.controller');
const mgr = require('../controllers/adminBooking.controller');
const kitchenStaff = require('../controllers/kitchenStaff.controller');
const { PRIORITIES, STAFF_ROLES } = require('../services/cleaning.service');
const { isObviousPin } = require('../utils/pins');
const { ALLOWED_TYPES: ALLOWED_IMAGE_TYPES } = require('../services/publicImage.service');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    ALLOWED_IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Image must be a JPG, PNG or WEBP')),
});

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
  [body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty()],
  validate,
  login
);

// Everything below requires a valid admin JWT.
router.use(adminAuth);

router.post(
  '/add-room',
  [
    body('name').trim().notEmpty(),
    body('description').optional().isString(),
    body('pricePerNight').isFloat({ min: 0 }),
    body('capacity').optional().isInt({ min: 1 }),
    body('totalRooms').optional().isInt({ min: 0 }),
    body('sizeSqft').optional({ nullable: true }).isInt({ min: 0 }),
    body('bedType').optional({ nullable: true }).isString(),
    body('amenities').optional().isArray(),
    body('images').optional().isArray(),
  ],
  validate,
  addRoom
);

router.get('/rooms', listAllRooms);

router.put('/rooms/:id', [param('id').isInt({ min: 1 })], validate, updateRoom);

router.delete('/rooms/:id', [param('id').isInt({ min: 1 })], validate, deleteRoom);

// ----- Bookings (manager decisions). Listing/detail/desk actions live under /api/desk. -----

const reasonField = body('reason').trim().isLength({ min: 3, max: 500 }).withMessage('A reason is required');
const bookingId = [param('id').isInt({ min: 1 })];

router.post('/bookings/:id/approve', bookingId, validate, mgr.approve);
router.post('/bookings/:id/reject', [...bookingId, reasonField], validate, mgr.reject);
router.post('/bookings/:id/cancel', [...bookingId, reasonField], validate, mgr.cancel);
router.post(
  '/bookings/:id/discount',
  [
    ...bookingId,
    body('type').isIn(['percent', 'fixed']),
    body('value').isFloat({ min: 0 }).toFloat(),
    body('value')
      .if(body('type').equals('percent'))
      .isFloat({ max: 100 })
      .withMessage('A percentage discount cannot exceed 100'),
    reasonField,
  ],
  validate,
  mgr.discount
);

router.get('/documents/:id/url', [param('id').isInt({ min: 1 })], validate, mgr.documentUrl);

router.get('/rate-discounts', mgr.listRateDiscounts);
router.post(
  '/rate-discounts',
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('roomTypeId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
    body('discountType').isIn(['percent', 'fixed']),
    body('value').isFloat({ gt: 0 }).toFloat(),
    body('value')
      .if(body('discountType').equals('percent'))
      .isFloat({ max: 100 })
      .withMessage('A percentage discount cannot exceed 100'),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    reasonField,
  ],
  validate,
  mgr.addRateDiscount
);
// Send only { isActive } to switch a promotion on or off, or any of the other fields to edit it.
router.put(
  '/rate-discounts/:id',
  [
    param('id').isInt({ min: 1 }),
    body('isActive').optional().isBoolean().toBoolean(),
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('roomTypeId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
    body('discountType').optional().isIn(['percent', 'fixed']),
    body('value').optional().isFloat({ gt: 0 }).toFloat(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('reason').optional().trim().isLength({ min: 3, max: 500 }).withMessage('A reason is required'),
  ],
  validate,
  mgr.updateRateDiscount
);
router.delete('/rate-discounts/:id', [param('id').isInt({ min: 1 })], validate, mgr.deleteRateDiscount);

router.get('/menu/categories', listAllCategories);

router.post(
  '/menu/categories',
  [body('name').trim().notEmpty(), body('sortOrder').optional().isInt({ min: 0 })],
  validate,
  addCategory
);

router.put('/menu/categories/:id', [param('id').isInt({ min: 1 })], validate, updateCategory);

router.delete('/menu/categories/:id', [param('id').isInt({ min: 1 })], validate, deleteCategory);

router.get('/menu/items', listAllMenuItems);

// What a diner is told about a dish. Kept to a fixed list so the guest site
// can label and filter them reliably.
const ALLERGENS = ['nuts', 'dairy', 'gluten', 'egg', 'shellfish', 'fish', 'soy'];
const dishInfoFields = [
  body('allergens').optional().isArray({ max: ALLERGENS.length }),
  body('allergens.*').isIn(ALLERGENS).withMessage(`Allergens must be any of: ${ALLERGENS.join(', ')}`),
  body('isJain').optional().isBoolean(),
  body('spiceRating').optional().isInt({ min: 0, max: 3 }).toInt(),
];

router.post(
  '/menu/items',
  [
    body('categoryId').isInt({ min: 1 }),
    body('name').trim().notEmpty(),
    body('description').optional().isString(),
    body('price').isFloat({ min: 0 }),
    body('image').optional({ nullable: true }).isString(),
    body('isVeg').optional().isBoolean(),
    body('spiceAdjustable').optional().isBoolean(),
    ...dishInfoFields,
  ],
  validate,
  addMenuItem
);

router.put('/menu/items/:id', [param('id').isInt({ min: 1 }), ...dishInfoFields], validate, updateMenuItem);

router.delete('/menu/items/:id', [param('id').isInt({ min: 1 })], validate, deleteMenuItem);

router.get(
  '/food-orders',
  [
    query('status').optional().isIn(['new', 'preparing', 'ready', 'served', 'cancelled']),
    query('from').optional().isISO8601({ strict: true }),
    query('to').optional().isISO8601({ strict: true }),
  ],
  validate,
  listFoodOrders
);

router.patch(
  '/food-orders/:id/status',
  [param('id').isInt({ min: 1 }), body('status').isIn(['new', 'preparing', 'ready', 'served', 'cancelled'])],
  validate,
  updateFoodOrderStatus
);

router.post(
  '/upload-image',
  imageUpload.single('file'),
  [query('type').isIn(['food', 'room'])],
  validate,
  uploadImage
);

// ----- Housekeeping -----

router.get('/staff', hk.listStaff);

router.post(
  '/staff',
  [
    body('name').trim().notEmpty(),
    body('phone').trim().isLength({ min: 7, max: 20 }).withMessage('A valid phone number is required'),
    body('role').isIn(STAFF_ROLES).withMessage(`role must be one of: ${STAFF_ROLES.join(', ')}`),
    body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  hk.addStaff
);

router.put(
  '/staff/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().notEmpty(),
    body('isActive').optional().isBoolean(),
    body('password').optional({ checkFalsy: true }).isString().isLength({ min: 6 }),
  ],
  validate,
  hk.updateStaff
);

router.get('/room-units', hk.listRoomUnits);

router.post(
  '/room-units',
  [
    body('roomTypeId').isInt({ min: 1 }).toInt(),
    body('unitNumber').trim().notEmpty().isLength({ max: 20 }),
    body('floor').optional({ nullable: true }).isString().isLength({ max: 20 }),
    body('view').optional({ nullable: true }).isString().isLength({ max: 60 }),
  ],
  validate,
  hk.addRoomUnit
);

router.put(
  '/room-units/:id',
  [
    param('id').isInt({ min: 1 }),
    body('roomTypeId').optional().isInt({ min: 1 }).toInt(),
    body('unitNumber').optional().trim().notEmpty().isLength({ max: 20 }),
    body('floor').optional({ nullable: true }).isString().isLength({ max: 20 }),
    body('view').optional({ nullable: true }).isString().isLength({ max: 60 }),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  hk.updateRoomUnit
);

router.get('/cleaning/jobs', hk.listJobs);

router.post(
  '/cleaning/jobs',
  [
    body('roomUnitId').isInt({ min: 1 }).toInt(),
    body('priority').optional().isIn(PRIORITIES),
    body('notes').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 1000 }),
  ],
  validate,
  hk.createJob
);

// Each id may be omitted (unchanged), null (unassign) or a staff id.
const optionalStaffId = (field) => body(field).optional({ values: 'null' }).isInt({ min: 1 }).toInt();
router.put(
  '/cleaning/jobs/:id/assign',
  [
    param('id').isInt({ min: 1 }),
    optionalStaffId('beddingStaffId'),
    optionalStaffId('toiletryStaffId'),
    optionalStaffId('inspectorId'),
  ],
  validate,
  hk.assignJob
);

router.patch(
  '/cleaning/jobs/:id/priority',
  [param('id').isInt({ min: 1 }), body('priority').isIn(PRIORITIES)],
  validate,
  hk.updateJobPriority
);

router.post('/cleaning/run-nightly', hk.runNightly);

// ----- Kitchen staff (per-cook PIN logins for the kitchen display) -----

const notObvious = (pin) => !isObviousPin(pin);
const OBVIOUS_PIN = 'That PIN is too easy to guess. Avoid repeats (0000) and runs (1234).';
const pinField = body('pin').matches(/^\d{4,6}$/).withMessage('PIN must be 4-6 digits').custom(notObvious).withMessage(OBVIOUS_PIN);

router.get('/kitchen-staff', kitchenStaff.listKitchenStaff);

router.post(
  '/kitchen-staff',
  [body('name').trim().notEmpty().isLength({ max: 150 }), pinField],
  validate,
  kitchenStaff.addKitchenStaff
);

router.put(
  '/kitchen-staff/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().notEmpty().isLength({ max: 150 }),
    body('pin').optional().matches(/^\d{4,6}$/).withMessage('PIN must be 4-6 digits').custom(notObvious).withMessage(OBVIOUS_PIN),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  kitchenStaff.updateKitchenStaff
);

// ----- Dashboard -----

router.get('/stats/today', todayStats);

// ----- Settings -----

// Every field is optional and may be sent empty to clear it.
const blankable = (field) => body(field).optional({ checkFalsy: true });

router.get('/settings', getSettings);
router.put(
  '/settings',
  [
    blankable('siteUrl').isString().isLength({ max: 500 }),
    blankable('phone').isString().matches(/^\+?[\d\s()-]{7,20}$/).withMessage('Enter a phone number, e.g. +91 98765 43210'),
    blankable('whatsapp').isString().matches(/^\d{8,15}$/).withMessage('WhatsApp number: digits only, with the country code (e.g. 919876543210)'),
    blankable('email').isEmail().withMessage('Enter a valid email address').isLength({ max: 150 }),
    blankable('address').isString().isLength({ max: 300 }),
    blankable('mapsUrl').isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('Paste the full Google Maps link, starting with https://').isLength({ max: 500 }),
    blankable('checkInTime').isString().isLength({ max: 20 }),
    blankable('checkOutTime').isString().isLength({ max: 20 }),
    body('tableCount').optional().isInt({ min: 1, max: 200 }).withMessage('Number of tables must be between 1 and 200').toInt(),
  ],
  validate,
  updateSettings
);
router.get('/order-links', getOrderLinks);

module.exports = router;
