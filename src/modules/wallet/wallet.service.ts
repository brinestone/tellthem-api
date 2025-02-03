import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  campaignPublications,
  campaigns,
  publicationBroadcasts,
} from '@schemas/campaigns';
import {
  fundingBalances,
  paymentTransactions,
  rewardBalances,
  vwWalletTransferGroups,
  vwWalletTransfers,
  walletCreditAllocations,
  wallets,
  walletTransactions,
} from '@schemas/finance';
import { accountConnections } from '@schemas/users';
import { and, count, eq, inArray, sql, desc } from 'drizzle-orm';
import {
  from,
  identity,
  map,
  mergeMap,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';

export class ParametersError extends Error {
  constructor(...parameters: string[]) {
    super(
      'Insufficnent parameters: "' + parameters.join(',') + '" for transaction',
    );
  }
}

export class InsufficientFundsError extends Error {
  constructor() {
    super('Insufficient funds');
  }
}

@Injectable()
export class WalletService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDb,
    private cs: ConfigService,
  ) {}

  async transferRewards(broadcast: string) {
    return await this.db.transaction(async (t) => {
      const data = await t
        .select({
          publication: publicationBroadcasts.publication,
          connection: publicationBroadcasts.connection,
          campaign: campaignPublications.campaign,
          broadcaster: accountConnections.user,
          campaignOwner: campaigns.owner,
          creditAllocation: campaignPublications.creditAllocation,
          allocatedCredits: walletCreditAllocations.allocated,
          remainingCredits: sql<number>`
            ${walletCreditAllocations.allocated} - 
            SUM(CASE WHEN ${walletTransactions.value} IS NULL THEN 0
                  ELSE ${walletTransactions.value}
                END
            )`.as('remaining_credits'),
          srcWallet: walletCreditAllocations.wallet,
          destWallet: wallets.id,
        })
        .from(publicationBroadcasts)
        .leftJoin(campaignPublications, (r) =>
          eq(campaignPublications.id, r.publication),
        )
        .leftJoin(campaigns, (r) => eq(campaigns.id, r.campaign))
        .leftJoin(accountConnections, (r) =>
          eq(accountConnections.id, r.connection),
        )
        .leftJoin(walletCreditAllocations, (r) =>
          eq(walletCreditAllocations.id, r.creditAllocation),
        )
        .leftJoin(walletTransactions, (r) =>
          and(
            eq(walletTransactions.creditAllocation, r.creditAllocation),
            eq(walletTransactions.status, 'complete'),
            eq(walletTransactions.type, 'reward'),
          ),
        )
        .leftJoin(wallets, (r) => eq(wallets.ownedBy, r.broadcaster))
        .groupBy(
          publicationBroadcasts.publication,
          publicationBroadcasts.connection,
          accountConnections.user,
          campaignPublications.creditAllocation,
          walletCreditAllocations.id,
          wallets.id,
          campaignPublications.campaign,
          campaigns.owner,
        )
        .where(eq(publicationBroadcasts.id, broadcast));

      if (data.length == 0) throw new ParametersError();
      const [
        {
          broadcaster,
          campaignOwner,
          creditAllocation,
          remainingCredits,
          srcWallet,
          destWallet,
        },
      ] = data;

      if (remainingCredits < this.cs.getOrThrow<number>('MIN_REWARD'))
        throw new InsufficientFundsError();

      if (
        !destWallet ||
        !srcWallet ||
        !creditAllocation ||
        !broadcaster ||
        !campaignOwner
      )
        throw new ParametersError(
          'destWallet',
          'srcWallet',
          'creditAllocation',
          'broadcaster',
          'campaignOwner',
        );

      const [{ id }] = await t
        .insert(walletTransactions)
        .values({
          to: destWallet,
          type: 'reward',
          from: srcWallet,
          status: 'complete',
          notes: 'rewards granted',
          creditAllocation,
          completedAt: new Date(),
          value: this.cs.getOrThrow<number>('MIN_REWARD'),
        })
        .returning({
          id: walletTransactions.id,
        });

      return {
        transactionId: id,
        campaignOwner,
        broadcaster,
        srcWallet,
        destWallet,
      };
    });
  }

  countWalletUserTransactions(owner: number) {
    return from(
      this.db
        .select({ total: count(vwWalletTransferGroups) })
        .from(wallets)
        .leftJoin(vwWalletTransferGroups, () =>
          eq(vwWalletTransferGroups.wallet, wallets.id),
        )
        .where(eq(wallets.ownedBy, owner))
        .limit(1),
    ).pipe(map(([{ total }]) => total));
  }

  findWalletTransfers(owner: number, page: number, size: number) {
    return from(
      this.db.query.wallets.findFirst({
        where: (w, { eq }) => eq(w.ownedBy, owner),
      }),
    ).pipe(
      switchMap((wallet) => {
        if (!wallet)
          return throwError(() => new NotFoundException('wallet not found'));
        return this.db
          .select()
          .from(vwWalletTransferGroups)
          .where(eq(vwWalletTransferGroups.wallet, wallet.id));
      }),
      mergeMap(identity),
      mergeMap((group) => {
        return from(
          this.db
            .select({
              transaction: vwWalletTransfers.transaction,
              credits: vwWalletTransfers.credits,
              status: vwWalletTransfers.status,
              type: vwWalletTransfers.type,
              notes: vwWalletTransfers.notes,
              recordedAt: vwWalletTransfers.recordedAt,
              creditAllocationId: vwWalletTransfers.creditAllocation,
              paymentTransactionId: vwWalletTransfers.payment,
              creditAllocation: {
                allocated: walletCreditAllocations.allocated,
                status: walletCreditAllocations.status,
              },
              paymentTransaction: {
                status: paymentTransactions.status,
                amount: paymentTransactions.value,
                currency: paymentTransactions.currency,
              },
            })
            .from(vwWalletTransfers)
            .leftJoin(paymentTransactions, (r) =>
              eq(paymentTransactions.walletTransaction, r.transaction),
            )
            .leftJoin(walletCreditAllocations, (r) =>
              eq(walletCreditAllocations.id, r.creditAllocationId),
            )
            .where(
              sql`vw_wallet_transfers.burst=${group.burst} AND vw_wallet_transfers.wallet=${group.wallet}`,
            )
            .orderBy(desc(vwWalletTransfers.recordedAt)),
        ).pipe(map((transfers) => ({ ...group, transfers })));
      }),
      toArray(),
    );
  }

  async updateWalletTransaction(
    walletTransaction: string,
    transactionId: string,
  ) {
    const [{ status, convertedAmount }] = await this.db
      .select({
        walletTransaction: paymentTransactions.walletTransaction,
        status: paymentTransactions.status,
        convertedAmount: paymentTransactions.convertedValue,
      })
      .from(paymentTransactions)
      .innerJoin(walletTransactions, (p) =>
        eq(p.walletTransaction, walletTransactions.id),
      )
      .where(eq(paymentTransactions.id, transactionId))
      .limit(1);

    return await this.db.transaction(async (t) => {
      const [{ from, to }] = await t
        .update(walletTransactions)
        .set({
          status,
          value: Math.floor(convertedAmount),
        })
        .where(eq(walletTransactions.id, walletTransaction))
        .returning({
          from: walletTransactions.from,
          to: walletTransactions.to,
        });

      const ids = [to];
      if (from) ids.push(from);
      return await t
        .select({
          owner: wallets.ownedBy,
          id: wallets.id,
        })
        .from(wallets)
        .where(inArray(wallets.id, ids));
    });
  }

  async topUpWallet(owner: number) {
    const wallet = await this.db.query.wallets.findFirst({
      columns: {
        id: true,
      },
      where: (w, { eq }) => eq(w.ownedBy, owner),
    });

    if (!wallet) throw new NotFoundException('Wallet not found');
    const [{ id }] = await this.db.transaction((t) =>
      t
        .insert(walletTransactions)
        .values({
          to: wallet.id,
          type: 'funding',
          notes: 'wallet top-up',
        })
        .returning({ id: walletTransactions.id }),
    );
    return id;
  }

  async getBalances(owner: number) {
    const [funding] = await this.db
      .select()
      .from(fundingBalances)
      .where((balance) => eq(balance.owner, owner))
      .limit(1);
    const [rewards] = await this.db
      .select()
      .from(rewardBalances)
      .where((balance) => eq(balance.owner, owner))
      .limit(1);

    return { funding, rewards };
  }

  async deleteWallet(owner: number) {
    const [{ id }] = await this.db.transaction((t) =>
      t
        .delete(wallets)
        .where(eq(wallets.ownedBy, owner))
        .returning({ id: wallets.id }),
    );
    return id;
  }

  async createWallet(owner: number, startingBalance = 0) {
    const [{ id }] = await this.db.transaction((t) =>
      t
        .insert(wallets)
        .values({
          ownedBy: owner,
          startingBalance,
        })
        .returning({ id: wallets.id }),
    );
    return id;
  }
}
