DROP VIEW "public"."vw_wallet_transfers";--> statement-breakpoint
DROP VIEW "public"."vw_wallet_transfer_groups";--> statement-breakpoint
CREATE VIEW "public"."vw_wallet_transfers" AS (select "wallets"."id" as "wallet", "wallet_transactions"."id" as "transaction_id", 
    CASE
      WHEN "wallet_transactions"."from" = "wallets"."id" THEN -1 * "wallet_transactions"."value"
      WHEN "wallet_transactions"."to" = "wallets"."id" THEN "wallet_transactions"."value"
    END
   as "transferred_credits", "wallet_transactions"."status", "wallet_transactions"."type", "wallet_transactions"."notes", "wallet_transactions"."recordedAt", DATE("wallet_transactions"."recordedAt") as "burst" from "wallet_transactions" left join "wallets" on ("wallet_transactions"."from" = "wallets"."id" or "wallet_transactions"."to" = "wallets"."id") group by "wallets"."id", "wallet_transactions"."id" order by "wallet_transactions"."recordedAt" desc);--> statement-breakpoint
CREATE VIEW "public"."vw_wallet_transfer_groups" AS (select "wallets"."id", DATE("wallet_transactions"."recordedAt") as "burst", 
        SUM(CASE
              WHEN "wallets"."id" = "wallet_transactions"."from" THEN -"wallet_transactions"."value"
              WHEN "wallets"."id" = "wallet_transactions"."to" THEN "wallet_transactions"."value"
              ELSE 0
            END
        )
       as "transferred_credits", 
        COALESCE(COUNT(CASE WHEN ("wallet_transactions"."to" = "wallets"."id" and "wallet_transactions"."type" = 'funding') THEN 1 END),0)
        /
        NULLIF(COUNT(CASE WHEN ("wallet_transactions"."to" = "wallets"."id" and "wallet_transactions"."type" = 'reward') THEN 1 END), 0)
       as "funding_to_reward_ratio" from "wallets" left join "wallet_transactions" on ("wallet_transactions"."from" = "wallets"."id" or "wallet_transactions"."to" = "wallets"."id") group by "burst", "wallets"."id" order by "burst" desc);