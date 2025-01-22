import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '@schemas/all';

export const DRIZZLE = Symbol('drizzle-conn');
export type TellThemDb = NodePgDatabase<typeof schema>;

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => {
        const dbUrl = cs.getOrThrow<string>('DATABASE_URL');

        const pool = new Pool({
          connectionString: dbUrl,
          ssl: true,
        });

        return drizzle(pool, {
          schema,
        }) as NodePgDatabase<typeof schema>;
      },
    },
  ],
})
export class DrizzleModule {}
