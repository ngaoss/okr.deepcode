import express from 'express';
import Project from '../models/Project.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Lấy danh sách trưởng phòng (dùng cho admin khi tạo/sửa dự án)
router.get('/managers', authMiddleware, async (req, res) => {
    try {
        const managers = await User.find({ role: 'TRƯỞNG PHÒNG' }).select('_id name email department avatar');
        res.json(managers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Lấy danh sách trưởng nhóm (dùng cho trưởng phòng khi gán dự án)
router.get('/leaders', authMiddleware, async (req, res) => {
    try {
        const leaders = await User.find({ role: 'TRƯỞNG NHÓM', department: req.user.department }).select('_id name email department avatar');
        res.json(leaders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Lấy danh sách dự án (phân quyền theo vai trò)
router.get('/', authMiddleware, async (req, res) => {
    try {
        let query = {};

        if (req.user.role === 'QUẢN TRỊ VIÊN' || req.user.role === 'ADMIN') {
            query = {}; // Admin xem tất cả
        } else if ((req.user.role === 'TRƯỞNG PHÒNG' || req.user.role === 'MANAGER') && req.query.kanban === 'true') {
            query = {}; // Manager xem tất cả trong Kanban Board
        } else if (req.user.role === 'TRƯỞNG PHÒNG' || req.user.role === 'MANAGER') {
            query = {
                $or: [
                    { assignedManagerId: req.user.id },
                    { ownerId: req.user.id },
                    { 'members.userId': req.user.id }
                ]
            };
        } else {
            // NHÂN VIÊN / TRƯỞNG NHÓM: thấy dự án của trưởng nhóm
            const queryPaths = [];
            if (req.user.role === 'TRƯỞNG NHÓM') {
                queryPaths.push({ assignedLeaderId: req.user.id });
                queryPaths.push({ ownerId: req.user.id });
            } else if (req.user.role === 'NHÂN VIÊN') {
                if (req.user.supervisorId) {
                    queryPaths.push({ assignedLeaderId: req.user.supervisorId });
                }
            }
            queryPaths.push({ 'members.userId': req.user.id });

            query = {
                $or: queryPaths.length > 0 ? queryPaths : [{ _id: null }] // Nếu không có path nào, thì không ra kết quả
            };
        }

        const projects = await Project.find(query)
            .populate('ownerId', 'name department')
            .populate('assignedManagerId', 'name email department avatar')
            .populate('assignedLeaderId', 'name email department avatar')
            .sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Tạo dự án mới (chỉ admin)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'QUẢN TRỊ VIÊN') {
            return res.status(403).json({ message: 'Chỉ Quản Trị Viên mới có thể tạo dự án' });
        }
        const { title, description, modules, members, assignedManagerId } = req.body;
        const project = await Project.create({
            title,
            description,
            modules: modules || [],
            members: members || [],
            assignedManagerId: assignedManagerId || null,
            ownerId: req.user.id
        });
        const populated = await project.populate('assignedManagerId', 'name email department avatar');
        res.json(populated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Cập nhật dự án
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (req.user.role === 'QUẢN TRỊ VIÊN') {
            // Admin toàn quyền
            const updated = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true })
                .populate('assignedManagerId', 'name email department avatar')
                .populate('assignedLeaderId', 'name email department avatar');
            return res.json(updated);
        } else if (req.user.role === 'TRƯỞNG PHÒNG') {
            // Trưởng phòng chỉ được cập nhật modules
            const isAssigned = project.assignedManagerId?.toString() === req.user.id ||
                project.ownerId?.toString() === req.user.id;
            if (!isAssigned) return res.status(403).json({ message: 'Không có quyền sửa dự án này' });

            project.modules = req.body.modules || project.modules;
            if (req.body.assignedLeaderId !== undefined) {
                project.assignedLeaderId = req.body.assignedLeaderId || null;
            }
            await project.save();
            return res.json(project);
        } else {
            return res.status(403).json({ message: 'Không có quyền sửa dự án' });
        }
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Xóa dự án (chỉ admin)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'QUẢN TRỊ VIÊN') {
            return res.status(403).json({ message: 'Chỉ Quản Trị Viên mới có thể xóa dự án' });
        }
        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json({ message: 'Project deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Cập nhật modules (admin hoặc trưởng phòng được giao)
router.patch('/:id/modules', authMiddleware, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const isAdmin = req.user.role === 'QUẢN TRỊ VIÊN';
        const isAssignedManager = req.user.role === 'TRƯỞNG PHÒNG' &&
            (project.assignedManagerId?.toString() === req.user.id || project.ownerId?.toString() === req.user.id);

        if (!isAdmin && !isAssignedManager) {
            return res.status(403).json({ message: 'Không có quyền chỉnh sửa modules' });
        }

        project.modules = req.body.modules;
        await project.save();
        res.json(project);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
