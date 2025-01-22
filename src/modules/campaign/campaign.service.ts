import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NewCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import {
  CampaignLookupSchema,
  campaignPublications,
  campaigns,
} from '@schemas/campaigns';
import { eq, desc, count, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { vwCreditAllocations } from '@schemas/finance';

@Injectable()
export class CampaignService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async findPublications(campaign: number, owner: number) {
    return await this.db
      .select({
        id: campaignPublications.id,
        publishBefore: campaignPublications.publishBefore,
        publishAfter: campaignPublications.publishAfter,
        campaign: campaignPublications.campaign,
        creditAllocation: {
          id: campaignPublications.creditAllocation,
          allocated: vwCreditAllocations.allocated,
          exhausted: vwCreditAllocations.exhausted,
        },
      })
      .from(campaignPublications)
      .innerJoin(campaigns, (c) =>
        and(eq(campaigns.id, c.campaign), eq(campaigns.createdBy, owner)),
      )
      .innerJoin(vwCreditAllocations, (c) =>
        eq(c.creditAllocation.id, vwCreditAllocations.id),
      )
      .where(and(eq(campaignPublications.campaign, campaign)))
      .orderBy(desc(campaignPublications.updatedAt));
  }

  async create(input: NewCampaignDto, owner: number) {
    const [{ id }] = await this.db.transaction((t) =>
      t
        .insert(campaigns)
        .values({ ...input, createdBy: owner })
        .returning({ id: campaigns.id }),
    );
    return id;
  }

  async findAll(page: number, size: number, user: number) {
    const data = await this.db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        updatedAt: campaigns.updatedAt,
        categories: campaigns.categories,
      })
      .from(campaigns)
      .where(eq(campaigns.createdBy, user))
      .orderBy(desc(campaigns.updatedAt))
      .offset(page * size)
      .limit(size);

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.createdBy, user));

    return {
      data: z.array(CampaignLookupSchema).parse(data),
      page,
      size,
      total,
    };
  }

  async findOne(id: number, userId: number) {
    return await this.db.query.campaigns.findFirst({
      where: (campaign, { and, eq }) =>
        and(eq(campaign.id, id), eq(campaign.createdBy, userId)),
    });
  }

  async update(owner: number, campaign: number, input: UpdateCampaignDto) {
    const { rowCount } = await this.db.transaction((t) =>
      t
        .update(campaigns)
        .set(input)
        .where(and(eq(campaigns.id, campaign), eq(campaigns.createdBy, owner))),
    );

    if (rowCount == 0) {
      throw new NotFoundException('Campaign not found');
    }
  }

  async remove(campaign: number, owner: number) {
    await this.db.transaction(async (t) => {
      const publications = await t
        .select({
          id: campaignPublications.id,
          allocation: campaignPublications.creditAllocation,
        })
        .from(campaignPublications)
        .where(eq(campaignPublications.campaign, campaign));

      await t.delete(campaignPublications).where(
        inArray(
          campaignPublications.id,
          publications.map(({ id }) => id),
        ),
      );
      await t
        .delete(campaigns)
        .where(and(eq(campaigns.id, campaign), eq(campaigns.createdBy, owner)));
    });
  }
}
