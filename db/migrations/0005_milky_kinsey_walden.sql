DROP VIEW "public"."vw_wallet_transfers";--> statement-breakpoint
CREATE VIEW "public"."vw_wallet_transfers" AS (select "wallets"."id" as "wallet", "wallet_transactions"."id" as "transaction_id", 
    CASE
      WHEN "wallet_transactions"."from" = "wallets"."id" THEN -1 * "wallet_transactions"."value"
      WHEN "wallet_transactions"."to" = "wallets"."id" THEN "wallet_transactions"."value"
    END
   as "transferred_credits", "wallet_transactions"."status", "wallet_transactions"."type", "wallet_transactions"."notes", "wallet_transactions"."recordedAt", DATE("wallet_transactions"."recordedAt") as "burst", "wallet_transactions"."creditAllocation", "payment_transactions"."id" as "payment" from "wallet_transactions" left join "wallets" on ("wallet_transactions"."from" = "wallets"."id" or "wallet_transactions"."to" = "wallets"."id") left join "payment_transactions" on "payment_transactions"."walletTransaction" = "wallet_transactions"."id" group by "wallets"."id", "wallet_transactions"."id", "payment_transactions"."id" order by "wallet_transactions"."recordedAt" desc);