import CompanyProfile from '../models/companyProfile.js'
import Drive from '../models/Drive.js';
import Application from '../models/Application.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, sendSuccess, getPagination } from '../utils/apiResponse.js';
import { deleteFromCloudinary } from '../services/upload.service.js';
import { logger } from '../config/logger.js';


const getCompanyOrFail = async (userId) => {
    const company = await CompanyProfile.findOne({ user: userId });
    if (!company) {
        throw new AppError('Company profile not found. Please complete your profile first.', 404);
    }
    return company;
};

// Profile

// get Profile
export const getMyProfile = asyncHandler(async (req, res) => {
    const profile = await CompanyProfile.findOne({ user: req.user.id })
        .populate('user', 'name email profilePhoto createdAt')
        .populate('approvedBy', 'name email');

    if (!profile) {
        return sendSuccess(res, {
            message: 'Profile not set up yet.',
            data: { profile: null },
        });
    }

    return sendSuccess(res, {
        message: 'Company profile fetched successfully.',
        data: { profile },
    });
});

export const upsertMyProfile = asyncHandler(async (req, res) => {
    const {
        companyName, website, industry, companyType, description, hrContact,
    } = req.body;

    const existing = await CompanyProfile.findOne({ user: req.user.id });

    if (existing?.approvalStatus === 'approved') {
        if (companyName && companyName !== existing.companyName) {
            throw new AppError('Company name cannot be changed after approval. Contact admin.', 400);
        }
        if (industry && industry !== existing.industry) {
            throw new AppError('Industry cannot be changed after approval. contact admin.', 400);
        }
    }

    const profile = await CompanyProfile.findOneAndUpdate(
        { user: req.user.id },
        {
            $set: {
                ...(companyName && { companyName }),
                ...(website && { website }),
                ...(industry && { industry }),
                ...(companyType && { companyType }),
                ...(description && { description }),
                ...(hrContact && { hrContact }),
                ...(existing?.approvalStatus === 'rejected' && { approvalStatus: 'pending' }),
            }
        },
        {
            new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true 
        }
    ).populate('user', 'name email');

    logger.info(`Company Profile updated: ${req.user.id}`);

    return sendSuccess(res, {
        message: existing 
            ? 'profile updated successfully.'
            : 'Profile created successfully. Awaiting admin approval.',
        data: { profile },
    });
}) 