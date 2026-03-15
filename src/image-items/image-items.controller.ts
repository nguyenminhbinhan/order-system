import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ImageItemsService } from './image-items.service';
import { CreateImageItemDto } from './dto/create-image-item.dto';
import { UpdateImageItemDto } from './dto/update-image-item.dto';

@Controller('image-items')
export class ImageItemsController {
  constructor(private readonly imageItemsService: ImageItemsService) {}

  @Post()
  create(@Body() dto: CreateImageItemDto) {
    return this.imageItemsService.create(dto);
  }

  @Get()
  findAll() {
    return this.imageItemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.imageItemsService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateImageItemDto) {
    return this.imageItemsService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.imageItemsService.remove(Number(id));
  }
}

