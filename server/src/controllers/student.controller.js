import StudentProfile from '../models/StudentProfile.js';
import Drive from '../models/Drive.js';
import Application from '../models/Application.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError, sendSuccess, getPagination } from '../utils/apiResponse.js';
import { deleFromCloudinary } from '../services/upload.service.js';
import { logger } from '../config/logger.js';


export const getMyProfile = asyncHandler(async (req, res) => {
    const profile = await StudentProfile.findOne({ user: req.user.id })
        .populate('user', 'name email profilePhoto isEmailVerified createdAt');

        if(!profile){
            return sendSuccess(res, {
                message: 'Profile not set up yet.',
                data: { profile: null },
            });
        }

        return sendSuccess(res, {
            message: 'Profile fetched successfully.',
            data : { profile },
        });
});