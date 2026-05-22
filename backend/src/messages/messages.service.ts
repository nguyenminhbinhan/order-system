import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { OrderGateway } from '../socket/order.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderGateway: OrderGateway,
  ) {}

  async create(dto: CreateMessageDto) {
    const table = await this.prisma.table.findUnique({ where: { id: dto.tableId } });
    if (!table) throw new NotFoundException('Table not found');

    const activeSession = await this.prisma.tableSession.findFirst({
      where: { tableId: dto.tableId, endedAt: null }
    });
    if (!activeSession) {
      throw new BadRequestException('Bàn hiện không có phiên hoạt động');
    }

    const message = await this.prisma.message.create({
      data: {
        tableId: dto.tableId,
        sender: dto.sender,
        content: dto.content,
      },
    });

    // Emit Socket Event
    this.orderGateway.server
      .to('service')
      .to(`table_${dto.tableId}`)
      .emit('newMessage', message);

    if (dto.sender === 'customer') {
      this.orderGateway.server.to('service').emit('tableNotification', {
        tableId: dto.tableId,
        type: 'NEW_MESSAGE',
        message: 'Khách gửi tin nhắn mới',
        createdAt: message.createdAt
      });
    }

    return message;
  }

  async findByTable(tableId: number) {
    const activeSession = await this.prisma.tableSession.findFirst({
      where: { tableId, endedAt: null }
    });
    if (!activeSession) {
      return [];
    }

    return this.prisma.message.findMany({
      where: { tableId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
