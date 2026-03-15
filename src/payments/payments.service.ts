import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
}

