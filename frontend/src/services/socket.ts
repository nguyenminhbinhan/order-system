/// <reference types="vite/client" />
import { io, Socket } from 'socket.io-client';
import { toast } from 'vue3-toastify';

import { API_BASE_URL } from '@/utils/constants';

const SOCKET_URL = API_BASE_URL;

/**
 * Centralized Socket.io service for the restaurant QR ordering system.
 * 
 * ARCHITECTURE RULES:
 * 1. Every on() method MUST call off() first to prevent listener stacking
 * 2. The connect() method is idempotent — safe to call multiple times
 * 3. Room membership is auto-restored on reconnect via currentRole tracking
 * 4. Only disconnect() destroys the socket instance; individual off() calls just remove listeners
 * 5. Views should call specific off() methods in onUnmounted, NOT disconnect()
 */
class SocketService {
  private socket: Socket | null = null;
  private currentRole: 'service' | 'kitchen' | 'customer' | null = null;
  private currentOrderId: string | null = null;
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Connect to the socket server. Idempotent — safe to call multiple times.
   * The auth callback always reads fresh token from memory or fallback to localStorage.
   */
  connect() {
    if (!this.socket) {
      this.socket = io(`${SOCKET_URL}/orders`, {
        transports: ['polling', 'websocket'], // ✅ polling trước, websocket sau
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        auth: (cb) => {
          // Always get fresh token from memory or fallback to localStorage on every connect/reconnect
          cb({ token: this.token || localStorage.getItem('token') });
        }
      });

      this.socket.on('connect', () => {
        toast.update('socket-status', { render: '🟢 Connected to realtime server', type: 'success', autoClose: 3000 });
        
        // Auto-rejoin rooms on reconnect — this is critical for surviving
        // network drops. The server tracks rooms by socket ID, so after
        // reconnect we must re-join to restore event routing.
        if (this.currentRole === 'service') this.socket?.emit('joinService');
        else if (this.currentRole === 'kitchen') this.socket?.emit('joinKitchen');
        else if (this.currentRole === 'customer' && this.currentOrderId) this.socket?.emit('joinCustomer', this.currentOrderId);

        // Also re-join table room if customer was in one
        if (this.currentTableId) this.socket?.emit('joinTable', this.currentTableId);
      });

      this.socket.on('disconnect', (reason) => {
        // Don't show toast for intentional disconnects (logout, navigation)
        if (reason !== 'io client disconnect') {
          toast.warning('🔴 Realtime connection lost. Reconnecting...', { autoClose: false, toastId: 'socket-status' });
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('[SOCKET] Connection error:', error.message);
      });
    } else if (!this.socket.connected) {
      this.socket.connect();
    }
  }


  reconnectWithNewToken() {
    if (this.socket) {
      // Disconnect and reconnect — the auth callback will pick up the new token
      this.socket.disconnect();
      this.socket.connect();
    } else {
      this.connect();
    }
  }


  disconnect() {
    if (this.socket) {
      // Explicitly leave rooms on the backend before disconnecting
      if (this.currentRole === 'service') this.socket.emit('leaveService');
      else if (this.currentRole === 'kitchen') this.socket.emit('leaveKitchen');
      else if (this.currentRole === 'customer' && this.currentOrderId) {
        this.socket.emit('leaveCustomer', this.currentOrderId);
      }
      if (this.currentTableId) {
        this.socket.emit('leaveTable', this.currentTableId);
      }
      this.socket.disconnect();
      this.socket = null;
      this.currentRole = null;
      this.currentOrderId = null;
      this.currentTableId = null;
      this.token = null;
    }
  }
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
  private currentTableId: number | null = null;

  joinTable(tableId: number) {
    this.currentTableId = tableId;
    if (this.socket) {
      this.socket.emit('joinTable', tableId);
    }
  }

  leaveTable(tableId: number) {
    if (this.socket) {
      this.socket.emit('leaveTable', tableId);
    }
    if (this.currentTableId === tableId) {
      this.currentTableId = null;
    }
  }

  onNewOrderCreated(callback: (order: any) => void) {
    if (this.socket) {
      this.socket.off('newOrderCreated');
      this.socket.on('newOrderCreated', callback);
    }
  }

  /** Alias for onNewOrderCreated — used by order.store */
  onNewOrder(callback: (order: any) => void) {
    this.onNewOrderCreated(callback);
  }

  onOrderConfirmed(callback: (order: any) => void) {
    if (this.socket) {
      this.socket.off('orderConfirmed');
      this.socket.on('orderConfirmed', callback);
    }
  }

  onOrderUpdated(callback: (payload: any) => void) {
    if (this.socket) {
      this.socket.off('orderUpdated');
      this.socket.on('orderUpdated', callback);
    }
  }

  onDashboardUpdated(callback: (payload?: any) => void) {
    if (this.socket) {
      this.socket.off('dashboardUpdated');
      this.socket.on('dashboardUpdated', callback);
    }
  }

  onCustomerActivity(callback: (payload: any) => void) {
    if (this.socket) {
      this.socket.off('customerActivity');
      this.socket.on('customerActivity', callback);
    }
  }

  onTableLocked(callback: (payload: { tableId: number; isLocked: boolean; tableName?: string }) => void) {
    if (this.socket) {
      this.socket.off('tableLocked');
      this.socket.on('tableLocked', callback);
    }
  }

  onItemStatusChanged(callback: (payload: any) => void) {
    if (this.socket) {
      this.socket.off('itemStatusChanged');
      this.socket.on('itemStatusChanged', callback);
    }
  }

 
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event);  // Dedup: remove any existing listener first
      this.socket.on(event, callback);
    }
  }

  private messageListeners = new Map<string, (msg: any) => void>();

  onNewMessage(key: string, callback: (msg: any) => void) {
    this.messageListeners.set(key, callback);
    if (this.socket) {
      this.socket.off('newMessage');
      this.socket.on('newMessage', (msg) => {
        this.messageListeners.forEach((cb) => cb(msg));
      });
    }
  }

  offNewMessage(key: string) {
    this.messageListeners.delete(key);
    if (this.socket) {
      this.socket.off('newMessage');
      if (this.messageListeners.size > 0) {
        this.socket.on('newMessage', (msg) => {
          this.messageListeners.forEach((cb) => cb(msg));
        });
      }
    }
  }

  off(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  private lastCartEmit = 0;

  emitCartUpdate(payload: { tableId: number; tableName: string; itemCount: number; description: string }) {
    const now = Date.now();
    if (now - this.lastCartEmit < 2000) return; // Client-side throttle: 2s
    this.lastCartEmit = now;
    
    if (this.socket) {
      this.socket.emit('customerCartUpdate', payload);
    }
  }

 
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

  offCustomerActivity() {
    if (this.socket) this.socket.off('customerActivity');
  }

  offTableLocked() {
    if (this.socket) this.socket.off('tableLocked');
  }

  offItemStatusChanged() {
    if (this.socket) this.socket.off('itemStatusChanged');
  }


  removeAllAppListeners() {
    if (this.socket) {
      this.socket.off('newOrderCreated');
      this.socket.off('orderConfirmed');
      this.socket.off('orderUpdated');
      this.socket.off('dashboardUpdated');
      this.socket.off('tableUpdated');
      this.socket.off('paymentCompleted');
      this.socket.off('tableNotification');
      this.socket.off('newMessage');
      this.socket.off('customerActivity');
      this.socket.off('tableLocked');
      this.socket.off('itemStatusChanged');
      this.socket.off('billPrinted');
    }
  }
}

export const socketService = new SocketService();

