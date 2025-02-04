CREATE TYPE "public"."reward_grant_status" AS ENUM('granted', 'failed', 'pending');--> statement-breakpoint
CREATE TABLE "reward_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcastView" uuid NOT NULL,
	"status" "reward_grant_status" DEFAULT 'pending',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"grantedAt" timestamp,
	"failedAt" timestamp,
	"walletTransaction" uuid
);
--> statement-breakpoint
ALTER TABLE "reward_grants" ADD CONSTRAINT "reward_grants_broadcastView_broadcast_views_id_fk" FOREIGN KEY ("broadcastView") REFERENCES "public"."broadcast_views"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_grants" ADD CONSTRAINT "reward_grants_walletTransaction_wallet_transactions_id_fk" FOREIGN KEY ("walletTransaction") REFERENCES "public"."wallet_transactions"("id") ON DELETE set null ON UPDATE no action;