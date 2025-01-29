CREATE TABLE "broadcast_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast" uuid NOT NULL,
	"viewedAt" timestamp DEFAULT now() NOT NULL,
	"ip" varchar(39)
);
--> statement-breakpoint
CREATE TABLE "publication_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection" uuid NOT NULL,
	"broadcastAt" timestamp DEFAULT now() NOT NULL,
	"slug" varchar(6) NOT NULL,
	CONSTRAINT "publication_broadcasts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "broadcast_views" ADD CONSTRAINT "broadcast_views_broadcast_publication_broadcasts_id_fk" FOREIGN KEY ("broadcast") REFERENCES "public"."publication_broadcasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_broadcasts" ADD CONSTRAINT "publication_broadcasts_connection_account_connections_id_fk" FOREIGN KEY ("connection") REFERENCES "public"."account_connections"("id") ON DELETE no action ON UPDATE no action;