import { body, param } from 'express-validator';

export const updateProfileValidator = [
    body('enrollmentNumber')
        .optional().trim().notEmpty().withMessage('Enrollment number cannot be empty').toUpperCase(),

    body('branch')
        .optional()
        .isFloat({ min: 2000, max: 2100 }).withMessage('Batch must be a valid year').toInt(),

    body('cgpa')
        .optional()
        .isFloat({ min: 0, max: 10 }).withMessage('CGPA must be between 0 and 10').isFloat(),

    body('activeBacklogs')
        .optional()
        .isInt({ min: 0 }).withMessage('Active backlogs cannot be negative')
        .toInt(),

    body('totalBacklogs')
        .optional()
        .isInt({ min: 0 }).withMessage('Total backlogs cannot be negative')
        .toInt(),

    body('skills')
        .optional.isArray().withMessage('Skills must be an array'),

    body('skills.*')
        .trim().notEmpty().withMessage('Skill cannot be empty')
        .isLength({ max: 50 }).withMessage('Each skill max 50 characters'),

    body('links.github')
        .optional({ nullable: true }).trim()
        .isURL().withMessage('GitHub must be a valid URL'),

    body('links.linkedin')
        .optional({ nullable: true }).trim()
        .isURL().withMessage('LinkedIn must be a valid URL'),

    body('links.portfolio')
        .optional({ nullable: true }).trim()
        .isURL().withMessage('Portfolio must be a valid URL'),
];

export const projectValidator = [
    body('title')
        .trim().notEmpty().withMessage('Project title is required')
        .isLength({ max: 200 }).withMessage('Title max 200 characters'),

    body('description')
        .optional().trim()
        .isLength({ max: 1000 }).withMessage('Description max 1000 characters'),

    body('techStack')
        .optional().isArray().withMessage('Tech stack must be an array'),

    body('techStack.*')
        .trim().notEmpty().withMessage('Tech stack item cannot be empty'),

    body('liveUrl')
        .optional({ nullable: true }).trim()
        .isURL().withMessage('Live URL must be valid'),

    body('githubUrl')
        .optional({ nullable: true }).trim()
        .isURL().withMessage('GitHub URL must be valid'),
];

export const certificationValidator = (data) => [
    body('name')
        .trim().notEmpty().withMessage('Certification name is required')
        .isLength({ max: 200 }).withMessage('Name max 200 characters'),

    body('issuer')
        .optional().trim()
        .isLength({ max: 200 }).withMessage('Issuer max 200 characters'),

    body('issueDate')
        .optional({ nullable: true })
        .isISO8601().withMessage('Issue date must be valid').toDate(),

    body('expiryDate')
        .optional({ nullable: true })
        .isISO8601().withMessage('Expiry date must be valid').toDate(),

    body('credentialUrl')
        .optional({ nullable: true }).trim()
        .isURL().withMessage('Credential URL must be valid'),
];

export const objectIdValidator = (paramName) => [
    param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
];