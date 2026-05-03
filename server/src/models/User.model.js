import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { kMaxLength } from 'buffer';
import { type } from 'os';



const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            MaxLength: [100, 'Name cannot exceed 100 characters']
        },

        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\S+@\S+\.\S+$/,
                'Please provide a valid email address',
            ]
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false // never return password
        },

        role: {
            type: String,
            enum: {
                values: ['admin', 'student', 'company'],
                message: 'Role must be admin, student, or company',
            },
            required: true
        },

        profilePhoto: {
            url: { type: String, default: null },
            publicId: { type: String, default: null },
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true // frequently filtered by admin → index speeds queries
        },

        isEmailVerified: {
            type: Boolean,
            defualt: false,
        },
        // Email Verification

        emailVerificationToken: {
            type: String,
            select: false
        },
        emailVerificationExpires: {
            type: Date,
            select: false
        },

        // password Reset
        passwordResetToken: {
            type: String,
            select: false
        },
        passwordResetExpires: {
            type: Date,
            select: false
        },
        //Password Change Tracking
        passwordChangedAt: {
            type: Date,
            select: false
        },

        // Brute force Protection
        loginAttempts: {
            type: Number,
            default: 0,
            select: false
        },
        lockUntil: {
            type: Date,
            default: null,
            select: false
        },
        lastLogin: { type: Date, default: null }
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                delete ret.password,
                delete ret.emailVerificationToken;
                delete ret.emailVerificationExpires;
                delete ret.passwordResetToken;
                delete ret.passwordResetExpires;
                delete ret.passwordChangedAt;
                delete ret.loginAttempts;
                delete ret.lockUntil;
                delete ret.__v;
                return ret;
            }
        }
    }
)