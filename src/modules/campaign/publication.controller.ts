import { CAMPAIGN_VIEWED, NEW_PUBLICATION } from '@events/campaign';
import { User } from '@modules/auth/decorators';
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
import { zodToOpenAPI, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { CampaignPublicationSchema } from './dto/campaign.dto';
import {
  BroadcastViewUpsertSchema,
  NewPublicationDto,
} from './dto/publication.dto';
import { CampaignPublishedEvent, CampaignViewedEvent } from './events';
import { CampaignService } from './services/campaign.service';
import { ANALYTICS } from '@events/analytics';
import { AnalyticsRequestReceivedEvent } from 'src/event';
import { createHash } from 'crypto';

@Controller('campaign/publications')
export class PublicationController {
  private logger = new Logger(PublicationController.name);
  constructor(
    private campaignService: CampaignService,
    private eventEmitter: EventEmitter2,
  ) {}

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
      const { clicks } = await this.campaignService.upsertBroadcastView(
        arg.key,
        arg.ip,
        hash,
        arg.userAgent,
      );
      if (clicks > 1) return;

      await this.eventEmitter.emitAsync(
        CAMPAIGN_VIEWED,
        new CampaignViewedEvent(arg.key, undefined, arg.user),
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
