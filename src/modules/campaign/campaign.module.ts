import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { DrizzleModule } from '@modules/drizzle';
import { PublicationController } from './publication.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [DrizzleModule, EventEmitterModule],
  controllers: [CampaignController, PublicationController],
  providers: [CampaignService],
})
export class CampaignModule {}
