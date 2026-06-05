CREATE TYPE "public"."opportunity_comment_type" AS ENUM('comment', 'update');--> statement-breakpoint
CREATE TYPE "public"."opportunity_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('writing', 'submitted', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "opportunity_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "opportunity_comment_type" DEFAULT 'comment' NOT NULL,
	"body" text NOT NULL,
	"attachment_url" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "proposal_status" DEFAULT 'writing' NOT NULL,
	"deadline" date,
	"content_draft" text,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"reminder_recipient_user_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "status" "opportunity_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "win_probability" integer;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_comments" ADD CONSTRAINT "opportunity_comments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_comments" ADD CONSTRAINT "opportunity_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_comments" ADD CONSTRAINT "opportunity_comments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_comments_opportunity_id_idx" ON "opportunity_comments" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_comments_organization_id_idx" ON "opportunity_comments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_comments_created_at_idx" ON "opportunity_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "proposals_opportunity_id_idx" ON "proposals" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "proposals_organization_id_idx" ON "proposals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposals_deadline_idx" ON "proposals" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");--> statement-breakpoint

-- S7 — Backfill the new opportunity_status from legacy `stage`:
--   discovery / qualifying  → pending  (default, no-op)
--   proposal / submitted / won / lost → accepted (work is in flight or done)
-- Then create a matching proposal row for every opp that's past discovery so
-- the proposal page reflects the actual writing/submitted/won/lost state. No
-- proposal is created for pending opps — those haven't earned one yet.
UPDATE "opportunities"
SET "status" = 'accepted'
WHERE "stage" IN ('proposal', 'submitted', 'won', 'lost');--> statement-breakpoint

INSERT INTO "proposals" (
  "opportunity_id",
  "organization_id",
  "title",
  "status",
  "deadline",
  "created_by_user_id"
)
SELECT
  o."id",
  o."organization_id",
  o."title",
  CASE o."stage"
    WHEN 'proposal'  THEN 'writing'::"proposal_status"
    WHEN 'submitted' THEN 'submitted'::"proposal_status"
    WHEN 'won'       THEN 'won'::"proposal_status"
    WHEN 'lost'      THEN 'lost'::"proposal_status"
  END,
  o."deadline",
  o."owner_user_id"
FROM "opportunities" o
WHERE o."stage" IN ('proposal', 'submitted', 'won', 'lost');