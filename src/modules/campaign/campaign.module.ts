import { DrizzleModule } from '@modules/drizzle';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CampaignController } from './campaign.controller';
import { CategoryController } from './category.controller';
import { PublicationController } from './publication.controller';
import { CampaignService } from './services/campaign.service';
import { CategoryService } from './services/category.service';

@Module({
  imports: [DrizzleModule, EventEmitterModule],
  controllers: [CampaignController, PublicationController, CategoryController],
  providers: [CampaignService, CategoryService],
})
export class CampaignModule {}
