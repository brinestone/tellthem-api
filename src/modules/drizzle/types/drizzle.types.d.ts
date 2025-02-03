import { schema } from '@schemas/all';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type DrizzleDb = NodePgDatabase<typeof schema>;
