CREATE TYPE "public"."opportunity_decision_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."proposal_assignment_role" AS ENUM('lead', 'technical_reviewer', 'finance_reviewer', 'compliance_reviewer', 'final_approver');--> statement-breakpoint
CREATE TYPE "public"."proposal_reviewer_status" AS ENUM('pending', 'approved', 'changes_required', 'rejected');--> statement-breakpoint
CREATE TABLE "opportunity_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "opportunity_decision_status" DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"roleType" "proposal_assignment_role" NOT NULL,
	"assigned_user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_reviewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"reviewerRole" "proposal_assignment_role" NOT NULL,
	"isRequired" boolean DEFAULT true NOT NULL,
	"status" "proposal_reviewer_status" DEFAULT 'pending' NOT NULL,
	"feedback" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "status" SET DEFAULT 'assigned'::text;--> statement-breakpoint
-- Remap legacy S7 statuses to the new workflow before the enum is recreated.
-- 'writing' no longer exists; existing drafts map to 'assigned' (no team yet).
UPDATE "proposals" SET "status" = 'assigned' WHERE "status" = 'writing';--> statement-breakpoint
DROP TYPE "public"."proposal_status";--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('assigned', 'drafting', 'awaiting_review', 'revision_required', 'rejected', 'ready_for_final_approval', 'awaiting_final_approval', 'final_approved', 'final_rejected', 'submitted', 'won', 'lost', 'shortlisted');--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "status" SET DEFAULT 'assigned'::"public"."proposal_status";--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "status" SET DATA TYPE "public"."proposal_status" USING "status"::"public"."proposal_status";--> statement-breakpoint
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_assignments" ADD CONSTRAINT "proposal_assignments_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_assignments" ADD CONSTRAINT "proposal_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_assignments" ADD CONSTRAINT "proposal_assignments_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_reviewers" ADD CONSTRAINT "proposal_reviewers_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_reviewers" ADD CONSTRAINT "proposal_reviewers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_reviewers" ADD CONSTRAINT "proposal_reviewers_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_activities_opportunity_id_idx" ON "opportunity_activities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_activities_created_at_idx" ON "opportunity_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "opportunity_decisions_opportunity_id_idx" ON "opportunity_decisions" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_decisions_status_idx" ON "opportunity_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposal_assignments_proposal_id_idx" ON "proposal_assignments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_assignments_assigned_user_id_idx" ON "proposal_assignments" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "proposal_assignments_role_type_idx" ON "proposal_assignments" USING btree ("roleType");--> statement-breakpoint
CREATE INDEX "proposal_reviewers_proposal_id_idx" ON "proposal_reviewers" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_reviewers_reviewer_user_id_idx" ON "proposal_reviewers" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "proposal_reviewers_status_idx" ON "proposal_reviewers" USING btree ("status");