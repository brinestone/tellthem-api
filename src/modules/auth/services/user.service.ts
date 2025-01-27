import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable } from '@nestjs/common';
import {
  userPrefs,
  verificationCodes,
  vwVerificationCodes,
} from '@schemas/users';
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { UpdatePrefsDto } from '../dto';

@Injectable()
export class UserService {
  async generateVerificationCode(data: unknown, key?: string) {
    if (key) {
      const existingCode = await this.db
        .select({
          code: vwVerificationCodes.code,
          expiresAt: vwVerificationCodes.expiresAt,
        })
        .from(vwVerificationCodes)
        .where(
          and(
            eq(vwVerificationCodes.key, key),
            eq(vwVerificationCodes.isExpired, false),
          ),
        );

      if (existingCode.length > 0) {
        return existingCode[0];
      }
    }

    const code = randomBytes(3).toString('hex').toUpperCase();

    const [{ createdAt }] = await this.db.transaction((t) =>
      t
        .insert(verificationCodes)
        .values({
          window: '15m',
          code,
          data,
          key,
        })
        .returning({ createdAt: verificationCodes.created_at }),
    );

    return { code, expiresAt: new Date(createdAt.valueOf() + 15 * 60_000) };
  }
  async findUserConnections(id: number) {
    return await this.db.query.accountConnections.findMany({
      columns: {
        id: true,
        createdAt: true,
        updatedAt: true,
        provider: true,
        status: true,
      },
      where: (connections, { eq }) => eq(connections.user, id),
    });
  }
  async updateUserPrefs(user: number, update: UpdatePrefsDto) {
    return await this.db.transaction((t) =>
      t.update(userPrefs).set(update).where(eq(userPrefs.user, user)),
    );
  }
  async findUserPrefs(user: number) {
    return await this.db.query.userPrefs.findFirst({
      where: (prefs, { eq }) => eq(prefs.user, user),
    });
  }

  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}
}
