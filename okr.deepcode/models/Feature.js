import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
    type: { type: String, enum: ['FEATURE', 'TECHNICAL', 'MEETING'], required: true },
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    history: [{
        content: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now }
    }]
});

const FeatureSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    moduleName: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    acceptanceCriteria: String,
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status: { type: String, enum: ['BACKLOG', 'SELECTED', 'IN_PROGRESS', 'DONE'], default: 'BACKLOG' },
    notes: [NoteSchema],
    attachments: [{
        name: String,
        url: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    comments: [{
        content: String,
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        authorName: String,
        createdAt: { type: Date, default: Date.now }
    }],
    sprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sprint', default: null }
}, { timestamps: true });

export default mongoose.model('Feature', FeatureSchema);
