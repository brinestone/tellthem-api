DROP VIEW "public"."vw_wallet_transfer_groups";--> statement-breakpoint
CREATE VIEW "public"."vw_wallet_transfer_groups" AS (select "wallets"."id" as "wallet", "wallets"."ownedBy", DATE("wallet_transactions"."recordedAt") as "burst", 
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