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
})