import React, { useState, useEffect } from 'react';
import { projectService, sprintService, taskAgileService, featureService } from '../services/projectService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';

const Board = () => {
    const { user: currentUser } = useAuth();
    const { confirm: customConfirm } = useConfirm();
    const role = currentUser?.role || '';
    const isAdmin = role === 'QUẢN TRỊ VIÊN';
    const isManager = role === 'TRƯỞNG PHÒNG';
    const isLeader = role === 'TRƯỞNG NHÓM';
    const canManageBoard = isAdmin || isManager || isLeader;

    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [sprints, setSprints] = useState([]);
    const [selectedSprint, setSelectedSprint] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState<any[]>([]);
    const [activeFeatures, setActiveFeatures] = useState([]);
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [showAssigneeError, setShowAssigneeError] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        featureId: '',
        description: '',
        assigneeName: '',
        taskType: 'FEATURE',
        startDate: '',
        durationDays: 1,
        dependencies: []
    });

    const columns = [
        { id: 'TODO', title: 'Cần làm', color: 'bg-slate-100 text-slate-500' },
        { id: 'IN_PROGRESS', title: 'Đang hoàn thiện', color: 'bg-sky-100 text-sky-600' },
        { id: 'REVIEW', title: 'Demo dự án', color: 'bg-amber-100 text-amber-600' },
        { id: 'DONE', title: 'Xong việc', color: 'bg-emerald-100 text-emerald-600' }
    ];

    useEffect(() => {
        fetchProjects();
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const data = await userService.getUsers();
            setUsers(data || []);
        } catch (err) {
            console.error('Lỗi lấy danh sách user:', err);
        }
    };

    useEffect(() => {
        if (selectedProject) {
            fetchSprints(selectedProject._id);
            fetchFeatures(selectedProject._id);
        }
    }, [selectedProject]);

    useEffect(() => {
        if (selectedSprint) {
            fetchTasks(selectedSprint._id);
        }
    }, [selectedSprint]);

    const fetchProjects = async () => {
        try {
            const data = await projectService.getProjects(true) || [];
            setProjects(data);
            if (data.length > 0 && !selectedProject) setSelectedProject(data[0]);
        } catch (err) {
            console.error('Lỗi lấy dự án:', err);
            setProjects([]);
        }
    };

    const fetchSprints = async (projectId) => {
        try {
            const data = await sprintService.getSprintsByProject(projectId) || [];
            setSprints(data);
            const active = data.find(s => s.status === 'ACTIVE');
            if (active) setSelectedSprint(active);
            else if (data.length > 0) setSelectedSprint(data[0]);
            else setSelectedSprint(null);
        } catch (err) {
            console.error('Lỗi lấy sprint:', err);
            setSprints([]);
        }
    };

    const fetchFeatures = async (projectId) => {
        try {
            const data = await featureService.getFeaturesByProject(projectId);
            setActiveFeatures(data);
        } catch (err) {
            console.error('Lỗi lấy features:', err);
        }
    };

    const fetchTasks = async (sprintId) => {
        try {
            const data = await taskAgileService.getTasksBySprint(sprintId);
            setTasks(data);
        } catch (err) {
            console.error('Lỗi lấy tasks:', err);
        }
    };

    // Tính toán endDate từ startDate + durationDays
    const calcEndDate = (startDate: string, durationDays: number): string => {
        const start = startDate ? new Date(startDate) : new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + (durationDays - 1));
        return end.toISOString().split('T')[0];
    };

    // Tính số ngày đã trôi qua kể từ startDate
    const calcDaysElapsed = (startDate: string): number => {
        if (!startDate) return 0;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    };

    // Logic cảnh báo deadline (giống GanttChart)
    const getDeadlineWarning = (task: any): { isWarning: boolean; isOverdue: boolean; diffDays: number } => {
        if (!task.endDate) return { isWarning: false, isOverdue: false, diffDays: Infinity };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = new Date(task.endDate);
        deadline.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0 && task.status !== 'DONE';
        let isWarning = false;
        if (task.status === 'TODO' && diffDays <= 14 && diffDays >= 0) isWarning = true;
        if (task.status === 'IN_PROGRESS' && diffDays <= 10 && diffDays >= 0) isWarning = true;
        if (task.status === 'REVIEW' && diffDays <= 7 && diffDays >= 0) isWarning = true;
        return { isWarning, isOverdue, diffDays };
    };

    const emptyTask = () => ({
        title: '',
        featureId: '',
        description: '',
        assigneeName: '',
        taskType: '',
        startDate: '',
        durationDays: 1,
        dependencies: []
    });

    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        try {
            const updated = await taskAgileService.updateTask(taskId, { status: newStatus });
            setTasks(tasks.map(t => t._id === taskId ? updated : t));
        } catch (err: any) {
            await customConfirm({ title: 'Lỗi', message: 'Lỗi cập nhật trạng thái: ' + err.message, type: 'danger', isAlert: true });
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        // Validate: phải chọn nhân viên
        if (!newTask.assigneeName) {
            setShowAssigneeError(true);
            return;
        }
        // Validate: phải chọn feature
        if (!newTask.featureId) {
            await customConfirm({ title: 'Thông báo', message: 'Vui lòng chọn Feature cho công việc!', type: 'warning', isAlert: true });
            return;
        }
        // Validate: durationDays >= 1
        if (!newTask.durationDays || newTask.durationDays < 1) {
            await customConfirm({ title: 'Thông báo', message: 'Số ngày hết hạn phải ít nhất là 1!', type: 'warning', isAlert: true });
            return;
        }

        // Tính toán endDate
        const resolvedStartDate = newTask.startDate || new Date().toISOString().split('T')[0];
        const resolvedEndDate = calcEndDate(resolvedStartDate, newTask.durationDays);

        const taskPayload = {
            title: newTask.title,
            featureId: newTask.featureId,
            description: newTask.description,
            assigneeName: newTask.assigneeName,
            taskType: newTask.taskType,
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            durationDays: newTask.durationDays,
            estimateTime: 0,
            progress: 0,
            dependencies: newTask.dependencies
        };

        try {
            if (editingTask) {
                const data = await taskAgileService.updateTask(editingTask._id, taskPayload);
                setTasks(tasks.map(t => t._id === data._id ? data : t));
                setEditingTask(null);
            } else {
                const data = await taskAgileService.createTask({
                    ...taskPayload,
                    projectId: selectedProject._id,
                    sprintId: selectedSprint._id
                });
                setTasks([...tasks, data]);
            }
            setIsAddingTask(false);
            setShowAssigneeError(false);
            setNewTask(emptyTask());
        } catch (err: any) {
            await customConfirm({ title: 'Lỗi', message: 'Lỗi lưu task: ' + err.message, type: 'danger', isAlert: true });
        }
    };

    const handleDeleteTask = async (id) => {
        const ok = await customConfirm({
            title: 'Xóa Task?',
            message: 'Bạn có chắc muốn xóa task này khỏi board?',
            type: 'danger'
        });
        if (!ok) return;
        try {
            await taskAgileService.deleteTask(id);
            setTasks(tasks.filter(t => t._id !== id));
        } catch (err: any) {
            await customConfirm({ title: 'Lỗi', message: 'Lỗi xóa task: ' + err.message, type: 'danger', isAlert: true });
        }
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        // Tính lại durationDays từ startDate và endDate nếu có
        let durationDays = task.durationDays || 1;
        if (task.startDate && task.endDate && !task.durationDays) {
            const start = new Date(task.startDate);
            const end = new Date(task.endDate);
            durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        }
        setNewTask({
            title: task.title,
            featureId: task.featureId,
            description: task.description,
            assigneeName: task.assigneeName,
            taskType: task.taskType || 'FEATURE',
            startDate: task.startDate ? task.startDate.split('T')[0] : '',
            durationDays,
            dependencies: task.dependencies || []
        });
        setIsAddingTask(true);
    };

    return (
        <div className="p-6 max-w-full mx-auto space-y-6 flex flex-col h-[calc(100vh-100px)]">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border shrink-0">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Board Dự án</h1>
                        <p className="text-xs text-slate-500">Theo dõi tiến độ Sprint qua Kanban</p>
                    </div>
                    <div className="h-8 w-px bg-slate-200"></div>
                    <div className="flex gap-2">
                        {projects.length > 1 ? (
                            <select
                                className="text-sm border-none bg-slate-50 rounded-lg px-3 py-1.5 font-bold text-slate-700 shadow-sm"
                                value={selectedProject?._id || ''}
                                onChange={(e) => setSelectedProject(projects.find(p => p._id === e.target.value))}
                            >
                                {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                            </select>
                        ) : (
                            projects.length === 1 && (
                                <div className="text-sm px-3 py-1.5 bg-slate-50 rounded-lg font-bold text-indigo-700 border border-slate-200">
                                    {projects[0].title}
                                </div>
                            )
                        )}
                        <select
                            className="text-sm border-none bg-indigo-50 rounded-lg px-3 py-1.5 font-bold text-indigo-700"
                            value={selectedSprint?._id || ''}
                            onChange={(e) => setSelectedSprint(sprints.find(s => s._id === e.target.value))}
                        >
                            {sprints.map(s => <option key={s._id} value={s._id}>{s.name} ({s.status})</option>)}
                        </select>
                    </div>
                </div>
                {canManageBoard && (
                    <button
                        onClick={() => { setEditingTask(null); setNewTask(emptyTask()); setIsAddingTask(true); }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition text-sm"
                    >
                        + Thêm Task mới
                    </button>
                )}
            </div>

            {selectedProject && (selectedProject.description || selectedProject.assignedLeaderId) && (
                <div className="flex flex-col md:flex-row gap-4 shrink-0">
                    <div className="flex-1 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                        {selectedProject.description && (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-icons text-indigo-500 text-sm">info</span>
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mô tả dự án</p>
                                </div>
                                <p className="text-sm text-slate-600 italic ml-6">{selectedProject.description}</p>
                            </>
                        )}
                        {selectedProject.assignedLeaderId && (
                            <div className={`${selectedProject.description ? 'ml-6 mt-1' : ''} flex items-center gap-2`}>
                                <span className="material-icons text-[14px] text-amber-500">manage_accounts</span>
                                <span className="text-xs text-slate-500">Trưởng nhóm phụ trách:</span>
                                <strong className="text-xs text-amber-600">{selectedProject.assignedLeaderId?.name || 'Đã gán'}</strong>
                            </div>
                        )}
                    </div>

                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-icons text-amber-600 text-sm">tips_and_updates</span>
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Cảnh báo Deadline</p>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 ml-6">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Cần làm (TODO)</p>
                                <p className="text-[10px] font-bold text-slate-600">Cảnh báo: ≤ 14 ngày</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Đang làm (IN PROGRESS)</p>
                                <p className="text-[10px] font-bold text-slate-600">Cảnh báo: ≤ 10 ngày</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Demo dự án (REVIEW)</p>
                                <p className="text-[10px] font-bold text-slate-600">Cảnh báo: ≤ 7 ngày</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-rose-500 uppercase">Quá hạn (OVERDUE)</p>
                                <p className="text-[10px] font-black text-rose-600 animate-pulse">Trễ Deadline & Chưa Xong</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isAddingTask && (
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-indigo-100 shrink-0">
                    <h2 className="text-lg font-bold mb-4">Phân rã Task từ Feature</h2>
                    <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        {/* Tên công việc */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Tên công việc <span className="text-red-400">*</span></label>
                            <input
                                required
                                className="px-3 py-2 border rounded-lg text-sm h-[40px]"
                                placeholder="Nhập tên công việc..."
                                value={newTask.title}
                                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                            />
                        </div>
                        {/* Chọn Feature */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Feature <span className="text-red-400">*</span></label>
                            <select
                                required
                                className="px-3 py-2 border rounded-lg text-sm h-[40px]"
                                value={newTask.featureId}
                                onChange={e => setNewTask({ ...newTask, featureId: e.target.value })}
                                style={{ color: !newTask.featureId ? '#9ca3af' : '' }}
                            >
                                <option value="" disabled style={{ color: '#9ca3af', fontStyle: 'italic' }}>— Chọn Feature —</option>
                                {activeFeatures.filter(f => f.sprintId === selectedSprint?._id).map(f => (
                                    <option key={f._id} value={f._id} style={{ color: '#1e293b' }}>{f.title}</option>
                                ))}
                            </select>
                        </div>
                        {/* Loại công việc */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Loại công việc <span className="text-red-400">*</span></label>
                            <select
                                required
                                className="px-3 py-2 border rounded-lg text-sm h-[40px]"
                                value={newTask.taskType}
                                onChange={e => setNewTask({ ...newTask, taskType: e.target.value })}
                                style={{ color: !newTask.taskType ? '#9ca3af' : '' }}
                            >
                                <option value="" disabled style={{ color: '#9ca3af', fontStyle: 'italic' }}>— Loại công việc —</option>
                                <option value="BUG" style={{ color: '#1e293b' }}>Lỗi (Bug)</option>
                                <option value="MEETING" style={{ color: '#1e293b' }}>Họp hành</option>
                                <option value="MILESTONE" style={{ color: '#1e293b' }}>Cột mốc</option>
                            </select>
                        </div>
                        {/* Ngày bắt đầu */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Ngày bắt đầu <span className="text-slate-300 font-normal normal-case">(bỏ trống để bắt đầu ngay hôm nay)</span></label>
                            <input
                                type="date"
                                className="px-3 py-2 border rounded-lg text-sm h-[40px]"
                                value={newTask.startDate}
                                onChange={e => setNewTask({ ...newTask, startDate: e.target.value })}
                            />
                        </div>

                        {/* Số ngày hết hạn */}
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <span className="material-icons text-[12px] text-orange-400">timer</span>
                                    Số ngày hết hạn công việc *
                                </label>
                                {newTask.durationDays >= 1 && (
                                    <span className="text-[9px] text-orange-400 font-bold uppercase tracking-tight">
                                        → Hết hạn: {new Date(calcEndDate(newTask.startDate, newTask.durationDays)).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                            </div>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                required
                                className="px-4 py-2 border rounded-lg text-sm font-bold text-orange-600 border-orange-200 focus:ring-2 focus:ring-orange-300 h-[40px]"
                                placeholder="Nhập số ngày..."
                                value={newTask.durationDays}
                                onChange={e => {
                                    const val = parseInt(e.target.value) || 1;
                                    setNewTask({ ...newTask, durationDays: Math.max(1, val) });
                                }}
                            />
                        </div>

                        {/* Chọn nhân viên - BẮT BUỘC */}
                        <div className="md:col-span-4 mt-2">
                            <label className="text-[11px] font-black tracking-widest text-slate-500 uppercase block mb-1">
                                CHỌN NHÂN VIÊN THỰC HIỆN <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-slate-400 italic mb-2">* Bắt buộc phải chọn nhân viên tham gia nhiệm vụ này.</p>
                            {showAssigneeError && (
                                <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium flex items-center gap-1">
                                    <span className="material-icons text-[14px]">warning</span>
                                    Chưa chọn nhân viên – Task sẽ không thể lưu!
                                </div>
                            )}
                            <div className="max-h-52 overflow-y-auto border rounded-xl bg-slate-50 p-2 grid gap-2 custom-scrollbar md:grid-cols-2 lg:grid-cols-3">
                                {users.filter(u => u.role === 'NHÂN VIÊN').map((u: any) => (
                                    <div
                                        key={u.id || u._id}
                                        onClick={() => setNewTask({ ...newTask, assigneeName: u.name })}
                                        className={`flex items-center gap-3 p-3 rounded-xl border bg-white cursor-pointer transition ${newTask.assigneeName === u.name ? 'border-blue-500 ring-1 ring-blue-500 shadow-md' : 'border-slate-200 hover:border-blue-300'}`}
                                    >
                                        <div className="w-5 flex items-center justify-center">
                                            <input
                                                type="radio"
                                                className="w-4 h-4 cursor-pointer text-blue-600 focus:ring-blue-500"
                                                checked={newTask.assigneeName === u.name}
                                                readOnly
                                            />
                                        </div>
                                        <img src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} alt={u.name} className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200" />
                                        <div className="flex flex-col flex-1 truncate">
                                            <span className="font-bold text-slate-800 text-sm truncate">{u.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase truncate">
                                                {u.role === 'NHÂN VIÊN' ? 'EMPLOYEE' : u.role === 'QUẢN TRỊ VIÊN' ? 'ADMIN' : 'MANAGER'} • {u.department || 'CHƯA PHÂN BAN'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Công việc tiền đề */}
                        <div className="md:col-span-4 flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Công việc tiền đề (Predecessors)</label>
                            <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-slate-50 min-h-[40px]">
                                {tasks.filter(t => t._id !== editingTask?._id).map(t => (
                                    <label key={t._id} className="flex items-center gap-2 bg-white px-2 py-1 rounded border hover:bg-indigo-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newTask.dependencies.includes(t._id)}
                                            onChange={(e) => {
                                                const deps = e.target.checked
                                                    ? [...newTask.dependencies, t._id]
                                                    : newTask.dependencies.filter(id => id !== t._id);
                                                setNewTask({ ...newTask, dependencies: deps });
                                            }}
                                        />
                                        <span className="text-[11px] font-medium text-slate-600 truncate max-w-[150px]">{t.title}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <textarea
                            className="md:col-span-4 px-4 py-2 border rounded-lg text-sm"
                            placeholder="Mô tả công việc..."
                            value={newTask.description}
                            onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                        />

                        <div className="md:col-span-4 flex justify-end gap-2 text-sm mt-2">
                            <button type="button" onClick={() => { setIsAddingTask(false); setEditingTask(null); setShowAssigneeError(false); }} className="px-4 py-2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">Hủy</button>
                            <button
                                type="submit"
                                disabled={!newTask.assigneeName || !newTask.featureId}
                                className={`px-8 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg transition-all ${newTask.assigneeName && newTask.featureId ? 'bg-indigo-600 text-white shadow-indigo-100 hover:scale-105' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                {editingTask ? 'Cập nhật' : 'Lưu Task'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="flex-1 flex gap-6 overflow-x-auto pb-4 items-start">
                {columns.map(col => (
                    <div key={col.id} className="min-w-[300px] w-1/4 bg-slate-50 rounded-2xl flex flex-col max-h-full border border-slate-200">
                        <div className="p-4 flex justify-between items-center sticky top-0 bg-slate-50 rounded-t-2xl border-b shrink-0">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${col.color}`}>
                                    {col.title}
                                </span>
                                <span className="text-slate-400 text-sm font-bold">{tasks.filter(t => t.status === col.id).length}</span>
                            </div>
                        </div>
                        <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar">
                            {tasks.filter(t => t.status === col.id).map(task => {
                                const feature = activeFeatures.find(f => f._id === task.featureId);
                                const { isWarning, isOverdue, diffDays } = getDeadlineWarning(task);
                                const daysElapsed = calcDaysElapsed(task.startDate);
                                const totalDays = task.durationDays || (task.startDate && task.endDate
                                    ? Math.max(1, Math.ceil((new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
                                    : 0);

                                // Card border/shadow style theo deadline
                                let cardClass = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition group';
                                if (isOverdue) cardClass = 'bg-white p-4 rounded-xl shadow-md border-2 border-rose-400 hover:shadow-lg transition group ring-2 ring-rose-200';
                                else if (isWarning) cardClass = 'bg-white p-4 rounded-xl shadow-sm border-2 border-orange-300 hover:shadow-md transition group';

                                return (
                                    <div key={task._id} className={cardClass}>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`material-icons text-[14px] ${task.taskType === 'BUG' ? 'text-red-500' : task.taskType === 'MEETING' ? 'text-orange-500' : 'text-blue-500'}`}>
                                                        {task.taskType === 'BUG' ? 'bug_report' : task.taskType === 'MEETING' ? 'groups' : task.taskType === 'MILESTONE' ? 'flag' : 'task_alt'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-indigo-500 uppercase px-1.5 py-0.5 bg-indigo-50 rounded">
                                                        {feature?.moduleName || 'NONE'}
                                                    </span>
                                                    {isOverdue && (
                                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded text-[9px] font-black uppercase animate-pulse">
                                                            <span className="material-icons text-[10px]">error</span>
                                                            QUÁ HẠN
                                                        </span>
                                                    )}
                                                    {isWarning && !isOverdue && (
                                                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[9px] font-black uppercase">
                                                            <span className="material-icons text-[10px]">warning</span>
                                                            SẮP HẾT HẠN
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    {canManageBoard && (
                                                        <>
                                                            <button onClick={() => handleEditTask(task)} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-blue-600 hover:text-white transition" title="Sửa">
                                                                <span className="material-icons text-[14px]">edit</span>
                                                            </button>
                                                            <button onClick={() => handleDeleteTask(task._id)} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-red-600 hover:text-white transition" title="Xóa">
                                                                <span className="material-icons text-[14px]">delete</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    {columns.filter(c => c.id !== col.id).map(c => {
                                                        const isEmployeeTransition = !canManageBoard && task.status === 'TODO' && c.id === 'IN_PROGRESS';
                                                        const isAllowed = canManageBoard || isEmployeeTransition;

                                                        if (!isAllowed) return null;

                                                        const getIconForStatus = (statusId: string) => {
                                                            switch (statusId) {
                                                                case 'TODO': return 'list_alt';
                                                                case 'IN_PROGRESS': return 'play_arrow';
                                                                case 'REVIEW': return 'visibility';
                                                                case 'DONE': return 'check_circle';
                                                                default: return 'arrow_forward';
                                                            }
                                                        };

                                                        return (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => handleUpdateTaskStatus(task._id, c.id)}
                                                                className={`w-6 h-6 flex items-center justify-center bg-slate-100 rounded transition ${isEmployeeTransition ? 'hover:bg-emerald-500 hover:text-white text-emerald-600' : 'hover:bg-indigo-600 hover:text-white'}`}
                                                                title={isEmployeeTransition ? 'Nhận việc & Tiến hành' : `Chuyển sang: ${c.title}`}
                                                            >
                                                                <span className="material-icons text-[14px]">{isEmployeeTransition ? 'front_hand' : getIconForStatus(c.id)}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-sm leading-tight">{task.title}</h4>
                                            {task.description && (
                                                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 italic">{task.description}</p>
                                            )}

                                            {/* Hiển thị tiến trình ngày */}
                                            {totalDays > 0 && (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center text-[9px] font-bold uppercase">
                                                        <span className={isOverdue ? 'text-rose-500' : isWarning ? 'text-orange-500' : 'text-slate-400'}>
                                                            {isOverdue ? '⚠ Đã quá hạn' : isWarning ? `Còn ${diffDays} ngày` : 'Tiến trình'}
                                                        </span>
                                                        <span className={`font-black ${isOverdue ? 'text-rose-600' : isWarning ? 'text-orange-600' : 'text-slate-600'}`}>
                                                            {Math.min(daysElapsed, totalDays)}/{totalDays} ngày
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-500 rounded-full ${isOverdue ? 'bg-rose-500' : isWarning ? 'bg-orange-400' : task.status === 'DONE' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${Math.min(100, (daysElapsed / totalDays) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center pt-2 border-t mt-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase border border-indigo-200">
                                                        {task.assigneeName ? task.assigneeName.charAt(0) : '?'}
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">{task.assigneeName || 'NONE'}</span>
                                                </div>
                                                {task.endDate && (
                                                    <div className={`flex items-center gap-1 text-[9px] font-bold ${isOverdue ? 'text-rose-500' : isWarning ? 'text-orange-500' : 'text-slate-400'}`}>
                                                        <span className="material-icons text-[11px]">event</span>
                                                        {new Date(task.endDate).toLocaleDateString('vi-VN')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Board;
