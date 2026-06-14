CREATE TYPE "public"."auth_provider" AS ENUM('local', 'google', 'microsoft');--> statement-breakpoint
CREATE TYPE "public"."client_interaction_type" AS ENUM('meeting', 'call', 'email', 'note', 'other', 'donor_reporting', 'grant_negotiation', 'partnership_meeting');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('client', 'prospect', 'donor', 'partner');--> statement-breakpoint
CREATE TYPE "public"."donor_grant_status" AS ENUM('pending', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."opportunity_comment_type" AS ENUM('comment', 'update');--> statement-breakpoint
CREATE TYPE "public"."opportunity_decision_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."opportunity_source" AS ENUM('tender', 'grant', 'partnership', 'referral', 'inbound', 'other');--> statement-breakpoint
CREATE TYPE "public"."opportunity_stage" AS ENUM('discovery', 'qualifying', 'proposal', 'submitted', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."opportunity_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type" AS ENUM('consulting', 'training', 'research', 'advisory', 'other');--> statement-breakpoint
CREATE TYPE "public"."organization_member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."partnership_agreement_status" AS ENUM('draft', 'active', 'expired', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."proposal_assignment_role" AS ENUM('lead', 'technical_reviewer', 'finance_reviewer', 'compliance_reviewer', 'final_approver');--> statement-breakpoint
CREATE TYPE "public"."proposal_reviewer_status" AS ENUM('pending', 'approved', 'changes_required', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('assigned', 'drafting', 'awaiting_review', 'revision_required', 'rejected', 'ready_for_final_approval', 'awaiting_final_approval', 'final_approved', 'final_rejected', 'submitted', 'won', 'lost', 'shortlisted');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('system_admin', 'org_admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'pending_verification');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"resource_id" text,
	"meta" jsonb,
	"prev_hash" text,
	"row_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" varchar(255),
	"password_hash" text,
	"mfa_secret" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_method" text DEFAULT 'totp' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_accounts_user_id_provider_unique" UNIQUE("user_id","provider"),
	CONSTRAINT "auth_accounts_provider_provider_user_id_unique" UNIQUE("provider","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"title" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid,
	"type" "client_interaction_type" DEFAULT 'note' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"summary" text NOT NULL,
	"follow_up_at" date,
	"follow_up_action" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"contact_id" uuid,
	"assigned_user_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"message" text NOT NULL,
	"completed_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"organization" text,
	"type" "client_type" DEFAULT 'prospect' NOT NULL,
	"industry" text,
	"country" text,
	"website" text,
	"phone" text,
	"email" text,
	"notes" text,
	"metadata" jsonb,
	"owner_user_id" uuid,
	"reminder_recipient_user_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_lookup_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_lookup_values_org_kind_key_uq" UNIQUE("organization_id","kind","key")
);
--> statement-breakpoint
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
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_email_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source" text DEFAULT 'other' NOT NULL,
	"type" text DEFAULT 'consulting' NOT NULL,
	"stage" "opportunity_stage" DEFAULT 'discovery' NOT NULL,
	"status" "opportunity_status" DEFAULT 'pending' NOT NULL,
	"win_probability" integer,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"deadline" date,
	"estimated_value" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"owner_user_id" uuid,
	"approved_to_pursue_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_clients" (
	"opportunity_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_clients_opportunity_id_client_id_pk" PRIMARY KEY("opportunity_id","client_id")
);
--> statement-breakpoint
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
CREATE TABLE "opportunity_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "opportunity_decision_status" DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
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
CREATE TABLE "password_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_policies" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"min_length" integer DEFAULT 8 NOT NULL,
	"require_uppercase" boolean DEFAULT false NOT NULL,
	"require_lowercase" boolean DEFAULT false NOT NULL,
	"require_number" boolean DEFAULT false NOT NULL,
	"require_symbol" boolean DEFAULT false NOT NULL,
	"expiry_days" integer,
	"history_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "proposal_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"roleType" "proposal_assignment_role" NOT NULL,
	"assigned_user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_reviewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"reviewerRole" "proposal_assignment_role" NOT NULL,
	"isRequired" boolean DEFAULT true NOT NULL,
	"status" "proposal_reviewer_status" DEFAULT 'pending' NOT NULL,
	"feedback" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "proposal_status" DEFAULT 'assigned' NOT NULL,
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
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_module_action_pk" PRIMARY KEY("role_id","module","action")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mfa_required" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_organization_id_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role_id" uuid,
	"invited_by_user_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by_user_id" uuid,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"avatar_url" text,
	"status" "user_status" DEFAULT 'pending_verification' NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"mfa_required" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"deactivated_at" timestamp with time zone,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_contact_id_client_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."client_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reminders" ADD CONSTRAINT "client_reminders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reminders" ADD CONSTRAINT "client_reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reminders" ADD CONSTRAINT "client_reminders_contact_id_client_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."client_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reminders" ADD CONSTRAINT "client_reminders_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reminders" ADD CONSTRAINT "client_reminders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_lookup_values" ADD CONSTRAINT "crm_lookup_values_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_grants" ADD CONSTRAINT "donor_grants_donor_id_clients_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_grants" ADD CONSTRAINT "donor_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_grants" ADD CONSTRAINT "donor_grants_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_projects" ADD CONSTRAINT "donor_projects_donor_id_clients_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_projects" ADD CONSTRAINT "donor_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_projects" ADD CONSTRAINT "donor_projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_projects" ADD CONSTRAINT "donor_projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_email_codes" ADD CONSTRAINT "mfa_email_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_activities" ADD CONSTRAINT "opportunity_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_attachments" ADD CONSTRAINT "opportunity_attachments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_attachments" ADD CONSTRAINT "opportunity_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_attachments" ADD CONSTRAINT "opportunity_attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_clients" ADD CONSTRAINT "opportunity_clients_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_clients" ADD CONSTRAINT "opportunity_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_clients" ADD CONSTRAINT "opportunity_clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_comments" ADD CONSTRAINT "opportunity_comments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_comments" ADD CONSTRAINT "opportunity_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_comments" ADD CONSTRAINT "opportunity_comments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_activities" ADD CONSTRAINT "opportunity_stage_activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_activities" ADD CONSTRAINT "opportunity_stage_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_activities" ADD CONSTRAINT "opportunity_stage_activities_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_transitions" ADD CONSTRAINT "opportunity_stage_transitions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_transitions" ADD CONSTRAINT "opportunity_stage_transitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_transitions" ADD CONSTRAINT "opportunity_stage_transitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_partner_id_clients_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_policies" ADD CONSTRAINT "password_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_assignments" ADD CONSTRAINT "proposal_assignments_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_assignments" ADD CONSTRAINT "proposal_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_assignments" ADD CONSTRAINT "proposal_assignments_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_reviewers" ADD CONSTRAINT "proposal_reviewers_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_reviewers" ADD CONSTRAINT "proposal_reviewers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_reviewers" ADD CONSTRAINT "proposal_reviewers_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "client_contacts_client_id_idx" ON "client_contacts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_contacts_organization_id_idx" ON "client_contacts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "client_contacts_email_idx" ON "client_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "client_interactions_client_id_idx" ON "client_interactions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_interactions_organization_id_idx" ON "client_interactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "client_interactions_contact_id_idx" ON "client_interactions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "client_interactions_occurred_at_idx" ON "client_interactions" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "client_reminders_client_id_idx" ON "client_reminders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_reminders_organization_id_idx" ON "client_reminders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "client_reminders_assigned_user_id_idx" ON "client_reminders" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "client_reminders_due_at_idx" ON "client_reminders" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "clients_organization_id_idx" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clients_owner_user_id_idx" ON "clients" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "clients_email_idx" ON "clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "crm_lookup_values_org_kind_idx" ON "crm_lookup_values" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE INDEX "donor_grants_donor_id_idx" ON "donor_grants" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "donor_grants_organization_id_idx" ON "donor_grants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "donor_grants_end_date_idx" ON "donor_grants" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "donor_grants_next_reporting_date_idx" ON "donor_grants" USING btree ("next_reporting_date");--> statement-breakpoint
CREATE INDEX "donor_projects_donor_id_idx" ON "donor_projects" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "donor_projects_project_id_idx" ON "donor_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "donor_projects_organization_id_idx" ON "donor_projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_email_codes_user_id_idx" ON "mfa_email_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mfa_recovery_codes_user_id_idx" ON "mfa_recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "opportunities_organization_id_idx" ON "opportunities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunities_stage_idx" ON "opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunities_owner_user_id_idx" ON "opportunities" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "opportunities_deadline_idx" ON "opportunities" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "opportunity_activities_opportunity_id_idx" ON "opportunity_activities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_activities_created_at_idx" ON "opportunity_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "opportunity_attachments_opportunity_id_idx" ON "opportunity_attachments" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_attachments_organization_id_idx" ON "opportunity_attachments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_clients_opportunity_id_idx" ON "opportunity_clients" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_clients_client_id_idx" ON "opportunity_clients" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "opportunity_clients_organization_id_idx" ON "opportunity_clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_comments_opportunity_id_idx" ON "opportunity_comments" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_comments_organization_id_idx" ON "opportunity_comments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_comments_created_at_idx" ON "opportunity_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "opportunity_decisions_opportunity_id_idx" ON "opportunity_decisions" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_decisions_status_idx" ON "opportunity_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunity_stage_activities_opp_stage_idx" ON "opportunity_stage_activities" USING btree ("opportunity_id","stage");--> statement-breakpoint
CREATE INDEX "opportunity_stage_activities_organization_id_idx" ON "opportunity_stage_activities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "opportunity_stage_transitions_opp_idx" ON "opportunity_stage_transitions" USING btree ("opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "opportunity_stage_transitions_organization_id_idx" ON "opportunity_stage_transitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "partnership_agreements_partner_id_idx" ON "partnership_agreements" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partnership_agreements_organization_id_idx" ON "partnership_agreements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "partnership_agreements_end_date_idx" ON "partnership_agreements" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "partnership_agreements_status_idx" ON "partnership_agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "password_history_user_id_idx" ON "password_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposal_assignments_proposal_id_idx" ON "proposal_assignments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_assignments_assigned_user_id_idx" ON "proposal_assignments" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "proposal_assignments_role_type_idx" ON "proposal_assignments" USING btree ("roleType");--> statement-breakpoint
CREATE INDEX "proposal_reviewers_proposal_id_idx" ON "proposal_reviewers" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_reviewers_reviewer_user_id_idx" ON "proposal_reviewers" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "proposal_reviewers_status_idx" ON "proposal_reviewers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposals_opportunity_id_idx" ON "proposals" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "proposals_organization_id_idx" ON "proposals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposals_deadline_idx" ON "proposals" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "roles_organization_id_idx" ON "roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_invitations_organization_id_idx" ON "user_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");