import { apiClient } from './api';

export const orderService = {
  async getOrders() {
    const response = await apiClient.get('/orders');
    return response.data;
  },

  async getOrder(id: string) {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data;
  },

  async createOrder(data: any) {
    const response = await apiClient.post('/orders', data);
    return response.data;
  },

  async updateOrder(id: string, data: any) {
    const response = await apiClient.put(`/orders/${id}`, data);
    return response.data;
  }
};
