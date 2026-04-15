import axios from 'axios';

export const API_BASE = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');

const API = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('customerToken') || '';

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['x-access-token'] = token;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default API;
