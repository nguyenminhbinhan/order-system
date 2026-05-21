import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { jwtConstants } from './constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private usersService: UsersService, private jwtService: JwtService) {}

  async register(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.login({ id: user.id, email: user.email, role: user.role, name: user.name });
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
    // Always build payload from the user object passed in (fresh from DB via validateUser)
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    this.logger.log(`LOGIN: user=${user.email}, role=${user.role}, id=${user.id}`);

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: jwtConstants.accessTokenExpiry }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: jwtConstants.refreshTokenExpiry }),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    };
  }

  async refresh(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      
      // CRITICAL: Re-fetch from DB to get current role
      const user = await this.usersService.findOne(decoded.sub);
      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      this.logger.log(`REFRESH: user=${user.email}, role=${user.role} (token had role=${decoded.role})`);

      const newPayload = { sub: user.id, email: user.email, role: user.role };
      return {
        access_token: this.jwtService.sign(newPayload, { expiresIn: jwtConstants.accessTokenExpiry }),
        refresh_token: this.jwtService.sign(newPayload, { expiresIn: jwtConstants.refreshTokenExpiry }),
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        },
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      this.logger.warn(`REFRESH FAILED: ${e.message}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const { password, ...rest } = user;
    return rest;
  }
}
