import CompanyProfile from '../models/companyProfile.js'
import Drive from '../models/Drive.js';
import Application from '../models/Application.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, sendSuccess, getPagination } from '../utils/apiResponse.js';
import { deleteFromCloudinary } from '../services/upload.service.js';
import { logger } from '../config/logger.js';


const getCompanyOrFail = async (userId) => {
    const company  = await CompanyProfile.findOne({ user: userId});
    if(!company) {
        throw new AppError('Company profile not found. Please complete your profile first.', 404);
    }
    return company;
};

// Profile

// get Profile
export const getMyProfile = asyncHandler(async (req, res ) => {
    const profile = await CompanyProfile.findOne({ user: req.user.id })
        .populate('user', 'name email profilePhoto createdAt')
        .populate('approvedBy', 'name email');

    if(!profile){
        return sendSuccess(res, {
            message: 'Profile not set up yet.',
            data: { profile: null },
        });
    }

    return sendSuccess(res, {
        message:  'Company profile fetched successfully.',
        data: { profile },
    });
});