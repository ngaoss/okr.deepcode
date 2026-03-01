import { apiRequest } from './apiClient';

export const projectService = {
    getProjects: (kanban?: boolean) => apiRequest(kanban ? '/projects?kanban=true' : '/projects'),
    getManagers: () => apiRequest('/projects/managers'),
    getLeaders: () => apiRequest('/projects/leaders'),
    createProject: (data: any) => apiRequest('/projects', { method: 'POST', body: JSON.stringify(data) }),
    updateProject: (id: string, data: any) => apiRequest(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProject: (id: string) => apiRequest(`/projects/${id}`, { method: 'DELETE' }),
    updateModules: (id: string, modules: any[]) => apiRequest(`/projects/${id}/modules`, { method: 'PATCH', body: JSON.stringify({ modules }) })
};

export const featureService = {
    getFeaturesByProject: (projectId: string) => apiRequest(`/features/project/${projectId}`),
    createFeature: (data: any) => apiRequest('/features', { method: 'POST', body: JSON.stringify(data) }),
    updateFeature: (id: string, data: any) => apiRequest(`/features/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFeature: (id: string) => apiRequest(`/features/${id}`, { method: 'DELETE' }),
    addNote: (id: string, note: any) => apiRequest(`/features/${id}/notes`, { method: 'POST', body: JSON.stringify(note) })
};

export const sprintService = {
    getSprintsByProject: (projectId: string) => apiRequest(`/sprints/project/${projectId}`),
    createSprint: (data: any) => apiRequest('/sprints', { method: 'POST', body: JSON.stringify(data) }),
    updateSprint: (id: string, data: any) => apiRequest(`/sprints/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSprint: (id: string) => apiRequest(`/sprints/${id}`, { method: 'DELETE' }),
    updateSprintStatus: (id: string, status: string, reviewNotes?: string) =>
        apiRequest(`/sprints/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reviewNotes }) }),
    addFeaturesToSprint: (sprintId: string, featureIds: string[]) =>
        apiRequest(`/sprints/${sprintId}/add-features`, { method: 'PATCH', body: JSON.stringify({ featureIds }) })
};

export const taskAgileService = {
    getTasksBySprint: (sprintId: string) => apiRequest(`/tasks-agile/sprint/${sprintId}`),
    createTask: (data: any) => apiRequest('/tasks-agile', { method: 'POST', body: JSON.stringify(data) }),
    updateTask: (id: string, data: any) => apiRequest(`/tasks-agile/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTask: (id: string) => apiRequest(`/tasks-agile/${id}`, { method: 'DELETE' }),
    logTime: (id: string, hours: number) => apiRequest(`/tasks-agile/${id}/log-time`, { method: 'POST', body: JSON.stringify({ hours }) })
};

export const noteAgileService = {
    getNotes: (targetType: string, targetId: string) => apiRequest(`/notes-agile/${targetType}/${targetId}`),
    createNote: (data: any) => apiRequest('/notes-agile', { method: 'POST', body: JSON.stringify(data) }),
    updateNote: (id: string, data: any) => apiRequest(`/notes-agile/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteNote: (id: string) => apiRequest(`/notes-agile/${id}`, { method: 'DELETE' })
};
