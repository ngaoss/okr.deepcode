import React, { useEffect, useState } from 'react';
import { featureService, noteAgileService, projectService } from '../services/projectService';

const EMPTY_NOTE = { title: '', type: 'BUSINESS', content: '', targetType: 'PROJECT', targetId: '' };

const Notes = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [notes, setNotes] = useState([]);
    const [features, setFeatures] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [newNote, setNewNote] = useState(EMPTY_NOTE);
    const [viewHistory, setViewHistory] = useState(null);

    const noteTypes = [
        { id: 'BUSINESS', label: 'Feature Note (Nghiệp vụ)', color: 'bg-blue-100 text-blue-600', icon: 'description' },
        { id: 'TECHNICAL', label: 'Technical Note (Kỹ thuật)', color: 'bg-purple-100 text-purple-600', icon: 'code' },
        { id: 'MEETING', label: 'Meeting Note (Họp)', color: 'bg-amber-100 text-amber-600', icon: 'groups' }
    ];

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProject?._id) {
            fetchNotes(selectedProject._id);
        }
    }, [selectedProject]);

    const resetNoteForm = () => {
        setIsAdding(false);
        setEditingNote(null);
        setNewNote(EMPTY_NOTE);
    };

    const fetchProjects = async () => {
        try {
            const data = await projectService.getProjects();
            setProjects(data || []);
            if (data?.length > 0 && !selectedProject) {
                setSelectedProject(data[0]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchNotes = async (projectId) => {
        try {
            const projectNotes = await noteAgileService.getNotes('PROJECT', projectId);
            const featureData = await featureService.getFeaturesByProject(projectId).catch(() => []);
            setFeatures(featureData);

            const featureNotesPromises = featureData.map(feature =>
                noteAgileService.getNotes('FEATURE', feature._id).catch(() => [])
            );
            const featureNotesArrays = await Promise.all(featureNotesPromises);
            const allFeatureNotes = featureNotesArrays.flat().map(note => ({
                ...note,
                featureName: featureData.find(feature => feature._id === note.targetId)?.title
            }));

            const allNotes = [...projectNotes, ...allFeatureNotes].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setNotes(allNotes);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveNote = async (e) => {
        e.preventDefault();
        if (!selectedProject?._id) return;

        try {
            if (editingNote?._id) {
                await noteAgileService.updateNote(editingNote._id, {
                    title: newNote.title,
                    content: newNote.content
                });
            } else {
                const isFeatureNote = newNote.targetType === 'FEATURE' && newNote.targetId !== '';
                await noteAgileService.createNote({
                    ...newNote,
                    targetId: isFeatureNote ? newNote.targetId : selectedProject._id,
                    targetType: isFeatureNote ? 'FEATURE' : 'PROJECT'
                });
            }

            await fetchNotes(selectedProject._id);
            resetNoteForm();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEditNote = (note) => {
        setEditingNote(note);
        setNewNote({
            title: note.title || '',
            type: note.type || 'BUSINESS',
            content: note.content || '',
            targetType: note.targetType || 'PROJECT',
            targetId: note.targetType === 'FEATURE' ? note.targetId : ''
        });
        setIsAdding(true);
    };

    const handleDeleteNote = async (noteId) => {
        if (!selectedProject?._id) return;
        if (!confirm('Bạn có chắc muốn xóa ghi chú này?')) return;
        try {
            await noteAgileService.deleteNote(noteId);
            await fetchNotes(selectedProject._id);
            if (editingNote?._id === noteId) resetNoteForm();
        } catch (err) {
            alert(err.message);
        }
    };
    
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Hệ thống Ghi chú</h1>
                    <p className="text-slate-500">Feature Note / Tech Note / Meeting Note</p>
                </div>
                <div className="flex gap-3">
                    <select
                        className="px-4 py-2 bg-slate-100 border-none rounded-lg font-medium cursor-pointer"
                        value={selectedProject?._id || ''}
                        onChange={(e) => setSelectedProject(projects.find(p => p._id === e.target.value))}
                    >
                        {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                    </select>
                    <button
                        onClick={() => {
                            resetNoteForm();
                            setIsAdding(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition"
                    >
                        + Tạo Ghi chú mới
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-indigo-100 animate-in fade-in zoom-in duration-200">
                    <form onSubmit={handleSaveNote} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input
                                required
                                className="px-4 py-2 border rounded-lg focus:ring-2 ring-indigo-500 md:col-span-1"
                                placeholder="Tiêu đề ghi chú..."
                                value={newNote.title}
                                onChange={e => setNewNote({ ...newNote, title: e.target.value })}
                            />
                            <select
                                className="px-4 py-2 border rounded-lg"
                                value={newNote.type}
                                onChange={e => setNewNote({ ...newNote, type: e.target.value })}
                                disabled={Boolean(editingNote)}
                            >
                                {noteTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                            <select
                                className="px-4 py-2 border rounded-lg text-sm text-slate-700 bg-slate-50"
                                value={newNote.targetType === 'FEATURE' ? newNote.targetId : ''}
                                onChange={e => {
                                    if (e.target.value) {
                                        setNewNote({ ...newNote, targetType: 'FEATURE', targetId: e.target.value });
                                    } else {
                                        setNewNote({ ...newNote, targetType: 'PROJECT', targetId: '' });
                                    }
                                }}
                                disabled={Boolean(editingNote)}
                            >
                                <option value="">Chọn Backlog đính kèm (bỏ trống = ghi chú chung)</option>
                                {features.map(f => <option key={f._id} value={f._id}>{f.title}</option>)}
                            </select>
                        </div>
                        <textarea
                            required
                            rows={6}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 ring-indigo-500 font-mono text-sm"
                            placeholder="Nội dung chi tiết..."
                            value={newNote.content}
                            onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                        />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={resetNoteForm} className="px-4 py-2">Hủy</button>
                            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">
                                {editingNote ? 'Cập nhật Ghi chú' : 'Lưu Ghi chú'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {notes.map(note => (
                    <div key={note._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:border-indigo-300 transition group">
                        <div className="p-4 border-b flex justify-between items-start bg-slate-50/50">
                            <div className="flex flex-col gap-2">
                                <div className={`p-2 rounded-lg w-max flex items-center gap-2 ${noteTypes.find(t => t.id === note.type)?.color}`}>
                                    <span className="material-icons text-lg">{noteTypes.find(t => t.id === note.type)?.icon}</span>
                                    <span className="text-xs font-bold">{(noteTypes.find(t => t.id === note.type)?.label || note.type || 'Note').split(' ')[0]}</span>
                                </div>
                                {note.targetType === 'FEATURE' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black w-max max-w-[200px] shadow-sm">
                                        <span className="material-icons text-[12px]">inventory_2</span>
                                        <span className="truncate">Backlog: {note.featureName || 'Đã xóa'}</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(note.createdAt).toLocaleDateString('vi-VN')}</span>
                                <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                                    <span className="material-icons text-[12px]">person</span>
                                    {note.createdBy?.name}
                                </div>
                            </div>
                        </div>
                        <div className="p-5 flex-1">
                            <h3 className="font-bold text-slate-800 mb-2">{note.title}</h3>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-6">{note.content}</p>
                        </div>
                        <div className="p-4 bg-slate-50 flex justify-between items-center shrink-0">
                            {note.history?.length > 0 ? (
                                <button
                                    onClick={() => setViewHistory(note)}
                                    className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
                                >
                                    Xem lịch sử ({note.history.length})
                                </button>
                            ) : <span />}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleEditNote(note)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 transition"
                                    title="Sửa ghi chú"
                                >
                                    <span className="material-icons text-xl">edit</span>
                                </button>
                                <button
                                    onClick={() => handleDeleteNote(note._id)}
                                    className="p-2 text-slate-400 hover:text-rose-600 transition"
                                    title="Xóa ghi chú"
                                >
                                    <span className="material-icons text-xl">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {viewHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">Lịch sử chỉnh sửa: {viewHistory.title}</h2>
                            <button onClick={() => setViewHistory(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {[...(viewHistory.history || [])].reverse().map((h, i) => (
                                <div key={i} className="space-y-2 border-l-2 border-indigo-200 pl-4 py-2">
                                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <span>Cập nhật: {new Date(h.updatedAt).toLocaleString('vi-VN')}</span>
                                    </div>
                                    <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border italic whitespace-pre-wrap">
                                        {h.content}
                                    </div>
                                </div>
                            ))}
                            <div className="space-y-2 border-l-2 border-green-400 pl-4 py-2">
                                <div className="text-[10px] font-black text-green-500 uppercase tracking-widest">Phiên bản hiện tại</div>
                                <div className="text-sm text-slate-600 bg-green-50/30 p-3 rounded-xl border border-green-100 italic whitespace-pre-wrap">
                                    {viewHistory.content}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notes;
