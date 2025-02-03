import { USER_DELETE_REQUESTED, USER_DELETED } from '@events/user';
import { Public, User } from '@modules/auth/decorators';
import {
  AccountDeletionRequestedEvent,
  UserDeletedEvent,
} from '@modules/auth/events';
import { GoogleGuard, RefreshGuard, RevokeGuard } from '@modules/auth/guards';
import { AuthService } from '@modules/auth/services';
import {
  Controller,
  Delete,
  Get,
  Ip,
  Logger,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiBearerAuth, ApiOAuth2 } from '@nestjs/swagger';
import { UserInfo } from '@schemas/users';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  private logger = new Logger(AuthController.name);
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Delete()
  async removeUserAccount(@User() { id }: UserInfo) {
    await this.eventEmitter.emitAsync(
      USER_DELETE_REQUESTED,
      new AccountDeletionRequestedEvent(id),
    );
    const result = await this.authService.removeUser(id);
    if (result) {
      void this.eventEmitter.emitAsync(USER_DELETED, new UserDeletedEvent(id));
      return;
    }
    this.logger.warn('Unexpeted result from user account deletion');
  }

  @Get('revoke-token')
  @Public()
  @ApiBearerAuth()
  @UseGuards(RevokeGuard)
  async handleTokenRevoke(@Req() req: Request, @User() { id }: UserInfo) {
    const { access, refresh } = req['tokens'];
    return await this.authService.revokeTokenPair(access, refresh, id);
  }

  @Public()
  @Get('google')
  @ApiOAuth2(['profile,email'], 'google')
  @UseGuards(GoogleGuard)
  handleGoogleSignIn() {}

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleGuard)
  async completeGoogleSignIn(
    @Ip() ip: string,
    @User() user: UserInfo,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.generateTokenPair(ip, {
        // aud: this.configService.getOrThrow<string>('VALID_AUDIENCE'),
        email: user.email,
        name: user.names,
        sub: user.id,
        image: user.imageUrl,
      });

    res.redirect(
      new URL(
        `/auth/oauth2/callback?access=${accessToken}&refresh=${refreshToken}`,
        this.configService.getOrThrow<string>('FRONT_END_ORIGIN'),
      ).toString(),
    );
  }

  @Get('refresh')
  @Public()
  @UseGuards(RefreshGuard)
  async handleAccessTokenRefresh(
    @Req() request: Request,
    @Ip() ip: string,
    @User() user: UserInfo,
  ) {
    const existingTokenPair = request['tokens'];
    const { accessToken, refreshToken } =
      await this.authService.generateTokenPair(
        ip,
        {
          aud: this.configService.getOrThrow<string>('VALID_AUDIENCE'),
          email: user.email,
          name: user.names,
          sub: user.id,
          image: user.imageUrl,
        },
        existingTokenPair,
      );

    return { access: accessToken, refresh: refreshToken };
  }
}
