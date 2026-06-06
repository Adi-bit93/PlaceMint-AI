import { body, param, query } from 'express-validator';

export const objectIdValidator = (paramName) => [
    param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
];

export const studentListValidator = [
    query('branch').optional()
        .isIn(['CE', 'IT', 'CSE', 'ENTC', 'MECH', 'CIVIL', 'EE', 'OTHER']).withMessage('Invalid branch'),
    query('placementStatus').optional()
        .isIn(['not_placed', 'placed', 'opted_out']).withMessage('Invalid placement status'),
    query('minCgpa').optional()
        .isFloat({ min: 0, max: 10 }).withMessage('minCgpa must be 0-10').toFloat(),
    query('batch').optional()
        .isInt({ min: 2000, max: 2100 }).withMessage('Batch must be a valid year').toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const updateStudentStatusValidator = [
    body('isActive').optional().isBoolean().toBoolean(),
    body('placementStatus').optional()
        .isIn(['not_placed', 'placed', 'opted_out']).withMessage('Invalid placement status'),
    body('reason').optional().trim().isLength({ max: 500 }),
];

export const companyApprovalValidator = [
    body('reason').optional().trim().isLength({ max: 500 }),
];

export const publishDriveValidator = [
    body('isDreamCompany').optional().isBoolean().toBoolean(),
    body('aiWeights.skill').optional().isFloat({ min: 0, max: 100 }).toFloat(),
    body('aiWeights.cgpa').optional().isFloat({ min: 0, max: 100 }).toFloat(),
    body('aiWeights.projects').optional().isFloat({ min: 0, max: 100 }).toFloat(),
    body('aiWeights.certifications').optional().isFloat({ min: 0, max: 100 }).toFloat(),
];

export const roundResultValidator = [
    body('applicationId').notEmpty().isMongoId().withMessage('Invalid applicationId'),
    body('roundOrder').notEmpty().isInt({ min: 1 }).toInt(),
    body('result').notEmpty()
        .isIn(['cleared', 'eliminated', 'absent']).withMessage('Invalid result'),
    body('remarks').optional().trim().isLength({ max: 500 }),
];

export const announcementValidator = [
    body('title').trim().notEmpty().withMessage('Title required')
        .isLength({ max: 200 }),
    body('message').trim().notEmpty().withMessage('Message required')
        .isLength({ max: 2000 }),
    body('targetAudience').optional()
        .isIn(['all', 'students', 'companies', 'branch', 'drive']).withMessage('Invalid audience'),
    body('targetBranch').optional()
        .isIn(['CE', 'IT', 'CSE', 'ENTC', 'MECH', 'CIVIL', 'EE', 'OTHER']),
    body('targetDriveId').optional().isMongoId(),
];

export const driveListValidator = [
    query('status').optional()
        .isIn(['draft', 'published', 'ongoing', 'completed', 'cancelled']),
    query('company').optional().isMongoId(),
];