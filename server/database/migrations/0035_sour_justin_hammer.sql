CREATE TYPE "public"."feedback_category" AS ENUM('bug', 'idea', 'question', 'praise');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'triaged', 'resolved', 'wont_fix');--> statement-breakpoint
CREATE TYPE "public"."uat_status" AS ENUM('untested', 'pass', 'fail', 'blocked');--> statement-breakpoint
CREATE TABLE "feedback_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"category" "feedback_category" DEFAULT 'idea' NOT NULL,
	"message" text NOT NULL,
	"page_url" text,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "launch_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uat_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"module" text NOT NULL,
	"story_code" text,
	"title" text NOT NULL,
	"status" "uat_status" DEFAULT 'untested' NOT NULL,
	"notes" text,
	"tested_by_user_id" uuid,
	"tested_at" timestamp with time zone,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launch_tasks" ADD CONSTRAINT "launch_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uat_cases" ADD CONSTRAINT "uat_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uat_cases" ADD CONSTRAINT "uat_cases_tested_by_user_id_users_id_fk" FOREIGN KEY ("tested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_items_org_idx" ON "feedback_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "launch_tasks_org_idx" ON "launch_tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "uat_cases_org_idx" ON "uat_cases" USING btree ("organization_id");