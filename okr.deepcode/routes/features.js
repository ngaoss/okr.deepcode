import express from 'express';
import Feature from '../models/Feature.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Lấy danh sách Features trong Backlog của một dự án
router.get('/project/:projectId', authMiddleware, async (req, res) => {
    try {
        const features = await Feature.find({ projectId: req.params.projectId }).sort({ createdAt: -1 });
        res.json(features);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Tạo Feature mới (Backlog item)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { projectId, moduleName, title, description, acceptanceCriteria, priority } = req.body;
        const feature = await Feature.create({
            projectId,
            moduleName,
            title,
            description,
            acceptanceCriteria,
            priority,
            status: 'BACKLOG'
        });
        res.json(feature);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Cập nhật Feature (bao gồm cả Note)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const feature = await Feature.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(feature);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Thêm Note vào Feature
router.post('/:id/notes', authMiddleware, async (req, res) => {
    try {
        const feature = await Feature.findById(req.params.id);
        if (!feature) return res.status(404).json({ message: 'Feature not found' });

        const { type, content } = req.body;
        feature.notes.push({
            type,
            content,
            createdBy: req.user.id
        });

        await feature.save();
        res.json(feature);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Xóa Feature
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const feature = await Feature.findByIdAndDelete(req.params.id);
        if (!feature) return res.status(404).json({ message: 'Feature not found' });
        res.json({ message: 'Feature deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
