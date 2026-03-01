import mongoose from 'mongoose';

const SubtaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    isCompleted: { type: Boolean, default: false }
});

const TaskSchema = new mongoose.Schema({
    featureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Feature', required: true },
    sprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    description: String,
    status: {
        type: String,
        enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'],
        default: 'TODO'
    },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assigneeName: String,
    estimateTime: { type: Number, default: 0 }, // Giờ
    logTime: { type: Number, default: 0 }, // Giờ
    subtasks: [SubtaskSchema],
    startDate: Date,
    endDate: Date,
    baselineStartDate: Date, // Kế hoạch gốc
    baselineEndDate: Date,   // Kế hoạch gốc
    progress: { type: Number, default: 0, min: 0, max: 100 },
    taskType: {
        type: String,
        enum: ['FEATURE', 'BUG', 'MEETING', 'MILESTONE'],
        default: 'FEATURE'
    },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TaskAgile' }],
    position: { type: Number, default: 0 } // Phục vụ drag and drop
}, { timestamps: true });

export default mongoose.model('TaskAgile', TaskSchema); // Đặt tên TaskAgile để tránh trùng với Task OKR cũ nếu có
