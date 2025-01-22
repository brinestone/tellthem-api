import { User } from '@modules/auth/decorators';
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { z } from 'zod';
import { CampaignPublicationSchema } from './dto/campaign.dto';
import { CampaignService } from './campaign.service';
import { UserInfo } from '@schemas/users';

@Controller('campaign/publications')
export class PublicationController {
  constructor(private campaignService: CampaignService) {}

  @Get(':campaign')
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
