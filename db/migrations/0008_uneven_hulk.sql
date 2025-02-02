DROP VIEW "public"."vw_funding_balances";--> statement-breakpoint
CREATE VIEW "public"."vw_funding_balances" AS (select "wallets"."id", "wallets"."ownedBy", 
        "wallets"."startingBalance" -
        COALESCE("total_allocated",0) -
        COALESCE("total_incoming",0)
       as "balance" from "wallets" left join (select "to", COALESCE(SUM("value"), 0) as "total_incoming" from "wallet_transactions" where ("wallet_transactions"."status" = 'complete' and "wallet_transactions"."type" = 'funding') group by "wallet_transactions"."to") "incoming_transactions" on "incoming_transactions"."to" = "wallets"."id" left join (select "wallet", COALESCE(SUM("allocated"), 0) as "total_allocated" from "credit_allocations" where "credit_allocations"."status" = 'active' group by "credit_allocations"."wallet") "allocation_summary" on "allocation_summary"."wallet" = "wallets"."id");