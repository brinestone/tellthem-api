DROP VIEW "public"."vw_campaign_blobs";--> statement-breakpoint
CREATE VIEW "public"."vw_campaign_blobs" AS (select "campaign_blobs"."id", "campaign_blobs"."campaign", "campaign_blobs"."storage", "campaign_blobs"."uploadedAt", "campaign_blobs"."path", "campaign_blobs"."size", CASE
                              WHEN "campaign_blobs"."storage" = 'permanent' THEN ("campaign_blobs"."campaign" IS NULL)
                              WHEN "campaign_blobs"."storage" = 'temporary' THEN (NOW() > ("campaign_blobs"."updatedAt" + "campaign_blobs"."tempWindow"))
                              ELSE true
                            END as "is_stale" from "campaign_blobs" left join "campaigns" on "campaigns"."id" = "campaign_blobs"."campaign");