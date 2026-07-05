CREATE TABLE "organization_communications_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"review_min_reviewers" integer DEFAULT 1 NOT NULL,
	"review_rule" text DEFAULT 'all' NOT NULL,
	"review_threshold" integer,
	"require_final_approver" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_communications_settings" ADD CONSTRAINT "organization_communications_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;