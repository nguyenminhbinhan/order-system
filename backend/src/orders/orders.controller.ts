import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, ForbiddenException, Req, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * ORDER STATUS FLOW (Simplified Per-Item Lifecycle)
 * 
 * ITEM:  pending → confirmed → ready
 *             ↓
 *          cancelled (from pending or confirmed)
 * 
 * ORDER: derived from item statuses (computeOrderStatus)
 * 
 * - Waiter confirms items → confirmed (sent to kitchen)
 * - Kitchen marks ready → cooked
 */

// Valid ORDER status transitions (for legacy update endpoint)
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: ['cancelled'],
  cancelled: [],
};

// Valid ITEM status transitions
const ITEM_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'cancelled'],
  ready: [],
  cancelled: [],
};

// Role permissions
const ROLE_STATUS_PERMISSIONS: Record<string, string[]> = {
  kitchen:  [],
  service:  ['confirmed', 'ready', 'cancelled'],
  admin:    ['confirmed', 'ready', 'cancelled'],
  manager:  ['confirmed', 'ready', 'cancelled'],
};

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: any) {
    const sessionToken = req.headers['x-session-token'] as string | undefined;
    return this.ordersService.create(dto, req.user, sessionToken);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service', 'kitchen')
  @Get()
  findAll(@Query('activeSessionOnly') activeSessionOnly?: string) {
    return this.ordersService.findAll(activeSessionOnly === 'true');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service', 'kitchen')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateOrderDto, @Req() req: any) {
    const userRole = req.user?.role;

    if (dto.status) {
      // 1. Check role permission for this status
      const allowedStatuses = ROLE_STATUS_PERMISSIONS[userRole] || [];
      if (!allowedStatuses.includes(dto.status)) {
        throw new ForbiddenException(
          `Role '${userRole}' cannot set status to '${dto.status}'.`
        );
      }

      // 2. Check valid status transition
      const order = await this.ordersService.findOne(id);
      const validNextStatuses = STATUS_TRANSITIONS[order.status] || [];
      if (!validNextStatuses.includes(dto.status)) {
        throw new ForbiddenException(
          `Invalid transition: '${order.status}' → '${dto.status}'.`
        );
      }
    }

    return this.ordersService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  // ==========================================
  // ORDER-LEVEL CONFIRMATION (legacy, still works)
  // ==========================================

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  confirmOrder(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.confirmOrder(id, req.user);
  }

  @Post(':id/confirm-with-edits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  confirmWithEdits(@Param('id') id: string, @Body() dto: ConfirmOrderDto, @Req() req: any) {
    return this.ordersService.confirmWithEdits(id, dto.items, req.user);
  }

  // ==========================================
  // PER-ITEM CONFIRMATION (Feature #2)
  // ==========================================

  /**
   * Confirm specific items within an order.
   * Body: { itemIds: string[] }
   */
  @Post(':id/items/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  confirmItems(
    @Param('id') id: string,
    @Body() body: { itemIds: string[] },
    @Req() req: any,
  ) {
    return this.ordersService.confirmItems(id, body.itemIds, req.user);
  }

  // ==========================================
  // PER-ITEM STATUS UPDATE (Feature #2)
  // ==========================================

  /**
   * Update a single item's status.
   * Body: { status: string }
   */
  @Post(':id/items/:itemId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  updateItemStatus(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    return this.ordersService.updateItemStatus(orderId, itemId, body.status, req.user);
  }

  // ==========================================
  // ITEM CANCELLATION
  // ==========================================

  /**
   * Cancel a specific order item.
   * Customer calls without auth (role defaults to 'customer').
   * Staff calls with JWT for audit trail.
   * 
   * STRICT: Only 'pending' items can be cancelled, regardless of role.
   */
  @Post(':orderId/items/:itemId/cancel')
  cancelOrderItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() body: { reason?: string; role?: string },
    @Req() req: any,
  ) {
    const role = req.user?.role || body.role || 'customer';
    const userId = req.user?.id || null;
    return this.ordersService.cancelOrderItem(orderId, itemId, role, body.reason, userId);
  }

  @Put(':id/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  updateItemProperties(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number; note: string },
    @Req() req: any,
  ) {
    return this.ordersService.updateItemProperties(orderId, itemId, body.quantity, body.note, req.user);
  }
}
