import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTableDto) {
    return this.prisma.table.create({ data: dto });
  }

  findAll() {
    return this.prisma.table.findMany({ include: { orders: true } });
  }

  async findOne(id: string) {
    const table = await this.prisma.table.findUnique({ where: { id }, include: { orders: true } });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  async update(id: string, dto: UpdateTableDto) {
    await this.findOne(id);
    return this.prisma.table.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.table.delete({ where: { id } });
  }
}

