import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import {logger} from '../config/logger.js';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true, // always use HTTPS URLs
})

// Resume storage

const resumeStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: `campus-placement/resumes/${req.user.id}`,
        resource_type: 'raw',
        public_id: `resume-${req.user.id}-${Date.now()}`,
        format: 'pdf',

    })
});

// Profile photo storage

const photoStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: 'campus-placement/photos',
        resource_type: 'image',
        public_id: `photo-${req.user.id}-${Date.now()}`,
        transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
        ]
    }),

});

const pdfFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are qllowed for resume upload'), false);
    }
};

const imageFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPG, PNG, or WebP images are allowed for profile photo.'), false);
    }
};

// Multer Instances

export const uploadResume = multer({
    storage: resumeStorage,
    fileFilter: pdfFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB Limit
        files: 1, // Only one file allowed
    }
});

export const uploadPhoto = multer({
    storage: photoStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
        files: 1, // Only one file allowed
    }

})

//Delete from cloudinary

export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        if (!publicId) return;
        const result = await cloudinary.uploader.destroy(publicId,
            { resource_type: resourceType, }
        )
        logger.info(`Cloudinary deleted: ${publicId} → result: ${result.result}`);
        return result;
    } catch(error) {
        logger.error(`Cloudinary delete failed: ${publicId} → ${err.message}`);
    }
};

export default cloudinary;
