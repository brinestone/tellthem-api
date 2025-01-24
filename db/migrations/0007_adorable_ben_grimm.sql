DROP VIEW "public"."vw_verification_codes";--> statement-breakpoint
CREATE VIEW "public"."vw_verification_codes" AS (select "code", "created_at", 
      ("created_at" + "window")::TIMESTAMP
     as "expires_at", 
      (CASE
        WHEN "confirmed_at" IS NOT NULL THEN true
        ELSE NOW() > ("created_at" + "window")
      END)::BOOlEAN
     as "is_expired", "data", "key" from "verification_codes");