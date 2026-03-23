import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants';
import { toast } from 'vue3-toastify';

// Create a configured Axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle global errors (e.g. 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Trigger auto-refresh if 401 is received from an endpoint OTHER than the refresh endpoint
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          
          if (res.data.access_token) {
            localStorage.setItem('token', res.data.access_token);
            if (res.data.refresh_token) {
               localStorage.setItem('refreshToken', res.data.refresh_token);
            }
            
            // Reattach new token to the failed request and retry
            originalRequest.headers['Authorization'] = `Bearer ${res.data.access_token}`;
            return apiClient(originalRequest);
          }
        } catch (refreshError) {
          // If refresh token is expired or invalid, forcibly log out
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/customer/login'; // Simple generic soft reload/routing
        }
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
    }
    
    let message = 'An unexpected error occurred';
    if (error.response?.data?.message) {
      message = Array.isArray(error.response.data.message) 
        ? error.response.data.message[0] 
        : error.response.data.message;
    }
    toast.error(message);
    
    return Promise.reject(error);
  }
);
