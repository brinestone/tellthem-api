import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { schema } from '@schemas/all';
import { drizzle, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as categories from '../db/seed/categories';
import * as users from '../db/seed/users';
import * as wallets from '../db/seed/wallets';
import { DefaultLogger } from 'drizzle-orm';
import { DefaultWriter } from 'db/log-writer';

type Seeder = {
  name: string;
  seed: (
    t: PgTransaction<NodePgQueryResultHKT, typeof schema>,
  ) => Promise<void>;
};

const logger = new Logger('Seeder');
const seeders: Seeder[] = [users, categories, wallets];

const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: true,
});
const db = drizzle(pool, {
  schema,
  logger: new DefaultLogger({ writer: new DefaultWriter() }),
});
db.transaction(async (t) => {
  for (const { seed, name } of seeders) {
    logger.verbose(`seeding ${name} ⚙️`);
    await seed(
      t as unknown as PgTransaction<NodePgQueryResultHKT, typeof schema>,
    );
    logger.log(`seeded ${name} ✅`);
  }
})
  .then(() => pool.end())
  .catch((e: Error) => logger.error('seed error', e.stack));
