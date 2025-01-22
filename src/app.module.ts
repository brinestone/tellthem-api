import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from '@modules/drizzle';
import { AuthModule } from './modules/auth/auth.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { AuthService } from './modules/auth/services/auth.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import jwtConfig from '@modules/auth/config/jwt.config';

@Module({
  imports: [
    JwtModule.registerAsync(jwtConfig.asProvider()),
    ConfigModule.forRoot(),
    DrizzleModule,
    AuthModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, AuthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
