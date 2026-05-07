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
