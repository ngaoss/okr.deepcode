import mongoose from 'mongoose';

const SprintSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    goal: String,
    status: {
        type: String,
        enum: ['PLANNING', 'ACTIVE', 'COMPLETED', 'CLOSED'],
        default: 'PLANNING'
    },
    reviewNotes: String, // Note khách hàng sau review
    completedAt: Date
}, { timestamps: true });

export default mongoose.model('Sprint', SprintSchema);
