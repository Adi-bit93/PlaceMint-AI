import StudentProfile from '../models/StudentProfile.js';
import Drive from '../models/Drive.js';
import Application from '../models/Application.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError, sendSuccess, getPagination } from '../utils/apiResponse.js';
import { deleFromCloudinary } from '../services/upload.service.js';
import { logger } from '../config/logger.js';
import { runInNewContext } from 'vm';


export const getMyProfile = asyncHandler(async (req, res) => {
    const profile = await StudentProfile.findOne({ user: req.user.id })
        .populate('user', 'name email profilePhoto isEmailVerified createdAt');

    if (!profile) {
        return sendSuccess(res, {
            message: 'Profile not set up yet.',
            data: { profile: null },
        });
    }

    return sendSuccess(res, {
        message: 'Profile fetched successfully.',
        data: { profile },
    });
});

// Create or Update Profile in single QQuery with upsert
export const upsertMyProfile = asyncHandler(async (req, res) => {
    const {
        enrollmentNumber, branch, batch, cgpa, activeBacklogs, totalBacklogs, skills, links,
    } = req.body;

    const profile = await StudentProfile.findOneAndUpdate(
        { user: req.user.id },
        {
            $set: {
                ...(enrollmentNumber && { enrollmentNumber }),
                ...(branch && { branch }),
                ...(batch && { batch }),
                ...(cgpa !== undefined && { cgpa }),
                ...(activeBacklogs !== undefined && { activeBacklogs }),
                ...(totalBacklogs !== undefined && { totalBacklogs }),
                ...(skills && { skills }),
                ...(links && { links }),
            },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate('user', 'name email profilePhoto');

    logger.info(`Profile updated: student ${req.user.id}`);

    return sendSuccess(res, {
        statusCode: 200,
        message: 'Profile updated successfully.',
        data: { profile },
    });
});

// Upload resume
export const uploadResume = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new AppError('No file uploaded. Please attach a pdf file.', 400);
    }

    // find existing profile
    const profile = await StudentProfile.findOne({ user: req.user.id });

    // Delete old file before saving the new one 
    if (profile?.resume?.publicId) {
        await deleFromCloudinary(profile.resume.publicId, 'raw');
    }

    const updatedProfile = await StudentProfile.findOneAndUpdate(
        { user: req.user.id },
        {
            $set: {
                'resume.url': req.file.path, // Cloudinary secure Url
                'resume.publicId': req.file.filename, // Cloudinary public_id
                'resume.uploadedAt': new Date(),
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    logger.info(`Resume uploaded: student ${req.user.id} → ${req.file.path}`);

    return sendSuccess(res, {
        message: 'Resume uploaded successfully.',
        data: {
            resume: updatedProfile.resume,
            profileCompleteness: updatedProfile.profileCompleteness,
        },
    })
});

//Upload Profile Photo
export const uploadProfilePhoto = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new AppError('No file uploaded. Please attach an image file.', 400);
    }

    const { default: User } = await import('../models/User.model.js');
    const user = await User.findById(req.user.id);

    if (user.profilePhoto?.publicId) {
        await deleFromCloudinary(user.profilePhoto.publicId, 'image');
    }

    user.profilePhoto = {
        url: req.file.path,
        publicId: req.file.filename,
    };

    await user.save({ validateBeforeSave: false });

    logger.info(`Photo uploaded: user ${req.user.id}`);

    return sendSuccess(res, {
        message: 'Profile photo uploaded successfully.',
        data: { profilePhoto: user.profilePhoto },
    });
});

// Add projects into the projects array
export const addProject = asyncHandler(async (req, res) => {
    const { title, description, techStack, liveUrl, githubUrl } = req.body;

    const profile = await StudentProfile.findOneAndUpdate(
        { user: req.user.id },
        {
            $push: {
                projects: { title, description, techStack, liveUrl, githubUrl },
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const newProject = profile.projects[profile.projects.length - 1];

    logger.info(`Project added: student ${req.user.id} → "${title}"`);

    return sendSuccess(res, {
        statusCode: 201,
        message: 'Project added successfully.',
        data: { project: newProject, totalProjects: profile.projects.length },
    });
});

// Update Project 
//PATCH /api/v1/students/projects/:projectId
export const updateProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { title, description, techStack, liveUrl, githubUrl } = req.body;


    const updateFields = {};
    if (title !== undefined) updateFields['projects.$.title'] = title;
    if (description !== undefined) updateFields['projects.$.description'] = description;
    if (techStack !== undefined) updateFields['projects.$.techStack'] = techStack;
    if (liveUrl !== undefined) updateFields['projects.$.liveUrl'] = liveUrl;
    if (githubUrl !== undefined) updateFields['projects.$.githubUrl'] = githubUrl;

    const profile = await StudentProfile.findOneAndUpdate(
        { user: req.user.id, 'projects._id': projectId },
        { $set: updateFields },
        { new: true, runValidators: true }
    );

    if (!profile) {
        throw new AppError('Project not found.', 404);
    }

    const updated = profile.projects.find((p) => p._id.toString() === projectId);

    return sendSuccess(res, {
        message: 'Project updated successfully.',
        data: { project: updated },
    });
});

// DELETE PROJECT 
// DELETE /api/v1/students/projects/:projectId
export const deleteProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    const profile = await StudentProfile.findOneAndUpdate(
        { user: req.user.id },
        { $pull: { projects: { _id: projectId } } },
        { new: true }
    );

    if (!profile) {
        throw new AppError('Profile not found.', 404);
    }

    logger.info(`Project deleted: student ${req.user.id} → ${projectId}`);

    return sendSuccess(res, {
        message: 'Project deleted successfully.',
        data: { totalProjects: profile.projects.length },
    });
});

//ADD CERTIFICATION
export const addCertification = asyncHandler(async (req, res) => {
    const { name, issuer, issueDate, expiryDate, credentialUrl } = req.body;

    const profile = await StudentProfile.findOneAndUpdate(
        { user: req.user.id },
        {
            $push: {
                certifications: { name, issuer, issueDate, expiryDate, credentialUrl },
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const newCert = profile.certifications[profile.certifications.length - 1];

    return sendSuccess(res, {
        statusCode: 201,
        message: 'Certification added successfully.',
        data: { certification: newCert },
    });
});

//DELETE CERTIFICATION
export const deleteCertification = asyncHandler(async (req, res) => {
    const { certId } = req.params;

    const profile = await StudentProfile.findOneAndUpdate(
        { user: req.user.id },
        { $pull: { certifications: { _id: certId } } },
        { new: true }
    );

    if (!profile) throw new AppError('Profile not found.', 404);

    return sendSuccess(res, {
        message: 'Certification deleted successfully.',
        data: { totalCertifications: profile.certifications.length },
    });
});

// Get Eligible Drives
export const getEligibleDrives = asyncHandler(async (req, res) => {
    const profile = await StudentProfile.findOne({ user: req.user.id });

    if (!profile) {
        throw new AppError('Please complete your profile before viewing drives.', 400);
    }

    const now = new Date();
    const eligibilityFilter = {
        status: 'published',
        applicationDeadline: { $gt: now },
        'eligibility.minCgpa': { $lte: profile.cgpa },
        'eligibility.maxActiveBacklogs': { $gte: profile.activeBacklogs },
        $or: [
            { 'eligibility.allowedBranches': { $size: 0 } },         // empty = all branches
            { 'eligibility.allowedBranches': profile.branch },
        ],
    };

    if (profile.batch) {
        eligibilityFilter.$and = [
            {
                $or: [
                    { 'eligibility.allowedBatches': { $size: 0 } },      // empty = all batches
                    { 'eligibility.allowedBatches': profile.batch },
                ],
            },
        ];
    }
    const { page, limit: _l } = req.query;
    const totalCount = await Drive.countDocuments(eligibilityFilter);
    const { skip, limit, meta } = getPagination(req.query, totalCount);

    const drives = await Drive
        .find(eligibilityFilter)
        .populate('company', 'companyName industry companyType logo website')
        .sort({ applicationDeadline: 1 }) // soonest deadline first
        .skip(skip)
        .limit(limit)
        .select('-jobDescription -aiWeights -__v'); // exclude heavy fields from list view

    return sendSuccess(res, {
        message: 'Eligible drives fetched successfully.',
        data: { drives },
        meta,
    });
})

// Get Drive Detail
export const getDriveDetail = asyncHandler(async (req, res) => {
    const drive = await Drive
        .findById(req.params.driveId)
        .populate('company', 'companyName industry companyType logo website description hrContact');

    if (!drive || drive.status === 'draft') {
        throw new AppError('Drive not found.', 404);
    }

    // Check if student already applied to this drive
    const existing = await Application.findOne({
        drive: drive._id,
        student: (await StudentProfile.findOne({ user: req.user.id }))?._id,
    });

    return sendSuccess(res, {
        message: 'Drive fetched successfully.',
        data: {
            drive,
            hasApplied: !!existing,
            applicationStatus: existing?.status || null,
        },
    });
});

// Apply to drive
export const applyToDrive = asyncHandler(async (req, res) => {
    const { driveId } = req.params;

    const profile = await StudentProfile.findOne({ user: req.user.id });
    if (!profile) {
        throw new AppError('Please complete your profile before applying.', 400);

    }

    if (profile.profileCompleteness < 60) {
        throw new AppError(
            `Your profile is only ${profile.profileCompleteness}% complete. Please complete at least 60% before applying.`,
            400
        );
    }
    if (!profile.resume?.url) {
        throw new AppError('Please upload your resume before applying to drives.', 400);
    }

    const drive = await Drive.findById(driveId);
    if (!drive) throw new AppError('Drive not found', 404);
    if (drive.status !== 'published') throw new AppError('This drive is not open for applications.', 400);
    if (drive.applicationDeadline < new Date()) throw new AppError('Application deadline has passed', 400);

    if (profile.cgpa < drive.eligibility.minCgpa) {
        throw new AppError(
            `Your CGPA (${profile.cgpa}) does not meet the minimum requirement (${drive.eligibility.minCgpa}).`,
            400
        );
    }

    if (profile.activeBacklogs > drive.eligibility.maxActiveBacklogs) {
        throw new AppError(
            `You have ${profile.activeBacklogs} active backlog(s). This drive allows maximum ${drive.eligibility.maxActiveBacklogs}.`,
            400
        );
    }

    if (
        drive.eligibility.allowedBranches.length > 0 &&
        !drive.eligibility.allowedBranches.includes(profile.branch)
    ) {
        throw new AppError(`Your branch (${profile.branch}) is not eligible for this drive.`, 400);
    }

    // one student one job policy
    if (profile.placementStatus === 'placed' && !drive.isDreamCompany) {
        throw new AppError(
            'You are already placed. You can only apply to Dream Companies now.',
            400
        );
    }

    // check Duplicate application
    const existing = await Application.findOne({ student: profile._id, drive: driveId });
    if (existing) {
        throw new AppError('You have already applied to this drive.', 409);
    }

    // Create application
    const application = await Application.create({
        student: profile._id,
        drive: driveId,
        status: 'applied',
    });

    await Drive.findByIdAndUpdate(driveId, { $inc: { 'stats.totalApplied': 1 } });

    logger.info(`Application created: student ${profile._id} → drive ${driveId}`);

    return sendSuccess(res, {
        statusCode: 201,
        message: 'Application submitted successfully!',
        data: { application },
    });

});
