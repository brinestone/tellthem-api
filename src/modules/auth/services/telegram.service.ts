import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  accountConnections,
  verificationCodes,
  vwVerificationCodes,
} from '@schemas/users';
import { and, eq } from 'drizzle-orm';
import { TelegramAccountConnectionDataSchema } from '../dto';

@Injectable()
export class TelegramService {
  async removeConnection(user: number) {
    const result = await this.db.transaction((t) =>
      t
        .delete(accountConnections)
        .where(
          and(
            eq(accountConnections.provider, 'telegram'),
            eq(accountConnections.user, user),
          ),
        )
        .returning({ id: accountConnections.id }),
    );
    return result[0]?.id;
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

  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}
}
