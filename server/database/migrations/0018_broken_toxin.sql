ALTER TABLE "project_vendors" ADD COLUMN "budget_category" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget_revision_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget_revision_note" text;