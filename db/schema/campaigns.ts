import { walletCreditAllocations, walletTransactions } from '@schemas/finance';
import { and, count, eq, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  interval,
  pgEnum,
  pgTable,
  pgView,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from 'drizzle-zod';
import { z } from 'zod';
import { accountConnections, users } from './users';

export const broadcastViews = pgTable('broadcast_views', {
  id: uuid().primaryKey().defaultRandom(),
  publication: bigint({ mode: 'number' }).references(
    () => campaignPublications.id,
    { onDelete: 'set null' },
  ),
  broadcast: uuid()
    .notNull()
    .references(() => publicationBroadcasts.id, { onDelete: 'cascade' }),
  viewedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  ip: varchar({ length: 39 }),
});

export const publicationBroadcasts = pgTable('publication_broadcasts', {
  id: uuid().primaryKey().defaultRandom(),
  connection: uuid().references(() => accountConnections.id, {
    onDelete: 'set null',
  }),
  publication: bigint({ mode: 'number' }).references(
    () => campaignPublications.id,
    {
      onDelete: 'set null',
    },
  ),
  ack: boolean().notNull().default(false),
  createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  sentAt: timestamp({ mode: 'date' }),
});

export const blobStatus = pgEnum('blob_storage', ['temporary', 'permanent']);
export const campaignBlobs = pgTable('campaign_blobs', {
  id: varchar({ length: 32 }).notNull().primaryKey(),
  storage: blobStatus().default('temporary'),
  path: varchar({ length: 500 }).notNull(),
  campaign: bigint({ mode: 'number' }).references(() => campaigns.id, {
    onDelete: 'set null',
  }),
  uploadedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  size: bigint({ mode: 'number' }).notNull(),
  updatedAt: timestamp({ mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  tempWindow: interval().default('24h'),
});

export const campaigns = pgTable('campaigns', {
  id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  media: text().array().default([]),
  links: text().array().default([]),
  emails: text().array().default([]),
  phones: text().array().default([]),
  createdAt: timestamp({ mode: 'date' }).defaultNow(),
  updatedAt: timestamp({ mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date()),
  categories: bigint({ mode: 'number' }).array().default([]),
  owner: bigint({ mode: 'number' })
    .notNull()
    .references(() => users.id),
  redirectUrl: varchar({ length: 500 }),
});

export const vwCampaignBlobs = pgView('vw_campaign_blobs').as((qb) => {
  return qb
    .select({
      id: campaignBlobs.id,
      campaign: campaignBlobs.campaign,
      storage: campaignBlobs.storage,
      uploadedAt: campaignBlobs.uploadedAt,
      path: campaignBlobs.path,
      size: campaignBlobs.size,
      isStale: sql<boolean>`CASE
                              WHEN ${eq(campaignBlobs.storage, 'permanent')} THEN (${campaignBlobs.campaign} IS NULL)
                              WHEN ${eq(campaignBlobs.storage, 'temporary')} THEN (NOW() > (${campaignBlobs.updatedAt} + ${campaignBlobs.tempWindow}))
                              ELSE true
                            END`.as('is_stale'),
    })
    .from(campaignBlobs)
    .leftJoin(campaigns, (c) => eq(campaigns.id, c.campaign));
});

export const NewCampaignSchema = createInsertSchema(campaigns)
  .pick({
    title: true,
    owner: true,
  })
  .extend({
    owner: z.number().optional(),
  });

export const UpdateCampaignSchema = createUpdateSchema(campaigns)
  .pick({
    title: true,
    categories: true,
    description: true,
    emails: true,
    links: true,
    phones: true,
    media: true,
    redirectUrl: true,
  })
  .extend({
    title: z.string().optional(),
    categories: z.array(z.number()).optional(),
    description: z.string().optional(),
    emails: z.array(z.string()).optional(),
    links: z.array(z.string().url()).optional(),
    phones: z.array(z.string()).optional(),
    media: z.array(z.string()).optional(),
    redirectUrl: z.string().url().optional(),
  });

export const CampaignLookupSchema = createSelectSchema(campaigns)
  .pick({
    id: true,
    title: true,
    updatedAt: true,
    categories: true,
  })
  .transform(({ categories, title, updatedAt, id }) => {
    return { categoryCount: categories?.length ?? 0, title, updatedAt, id };
  });

export const campaignPublications = pgTable('campaign_publications', {
  id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  createdAt: timestamp({ mode: 'date' }).defaultNow(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow(),
  campaign: bigint({ mode: 'number' })
    .notNull()
    .references(() => campaigns.id),
  creditAllocation: uuid()
    .notNull()
    .references(() => walletCreditAllocations.id),
  publishAfter: date({ mode: 'string' }).defaultNow(),
  publishBefore: date({ mode: 'string' }),
});

export const vwCampaignPublications = pgView('vw_campaign_publications').as(
  (qb) => {
    return qb
      .select({
        totalBroadcasts: count(publicationBroadcasts.id).as('broadcast_count'),
        totalClicks: count(broadcastViews.id).as('click_count'),
        totalExhaustedCredits:
          sql<number>`COALESCE(SUM(${walletTransactions.value}), 0)`.as(
            'total_exhausted_credits',
          ),
        totalAllocatedCredits: walletCreditAllocations.allocated,
        creditAllocation: campaignPublications.creditAllocation,
        campaign: campaignPublications.campaign,
        updatedAt: campaignPublications.updatedAt,
        id: campaignPublications.id,
        createdAt: campaignPublications.createdAt,
        owner: campaigns.owner,
      })
      .from(campaignPublications)
      .leftJoin(campaigns, (r) => eq(campaigns.id, r.campaign))
      .leftJoin(publicationBroadcasts, (r) =>
        and(
          eq(publicationBroadcasts.publication, r.id),
          eq(publicationBroadcasts.ack, true),
        ),
      )
      .leftJoin(broadcastViews, (r) => eq(broadcastViews.publication, r.id))
      .leftJoin(walletCreditAllocations, (r) =>
        eq(walletCreditAllocations.id, r.creditAllocation),
      )
      .leftJoin(walletTransactions, (r) =>
        and(
          eq(walletTransactions.creditAllocation, r.creditAllocation),
          eq(walletTransactions.status, 'complete'),
          eq(walletTransactions.type, 'reward'),
        ),
      )
      .groupBy(
        walletCreditAllocations.id,
        campaignPublications.id,
        campaigns.id,
      );
  },
);

export const newPublicationSchema = createInsertSchema(campaignPublications)
  .omit({
    createdAt: true,
    updatedAt: true,
    campaign: true,
    creditAllocation: true,
  })
  .extend({
    credits: z
      .number()
      .min(25)
      .describe('The number of credits to allocate for the publication'),
  })
  .refine((data) => data.credits > 0);

export const BroadcastSchema = createSelectSchema(publicationBroadcasts);
export const CampaignSchema = createSelectSchema(campaigns);
export const CampaignPublicationSchema =
  createSelectSchema(campaignPublications);
export type Campaign = z.infer<typeof CampaignSchema>;
export type CampaignPublication = z.infer<typeof CampaignPublicationSchema>;
export type PublicationBroadcast = z.infer<typeof BroadcastSchema>;
