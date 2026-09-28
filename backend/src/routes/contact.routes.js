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
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, message } = req.body;
    console.log(`[contact] ${name} <${email}>: ${message}`);
    res.json({ success: true, message: "Thanks for reaching out — we'll get back to you shortly." });
  })
);

module.exports = router;
