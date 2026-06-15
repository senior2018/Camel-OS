CREATE TABLE "proposal_brainstorm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_section_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"saved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_bd_notes" ADD COLUMN "attachment_storage_key" text;--> statement-breakpoint
ALTER TABLE "proposal_bd_notes" ADD COLUMN "attachment_file_name" text;--> statement-breakpoint
ALTER TABLE "proposal_bd_notes" ADD COLUMN "attachment_mime_type" text;--> statement-breakpoint
ALTER TABLE "proposal_bd_notes" ADD COLUMN "attachment_file_size" integer;--> statement-breakpoint
ALTER TABLE "proposal_sections" ADD COLUMN "updated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "proposal_brainstorm_notes" ADD CONSTRAINT "proposal_brainstorm_notes_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_brainstorm_notes" ADD CONSTRAINT "proposal_brainstorm_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_brainstorm_notes" ADD CONSTRAINT "proposal_brainstorm_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_section_versions" ADD CONSTRAINT "proposal_section_versions_section_id_proposal_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."proposal_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_section_versions" ADD CONSTRAINT "proposal_section_versions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_section_versions" ADD CONSTRAINT "proposal_section_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_section_versions" ADD CONSTRAINT "proposal_section_versions_saved_by_user_id_users_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_brainstorm_notes_proposal_id_idx" ON "proposal_brainstorm_notes" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_section_versions_section_id_idx" ON "proposal_section_versions" USING btree ("section_id");--> statement-breakpoint
ALTER TABLE "proposal_sections" ADD CONSTRAINT "proposal_sections_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;