ALTER TABLE "project_reports" ADD COLUMN "kind" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_reports" ADD COLUMN "activity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_reports" ADD COLUMN "visible_to_members" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_reports" ADD COLUMN "approver_user_id" uuid;--> statement-breakpoint
ALTER TABLE "project_reports" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "project_reports" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;