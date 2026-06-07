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
    driveListValidator
} from '../validators/admin.validators.js';
const router = Router();

//All admin routes: JWT required + admin role only
router.use(protect, restrictTo('admin'));

router.get('/stats', adminController.getOverviewStats);
router.get('/stats/placement', adminController.getPlacementAnalytics);
router.get('/pending-approvals', adminController.getPendingApprovals);

