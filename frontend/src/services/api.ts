import axios from 'axios';
import type { ApiError } from '../types';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://opsflow-backend-fecj.onrender.com/api'
    : 'http://localhost:4000/api')
).replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        console.error(
          'OpsFlow API connection failed:',
          error.message
        );
      } else {
        console.error('OpsFlow API error:', {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url,
        });

        if (error.response.status === 401) {
          localStorage.removeItem('opsflow_token');
        }
      }
    }

    return Promise.reject(error);
  }
);

export const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          error?: ApiError | string;
          message?: string;
        }
      | undefined;

    if (typeof data?.error === 'string') {
      return data.error;
    }

    if (
      data?.error &&
      typeof data.error === 'object' &&
      'message' in data.error
    ) {
      return (
        data.error.message ||
        'Something went wrong. Please try again.'
      );
    }

    if (data?.message) {
      return data.message;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};