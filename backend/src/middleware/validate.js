const { validationResult } = require('express-validator');

// Run after an array of express-validator checks. If any failed, respond
// with 422 and a list of field-level messages instead of hitting the controller.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = validate;
