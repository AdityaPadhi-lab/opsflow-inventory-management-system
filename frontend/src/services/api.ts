import axios from 'axios';
import type { ApiError } from '../types';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:4000/api';

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
        console.error('API connection failed:', error.message);
      } else {
        console.error(
          'API error:',
          error.response.status,
          error.response.data
        );
      }
    }

    return Promise.reject(error);
  }
);

export const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError<{ error?: ApiError; message?: string }>(error)) {
    return (
      error.response?.data?.error?.message ??
      error.response?.data?.message ??
      error.message ??
      'Something went wrong. Please try again.'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};
