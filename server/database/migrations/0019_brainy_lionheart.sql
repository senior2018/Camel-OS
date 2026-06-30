CREATE TYPE "public"."timesheet_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "growth_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"period_label" text,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_plans_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "timesheet_entries" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD COLUMN "task_label" text;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD COLUMN "week_start_date" date;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD COLUMN "status" timesheet_status DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD COLUMN "decision_note" text;--> statement-breakpoint
ALTER TABLE "growth_plans" ADD CONSTRAINT "growth_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_plans" ADD CONSTRAINT "growth_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_plans" ADD CONSTRAINT "growth_plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "growth_plans_org_idx" ON "growth_plans" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "timesheet_entries" ADD CONSTRAINT "timesheet_entries_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "timesheet_entries_user_week_idx" ON "timesheet_entries" USING btree ("user_id","week_start_date");