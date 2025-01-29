import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  fundingBalances,
  paymentTransactions,
  rewardBalances,
  wallets,
  walletTransactions,
} from '@schemas/finance';
import { eq, or, desc, count, inArray } from 'drizzle-orm';

@Injectable()
export class WalletService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async countWalletUserTransactions(owner: number) {
    const [{ total }] = await this.db
      .select({ total: count(walletTransactions.id) })
      .from(wallets)
      .leftJoin(walletTransactions, () =>
        or(
          eq(walletTransactions.from, wallets.id),
          eq(walletTransactions.to, wallets.id),
        ),
      )
      .groupBy(wallets.id)
      .where(eq(wallets.ownedBy, owner))
      .limit(1);
    return total;
  }

  async findWalletTransfers(owner: number, page: number, size: number) {
    const wallet = await this.db.query.wallets.findFirst({
      where: (w, { eq }) => eq(w.ownedBy, owner),
    });

    if (!wallet) throw new NotFoundException('User wallet not found');
    const transactions = await this.db
      .select({
        id: walletTransactions.id,
        from: walletTransactions.from,
        to: walletTransactions.to,
        amount: walletTransactions.value,
        status: walletTransactions.status,
        type: walletTransactions.type,
        date: walletTransactions.recordedAt,
        payment: {
          id: paymentTransactions.id,
          currency: paymentTransactions.currency,
          amount: paymentTransactions.value,
          status: paymentTransactions.status,
        },
      })
      .from(walletTransactions)
      .leftJoin(paymentTransactions, (wt) =>
        eq(paymentTransactions.walletTransaction, wt.id),
      )
      .orderBy(desc(walletTransactions.recordedAt))
      .where(
        or(
          eq(walletTransactions.from, wallet.id),
          eq(walletTransactions.to, wallet.id),
        ),
      )
      .offset(page * size)
      .limit(size);
    return transactions;
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
      .where((balance) => eq(balance.ownerId, owner))
      .limit(1);
    const [rewards] = await this.db
      .select()
      .from(rewardBalances)
      .where((balance) => eq(balance.ownerId, owner))
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
