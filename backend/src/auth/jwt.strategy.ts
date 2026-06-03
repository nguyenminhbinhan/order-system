import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants } from './constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  /**
   * CRITICAL FIX: Return the JWT payload directly instead of querying DB.
   *
   * Previous behavior: Called usersService.findOne(payload.sub) on EVERY request
   * → Extra DB roundtrip per API call
   * → If DB is slow/down, ALL requests fail with 401
   * → Returns full Prisma user (including password hash!)
   *
   * New behavior: Trust the signed JWT payload. The token is cryptographically
   * verified by Passport, so the payload is trustworthy.
   * Role freshness is guaranteed by the refresh endpoint (which re-fetches from DB).
   */
  async validate(payload: any) {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
