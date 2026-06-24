CREATE TYPE "public"."proposal_message_kind" AS ENUM('message', 'system');--> statement-breakpoint
CREATE TABLE "proposal_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "proposal_message_kind" DEFAULT 'message' NOT NULL,
	"body" text NOT NULL,
	"event_type" text,
	"author_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_messages" ADD CONSTRAINT "proposal_messages_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_messages" ADD CONSTRAINT "proposal_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_messages" ADD CONSTRAINT "proposal_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_messages_proposal_id_idx" ON "proposal_messages" USING btree ("proposal_id");