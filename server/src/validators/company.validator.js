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

// Create Drive
export const createDriveValidator = [
    body('jobRole')
        .trim()
        .notEmpty().withMessage('Job role is required')
        .isLength({ max: 200 }).withMessage('Job role cannot exceed 200 characters'),

    body('jobDescription')
        .trim()
        .notEmpty().withMessage('Job description is required')
        .isLength({ min: 50, max: 5000 }).withMessage('Job description must be between 50 and 5000 characters'),

    body('ctc')
        .notEmpty().withMessage('CTC is required')
        .isFloat({ min: 0 }).withMessage('CTC must be a positive number')
        .toFloat(),

    body('ctcBreakdown')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('CTC breakdown cannot exceed 200 characters'),

    body('jobLocation')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Job location cannot exceed 200 characters'),

    body('bond.hasBond')
        .optional()
        .isBoolean().withMessage('hasBond must be true or false')
        .toBoolean(),

    body('bond.duration')
        .optional()
        .trim(),

    // Eligibility rules
    body('eligibility.minCgpa')
        .notEmpty().withMessage('Minimum CGPA is required')
        .isFloat({ min: 0, max: 10 }).withMessage('Min CGPA must be between 0 and 10')
        .toFloat(),

    body('eligibility.allowedBranches')
        .optional()
        .isArray().withMessage('Allowed branches must be an array'),

    body('eligibility.allowedBranches.*')
        .isIn(['CE', 'IT', 'CSE', 'ENTC', 'MECH', 'CIVIL', 'EE', 'OTHER'])
        .withMessage('Invalid branch in allowedBranches'),

    body('eligibility.maxActiveBacklogs')
        .optional()
        .isInt({ min: 0 }).withMessage('Max active backlogs must be 0 or more')
        .toInt(),

    body('eligibility.allowedBatches')
        .optional()
        .isArray().withMessage('Allowed batches must be an array'),

    body('eligibility.allowedBatches.*')
        .isInt({ min: 2000, max: 2100 }).withMessage('Each batch must be a valid year')
        .toInt(),

    body('applicationDeadline')
        .notEmpty().withMessage('Application deadline is required')
        .isISO8601().withMessage('Application deadline must be a valid date')
        .toDate()
        .custom((value) => {
            if (value <= new Date()) {
                throw new Error('Application deadline must be in the future');
            }
            return true;
        }),

    body('driveDate')
        .optional({ nullable: true })
        .isISO8601().withMessage('Drive date must be a valid date')
        .toDate(),

    // Rounds
    body('rounds')
        .optional()
        .isArray().withMessage('Rounds must be an array'),

    body('rounds.*.name')
        .trim()
        .notEmpty().withMessage('Each round must have a name'),

    body('rounds.*.order')
        .isInt({ min: 1 }).withMessage('Round order must be a positive integer')
        .toInt(),
];

// update Drive 
export const updateDriveValidator = [
    body('jobRole')
        .optional()
        .trim()
        .notEmpty().withMessage('Job role cannot be empty')
        .isLength({ max: 200 }),

    body('jobDescription')
        .optional()
        .trim()
        .isLength({ min: 50, max: 5000 }).withMessage('Job description must be 50-5000 characters'),

    body('ctc')
        .optional()
        .isFloat({ min: 0 }).withMessage('CTC must be positive')
        .toFloat(),

    body('applicationDeadline')
        .optional()
        .isISO8601().withMessage('Must be a valid date')
        .toDate()
        .custom((value) => {
            if (value <= new Date()) throw new Error('Deadline must be in the future');
            return true;
        }),

    body('eligibility.minCgpa')
        .optional()
        .isFloat({ min: 0, max: 10 }).withMessage('Min CGPA must be 0-10')
        .toFloat(),
];