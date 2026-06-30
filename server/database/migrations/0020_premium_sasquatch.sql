CREATE TYPE "public"."applicant_stage" AS ENUM('applied', 'screening', 'interview', 'offer', 'hired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."feedback_relationship" AS ENUM('self', 'manager', 'peer', 'report');--> statement-breakpoint
CREATE TYPE "public"."performance_review_status" AS ENUM('draft', 'collecting', 'completed');--> statement-breakpoint
CREATE TYPE "public"."vacancy_status" AS ENUM('open', 'on_hold', 'closed', 'filled');--> statement-breakpoint
CREATE TABLE "job_applicants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vacancy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"cv_url" text,
	"stage" "applicant_stage" DEFAULT 'applied' NOT NULL,
	"rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_vacancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"department" text,
	"description" text,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"location" text,
	"openings" integer DEFAULT 1 NOT NULL,
	"status" "vacancy_status" DEFAULT 'open' NOT NULL,
	"closing_date" date,
	"posted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"relationship" "feedback_relationship" DEFAULT 'peer' NOT NULL,
	"rating" integer,
	"strengths" text,
	"improvements" text,
	"comments" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "performance_feedback_review_reviewer_unique" UNIQUE("review_id","reviewer_user_id")
);
--> statement-breakpoint
CREATE TABLE "performance_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"period_label" text,
	"status" "performance_review_status" DEFAULT 'draft' NOT NULL,
	"overall_rating" integer,
	"summary" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_vacancy_id_job_vacancies_id_fk" FOREIGN KEY ("vacancy_id") REFERENCES "public"."job_vacancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD CONSTRAINT "job_vacancies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_vacancies" ADD CONSTRAINT "job_vacancies_posted_by_user_id_users_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_review_id_performance_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."performance_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_feedback" ADD CONSTRAINT "performance_feedback_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_applicants_vacancy_idx" ON "job_applicants" USING btree ("vacancy_id");--> statement-breakpoint
CREATE INDEX "job_vacancies_org_idx" ON "job_vacancies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "performance_feedback_review_idx" ON "performance_feedback" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "performance_reviews_org_idx" ON "performance_reviews" USING btree ("organization_id");