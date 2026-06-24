ALTER TYPE "public"."proposal_assignment_role" ADD VALUE 'commenter';--> statement-breakpoint
ALTER TYPE "public"."proposal_assignment_role" ADD VALUE 'viewer';--> statement-breakpoint
CREATE TABLE "organization_proposal_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"roles" jsonb NOT NULL,
	"outcome_stages" jsonb NOT NULL,
	"review_min_reviewers" integer DEFAULT 3 NOT NULL,
	"review_rule" "proposal_review_rule" DEFAULT 'all' NOT NULL,
	"review_threshold" integer,
	"require_final_approver" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_assignments" ADD COLUMN "role_label" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "roles_override" jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "outcome_stages_override" jsonb;--> statement-breakpoint
ALTER TABLE "organization_proposal_settings" ADD CONSTRAINT "organization_proposal_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;