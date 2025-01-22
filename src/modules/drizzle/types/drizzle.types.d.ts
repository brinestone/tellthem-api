import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '@schemas/all';

export type DrizzleDb = NodePgDatabase<typeof schema>;
