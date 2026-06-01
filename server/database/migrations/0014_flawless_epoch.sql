CREATE TYPE "public"."partnership_agreement_status" AS ENUM('draft', 'active', 'expired', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."client_interaction_type" ADD VALUE 'donor_reporting';--> statement-breakpoint
ALTER TYPE "public"."client_interaction_type" ADD VALUE 'grant_negotiation';--> statement-breakpoint
ALTER TYPE "public"."client_interaction_type" ADD VALUE 'partnership_meeting';--> statement-breakpoint
CREATE TABLE "donor_projects" (
	"donor_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"funding_amount" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donor_projects_donor_id_project_id_pk" PRIMARY KEY("donor_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "partnership_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"value" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "partnership_agreement_status" DEFAULT 'draft' NOT NULL,
	"document_url" text,
	"notes" text,
	"renewal_notified_at_90" timestamp with time zone,
	"renewal_notified_at_30" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"start_date" date,
	"end_date" date,
	"total_budget" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donor_projects" ADD CONSTRAINT "donor_projects_donor_id_clients_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_projects" ADD CONSTRAINT "donor_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_projects" ADD CONSTRAINT "donor_projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_projects" ADD CONSTRAINT "donor_projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_partner_id_clients_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donor_projects_donor_id_idx" ON "donor_projects" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "donor_projects_project_id_idx" ON "donor_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "donor_projects_organization_id_idx" ON "donor_projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "partnership_agreements_partner_id_idx" ON "partnership_agreements" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partnership_agreements_organization_id_idx" ON "partnership_agreements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "partnership_agreements_end_date_idx" ON "partnership_agreements" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "partnership_agreements_status_idx" ON "partnership_agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");