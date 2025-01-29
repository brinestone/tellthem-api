import { AuthModule } from '@modules/auth';
import { JwtGuard } from '@modules/auth/guards';
import { BlobModule } from '@modules/blob';
import { CampaignModule } from '@modules/campaign';
import { FinanceModule } from '@modules/finance';
import { WalletModule } from '@modules/wallet';
import { WebhookModule } from '@modules/webhook';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { LoggerMiddleware } from './middleware/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthModule,
    EventEmitterModule.forRoot(),
    CampaignModule,
    WalletModule,
    FinanceModule,
    WebhookModule,
    BlobModule,
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
