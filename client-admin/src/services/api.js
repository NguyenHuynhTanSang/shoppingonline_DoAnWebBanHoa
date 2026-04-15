import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

API.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('adminToken') ||
      localStorage.getItem('token') ||
      '';

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['x-access-token'] = token;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || '';

    if (
      error.response?.status === 401 ||
      message === 'Token is not valid' ||
      message === 'Token has expired' ||
      message === 'Auth token is not supplied'
    ) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('token');
      alert('Phiên đăng nhập admin đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
      window.location.href = '/admin/login';
      return;
    }

    return Promise.reject(error);
  }
);

export default API;