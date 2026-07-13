CREATE TYPE "public"."project_expense_request_status" AS ENUM('requested', 'approved', 'rejected', 'returned');--> statement-breakpoint
CREATE TABLE "project_expense_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"category" text,
	"amount" numeric(14, 2) NOT NULL,
	"status" "project_expense_request_status" DEFAULT 'requested' NOT NULL,
	"requested_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"decision_note" text,
	"spent_amount" numeric(14, 2),
	"receipt_url" text,
	"return_note" text,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_expense_requests" ADD CONSTRAINT "project_expense_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expense_requests" ADD CONSTRAINT "project_expense_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expense_requests" ADD CONSTRAINT "project_expense_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_expense_requests" ADD CONSTRAINT "project_expense_requests_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_expense_requests_project_idx" ON "project_expense_requests" USING btree ("project_id");