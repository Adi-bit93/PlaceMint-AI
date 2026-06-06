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
    body('reason').optional().trim().isLength({ max: 500}),
];