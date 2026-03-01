import express from 'express';
import Sprint from '../models/Sprint.js';
import Feature from '../models/Feature.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Lấy danh sách Sprint của dự án
router.get('/project/:projectId', authMiddleware, async (req, res) => {
    try {
        const sprints = await Sprint.find({ projectId: req.params.projectId }).sort({ startDate: 1 });
        res.json(sprints);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Tạo Sprint mới
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { projectId, name, startDate, endDate, goal } = req.body;
        const sprint = await Sprint.create({
            projectId,
            name,
            startDate,
            endDate,
            goal,
            status: 'PLANNING'
        });
        res.json(sprint);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Cập nhật trạng thái Sprint (Start/End Sprint)
router.patch('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status, reviewNotes } = req.body;
        const updateData = { status };
        if (status === 'COMPLETED') {
            updateData.completedAt = new Date();
            updateData.reviewNotes = reviewNotes;
        }

        const sprint = await Sprint.findByIdAndUpdate(req.params.id, updateData, { new: true });

        // Nếu End Sprint, các Feature chưa DONE sẽ cần xử lý (thường là quay lại Backlog hoặc sang Sprint mới)
        // Ở đây ta để logic đơn giản là cập nhật trạng thái Sprint trước

        res.json(sprint);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Gán Feature vào Sprint
router.patch('/:id/add-features', authMiddleware, async (req, res) => {
    try {
        const { featureIds } = req.body;
        await Feature.updateMany(
            { _id: { $in: featureIds } },
            { $set: { sprintId: req.params.id, status: 'SELECTED' } }
        );
        res.json({ message: 'Features added to sprint' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Cập nhật Sprint
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const sprint = await Sprint.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
        res.json(sprint);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Xóa Sprint
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const sprint = await Sprint.findByIdAndDelete(req.params.id);
        if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

        // Khi xóa sprint, đưa các feature liên quan về trạng thái BACKLOG
        await Feature.updateMany({ sprintId: req.params.id }, { $unset: { sprintId: 1 }, $set: { status: 'BACKLOG' } });

        res.json({ message: 'Sprint deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
