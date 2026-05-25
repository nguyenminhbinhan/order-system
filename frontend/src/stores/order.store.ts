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

  async function setTableId(id: number, qrToken?: string) {
    activeTableId.value = id;
    localStorage.setItem('tableId', id.toString());
    try {
      const res = await apiClient.post(`/tables/${id}/session`, { qrToken });
      
      // Handle table locked: backend returns isLocked: true
      if (res.data.isLocked) {
        activeSessionToken.value = null;
        localStorage.removeItem('sessionToken');
        return { sessionEnded: false, isLocked: true };
      }

      // Handle session cooldown: backend returns token: null if session recently ended
      if (res.data.sessionEnded || !res.data.token) {
        activeSessionToken.value = null;
        localStorage.removeItem('sessionToken');
        return { sessionEnded: true, isLocked: false };
      }
      
      activeSessionToken.value = res.data.token;
      localStorage.setItem('sessionToken', res.data.token);
      return { sessionEnded: false, isLocked: false };
    } catch(e: any) {
      console.error('Failed to create session token', e);
      // Check if error response contains isLocked
      if (e?.response?.data?.isLocked) {
        return { sessionEnded: false, isLocked: true };
      }
      return { sessionEnded: false, isLocked: false };
    }
  }

  function clearTableId() {
    activeTableId.value = null;
    activeSessionToken.value = null;
    localStorage.removeItem('tableId');
    localStorage.removeItem('sessionToken');
  }

  /**
   * Resolve a QR token to a tableId and create/get session.
   * Used for production QR scanning via /table/:token route.
   */
  async function setTableByToken(token: string) {
    try {
      const res = await apiClient.get(`/tables/by-token/${token}`);
      const tableId = res.data.id;
      return await setTableId(tableId, token);
    } catch (e) {
      console.error('Failed to resolve table token', e);
      return { sessionEnded: false, error: true };
    }
  }

  /**
   * Validate current session against backend.
   * Called on page reload to detect stale state.
   * Returns session status from server.
   */
  async function validateSession() {
    if (!activeTableId.value) return { active: false };
    try {
      const res = await apiClient.get(`/tables/${activeTableId.value}/session-status`);
      return res.data;
    } catch (e) {
      console.error('Failed to validate session', e);
      return { active: false };
    }
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

  async function fetchOrderHistory(activeSessionOnly = false) {
    loading.value = true;
    try {
      orderHistory.value = await orderService.getOrders(activeSessionOnly);
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
  let _listenersInitialized = false;

  function initSocketListeners() {
    // Guard: prevent duplicate listener registration from multiple views
    if (_listenersInitialized) return;
    _listenersInitialized = true;

    socketService.onNewOrder((order) => {
      // Add to beginning of history if we are tracking all orders
      // Dedup: check if order already exists before adding
      if (!orderHistory.value.some(o => o.id === order.id)) {
        orderHistory.value.unshift(order);
      }
    });

    socketService.onOrderUpdated((payload) => {
      // Gateway sends either full order object (payload.id) or partial ({orderId, status})
      const orderId = payload.id || payload.orderId;
      const status = payload.status;

      // Update individual order if it matches
      if (currentOrder.value && currentOrder.value.id === orderId) {
        if (payload.items) {
          // Full order object — replace entirely for freshest data
          currentOrder.value = payload;
        } else {
          currentOrder.value.status = status;
        }
      }
      
      // Update in history list
      const index = orderHistory.value.findIndex(o => o.id === orderId);
      if (index !== -1) {
        if (payload.items) {
          orderHistory.value[index] = payload;
        } else {
          orderHistory.value[index].status = status;
        }
      }
    });
  }

  function destroySocketListeners() {
    _listenersInitialized = false;
    socketService.offNewOrderCreated();
    socketService.offOrderUpdated();
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

  function reset() {
    currentOrder.value = null;
    orderHistory.value = [];
    loading.value = false;
    activeTableId.value = null;
    activeSessionToken.value = null;
    activeOrderId.value = null;
    activeTableOrders.value = [];
    destroySocketListeners();
  }

  return { currentOrder, orderHistory, loading, activeTableId, activeOrderId, activeTableOrders, activeSessionToken, setTableId, clearTableId, setTableByToken, validateSession, setOrderId, clearOrderId, placeOrder, fetchOrderHistory, fetchOrderById, fetchActiveTableOrders, initSocketListeners, destroySocketListeners, updateOrderStatus, reset };
});
