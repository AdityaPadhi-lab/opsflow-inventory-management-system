import axios from 'axios';
import type { ApiError } from '../types';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Attach authentication token to every API request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('opsflow_token');

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle common authentication/API failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('opsflow_token');
    }

    return Promise.reject(error);
  }
);

// Convert API/axios errors into a user-friendly message
export const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError<{ error?: ApiError }>(error)) {
    const apiError = error.response?.data?.error;

    if (apiError?.message) {
      return apiError.message;
    }

    if (error.code === 'ECONNABORTED') {
      return 'The API request timed out. Please try again.';
    }

    if (!error.response) {
      return 'Unable to connect to the API server. Make sure the backend is running.';
    }

    if (error.response.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (error.response.status === 403) {
      return 'You do not have permission to perform this action.';
    }

    if (error.response.status >= 500) {
      return 'The server encountered an error. Please try again.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};