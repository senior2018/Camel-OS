CREATE TABLE "release_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"released_at" date NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD COLUMN "video_url" text;--> statement-breakpoint
ALTER TABLE "release_notes" ADD CONSTRAINT "release_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_notes" ADD CONSTRAINT "release_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "release_notes_org_idx" ON "release_notes" USING btree ("organization_id");