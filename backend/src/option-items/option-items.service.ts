import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateOptionItemDto } from './dto/create-option-item.dto';
import { UpdateOptionItemDto } from './dto/update-option-item.dto';

@Injectable()
export class OptionItemsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateOptionItemDto) {
    return this.prisma.optionItem.create({ data: { menu: { connect: { id: dto.menuId } }, name: dto.name, required: dto.required } });
  }

  findAll() {
    return this.prisma.optionItem.findMany({ include: { menu: true } });
  }

  async findOne(id: number) {
    const item = await this.prisma.optionItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Option item not found');
    return item;
  }

  async update(id: number, dto: UpdateOptionItemDto) {
    await this.findOne(id);
    return this.prisma.optionItem.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.optionItem.delete({ where: { id } });
  }
}

