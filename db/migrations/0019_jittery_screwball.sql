ALTER TABLE "publication_broadcasts" DROP CONSTRAINT "publication_broadcasts_connection_account_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "publication_broadcasts" ALTER COLUMN "connection" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_broadcasts" ADD CONSTRAINT "publication_broadcasts_connection_account_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "public"."account_connections"("id") ON DELETE set null ON UPDATE no action;