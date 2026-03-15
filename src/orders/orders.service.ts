import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateOrderDto) {
    return this.prisma.order.create({
      data: {
        table: { connect: { id: dto.tableId } },
        totalAmount: dto.totalAmount,
      },
      include: { table: true, items: true, payments: true },
    });
  }

  findAll() {
    return this.prisma.order.findMany({ include: { table: true, items: true, payments: true } });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { table: true, items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    await this.findOne(id);
    return this.prisma.order.update({ where: { id }, data: { ...dto }, include: { table: true, items: true, payments: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.order.delete({ where: { id } });
  }
}

