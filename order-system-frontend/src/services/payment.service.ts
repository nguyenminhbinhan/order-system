import { apiClient } from './api';

export const paymentService = {
  async getPayments() {
    const response = await apiClient.get('/payments');
    return response.data;
  },

  async getPayment(id: string) {
    const response = await apiClient.get(`/payments/${id}`);
    return response.data;
  },

  async createPayment(data: any) {
    const response = await apiClient.post('/payments', data);
    return response.data;
  },
  
  async updatePaymentStatus(id: string, status: string) {
    const response = await apiClient.put(`/payments/${id}/status`, { status });
    return response.data;
  }
};
