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
import { ConnectionController } from './controllers/auth/connection.controller';
import { ConnectionService } from './services/connection.service';
import { WebhookModule } from '@modules/webhook';
import { CampaignModule } from '@modules/campaign';

@Module({
  imports: [
    DrizzleModule,
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forFeature(googleOauthConfig),
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(refreshConfig),
    WebhookModule,
    CampaignModule,
  ],
  providers: [
    AuthService,
    ConnectionService,
    GoogleStrategy,
    JwtStrategy,
    RevokeStrategy,
    UserService,
    QueryUrlJwtStrategy,
    RefreshStrategy,
  ],
  controllers: [AuthController, UserController, ConnectionController],
})
export class AuthModule {}
