import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('menu-items')
export class MenuItemsController {
    constructor(private readonly menuItemsService: MenuItemsService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(@Body() dto: CreateMenuItemDto) {
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
    @UseGuards(JwtAuthGuard)
    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
        return this.menuItemsService.update(id, dto);
    }
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.menuItemsService.remove(id);
    }
}

