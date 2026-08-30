import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
    console.error('API Error:', error);
    const message = error?.response?.data?.message || error?.message || 'Request failed';
    return Promise.reject(new Error(message));
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
    get: (id: string) => `/donations/${id}`,
    create: '/donations',
    update: (id: string) => `/donations/${id}`,
    remove: (id: string) => `/donations/${id}`,
    myDonations: '/donations/mine',
  },
  requests: {
    list: '/requests',
    create: '/requests',
    myRequests: '/requests/mine',
    accept: (id: string) => `/requests/${id}/accept`,
    reject: (id: string) => `/requests/${id}/reject`,
    complete: (id: string) => `/requests/${id}/complete`,
  },
};

// Flag to control mock vs real API
export const USE_MOCK_DATA = false;
