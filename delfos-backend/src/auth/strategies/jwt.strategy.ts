import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly redisService: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    });
  }

  async validate(payload: any) {
    // Verificar se a sessão existe no Redis
    const sessionExists = await this.redisService.checkSession(payload.sub);
    if (!sessionExists) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      userType: payload.userType,
    };
  }
}
