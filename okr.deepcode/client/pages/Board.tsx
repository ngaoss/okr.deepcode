import React, { useState, useEffect } from 'react';
import { projectService, sprintService, taskAgileService, featureService } from '../services/projectService';

const Board = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [sprints, setSprints] = useState([]);
    const [selectedSprint, setSelectedSprint] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [activeFeatures, setActiveFeatures] = useState([]);
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [newTask, setNewTask] = useState({
        title: '',
        featureId: '',
        description: '',
        assigneeName: '',
        estimateTime: 0,
        progress: 0,
        taskType: 'FEATURE',
        startDate: '',
        endDate: '',
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
    }, []);

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
            const data = await projectService.getProjects() || [];
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

    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        try {
            const updated = await taskAgileService.updateTask(taskId, { status: newStatus });
            setTasks(tasks.map(t => t._id === taskId ? updated : t));
        } catch (err) {
            alert('Lỗi cập nhật trạng thái: ' + err.message);
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            if (editingTask) {
                const data = await taskAgileService.updateTask(editingTask._id, newTask);
                setTasks(tasks.map(t => t._id === data._id ? data : t));
                setEditingTask(null);
            } else {
                const data = await taskAgileService.createTask({
                    ...newTask,
                    projectId: selectedProject._id,
                    sprintId: selectedSprint._id
                });
                setTasks([...tasks, data]);
            }
            setIsAddingTask(false);
            setNewTask({ title: '', featureId: '', description: '', assigneeName: '', estimateTime: 0, progress: 0, taskType: 'FEATURE', startDate: '', endDate: '', dependencies: [] });
        } catch (err) {
            alert('Lỗi lưu task: ' + err.message);
        }
    };

    const handleDeleteTask = async (id) => {
        if (!confirm('Bạn có chắc muốn xóa task này?')) return;
        try {
            await taskAgileService.deleteTask(id);
            setTasks(tasks.filter(t => t._id !== id));
        } catch (err) {
            alert('Lỗi xóa task: ' + err.message);
        }
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setNewTask({
            title: task.title,
            featureId: task.featureId,
            description: task.description,
            assigneeName: task.assigneeName,
            estimateTime: task.estimateTime,
            progress: task.progress || 0,
            taskType: task.taskType || 'FEATURE',
            startDate: task.startDate ? task.startDate.split('T')[0] : '',
            endDate: task.endDate ? task.endDate.split('T')[0] : '',
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
                        <select
                            className="text-sm border-none bg-slate-50 rounded-lg px-3 py-1.5 font-bold text-slate-700"
                            value={selectedProject?._id || ''}
                            onChange={(e) => setSelectedProject(projects.find(p => p._id === e.target.value))}
                        >
                            {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                        </select>
                        <select
                            className="text-sm border-none bg-indigo-50 rounded-lg px-3 py-1.5 font-bold text-indigo-700"
                            value={selectedSprint?._id || ''}
                            onChange={(e) => setSelectedSprint(sprints.find(s => s._id === e.target.value))}
                        >
                            {sprints.map(s => <option key={s._id} value={s._id}>{s.name} ({s.status})</option>)}
                        </select>
                    </div>
                </div>
                <button
                    onClick={() => { setEditingTask(null); setNewTask({ title: '', featureId: '', description: '', assigneeName: '', estimateTime: 0, progress: 0, taskType: 'FEATURE', startDate: '', endDate: '', dependencies: [] }); setIsAddingTask(true); }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition text-sm"
                >
                    + Thêm Task mới
                </button>
            </div>

            {isAddingTask && (
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-indigo-100 shrink-0">
                    <h2 className="text-lg font-bold mb-4">Phân rã Task từ Feature</h2>
                    <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input
                            required
                            className="px-4 py-2 border rounded-lg text-sm"
                            placeholder="Tên công việc (Task)..."
                            value={newTask.title}
                            onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                        />
                        <select
                            required
                            className="px-4 py-2 border rounded-lg text-sm"
                            value={newTask.featureId}
                            onChange={e => setNewTask({ ...newTask, featureId: e.target.value })}
                        >
                            <option value="">Chọn Feature...</option>
                            {activeFeatures.filter(f => f.sprintId === selectedSprint?._id).map(f => (
                                <option key={f._id} value={f._id}>{f.title}</option>
                            ))}
                        </select>
                        <select
                            className="px-4 py-2 border rounded-lg text-sm"
                            value={newTask.taskType}
                            onChange={e => setNewTask({ ...newTask, taskType: e.target.value })}
                        >
                            <option value="FEATURE">Công việc</option>
                            <option value="BUG">Lỗi (Bug)</option>
                            <option value="MEETING">Họp hành</option>
                            <option value="MILESTONE">Cột mốc</option>
                        </select>
                        <input
                            className="px-4 py-2 border rounded-lg text-sm"
                            placeholder="Người thực hiện..."
                            value={newTask.assigneeName}
                            onChange={e => setNewTask({ ...newTask, assigneeName: e.target.value })}
                        />

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Ngày bắt đầu</label>
                            <input
                                type="date"
                                className="px-4 py-2 border rounded-lg text-sm"
                                value={newTask.startDate}
                                onChange={e => setNewTask({ ...newTask, startDate: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Ngày kết thúc</label>
                            <input
                                type="date"
                                className="px-4 py-2 border rounded-lg text-sm"
                                value={newTask.endDate}
                                onChange={e => setNewTask({ ...newTask, endDate: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Estimate (h)</label>
                            <input
                                type="text"
                                className="px-4 py-2 border rounded-lg text-sm"
                                value={newTask.estimateTime}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    const num = Number(val);
                                    if (val === '' || (num >= 1 && num <= 24)) {
                                        setNewTask({ ...newTask, estimateTime: val === '' ? 0 : num });
                                    }
                                }}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Tiến độ (%)</label>
                            <input
                                type="text"
                                className="px-4 py-2 border rounded-lg text-sm font-bold text-blue-600"
                                value={newTask.progress}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    const num = Number(val);
                                    if (val === '' || (num >= 1 && num <= 100)) {
                                        setNewTask({ ...newTask, progress: val === '' ? 0 : num });
                                    }
                                }}
                            />
                        </div>

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
                            <button type="button" onClick={() => { setIsAddingTask(false); setEditingTask(null); }} className="px-4 py-2 text-slate-400 font-bold uppercase tracking-wider text-[10px]">Hủy</button>
                            <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 hover:scale-105 transition-transform">
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
                                return (
                                    <div key={task._id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition group">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`material-icons text-[14px] ${task.taskType === 'BUG' ? 'text-red-500' : task.taskType === 'MEETING' ? 'text-orange-500' : 'text-blue-500'}`}>
                                                        {task.taskType === 'BUG' ? 'bug_report' : task.taskType === 'MEETING' ? 'groups' : task.taskType === 'MILESTONE' ? 'flag' : 'task_alt'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-indigo-500 uppercase px-1.5 py-0.5 bg-indigo-50 rounded">
                                                        {feature?.moduleName || 'NONE'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    <button onClick={() => handleEditTask(task)} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-blue-600 hover:text-white transition" title="Sửa">
                                                        <span className="material-icons text-[14px]">edit</span>
                                                    </button>
                                                    <button onClick={() => handleDeleteTask(task._id)} className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-red-600 hover:text-white transition" title="Xóa">
                                                        <span className="material-icons text-[14px]">delete</span>
                                                    </button>
                                                    {columns.filter(c => c.id !== col.id).map(c => {
                                                        const getIconForStatus = (statusId) => {
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
                                                                className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded hover:bg-indigo-600 hover:text-white transition"
                                                                title={`Chuyển sang: ${c.title}`}
                                                            >
                                                                <span className="material-icons text-[14px]">{getIconForStatus(c.id)}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                            <h4 className="font-bold text-slate-800 text-sm leading-tight">{task.title}</h4>

                                            <div className="space-y-1">
                                                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
                                                    <span>Tiến độ</span>
                                                    <span>{task.progress || 0}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${task.progress >= 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                                                        style={{ width: `${task.progress || 0}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center pt-3 border-t mt-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase border border-indigo-200">
                                                        {task.assigneeName ? task.assigneeName.charAt(0) : '?'}
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-500 uppercase">{task.assigneeName || 'NONE'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-icons text-[12px]">schedule</span>
                                                        {task.logTime}/{task.estimateTime}h
                                                    </span>
                                                </div>
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
