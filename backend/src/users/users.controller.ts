import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: any) {
    if (dto.role === 'admin' && req.user?.role !== 'admin') {
      throw new UnauthorizedException('Managers cannot create admin accounts');
    }
    return this.usersService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    if (dto.role === 'admin' && req.user?.role !== 'admin') {
      throw new UnauthorizedException('Managers cannot grant admin roles');
    }
    const existingUser = await this.usersService.findOne(id);
    if (existingUser.role === 'admin' && req.user?.role !== 'admin') {
      throw new UnauthorizedException('Managers cannot modify admin accounts');
    }
    return this.usersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const existingUser = await this.usersService.findOne(id);
    if (existingUser.role === 'admin' && req.user?.role !== 'admin') {
      throw new UnauthorizedException('Managers cannot delete admin accounts');
    }
    return this.usersService.remove(id);
  }
}

