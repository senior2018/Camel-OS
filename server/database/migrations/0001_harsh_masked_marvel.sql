CREATE TYPE "public"."proposal_writing_mode" AS ENUM('in_system', 'upload', 'both');--> statement-breakpoint
ALTER TYPE "public"."proposal_assignment_role" ADD VALUE 'contributor' BEFORE 'technical_reviewer';--> statement-breakpoint
ALTER TYPE "public"."proposal_assignment_role" ADD VALUE 'reviewer' BEFORE 'technical_reviewer';--> statement-breakpoint
CREATE TABLE "proposal_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"brief" text,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"assigned_to_user_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "writing_mode" "proposal_writing_mode" DEFAULT 'in_system' NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "submission_reference" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "submission_channel" text;--> statement-breakpoint
ALTER TABLE "proposal_attachments" ADD CONSTRAINT "proposal_attachments_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_attachments" ADD CONSTRAINT "proposal_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_attachments" ADD CONSTRAINT "proposal_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_attachments_proposal_id_idx" ON "proposal_attachments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_attachments_organization_id_idx" ON "proposal_attachments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proposal_sections_proposal_id_idx" ON "proposal_sections" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_sections_assigned_to_user_id_idx" ON "proposal_sections" USING btree ("assigned_to_user_id");