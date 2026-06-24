CREATE TYPE "public"."proposal_review_rule" AS ENUM('all', 'count', 'percent');--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "review_min_reviewers" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "review_rule" "proposal_review_rule" DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "review_threshold" integer;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "require_final_approver" boolean DEFAULT true NOT NULL;