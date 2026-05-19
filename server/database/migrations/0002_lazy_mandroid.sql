CREATE TYPE "public"."opportunity_source" AS ENUM('tender', 'grant', 'partnership', 'referral', 'inbound', 'other');--> statement-breakpoint
CREATE TYPE "public"."opportunity_stage" AS ENUM('discovery', 'qualifying', 'proposal', 'submitted', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type" AS ENUM('consulting', 'training', 'research', 'advisory', 'other');--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source" "opportunity_source" DEFAULT 'other' NOT NULL,
	"type" "opportunity_type" DEFAULT 'consulting' NOT NULL,
	"stage" "opportunity_stage" DEFAULT 'discovery' NOT NULL,
	"deadline" date,
	"estimated_value" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"win_probability" integer,
	"tags" text[],
	"owner_user_id" uuid,
	"approved_to_pursue_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunities_organization_id_idx" ON "opportunities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunities_stage_idx" ON "opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "opportunities_owner_user_id_idx" ON "opportunities" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "opportunities_deadline_idx" ON "opportunities" USING btree ("deadline");