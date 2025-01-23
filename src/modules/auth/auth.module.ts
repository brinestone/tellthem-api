import { DrizzleModule } from '@modules/drizzle';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import googleOauthConfig from './config/google-oauth.config';
import jwtConfig from './config/jwt.config';
import refreshConfig from './config/refresh.config';
import { AuthController } from './controllers/auth/auth.controller';
import { AuthService } from './services/auth.service';
import { QueryUrlJwtStrategy, RevokeStrategy } from './strategies';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { UserController } from './controllers/auth/user.controller';
import { UserService } from './services';

@Module({
  imports: [
    DrizzleModule,
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(googleOauthConfig),
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(refreshConfig),
  ],
  providers: [
    AuthService,
    GoogleStrategy,
    JwtStrategy,
    RevokeStrategy,
    UserService,
    QueryUrlJwtStrategy,
    RefreshStrategy,
  ],
  controllers: [AuthController, UserController],
})
export class AuthModule {}
