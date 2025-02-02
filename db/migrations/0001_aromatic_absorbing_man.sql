DROP VIEW "public"."vw_campaign_publications";--> statement-breakpoint
ALTER TABLE "broadcast_views" ALTER COLUMN "ip" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD COLUMN "deviceHash" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD COLUMN "userAgent" text;--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD COLUMN "clickCount" integer DEFAULT 1;--> statement-breakpoint
CREATE UNIQUE INDEX "broadcast_views_broadcast_deviceHash_index" ON "broadcast_views" USING btree ("broadcast","deviceHash");--> statement-breakpoint
CREATE VIEW "public"."vw_campaign_publications" AS (select count("publication_broadcasts"."id") as "broadcast_count", count("broadcast_views"."id") as "unique_visits", sum("broadcast_views"."clickCount") as "total_visits", COALESCE(SUM("wallet_transactions"."value"), 0) as "total_exhausted_credits", "credit_allocations"."allocated", "campaign_publications"."creditAllocation", "campaign_publications"."campaign", "campaign_publications"."updatedAt", "campaign_publications"."id", "campaign_publications"."createdAt", "campaigns"."owner" from "campaign_publications" left join "campaigns" on "campaigns"."id" = "campaign_publications"."campaign" left join "publication_broadcasts" on ("publication_broadcasts"."publication" = "campaign_publications"."id" and "publication_broadcasts"."ack" = true) left join "broadcast_views" on "broadcast_views"."publication" = "campaign_publications"."id" left join "credit_allocations" on "credit_allocations"."id" = "campaign_publications"."creditAllocation" left join "wallet_transactions" on ("wallet_transactions"."creditAllocation" = "campaign_publications"."creditAllocation" and "wallet_transactions"."status" = 'complete' and "wallet_transactions"."type" = 'reward') group by "credit_allocations"."id", "campaign_publications"."id", "campaigns"."id");