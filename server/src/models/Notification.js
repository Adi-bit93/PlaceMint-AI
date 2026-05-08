import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                'drive_published',
                'application_received',
                'shortlisted',
                'round_result',
                'selected',
                'rejected',
                'drive_reminder',
                'announcement',
                'profile_incomplete',
                'company_approved',
                'company_rejected',
            ],
            required: true,
            index: true,
        },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },

        // Link
        actionUrl: { type: String, default: null },

        isRead: { type: Boolean, default: false, index: true },
        readAt: { type: Date, default: null },

        relatedDrive: { type: mongoose.Schema.Types.ObjectId, ref: 'Drive', default: null },
        relatedApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },

    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                delete ret.__v;
                return ret;
            },
        },
    }
);