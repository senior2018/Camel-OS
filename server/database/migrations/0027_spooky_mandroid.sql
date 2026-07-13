CREATE TABLE "project_activity_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_project_settings" ADD COLUMN "activity_statuses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_project_settings" ADD COLUMN "lifecycle_labels" jsonb DEFAULT '{"notStarted":"Not started","inProgress":"In progress","done":"Completed"}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_activities" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "project_activities" ADD COLUMN "status_label" text DEFAULT 'Not started' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_activities" ADD COLUMN "status_category" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_activities" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD COLUMN "status_category" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "lifecycle_category" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_activity_comments" ADD CONSTRAINT "project_activity_comments_activity_id_project_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."project_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity_comments" ADD CONSTRAINT "project_activity_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity_comments" ADD CONSTRAINT "project_activity_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity_comments" ADD CONSTRAINT "project_activity_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_activity_comments_activity_idx" ON "project_activity_comments" USING btree ("activity_id");--> statement-breakpoint
ALTER TABLE "project_activities" ADD CONSTRAINT "project_activities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "project_activities" SET "status_category" = CASE "status" WHEN 'done' THEN 'done' WHEN 'in_progress' THEN 'in_progress' WHEN 'blocked' THEN 'in_progress' ELSE 'not_started' END, "status_label" = CASE "status" WHEN 'done' THEN 'Completed' WHEN 'in_progress' THEN 'In progress' WHEN 'blocked' THEN 'Blocked' ELSE 'Not started' END;--> statement-breakpoint
UPDATE "project_milestones" m SET "status_category" = COALESCE((SELECT CASE WHEN count(*) = 0 THEN 'not_started' WHEN count(*) FILTER (WHERE a."status_category" = 'done') = count(*) THEN 'done' WHEN count(*) FILTER (WHERE a."status_category" = 'not_started') = count(*) THEN 'not_started' ELSE 'in_progress' END FROM "project_activities" a WHERE a."milestone_id" = m."id"), 'not_started');--> statement-breakpoint
UPDATE "projects" p SET "lifecycle_category" = COALESCE((SELECT CASE WHEN count(*) = 0 THEN 'not_started' WHEN count(*) FILTER (WHERE m."status_category" = 'done') = count(*) THEN 'done' WHEN count(*) FILTER (WHERE m."status_category" = 'not_started') = count(*) THEN 'not_started' ELSE 'in_progress' END FROM "project_milestones" m WHERE m."project_id" = p."id"), 'not_started');
