import { ANALYTICS } from '@events/analytics';
import {
  CAMPAIGN_VIEWED,
  NEW_PUBLICATION,
  REWARD_GRANTED,
} from '@events/campaign';
import { REWARD_TRANSFERRED } from '@events/wallet';
import { User } from '@modules/auth/decorators';
import { RewardTransferredEvent } from '@modules/wallet/events';
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ApiBasicAuth, ApiBody, ApiParam, ApiResponse } from '@nestjs/swagger';
import { newPublicationSchema } from '@schemas/campaigns';
import { UserInfo } from '@schemas/users';
import { createHash } from 'crypto';
import { zodToOpenAPI, ZodValidationPipe } from 'nestjs-zod';
import { AnalyticsRequestReceivedEvent } from 'src/event';
import { z } from 'zod';
import { CampaignPublicationSchema } from './dto/campaign.dto';
import {
  BroadcastViewUpsertSchema,
  NewPublicationDto,
} from './dto/publication.dto';
import {
  CampaignPublishedEvent,
  CampaignViewedEvent,
  RewardGrantedEvent,
} from './events';
import { CampaignService } from './services/campaign.service';

@Controller('campaign/publications')
export class PublicationController {
  private logger = new Logger(PublicationController.name);
  constructor(
    private campaignService: CampaignService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(REWARD_TRANSFERRED)
  async onRewardsTransferred(arg: RewardTransferredEvent) {
    try {
      await this.campaignService.updateReward(arg.grant, arg.transaction);
    } catch (e) {
      this.logger.error(e.message, e.stack);
    }
  }
  @OnEvent(ANALYTICS)
  async registerBroadcastView(arg: AnalyticsRequestReceivedEvent) {
    if (arg.type != 'broadcast') return;
    try {
      const { deviceInfo: di } = BroadcastViewUpsertSchema.parse(arg.data);
      const cipher = createHash('sha256');
      cipher.update(di.hash);
      cipher.update(arg.ip);
      cipher.update(arg.userAgent);

      const hash = cipher.digest('hex');
      const { clicks, id: broadcastView } =
        await this.campaignService.upsertBroadcastView(
          arg.key,
          arg.ip,
          hash,
          arg.userAgent,
        );
      if (clicks > 1) return;

      const rewardId = await this.campaignService.createReward(broadcastView);

      await this.eventEmitter.emitAsync(
        CAMPAIGN_VIEWED,
        new CampaignViewedEvent(arg.key, undefined, arg.user),
      );
      await this.eventEmitter.emitAsync(
        REWARD_GRANTED,
        new RewardGrantedEvent(rewardId, arg.key),
      );
    } catch (e) {
      this.logger.error(e.message, e.stack);
    }
  }

  @Post(':campaign')
  @ApiParam({
    name: 'campaign',
    description: "The campaign's ID",
    required: true,
  })
  @ApiBody({
    schema: zodToOpenAPI(newPublicationSchema),
  })
  @ApiBasicAuth()
  async createPublication(
    @Param('campaign', new ParseIntPipe()) campaign: number,
    @Body(new ZodValidationPipe()) input: NewPublicationDto,
    @User() { id }: UserInfo,
  ) {
    const publicationId = await this.campaignService.createPublication(
      id,
      campaign,
      input,
    );
    this.eventEmitter
      .emitAsync(
        NEW_PUBLICATION,
        new CampaignPublishedEvent(campaign, publicationId, id),
      )
      .catch((e: Error) => this.logger.error(e.message, e.stack));
  }

  @Get(':campaign')
  @ApiResponse({
    status: 200,
    schema: zodToOpenAPI(z.array(CampaignPublicationSchema)),
  })
  @ApiParam({
    description: "The campaign's ID",
    name: 'campaign',
    type: 'number',
    required: true,
  })
  async findPublications(
    @Param('campaign', new ParseIntPipe()) campaignId: number,
    @User() { id: userId }: UserInfo,
  ) {
    const publications = await this.campaignService.findPublications(
      campaignId,
      userId,
    );
    return z.array(CampaignPublicationSchema).parse(publications);
  }
}
