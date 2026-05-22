import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { OrderGateway } from '../socket/order.gateway';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderGateway: OrderGateway,
  ) {}

  // ==========================================
  // EXISTING CRUD (preserved for backward compat)
  // ==========================================

  create(dto: CreatePaymentDto) {
    return this.prisma.payment.create({ data: {
      order: { connect: { id: dto.orderId } },
      method: dto.method,
      amount: dto.amount,
      status: dto.status || 'pending',
      image: dto.image,
    }});
  }

  findAll() {
    return this.prisma.payment.findMany({ include: { order: true } });
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: { order: true } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async update(id: string, dto: UpdatePaymentDto) {
    await this.findOne(id);
    return this.prisma.payment.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.payment.delete({ where: { id } });
  }

  // ==========================================
  // FAKE QR PAYMENT FLOW — Internal payment lifecycle
  // ==========================================

  /**
   * Create a payment record for a table's active session.
   * Called by the waiter when they click "Tạo QR thanh toán".
   * 
   * Aggregates all non-cancelled orders in the active session,
   * creates a Payment record linked to the first order,
   * and returns the paymentId for QR code generation.
   */
  async createForSession(tableId: number) {
    const session = await this.prisma.tableSession.findFirst({
      where: { tableId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      include: {
        table: true,
        orders: {
          where: { status: { notIn: ['cancelled'] } },
          include: { items: { include: { menuItem: true } } }
        }
      }
    });

    if (!session) {
      throw new BadRequestException('NO_ACTIVE_SESSION');
    }

    if (session.orders.length === 0) {
      throw new BadRequestException('Bàn chưa có order');
    }

    // Calculate total of only ready items
    let subtotal = 0;
    for (const order of session.orders) {
      for (const item of order.items) {
        if (item.status === 'ready') {
          subtotal += Number(item.price || 0) * item.quantity;
        }
      }
    }

    if (subtotal === 0) {
      throw new BadRequestException('Chưa có món nào hoàn tất để thanh toán');
    }

    // Check if there's already a pending payment for this session
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        order: { sessionId: session.id },
        status: 'pending',
      }
    });

    if (existingPayment) {
      if (Number(existingPayment.amount) !== subtotal) {
        await this.prisma.payment.update({
          where: { id: existingPayment.id },
          data: { amount: subtotal }
        });
      }
      // Return existing pending payment instead of creating duplicate
      return {
        paymentId: existingPayment.id,
        amount: subtotal,
        tableId,
        sessionId: session.id,
        existing: true,
      };
    }

    // Create payment linked to first order (session-level payment concept)
    const firstOrder = session.orders[0];
    const payment = await this.prisma.payment.create({
      data: {
        order: { connect: { id: firstOrder.id } },
        method: 'bank', // QR payment method
        amount: subtotal,
        status: 'pending',
      }
    });

    // Update table status to indicate payment is in progress
    await this.prisma.table.update({
      where: { id: tableId },
      data: { status: 'needs_payment' }
    });

    this.orderGateway.server.to('service').emit('tableUpdated', tableId);

    return {
      paymentId: payment.id,
      amount: subtotal,
      tableId,
      sessionId: session.id,
      existing: false,
    };
  }

  /**
   * PUBLIC endpoint — Get payment info for customer payment page.
   * No auth required — customer accesses via QR scan on their phone.
   * 
   * Returns all information needed to render the payment page:
   * restaurant info, table number, order summary, amount.
   */
  async getPaymentInfo(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            table: true,
            session: {
              include: {
                table: true,
                orders: {
                  where: { status: { notIn: ['cancelled'] } },
                  include: {
                    items: { include: { menuItem: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }

    // Build aggregated item list from all session orders
    const session = payment.order.session;
    const items: { name: string; price: number; quantity: number; note: string }[] = [];

    if (session) {
      const itemMap = new Map<string, { name: string; price: number; quantity: number; note: string }>();
      
      for (const order of session.orders) {
        for (const item of order.items) {
          if (item.status !== 'ready') continue;
          const key = `${item.menuItemId}-${item.note || ''}`;
          if (itemMap.has(key)) {
            itemMap.get(key)!.quantity += item.quantity;
          } else {
            itemMap.set(key, {
              name: item.name || item.menuItem?.name || 'Item',
              price: Number(item.price),
              quantity: item.quantity,
              note: item.note || '',
            });
          }
        }
      }

      items.push(...Array.from(itemMap.values()));
    }

    const tableName = payment.order.table?.name?.replace('Table', '').trim() || String(payment.order.tableId);

    return {
      paymentId: payment.id,
      status: payment.status,
      amount: Number(payment.amount),
      method: payment.method,
      paidAt: payment.paidAt,
      tableId: payment.order.tableId,
      tableNumber: tableName,
      sessionId: session?.id,
      startedAt: session?.startedAt,
      items,
      orderCount: session?.orders?.length || 0,
      // Restaurant info (hardcoded for this project)
      restaurant: {
        name: 'Quán ăn Bình An',
        address: '70 Hoàng Dư Khương, Cẩm Lệ, Đà Nẵng',
        phone: '0935124062',
        email: 'annguyen020403@gmail.com',
      }
    };
  }

  /**
   * PUBLIC endpoint — Customer confirms payment.
   * No auth required — customer presses button on their phone.
   * 
   * Executes the FULL checkout lifecycle:
   * 1. Validates payment exists and is pending
   * 2. Marks payment as PAID
   * 3. Marks all session orders as completed
   * 4. Closes the session
   * 5. Resets table to EMPTY
   * 6. Emits socket events to all parties
   * 
   * Guards:
   * - Double-confirmation prevention (already paid check)
   * - Invalid payment ID
   * - Session already closed
   */
  async confirmPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            session: {
              include: { orders: true }
            }
          }
        }
      }
    });

    if (!payment) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }

    const session = payment.order.session;
    if (!session) {
      throw new BadRequestException('NO_SESSION_FOUND');
    }

    if (payment.status === 'paid') {
      // Already paid — return success without re-processing
      return {
        success: true,
        alreadyPaid: true,
        paidAt: payment.paidAt,
        amount: Number(payment.amount),
        tableId: payment.order.tableId,
        sessionId: session.id,
      };
    }

    if (payment.status === 'failed') {
      throw new BadRequestException('PAYMENT_FAILED');
    }

    if (session.endedAt) {
      throw new BadRequestException('SESSION_ALREADY_CLOSED');
    }

    const tableId = payment.order.tableId;
    const amount = Number(payment.amount);

    const paidAt = new Date();

    // Execute full checkout in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Fetch session with orders and ready items
      const fullSession = await tx.tableSession.findUnique({
        where: { id: session.id },
        include: {
          table: true,
          orders: {
            where: { status: { not: 'cancelled' } },
            include: {
              items: { include: { menuItem: true } }
            }
          }
        }
      });

      if (!fullSession) {
        throw new BadRequestException('NO_SESSION_FOUND');
      }

      // Build aggregated item list of only ready items, excluding cancelled items/orders
      const itemMap = new Map<string, { name: string; price: number; quantity: number; note: string }>();

      for (const order of fullSession.orders) {
        for (const item of order.items) {
          if (item.status === 'ready') {
            const price = Number(item.price || 0);
            const key = `${item.menuItemId}-${item.note || ''}`;

            if (itemMap.has(key)) {
              itemMap.get(key)!.quantity += item.quantity;
            } else {
              itemMap.set(key, {
                name: item.name || item.menuItem?.name || 'Món ăn',
                price,
                quantity: item.quantity,
                note: item.note || '',
              });
            }
          }
        }
      }

      const items = Array.from(itemMap.values());
      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      const billSnapshot = {
        tableId: fullSession.tableId,
        tableNumber: fullSession.table?.name?.replace('Table', '').trim() || String(fullSession.tableId),
        tableName: fullSession.table?.name || `Bàn ${fullSession.tableId}`,
        sessionId: fullSession.id,
        startedAt: fullSession.startedAt,
        paidAt,
        items,
        subtotal,
        total: subtotal,
      };

      // 1. Mark payment as PAID
      await tx.payment.update({
        where: { id },
        data: { status: 'paid', paidAt }
      });

      // 3. Close session
      await tx.tableSession.update({
        where: { id: session.id },
        data: {
          endedAt: paidAt,
          paidAt,
          totalAmount: subtotal,
          billSnapshot: billSnapshot as any,
        }
      });

      // 4. Reset table to EMPTY
      await tx.table.update({
        where: { id: tableId },
        data: { status: 'empty' }
      });

      // 5. Clean up messages
      await tx.message.deleteMany({
        where: { tableId }
      });

      // 6. Audit log
      await tx.auditLog.create({
        data: {
          userId: null, // Customer payment — no authenticated user
          action: 'QR_PAYMENT_CONFIRMED',
          tableId,
          metadata: { paymentId: id, amount: subtotal, sessionId: session.id }
        }
      });
    }, { timeout: 20000 });

    // 7. Emit socket events via centralized gateway method
    this.orderGateway.emitPaymentCompleted({ tableId, paymentId: id, sessionId: session.id });

    // 8. Customer activity notification (Fix #3)
    const table = await this.prisma.table.findUnique({ where: { id: tableId } });
    this.orderGateway.emitCustomerActivity({
      tableId,
      tableName: table?.name || `Table ${tableId}`,
      type: 'PAYMENT_CONFIRMED',
      description: `Khách đã thanh toán ${new Intl.NumberFormat('vi-VN').format(amount)} ₫`,
      metadata: { paymentId: id, amount },
    });

    return {
      success: true,
      alreadyPaid: false,
      paidAt,
      amount,
      tableId,
      sessionId: session.id,
    };
  }
}
