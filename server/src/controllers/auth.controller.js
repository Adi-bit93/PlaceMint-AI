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

import {logger} from '../config/logger.js';
import http  from 'winston';
import { send } from 'process';

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
});


export const logout = asyncHandler(async (req, res) => {
    clearRefreshTokenCookie(res);
    logger.info(`Logout: ${req.user?.email || 'unknown'}`);
    return sendSuccess(res, { message: 'Logged out successfully. ' });
});

// refresh Token
export const refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken;

    if (!token) {
        throw new AppError('No refresh token found. Please log in again.', 401);
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
        clearRefreshTokenCookie(res);
        throw new AppError('Refresh token is invalid or expired. Please log in again.', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
        clearRefreshTokenCookie(res);
        throw new AppError('User not found. Please log in again.', 401);
    }

    // create new access token
    const newAccessToken = user.generateAccessToken();

    logger.debug(`Token refreshed: ${user.email}`);

    return sendSuccess(res, {
        message: 'Token refreshed.',
        data: { accessToken: newAccessToken },
    });
});

export const verifyEmail = asyncHandler(async (req, res) => {
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }, // not expired
    }).select('+emailVerificationToken +emailVerificationExpires');


    if (!user) {
        throw new AppError('Verification link is invalid or has expired.', 400);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // Send welcome email
    try {
        await sendWelcomeEmail(user);
        console.log("Email Verification Token : ", user.emailVerificationToken);
    } catch (err) {
        logger.error(`Welcome email failed: ${err.message}`);
    }

    logger.info(`Email verified: ${user.email}`);

    return sendSuccess(res, { message: 'Email verified successfully. You can now log in.' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
 
  const genericMessage = 'If an account with that email exists, a reset link has been sent.';
 
  if (!user) {
    return sendSuccess(res, { message: genericMessage });
  }
 
  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
 
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
 
  try {
    await sendPasswordResetEmail(user, resetUrl);
  } catch (err) {
    // If email fails → clear the reset token so user can try again
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError('Failed to send reset email. Please try again later.', 500);
  }
 
  logger.info(`Password reset requested: ${user.email}`);
  return sendSuccess(res, { message: genericMessage });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
 
  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');
 
  if (!user) {
    throw new AppError('Password reset link is invalid or has expired.', 400);
  }
 
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
 
  // Send confirmation email
  try {
    await sendPasswordChangedEmail(user);
  } catch (err) {
    logger.error(`Password changed email failed: ${err.message}`);
  }
 
  const accessToken  = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  sendRefreshTokenCookie(res, refreshToken);
 
  logger.info(`Password reset complete: ${user.email}`);
 
  return sendSuccess(res, {
    message: 'Password reset successful.',
    data: { accessToken },
  });
});

export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
 
  const user = await User.findById(req.user.id).select('+password');
 
  const isCorrect = await user.comparePassword(currentPassword);
  if (!isCorrect) {
    throw new AppError('Current password is incorrect.', 401);
  }
 
  user.password = newPassword; // pre-save hook hashes it
  await user.save();
 
 
  // Issue fresh tokens
  const accessToken  = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  sendRefreshTokenCookie(res, refreshToken);
 
  try {
    await sendPasswordChangedEmail(user);
  } catch (err) {
    logger.error(`Password changed email failed: ${err.message}`);
  }
 
  logger.info(`Password updated: ${user.email}`);
 
  return sendSuccess(res, {
    message: 'Password updated successfully.',
    data: { accessToken },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
 
  if (!user) {
    throw new AppError('User not found.', 404);
  }
 
  return sendSuccess(res, {
    message: 'User fetched successfully.',
    data: { user },
  });
});