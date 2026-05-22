import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import * as authController from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';

import {
    registerValidator,
    loginValidator,
    forgotPasswordValidator,
    resetPasswordValidator,
    updatePasswordValidator
} from '../validators/Auth.validator.js';

const router = Router();


// Rate limiter for auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: 'Too many attempts from this IP. Please try again after 15 minutes.',
    },
});

// Public Routes

router.post('/register',
    authLimiter,
    registerValidator,
    validate,
    authController.register
);

router.post('/login',
    authLimiter,
    loginValidator,
    validate,
    authController.login
);

router.post('/refresh-token', authController.refreshToken);
router.get('/verify-email/:token', authController.verifyEmail);

router.post('/forgot-password',
    authLimiter,
    forgotPasswordValidator,
    validate,
    authController.forgotPassword
);

router.post('/reset-password/:token',
    authLimiter,
    resetPasswordValidator,
    validate,
    authController.resetPassword
);

router.get('/me', protect, authController.getMe);

router.patch('/update-password', 
    protect,
    updatePasswordValidator,
    validate,
    authController.updatePassword
);
export default router;