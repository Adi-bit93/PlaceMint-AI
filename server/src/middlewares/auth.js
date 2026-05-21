import jwt from 'jsonwebtoken';
import { AppError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../config/logger.js';

export const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
    }

    if (!token) {
        throw new AppError('You are not logged in. Please log in to continue.', 401);
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return next(err); // goes to globalErrorHandler → clean 401 message
    }

    // Lazy-load User model to avoid circular dependency
    const { default: User } = await import('../models/User.js');
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
        throw new AppError('The account linked to this token no longer exists.', 401);
    }

    // Check account is active — admin may have deactivated it
    if (!user.isActive) {
        throw new AppError('Your account has been deactivated. Please contact the placement office.', 403);
    }

    // Check password hasn't changed after token was issued
    // If user changed password → old tokens are no longer valid → force re-login
    if (user.passwordChangedAt) {
        const changedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (decoded.iat < changedAt) {
            throw new AppError('Your password was recently changed. Please log in again.', 401);
        }
    }

    req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        name: user.name,
    };

    logger.debug(`Auth: ${req.user.role} ${req.user.id} → ${req.method} ${req.path}`);
    next()
});

export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            logger.warn(`Forbidden: ${req.user.role} ${req.user.id} tried ${req.method} ${req.path}`);
            return next(
                new AppError(`Access denied. This action is restricted to: ${roles.join(', ')}`, 403)
            );
        }
        next();
    };
};