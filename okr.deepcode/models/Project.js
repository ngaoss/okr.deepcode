import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedLeaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['QUẢN TRỊ VIÊN', 'TRƯỞNG PHÒNG', 'TRƯỞNG NHÓM', 'NHÂN VIÊN'], default: 'NHÂN VIÊN' }
    }],
    modules: [{
        name: { type: String, required: true },
        description: String
    }],
    status: { type: String, enum: ['PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD'], default: 'PLANNING' },
    startDate: Date,
    endDate: Date
}, { timestamps: true });

export default mongoose.model('Project', ProjectSchema);
