import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateImageItemDto } from './dto/create-image-item.dto';
import { UpdateImageItemDto } from './dto/update-image-item.dto';

@Injectable()
export class ImageItemsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateImageItemDto) {
    return this.prisma.imageItem.create({ data: { menu: { connect: { id: dto.menuId } }, image: dto.image } });
  }

  findAll() {
    return this.prisma.imageItem.findMany({ include: { menu: true } });
  }

  async findOne(id: number) {
    const image = await this.prisma.imageItem.findUnique({ where: { id } });
    if (!image) throw new NotFoundException('Image item not found');
    return image;
  }

  async update(id: number, dto: UpdateImageItemDto) {
    await this.findOne(id);
    return this.prisma.imageItem.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.imageItem.delete({ where: { id } });
  }
}

