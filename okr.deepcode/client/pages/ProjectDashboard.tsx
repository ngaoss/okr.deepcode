import React, { useState, useEffect } from 'react';
import { projectService, sprintService, taskAgileService } from '../services/projectService';

const ProjectDashboard = () => {
    const [stats, setStats] = useState({
        totalProjects: 0,
        activeSprints: 0,
        pendingTasks: 0,
        completedTasks: 0
    });
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const projectsData = await projectService.getProjects();
                setProjects(projectsData);

                let activeS = 0;
                let pendingT = 0;
                let completedT = 0;

                for (const p of projectsData) {
                    const sprints = await sprintService.getSprintsByProject(p._id);
                    activeS += sprints.filter(s => s.status === 'ACTIVE').length;

                    for (const s of sprints) {
                        const tasks = await taskAgileService.getTasksBySprint(s._id);
                        pendingT += tasks.filter(t => t.status !== 'DONE').length;
                        completedT += tasks.filter(t => t.status === 'DONE').length;
                    }
                }

                setStats({
                    totalProjects: projectsData.length,
                    activeSprints: activeS,
                    pendingTasks: pendingT,
                    completedTasks: completedT
                });
            } catch (err) {
                console.error(err);
            }
        };
        fetchStats();
    }, []);

    const cards = [
        { title: 'Tổng Dự án', value: stats.totalProjects, icon: 'folder', color: 'text-blue-600', bg: 'bg-blue-50' },
        { title: 'Sprint Đang chạy', value: stats.activeSprints, icon: 'bolt', color: 'text-orange-600', bg: 'bg-orange-50' },
        { title: 'Công việc Chờ', value: stats.pendingTasks, icon: 'assignment_late', color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { title: 'Đã hoàn thành', value: stats.completedTasks, icon: 'task_alt', color: 'text-green-600', bg: 'bg-green-50' }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 text-['Inter']">
            <header>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Project Overview</h1>
                <p className="text-slate-500 font-medium">Chào mừng bạn trở lại! Đây là tóm tắt tiến độ các dự án Agile.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-2xl ${card.bg} ${card.color}`}>
                                <span className="material-icons text-2xl">{card.icon}</span>
                            </div>
                        </div>
                        <div className="text-4xl font-black text-slate-800 mb-1">{card.value}</div>
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">{card.title}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                        <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
                        Dự án Gần đây
                    </h2>
                    <div className="space-y-4">
                        {projects.slice(0, 5).map(p => (
                            <div key={p._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 font-black text-xl border border-slate-100">
                                        {p.title.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800">{p.title}</div>
                                        <div className="text-xs text-slate-500">{p.modules.length} Modules defined</div>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                    {p.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-indigo-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-800 rounded-full -mr-20 -mt-20 blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="relative z-10">
                        <h2 className="text-xl font-black text-white mb-2">Truy cập nhanh</h2>
                        <p className="text-indigo-200 text-sm mb-8">Bắt đầu quản lý công việc của bạn ngay bây giờ.</p>

                        <div className="grid grid-cols-2 gap-4">
                            <a href="#/backlog" className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all group/btn">
                                <span className="material-icons text-white mb-2 group-hover/btn:scale-110 transition-transform">inventory_2</span>
                                <div className="text-white font-bold text-sm">Backlog</div>
                            </a>
                            <a href="#/board" className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all group/btn">
                                <span className="material-icons text-white mb-2 group-hover/btn:scale-110 transition-transform">view_kanban</span>
                                <div className="text-white font-bold text-sm">Kanban Board</div>
                            </a>
                            <a href="#/sprints" className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all group/btn">
                                <span className="material-icons text-white mb-2 group-hover/btn:scale-110 transition-transform">bolt</span>
                                <div className="text-white font-bold text-sm">Sprints</div>
                            </a>
                            <a href="#/gantt" className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all group/btn">
                                <span className="material-icons text-white mb-2 group-hover/btn:scale-110 transition-transform">timeline</span>
                                <div className="text-white font-bold text-sm">Gantt Timeline</div>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectDashboard;
