import { NEW_PUBLICATION } from '@events/campaign';
import { User } from '@modules/auth/decorators';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApiBasicAuth,
  ApiBody,
  ApiParam,
  ApiResponse
} from '@nestjs/swagger';
import { newPublicationSchema } from '@schemas/campaigns';
import { UserInfo } from '@schemas/users';
import { zodToOpenAPI, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { CampaignPublicationSchema } from './dto/campaign.dto';
import { NewPublicationDto } from './dto/publication.dto';
import { CampaignPublishedEvent } from './events';
import { CampaignService } from './services/campaign.service';

@Controller('campaign/publications')
export class PublicationController {
  constructor(
    private campaignService: CampaignService,
    private eventEmitter: EventEmitter2,
  ) {}

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
    void this.eventEmitter.emitAsync(
      NEW_PUBLICATION,
      new CampaignPublishedEvent(campaign, publicationId),
    );
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
