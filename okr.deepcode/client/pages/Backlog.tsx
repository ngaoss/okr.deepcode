import React, { useState, useEffect } from 'react';
import { projectService, featureService, noteAgileService } from '../services/projectService';

const Backlog = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [features, setFeatures] = useState([]);
    const [isAddingProject, setIsAddingProject] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [isAddingFeature, setIsAddingFeature] = useState(false);
    const [editingFeature, setEditingFeature] = useState(null);
    const [newProject, setNewProject] = useState({ title: '', description: '', modules: [] });
    const [newFeature, setNewFeature] = useState({ title: '', moduleName: '', description: '', acceptanceCriteria: '', priority: 'MEDIUM' });
    const [viewingFeature, setViewingFeature] = useState(null);
    const [featureNotes, setFeatureNotes] = useState([]);

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProject) {
            fetchFeatures(selectedProject._id);
        }
    }, [selectedProject]);

    const fetchProjects = async () => {
        try {
            const data = await projectService.getProjects();
            setProjects(data);
            if (data.length > 0 && !selectedProject) setSelectedProject(data[0]);
        } catch (err) {
            console.error('Lỗi lấy danh sách dự án:', err);
        }
    };

    const fetchFeatures = async (projectId) => {
        try {
            const data = await featureService.getFeaturesByProject(projectId);
            setFeatures(data);
        } catch (err) {
            console.error('Lỗi lấy danh sách feature:', err);
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        try {
            const data = await projectService.createProject(newProject);
            setProjects([data, ...projects]);
            setSelectedProject(data);
            setIsAddingProject(false);
            setNewProject({ title: '', description: '', modules: [] });
        } catch (err) {
            alert('Lỗi tạo dự án: ' + err.message);
        }
    };

    const handleCreateFeature = async (e) => {
        e.preventDefault();
        try {
            if (editingFeature) {
                const data = await featureService.updateFeature(editingFeature._id, newFeature);
                setFeatures(features.map(f => f._id === data._id ? data : f));
                setEditingFeature(null);
            } else {
                const data = await featureService.createFeature({ ...newFeature, projectId: selectedProject._id });
                setFeatures([data, ...features]);
            }
            setIsAddingFeature(false);
            setNewFeature({ title: '', moduleName: '', description: '', acceptanceCriteria: '', priority: 'MEDIUM' });
        } catch (err) {
            alert('Lỗi lưu feature: ' + err.message);
        }
    };

    const handleDeleteProject = async (id) => {
        if (!confirm('Xóa dự án này sẽ xóa tất cả dữ liệu liên quan. Bạn chắc chắn?')) return;
        try {
            await projectService.deleteProject(id);
            const updatedProjects = projects.filter(p => p._id !== id);
            setProjects(updatedProjects);
            if (selectedProject?._id === id) {
                setSelectedProject(updatedProjects[0] || null);
            }
        } catch (err) {
            alert('Lỗi xóa dự án: ' + err.message);
        }
    };

    const handleDeleteFeature = async (id) => {
        if (!confirm('Bạn có chắc muốn xóa feature này?')) return;
        try {
            await featureService.deleteFeature(id);
            setFeatures(features.filter(f => f._id !== id));
        } catch (err) {
            alert('Lỗi xóa feature: ' + err.message);
        }
    };

    const handleEditProject = (project) => {
        setEditingProject(project);
        setNewProject({
            title: project.title,
            description: project.description,
            modules: project.modules
        });
        setIsAddingProject(true);
    };

    const handleEditFeature = (feature) => {
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

    const handleSaveProject = async (e) => {
        e.preventDefault();
        try {
            if (editingProject) {
                const data = await projectService.updateProject(editingProject._id, newProject);
                setProjects(projects.map(p => p._id === data._id ? data : p));
                setSelectedProject(data);
                setEditingProject(null);
            } else {
                const data = await projectService.createProject(newProject);
                setProjects([data, ...projects]);
                setSelectedProject(data);
            }
            setIsAddingProject(false);
            setNewProject({ title: '', description: '', modules: [] });
        } catch (err) {
            alert('Lỗi lưu dự án: ' + err.message);
        }
    };

    const handleViewFeatureDetail = async (feature) => {
        setViewingFeature(feature);
        try {
            const data = await noteAgileService.getNotes('FEATURE', feature._id);
            setFeatureNotes(data);
        } catch (err) {
            console.error('Lỗi lấy ghi chú:', err);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Quản lý Backlog</h1>
                    <p className="text-slate-500">Quản lý các yêu cầu nghiệp vụ và tính năng dự án</p>
                </div>
                <div className="flex gap-3">
                    <select
                        className="px-4 py-2 bg-slate-100 border-none rounded-lg focus:ring-2 ring-blue-500 font-medium cursor-pointer"
                        value={selectedProject?._id || ''}
                        onChange={(e) => setSelectedProject(projects.find(p => p._id === e.target.value))}
                    >
                        {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                    </select>
                    <button
                        onClick={() => { handleEditProject(selectedProject); }}
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
                        onClick={() => { setEditingProject(null); setNewProject({ title: '', description: '', modules: [] }); setIsAddingProject(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                        + Dự án mới
                    </button>
                </div>
            </div>

            {isAddingProject && (
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-100 animate-in fade-in zoom-in duration-200">
                    <h2 className="text-lg font-bold mb-4">Tạo Dự án Mới</h2>
                    <form onSubmit={handleCreateProject} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            required
                            className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500"
                            placeholder="Tên dự án..."
                            value={newProject.title}
                            onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                        />
                        <input
                            className="px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500"
                            placeholder="Các Module (ngăn cách bởi dấu phẩy)..."
                            onChange={e => setNewProject({ ...newProject, modules: e.target.value.split(',').map(m => ({ name: m.trim() })) })}
                        />
                        <textarea
                            className="md:col-span-2 px-4 py-2 border rounded-lg focus:ring-2 ring-blue-500"
                            placeholder="Mô tả dự án..."
                            value={newProject.description}
                            onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                        />
                        <div className="md:col-span-2 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setIsAddingProject(false); setEditingProject(null); }}
                                className="px-4 py-2 text-slate-600 font-medium"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                onClick={handleSaveProject}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold"
                            >
                                {editingProject ? 'Cập nhật dự án' : 'Lưu dự án'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {selectedProject && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 border rounded-xl p-4 bg-white shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Modules công việc</h3>
                            {/* Add module button here later */}
                        </div>
                        <div className="space-y-2">
                            {selectedProject.modules.map((m, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span className="font-medium text-slate-700">{m.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800">Danh sách Backlog</h3>
                            <button
                                onClick={() => { setEditingFeature(null); setNewFeature({ title: '', moduleName: '', description: '', acceptanceCriteria: '', priority: 'MEDIUM' }); setIsAddingFeature(true); }}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                            >
                                + Thêm Feature
                            </button>
                        </div>

                        {isAddingFeature && (
                            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-green-100 animate-in fade-in slide-in-from-top-4 duration-200">
                                <form onSubmit={handleCreateFeature} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        {selectedProject.modules.map((m, idx) => <option key={idx} value={m.name}>{m.name}</option>)}
                                    </select>
                                    <textarea
                                        className="md:col-span-2 px-4 py-2 border rounded-lg"
                                        placeholder="Mô tả yêu cầu khách hàng..."
                                        value={newFeature.description}
                                        onChange={e => setNewFeature({ ...newFeature, description: e.target.value })}
                                    />
                                    <textarea
                                        className="md:col-span-2 px-4 py-2 border rounded-lg"
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

                        <div className="space-y-3">
                            {features.map(f => (
                                <div key={f._id} className="bg-white p-4 rounded-xl shadow-sm border hover:border-blue-300 transition group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded uppercase tabular-nums">
                                                {f.moduleName}
                                            </span>
                                            <h4 className="font-bold text-slate-800 text-lg">{f.title}</h4>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${f.priority === 'HIGH' || f.priority === 'URGENT' ? 'bg-red-100 text-red-600' :
                                            f.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                                            }`}>
                                            {f.priority}
                                        </span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition ml-2">
                                            <button onClick={() => handleEditFeature(f)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                                <span className="material-icons text-sm">edit</span>
                                            </button>
                                            <button onClick={() => handleDeleteFeature(f._id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                                <span className="material-icons text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-slate-600 text-sm line-clamp-2 mb-3">{f.description}</p>
                                    <div className="flex justify-between items-center text-xs text-slate-400 border-t pt-3">
                                        <div className="flex gap-4">
                                            <span>Tiêu chí: {f.acceptanceCriteria ? '✅ Đã có' : '⏳ Chưa có'}</span>
                                            <span>Ghi chú: {f.notes.length}</span>
                                        </div>
                                        <button
                                            onClick={() => handleViewFeatureDetail(f)}
                                            className="text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition"
                                        >
                                            Chi tiết →
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {features.length === 0 && !isAddingFeature && (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 font-medium">Chưa có tính năng nào trong Backlog dự án hiện tại.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {viewingFeature && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">Chi tiết Backlog: {viewingFeature.title}</h2>
                            <button onClick={() => setViewingFeature(null)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg text-slate-700 border-b pb-2">Mô tả Yêu cầu</h3>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewingFeature.description || 'Chưa có mô tả'}</p>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg text-slate-700 border-b pb-2">Tiêu chí Nghiệm thu (Acceptance Criteria)</h3>
                                <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewingFeature.acceptanceCriteria || 'Chưa có tiêu chí'}</p>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg text-slate-700 border-b pb-2">Các Ghi chú đính kèm ({featureNotes.length})</h3>
                                {featureNotes.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">Chưa có ghi chú nào được đính kèm ở tính năng này.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {featureNotes.map(n => (
                                            <div key={n._id} className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl">
                                                <div className="flex justify-between mb-2 border-b border-indigo-100 pb-2">
                                                    <span className="font-bold text-indigo-700 text-sm">{n.title}</span>
                                                    <span className="text-[10px] text-slate-500 uppercase">{new Date(n.createdAt).toLocaleDateString('vi-VN')}</span>
                                                </div>
                                                <div className="text-sm text-slate-700 whitespace-pre-wrap italic w-full">
                                                    {n.content}
                                                </div>
                                                <div className="flex justify-end mt-2 pt-2 border-t border-indigo-100">
                                                    <span className="text-[10px] font-bold text-slate-400">Tạo bởi: {n.createdBy?.name || 'Không rõ'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Backlog;
