import { User } from '@modules/auth/decorators';
import { GoogleGuard } from '@modules/auth/guards';
import { RefreshGuard } from '@modules/auth/guards/refresh.guard';
import { AuthService } from '@modules/auth/services/auth.service';
import { Controller, Get, Ip, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserInfo } from '@schemas/users';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}
  @Get('google')
  @UseGuards(GoogleGuard)
  handleGoogleSignIn() {}

  @Get('google/callback')
  @UseGuards(GoogleGuard)
  async completeGoogleSignIn(
    @Ip() ip: string,
    @User() user: UserInfo,
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.generateTokenPair(ip, {
        aud: this.configService.getOrThrow<string>('VALID_AUDIENCE'),
        email: user.email,
        name: user.names,
        sub: user.id,
        image: user.imageUrl,
      });

    res.redirect(
      new URL(
        `/auth/oauth2/callback?access=${accessToken}&refresh=${refreshToken}`,
        this.configService.getOrThrow<string>('VALID_AUDIENCE'),
      ).toString(),
    );
  }

  @Get('refresh')
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
