import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService, private jwtService: JwtService) {}

  async register(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.login({ id: user.id, email: user.email, role: user.role });
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const valid = await this.usersService.validatePassword(email, password);
    if (!valid) return null;

    const { password: pw, ...rest } = user;
    return rest;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateUserByPayload(payload: any) {
    return this.usersService.findOne(payload.sub);
  }
}

