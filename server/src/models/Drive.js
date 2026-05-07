import mongoose from 'mongoose'

const roundSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
        // e.g. 'Aptitude Test', 'Technical Interview', 'HR Interview'
    },
    order: {
        type: Number,
        required: true, // 1, 2, 3 defines sequence
    },
    scheduledAt: { type: Date, default: null },
    venue: { type: String, default: null },

    // Status updated by admin
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed'],
        default: 'upcoming',
    },

    // Number who appeared and cleared this round
    // Updated by admin after round completes
    appeared: { type: Number, default: 0 },
    cleared: { type: Number, default: 0 },
}, { _id: true });

const driveSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CompanyProfile',
        required: true,
        index: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    jobRole: {
        type: String,
        required: [true, 'Job role is required'],
        trim: true,
        // e.g. 'Software Engineer', 'Data Analyst', 'Systems Engineer'
    },
    jobDescription: {
        type: String,
        required: [true, 'Job description is required'],
        trim: true,
        maxlength: [5000, 'Job description too long'],
        //  AI engine parses this to extract required skills
    },
    ctc: {
        type: Number,
        required: [true, 'CTC is required'],
        min: [0, 'CTC cannot be negative'],
    },
    ctcBreakdown: {
        type: String,
        default: null,
    },
    jobLocation: {
        type: String,
        trim: true,
        default: null,
    },
    bond: {
        hasBond: { type: Boolean, default: false },
        duration: { type: String, default: null }, // '1 year'
        details: { type: String, default: null },
    },

    //  Eligibility Rules (Hard Filter)
    eligibility: {
        minCgpa: {
            type: Number,
            required: [true, 'Minimum CGPA is required'],
            min: 0,
            max: 10,
        },
    },

    allowedBranches: {
        type: [String],
        enum: ['CE', 'IT', 'CSE', 'ENTC', 'MECH', 'CIVIL', 'EE', 'OTHER'],
        default: [],
    },

    maxActiveBacklogs: {
        type: Number,
        default: 0,
        min: 0,
    },

    allowedBatches: {
        type: [Number],
        default: [],
    },
    requiredSkills: {
        type: [String],
        default: [],
        set: (skills) => skills.map((s) => s.toLowerCase().trim()),
    },

    //AI Shortlisting
    requiredSkills: {
        type: [String],
        default: [],
        set: (s) => s.map((x) => x.toLowerCase().trim()),
    },
    bonusSkills: {
        type: [String],
        default: [],
        set: (s) => s.map((x) => x.toLowerCase().trim()),
    },

    // AI weight Overrides
    aiWeights: {
        skill: { type: Number, default: 40 },
        cgpa: { type: Number, default: 30 },
        projects: { type: Number, default: 20 },
        certifications: { type: Number, default: 10 },
    },
    rounds: {
        type: [roundSchema],
        default: [],
    },
    applicationDeadline: {
        type: Date,
        required: [true, 'Application deadline is required'],
    },
    driveDate: {
        type: Date,
        default: null,
    },

    // Drive Status
    status: {
        type: String,
        enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
        default: 'draft',
        index: true,
    },
    isDreamCompany: {
        type: Boolean,
        default: false,
        index: true,
    },
    stats: {
        totalApplied: { type: Number, default: 0 },
        totalShortlisted: { type: Number, default: 0 },
        totalSelected: { type: Number, default: 0 },
    },
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
)
