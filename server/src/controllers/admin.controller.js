import mongoose from 'mongoose';
import User from '../models/User.model.js';
import StudentProfile from '../models/StudentProfile.js';
import CompanyProfile from '../models/companyProfile.js';
import Drive from '../models/Drive.js';
import Application from '../models/Application.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError, sendSuccess, getPagination } from '../utils/apiResponse.js';
import { cacheOrFetch, invalidatePrefix, del } from '../config/cache.js';
import { logger } from '../config/logger.js';


export const getOverviewStats = asyncHandler(async (req, res) => {
    const CACHE_KEY = 'admin:stats:overview';
    const TTL = 120; // 2 minutes

    const stats = await cacheOrFetch(CACHE_KEY, async () => {

        const [studentStats, companyStats, driveStats, applicationStats] = await Promise.all([

            // Student aggregation — counts by placement status and branch
            StudentProfile.aggregate([
                {
                    $facet: {
                        total: [{ $count: 'count' }],
                        placed: [{ $match: { placementStatus: 'placed' } }, { $count: 'count' }],
                        notPlaced: [{ $match: { placementStatus: 'not_placed' } }, { $count: 'count' }],
                        byBranch: [{ $group: { _id: '$branch', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
                        avgCgpa: [{ $group: { _id: null, avg: { $avg: '$cgpa' } } }],
                    },
                },
            ]),

            // Company aggregation — counts by approval status
            CompanyProfile.aggregate([
                {
                    $facet: {
                        total: [{ $count: 'count' }],
                        approved: [{ $match: { approvalStatus: 'approved' } }, { $count: 'count' }],
                        pending: [{ $match: { approvalStatus: 'pending' } }, { $count: 'count' }],
                    },
                },
            ]),

            // Drive aggregation — counts by status
            Drive.aggregate([
                {
                    $facet: {
                        total: [{ $count: 'count' }],
                        published: [{ $match: { status: 'published' } }, { $count: 'count' }],
                        completed: [{ $match: { status: 'completed' } }, { $count: 'count' }],
                    },
                },
            ]),

            // Application aggregation — total and by status
            Application.aggregate([
                {
                    $facet: {
                        total: [{ $count: 'count' }],
                        selected: [{ $match: { status: 'selected' } }, { $count: 'count' }],
                    },
                },
            ]),
        ]);

        // Extract values from aggregation results safely
        const s = studentStats[0];
        const co = companyStats[0];
        const d = driveStats[0];
        const a = applicationStats[0];

        const totalStudents = s.total[0]?.count || 0;
        const placedCount = s.placed[0]?.count || 0;

        return {
            students: {
                total: totalStudents,
                placed: placedCount,
                notPlaced: s.notPlaced[0]?.count || 0,
                placementRate: totalStudents > 0
                    ? Math.round((placedCount / totalStudents) * 100)
                    : 0,
                averageCgpa: Math.round((s.avgCgpa[0]?.avg || 0) * 100) / 100,
                byBranch: s.byBranch,
            },
            companies: {
                total: co.total[0]?.count || 0,
                approved: co.approved[0]?.count || 0,
                pending: co.pending[0]?.count || 0,
            },
            drives: {
                total: d.total[0]?.count || 0,
                published: d.published[0]?.count || 0,
                completed: d.completed[0]?.count || 0,
            },
            applications: {
                total: a.total[0]?.count || 0,
                selected: a.selected[0]?.count || 0,
            },
        };
    }, TTL);

    return sendSuccess(res, {
        message: 'Overview stats fetched.',
        data: { stats },
    });
});

// 2. GET PLACEMENT ANALYTICS
export const getPlacementAnalytics = asyncHandler(async (req, res) => {
    const CACHE_KEY = 'admin:stats:placement';
    const TTL = 300;

    const analytics = await cacheOrFetch(CACHE_KEY, async () => {
        const [packageStats, topCompanies, skillDemand] = await Promise.all([

            // Average package per branch — for salary bar chart
            Application.aggregate([
                { $match: { status: 'selected' } },
                {
                    $lookup: {
                        from: 'studentprofiles',
                        localField: 'student',
                        foreignField: '_id',
                        as: 'studentProfile',
                    }
                },
                { $unwind: '$studentProfile' },
                {
                    $group: {
                        _id: '$studentProfile.branch',
                        avgPackage: { $avg: '$offer.ctc' },
                        maxPackage: { $max: '$offer.ctc' },
                        count: { $sum: 1 },
                    }
                },
                { $sort: { avgPackage: -1 } },
            ]),

            // Top 10 hiring companies by offer count
            Application.aggregate([
                { $match: { status: 'selected' } },
                {
                    $lookup: {
                        from: 'drives',
                        localField: 'drive',
                        foreignField: '_id',
                        as: 'driveData',
                    }
                },
                { $unwind: '$driveData' },
                {
                    $lookup: {
                        from: 'companyprofiles',
                        localField: 'driveData.company',
                        foreignField: '_id',
                        as: 'companyData',
                    }
                },
                { $unwind: '$companyData' },
                {
                    $group: {
                        _id: '$companyData._id',
                        companyName: { $first: '$companyData.companyName' },
                        hiredCount: { $sum: 1 },
                        avgCTC: { $avg: '$offer.ctc' },
                    }
                },
                { $sort: { hiredCount: -1 } },
                { $limit: 10 },
            ]),

            // Most in-demand skills across all published drives
            Drive.aggregate([
                { $match: { status: { $in: ['published', 'ongoing', 'completed'] } } },
                { $unwind: '$requiredSkills' },
                { $group: { _id: '$requiredSkills', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 },
            ]),
        ]);

        return { packageStats, topCompanies, skillDemand };
    }, TTL);

    return sendSuccess(res, {
        message: 'Placement analytics fetched.',
        data: { analytics },
    });
});

// Student Management

// Get All Student
export const getAllStudents = asyncHandler(async (req, res) => {
    const { branch, placementStatus, minCgpa, maxCgpa, batch, search } = req.query;

    // Build filter dynamically — only add fields that were provided
    const filter = {};
    if (branch) filter.branch = branch;
    if (placementStatus) filter.placementStatus = placementStatus;
    if (batch) filter.batch = parseInt(batch);
    if (minCgpa || maxCgpa) {
        filter.cgpa = {};
        if (minCgpa) filter.cgpa.$gte = parseFloat(minCgpa);
        if (maxCgpa) filter.cgpa.$lte = parseFloat(maxCgpa);
    }

    let userIdFilter = null;
    if (search) {
        const matchingUsers = await User.find({
            role: 'student',
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ],
        }).select('_id').lean();

        userIdFilter = matchingUsers.map((u) => u._id);
        filter.user = { $in: userIdFilter };
    }

    const totalCount = await StudentProfile.countDocuments(filter);
    const { skip, limit, meta } = getPagination(req.query, totalCount);

    const students = await StudentProfile
        .find(filter)
        .populate('user', 'name email profilePhoto isActive isEmailVerified createdAt lastLogin')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('user branch batch cgpa activeBacklogs placementStatus profileCompleteness skills enrollmentNumber createdAt')
        .lean(); // lean() returns plain objects instead of Mongoose docs → 40% faster, less memory

    return sendSuccess(res, {
        message: 'Students fetched successfully.',
        data: { students },
        meta,
    });
});

//4. GET SINGLE STUDENT
export const getStudent = asyncHandler(async (req, res) => {
    const profile = await StudentProfile
        .findById(req.params.studentId)
        .populate('user', 'name email profilePhoto isActive isEmailVerified createdAt lastLogin')
        .lean();

    if (!profile) throw new AppError('Student not found.', 404);

    // Get application history for this student
    const applications = await Application
        .find({ student: profile._id })
        .populate('drive', 'jobRole ctc status applicationDeadline')
        .sort({ appliedAt: -1 })
        .limit(10)
        .lean();

    return sendSuccess(res, {
        message: 'Student fetched successfully.',
        data: { profile, applications },
    });
});

// Update Student Status
export const updateStudentStatus = asyncHandler(async (req, res) => {
    const { isActive, placementStatus, reason } = req.body;

    const profile = await StudentProfile
        .findById(req.params.studentId)
        .populate('user')

    if (!profile) throw new AppError('Student not found.', 404);

    if (isActive !== undefined) {
        await User.findByIdAndUpdate(profile.user._id, { isActive });
    }

    // Update placement status if provided
    if (placementStatus) {
        profile.placementStatus = placementStatus;
        await profile.save();
    }

    // Invalidate overview stats cache — student count changed
    invalidatePrefix('admin:stats');

    logger.info(
        `Admin ${req.user.id} updated student ${profile._id}: isActive=${isActive} placementStatus=${placementStatus}`
    );

    return sendSuccess(res, {
        message: 'Student status updated successfully.',
        data: { studentId: profile._id, isActive, placementStatus },
    });
})