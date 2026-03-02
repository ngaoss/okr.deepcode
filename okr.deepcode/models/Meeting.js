import mongoose from 'mongoose';

const MeetingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: Date, required: true },
    department: String,
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hostName: String,
    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
    columns: [{
        key: { type: String, required: true },
        title: { type: String, required: true },
        type: { type: String, enum: ['text', 'number', 'date', 'select', 'user', 'checkbox'], default: 'text' },
        options: [String], // For 'select' type
        width: { type: Number, default: 200 }
    }],
    mapping: {
        titleKey: String,
        assigneeKey: String,
        deadlineKey: String,
        statusKey: String,
        featureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Feature' },
        sprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint' }
    },
    rows: [{
        cells: mongoose.Schema.Types.Mixed,
        linkedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskAgile' }
    }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Meeting', MeetingSchema);
