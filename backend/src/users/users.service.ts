import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          name: createUserDto.name,
          role: createUserDto.role,
          email: createUserDto.email,
          password: hashedPassword,
          address: createUserDto.address || 'N/A',
          phone: createUserDto.phone || '',
          contractType: createUserDto.contractType || 'monthly',
          status: createUserDto.status || 'active',
        },
      });
    } catch (error) {
      throw new BadRequestException('Could not create user');
    }
  }

  async findAll() {
    return this.prisma.user.findMany({ where: { isDeleted: false }, include: { menuItems: true } });
  }

  async findOne(id: string) {
    const user: any = await this.prisma.user.findUnique({ where: { id }, include: { menuItems: true } });
    if (!user || user.isDeleted) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async findByEmail(email: string) {
    const user: any = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.isDeleted) return null;
    return user;
  }

  async validatePassword(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user) return false;
    return bcrypt.compare(password, user.password);
  }

  async login(email: string, password: string) {
    const user: any = await this.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new BadRequestException('Invalid credentials');
    return { id: user.id, name: user.name, role: user.role, email: user.email };
  }
}

