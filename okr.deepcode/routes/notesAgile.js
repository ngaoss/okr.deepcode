import express from 'express';
import NoteAgile from '../models/NoteAgile.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Lấy ghi chú theo đối tượng (Project/Sprint/Feature/Task)
router.get('/:targetType/:targetId', authMiddleware, async (req, res) => {
    try {
        const notes = await NoteAgile.find({
            targetType: req.params.targetType.toUpperCase(),
            targetId: req.params.targetId
        }).populate('createdBy', 'name avatar').sort({ createdAt: -1 });
        res.json(notes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Tạo ghi chú mới
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { targetType, targetId, type, title, content, mentions } = req.body;
        const note = await NoteAgile.create({
            targetType: targetType.toUpperCase(),
            targetId,
            type: type.toUpperCase(),
            title,
            content,
            mentions: mentions || [],
            createdBy: req.user.id
        });
        res.json(note);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Cập nhật và lưu lịch sử ghi chú
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const oldNote = await NoteAgile.findById(req.params.id);
        if (!oldNote) return res.status(404).json({ message: 'Note not found' });

        // Lưu phiên bản cũ vào history
        oldNote.history.push({
            content: oldNote.content,
            updatedBy: req.user.id,
            updatedAt: new Date()
        });

        const { title, content, mentions } = req.body;
        oldNote.title = title || oldNote.title;
        oldNote.content = content || oldNote.content;
        oldNote.mentions = mentions || oldNote.mentions;

        await oldNote.save();
        res.json(oldNote);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// XÃ³a ghi chÃº
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const note = await NoteAgile.findByIdAndDelete(req.params.id);
        if (!note) return res.status(404).json({ message: 'Note not found' });
        res.json({ message: 'Note deleted' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
