import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }

  // ==========================================
  // FAKE QR PAYMENT FLOW — Public endpoints
  // These are accessed by customers on their phones
  // after scanning the QR code on the bill.
  // NO authentication required.
  // ==========================================

  /**
   * GET /payments/:id/info
   * Public — Customer views payment details on their phone.
   * Returns: restaurant info, table number, items, total amount.
   */
  @Get(':id/info')
  getPaymentInfo(@Param('id') id: string) {
    return this.paymentsService.getPaymentInfo(id);
  }

  /**
   * POST /payments/:id/confirm
   * Public — Customer confirms payment on their phone.
   * Executes full checkout: mark paid, close session, reset table.
   */
  @Post(':id/confirm')
  confirmPayment(@Param('id') id: string) {
    return this.paymentsService.confirmPayment(id);
  }
}
