import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import {
  Inject,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import {
  broadcastViews,
  CampaignLookupSchema,
  campaignPublications,
  campaigns,
  publicationBroadcasts,
  rewardGrants,
  RewardGrantUpdate,
} from '@schemas/campaigns';
import {
  fundingBalances,
  vwCreditAllocations,
  walletCreditAllocations,
  walletTransactions,
} from '@schemas/finance';
import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { NewCampaignDto, UpdateCampaignDto } from '../dto/campaign.dto';
import { NewPublicationDto } from '../dto/publication.dto';

@Injectable()
export class CampaignService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async updateReward(id: string, transactionId: string) {
    await this.db.transaction(async (t) => {
      const [{ status }] = await t
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, transactionId));

      const grant = await t.query.rewardGrants.findFirst({
        where: (grant, { eq }) => eq(grant.id, id),
      });

      if (!grant) {
        throw new Error('grant not found :' + id);
      }
      const update = {
        status,
        walletTransaction: transactionId,
      } as RewardGrantUpdate;

      if (status == 'complete') {
        update.grantedAt = new Date();
        update.grantedAt = new Date();
      }

      if (status == 'failed') {
        update.failedAt = new Date();
        update.failureCount = grant.failureCount + 1;
      }

      return t.update(rewardGrants).set(update).where(eq(rewardGrants.id, id));
    });
  }

  async createReward(broadcastView: string) {
    const [{ id }] = await this.db.transaction((t) =>
      t
        .insert(rewardGrants)
        .values({
          broadcastView,
        })
        .returning({ id: rewardGrants.id }),
    );
    return id;
  }

  async upsertBroadcastView(
    broadcast: string,
    ip: string,
    deviceHash: string,
    userAgent: string,
    user?: number,
  ) {
    const res = await this.db.transaction((t) => {
      return t
        .insert(broadcastViews)
        .values({
          broadcast,
          ip,
          deviceHash,
          userAgent,
          user,
        })
        .onConflictDoUpdate({
          target: [
            broadcastViews.deviceHash,
            broadcastViews.broadcast,
            broadcastViews.ip,
          ],
          set: {
            clickCount: sql`${broadcastViews.clickCount} + 1`,
            viewedAt: new Date(),
          },
        })
        .returning({
          id: broadcastViews.id,
          clicks: broadcastViews.clickCount,
        });
    });

    return res[0];
  }

  async markBroadcastsAsSent(broadcasts: string[]) {
    const now = new Date(new Date().toUTCString());
    await this.db.transaction((t) =>
      t
        .update(publicationBroadcasts)
        .set({ sentAt: now })
        .where(inArray(publicationBroadcasts.id, broadcasts)),
    );
  }

  async createBulkBroadcasts(publication: number, connections: string[]) {
    const result = await this.db.transaction((t) =>
      t
        .insert(publicationBroadcasts)
        .values(
          connections.map((connection) => {
            return {
              connection,
              publication,
            };
          }),
        )
        .returning({
          id: publicationBroadcasts.id,
          connection: publicationBroadcasts.connection,
        }),
    );
    return result.map(({ id, connection }) => ({ id, connection }));
  }

  async createPublication(
    owner: number,
    campaign: number,
    input: NewPublicationDto,
  ) {
    return await this.db.transaction(async (t) => {
      const fundingResult = await t
        .select()
        .from(fundingBalances)
        .where(
          and(
            eq(fundingBalances.owner, owner),
            gte(fundingBalances.balance, input.credits),
          ),
        )
        .limit(1);

      if (fundingResult.length == 0) {
        throw new PreconditionFailedException('Insufficient funds');
      }

      const [fundingWallet] = fundingResult;
      const [{ id: allocationId }] = await t
        .insert(walletCreditAllocations)
        .values({
          allocated: input.credits,
          wallet: fundingWallet.id,
          status: 'active',
        })
        .returning({ id: walletCreditAllocations.id });

      const [{ id }] = await t
        .insert(campaignPublications)
        .values({
          creditAllocation: allocationId,
          campaign,
          publishAfter: input.publishAfter,
          publishBefore: input.publishBefore,
        })
        .returning({ id: campaignPublications.id });

      return id;
    });
  }

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
        and(eq(campaigns.id, c.campaign), eq(campaigns.owner, owner)),
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
        .values({ ...input, owner })
        .returning({ id: campaigns.id }),
    );
    return id;
  }

  async lookupCampaigns(page: number, size: number, user: number) {
    const data = await this.db
      .select({
        id: campaigns.id,
        title: campaigns.title,
        updatedAt: campaigns.updatedAt,
        categories: campaigns.categories,
      })
      .from(campaigns)
      .where(eq(campaigns.owner, user))
      .orderBy(desc(campaigns.updatedAt))
      .offset(page * size)
      .limit(size);

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(campaigns)
      .where(eq(campaigns.owner, user));

    return {
      data: z.array(CampaignLookupSchema).parse(data),
      page,
      size,
      total,
    };
  }

  async findCampaign(id: number, userId: number) {
    return await this.db.query.campaigns.findFirst({
      where: (campaign, { and, eq }) =>
        and(eq(campaign.id, id), eq(campaign.owner, userId)),
    });
  }

  async updateCampaignInfo(
    owner: number,
    campaign: number,
    input: UpdateCampaignDto,
  ) {
    const { rowCount } = await this.db.transaction((t) =>
      t
        .update(campaigns)
        .set(input)
        .where(and(eq(campaigns.id, campaign), eq(campaigns.owner, owner))),
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

      await t.delete(walletCreditAllocations).where(
        inArray(
          walletCreditAllocations.id,
          publications.map(({ allocation }) => allocation),
        ),
      );

      await t.delete(campaignPublications).where(
        inArray(
          campaignPublications.id,
          publications.map(({ id }) => id),
        ),
      );
      await t
        .delete(campaigns)
        .where(and(eq(campaigns.id, campaign), eq(campaigns.owner, owner)));
    });
  }
}
