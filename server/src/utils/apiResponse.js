class AppError extends Error { 
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = String(statusCode).startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // distinguish from programming errors

         // Keeps the stack trace clean — doesn't include this constructor call in it
        Error.captureStackTrace(this, this.constructor);
    }
}

// sendSuccess: standard format for successful API responses
const sendSuccess = (res, { statusCode = 200, message = 'Success', data = null , meta = null}) => {
    const body = {
        success: true, 
        message
    };
    if(data !== null) body.data = data; // actual data
    if(meta !== null) body.meta = meta; // pagination info, counts etc..;

    return res.status(statusCode).json(body);

}

// sendError: standard format for error API responses

const sendError = (res, { statusCode = 500, message = 'Something went wrong', errors = null }) => {
    const body = { success: false, message };
    if (errors !== null) body.errors = errors;

    return res.status(statusCode).json(body);
}