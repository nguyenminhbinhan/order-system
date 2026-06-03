import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MenuItemsService } from './menu-items.service';
import { StorageService } from './storage.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('menu-items')
export class MenuItemsController {
  constructor(
    private readonly menuItemsService: MenuItemsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @UseInterceptors(FileInterceptor('image'))
  async create(@UploadedFile() file: any, @Body() dto: CreateMenuItemDto) {
    // Manual fallback for multipart/form-data
    if (typeof dto.price === 'string') {
      dto.price = Number(dto.price);
    }
    if (typeof dto.available === 'string') {
      dto.available = dto.available === 'true';
    }

    if (file) {
      dto.imageFilename = await this.storageService.saveFile(file);
    }
    return this.menuItemsService.create(dto);
  }

  // @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.menuItemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.menuItemsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Put(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() dto: UpdateMenuItemDto,
  ) {
    // Manual fallback for multipart/form-data
    if (dto.price && typeof dto.price === 'string') {
      dto.price = Number(dto.price);
    }
    if (dto.available && typeof dto.available === 'string') {
      dto.available = dto.available === 'true';
    }

    if (file) {
      dto.imageFilename = await this.storageService.saveFile(file);
    }
    return this.menuItemsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menuItemsService.remove(id);
  }
}
