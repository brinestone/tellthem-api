import { and, desc, eq, or, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const paymentMethodProviders = pgEnum('payment_method_provider', [
  'momo',
  'virtual',
]);
export const paymentMethodStatus = pgEnum('payment_method_status', [
  'active',
  'inactive',
  're-connection required',
]);
export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: paymentMethodProviders().notNull(),
    params: jsonb().notNull(),
    status: paymentMethodStatus().notNull().default('active'),
    createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    owner: bigint({ mode: 'number' })
      .notNull()
      .references(() => users.id),
  },
  (table) => {
    return {
      idx: uniqueIndex().on(table.provider, table.owner),
    };
  },
);

export const wallets = pgTable('wallets', {
  id: uuid().primaryKey().defaultRandom(),
  ownedBy: bigint({ mode: 'number' })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp({ mode: 'date' }).defaultNow(),
  updatedAt: timestamp({ mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date()),
  startingBalance: bigint({ mode: 'number' }).default(0),
});

export const transactionStatus = pgEnum('transaction_status', [
  'pending',
  'cancelled',
  'complete',
]);
export const walletTransactionType = pgEnum('wallet_transaction_type', [
  'funding',
  'reward',
  'withdrawal',
]);
export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid().primaryKey().defaultRandom(),
  value: bigint({ mode: 'number' }),
  from: uuid().references(() => wallets.id),
  to: uuid()
    .notNull()
    .references(() => wallets.id),
  recordedAt: timestamp({ mode: 'date' }).defaultNow(),
  completedAt: timestamp({ mode: 'date' }),
  cancelledAt: timestamp({ mode: 'date' }),
  status: transactionStatus().default('pending'),
  type: walletTransactionType().notNull(),
  notes: text(),
  creditAllocation: uuid().references(() => walletCreditAllocations.id), // indicates that this transaction exhausts the allocation's value
});

export const creditAllocationStatus = pgEnum('credit_allocation_status', [
  'active',
  'cancelled',
  'complete',
]);
export const walletCreditAllocations = pgTable('credit_allocations', {
  id: uuid().primaryKey().defaultRandom(),
  allocated: bigint({ mode: 'number' }).notNull(),
  createdAt: timestamp({ mode: 'date' }).defaultNow(),
  updatedAt: timestamp({ mode: 'date' }).defaultNow(),
  status: creditAllocationStatus().notNull().default('active'),
  wallet: uuid()
    .notNull()
    .references(() => wallets.id),
});

export const paymentTransactions = pgTable('payment_transactions', {
  id: uuid().primaryKey().defaultRandom(),
  paymentMethod: paymentMethodProviders().notNull(),
  status: transactionStatus().notNull(),
  externalTransactionId: varchar({ length: 400 }),
  recordedAt: timestamp({ mode: 'date' }).defaultNow(),
  completedAt: timestamp({ mode: 'date' }),
  cancelledAt: timestamp({ mode: 'date' }),
  value: real().notNull(),
  exchangeRateSnapshot: real().notNull(),
  convertedValue: real().notNull(),
  notes: text(),
  currency: varchar({ length: 10 }).notNull(),
  params: jsonb(),
  inbound: boolean().notNull(),
  walletTransaction: uuid().references(() => walletTransactions.id),
});

export const fundingBalances = pgView('vw_funding_balances').as((qb) => {
  const incomingTransactions = qb
    .select({
      walletId: walletTransactions.to,
      totalIncoming:
        sql<number>`COALESCE(SUM(${walletTransactions.value}), 0)`.as(
          'total_incoming',
        ),
    })
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.status, 'complete'),
        eq(walletTransactions.type, 'funding'),
      ),
    )
    .groupBy(walletTransactions.to)
    .as('incoming_transactions');

  const allocationSummary = qb
    .select({
      walletId: walletCreditAllocations.wallet,
      totalAllocated:
        sql<number>`COALESCE(SUM(${walletCreditAllocations.allocated}), 0)`.as(
          'total_allocated',
        ),
    })
    .from(walletCreditAllocations)
    .where(eq(walletCreditAllocations.status, 'active'))
    .groupBy(walletCreditAllocations.wallet)
    .as('allocation_summary');

  return qb
    .select({
      id: wallets.id,
      owner: wallets.ownedBy,
      balance: sql<number>`
        ${wallets.startingBalance} -
        COALESCE(${allocationSummary.totalAllocated},0) +
        COALESCE(${incomingTransactions.totalIncoming},0)
      `.as('balance'),
    })
    .from(wallets)
    .leftJoin(incomingTransactions, (w) =>
      eq(incomingTransactions.walletId, w.id),
    )
    .leftJoin(allocationSummary, (w) => eq(allocationSummary.walletId, w.id));
});

export const rewardBalances = pgView('vw_reward_balances').as((qb) => {
  return qb
    .select({
      id: wallets.id,
      owner: wallets.ownedBy,
      balance: sql<number>`
      SUM(
        CASE
          WHEN ${and(eq(walletTransactions.to, wallets.id), eq(walletTransactions.type, 'reward'))} THEN ${walletTransactions.value}
          WHEN ${and(eq(walletTransactions.from, wallets.id), eq(walletTransactions.type, 'withdrawal'))} THEN -1 * ${walletTransactions.value}
          ELSE 0
        END
      )
    `.as('balance'),
    })
    .from(wallets)
    .leftJoin(walletTransactions, (r) =>
      and(
        eq(walletTransactions.status, 'complete'),
        or(
          eq(walletTransactions.from, wallets.id),
          eq(walletTransactions.to, wallets.id),
        ),
      ),
    )
    .groupBy(wallets.id);
});

export const vwCreditAllocations = pgView('vw_credit_allocations').as((qb) => {
  return qb
    .select({
      id: walletCreditAllocations.id,
      wallet: walletCreditAllocations.wallet,
      allocated: walletCreditAllocations.allocated,
      exhausted: sql<number>`
        SUM(
          CASE
            WHEN ${and(eq(walletTransactions.type, 'reward'), eq(walletTransactions.from, walletCreditAllocations.wallet))} THEN ${walletTransactions.value}
            ELSE 0
          END
        )
      `.as('exhausted'),
    })
    .from(walletCreditAllocations)
    .leftJoin(walletTransactions, (allocation) =>
      and(
        eq(allocation.id, walletTransactions.creditAllocation),
        eq(walletTransactions.type, 'reward'),
        eq(walletTransactions.from, allocation.wallet),
      ),
    )
    .groupBy(walletCreditAllocations.id);
});

export const vwWalletTransferGroups = pgView('vw_wallet_transfer_groups').as(
  (qb) =>
    qb
      .select({
        wallet: sql<string>`${wallets.id}`.as('wallet'),
        owner: sql<number>`${wallets.ownedBy}`.as('owner'),
        burst: sql<Date | null>`DATE(${walletTransactions.recordedAt})`.as(
          'burst',
        ),
        transferredCredits: sql<number>`
        SUM(CASE
              WHEN ${eq(wallets.id, walletTransactions.from)} THEN -${walletTransactions.value}
              WHEN ${eq(wallets.id, walletTransactions.to)} THEN ${walletTransactions.value}
              ELSE 0
            END
        )
      `.as('transferred_credits'),
        fundingRewardsRatio: sql<number | null>`
        COALESCE(COUNT(CASE WHEN ${and(eq(walletTransactions.to, wallets.id), eq(walletTransactions.type, 'funding'))} THEN 1 END),0)
        /
        NULLIF(COUNT(CASE WHEN ${and(eq(walletTransactions.to, wallets.id), eq(walletTransactions.type, 'reward'))} THEN 1 END), 0)
      `.as('funding_to_reward_ratio'),
      })
      .from(wallets)
      .leftJoin(walletTransactions, () =>
        or(
          eq(walletTransactions.from, wallets.id),
          eq(walletTransactions.to, wallets.id),
        ),
      )
      .groupBy(({ burst }) => [burst, wallets.id])
      .orderBy(({ burst }) => desc(burst)),
);

export const vwWalletTransfers = pgView('vw_wallet_transfers').as((qb) =>
  qb
    .select({
      wallet: sql<string>`${wallets.id}`.as('wallet'),
      transaction: sql<string>`${walletTransactions.id}`.as('transaction_id'),
      credits: sql<number>`
    CASE
      WHEN ${eq(walletTransactions.from, wallets.id)} THEN -1 * ${walletTransactions.value}
      WHEN ${eq(walletTransactions.to, wallets.id)} THEN ${walletTransactions.value}
    END
  `.as('transferred_credits'),
      status: walletTransactions.status,
      type: walletTransactions.type,
      notes: walletTransactions.notes,
      recordedAt: walletTransactions.recordedAt,
      burst: sql<Date>`DATE(${walletTransactions.recordedAt})`.as('burst'),
      creditAllocation: walletTransactions.creditAllocation,
      payment: sql<string | null>`${paymentTransactions.id}`.as('payment'),
    })
    .from(walletTransactions)
    .leftJoin(wallets, () =>
      or(
        eq(walletTransactions.from, wallets.id),
        eq(walletTransactions.to, wallets.id),
      ),
    )
    .leftJoin(paymentTransactions, (r) =>
      eq(paymentTransactions.walletTransaction, r.transaction),
    )

    .groupBy(wallets.id, walletTransactions.id, paymentTransactions.id)
    .orderBy(desc(walletTransactions.recordedAt)),
);
