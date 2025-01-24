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
    );

    if (!result) {
      throw new ForbiddenException('token invalid or expired');
    }

    const { access_token: accessToken, user: userId } = result;

    const user = await this.authService.findUserById(userId);
    if (!user) {
      return new ForbiddenException('user not found');
    }

    req['tokens'] = { access: accessToken, refresh: payload.tokenId };
    return user;
  }
}
