import mongoose, { mongo } from "mongoose";

const projectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
    },
    techStack: [{
        type: String,
        trim: true,
        lowercase: true
    }], // ['react', 'node', 'mongodb'] 
    liveUrl: {
        type: String,
        trim: true,
        default: null,
    },
    githubUrl: {
        type: String,
        trim: true,
        default: null,
    }
}, { _id: true });

const certificationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },  // 'AWS Cloud Practitioner'
    issuer: { type: String, trim: true },                  // 'Amazon Web Services'
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    credentialUrl: { type: String, default: null },
}, { _id: true });

const experienceSchema = new mongoose.Schema({
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },   // null = currently working
    isCurrent: { type: Boolean, default: false },
    description: { type: String, trim: true },
}, { _id: true });

// Main Schema
const studentProfileSchema = new mongoose.Schema({
    // Link to user
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // one profile per user
        index: true,
    },

    // Academic Info
    enrollmentNumber: {
        type: String,
        required: [true, 'Enrollment number is required'],
        unique: true,
        trim: true,
        uppercase: true,
    },
    branch: {
        type: String,
        required: [true, 'Branch is required'],
        enum: {
            values: ['CE', 'IT', 'CSE', 'ENTC', 'MECH', 'CIVIL', 'EE', 'OTHER'],
            message: 'Invalid branch selected',
        },
    },

    batch: {
        type: Number,
        required: [true, 'Batch year is required'],
    },

    cgpa: {
        type: Number,
        required: [true, 'CGPA is required'],
        min: [0, 'CGPA cannot be less than 0'],
        max: [10, 'CGPA cannot exceed 10']
    },
    activeBacklogs: {
        type: Number,
        default: 0,
        min: [0, 'Active backlogs cannot be negative '],
    },
    totalBacklogs: {
        type: Number,
        default: 0,
        min: 0,
    },

    // Skill

    skills: {
        type: [String],
        default: [],
        set: (skills) => skills.map((s) => s.toLowerCase().trim()),
    },

    resume: {
        url: { type: String, default: null },  // Cloudinary URL
        publicId: { type: String, default: null },
        uploadedAt: { type: Date, default: null },

        parsedText: { type: String, default: null, select: false }, // raw extracted text(AI engine)
    },

    projects: { type: [projectSchema], default: [] },
    certifications: { type: [certificationSchema], defualt: [] },
    experiences: { type: [experienceSchema], default: [] },

    // Social Links
    links: {
        github: { type: String, default: null },
        linkedin: { type: String, default: null },
        portfolio: { type: String, default: null },
    },

    // placement status

    placementStatus: {
        type: String,
        enum: ['not_placed', 'placed', 'opted_out'],
        default: 'not_placed',
        index: true,
    },

    placedAt: {
        company: { type: String, default: null },
        role: { type: String, default: null },
        ctc: { type: Number, default: null },
        offerDate: { type: Date, default: null },
    },

    // AI Shortlisting 
    skillEmbedding: {
        type: [Number],
        default: null,
        select: false, // large array → never return in list queries
    },

    // ── Profile Completeness
    profileCompleteness: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
},
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                delete ret.__v;
                delete ret.skillEmbedding; // never expose embedding in API responses
                return ret;
            },
        },
    }
);

// ─── Indexes for admin filtering and AI hard-filter queries
studentProfileSchema.index({ branch: 1, batch: 1 });          
studentProfileSchema.index({ cgpa: -1 });                      
studentProfileSchema.index({ branch: 1, cgpa: -1 });           
studentProfileSchema.index({ placementStatus: 1, branch: 1 }); 
studentProfileSchema.index({ skills: 1 });                    
studentProfileSchema.index({ activeBacklogs: 1, cgpa: -1 });   

studentProfileSchema.pre('save', function(next) {
    let score = 0;

    if(this.enrollmentNumber) score += 10;
    if(this.cgpa > 0) score += 10;
    if(this.branch) score += 10;

    if(this.resume?.url) score += 20;

    if(this.skills.length >=3 ) score += 30;
    else if(this.skills.length >= 1) score += 10;

    if(this.links.linkedin || this.links.github) score += 10;

    this.profileCompleteness = Math.min(100, score);

    next()
})

const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);

export default StudentProfile;
