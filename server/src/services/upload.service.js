import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import logger from '../config/logger.js';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true, // always use HTTPS URLs
})

// Resume storage

const resumeStorage = new ClloudinaryStorage({
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
            {width: 400, height: 400, crop: 'fill', gravity: 'face'},
            {quality: 'auto', fetch_format: 'auto'},
        ]
    }),

});