const { Router } = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

const THANKS = "Thanks for reaching out — we'll get back to you shortly.";

// A public form: a handful of messages per visitor is plenty.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages in a short time. Please try again in a few minutes, or email us.' },
});

// POST /api/contact
// Minimal endpoint backing the Contact page form. Logs the enquiry server-side;
// wire this up to an email service (e.g. SendGrid, Nodemailer) in production.
router.post(
  '/',
  contactLimiter,
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
    // "website" is a field people never see; only form-filling bots complete
    // it. Answer as if it worked so they have nothing to adapt to.
    if (req.body.website) return res.json({ success: true, message: THANKS });

    // Phase 2 saves these to an admin inbox and emails them; until then they are only logged.
    const { name, email, message, reason = 'Other', phone, checkIn, checkOut } = req.body;
    const dates = checkIn ? ` ${checkIn}${checkOut ? ` → ${checkOut}` : ''}` : '';
    console.log(`[contact:${reason}]${dates} ${name} <${email}>${phone ? ` ${phone}` : ''}: ${message}`);
    return res.json({ success: true, message: THANKS });
  })
);

module.exports = router;
