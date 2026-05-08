import mongoose, { mongo } from "mongoose";

const applicationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'StudentProfile',
            required: true,
            index: true,
        },

        drive: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Drive',
            required: true,
            index: true,
        },

        status: {
            type: String,
            enum: ['applied', 'shortlisted', 'in_process', 'selected', 'rejected', 'withdrew'],
            default: 'applied',
            index: true,
        },
        aiScore: {
            total: { type: Number, default: null },

            breakdown: {
                skillMatch: { type: Number, default: null },
                cgpaScore: { type: Number, default: null },
                projectScore: { type: Number, default: null },
                certScore: { type: Number, default: null },
            },

            matchedSkills: { type: [String], default: [] }, // ['react', 'node.js']
            missingSkills: { type: [String], default: [] }, // ['docker', 'aws']
            bonusSkills: { type: [String], default: [] }, // bonus skills student has

            scoredAt: { type: Date, default: null },
        },
        roundResults: [
            {
                roundName: { type: String, required: true },
                roundOrder: { type: Number, required: true },
                result: { type: String, enum: ['cleared', 'eliminated', 'absent', 'pending'], default: 'pending' },
                remarks: { type: String, default: null },
                updatedAt: { type: Date, default: Date.now },
            }
        ],
        currentRound: { type: Number, default: null },

        offer: {
            ctc: { type: Number, default: null },
            role: { type: String, default: null },
            location: { type: String, default: null },
            offerDate: { type: Date, default: null },
            joiningDate: { type: Date, default: null },
        },
        adminNotes: {
            type: String,
            default: null,
            select: false,
        },
        appliedAt: { type: Date, default: Date.now },
        shortlistedAt: { type: String, default: null },
        selectedAt: { type: Date, default: null },
        rejectedAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                delete ret.__v;
                delete ret.adminNotes;
                return ret;
            },
        },
    }
)