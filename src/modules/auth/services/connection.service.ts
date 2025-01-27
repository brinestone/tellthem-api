import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  accountConnections,
  UserInfo,
  users,
  verificationCodes,
  vwVerificationCodes,
} from '@schemas/users';
import { and, eq, ne } from 'drizzle-orm';
import { TelegramAccountConnectionDataSchema } from '../dto';
import { LRUCache } from 'lru-cache';

@Injectable()
export class ConnectionService {
  async findUserByConnection(provider: 'telegram', providerId: string) {
    const key = `${provider},${providerId}`;
    if (!this.cache.has(key)) {
      return await this.cache.fetch(key);
    }
    return this.cache.get(key);
  }
  async removeTelegramConnection(user: number) {
    const result = await this.db.transaction((t) =>
      t
        .delete(accountConnections)
        .where(
          and(
            eq(accountConnections.provider, 'telegram'),
            eq(accountConnections.user, user),
          ),
        )
        .returning({
          id: accountConnections.id,
          params: accountConnections.params,
        }),
    );
    const ans = result[0];
    if (!ans) return null;

    return {
      id: ans.id,
      params: TelegramAccountConnectionDataSchema.parse(ans.params),
    };
  }
  async registerTelegramConnection(user: number, code: string) {
    const result = await this.db
      .select()
      .from(vwVerificationCodes)
      .where((vc) =>
        and(eq(vc.code, code), eq(vwVerificationCodes.isExpired, false)),
      );

    if (result.length == 0)
      throw new NotFoundException('Code not found or is expired');

    const [{ data }] = result;
    const telegramData = TelegramAccountConnectionDataSchema.parse(data);
    return await this.db.transaction(async (t) => {
      const [{ id }] = await t
        .insert(accountConnections)
        .values({
          user,
          provider: 'telegram',
          params: data,
          status: 'active',
          providerId: String(telegramData.userInfo.id),
        })
        .returning({ id: accountConnections.id });

      await t
        .update(verificationCodes)
        .set({
          confirmed_at: new Date(),
        })
        .where(eq(verificationCodes.code, code));

      return id;
    });
  }

  private cache = new LRUCache<string, UserInfo>({
    size: 300,
    maxSize: 300000,
    ttl: 2 * 3600 * 1000,
    sizeCalculation: (v) => {
      return Object.entries(v)
        .map(([k, v]) => String(k).length + String(v).length)
        .reduce((acc, curr) => acc + curr, 0);
    },
    fetchMethod: async (key) => {
      this.logger.verbose('updating connections cache');
      const [provider, providerId] = key.split(',');
      const result = await this.db
        .selectDistinct()
        .from(users)
        .innerJoin(accountConnections, eq(users.id, accountConnections.user))
        .where(
          and(
            eq(accountConnections.provider, provider as any),
            eq(accountConnections.providerId, providerId),
            ne(accountConnections.status, 'inactive'),
          ),
        )
        .limit(1);
      return result[0]?.users;
    },
  });
  private logger = new Logger(ConnectionService.name);
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}
}
