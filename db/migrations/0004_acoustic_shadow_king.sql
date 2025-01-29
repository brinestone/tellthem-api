ALTER TABLE "wallet_transactions" DROP CONSTRAINT "wallet_transactions_accountTransaction_payment_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "wallet_transactions" ALTER COLUMN "value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "walletTransaction" uuid;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_walletTransaction_wallet_transactions_id_fk" FOREIGN KEY ("walletTransaction") REFERENCES "public"."wallet_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" DROP COLUMN "accountTransaction";