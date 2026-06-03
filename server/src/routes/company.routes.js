import { application, Router } from "express";
import * as companyController from '../controllers/company.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
    updateCompanyProfileValidator,
    createDriveValidator,
    objectIdValidator,
    candidateQueryValidator,
    updateDriveValidator
} from '../validators/company.validator.js';
import { uploadPhoto } from "../services/upload.service.js";

const router = Router();

router.use(protect, restrictTo('company'));

router
    .route('profile')
    .get(companyController.getMyProfile)
    .put(
        updateCompanyProfileValidator,
        validate,
        companyController.upsertMyProfile
    );

router.post(
    '/logo',
    uploadPhoto.single('logo'),
    companyController.uploadLogo
);

// Drives
router
    .route('/drives')
    .get(companyController.getMyDrives)
post(
    createDriveValidator,
    validate,
    companyController.createDrive
);

router
    .route('/drives/:driveId')
    .get(
        objectIdValidator('driveId'),
        validate,
        companyController.getDrive
    )
    .patch(
        [...objectIdValidator('driveId'), ...updateDriveValidator],
        validate,
        companyController.updateDrive
    );

router.patch(
    '/drives/:driveId/submit',
    objectIdValidator('driveId'),
    validate,
    companyController.submitDriveForReview
);

Router.get(
    '/drives/:driveId/stats',
    objectIdValidator('driveId'),
    validate,
    companyController.getDriveStats
);

// Candidates

router.get(
    '/drives/:driveId/candidates',
    [...objectIdValidator('driveId'), ...candidateQueryValidator],
    validate,
    companyController.getCandidates
);

router.get(
    '/drives/:driveId/candidates/:applicationId',
    [...objectIdValidator('driveId'), ...objectIdValidator('applicationId')],
    validate,
    companyController.getCandidateDetail
);

router.patch(
    '/drives/:driveId/candidates/:applicationId/shortlist',
    [...objectIdValidator('driveId'), ...objectIdValidator('applicationId')],
    validate,
    companyController.ShortlistCandidate
);

router.patch(
    'drives/:driveId/candidates/:applicationId/reject',
    [...objectIdValidator('driveId'), ...objectIdValidator('applicationId')],
    validate,
    companyController.rejectCandidate
);

router.patch(
    '/drives/:driveId/candidates/:applicationId/round-result',
    [...objectIdValidator('driveId'), ...objectIdValidator('applicationId')],
    validate,
    companyController.updateRoundResult
);

router.patch(
    '/drives/:driveId/candidates/:applicationId/select',
    [...objectIdValidator('driveId'), ...objectIdValidator('applicationId')],
    validate,
    companyController.selectCandidate
);

export default router;

