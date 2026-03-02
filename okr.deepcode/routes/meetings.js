import express from 'express';
import Meeting from '../models/Meeting.js';
import TaskAgile from '../models/TaskAgile.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Lấy danh sách cuộc họp
router.get('/', authMiddleware, async (req, res) => {
    try {
        const meetings = await Meeting.find().sort({ createdAt: -1 });
        res.json(meetings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Lấy chi tiết cuộc họp
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
        res.json(meeting);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Tạo cuộc họp mới
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, date, department, hostId, hostName, columns, projectId } = req.body;

        // Cấu trúc cột mặc định nếu không có
        const defaultColumns = columns || [
            { key: 'content', title: 'Nội dung cuộc họp', type: 'text', width: 400 },
            { key: 'assignee', title: 'Người phụ trách', type: 'user', width: 200 },
            { key: 'deadline', title: 'Hạn hoàn thành', type: 'date', width: 150 },
            { key: 'status', title: 'Trạng thái', type: 'select', options: ['TODO', 'IN_PROGRESS', 'DONE'], width: 150 }
        ];

        const meeting = await Meeting.create({
            title,
            date,
            department,
            projectId,
            hostId: hostId || req.user.id,
            hostName: hostName || req.user.name,
            columns: defaultColumns,
            rows: [],
            mapping: {
                titleKey: 'content',
                assigneeKey: 'assignee',
                deadlineKey: 'deadline',
                statusKey: 'status'
            }
        });
        res.json(meeting);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Cập nhật cuộc họp (cấu trúc sheet hoặc thông tin chung)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        // Nếu đã đóng, chỉ cho phép update trạng thái hoặc ghi chú (rows)
        if (meeting.status === 'CLOSED' && req.body.columns) {
            return res.status(400).json({ message: 'Cannot edit column structure of a closed meeting' });
        }

        // Logic sync sang Task nểu có linkedTaskId
        if (req.body.rows && meeting.mapping) {
            for (const row of req.body.rows) {
                if (row.linkedTaskId) {
                    const taskUpdate = {};
                    const { mapping } = meeting;
                    if (mapping.titleKey) taskUpdate.title = row.cells[mapping.titleKey];
                    if (mapping.deadlineKey) taskUpdate.endDate = row.cells[mapping.deadlineKey];
                    if (mapping.statusKey) taskUpdate.status = row.cells[mapping.statusKey];
                    // Note: Assignee sync might be complex if it's just a name string vs ID.
                    // Assuming user type returns an object or ID in a real app.

                    if (Object.keys(taskUpdate).length > 0) {
                        await TaskAgile.findByIdAndUpdate(row.linkedTaskId, taskUpdate);
                    }
                }
            }
        }

        const updated = await Meeting.findByIdAndUpdate(req.params.id, {
            ...req.body,
            updatedBy: req.user.id
        }, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Chuyển dòng thành Task
router.post('/:id/rows/:rowIdx/convert', authMiddleware, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

        const row = meeting.rows[req.params.rowIdx];
        if (!row) return res.status(404).json({ message: 'Row not found' });
        if (row.linkedTaskId) return res.status(400).json({ message: 'Row already linked to a task' });

        const { mapping } = meeting;
        if (!mapping || !mapping.featureId || !mapping.sprintId) {
            return res.status(400).json({ message: 'Meeting mapping (Feature/Sprint) not configured' });
        }

        // Create Task
        const taskPayload = {
            projectId: meeting.projectId,
            featureId: mapping.featureId,
            sprintId: mapping.sprintId,
            title: row.cells[mapping.titleKey] || 'Untitled Task from Meeting',
            description: `Created from meeting: ${meeting.title}`,
            status: row.cells[mapping.statusKey] || 'TODO',
            endDate: row.cells[mapping.deadlineKey],
            taskType: 'MEETING'
        };

        // If assignee mapping exists and is a user object/id
        if (mapping.assigneeKey && row.cells[mapping.assigneeKey]) {
            // Simplified: assume it's a name or we need to find the user
            taskPayload.assigneeName = row.cells[mapping.assigneeKey];
        }

        const newTask = await TaskAgile.create(taskPayload);

        // Link back to row
        meeting.rows[req.params.rowIdx].linkedTaskId = newTask._id;
        await meeting.save();

        res.json({ message: 'Task created', task: newTask });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Đóng cuộc họp
router.post('/:id/close', authMiddleware, async (req, res) => {
    try {
        const meeting = await Meeting.findByIdAndUpdate(req.params.id, { status: 'CLOSED' }, { new: true });
        res.json(meeting);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Sao chép cuộc họp (Clone & Version Control)
router.post('/:id/clone', authMiddleware, async (req, res) => {
    try {
        const { unfinishedOnly } = req.body;
        const original = await Meeting.findById(req.params.id);
        if (!original) return res.status(404).json({ message: 'Meeting not found' });

        let rowsToClone = original.rows;
        if (unfinishedOnly && original.mapping?.statusKey) {
            rowsToClone = original.rows.filter(row => row.cells[original.mapping.statusKey] !== 'DONE');
        }

        const clone = await Meeting.create({
            title: `${original.title} (Copy)`,
            date: new Date(),
            department: original.department,
            projectId: original.projectId,
            hostId: req.user.id,
            hostName: req.user.name,
            columns: original.columns,
            mapping: original.mapping,
            rows: rowsToClone.map(row => ({
                cells: row.cells,
                linkedTaskId: null // Reset links for new meeting
            }))
        });
        res.json(clone);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Mở lại cuộc họp
router.post('/:id/reopen', authMiddleware, async (req, res) => {
    try {
        const meeting = await Meeting.findByIdAndUpdate(req.params.id, { status: 'ACTIVE' }, { new: true });
        res.json(meeting);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Xóa cuộc họp
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await Meeting.findByIdAndDelete(req.params.id);
        res.json({ message: 'Meeting deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
