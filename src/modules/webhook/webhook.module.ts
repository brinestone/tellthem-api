import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Telegraf } from 'telegraf';
import telegrafConfig from './config/telegraf.config';
import { TelegrafService } from './services/telegraf.service';

@Module({
  imports: [EventEmitterModule, ConfigModule.forFeature(telegrafConfig)],
  providers: [
    {
      provide: Telegraf,
      inject: [telegrafConfig.KEY],
      useFactory: (tc: ConfigType<typeof telegrafConfig>) => {
        const bot = new Telegraf(tc.botToken);
        return bot;
      },
    },
    TelegrafService,
  ],
  exports: [Telegraf, ConfigModule],
})
export class WebhookModule {}
