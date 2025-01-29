import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  accessTokens,
  federatedCredentials,
  refreshTokens,
  UserInfo,
  userPrefs,
  users,
  vwRefreshTokens,
} from '@schemas/users';
import { eq } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';
import { randomBytes } from 'node:crypto';
import { UserClaimsDto } from '../dto';

export type UserInput = {
  email: string;
  names: string;
  imageUrl?: string;
  phone?: string;
};

@Injectable()
export class AuthService {
  async removeUser(id: number) {
    await this.db.delete(users).where(eq(users.id, id));
    return this.userCache.delete(id);
  }

  async revokeTokenPair(
    accessTokenId: string,
    refreshTokenId: string,
    user: number,
  ) {
    await this.db.transaction(async (t) => {
      await t
        .update(accessTokens)
        .set({ revoked_at: new Date() })
        .where(eq(accessTokens.id, accessTokenId));
      await t
        .update(refreshTokens)
        .set({ revoked_by: user })
        .where(eq(refreshTokens.id, refreshTokenId));
    });
  }

  async generateTokenPair(
    ip: string,
    claims: UserClaimsDto,
    existingTokenPair?: { access: string; refresh: string },
  ) {
    this.logger.log('generating token pair');
    const refreshValue = randomBytes(16).toString('hex');

    const { accessTokenId, refreshTokenId } = await this.db.transaction(
      async (t) => {
        const [{ accessTokenId }] = await t
          .insert(accessTokens)
          .values({
            ip,
            user: claims.sub,
            window: this.configService.getOrThrow<string>('JWT_LIFETIME'),
          })
          .returning({ accessTokenId: accessTokens.id });

        const [{ refreshTokenId }] = await t
          .insert(refreshTokens)
          .values({
            window: this.configService.getOrThrow<string>(
              'REFRESH_TOKEN_LIFETIME',
            ),
            ip,
            token: refreshValue,
            user: claims.sub,
            access_token: accessTokenId,
          })
          .returning({ refreshTokenId: refreshTokens.id });

        if (existingTokenPair) {
          const { access, refresh } = existingTokenPair;
          await t
            .update(accessTokens)
            .set({
              replaced_by: accessTokenId,
            })
            .where(eq(accessTokens.id, access));

          await t
            .update(refreshTokens)
            .set({
              replaced_by: refreshTokenId,
            })
            .where(eq(refreshTokens.id, refresh));
        }

        return { accessTokenId, refreshTokenId };
      },
    );

    claims.tokenId = accessTokenId;
    this.logger.verbose('signing access token');
    const accessToken = await this.jwtService.signAsync(claims);
    this.logger.verbose('signing refresh token');
    const refreshToken = await this.jwtService.signAsync(
      {
        value: refreshValue,
        tokenId: refreshTokenId,
      },
      {
        expiresIn: this.configService.getOrThrow<string>(
          'REFRESH_TOKEN_LIFETIME',
        ),
      },
    );

    return { accessToken, refreshToken };
  }

  async findExistingRefreshToken(ipAddress: string, id: string) {
    const ans = await this.db
      .select({
        access_token: vwRefreshTokens.access_token,
        user: vwRefreshTokens.user,
      })
      .from(vwRefreshTokens)
      .innerJoin(accessTokens, (r) => eq(r.access_token, accessTokens.id))
      .where(eq(vwRefreshTokens.id, id))
      .limit(1);
    return ans[0];
  }

  async findUserById(id: number) {
    if (this.userCache.has(id)) return this.userCache.get(id);
    return await this.userCache.fetch(id);
  }

  async updateCredentialAccessToken(
    refreshToken: string,
    credential: string,
    token: string,
  ) {
    await this.db.transaction(async (t) => {
      await t
        .update(federatedCredentials)
        .set({ lastAccessToken: token, refreshToken })
        .where(eq(federatedCredentials.id, credential));
      await t
        .update(users)
        .set({ updatedAt: new Date() })
        .where(eq(users.credentials, credential));
    });
  }

  async createNewUser(
    credentialId: string,
    refreshToken: string,
    provider: string,
    accessToken: string,
    input: UserInput,
  ) {
    const { userId } = await this.db.transaction(async (t) => {
      await t.insert(federatedCredentials).values({
        id: credentialId,
        lastAccessToken: accessToken,
        refreshToken,
        provider,
      });

      const [userInfo] = await t
        .insert(users)
        .values({
          credentials: credentialId,
          names: input.names,
          email: input.email,
          imageUrl: input.imageUrl,
        })
        .returning({
          userId: users.id,
          email: users.email,
        });

      const { userId } = userInfo;
      await t.insert(userPrefs).values({
        country: 'CM',
        currency: 'XAF',
        language: 'en',
        user: userId,
        theme: 'light',
      });

      return userInfo;
    });

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user;
  }

  async findUserByCredential(credential: string) {
    return this.db.query.users.findFirst({
      where: (user, { eq }) => eq(user.credentials, credential),
    });
  }

  private userCache = new LRUCache<number, UserInfo>({
    size: 100,
    maxSize: 1500,
    sizeCalculation: (value) => {
      return Object.entries(value)
        .map(([k, v]) => String(k).length + String(v).length)
        .reduce((acc, curr) => acc + curr, 0);
    },
    ttl: 2 * 3600 * 1000,
    fetchMethod: async (key) => {
      this.logger.verbose('updating user cache');
      return await this.db.query.users.findFirst({
        where: (user, { eq }) => eq(user.id, key),
      });
    },
  });
  private logger = new Logger(AuthService.name);
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDb,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}
}
