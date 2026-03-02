import { apiRequest } from './apiClient';

export const meetingService = {
    getMeetings: () => apiRequest('/meetings'),
    getMeeting: (id: string) => apiRequest(`/meetings/${id}`),
    createMeeting: (data: any) => apiRequest('/meetings', { method: 'POST', body: JSON.stringify(data) }),
    updateMeeting: (id: string, data: any) => apiRequest(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    closeMeeting: (id: string) => apiRequest(`/meetings/${id}/close`, { method: 'POST' }),
    reopenMeeting: (id: string) => apiRequest(`/meetings/${id}/reopen`, { method: 'POST' }),
    cloneMeeting: (id: string, options: any = {}) => apiRequest(`/meetings/${id}/clone`, { method: 'POST', body: JSON.stringify(options) }),
    convertRowToTask: (id: string, rowIdx: number) => apiRequest(`/meetings/${id}/rows/${rowIdx}/convert`, { method: 'POST' }),
    deleteMeeting: (id: string) => apiRequest(`/meetings/${id}`, { method: 'DELETE' })
};
