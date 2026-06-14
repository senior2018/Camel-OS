CREATE TABLE "proposal_section_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"section_id" uuid,
	"organization_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"body" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "brainstorm" text;--> statement-breakpoint
ALTER TABLE "proposal_section_comments" ADD CONSTRAINT "proposal_section_comments_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_section_comments" ADD CONSTRAINT "proposal_section_comments_section_id_proposal_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."proposal_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_section_comments" ADD CONSTRAINT "proposal_section_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_section_comments" ADD CONSTRAINT "proposal_section_comments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_section_comments_proposal_id_idx" ON "proposal_section_comments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_section_comments_section_id_idx" ON "proposal_section_comments" USING btree ("section_id");