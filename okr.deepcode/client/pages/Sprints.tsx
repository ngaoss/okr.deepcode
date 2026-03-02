import React, { useEffect, useMemo, useState } from 'react';
import { featureService, projectService, sprintService } from '../services/projectService';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';

const Sprints = () => {
    const { user: currentUser } = useAuth();
    const { confirm: customConfirm } = useConfirm();
    const role = currentUser?.role || '';
    const isAdmin = role === 'QUẢN TRỊ VIÊN';
    const isManager = role === 'TRƯỞNG PHÒNG';
    const isLeader = role === 'TRƯỞNG NHÓM';
    const isEmployee = role === 'NHÂN VIÊN';
    const canManageSprint = isAdmin || isManager;
    const canManageFeature = isAdmin || isManager || isLeader;

    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [sprints, setSprints] = useState([]);
    const [projectFeatures, setProjectFeatures] = useState([]);
    const [isAddingSprint, setIsAddingSprint] = useState(false);
    const [editingSprint, setEditingSprint] = useState(null);
    const [newSprint, setNewSprint] = useState({ name: '', startDate: '', durationDays: 14, goal: '' });
    const [activeSprint, setActiveSprint] = useState(null);
    const [draggingFeatureId, setDraggingFeatureId] = useState(null);
    const [dropSprintId, setDropSprintId] = useState(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProject?._id) {
            refreshProjectBoards(selectedProject._id);
        }
    }, [selectedProject]);

    const backlogFeatures = useMemo(
        () => projectFeatures.filter(feature => !feature.sprintId),
        [projectFeatures]
    );

    const getSprintFeatures = (sprintId) =>
        projectFeatures.filter(feature => String(feature.sprintId || '') === String(sprintId));

    const fetchProjects = async () => {
        try {
            const data = await projectService.getProjects();
            setProjects(data || []);
            if (data?.length > 0 && !selectedProject) setSelectedProject(data[0]);
        } catch (err) {
            console.error('Lỗi lấy dự án:', err);
        }
    };

    const fetchSprints = async (projectId) => {
        try {
            const data = await sprintService.getSprintsByProject(projectId);
            setSprints(data || []);
            const active = (data || []).find(s => s.status === 'ACTIVE');
            setActiveSprint(active || null);
        } catch (err) {
            console.error('Lỗi lấy sprint:', err);
        }
    };

    const fetchFeatures = async (projectId) => {
        try {
            const data = await featureService.getFeaturesByProject(projectId);
            setProjectFeatures(data || []);
        } catch (err) {
            console.error('Lỗi lấy backlog:', err);
        }
    };

    const refreshProjectBoards = async (projectId) => {
        await Promise.all([fetchSprints(projectId), fetchFeatures(projectId)]);
    };

    const calcSprintEndDate = (startDate: string, durationDays: number): string => {
        const start = startDate ? new Date(startDate) : new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + (durationDays - 1));
        return end.toISOString().split('T')[0];
    };

    const handleCreateSprint = async (e) => {
        e.preventDefault();
        if (!newSprint.durationDays || newSprint.durationDays < 1) {
            alert('Số ngày sprint phải ít nhất là 1!');
            return;
        }
        const resolvedStartDate = newSprint.startDate || new Date().toISOString().split('T')[0];
        const resolvedEndDate = calcSprintEndDate(resolvedStartDate, newSprint.durationDays);
        const sprintPayload = {
            name: newSprint.name,
            goal: newSprint.goal,
            startDate: resolvedStartDate,
            endDate: resolvedEndDate,
            durationDays: newSprint.durationDays
        };
        try {
            if (editingSprint) {
                await sprintService.updateSprint(editingSprint._id, sprintPayload);
                setEditingSprint(null);
            } else {
                await sprintService.createSprint({ ...sprintPayload, projectId: selectedProject._id });
            }
            setIsAddingSprint(false);
            setNewSprint({ name: '', startDate: '', durationDays: 14, goal: '' });
            refreshProjectBoards(selectedProject._id);
        } catch (err) {
            alert('Lỗi lưu sprint: ' + err.message);
        }
    };

    const handleDeleteSprint = async (id) => {
        const ok = await customConfirm({
            title: 'Xóa Sprint?',
            message: 'Xóa Sprint sẽ đưa các task liên quan về Backlog. Bạn có chắc chắn muốn xóa?',
            type: 'warning'
        });
        if (!ok) return;
        try {
            await sprintService.deleteSprint(id);
            if (activeSprint?._id === id) setActiveSprint(null);
            refreshProjectBoards(selectedProject._id);
        } catch (err) {
            alert('Lỗi xóa sprint: ' + err.message);
        }
    };

    const handleEditSprint = (sprint) => {
        setEditingSprint(sprint);
        // Tính lại durationDays từ startDate/endDate nếu chưa có
        let durationDays = sprint.durationDays || 14;
        if (sprint.startDate && sprint.endDate && !sprint.durationDays) {
            const start = new Date(sprint.startDate);
            const end = new Date(sprint.endDate);
            durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        }
        setNewSprint({
            name: sprint.name,
            startDate: new Date(sprint.startDate).toISOString().split('T')[0],
            durationDays,
            goal: sprint.goal
        });
        setIsAddingSprint(true);
    };

    const handleStartSprint = async (sprintId) => {
        try {
            const data = await sprintService.updateSprintStatus(sprintId, 'ACTIVE');
            setSprints(sprints.map(s => s._id === sprintId ? data : (s.status === 'ACTIVE' ? { ...s, status: 'COMPLETED' } : s)));
            setActiveSprint(data);
        } catch (err) {
            alert('Lỗi kích hoạt sprint: ' + err.message);
        }
    };

    const handleDropFeatureToSprint = async (sprintId: string, explicitFeatureId?: string) => {
        const featureId = explicitFeatureId || draggingFeatureId;
        if (!featureId || !selectedProject?._id) return;
        if (!canManageFeature) {
            alert('Bạn không có quyền chuyển đổi feature này!');
            return;
        }
        try {
            await sprintService.addFeaturesToSprint(sprintId, [featureId]);
            setDraggingFeatureId(null);
            setDropSprintId(null);
            refreshProjectBoards(selectedProject._id);
        } catch (err: any) {
            alert('Lỗi thêm feature vào sprint: ' + err.message);
        }
    };

    const handleApproveSprint = async (sprintId: string, status: string) => {
        try {
            if (!selectedProject?._id) return;
            await fetch(`/api/sprints/${sprintId}/approve`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('okr_auth_token')}`
                },
                body: JSON.stringify({ approvalStatus: status })
            });
            refreshProjectBoards(selectedProject._id);
        } catch (err: any) {
            alert('Lỗi duyệt sprint: ' + err.message);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Quản lý Sprint</h1>
                    <p className="text-slate-500">Kéo thả feature backlog vào sprint để lập kế hoạch</p>
                </div>
                <div className="flex gap-3">
                    {projects.length > 1 ? (
                        <select
                            className="px-4 py-2 bg-slate-100 border-none rounded-lg font-medium cursor-pointer shadow-sm"
                            value={selectedProject?._id || ''}
                            onChange={(e) => setSelectedProject(projects.find(p => p._id === e.target.value))}
                        >
                            {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                        </select>
                    ) : (
                        projects.length === 1 && (
                            <div className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-indigo-700 border border-slate-200">
                                {projects[0].title}
                            </div>
                        )
                    )}
                    {canManageSprint && (
                        <button
                            onClick={() => { setEditingSprint(null); setNewSprint({ name: '', startDate: '', durationDays: 14, goal: '' }); setIsAddingSprint(true); }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition"
                        >
                            + Tạo Sprint mới
                        </button>
                    )}
                </div>
            </div>

            {selectedProject && selectedProject.description && (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-icons text-indigo-500 text-sm">info</span>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mô tả dự án</p>
                    </div>
                    <p className="text-sm text-slate-600 italic ml-6">{selectedProject.description}</p>
                </div>
            )}

            {isAddingSprint && (
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-indigo-100 animate-in fade-in zoom-in duration-200">
                    <h2 className="text-lg font-bold mb-4">Lên kế hoạch Sprint</h2>
                    <form onSubmit={handleCreateSprint} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        {/* Tên Sprint */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Tên Sprint <span className="text-red-400">*</span></label>
                            <input
                                required
                                className="px-4 py-2 border rounded-lg focus:ring-2 ring-indigo-500 h-[40px] text-sm"
                                placeholder="Nhập tên Sprint..."
                                value={newSprint.name}
                                onChange={e => setNewSprint({ ...newSprint, name: e.target.value })}
                            />
                        </div>
                        {/* Ngày bắt đầu */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Ngày bắt đầu <span className="text-slate-300 font-normal normal-case">(bỏ trống để bắt đầu ngay hôm nay)</span></label>
                            <input
                                type="date"
                                className="px-4 py-2 border rounded-lg h-[40px] text-sm"
                                value={newSprint.startDate}
                                onChange={e => setNewSprint({ ...newSprint, startDate: e.target.value })}
                            />
                        </div>
                        {/* Số ngày sprint */}
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <span className="material-icons text-[12px] text-orange-400">timer</span>
                                    Số ngày Sprint <span className="text-red-400">*</span>
                                </label>
                                {newSprint.durationDays >= 1 && (
                                    <span className="text-[9px] text-orange-400 font-bold uppercase tracking-tight">
                                        → Kết thúc: {new Date(calcSprintEndDate(newSprint.startDate, newSprint.durationDays)).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                            </div>
                            <input
                                required
                                type="number"
                                min={1}
                                max={365}
                                className="px-4 py-2 border rounded-lg font-bold text-orange-600 border-orange-200 focus:ring-2 focus:ring-orange-300 h-[40px] text-sm"
                                placeholder="Nhập số ngày..."
                                value={newSprint.durationDays}
                                onChange={e => setNewSprint({ ...newSprint, durationDays: Math.max(1, parseInt(e.target.value) || 1) })}
                            />
                        </div>
                        <textarea
                            className="md:col-span-3 px-4 py-2 border rounded-lg text-sm"
                            placeholder="Mục tiêu Sprint..."
                            value={newSprint.goal}
                            onChange={e => setNewSprint({ ...newSprint, goal: e.target.value })}
                        />
                        <div className="md:col-span-3 flex justify-end gap-2 text-sm">
                            <button type="button" onClick={() => { setIsAddingSprint(false); setEditingSprint(null); }} className="px-4 py-2">Hủy</button>
                            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">
                                {editingSprint ? 'Cập nhật Sprint' : 'Tạo Sprint'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className={`grid grid-cols-1 ${!isEmployee ? 'lg:grid-cols-2' : ''} gap-8`}>
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-icons text-indigo-600">running_with_errors</span>
                        Sprints Dự án
                    </h3>
                    <div className="space-y-4">
                        {sprints.map((sprint: any) => {
                            const featuresInSprint = getSprintFeatures(sprint._id);
                            const isDropTarget = dropSprintId === sprint._id;
                            const showApprovalActions = isAdmin && sprint.approvalStatus === 'PENDING';
                            return (
                                <div
                                    key={sprint._id}
                                    className={`bg-white border-2 rounded-xl p-5 shadow-sm transition ${sprint.status === 'ACTIVE' ? 'border-green-400' : 'border-slate-100'} ${isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDropSprintId(sprint._id);
                                    }}
                                    onDragLeave={() => setDropSprintId((prev) => (prev === sprint._id ? null : prev))}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const featureId = e.dataTransfer.getData('text/plain') || draggingFeatureId;
                                        handleDropFeatureToSprint(sprint._id, featureId);
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-lg text-slate-800">{sprint.name}</h4>
                                            <p className="text-xs text-slate-500">
                                                {new Date(sprint.startDate).toLocaleDateString('vi-VN')} - {new Date(sprint.endDate).toLocaleDateString('vi-VN')}
                                            </p>
                                            {(sprint.creatorName || sprint.creatorRole) && (
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    Tạo bởi: <strong className="text-indigo-600">{sprint.creatorName}</strong> ({sprint.creatorRole})
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${sprint.approvalStatus === 'PENDING' ? 'bg-orange-100 text-orange-700' : sprint.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : sprint.status === 'PLANNING' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                                {sprint.approvalStatus === 'PENDING' ? 'CHỜ DUYỆT' : sprint.status}
                                            </span>
                                            {showApprovalActions && (
                                                <div className="flex gap-1 mt-1">
                                                    <button onClick={() => handleApproveSprint(sprint._id, 'APPROVED')} className="text-[10px] px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600">
                                                        Duyệt
                                                    </button>
                                                    <button onClick={() => handleApproveSprint(sprint._id, 'REJECTED')} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600">
                                                        Từ chối
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            {canManageSprint && (
                                                <>
                                                    <button onClick={() => handleEditSprint(sprint)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                                        <span className="material-icons text-sm">edit</span>
                                                    </button>
                                                    <button onClick={() => handleDeleteSprint(sprint._id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                                        <span className="material-icons text-sm">delete</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-sm text-slate-600 italic mb-4">"{sprint.goal}"</p>

                                    {!isEmployee && (
                                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg mb-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Thả feature backlog vào đây</span>
                                            {sprint.status === 'PLANNING' && sprint.approvalStatus !== 'PENDING' && canManageSprint && (
                                                <button
                                                    onClick={() => handleStartSprint(sprint._id)}
                                                    className="px-4 py-1.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition"
                                                >
                                                    Bắt đầu Sprint
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {featuresInSprint.length > 0 ? (
                                            featuresInSprint.map(feature => (
                                                <div key={feature._id} className="ml-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                    <div className="text-sm font-semibold text-slate-700">{feature.title}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                                        {feature.moduleName} • {feature.priority}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="ml-3 text-xs text-slate-400 italic">Chưa có feature nào trong sprint này.</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {sprints.length === 0 && (
                            <div className="p-12 border-2 border-dashed rounded-2xl text-center text-slate-400">
                                Chưa có Sprint nào. Hãy tạo Sprint đầu tiên để bắt đầu.
                            </div>
                        )}
                    </div>
                </div>

                {!isEmployee && (
                    <div className="space-y-6 bg-slate-100 p-6 rounded-2xl h-[calc(100vh-250px)] overflow-y-auto">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="material-icons text-orange-500">inventory_2</span>
                            Features chờ xử lý (Backlog)
                        </h3>
                        <p className="text-xs text-slate-500">Giữ và kéo từng feature sang cột Sprint để gán trực tiếp.</p>
                        <div className="space-y-3">
                            {backlogFeatures.map(feature => (
                                <div
                                    key={feature._id}
                                    draggable
                                    onDragStart={(e) => {
                                        setDraggingFeatureId(feature._id);
                                        e.dataTransfer.setData('text/plain', feature._id);
                                    }}
                                    onDragEnd={() => {
                                        setDraggingFeatureId(null);
                                        setDropSprintId(null);
                                    }}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-transparent hover:border-indigo-400 transition cursor-grab active:cursor-grabbing"
                                >
                                    <div className="flex justify-between items-start mb-2 gap-3">
                                        <h5 className="font-bold text-slate-700">{feature.title}</h5>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${feature.priority === 'HIGH' || feature.priority === 'URGENT' ? 'bg-red-100 text-red-600' : feature.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {feature.priority}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">{feature.moduleName}</span>
                                        <span>Kéo thả vào sprint</span>
                                    </div>
                                </div>
                            ))}
                            {backlogFeatures.length === 0 && (
                                <div className="text-center py-12 text-slate-400">
                                    Backlog trống.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sprints;
