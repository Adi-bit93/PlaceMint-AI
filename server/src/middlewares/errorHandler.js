import { sendError } from "../utils/apiResponse";
import { logger } from "../config/logger";
import { error } from "winston";

const handleCastError = (err) => ({
    statusCode = 400,
    message: `Invalid ${err.path}: "${err.value}"  is not a valid ID format`,
});

// MongoDB duplicate key error (code 11000)
// e.g. registering with an email that already exists

const handleDuplicateKey = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];

    return {
        statusCode: 400,
        message: `${field} "${value}" is already taken. please use a different value.`,
    }
}

// Mongoose ValidationError → required fields missing, enum values wrong, etc.
const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
    }));

    return {
        statusCode: 422,
        message: "Validation failed. Please check your input.",
        errors,
    };
};

// JWT errors → invalid or expired token
const handleJWTInvalid =() => ({
    statusCode: 401,
    message: 'Invalid token. Please log in again.'
});

const handleJWTExpired = () => ({
    statusCode: 401,
    message: 'Your session has expired. Please log in again.',
})
