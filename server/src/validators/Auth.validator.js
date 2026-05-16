import {body} from 'express-validator';


// Register
export const registerValidator = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({min: 2, max: 50})
        .withMessage('Name must be between 2 and 50 characters')
        .escape(),

    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(), // lowercases, removes dots in gmail etc.

    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['student', 'company'])
        .withMessage('Role must be student or company'),
];

// Login