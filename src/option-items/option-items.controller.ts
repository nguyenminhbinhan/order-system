import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { OptionItemsService } from './option-items.service';
import { CreateOptionItemDto } from './dto/create-option-item.dto';
import { UpdateOptionItemDto } from './dto/update-option-item.dto';

@Controller('option-items')
export class OptionItemsController {
  constructor(private readonly optionItemsService: OptionItemsService) {}

  @Post()
  create(@Body() dto: CreateOptionItemDto) {
    return this.optionItemsService.create(dto);
  }

  @Get()
  findAll() {
    return this.optionItemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.optionItemsService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOptionItemDto) {
    return this.optionItemsService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.optionItemsService.remove(Number(id));
  }
}

