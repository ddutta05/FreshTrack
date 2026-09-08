import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: Array<{ field: string; message: string }>;

  constructor(message: string, status?: number, code?: string, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function clearAuthStorage() {
  localStorage.removeItem('freshtrack_token');
  localStorage.removeItem('freshtrack_user');
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('freshtrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.error?.code;
    const details = error?.response?.data?.error?.details;
    const message = error?.response?.data?.message || error?.message || 'Request failed';

    if (status === 401 || (status === 403 && code === 'ACCOUNT_DISABLED')) {
      unauthorizedHandler?.();
    }

    return Promise.reject(new ApiError(message, status, code, details));
  }
);

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    me: '/auth/me',
  },
  users: {
    list: '/users',
    get: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    disable: (id: string) => `/users/${id}/disable`,
    enable: (id: string) => `/users/${id}/enable`,
  },
  donations: {
    list: '/donations',
    impactStats: '/donations/impact-stats',
    get: (id: string) => `/donations/${id}`,
    create: '/donations',
    update: (id: string) => `/donations/${id}`,
    remove: (id: string) => `/donations/${id}`,
    myDonations: '/donations/mine',
  },
  requests: {
    list: '/requests',
    get: (id: string) => `/requests/${id}`,
    create: '/requests',
    myRequests: '/requests/mine',
    accept: (id: string) => `/requests/${id}/accept`,
    reject: (id: string) => `/requests/${id}/reject`,
    complete: (id: string) => `/requests/${id}/complete`,
  },
  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
  },
  admin: {
    stats: '/admin/stats',
    donations: '/admin/donations',
  },
};
