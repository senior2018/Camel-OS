CREATE TABLE "knowledge_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_role_policy" (
	"organization_id" uuid NOT NULL,
	"category" text NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "notification_role_policy_organization_id_category_role_id_pk" PRIMARY KEY("organization_id","category","role_id")
);
--> statement-breakpoint
ALTER TABLE "knowledge_categories" ADD CONSTRAINT "knowledge_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_role_policy" ADD CONSTRAINT "notification_role_policy_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_role_policy" ADD CONSTRAINT "notification_role_policy_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_categories_org_idx" ON "knowledge_categories" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notification_role_policy_org_idx" ON "notification_role_policy" USING btree ("organization_id");