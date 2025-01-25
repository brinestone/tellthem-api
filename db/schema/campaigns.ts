import { walletCreditAllocations } from '@schemas/finance';
import { eq, sql } from 'drizzle-orm';
import {
  bigint,
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
import { users } from './users';

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
  createdBy: bigint({ mode: 'number' })
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
    createdBy: true,
  })
  .extend({
    createdBy: z.number().optional(),
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
    // creditAllocation: z.string().uuid().optional(),
  })
  .refine((data) => data.credits > 0);
