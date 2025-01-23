import { AuthModule } from '@modules/auth';
import { JwtGuard } from '@modules/auth/guards/jwt.guard';
import { CampaignModule } from '@modules/campaign';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { WalletModule } from '@modules/wallet/wallet.module';
import { FinanceModule } from '@modules/finance/finance.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthModule,
    EventEmitterModule.forRoot(),
    CampaignModule,
    WalletModule,
    FinanceModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
