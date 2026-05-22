import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, sendSuccess } from '../utils/apiResponse.js';
import {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendWelcomeEmail,
    sendPasswordChangedEmail
} from '../services/email.services.js';

import logger from '../config/logger.js';
import { http } from 'winston';

const sendRefreshTokenCookie = (res, refreshToken) => {
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30days in ms
    });
};

const clearRefreshTokenCookie = (res) => {
    res.cookie('refreshToken', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: new Date(0), // immediately expire 
    });
};

// Register 

export const register = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
        throw new AppError('An account with this email already exists.', 409);
    }

    const user = await User.create({ name, email, password, role });

    const rawToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

    try {
        await sendVerificationEmail(user, verifyUrl);
    } catch (emailErr) {
        logger.error(`Verification email failed for ${user.email}: ${emailErr.message}`);
    }

    // token
    const accessToken = user.generateAccessToken();
    const refreshTOken = user.generateRefreshToken();

    sendRefreshTokenCookie(res, refreshToken);

    logger.info(`New ${role} registered: ${email}`);

    return sendSuccess(res, {
        statusCode: 201,
        message: 'Account created successfully. Please check your email to verify your account.',
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
            },
            accessToken
        },
    });
});

// Login

export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

    if (user?.isLocked) {
        throw new AppError('Account temporarily locked due to too many failed login attempts. Try again in 30 minutes.',
            423
        );
    }

    const isPasswordCorrect = user ? await user.comparePassword(password) : false;

    if (!user || !isPasswordCorrect) {
        if (user) await user.incrementLoginAttempts();

        throw new AppError('Invalid email or password.', 401);
    }
    if (!user.isActive) {
        throw new AppError('Your account has been deactivated. Please contact the placement office.', 403);
    }

    await user.resetLoginAttempts();

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    sendRefreshTokenCookie(res, refreshToken)

    logger.info(`Login: ${user.role} ${user.email}`);

    return sendSuccess(res, {
        message: 'Logged in successfully.',
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profilePhoto: user.profilePhoto,
                isEmailVerified: user.isEmailVerified,
            },
            accessToken,
        },
    });
 })



