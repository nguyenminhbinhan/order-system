import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuItemsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateMenuItemDto) {
    return this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        available: dto.available ?? true,
        user: { connect: { id: dto.userId } },
        category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      },
    });
  }

  findAll() {
    return this.prisma.menuItem.findMany({ include: { user: true, category: true, images: true, options: true } });
  }

  async findOne(id: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { user: true, category: true, images: true, options: true },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async update(id: string, dto: UpdateMenuItemDto) {
    await this.findOne(id);
    const data: any = {
      ...dto,
    };
    if (dto.userId) data.user = { connect: { id: dto.userId } };
    if (dto.categoryId) data.category = { connect: { id: dto.categoryId } };
    return this.prisma.menuItem.update({
      where: { id },
      data,
      include: { user: true, category: true, images: true, options: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.menuItem.delete({ where: { id } });
  }
}

