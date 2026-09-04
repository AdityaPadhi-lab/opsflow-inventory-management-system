import axios from 'axios';
import type { ApiError } from '../types';

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ??
    'http://localhost:4000/api',

  timeout: 30000,

  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('opsflow_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const errorMessage = (error: unknown) => {
  const data = axios.isAxiosError<{ error?: ApiError }>(error)
    ? error.response?.data
    : undefined;

  return (
    data?.error?.message ??
    'Something went wrong. Please try again.'
  );
};