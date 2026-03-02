import React, { useState, useEffect, useRef } from 'react';
import { meetingService } from '../services/meetingService';
import { projectService, featureService, sprintService, taskAgileService } from '../services/projectService';
import { dataService } from '../services/dataService';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useNavigate, useParams } from 'react-router-dom';

const Meetings: React.FC = () => {
    const { user: currentUser } = useAuth();
    const { confirm: customConfirm } = useConfirm();
    const navigate = useNavigate();
    const { id: meetingId } = useParams();

    const [meetings, setMeetings] = useState<any[]>([]);
    const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newMeeting, setNewMeeting] = useState({ title: '', date: new Date().toISOString().split('T')[0], department: currentUser?.department || '', projectId: '' });
    const [tasks, setTasks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [features, setFeatures] = useState<any[]>([]);
    const [sprints, setSprints] = useState<any[]>([]);

    const [showMappingModal, setShowMappingModal] = useState(false);
    const [showColumnModal, setShowColumnModal] = useState<{ isOpen: boolean, colIndex: number | null }>({ isOpen: false, colIndex: null });
    const [showCloneOptionsModal, setShowCloneOptionsModal] = useState<{ isOpen: boolean, meetingId: string | null }>({ isOpen: false, meetingId: null });

    const [editingColumn, setEditingColumn] = useState<any>(null);
    const optionsRef = useRef<HTMLTextAreaElement>(null);
    const [tempMapping, setTempMapping] = useState<any>(null);
    const [showUserPicker, setShowUserPicker] = useState<{ rIdx: number, colKey: string } | null>(null);

    useEffect(() => {
        if (!meetingId) {
            fetchMeetings();
            fetchProjects();
        } else {
            fetchMeetingDetails(meetingId);
        }
    }, [meetingId]);

    const fetchProjects = async () => {
        try {
            const data = await projectService.getProjects();
            setProjects(data || []);
        } catch (err) {
            console.error('Failed to fetch projects', err);
        }
    };

    const fetchMeetings = async () => {
        setIsLoading(true);
        try {
            const data = await meetingService.getMeetings();
            setMeetings(data);
        } catch (err) {
            console.error('Failed to fetch meetings', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMeetingDetails = async (id: string) => {
        setIsLoading(true);
        try {
            const data = await meetingService.getMeeting(id);
            setSelectedMeeting(data);
            if (data.projectId) {
                const tasksData = await taskAgileService.getTasksByProject(data.projectId);
                setTasks(tasksData || []);
                const featuresData = await featureService.getFeaturesByProject(data.projectId);
                setFeatures(featuresData || []);
                const sprintsData = await sprintService.getSprintsByProject(data.projectId);
                setSprints(sprintsData || []);
            }
            const usersData = await dataService.getUsers();
            setUsers(usersData || []);
            setTempMapping(data.mapping || {});
        } catch (err) {
            console.error('Failed to fetch meeting details', err);
            navigate('/meetings');
        } finally {
            setIsLoading(false);
        }
    };

    const getCleanRows = (rows: any[]) => {
        return rows.map(({ _id, tempId, ...rest }: any) => {
            if (_id && String(_id).startsWith('row_')) return rest;
            if (_id) return { _id, ...rest };
            return rest;
        });
    };

    const handleCreateMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const created = await meetingService.createMeeting(newMeeting);
            setMeetings([created, ...meetings]);
            setShowCreateModal(false);
            setNewMeeting({ title: '', date: new Date().toISOString().split('T')[0], department: currentUser?.department || '', projectId: '' });
            navigate(`/meetings/${created._id}`);
        } catch (err) {
            alert('Lỗi tạo cuộc họp');
        }
    };

    const handleSaveSheet = async () => {
        if (!selectedMeeting) return;
        try {
            const updated = await meetingService.updateMeeting(selectedMeeting._id, {
                columns: selectedMeeting.columns,
                rows: getCleanRows(selectedMeeting.rows)
            });
            setSelectedMeeting(updated);
            return updated;
        } catch (err) {
            alert('Lỗi lưu sheet');
            throw err;
        }
    };

    const handleCloseMeeting = async (m?: any) => {
        const target = m || selectedMeeting;
        if (!target) return;
        const ok = await customConfirm({
            title: 'Kết thúc cuộc họp?',
            message: 'Sau khi đóng, cấu trúc cột sẽ không thể thay đổi. Bạn có chắc chắn không?',
            type: 'warning'
        });
        if (!ok) return;

        try {
            const updated = await meetingService.closeMeeting(target._id);
            if (selectedMeeting?._id === target._id) setSelectedMeeting(updated);
            setMeetings(prev => prev.map(mm => mm._id === target._id ? updated : mm));
        } catch (err) {
            alert('Lỗi đóng cuộc họp');
        }
    };

    const handleReopenMeeting = async (m?: any) => {
        const target = m || selectedMeeting;
        if (!target) return;
        const ok = await customConfirm({
            title: 'Mở khóa cuộc họp?',
            message: 'Cuộc họp sẽ quay lại trạng thái Đang diễn ra và có thể chỉnh sửa.',
            type: 'warning'
        });
        if (!ok) return;

        try {
            const updated = await meetingService.reopenMeeting(target._id);
            if (selectedMeeting?._id === target._id) setSelectedMeeting(updated);
            setMeetings(prev => prev.map(mm => mm._id === target._id ? updated : mm));
        } catch (err) {
            alert('Lỗi mở khóa cuộc họp');
        }
    };

    const handleCloneMeeting = async (id: string, options: any = {}) => {
        try {
            const cloned = await meetingService.cloneMeeting(id, options);
            setMeetings([cloned, ...meetings]);
            setShowCloneOptionsModal({ isOpen: false, meetingId: null });
            alert('Đã sao chép cuộc họp thành công!');
        } catch (err) {
            alert('Lỗi sao chép cuộc họp');
        }
    };

    const handleDeleteMeeting = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const ok = await customConfirm({
            title: 'Xóa cuộc họp?',
            message: 'Toàn bộ nội dung sheet sẽ bị xóa vĩnh viễn. Bạn có chắc chắn không?',
            type: 'danger'
        });
        if (!ok) return;

        try {
            await meetingService.deleteMeeting(id);
            setMeetings(meetings.filter(m => m._id !== id));
        } catch (err) {
            alert('Lỗi xóa cuộc họp');
        }
    };

    const handleDeleteColumn = async (colIndex: number) => {
        const ok = await customConfirm({
            title: 'Xóa cột?',
            message: 'Toàn bộ dữ liệu của cột này sẽ biến mất. Bạn có chắc chắn không?',
            type: 'danger'
        });
        if (!ok) return;

        const colKey = selectedMeeting.columns[colIndex].key;
        // Check mapping
        const isMapped = Object.values(selectedMeeting.mapping || {}).includes(colKey);
        if (isMapped) {
            alert('Không thể xóa cột đang được mapping sang Task. Hãy gỡ mapping trước.');
            return;
        }

        const newCols = selectedMeeting.columns.filter((_, i) => i !== colIndex);
        const updatedMeeting = { ...selectedMeeting, columns: newCols };
        setSelectedMeeting(updatedMeeting);
        setShowColumnModal({ isOpen: false, colIndex: null });

        // Auto save structure change
        try {
            await meetingService.updateMeeting(updatedMeeting._id, {
                columns: newCols,
                rows: getCleanRows(selectedMeeting.rows)
            });
            setMeetings(prev => prev.map(m => m._id === updatedMeeting._id ? updatedMeeting : m));
        } catch (err) {
            console.error(err);
        }
    };

    const handleConvertRow = async (rowIdx: number) => {
        if (!selectedMeeting) return;
        try {
            // Auto save first to ensure server has the latest data (especially the row itself)
            await handleSaveSheet();

            const res = await meetingService.convertRowToTask(selectedMeeting._id, rowIdx);
            const updatedRows = [...selectedMeeting.rows];
            updatedRows[rowIdx].linkedTaskId = res.task?._id || res.task?.id;
            setSelectedMeeting({ ...selectedMeeting, rows: updatedRows });
            alert('Đã tạo Task thành công!');
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.message || err.message || 'Lỗi tạo Task. Hãy kiểm tra cấu hình Mapping.');
        }
    };

    const handleConvertRowWithTitle = async (rIdx: number, customTitle: string) => {
        if (!selectedMeeting.mapping?.titleKey) return;

        // First update the cell content to the custom title if it changed
        const newRows = [...selectedMeeting.rows];
        newRows[rIdx].cells[selectedMeeting.mapping.titleKey] = customTitle;
        setSelectedMeeting({ ...selectedMeeting, rows: newRows });

        // Then call convert
        handleConvertRow(rIdx);
    };

    const handleAddRow = () => {
        if (!selectedMeeting) return;
        const newId = `row_${Math.random().toString(36).substr(2, 9)}`;
        const newRow = {
            tempId: newId, // Use tempId for local React keys
            cells: {},
            linkedTaskId: null
        };
        setSelectedMeeting({
            ...selectedMeeting,
            rows: [...selectedMeeting.rows, newRow]
        });
    };

    const handleCellChange = (rowIndex: number, columnKey: string, value: any) => {
        if (!selectedMeeting || selectedMeeting.status === 'CLOSED') return;

        const updatedRows = [...selectedMeeting.rows];
        const row = { ...updatedRows[rowIndex] };
        const cells = { ...(row.cells || {}) };
        cells[columnKey] = value;
        row.cells = cells;
        updatedRows[rowIndex] = row;

        setSelectedMeeting({ ...selectedMeeting, rows: updatedRows });
    };

    const handleDeleteRow = (idx: number) => {
        const row = selectedMeeting.rows[idx];
        if (row.linkedTaskId) {
            alert('Không thể xóa dòng đã được liên kết với Task. Hãy xóa Task hoặc gỡ liên kết trước (tính năng tương lai).');
            return;
        }
        const updatedRows = selectedMeeting.rows.filter((_: any, i: number) => i !== idx);
        setSelectedMeeting({ ...selectedMeeting, rows: updatedRows });
    };

    // Removed unused handleColumnTitleChange

    const handleAddColumn = async () => {
        if (selectedMeeting.status === 'CLOSED') return;
        const newCol = {
            key: `col_${Date.now()}`,
            title: 'Cột mới',
            width: 150,
            type: 'text',
            options: []
        };
        const newCols = [...selectedMeeting.columns, newCol];

        // Save immediately with full context to prevent row data loss
        try {
            const updated = await meetingService.updateMeeting(selectedMeeting._id, {
                columns: newCols,
                rows: getCleanRows(selectedMeeting.rows) // Keep existing row data (including unsaved changes)
            });
            setSelectedMeeting(updated);
            setMeetings(prev => prev.map(m => m._id === updated._id ? updated : m));
        } catch (err) {
            alert('Lỗi thêm cột');
        }
    };

    const handleUpdateColumn = async () => {
        if (!selectedMeeting || editingColumn === null || showColumnModal.colIndex === null) return;

        const updatedCols = [...selectedMeeting.columns];
        const finalCol = { ...editingColumn };
        if (finalCol.type === 'select' && !Array.isArray(finalCol.options)) {
            finalCol.options = [];
        }

        if (showColumnModal.colIndex >= updatedCols.length) {
            updatedCols.push(finalCol);
        } else {
            updatedCols[showColumnModal.colIndex] = finalCol;
        }

        // Parse from ref here
        const optionsText = optionsRef.current?.value || '';
        const opts = optionsText.split(',').map((s: string) => s.trim()).filter(s => s !== '');
        updatedCols[showColumnModal.colIndex].options = opts;

        const updatedMeeting = { ...selectedMeeting, columns: updatedCols };
        setSelectedMeeting(updatedMeeting);
        setShowColumnModal({ isOpen: false, colIndex: null });

        // Auto save structure with row preservation
        try {
            const updated = await meetingService.updateMeeting(updatedMeeting._id, {
                columns: updatedCols,
                rows: getCleanRows(selectedMeeting.rows)
            });
            setMeetings(prev => prev.map(m => m._id === updated._id ? updated : m));
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveMapping = async () => {
        if (!selectedMeeting) return;
        try {
            const updated = await meetingService.updateMeeting(selectedMeeting._id, { mapping: tempMapping });
            setSelectedMeeting(updated);
            setShowMappingModal(false);
            alert('Đã lưu cấu hình Mapping!');
        } catch (err) {
            alert('Lỗi lưu Mapping');
        }
    };

    const renderCellInput = (row: any, col: any, rIdx: number) => {
        const val = row.cells[col.key] || '';
        const isClosed = selectedMeeting.status === 'CLOSED';
        const onChange = (e: any) => handleCellChange(rIdx, col.key, e.target.value);

        switch (col.type) {
            case 'number':
                return <input type="number" disabled={isClosed} className="w-full p-2 text-sm outline-none focus:bg-white disabled:bg-slate-50 disabled:text-slate-400" value={val} onChange={onChange} />;
            case 'date':
                return <input type="date" disabled={isClosed} className="w-full p-2 text-sm outline-none focus:bg-white disabled:bg-slate-50 disabled:text-slate-400" value={val} onChange={onChange} />;
            case 'checkbox':
                return (
                    <div className="flex justify-center p-2">
                        <input type="checkbox" disabled={isClosed} className="w-5 h-5 accent-indigo-600 disabled:opacity-50" checked={val === true || val === 'true'} onChange={(e) => handleCellChange(rIdx, col.key, e.target.checked ? 'true' : 'false')} />
                    </div>
                );
            case 'select':
                {
                    const s = val.toLowerCase();
                    let colorClass = 'bg-slate-50 text-slate-500 border-slate-200';
                    if (s.includes('chú ý')) colorClass = 'bg-rose-50 text-rose-600 border-rose-200 ring-rose-500/10';
                    if (s.includes('tiếp tục')) colorClass = 'bg-amber-50 text-amber-600 border-amber-200 ring-amber-500/10';
                    if (s.includes('triển khai')) colorClass = 'bg-orange-50 text-orange-600 border-orange-200 ring-orange-500/10';

                    return (
                        <div className="p-1 px-2 h-full flex items-center">
                            <select
                                disabled={isClosed}
                                className={`w-full p-2 py-1 text-[10px] font-black uppercase tracking-widest outline-none rounded-lg border transition-all ${colorClass} focus:ring-4`}
                                value={val}
                                onChange={onChange}
                            >
                                <option value="" className="bg-white text-slate-400 italic">-- Chọn --</option>
                                {col.options?.map((opt: string) => <option key={opt} value={opt} className="bg-white text-slate-700">{opt}</option>)}
                            </select>
                        </div>
                    );
                }
            case 'user':
                const selectedUser = users.find(u => u.name === val);
                return (
                    <div className="flex items-center gap-2 p-2 min-h-[48px] justify-center">
                        {val ? (
                            <button
                                disabled={isClosed}
                                onClick={() => setShowUserPicker({ rIdx, colKey: col.key })}
                                className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-2 py-1 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group max-w-full overflow-hidden"
                            >
                                <img
                                    src={selectedUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(val)}`}
                                    className="w-6 h-6 rounded-lg object-cover group-hover:scale-110 transition-transform flex-shrink-0"
                                    alt="avatar"
                                />
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest truncate">{val}</span>
                            </button>
                        ) : (
                            <button
                                disabled={isClosed}
                                onClick={() => setShowUserPicker({ rIdx, colKey: col.key })}
                                className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 text-slate-300 hover:text-indigo-600 hover:border-indigo-300 hover:bg-white hover:shadow-sm transition-all flex items-center justify-center group"
                                title="Giao người phụ trách"
                            >
                                <span className="material-icons text-lg group-hover:scale-110 transition-transform">person_add</span>
                            </button>
                        )}
                    </div>
                );
            default:
                return (
                    <textarea
                        disabled={isClosed}
                        className="w-full bg-transparent p-3 text-sm text-slate-700 outline-none focus:bg-white min-h-[40px] resize-y disabled:text-slate-400"
                        value={val}
                        onChange={onChange}
                        rows={1}
                    />
                );
        }
    };

    if (meetingId && selectedMeeting) {
        return (
            <div className="space-y-6 flex flex-col h-full bg-slate-50">
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 gap-4">
                    <div className="flex items-center gap-5">
                        <button onClick={() => navigate('/meetings')} className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all text-slate-400 group">
                            <span className="material-icons group-hover:-translate-x-1 transition-transform">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">{selectedMeeting.title}</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                    {new Date(selectedMeeting.date).toLocaleDateString('vi-VN')}
                                </span>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${selectedMeeting.status === 'ACTIVE' ? 'text-indigo-500' : 'text-slate-400'}`}>
                                    <span className="material-icons text-[10px]">{selectedMeeting.status === 'ACTIVE' ? 'fiber_manual_record' : 'lock'}</span>
                                    {selectedMeeting.status === 'ACTIVE' ? 'Đang diễn ra' : 'Đã đóng'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {selectedMeeting.status === 'ACTIVE' && (
                            <>
                                <button
                                    onClick={() => {
                                        setTempMapping(selectedMeeting.mapping || {});
                                        setShowMappingModal(true);
                                    }}
                                    className="h-12 px-6 bg-slate-50 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-3 border border-slate-100"
                                >
                                    <span className="material-icons text-xl">settings_input_component</span>
                                    <span>Mapping Task</span>
                                </button>
                                <button
                                    onClick={handleAddColumn}
                                    className="h-12 pl-2 pr-10 bg-indigo-100 text-indigo-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-200 transition-all flex items-center gap-10 group shadow-sm shadow-indigo-100"
                                >
                                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm transition-transform group-hover:rotate-90">
                                        <span className="material-icons">add</span>
                                    </div>
                                    <span>Thêm cột</span>
                                </button>
                                {selectedMeeting.status === 'ACTIVE' ? (
                                    <button
                                        onClick={() => handleCloseMeeting()}
                                        className="h-12 px-6 bg-amber-100 text-amber-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-200 transition-all flex items-center gap-3"
                                    >
                                        <span className="material-icons text-xl text-amber-500">lock</span>
                                        <span>Đóng họp</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleReopenMeeting()}
                                        className="h-12 px-6 bg-emerald-100 text-emerald-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-200 transition-all flex items-center gap-3"
                                    >
                                        <span className="material-icons text-xl text-emerald-500">lock_open</span>
                                        <span>Mở khóa</span>
                                    </button>
                                )}
                            </>
                        )}
                        <button
                            onClick={async () => {
                                try {
                                    await handleSaveSheet();
                                    alert('Đã lưu nội dung!');
                                } catch (e) { }
                            }}
                            className="h-12 px-8 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-3"
                        >
                            <span className="material-icons text-xl">save</span>
                            <span>Lưu nội dung</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="overflow-auto custom-scrollbar flex-1">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-50 border-b">
                                <tr>
                                    <th className="w-12 p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r">#</th>
                                    {selectedMeeting.columns.map((col: any, idx: number) => (
                                        <th key={col.key} className="border border-slate-200 bg-slate-50">
                                            <div className="flex items-center group/col h-full">
                                                <div className="flex-1 p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center truncate">
                                                    {col.title}
                                                    <span className="ml-2 px-1 bg-slate-200 rounded text-[8px] opacity-70 font-bold uppercase">{col.type}</span>
                                                </div>
                                                {selectedMeeting.status === 'ACTIVE' && col.key.startsWith('col_') && (
                                                    <button
                                                        onClick={() => {
                                                            setEditingColumn({ ...col });
                                                            setShowColumnModal({ isOpen: true, colIndex: idx });
                                                            // Set ref value after a short tick to ensure modal is rendered
                                                            setTimeout(() => {
                                                                if (optionsRef.current) {
                                                                    optionsRef.current.value = col.options?.join(', ') || '';
                                                                }
                                                            }, 0);
                                                        }}
                                                        className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-lg mr-2 shadow-sm transition-all"
                                                        title="Cấu hình cột"
                                                    >
                                                        <span className="material-icons text-sm">edit</span>
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-56 border border-slate-200 bg-slate-50">
                                        <div className="flex items-center justify-center gap-2">
                                            <span>Tạo công việc</span>
                                            {selectedMeeting.status === 'ACTIVE' && (
                                                <button
                                                    onClick={() => {
                                                        setTempMapping(selectedMeeting.mapping || {});
                                                        setShowMappingModal(true);
                                                    }}
                                                    className="p-1 hover:text-indigo-600 transition-colors"
                                                    title="Cấu hình Mapping"
                                                >
                                                    <span className="material-icons text-[12px]">settings_input_component</span>
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedMeeting.rows.map((row: any, rIdx: number) => (
                                    <tr key={row._id || row.tempId || rIdx} className="border-b hover:bg-slate-50/50 transition-colors">
                                        <td className="p-3 text-[10px] font-bold text-slate-400 text-center border-r bg-slate-50/30">{rIdx + 1}</td>
                                        {selectedMeeting.columns.map((col: any) => (
                                            <td key={col.key} className="p-0 border-r align-top">
                                                {renderCellInput(row, col, rIdx)}
                                            </td>
                                        ))}
                                        <td className="p-2 text-center align-middle border border-slate-200">
                                            {row.linkedTaskId ? (
                                                <div className="flex justify-center items-center gap-2">
                                                    <span className="text-emerald-600 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg">
                                                        <span className="material-icons text-[12px]">check_circle</span>
                                                        Done: {row.linkedTaskId.slice(-4)}
                                                    </span>
                                                    {selectedMeeting.status === 'ACTIVE' && (
                                                        <button
                                                            onClick={() => handleDeleteRow(rIdx)}
                                                            className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                                            title="Xóa dòng"
                                                        >
                                                            <span className="material-icons text-xs">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl px-3 py-1.5 w-full max-w-[200px] mx-auto border border-indigo-100 transition-all">
                                                    <input
                                                        type="text"
                                                        className="bg-transparent border-none text-[10px] font-bold text-indigo-900 w-full focus:ring-0 p-0 placeholder:text-indigo-300"
                                                        placeholder="Nhập tên Task..."
                                                        defaultValue={row.cells[selectedMeeting.mapping?.titleKey || 'content']}
                                                        onBlur={(e) => handleCellChange(rIdx, selectedMeeting.mapping?.titleKey || 'content', e.target.value)}
                                                    />
                                                    <button
                                                        onClick={(e) => {
                                                            const input = e.currentTarget.previousSibling as HTMLInputElement;
                                                            handleConvertRowWithTitle(rIdx, input.value);
                                                        }}
                                                        disabled={!selectedMeeting.mapping?.featureId || !selectedMeeting.mapping?.sprintId}
                                                        className="text-indigo-600 hover:text-indigo-800 disabled:opacity-30 transition-colors flex shrink-0"
                                                        title={(!selectedMeeting.mapping?.featureId || !selectedMeeting.mapping?.sprintId) ? "Hãy cấu hình Mapping trước" : "Bấm để tạo Task"}
                                                    >
                                                        <span className="material-icons text-xl">add_circle</span>
                                                    </button>
                                                    {selectedMeeting.status === 'ACTIVE' && (
                                                        <button
                                                            onClick={() => handleDeleteRow(rIdx)}
                                                            className="p-1 text-slate-400 hover:text-red-500 transition-colors flex shrink-0"
                                                            title="Xóa dòng"
                                                        >
                                                            <span className="material-icons text-sm">delete_outline</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {selectedMeeting.status === 'ACTIVE' && (
                                    <tr className="bg-slate-50/30 border-b border-dashed">
                                        <td colSpan={selectedMeeting.columns.length + 2} className="p-0">
                                            <button onClick={handleAddRow} className="w-full py-4 text-slate-400 hover:text-indigo-600 hover:bg-white transition-all flex items-center justify-center gap-2">
                                                <span className="material-icons text-sm">add</span>
                                                <span className="text-xs font-bold uppercase tracking-widest">Thêm dòng nội dung mới</span>
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modals for Detail View */}
                {showMappingModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 space-y-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center shadow-inner">
                                    <span className="material-icons text-4xl text-indigo-500">settings_input_component</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cấu hình Mapping Task</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Đồng bộ nội dung cuộc họp sang hệ thống Task</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center justify-center gap-2">
                                        <span className="material-icons text-xs">location_on</span>
                                        Vị trí đích để tạo Task
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Feature Đích</label>
                                            <select
                                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm"
                                                value={tempMapping.featureId || ''}
                                                onChange={e => setTempMapping({ ...tempMapping, featureId: e.target.value })}
                                            >
                                                <option value="">-- Chọn Feature --</option>
                                                {features.map(f => <option key={f._id} value={f._id}>{f.title}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Sprint Đích</label>
                                            <select
                                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold shadow-sm"
                                                value={tempMapping.sprintId || ''}
                                                onChange={e => setTempMapping({ ...tempMapping, sprintId: e.target.value })}
                                            >
                                                <option value="">-- Chọn Sprint --</option>
                                                {sprints.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tiêu đề (Title)</label>
                                    <select className="w-full p-3 bg-slate-50 border-none rounded-2xl text-xs font-bold shadow-inner" value={tempMapping.titleKey || ''} onChange={e => setTempMapping({ ...tempMapping, titleKey: e.target.value })}>
                                        <option value="">-- Chọn Cột --</option>
                                        {selectedMeeting.columns.map((c: any) => <option key={c.key} value={c.key}>{c.title}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Hạn (Deadline)</label>
                                    <select className="w-full p-3 bg-slate-50 border-none rounded-2xl text-xs font-bold shadow-inner" value={tempMapping.deadlineKey || ''} onChange={e => setTempMapping({ ...tempMapping, deadlineKey: e.target.value })}>
                                        <option value="">-- Chọn Cột --</option>
                                        {selectedMeeting.columns.filter((c: any) => c.type === 'date').map((c: any) => <option key={c.key} value={c.key}>{c.title}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Phụ trách (Assignee)</label>
                                    <select className="w-full p-3 bg-slate-50 border-none rounded-2xl text-xs font-bold shadow-inner" value={tempMapping.assigneeKey || ''} onChange={e => setTempMapping({ ...tempMapping, assigneeKey: e.target.value })}>
                                        <option value="">-- Chọn Cột --</option>
                                        {selectedMeeting.columns.filter((c: any) => c.type === 'user').map((c: any) => <option key={c.key} value={c.key}>{c.title}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Trạng thái (Status)</label>
                                    <select className="w-full p-3 bg-slate-50 border-none rounded-2xl text-xs font-bold shadow-inner" value={tempMapping.statusKey || ''} onChange={e => setTempMapping({ ...tempMapping, statusKey: e.target.value })}>
                                        <option value="">-- Chọn Cột --</option>
                                        {selectedMeeting.columns.filter((c: any) => c.type === 'select').map((c: any) => <option key={c.key} value={c.key}>{c.title}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-4 border-t border-slate-50">
                                <button onClick={handleSaveMapping} className="w-full px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all">Lưu cấu hình ngay</button>
                                <button onClick={() => setShowMappingModal(false)} className="w-full py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors text-center">Hủy bỏ</button>
                            </div>
                        </div>
                    </div>
                )}

                {showColumnModal.isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-[2rem] w-full max-w-md p-8 space-y-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center shadow-inner">
                                    <span className="material-icons text-4xl text-indigo-500">view_column</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cấu hình Cột</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Điều chỉnh thông tin cột dữ liệu</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tên cột</label>
                                    <input
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                        value={editingColumn?.title || ''}
                                        onChange={e => setEditingColumn({ ...editingColumn, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Loại dữ liệu (Type)</label>
                                    <select
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                        value={editingColumn?.type || 'text'}
                                        onChange={e => setEditingColumn({ ...editingColumn, type: e.target.value })}
                                    >
                                        <option value="text">Text (Văn bản)</option>
                                        <option value="number">Number (Số)</option>
                                        <option value="date">Date (Ngày tháng)</option>
                                        <option value="select">Select (Lựa chọn)</option>
                                        <option value="user">User (Thành viên)</option>
                                        <option value="checkbox">Checkbox (Đánh dấu)</option>
                                    </select>
                                </div>
                                {editingColumn?.type === 'select' && (
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">
                                            Nhập các lựa chọn (cách nhau bởi dấu phẩy ',')
                                        </label>
                                        <textarea
                                            ref={optionsRef}
                                            className="w-full p-4 bg-indigo-50/30 border border-indigo-100 rounded-[1.5rem] text-sm font-bold text-indigo-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                                            rows={3}
                                            placeholder="Ví dụ: Đang làm, Hoàn thành, Tạm dừng"
                                        />
                                        <p className="text-[9px] text-slate-400 font-medium text-center">Lưu ý: Sau khi nhập, hãy bấm Xác nhận để áp dụng cho bảng.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 pt-4 border-t border-slate-50">
                                <button
                                    onClick={handleUpdateColumn}
                                    className="w-full px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all"
                                >
                                    Xác nhận thay đổi
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowColumnModal({ isOpen: false, colIndex: null })}
                                        className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Hủy bỏ
                                    </button>
                                    <button
                                        onClick={() => handleDeleteColumn(showColumnModal.colIndex!)}
                                        className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                                    >
                                        Xóa cột
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {showUserPicker && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 space-y-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center shadow-inner group overflow-hidden">
                                    <span className="material-icons text-5xl text-indigo-500 group-hover:scale-110 transition-transform">account_circle</span>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">Giao người phụ trách</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Danh sách Trưởng phòng & Trưởng nhóm</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto px-2 custom-scrollbar">
                                {users
                                    .filter(u => u.role === 'TRƯỞNG PHÒNG' || u.role === 'TRƯỞNG NHÓM')
                                    .map(u => (
                                        <button
                                            key={u.id || u._id}
                                            onClick={() => {
                                                handleCellChange(showUserPicker.rIdx, showUserPicker.colKey, u.name);
                                                setShowUserPicker(null);
                                            }}
                                            className="flex items-center justify-between p-4 bg-slate-50 hover:bg-white hover:shadow-xl hover:scale-[1.02] border-2 border-transparent hover:border-indigo-100 rounded-2xl transition-all group group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <img src={u.avatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md group-hover:rotate-3 transition-transform" alt={u.name} />
                                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-lg flex items-center justify-center">
                                                        <span className="material-icons text-white text-[12px]">check</span>
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-base font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{u.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[9px] font-black text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-md uppercase tracking-widest">{u.role}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{u.department}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="material-icons text-slate-200 group-hover:text-indigo-400 transition-colors transform group-hover:translate-x-1 transition-transform">chevron_right</span>
                                        </button>
                                    ))}
                            </div>

                            <div className="flex flex-col gap-3 pt-4 border-t border-slate-50">
                                <button onClick={() => setShowUserPicker(null)} className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors text-center">Hủy bỏ yêu cầu</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Meeting Sheets</h2>
                    <p className="text-slate-500 text-xs font-medium">Bản ghi nội dung cuộc họp hiệu suất cao</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center space-x-2 shadow-lg shadow-indigo-100 active:scale-95"
                >
                    <span className="material-icons">add_circle</span>
                    <span>Khởi tạo cuộc họp</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    </div>
                ) : meetings.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-slate-400 bg-white border border-dashed rounded-[2rem]">
                        Chưa có cuộc họp nào được ghi lại.
                    </div>
                ) : (
                    meetings.map(m => (
                        <div
                            key={m._id}
                            onClick={() => navigate(`/meetings/${m._id}`)}
                            className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest ${m.status === 'ACTIVE' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {m.status === 'ACTIVE' ? 'Đang diễn ra' : 'Đã lưu trữ'}
                                </span>
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            m.status === 'ACTIVE' ? handleCloseMeeting(m) : handleReopenMeeting(m);
                                        }}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${m.status === 'ACTIVE' ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100'}`}
                                        title={m.status === 'ACTIVE' ? 'Đóng họp' : 'Mở khóa'}
                                    >
                                        <span className="material-icons text-sm">{m.status === 'ACTIVE' ? 'lock' : 'lock_open'}</span>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowCloneOptionsModal({ isOpen: true, meetingId: m._id });
                                        }}
                                        className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-all"
                                        title="Sao chép"
                                    >
                                        <span className="material-icons text-sm">content_copy</span>
                                    </button>
                                    <button onClick={(e) => handleDeleteMeeting(m._id, e)} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition-all" title="Xóa">
                                        <span className="material-icons text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight group-hover:text-indigo-600 transition-colors">{m.title}</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                        <span className="material-icons text-sm text-slate-400">calendar_today</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-600">{new Date(m.date).toLocaleDateString('vi-VN')}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                        <span className="material-icons text-sm text-slate-400">person</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-600">{m.hostName}</span>
                                </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                    {m.rows?.length || 0} Dòng ghi chú
                                </span>
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white"></div>
                                    <div className="w-6 h-6 rounded-full bg-indigo-200 border-2 border-white"></div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <form onSubmit={handleCreateMeeting} className="bg-white rounded-[2rem] w-full max-w-md p-8 space-y-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center shadow-inner">
                                <span className="material-icons text-4xl text-indigo-500">add_task</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Tạo cuộc họp mới</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Khởi tạo Sheet nội dung cuộc họp</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tên cuộc họp</label>
                                <input
                                    required
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                    placeholder="Ví dụ: Họp chiến lược OKR Q2"
                                    value={newMeeting.title}
                                    onChange={e => setNewMeeting({ ...newMeeting, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ngày họp</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                        value={newMeeting.date}
                                        onChange={e => setNewMeeting({ ...newMeeting, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phòng ban</label>
                                    <input
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                        value={newMeeting.department}
                                        onChange={e => setNewMeeting({ ...newMeeting, department: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Dự án liên quan (Optional)</label>
                                <select
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner"
                                    value={newMeeting.projectId}
                                    onChange={e => setNewMeeting({ ...newMeeting, projectId: e.target.value })}
                                >
                                    <option value="">-- Không liên kết --</option>
                                    {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-4 border-t border-slate-50">
                            <button type="submit" className="w-full px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all">Khởi tạo ngay</button>
                            <button type="button" onClick={() => setShowCreateModal(false)} className="w-full py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors text-center">Hủy bỏ</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Clone Options */}
            {showCloneOptionsModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 space-y-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-300">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center shadow-inner">
                                <span className="material-icons text-4xl text-indigo-500">content_copy</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Tùy chọn Sao chép</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Bạn muốn sao chép nội dung như thế nào?</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleCloneMeeting(showCloneOptionsModal.meetingId!, { unfinishedOnly: false })}
                                className="w-full p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-100 rounded-2xl text-left transition-all group"
                            >
                                <p className="font-black text-slate-700 group-hover:text-indigo-600">Sao chép Toàn bộ</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Giữ nguyên 100% cấu trúc và dữ liệu</p>
                            </button>
                            <button
                                onClick={() => handleCloneMeeting(showCloneOptionsModal.meetingId!, { unfinishedOnly: true })}
                                className="w-full p-5 bg-slate-50 hover:bg-amber-50 border-2 border-transparent hover:border-amber-100 rounded-2xl text-left transition-all group"
                            >
                                <p className="font-black text-slate-700 group-hover:text-amber-600">Dòng chưa hoàn thành</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Chỉ copy các dòng chưa có liên kết Task</p>
                            </button>
                        </div>

                        <button onClick={() => setShowCloneOptionsModal({ isOpen: false, meetingId: null })} className="w-full py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors text-center border-t border-slate-50 pt-5">Hủy bỏ</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Meetings;
