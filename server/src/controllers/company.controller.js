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
});

// Upload Logo
export const uploadLogo = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new AppError('No file uploaded. Please attach an image file.', 400);
    };

    const profile = await CompanyProfile.findOne({ user: req.user.id });

    // delete old logo from Cloundinary
    if (profile?.logo?.publicId) {
        await deleteFromCloudinary(profile.logo.publicId, 'image');
    }

    const updated = await CompanyProfile.findOneAndUpdate(
        { user: req.user.id },
        {
            $set: {
                'logo.url': req.file.path,
                'logo.publicId': req.file.filename,
            },
        },
        { new: true, upsert: true }
    );

    return sendSuccess(res, {
        message: 'Logo uploaded successfully.',
        data: { logo: updated.logo },
    });
});

// DRIVES

// GET My Drives

export const getMyDrives = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    if (company.approvalStatus !== 'approved') {
        throw new AppError(
            `Your company account is ${company.approvalStatus}. You cannot manage drives until approved.`,
            403
        );
    }

    const { status } = req.query;
    const filter = { company: company._id };
    if (status) filter.status = status;

    const totalCount = await Drive.countDocuments(filter);
    const { skip, limit, meta } = getPagination(req.query, totalCount);

    const drives = await Drive.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-jobDescription -aiWeights'); // exclude heavy fields from list

    return sendSuccess(res, {
        message: 'Drives fetched successfully.',
        data: { drives },
        meta,
    });
});
