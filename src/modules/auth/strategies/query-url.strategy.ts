import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../config/jwt.config';
import { AuthService } from '../services';

@Injectable()
export class QueryUrlJwtStrategy extends PassportStrategy(
  Strategy,
  'query-url',
) {
  constructor(
    @Inject(jwtConfig.KEY) config: ConfigType<typeof jwtConfig>,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromUrlQueryParameter('auth_token'),
      secretOrKey: config.secret,
      ignoreExpiration: false,
    } as any);
  }

  async validate({ sub }: { sub: number }) {
    return await this.authService.findUserById(sub);
  }
}
