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
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const errorMessage = (error: unknown): string => {
  if (axios.isAxiosError<{ error?: ApiError }>(error)) {
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    }

    if (error.response?.status === 401) {
      return 'Invalid email or password.';
    }

    if (error.response?.status === 403) {
      return 'You are not authorized to perform this action.';
    }

    if (error.response?.status === 404) {
      return 'The requested resource was not found.';
    }

    if (error.response?.status === 500) {
      return 'Server error. Please try again later.';
    }

    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Please try again.';
    }

    if (error.message === 'Network Error') {
      return 'Unable to connect to the server. Please check your connection.';
    }
  }

  return 'Something went wrong. Please try again.';
};