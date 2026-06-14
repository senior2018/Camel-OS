CREATE TYPE "public"."proposal_bd_note_kind" AS ENUM('client_comm', 'evaluator_feedback', 'note');--> statement-breakpoint
ALTER TYPE "public"."proposal_status" ADD VALUE 'under_evaluation';--> statement-breakpoint
ALTER TYPE "public"."proposal_status" ADD VALUE 'clarification_requested';--> statement-breakpoint
ALTER TYPE "public"."proposal_status" ADD VALUE 'contract_signed';--> statement-breakpoint
CREATE TABLE "proposal_bd_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "proposal_bd_note_kind" DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_bd_notes" ADD CONSTRAINT "proposal_bd_notes_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_bd_notes" ADD CONSTRAINT "proposal_bd_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_bd_notes" ADD CONSTRAINT "proposal_bd_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_bd_notes_proposal_id_idx" ON "proposal_bd_notes" USING btree ("proposal_id");