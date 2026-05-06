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