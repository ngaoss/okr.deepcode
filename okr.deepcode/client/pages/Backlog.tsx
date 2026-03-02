import React, { useState, useEffect } from 'react';
import { projectService, featureService, noteAgileService } from '../services/projectService';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';

const EMPTY_FEATURE = { title: '', moduleName: '', description: '', acceptanceCriteria: '', priority: 'MEDIUM' };
const EMPTY_PROJECT = { title: '', description: '', modules: [], assignedManagerId: '' };

const Backlog = () => {
    const { user: currentUser } = useAuth();
    const { confirm: customConfirm } = useConfirm();
    const role = currentUser?.role || '';

    const isAdmin = role === 'QUẢN TRỊ VIÊN';
    const isManager = role === 'TRƯỞNG PHÒNG';
    const isLeader = role === 'TRƯỞNG NHÓM';
    // NHÂN VIÊN: chỉ xem

    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [features, setFeatures] = useState([]);

    // Project form
    const [isAddingProject, setIsAddingProject] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [newProject, setNewProject] = useState(EMPTY_PROJECT);
    const [managers, setManagers] = useState([]);
    const [leaders, setLeaders] = useState([]);
    const [tempSelectedLeaderId, setTempSelectedLeaderId] = useState<string | null>(null);
    const [modulesInput, setModulesInput] = useState('');

    // Feature form
    const [isAddingFeature, setIsAddingFeature] = useState(false);
    const [editingFeature, setEditingFeature] = useState(null);
    const [newFeature, setNewFeature] = useState(EMPTY_FEATURE);

    // Module inline add
    const [isAddingModule, setIsAddingModule] = useState(false);
    const [newModuleName, setNewModuleName] = useState('');

    // Detail modal
    const [viewingFeature, setViewingFeature] = useState(null);
    const [featureNotes, setFeatureNotes] = useState([]);

    useEffect(() => {
        fetchProjects();
        if (isAdmin) fetchManagers();
        if (isManager) fetchLeaders();
    }, [isAdmin, isManager]);

    useEffect(() => {
        if (selectedProject) {
            fetchFeatures(selectedProject._id);
            setTempSelectedLeaderId(selectedProject.assignedLeaderId?._id || selectedProject.assignedLeaderId || null);
        }
    }, [selectedProject]);

    const fetchProjects = async () => {
        try {
            const data = await projectService.getProjects();
            setProjects(data || []);
            if (data?.length > 0 && !selectedProject) setSelectedProject(data[0]);
        } catch (err) {
            console.error('Lỗi lấy dự án:', err);
        }
    };

    const fetchManagers = async () => {
        try {
            const data = await projectService.getManagers();
            setManagers(data || []);
        } catch (err) {
            console.error('Lỗi lấy trưởng phòng:', err);
        }
    };

    const fetchLeaders = async () => {
        try {
            const data = await projectService.getLeaders();
            setLeaders(data || []);
        } catch (err) {
            console.error('Lỗi lấy trưởng nhóm:', err);
        }
    };

    const handleAssignLeader = async () => {
        if (!selectedProject || !tempSelectedLeaderId) return;
        try {
            const data = await projectService.updateProject(selectedProject._id, { assignedLeaderId: tempSelectedLeaderId });
            setProjects(prev => prev.map((p: any) => p._id === data._id ? data : p));
            setSelectedProject(data);
            alert('Đã lưu phân công Trưởng nhóm thành công!');
        } catch (err: any) {
            alert('Lỗi gán trưởng nhóm: ' + err.message);
        }
    };

    const fetchFeatures = async (projectId: string) => {
        try {
            const data = await featureService.getFeaturesByProject(projectId);
            setFeatures(data || []);
        } catch (err) {
            console.error('Lỗi lấy features:', err);
        }
    };

    // ============ PROJECT HANDLERS (Admin only) ============
    const handleOpenNewProject = () => {
        setEditingProject(null);
        setNewProject(EMPTY_PROJECT);
        setModulesInput('');
        setIsAddingProject(true);
    };

    const handleOpenEditProject = (project: any) => {
        setEditingProject(project);
        setNewProject({
            title: project.title,
            description: project.description || '',
            modules: project.modules || [],
            assignedManagerId: project.assignedManagerId?._id || project.assignedManagerId || ''
        });
        setModulesInput((project.modules || []).map((m: any) => m.name).join(', '));
        setIsAddingProject(true);
    };

    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...newProject,
            modules: modulesInput.split(',').map(m => ({ name: m.trim() })).filter(m => m.name)
        };
        try {
            if (editingProject) {
                const data = await projectService.updateProject(editingProject._id, payload);
                setProjects(prev => prev.map(p => p._id === data._id ? data : p));
                setSelectedProject(data);
            } else {
                const data = await projectService.createProject(payload);
                setProjects(prev => [data, ...prev]);
                setSelectedProject(data);
            }
            setIsAddingProject(false);
            setEditingProject(null);
        } catch (err: any) {
            alert('Lỗi lưu dự án: ' + err.message);
        }
    };

    const handleDeleteProject = async (id: string) => {
        const ok = await customConfirm({
            title: 'Xóa dự án?',
            message: 'Xóa dự án sẽ xóa toàn bộ dữ liệu liên quan. Bạn chắc chắn?',
            type: 'danger',
            confirmText: 'Xóa vĩnh viễn',
            cancelText: 'Quay lại'
        });
        if (!ok) return;
        try {
            await projectService.deleteProject(id);
            const updated = projects.filter((p: any) => p._id !== id);
            setProjects(updated);
            setSelectedProject(updated[0] || null);
        } catch (err: any) {
            alert('Lỗi xóa dự án: ' + err.message);
        }
    };

    // ============ MODULE HANDLERS (Admin + Manager) ============
    const handleAddModule = async () => {
        if (!newModuleName.trim() || !selectedProject) return;
        const updatedModules = [...(selectedProject.modules || []), { name: newModuleName.trim() }];
        try {
            const data = await projectService.updateModules(selectedProject._id, updatedModules);
            setProjects(prev => prev.map((p: any) => p._id === data._id ? data : p));
            setSelectedProject(data);
            setNewModuleName('');
            setIsAddingModule(false);
        } catch (err: any) {
            alert('Lỗi thêm module: ' + err.message);
        }
    };

    const handleDeleteModule = async (moduleName: string) => {
        const ok = await customConfirm({
            title: 'Xóa Module?',
            message: `Bạn có chắc chắn muốn xóa module "${moduleName}"?`,
            type: 'warning'
        });
        if (!ok) return;
        const updatedModules = (selectedProject.modules || []).filter((m: any) => m.name !== moduleName);
        try {
            const data = await projectService.updateModules(selectedProject._id, updatedModules);
            setProjects(prev => prev.map((p: any) => p._id === data._id ? data : p));
            setSelectedProject(data);
            setFeatures(prev => prev.filter((f: any) => f.moduleName !== moduleName));
        } catch (err: any) {
            alert('Lỗi xóa module: ' + err.message);
        }
    };

    // ============ FEATURE HANDLERS (Admin + Manager + Leader) ============
    const handleOpenNewFeature = () => {
        setEditingFeature(null);
        setNewFeature(EMPTY_FEATURE);
        setIsAddingFeature(true);
    };

    const handleEditFeature = (feature: any) => {
        setEditingFeature(feature);
        setNewFeature({
            title: feature.title,
            moduleName: feature.moduleName,
            description: feature.description,
            acceptanceCriteria: feature.acceptanceCriteria,
            priority: feature.priority
        });
        setIsAddingFeature(true);
    };

    const handleSaveFeature = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingFeature) {
                const data = await featureService.updateFeature(editingFeature._id, newFeature);
                setFeatures(prev => prev.map((f: any) => f._id === data._id ? data : f));
                setEditingFeature(null);
            } else {
                const data = await featureService.createFeature({ ...newFeature, projectId: selectedProject._id });
                setFeatures(prev => [data, ...prev]);
            }
            setIsAddingFeature(false);
            setNewFeature(EMPTY_FEATURE);
        } catch (err: any) {
            alert('Lỗi lưu feature: ' + err.message);
        }
    };

    const handleDeleteFeature = async (id: string) => {
        const ok = await customConfirm({
            title: 'Xóa Feature?',
            message: 'Bạn có chắc chắn muốn xóa feature này khỏi backlog?',
            type: 'warning'
        });
        if (!ok) return;
        try {
            await featureService.deleteFeature(id);
            setFeatures(prev => prev.filter((f: any) => f._id !== id));
        } catch (err: any) {
            alert('Lỗi xóa feature: ' + err.message);
        }
    };

    const handleViewFeatureDetail = async (feature: any) => {
        setViewingFeature(feature);
        try {
            const data = await noteAgileService.getNotes('FEATURE', feature._id);
            setFeatureNotes(data || []);
        } catch {
            setFeatureNotes([]);
        }
    };

    const canEditFeature = isAdmin || isManager || isLeader;
    const canEditModule = isAdmin || isManager;
    const canManageProject = isAdmin;

    const priorityColors: Record<string, string> = {
        URGENT: 'bg-red-100 text-red-700 border-red-200',
        HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
        MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
        LOW: 'bg-blue-100 text-blue-700 border-blue-200'
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* ---- Header ---- */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Quản lý Backlog</h1>
                    <p className="text-slate-500 text-sm">Quản lý yêu cầu nghiệp vụ và tính năng dự án</p>
                </div>
                <div className="flex gap-3 items-center">
                    {projects.length > 1 ? (
                        <select
                            className="px-4 py-2 bg-slate-100 border-none rounded-lg font-medium cursor-pointer shadow-sm"
                            value={selectedProject?._id || ''}
                            onChange={(e) => setSelectedProject(projects.find((p: any) => p._id === e.target.value))}
                        >
                            {projects.map((p: any) => <option key={p._id} value={p._id}>{p.title}</option>)}
                        </select>
                    ) : (
                        projects.length === 1 && (
                            <div className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-indigo-700 border border-slate-200">
                                {projects[0].title}
                            </div>
                        )
                    )}

                    {/* Nút sửa/xóa dự án - chỉ admin */}
                    {canManageProject && selectedProject && (
                        <>
                            <button
                                onClick={() => handleOpenEditProject(selectedProject)}
                                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
                                title="Sửa dự án"
                            >
                                <span className="material-icons text-sm">edit</span>
                            </button>
                            <button
                                onClick={() => handleDeleteProject(selectedProject._id)}
                                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                                title="Xóa dự án"
                            >
                                <span className="material-icons text-sm">delete</span>
                            </button>
                            <button
                                onClick={handleOpenNewProject}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                            >
                                + Dự án mới
                            </button>
                        </>
                    )}
                    {canManageProject && projects.length === 0 && (
                        <button
                            onClick={handleOpenNewProject}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                        >
                            + Dự án mới
                        </button>
                    )}
                </div>
            </div>

            {/* ---- Project Description ---- */}
            {selectedProject && (selectedProject.description || isManager) && (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-4">
                    {selectedProject.description && (
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-icons text-indigo-500 text-sm">info</span>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mô tả dự án</p>
                            </div>
                            <p className="text-sm text-slate-600 italic ml-6">{selectedProject.description}</p>
                        </div>
                    )}

                    {selectedProject.assignedLeaderId && (
                        <div className="ml-6 flex items-center gap-2 mt-1">
                            <span className="material-icons text-[14px] text-amber-500">manage_accounts</span>
                            <span className="text-xs text-slate-500">Trưởng nhóm phụ trách:</span>
                            <strong className="text-xs text-amber-600">{selectedProject.assignedLeaderId?.name || 'Đã gán'}</strong>
                        </div>
                    )}

                    {isManager && (
                        <div className="mt-2">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-[11px] font-black tracking-widest text-slate-500 uppercase">TRƯỞNG NHÓM (ƯU TIÊN QUẢN LÝ)</label>
                                <button
                                    onClick={handleAssignLeader}
                                    disabled={!tempSelectedLeaderId || tempSelectedLeaderId === (selectedProject?.assignedLeaderId?._id || selectedProject?.assignedLeaderId)}
                                    className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    Lưu phân công
                                </button>
                            </div>
                            <div className="max-h-52 overflow-y-auto border rounded-xl bg-slate-50 p-2 grid gap-2 custom-scrollbar md:grid-cols-2 lg:grid-cols-3">
                                {leaders.map((m: any) => {
                                    const isAssigned = tempSelectedLeaderId === m._id;
                                    return (
                                        <div
                                            key={m._id}
                                            onClick={() => setTempSelectedLeaderId(m._id)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border bg-white cursor-pointer transition ${isAssigned ? 'border-amber-500 ring-1 ring-amber-500 shadow-md' : 'border-slate-200 hover:border-amber-300'}`}
                                        >
                                            <div className="w-5 flex items-center justify-center">
                                                <input
                                                    type="radio"
                                                    className="w-4 h-4 cursor-pointer text-amber-600 focus:ring-amber-500"
                                                    checked={isAssigned}
                                                    readOnly
                                                />
                                            </div>
                                            <img src={m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`} alt={m.name} className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200" />
                                            <div className="flex flex-col flex-1 truncate">
                                                <span className="font-bold text-slate-800 text-sm truncate">{m.name}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase truncate">LEADER • {m.department || 'CHƯA PHÂN BAN'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}


            {/* ---- Project Form (Admin only) ---- */}
            {isAddingProject && canManageProject && (
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-100 animate-in fade-in zoom-in duration-200">
                    <h2 className="text-lg font-bold mb-4">{editingProject ? 'Chỉnh sửa Dự án' : 'Tạo Dự án Mới'}</h2>
                    <form onSubmit={handleSaveProject} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            required
                            className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500"
                            placeholder="Tên dự án..."
                            value={newProject.title}
                            onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                        />
                        <div className="md:col-span-2">
                            <label className="text-[11px] font-black tracking-widest text-slate-500 uppercase block mb-3">TRƯỞNG PHÒNG PHỤ TRÁCH (ƯU TIÊN QUẢN LÝ)</label>
                            <div className="max-h-52 overflow-y-auto border rounded-xl bg-slate-50 p-2 grid gap-2 custom-scrollbar md:grid-cols-2">
                                {managers.map((m: any) => (
                                    <div
                                        key={m._id}
                                        onClick={() => setNewProject({ ...newProject, assignedManagerId: m._id })}
                                        className={`flex items-center gap-3 p-3 rounded-xl border bg-white cursor-pointer transition ${newProject.assignedManagerId === m._id ? 'border-blue-500 ring-1 ring-blue-500 shadow-md' : 'border-slate-200 hover:border-blue-300'}`}
                                    >
                                        <div className="w-5 flex items-center justify-center">
                                            <input
                                                type="radio"
                                                className="w-4 h-4 cursor-pointer text-blue-600 focus:ring-blue-500"
                                                checked={newProject.assignedManagerId === m._id}
                                                readOnly
                                            />
                                        </div>
                                        <img src={m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.name}`} alt={m.name} className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200" />
                                        <div className="flex flex-col flex-1">
                                            <span className="font-bold text-slate-800 text-sm">{m.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">MANAGER • {m.department || 'CHƯA PHÂN BAN'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <input
                            className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500"
                            placeholder="Các Module (ngăn cách bởi dấu phẩy): VD: Backend, Frontend, Testing"
                            value={modulesInput}
                            onChange={e => setModulesInput(e.target.value)}
                        />
                        <textarea
                            className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500"
                            placeholder="Mô tả dự án..."
                            value={newProject.description}
                            onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                        />
                        <div className="md:col-span-2 flex justify-end gap-2">
                            <button type="button" onClick={() => { setIsAddingProject(false); setEditingProject(null); }} className="px-4 py-2 text-slate-600 font-medium">Hủy</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">
                                {editingProject ? 'Cập nhật dự án' : 'Lưu dự án'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ---- Main Content ---- */}
            {selectedProject ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* --- Modules Panel --- */}
                    <div className="md:col-span-1 border rounded-xl p-4 bg-white shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Modules công việc</h3>
                            {canEditModule && (
                                <button
                                    onClick={() => setIsAddingModule(v => !v)}
                                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold transition"
                                >
                                    + Module
                                </button>
                            )}
                        </div>

                        {isAddingModule && canEditModule && (
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                                    placeholder="Tên module..."
                                    value={newModuleName}
                                    onChange={e => setNewModuleName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddModule()}
                                />
                                <button onClick={handleAddModule} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold">✓</button>
                                <button onClick={() => { setIsAddingModule(false); setNewModuleName(''); }} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm">✕</button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {(selectedProject.modules || []).map((m: any, idx: number) => (
                                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between group">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                                        <span className="font-medium text-slate-700 text-sm">{m.name}</span>
                                    </div>
                                    {canEditModule && (
                                        <button
                                            onClick={() => handleDeleteModule(m.name)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition"
                                            title="Xóa module"
                                        >
                                            <span className="material-icons text-sm">close</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                            {(selectedProject.modules || []).length === 0 && (
                                <p className="text-sm text-slate-400 italic text-center py-4">
                                    {canEditModule ? 'Chưa có module. Nhấn + để thêm.' : 'Chưa có module nào.'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* --- Features Panel --- */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">Danh sách Backlog
                                <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-sm font-bold rounded-full">{features.length}</span>
                            </h3>
                            {canEditFeature && (
                                <button
                                    onClick={handleOpenNewFeature}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                >
                                    + Thêm Feature
                                </button>
                            )}
                        </div>

                        {/* Feature Form */}
                        {isAddingFeature && canEditFeature && (
                            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-green-100 animate-in fade-in slide-in-from-top-4 duration-200">
                                <h2 className="text-base font-bold mb-4 text-green-700">
                                    {editingFeature ? '✏️ Sửa Feature' : '+ Thêm Feature mới vào Backlog'}
                                </h2>
                                <form onSubmit={handleSaveFeature} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input
                                        required
                                        className="px-4 py-2 border rounded-lg"
                                        placeholder="Tên tính năng (Feature)..."
                                        value={newFeature.title}
                                        onChange={e => setNewFeature({ ...newFeature, title: e.target.value })}
                                    />
                                    <select
                                        required
                                        className="px-4 py-2 border rounded-lg"
                                        value={newFeature.moduleName}
                                        onChange={e => setNewFeature({ ...newFeature, moduleName: e.target.value })}
                                    >
                                        <option value="">Chọn Module...</option>
                                        {(selectedProject.modules || []).map((m: any, idx: number) => (
                                            <option key={idx} value={m.name}>{m.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="px-4 py-2 border rounded-lg"
                                        value={newFeature.priority}
                                        onChange={e => setNewFeature({ ...newFeature, priority: e.target.value })}
                                    >
                                        <option value="LOW">🔵 LOW - Thấp</option>
                                        <option value="MEDIUM">🟡 MEDIUM - Trung bình</option>
                                        <option value="HIGH">🟠 HIGH - Cao</option>
                                        <option value="URGENT">🔴 URGENT - Khẩn cấp</option>
                                    </select>
                                    <div />
                                    <textarea
                                        className="md:col-span-2 px-4 py-2 border rounded-lg"
                                        rows={3}
                                        placeholder="Mô tả yêu cầu khách hàng..."
                                        value={newFeature.description}
                                        onChange={e => setNewFeature({ ...newFeature, description: e.target.value })}
                                    />
                                    <textarea
                                        className="md:col-span-2 px-4 py-2 border rounded-lg"
                                        rows={2}
                                        placeholder="Tiêu chí nghiệm thu (Acceptance Criteria)..."
                                        value={newFeature.acceptanceCriteria}
                                        onChange={e => setNewFeature({ ...newFeature, acceptanceCriteria: e.target.value })}
                                    />
                                    <div className="md:col-span-2 flex justify-end gap-2">
                                        <button type="button" onClick={() => { setIsAddingFeature(false); setEditingFeature(null); }} className="px-4 py-2">Hủy</button>
                                        <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold">
                                            {editingFeature ? 'Cập nhật Feature' : 'Thêm vào Backlog'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Feature List */}
                        <div className="space-y-3">
                            {features.map((f: any) => (
                                <div key={f._id} className="bg-white p-4 rounded-xl shadow-sm border hover:border-blue-300 transition group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded uppercase shrink-0">
                                                {f.moduleName}
                                            </span>
                                            <h4 className="font-bold text-slate-800 truncate">{f.title}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityColors[f.priority] || priorityColors['MEDIUM']}`}>
                                                {f.priority}
                                            </span>
                                            {/* Edit/Delete chỉ cho Admin, Manager, Leader */}
                                            {canEditFeature && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                    <button onClick={() => handleEditFeature(f)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Sửa">
                                                        <span className="material-icons text-sm">edit</span>
                                                    </button>
                                                    {(isAdmin || isManager) && (
                                                        <button onClick={() => handleDeleteFeature(f._id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Xóa">
                                                            <span className="material-icons text-sm">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-slate-600 text-sm line-clamp-2 mb-3">{f.description}</p>
                                    <div className="flex justify-between items-center text-xs text-slate-400 border-t pt-3">
                                        <div className="flex gap-4">
                                            <span>Tiêu chí: {f.acceptanceCriteria ? '✅ Đã có' : '⏳ Chưa có'}</span>
                                            <span>Ghi chú: {f.notes?.length || 0}</span>
                                        </div>
                                        <button
                                            onClick={() => handleViewFeatureDetail(f)}
                                            className="text-blue-600 font-bold hover:underline transition"
                                        >
                                            Chi tiết →
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {features.length === 0 && !isAddingFeature && (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                    <span className="material-icons text-3xl text-slate-300">inventory_2</span>
                                    <p className="text-slate-400 font-medium mt-2">
                                        {canEditFeature ? 'Chưa có tính năng nào. Nhấn "+ Thêm Feature" để bắt đầu.' : 'Chưa có tính năng nào trong Backlog.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    <span className="material-icons text-5xl text-slate-300">dashboard</span>
                    <p className="text-slate-500 font-medium mt-4">
                        {canManageProject ? 'Chưa có dự án nào. Nhấn "+ Dự án mới" để tạo.' : 'Bạn chưa được giao cho dự án nào.'}
                    </p>
                </div>
            )}

            {/* ---- Feature Detail Modal ---- */}
            {viewingFeature && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{viewingFeature.moduleName}</p>
                                <h2 className="text-xl font-bold text-slate-800">{viewingFeature.title}</h2>
                            </div>
                            <button onClick={() => setViewingFeature(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-2">
                                <h3 className="font-bold text-slate-700 border-b pb-2">📝 Mô tả Yêu cầu</h3>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewingFeature.description || 'Chưa có mô tả'}</p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-slate-700 border-b pb-2">✅ Tiêu chí Nghiệm thu</h3>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewingFeature.acceptanceCriteria || 'Chưa có tiêu chí'}</p>
                            </div>
                            <div className="space-y-3">
                                <h3 className="font-bold text-slate-700 border-b pb-2">📌 Ghi chú đính kèm ({featureNotes.length})</h3>
                                {featureNotes.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">Chưa có ghi chú nào.</p>
                                ) : featureNotes.map((n: any) => (
                                    <div key={n._id} className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                                        <div className="flex justify-between mb-2 border-b border-indigo-100 pb-2">
                                            <span className="font-bold text-indigo-700 text-sm">{n.title}</span>
                                            <span className="text-[10px] text-slate-500">{new Date(n.createdAt).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap italic">{n.content}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-2 text-right">Tạo bởi: {n.createdBy?.name || 'Không rõ'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Backlog;
