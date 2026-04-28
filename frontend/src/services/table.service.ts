import { apiClient } from './api';

export const tableService = {
  async getTables() {
    const response = await apiClient.get('/tables');
    return response.data;
  },

  async getTable(id: string) {
    const response = await apiClient.get(`/tables/${id}`);
    return response.data;
  },

  async updateTableStatus(id: string, status: string) {
    const response = await apiClient.put(`/tables/${id}`, { status });
    return response.data;
  }
};
