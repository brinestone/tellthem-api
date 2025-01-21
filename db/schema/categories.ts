import { sql } from 'drizzle-orm';
import { bigint, pgTable, pgView, text, varchar } from 'drizzle-orm/pg-core';
import { campaignPublications, campaigns } from './campaigns';

export const categories = pgTable('categories', {
  id: bigint({ mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  title: varchar({ length: 255 }).notNull(),
  description: text().notNull(),
  image: varchar({ length: 500 }),
});

export const vwCategories = pgView('vw_categories').as((qb) => {
  return qb
    .select({
      id: categories.id,
      title: categories.title,
      publicationCount: sql<number>`COUNT(${campaignPublications.id})`.as(
        'publication_count',
      ),
    })
    .from(categories)
    .leftJoin(campaigns, sql`${categories.id} = ANY(${campaigns.categories})`)
    .leftJoin(
      campaignPublications,
      sql`${campaignPublications.campaign} = ${campaigns.id} AND (${campaignPublications.publishBefore} > NOW() OR ${campaignPublications.publishBefore} IS NULL)`,
    )
    .groupBy(categories.id);
});
