import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../config/jwt.config';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY) config: ConfigType<typeof jwtConfig>,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.secret,
      ignoreExpiration: false,
    } as any);
  }

  async validate({ sub }: { sub: number }) {
    return await this.authService.findUserById(sub);
  }
}
