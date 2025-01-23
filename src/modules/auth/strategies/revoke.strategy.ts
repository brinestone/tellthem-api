import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../services';
import { ConfigService, ConfigType } from '@nestjs/config';
import refreshConfig from '../config/refresh.config';
import { Request } from 'express';

@Injectable()
export class RevokeStrategy extends PassportStrategy(Strategy, 'revoke') {
  private logger = new Logger(RevokeStrategy.name);

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    @Inject(refreshConfig.KEY) config: ConfigType<typeof refreshConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromUrlQueryParameter('token'),
      secretOrKey: config.secret,
      ignoreExpiration: false,
      passReqToCallback: true,
    } as any);
  }
  async validate(
    req: Request,
    payload: { tokenId: string; value: string },
  ): Promise<unknown> {
    console.log(payload);
    const ip = String(req.ip);
    this.logger.log('revoking token');
    const result = await this.authService.findExistingRefreshToken(
      ip,
      payload.tokenId,
      payload.value,
    );

    if (!result) {
      throw new ForbiddenException('token invalid or expired');
    }

    const { vw_refresh_tokens: refreshToken, access_tokens: accessToken } =
      result;

    const user = await this.authService.findUserById(refreshToken.user);
    if (!user) {
      return new ForbiddenException('user not found');
    }

    req['tokens'] = { access: accessToken.id, refresh: refreshToken.id };
    return user;
  }
}
