import { DrizzleModule } from '@modules/drizzle';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CampaignController } from './campaign.controller';
import { CategoryController } from './category.controller';
import { PublicationController } from './publication.controller';
import { CampaignService } from './services/campaign.service';
import { CategoryService } from './services/category.service';
import { WebhookModule } from '@modules/webhook';

@Module({
  imports: [DrizzleModule, EventEmitterModule, WebhookModule],
  controllers: [CampaignController, PublicationController, CategoryController],
  providers: [CampaignService, CategoryService],
  exports: [CampaignService],
})
export class CampaignModule {}
