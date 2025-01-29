CREATE TYPE "public"."blob_storage" AS ENUM('temporary', 'permanent');--> statement-breakpoint
CREATE TABLE "campaign_blobs" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"storage" "blob_storage" DEFAULT 'temporary',
	"path" varchar(500) NOT NULL,
	"campaign" bigint,
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	"size" bigint NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"tempWindow" interval DEFAULT '24h'
);
--> statement-breakpoint
ALTER TABLE "campaign_blobs" ADD CONSTRAINT "campaign_blobs_campaign_campaigns_id_fk" FOREIGN KEY ("campaign") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE VIEW "public"."vw_campaign_blobs" AS (select "campaign_blobs"."id", "campaign_blobs"."campaign", "campaign_blobs"."storage", "campaign_blobs"."uploadedAt", "campaign_blobs"."path", "campaign_blobs"."size", CASE
                              WHEN "campaign_blobs"."storage" = 'permanent' THEN ("campaign_blobs"."campaign" IS NULL AND ("campaign_blobs"."updatedAt" + '24h'::INTERVAL) < NOW())
                              WHEN "campaign_blobs"."storage" = 'temporary' THEN (NOW() > ("campaign_blobs"."updatedAt" + "campaign_blobs"."tempWindow"))
                              ELSE true
                            END as "is_stale" from "campaign_blobs" left join "campaigns" on "campaigns"."id" = "campaign_blobs"."campaign");