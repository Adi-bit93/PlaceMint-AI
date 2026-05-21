import { validationResult } from "express-validator";
import { AppError } from '../utils/apiResponse.js';

const validate = (req, res, next) => {
    const errors = validationResult(req)

    if(!errors.isEmpty()){
        const formatted = errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
            value: err.value,
        }))

        const error = new AppError('Validation failed. Please check your input. ', 422);
        error.errors = formatted;
        return next(error);
    }
    next();

};

export default validate;