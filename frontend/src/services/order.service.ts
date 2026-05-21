import { apiClient } from './api';

export const orderService = {
  async getOrders(activeSessionOnly = false) {
    const response = await apiClient.get('/orders', {
      params: activeSessionOnly ? { activeSessionOnly: true } : {}
    });
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
  },

  async cancelOrderItem(orderId: string, itemId: string, role: string = 'customer', reason?: string) {
    const response = await apiClient.post(`/orders/${orderId}/items/${itemId}/cancel`, { role, reason });
    return response.data;
  },

  /** Confirm specific items within an order (per-item confirmation) */
  async confirmItems(orderId: string, itemIds: string[]) {
    const response = await apiClient.post(`/orders/${orderId}/items/confirm`, { itemIds });
    return response.data;
  },

  /** Update a single item's status (item lifecycle) */
  async updateItemStatus(orderId: string, itemId: string, status: string) {
    const response = await apiClient.post(`/orders/${orderId}/items/${itemId}/status`, { status });
    return response.data;
  },

  /** Update quantity and note of a pending item */
  async updateItemProperties(orderId: string, itemId: string, quantity: number, note: string) {
    const response = await apiClient.put(`/orders/${orderId}/items/${itemId}`, { quantity, note });
    return response.data;
  },
};
