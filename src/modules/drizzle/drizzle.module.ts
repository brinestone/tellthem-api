import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { schema } from '@schemas/all';
import { DefaultWriter } from 'db/log-writer';
import { DefaultLogger } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DrizzleDb } from './types/drizzle.types';

export const DRIZZLE = Symbol('drizzle-conn');

@Module({
  imports: [ConfigModule],
  exports: [DRIZZLE],
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => {
        const dbUrl = cs.getOrThrow<string>('DATABASE_URL');

        const pool = new Pool({
          connectionString: dbUrl,
          ssl: cs.get<string>('NODE_ENV', 'production') !== 'development',
        });

        return drizzle(pool, {
          schema,
          logger: new DefaultLogger({ writer: new DefaultWriter() }),
        }) as DrizzleDb;
      },
    },
  ],
})
export class DrizzleModule {}
