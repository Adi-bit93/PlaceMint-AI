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
});

// Company Management 
//Get all companies
export const getAllCompanies = asyncHandler(async (req, res) => {
    const filter = {};
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (industry) filter.industry = industry;
    if (search) {
        filter.companyName = { $regex: search, $options: 'i' };
    }

    const totalCount = await CompanyProfile.countDocuments(filter);
    const { skip, limit, meta } = getPagination(req.query, totalCount);

    const companies = await CompanyProfile
        .find(filter)
        .populate('user', 'name email isActive createdAt lastLogin')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('companyName industry companyType approvalStatus logo totalHired averagePackage hrContact createdAt')
        .lean();

    return sendSuccess(res, {
        message: 'Companies fetched successfully.',
        data: { companies },
        meta,
    })
});

export const approveCompany = asyncHandler(async (req, res) => {
    const company = await CompanyProfile.findById(req.params.companyId).populate('user');
    if (!company) throw new AppError('Company not found.', 404);

    if (company.approvalStatus === 'approved') {
        throw new AppError('Company is already approved.', 400);
    }

    company.approvalStatus = 'approved';
    company.approvedBy = req.user.id;
    company.approvedAt = new Date();
    await company.save();

    // Activate the company's User account
    await User.findByIdAndUpdate(company.user._id, { isActive: true });

    // Notify company
    await Notification.create({
        recipient: company.user._id,
        type: 'company_approved',
        title: 'Account Approved!',
        message: 'Your company account has been approved. You can now post placement drives.',
        actionUrl: '/company/drives',
    });

    invalidatePrefix('admin:stats');

    logger.info(`Company approved: ${company.companyName} by admin ${req.user.id}`);

    return sendSuccess(res, {
        message: `${company.companyName} approved successfully.`,
        data: { companyId: company._id, approvalStatus: 'approved' },
    });
});

//Reject Company
export const rejectCompany = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    const company = await CompanyProfile.findById(req.params.companyId).populate('user');
    if (!company) throw new AppError('Company not found.', 404);

    company.approvalStatus = 'rejected';
    company.rejectionReason = reason || null;
    await company.save();

    await Notification.create({
        recipient: company.user._id,
        type: 'company_rejected',
        title: 'Account Not Approved',
        message: reason
            ? `Your company account was not approved: ${reason}`
            : 'Your company account was not approved. Please update your profile and resubmit.',
        actionUrl: '/company/profile',
    });

    logger.info(`Company rejected: ${company.companyName} by admin ${req.user.id}`);

    return sendSuccess(res, {
        message: `${company.companyName} rejected.`,
        data: { companyId: company._id, approvalStatus: 'rejected' },
    });
});

//DRIVE MANAGEMENT
//Get all drives
export const getAllDrives = asyncHandler(async (req, res) => {
    const { status, company } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (company) filter.company = company;

    const totalCount = await Drive.countDocuments(filter);
    const { skip, limit, meta } = getPagination(req.query, totalCount);

    const drives = await Drive
        .find(filter)
        .populate('company', 'companyName logo industry')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-jobDescription -skillEmbedding')
        .lean();

    return sendSuccess(res, {
        message: 'Drives fetched successfully.',
        data: { drives },
        meta,
    });
});

// Get Single Drive
export const getDrive = asyncHandler(async (req, res) => {
    const drive = await Drive
        .findById(req.params.driveId)
        .populate('company', 'companyName logo industry companyType hrContact')
        .populate('createdBy', 'name email')
        .lean();

    if (!drive) throw new AppError('Drive not found.', 404);

    // Real-time application breakdown — not cached (admin needs live data)
    const breakdown = await Application.aggregate([
        { $match: { drive: drive._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusBreakdown = {};
    breakdown.forEach(({ _id, count }) => { statusBreakdown[_id] = count; });

    return sendSuccess(res, {
        message: 'Drive fetched successfully.',
        data: { drive, statusBreakdown },
    });
});

//Publish Drive
export const publishDrive = asyncHandler(async (req, res) => {
    const { isDreamCompany, aiWeights } = req.body;

    const drive = await Drive.findById(req.params.driveId);
    if (!drive) throw new AppError('Drive not found.', 404);

    if (drive.status === 'published') {
        throw new AppError('Drive is already published.', 400);
    }

    if (!['draft'].includes(drive.status)) {
        throw new AppError(`Cannot publish a drive in "${drive.status}" status.`, 400);
    }

    // Apply admin overrides before publishing
    const updates = { status: 'published' };
    if (isDreamCompany !== undefined) updates.isDreamCompany = isDreamCompany;
    if (aiWeights) {
        // Validate weights sum to 100
        const total = Object.values(aiWeights).reduce((a, b) => a + b, 0);
        if (Math.round(total) !== 100) {
            throw new AppError(`AI weights must sum to 100. Current sum: ${total}`, 400);
        }
        updates.aiWeights = aiWeights;
    }

    const published = await Drive.findByIdAndUpdate(
        drive._id,
        { $set: updates },
        { new: true }
    );

    //Notify student eligible student
    notifyEligibleStudents(published).catch((err) =>
        logger.error(`Notification dispatch failed for drive ${published._id}: ${err.message}`)
    );

    // Invalidate drive-related cache
    invalidatePrefix('admin:stats');

    logger.info(`Drive published: ${drive._id} by admin ${req.user.id}`);

    return sendSuccess(res, {
        message: 'Drive published successfully. Eligible students will be notified.',
        data: { drive: published },
    });
});

// Helper : notify eligble students when drive is published 
const notifyEligibleStudents = async (drive) => {
    const eligibilityFilter = {
        placementStatus: { $in: ['not_placed'] },
        cgpa: { $gte: drive.eligibility.minCgpa },
        activeBacklogs: { $lte: drive.eligibility.maxActiveBacklogs },
    };

    if (drive.eligibility.allowedBranches.length > 0) {
        eligibilityFilter.branch = { $in: drive.eligibility.allowedBranches };
    }

    if (drive.eligibility.allowedBatches.length > 0) {
        eligibilityFilter.batch = { $in: drive.eligibility.allowedBatches };
    }

    const eligibleStudents = await StudentProfile
        .find(eligibilityFilter)
        .select('user')
        .lean();

    if (eligibleStudents.length === 0) return;

    // Build all notification documents at once
    const notifications = eligibleStudents.map((s) => ({
        insertOne: {
            document: {
                recipient: s.user,
                type: 'drive_published',
                title: 'New Drive Available!',
                message: `A new placement drive has been posted. Apply before the deadline.`,
                actionUrl: `/student/drives/${drive._id}`,
                relatedDrive: drive._id,
                isRead: false,
                createdAt: new Date(),
            },
        },
    }));

    await Notification.bulkWrite(notifications, { ordered: false });

    logger.info(`Notified ${eligibleStudents.length} students for drive ${drive._id}`);
};

//CLOSE / CANCEL DRIVE
export const updateDriveStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const allowed = ['ongoing', 'completed', 'cancelled'];

    if (!allowed.includes(status)) {
        throw new AppError(`Status must be one of: ${allowed.join(', ')}`, 400);
    }

    const drive = await Drive.findByIdAndUpdate(
        req.params.driveId,
        { $set: { status } },
        { new: true }
    );

    if (!drive) throw new AppError('Drive not found.', 404);

    invalidatePrefix('admin:stats');

    logger.info(`Drive ${drive._id} status → ${status} by admin ${req.user.id}`);

    return sendSuccess(res, {
        message: `Drive status updated to "${status}".`,
        data: { driveId: drive._id, status },
    });
});

//Update Round Result
export const updateRoundResult = asyncHandler(async (req, res) => {
    const { applicationId, roundOrder, result, remarks } = req.body;

    const drive = await Drive.findById(req.params.driveId);
    if (!drive) throw new AppError('Drive not found.', 404);

    const application = await Application.findOne({
        _id: applicationId,
        drive: drive._id,
    });
    if (!application) throw new AppError('Application not found.', 404);

    // Upsert round result
    const existingIdx = application.roundResults
        .findIndex((r) => r.roundOrder === roundOrder);

    const roundEntry = {
        roundName: drive.rounds.find((r) => r.order === roundOrder)?.name || `Round ${roundOrder}`,
        roundOrder,
        result,
        remarks,
        updatedAt: new Date(),
    };

    if (existingIdx !== -1) {
        application.roundResults[existingIdx] = roundEntry;
    } else {
        application.roundResults.push(roundEntry);
    }

    // Update application status
    if (result === 'cleared') {
        application.status = 'in_process';
        application.currentRound = roundOrder;
    } else {
        application.status = 'rejected';
        application.rejectedAt = new Date();
    }

    await application.save();

    // Notify student of round result
    await Notification.create({
        recipient: application.student,
        type: 'round_result',
        title: result === 'cleared' ? '🎉 Round Cleared!' : 'Round Result Updated',
        message: result === 'cleared'
            ? `You cleared Round ${roundOrder} for a placement drive. Stay tuned for next steps.`
            : `Your application status has been updated for Round ${roundOrder}.`,
        relatedApplication: application._id,
        relatedDrive: drive._id,
    });

    return sendSuccess(res, {
        message: 'Round result updated.',
        data: {
            applicationId: application._id,
            roundOrder,
            result,
            applicationStatus: application.status,
        },
    });
});

// Announcements
// Create Announcement
export const createAnnouncement = asyncHandler(async (req, res) => {
    const { title, message, targetAudience = 'all', targetBranch, targetDriveId } = req.body;

    // Find target user IDs based on audience
    let recipientUserIds = [];

    if (targetAudience === 'all') {
        const users = await User
            .find({ isActive: true, role: { $in: ['student', 'company'] } })
            .select('_id')
            .lean();
        recipientUserIds = users.map((u) => u._id);

    } else if (targetAudience === 'students') {
        const users = await User
            .find({ isActive: true, role: 'student' })
            .select('_id')
            .lean();
        recipientUserIds = users.map((u) => u._id);

    } else if (targetAudience === 'companies') {
        const users = await User
            .find({ isActive: true, role: 'company' })
            .select('_id')
            .lean();
        recipientUserIds = users.map((u) => u._id);

    } else if (targetAudience === 'branch' && targetBranch) {
        // Students in a specific branch
        const profiles = await StudentProfile
            .find({ branch: targetBranch })
            .select('user')
            .lean();
        recipientUserIds = profiles.map((p) => p.user);

    } else if (targetAudience === 'drive' && targetDriveId) {
        // Students who applied to a specific drive
        const drive = await Drive.findById(targetDriveId);
        if (!drive) throw new AppError('Drive not found.', 404);

        const applications = await Application
            .find({ drive: targetDriveId })
            .populate('student', 'user')
            .lean();
        recipientUserIds = applications.map((a) => a.student?.user).filter(Boolean);
    }

    if (recipientUserIds.length === 0) {
        return sendSuccess(res, {
            message: 'No recipients found for the selected audience.',
            data: { sent: 0 },
        });
    }

    // Bulk insert all notifications — single DB call
    const notifications = recipientUserIds.map((userId) => ({
        insertOne: {
            document: {
                recipient: userId,
                type: 'announcement',
                title,
                message,
                isRead: false,
                createdAt: new Date(),
            },
        },
    }));

    await Notification.bulkWrite(notifications, { ordered: false });

    logger.info(
        `Announcement sent: "${title}" → ${recipientUserIds.length} recipients by admin ${req.user.id}`
    );

    return sendSuccess(res, {
        statusCode: 201,
        message: `Announcement sent to ${recipientUserIds.length} recipient(s).`,
        data: { title, sent: recipientUserIds.length, targetAudience },
    });
});

//For pending approval
export const getPendingApprovals = asyncHandler(async (req, res) => {
    // Run both queries in parallel
    const [pendingCompanies, draftDrives] = await Promise.all([
        CompanyProfile
            .find({ approvalStatus: 'pending' })
            .populate('user', 'name email createdAt')
            .select('companyName industry companyType hrContact createdAt')
            .sort({ createdAt: 1 }) // oldest first — FIFO queue
            .limit(20)
            .lean(),

        Drive
            .find({ status: 'draft' })
            .populate('company', 'companyName logo')
            .select('jobRole ctc applicationDeadline createdAt')
            .sort({ createdAt: 1 })
            .limit(20)
            .lean(),
    ]);

    return sendSuccess(res, {
        message: 'Pending approvals fetched.',
        data: {
            pendingCompanies,
            draftDrives,
            totalPending: pendingCompanies.length + draftDrives.length,
        },
    });
});