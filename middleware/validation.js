const { body, param, validationResult } = require('express-validator')

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    })
  }
  next()
}

// Auth validations
const validateSignup = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),

  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),

  body('role').optional().isIn(['super_admin', 'sub_admin', 'manager']).withMessage('Invalid role'),

  handleValidationErrors,
]

const validateSignin = [
  // Password is always required
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),

  // Either email or username must be provided (but not both)
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.username) {
      throw new Error('Either email or username is required')
    }
    if (req.body.email && req.body.username) {
      throw new Error('Use either email or username, not both')
    }
    return true
  }),

  // Conditional validation for email if provided
  body('email')
    .if(body('email').exists())
    .notEmpty()
    .withMessage('Email cannot be empty')
    .isEmail()
    .withMessage('Invalid email format'),

  // Conditional validation for username if provided
  body('username')
    .if(body('username').exists())
    .notEmpty()
    .withMessage('Username cannot be empty')
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters'),

  handleValidationErrors,
]

// Parameter validations
const validateIdParam = [
  param('id').isInt({ min: 1 }).withMessage('ID must be a valid positive integer'),
  handleValidationErrors,
]

// Player validations
const validateCreatePlayer = [
  body('first_name')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name must be 50 characters or less'),

  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('club_id').isInt({ min: 1 }).withMessage('Valid club ID is required'),

  handleValidationErrors,
]

module.exports = {
  validateSignup,
  validateSignin,
  validateIdParam,
  validateCreatePlayer,
  handleValidationErrors,
}
