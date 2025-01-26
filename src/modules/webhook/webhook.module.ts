import { DRIZZLE, DrizzleDb, DrizzleModule } from '@modules/drizzle';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { accountConnections } from '@schemas/users';
import { and, eq } from 'drizzle-orm';
import { Context, Telegraf } from 'telegraf';
import { MessageEntity } from 'telegraf/typings/core/types/typegram';
import telegrafConfig from './config/telegraf.config';

function telegramCommandMiddleware(db: DrizzleDb) {
  const logger = new Logger('telegram-middleware');
  return async (ctx: Context, next: () => Promise<void>) => {
    if (ctx.from?.is_bot) {
      await ctx.reply('Access denied. No bots allowed');
      await ctx.banChatMember(ctx.from.id);
      return;
    }
    const now = Date.now();
    try {
      if (
        (
          (ctx.message as unknown as any).entities as
            | MessageEntity[]
            | undefined
        )?.[0].type != 'bot_command'
      ) {
        await ctx.reply(
          'Unknown command. Please check the menu for a valid command',
        );
        return;
      }
      if ((ctx.message as unknown as { text: string }).text != '/start') {
        const connections = await db
          .select({ status: accountConnections.status })
          .from(accountConnections)
          .where(
            and(
              eq(accountConnections.providerId, String(ctx.from?.id)),
              eq(accountConnections.provider, 'telegram'),
            ),
          )
          .limit(1);
        if (connections.length == 0 || connections[0].status != 'active') {
          await ctx.reply(
            'Your Telegram account is not connected or requires re-connection. Please use the /start command to get started',
          );
          return;
        }
      }

      await next();
    } catch (e) {
      logger.error(e.message, e.stack);
    } finally {
      const diff = Date.now() - now;
      logger.verbose(
        (ctx.message as unknown as { text: string }).text +
          ' command handled | +' +
          diff +
          'ms',
      );
    }
  };
}

@Module({
  imports: [
    EventEmitterModule,
    DrizzleModule,
    ConfigModule.forFeature(telegrafConfig),
  ],
  providers: [
    {
      provide: Telegraf,
      inject: [telegrafConfig.KEY, DRIZZLE],
      useFactory: (tc: ConfigType<typeof telegrafConfig>, db: DrizzleDb) => {
        const bot = new Telegraf(tc.botToken);
        bot.use(telegramCommandMiddleware(db));
        return bot;
      },
    },
  ],
  exports: [Telegraf, ConfigModule],
})
export class WebhookModule {}
