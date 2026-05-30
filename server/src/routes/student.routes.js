import { Router } from 'express';
import * as studentController from '../controllers/student.controller.js';
import { protect, restrictTo } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';
import {
    updateProfileValidator,
    projectValidator,
    certificationValidator,
    objectIdValidator,
} from '../validators/student.validator.js';
import { uploadResume, uploadPhoto } from '../services/upload.service.js';

const router = Router();

router.use(protect, restrictTo('student'));

// profile
router.route('/profile')
    .get(studentController.getMyProfile)
    .put(updateProfileValidator, validate, studentController.upsertMyProfile);

//file uploads
router.post(
    '/resume',
    uploadResume.single('resume'),
    studentController.uploadResume
);
router.post(
    '/photo',
    uploadPhoto.single('single'),
    studentController.uploadProfilePhoto
);

// projects
router.route('/projects')
    .post(projectValidator, validate, studentController.addProject);

router.route('/projects/:projectId')
    .patch(
        [...objectIdValidator('projectId'), ...projectValidator],
        validate,
        studentController.updateProject
    )
    .delete(
        objectIdValidator('projectId'),
        validate,
        studentController.deleteProject
    );

// certification 

router.route('/certifications')
    .post(certificationValidator, validate, studentController.addCertification);

router
    .route('/certifications/:certId')
    .delete(
        objectIdValidator('certId'),
        validate,
        studentController.deleteCertification
    );

// drives -- student browsing 
router.route('/drives')
    .get(studentController.getEligibleDrives);

router.route('/drives/:driveId')
    .get(studentController.getDriveDetail)

router.route('/drives/:driveId/apply')
    .post(studentController.applyToDrive);

// applications -- students own applications 

router.route('application')
    .get(studentController.getMyApplications);

router
    route('/applications/:applicationId')
    .get(studentController.getApplicationDetail)
    .delete(studentController.withdrawApplication);


export default router;