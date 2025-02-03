import { NEW_PUBLICATION } from '@events/campaign';
import {
  ACCOUNT_CONNECTION_DELETED,
  NEW_ACCOUNT_CONNECTION,
} from '@events/connection';
import { User } from '@modules/auth/decorators';
import {
  TelegramAccountConnectionDataSchema,
  TelegramCodeVerificationInput,
  TelegramCodeVerificationSchema,
} from '@modules/auth/dto';
import {
  AccountConnectionCreatedEvent,
  AccountConnectionDeletedEvent,
} from '@modules/auth/events';
import { UserService } from '@modules/auth/services';
import { ConnectionService } from '@modules/auth/services/connection.service';
import { CampaignService } from '@modules/campaign';
import { CampaignPublishedEvent } from '@modules/campaign/events';
import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Campaign } from '@schemas/campaigns';
import {
  AccountConnection,
  AccountConnectionSchema,
  UserInfo,
} from '@schemas/users';
import axios, { AxiosError } from 'axios';
import { zodToOpenAPI, ZodValidationPipe } from 'nestjs-zod';
import {
  concatMap,
  delayWhen,
  forkJoin,
  from,
  groupBy,
  of,
  switchMap,
  toArray,
} from 'rxjs';
import { Context, Telegraf } from 'telegraf';
import { z } from 'zod';

// const videoExtensions = [
//   '.mp4',
//   '.mov',
//   '.avi',
//   '.wmv',
//   '.flv',
//   '.webm',
//   '.mkv',
//   '.mpeg',
//   '.mpg',
// ];

// const imageExtensions = [
//   '.jpg',
//   '.jpeg',
//   '.png',
//   '.gif',
//   '.bmp',
//   '.svg',
//   '.webp',
//   '.tiff',
//   '.tif',
// ];

export type PxlShortLinkResponse = {
  data: ShortLinkData;
};

export type ShortLinkData = {
  id: string;
  route: string;
  destination: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  consent: boolean;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
};

@Controller('connections')
export class ConnectionController {
  private logger = new Logger(ConnectionController.name);
  constructor(
    private userService: UserService,
    private connectionService: ConnectionService,
    private eventEmitter: EventEmitter2,
    private cs: ConfigService,
    private bot: Telegraf,
    private campaignService: CampaignService,
  ) {
    this.logger.verbose('listening to /start command');
    bot.command('start', async (ctx) => {
      await this.handleTelegramStartCommand(ctx);
    });
  }

  private sendCampaignBroadcastToConnections(
    connections: (AccountConnection & { broadcast: string })[],
    campaign: Campaign,
  ) {
    from(connections)
      .pipe(
        groupBy((c) => c.provider),
        concatMap((group$) => {
          switch (group$.key) {
            case 'telegram': {
              const messageTemplate = (shareLink: string) => {
                return `
📣📣📣 *NEW CAMPAIGN* 📣📣📣

A new campaign has been published and is available for you to post on your status.
Please use the information below to make an attractive post to attact your friends and make your rewards.

*Campaign Information*

*Title*: ${campaign.title}
*Description*: ${campaign.description ?? 'N/A'}

*Note* 
- Please have your viewers click the link: *${shareLink}* to ensure that your rewards be transfered into your wallet.
- After sharing on your story, you must share the link to your status post with me for verification. No rewards will be earned if the link to the story is not shared with me.
`;
              };
              return group$.pipe(
                delayWhen((_, i) => (i % 30 == 0 && i > 0 ? of(1000) : of(0))),
                concatMap((connection) => {
                  const url = `${this.cs.getOrThrow<string>('VALID_AUDIENCE')}/analytics?id=${connection.broadcast}&t=broadcast&r=${encodeURIComponent(campaign.redirectUrl as string)}`;
                  return forkJoin([
                    of(connection),
                    axios.post<PxlShortLinkResponse>(
                      'https://api.pxl.to/api/v1/short',
                      {
                        destination: url,
                        title: campaign.title,
                        description: campaign.description ?? null,
                      },
                      {
                        headers: {
                          'content-type': 'application/json',
                          Authorization: `Bearer ${this.cs.getOrThrow<string>('PXL_API_KEY')}`,
                        },
                      },
                    ),
                  ]);
                }),
                switchMap(
                  async ([
                    connection,
                    {
                      data: { data },
                    },
                  ]) => {
                    const { chatId } =
                      TelegramAccountConnectionDataSchema.parse(
                        connection.params,
                      );
                    const msg = messageTemplate(`https://${data.id}`);
                    await this.bot.telegram.sendMessage(chatId, msg, {
                      parse_mode: 'Markdown',
                    });
                    return connection.broadcast;
                  },
                ),
                toArray(),
                concatMap((broadcasts) =>
                  this.campaignService.markBroadcastsAsSent(broadcasts),
                ),
              );
            }
          }
        }),
      )
      .subscribe({
        error: (error: AxiosError) => {
          this.logger.error(error.message, error.stack);
        },
      });
  }

  @OnEvent(NEW_PUBLICATION)
  async prepareBroadcasts({
    publication,
    owner,
    campaign,
  }: CampaignPublishedEvent) {
    this.logger.log('preparing campaign publication broadcasts');
    try {
      const campaignObj = await this.campaignService.findCampaign(
        campaign,
        owner,
      );
      if (!campaignObj) {
        this.logger.warn(
          'Campaign object could not found while attempting to broadcast publication event',
        );
        return;
      }
      const generator =
        await this.connectionService.findAllActiveUserConnectionsExceptFor(
          300,
          owner,
        );

      for await (const connections of generator) {
        if (connections.length == 0) {
          this.logger.warn('No users could be found to broadcast to');
          continue;
        }
        const broadcasts = await this.campaignService.createBulkBroadcasts(
          publication,
          connections.map((c) => c.id),
        );
        const m = new Map<string, AccountConnection>();
        broadcasts.forEach(({ connection, id }) => {
          const c = connections.find(({ id }) => id == connection);
          if (!c) return;
          m.set(id, AccountConnectionSchema.parse(c));
        });
        const accountConnectionList = [...m.entries()].map(
          ([broadcast, conn]) => ({ ...conn, broadcast }),
        );
        this.sendCampaignBroadcastToConnections(
          accountConnectionList,
          campaignObj,
        );
      }
    } catch (e) {
      this.logger.error(e.message, e.stack);
    }
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
      const existingUser = await this.userService.findUserByConnection(
        'telegram',
        String(context.from.id),
      );

      if (existingUser) {
        this.logger.debug('Existing user found');
        await context.reply(
          `Your account is already linked to *${existingUser.names} (${existingUser.email})*. If you want to disconnect your Telegram account from the linked account please click the *Disconnect* button on your account's settings page.`,
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
        this.cs.get<string>('NODE_ENV', 'production') === 'development'
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
    const { id: connectionId, data } =
      await this.connectionService.registerTelegramConnection(id, input.code);

    void this.eventEmitter.emitAsync(
      NEW_ACCOUNT_CONNECTION,
      new AccountConnectionCreatedEvent('telegram', connectionId, id),
    );

    await this.bot.telegram.sendMessage(
      (data as unknown & { chatId: number }).chatId,
      'Congratulations! Your account has been connected successfully!! 🎊',
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
