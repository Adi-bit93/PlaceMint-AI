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

export const upsertMyProfile = asyncHandler(async(req, res) => {
    const {
        enrollmentNumber, branch, batch, cgpa, activeBacklogs, totalBacklogs, skills, links,
    } = req.body;

    const profile = await StudentProfile.findOneAndUpdate(
        { user: req.user.id },
        {
            $set: {
                ...(enrollmentNumber && {enrollmentNumber }),
                ...(branch && { branch }),
                ...(batch && { batch }),
                ...(cgpa !== undefined && { cgpa }),
                ...(activeBacklogs !== undefined && { activeBacklogs }),
                ...(totalBacklogs !== undefined && { totalBacklogs }),
                ...(skills && { skills }),
                ...(links && { links }),
            },
        },
        { new : true, upsert: true, runValidators: true, setDefaultsOnInsert: true}
    ).populate('user', 'name email profilePhoto');

    logger.info(`Profile updated: student ${req.user.id}`);

    return sendSuccess(res, {
        statusCode: 200,
        message: 'Profile updated successfully.',
        data: { profile },
    });
});