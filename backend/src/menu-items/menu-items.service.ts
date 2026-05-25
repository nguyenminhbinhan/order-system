import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { StorageService } from './storage.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class MenuItemsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateMenuItemDto) {
    const item = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        available: dto.available ?? true,
        user: { connect: { id: dto.userId } },
        category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
        images: dto.imageFilename ? {
          create: {
            image: dto.imageFilename
          }
        } : undefined,
        imageFilename: dto.imageFilename
      },
    });
    await this.cacheManager.del('menu:all');
    return item;
  }

  async findAll() {
    const cachedMenu = await this.cacheManager.get('menu:all');
    if (cachedMenu) {
      return cachedMenu;
    }
    const menu = await this.prisma.menuItem.findMany({ where: { isDeleted: false }, include: { user: true, category: true, images: true, options: true } });
    await this.cacheManager.set('menu:all', menu, 60000); // 60s TTL
    return menu;
  }

  async findOne(id: string) {
    const item: any = await this.prisma.menuItem.findUnique({
      where: { id },
      include: { user: true, category: true, images: true, options: true },
    });
    if (!item || item.isDeleted) throw new NotFoundException('Menu item not found');
    return item;
  }

  async update(id: string, dto: UpdateMenuItemDto) {
    const existing = await this.findOne(id);
    
    if (dto.imageFilename && existing.imageFilename) {
      // Clean old file using the storage service
      await this.storageService.deleteFile(existing.imageFilename);
    }

    const data: any = {
      name: dto.name,
      description: dto.description,
      price: dto.price,
      available: dto.available,
      imageFilename: dto.imageFilename
    };

    if (dto.userId) {
      data.user = { connect: { id: dto.userId } };
    }

    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }

    // If new image was uploaded, also sync the ImageItem relation table
    if (dto.imageFilename) {
      // Delete all old ImageItem records for this menu item, then create one fresh one
      await this.prisma.imageItem.deleteMany({ where: { menuId: id } });
      data.images = {
        create: { image: dto.imageFilename }
      };
    }
    
    const item = await this.prisma.menuItem.update({
      where: { id },
      data,
      include: { user: true, category: true, images: true, options: true },
    });
    

    await this.cacheManager.del('menu:all');
    return item;
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    
    // Delete image file using the storage service
    if (existing && existing.imageFilename) {
      await this.storageService.deleteFile(existing.imageFilename);
    }

    const item = await this.prisma.menuItem.update({
      where: { id },
      data: { isDeleted: true },
    });
    
    await this.cacheManager.del('menu:all');
    return item;
  }
}

