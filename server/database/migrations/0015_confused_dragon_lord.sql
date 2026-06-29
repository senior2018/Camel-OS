CREATE TYPE "public"."media_sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TYPE "public"."media_source_type" AS ENUM('print', 'online', 'tv', 'radio', 'social');--> statement-breakpoint
CREATE TABLE "media_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"outlet" text,
	"source_type" "media_source_type" DEFAULT 'online' NOT NULL,
	"sentiment" "media_sentiment" DEFAULT 'neutral' NOT NULL,
	"url" text,
	"mention_date" date NOT NULL,
	"summary" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"escalation_note" text,
	"flagged_by_user_id" uuid,
	"flagged_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_mentions" ADD CONSTRAINT "media_mentions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_mentions" ADD CONSTRAINT "media_mentions_flagged_by_user_id_users_id_fk" FOREIGN KEY ("flagged_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_mentions" ADD CONSTRAINT "media_mentions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_mentions_org_idx" ON "media_mentions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "media_mentions_date_idx" ON "media_mentions" USING btree ("mention_date");