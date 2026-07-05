CREATE TABLE "organization_project_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"report_sections" jsonb NOT NULL,
	"close_checklist" jsonb NOT NULL,
	"budget_categories" jsonb NOT NULL,
	"team_roles" jsonb NOT NULL,
	"require_budget_revision_approval" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_project_settings" ADD CONSTRAINT "organization_project_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;