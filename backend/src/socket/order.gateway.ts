import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
})
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('OrderGateway');

  // Throttle map for customerCartUpdate — prevent spam
  private cartUpdateThrottles = new Map<number, number>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinKitchen')
  handleJoinKitchen(client: Socket) {
    client.join('kitchen');
    this.logger.log(`Client ${client.id} joined kitchen`);
  }

  @SubscribeMessage('joinService')
  handleJoinService(client: Socket) {
    client.join('service');
    this.logger.log(`Client ${client.id} joined service`);
  }

  @SubscribeMessage('joinCustomer')
  handleJoinCustomer(client: Socket, orderId: string) {
    client.join(`order_${orderId}`);
    this.logger.log(`Client ${client.id} joined order_${orderId}`);
  }

  /**
   * Customer joins a table-specific room for activity tracking.
   * Used for customer → service notifications.
   */
  @SubscribeMessage('joinTable')
  handleJoinTable(client: Socket, tableId: number) {
    client.join(`table_${tableId}`);
    this.logger.log(`Client ${client.id} joined table_${tableId}`);
  }

  @SubscribeMessage('leaveKitchen')
  handleLeaveKitchen(client: Socket) {
    client.leave('kitchen');
    this.logger.log(`Client ${client.id} left kitchen`);
  }

  @SubscribeMessage('leaveService')
  handleLeaveService(client: Socket) {
    client.leave('service');
    this.logger.log(`Client ${client.id} left service`);
  }

  @SubscribeMessage('leaveCustomer')
  handleLeaveCustomer(client: Socket, orderId: string) {
    client.leave(`order_${orderId}`);
    this.logger.log(`Client ${client.id} left order_${orderId}`);
  }

  @SubscribeMessage('leaveTable')
  handleLeaveTable(client: Socket, tableId: number) {
    client.leave(`table_${tableId}`);
    this.logger.log(`Client ${client.id} left table_${tableId}`);
  }

  /**
   * Throttled customer cart activity relay.
   * Frontend emits this when customer adds/removes items.
   * Server re-emits to service room with 3-second throttle per table.
   */
  @SubscribeMessage('customerCartUpdate')
  handleCustomerCartUpdate(client: Socket, payload: { tableId: number; tableName: string; itemCount: number; description: string }) {
    const { tableId } = payload;
    const now = Date.now();
    const lastEmit = this.cartUpdateThrottles.get(tableId) || 0;

    // Throttle: max 1 emit per 3 seconds per table
    if (now - lastEmit < 3000) return;
    this.cartUpdateThrottles.set(tableId, now);

    this.emitCustomerActivity({
      tableId: payload.tableId,
      tableName: payload.tableName,
      type: 'CART_UPDATE',
      description: payload.description,
      metadata: { itemCount: payload.itemCount },
    });
  }

  // ==========================================
  // EXISTING EMISSIONS — Preserved exactly
  // ==========================================

  emitNewOrderCreated(payload: any) {
    this.logger.log(`Emitting newOrderCreated for order ${payload.id}`);
    this.server.to('service').emit('newOrderCreated', payload);
    this.server.emit('dashboardUpdated', payload);
  }

  emitOrderConfirmed(payload: any) {
    this.logger.log(`Emitting orderConfirmed for order ${payload.id}`);
    this.server.to('kitchen').emit('orderConfirmed', payload);
  }

  emitOrderUpdated(payload: any) {
    this.logger.log(`Emitting orderUpdated for order ${payload.id}`);
    // Notify all listeners
    this.server.emit('orderUpdated', payload);
    this.server.emit('dashboardUpdated', payload);
  }

  /**
   * Centralized payment completion emission.
   * Notifies ALL relevant parties:
   * - Global: paymentCompleted (customer devices listening)
   * - Service room: tableUpdated (waiter refreshes table state)
   * - Global: dashboardUpdated (admin analytics refresh)
   */
  emitPaymentCompleted(payload: { tableId: number; paymentId?: string }) {
    this.logger.log(`Emitting paymentCompleted for table ${payload.tableId}`);
    this.server.emit('paymentCompleted', payload);
    this.server.to('service').emit('tableUpdated', payload.tableId);
    this.server.emit('dashboardUpdated', {});
  }

  // ==========================================
  // NEW EMISSIONS — Fix #3 & #4
  // ==========================================

  /**
   * Emit customer activity notification to service room.
   * Waiters see real-time notifications of customer actions.
   */
  emitCustomerActivity(payload: {
    tableId: number;
    tableName: string;
    type: 'SCAN_QR' | 'ORDER_PLACED' | 'PAYMENT_CONFIRMED' | 'CART_UPDATE' | 'ITEM_CANCELLED' | 'CALL_WAITER' | 'REQUEST_PAYMENT';
    description: string;
    metadata?: Record<string, any>;
  }) {
    const event = {
      ...payload,
      timestamp: new Date().toISOString(),
    };
    this.logger.log(`Customer activity: ${payload.type} on table ${payload.tableId}`);
    this.server.to('service').emit('customerActivity', event);
  }

  /**
   * Emit order item cancellation to all parties.
   */
  emitOrderItemCancelled(payload: { orderId: string; itemId: string; tableId: number; itemName: string; reason?: string }) {
    this.logger.log(`Order item cancelled: ${payload.itemName} in order ${payload.orderId}`);
    this.server.emit('orderUpdated', payload);
    this.server.to('service').emit('tableUpdated', payload.tableId);
    this.server.to('kitchen').emit('orderUpdated', payload);
    this.server.emit('dashboardUpdated', {});
  }

  /**
   * Emit table lock/unlock state change to all parties.
   * Customer devices, service, kitchen, and admin all need to know.
   */
  emitTableLocked(payload: { tableId: number; isLocked: boolean; tableName?: string }) {
    this.logger.log(`Table ${payload.tableId} lock state: ${payload.isLocked}`);
    this.server.emit('tableLocked', payload);
    this.server.to('service').emit('tableUpdated', payload.tableId);
    this.server.to(`table_${payload.tableId}`).emit('tableLocked', payload);
  }

  /**
   * Emit individual item status change.
   * Used for per-item confirmation, kitchen status updates.
   */
  emitItemStatusChanged(payload: { orderId: string; itemId: string; tableId: number; itemName: string; newStatus: string; oldStatus: string }) {
    this.logger.log(`Item ${payload.itemName} status: ${payload.oldStatus} → ${payload.newStatus}`);
    this.server.emit('itemStatusChanged', payload);
    this.server.to('service').emit('tableUpdated', payload.tableId);
    this.server.to('kitchen').emit('itemStatusChanged', payload);
    this.server.emit('dashboardUpdated', {});
  }
}
