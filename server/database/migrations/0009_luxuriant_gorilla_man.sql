CREATE TYPE "public"."donor_grant_status" AS ENUM('pending', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "donor_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"total_value" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"reporting_schedule" text,
	"next_reporting_date" date,
	"status" "donor_grant_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"end_date_notified_at" timestamp with time zone,
	"next_reporting_notified_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donor_grants" ADD CONSTRAINT "donor_grants_donor_id_clients_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_grants" ADD CONSTRAINT "donor_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_grants" ADD CONSTRAINT "donor_grants_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donor_grants_donor_id_idx" ON "donor_grants" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "donor_grants_organization_id_idx" ON "donor_grants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "donor_grants_end_date_idx" ON "donor_grants" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "donor_grants_next_reporting_date_idx" ON "donor_grants" USING btree ("next_reporting_date");