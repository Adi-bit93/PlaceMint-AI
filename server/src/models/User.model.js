import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';



const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true,
            minlength: 8,
            select: false // never return password
        },

        role: {
            type: String,
            enum: ["admin", "student", "company"],
            default: "student"
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        passwordchangedAt: Date,
        passwordResetToken: String,
        passwordResetExpires: Date,

        emailVerificationToken: String,
        emailVerificationExpires: Date,

        loginAttempts: {
            type: Number,
            default: 0,
        },

        lockUntil: Date,

    },
    { timestamps: true }
)