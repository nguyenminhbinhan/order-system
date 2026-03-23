import { apiClient } from './api';

export const menuService = {
  async getCategories() {
    const response = await apiClient.get('/categories');
    return response.data;
  },

  async getMenuItems() {
    const response = await apiClient.get('/menu-items');
    return response.data;
  },
  
  async getMenuItem(id: string) {
    const response = await apiClient.get(`/menu-items/${id}`);
    return response.data;
  },
  
  async createMenuItem(data: any) {
    const response = await apiClient.post('/menu-items', data);
    return response.data;
  },
  
  async updateMenuItem(id: string, data: any) {
    const response = await apiClient.put(`/menu-items/${id}`, data);
    return response.data;
  },
  
  async deleteMenuItem(id: string) {
    const response = await apiClient.delete(`/menu-items/${id}`);
    return response.data;
  },

  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/menu-items/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};
