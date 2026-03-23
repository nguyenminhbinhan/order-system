import { apiClient } from './api';

export const authService = {
  async login(credentials: any) {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },
  
  async getProfile() {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  }
};
