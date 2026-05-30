import { body, param, query } from 'express-validator';

// Update Company Profile
export const updateCompanyProfileValidator = [
    body('companyName')
        .optional()
        .trim()
        .notEmpty().withMessage('Company name cannot be empty')
        .isLength({ max: 200 }).withMessage('Company name cannot exceed 200 characters'),

    body('website')
        .optional({ nullable: true })
        .trim()
        .isURL().withMessage('Website must be a valid URL'),

    body('industry')
        .optional()
        .isIn(['IT', 'Finance', 'Healthcare', 'Manufacturing', 'Consulting', 'Ecommerce', 'Startup', 'Other'])
        .withMessage('Invalid industry type'),

    body('companyType')
        .optional()
        .isIn(['Product', 'Service', 'Startup', 'PSU', 'MNC', 'Other'])
        .withMessage('Invalid company type'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),

    body('hrContact.name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('HR name cannot exceed 100 characters'),

    body('hrContact.phone')
        .optional()
        .trim()
        .isMobilePhone().withMessage('Please provide a valid phone number'),

    body('hrContact.designation')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Designation cannot exceed 100 characters'),
];