const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// POST /api/contact
// Minimal endpoint backing the Contact page form. Logs the enquiry server-side;
// wire this up to an email service (e.g. SendGrid, Nodemailer) in production.
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('message').trim().isLength({ min: 5, max: 2000 }).withMessage('Message is required'),
    body('reason').optional().isIn(['Stay', 'Event', 'Wedding', 'Other']),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
    body('checkIn').optional({ checkFalsy: true }).isISO8601(),
    body('checkOut').optional({ checkFalsy: true }).isISO8601(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    // Phase 2 saves these to an admin inbox and emails them; until then they are only logged.
    const { name, email, message, reason = 'Other', phone, checkIn, checkOut } = req.body;
    const dates = checkIn ? ` ${checkIn}${checkOut ? ` → ${checkOut}` : ''}` : '';
    console.log(`[contact:${reason}]${dates} ${name} <${email}>${phone ? ` ${phone}` : ''}: ${message}`);
    res.json({ success: true, message: "Thanks for reaching out — we'll get back to you shortly." });
  })
);

module.exports = router;
