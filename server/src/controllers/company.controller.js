import CompanyProfile from '../models/companyProfile.js'
import Drive from '../models/Drive.js';
import Application from '../models/Application.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, sendSuccess, getPagination } from '../utils/apiResponse.js';
import { deleteFromCloudinary } from '../services/upload.service.js';
import { logger } from '../config/logger.js';
import { get } from 'http';


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

// get single drive 
export const getDrive = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    const drive = await Drive.findOne({
        _id: req.params.driveId,
        company: company._id, // scoped to this company only 
    });
    if (!drive) throw new AppError('Drive not found.', 404);

    return sendSuccess(res, {
        message: 'Drive fetched successfully.',
        data: { drive },
    });

});

export const createDrive = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    if (company.approvalStatus !== 'approved') {
        throw new AppError('Your company must be approved before posting drives.', 403);
    }

    const {
        jobRole, jobDescription, ctc, ctcBreakdown, jobLocation,
        bond, eligibility, rounds, applicationDeadline, driveDate,
    } = req.body;

    const drive = await Drive.create({
        company: company._id,
        createdBy: req.user.id,
        jobRole,
        jobDescription,
        ctc,
        ctcBreakdown,
        jobLocation,
        bond,
        eligibility,
        rounds: rounds || [],
        applicationDeadline,
        driveDate,
        status: 'draft', // always starts as draft — admin publishes
    });

    logger.info(`Drive created: ${drive._id} by company ${company._id}`);

    return sendSuccess(res, {
        statusCode: 201,
        message: 'Drive created successfully. Submit to admin for review.',
        data: { drive },
    });
})

export const updateDrive = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    const drive = await Drive.findOne({
        _id: req.params.driveId,
        company: company._id,
    });

    if (!drive) throw new AppError('Drive not found.', 404);

    if (drive.status !== 'draft') {
        throw new AppError(
            `Drive cannot be edited in "${drive.status}" status. Contact admin for changes.`, 400
        )
    }

    const allowedFields = [
        'jobRole', 'jobDescription', 'ctc', 'ctcBreakdown',
        'jobLocation', 'bond', 'eligibility', 'rounds',
        'applicationDeadline', 'driveDate',
    ];

    // Only update fields that were actually sent in the request body
    const updates = {};
    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const updated = await Drive.findByIdAndUpdate(
        drive._id,
        { $set: updates },
        { new: true, runValidators: true }
    );

    logger.info(`Drive updated: ${drive._id}`);

    return sendSuccess(res, {
        message: 'Drive updated successfully.',
        data: { drive: updated },
    });
})

// Submit drive for review

export const submitDriveForReview = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    const drive = await Drive.findOne({
        _id: req.params.driveId,
        company: company._id,
    });

    if (!drive) throw new AppError('Drive not found.', 404);

    if (drive.status !== 'draft') {
        throw new AppError('Only draft drives can be submitted for review.', 400);
    }

    if (!drive.rounds || drive.rounds.length === 0) {
        throw new AppError('Please add at least one interview round before submitting.', 400);
    }

    drive.status = 'pending_review';

    logger.info(`Drive ${drive._id} submitted for review by company ${company._id}`);

    return sendSuccess(res, {
        message: 'Drive submitted for admin review. You will be notified once published.',
        data: { driveId: drive._id, status: drive.status },
    });
})

// Candidates - view and manage applicants 

// Get candidates
export const getCandidates = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    const drive = await Drive.findOne({
        _id: req.params.driveId,
        company: company._id,
    })
    if (!drive) throw new AppError('Drive not found.', 404);

    const filter = { drive: drive._id };

    if (req.query.status) filter.status = req.query.status;

    if (req.query.minScore) {
        filter['aiScore.total'] = { $gte: parseFloat(req.query.minScore) };
    }

    const totalCount = await Application.countDocuments(filter);
    const { skip, limit, meta } = getPagination(req.query, totalCount);

    const candidates = await Application
        .filter(filter)
        .populate({
            path: 'student',
            select: 'cgpa branch batch skills projects certifications links resume enrollmentNumber profileCompleteness',
            populate: {
                path: 'user',
                select: 'name email profilePhoto',
            },
        })
        .sort({ 'aiScore.total': -1, appliedAt: -1 })
        .skip(skip)
        .limit(limit);

    return sendSuccess(res, {
        message: 'Candidates fetched successfully.',
        data: { candidates, driveTitle: drive.jobRole },
        meta,
    });
})

//Get single candidate detail
export const getCandidateDetail = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    const drive = await Drive.findOne({ _id: req.params.driveId, company: company._id });
    if (!drive) throw new AppError('Drive not found.', 404);

    const application = await Application
        .findOne({ _id: req.params.applicationId, drive: drive._id })
        .populate({
            path: 'student',
            populate: { path: 'user', select: 'name email profilePhoto createdAt' },
        });

    if (!application) throw new AppError('Application not found.', 404);

    return sendSuccess(res, {
        message: 'Candidate detail fetched successfully.',
        data: { application },
    });
})

// Shortlist Candidate
export const ShortlistCandidate = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    const drive = await Drive.findOne({ _id: req.params.driveId, company: company._id });
    if (!drive) throw new AppError('Drive not found.', 404);

    const application = await Application.findOne({
        _id: req.params.applicationId,
        drive: drive._id,
    });

    if (!application) throw new AppError('Application not found.', 404);

    if (!['applied', 'shortlisted'].includes(application.status)) {
        throw new AppError(`Cannot shortlist — candidate is already ${application.status}.`, 400);
    }

    application.status = 'shortlisted';
    application.shortlistedAt = new Date();
    await application.save();

    // Update drive shortlist count
    await Drive.findByIdAndUpdate(drive._id, {
        $inc: { 'stats.totalShortlisted': 1 },
    });

    logger.info(`Shortlisted: application ${application._id} by company ${company._id}`);

    return sendSuccess(res, {
        message: 'Candidate shortlisted successfully.',
        data: { applicationId: application._id, status: application.status },
    });
});

//REJECT CANDIDATE
export const rejectCandidate = asyncHandler(async (req, res) => {
    const company = await getCompanyOrFail(req.user.id);

    const drive = await Drive.findOne({ _id: req.params.driveId, company: company._id });
    if (!drive) throw new AppError('Drive not found.', 404);

    const application = await Application.findOne({
        _id: req.params.applicationId,
        drive: drive._id,
    });

    if (!application) throw new AppError('Application not found.', 404);

    if (['selected', 'rejected', 'withdrew'].includes(application.status)) {
        throw new AppError(`Candidate is already ${application.status}.`, 400);
    }

    application.status = 'rejected';
    application.rejectedAt = new Date();
    await application.save();

    logger.info(`Rejected: application ${application._id} by company ${company._id}`);

    return sendSuccess(res, {
        message: 'Candidate rejected.',
        data: { applicationId: application._id, status: application.status },
    });
});

// Update round result 
export const updateRoundResult = asyncHandler(async (req, res) => {
    const { roundName, roundOrder, result, remarks } = req.body;

    if (!roundName || !roundOrder || !result) {
        throw new AppError('roundName, roundOrder, and result are required.', 400);
    }

    if (!['cleared', 'eliminated', 'absent'].includes(result)) {
        throw new AppError('Result must be cleared, eliminated, or absent.', 400);
    }

    const company = await getCompanyOrFail(req.user.id);
    const drive = await Drive.findOne({ _id: req.params.driveId, company: company._id });
    if (!drive) throw new AppError('Drive not found.', 404);

    const application = await Application.findOne({
        _id: req.params.applicationId,
        drive: drive._id,
    });
    if (!application) throw new AppError('Application not found.', 404);

    const existingRoundIdx = application.roundResults.findIndex(
        (r) => r.roundOrder === roundOrder
    );

    if (existingRoundIdx !== -1) {
        // Update existing round result
        application.roundResults[existingRoundIdx].result = result;
        application.roundResults[existingRoundIdx].remarks = remarks;
        application.roundResults[existingRoundIdx].updatedAt = new Date();
    } else {
        // Add new round result
        application.roundResults.push({
            roundName, roundOrder, result, remarks,
        });
    }

    // Update application status based on result
    if (result === 'eliminated' || result === 'absent') {
        application.status = 'rejected';
        application.rejectedAt = new Date();
    } else if (result === 'cleared') {
        application.status = 'in_process';
        application.currentRound = roundOrder;
    }

    await application.save();

    logger.info(`Round result updated: application ${application._id} round ${roundOrder} → ${result}`);

    return sendSuccess(res, {
        message: 'Round result updated successfully.',
        data: {
            applicationId: application._id,
            roundOrder,
            result,
            applicationStatus: application.status,
        },
    });
})

export const selectCandidate = asyncHandler(async (req, res) => {
    const { ctc, role, location, offerDate, joiningDate } = req.body;

    const company = await getCompanyOrFail(req.user.id);
    const drive = await Drive.findOne({ _id: req.params.driveId, company: company._id });
    if (!drive) throw new AppError('Drive not found.', 404);
    const application = await Application.findOne({
        _id: req.params.applicationId,
        drive: drive._id,
    });

    if (!application) throw new AppError('Application not found.', 404);

    if (application.status === 'selected') {
        throw new AppError('Candidate is already selected.', 400);
    }

    application.status = 'selected';
    application.selectedAt = new Date();
    application.offer = {
        ctc: ctc || drive.ctc,
        role: role || drive.jobRole,
        location: location || drive.jobLocation,
        offerDate: offerDate ? new Date(offerDate) : new Date(),
        joiningDate: joiningDate ? new Date(joiningDate) : null,
    };
    await application.save();

    // Update drive selected count
    await Drive.findByIdAndUpdate(drive._id, {
        $inc: { 'stats.totalSelected': 1 },
    });

    // Update student placement status to 'placed'
    const StudentProfile = (await import('../models/StudentProfile.js')).default;
    await StudentProfile.findByIdAndUpdate(application.student, {
        $set: {
            placementStatus: 'placed',
            'placedAt.company': company.companyName,
            'placedAt.role': application.offer.role,
            'placedAt.ctc': application.offer.ctc,
            'placedAt.offerDate': application.offer.offerDate,
        },
    });

    logger.info(`Candidate selected: application ${application._id} → placed`);

    return sendSuccess(res, {
        message: 'Candidate selected and marked as placed.',
        data: {
            applicationId: application._id,
            offer: application.offer,
        },
    });
})
