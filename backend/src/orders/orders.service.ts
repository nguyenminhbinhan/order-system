import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderGateway } from '../socket/order.gateway';
import { OrderStatus } from '@prisma/client';

// ==========================================
// SIMPLIFIED ITEM STATUS LIFECYCLE
// ==========================================
// pending → confirmed → ready
//    ↓
// cancelled (from pending or confirmed)
//
// ORDER STATUS = derived from item statuses (computeOrderStatus)
// ==========================================

const VALID_ITEM_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: [],
  cancelled: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderGateway: OrderGateway,
  ) { }

  // ==========================================
  // PURE HELPERS
  // ==========================================

  /**
   * Derive order-level status from its items.
   * This is the SINGLE SOURCE OF TRUTH for order status.
   */
  computeOrderStatus(items: { status: string }[]): OrderStatus {
    if (items.length === 0) return 'cancelled' as OrderStatus;

    const nonCancelled = items.filter(i => i.status !== 'cancelled');
    if (nonCancelled.length === 0) return 'cancelled' as OrderStatus;

    const statuses = nonCancelled.map(i => i.status);

    // If any pending -> pending_confirmation
    if (statuses.some(s => s === 'pending')) return 'pending_confirmation' as OrderStatus;
    // All ready -> ready
    if (statuses.every(s => s === 'ready')) return 'ready' as OrderStatus;
    // Any confirmed (or legacy preparing) -> confirmed
    if (statuses.some(s => s === 'confirmed' || s === 'preparing')) return 'confirmed' as OrderStatus;

    return 'pending_confirmation' as OrderStatus;
  }

  /**
   * Recalculate order total from non-cancelled items.
   */
  private calcTotal(items: { price: any; quantity: number; status: string }[]): number {
    return items
      .filter(i => i.status !== 'cancelled')
      .reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  }

  /**
   * Fetch order with full includes. Used after mutations to return consistent data.
   */
  private fullInclude() {
    return { table: true, session: true, items: { include: { menuItem: true } }, payments: true };
  }

  // ==========================================
  // ORDER CREATION
  // ==========================================

  async create(dto: CreateOrderDto, user?: any) {
    if (!dto.tableId) {
      throw new BadRequestException('tableId is required');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const table: any = await this.prisma.table.findUnique({ where: { id: dto.tableId } });
    if (!table || table.isDeleted) {
      throw new BadRequestException('Cannot create an order for a deleted or invalid table');
    }

    // TABLE LOCK GUARD
    if (table.isLocked) {
      throw new BadRequestException('Bàn đang bị khóa. Không thể đặt món.');
    }

    // Idempotency / Anti-spam check
    const recentOrder = await this.prisma.order.findFirst({
      where: {
        tableId: dto.tableId,
        createdAt: { gt: new Date(Date.now() - 5000) }
      }
    });

    if (recentOrder) {
      throw new BadRequestException('Please wait a moment before placing another order on this table');
    }

    // Fetch all menu items to get names and snapshot prices
    const menuItemIds = dto.items.map(item => item.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isDeleted: false }
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException('One or more menu items are invalid or not found');
    }

    const orderItemsData = dto.items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      if (!menuItem) {
        throw new BadRequestException(`MenuItem with id ${item.menuItemId} not found`);
      }
      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        note: item.note,
        status: 'pending' as const, // All new items start as pending
      };
    });

    // Calculate total server-side from snapshotted prices
    const serverTotal = orderItemsData.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity, 0
    );

    const order = await this.prisma.$transaction(async (tx) => {
      let session = await tx.tableSession.findFirst({
        where: { tableId: dto.tableId, endedAt: null },
        orderBy: { startedAt: 'desc' }
      });

      if (!session) {
        session = await tx.tableSession.create({
          data: { tableId: dto.tableId }
        });
      }

      const newOrder = await tx.order.create({
        data: {
          table: { connect: { id: dto.tableId } },
          session: { connect: { id: session.id } },
          totalAmount: serverTotal,
          status: 'pending_confirmation',
          items: {
            create: orderItemsData
          }
        },
        include: this.fullInclude(),
      });

      await tx.table.update({
        where: { id: dto.tableId },
        data: { status: 'waiting_confirmation' }
      });

      return newOrder;
    }, { timeout: 20000 });

    this.orderGateway.emitNewOrderCreated(order);
    this.orderGateway.server.to('service').emit('tableUpdated', dto.tableId);

    // Emit customer activity
    const tableName = order.table?.name || `Table ${dto.tableId}`;
    this.orderGateway.emitCustomerActivity({
      tableId: dto.tableId,
      tableName,
      type: 'ORDER_PLACED',
      description: `Khách đặt ${order.items.length} món tại ${tableName}`,
      metadata: { orderId: order.id, itemCount: order.items.length, total: Number(order.totalAmount) },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'CREATE_ORDER',
        tableId: dto.tableId,
        metadata: { totalAmount: serverTotal }
      }
    });

    return order;
  }

  // ==========================================
  // CRUD
  // ==========================================

  findAll(activeSessionOnly: boolean = false) {
    if (activeSessionOnly) {
      return this.prisma.order.findMany({
        where: {
          session: {
            endedAt: null
          },
          status: {
            not: 'cancelled'
          }
        },
        include: this.fullInclude()
      });
    }
    return this.prisma.order.findMany({ include: this.fullInclude() });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.fullInclude(),
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async update(id: string, dto: UpdateOrderDto, user?: any) {
    const existingOrder = await this.findOne(id);

    // Guard: Prevent duplicate status or invalid transitions
    if (dto.status) {
      if (existingOrder.status === dto.status) {
        throw new BadRequestException(`Order is already in '${dto.status}' status`);
      }
      if (existingOrder.status === 'cancelled') {
        throw new BadRequestException(`Cannot update a ${existingOrder.status} order`);
      }
    }

    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.totalAmount !== undefined) data.totalAmount = dto.totalAmount;
    if (dto.tableId !== undefined) data.table = { connect: { id: dto.tableId } };

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const uOrder = await tx.order.update({
        where: { id },
        data,
        include: this.fullInclude()
      });

      // Table status based on order lifecycle
      if (dto.status) {
        if (dto.status === 'confirmed') {
          // When order is confirmed, also confirm all pending items
          await tx.orderItem.updateMany({
            where: { orderId: id, status: 'pending' },
            data: { status: 'confirmed' }
          });

          await tx.table.update({
            where: { id: uOrder.tableId },
            data: { status: 'occupied' }
          });
        }

        if (dto.status === 'ready') {
          await tx.table.update({
            where: { id: uOrder.tableId },
            data: { status: 'needs_payment' }
          });
        }

        if (dto.status === 'cancelled') {
          // No message cleanup on completed order needed here as complete is removed
        }
      }

      return uOrder;
    }, { timeout: 20000 });

    // Socket notifications
    this.orderGateway.server.to('service').emit('tableUpdated', updatedOrder.tableId);

    if (dto.status) {
      this.orderGateway.emitOrderUpdated(updatedOrder);

      if (dto.status === 'confirmed') {
        this.orderGateway.emitOrderConfirmed(updatedOrder);
        
        await this.prisma.auditLog.create({
          data: {
            userId: user?.id || null,
            action: 'CONFIRM_ORDER',
            tableId: updatedOrder.tableId,
            metadata: { orderId: id }
          }
        });
      }
    }

    return updatedOrder;
  }

  // ==========================================
  // ORDER CONFIRMATION (legacy — confirms entire order)
  // ==========================================

  async confirmOrder(id: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { table: true, items: true }
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'pending_confirmation') {
      throw new BadRequestException('Order can only be confirmed while pending confirmation');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Confirm all pending items
      await tx.orderItem.updateMany({
        where: { orderId: id, status: 'pending' },
        data: { status: 'confirmed' }
      });

      const confirmed = await tx.order.update({
        where: { id },
        data: { status: 'confirmed' },
        include: this.fullInclude()
      });

      await tx.table.update({
        where: { id: confirmed.tableId },
        data: { status: 'occupied' }
      });

      return confirmed;
    }, { timeout: 20000 });

    this.orderGateway.server.to('service').emit('tableUpdated', updatedOrder.tableId);
    this.orderGateway.emitOrderUpdated(updatedOrder);
    this.orderGateway.emitOrderConfirmed(updatedOrder);

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'CONFIRM_ORDER',
        tableId: updatedOrder.tableId,
        metadata: { orderId: id }
      }
    });

    return updatedOrder;
  }

  // ==========================================
  // PER-ITEM CONFIRMATION (Feature #2)
  // ==========================================

  /**
   * Confirm specific items within an order.
   * Each item transitions from 'pending' → 'confirmed'.
   * Order status is recomputed after confirmation.
   */
  async confirmItems(orderId: string, itemIds: string[], user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true, session: true }
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.session && order.session.endedAt) {
      throw new BadRequestException('Phiên đã kết thúc. Không thể xác nhận món.');
    }
    if (order.status === 'cancelled') {
      throw new BadRequestException(`Không thể xác nhận món trong đơn đã hủy`);
    }

    // TABLE LOCK GUARD
    if (order.table && (order.table as any).isLocked) {
      throw new BadRequestException('Bàn đang bị khóa.');
    }

    // Validate all requested items exist and are pending
    const pendingItems = order.items.filter(i => itemIds.includes(i.id));
    const invalidItems = pendingItems.filter(i => i.status !== 'pending');
    if (invalidItems.length > 0) {
      throw new BadRequestException(`Một số món không ở trạng thái chờ xác nhận.`);
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Confirm each item
      for (const itemId of itemIds) {
        await tx.orderItem.update({
          where: { id: itemId },
          data: { status: 'confirmed' }
        });
      }

      // Re-fetch all items to compute new order status
      const freshItems = await tx.orderItem.findMany({ where: { orderId } });
      const newOrderStatus = this.computeOrderStatus(freshItems);
      const newTotal = this.calcTotal(freshItems);

      const result = await tx.order.update({
        where: { id: orderId },
        data: { status: newOrderStatus, totalAmount: newTotal },
        include: this.fullInclude()
      });

      // Update table status
      if (newOrderStatus === 'confirmed' || newOrderStatus === 'preparing') {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'occupied' }
        });
      }

      return result;
    }, { timeout: 20000 });

    // Socket emissions
    this.orderGateway.server.to('service').emit('tableUpdated', updatedOrder.tableId);
    this.orderGateway.emitOrderUpdated(updatedOrder);
    this.orderGateway.emitOrderConfirmed(updatedOrder);

    // Emit per-item status changes
    for (const itemId of itemIds) {
      const item = order.items.find(i => i.id === itemId);
      if (item) {
        this.orderGateway.emitItemStatusChanged({
          orderId,
          itemId,
          tableId: order.tableId,
          itemName: item.name,
          oldStatus: 'pending',
          newStatus: 'confirmed',
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'CONFIRM_ITEMS',
        tableId: updatedOrder.tableId,
        metadata: { orderId, itemIds, count: itemIds.length }
      }
    });

    return updatedOrder;
  }

  // ==========================================
  // PER-ITEM STATUS UPDATE (Feature #2)
  // ==========================================

  /**
   * Update a single item's status through the lifecycle.
   * Valid transitions defined in VALID_ITEM_TRANSITIONS.
   */
  async updateItemStatus(orderId: string, itemId: string, newStatus: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true, session: true }
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.session && order.session.endedAt) {
      throw new BadRequestException('Phiên đã kết thúc. Không thể cập nhật trạng thái món.');
    }

    const item = order.items.find(i => i.id === itemId);
    if (!item) throw new NotFoundException('Order item not found');

    // Validate transition
    const validNext = VALID_ITEM_TRANSITIONS[item.status] || [];
    if (!validNext.includes(newStatus)) {
      throw new BadRequestException(`Không thể chuyển trạng thái từ '${item.status}' sang '${newStatus}'`);
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: { status: newStatus as any }
      });

      // Recompute order status
      const freshItems = await tx.orderItem.findMany({ where: { orderId } });
      const newOrderStatus = this.computeOrderStatus(freshItems);
      const newTotal = this.calcTotal(freshItems);

      const result = await tx.order.update({
        where: { id: orderId },
        data: { status: newOrderStatus, totalAmount: newTotal },
        include: this.fullInclude()
      });

      // Update table status based on overall order state
      if (newOrderStatus === 'ready') {
        await tx.table.update({
          where: { id: order.tableId },
          data: { status: 'needs_payment' }
        });
      }

      return result;
    }, { timeout: 20000 });

    // Socket emissions
    this.orderGateway.emitItemStatusChanged({
      orderId,
      itemId,
      tableId: order.tableId,
      itemName: item.name,
      oldStatus: item.status,
      newStatus,
    });
    this.orderGateway.emitOrderUpdated(updatedOrder);
    this.orderGateway.server.to('service').emit('tableUpdated', updatedOrder.tableId);

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'UPDATE_ITEM_STATUS',
        tableId: order.tableId,
        metadata: { orderId, itemId, itemName: item.name, oldStatus: item.status, newStatus }
      }
    });

    return updatedOrder;
  }

  // ==========================================
  // CONFIRM WITH EDITS (legacy — preserved)
  // ==========================================

  async confirmWithEdits(id: string, items: { itemId: string; quantity: number; note?: string }[], user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, table: true, session: true }
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.session && order.session.endedAt) {
      throw new BadRequestException('Phiên đã kết thúc. Không thể xác nhận món.');
    }
    if (order.status !== 'pending_confirmation') {
      throw new BadRequestException('Order can only be edited while pending confirmation');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Update each order item
      for (const edit of items) {
        const existingItem = order.items.find(i => i.id === edit.itemId);
        if (!existingItem) continue;

        await tx.orderItem.update({
          where: { id: edit.itemId },
          data: {
            quantity: edit.quantity,
            note: edit.note ?? existingItem.note,
            status: 'confirmed', // Edit + confirm in one step
          }
        });
      }

      // Re-fetch items to recalculate total from DB prices
      const freshItems = await tx.orderItem.findMany({
        where: { orderId: id }
      });

      const newTotal = this.calcTotal(freshItems);
      const newStatus = this.computeOrderStatus(freshItems);

      // Update order: set total + confirm
      const confirmed = await tx.order.update({
        where: { id },
        data: {
          totalAmount: newTotal,
          status: newStatus
        },
        include: this.fullInclude()
      });

      await tx.table.update({
        where: { id: confirmed.tableId },
        data: { status: 'occupied' }
      });

      return confirmed;
    }, { timeout: 20000 });

    // Socket events
    this.orderGateway.server.to('service').emit('tableUpdated', updatedOrder.tableId);
    this.orderGateway.emitOrderUpdated(updatedOrder);
    this.orderGateway.emitOrderConfirmed(updatedOrder);

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'CONFIRM_ORDER_WITH_EDITS',
        tableId: updatedOrder.tableId,
        metadata: { orderId: id, editedItems: items.length }
      }
    });

    return updatedOrder;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.order.delete({ where: { id } });
  }

  // ==========================================
  // ORDER ITEM CANCELLATION — STRICT PENDING ONLY
  // ==========================================

  /**
   * Cancel a specific order item.
   * 
   * STRICT RULE: Cancellation ONLY allowed from 'pending' status.
   * No exceptions for any role — once confirmed, item cannot be cancelled.
   */
  async cancelOrderItem(
    orderId: string,
    itemId: string,
    role: string = 'customer',
    reason?: string,
    userId?: string,
  ) {
    // 1. Fetch order with items and session
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        table: true,
        session: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    // 2. Guard: order-level status check
    if (order.status === 'cancelled') {
      throw new BadRequestException(`Không thể hủy món trong đơn đã hủy`);
    }

    // 3. Guard: session still active
    if (order.session && order.session.endedAt) {
      throw new BadRequestException('Phiên đã kết thúc. Không thể hủy món.');
    }

    // 4. Guard: table not locked
    if (order.table && (order.table as any).isLocked) {
      throw new BadRequestException('Bàn đang bị khóa. Không thể hủy món.');
    }

    // 5. Find the specific item
    const item = order.items.find(i => i.id === itemId);
    if (!item) throw new NotFoundException('Order item not found');

    // 6. Guard: item already cancelled
    if (item.status === 'cancelled') {
      throw new BadRequestException('Món này đã được hủy rồi.');
    }

    // 7. STRICT: Only pending items can be cancelled (for ALL roles)
    if (item.status !== 'pending') {
      throw new BadRequestException('Chỉ có thể hủy món chưa được xác nhận (trạng thái "Chờ xác nhận").');
    }

    // 8. Execute cancellation in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Cancel the item
      await tx.orderItem.update({
        where: { id: itemId },
        data: { status: 'cancelled' },
      });

      // Re-fetch all items to recalculate total and derive order status
      const remainingItems = await tx.orderItem.findMany({ where: { orderId } });
      const newTotal = this.calcTotal(remainingItems);
      const newOrderStatus = this.computeOrderStatus(remainingItems);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { totalAmount: Math.max(0, newTotal), status: newOrderStatus },
        include: this.fullInclude(),
      });

      return updatedOrder;
    }, { timeout: 20000 });

    // 9. Socket emissions
    this.orderGateway.emitOrderItemCancelled({
      orderId,
      itemId,
      tableId: order.tableId,
      itemName: item.name,
      reason,
    });

    this.orderGateway.emitOrderUpdated(result);

    this.orderGateway.emitCustomerActivity({
      tableId: order.tableId,
      tableName: order.table?.name || `Table ${order.tableId}`,
      type: 'ITEM_CANCELLED',
      description: `Hủy món: ${item.name} (x${item.quantity})`,
      metadata: { orderId, itemId, itemName: item.name, reason },
    });

    // 10. Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: 'CANCEL_ORDER_ITEM',
        tableId: order.tableId,
        metadata: { orderId, itemId, itemName: item.name, role, reason },
      },
    });

    return result;
  }

  async updateItemProperties(
    orderId: string,
    itemId: string,
    quantity: number,
    note: string,
    user?: any,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        table: true,
        session: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (order.status === 'cancelled') {
      throw new BadRequestException('Không thể chỉnh sửa món trong đơn đã hủy');
    }

    if (order.session && order.session.endedAt) {
      throw new BadRequestException('Phiên đã kết thúc. Không thể chỉnh sửa món.');
    }

    if (order.table && (order.table as any).isLocked) {
      throw new BadRequestException('Bàn đang bị khóa. Không thể chỉnh sửa món.');
    }

    const item = order.items.find(i => i.id === itemId);
    if (!item) throw new NotFoundException('Order item not found');

    if (item.status !== 'pending') {
      throw new BadRequestException('Chỉ có thể chỉnh sửa số lượng hoặc ghi chú của món chưa được xác nhận (trạng thái "Chờ xác nhận").');
    }

    if (quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0. Để xóa món, vui lòng chọn Hủy món.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: { quantity, note },
      });

      const freshItems = await tx.orderItem.findMany({ where: { orderId } });
      const newOrderStatus = this.computeOrderStatus(freshItems);
      const newTotal = this.calcTotal(freshItems);

      return tx.order.update({
        where: { id: orderId },
        data: { status: newOrderStatus, totalAmount: newTotal },
        include: this.fullInclude(),
      });
    }, { timeout: 20000 });

    this.orderGateway.server.to('service').emit('tableUpdated', order.tableId);
    this.orderGateway.emitOrderUpdated(result);

    await this.prisma.auditLog.create({
      data: {
        userId: user?.id || null,
        action: 'UPDATE_ITEM_PROPERTIES',
        tableId: order.tableId,
        metadata: {
          orderId,
          itemId,
          itemName: item.name,
          oldQuantity: item.quantity,
          newQuantity: quantity,
          oldNote: item.note,
          newNote: note,
        },
      },
    });

    return result;
  }
}
