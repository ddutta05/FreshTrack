import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

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

function prettyValidationMessage(details?: Array<{ field?: string; message?: string }>, fallback = 'Please review your input and try again.') {
  if (!details?.length) return fallback;

  const firstMessage = details[0]?.message ?? fallback;

  if (/invalid .*id|not found/i.test(firstMessage)) {
    return 'We couldn\'t find that item.';
  }

  if (/unsupported file type|valid image file|valid file/i.test(firstMessage)) {
    return 'Please upload a valid image file.';
  }

  if (/already exists|duplicate/i.test(firstMessage)) {
    return 'This item already exists.';
  }

  if (/required|must be|should be|invalid|too long|too short/i.test(firstMessage)) {
    return firstMessage;
  }

  return fallback;
}

export function normalizeApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      if (error.code === 'INVALID_CREDENTIALS') return 'Incorrect email or password.';
      if (error.code === 'AUTH_REQUIRED') return 'Please log in to continue.';
      return 'Your session has expired. Please log in again.';
    }
    if (error.status === 403) return 'You do not have permission to do that.';
    if (error.status === 404) return 'We could not find that item.';
    if (error.status === 409) return error.message || 'This action conflicts with the current state.';
    if (error.status === 422) return prettyValidationMessage(error.details, error.message || 'Please review your input and try again.');
    if (error.status === 500) return 'Something went wrong on the server. Please try again.';
    if (error.message) return error.message;
    return 'Something went wrong. Please try again.';
  }

  if (typeof error === 'string' && error.trim()) return error.trim();

  const maybeError = error as {
    message?: string;
    code?: string;
    response?: {
      status?: number;
      data?: {
        message?: string;
        error?: { code?: string; details?: Array<{ field?: string; message?: string }> };
      };
    };
  };
  if (maybeError?.response?.status === 401) {
    const code = maybeError.response?.data?.error?.code || maybeError.code;
    if (code === 'INVALID_CREDENTIALS') return 'Incorrect email or password.';
    if (code === 'AUTH_REQUIRED') return 'Please log in to continue.';
    return 'Your session has expired. Please log in again.';
  }
  if (maybeError?.response?.status === 403) return 'You do not have permission to do that.';
  if (maybeError?.response?.status === 404) return 'We could not find that item.';
  if (maybeError?.response?.status === 409) return maybeError.response?.data?.message || 'This action conflicts with the current state.';
  if (maybeError?.response?.status === 422) {
    return prettyValidationMessage(
      maybeError.response?.data?.error?.details,
      maybeError.response?.data?.message || 'Please review your input and try again.',
    );
  }
  if (maybeError?.response?.status === 500) return 'Something went wrong on the server. Please try again.';
  if (maybeError?.message && maybeError.message !== 'Request failed') return maybeError.message;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Unable to connect to FreshTrack right now. Please try again.';
  return 'Unable to connect to FreshTrack right now. Please try again.';
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function clearAuthStorage() {
  localStorage.removeItem('freshtrack_token');
  localStorage.removeItem('freshtrack_user');
  sessionStorage.removeItem('freshtrack_token');
  sessionStorage.removeItem('freshtrack_user');
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('freshtrack_token') || sessionStorage.getItem('freshtrack_token');
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
    const backendMessage = error?.response?.data?.message || error?.message || 'Request failed';

    const message = status === 401
      ? (code === 'INVALID_CREDENTIALS'
        ? 'Incorrect email or password.'
        : code === 'AUTH_REQUIRED'
          ? 'Please log in to continue.'
          : 'Your session has expired. Please log in again.')
      : status === 403
        ? 'You do not have permission to do that.'
        : status === 404
          ? 'We could not find that item.'
          : status === 422
            ? prettyValidationMessage(details, backendMessage)
            : status === 500
              ? 'Something went wrong on the server. Please try again.'
              : status === 503
                ? 'Unable to connect to FreshTrack right now. Please try again.'
                : !error?.response
                  ? 'Unable to connect to FreshTrack right now. Please try again.'
                  : backendMessage;

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
    ngo: (id: string) => `/users/ngos/${id}`,
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
  offers: {
    list: '/offers',
    mine: '/offers/mine',
    received: '/offers/received',
    get: (id: string) => `/offers/${id}`,
    accept: (id: string) => `/offers/${id}/accept`,
    reject: (id: string) => `/offers/${id}/reject`,
    complete: (id: string) => `/offers/${id}/complete`,
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
  ai: {
    chat: '/ai/chat',
  },
  recommendations: {
    ngosBrowse: '/recommendations/ngos/browse',
  },
};
