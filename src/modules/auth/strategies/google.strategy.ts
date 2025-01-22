import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleOauthConfig from '../config/google-oauth.config';
import { AuthService } from '../services/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  private logger = new Logger(GoogleStrategy.name);
  constructor(
    @Inject(googleOauthConfig.KEY)
    googleConfig: ConfigType<typeof googleOauthConfig>,
    private authService: AuthService,
  ) {
    super({
      clientID: googleConfig.clientId,
      clientSecret: googleConfig.clientSecret,
      callbackURL: googleConfig.callbackUrl,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    this.logger.log('completing oauth2 request');
    let existingUser = await this.authService.findUserByCredential(profile.id);
    if (!existingUser) {
      existingUser = await this.authService.createNewUser(
        profile.id,
        refreshToken,
        'google',
        accessToken,
        {
          email: profile.emails?.[0].value ?? '',
          names: profile.displayName,
          imageUrl: profile.photos?.[0].value,
        },
      );
    } else {
      await this.authService.updateCredentialAccessToken(
        refreshToken,
        profile.id,
        accessToken,
      );
      this.logger.log('updated user credential');
    }
    return done(null, existingUser);
  }
}
