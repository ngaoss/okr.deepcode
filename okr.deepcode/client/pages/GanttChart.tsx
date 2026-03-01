import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { projectService, sprintService, taskAgileService, featureService } from '../services/projectService';

// Native Date Helpers
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const startOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
};

const endOfWeek = (date) => {
    const d = startOfWeek(date);
    return addDays(d, 6);
};

const formatDate = (date, pattern) => {
    const d = new Date(date);
    if (pattern === 'dd/MM') return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    if (pattern === 'MM/yyyy') return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    if (pattern === 'EEE') return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
    if (pattern === 'dd') return d.getDate().toString().padStart(2, '0');
    if (pattern === 'yyyy-MM-dd') return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    return d.toLocaleDateString();
};

const GanttChart = () => {
    // --- State ---
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [treeData, setTreeData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedItems, setExpandedItems] = useState(new Set());
    const [zoomLevel, setZoomLevel] = useState('day'); // 'day', 'week', 'month'
    const [hoverItem, setHoverItem] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(null); // { id, startX, originalStartDate, originalEndDate }
    const [resizing, setResizing] = useState(null); // { id, startX, originalEndDate }
    const [viewMode, setViewMode] = useState('project'); // 'project' or 'resource'
    const [showCriticalPath, setShowCriticalPath] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null); // { task, newDates, newSprintId }
    const [dropTarget, setDropTarget] = useState(null); // sprintId

    // --- Constants ---
    const SIDEBAR_WIDTH = 380;
    const ROW_HEIGHT = 48;
    const ZOOM_CONFIG = {
        day: { width: 100, label: 'Ngày' },
        week: { width: 250, label: 'Tuần' },
        month: { width: 400, label: 'Tháng' },
        quarter: { width: 800, label: 'Quý' }
    };

    const containerRef = useRef(null);
    const headerRef = useRef(null);
    const sidebarRef = useRef(null);

    // --- Fetching ---
    const fetchProjects = useCallback(async () => {
        try {
            const data = await projectService.getProjects();
            setProjects(data || []);
            if (data && data.length > 0 && !selectedProject) {
                setSelectedProject(data[0]);
            }
        } catch (err) {
            console.error('Fetch projects error:', err);
            setError('Không thể tải danh sách dự án');
        }
    }, [selectedProject]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const buildHierarchy = useCallback(async (projectId) => {
        if (!projectId) return;
        setIsLoading(true);
        try {
            const [sprints, features] = await Promise.all([
                sprintService.getSprintsByProject(projectId).catch(() => []),
                featureService.getFeaturesByProject(projectId).catch(() => [])
            ]);

            const fullTree = [];
            for (const sprint of (sprints || [])) {
                const tasks = await taskAgileService.getTasksBySprint(sprint._id).catch(() => []);

                const sprintNode = {
                    ...sprint,
                    id: sprint._id,
                    type: 'SPRINT',
                    status: sprint.status === 'COMPLETED' ? 'DONE' : sprint.status === 'ACTIVE' ? 'IN_PROGRESS' : 'TODO',
                    progress: sprint.status === 'COMPLETED' ? 100 : sprint.status === 'ACTIVE' ? 50 : 0,
                    children: []
                };

                // Nhóm theo Feature (Module)
                const featureMap = new Map();
                tasks.forEach(task => {
                    const featId = task.featureId || 'orphaned';
                    if (!featureMap.has(featId)) {
                        const feat = features.find(f => f._id === featId) || { title: 'Tác vụ lẻ', _id: 'orphaned' };
                        featureMap.set(featId, {
                            ...feat,
                            id: feat._id,
                            type: 'FEATURE',
                            status: feat.status || 'TODO',
                            progress: feat.progress || 0,
                            children: [],
                            tasks: []
                        });
                    }
                    featureMap.get(featId).children.push({ ...task, id: task._id, type: 'TASK' });
                });

                sprintNode.children = Array.from(featureMap.values());
                fullTree.push(sprintNode);
            }

            const collectExpandableIds = (nodes, acc = new Set()) => {
                nodes.forEach(node => {
                    if (node.children && node.children.length > 0) {
                        acc.add(node.id);
                        collectExpandableIds(node.children, acc);
                    }
                });
                return acc;
            };

            const allExpandableIds = collectExpandableIds(fullTree);
            setTreeData(fullTree);
            setExpandedItems(prev => {
                // First load opens all; next reloads preserve manual collapsed/expanded state.
                if (!prev || prev.size === 0) return allExpandableIds;
                const next = new Set();
                prev.forEach(id => {
                    if (allExpandableIds.has(id)) next.add(id);
                });
                return next;
            });

        } catch (err) {
            console.error('Build hierarchy error:', err);
            setError('Lỗi phân cấp dữ liệu');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedProject?._id) {
            buildHierarchy(selectedProject._id);
        }
    }, [selectedProject, buildHierarchy]);

    // --- Timeline Logic ---
    const { units, timeRange } = useMemo(() => {
        if (treeData.length === 0) return { units: [], timeRange: { start: new Date(), end: new Date() } };

        let start = null;
        let end = null;

        const checkDates = (items) => {
            items.forEach(item => {
                const s = item.startDate ? new Date(item.startDate) : null;
                const e = item.endDate ? new Date(item.endDate) : null;
                if (s && (!start || s < start)) start = s;
                if (e && (!end || e > end)) end = e;
                if (item.children) checkDates(item.children);
            });
        };
        checkDates(treeData);

        if (!start || !end) {
            start = startOfWeek(new Date());
            end = addDays(start, 30);
        } else {
            // Padding based on zoom
            const padding = zoomLevel === 'day' ? 7 : zoomLevel === 'week' ? 28 : 90;
            start = startOfWeek(addDays(start, -padding));
            end = endOfWeek(addDays(end, padding * 2));
        }

        const unitList = [];
        let curr = new Date(start);
        curr.setHours(0, 0, 0, 0);

        while (curr <= end) {
            unitList.push(new Date(curr));
            if (zoomLevel === 'day') curr = addDays(curr, 1);
            else if (zoomLevel === 'week') curr = addDays(curr, 7);
            else if (zoomLevel === 'month') {
                curr.setMonth(curr.getMonth() + 1);
                curr.setDate(1);
            }
            else if (zoomLevel === 'quarter') {
                curr.setMonth(curr.getMonth() + 3);
                curr.setDate(1);
            }
        }

        return { units: unitList, timeRange: { start, end: unitList[unitList.length - 1] } };
    }, [treeData, zoomLevel]);

    const getContinuousUnitOffset = (date) => {
        const d = new Date(date);
        const start = timeRange.start;

        if (zoomLevel === 'day') {
            return (d.getTime() - start.getTime()) / 86400000;
        }
        if (zoomLevel === 'week') {
            return (d.getTime() - start.getTime()) / (86400000 * 7);
        }
        if (zoomLevel === 'month') {
            const months = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
            const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            return months + (d.getDate() - 1) / daysInMonth; // 1st = 0 offset
        }
        if (zoomLevel === 'quarter') {
            const months = (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
            const quarters = Math.floor(months / 3);

            const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
            const quarterStart = new Date(d.getFullYear(), quarterStartMonth, 1);
            const nextQuarterMonth = quarterStartMonth + 3;
            const nextQuarterStart = new Date(d.getFullYear(), nextQuarterMonth, 1);

            const daysInQuarter = (nextQuarterStart.getTime() - quarterStart.getTime()) / 86400000;
            const daysIntoQuarter = (d.getTime() - quarterStart.getTime()) / 86400000;

            return quarters + (daysIntoQuarter / daysInQuarter);
        }
        return 0;
    };

    const getXPosition = (date) => {
        if (!date) return 0;
        const offsetUnits = getContinuousUnitOffset(date);
        return offsetUnits * ZOOM_CONFIG[zoomLevel].width;
    };

    const getBarWidth = (start, end) => {
        if (!start || !end) return 0;
        const startOffset = getContinuousUnitOffset(start);

        const e = new Date(end);
        e.setDate(e.getDate() + 1); // Inclusive
        const endOffset = getContinuousUnitOffset(e);

        let diff = endOffset - startOffset;
        if (zoomLevel === 'day' && diff < 1) diff = 1;
        if (zoomLevel === 'week' && diff < 1 / 7) diff = 1 / 7;
        if (zoomLevel === 'month' && diff < 1 / 31) diff = 1 / 31;
        if (zoomLevel === 'quarter' && diff < 1 / 92) diff = 1 / 92;

        return diff * ZOOM_CONFIG[zoomLevel].width;
    };

    const getTodayOffset = () => {
        const today = new Date();
        return getXPosition(today);
    };

    const toggleExpand = (id) => {
        const next = new Set(expandedItems);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedItems(next);
    };

    // --- Render Helpers ---
    const getStatusColor = (status, type, priority, endDate) => {
        if (type === 'SPRINT') return 'bg-orange-500 border-orange-600';

        const today = new Date();
        const deadline = new Date(endDate);
        const diffDays = endDate ? Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : NaN;

        // Logic cảnh báo Deadline (Màu Đỏ)
        if (status === 'TODO' && diffDays <= 14 && diffDays >= 0) return 'bg-rose-500 border-rose-600 animate-pulse';
        if (status === 'IN_PROGRESS' && diffDays <= 10 && diffDays >= 0) return 'bg-rose-500 border-rose-600 animate-pulse';
        if (status === 'REVIEW' && diffDays <= 7 && diffDays >= 0) return 'bg-rose-500 border-rose-600 animate-pulse';
        if (diffDays < 0 && status !== 'DONE') return 'bg-rose-600 border-rose-700 ring-2 ring-rose-500/50';

        // Màu theo trạng thái nghiệp vụ
        if (status === 'DONE') return 'bg-emerald-500 border-emerald-600';
        if (status === 'REVIEW') return 'bg-amber-400 border-amber-500';
        if (status === 'IN_PROGRESS') return 'bg-sky-500 border-sky-600';

        return 'bg-slate-400 border-slate-500'; // TODO (Mặc định xám)
    };

    const getStatusIcon = (type, taskType) => {
        if (type === 'SPRINT') return 'sprint';
        if (type === 'FEATURE') return 'extension';
        if (taskType === 'BUG') return 'bug_report';
        if (taskType === 'MEETING') return 'groups';
        if (taskType === 'MILESTONE') return 'flag';
        return 'task_alt';
    };

    const flattenTree = (items, level = 0, result = []) => {
        items.forEach(item => {
            result.push({ ...item, level });
            if (expandedItems.has(item.id) && item.children) {
                flattenTree(item.children, level + 1, result);
            }
        });
        return result;
    };

    const visibleRows = useMemo(() => {
        if (viewMode === 'resource') {
            const userGroups = {};
            const allTasks = [];
            const collectTasks = (nodes) => {
                nodes.forEach(node => {
                    if (node.type === 'TASK') allTasks.push(node);
                    if (node.children) collectTasks(node.children);
                });
            };
            collectTasks(treeData);
            allTasks.forEach(task => {
                const user = task.assigneeName || 'Unassigned';
                if (!userGroups[user]) userGroups[user] = { id: `user-${user}`, name: user, type: 'RESOURCE', children: [] };
                userGroups[user].children.push(task);
            });
            return flattenTree(Object.values(userGroups));
        }
        return flattenTree(treeData);
    }, [treeData, expandedItems, viewMode]);

    // --- Critical Path Logic ---
    const criticalPathIds = useMemo(() => {
        if (!showCriticalPath) return new Set();
        let lastTask = null;
        let maxDate = new Date(0);
        visibleRows.forEach(row => {
            if (row.type === 'TASK') {
                const date = new Date(row.endDate);
                if (date > maxDate) {
                    maxDate = date;
                    lastTask = row;
                }
            }
        });
        if (!lastTask) return new Set();
        const path = new Set();
        const findPredecessors = (taskId) => {
            path.add(taskId);
            const task = visibleRows.find(r => r.id === taskId);
            if (task && task.dependencies) {
                task.dependencies.forEach(depId => findPredecessors(depId));
            }
        };
        findPredecessors(lastTask.id);
        return path;
    }, [visibleRows, showCriticalPath]);

    // --- Dependency Logic ---
    const dependencyLines = useMemo(() => {
        const lines = [];
        const taskMap = new Map();

        // Tạo map để tra cứu nhanh vị trí hàng của từng task
        visibleRows.forEach((row, index) => {
            if (row.type === 'TASK') {
                taskMap.set(row.id, { ...row, rowIndex: index });
            }
        });

        visibleRows.forEach((successor, sIdx) => {
            if (successor.type === 'TASK' && successor.dependencies) {
                successor.dependencies.forEach(preId => {
                    const predecessor = taskMap.get(preId);
                    if (predecessor) {
                        const startX = getXPosition(predecessor.startDate);
                        const startY = (predecessor.rowIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                        const endX = getXPosition(successor.startDate);
                        const endY = (sIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);

                        // Kiểm tra xung đột (Task sau bắt đầu trước khi task trước xong)
                        const pivotX = Math.min(startX, endX) - 24;

                        lines.push({ startX, startY, endX, endY, pivotX });
                    }
                });
            }
        });
        return lines;
    }, [visibleRows, zoomLevel, timeRange]);

    // --- Sync scrolling ---
    const handleScroll = (e) => {
        if (headerRef.current) headerRef.current.scrollLeft = e.target.scrollLeft;
        if (sidebarRef.current) sidebarRef.current.scrollTop = e.target.scrollTop;
    };

    const handleDragStart = (e, row) => {
        if (row.type !== 'TASK' && row.type !== 'SPRINT') return;
        e.stopPropagation();
        setDragging({
            id: row.id,
            startX: e.clientX,
            originalStartDate: new Date(row.startDate),
            originalEndDate: new Date(row.endDate)
        });
    };

    const handleResizeStart = (e, row) => {
        if (row.type !== 'TASK' && row.type !== 'SPRINT') return;
        e.stopPropagation();
        setResizing({
            id: row.id,
            startX: e.clientX,
            originalEndDate: new Date(row.endDate)
        });
    };

    const handleMouseMove = useCallback((e) => {
        if (dragging) {
            const dx = e.clientX - dragging.startX;
            const daysPerUnit = zoomLevel === 'day' ? 1 : zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 90;
            const daysMoved = Math.round((dx / ZOOM_CONFIG[zoomLevel].width) * daysPerUnit);

            if (daysMoved !== 0) {
                const newStart = addDays(dragging.originalStartDate, daysMoved);
                const newEnd = addDays(dragging.originalEndDate, daysMoved);

                setTreeData(prev => {
                    const updateNode = (nodes) => nodes.map(node => {
                        if (node.id === dragging.id) {
                            return { ...node, startDate: formatDate(newStart, 'yyyy-MM-dd'), endDate: formatDate(newEnd, 'yyyy-MM-dd') };
                        }
                        if (node.children) return { ...node, children: updateNode(node.children) };
                        return node;
                    });
                    return updateNode(prev);
                });
            }
        } else if (resizing) {
            const dx = e.clientX - resizing.startX;
            const daysPerUnit = zoomLevel === 'day' ? 1 : zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 90;
            const daysAdded = Math.round((dx / ZOOM_CONFIG[zoomLevel].width) * daysPerUnit);

            if (daysAdded !== 0) {
                const newEnd = addDays(resizing.originalEndDate, daysAdded);

                setTreeData(prev => {
                    const updateNode = (nodes) => nodes.map(node => {
                        if (node.id === resizing.id) {
                            return { ...node, endDate: formatDate(newEnd, 'yyyy-MM-dd') };
                        }
                        if (node.children) return { ...node, children: updateNode(node.children) };
                        return node;
                    });
                    return updateNode(prev);
                });
            }
        }

        // Logic detect drop target for cross-sprint
        if (dragging) {
            const y = e.clientY;
            const sidebarElements = document.querySelectorAll('[data-sprint-id]');
            let found = null;
            sidebarElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (y >= rect.top && y <= rect.bottom) {
                    found = el.getAttribute('data-sprint-id');
                }
            });
            setDropTarget(found);
        }
    }, [dragging, resizing, zoomLevel]);

    const handleMouseUp = useCallback(async () => {
        if (!dragging && !resizing) return;

        const targetId = dragging?.id || resizing?.id;
        const task = visibleRows.find(r => r.id === targetId);

        if (task) {
            setConfirmModal({
                task,
                newDates: { startDate: task.startDate, endDate: task.endDate },
                newSprintId: dropTarget
            });
        }

        setDragging(null);
        setResizing(null);
        setDropTarget(null);
    }, [dragging, resizing, visibleRows, dropTarget]);

    const confirmUpdate = async () => {
        if (!confirmModal) return;
        const { task, newDates, newSprintId } = confirmModal;
        try {
            if (task.type === 'SPRINT') {
                await sprintService.updateSprint(task.id, newDates);
            } else {
                await taskAgileService.updateTask(task.id, {
                    ...newDates,
                    sprintId: newSprintId || task.sprintId
                });
            }
            if (!newSprintId || newSprintId !== task.sprintId || task.type === 'SPRINT') {
                buildHierarchy(selectedProject._id);
            }
        } catch (err) {
            console.error('Update error:', err);
            buildHierarchy(selectedProject._id);
        }
        setConfirmModal(null);
    };

    const cancelUpdate = () => {
        setConfirmModal(null);
        buildHierarchy(selectedProject._id); // Refresh to revert UI state
    };

    useEffect(() => {
        if (dragging || resizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, resizing, handleMouseMove, handleMouseUp]);

    // Auto-scroll to Today Line
    useEffect(() => {
        if (!isLoading && containerRef.current && treeData.length > 0) {
            setTimeout(() => {
                if (containerRef.current) {
                    const todayOffset = getTodayOffset();
                    const containerWidth = containerRef.current.clientWidth || 800;
                    if (todayOffset > 0) {
                        containerRef.current.scrollLeft = Math.max(0, todayOffset - containerWidth / 2);
                    }
                }
            }, 300); // Wait for render
        }
    }, [isLoading, zoomLevel, treeData.length, selectedProject]);

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-['Inter'] overflow-hidden">
            {/* --- Premium Top Header --- */}
            <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                        <span className="material-icons text-white">analytics</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">Hệ thống Quản trị OKR & PRO</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biểu đồ Gantt Nghiệp vụ v5.0</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        className="bg-slate-100 border-none rounded-xl px-4 py-2.5 font-bold text-sm text-slate-700 outline-none focus:ring-2 ring-indigo-500/20"
                        value={selectedProject?._id || ''}
                        onChange={(e) => setSelectedProject(projects.find(p => p._id === e.target.value))}
                    >
                        {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                    </select>

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('project')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${viewMode === 'project' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}
                        >
                            Dự án
                        </button>
                        <button
                            onClick={() => setViewMode('resource')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${viewMode === 'resource' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}
                        >
                            Nhân sự
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-200"></div>

                    <button
                        onClick={() => setShowCriticalPath(!showCriticalPath)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showCriticalPath ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-200 shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        <span className="material-icons text-sm">{showCriticalPath ? 'insights' : 'show_chart'}</span>
                        {showCriticalPath ? 'Ẩn Đường Găng' : 'Hiện Đường Găng'}
                    </button>

                    <div className="h-8 w-px bg-slate-200"></div>

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['day', 'week', 'month', 'quarter'].map(z => (
                            <button
                                key={z}
                                onClick={() => setZoomLevel(z)}
                                className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${zoomLevel === z ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {ZOOM_CONFIG[z].label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* --- 1. Sidebar (Task Tree) --- */}
                <div className="flex flex-col border-r border-slate-200 bg-white z-40 shadow-[4px_0_24px_rgba(0,0,0,0.02)]" style={{ width: SIDEBAR_WIDTH }}>
                    <div className="h-16 border-b border-slate-100 flex items-center px-6 bg-slate-50/50">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Cấu trúc công việc</span>
                    </div>
                    <div
                        ref={sidebarRef}
                        className="flex-1 overflow-hidden"
                    >
                        {visibleRows.map((row) => (
                            <div
                                key={row.id}
                                className={`flex items-center px-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer group ${dropTarget === row.id ? 'bg-indigo-50 ring-2 ring-indigo-500 ring-inset' : ''}`}
                                style={{ height: ROW_HEIGHT }}
                                onClick={() => row.children && toggleExpand(row.id)}
                                data-sprint-id={row.type === 'SPRINT' ? row.id : null}
                            >
                                <div style={{ width: row.level * 20 }} />
                                <div className="w-6 h-6 flex items-center justify-center mr-1">
                                    {row.children && row.children.length > 0 && (
                                        <span className={`material-icons text-lg text-slate-400 transition-transform ${expandedItems.has(row.id) ? 'rotate-90' : ''}`}>
                                            chevron_right
                                        </span>
                                    )}
                                </div>
                                <span className={`material-icons text-lg mr-2 ${row.type === 'RESOURCE' ? 'text-indigo-500' :
                                    row.type === 'SPRINT' ? 'text-indigo-600' :
                                        row.type === 'FEATURE' ? 'text-amber-500' :
                                            'text-blue-500'
                                    }`}>
                                    {row.type === 'RESOURCE' ? 'account_circle' : getStatusIcon(row.type, row.taskType)}
                                </span>
                                <div className="flex flex-col min-w-0">
                                    <span className={`text-sm truncate ${row.type === 'SPRINT' ? 'font-black text-slate-800' : row.type === 'FEATURE' ? 'font-bold text-slate-700' : 'text-slate-600 font-medium'}`}>
                                        {row.name || row.title}
                                    </span>
                                    {row.type === 'TASK' && (
                                        <span className="text-[10px] text-slate-400 font-bold truncate">@{row.assigneeName || 'Chưa gán'}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- 2. Timeline Area --- */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {/* Header Axis */}
                    <div
                        ref={headerRef}
                        className="h-16 border-b border-slate-200 overflow-hidden bg-slate-50/80 backdrop-blur flex"
                    >
                        <div className="relative h-full flex min-w-max">
                            {units.map((unit, idx) => {
                                const isToday = zoomLevel === 'day' && formatDate(unit, 'yyyy-MM-dd') === formatDate(new Date(), 'yyyy-MM-dd');

                                let labelTitle = '';
                                let labelSubtitle = '';

                                if (zoomLevel === 'day') {
                                    labelTitle = formatDate(unit, 'EEE');
                                    labelSubtitle = formatDate(unit, 'dd');
                                } else if (zoomLevel === 'week') {
                                    const weekNum = Math.ceil((unit.getDate() + new Date(unit.getFullYear(), unit.getMonth(), 1).getDay()) / 7);
                                    labelTitle = `Tuần ${weekNum}`;
                                    labelSubtitle = formatDate(unit, 'MM/yyyy');
                                } else if (zoomLevel === 'month') {
                                    labelTitle = `Tháng ${unit.getMonth() + 1}`;
                                    labelSubtitle = unit.getFullYear();
                                } else if (zoomLevel === 'quarter') {
                                    const q = Math.floor(unit.getMonth() / 3) + 1;
                                    labelTitle = `Quý ${q}`;
                                    labelSubtitle = unit.getFullYear();
                                }

                                return (
                                    <div
                                        key={idx}
                                        className={`flex flex-col items-center justify-center border-r border-slate-100/50 shrink-0 ${isToday ? 'bg-indigo-50/50' : ''}`}
                                        style={{ width: ZOOM_CONFIG[zoomLevel].width }}
                                    >
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                            {labelTitle}
                                        </span>
                                        <span className={`text-sm font-black mt-0.5 ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>
                                            {labelSubtitle}
                                        </span>
                                        {(zoomLevel === 'day' && unit.getDate() === 1) && (
                                            <div className="absolute top-0 px-2 py-0.5 bg-slate-800 text-white text-[8px] font-black rounded-b uppercase">
                                                {formatDate(unit, 'MM/yyyy')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Body Content */}
                    <div
                        ref={containerRef}
                        className="flex-1 overflow-auto bg-slate-50/20 custom-scrollbar relative"
                        onScroll={handleScroll}
                    >
                        {/* Grid Background */}
                        <div className="absolute top-0 left-0 bottom-0 flex pointer-events-none min-w-max">
                            {units.map((unit, idx) => (
                                <div
                                    key={idx}
                                    className={`h-full border-r border-slate-100/60 ${(zoomLevel === 'day' && (unit.getDay() === 0 || unit.getDay() === 6)) ? 'bg-slate-100/30' : ''}`}
                                    style={{ width: ZOOM_CONFIG[zoomLevel].width }}
                                />
                            ))}
                        </div>

                        {/* Today Line */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                            style={{ left: getTodayOffset() }}
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-rose-500 text-[8px] font-black text-white px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap">HÔM NAY</div>
                        </div>

                        {/* Task Bars Area */}
                        <div className="relative min-w-max">
                            {/* SVG Layer for Dependencies */}
                            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-20" style={{ minWidth: units.length * ZOOM_CONFIG[zoomLevel].width }}>
                                <defs>
                                    <marker id="arrowhead-black" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                        <polygon points="0 0, 10 3.5, 0 7" fill="#111827" />
                                    </marker>
                                </defs>
                                {dependencyLines.map((line, i) => {
                                    const path = `M ${line.startX} ${line.startY} L ${line.pivotX} ${line.startY} L ${line.pivotX} ${line.endY} L ${line.endX} ${line.endY}`;
                                    return (
                                        <path
                                            key={i}
                                            d={path}
                                            stroke="#111827"
                                            strokeWidth="1.5"
                                            fill="none"
                                            markerEnd="url(#arrowhead-black)"
                                            style={{ transition: 'all 0.3s' }}
                                        />
                                    );
                                })}
                            </svg>

                            {visibleRows.map((row) => (
                                <div
                                    key={row.id}
                                    className="relative flex items-center border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                                    style={{ height: ROW_HEIGHT }}
                                >
                                    {/* Baseline Bar (Optional) */}
                                    {row.type === 'TASK' && row.baselineStartDate && (
                                        <div
                                            className="absolute h-1.5 bottom-1 rounded-full bg-slate-200 border border-slate-300 opacity-50 z-0"
                                            style={{
                                                left: getXPosition(row.baselineStartDate),
                                                width: getBarWidth(row.baselineStartDate, row.baselineEndDate)
                                            }}
                                            title="Baseline (Initial Plan)"
                                        />
                                    )}

                                    {/* Main Bar */}
                                    <div
                                        className={`absolute top-2 bottom-4 rounded-xl transition-all shadow-sm border border-white/40 group-hover:shadow-md cursor-pointer overflow-hidden ${getStatusColor(row.status, row.type, row.priority, row.endDate)
                                            } ${dragging?.id === row.id || resizing?.id === row.id ? 'opacity-70 scale-[1.02] ring-4 ring-indigo-500/30' : ''} ${criticalPathIds.has(row.id) ? 'ring-2 ring-rose-500 ring-offset-2' : ''
                                            }`}
                                        onMouseDown={(e) => handleDragStart(e, row)}
                                        onMouseMove={(e) => {
                                            if (!dragging && !resizing) {
                                                setTooltipPos({ x: e.clientX, y: e.clientY - 15 });
                                            }
                                        }}
                                        onMouseEnter={(e) => {
                                            setHoverItem(row);
                                            setTooltipPos({ x: e.clientX, y: e.clientY - 15 });
                                        }}
                                        onMouseLeave={() => setHoverItem(null)}
                                        style={{
                                            left: getXPosition(row.startDate),
                                            width: getBarWidth(row.startDate, row.endDate),
                                            zIndex: row.type === 'SPRINT' ? 5 : 10
                                        }}
                                    >
                                        {/* Progress Fill (Actual) */}
                                        {row.type === 'TASK' && (
                                            <div
                                                className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-700"
                                                style={{ width: `${row.progress || 0}%` }}
                                            />
                                        )}

                                        <div className="absolute inset-0 px-3 flex items-center overflow-hidden">
                                            <span className={`text-[11px] font-black truncate ${(row.type === 'TASK' && row.status !== 'TODO') || row.type === 'SPRINT' ? 'text-white' : 'text-slate-700'
                                                } ${row.type === 'SPRINT' ? 'text-amber-900' : ''}`}>
                                                {row.title || row.name || row.goal}
                                            </span>
                                        </div>

                                        {/* Resize Handle */}
                                        {(row.type === 'TASK' || row.type === 'SPRINT') && (
                                            <div
                                                className="absolute top-0 right-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize flex items-center justify-center group/resize"
                                                onMouseDown={(e) => handleResizeStart(e, row)}
                                            >
                                                <div className="w-0.5 h-4 bg-white/30 rounded-full group-hover/resize:bg-white/60" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Premium Legend --- */}
            <footer className="h-14 bg-white border-t border-slate-200 px-8 flex items-center justify-between shrink-0 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="flex gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-slate-400 rounded-sm" />
                        <span>Cần làm (Xám)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-sky-500 rounded-sm" />
                        <span>Đang làm (Blue)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-400 rounded-sm" />
                        <span>Demo (Vàng)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                        <span>Xong việc (Xanh lá)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-rose-500 rounded-sm" />
                        <span>Cảnh báo Deadline (Đỏ)</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-slate-800 text-white rounded uppercase tracking-tighter">v3.0 Static Engine</span>
                </div>
            </footer>

            {/* --- Smart Tooltip --- */}
            {hoverItem && (
                <div
                    className="fixed z-[100] pointer-events-none bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-white/10 backdrop-blur-md transition-all duration-200 animate-in fade-in zoom-in-95"
                    style={{
                        left: tooltipPos.x,
                        top: tooltipPos.y,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <div className="flex flex-col gap-2 min-w-[200px]">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                            <span className="material-icons text-sm text-indigo-400">{getStatusIcon(hoverItem.type, hoverItem.taskType)}</span>
                            <span className="text-xs font-black uppercase tracking-widest">
                                {hoverItem.status === 'TODO' ? 'Cần làm' :
                                    hoverItem.status === 'IN_PROGRESS' ? 'Đang hoàn thiện' :
                                        hoverItem.status === 'REVIEW' ? 'Demo dự án' : 'Xong việc'}
                            </span>
                        </div>
                        <h4 className="text-sm font-bold leading-tight">{hoverItem.title || hoverItem.name}</h4>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase">Hạn chót</p>
                                <p className="text-[10px] font-bold text-rose-400">{formatDate(hoverItem.endDate, 'dd/MM/yyyy')}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase">Thực hiện</p>
                                <p className="text-[10px] font-bold text-sky-400 truncate">@{hoverItem.assigneeName || 'Chưa gán'}</p>
                            </div>
                        </div>
                        {hoverItem.type === 'TASK' && (
                            <div className="mt-1 flex flex-col gap-2">
                                <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex justify-between">
                                        Tiến độ ({hoverItem.progress || 0}%)
                                        <span className="text-indigo-400 italic">🔥 {hoverItem.logTime || 0}h logged</span>
                                    </p>
                                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" style={{ width: `${hoverItem.progress || 0}%` }} />
                                    </div>
                                </div>
                                <p className="text-[9px] text-slate-300 italic line-clamp-2">"{hoverItem.description || 'Không có mô tả'}"</p>
                            </div>
                        )}
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900" />
                </div>
            )}

            {/* --- Confirmation Modal --- */}
            {confirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                            <span className="material-icons text-indigo-600 text-3xl">help_outline</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Xác nhận thay đổi?</h3>
                        <p className="text-slate-500 text-sm leading-relaxed mb-8">
                            Bạn vừa thay đổi thời gian hoặc di chuyển task <span className="font-bold text-slate-800">"{confirmModal.task.title}"</span>.
                            {confirmModal.newSprintId && confirmModal.newSprintId !== confirmModal.task.sprintId && (
                                <span className="block mt-2 p-2 bg-amber-50 rounded-lg text-amber-700 text-xs font-bold border border-amber-100">
                                    ⚠️ Task sẽ được chuyển sang Sprint mới!
                                </span>
                            )}
                        </p>

                        <div className="grid grid-cols-2 gap-3 pb-8 border-b border-slate-100 mb-8">
                            <div className="bg-slate-50 p-3 rounded-2xl">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Bắt đầu mới</p>
                                <p className="text-sm font-bold text-slate-700">{formatDate(confirmModal.newDates.startDate, 'dd/MM/yyyy')}</p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Kết thúc mới</p>
                                <p className="text-sm font-bold text-slate-700">{formatDate(confirmModal.newDates.endDate, 'dd/MM/yyyy')}</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={cancelUpdate}
                                className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={confirmUpdate}
                                className="flex-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-[1.02]"
                            >
                                Lưu thay đổi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GanttChart;
