// API utility functions

import axios from 'axios';
import { useAuthStore } from '../store/auth';

// Production API URL - hardcoded for reliability
const API_BASE_URL = 'https://minimax-checkin.minimaxpro.workers.dev/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state on 401
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (email: string, password: string, name?: string) =>
    api.post('/auth/register', { email, password, name }),
  
  getMe: () =>
    api.get('/auth/me'),
};

// Accounts API
export const accountsApi = {
  getAll: () =>
    api.get('/accounts'),
  
  getOne: (id: number) =>
    api.get(`/accounts/${id}`),
  
  create: (account_name: string, cookies: string) =>
    api.post('/accounts', { account_name, cookies }),
  
  update: (id: number, data: { account_name?: string; cookies?: string; is_active?: number }) =>
    api.put(`/accounts/${id}`, data),
  
  delete: (id: number) =>
    api.delete(`/accounts/${id}`),
  
  checkin: (id: number) =>
    api.post(`/accounts/${id}/checkin`),
  
  refresh: (id: number) =>
    api.post(`/accounts/${id}/refresh`),
};

// Admin API
export const adminApi = {
  getLogs: (limit?: number, accountId?: number) =>
    api.get('/admin/logs', { params: { limit, accountId } }),
  
  getStatus: () =>
    api.get('/admin/status'),
  
  getSummary: (date?: string) =>
    api.get(`/admin/summary/${date || ''}`),
  
  triggerCron: () =>
    api.post('/admin/trigger-cron'),
};
