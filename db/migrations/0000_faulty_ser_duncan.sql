CREATE TYPE "public"."blob_storage" AS ENUM('temporary', 'permanent');--> statement-breakpoint
CREATE TYPE "public"."credit_allocation_status" AS ENUM('active', 'cancelled', 'complete');--> statement-breakpoint
CREATE TYPE "public"."payment_method_provider" AS ENUM('momo', 'virtual');--> statement-breakpoint
CREATE TYPE "public"."payment_method_status" AS ENUM('active', 'inactive', 're-connection required');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'cancelled', 'complete');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('funding', 'reward', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."account_connection_providers" AS ENUM('telegram');--> statement-breakpoint
CREATE TYPE "public"."account_connection_status" AS ENUM('active', 'inactive', 'reconnect_required');--> statement-breakpoint
CREATE TYPE "public"."theme_pref" AS ENUM('system', 'dark', 'light');--> statement-breakpoint
CREATE TABLE "broadcast_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication" bigint,
	"broadcast" uuid NOT NULL,
	"viewedAt" timestamp DEFAULT now() NOT NULL,
	"deviceHash" varchar(64) NOT NULL,
	"ip" varchar(39) NOT NULL,
	"userAgent" text,
	"clickCount" integer DEFAULT 1 NOT NULL,
	"user" bigint
);
--> statement-breakpoint
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
CREATE TABLE "campaign_publications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaign_publications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"campaign" bigint NOT NULL,
	"creditAllocation" uuid NOT NULL,
	"publishAfter" date DEFAULT now(),
	"publishBefore" date
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" varchar(255) NOT NULL,
	"description" text,
	"media" text[] DEFAULT '{}',
	"links" text[] DEFAULT '{}',
	"emails" text[] DEFAULT '{}',
	"phones" text[] DEFAULT '{}',
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"categories" bigint[] DEFAULT '{}',
	"owner" bigint NOT NULL,
	"redirectUrl" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "publication_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection" uuid,
	"publication" bigint,
	"ack" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"sentAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"image" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_method_provider" NOT NULL,
	"params" jsonb NOT NULL,
	"status" "payment_method_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"owner" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paymentMethod" "payment_method_provider" NOT NULL,
	"status" "transaction_status" NOT NULL,
	"externalTransactionId" varchar(400),
	"recordedAt" timestamp DEFAULT now(),
	"completedAt" timestamp,
	"cancelledAt" timestamp,
	"value" real NOT NULL,
	"exchangeRateSnapshot" real NOT NULL,
	"convertedValue" real NOT NULL,
	"notes" text,
	"currency" varchar(10) NOT NULL,
	"params" jsonb,
	"inbound" boolean NOT NULL,
	"walletTransaction" uuid
);
--> statement-breakpoint
CREATE TABLE "credit_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allocated" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"status" "credit_allocation_status" DEFAULT 'active' NOT NULL,
	"wallet" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"value" bigint,
	"from" uuid,
	"to" uuid NOT NULL,
	"recordedAt" timestamp DEFAULT now(),
	"completedAt" timestamp,
	"cancelledAt" timestamp,
	"status" "transaction_status" DEFAULT 'pending',
	"type" "wallet_transaction_type" NOT NULL,
	"notes" text,
	"creditAllocation" uuid
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownedBy" bigint NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"startingBalance" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" varchar(39) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"window" interval NOT NULL,
	"user" bigint NOT NULL,
	"replaced_by" uuid
);
--> statement-breakpoint
CREATE TABLE "account_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"user" bigint NOT NULL,
	"provider" "account_connection_providers" NOT NULL,
	"params" jsonb NOT NULL,
	"status" "account_connection_status" DEFAULT 'active' NOT NULL,
	"providerId" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federated_credentials" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"provider" varchar(255) NOT NULL,
	"lastAccessToken" varchar(500),
	"refreshToken" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(32) NOT NULL,
	"user" bigint NOT NULL,
	"ip" varchar(39) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"replaced_by" uuid,
	"revoked_by" bigint,
	"window" interval NOT NULL,
	"access_token" uuid NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_prefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"user" bigint NOT NULL,
	"country" varchar(2) NOT NULL,
	"theme" "theme_pref" DEFAULT 'light' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"language" varchar(2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 100 CACHE 1),
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"names" varchar(100) NOT NULL,
	"imageUrl" varchar(255),
	"email" varchar(100) NOT NULL,
	"phone" varchar(255),
	"credentials" varchar
);
--> statement-breakpoint
CREATE TABLE "verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"window" interval NOT NULL,
	"code" varchar(6) NOT NULL,
	"confirmed_at" timestamp,
	"data" jsonb,
	"key" varchar,
	CONSTRAINT "verification_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD CONSTRAINT "broadcast_views_publication_campaign_publications_id_fk" FOREIGN KEY ("publication") REFERENCES "public"."campaign_publications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD CONSTRAINT "broadcast_views_broadcast_publication_broadcasts_id_fk" FOREIGN KEY ("broadcast") REFERENCES "public"."publication_broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD CONSTRAINT "broadcast_views_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_blobs" ADD CONSTRAINT "campaign_blobs_campaign_campaigns_id_fk" FOREIGN KEY ("campaign") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_publications" ADD CONSTRAINT "campaign_publications_campaign_campaigns_id_fk" FOREIGN KEY ("campaign") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_publications" ADD CONSTRAINT "campaign_publications_creditAllocation_credit_allocations_id_fk" FOREIGN KEY ("creditAllocation") REFERENCES "public"."credit_allocations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_broadcasts" ADD CONSTRAINT "publication_broadcasts_connection_account_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "public"."account_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_broadcasts" ADD CONSTRAINT "publication_broadcasts_publication_campaign_publications_id_fk" FOREIGN KEY ("publication") REFERENCES "public"."campaign_publications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_owner_users_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_walletTransaction_wallet_transactions_id_fk" FOREIGN KEY ("walletTransaction") REFERENCES "public"."wallet_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_wallet_wallets_id_fk" FOREIGN KEY ("wallet") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_from_wallets_id_fk" FOREIGN KEY ("from") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_to_wallets_id_fk" FOREIGN KEY ("to") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_creditAllocation_credit_allocations_id_fk" FOREIGN KEY ("creditAllocation") REFERENCES "public"."credit_allocations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_ownedBy_users_id_fk" FOREIGN KEY ("ownedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_replaced_by_access_tokens_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "public"."access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_connections" ADD CONSTRAINT "account_connections_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_refresh_tokens_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "public"."refresh_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_access_token_access_tokens_id_fk" FOREIGN KEY ("access_token") REFERENCES "public"."access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_prefs" ADD CONSTRAINT "user_prefs_user_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_credentials_federated_credentials_id_fk" FOREIGN KEY ("credentials") REFERENCES "public"."federated_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "broadcast_views_broadcast_deviceHash_ip_index" ON "broadcast_views" USING btree ("broadcast","deviceHash","ip");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_provider_owner_index" ON "payment_methods" USING btree ("provider","owner");--> statement-breakpoint
CREATE UNIQUE INDEX "account_connections_provider_providerId_index" ON "account_connections" USING btree ("provider","providerId");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_user_index" ON "refresh_tokens" USING btree ("token","user");--> statement-breakpoint
CREATE VIEW "public"."vw_campaign_blobs" AS (select "campaign_blobs"."id", "campaign_blobs"."campaign", "campaign_blobs"."storage", "campaign_blobs"."uploadedAt", "campaign_blobs"."path", "campaign_blobs"."size", CASE
                              WHEN "campaign_blobs"."storage" = 'permanent' THEN ("campaign_blobs"."campaign" IS NULL)
                              WHEN "campaign_blobs"."storage" = 'temporary' THEN (NOW() > ("campaign_blobs"."updatedAt" + "campaign_blobs"."tempWindow"))
                              ELSE true
                            END as "is_stale" from "campaign_blobs" left join "campaigns" on "campaigns"."id" = "campaign_blobs"."campaign");--> statement-breakpoint
CREATE VIEW "public"."vw_campaign_publications" AS (select count("publication_broadcasts"."id") as "broadcast_count", count("broadcast_views"."id") as "unique_visits", sum("broadcast_views"."clickCount") as "total_visits", COALESCE(SUM("wallet_transactions"."value"), 0) as "total_exhausted_credits", "credit_allocations"."allocated", "campaign_publications"."creditAllocation", "campaign_publications"."campaign", "campaign_publications"."updatedAt", "campaign_publications"."id", "campaign_publications"."createdAt", "campaigns"."owner" from "campaign_publications" left join "campaigns" on "campaigns"."id" = "campaign_publications"."campaign" left join "publication_broadcasts" on ("publication_broadcasts"."publication" = "campaign_publications"."id" and "publication_broadcasts"."ack" = true) left join "broadcast_views" on "broadcast_views"."publication" = "campaign_publications"."id" left join "credit_allocations" on "credit_allocations"."id" = "campaign_publications"."creditAllocation" left join "wallet_transactions" on ("wallet_transactions"."creditAllocation" = "campaign_publications"."creditAllocation" and "wallet_transactions"."status" = 'complete' and "wallet_transactions"."type" = 'reward') group by "credit_allocations"."id", "campaign_publications"."id", "campaigns"."id");--> statement-breakpoint
CREATE VIEW "public"."vw_categories" AS (select "categories"."id", "categories"."title", COUNT("campaign_publications"."id") as "publication_count" from "categories" left join "campaigns" on "categories"."id" = ANY("campaigns"."categories") left join "campaign_publications" on "campaign_publications"."campaign" = "campaigns"."id" AND ("campaign_publications"."publishBefore" > NOW() OR "campaign_publications"."publishBefore" IS NULL) group by "categories"."id");--> statement-breakpoint
CREATE VIEW "public"."vw_funding_balances" AS (select "wallets"."id", "wallets"."ownedBy", 
        "wallets"."startingBalance" -
        COALESCE("total_allocated",0) +
        COALESCE("total_incoming",0)
       as "balance" from "wallets" left join (select "to", COALESCE(SUM("value"), 0) as "total_incoming" from "wallet_transactions" where ("wallet_transactions"."status" = 'complete' and "wallet_transactions"."type" = 'funding') group by "wallet_transactions"."to") "incoming_transactions" on "incoming_transactions"."to" = "wallets"."id" left join (select "wallet", COALESCE(SUM("allocated"), 0) as "total_allocated" from "credit_allocations" where "credit_allocations"."status" = 'active' group by "credit_allocations"."wallet") "allocation_summary" on "allocation_summary"."wallet" = "wallets"."id");--> statement-breakpoint
CREATE VIEW "public"."vw_reward_balances" AS (select "wallets"."id", "wallets"."ownedBy", 
      SUM(
        CASE
          WHEN ("wallet_transactions"."to" = "wallets"."id" and "wallet_transactions"."type" = 'reward') THEN "wallet_transactions"."value"
          WHEN ("wallet_transactions"."from" = "wallets"."id" and "wallet_transactions"."type" = 'withdrawal') THEN -1 * "wallet_transactions"."value"
          ELSE 0
        END
      )
     as "balance" from "wallets" left join "wallet_transactions" on ("wallet_transactions"."status" = 'complete' and ("wallet_transactions"."from" = "wallets"."id" or "wallet_transactions"."to" = "wallets"."id")) group by "wallets"."id");--> statement-breakpoint
CREATE VIEW "public"."vw_credit_allocations" AS (select "credit_allocations"."id", "credit_allocations"."wallet", "credit_allocations"."allocated", 
        SUM(
          CASE
            WHEN ("wallet_transactions"."type" = 'reward' and "wallet_transactions"."from" = "credit_allocations"."wallet") THEN "wallet_transactions"."value"
            ELSE 0
          END
        )
       as "exhausted" from "credit_allocations" left join "wallet_transactions" on ("credit_allocations"."id" = "wallet_transactions"."creditAllocation" and "wallet_transactions"."type" = 'reward' and "wallet_transactions"."from" = "credit_allocations"."wallet") group by "credit_allocations"."id");--> statement-breakpoint
CREATE VIEW "public"."vw_access_tokens" AS (select "user", (now() > ("created_at" + "window")::TIMESTAMP)::BOOLEAN OR revoked_at IS NOT NULL OR replaced_by IS NOT NULL as "is_expired", (created_at + "window")::TIMESTAMP as "expires_at", "created_at", "ip", "id" from "access_tokens");--> statement-breakpoint
CREATE VIEW "public"."vw_refresh_tokens" AS (select (now()::TIMESTAMP > ("created_at" + "window")::TIMESTAMP)::BOOLEAN OR "revoked_by" IS NOT NULL as "is_expired", ("created_at" + "window")::TIMESTAMP as "expires", "revoked_by", "replaced_by", "created_at", "access_token", "ip", "user", "token", "id" from "refresh_tokens");--> statement-breakpoint
CREATE VIEW "public"."vw_verification_codes" AS (select "code", "created_at", 
      ("created_at" + "window")::TIMESTAMP
     as "expires_at", 
      (CASE
        WHEN "confirmed_at" IS NOT NULL THEN true
        ELSE NOW() > ("created_at" + "window")
      END)::BOOlEAN
     as "is_expired", "data", "key" from "verification_codes");