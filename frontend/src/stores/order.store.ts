import { defineStore } from 'pinia';
import { ref } from 'vue';
import { orderService } from '@/services/order.service';
import { socketService } from '@/services/socket';
import { apiClient } from '@/services/api';

export const useOrderStore = defineStore('order', () => {
  const currentOrder = ref<any>(null);
  const orderHistory = ref<any[]>([]);
  const loading = ref<boolean>(false);
  
  // Table session tracking
  const activeTableId = ref<number | null>(
    localStorage.getItem('tableId') ? Number(localStorage.getItem('tableId')) : null
  );

  const activeSessionToken = ref<string | null>(
    localStorage.getItem('sessionToken') || null
  );

  async function setTableId(id: number) {
    activeTableId.value = id;
    localStorage.setItem('tableId', id.toString());
    try {
      const res = await apiClient.post(`/tables/${id}/session`);
      
      // Handle session cooldown: backend returns token: null if session recently ended
      if (res.data.sessionEnded || !res.data.token) {
        activeSessionToken.value = null;
        localStorage.removeItem('sessionToken');
        return { sessionEnded: true };
      }
      
      activeSessionToken.value = res.data.token;
      localStorage.setItem('sessionToken', res.data.token);
      return { sessionEnded: false };
    } catch(e) {
      console.error('Failed to create session token', e);
      return { sessionEnded: false };
    }
  }

  function clearTableId() {
    activeTableId.value = null;
    activeSessionToken.value = null;
    localStorage.removeItem('tableId');
    localStorage.removeItem('sessionToken');
  }

  // Order session tracking
  const activeOrderId = ref<string | null>(
    localStorage.getItem('orderId') || null
  );

  function setOrderId(id: string) {
    activeOrderId.value = id;
    localStorage.setItem('orderId', id);
  }

  function clearOrderId() {
    activeOrderId.value = null;
    localStorage.removeItem('orderId');
  }

  async function placeOrder(cartData: any) {
    loading.value = true;
    try {
      const order = await orderService.createOrder(cartData);
      currentOrder.value = order;
      setOrderId(order.id);
      return order;
    } catch (error) {
      console.error('Failed to create order', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOrderHistory() {
    loading.value = true;
    try {
      orderHistory.value = await orderService.getOrders();
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      loading.value = false;
    }
  }

  async function fetchOrderById(id: string) {
    loading.value = true;
    try {
      const order = await orderService.getOrder(id);
      currentOrder.value = order;
      return order;
    } catch (error) {
      console.error('Failed to fetch individual order details', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  const activeTableOrders = ref<any[]>([]);

  async function fetchActiveTableOrders(tableId: number) {
    loading.value = true;
    try {
      const response = await apiClient.get(`/tables/${tableId}/orders`);
      activeTableOrders.value = response.data;
    } catch (error) {
      console.error('Failed to fetch active table orders', error);
    } finally {
      loading.value = false;
    }
  }

  // Socket setup for general use (e.g Kitchen/Admin)
  function initSocketListeners() {
    socketService.onNewOrder((order) => {
      // Add to beginning of history if we are tracking all orders
      orderHistory.value.unshift(order);
    });

    socketService.onOrderUpdated((payload) => {
      // Update individual order if it matches
      if (currentOrder.value && currentOrder.value.id === payload.orderId) {
        currentOrder.value.status = payload.status;
      }
      
      // Update in history list 
      const index = orderHistory.value.findIndex(o => o.id === payload.orderId);
      if (index !== -1) {
        orderHistory.value[index].status = payload.status;
      }
    });
  }

  async function updateOrderStatus(id: string, status: string) {
    loading.value = true;
    try {
      const updatedOrder = await orderService.updateOrder(id, { status });
      // The socket logic will catch the broadcast to update the UI,
      // but returning here is useful for optimistic updates
      return updatedOrder;
    } catch (error) {
      console.error('Failed to update order status', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  return { currentOrder, orderHistory, loading, activeTableId, activeOrderId, activeTableOrders, setTableId, clearTableId, setOrderId, clearOrderId, placeOrder, fetchOrderHistory, fetchOrderById, fetchActiveTableOrders, initSocketListeners, updateOrderStatus };
});
