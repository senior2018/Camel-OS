CREATE TYPE "public"."mel_evaluation_status" AS ENUM('draft', 'open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."mel_level" AS ENUM('goal', 'outcome', 'output', 'indicator');--> statement-breakpoint
CREATE TYPE "public"."mel_question_type" AS ENUM('text', 'scale', 'multiple_choice');--> statement-breakpoint
CREATE TABLE "mel_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "mel_data_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"indicator_id" uuid NOT NULL,
	"period_date" date NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"note" text,
	"evidence_url" text,
	"entered_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mel_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "mel_evaluation_status" DEFAULT 'draft' NOT NULL,
	"public_token" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mel_evaluations_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "mel_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"level" "mel_level" DEFAULT 'indicator' NOT NULL,
	"name" text NOT NULL,
	"baseline" numeric(14, 2),
	"target" numeric(14, 2),
	"unit" text,
	"frequency" text,
	"data_source" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mel_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"sector" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mel_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"type" "mel_question_type" DEFAULT 'text' NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"required" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mel_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"respondent_name" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "portal_token" text;--> statement-breakpoint
ALTER TABLE "mel_answers" ADD CONSTRAINT "mel_answers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_answers" ADD CONSTRAINT "mel_answers_response_id_mel_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."mel_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_answers" ADD CONSTRAINT "mel_answers_question_id_mel_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."mel_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_data_points" ADD CONSTRAINT "mel_data_points_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_data_points" ADD CONSTRAINT "mel_data_points_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_data_points" ADD CONSTRAINT "mel_data_points_indicator_id_mel_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."mel_indicators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_data_points" ADD CONSTRAINT "mel_data_points_entered_by_user_id_users_id_fk" FOREIGN KEY ("entered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_evaluations" ADD CONSTRAINT "mel_evaluations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_evaluations" ADD CONSTRAINT "mel_evaluations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_evaluations" ADD CONSTRAINT "mel_evaluations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_indicators" ADD CONSTRAINT "mel_indicators_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_indicators" ADD CONSTRAINT "mel_indicators_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_lessons" ADD CONSTRAINT "mel_lessons_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_lessons" ADD CONSTRAINT "mel_lessons_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_lessons" ADD CONSTRAINT "mel_lessons_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_questions" ADD CONSTRAINT "mel_questions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_questions" ADD CONSTRAINT "mel_questions_evaluation_id_mel_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."mel_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_responses" ADD CONSTRAINT "mel_responses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mel_responses" ADD CONSTRAINT "mel_responses_evaluation_id_mel_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."mel_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mel_answers_response_idx" ON "mel_answers" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "mel_data_points_indicator_idx" ON "mel_data_points" USING btree ("indicator_id");--> statement-breakpoint
CREATE INDEX "mel_evaluations_org_idx" ON "mel_evaluations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mel_indicators_project_idx" ON "mel_indicators" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "mel_lessons_org_idx" ON "mel_lessons" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "mel_questions_evaluation_idx" ON "mel_questions" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "mel_responses_evaluation_idx" ON "mel_responses" USING btree ("evaluation_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_portal_token_unique" UNIQUE("portal_token");