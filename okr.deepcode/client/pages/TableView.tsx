import React, { useState, useEffect } from 'react';
import { projectService, sprintService, taskAgileService, featureService } from '../services/projectService';

const TableView = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [features, setFeatures] = useState([]);
    const [sprints, setSprints] = useState([]);
    const [filter, setFilter] = useState({ status: '', sprintId: '', moduleName: '' });
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        if (selectedProject) {
            fetchData(selectedProject._id);
        }
    }, [selectedProject]);

    const fetchProjects = async () => {
        try {
            const data = await projectService.getProjects();
            setProjects(data);
            if (data.length > 0 && !selectedProject) setSelectedProject(data[0]);
        } catch (err) {
            console.error('Lỗi lấy dự án:', err);
        }
    };

    const fetchData = async (projectId) => {
        try {
            const [fData, sData] = await Promise.all([
                featureService.getFeaturesByProject(projectId),
                sprintService.getSprintsByProject(projectId)
            ]);
            setFeatures(fData);
            setSprints(sData);

            // Lấy tất cả task của các sprint thuộc dự án này
            const allTasks = [];
            for (const sprint of sData) {
                const sTasks = await taskAgileService.getTasksBySprint(sprint._id);
                allTasks.push(...sTasks);
            }
            setTasks(allTasks);
        } catch (err) {
            console.error('Lỗi lấy dữ liệu:', err);
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTasks = [...tasks].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredTasks = sortedTasks.filter(t => {
        const feature = features.find(f => f._id === t.featureId);
        return (
            (filter.status === '' || t.status === filter.status) &&
            (filter.sprintId === '' || t.sprintId === filter.sprintId) &&
            (filter.moduleName === '' || feature?.moduleName === filter.moduleName)
        );
    });

    const exportToCSV = () => {
        const headers = ["Task", "Module", "Sprint", "Assignee", "Status", "Estimate (h)", "Actual (h)"];
        const rows = filteredTasks.map(t => {
            const feature = features.find(f => f._id === t.featureId);
            const sprint = sprints.find(s => s._id === t.sprintId);
            return [
                t.title,
                feature?.moduleName || '',
                sprint?.name || '',
                t.assigneeName || '',
                t.status,
                t.estimateTime,
                t.logTime
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers, ...rows].map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `project_tasks_${selectedProject?.title}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    return (
        <div className="p-6 max-w-full mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Table View</h1>
                    <p className="text-slate-500">Quản lý nâng cao dạng bảng (Excel-style)</p>
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
                    <button
                        onClick={exportToCSV}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition flex items-center gap-2"
                    >
                        <span className="material-icons text-sm">download</span>
                        Xuất Excel (CSV)
                    </button>
                </div>
            </div>

            {selectedProject && selectedProject.description && (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-icons text-indigo-500 text-sm">info</span>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mô tả dự án</p>
                    </div>
                    <p className="text-sm text-slate-600 italic ml-6">{selectedProject.description}</p>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Trạng thái</label>
                    <select
                        className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                        value={filter.status}
                        onChange={e => setFilter({ ...filter, status: e.target.value })}
                        style={{ color: !filter.status ? '#9ca3af' : '' }}
                    >
                        <option value="" style={{ color: '#9ca3af', fontStyle: 'italic' }}>— Tất cả trạng thái —</option>
                        <option value="TODO" style={{ color: '#1e293b' }}>To Do</option>
                        <option value="IN_PROGRESS" style={{ color: '#1e293b' }}>In Progress</option>
                        <option value="REVIEW" style={{ color: '#1e293b' }}>Review</option>
                        <option value="DONE" style={{ color: '#1e293b' }}>Done</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sprint</label>
                    <select
                        className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                        value={filter.sprintId}
                        onChange={e => setFilter({ ...filter, sprintId: e.target.value })}
                        style={{ color: !filter.sprintId ? '#9ca3af' : '' }}
                    >
                        <option value="" style={{ color: '#9ca3af', fontStyle: 'italic' }}>— Tất cả Sprint —</option>
                        {sprints.map(s => <option key={s._id} value={s._id} style={{ color: '#1e293b' }}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Module</label>
                    <select
                        className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm"
                        value={filter.moduleName}
                        onChange={e => setFilter({ ...filter, moduleName: e.target.value })}
                        style={{ color: !filter.moduleName ? '#9ca3af' : '' }}
                    >
                        <option value="" style={{ color: '#9ca3af', fontStyle: 'italic' }}>— Tất cả Module —</option>
                        {selectedProject?.modules.map((m, idx) => <option key={idx} value={m.name} style={{ color: '#1e293b' }}>{m.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b">
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100" onClick={() => handleSort('title')}>Task</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Module</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Sprint</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Assignee</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>Status</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100" onClick={() => handleSort('estimateTime')}>Estimate</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100" onClick={() => handleSort('logTime')}>Actual</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">%</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredTasks.map(t => {
                                const feature = features.find(f => f._id === t.featureId);
                                const sprint = sprints.find(s => s._id === t.sprintId);
                                const progress = t.estimateTime > 0 ? Math.round((t.logTime / t.estimateTime) * 100) : 0;

                                return (
                                    <tr key={t._id} className="hover:bg-slate-50 transition group">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{t.title}</div>
                                            <div className="text-[10px] text-slate-400">ID: {t._id.slice(-6).toUpperCase()}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                                                {feature?.moduleName || 'NONE'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">{sprint?.name || '-'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 uppercase">
                                                    {t.assigneeName ? t.assigneeName.charAt(0) : '?'}
                                                </div>
                                                <span className="text-sm font-medium">{t.assigneeName || 'Unassigned'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${t.status === 'DONE' ? 'bg-green-100 text-green-700' :
                                                t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                    t.status === 'REVIEW' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm font-mono">{t.estimateTime}h</td>
                                        <td className="p-4 text-sm font-mono">{t.logTime}h</td>
                                        <td className="p-4 w-32">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${progress >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 w-8">{progress}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredTasks.length === 0 && (
                    <div className="p-12 text-center text-slate-400 font-medium">
                        Không tìm thấy dữ liệu phù hợp với bộ lọc.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TableView;
