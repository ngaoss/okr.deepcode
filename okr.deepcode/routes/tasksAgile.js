import express from 'express';
import TaskAgile from '../models/TaskAgile.js';
import Feature from '../models/Feature.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Lấy danh sách task của một Sprint
router.get('/sprint/:sprintId', authMiddleware, async (req, res) => {
    try {
        const tasks = await TaskAgile.find({ sprintId: req.params.sprintId }).sort({ position: 1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Tạo Task mới cho một Feature
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { featureId, sprintId, projectId, title, description, assigneeId, assigneeName, estimateTime, progress, taskType, dependencies, startDate, endDate, baselineStartDate, baselineEndDate } = req.body;
        const task = await TaskAgile.create({
            featureId,
            sprintId,
            projectId,
            title,
            description,
            assigneeId,
            assigneeName,
            estimateTime,
            progress: progress || 0,
            taskType: taskType || 'FEATURE',
            dependencies: dependencies || [],
            startDate,
            endDate,
            baselineStartDate: baselineStartDate || startDate,
            baselineEndDate: baselineEndDate || endDate,
            status: 'TODO'
        });
        res.json(task);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Cập nhật trạng thái/vị trí Task (Kanban drag-drop)
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const task = await TaskAgile.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(task);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Log time cho task
router.post('/:id/log-time', authMiddleware, async (req, res) => {
    try {
        const { hours } = req.body;
        const task = await TaskAgile.findById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });

        task.logTime += Number(hours);
        await task.save();
        res.json(task);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Xóa Task
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const task = await TaskAgile.findByIdAndDelete(req.params.id);
        if (!task) return res.status(404).json({ message: 'Task not found' });
        res.json({ message: 'Task deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
