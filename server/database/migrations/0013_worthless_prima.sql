CREATE TABLE "opportunity_stage_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"stage" "opportunity_stage" NOT NULL,
	"label" text NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_stage_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_stage" "opportunity_stage" NOT NULL,
	"to_stage" "opportunity_stage" NOT NULL,
	"comment" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_stage_activities" ADD CONSTRAINT "opportunity_stage_activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_activities" ADD CONSTRAINT "opportunity_stage_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_activities" ADD CONSTRAINT "opportunity_stage_activities_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_transitions" ADD CONSTRAINT "opportunity_stage_transitions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_transitions" ADD CONSTRAINT "opportunity_stage_transitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_transitions" ADD CONSTRAINT "opportunity_stage_transitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_stage_activities_opp_stage_idx" ON "opportunity_stage_activities" USING btree ("opportunity_id","stage");--> statement-breakpoint
CREATE INDEX "opportunity_stage_activities_organization_id_idx" ON "opportunity_stage_activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_stage_transitions_opp_idx" ON "opportunity_stage_transitions" USING btree ("opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "opportunity_stage_transitions_organization_id_idx" ON "opportunity_stage_transitions" USING btree ("organization_id");