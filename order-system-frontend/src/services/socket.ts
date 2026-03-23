/// <reference types="vite/client" />
import { io, Socket } from 'socket.io-client';
import { toast } from 'vue3-toastify';

// @ts-ignore: Vite env var
const SOCKET_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private currentRole: 'service' | 'kitchen' | 'customer' | null = null;
  private currentOrderId: string | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(`${SOCKET_URL}/orders`, {
        transports: ['websocket'],
        autoConnect: true,
        auth: (cb) => {
          cb({ token: localStorage.getItem('token') });
        }
      });

      this.socket.on('connect', () => {
        toast.update('socket-status', { render: '🟢 Connected to realtime server', type: 'success', autoClose: 3000 });
        
        // Auto-rejoin rooms on reconnect
        if (this.currentRole === 'service') this.socket?.emit('joinService');
        else if (this.currentRole === 'kitchen') this.socket?.emit('joinKitchen');
        else if (this.currentRole === 'customer' && this.currentOrderId) this.socket?.emit('joinCustomer', this.currentOrderId);
      });

      this.socket.on('disconnect', () => {
        toast.warning('🔴 Realtime connection lost. Reconnecting...', { autoClose: false, toastId: 'socket-status' });
      });

      this.socket.on('connect_error', (error) => {
        console.error('[SOCKET] Connection error:', error);
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Role Connectors
  joinCustomer(orderId: string) {
    this.currentRole = 'customer';
    this.currentOrderId = orderId;
    if (this.socket) {
      this.socket.emit('joinCustomer', orderId);
    }
  }

  joinKitchen() {
    this.currentRole = 'kitchen';
    if (this.socket) {
      this.socket.emit('joinKitchen');
    }
  }

  joinService() {
    this.currentRole = 'service';
    if (this.socket) {
      this.socket.emit('joinService');
    }
  }

  leaveCustomer(orderId: string) {
    if (this.socket) {
      this.socket.emit('leaveCustomer', orderId);
    }
  }

  leaveKitchen() {
    if (this.socket) {
      this.socket.emit('leaveKitchen');
    }
  }

  leaveService() {
    if (this.socket) {
      this.socket.emit('leaveService');
    }
  }

  // Event Listeners
  onNewOrderCreated(callback: (order: any) => void) {
    if (this.socket) {
      this.socket.on('newOrderCreated', (order) => {
        callback(order);
      });
    }
  }

  onOrderConfirmed(callback: (order: any) => void) {
    if (this.socket) {
      this.socket.on('orderConfirmed', (order) => {
        callback(order);
      });
    }
  }

  onOrderUpdated(callback: (payload: any) => void) {
    if (this.socket) {
      this.socket.on('orderUpdated', (payload) => {
        callback(payload);
      });
    }
  }

  onDashboardUpdated(callback: (payload?: any) => void) {
    if (this.socket) {
      this.socket.on('dashboardUpdated', (payload) => {
        callback(payload);
      });
    }
  }

  // Generic Listeners
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  // Remove Listeners
  offNewOrderCreated() {
    if (this.socket) this.socket.off('newOrderCreated');
  }

  offOrderConfirmed() {
    if (this.socket) this.socket.off('orderConfirmed');
  }

  offOrderUpdated() {
    if (this.socket) this.socket.off('orderUpdated');
  }

  offDashboardUpdated() {
    if (this.socket) this.socket.off('dashboardUpdated');
  }
}

export const socketService = new SocketService();
