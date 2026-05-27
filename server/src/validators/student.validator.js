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