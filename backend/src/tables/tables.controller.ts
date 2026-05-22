import { Body, Controller, Delete, Get, Param, Post, Put, Patch, ParseIntPipe, UseGuards, Req, UnauthorizedException, ForbiddenException, Query } from '@nestjs/common';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post()
  create(@Body() dto: CreateTableDto) {
    return this.tablesService.create(dto);
  }

  @Get()
  findAll(@Query('includeDeleted') includeDeleted?: string) {
    const showDeleted = includeDeleted === 'true';
    return this.tablesService.findAll(showDeleted);
  }

  /**
   * Resolve a QR token to a table. Public endpoint (customer scans QR).
   * MUST be placed BEFORE the :id route to avoid parameter conflicts.
   */
  @Get('by-token/:token')
  findByToken(@Param('token') token: string) {
    return this.tablesService.findByToken(token);
  }

  /**
   * Check if a table has an active session. Public endpoint (customer page reload).
   * Returns session status for frontend state recovery.
   */
  @Get(':id/session-status')
  getSessionStatus(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.getSessionStatus(id);
  }

  @Get('sessions/:sessionId/bill-snapshot')
  getBillSnapshot(@Param('sessionId') sessionId: string) {
    return this.tablesService.getBillSnapshot(sessionId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.safeDeleteTable(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.restore(id);
  }

  @Post(':id/call-waiter')
  callWaiter(@Param('id') id: string, @Req() req: any) {
    return this.tablesService.callWaiter(+id, req.user);
  }

  @Post(':id/request-payment')
  requestPayment(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tablesService.requestPayment(id, req.user);
  }

  @Get(':id/orders')
  getActiveOrders(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.getActiveOrders(id);
  }

  @Post(':id/session')
  getOrCreateSessionToken(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.getOrCreateSessionToken(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  @Get(':id/preview-bill')
  async getPreviewBill(@Param('id', ParseIntPipe) id: number) {
    return await this.tablesService.getPreviewBill(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  @Post(':id/print-preview')
  printPreviewBill(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.printPreviewBill(id);
  }

  /**
   * Create a QR payment for a table's active session.
   * Returns paymentId for QR code generation on the bill.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  @Post(':id/create-payment')
  createPayment(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.createPaymentForTable(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  @Post(':id/checkout')
  checkout(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tablesService.checkout(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  @Post(':id/reset')
  forceReset(@Param('id', ParseIntPipe) id: number) {
    return this.tablesService.forceResetTable(id);
  }

  // ==========================================
  // TABLE LOCK/UNLOCK (Feature #3)
  // ==========================================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  @Post(':id/lock')
  lockTable(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tablesService.lockTable(id, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'service')
  @Post(':id/unlock')
  unlockTable(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.tablesService.unlockTable(id, req.user);
  }
}
