import mongoose from 'mongoose';

const companyProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },

        companyName: {
            type: String,
            required: [true, 'Company name is required'],
            trim: true,
            maxlength: [200, 'Company name too long'],
        },

        website: {
            type: String,
            trim: true,
            default: null,
        },
        logo: {
            url: { type: String, default: null },
            publicId: { type: String, default: null },
        },

        industry: {
            type: String,
            enum: {
                values: ['IT', 'Finance', 'Healthcare', 'Manufacturing', 'Consulting', 'Ecommerce', 'Startup', 'Other'],
                message: 'Invalid industry type',
            },
            required: [true, 'Industry is required'],
        },

        companyType: {
            type: String,
            enum:{
                values: ['Product', 'Service', 'Startup', 'PSU', 'MNC', 'Other'],
                message: 'Invalid company type',
            },
            required: [true, 'Company type is required'],
        },

        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
            default:null,
        },
        
    }
)