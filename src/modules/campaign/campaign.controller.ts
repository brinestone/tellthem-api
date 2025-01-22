import { CAMPAIGN_DELETED, NEW_CAMPAIGN } from '@events/campaign';
import { User } from '@modules/auth/decorators';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ZodValidationPipe } from '@pipes/zod';
import { NewCampaignSchema, UpdateCampaignSchema } from '@schemas/campaigns';
import { UserInfo } from '@schemas/users';
import { Request } from 'express';
import { CampaignService } from './campaign.service';
import {
  CampaignLookupPaginationValidationSchema,
  NewCampaignDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';
import { CampaignCreatedEvent, CampaignDeletedEvent } from './events';

@Controller('campaign')
export class CampaignController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(NewCampaignSchema))
    createCampaignDto: NewCampaignDto,
    @User() { id }: UserInfo,
  ) {
    const campaignId = await this.campaignService.create(createCampaignDto, id);
    this.eventEmitter.emit(NEW_CAMPAIGN, new CampaignCreatedEvent(campaignId));
    return;
  }

  @Get()
  async findAll(@Req() request: Request, @User() user: UserInfo) {
    const { page, size } = CampaignLookupPaginationValidationSchema.parse(
      request.query,
    );
    return await this.campaignService.findAll(page, size, user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseIntPipe()) id: number,
    @User() { id: userId }: UserInfo,
  ) {
    return this.campaignService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body(new ZodValidationPipe(UpdateCampaignSchema))
    updateCampaignDto: UpdateCampaignDto,
    @User() { id: userId }: UserInfo,
  ) {
    return await this.campaignService.update(userId, id, updateCampaignDto);
  }

  @Delete(':campaign')
  async remove(
    @User() { id: user }: UserInfo,
    @Param('campaign', new ParseIntPipe()) id: number,
  ) {
    await this.campaignService.remove(id, user);
    this.eventEmitter.emit(CAMPAIGN_DELETED, new CampaignDeletedEvent(id));
  }
}
