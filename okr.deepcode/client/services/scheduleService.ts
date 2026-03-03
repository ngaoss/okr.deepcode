
import { apiRequest } from './apiClient';

export interface WorkScheduleRecord {
    _id?: string;
    userId: string;
    userName: string;
    userRole?: string;
    department: string;
    dateKey: string;
    shift: 'FULL_DAY' | 'HALF_DAY' | 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'OFF' | 'UNEXCUSED_ABSENCE' | 'ONLINE';
    status: 'PENDING' | 'APPROVED' | 'WAITING' | 'COMPLETED' | 'REJECTED';
    rejectionReason?: string;
    note?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ScheduleSummary {
    userId: string;
    userName: string;
    userRole?: string;
    department: string;
    plannedDays: number;
    offDays: number;
    workDays: number;
    unexcusedAbsences: number;
    pendingDays: number;
}

export const scheduleService = {
    // Register or update schedules in bulk
    bulkUpdate: async (schedules: { dateKey: string; shift: string; note?: string; userId?: string }[], status?: string) => {
        const response = await apiRequest('/schedules/bulk', {
            method: 'POST',
            body: JSON.stringify({ schedules, status })
        });
        return (Array.isArray(response) ? response : []) as WorkScheduleRecord[];
    },

    updateStatus: async (data: { dateKeys: string[]; userId: string; status: string; rejectionReason?: string }) => {
        const response = await apiRequest('/schedules/status', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return response;
    },

    // Get my own schedules
    getMine: async (from?: string, to?: string) => {
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        const qs = params.toString();

        const response = await apiRequest(`/schedules/me${qs ? '?' + qs : ''}`);
        return (Array.isArray(response) ? response : []) as WorkScheduleRecord[];
    },

    // Admin: Get all schedules
    getAll: async (params: { from?: string; to?: string; department?: string; userId?: string }) => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryParams.append(key, value);
        });
        const qs = queryParams.toString();

        const response = await apiRequest(`/schedules${qs ? '?' + qs : ''}`);
        return (Array.isArray(response) ? response : []) as WorkScheduleRecord[];
    },

    // Admin: Get report
    getReport: async (from?: string, to?: string, department?: string) => {
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        if (department) params.append('department', department);
        const qs = params.toString();

        const response = await apiRequest(`/schedules/report${qs ? '?' + qs : ''}`);
        return (Array.isArray(response) ? response : []) as ScheduleSummary[];
    }
};
