import {
  ACCOUNT_CONNECTION_DELETED,
  NEW_ACCOUNT_CONNECTION,
} from '@events/connection';
import { User } from '@modules/auth/decorators';
import {
  TelegramCodeVerificationInput,
  TelegramCodeVerificationSchema,
} from '@modules/auth/dto';
import {
  AccountConnectionCreatedEvent,
  AccountConnectionDeletedEvent,
} from '@modules/auth/events';
import { UserService } from '@modules/auth/services';
import { ConnectionService } from '@modules/auth/services/connection.service';
import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { AccountConnectionSchema, UserInfo } from '@schemas/users';
import { zodToOpenAPI, ZodValidationPipe } from 'nestjs-zod';
import { Context, Telegraf } from 'telegraf';
import { z } from 'zod';

@Controller('connections')
export class ConnectionController {
  private logger = new Logger(ConnectionController.name);
  constructor(
    private userService: UserService,
    private connectionService: ConnectionService,
    private eventEmitter: EventEmitter2,
    private cs: ConfigService,
    private bot: Telegraf,
  ) {
    this.logger.verbose('listening to /start command');
    bot.command('start', async (ctx) => {
      await this.handleTelegramStartCommand(ctx);
    });
  }

  private async handleTelegramStartCommand(context: Context) {
    try {
      this.logger.log('handling Telegram bot start command');
      if (!context.from || context.from.is_bot) {
        await context.reply('Access denied');
        this.logger.warn('invalid Telegram bot command or invalid sender');
        return;
      }

      this.logger.debug('Finding existing connected user');
      const existingUser = await this.connectionService.findUserByConnection(
        'telegram',
        String(context.from.id),
      );

      if (existingUser) {
        this.logger.debug('Existing user found');
        await context.reply(
          `Your account is already linked to *${existingUser.names}*. If you want to disconnect your Telegram account from the linked account please click the *Disconnect* button on your account's settings page.`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      this.logger.debug('Generating verification codes');
      const { code } = await this.userService.generateVerificationCode(
        {
          chatId: context.chat?.id,
          userInfo: context.from,
        },
        String(context.from.id),
      );

      const frontend = this.cs.getOrThrow<string>('VALID_AUDIENCE');
      const settingsPageLink =
        this.cs.get<string>('NODE_ENV') === 'development'
          ? `Go to *${frontend}/settings*`
          : `Kindly [click here](${frontend}/settings)`;
      const message = `
Hi [${context.from.first_name}](tg://user?id=${context.from.id}), thanks for connecting!

${settingsPageLink} and enter the code shown below, to finish connecting your account and start earning your rewards.

*${code}*
  `;

      this.logger.debug('sending reply');
      await context.replyWithMarkdown(message);
    } catch (e) {
      this.logger.error(e.message, e.stack);
    }
  }

  @Get('disconnect/tm')
  @ApiOperation({
    description: "Remove a user's Telegram account connection",
    summary: 'Remove Telegram connection',
  })
  @ApiNotFoundResponse({
    description: 'No telegram account connection could be found',
  })
  @ApiOkResponse({
    description: 'The disconnection was successfull',
  })
  async removeTelegramAccountConnection(@User() user: UserInfo) {
    const result = await this.connectionService.removeTelegramConnection(
      user.id,
    );
    if (!result) throw new NotFoundException('Connection not found');

    const {
      id,
      params: { chatId },
    } = result;
    void this.eventEmitter.emitAsync(
      ACCOUNT_CONNECTION_DELETED,
      new AccountConnectionDeletedEvent('telegram', id, user.id),
    );

    void this.bot.telegram.sendMessage(
      chatId,
      'Account disconnection successful. Goodbye',
    );
  }

  @Get('verify/tm')
  @ApiOperation({
    summary: 'Connect Telegram account',
    description:
      "Verify a verification code from Telegram and connect a user's account to their Telegram account",
  })
  @ApiBody({ schema: zodToOpenAPI(TelegramCodeVerificationSchema) })
  @ApiNotFoundResponse({
    description: 'The code has expired or does not exist',
  })
  @ApiOkResponse({
    description:
      'The verification code was valid and the account was connected succefully with Telegram',
  })
  async verifyTelegramVerificationCode(
    @Query(new ZodValidationPipe()) input: TelegramCodeVerificationInput,
    @User() { id }: UserInfo,
  ) {
    const connectionId =
      await this.connectionService.registerTelegramConnection(id, input.code);

    void this.eventEmitter.emitAsync(
      NEW_ACCOUNT_CONNECTION,
      new AccountConnectionCreatedEvent('telegram', connectionId, id),
    );
  }

  @Get()
  @ApiOkResponse({
    schema: zodToOpenAPI(z.array(AccountConnectionSchema)),
  })
  @ApiOperation({
    summary: 'Get account connections',
    description: "Retrieves a user's account connections.",
  })
  async findUserConnections(@User() user: UserInfo) {
    return await this.userService.findUserConnections(user.id);
  }
}
