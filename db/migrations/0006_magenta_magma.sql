DROP VIEW "public"."vw_reward_balances";--> statement-breakpoint
CREATE VIEW "public"."vw_reward_balances" AS (select "wallets"."id", "wallets"."ownedBy", 
      SUM(
        CASE
          WHEN ("wallet_transactions"."from" = "wallets"."id" and "wallet_transactions"."type" = 'reward') THEN "wallet_transactions"."value"
          WHEN ("wallet_transactions"."to" = "wallets"."id" and "wallet_transactions"."type" = 'withdrawal') THEN -1 * "wallet_transactions"."value"
          ELSE 0
        END
      )
     as "balance" from "wallets" left join "wallet_transactions" on ("wallet_transactions"."status" = 'complete' and ("wallet_transactions"."from" = "wallets"."id" or "wallet_transactions"."to" = "wallets"."id")) group by "wallets"."id");