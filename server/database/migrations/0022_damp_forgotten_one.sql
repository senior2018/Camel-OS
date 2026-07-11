CREATE TYPE "public"."kpi_direction" AS ENUM('increase', 'decrease');--> statement-breakpoint
CREATE TYPE "public"."strategy_status" AS ENUM('not_started', 'on_track', 'at_risk', 'off_track', 'achieved');--> statement-breakpoint
CREATE TABLE "departmental_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"objective_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"department" text,
	"owner_user_id" uuid,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"status" "strategy_status" DEFAULT 'not_started' NOT NULL,
	"due_date" date,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "individual_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"status" "strategy_status" DEFAULT 'not_started' NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategic_objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"theme" text,
	"owner_user_id" uuid,
	"manual_status" "strategy_status",
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	"summary" text,
	"rag_status" "strategy_status" DEFAULT 'on_track' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"baseline" numeric(16, 2) DEFAULT '0' NOT NULL,
	"target" numeric(16, 2),
	"current" numeric(16, 2) DEFAULT '0' NOT NULL,
	"direction" "kpi_direction" DEFAULT 'increase' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "departmental_goals" ADD CONSTRAINT "departmental_goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departmental_goals" ADD CONSTRAINT "departmental_goals_objective_id_strategic_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."strategic_objectives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departmental_goals" ADD CONSTRAINT "departmental_goals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departmental_goals" ADD CONSTRAINT "departmental_goals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_objectives" ADD CONSTRAINT "individual_objectives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_objectives" ADD CONSTRAINT "individual_objectives_goal_id_departmental_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."departmental_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "individual_objectives" ADD CONSTRAINT "individual_objectives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_objectives" ADD CONSTRAINT "strategic_objectives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_objectives" ADD CONSTRAINT "strategic_objectives_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_objectives" ADD CONSTRAINT "strategic_objectives_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_checkins" ADD CONSTRAINT "strategy_checkins_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_checkins" ADD CONSTRAINT "strategy_checkins_objective_id_strategic_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."strategic_objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_checkins" ADD CONSTRAINT "strategy_checkins_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_kpis" ADD CONSTRAINT "strategy_kpis_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_kpis" ADD CONSTRAINT "strategy_kpis_objective_id_strategic_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."strategic_objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "departmental_goals_org_idx" ON "departmental_goals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "departmental_goals_objective_idx" ON "departmental_goals" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "individual_objectives_goal_idx" ON "individual_objectives" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "individual_objectives_user_idx" ON "individual_objectives" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strategic_objectives_org_idx" ON "strategic_objectives" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "strategy_checkins_objective_idx" ON "strategy_checkins" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "strategy_kpis_objective_idx" ON "strategy_kpis" USING btree ("objective_id");