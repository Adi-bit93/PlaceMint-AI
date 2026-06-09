import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
    objectIdValidator,
    studentListValidator,
    updateStudentStatusValidator,
    companyApprovalValidator,
    publishDriveValidator,
    announcementValidator,
    driveListValidator,
    roundResultValidator
} from '../validators/admin.validators.js';
const router = Router();

//All admin routes: JWT required + admin role only
router.use(protect, restrictTo('admin'));

router.get('/stats', adminController.getOverviewStats);
router.get('/stats/placement', adminController.getPlacementAnalytics);
router.get('/pending-approvals', adminController.getPendingApprovals);

//  STUDENT MANAGEMENT
router.get(
    '/students',
    studentListValidator,
    validate,
    adminController.getAllStudents
);

router.get(
    '/students/:studentId',
    objectIdValidator('studentId'),
    validate,
    adminController.getStudent
);

router.patch(
    '/students/:studentId/status',
    [...objectIdValidator('studentId'), ...updateStudentStatusValidator],
    validate,
    adminController.updateStudentStatus
);

// COMPANY MANAGEMENT

router.get(
    '/companies',
    validate,
    adminController.getAllCompanies
);

router.patch(
    '/companies/:companyId/approve',
    objectIdValidator('companyId'),
    validate,
    adminController.approveCompany
);

router.patch(
    '/companies/:companyId/reject',
    [...objectIdValidator('companyId'), ...companyApprovalValidator],
    validate,
    adminController.rejectCompany
);

// DRIVE MANAGEMENT
router.get(
    '/drives',
    driveListValidator,
    validate,
    adminController.getAllDrives
);

router.get(
    '/drives/:driveId',
    objectIdValidator('driveId'),
    validate,
    adminController.getDrive
);

router.patch(
    '/drives/:driveId/publish',
    [...objectIdValidator('driveId'), ...publishDriveValidator],
    validate,
    adminController.publishDrive
);

router.patch(
    '/drives/:driveId/status',
    objectIdValidator('driveId'),
    validate,
    adminController.updateDriveStatus
);

router.patch(
    '/drives/:driveId/round-result',
    [...objectIdValidator('driveId'), ...roundResultValidator],
    validate,
    adminController.updateRoundResult
);

// ANNOUNCEMENTS

router.post(
    '/announcements',
    announcementValidator,
    validate,
    adminController.createAnnouncement
);

export default router;
