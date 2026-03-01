import mongoose from 'mongoose';

const NoteAgileSchema = new mongoose.Schema({
    targetType: {
        type: String,
        enum: ['PROJECT', 'SPRINT', 'FEATURE', 'TASK'],
        required: true
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: {
        type: String,
        enum: ['BUSINESS', 'TECHNICAL', 'MEETING'],
        required: true
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    history: [{
        content: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

export default mongoose.model('NoteAgile', NoteAgileSchema);
