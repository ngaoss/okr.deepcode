import express from 'express';
import Project from '../models/Project.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Lấy danh sách dự án
router.get('/', authMiddleware, async (req, res) => {
    try {
        const projects = await Project.find({
            $or: [
                { ownerId: req.user.id },
                { 'members.userId': req.user.id }
            ]
        }).sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Tạo dự án mới
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, description, modules, members } = req.body;
        const project = await Project.create({
            title,
            description,
            modules: modules || [],
            members: members || [],
            ownerId: req.user.id
        });
        res.json(project);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Cập nhật dự án
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json(project);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Xóa dự án
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        // Ta không xóa hẳn để tránh mất dữ liệu liên quan, hoặc có thể xóa cascade. 
        // Ở đây ta thực hiện xóa hẳn Project.
        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json({ message: 'Project deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Thêm/Sửa Module trong dự án
router.patch('/:id/modules', authMiddleware, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        project.modules = req.body.modules;
        await project.save();
        res.json(project);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
